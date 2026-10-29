import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createWorld } from "./world.js";

const scene = new T.Scene();
scene.background = new T.Color("#abc2a1");
scene.fog = new T.FogExp2("#abc2a1", 0.003);
const renderer = new T.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
const camera = new T.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 150);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 1.5;
controls.maxDistance = 70;
controls.maxPolarAngle = Math.PI * 0.485;
const sun = new T.DirectionalLight("#fff0d6", 2.4);
sun.position.set(-16, 32, 15);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, {
  left: -35,
  right: 35,
  top: 32,
  bottom: -32,
  near: 1,
  far: 85,
});
sun.shadow.bias = -0.00015;
sun.shadow.normalBias = 0.035;
const hemi = new T.HemisphereLight("#eaf2df", "#607b66", 1.5);
const fill = new T.DirectionalLight("#dae9ec", 0.6);
fill.position.set(15, 14, -20);
scene.add(sun, sun.target, hemi, fill, new T.AmbientLight("#ccdabb", 0.22));
const world = createWorld(T, scene);
const views = {
  river: { position: [17.0, 6.5, 14.5], target: [12, 0, 8.4] },
  fountain: { position: [2.5, 3.7, 7.0], target: [-1, 0.65, 2.5] },
  mill: { position: [8.0, 4.0, -0.7], target: [13.0, 0.6, -6.0] },
  low: { position: [13.7, 1.45, 12.7], target: [11.7, 0.12, 7.3] },
  village: { position: [27, 36, 44], target: [0, 0, 1.5] },
};
function setView(name) {
  const preset = views[name] || views.river;
  camera.position.set(...preset.position);
  controls.target.set(...preset.target);
  controls.update();
}
setView("river");
let dusk = 0,
  paused = matchMedia("(prefers-reduced-motion: reduce)").matches,
  last = performance.now(),
  elapsed = 0;
const $ = (s) => document.querySelector(s);
$("#view").onchange = (e) => setView(e.target.value);
$("#light").onchange = (e) => {
  dusk = e.target.value === "dusk" ? 1 : 0;
  document.body.classList.toggle("dusk", !!dusk);
  sun.color.set(dusk ? "#ffa572" : "#fff0d6");
  sun.intensity = dusk ? 0.6 : 2.4;
  hemi.color.set(dusk ? "#8dacef" : "#eaf2df");
  hemi.intensity = dusk ? 1 : 1.5;
  scene.background.set(dusk ? "#566782" : "#abc2a1");
  scene.fog.color.copy(scene.background);
  for (const light of world.lanterns) light.intensity = dusk ? 18 : 0.1;
};
$("#quality").onchange = (e) => {
  world.water.setQuality(e.target.value);
  renderer.setPixelRatio(
    Math.min(
      devicePixelRatio,
      e.target.value === "high"
        ? 1.75
        : e.target.value === "balanced"
          ? 1.25
          : 1,
    ),
  );
};
function updatePause() {
  $("#pause").setAttribute("aria-pressed", String(paused));
  $("#pause").textContent = paused ? "Resume water" : "Pause water";
}
$("#pause").onclick = () => {
  paused = !paused;
  updatePause();
};
updatePause();
$("#ripple").onclick = () => {
  if (paused) {
    paused = false;
    updatePause();
  }
  world.water.disturb("river", 12, 8.4, 0.065, 0.24);
  world.water.disturb("fountain-lower", -1.55, 3.0, 0.03, 0.11);
  world.water.disturb("fountain-upper", -0.75, 2.6, 0.014, 0.06);
};
let pointerStart;
const raycaster = new T.Raycaster(),
  pointer = new T.Vector2();
renderer.domElement.addEventListener("pointerdown", (e) => {
  pointerStart = [e.clientX, e.clientY];
});
renderer.domElement.addEventListener("pointerup", (e) => {
  if (
    !pointerStart ||
    paused ||
    Math.hypot(e.clientX - pointerStart[0], e.clientY - pointerStart[1]) > 5
  )
    return;
  pointer.set(
    (e.clientX / innerWidth) * 2 - 1,
    1 - (e.clientY / innerHeight) * 2,
  );
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(
    world.water.group.children.filter((o) => o.userData.waterBody),
  )[0];
  if (hit)
    world.water.disturb(
      hit.object.userData.waterBody,
      hit.point.x,
      hit.point.z,
      0.045,
      0.13,
    );
});
addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});
renderer.info.autoReset = false;
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - last) / 1000, 0.045);
  last = now;
  if (document.hidden) return;
  if (!paused) {
    elapsed += dt;
    world.update(dt, elapsed);
  }
  controls.update();
  renderer.info.reset();
  world.water.render(renderer, camera, { dt, dusk, sun });
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);
window.__waterStudy = {
  diagnostics: () => world.water.diagnostics(),
  inspect: (id) => world.water.inspect(renderer, id),
  disturb: (...args) => world.water.disturb(...args),
  setView,
};
