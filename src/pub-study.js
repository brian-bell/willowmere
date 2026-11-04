import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { SoftBloomPass, BloomOutputPass } from "./bloom.js";
import { InteriorAO } from "./interior-ao.js";
import { createInteriorWalker } from "./interior-movement.js";
import { createTrees } from "./trees.js";
import { PUB_CUTAWAYS, PUB_SUMMARY, PUB_VIEWS } from "./content/pub.js";
import { createPub } from "./pub/index.js";
import { PUB, WALK, YARD, floorHeight, groundColliders, insideTheHouse, levelAt, loftColliders } from "./pub/layout.js";
import { planFacts, planPoint, planSvg } from "./pub/plan.js";
import { createPubSetting } from "./pub/setting.js";

const $ = (s) => document.querySelector(s);
const scene = new T.Scene();
const renderer = new T.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
const pixelRatio = () => Math.min(devicePixelRatio, 1.25);
renderer.setPixelRatio(pixelRatio());
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.domElement.setAttribute(
  "aria-label",
  "Interactive 3D model of a Tudor pub. Drag to rotate and scroll to zoom.",
);
document.body.prepend(renderer.domElement);

const pmrem = new T.PMREMGenerator(renderer);
const room = new RoomEnvironment();
scene.environment = pmrem.fromScene(room, 0.04).texture;
room.dispose();
pmrem.dispose();

const camera = new T.PerspectiveCamera(42, innerWidth / innerHeight, 0.08, 200);
camera.rotation.order = "YXZ";
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.4;
controls.maxDistance = 58;

const pub = createPub();
scene.add(pub.group);
const setting = createPubSetting(scene, pub.materials.glass);

// A few of the village's own trees, so the building is seen in its world.
const trees = YARD.trees.map(({ x, z, placement }) => {
  const tree = createTrees([placement]);
  tree.group.position.set(x - placement[0], 0, z - placement[1]);
  scene.add(tree.group);
  return tree;
});

setting.refreshShadows();

const target = new T.WebGLRenderTarget(innerWidth, innerHeight, {
  samples: 4,
  type: T.HalfFloatType,
});
const composer = new EffectComposer(renderer, target);
composer.setPixelRatio(pixelRatio());
composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
// Contact shadows only indoors, where furniture would otherwise float.
const ao = new InteriorAO(scene, camera, innerWidth, innerHeight, 12);
ao.kernelRadius = 0.32;
ao.minDistance = 0.0004;
ao.maxDistance = 0.012;
composer.addPass(ao);
const bloom = new SoftBloomPass(0.2, 0.45, 1.25);
composer.addPass(bloom);
composer.addPass(new BloomOutputPass(bloom));

// How dusky the day is, and how far indoors the eye is. Both ease.
const state = {
  dusk: 0,
  duskTarget: 0,
  indoors: 0,
  indoorsTarget: 0,
  cutaway: "whole",
  mode: "orbit",
};

function setCutaway(id) {
  state.cutaway = id;
  pub.groups.roof.visible = id === "whole";
  pub.groups.upper.visible = id !== "loft";
  $("#cutaway").value = id;
  setting.refreshShadows();
}

function setViewNote(view) {
  $("#note strong").textContent = view.label;
  $("#note p").textContent = view.note;
}

function setView(id) {
  const view = PUB_VIEWS.find((v) => v.id === id) || PUB_VIEWS[0];
  leaveWalk();
  if (state.cutaway !== "whole") setCutaway("whole");
  camera.position.set(...view.position);
  controls.target.set(...view.target);
  // A tall, narrow screen stands further back to keep the whole front in frame.
  if (view.group === "Outside" && camera.aspect < 1)
    camera.position.sub(controls.target).multiplyScalar(1.7).add(controls.target);
  controls.update();
  $("#view").value = view.id;
  setViewNote(view);
  // Indoors, the orbit may look up into the rafters; outdoors, not below ground.
  controls.maxPolarAngle = view.group === "Outside" ? Math.PI * 0.495 : Math.PI * 0.9;
  syncIndoors(true);
}

function syncIndoors(immediately = false) {
  const inside =
    insideTheHouse(camera.position.x, camera.position.y, camera.position.z) ||
    state.cutaway !== "whole";
  state.indoorsTarget = inside ? 1 : 0;
  if (immediately) state.indoors = state.indoorsTarget;
}

// The cutaways look down from above.
function viewCutaway(id) {
  setCutaway(id);
  leaveWalk();
  if (id === "whole") {
    setView("street");
    return;
  }
  camera.position.set(14, id === "loft" ? 15 : 17.5, 17);
  controls.target.set(0, id === "loft" ? 1 : 3.2, 0.5);
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.update();
  const label = PUB_CUTAWAYS.find((c) => c.id === id).label;
  $("#note strong").textContent = label;
  $("#note p").textContent =
    id === "loft"
      ? "With the upper storey lifted away: the hearth, the long table and the bar's L, as the carpenter set them out."
      : "With the roof lifted away: the well's rail, the cots along the walls and the two four-posters in the gables.";
  syncIndoors(true);
}

