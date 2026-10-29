import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import "./style.css";
import { applyIcons } from "./icons.js";
applyIcons();
import { createWorld } from "./world.js";
import { createLife } from "./life.js";
import { createAudio } from "./audio.js";
import { createEffects } from "./effects.js";
import { createPlayerVisibility } from "./visibility.js";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const canvas = $("#scene"),
  scene = new THREE.Scene();
scene.background = new THREE.Color("#abc2a1");
scene.fog = new THREE.FogExp2("#b5c2a0", 0.0025);
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
const camera = new THREE.OrthographicCamera(-25, 25, 16, -16, 0.1, 160);
const cameraOffset = new THREE.Vector3(27, 36, 44);
let viewHeight = 29,
  targetViewHeight = 29;
const target = new THREE.Vector3(0, 0, 1.5),
  cameraTarget = target.clone();
const hemi = new THREE.HemisphereLight("#eaf2df", "#607b66", 1.5);
scene.add(hemi);
const ambient = new THREE.AmbientLight("#ccdabb", 0.22);
scene.add(ambient);
const sun = new THREE.DirectionalLight("#fff0d6", 2.4);
sun.position.set(-16, 32, 15);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, {
  left: -35,
  right: 35,
  top: 32,
  bottom: -32,
  near: 1,
  far: 85,
});
sun.shadow.bias = -0.00015;
sun.shadow.normalBias = 0.045;
sun.shadow.radius = 3;
scene.add(sun);
scene.add(sun.target);
const fill = new THREE.DirectionalLight("#dae9ec", 0.6);
fill.position.set(15, 14, -20);
scene.add(fill);
const world = createWorld(THREE, scene),
  life = createLife(THREE, scene),
  audio = createAudio();
const sceneTarget = new THREE.WebGLRenderTarget(innerWidth, innerHeight, {
  samples: 4,
  type: THREE.HalfFloatType,
});
const composer = new EffectComposer(renderer, sceneTarget);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(innerWidth, innerHeight),
  0.19,
  0.65,
  1.15,
);
composer.addPass(bloom);
composer.addPass(new OutputPass());
renderer.info.autoReset = false;
const glowMaterials = new Set();
scene.traverse((o) => {
  if (
    o.material &&
    !Array.isArray(o.material) &&
    o.material.emissive?.getHex() > 0
  )
    glowMaterials.add(o.material);
});
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
const petalMat = new THREE.MeshStandardMaterial({
    color: "#fff1b3",
    roughness: 0.8,
  }),
  centerMat = new THREE.MeshStandardMaterial({ color: "#d99a3e" }),
  stemMat = new THREE.MeshStandardMaterial({ color: "#56733e" });
function makeFlower(x, z, planted = false) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  for (let i = 0; i < 5; i++) {
    const a = i * 2.4,
      r = 0.14 + i * 0.035,
      fx = Math.cos(a) * r,
      fz = Math.sin(a) * r,
      h = 0.32 + (i % 3) * 0.11;
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.017, 0.02, h, 4),
      stemMat,
    );
    stem.position.set(fx, h / 2, fz);
    group.add(stem);
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 4), centerMat);
    c.position.set(fx, h, fz);
    group.add(c);
    for (let p = 0; p < 5; p++) {
      const b = (p * Math.PI * 2) / 5;
      const petal = new THREE.Mesh(
        new THREE.SphereGeometry(0.065, 6, 4),
        petalMat,
      );
      petal.scale.set(1, 0.35, 1.5);
      petal.position.set(fx + Math.cos(b) * 0.07, h, fz + Math.sin(b) * 0.07);
      petal.rotation.y = -b;
      group.add(petal);
    }
  }
  if (!planted) {
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.37, 0.4, 32),
      new THREE.MeshBasicMaterial({
        color: "#f6e5ae",
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.025;
    group.add(halo);
  }
  scene.add(group);
  return group;
}
gatheringSpots.forEach(([x, z], i) => {
  if (!state.gathered.includes(i)) flowerGroups.set(i, makeFlower(x, z));
});
const plantedGroups = [];
state.plants.forEach((p) => {
  let g = makeFlower(p.x, p.z, true);
  g.scale.setScalar(p.watered ? 1.35 : 0.7);
  plantedGroups.push(g);
});
let tool = "hand",
  started = state.started,
  photo = false,
  motion = !matchMedia("(prefers-reduced-motion: reduce)").matches,
  dialogue = null,
  nearest = null,
  day = "day";
