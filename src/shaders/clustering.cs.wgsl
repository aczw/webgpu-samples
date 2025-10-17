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
}
