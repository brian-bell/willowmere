import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SoftBloomPass, BloomOutputPass } from "./bloom.js";
import "./style.css";
import { applyIcons } from "./icons.js";
applyIcons();
import { createWorld } from "./world.js";
import { createLife } from "./life.js";
import { createAudio } from "./audio.js";
import { createEffects } from "./effects.js";
import { createFlowerFactory } from "./flowers.js";
import { createPlayerVisibility } from "./visibility.js";
import { createSky } from "./sky.js";
import { createStreamer } from "./streaming.js";
import { WORLD, regionAt, terrainField } from "./world-layout.js";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const canvas = $("#scene"),
  scene = new THREE.Scene();
scene.background = new THREE.Color("#abc2a1");
// Linear fog that starts at the eye in the overview, where its quadratic
// onset matches the light exponential haze this used to be (density 0.0025),
// and closes in first person so the far plane's edge vanishes into it.
const FOG = {
    overview: { near: 0, far: 693 },
    firstPerson: { near: 30, far: 70 },
  },
  // First person draws only as far as its fog lets anything show.
  FIRST_PERSON_FAR = 72;
scene.fog = new THREE.Fog("#b5c2a0", FOG.overview.near, FOG.overview.far);
// Update transforms once, then reuse them for water, shadows and the final view.
scene.matrixWorldAutoUpdate = false;
const renderer = new THREE.WebGLRenderer({
  canvas,
  // The composer already renders into a multisampled target.
  antialias: false,
  powerPreference: "high-performance",
});
// Every pass fills the full drawing buffer, so the frame rate follows pixel
// count. Each quality caps the pixel ratio; the scaler below lowers it while
// frames run long. See docs/performance.md.
const QUALITY_PIXEL_RATIO = { high: 1.25, balanced: 1.25, performance: 1 };
// Retina laptops and large monitors start on balanced; 1x screens up to about
// 1920 × 1200, and small windows on dense screens, start on high.
const startQuality =
  innerWidth < 760 || innerWidth * innerHeight * devicePixelRatio ** 2 > 2.6e6
    ? "balanced"
    : "high";
// Benchmark overrides for attributing render cost (window.__willowmere.tune);
// empty in normal play, so every `??` below takes its default.
const overrides = {};
const resolution = {
  // ?resolution=fixed keeps the quality's pixel ratio for benchmarks and tests.
  adaptive: new URLSearchParams(location.search).get("resolution") !== "fixed",
  ceiling: Math.min(devicePixelRatio, QUALITY_PIXEL_RATIO[startQuality]),
  floor: 0.75,
  step: 0.125,
  // Set with the starting quality below.
  pixelRatio: 0,
  samples: [],
  windowStart: 0,
  lastSample: 0,
  p95: 0,
  mean: 0,
  // Frames before this time are not sampled: startup, or after a failed descent.
  holdUntil: performance.now() + 3000,
  holdFor: 30000,
  goodWindows: 0,
  // Consecutive good one-second windows needed to step up; doubles when a
  // step up is undone straight away.
  upWindows: 5,
  lastUp: -Infinity,
  // Mean interval when the current run of step downs began.
  descentFrom: 0,
  // The village's ratio while the bakery is open.
  outdoor: 0,
};
function applyPixelRatio(ratio) {
  resolution.pixelRatio = ratio;
  renderer.setPixelRatio(ratio);
  composer.setPixelRatio(ratio);
  resolution.samples.length = 0;
}
function resetResolution(quality) {
  Object.assign(resolution, {
    ceiling: Math.min(devicePixelRatio, QUALITY_PIXEL_RATIO[quality]),
    goodWindows: 0,
    upWindows: 5,
    lastUp: -Infinity,
    descentFrom: 0,
  });
  applyPixelRatio(overrides.pixelRatio ?? resolution.ceiling);
}
function stepResolution(direction) {
  const r = resolution;
  applyPixelRatio(
    THREE.MathUtils.clamp(
      r.pixelRatio + direction * r.step,
      Math.min(r.floor, r.ceiling),
      r.ceiling,
    ),
  );
  resize();
}
function updateResolution(now, interval) {
  const r = resolution;
  if (!r.adaptive || overrides.pixelRatio != null || now < r.holdUntil) return;
  // Start a fresh window after a hidden tab, the bakery, or a long stall.
  if (interval > 250 || now - r.lastSample > 250) {
    r.samples.length = 0;
    r.windowStart = now;
  }
  r.lastSample = now;
  r.samples.push(interval);
  if (now - r.windowStart < 1000) return;
  r.samples.sort((a, b) => a - b);
  r.p95 = r.samples[Math.floor(r.samples.length * 0.95)];
  r.mean = r.samples.reduce((a, b) => a + b, 0) / r.samples.length;
  r.samples.length = 0;
  r.windowStart = now;
  const slow = r.p95 > 20;
  if (!slow) r.descentFrom = 0;
  if (slow) {
    r.goodWindows = 0;
    // Slow again soon after stepping up: wait longer before the next try.
    if (now - r.lastUp < 10000) r.upWindows = Math.min(r.upWindows * 2, 60);
    if (r.pixelRatio > Math.min(r.floor, r.ceiling)) {
      r.descentFrom ||= r.mean;
      stepResolution(-1);
    } else if (r.descentFrom && r.mean > r.descentFrom * 0.95) {
      // Even the floor did not shorten frames, so something else sets the
      // pace (a 30 Hz cap or a busy CPU). Restore detail and retry later.
      // Single steps are not judged: vsync can hold frames at 33 ms until
      // the GPU fits within one refresh.
      r.descentFrom = 0;
      r.holdUntil = now + r.holdFor;
      r.holdFor = Math.min(r.holdFor * 2, 300000);
      applyPixelRatio(r.ceiling);
      resize();
    }
  } else if (r.p95 < 18) {
    if (++r.goodWindows >= r.upWindows && r.pixelRatio < r.ceiling) {
      r.goodWindows = 0;
      r.lastUp = now;
      stepResolution(1);
    }
  } else r.goodWindows = 0;
}
renderer.setPixelRatio(resolution.ceiling);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
const overviewCamera = new THREE.OrthographicCamera(-25, 25, 16, -16, 0.1, 160),
  firstPersonCamera = new THREE.PerspectiveCamera(
    66,
    innerWidth / innerHeight,
    0.06,
    FIRST_PERSON_FAR,
  );
firstPersonCamera.rotation.order = "YXZ";
let camera = overviewCamera,
  firstPerson = false,
  yaw = 0,
  pitch = 0,
  dragging = null;
const cameraOffset = new THREE.Vector3(27, 36, 44);
const cameraDistance = cameraOffset.length(),
  cameraHeading = Math.atan2(cameraOffset.x, cameraOffset.z),
  DEFAULT_TILT = THREE.MathUtils.radToDeg(
    Math.asin(cameraOffset.y / cameraDistance),
  ),
  MIN_TILT = 20,
  MAX_TILT = 75,
  TILT_STEP = 5;
let tilt = DEFAULT_TILT,
  targetTilt = DEFAULT_TILT;
const YAW_STEP = 15;
let overviewYaw = 0,
  targetYaw = 0;
function setYaw(angle) {
  targetYaw = THREE.MathUtils.euclideanModulo(angle, 360);
  $("#yaw-angle").textContent = `${Math.round(targetYaw)}°`;
  $("#yaw-reset").disabled = targetYaw === 0;
}
const PAN_STEP = 3,
  PAN_LIMIT = 18,
  pan = new THREE.Vector2(),
  targetPan = new THREE.Vector2(),
  panOffset = new THREE.Vector3(),
  viewTarget = new THREE.Vector3();
function setPan(x, y) {
  targetPan.set(
    THREE.MathUtils.clamp(x, -PAN_LIMIT, PAN_LIMIT),
    THREE.MathUtils.clamp(y, -PAN_LIMIT, PAN_LIMIT),
  );
  $("#pan-left").disabled = targetPan.x <= -PAN_LIMIT;
  $("#pan-right").disabled = targetPan.x >= PAN_LIMIT;
  $("#pan-up").disabled = targetPan.y <= -PAN_LIMIT;
  $("#pan-down").disabled = targetPan.y >= PAN_LIMIT;
  $("#pan-reset").disabled = targetPan.lengthSq() === 0;
}
function setTilt(angle) {
  targetTilt = THREE.MathUtils.clamp(angle, MIN_TILT, MAX_TILT);
  updateTiltControls();
}
function updateTiltControls() {
  $("#tilt-up").disabled = targetTilt >= MAX_TILT;
  $("#tilt-down").disabled = targetTilt <= MIN_TILT;
  $("#tilt-angle").textContent = `${Math.round(targetTilt)}°`;
  $("#tilt-reset").disabled = targetTilt === DEFAULT_TILT;
}
const DEFAULT_VIEW_HEIGHT = 18,
  MIN_VIEW_HEIGHT = 10,
  // At 39 the overview held about twice the village's content, which culling
  // cannot reduce; the cap lifts once zoom-based detail reduction exists.
  MAX_VIEW_HEIGHT = 30,
  ZOOM_STEP = 3;
