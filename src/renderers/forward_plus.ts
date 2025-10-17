import {
  Renderer,
  device,
  modelBindGroupLayout,
  materialBindGroupLayout,
  vertexBufferLayout,
  canvasFormat,
  context,
  canvas,
} from "../renderer";
import { naiveVertSrc, forwardPlusFragSrc, constants } from "../shaders/shaders";
import { Stage } from "../stage/stage";

export class ForwardPlusRenderer extends Renderer {
  sceneUniformsBindGroupLayout: GPUBindGroupLayout;
  sceneUniformsBindGroup: GPUBindGroup;

  depthTexture: GPUTexture;

  pipeline: GPURenderPipeline;

  constructor(stage: Stage) {
    super(stage);

    // TODO-2: initialize layouts, pipelines, textures, etc. needed for Forward+ here
    this.sceneUniformsBindGroupLayout = device.createBindGroupLayout({
      label: "F+ scene uniforms bind group layout",
      entries: [
        {
          // Camera uniforms
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
        {
          // Light set
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "read-only-storage" },
        },
        {
          // Cluster set storage buffer
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "read-only-storage" },
        },
        {
          // Num slices uniform buffer
          binding: 3,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
        {
          // Dimensions uniform buffer
          binding: 4,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    });

    this.sceneUniformsBindGroup = device.createBindGroup({
      label: "F+ scene uniforms bind group",
      layout: this.sceneUniformsBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.camera.uniformsBuffer } },
        { binding: 1, resource: { buffer: this.lights.lightSetStorageBuffer } },
        { binding: 2, resource: { buffer: this.lights.clusterSetStorageBuffer } },
        { binding: 3, resource: { buffer: this.lights.numSlicesUniformBuffer } },
        { binding: 4, resource: { buffer: this.lights.dimensionsUniformBuffer } },
      ],
    });

    this.depthTexture = device.createTexture({
      size: [canvas.width, canvas.height],
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    this.pipeline = device.createRenderPipeline({
      label: "F+ render pipeline",
      layout: device.createPipelineLayout({
        label: "F+ render pipeline layout",
        bindGroupLayouts: [
          this.sceneUniformsBindGroupLayout,
          modelBindGroupLayout,
          materialBindGroupLayout,
        ],
      }),
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth24plus",
      },
      vertex: {
        module: device.createShaderModule({
          label: "F+ vertex shader (same as naive)",
          code: naiveVertSrc,
        }),
        buffers: [vertexBufferLayout],
      },
      fragment: {
        module: device.createShaderModule({
          label: "F+ fragment shader",
          code: forwardPlusFragSrc,
        }),
        targets: [
          {
            format: canvasFormat,
          },
        ],
      },
    });
  }

  override draw() {
    // TODO-2: run the Forward+ rendering pass:
    // - run the clustering compute shader
    // - run the main rendering pass, using the computed clusters for efficient lighting
    const encoder = device.createCommandEncoder();
    const canvasTextureView = context.getCurrentTexture().createView();

    this.lights.doLightClustering(encoder);

    const renderPass = encoder.beginRenderPass({
      label: "F+ render pass",
      colorAttachments: [
        {
          view: canvasTextureView,
          clearValue: [0, 0, 0, 0],
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: this.depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });
    renderPass.setPipeline(this.pipeline);

    renderPass.setBindGroup(constants.bindGroup_scene, this.sceneUniformsBindGroup);

    this.scene.iterate(
      (node) => renderPass.setBindGroup(constants.bindGroup_model, node.modelBindGroup),
      (material) =>
        renderPass.setBindGroup(constants.bindGroup_material, material.materialBindGroup),
      (primitive) => {
        renderPass.setVertexBuffer(0, primitive.vertexBuffer);
        renderPass.setIndexBuffer(primitive.indexBuffer, "uint32");
        renderPass.drawIndexed(primitive.numIndices);
      }
    );

    renderPass.end();
    device.queue.submit([encoder.finish()]);
  }
}
