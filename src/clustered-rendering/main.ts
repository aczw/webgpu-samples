import { vec3 } from "wgpu-matrix";
import { Pane } from "tweakpane";
import * as TweakpaneEssentialsPlugin from "@tweakpane/plugin-essentials";

import { initWebGPU, Renderer } from "./renderer";
import { NaiveRenderer } from "./renderers/naive";
import { ForwardPlusRenderer } from "./renderers/forward-plus";
import { ClusteredDeferredRenderer } from "./renderers/clustered-deferred";

import { Scene } from "./stage/scene";
import { Lights } from "./stage/lights";
import { Camera } from "./stage/camera";
import { Stage } from "./stage/stage";

await initWebGPU();

const scene = new Scene();
await scene.loadGltf("/scenes/sponza/Sponza.gltf");

const camera = new Camera({ enableFlight: true, position: vec3.create(-7, 2, 0) });
const lights = new Lights({ camera, numLights: 1000 });
const stage = new Stage(scene, lights, camera);

let renderer: Renderer | undefined;

const pane = new Pane({ title: "WebGPU Clustered Rendering" });
pane.registerPlugin(TweakpaneEssentialsPlugin);

const fpsGraph = pane.addBlade({
  label: "FPS",
  view: "fpsgraph",
  interval: 100,
  min: 0,
  rows: 2,
}) as TweakpaneEssentialsPlugin.FpsGraphBladeApi;

fpsGraph.on("tick", (ev) => {
  if (ev.target.fps && ev.target.fps > ev.target.max) {
    ev.target.max = ev.target.fps;
  }
});

pane
  .addBinding(lights, "numLights", { label: "Light count", min: 1, max: 5000, step: 1 })
  .on("change", () => lights.updateLightSetUniformNumLights());

const modes = {
  Naive: "naive",
  "Forward+": "forward",
  Deferred: "deferred",
};

function setRenderer(mode: string) {
  renderer?.stop();

  switch (mode) {
    case modes["Naive"]:
      renderer = new NaiveRenderer(stage);
      break;
    case modes["Forward+"]:
      renderer = new ForwardPlusRenderer(stage);
      break;
    case modes["Deferred"]:
      renderer = new ClusteredDeferredRenderer({ stage });
      break;
  }

  renderer?.setOnFrame(async function (time, deltaTime) {
    this.camera.onFrame(deltaTime);
    this.lights.onFrame(time);

    fpsGraph.begin();
    this.draw();
    fpsGraph.end();
  });

  renderer?.start();
}

const params = { mode: modes["Deferred"] };

pane
  .addBinding(params, "mode", {
    label: "Mode",
    options: modes,
  })
  .on("change", (ev) => setRenderer(ev.value));

setRenderer(params.mode);