// Beyond these, single leaves cover only a few pixels and trees draw coarser foliage.
const COARSE_LEAVES_VIEW_HEIGHT = 24,
  COARSE_LEAVES_DISTANCE = 18;
const leafDetailFromEye = (center) =>
  center.distanceTo(firstPersonCamera.position) > COARSE_LEAVES_DISTANCE
    ? 1
    : 0;
const leafDetail = () =>
  overrides.leafDetail ??
  (firstPerson
    ? leafDetailFromEye
    : viewHeight > COARSE_LEAVES_VIEW_HEIGHT
      ? 1
      : 0);
let viewHeight = 29,
  targetViewHeight = 29;
function updateZoomControls() {
  $("#zoom-in").disabled = firstPerson || targetViewHeight <= MIN_VIEW_HEIGHT;
  $("#zoom-out").disabled = firstPerson || targetViewHeight >= MAX_VIEW_HEIGHT;
  $("#zoom-reset").disabled =
    firstPerson || targetViewHeight === DEFAULT_VIEW_HEIGHT;
}
function setZoom(height) {
  targetViewHeight = THREE.MathUtils.clamp(
    height,
    MIN_VIEW_HEIGHT,
    MAX_VIEW_HEIGHT,
  );
  updateZoomControls();
}
const target = new THREE.Vector3(0, 0, 1.5),
  cameraTarget = target.clone();
const hemi = new THREE.HemisphereLight("#eaf2df", "#607b66", 1.5);
scene.add(hemi);
const ambient = new THREE.AmbientLight("#ccdabb", 0.22);
scene.add(ambient);
// Eye-level views resolve finer shadow texels than the village overview.
const SHADOW_MAP_SIZES = {
  high: { overview: 2048, firstPerson: 4096 },
  balanced: { overview: 1536, firstPerson: 2048 },
  performance: { overview: 1024, firstPerson: 1024 },
};
const sun = new THREE.DirectionalLight("#fff0d6", 2.4);
sun.position.set(-16, 32, 15);
sun.castShadow = true;
sun.shadow.mapSize.setScalar(SHADOW_MAP_SIZES.high.overview);
sun.shadow.normalBias = 0.045;
scene.add(sun);
scene.add(sun.target);
// Only first person sees the horizon; the overview looks down on the village.
const sky = createSky(THREE, sun);
scene.add(sky.mesh);
const showSky = () => (sky.mesh.visible = firstPerson && (overrides.sky ?? true));
// The sun never moves. Its shadow camera rolls with each yaw step so the overview's
// footprint lines up with the map, and its bounds follow the receivers in view in
// fixed sizes and whole-texel steps, so shadow edges hold still while the view
// follows or pans and change only in small steps while it zooms.
const shadowCamera = sun.shadow.camera;
// The soil rim's base and the tallest canopy on the highest ground bound every
// receiver vertically.
const SHADOW_FLOOR = -1.4,
  SHADOW_CEILING = terrainField.max + WORLD.canopy,
  SHADOW_MARGIN = 1,
  // Depth bias in metres; the shadow map stores depth across near..far.
  SHADOW_BIAS = 0.0126,
  // Fractions of the village's light-space extent, about 12% apart, so a
  // texel's size never depends on the map's. The largest steps cover views
  // wider than the village; any larger view takes the whole map.
  SHADOW_STEPS = Array.from({ length: 17 }, (_, i) =>
    i < 10 ? 0.32 * 1.12 ** i : 1.12 ** (i - 10),
  ),
  // First person fits the shadow to a village-sized box of ground around the
  // eye, reaching this far ahead of it, so eye-level detail keeps the
  // 4096 map's density on a map of any size, and turning only shifts it.
  FIRST_PERSON_SHADOW_AHEAD = 10;
const shadowLight = sun.position.clone().sub(sun.target.position).normalize(),
  shadowPoint = new THREE.Vector3(),
  shadowRay = new THREE.Vector3(),
  shadowSize = new THREE.Vector2(),
  shadowCenter = new THREE.Vector2(),
  shadowView = new THREE.Box2(),
  // Light-space bounds of the village's receivers (the size reference) and of
  // the whole map's (where the shadow box may go).
  villageShadow = new THREE.Box2(),
  worldShadow = new THREE.Box2(),
  shadowStep = [10, 10];
let shadowYaw = null;
// The depth range spans the world's receivers along the light, with a metre spare.
{
  let near = Infinity,
    far = -Infinity;
  const { shadow } = WORLD;
  for (let i = 0; i < 8; i++) {
    shadowPoint.set(
      i & 1 ? shadow.maxX : shadow.minX,
      i & 2 ? SHADOW_CEILING : SHADOW_FLOOR,
      i & 4 ? shadow.maxZ : shadow.minZ,
    );
    const depth = sun.position.clone().sub(shadowPoint).dot(shadowLight);
    near = Math.min(near, depth);
    far = Math.max(far, depth);
  }
  shadowCamera.near = Math.max(0.1, near - 1);
  shadowCamera.far = far + 1;
  sun.shadow.bias = -SHADOW_BIAS / (shadowCamera.far - shadowCamera.near);
}
function addShadowPoint(box, point) {
  point.applyMatrix4(shadowCamera.matrixWorldInverse);
  box.expandByPoint(shadowCenter.set(point.x, point.y));
}
// Adds a ground box's receivers, from the soil rim to the canopy, offset by
// (dx, dz), to a light-space box.
function addShadowBox(box, bounds, dx, dz) {
  for (let i = 0; i < 8; i++)
    addShadowPoint(
      box,
      shadowPoint.set(
        (i & 1 ? bounds.maxX : bounds.minX) + dx,
        i & 2 ? SHADOW_CEILING : SHADOW_FLOOR,
        (i & 4 ? bounds.maxZ : bounds.minZ) + dz,
      ),
    );
  return box;
}
function rollShadow(yaw) {
  // Point light-space x along the screen's right edge, projected across the sunlight.
  const heading = cameraHeading + THREE.MathUtils.degToRad(yaw);
  shadowPoint.set(Math.cos(heading), 0, -Math.sin(heading));
  shadowPoint
    .addScaledVector(shadowLight, -shadowPoint.dot(shadowLight))
    .normalize();
  shadowCamera.up.crossVectors(shadowLight, shadowPoint);
  shadowCamera.position.copy(sun.position);
  shadowCamera.lookAt(sun.target.position);
  shadowCamera.updateMatrixWorld();
  for (const [box, bounds] of [
    [villageShadow, WORLD.shadowReference],
    [worldShadow, WORLD.shadow],
  ])
    addShadowBox(box.makeEmpty(), bounds, 0, 0);
  shadowYaw = yaw;
}
function updateShadowMapSize() {
  const size =
    SHADOW_MAP_SIZES[$("#quality").value][
      firstPerson ? "firstPerson" : "overview"
    ];
  if (sun.shadow.mapSize.x === size) return;
  sun.shadow.mapSize.setScalar(size);
  sun.shadow.map?.dispose();
  sun.shadow.map = null;
  if (!sun.shadow.autoUpdate) sun.shadow.needsUpdate = true;
}
function fitShadow() {
  if (shadowYaw !== targetYaw) rollShadow(targetYaw);
  if (firstPerson) {
    // A village-sized box centred a little ahead of the eye.
    const { shadowReference: v } = WORLD,
      ahead = FIRST_PERSON_SHADOW_AHEAD;
    addShadowBox(
      shadowView.makeEmpty(),
      v,
      firstPersonCamera.position.x - (v.minX + v.maxX) / 2 - Math.sin(yaw) * ahead,
      firstPersonCamera.position.z - (v.minZ + v.maxZ) / 2 - Math.cos(yaw) * ahead,
    );
  } else {
    // Trace the overview's corner rays through every receiver height.
    shadowView.makeEmpty();
    overviewCamera.updateMatrixWorld();
    overviewCamera.getWorldDirection(shadowRay);
    for (let i = 0; i < 8; i++) {
      shadowPoint
        .set(i & 1 ? 1 : -1, i & 2 ? 1 : -1, -1)
        .unproject(overviewCamera);
      const y = i & 4 ? SHADOW_CEILING : SHADOW_FLOOR;
      shadowPoint.addScaledVector(shadowRay, (y - shadowPoint.y) / shadowRay.y);
      addShadowPoint(shadowView, shadowPoint);
    }
    shadowView.expandByScalar(SHADOW_MARGIN);
  }
  shadowView.getSize(shadowSize);
  shadowView.getCenter(shadowCenter);
  const bounds = [0, 0, 0, 0];
  for (const axis of [0, 1]) {
    const key = axis ? "y" : "x",
      reference = villageShadow.max[key] - villageShadow.min[key],
      low = worldShadow.min[key],
      full = worldShadow.max[key] - low,
      last = SHADOW_STEPS.length - 1,
      // Less a hair, so first person's village-sized box takes the 1.0 step.
      needed = Math.min(shadowSize[key], full) / reference - 1e-9;
    // Grow at once; shrink only when the view fits well inside the smaller
    // size. First person's box never changes size, so it takes its step at once.
    let step = shadowStep[axis];
    if (firstPerson || needed > SHADOW_STEPS[step]) {
      step = SHADOW_STEPS.findIndex((s) => s >= needed);
      if (step < 0) step = last;
    } else while (step > 0 && needed < SHADOW_STEPS[step - 1] * 0.96) step--;
    shadowStep[axis] = step;
    const extent = Math.min(reference * SHADOW_STEPS[step], full),
      texel = extent / sun.shadow.mapSize[key],
      start = THREE.MathUtils.clamp(
        shadowCenter[key] - extent / 2,
        low,
        low + full - extent,
      );
    bounds[axis * 2] = Math.floor(start / texel) * texel;
    bounds[axis * 2 + 1] = bounds[axis * 2] + extent;
  }
  const [left, right, bottom, top] = bounds;
  if (
    left !== shadowCamera.left ||
    right !== shadowCamera.right ||
    bottom !== shadowCamera.bottom ||
    top !== shadowCamera.top
  ) {
    Object.assign(shadowCamera, { left, right, bottom, top });
    shadowCamera.updateProjectionMatrix();
  }
}
const fill = new THREE.DirectionalLight("#dae9ec", 0.6);
fill.position.set(15, 14, -20);
scene.add(fill);
const world = createWorld(THREE, scene),
  life = createLife(THREE, scene, world.terrainHeight),
  audio = createAudio();
