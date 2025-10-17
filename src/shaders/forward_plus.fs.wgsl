// TODO-2: implement the Forward+ fragment shader

// See naive.fs.wgsl for basic fragment shader setup; this shader should use light clusters instead of looping over all lights

// ------------------------------------
// Shading process:
// ------------------------------------
// Determine which cluster contains the current fragment.
// Retrieve the number of lights that affect the current fragment from the cluster’s data.
// Initialize a variable to accumulate the total light contribution for the fragment.
// For each light in the cluster:
//     Access the light's properties using its index.
//     Calculate the contribution of the light based on its position, the fragment’s position, and the surface normal.
//     Add the calculated contribution to the total light accumulation.
// Multiply the fragment’s diffuse color by the accumulated light contribution.
// Return the final color, ensuring that the alpha component is set appropriately (typically to 1).

@group(${bindGroup_scene}) @binding(0) var<uniform> camera: CameraUniforms;
@group(${bindGroup_scene}) @binding(1) var<storage, read> lightSet: LightSet;
@group(${bindGroup_scene}) @binding(2) var<storage, read> clusterSet: ClusterSet;
@group(${bindGroup_scene}) @binding(3) var<uniform> numSlices: vec3<u32>;
@group(${bindGroup_scene}) @binding(4) var<uniform> dimensions: vec2<u32>;

@group(${bindGroup_material}) @binding(0) var diffuseTex: texture_2d<f32>;
@group(${bindGroup_material}) @binding(1) var diffuseTexSampler: sampler;

struct FragmentInput
{
    @builtin(position) pixel: vec4<f32>,
    @location(0) pos: vec3f,
    @location(1) nor: vec3f,
    @location(2) uv: vec2f
}

@fragment
fn main(in: FragmentInput) -> @location(0) vec4f
{
    let diffuseColor = textureSample(diffuseTex, diffuseTexSampler, in.uv);
    
    if (diffuseColor.a < 0.5) {
        discard;
    }

    let clip: vec4<f32> = camera.viewProjection * vec4<f32>(in.pos, 1.0);
    let ndc: vec3<f32> = clip.xyz / clip.w;
    let uv: vec2<f32> = (ndc.xy + 1.0) * 0.5;

    // Truncate to find cluster indices
    let clusterX = u32(uv.x * f32(dimensions.x) / f32(${clusterPixelWidth}));
    let clusterY = u32(uv.y * f32(dimensions.y) / f32(${clusterPixelHeight}));

    // Since our depth slices aren't linearly spaced, we have to derive it. And since
    // we did the original z-value calculations in view space, we do the same here
    let viewPos: vec4<f32> = camera.view * vec4<f32>(in.pos, 1.0);
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
        lightSum += calculateLightContrib(light, in.pos, normalize(in.nor));
    }

    let finalColor = diffuseColor.rgb * lightSum;
    return vec4<f32>(finalColor, 1.0);
}
