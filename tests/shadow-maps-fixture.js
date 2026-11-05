import * as THREE from "three";
import "../src/shader-chunks.js";
import { useDepthShadowMaps } from "../src/shadow-maps.js";

// A box over a lit floor, drawn with the game's shadow maps. Served by Vite and
// imported in a page by tests/shadow-maps.spec.js.
const SIZE = 64;

export async function renderShadow(lightKind) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const renderer = new THREE.WebGLRenderer({ canvas, preserveDrawingBuffer: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  useDepthShadowMaps(renderer);
  const scene = new THREE.Scene(),
    camera = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 40);
  camera.position.set(0, 20, 0);
  camera.lookAt(0, 0, 0);
  const light =
    lightKind === "spot"
      ? new THREE.SpotLight("#fff", 200, 0, 0.6, 0, 1)
      : new THREE.DirectionalLight("#fff", 3);
  light.position.set(0, 10, 0);
  light.castShadow = true;
  // Coarse, so the filter's soft edge spans several of the picture's pixels.
  light.shadow.mapSize.setScalar(32);
  Object.assign(light.shadow.camera, { near: 1, far: 20, left: -5, right: 5, top: 5, bottom: -5 });
  scene.add(light, light.target);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: "#888" }),
  );
  floor.receiveShadow = true;
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(2, 0.2, 2),
    new THREE.MeshBasicMaterial({ color: "#000" }),
  );
  box.position.y = 2;
  box.castShadow = true;
  // Seen from above, the box would hide its own shadow; it casts but isn't drawn.
  box.material.colorWrite = false;
  box.material.depthWrite = false;
  scene.add(floor, box);
  renderer.render(scene, camera);
  const gl = renderer.getContext(),
    error = gl.getError(),
    // A row across the middle of the picture, from left to right.
    readRow = () => {
      const pixels = new Uint8Array(SIZE * SIZE * 4),
        row = [];
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.readPixels(0, 0, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      for (let x = 0; x < SIZE; x++) row.push(pixels[(SIZE / 2) * SIZE * 4 + x * 4]);
      return row;
    },
    row = readRow();
  const map = light.shadow.map,
    framebuffer = renderer.properties.get(map).__webglFramebuffer;
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  const colorAttachment = gl.getFramebufferAttachmentParameter(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE,
  );
  const result = {
    error,
    row,
    depthOnly: colorAttachment === gl.NONE,
    sampler: map.texture.isDepthTexture === true,
    complete: gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE,
    textures: renderer.info.memory.textures,
  };
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  // A light that resizes drops its map, and gets a new one of the new size.
  const old = map;
  light.shadow.mapSize.setScalar(16);
  light.shadow.map.dispose();
  light.shadow.map = null;
  renderer.render(scene, camera);
  result.resized = light.shadow.map !== old && light.shadow.map.width === 16;
  result.errorAfterResize = gl.getError();
  // A lost context comes back with no GL objects and a new shadow renderer.
  light.shadow.mapSize.setScalar(32);
  light.shadow.map.dispose();
  light.shadow.map = null;
  const context = gl.getExtension("WEBGL_lose_context"),
    event = (name) =>
      new Promise((resolve, reject) => {
        canvas.addEventListener(name, resolve, { once: true });
        setTimeout(() => reject(Error(`No ${name}`)), 10000);
      }),
    lost = event("webglcontextlost");
  context.loseContext();
  await lost;
  // Chrome allows a restore only once the event's dispatch has finished.
  await new Promise((resolve) => setTimeout(resolve));
  const restored = event("webglcontextrestored");
  context.restoreContext();
  await restored;
  renderer.render(scene, camera);
  result.errorAfterRestore = gl.getError();
  result.rowAfterRestore = readRow();
  result.sampledAfterRestore = light.shadow.map.texture.isDepthTexture === true;
  renderer.dispose();
  return result;
}