const sceneTarget = new THREE.WebGLRenderTarget(innerWidth, innerHeight, {
  samples: 4,
  type: THREE.HalfFloatType,
});
const composer = new EffectComposer(renderer, sceneTarget);
const scenePass = new RenderPass(scene, camera);
composer.addPass(scenePass);
const bloom = new SoftBloomPass(0.19, 0.65, 1.15);
composer.addPass(bloom);
composer.addPass(new BloomOutputPass(bloom));
renderer.info.autoReset = false;
// Everything beyond the village streams in after the first outdoor frames.
const streamer = createStreamer(renderer, scene, { target: sceneTarget });
let openCountryRequested = false;
// Lit windows and lamp glass brighten at blue hour. Each chunk lists its own.
const glowMaterials = new Set();
for (const chunk of world.chunks.values())
  for (const material of chunk.glow) glowMaterials.add(material);
const startPos = world.spawn || { x: -3, z: 5 };
life.player.position.set(startPos.x, 0, startPos.z);
const effects = createEffects(scene);
const playerVisibility = createPlayerVisibility(
  scene,
  life.player,
  world.colliders,
  world.treeCanopies,
);
const STORAGE = "willowmere.save.v1";
let state = {
  flowers: 0,
  seeds: 5,
  coins: 120,
  quests: { mabel: false, flower: false, plant: false },
  gathered: [],
  plants: [],
  started: false,
};
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE));
  if (saved && saved.quests && Array.isArray(saved.plants))
    state = { ...state, ...saved };
} catch {}
// Planted flowers are keyed by id, so their meshes can be created in any order.
// Saves from before ids get them in planting order.
let nextPlantId =
  Math.max(-1, ...state.plants.map((p) => (Number.isInteger(p.id) ? p.id : -1))) + 1;
for (const plant of state.plants)
  if (!Number.isInteger(plant.id)) plant.id = nextPlantId++;
let savingWorks = true;
function save() {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(state));
  } catch {
    savingWorks = false;
    $("#save-status").textContent = "This visit cannot be saved";
  }
}
let toastTimeout;
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => $("#toast").classList.remove("show"), 3600);
}
function updateUI() {
  $("#game").classList.toggle(
    "quest-complete",
    Object.values(state.quests).every(Boolean),
  );
  for (const [key, done] of Object.entries(state.quests))
    $(`[data-quest="${key}"]`).classList.toggle("done", done);
  $("#quest-count").textContent =
    `${Object.values(state.quests).filter(Boolean).length} / 3`;
  $("#flower-count").textContent = `${Math.min(state.flowers, 3)}/3`;
  $("#inventory-flower").textContent = state.flowers;
  $("#inventory-seed").textContent = state.seeds;
  $("#coin-count").textContent = state.coins;
}
function complete(quest) {
  if (state.quests[quest]) return;
  state.quests[quest] = true;
  state.coins += 25;
  audio.chime();
  updateUI();
  save();
  if (Object.values(state.quests).every(Boolean))
    setTimeout(
      () => toast("A warm welcome, complete. You belong here. +25 petals"),
      500,
    );
}
const gatheringSpots = [
    [-4, 7],
    [-9, 2],
    [-2, -3],
    [5, 2],
    [6, 7],
    [-12, 7],
    [0, 9],
    [-10, -1],
  ],
  flowerGroups = new Map();
const makeFlower = createFlowerFactory(scene);
const flowerAt = (x, z, planted) => {
  const group = makeFlower(x, z, planted);
  group.position.y = world.terrainHeight(x, z);
  return group;
};
gatheringSpots.forEach(([x, z], i) => {
  if (!state.gathered.includes(i)) flowerGroups.set(i, flowerAt(x, z));
});
const plantedGroups = new Map();
state.plants.forEach((p) => {
  const g = flowerAt(p.x, p.z, true);
  g.scale.setScalar(p.watered ? 1.35 : 0.7);
  plantedGroups.set(p.id, g);
});
let tool = "hand",
  started = state.started,
  photo = false,
  motion = !matchMedia("(prefers-reduced-motion: reduce)").matches,
  dialogue = null,
  nearest = null,
  day = "day";
let interior = null,
  interiorLoading = false;
async function enterBakery() {
  if (interiorLoading || interior?.active) return;
  interiorLoading = true;
  releaseLook();
  begin();
  if (photo) setPhoto(false);
  keys.clear();
  velocity.set(0, 0);
  clickPath.length = 0;
  dialogue = null;
  $("#dialogue").hidden = true;
  try {
    if (!interior) {
      const { createInterior } = await import("./interior.js");
      interior = createInterior({
        renderer,
        onExit: leaveBakery,
        onStep: () => audio.step(),
        onInteract: () => audio.chime(),
      });
    }
    // The scaler only measures the village, so the bakery uses the quality's
    // full ratio; the village resumes at its own ratio on the way out.
    resolution.outdoor = resolution.pixelRatio;
    applyPixelRatio(resolution.ceiling);
    interior.enter();
    const url = new URL(location.href);
    url.searchParams.set("interior", "bakery");
    history.replaceState(null, "", url);
    $("#loading").classList.add("loaded");
  } catch (error) {
    console.error("Could not open bakery", error);
    toast("The bakery couldn’t open. Please try again.");
  } finally {
    interiorLoading = false;
  }
}
function leaveBakery() {
  interior?.exit();
  applyPixelRatio(Math.min(resolution.outdoor, resolution.ceiling));
  keys.clear();
  velocity.set(0, 0);
  const url = new URL(location.href);
  url.searchParams.delete("interior");
  history.replaceState(null, "", url);
  updateViewUI();
  resize();
}
$("#visit-bakery").onclick = enterBakery;
$("#motion").checked = motion;
function begin() {
  if (!started) setZoom(DEFAULT_VIEW_HEIGHT);
  started = true;
  $("#game").classList.add("playing");
  state.started = true;
  $("#intro").classList.add("dismissed");
  save();
  canvas.focus();
}
if (started) {
  $("#intro").classList.add("dismissed");
  $("#game").classList.add("playing");
  viewHeight = targetViewHeight = DEFAULT_VIEW_HEIGHT;
}
updateZoomControls();
$("#zoom-in").onclick = () => setZoom(targetViewHeight - ZOOM_STEP);
$("#zoom-out").onclick = () => setZoom(targetViewHeight + ZOOM_STEP);
$("#zoom-reset").onclick = () => setZoom(DEFAULT_VIEW_HEIGHT);
updateTiltControls();
$("#tilt-up").onclick = () => setTilt(targetTilt + TILT_STEP);
$("#tilt-down").onclick = () => setTilt(targetTilt - TILT_STEP);
$("#tilt-reset").onclick = () => setTilt(DEFAULT_TILT);
setYaw(0);
$("#yaw-left").onclick = () => setYaw(targetYaw - YAW_STEP);
$("#yaw-right").onclick = () => setYaw(targetYaw + YAW_STEP);
$("#yaw-reset").onclick = () => setYaw(0);
setPan(0, 0);
$("#pan-left").onclick = () => setPan(targetPan.x - PAN_STEP, targetPan.y);
$("#pan-right").onclick = () => setPan(targetPan.x + PAN_STEP, targetPan.y);
$("#pan-up").onclick = () => setPan(targetPan.x, targetPan.y - PAN_STEP);
$("#pan-down").onclick = () => setPan(targetPan.x, targetPan.y + PAN_STEP);
$("#pan-reset").onclick = () => setPan(0, 0);
$("#start").onclick = () => {
  begin();
  toast("Follow the paths. A little adventure is all you need.");
};
function selectTool(value) {
  tool = value;
  $$(".tool").forEach((b) =>
    b.classList.toggle("active", b.dataset.tool === tool),
  );
}
$$(".tool").forEach(
  (b) =>
    (b.onclick = () => {
      begin();
      selectTool(b.dataset.tool);
      if (tool === "seeds")
        toast("Find an open patch of grass, then press E to plant.");
      if (tool === "water") toast("Stand beside a planted flower and press E.");
    }),
);
const keys = new Set(),
  velocity = new THREE.Vector2(),
  clickPath = [];
