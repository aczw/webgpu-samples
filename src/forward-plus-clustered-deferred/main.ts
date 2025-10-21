import Stats from "stats.js";
import { GUI } from "dat.gui";
import { vec3 } from "wgpu-matrix";

import { initWebGPU, Renderer } from "./renderer";
import { NaiveRenderer } from "./renderers/naive";
import { ForwardPlusRenderer } from "./renderers/forward-plus";
import { ClusteredDeferredRenderer } from "./renderers/clustered-deferred";

import { Scene } from "./stage/scene";
import { Lights } from "./stage/lights";
import { Camera } from "./stage/camera";
import { Stage } from "./stage/stage";

await initWebGPU();

let scene = new Scene();
await scene.loadGltf("/scenes/sponza/Sponza.gltf");

const camera = new Camera({ enableFlight: true, position: vec3.create(-7, 2, 0) });
const lights = new Lights({ camera, numLights: 1000 });

const stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);

const gui = new GUI();
gui
  .add(lights, "numLights")
  .min(1)
  .max(Lights.maxNumLights)
  .step(1)
  .onChange(() => {
    lights.updateLightSetUniformNumLights();
  });

const stage = new Stage(scene, lights, camera, stats);

const renderModes = {
  Naive: "naive",
  "Forward+": "forward-plus",
  "Clustered Deferred": "clustered-deferred",
};

let renderer: Renderer | undefined;

function setRenderer(mode: string) {
  renderer?.stop();

  switch (mode) {
    case renderModes["Naive"]:
      renderer = new NaiveRenderer(stage);
      break;
    case renderModes["Forward+"]:
      renderer = new ForwardPlusRenderer(stage);
      break;
    case renderModes["Clustered Deferred"]:
      renderer = new ClusteredDeferredRenderer({ stage });
      break;
  }

  renderer?.setOnFrame(async function (time, deltaTime) {
    this.camera.onFrame(deltaTime);
    this.lights.onFrame(time);
    this.stats.begin();
    this.draw();
    this.stats.end();
  });

  renderer?.start();
}

const renderModeController = gui.add(
  { mode: renderModes["Clustered Deferred"] },
  "mode",
  renderModes,
);
renderModeController.onChange(setRenderer);

setRenderer(renderModeController.getValue());
