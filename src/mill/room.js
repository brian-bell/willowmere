import * as T from "three";
import { MILL_GREETING, MILL_NOTES, MILL_POINTS, MILL_ROOM } from "../content/mill.js";
import { createParts } from "../post-office/parts.js";
import { buildFittings } from "./fittings.js";
import { MILL as K, millLayout } from "./layout.js";
import { buildMachinery } from "./machinery.js";
import { VIEW_DAY, VIEW_NIGHT, buildShell } from "./shell.js";
import { createSurfaces } from "./surfaces.js";
import { WHEEL_RATE, millWheel } from "./wheel.js";

// How long a scoop keeps the stones busy, and how much wheat fills a sack.
const SCOOP = 0.34,
  HOPPER_RUN = 70,
  SACK_FILL = 50;

// Willow Mill as a walkable room (src/interior.js): the one big room of its
// ground floor, with the wheel's gearing turning in it. Amos is out with the
// cart. The sluice lever stills the wheel here and outside (src/mill/wheel.js).
// Nothing that moves casts a shadow, so the one sun map is drawn on opening
// and kept.
export function createMill() {
  const scene = new T.Scene();
  scene.background = new T.Color("#a9cbd6");
  const root = new T.Group();
  scene.add(root);
  const parts = createParts(root, 7919),
    surfaces = createSurfaces(parts),
    { M } = surfaces,
    { range, bake, paintFlat } = parts,
    keep = new Set();
  const shell = buildShell(parts, surfaces, keep),
    machinery = buildMachinery(parts, surfaces, keep),
    fittings = buildFittings(parts, surfaces, keep);

  // ------------------------------------------------------------------ light
  const lamps = fittings.lanternSpots.map((spot) => {
    const light = new T.PointLight("#ffcf8a", 0.8, 7, 2);
    light.position.set(spot.x, K.ceiling - spot.drop + 0.03, spot.z);
    scene.add(light);
    return light;
  });
  const stoveLight = new T.PointLight("#ff9a45", 2, 4.5, 2);
  stoveLight.position.set(K.stove.x - K.stove.w / 2 - 0.3, 0.55, K.stove.z);
  scene.add(stoveLight);
  // What the windows spill across the flags by day.
  const fills = [
    { at: [-3.2, 2.4, 4.2], day: 3.2, night: 0.7, colour: "#fff0cf" },
    { at: [3.2, 2.4, 4.2], day: 3.2, night: 0.7, colour: "#fff0cf" },
    { at: [4.3, 2.3, 0], day: 2.4, night: 0.5, colour: "#fff0cf" },
    { at: [-1.8, 2.2, -4.3], day: 2.2, night: 0.5, colour: "#d8e6ee" },
    { at: [-4.4, 2.2, -3.05], day: 1.8, night: 0.4, colour: "#d8ecea" },
  ].map((f) => {
    const light = new T.PointLight(f.colour, f.day, 7.5, 1.6);
    light.position.set(...f.at);
    scene.add(light);
    return { light, ...f };
  });
  const ambient = new T.HemisphereLight("#fff1dc", "#6f6250", 0.8);
  scene.add(ambient);
  // Afternoon sun from the south-west, through the front windows and the door.
  const sun = new T.DirectionalLight("#ffdca6", 4.6);
  sun.position.set(-9, 12, 15);
  sun.target.position.set(-0.5, 0, 1);
  scene.add(sun, sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 44 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.normalBias = 0.022;
  sun.shadow.bias = -0.00016;
  sun.shadow.radius = 1.6;

  // ------------------------------------------- flour in the air, and steam
  const softDot = (() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const c = canvas.getContext("2d"),
      g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.4, "rgba(255,255,255,0.45)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
    return new T.CanvasTexture(canvas);
  })();
  const DUST = 90;
  const dustGeo = new T.BufferGeometry(),
    dustPositions = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    dustPositions[i * 3] = range(-4.5, 4.5);
    dustPositions[i * 3 + 1] = range(0.4, 4.2);
    dustPositions[i * 3 + 2] = range(-3.5, 4.8);
  }
  dustGeo.setAttribute("position", new T.BufferAttribute(dustPositions, 3));
  const dustMat = new T.PointsMaterial({ color: "#fff3d6", map: softDot, size: 0.035, transparent: true, opacity: 0.45, depthWrite: false });
  const dust = new T.Points(dustGeo, dustMat);
  scene.add(dust);
  // One cloud of puffs shared between the kettle's steam, the bolter's flour,
  // the meal spout and the spray off the wheel, so they are a single draw.
  const PUFFS = 30;
  const puffGeo = new T.BufferGeometry(),
    puffPositions = new Float32Array(PUFFS * 3);
  puffGeo.setAttribute("position", new T.BufferAttribute(puffPositions, 3));
  const puffs = new T.Points(puffGeo, new T.PointsMaterial({ color: "#ffffff", map: softDot, size: 0.26, transparent: true, opacity: 0.14, depthWrite: false }));
  puffs.frustumCulled = false;
  scene.add(puffs);

  root.traverse((o) => {
    if (o.isMesh && o.material.transparent) o.castShadow = o.receiveShadow = false;
  });
  for (const g of keep) g.traverse((o) => (o.castShadow = false));
  paintFlat(keep);
  bake(keep);

  // --------------------------------------------------------------- behaviour
  let night = false,
    pending = null,
    hopper = 0.55,
    meal = 0.35,
    sacks = 0,
    hoisted = false,
    lift = 0,
    crankTurn = 0,
    rock = 0,
    mouseAway = 0,
    leverAngle = 0;
  const timers = { bolter: 0, rock: 0, mouse: 0, sack: 0 },
    timerNames = Object.keys(timers);
  const lines = {};
  const nextLine = (id, list) => {
    lines[id] = (lines[id] ?? -1) + 1;
    return list[lines[id] % list.length];
  };
  const say = (note, id = note.title) => ({ title: note.title, text: note.text ?? nextLine(id, note.lines), sound: note.sound });

  /** The room's own reply to E. */
  function interact(point) {
    const { id } = point,
      still = !millWheel.turning;
    if (id === "sluice") return say(millWheel.toggleSluice() ? MILL_NOTES.sluiceShut : MILL_NOTES.sluiceOpen);
    if (id === "hoist") {
      if (still) return say(MILL_NOTES.hoistStill);
      hoisted = !hoisted;
      return say(hoisted ? MILL_NOTES.hoistUp : MILL_NOTES.hoistDown);
    }
    if (id === "hopper") {
      if (hopper > 1 - SCOOP / 2) return say(MILL_NOTES.hopperFull);
      hopper = Math.min(1, hopper + SCOOP);
      return say(MILL_NOTES.hopper);
    }
    if (id === "meal" && meal >= 1) {
      meal = 0;
      sacks++;
      timers.sack = 0.6;
      return say(MILL_NOTES.mealFull);
    }
    if (still && (id === "stones" || id === "pitWheel" || id === "wheel")) return say(MILL_NOTES[`${id}Still`]);
    if (id === "bolter") timers.bolter = 2.6;
    if (id === "mouse") {
      timers.mouse = 9;
      // The third line sends it home.
      const said = say(MILL_NOTES.mouse);
      if (said.text === MILL_NOTES.mouse.lines[2]) mouseAway = 1;
      return said;
    }
    const note = MILL_NOTES[id];
    if (!note) return null;
    if (id === "chair") return { ...say(note), night: !night };
    return say(note);
  }

  const mouseHome = new T.Vector3(K.mouse.x, 0, K.mouse.z),
    mouseHole = new T.Vector3(K.mouseHole.x, 0, K.back + 0.05);
  let mouseAt = 0;

  const room = {
    ...MILL_ROOM,
    scene,
    sun,
    shadowLights: [sun],
    staticShadows: true,
    exposure: 1.02,
    environmentIntensity: 0.2,
    points: MILL_POINTS.map((point) => {
      if (point.id === "sluice")
        return { ...point, get label() { return millWheel.shut ? "Lift the sluice" : point.label; } };
      if (point.id === "hoist")
        return { ...point, get label() { return hoisted ? "Let the hoist bring a sack down" : point.label; } };
      if (point.id === "meal")
        return { ...point, get label() { return meal >= 1 ? "Tie off the full sack" : point.label; } };
      // The mouse answers only while it is out.
      if (point.id === "mouse") return { ...point, available: () => mouseAt < 0.2 };
      return point;
    }),
    layout: millLayout(),
    interact,
    enter() {
      pending = say(MILL_GREETING, "greeting");
    },
    setNight(value) {
      night = value;
    },
    takeNote() {
      const note = pending;
      pending = null;
      return note;
    },
    update(time, motion = true, { dt = 0 } = {}) {
      const t = motion ? time : 0,
        k = 1 - Math.exp(-dt * 3),
        ease = (rate) => 1 - Math.exp(-dt * rate);
      for (const name of timerNames) timers[name] = Math.max(0, timers[name] - dt);
      // ---- the water, the wheel and everything it drives
      millWheel.step(dt, motion);
      const drive = millWheel.drive;
      machinery.update(millWheel.turn);
      shell.wheel.rotation.x = -millWheel.turn;
      leverAngle += ((millWheel.shut ? 0.5 : -0.35) - leverAngle) * ease(5);
      machinery.lever.rotation.x = leverAngle;
      // The stones take wheat from the hopper and fill the sack, while they turn.
      if (motion && hopper > 0) {
        const used = Math.min(hopper, (dt * drive) / HOPPER_RUN);
        hopper -= used;
        meal = Math.min(1, meal + (used * HOPPER_RUN) / SACK_FILL);
      }
      const h = machinery.hopper,
        level = h.bottom + hopper * (h.top - h.bottom);
      machinery.grain.position.y = level;
      machinery.grain.visible = hopper > 0.01;
      const width = 0.34 + ((level - h.bottom) / (h.top - h.bottom)) * 0.5;
      machinery.grain.scale.set(width, 1, width);
      // The damsel shakes the shoe as long as there is wheat and the stones turn.
      const shaking = motion && hopper > 0.01 ? drive : 0;
      machinery.shoe.rotation.z = Math.sin(time * 34) * 0.035 * shaking;
      const plump = 0.55 + 0.45 * meal,
        dropped = timers.sack > 0 ? 1 - timers.sack / 0.6 : 1;
      machinery.sack.scale.set(0.85 + 0.15 * meal, plump * dropped, 0.85 + 0.15 * meal);
      // ---- the hoist: up through the trapdoors into the loft, or back down
      if (motion) lift += ((hoisted ? 1 : 0) - lift) * ease(0.9 * Math.max(drive, 0.05));
      else lift = hoisted ? 1 : 0;
      const sackY = lift * (K.ceiling + 0.4);
      fittings.hoisted.position.y = sackY;
      fittings.hoisted.visible = lift < 0.995;
      fittings.chain.parent.position.y = 1.2 + sackY;
      fittings.chain.scale.y = Math.max(0.01, K.ceiling + 0.6 - (1.2 + sackY));
      fittings.chain.position.y = fittings.chain.scale.y / 2;
      // The flaps open while the sack is passing through the ceiling.
      const sackTop = sackY + 1.2,
        through = Math.max(0, Math.min(1, (sackTop - (K.ceiling - 0.2)) / 0.4)) * Math.max(0, Math.min(1, (K.ceiling + 0.2 - sackY) / 0.4));
      shell.flaps.forEach((flap, i) => (flap.rotation.z = (i ? -1 : 1) * through * 1.35));
      // ---- the mouse, out by the bins or off home along the skirting
      if (mouseAway && timers.mouse <= 0) mouseAway = 0;
      mouseAt += ((mouseAway ? 1 : 0) - mouseAt) * ease(mouseAway ? 2.4 : 0.6);
      fittings.mouse.position.lerpVectors(mouseHome, mouseHole, mouseAt);
      fittings.mouse.visible = mouseAt < 0.97;
      fittings.mouse.rotation.y = mouseAway ? Math.atan2(mouseHole.x - mouseHome.x, mouseHole.z - mouseHome.z) : 0.6 + Math.sin(t * 0.7) * 0.4;
      const sitting = timers.mouse > 6 && !mouseAway;
      fittings.body.rotation.x = sitting ? -0.9 : Math.sin(t * 5) * 0.03;
      fittings.body.position.y = sitting ? 0.03 : 0;
      // ---- the rocking chair rocks while you sit by it
      rock += ((night ? 1 : 0) - rock) * ease(1.5);
      fittings.rocking.rotation.x = Math.sin(t * 1.6) * 0.07 * rock;
      // ---- the bolter's crank
      crankTurn += (timers.bolter > 0 ? 4.5 : 0) * dt;
      fittings.crank.rotation.x = crankTurn;
      // ---- puffs: steam from the kettle, flour from the bolter and the spout, spray off the wheel
      const pos = puffGeo.attributes.position,
        w = shell.wheelAt,
        meal0 = { x: K.mealSack.x, y: 0.85, z: K.mealSack.z };
      for (let i = 0; i < PUFFS; i++) {
        const f = (t * 0.3 + i / PUFFS) % 1,
          kind = i % 5;
        if (kind < 2) {
          const s = fittings.steamAt;
          pos.setXYZ(i, s.x + Math.sin(f * 7 + i) * 0.04, s.y + f * 0.6, s.z + Math.sin(f * 5 + i * 2) * 0.05);
        } else if (kind === 2) {
          const p = fittings.puffAt,
            on = timers.bolter > 0 ? 1 : 0;
          pos.setXYZ(i, p.x - f * 0.25, on ? p.y + f * 0.4 : -10, p.z + Math.sin(i) * 0.3);
        } else if (kind === 3) {
          const on = shaking > 0.1 ? 1 : 0;
          pos.setXYZ(i, meal0.x + Math.sin(i * 3) * 0.08, on ? meal0.y + f * 0.25 : -10, meal0.z + Math.cos(i * 3) * 0.08);
        } else {
          const z = shell.spray[i % shell.spray.length].z,
            on = drive > 0.2 ? 1 : 0;
          pos.setXYZ(i, w.x + Math.sin(i * 5) * 0.4, on ? -1.1 + f * 0.6 : -10, w.z + z);
        }
      }
      pos.needsUpdate = true;
      // ---- flour turning in the sun
      dust.rotation.y = Math.sin(t * 0.04) * 0.05;
      dust.position.y = Math.sin(t * 0.3) * 0.08;
      // ---- the stove's fire, and evening
      const flicker = Math.sin(t * 8) * 0.4 + Math.sin(t * 13) * 0.25;
      stoveLight.intensity = (night ? 5 : 2) + flicker;
      M.fireGlow.emissiveIntensity = 1.5 + flicker * 0.4;
      sun.intensity += ((night ? 0.3 : 4.6) - sun.intensity) * k;
      sun.color.lerp(night ? COOL : WARM, k);
      ambient.intensity += ((night ? 0.4 : 0.8) - ambient.intensity) * k;
      for (const f of fills) f.light.intensity += ((night ? f.night : f.day) - f.light.intensity) * k;
      for (const lamp of lamps) lamp.intensity += ((night ? 9 : 0.8) - lamp.intensity) * k;
      M.lantern.emissiveIntensity += ((night ? 2.6 : 0.4) - M.lantern.emissiveIntensity) * k;
      for (const material of shell.viewMaterials) material.color.lerp(night ? VIEW_NIGHT : VIEW_DAY, k);
      scene.background.lerp(night ? DUSK : DAY, k);
      dustMat.opacity = night ? 0.15 : 0.45;
    },
    diagnostics: () => ({
      turning: millWheel.turning,
      sluiceShut: millWheel.shut,
      stoneRate: machinery.stoneRate(WHEEL_RATE * millWheel.drive),
      hopper,
      meal,
      sacks,
      hoisted,
      mouseOut: mouseAt < 0.2,
      cranking: timers.bolter > 0,
    }),
  };
  return room;
}

const WARM = new T.Color("#ffdca6"),
  COOL = new T.Color("#9fb3e0"),
  DAY = new T.Color("#a9cbd6"),
  DUSK = new T.Color("#1d2c4a");