function releaseLook() {
  if (dragging && canvas.hasPointerCapture(dragging.id))
    canvas.releasePointerCapture(dragging.id);
  dragging = null;
  if (document.pointerLockElement === canvas) document.exitPointerLock();
}
function updateViewUI() {
  $("#game").classList.toggle("first-person", firstPerson);
  $("#view-toggle").setAttribute("aria-pressed", String(firstPerson));
  $("#view-toggle").innerHTML = firstPerson
    ? "Village view <kbd>V</kbd>"
    : "First person <kbd>V</kbd>";
  $("#free-look").hidden = !firstPerson;
  $("#view-help").hidden = !firstPerson;
  $("#photo-hint span").textContent = firstPerson
    ? "Drag to look · V to switch views · Press P or Esc to return"
    : "Scroll to frame · Press P or Esc to return";
  canvas.setAttribute(
    "aria-label",
    firstPerson
      ? "First-person village. WASD to walk, drag to look, arrow keys to turn, Page Up and Page Down to look up and down, E to interact, V to switch views."
      : "Interactive village. Move with WASD or arrow keys, interact with E. V for first person.",
  );
  updateZoomControls();
}
function setFirstPerson(value) {
  releaseLook();
  keys.clear();
  velocity.set(0, 0);
  clickPath.length = 0;
  if (value && !firstPerson) {
    yaw = life.player.rotation.y + Math.PI;
    pitch = -0.08;
  }
  firstPerson = value;
  Object.assign(scene.fog, firstPerson ? FOG.firstPerson : FOG.overview);
  updateShadowMapSize();
  camera = firstPerson ? firstPersonCamera : overviewCamera;
  scenePass.camera = camera;
  life.player.visible = !firstPerson;
  showSky();
  state.viewMode = firstPerson ? "first-person" : "overview";
  updateViewUI();
  save();
  canvas.focus({ preventScroll: true });
}
setFirstPerson(state.viewMode === "first-person");
$("#view-toggle").onclick = () => {
  begin();
  setFirstPerson(!firstPerson);
};
$("#free-look").onclick = async () => {
  if (!canLook()) return;
  if (document.pointerLockElement === canvas) return releaseLook();
  try {
    if (!canvas.requestPointerLock) throw new Error("Pointer lock unavailable");
    await canvas.requestPointerLock();
  } catch {
    toast(
      "Drag the scene to look around. You can also turn with the arrow keys.",
    );
  }
};
function canLook() {
  return (
    firstPerson &&
    !interior?.active &&
    !interiorLoading &&
    !dialogue &&
    !modalOpen()
  );
}
function look(dx, dy) {
  yaw -= dx * 0.0035;
  pitch = THREE.MathUtils.clamp(pitch - dy * 0.0035, -1.35, 1.35);
}
document.addEventListener("pointerlockchange", () => {
  if (interior?.active) return;
  const locked = document.pointerLockElement === canvas;
  $("#free-look").setAttribute("aria-pressed", String(locked));
  if (!locked) {
    keys.clear();
    velocity.set(0, 0);
  }
});
document.addEventListener("pointermove", (e) => {
  if (!canLook()) return;
  if (document.pointerLockElement === canvas) look(e.movementX, e.movementY);
  else if (dragging?.id === e.pointerId) {
    look(e.clientX - dragging.x, e.clientY - dragging.y);
    dragging.x = e.clientX;
    dragging.y = e.clientY;
  }
});
const stopLook = (e) => {
  if (dragging?.id === e.pointerId) dragging = null;
};
canvas.addEventListener("pointerup", stopLook);
canvas.addEventListener("pointercancel", stopLook);
canvas.addEventListener("lostpointercapture", stopLook);
let lastStep = 0;
function modalOpen() {
  return !!document.querySelector("dialog[open]");
}
function openDialogue(name, lines, onFinish) {
  releaseLook();
  dialogue = { name, lines, index: 0, onFinish };
  $("#speaker").textContent = name;
  $("#dialogue-text").textContent = lines[0];
  $("#dialogue-next").innerHTML =
    lines.length > 1 ? "Continue <span>→</span>" : "Lovely <span>✓</span>";
  $("#dialogue").hidden = false;
  clickPath.length = 0;
  keys.clear();
  $("#dialogue-next").focus();
}
function nextDialogue() {
  if (!dialogue) return;
  dialogue.index++;
  if (dialogue.index < dialogue.lines.length) {
    $("#dialogue-text").textContent = dialogue.lines[dialogue.index];
    $("#dialogue-next").innerHTML =
      dialogue.index === dialogue.lines.length - 1
        ? "Lovely <span>✓</span>"
        : "Continue <span>→</span>";
  } else {
    const finish = dialogue.onFinish;
    dialogue = null;
    $("#dialogue").hidden = true;
    finish?.();
    canvas.focus();
  }
}
$("#dialogue-next").onclick = nextDialogue;
function refreshJournal() {
  const rows = [
    [
      "Meet the neighbors",
      state.quests.mabel
        ? "Mabel saved you a place among the flowers."
        : "Mabel tends the flowers just west of the fountain.",
    ],
    [
      "A pocketful of sunshine",
      `You’ve gathered ${state.flowers} wildflower${state.flowers === 1 ? "" : "s"}. Look for the pale rings around little bouquets.`,
    ],
    [
      "Put down roots",
      state.quests.plant
        ? `${state.plants.length} new patch${state.plants.length === 1 ? "" : "es"} of flowers make the village a little more yours.`
        : "Choose the seed pouch (3), find an open patch, and press E.",
    ],
  ];
  $("#journal-content").replaceChildren(
    ...rows.map(([title, body]) => {
      const d = document.createElement("div");
      d.className = "journal-entry";
      const b = document.createElement("b");
      b.textContent = title;
      const s = document.createElement("span");
      s.textContent = body;
      d.append(b, s);
      return d;
    }),
  );
}
function openModal(id) {
  releaseLook();
  keys.clear();
  clickPath.length = 0;
  const d = $(id);
  if (d.open) d.close();
  else d.showModal();
}
$("#journal-button").onclick = () => {
  refreshJournal();
  openModal("#journal");
};
$("#settings").onclick = () => openModal("#settings-dialog");
$$(".close-modal").forEach(
  (b) => (b.onclick = () => b.closest("dialog").close()),
);
$$("dialog").forEach((d) => {
  d.addEventListener("click", (e) => {
    if (e.target === d) {
      const r = d.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        d.close();
    }
  });
  d.addEventListener("close", () => canvas.focus());
});
function setPhoto(value) {
  photo = value;
  $("#game").classList.toggle("photo-mode", photo);
  $("#photo-hint").hidden = !photo;
  if (photo) {
    begin();
    $("#photo-hint").hidden = false;
  }
  canvas.focus();
}
$("#photo-button").onclick = () => setPhoto(!photo);
$("#sound").onclick = async () => {
  try {
    const on = await audio.toggle();
    $("#sound").classList.toggle("on", on);
    $("#sound").setAttribute(
      "aria-label",
      on ? "Mute ambient audio" : "Enable ambient audio",
    );
  } catch {
    toast("Ambient audio is unavailable in this browser.");
  }
};
$("#volume").oninput = (e) => audio.setVolume(Number(e.target.value) / 100);
$("#motion").onchange = (e) => (motion = e.target.checked);
$("#quality").onchange = (e) => {
  const q = e.target.value;
  world.water.setQuality(q);
  // The chosen quality is the scaler's ceiling.
  resetResolution(q);
  updateShadowMapSize();
  bloom.enabled = overrides.bloom ?? q !== "performance";
  resize();
};
$("#day-select").onchange = (e) => {
  day = e.target.value;
  $("#time-label").innerHTML =
    day === "day"
      ? "4:30 PM <i>·</i> Golden afternoon"
      : "7:45 PM <i>·</i> Blue hour";
  $("#weather-icon").textContent = day === "day" ? "☼" : "☾";
};
$("#reset-position").onclick = () => {
  life.player.position.set(startPos.x, 0, startPos.z);
  velocity.set(0, 0);
  clickPath.length = 0;
  $("#settings-dialog").close();
  toast("Back home, on the village green.");
};
const colliders = world.colliders || [];
const { walk } = WORLD;
function blocked(x, z, r = 0.27) {
  if (
    x < walk.minX + r ||
    x > walk.maxX - r ||
    z < walk.minZ + r ||
    z > walk.maxZ - r
  )
    return true;
  for (const c of colliders) {
    if (c.r !== undefined) {
      if (Math.hypot(x - c.x, z - c.z) < r + c.r) return true;
    } else if (c.w !== undefined) {
      const dx = Math.max(Math.abs(x - c.x) - c.w / 2, 0),
        dz = Math.max(Math.abs(z - c.z) - c.d / 2, 0);
      if (dx * dx + dz * dz < r * r) return true;
    }
  }
  return false;
}
function openGrass(x, z) {
  return (
    world.isPlantable(x, z) &&
    !blocked(x, z, 0.55) &&
    state.plants.every((p) => Math.hypot(x - p.x, z - p.z) > 0.75)
  );
}
const oneOf = (list) => list[Math.floor(Math.random() * list.length)];
function interact() {
  if (interior?.active || interiorLoading) return;
  if (dialogue) {
    nextDialogue();
    return;
  }
  if (modalOpen()) return;
  begin();
  const p = life.player.position;
  if (tool === "seeds") {
    if (state.seeds <= 0) {
      toast("Your seed pouch is empty. Finn has a few to spare.");
      return;
    }
    const facing = firstPerson ? yaw + Math.PI : life.player.rotation.y;
    let fx = p.x + Math.sin(facing) * 0.8,
      fz = p.z + Math.cos(facing) * 0.8;
    if (!openGrass(fx, fz)) {
      toast("Find a little more room for those roots.");
      return;
    }
    const plant = { id: nextPlantId++, x: fx, z: fz, watered: false };
    state.plants.push(plant);
    if (motion) effects.burst(fx, world.terrainHeight(fx, fz) + 0.4, fz);
    const g = flowerAt(fx, fz, true);
    g.scale.setScalar(0.7);
    plantedGroups.set(plant.id, g);
    state.seeds--;
    complete("plant");
    updateUI();
    save();
    audio.chime();
    toast("A small beginning. Your flowers are planted.");
    return;
  }
  if (tool === "water") {
    const plant = state.plants.find(
      (q) => Math.hypot(q.x - p.x, q.z - p.z) < 2 && !q.watered,
    );
    if (!plant) {
      toast("Plant some flowers first, then give them a drink.");
      return;
    }
    plant.watered = true;
    if (motion)
      effects.burst(plant.x, world.terrainHeight(plant.x, plant.z) + 0.4, plant.z);
    state.coins += 5;
    save();
    updateUI();
    audio.chime();
    toast("A little water, a little sunshine. +5 petals");
    return;
  }
  if (!nearest) {
    toast("Wander closer to a neighbor, a flower, or a village landmark.");
    return;
  }
  if (nearest.kind === "flower") {
    const id = nearest.id;
    const fg = flowerGroups.get(id);
    if (motion)
      effects.burst(fg.position.x, fg.position.y + 0.4, fg.position.z);
    scene.remove(fg);
    flowerGroups.delete(id);
    state.gathered.push(id);
    state.flowers++;
    if (state.flowers >= 3) complete("flower");
    save();
    updateUI();
    audio.chime();
    toast(`A wildflower for your pocket. ${state.flowers} gathered.`);
    nearest = null;
    return;
  }
  if (nearest.kind === "npc") {
    const n = nearest.data;
    const phrases = n.dialogue?.length
      ? n.dialogue
      : ["A lovely day to be here, isn’t it?"];
    const names = {
      mabel: "MABEL · THE FLORIST",
      finn: "FINN · THE BAKER",
      elio: "ELIO · THE GARDENER",
    };
    openDialogue(names[n.id] || n.name, [oneOf(phrases)], () => {
      if (n.id === "mabel") complete("mabel");
      if (n.id === "finn" && state.seeds < 3) {
        state.seeds += 3;
        updateUI();
        save();
        toast("Finn tucked three seeds into your pouch.");
      }
    });
    return;
  }
  const id = nearest.data.id || nearest.data.type;
  if (id === "bakery") {
    enterBakery();
    return;
  }
  const dialogues = {
    fountain: [
      "Listen closely. Beneath the splashing water, the whole village seems to hum.",
      "Someone has left a little wish on the rim: “May we always have enough to share.”",
      "A copper coin glints at the bottom, worn smooth by years of hopeful thumbs.",
      "A sparrow perches on the rim, takes a sip, and flies off as if it has somewhere wonderful to be.",
      "The water catches the sky and hands it back a little brighter.",
      "Chalked on the stone in a child’s hand: “I wish for a puppy. Or two.”",
      "You make a small wish. The fountain keeps it, the way good friends keep secrets.",
      "The spray drifts over your hands, cool as the first morning of autumn.",
      "Ripples spread from the falling water and fold back into stillness. Your breathing slows to match.",
      "Mabel says the fountain was here before the village. Everyone else simply gathered round it.",
      "A pressed daisy and a sun-warmed penny sit side by side on the ledge, both left for luck.",
      "If you listen long enough, the splashing starts to sound like distant laughter.",
      "Carved faintly into the basin: “Wish small, wish often.”",
      "A dragonfly skims the surface, writes something on the water, and erases it again.",
      "Moss has grown soft around the basin, as if the stones wanted somewhere comfortable to sit.",
    ],
    bakery: [
      "Warm bread, wild honey, and a hint of cinnamon drift through the open window.",
      "Finn is just outside. He’s always happy to share a story — and a few seeds.",
    ],
    home: [
      "Your little cottage. The kettle is warm, and the afternoon can wait.",
      "There’s nowhere you need to be. You’re home.",
    ],
    mill: [
      "The old wheel turns with the river, as it has for a hundred quiet summers.",
    ],
    garden: [
      "Good things grow slowly. Choose your seeds, find a little space, and begin.",
    ],
  };
  // Like a neighbor, a landmark answers each interaction with a single line.
  openDialogue(nearest.data.name.toUpperCase(), [
    oneOf(
      dialogues[id] || [
        "Some places ask you to slow down. This is one of them.",
      ],
    ),
  ]);
}
window.addEventListener("keydown", (e) => {
  if (interior?.active) {
    interior.key(e);
    return;
  }
  if (interiorLoading) return;
  if (e.target.matches("input,select,textarea")) return;
  if (e.target.closest(".view-controls") && [" ", "Enter"].includes(e.key)) return;
  const k = e.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k))
    e.preventDefault();
  if (e.repeat && ["e", "j", "p", "v", "escape"].includes(k)) return;
  if (k === "escape") {
    releaseLook();
    if (photo) setPhoto(false);
    if (dialogue) {
      dialogue = null;
      $("#dialogue").hidden = true;
    }
    return;
  }
  if (modalOpen()) return;
  if (k === "e" || k === " ") {
    interact();
    return;
  }
  if (dialogue) return;
  if (k === "v") {
    begin();
    setFirstPerson(!firstPerson);
    return;
  }
  if (firstPerson && ["pageup", "pagedown"].includes(k)) e.preventDefault();
  if (k === "j") {
    $("#journal-button").click();
    return;
  }
  if (k === "p") {
    setPhoto(!photo);
    return;
  }
  if (["1", "2", "3", "4"].includes(k))
    selectTool(["hand", "flowers", "seeds", "water"][+k - 1]);
  keys.add(k);
  if (
    [
      "w",
      "a",
      "s",
      "d",
      "arrowup",
      "arrowdown",
      "arrowleft",
      "arrowright",
    ].includes(k)
  ) {
    begin();
    clickPath.length = 0;
  }
});
window.addEventListener("keyup", (e) => {
  keys.delete(e.key.toLowerCase());
  interior?.keyUp(e);
});
window.addEventListener("blur", () => {
  releaseLook();
  keys.clear();
  velocity.set(0, 0);
  interior?.blur();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    releaseLook();
    keys.clear();
    velocity.set(0, 0);
    interior?.blur();
  }
});
$$("[data-key]").forEach((b) => {
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    keys.add(b.dataset.key.toLowerCase());
    clickPath.length = 0;
    begin();
  });
  const release = () => keys.delete(b.dataset.key.toLowerCase());
  b.addEventListener("pointerup", release);
  b.addEventListener("pointercancel", release);
  b.addEventListener("lostpointercapture", release);
});
$("#touch-interact").onclick = interact;
// A grid search gives point-and-click movement a route around cottages and across the bridge.
// Colliders never move, so each cell's walkability is sampled once, on the first click.
const ROUTE_STEP = 0.65,
  ROUTE = {
    step: ROUTE_STEP,
    minX: walk.minX,
    minZ: walk.minZ,
    cols: Math.floor((walk.maxX - walk.minX) / ROUTE_STEP + 1e-6) + 1,
    rows: Math.floor((walk.maxZ - walk.minZ) / ROUTE_STEP + 1e-6) + 1,
    radius: 0.34,
  };
