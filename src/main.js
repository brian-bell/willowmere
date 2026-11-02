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
import { createPlayerVisibility } from "./visibility.js";
import { createSky } from "./sky.js";
import { createStreamer } from "./streaming.js";
import { createFishing } from "./fishing.js";
import { createNavigation } from "./game/navigation.js";
import { createActivities } from "./game/activities.js";
import { createDebugApi } from "./game/debug-api.js";
import { createHud } from "./game/hud.js";
import { createInteractions } from "./game/interactions.js";
import { loadState, saveState } from "./game/save.js";
import { SHADOW_MAP_SIZES, createSunShadow } from "./game/shadows.js";
import {
  DEFAULT_VIEW_HEIGHT,
  createOverviewCamera,
} from "./game/overview-camera.js";
import { QUALITY_PIXEL_RATIO, createResolutionScaler, startingQuality } from "./game/resolution.js";
import { MILLPOND } from "./regions/millpond-layout.js";
import { regions } from "./regions/index.js";
import { WORLD, regionAt } from "./world-layout.js";
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
// Benchmark overrides for attributing render cost (window.__willowmere.tune);
// empty in normal play, so every `??` below takes its default.
const overrides = {};
const startQuality = startingQuality(innerWidth, innerHeight, devicePixelRatio);
const scaler = createResolutionScaler({
    // ?resolution=fixed keeps the quality's pixel ratio for benchmarks and tests.
    adaptive: new URLSearchParams(location.search).get("resolution") !== "fixed",
    quality: startQuality,
    density: () => devicePixelRatio,
    now: performance.now(),
    setPixelRatio(ratio) {
      renderer.setPixelRatio(ratio);
      composer.setPixelRatio(ratio);
    },
    resize: () => resize(),
    overrides,
  }),
  resolution = scaler.state;
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
// Beyond these, single leaves cover only a few pixels and trees draw coarser
// foliage; in first person, trees further off than CROWN_DISTANCE, deep in
// the fog, draw their crown shells instead of leaves.
const COARSE_LEAVES_VIEW_HEIGHT = 24,
  COARSE_LEAVES_DISTANCE = 18,
  CROWN_DISTANCE = 40;
const leafDetailFromEye = (center) => {
  const distance = center.distanceTo(firstPersonCamera.position);
  return distance > CROWN_DISTANCE ? 2 : distance > COARSE_LEAVES_DISTANCE ? 1 : 0;
};
const leafDetail = () =>
  overrides.leafDetail ??
  (firstPerson
    ? leafDetailFromEye
    : overview.viewHeight > COARSE_LEAVES_VIEW_HEIGHT
      ? 1
      : 0);
const overview = createOverviewCamera({
  camera: overviewCamera,
  isFirstPerson: () => firstPerson,
  onZoom: () => updateFrustum(),
});
const hemi = new THREE.HemisphereLight("#eaf2df", "#607b66", 1.5);
scene.add(hemi);
const ambient = new THREE.AmbientLight("#ccdabb", 0.22);
scene.add(ambient);
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
const sunShadow = createSunShadow({ sun, overviewCamera, firstPersonCamera }),
  shadowCamera = sunShadow.camera;
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
// The float and line stream in with the millpond's jetty.
const fishing = createFishing(THREE, {
    water: world.water,
    body: "millpond",
    surface: MILLPOND.surface,
  });
streamer.add({
  x: MILLPOND.jetty.x,
  z: MILLPOND.jetty.minZ,
  step: () => fishing.group,
});
const playerVisibility = createPlayerVisibility(
  scene,
  life.player,
  world.colliders,
  world.treeCanopies,
);
// localStorage itself can throw where site data is blocked.
const storage = () => localStorage;
const { state, nextPlantId } = loadState(storage);
function save() {
  if (!saveState(storage, state))
    $("#save-status").textContent = "This visit cannot be saved";
}
const hud = createHud({
    canvas,
    state,
    onCapture() {
      releaseLook();
      keys.clear();
      clickPath.length = 0;
    },
  }),
  { toast, updateUI } = hud;