$("#motion").checked = motion;
function begin() {
  if (!started) targetViewHeight = 18;
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
  viewHeight = targetViewHeight = 18;
}
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
let lastStep = 0;
function modalOpen() {
  return !!document.querySelector("dialog[open]");
}
function openDialogue(name, lines, onFinish) {
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
  renderer.setPixelRatio(
    Math.min(
      devicePixelRatio,
      q === "high" ? 1.75 : q === "balanced" ? 1.25 : 1,
    ),
  );
  composer.setPixelRatio(renderer.getPixelRatio());
  sun.shadow.mapSize.setScalar(
    q === "high" ? 4096 : q === "balanced" ? 2048 : 1024,
  );
  if (sun.shadow.map) {
    sun.shadow.map.dispose();
    sun.shadow.map = null;
  }
  bloom.enabled = q !== "performance";
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
function blocked(x, z, r = 0.27) {
  if (x < -21 + r || x > 21 - r || z < -17 + r || z > 17 - r) return true;
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
    (world.isPlantable?.(x, z) ?? true) &&
    !blocked(x, z, 0.55) &&
    Math.hypot(x, z) > 2.5 &&
    state.plants.every((p) => Math.hypot(x - p.x, z - p.z) > 0.75) &&
    Math.abs(x - 12) > 2
  );
}
function interact() {
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
    let fx = p.x + Math.sin(life.player.rotation.y) * 0.8,
      fz = p.z + Math.cos(life.player.rotation.y) * 0.8;
    if (!openGrass(fx, fz)) {
      toast("Find a little more room for those roots.");
      return;
    }
    const plant = { x: fx, z: fz, watered: false };
    state.plants.push(plant);
    if (motion) effects.burst(fx, 0.4, fz);
    let g = makeFlower(fx, fz, true);
    g.scale.setScalar(0.7);
    plantedGroups.push(g);
    state.seeds--;
    complete("plant");
    updateUI();
    save();
    audio.chime();
    toast("A small beginning. Your flowers are planted.");
    return;
  }
  if (tool === "water") {
    let idx = state.plants.findIndex(
      (q) => Math.hypot(q.x - p.x, q.z - p.z) < 2 && !q.watered,
    );
    if (idx < 0) {
      toast("Plant some flowers first, then give them a drink.");
      return;
    }
    state.plants[idx].watered = true;
    if (motion) effects.burst(state.plants[idx].x, 0.4, state.plants[idx].z);
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
    if (motion) effects.burst(fg.position.x, 0.4, fg.position.z);
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
    const names = {
      mabel: "MABEL · THE FLORIST",
      finn: "FINN · THE BAKER",
      elio: "ELIO · THE GARDENER",
    };
    openDialogue(
      names[n.id] || n.name,
      n.dialogue || ["A lovely day to be here, isn’t it?"],
      () => {
        if (n.id === "mabel") complete("mabel");
        if (n.id === "finn" && state.seeds < 3) {
          state.seeds += 3;
          updateUI();
          save();
          toast("Finn tucked three seeds into your pouch.");
        }
      },
    );
    return;
  }
  const id = nearest.data.id || nearest.data.type;
  const dialogues = {
    fountain: [
      "Listen closely. Beneath the splashing water, the whole village seems to hum.",
      "Someone has left a little wish on the rim: “May we always have enough to share.”",
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
  openDialogue(
    nearest.data.name.toUpperCase(),
    dialogues[id] || ["Some places ask you to slow down. This is one of them."],
  );
}
window.addEventListener("keydown", (e) => {
  if (e.target.matches("input,select,textarea")) return;
  const k = e.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k))
    e.preventDefault();
  if (e.repeat && ["e", "j", "p", "escape"].includes(k)) return;
  if (k === "escape") {
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
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => {
  keys.clear();
  velocity.set(0, 0);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    keys.clear();
    velocity.set(0, 0);
  }
});
$$("[data-key]").forEach((b) => {
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    keys.add(b.dataset.key.toLowerCase());
    begin();
  });
  const release = () => keys.delete(b.dataset.key.toLowerCase());
  b.addEventListener("pointerup", release);
  b.addEventListener("pointercancel", release);
});
$("#touch-interact").onclick = interact;
// A grid search gives point-and-click movement a route around cottages and across the bridge.
function findPath(start, end) {
  const step = 0.65,
    minX = -21,
    minZ = -17,
    cols = 65,
    rows = 53,
    toCell = (p) => [
      Math.round((p.x - minX) / step),
      Math.round((p.z - minZ) / step),
    ],
    toWorld = (x, z) => ({ x: minX + x * step, z: minZ + z * step }),
    key = (x, z) => z * cols + x;
  let [sx, sz] = toCell(start),
    [ex, ez] = toCell(end);
  if (blocked(end.x, end.z, 0.3)) return [];
  const open = [{ x: sx, z: sz, g: 0, f: 0 }],
    came = new Map(),
    cost = new Map([[key(sx, sz), 0]]),
    closed = new Set();
  let found = null;
  for (let iteration = 0; open.length && iteration < 5000; iteration++) {
    open.sort((a, b) => a.f - b.f);
    let cur = open.shift(),
      ck = key(cur.x, cur.z);
    if (closed.has(ck)) continue;
    if (Math.abs(cur.x - ex) + Math.abs(cur.z - ez) <= 1) {
      found = cur;
      break;
    }
    closed.add(ck);
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const nx = cur.x + dx,
        nz = cur.z + dz,
        nk = key(nx, nz);
      if (nx < 0 || nx >= cols || nz < 0 || nz >= rows || closed.has(nk))
        continue;
      const w = toWorld(nx, nz);
      if (blocked(w.x, w.z, 0.34)) continue;
      if (dx && dz) {
        const a = toWorld(cur.x + dx, cur.z),
          b = toWorld(cur.x, cur.z + dz);
        if (blocked(a.x, a.z, 0.34) || blocked(b.x, b.z, 0.34)) continue;
      }
      const ng = cur.g + Math.hypot(dx, dz);
      if (ng < (cost.get(nk) ?? Infinity)) {
        cost.set(nk, ng);
        came.set(nk, cur);
        open.push({
          x: nx,
          z: nz,
          g: ng,
          f: ng + Math.hypot(nx - ex, nz - ez),
        });
      }
    }
  }
  if (!found) return [];
  const result = [end];
  while (found && (found.x !== sx || found.z !== sz)) {
    result.push(toWorld(found.x, found.z));
    found = came.get(key(found.x, found.z));
  }
  return result.reverse();
}
const raycaster = new THREE.Raycaster(),
  mouse = new THREE.Vector2(),
  groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
  hit = new THREE.Vector3();
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
destination.position.y = 0.03;
destination.visible = false;
scene.add(destination);
canvas.addEventListener("pointerdown", (e) => {
  if (e.button !== 0 || dialogue || modalOpen()) return;
  begin();
  const r = canvas.getBoundingClientRect();
  mouse.set(
    ((e.clientX - r.left) / r.width) * 2 - 1,
    (-(e.clientY - r.top) / r.height) * 2 + 1,
  );
  raycaster.setFromCamera(mouse, camera);
  if (raycaster.ray.intersectPlane(groundPlane, hit)) {
    const route = findPath(life.player.position, { x: hit.x, z: hit.z });
    clickPath.splice(0, clickPath.length, ...route);
    if (route.length) {
      destination.position.set(hit.x, 0.03, hit.z);
      destination.visible = true;
    }
  }
});
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    targetViewHeight = THREE.MathUtils.clamp(
      targetViewHeight + e.deltaY * 0.012,
      10,
      39,
    );
  },
  { passive: false },
);
function updateFrustum() {
  const w = innerWidth,
    h = innerHeight;
  const aspect = w / h;
  const height = aspect < 0.9 ? viewHeight * 1.35 : viewHeight;
  camera.left = (-height * aspect) / 2;
  camera.right = (height * aspect) / 2;
  camera.top = height / 2;
  camera.bottom = -height / 2;
  camera.updateProjectionMatrix();
}
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  updateFrustum();
}
window.addEventListener("resize", resize);
resize();
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
      candidates.push({ kind: "world", data: i, d: d + 0.4, label: i.name });
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
  $("#location-name").textContent =
    p.x > 10
      ? "The willow brook"
      : p.z < -5
        ? "The cottage lane"
        : p.x < -8
          ? "The wildflower meadow"
          : p.z > 7
            ? "The kitchen gardens"
            : "The village green";
}
let elapsed = 0,
  last = performance.now(),
  frame = 0,
  duskMix = 0;