const routeWalkable = new Uint8Array(ROUTE.cols * ROUTE.rows);
let routeRows = 0;
// Samples rows until the deadline, or all of them; true once the grid is done.
function sampleRouteRows(deadline = Infinity) {
  const { step, minX, minZ, cols, rows, radius } = ROUTE;
  while (routeRows < rows) {
    const z = routeRows++;
    for (let x = 0; x < cols; x++)
      if (!blocked(minX + x * step, minZ + z * step, radius))
        routeWalkable[z * cols + x] = 1;
    if (performance.now() > deadline) break;
  }
  return routeRows === rows;
}
// The grid streams in with the open country; a click before then finishes it.
streamer.add({
  x: 0,
  z: 0,
  step: (deadline) => (sampleRouteRows(deadline) ? [] : null),
});
function walkableCells() {
  sampleRouteRows();
  return routeWalkable;
}
const ROUTE_MOVES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
function findPath(start, end) {
  if (blocked(end.x, end.z, 0.3)) return [];
  const { step, minX, minZ, cols, rows } = ROUTE,
    walkable = walkableCells(),
    toCell = (v, min, count) =>
      THREE.MathUtils.clamp(Math.round((v - min) / step), 0, count - 1),
    toWorld = (i) => ({
      x: minX + (i % cols) * step,
      z: minZ + Math.floor(i / cols) * step,
    }),
    sx = toCell(start.x, minX, cols),
    sz = toCell(start.z, minZ, rows),
    ex = toCell(end.x, minX, cols),
    ez = toCell(end.z, minZ, rows),
    startCell = sz * cols + sx,
    cost = new Float32Array(cols * rows).fill(Infinity),
    came = new Int32Array(cols * rows).fill(-1),
    closed = new Uint8Array(cols * rows),
    // Binary min-heap of cells keyed by estimated total cost; stale entries are skipped.
    heapCell = [],
    heapF = [];
  const push = (cell, f) => {
    let i = heapCell.length;
    heapCell.push(cell);
    heapF.push(f);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heapF[parent] <= f) break;
      heapCell[i] = heapCell[parent];
      heapF[i] = heapF[parent];
      i = parent;
    }
    heapCell[i] = cell;
    heapF[i] = f;
  };
  const pop = () => {
    const top = heapCell[0],
      lastCell = heapCell.pop(),
      lastF = heapF.pop(),
      n = heapCell.length;
    if (n) {
      let i = 0;
      for (;;) {
        let child = 2 * i + 1;
        if (child >= n) break;
        if (child + 1 < n && heapF[child + 1] < heapF[child]) child++;
        if (heapF[child] >= lastF) break;
        heapCell[i] = heapCell[child];
        heapF[i] = heapF[child];
        i = child;
      }
      heapCell[i] = lastCell;
      heapF[i] = lastF;
    }
    return top;
  };
  cost[startCell] = 0;
  push(startCell, 0);
  let found = -1;
  while (heapCell.length) {
    const cell = pop();
    if (closed[cell]) continue;
    const cx = cell % cols,
      cz = (cell - cx) / cols;
    if (Math.abs(cx - ex) + Math.abs(cz - ez) <= 1) {
      found = cell;
      break;
    }
    closed[cell] = 1;
    for (const [dx, dz] of ROUTE_MOVES) {
      const nx = cx + dx,
        nz = cz + dz,
        next = nz * cols + nx;
      if (nx < 0 || nx >= cols || nz < 0 || nz >= rows || closed[next])
        continue;
      if (!walkable[next]) continue;
      if (dx && dz && !(walkable[cz * cols + nx] && walkable[nz * cols + cx]))
        continue;
      const g = cost[cell] + Math.hypot(dx, dz);
      if (g < cost[next]) {
        cost[next] = g;
        came[next] = cell;
        push(next, g + Math.hypot(nx - ex, nz - ez));
      }
    }
  }
  if (found < 0) return [];
  const result = [end];
  for (let cell = found; cell !== startCell && cell >= 0; cell = came[cell])
    result.push(toWorld(cell));
  return result.reverse();
}
const raycaster = new THREE.Raycaster(),
  mouse = new THREE.Vector2(),
  groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
  hit = new THREE.Vector3();
