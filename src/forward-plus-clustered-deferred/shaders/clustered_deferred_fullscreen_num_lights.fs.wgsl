@group(0) @binding(0) var<uniform> camera: CameraUniforms;
@group(0) @binding(2) var<storage, read> clusterSet: ClusterSet;
@group(0) @binding(3) var<uniform> numSlices: vec3<u32>;
@group(0) @binding(4) var<uniform> dimensions: vec2<u32>;

@group(0) @binding(5) var posTex: texture_2d<f32>;

@fragment
fn main(@builtin(position) position: vec4<f32>) -> @location(0) vec4f {
    let pixel = vec2<i32>(floor(position.xy));
    let worldPos = vec4<f32>(textureLoad(posTex, pixel, 0).xyz, 1.0);

    let clip: vec4<f32> = camera.viewProjection * worldPos;
    let ndc: vec3<f32> = clip.xyz / clip.w;
    let uv: vec2<f32> = (ndc.xy + 1.0) * 0.5;

    // Truncate to find cluster indices
    let clusterX = u32(uv.x * f32(dimensions.x) / f32(${clusterPixelWidth}));
    let clusterY = u32(uv.y * f32(dimensions.y) / f32(${clusterPixelHeight}));

    // Since our depth slices aren't linearly spaced, we have to derive it. And since
    // we did the original z-value calculations in view space, we do the same here
    let viewPos: vec4<f32> = camera.view * worldPos;
    let logFarNearInv: f32 = 1.0 / log(camera.farPlane / camera.nearPlane);
    let clusterZ = u32(
        (log(-viewPos.z) * f32(numSlices.z) * logFarNearInv) -
        (f32(numSlices.z) * log(camera.nearPlane) * logFarNearInv)
    );

    let index = (clusterZ * numSlices.x * numSlices.y) + (clusterY * numSlices.x) + clusterX;
    let ratio = 1.0 - f32(clusterSet.clusters[index].numLights) / f32(${maxLightsInCluster});
    let val = ratio * ratio * ratio * ratio;

    return vec4<f32>(val, val, val, 1.0);
}