const activities = createActivities({
  scene,
  world,
  player: life.player,
  state,
  nextPlantId,
  hud,
  save,
  audio,
  effects,
  fishing,
  blocked: (x, z, r) => blocked(x, z, r),
  motion: () => motion,
});
let tool = "hand",
  started = state.started,
  photo = false,
  motion = !matchMedia("(prefers-reduced-motion: reduce)").matches,
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
  hud.dismissDialogue();
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
    scaler.apply(resolution.ceiling);
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
  scaler.apply(Math.min(resolution.outdoor, resolution.ceiling));
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
  if (!started) overview.setZoom(DEFAULT_VIEW_HEIGHT);
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
  overview.zoomAt(DEFAULT_VIEW_HEIGHT);
}
overview.bindControls();
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
// What the HUD and interactions read of the visit's live settings.
const session = {
  get tool() {
    return tool;
  },
  get started() {
    return started;
  },
  get photo() {
    return photo;
  },
  get firstPerson() {
    return firstPerson;
  },
  get yaw() {
    return yaw;
  },
};
const interactions = createInteractions({
  world,
  life,
  hud,
  activities,
  fishing,
  session,
  clickPath,
  begin,
  isIndoors: () => !!interior?.active || interiorLoading,
  enterBakery,
});
function releaseLook() {
  if (dragging && canvas.hasPointerCapture(dragging.id))
    canvas.releasePointerCapture(dragging.id);
  dragging = null;
  if (document.pointerLockElement === canvas) document.exitPointerLock();
}
const coarsePointer = matchMedia("(pointer: coarse)");
function updateViewUI() {
  $("#game").classList.toggle("first-person", firstPerson);
  $("#view-toggle").setAttribute("aria-pressed", String(firstPerson));
  $("#view-toggle").innerHTML = firstPerson
    ? "Village view <kbd>V</kbd>"
    : "First person <kbd>V</kbd>";
  $("#free-look").hidden = !firstPerson;
  $("#view-help").hidden = !firstPerson;
  canvas.setAttribute(
    "aria-label",
    firstPerson
      ? "First-person village. WASD to walk, drag to look, arrow keys to turn, Page Up and Page Down to look up and down, E to interact, V to switch views."
      : "Interactive village. Move with WASD or arrow keys, interact with E. V for first person.",
  );
  overview.updateZoomControls();
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
  interactions.pending = null;
  firstPerson = value;
  Object.assign(scene.fog, firstPerson ? FOG.firstPerson : FOG.overview);
  sunShadow.setMapSize($("#quality").value, firstPerson);
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
    !hud.inDialogue &&
    !hud.modalOpen()
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
hud.bindControls();
$("#journal-button").onclick = () => {
  hud.refreshJournal(regionAt(life.player.position.x, life.player.position.z).id);
  hud.openModal("#journal");
};
$("#settings").onclick = () => hud.openModal("#settings-dialog");
function setPhoto(value) {
  photo = value;
  $("#game").classList.toggle("photo-mode", photo);
  $("#photo-hint").hidden = !photo;
  $("#photo-hint span").textContent = coarsePointer.matches
    ? "Tap anywhere to return"
    : firstPerson
      ? "Drag to look · V to switch views · Press P or Esc to return"
      : "Scroll to frame · Press P or Esc to return";
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
  scaler.reset(q);
  sunShadow.setMapSize($("#quality").value, firstPerson);
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
const { blocked, findPath, sampleRows: sampleRouteRows } = createNavigation({
  walk: WORLD.walk,
  colliders,
});
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
    if (hud.inDialogue) hud.dismissDialogue();
    return;
  }
  if (hud.modalOpen()) return;
  if (k === "e" || k === " ") {
    interactions.interact();
    return;
  }
  if (hud.inDialogue) return;
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
    interactions.pending = null;
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
    interactions.pending = null;
    begin();
  });
  const release = () => keys.delete(b.dataset.key.toLowerCase());
  b.addEventListener("pointerup", release);
  b.addEventListener("pointercancel", release);
  b.addEventListener("lostpointercapture", release);
});
$("#interaction").onclick = interactions.interact;
// On phones the quest card folds down to its title row; a tap opens the list.
const phoneLayout = matchMedia("(max-width: 760px), (max-height: 500px)");
function updateQuestToggle() {
  $(".quest-toggle").setAttribute(
    "aria-expanded",
    String(!phoneLayout.matches || $("#game").classList.contains("quest-open")),
  );
}
$(".quest-toggle").onclick = () => {
  if (!phoneLayout.matches) return;
  $("#game").classList.toggle("quest-open");
  updateQuestToggle();
};
phoneLayout.addEventListener("change", updateQuestToggle);
updateQuestToggle();
// A grid search gives point-and-click movement a route around cottages and across the bridge.
// The grid streams in with the open country; a click before then finishes it.
streamer.add({
  x: 0,
  z: 0,
  step: (deadline) => (sampleRouteRows(deadline) ? [] : null),
});
const raycaster = new THREE.Raycaster(),
  mouse = new THREE.Vector2(),
  groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
  hit = new THREE.Vector3();