// Where a ray meets the terrain: intersect a level plane, then move the plane
// to the ground height under the hit and repeat. Flat ground needs one pass;
// gentle slopes settle within a few.
function pickGround(ray, out) {
  let height = 0;
  for (let i = 0; i < 6; i++) {
    groundPlane.constant = -height;
    if (!ray.intersectPlane(groundPlane, out)) return null;
    const next = world.terrainHeight(out.x, out.z);
    if (Math.abs(next - height) < 0.005) return out;
    height = next;
  }
  return out;
}
const destination = new THREE.Mesh(
  new THREE.RingGeometry(0.25, 0.29, 32),
  new THREE.MeshBasicMaterial({
    color: "#fff3c8",
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
  }),
);
destination.rotation.x = -Math.PI / 2;
destination.visible = false;
scene.add(destination);
canvas.addEventListener("pointerdown", (e) => {
  if (interior?.active || interiorLoading) return;
  if (e.button !== 0 || dialogue || modalOpen()) return;
  begin();
  if (firstPerson) {
    if (document.pointerLockElement === canvas) interact();
    else if (!dragging) {
      dragging = { id: e.pointerId, x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    }
    return;
  }
  const r = canvas.getBoundingClientRect();
  mouse.set(
    ((e.clientX - r.left) / r.width) * 2 - 1,
    (-(e.clientY - r.top) / r.height) * 2 + 1,
  );
  raycaster.setFromCamera(mouse, camera);
  if (pickGround(raycaster.ray, hit)) {
    const route = findPath(life.player.position, { x: hit.x, z: hit.z });
    clickPath.splice(0, clickPath.length, ...route);
    if (route.length) {
      destination.position.set(hit.x, world.terrainHeight(hit.x, hit.z) + 0.03, hit.z);
      destination.visible = true;
    }
  }
});
canvas.addEventListener(
  "wheel",
  (e) => {
    if (interior?.active || interiorLoading || firstPerson) return;
    e.preventDefault();
    setZoom(targetViewHeight + e.deltaY * 0.012);
  },
  { passive: false },
);
function updateFrustum() {
  const w = innerWidth,
    h = innerHeight;
  const aspect = w / h;
  const height = aspect < 0.9 ? viewHeight * 1.35 : viewHeight;
  overviewCamera.left = (-height * aspect) / 2;
  overviewCamera.right = (height * aspect) / 2;
  overviewCamera.top = height / 2;
  overviewCamera.bottom = -height / 2;
  overviewCamera.updateProjectionMatrix();
  firstPersonCamera.aspect = aspect;
  firstPersonCamera.fov = aspect < 0.8 ? 78 : 66;
  firstPersonCamera.updateProjectionMatrix();
}
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  updateFrustum();
  interior?.resize();
}
window.addEventListener("resize", () => {
  // Moving to a screen with another density changes the quality's ceiling.
  const q = $("#quality").value;
  if (Math.min(devicePixelRatio, QUALITY_PIXEL_RATIO[q]) !== resolution.ceiling)
    resetResolution(q);
  resize();
});
$("#quality").value = startQuality;
$("#quality").dispatchEvent(new Event("change"));
function scanNearby() {
  if (dialogue || photo || modalOpen()) {
    $("#interaction").hidden = true;
    return;
  }
  const p = life.player.position;
  let candidates = [];
  for (const n of life.npcs) {
    const x = n.group?.position.x ?? n.x,
      z = n.group?.position.z ?? n.z,
      d = Math.hypot(p.x - x, p.z - z);
    if (d < 2.25)
      candidates.push({
        kind: "npc",
        data: n,
        d,
        label: `Say hello to ${n.name.split(" ")[0]}`,
      });
  }
  for (const [id, g] of flowerGroups) {
    const d = Math.hypot(p.x - g.position.x, p.z - g.position.z);
    if (d < 1.65)
      candidates.push({ kind: "flower", id, d, label: "Gather wildflowers" });
  }
  for (const i of world.interactables || []) {
    const d = Math.hypot(p.x - i.x, p.z - i.z);
    if (d < (i.radius || 2.4))
      candidates.push({
        kind: "world",
        data: i,
        d: d + 0.4,
        label: i.id === "bakery" ? "Enter The Daily Loaf" : i.name,
      });
  }
  candidates.sort((a, b) => a.d - b.d);
  nearest = candidates[0] || null;
  const label =
    tool === "seeds"
      ? "Plant a little happiness"
      : tool === "water"
        ? "Water your flowers"
        : nearest?.label;
  $("#interaction").hidden = !label || !started;
  if (label) $("#interaction span").textContent = label;
  $("#location-name").textContent = regionAt(p.x, p.z).name;
}
let elapsed = 0,
  last = performance.now(),
  frame = 0,
  duskMix = 0,
  skyTime = 0;
