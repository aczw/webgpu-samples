import { vec3 } from "wgpu-matrix";

import { canvas, device } from "../renderer";
import { Camera } from "./camera";
import { clusteringComputeSrc, constants, moveLightsComputeSrc } from "../shaders/shaders";

// h in [0, 1]
function hueToRgb(h: number) {
  let f = (n: number, k = (n + h * 6) % 6) => 1 - Math.max(Math.min(k, 4 - k, 1), 0);
  return vec3.lerp(vec3.create(1, 1, 1), vec3.create(f(5), f(3), f(1)), 0.8);
}

type LightsConstructorOptions = {
  camera: Camera;
  numLights: number;
};

export class Lights {
  private camera: Camera;

  static readonly maxNumLights = 5000;
  static readonly numFloatsPerLight = 8; // vec3f is aligned at 16 byte boundaries
  static readonly lightIntensity = 0.1;

  numLights: number;

  lightsArray = new Float32Array(Lights.maxNumLights * Lights.numFloatsPerLight);
  lightSetStorageBuffer: GPUBuffer;

  timeUniformBuffer: GPUBuffer;

  moveLightsComputeBindGroupLayout: GPUBindGroupLayout;
  moveLightsComputeBindGroup: GPUBindGroup;
  moveLightsComputePipeline: GPUComputePipeline;

  clusteringComputeBgl: GPUBindGroupLayout;
  clusteringComputeBg: GPUBindGroup;
  clusteringComputePipeline: GPUComputePipeline;

  numWorkgroupsArray: Uint32Array<ArrayBuffer>;

  numSlicesArray: Uint32Array<ArrayBuffer>;
  numSlicesUniformBuffer: GPUBuffer;

  dimensionsUniformBuffer: GPUBuffer;

  clusterSetStorageBuffer: GPUBuffer;

