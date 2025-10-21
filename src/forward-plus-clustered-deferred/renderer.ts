import { Scene } from "./stage/scene";
import { Lights } from "./stage/lights";
import { Camera } from "./stage/camera";
import { Stage } from "./stage/stage";

export var canvas: HTMLCanvasElement;
export var canvasFormat: GPUTextureFormat;
export var context: GPUCanvasContext;
export var device: GPUDevice;
export var canvasTextureView: GPUTextureView;

export var aspectRatio: number;
export const fovYDegrees = 45;

export var modelBindGroupLayout: GPUBindGroupLayout;
export var materialBindGroupLayout: GPUBindGroupLayout;

/**
 * This function initializes WebGPU and also creates some bind group layouts
 * shared by all the renderers.
 */
export async function initWebGPU() {
  canvas = document.getElementById("main-canvas") as HTMLCanvasElement;

  const devicePixelRatio = window.devicePixelRatio;
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;

  aspectRatio = canvas.width / canvas.height;

  if (!navigator.gpu) {
    let errorMessageElement = document.createElement("h1");
    errorMessageElement.textContent =
      "This browser doesn't support WebGPU! Try using Google Chrome.";
    errorMessageElement.style.paddingLeft = "0.4em";
    document.body.innerHTML = "";
    document.body.appendChild(errorMessageElement);
    throw new Error("WebGPU not supported on this browser");
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error("no appropriate GPUAdapter found");
  }

  device = await adapter.requestDevice();

  context = canvas.getContext("webgpu")!;
  canvasFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device: device,
    format: canvasFormat,
  });

  console.log("[Info] WebGPU init successsful");

  modelBindGroupLayout = device.createBindGroupLayout({
    label: "Model bind group layout",
    entries: [
      {
        // modelMat
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "uniform" },
      },
    ],
  });

  materialBindGroupLayout = device.createBindGroupLayout({
    label: "Material bind group layout",
    entries: [
      {
        // diffuseTex
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {},
      },
      {
        // diffuseTexSampler
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {},
      },
    ],
  });
}

export const vertexBufferLayout: GPUVertexBufferLayout = {
  arrayStride: 32,
  attributes: [
    {
      // pos
      format: "float32x3",
      offset: 0,
      shaderLocation: 0,
    },
    {
      // nor
      format: "float32x3",
      offset: 12,
      shaderLocation: 1,
    },
    {
      // uv
      format: "float32x2",
      offset: 24,
      shaderLocation: 2,
    },
  ],
};

type OnFrameFn = (this: Renderer, time: number, deltaTime: number) => Promise<void>;

export abstract class Renderer {
  protected scene: Scene;
  protected lights: Lights;
  protected camera: Camera;
  protected stats: Stats;

  private onFrame: OnFrameFn;
  private prevTime: number;
  private frameRequestId: number;

  constructor(stage: Stage) {
    this.scene = stage.scene;
    this.lights = stage.lights;
    this.camera = stage.camera;
    this.stats = stage.stats;

    this.onFrame = async () => {};
    this.prevTime = 0;
    this.frameRequestId = 0;
  }

  setOnFrame(onFrame: OnFrameFn) {
    this.onFrame = onFrame;
  }

  start() {
    this.frameRequestId = requestAnimationFrame((time) => {
      if (this.prevTime == 0) {
        this.prevTime = time;
      }

      const deltaTime = time - this.prevTime;

      this.onFrame.call(this, time, deltaTime);
      this.prevTime = time;

      this.start();
    });
  }

  stop() {
    cancelAnimationFrame(this.frameRequestId);
  }

  protected abstract draw(): void;
}
