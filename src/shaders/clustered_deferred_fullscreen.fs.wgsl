// Similar to the Forward+ fragment shader, but with vertex information coming from the G-buffer instead.

@group(0) @binding(0) var<uniform> camera: CameraUniforms;
@group(0) @binding(1) var<storage, read> lightSet: LightSet;
@group(0) @binding(2) var<storage, read> clusterSet: ClusterSet;
@group(0) @binding(3) var<uniform> numSlices: vec3<u32>;
@group(0) @binding(4) var<uniform> dimensions: vec2<u32>;

@group(0) @binding(5) var posTex: texture_2d<f32>;
@group(0) @binding(6) var norTex: texture_2d<f32>;
@group(0) @binding(7) var albedoTex: texture_2d<f32>;

@fragment
fn main(@builtin(position) position: vec4<f32>) -> @location(0) vec4f {
    let pixel = vec2<i32>(floor(position.xy));
    
    let worldPos = vec4<f32>(textureLoad(posTex, pixel, 0).xyz, 1.0);
    let normal: vec3<f32> = textureLoad(norTex, pixel, 0).xyz;
    let albedo: vec4<f32> = textureLoad(albedoTex, pixel, 0);

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
    var numLights = clusterSet.clusters[index].numLights;
    var lightSum = vec3<f32>();

    for (var clusterLightIndex = 0u; clusterLightIndex < numLights; clusterLightIndex++) {
        let lightIndex = clusterSet.clusters[index].lights[clusterLightIndex];
        let light = lightSet.lights[lightIndex];
        lightSum += calculateLightContrib(light, worldPos.xyz, normalize(normal));
    }

    return albedo * vec4<f32>(lightSum, 1.0);
}