// Walking: the village's own interior walker, with the storey's colliders
// swapped in as the stairs carry you between them.
const walkColliders = { ground: groundColliders(), loft: loftColliders() };
const active = [...walkColliders.ground];
const walker = createInteriorWalker({ bounds: WALK.bounds, colliders: active, spawn: WALK.spawn });
const keys = new Set();
let level = "ground";
function useLevel(next) {
  level = next;
  active.length = 0;
  active.push(...walkColliders[next]);
}
function enterWalk() {
  state.mode = "walk";
  controls.enabled = false;
  if (state.cutaway !== "whole") setCutaway("whole");
  useLevel("ground");
  walker.reset();
  $("#walk").setAttribute("aria-pressed", "true");
  $("#walk").textContent = "Stop walking";
  $("#note strong").textContent = "Walk through";
  $("#note p").textContent =
    "The front door stands open. Mind the hearth, climb the stairs by the east wall, and go out through the loft onto the balcony.";
  syncHint();
}
function leaveWalk() {
  if (state.mode !== "walk") return;
  state.mode = "orbit";
  keys.clear();
  controls.enabled = true;
  const look = camera.getWorldDirection(new T.Vector3());
  controls.target.copy(camera.position).addScaledVector(look, 2);
  controls.update();
  $("#walk").setAttribute("aria-pressed", "false");
  $("#walk").textContent = "Walk through";
  syncHint();
}
function syncHint() {
  $("#hint").textContent =
    state.mode === "walk"
      ? "WASD or arrows to walk · drag to look · shift to hurry"
      : "Drag to turn · scroll to look closer · right-drag to pan";
}
addEventListener("keydown", (e) => {
  if (state.mode !== "walk" || e.target.matches?.("select")) return;
  keys.add(e.code);
  if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => keys.clear());
const canvas = renderer.domElement;
let dragging = false;
canvas.addEventListener("pointerdown", (e) => {
  if (state.mode !== "walk") return;
  dragging = true;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointerup", () => (dragging = false));
canvas.addEventListener("pointermove", (e) => {
  if (state.mode === "walk" && dragging) walker.look(-e.movementX * 0.0034, -e.movementY * 0.0034);
});
function walkStep(dt) {
  const f = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0),
    s = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
  walker.update(dt, f, s, keys.has("ShiftLeft") || keys.has("ShiftRight"));
  const next = levelAt(level, walker.position.x, walker.position.z);
  if (next !== level) useLevel(next);
  camera.position.set(
    walker.position.x,
    floorHeight(level, walker.position.x, walker.position.z) + PUB.eye,
    walker.position.z,
  );
  camera.rotation.set(walker.pitch, walker.yaw, 0);
}

// The page's controls.
function fillSelect(select, items) {
  for (const item of items) {
    const o = document.createElement("option");
    o.value = item.id;
    o.textContent = item.label;
    select.append(o);
  }
}
const groups = ["Outside", "Inside", "Upstairs"];
for (const name of groups) {
  const optgroup = document.createElement("optgroup");
  optgroup.label = name;
  fillSelect(optgroup, PUB_VIEWS.filter((v) => v.group === name));
  $("#view").append(optgroup);
}
fillSelect($("#cutaway"), PUB_CUTAWAYS);
$("#tagline").textContent = PUB_SUMMARY.tagline;
$("#view").onchange = (e) => setView(e.target.value);
$("#cutaway").onchange = (e) => viewCutaway(e.target.value);
$("#light").onclick = (e) => {
  state.duskTarget = state.duskTarget ? 0 : 1;
  e.target.setAttribute("aria-pressed", String(!!state.duskTarget));
  e.target.textContent = state.duskTarget ? "Golden afternoon" : "Blue hour";
};
$("#walk").onclick = () => (state.mode === "walk" ? leaveWalk() : enterWalk());
const plans = $("#plans");
plans.innerHTML = `<h2>Ground floor</h2>${planSvg("ground")}<h2>Loft and gallery</h2>${planSvg("loft")}<dl>${planFacts()
  .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
  .join("")}</dl><p style="font-size:12px;line-height:1.5;margin:0">${PUB_SUMMARY.placement}</p>`;
const dots = { ground: plans.querySelectorAll("[data-you]")[0], loft: plans.querySelectorAll("[data-you]")[1] };
$("#plan").onclick = (e) => {
  plans.hidden = !plans.hidden;
  e.target.setAttribute("aria-pressed", String(!plans.hidden));
};

addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  composer.setPixelRatio(pixelRatio());
  composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = innerWidth < 760 ? 58 : 42;
  camera.updateProjectionMatrix();
});
camera.fov = innerWidth < 760 ? 58 : 42;
camera.updateProjectionMatrix();

renderer.info.autoReset = false;
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
let last = performance.now(),
  elapsed = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (document.hidden) return;
  if (!still) elapsed += dt;
  const t = elapsed;
  if (state.mode === "walk") walkStep(dt);
  else controls.update();
  syncIndoors();
  const ease = 1 - Math.exp(-dt * 3.5);
  state.dusk += (state.duskTarget - state.dusk) * ease;
  state.indoors += (state.indoorsTarget - state.indoors) * (1 - Math.exp(-dt * 6));
  setting.apply(state.dusk, state.indoors, t, camera.position);
  pub.update(t);
  for (const tree of trees) tree.update(t);
  const dot = dots[level];
  if (state.mode === "walk" && !plans.hidden) {
    const { cx, cy } = planPoint(walker.position.x, walker.position.z);
    dot.setAttribute("cx", cx);
    dot.setAttribute("cy", cy);
    dots[level === "ground" ? "loft" : "ground"].setAttribute("cx", "-20");
  }
  ao.enabled = state.indoors > 0.5;
  renderer.info.reset();
  composer.render(dt);
}

setView(new URLSearchParams(location.search).get("view") || "street");
syncHint();
$("#loading").hidden = true;
requestAnimationFrame(frame);

window.__pubStudy = {
  scene,
  camera,
  renderer,
  controls,
  pub,
  setView,
  setCutaway: viewCutaway,
  setDusk(on) {
    state.duskTarget = state.dusk = on ? 1 : 0;
  },
  walk: {
    place: (pose) => walker.place(pose),
    position: () => ({ ...walker.position, level }),
  },
  diagnostics: () => ({
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
    programs: renderer.info.programs.length,
  }),
};
