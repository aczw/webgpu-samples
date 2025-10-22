// This shader should be very simple as it does not need all of the information passed by the the naive vertex shader.

const positions = array(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0)
);

@vertex
fn main(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
    return vec4<f32>(positions[index], 0.0, 1.0);
}