  constructor({ camera, numLights }: LightsConstructorOptions) {
    this.camera = camera;
    this.numLights = numLights;

    this.lightSetStorageBuffer = device.createBuffer({
      label: "Light set storage buffer",
      size: 16 + this.lightsArray.byteLength, // 16 for numLights + padding
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.populateLightsBuffer();
    this.updateLightSetUniformNumLights();

    this.timeUniformBuffer = device.createBuffer({
      label: "Time uniform buffer",
      size: 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.moveLightsComputeBindGroupLayout = device.createBindGroupLayout({
      label: "move lights compute bind group layout",
      entries: [
        {
          // lightSet
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" },
        },
        {
          // time
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        },
      ],
    });

    this.moveLightsComputeBindGroup = device.createBindGroup({
      label: "move lights compute bind group",
      layout: this.moveLightsComputeBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.lightSetStorageBuffer },
        },
        {
          binding: 1,
          resource: { buffer: this.timeUniformBuffer },
        },
      ],
    });

    this.moveLightsComputePipeline = device.createComputePipeline({
      label: "move lights compute pipeline",
      layout: device.createPipelineLayout({
        label: "move lights compute pipeline layout",
        bindGroupLayouts: [this.moveLightsComputeBindGroupLayout],
      }),
      compute: {
        module: device.createShaderModule({
          label: "move lights compute shader",
          code: moveLightsComputeSrc,
        }),
        entryPoint: "main",
      },
    });

    const numSlicesX = Math.ceil(canvas.width / constants.clusterPixelWidth);
    const numSlicesY = Math.ceil(canvas.height / constants.clusterPixelHeight);
    const numSlicesZ = 24;
    this.numSlicesArray = new Uint32Array([numSlicesX, numSlicesY, numSlicesZ]);

    this.numSlicesUniformBuffer = device.createBuffer({
      label: "Num slices uniform buffer",
      size: 3 * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(this.numSlicesUniformBuffer, 0, this.numSlicesArray);
    console.log(
      `[Clustering] Number of slices: X ${numSlicesX} / Y ${numSlicesY} / Z ${numSlicesZ}`,
    );

    // Calculate number of workgroups needed to compute all clusters
    const { x, y, z } = constants.clusteringWorkgroupSize;
    const numWorkgroupsX = Math.ceil(numSlicesX / x);
    const numWorkgroupsY = Math.ceil(numSlicesY / y);
    const numWorkgroupsZ = Math.ceil(numSlicesZ / z);
    this.numWorkgroupsArray = new Uint32Array([numWorkgroupsX, numWorkgroupsY, numWorkgroupsZ]);
    console.log(
      `[Clustering] Dispatch workgroups size: X ${numWorkgroupsX} / Y ${numWorkgroupsY} / Z ${numWorkgroupsZ}`,
    );

    this.dimensionsUniformBuffer = device.createBuffer({
      label: "Dimensions uniform buffer",
      size: 2 * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(
      this.dimensionsUniformBuffer,
      0,
      new Uint32Array([canvas.width, canvas.height]),
    );
    console.log(`[Info] Dimensions: width ${canvas.width} / height ${canvas.height}`);

    const totalNumClusters = numSlicesX * numSlicesY * numSlicesZ;
    this.clusterSetStorageBuffer = device.createBuffer({
      label: "Cluster set storage buffer",
      size: 4 + totalNumClusters * (4 + constants.maxLightsInCluster * 4),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.clusterSetStorageBuffer, 0, new Uint32Array([totalNumClusters]));
    console.log(`[Clustering] Total number of clusters: ${totalNumClusters}`);

    this.clusteringComputeBgl = device.createBindGroupLayout({
      label: "Clustering compute bind group layout",
      entries: [
        {
          // Light set
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        },
        {
          // Camera uniforms
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        },
        {
          // Dimensions uniform
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        },
        {
          // Num slices uniform buffer
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        },
        {
          // Cluster set storage buffer
          binding: 4,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" },
        },
      ],
    });

    this.clusteringComputeBg = device.createBindGroup({
      label: "Clustering compute bind group",
      layout: this.clusteringComputeBgl,
      entries: [
        { binding: 0, resource: { buffer: this.lightSetStorageBuffer } },
        { binding: 1, resource: { buffer: this.camera.uniformsBuffer } },
        { binding: 2, resource: { buffer: this.dimensionsUniformBuffer } },
        { binding: 3, resource: { buffer: this.numSlicesUniformBuffer } },
        { binding: 4, resource: { buffer: this.clusterSetStorageBuffer } },
      ],
    });

    this.clusteringComputePipeline = device.createComputePipeline({
      label: "Clustering compute pipeline",
      layout: device.createPipelineLayout({
        label: "Clustering compute pipeline layout",
        bindGroupLayouts: [this.clusteringComputeBgl],
      }),
      compute: {
        module: device.createShaderModule({
          label: "Clustering compute shader (clustering.cs.wgsl)",
          code: clusteringComputeSrc,
        }),
        entryPoint: "main",
      },
    });
  }

  private populateLightsBuffer() {
    for (let lightIdx = 0; lightIdx < Lights.maxNumLights; ++lightIdx) {
      // light pos is set by compute shader so no need to set it here
      const lightColor = vec3.scale(hueToRgb(Math.random()), Lights.lightIntensity);
      this.lightsArray.set(lightColor, lightIdx * Lights.numFloatsPerLight + 4);
    }

    device.queue.writeBuffer(this.lightSetStorageBuffer, 16, this.lightsArray);
  }

  updateLightSetUniformNumLights() {
    device.queue.writeBuffer(this.lightSetStorageBuffer, 0, new Uint32Array([this.numLights]));
  }

  doLightClustering(encoder: GPUCommandEncoder) {
    const pass = encoder.beginComputePass({ label: "Clustering compute pass" });

    pass.setPipeline(this.clusteringComputePipeline);
    pass.setBindGroup(0, this.clusteringComputeBg);
    pass.dispatchWorkgroups(
      this.numWorkgroupsArray[0],
      this.numWorkgroupsArray[1],
      this.numWorkgroupsArray[2],
    );

    pass.end();
  }

  // CHECKITOUT: this is where the light movement compute shader is dispatched from the host
  onFrame(time: number) {
    device.queue.writeBuffer(this.timeUniformBuffer, 0, new Float32Array([time]));

    // not using same encoder as render pass so this doesn't interfere with measuring actual rendering performance
    const encoder = device.createCommandEncoder();

    const computePass = encoder.beginComputePass();
    computePass.setPipeline(this.moveLightsComputePipeline);

    computePass.setBindGroup(0, this.moveLightsComputeBindGroup);

    const workgroupCount = Math.ceil(this.numLights / constants.moveLightsWorkgroupSize);
    computePass.dispatchWorkgroups(workgroupCount);

    computePass.end();

    device.queue.submit([encoder.finish()]);
  }
}
