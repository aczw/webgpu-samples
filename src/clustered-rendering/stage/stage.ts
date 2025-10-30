import { Camera } from "./camera";
import { Lights } from "./lights";
import { Scene } from "./scene";

export class Stage {
  scene: Scene;
  lights: Lights;
  camera: Camera;

  constructor(scene: Scene, lights: Lights, camera: Camera) {
    this.scene = scene;
    this.lights = lights;
    this.camera = camera;
  }
}