const screenRight = new THREE.Vector2(
    cameraOffset.z,
    -cameraOffset.x,
  ).normalize(),
  screenDown = new THREE.Vector2(cameraOffset.x, cameraOffset.z).normalize(),
  input = new THREE.Vector2(),
  duskHemi = new THREE.Color("#8dacef"),
  duskSun = new THREE.Color("#ffa572"),
  duskSky = new THREE.Color("#566782"),
  viewFrustum = new THREE.Frustum(),
  shadowFrustum = new THREE.Frustum(),
  animationFrustums = [viewFrustum, shadowFrustum],
  frustumMatrix = new THREE.Matrix4();
function animate(now) {
  requestAnimationFrame(animate);
  const interval = now - last;
  const dt = Math.min(interval / 1000, 0.045);
  last = now;
  if (document.hidden) return;
  elapsed += dt;
  frame++;
  if (interior?.active) {
    interior.update(dt, elapsed, motion);
    return;
  }
  updateResolution(now, interval);
  // Take the shortest arc, including when rotation crosses the 0°/360° seam.
  const yawDelta = THREE.MathUtils.euclideanModulo(targetYaw - overviewYaw + 180, 360) - 180;
  overviewYaw = motion
    ? THREE.MathUtils.euclideanModulo(overviewYaw + yawDelta * (1 - Math.exp(-dt * 8)), 360)
    : targetYaw;
  const heading = cameraHeading + THREE.MathUtils.degToRad(overviewYaw);
  screenRight.set(Math.cos(heading), -Math.sin(heading));
  screenDown.set(Math.sin(heading), Math.cos(heading));
  const p = life.player.position;
  input.set(0, 0);
  if (!dialogue && !modalOpen()) {
    if (firstPerson) {
      yaw +=
        ((keys.has("arrowleft") ? 1 : 0) - (keys.has("arrowright") ? 1 : 0)) *
        dt *
        1.65;
      pitch = THREE.MathUtils.clamp(
        pitch +
          ((keys.has("pageup") ? 1 : 0) - (keys.has("pagedown") ? 1 : 0)) * dt,
        -1.35,
        1.35,
      );
    }
    const horiz =
        (keys.has("d") || (!firstPerson && keys.has("arrowright")) ? 1 : 0) -
        (keys.has("a") || (!firstPerson && keys.has("arrowleft")) ? 1 : 0),
      vert =
        (keys.has("s") || keys.has("arrowdown") ? 1 : 0) -
        (keys.has("w") || keys.has("arrowup") ? 1 : 0);
    if (firstPerson)
      input.set(
        Math.cos(yaw) * horiz + Math.sin(yaw) * vert,
        -Math.sin(yaw) * horiz + Math.cos(yaw) * vert,
      );
    else
      input
        .copy(screenRight)
        .multiplyScalar(horiz)
        .addScaledVector(screenDown, vert);
    if (input.lengthSq() > 0) input.normalize();
    else if (clickPath.length) {
      let dest = clickPath[0];
      input.set(dest.x - p.x, dest.z - p.z);
      if (input.length() < 0.16) {
        clickPath.shift();
        input.set(0, 0);
      } else input.normalize();
    }
  }
  const speed = keys.has("shift") ? 5.1 : 3.0;
  velocity.lerp(input.multiplyScalar(speed), 1 - Math.exp(-dt * 14));
  if (input.lengthSq() < 0.001 && velocity.length() < 0.06) velocity.set(0, 0);
  const subdivisions = Math.max(1, Math.ceil((velocity.length() * dt) / 0.12));
  for (let i = 0; i < subdivisions; i++) {
    const nx = p.x + (velocity.x * dt) / subdivisions,
      nz = p.z + (velocity.y * dt) / subdivisions;
    if (!blocked(nx, p.z)) p.x = nx;
    else velocity.x = 0;
    if (!blocked(p.x, nz)) p.z = nz;
    else velocity.y = 0;
  }
  p.y = world.getGroundHeight?.(p.x, p.z) ?? 0.05;
  const moving = velocity.length() > 0.08;
  life.setPlayerMotion(velocity.x, velocity.y);
  life.update(dt, elapsed, moving, motion);
  if (moving && elapsed - lastStep > 0.33) {
    audio.step();
    lastStep = elapsed;
  }
  // The view stays composed around the village, then gently accompanies longer
  // walks, up to the map's edge.
  const follow = started ? 0.85 : 0.48,
    bounds = WORLD.camera;
  target.set(
    THREE.MathUtils.clamp(p.x * follow, bounds.minX, bounds.maxX),
    0,
    THREE.MathUtils.clamp(1.5 + (p.z - 5) * follow, bounds.minZ, bounds.maxZ),
  );
  if (Math.abs(viewHeight - targetViewHeight) > 0.01) {
    viewHeight = THREE.MathUtils.lerp(
      viewHeight,
      targetViewHeight,
      1 - Math.exp(-dt * 2.4),
    );
    updateFrustum();
  }
  cameraTarget.lerp(target, 1 - Math.exp(-dt * 1.8));
  tilt = motion
    ? THREE.MathUtils.lerp(tilt, targetTilt, 1 - Math.exp(-dt * 8))
    : targetTilt;
  // Pitch around the view's horizontal axis, preserving heading and distance.
  const overviewPitch = THREE.MathUtils.degToRad(tilt),
    groundDistance = cameraDistance * Math.cos(overviewPitch);
  cameraOffset.set(
    groundDistance * Math.sin(heading),
    cameraDistance * Math.sin(overviewPitch),
    groundDistance * Math.cos(heading),
  );
  if (motion) pan.lerp(targetPan, 1 - Math.exp(-dt * 8));
  else pan.copy(targetPan);
  // Keep pan directions aligned with the screen on the village's ground plane.
  panOffset.set(
    screenRight.x * pan.x + screenDown.x * pan.y,
    0,
    screenRight.y * pan.x + screenDown.y * pan.y,
  );
  viewTarget.copy(cameraTarget).add(panOffset);
  overviewCamera.position.copy(viewTarget).add(cameraOffset);
  overviewCamera.lookAt(viewTarget);
  firstPersonCamera.position.copy(p).y += 1.65;
  firstPersonCamera.rotation.set(pitch, yaw, 0, "YXZ");
  // Chunks animate while the view or the sun's shadow can see them.
  camera.updateMatrixWorld();
  viewFrustum.setFromProjectionMatrix(
    frustumMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    ),
  );
  shadowFrustum.setFromProjectionMatrix(
    frustumMatrix.multiplyMatrices(
      shadowCamera.projectionMatrix,
      shadowCamera.matrixWorldInverse,
    ),
  );
  world.update(motion ? dt : 0, motion ? elapsed : 0, animationFrustums);
  destination.visible = clickPath.length > 0;
  if (destination.visible) {
    destination.scale.setScalar(1 + Math.sin(elapsed * 4) * 0.12);
    destination.material.opacity = 0.5 + Math.sin(elapsed * 3) * 0.2;
  }
  for (const plant of state.plants) {
    const g = plantedGroups.get(plant.id);
    if (!g) continue;
    const targetScale = plant.watered ? 1.35 : 0.7;
    g.scale.setScalar(
      THREE.MathUtils.lerp(g.scale.x, targetScale, 1 - Math.exp(-dt * 1.5)),
    );
  }
  duskMix = THREE.MathUtils.lerp(
    duskMix,
    day === "dusk" ? 1 : 0,
    1 - Math.exp(-dt * 1.5),
  );
  sun.intensity = THREE.MathUtils.lerp(2.4, 0.6, duskMix);
  hemi.intensity = THREE.MathUtils.lerp(1.5, 1.0, duskMix);
  hemi.color.set("#eaf2df").lerp(duskHemi, duskMix);
  sun.color.set("#fff0d6").lerp(duskSun, duskMix);
  scene.background.set("#abc2a1").lerp(duskSky, duskMix);
  scene.fog.color.copy(scene.background);
  if (motion) skyTime += dt;
  sky.update(duskMix, skyTime, scene.fog.color);
  world.placeLanterns?.(
    firstPerson ? p.x : viewTarget.x,
    firstPerson ? p.z : viewTarget.z,
  );
  for (const light of world.lanterns || [])
    light.intensity = THREE.MathUtils.lerp(0.1, 18.0, duskMix);
  renderer.toneMappingExposure = THREE.MathUtils.lerp(1.05, 0.95, duskMix);
  effects.update(dt, motion);
  if (frame % 8 === 0) scanNearby();
  for (const material of glowMaterials)
    material.emissiveIntensity = THREE.MathUtils.lerp(0.25, 2.0, duskMix);
  playerVisibility.update(camera, !photo && !firstPerson);
  world.trees.setDetail(leafDetail());
  if (firstPerson) world.setDetailFocus(p.x, p.z);
  else world.setDetailFocus();
  streamer.update(p.x, p.z, camera);
  fitShadow();
  scene.updateMatrixWorld();
  renderer.info.reset();
  // RenderPass draws into readBuffer; water resolves refraction from that pass.
  if (overrides.water ?? true)
    world.water.render(renderer, camera, {
      dt,
      dusk: duskMix,
      sun,
      target: composer.readBuffer,
    });
  composer.render();
  if (frame === 3) $("#loading").classList.add("loaded");
  // The open country's code loads once the village is on screen.
  if (frame >= 3 && !openCountryRequested) {
    openCountryRequested = true;
    import("./regions/outskirts.js").then(({ outskirtsJobs }) =>
      streamer.add(...outskirtsJobs(THREE, world)),
    );
  }
}
updateUI();
requestAnimationFrame(animate);
// Applies the benchmark overrides, or the defaults for anything not overridden.
function applyTune() {
  const q = $("#quality").value;
  const shadowUpdate = overrides.shadowUpdate ?? true;
  if (!shadowUpdate && sun.shadow.autoUpdate) sun.shadow.needsUpdate = true;
  sun.shadow.autoUpdate = shadowUpdate;
  bloom.enabled = overrides.bloom ?? q !== "performance";
  const samples = overrides.samples ?? 4;
  for (const target of [composer.renderTarget1, composer.renderTarget2])
    if (target.samples !== samples) {
      target.samples = samples;
      target.dispose();
    }
  const foliage = overrides.foliage ?? true;
  for (const mesh of world.trees.foliage) mesh.visible = foliage;
  world.bushes.group.visible = foliage;
  world.showFields(overrides.fields ?? true);
  world.trees.setDetail(leafDetail());
  showSky();
  // The scaler stands aside while the ratio is forced; clearing it resumes
  // from the quality's cap.
  if (!interior?.active) resetResolution(q);
  resize();
}
window.__willowmere = {
  tune(settings) {
    for (const [key, value] of Object.entries(settings))
      if (value == null) delete overrides[key];
      else overrides[key] = value;
    applyTune();
    return this.getDiagnostics().render;
  },
  getState: () => structuredClone(state),
  getPlayer: () => ({ x: life.player.position.x, z: life.player.position.z }),
  getView: () => ({
    mode: firstPerson ? "first-person" : "overview",
    camera: camera.type,
    position: camera.position.toArray(),
    yaw,
    pitch,
    playerVisible: life.player.visible,
    pointerLocked: document.pointerLockElement === canvas,
  }),
  getInterior: () => interior?.diagnostics() ?? { active: false },
  tuneInterior: (settings) => interior?.tune(settings),
  getWater: () => world.water.diagnostics(),
  getChunks: () => {
    const animating = new Set(world.animatedChunks()),
      sphere = new THREE.Sphere();
    return [...world.chunks.values()].map((chunk) => ({
      key: chunk.key,
      bounds: [chunk.bounds.min.toArray(), chunk.bounds.max.toArray()],
      animations: chunk.animations.length,
      animating: animating.has(chunk.key),
      glow: chunk.glow.size,
      meshes: chunk.meshes.map((mesh) => {
        sphere
          .copy(mesh.isInstancedMesh ? mesh.boundingSphere : mesh.geometry.boundingSphere)
          .applyMatrix4(mesh.matrixWorld);
        return {
          name: mesh.name,
          visible: mesh.visible,
          instances: mesh.isInstancedMesh ? mesh.count : 0,
          center: sphere.center.toArray(),
          radius: sphere.radius,
        };
      }),
    }));
  },
  getGlowMaterials: () => glowMaterials.size,
  getStreaming: () => ({
    pending: streamer.pending,
    finished: streamer.finished,
  }),
  getDiagnostics: () => ({
    objects: scene.children.length,
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
    colliders: colliders.length,
    flowers: flowerGroups.size,
    programs: renderer.info.programs.length,
    lanterns: {
      pool: world.lanterns.length,
      lamps: world.lamps.length,
      pointLights: scene.children.filter((o) => o.isPointLight).length,
      lit: world.lanterns.map((light) => light.position.toArray()),
      lampPositions: world.lamps.map((lamp) => lamp.toArray()),
    },
    resolution: {
      adaptive: resolution.adaptive,
      pixelRatio: renderer.getPixelRatio(),
      ceiling: resolution.ceiling,
      floor: resolution.floor,
      p95: resolution.p95,
      mean: resolution.mean,
      upWindows: resolution.upWindows,
      drawingBuffer: [canvas.width, canvas.height],
    },
    shadow: {
      mapSize: sun.shadow.mapSize.x,
      // The village's light-space extent, which shadow sizes are fractions of.
      reference: villageShadow.getSize(new THREE.Vector2()).toArray(),
      bounds: [
        shadowCamera.left,
        shadowCamera.right,
        shadowCamera.bottom,
        shadowCamera.top,
      ],
    },
    fog: [scene.fog.near, scene.fog.far],
    far: camera.far,
    render: {
      pixelRatio: renderer.getPixelRatio(),
      width: composer.renderTarget1.width,
      height: composer.renderTarget1.height,
      samples: composer.renderTarget1.samples,
      bloom: bloom.enabled,
      shadowUpdate: sun.shadow.autoUpdate,
      water: overrides.water ?? true,
      foliage: world.bushes.group.visible,
      fields: overrides.fields ?? true,
      sky: sky.mesh.visible,
      leafDetail: overrides.leafDetail ?? "auto",
      leaves: world.trees.foliage.reduce((n, mesh) => n + mesh.count, 0),
      overrides: { ...overrides },
    },
    position: life.player.position.toArray(),
    camera: {
      tilt,
      targetTilt,
      yaw: overviewYaw,
      targetYaw,
      viewHeight,
      targetViewHeight,
      offset: cameraOffset.toArray(),
      pan: pan.toArray(),
      targetPan: targetPan.toArray(),
    },
  }),
  setAdaptiveResolution: (on) => {
    resolution.adaptive = on;
    resetResolution($("#quality").value);
    resize();
  },
  blocked,
  findPath,
  project: (x, z) => {
    const v = new THREE.Vector3(x, 0.1, z).project(camera);
    return {
      x: (v.x * 0.5 + 0.5) * innerWidth,
      y: (-v.y * 0.5 + 0.5) * innerHeight,
    };
  },
};
if (new URLSearchParams(location.search).get("interior") === "bakery")
  enterBakery();
