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
import {
  naiveVertSrc,
  constants,
  clusteredDeferredFullscreenFragSrc,
  clusteredDeferredFragSrc,
} from "../shaders/shaders";
import { Camera } from "../stage/camera";
import { Stage } from "../stage/stage";

export class ClusteredDeferredRenderer extends Renderer {
  positionTexture: GPUTexture;
  normalTexture: GPUTexture;
  albedoTexture: GPUTexture;
  depthTexture: GPUTexture;

  positionTextureView: GPUTextureView;
  normalTextureView: GPUTextureView;
  albedoTextureView: GPUTextureView;

  gBufferBgl: GPUBindGroupLayout;
  gBufferBg: GPUBindGroup;
  gBufferPipeline: GPURenderPipeline;

  renderBgl: GPUBindGroupLayout;
  renderBg: GPUBindGroup;
  renderPipeline: GPURenderPipeline;

  constructor(stage: Stage) {
    super(stage);

    this.positionTexture = device.createTexture({
      label: "G-buffer position texture",
      size: [canvas.width, canvas.height],
      format: "rgba16float",
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.positionTextureView = this.positionTexture.createView({ label: "Position texture view" });

    this.normalTexture = device.createTexture({
      label: "G-buffer normal texture",
      size: [canvas.width, canvas.height],
      format: "rgba16float",
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.normalTextureView = this.normalTexture.createView({ label: "Normal texture view" });

    this.albedoTexture = device.createTexture({
      label: "G-buffer albedo texture",
      size: [canvas.width, canvas.height],
      format: "bgra8unorm",
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.albedoTextureView = this.albedoTexture.createView({ label: "Albedo texture view" });

    this.depthTexture = device.createTexture({
      label: "Depth texture",
      size: [canvas.width, canvas.height],
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    this.gBufferBgl = device.createBindGroupLayout({
      label: "Deferred g-buffer bind group layout",
      entries: [
        {
          // Camera uniforms
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "uniform" },
        },
      ],
    });

    this.gBufferBg = device.createBindGroup({
      label: "Deferred g-buffer bind group",
      layout: this.gBufferBgl,
      entries: [{ binding: 0, resource: { buffer: this.camera.uniformsBuffer } }],
    });

    this.gBufferPipeline = device.createRenderPipeline({
      label: "Deferred g-buffer pipeline",
      layout: device.createPipelineLayout({
        label: "Deferred g-buffer pipeline layout",
        bindGroupLayouts: [this.gBufferBgl, modelBindGroupLayout, materialBindGroupLayout],
      }),
      vertex: {
        module: device.createShaderModule({
          label: "Deferred g-buffer vertex shader (same as naive)",
          code: naiveVertSrc,
        }),
        buffers: [vertexBufferLayout],
      },
      fragment: {
        module: device.createShaderModule({
          label: "Deferred g-buffer fragment shader",
          code: clusteredDeferredFragSrc,
        }),
        targets: [
          { format: "rgba16float" }, // Position
          { format: "rgba16float" }, // Normal
          { format: "bgra8unorm" }, // Albedo
        ],
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth24plus",
      },
    });

    // this.renderBgl = device.createBindGroupLayout({
    //   label: "Deferred render bind group layout",
    //   entries: [
    //     {
    //       // Camera uniforms
    //       binding: 0,
    //       visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
    //       buffer: { type: "uniform" },
    //     },
    //     {
    //       // Light set
    //       binding: 1,
    //       visibility: GPUShaderStage.FRAGMENT,
    //       buffer: { type: "read-only-storage" },
    //     },
    //     {
    //       // Cluster set storage buffer
    //       binding: 2,
    //       visibility: GPUShaderStage.FRAGMENT,
    //       buffer: { type: "read-only-storage" },
    //     },
    //     {
    //       // Num slices uniform buffer
    //       binding: 3,
    //       visibility: GPUShaderStage.FRAGMENT,
    //       buffer: { type: "uniform" },
    //     },
    //     {
    //       // Dimensions uniform buffer
    //       binding: 4,
    //       visibility: GPUShaderStage.FRAGMENT,
    //       buffer: { type: "uniform" },
    //     },
    //   ],
    // });

    // this.renderBg = device.createBindGroup({
    //   label: "Deferred render bind group",
    //   layout: this.renderBgl,
    //   entries: [
    //     { binding: 0, resource: { buffer: this.camera.uniformsBuffer } },
    //     { binding: 1, resource: { buffer: this.lights.lightSetStorageBuffer } },
    //     { binding: 2, resource: { buffer: this.lights.clusterSetStorageBuffer } },
    //     { binding: 3, resource: { buffer: this.lights.numSlicesUniformBuffer } },
    //     { binding: 4, resource: { buffer: this.lights.dimensionsUniformBuffer } },
    //   ],
    // });

    // this.renderPipeline = device.createRenderPipeline({
    //   label: "Deferred render pipeline",
    //   layout: device.createPipelineLayout({
    //     label: "Deferred render pipeline layout",
    //     bindGroupLayouts: [this.gBufferBgl, modelBindGroupLayout, materialBindGroupLayout],
    //   }),
    //   depthStencil: {
    //     depthWriteEnabled: true,
    //     depthCompare: "less",
    //     format: "depth24plus",
    //   },
    //   vertex: {
    //     module: device.createShaderModule({
    //       label: "Deferred vertex shader (same as naive)",
    //       code: naiveVertSrc,
    //     }),
    //     buffers: [vertexBufferLayout],
    //   },
    //   fragment: {
    //     module: device.createShaderModule({
    //       label: "Deferred fullscreen fragment shader",
    //       code: clusteredDeferredFullscreenFragSrc,
    //     }),
    //     targets: [
    //       {
    //         format: canvasFormat,
    //       },
    //     ],
    //   },
    // });
  }

  override draw() {
    const encoder = device.createCommandEncoder();
    const canvasTextureView = context.getCurrentTexture().createView();

    this.lights.doLightClustering(encoder);

    {
      const gBufferPass = encoder.beginRenderPass({
        label: "Deferred g-buffer pass",
        colorAttachments: [
          {
            // Position
            view: this.positionTextureView,
            clearValue: [0.0, 0.0, 0.0, 1.0],
            loadOp: "clear",
            storeOp: "store",
          },
          {
            // Normal
            view: this.normalTextureView,
            clearValue: [0.0, 0.0, 0.0, 1.0],
            loadOp: "clear",
            storeOp: "store",
          },
          {
            // Albedo
            view: this.albedoTextureView,
            clearValue: [0.0, 0.0, 0.0, 1.0],
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

      gBufferPass.setPipeline(this.gBufferPipeline);
      gBufferPass.setBindGroup(constants.bindGroup_scene, this.gBufferBg);

      this.scene.iterate(
        (node) => gBufferPass.setBindGroup(constants.bindGroup_model, node.modelBindGroup),
        (material) =>
          gBufferPass.setBindGroup(constants.bindGroup_material, material.materialBindGroup),
        (primitive) => {
          gBufferPass.setVertexBuffer(0, primitive.vertexBuffer);
          gBufferPass.setIndexBuffer(primitive.indexBuffer, "uint32");
          gBufferPass.drawIndexed(primitive.numIndices);
        }
      );

      gBufferPass.end();
    }

    device.queue.submit([encoder.finish()]);
  }
}
