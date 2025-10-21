import Stats from "stats.js";

import { initWebGPU } from "@fpcd/renderer";
import { ClusteredDeferredRenderer } from "@fpcd/renderers/clustered-deferred";

import { setupLoaders, Scene } from "@fpcd/stage/scene";
import { Lights } from "@fpcd/stage/lights";
import { Camera } from "@fpcd/stage/camera";
import { Stage } from "@fpcd/stage/stage";

await initWebGPU();
setupLoaders();

const scene = new Scene();
await scene.loadGltf("/scenes/sponza/Sponza.gltf");

const camera = new Camera({ enableFlight: false });
const lights = new Lights({ camera, numLights: 700 });

const stats = new Stats();
stats.showPanel(0);

// document.body.appendChild(stats.dom);

const renderer = new ClusteredDeferredRenderer(new Stage(scene, lights, camera, stats));

renderer.setOnFrame(async function (time, deltaTime) {
  this.camera.onFrame(deltaTime);
  this.lights.onFrame(time);
  // this.stats.begin();
  this.draw();
  // this.stats.end();
});

renderer.start();
