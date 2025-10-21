import Stats from "stats.js";
import { vec3 } from "wgpu-matrix";

import { initWebGPU } from "@fpcd/renderer";
import { ClusteredDeferredRenderer } from "@fpcd/renderers/clustered-deferred";

import { Scene } from "@fpcd/stage/scene";
import { Lights } from "@fpcd/stage/lights";
import { Camera } from "@fpcd/stage/camera";
import { Stage } from "@fpcd/stage/stage";

await initWebGPU();

const scene = new Scene();
await scene.loadGltf("/scenes/sponza/Sponza.gltf");

const camera = new Camera({ enableFlight: false, position: vec3.create(0, 2, 0) });
const lights = new Lights({ camera, numLights: 500 });

const stats = new Stats();
stats.showPanel(0);

// document.body.appendChild(stats.dom);

const renderer = new ClusteredDeferredRenderer({
  stage: new Stage(scene, lights, camera, stats),
  debug: { numLights: true },
});

renderer.setOnFrame(async function (time, deltaTime) {
  this.camera.rotateCamera(deltaTime / 50, 0);
  this.camera.onFrame(deltaTime);
  this.lights.onFrame(time);
  // this.stats.begin();
  this.draw();
  // this.stats.end();
});

const canvas = document.getElementById("main-canvas") as HTMLCanvasElement;
const id = setInterval(() => {
  canvas.style.opacity = Math.min(1, Number(canvas.style.opacity) + 0.1).toString();

  if (canvas.style.opacity === "1.0") {
    clearInterval(id);
  }
}, 100);

renderer.start();