const screenRight = new THREE.Vector2(
    cameraOffset.z,
    -cameraOffset.x,
  ).normalize(),
  screenDown = new THREE.Vector2(cameraOffset.x, cameraOffset.z).normalize();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - last) / 1000, 0.045);
  last = now;
  if (document.hidden) return;
  elapsed += dt;
  frame++;
  const p = life.player.position;
  let input = new THREE.Vector2();
  if (!dialogue && !modalOpen()) {
    const horiz =
        (keys.has("d") || keys.has("arrowright") ? 1 : 0) -
        (keys.has("a") || keys.has("arrowleft") ? 1 : 0),
      vert =
        (keys.has("s") || keys.has("arrowdown") ? 1 : 0) -
        (keys.has("w") || keys.has("arrowup") ? 1 : 0);
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
  world.update?.(motion ? dt : 0, motion ? elapsed : 0);
  if (moving && elapsed - lastStep > 0.33) {
    audio.step();
    lastStep = elapsed;
  }
  // The view stays composed around the village, then gently accompanies longer walks.
  const follow = started ? 0.85 : 0.48;
  target.set(
    THREE.MathUtils.clamp(p.x * follow, -12, 14),
    0,
    THREE.MathUtils.clamp(1.5 + (p.z - 5) * follow, -9, 11),
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
  camera.position.copy(cameraTarget).add(cameraOffset);
  camera.lookAt(cameraTarget);
  destination.visible = clickPath.length > 0;
  if (destination.visible) {
    destination.scale.setScalar(1 + Math.sin(elapsed * 4) * 0.12);
    destination.material.opacity = 0.5 + Math.sin(elapsed * 3) * 0.2;
  }
  plantedGroups.forEach((g, i) => {
    const targetScale = state.plants[i].watered ? 1.35 : 0.7;
    g.scale.lerp(
      new THREE.Vector3(targetScale, targetScale, targetScale),
      1 - Math.exp(-dt * 1.5),
    );
  });
  duskMix = THREE.MathUtils.lerp(
    duskMix,
    day === "dusk" ? 1 : 0,
    1 - Math.exp(-dt * 1.5),
  );
  sun.intensity = THREE.MathUtils.lerp(2.4, 0.6, duskMix);
  hemi.intensity = THREE.MathUtils.lerp(1.5, 1.0, duskMix);
  hemi.color.set("#eaf2df").lerp(new THREE.Color("#8dacef"), duskMix);
  sun.color.set("#fff0d6").lerp(new THREE.Color("#ffa572"), duskMix);
  scene.background.set("#abc2a1").lerp(new THREE.Color("#566782"), duskMix);
  scene.fog.color.copy(scene.background);
  for (const light of world.lanterns || [])
    light.intensity = THREE.MathUtils.lerp(0.1, 18.0, duskMix);
  renderer.toneMappingExposure = THREE.MathUtils.lerp(1.05, 0.95, duskMix);
  effects.update(dt, motion);
  if (frame % 8 === 0) scanNearby();
  for (const material of glowMaterials)
    material.emissiveIntensity = THREE.MathUtils.lerp(0.25, 2.0, duskMix);
  playerVisibility.update(camera, !photo);
  renderer.info.reset();
  composer.render();
  if (frame === 3) {
    $("#loading").classList.add("loaded");
    if (innerWidth < 760) {
      $("#quality").value = "balanced";
      $("#quality").dispatchEvent(new Event("change"));
    }
  }
}
updateUI();
requestAnimationFrame(animate);
window.__willowmere = {
  getState: () => structuredClone(state),
  getPlayer: () => ({ x: life.player.position.x, z: life.player.position.z }),
  getDiagnostics: () => ({
    objects: scene.children.length,
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    colliders: colliders.length,
    flowers: flowerGroups.size,
    position: life.player.position.toArray(),
  }),
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