// Where a ray meets the ground, a deck or water: intersect a level plane, then
// move the plane to the surface's height under the hit and repeat. Flat ground needs one pass;
// gentle slopes settle within a few.
function pickGround(ray, out) {
  let height = 0;
  for (let i = 0; i < 6; i++) {
    groundPlane.constant = -height;
    if (!ray.intersectPlane(groundPlane, out)) return null;
    const next = world.surfaceHeight(out.x, out.z);
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
  if (e.button !== 0 || hud.inDialogue || hud.modalOpen()) return;
  // Touch screens have no P or Escape key, so a tap ends photo mode.
  if (photo && e.pointerType !== "mouse") {
    setPhoto(false);
    return;
  }
  begin();
  if (firstPerson) {
    if (document.pointerLockElement === canvas) interactions.interact();
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
  const target =
    tool === "seeds" || tool === "water"
      ? null
      : interactions.pick(e.clientX - r.left, e.clientY - r.top, r, e.pointerType !== "mouse", camera);
  interactions.pending = target;
  if (target) {
    const { x, z } = target,
      p = life.player.position;
    // Someone standing behind a counter is reached from the nearest open side.
    const sides = Array.from({ length: 8 }, (_, i) => ({
      x: x + Math.cos((i * Math.PI) / 4) * 1.2,
      z: z + Math.sin((i * Math.PI) / 4) * 1.2,
    }))
      .filter((g) => !blocked(g.x, g.z, 0.3))
      .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    let route = [];
    for (const goal of [{ x, z }, ...sides]) if ((route = findPath(p, goal)).length) break;
    clickPath.splice(0, clickPath.length, ...route);
    destination.position.set(x, world.terrainHeight(x, z) + 0.03, z);
    interactions.scan();
    return;
  }
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
    overview.setZoom(overview.targetViewHeight + e.deltaY * 0.012);
  },
  { passive: false },
);
function updateFrustum() {
  const w = innerWidth,
    h = innerHeight;
  const aspect = w / h;
  overview.fit(aspect);
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
    scaler.reset(q);
  resize();
});
$("#quality").value = startQuality;
$("#quality").dispatchEvent(new Event("change"));
let elapsed = 0,
  last = performance.now(),
  frame = 0,
  duskMix = 0,
  skyTime = 0;
const input = new THREE.Vector2(),
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
  scaler.update(now, interval);
  overview.turn(dt, motion);
  const p = life.player.position;
  input.set(0, 0);
  if (!hud.inDialogue && !hud.modalOpen()) {
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
        .copy(overview.screenRight)
        .multiplyScalar(horiz)
        .addScaledVector(overview.screenDown, vert);
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
  activities.updateFishing(dt, elapsed);
  if (moving && elapsed - lastStep > 0.33) {
    audio.step();
    lastStep = elapsed;
  }
  overview.follow(dt, motion, p, started);
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
  activities.grow(dt);
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
    firstPerson ? p.x : overview.viewTarget.x,
    firstPerson ? p.z : overview.viewTarget.z,
  );
  for (const light of world.lanterns || [])
    light.intensity = THREE.MathUtils.lerp(0.1, 18.0, duskMix);
  renderer.toneMappingExposure = THREE.MathUtils.lerp(1.05, 0.95, duskMix);
  effects.update(dt, motion);
  if (frame % 8 === 0) interactions.scan();
  if (frame % 120 === 0) activities.updateOrchard();
  for (const material of glowMaterials)
    material.emissiveIntensity = THREE.MathUtils.lerp(0.25, 2.0, duskMix);
  playerVisibility.update(camera, !photo && !firstPerson);
  world.trees.setDetail(leafDetail());
  if (firstPerson) world.setDetailFocus(p.x, p.z);
  else world.setDetailFocus();
  streamer.update(p.x, p.z, camera);
  sunShadow.fit({ firstPerson, yaw, targetYaw: overview.targetYaw });
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
  // Every region's builder, the open country's included, loads once the
  // village is on screen.
  if (frame >= 3 && !openCountryRequested) {
    openCountryRequested = true;
    for (const region of regions)
      region.stream?.(THREE, world).then(({ jobs, ...loaded }) => {
        activities.regionLoaded[region.id]?.(loaded);
        streamer.add(...jobs);
      });
  }
}
updateUI();
requestAnimationFrame(animate);
window.__willowmere = createDebugApi({
  scene,
  renderer,
  composer,
  bloom,
  sun,
  sky,
  world,
  life,
  streamer,
  fishing,
  activities,
  overview,
  sunShadow,
  scaler,
  overrides,
  state,
  colliders,
  glowMaterials,
  firstPersonCamera,
  canvas,
  blocked,
  findPath,
  leafDetail,
  showSky,
  resize,
  quality: () => $("#quality").value,
  get camera() {
    return camera;
  },
  get firstPerson() {
    return firstPerson;
  },
  get yaw() {
    return yaw;
  },
  get pitch() {
    return pitch;
  },
  get interior() {
    return interior;
  },
  stopAfterJump(heading) {
    if (heading !== undefined) yaw = heading + Math.PI;
    velocity.set(0, 0);
    clickPath.length = 0;
    overview.snap();
  },
});
if (new URLSearchParams(location.search).get("interior") === "bakery")
  enterBakery();
