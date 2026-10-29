import * as T from "three";
import { createWaterSystem } from "../src/water.js";

// Runs in the browser so this probe exercises real WebGL render attachments.
export function probeWater() {
  const renderer = new T.WebGLRenderer();
  renderer.setSize(128, 128);
  const scene = new T.Scene();
  scene.background = new T.Color("#708a80");
  const camera = new T.PerspectiveCamera(45, 1, 0.1, 20);
  camera.position.set(0, 3, 3);
  camera.lookAt(0, 0, 0);
  const system = createWaterSystem(scene, { quality: "balanced" });
  system.addBody({
    id: "test",
    x: 0,
    y: 0.2,
    z: 0,
    radius: 1,
    hole: 0.12,
    depth: 0.2,
    amplitude: 0,
  });
  system.render(renderer, camera);
  const rest = system.inspect(renderer, "test");
  const accepted = system.disturb("test", 0.45, 0, 0.045, 0.08);
  const dryRejected = !system.disturb("test", 0, 0, 0.04, 0.1);
  const invalidRejected = !system.disturb("test", NaN, 0);
  function advance(frames) {
    for (let i = 0; i < frames; i++) {
      system.update(1 / 60);
      system.render(renderer, camera, { dt: 1 / 60 });
      renderer.render(scene, camera);
    }
    return system.inspect(renderer, "test");
  }
  const impact = advance(1),
    propagated = advance(24),
    settled = advance(180);
  const target = new T.WebGLRenderTarget(128, 128);
  renderer.setRenderTarget(target);
  renderer.setViewport(3, 4, 90, 80);
  renderer.setScissor(7, 8, 70, 60);
  renderer.setScissorTest(true);
  renderer.setClearColor("#ab2345", 0.37);
  renderer.toneMapping = T.ACESFilmicToneMapping;
  const plane = new T.Plane(new T.Vector3(1, 0, 0), 3);
  const clipping = [plane];
  renderer.clippingPlanes = clipping;
  system.render(renderer, camera, { dt: 1 / 60 });
  const restored =
    renderer.getRenderTarget() === target &&
    renderer.clippingPlanes === clipping &&
    renderer.getScissorTest() &&
    renderer.toneMapping === T.ACESFilmicToneMapping &&
    renderer.getViewport(new T.Vector4()).toArray().join() === "3,4,90,80" &&
    renderer.getScissor(new T.Vector4()).toArray().join() === "7,8,70,60" &&
    Math.abs(renderer.getClearAlpha() - 0.37) < 0.0001 &&
    renderer.getClearColor(new T.Color()).getHexString() === "ab2345";
  system.dispose();
  system.dispose();
  target.dispose();
  renderer.dispose();
  return {
    rest,
    accepted,
    dryRejected,
    invalidRejected,
    impact,
    propagated,
    settled,
    restored,
  };
}
