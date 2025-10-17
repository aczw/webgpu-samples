// TODO-2: implement the light clustering compute shader

// ------------------------------------
// Calculating cluster bounds:
// ------------------------------------
// For each cluster (X, Y, Z):
//     - Calculate the screen-space bounds for this cluster in 2D (XY).
//     - Calculate the depth bounds for this cluster in Z (near and far planes).
//     - Convert these screen and depth bounds into view-space coordinates.
//     - Store the computed bounding box (AABB) for the cluster.

// ------------------------------------
// Assigning lights to clusters:
// ------------------------------------
// For each cluster:
//     - Initialize a counter for the number of lights in this cluster.

//     For each light:
//         - Check if the light intersects with the cluster’s bounding box (AABB).
//         - If it does, add the light to the cluster's light list.
//         - Stop adding lights if the maximum number of lights is reached.

//     - Store the number of lights assigned to this cluster.

@group(0) @binding(0) var<storage, read> lightSet: LightSet;
@group(0) @binding(1) var<uniform> camera: CameraUniforms;
@group(0) @binding(2) var<uniform> dimensions: vec2<u32>;
@group(0) @binding(3) var<uniform> numSlices: vec3<u32>;
@group(0) @binding(4) var<storage, read_write> clusterSet: ClusterSet;

const pixelWidth: u32 = ${clusterPixelWidth};
const pixelHeight: u32 = ${clusterPixelHeight};

fn screenToView(point: vec2<f32>) -> vec4<f32> {
    // Convert to NDC
    let uv = point / vec2<f32>(dimensions);
    let ndc: vec2<f32> = 2.0 * uv - 1.0;

    // Convert to view space and undo perspective projection
    var view = camera.inverseProjection * vec4<f32>(ndc, -1.0, 1.0);
    view /= view.w;
    
    return view;
}

// While the bounds are now in view space, we picked an arbitrary z-value (-1.0) for the
// NDC-to-view conversion. We now need to translate this point to the actual z-value we want
fn moveToDepth(point: vec3<f32>, depth: f32) -> vec3<f32> {
    let amount = depth / -point.z;
    return amount * point;
}

// Adapted from https://stackoverflow.com/questions/28343716/sphere-intersection-test-of-aabb
fn testSphereAabbIsect(center: vec3<f32>, min: vec3<f32>, max: vec3<f32>) -> bool {
    var sum: f32 = 0.0;

    for (var dir = 0; dir < 3; dir++) {
        let val = center[dir];
        if (val < min[dir]) { sum += (min[dir] - val) * (min[dir] - val); }
        if (val > max[dir]) { sum += (val - max[dir]) * (val - max[dir]); }
    }

    return sum <= (${lightRadius} * ${lightRadius});
}

@compute
@workgroup_size(
    ${clusteringWorkgroupSize.x},
    ${clusteringWorkgroupSize.y},
    ${clusteringWorkgroupSize.z}
)
fn main(@builtin(global_invocation_id) cluster: vec3<u32>) {
    if (cluster.x >= numSlices.x || cluster.y >= numSlices.y || cluster.z >= numSlices.z) {
        return;
    }

    // Bounds of this cluster in screen space, from bottom left to top right
    let minScreen = vec2<u32>(cluster.x * pixelWidth, cluster.y * pixelHeight);
    let maxScreen = vec2<u32>((cluster.x + 1) * pixelWidth, (cluster.y + 1) * pixelHeight);

    // Convert bounds to view space
    let minView: vec4<f32> = screenToView(vec2<f32>(minScreen));
    let maxView: vec4<f32> = screenToView(vec2<f32>(maxScreen));

    // Find the near and far values for this cluster. Use an exponential calculation
    // because the depth range is not linear
    let near = camera.nearPlane;
    let far = camera.farPlane;
    let clusterNear = near * pow(far / near, f32(cluster.z) / f32(numSlices.z));
    let clusterFar = near * pow(far / near, f32(cluster.z + 1) / f32(numSlices.z));

    // Get each corner of the cluster bound. Z-value can be taken from either one
    let corner00 = vec3<f32>(minView.xyz);
    let corner01 = vec3<f32>(minView.x, maxView.y, maxView.z);
    let corner10 = vec3<f32>(maxView.x, minView.y, minView.z);
    let corner11 = vec3<f32>(maxView.xyz);

    let nearCorner00 = moveToDepth(corner00, clusterNear);
    let nearCorner01 = moveToDepth(corner01, clusterNear);
    let nearCorner10 = moveToDepth(corner10, clusterNear);
    let nearCorner11 = moveToDepth(corner11, clusterNear);
    let farCorner00 = moveToDepth(corner00, clusterFar);
    let farCorner01 = moveToDepth(corner01, clusterFar);
    let farCorner10 = moveToDepth(corner10, clusterFar);
    let farCorner11 = moveToDepth(corner11, clusterFar);

    // Calculate bounding box for cluster
    let min = min(
        min(min(nearCorner00, nearCorner01), min(nearCorner10, nearCorner11)),
        min(min(farCorner00, farCorner01), min(farCorner10, farCorner11))
    );
    let max = max(
        max(max(nearCorner00, nearCorner01), max(nearCorner10, nearCorner11)),
        max(max(farCorner00, farCorner01), max(farCorner10, farCorner11))
    );

    let index = (cluster.z * numSlices.x * numSlices.y) + (cluster.y * numSlices.x) + cluster.x;
    var numLights: u32 = 0;

    for (var lightIndex = 0u; lightIndex < lightSet.numLights; lightIndex++) {
        if (numLights >= ${maxLightsInCluster}) {
            break;
        }

        let center: vec3<f32> = lightSet.lights[lightIndex].pos;
        if (testSphereAabbIsect(center, min, max)) {
            clusterSet.clusters[index].lights[numLights] = lightIndex;
            numLights++;
        }
    }

    clusterSet.clusters[index].numLights = numLights;
}
