import * as T from "three";
import {
  BATH_LINES,
  BREAKFAST,
  BREAKFAST_LABELS,
  REST_LINES,
  THISTLEDOWN_POINTS,
  THISTLEDOWN_ROOM,
  WIRELESS_LINES,
} from "../content/thistledown.js";
import { cookBreakfast, createBreakfast, eatBreakfast, nextOf, orderBreakfast } from "../game/thistledown.js";
import { buildBreakfast, buildHall, buildKitchen, buildSitting } from "./ground-floor.js";
import { INN, SEEN_FROM, WALK, floorHeight, groundColliders, levelAt, stairHeight, upperColliders, zoneAt } from "./layout.js";
import { createMaterials, createSheet } from "./materials.js";
import { buildOutside } from "./outside.js";
import { buildBath, buildGoldfinch, buildLanding, buildLinnet } from "./upper-floor.js";
import { buildShell } from "./shell.js";

// Thistledown as a walkable room (src/interior.js): the village's bed &
// breakfast, two floors joined by one stair. The walker's colliders swap as it
// climbs and the eye follows the floor, as in The Drowsy Heron. The shell and the
// garden always draw; each furnished room draws only from where it can be seen
// (SEEN_FROM in layout.js), so a merged room out of sight costs nothing.
//
// The sun is the only shadow-caster and renders once when the room opens. The
// lamps are a fixed pool, so changing the hour or the floor compiles no program:
// the hall and landing lights stay put, and four others stand downstairs or
// upstairs according to which floor the visitor is on.

const DAY = {
  fog: new T.Color("#dfe2c8"),
  sky: new T.Color("#9dbfd2"),
  horizon: new T.Color("#f2e6c4"),
  sun: new T.Color("#ffe5bb"),
  hemi: new T.Color("#fff1dc"),
};
const DUSK = {
  fog: new T.Color("#26324f"),
  sky: new T.Color("#1f2e50"),
  horizon: new T.Color("#c08a6e"),
  sun: new T.Color("#ff9d6a"),
  hemi: new T.Color("#8aa3d4"),
};

// The four lamps that follow the visitor between floors.
const FLOOR_LAMPS = {
  ground: [
    { at: [3.5, 0.52, -1.1], colour: "#ff9a4f", reach: 7, day: 3.2, dusk: 6.5, flicker: true },
    { at: [5.2, 1.5, 2.25], colour: "#ffc184", reach: 6, day: 0.4, dusk: 4.2 },
    { at: [-3, 1.86, 1.62], colour: "#ffd39b", reach: 6, day: 0.5, dusk: 5.5 },
    { at: [-3.55, 1.95, -1.0], colour: "#ffd9a6", reach: 6.5, day: 1.8, dusk: 6.5 },
  ],
  upper: [
    { at: [-1.7, INN.loft + 1.05, 2.15], colour: "#ffc98a", reach: 5.5, day: 0.7, dusk: 3.2 },
    { at: [4.05, INN.loft + 1.05, -0.2], colour: "#ffb878", reach: 5, day: 0.55, dusk: 3 },
    { at: [-3.04, INN.loft + 1.05, -1.75], colour: "#ffd2a0", reach: 5.5, day: 0.7, dusk: 3 },
    { at: [3.1, INN.loft + 2.0, -3.45], colour: "#fff0d8", reach: 5, day: 1.3, dusk: 4.4 },
  ],
};

const GROUND_ZONES = new Set(["hall", "breakfast", "sitting", "kitchen"]);

export function createThistledownRoom() {
  const scene = new T.Scene();
  scene.background = new T.Color("#9dbfd2");
  // The view from the windows closes in with the evening; indoors stays clear.
  scene.fog = new T.Fog("#dfe2c8", 22, 72);
  const M = createMaterials(),
    sheet = createSheet();

  // ------------------------------------------------------------ build the house
  const shell = buildShell(M, sheet),
    outside = buildOutside(M, sheet),
    hall = buildHall(M, sheet),
    breakfastRoom = buildBreakfast(M, sheet),
    kitchen = buildKitchen(M, sheet),
    sitting = buildSitting(M, sheet),
    landing = buildLanding(M, sheet),
    goldfinch = buildGoldfinch(M, sheet),
    linnet = buildLinnet(M, sheet),
    bath = buildBath(M, sheet);
  const rooms = {
    hall: hall.parts,
    breakfast: breakfastRoom.parts,
    kitchen: kitchen.parts,
    sitting: sitting.parts,
    landing: landing.parts,
    goldfinch: goldfinch.parts,
    linnet: linnet.parts,
    bath: bath.parts,
  };

  // A little steam that rises while something is hot.
  const steamGeometry = new T.SphereGeometry(1, 7, 5);
  function steamAt(at) {
    const g = new T.Group();
    g.position.set(...at);
    const puffs = Array.from({ length: 5 }, () => {
      const m = new T.Mesh(steamGeometry, M.steam);
      g.add(m);
      return m;
    });
    g.visible = false;
    scene.add(g);
    return { group: g, puffs, active: 0 };
  }
  const panSteam = steamAt(kitchen.pan.at),
    teaSteam = steamAt(breakfastRoom.tea.spoutAt),
    traySteam = steamAt(goldfinch.tray.kettleAt),
    bathSteam = steamAt(bath.tub.steamAt);
  const steams = [panSteam, teaSteam, traySteam, bathSteam];

  // Merge each room; every room shares a few vertex-coloured finishes.
  const finishes = new Map();
  for (const parts of [shell.ground, shell.upper, shell.middle, outside.parts, ...Object.values(rooms)]) {
    parts.finish(finishes);
    scene.add(parts.root);
  }

  // ------------------------------------------------------------------ the sky
  const skyColors = { top: { value: DAY.sky.clone() }, bottom: { value: DAY.horizon.clone() } };
  const sky = new T.Mesh(
    new T.SphereGeometry(55, 24, 12),
    new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: skyColors,
      vertexShader: /* glsl */ `
        varying float h;
        void main() {
          h = normalize(position).y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top;
        uniform vec3 bottom;
        varying float h;
        void main() {
          gl_FragColor = vec4(mix(bottom, top, smoothstep(-0.02, 0.42, h)), 1.0);
        }`,
    }),
  );
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);

  // --------------------------------------------------------------------- lights
  const hemi = new T.HemisphereLight("#fff1dc", "#6f5e4a", 0.62);
  scene.add(hemi);
  // Golden afternoon comes in low from the lane, through the front and west
  // windows and the door's fanlight, and lays bars across the floors.
  const sun = new T.DirectionalLight("#ffe5bb", 3.1);
  sun.position.set(-12, 12, 16);
  sun.target.position.set(0, 1.5, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(2048);
  Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -8, near: 2, far: 50 });
  sun.shadow.bias = -0.00028;
  sun.shadow.normalBias = 0.018;
  sun.shadow.radius = 2.5;
  scene.add(sun, sun.target);

  const hallLamp = new T.PointLight("#ffd39b", 1, 6.5, 2);
  hallLamp.position.set(0, 2.05, 2.6);
  const backLamp = new T.PointLight("#ffd39b", 1, 5, 2);
  backLamp.position.set(-0.5, 2.05, -3.1);
  const landingLamp = new T.PointLight("#ffd39b", 1, 6, 2);
  landingLamp.position.set(-0.2, INN.loft + 2.05, -2.0);
  const floorLamps = FLOOR_LAMPS.ground.map(() => new T.PointLight("#ffffff", 0, 6, 2));
  scene.add(hallLamp, backLamp, landingLamp, ...floorLamps);

  // -------------------------------------------------------------------- the walk
  const storeys = { ground: groundColliders(), upper: upperColliders() };
  const colliders = [...storeys.ground];
  const visit = {
    level: "ground",
    zone: "hall",
    dusk: 0,
    target: 0,
    shown: null,
    music: false,
    bathRunning: false,
    bathFill: 0,
    teaTimer: 0,
    kettleTimer: 0,
    pendingNote: null,
    breakfast: createBreakfast(),
    reads: {},
  };
  const use = (level) => {
    visit.level = level;
    colliders.length = 0;
    colliders.push(...storeys[level]);
    placeFloorLamps(level);
  };
  function placeFloorLamps(level) {
    FLOOR_LAMPS[level].forEach((lamp, i) => {
      floorLamps[i].position.set(...lamp.at);
      floorLamps[i].color.set(lamp.colour);
      floorLamps[i].distance = lamp.reach;
    });
  }
  placeFloorLamps("ground");

  // Each room's furniture draws only from where it can be seen. The frame the
  // sun's map renders, everything is shown, so all of it casts.
  function showRooms(zone, force = false) {
    const key = force ? "all" : zone;
    if (visit.shown === key) return;
    visit.shown = key;
    const seen = SEEN_FROM[zone] ?? [];
    for (const [id, parts] of Object.entries(rooms)) parts.root.visible = force || seen.includes(id);
    // A floor's walls show from that floor, and from either end of the stairs.
    shell.ground.root.visible = force || GROUND_ZONES.has(zone) || zone === "landing";
    shell.upper.root.visible = force || !GROUND_ZONES.has(zone) || zone === "hall";
  }

  // --------------------------------------------------------------------- points
  const points = THISTLEDOWN_POINTS.map((point) => {
    const zone = zoneAt(point.level, point.x, point.z),
      built = {
        ...point,
        y: (point.level === "upper" ? INN.loft : 0) + point.y,
        available: () => visit.level === point.level && visit.zone === zone,
      };
    if (point.id === "hatch") Object.defineProperty(built, "label", { get: () => BREAKFAST_LABELS[visit.breakfast.phase] });
    if (point.id === "table") built.available = () => visit.zone === zone && visit.breakfast.phase === "served";
    if (point.id === "wireless") Object.defineProperty(built, "label", { get: () => (visit.music ? "Turn off the wireless" : "Turn on the wireless") });
    if (point.id === "bath") Object.defineProperty(built, "label", { get: () => (visit.bathRunning ? "Turn off the taps" : "Run the bath") });
    if (point.id === "goldfinch-bed" || point.id === "linnet-bed")
      Object.defineProperty(built, "label", { get: () => (visit.target ? "Sleep until the morning" : "Have a lie down") });
    return built;
  });

  function showBreakfast() {
    const { phase } = visit.breakfast;
    breakfastRoom.served.visible = phase === "served";
    breakfastRoom.eaten.visible = phase === "eaten";
    kitchen.pan.sizzle.visible = phase === "cooking";
    panSteam.active = phase === "cooking" ? 1 : 0;
  }

  function interact(point) {
    const { id } = point;
    if (id === "hatch") {
      const before = visit.breakfast.phase,
        result = orderBreakfast(visit.breakfast);
      showBreakfast();
      if (result === "ordered") return { title: BREAKFAST.title, text: before === "eaten" ? BREAKFAST.again : BREAKFAST.ordered, sound: "bell" };
      return { title: BREAKFAST.title, text: BREAKFAST[result], sound: "bell" };
    }
    if (id === "table") {
      if (!eatBreakfast(visit.breakfast)) return null;
      showBreakfast();
      return { title: BREAKFAST.title, text: BREAKFAST.eat, sound: "chime" };
    }
    if (id === "wireless") {
      visit.music = !visit.music;
      return { title: point.title, text: visit.music ? WIRELESS_LINES.on : WIRELESS_LINES.off, sound: visit.music ? "music:on" : "music:off" };
    }
    if (id === "bath") {
      visit.bathRunning = !visit.bathRunning;
      return { title: point.title, text: visit.bathRunning ? BATH_LINES.on : BATH_LINES.off, sound: visit.bathRunning ? "water" : undefined };
    }
    if (id === "goldfinch-bed" || id === "linnet-bed") {
      const toNight = !visit.target;
      return { title: point.title, text: toNight ? REST_LINES.evening : REST_LINES.morning, night: toNight, sound: "chime" };
    }
    if (id === "tea") visit.teaTimer = 7;
    if (id === "goldfinch-tray") visit.kettleTimer = 6;
    if (point.lines) {
      const n = visit.reads[id] ?? 0;
      visit.reads[id] = n + 1;
      return { title: point.title, text: nextOf(point.lines, n), sound: point.sound };
    }
    return { title: point.title, text: point.text, sound: point.sound };
  }

  const eye = new T.Vector3(WALK.spawn.x, INN.eye, WALK.spawn.z);
  // -----------------------------------------------------------------------
  const room = {
    ...THISTLEDOWN_ROOM,
    scene,
    sun,
    shadowLights: [sun],
    staticShadows: true,
    exposure: 1.02,
    environmentIntensity: 0.26,
    night: false,
    points,
    layout: { bounds: WALK.bounds, spawn: WALK.spawn, colliders },
    interact,
    setNight(value) {
      visit.target = value ? 1 : 0;
    },
    enter() {
      use("ground");
      visit.dusk = visit.target;
      visit.zone = "hall";
      visit.shown = null;
    },
    leave() {
      visit.music = false;
      visit.bathRunning = false;
    },
    takeNote() {
      const note = visit.pendingNote;
      visit.pendingNote = null;
      return note;
    },
    /** The eye's height over the floor under it, on either floor or the stair. */
    eyeAt(walker) {
      return floorHeight(visit.level, walker.position.x, walker.position.z) + INN.eye;
    },
    update(time, motion = true, { dt = 0, walker } = {}) {
      const t = motion ? time : 0;
      if (walker) {
        const { x, z } = walker.position,
          next = levelAt(visit.level, x, z);
        if (next !== visit.level) use(next);
        visit.zone = zoneAt(visit.level, x, z);
        eye.set(x, room.eyeAt(walker), z);
      }
      // The first frame after a resize re-renders the sun's map, so show it all.
      showRooms(visit.zone, sun.shadow.needsUpdate);
      sky.position.copy(eye);

      // Cooking, the bath and everything that keeps time.
      if (cookBreakfast(visit.breakfast, dt)) {
        showBreakfast();
        visit.pendingNote = { title: BREAKFAST.title, text: BREAKFAST.ready, sound: "bell" };
      }
      visit.teaTimer = Math.max(0, visit.teaTimer - dt);
      visit.kettleTimer = Math.max(0, visit.kettleTimer - dt);
      teaSteam.active = visit.teaTimer > 0 ? 1 : 0;
      traySteam.active = visit.kettleTimer > 0 ? 1 : 0;
      visit.bathFill = Math.min(1, Math.max(0, visit.bathFill + (visit.bathRunning ? dt / 9 : -dt / 14)));
      bathSteam.active = visit.bathFill > 0.05 ? 1 : 0;
      const { water } = bath.tub;
      water.visible = visit.bathFill > 0.01;
      water.position.y = 0.21 + visit.bathFill * 0.32;
      if (motion) {
        for (const s of steams) {
          s.group.visible = s.active > 0;
          if (s.group.visible) {
            s.puffs.forEach((puff, i) => {
              const f = (t * 0.32 + i / s.puffs.length) % 1;
              puff.position.set(Math.sin(f * 7 + i) * 0.05, f * 0.55, Math.cos(f * 5 + i) * 0.05);
              puff.scale.setScalar(0.035 + f * 0.09);
            });
          }
        }
      } else for (const s of steams) s.group.visible = false;
      M.steam.opacity = 0.3;

      // The clock's pendulum and hands; the canary; Thimble's sleeping breath.
      const { pendulum, minute, hour } = hall.clock;
      pendulum.rotation.z = Math.sin(t * Math.PI) * 0.11;
      minute.rotation.z = -t * 0.04;
      hour.rotation.z = -t * 0.04 / 12 - 1;
      const { bird } = breakfastRoom.caruso;
      bird.position.x = Math.round(Math.sin(t * 0.7) * 2) * 0.03;
      bird.position.y = 1.34 + Math.max(0, Math.sin(t * 5.2)) * 0.008;
      bird.rotation.y = Math.sin(t * 0.6) > 0 ? 0.9 : -0.9;
      const { body, head, tail } = sitting.thimble;
      const breath = 1 + Math.sin(t * 1.1) * 0.022;
      body.scale.set(breath, breath, 1);
      head.rotation.x = Math.sin(t * 1.1) * 0.012;
      tail.rotation.y = Math.sin(t * 0.34) * 0.07;
      // The fire.
      for (const f of sitting.fire.flames) {
        const n = Math.sin(t * 9 + f.phase) * 0.16 + Math.sin(t * 14.7 + f.phase * 2) * 0.12;
        f.mesh.scale.set(f.wide * (1 - n * 0.4), f.tall * (1 + n), f.wide * (1 - n * 0.4));
        f.mesh.position.x = f.x + Math.sin(t * 6 + f.phase) * 0.012;
      }
      // The sheets in the garden.
      outside.sheets.forEach((s, i) => (s.rotation.x = Math.sin(t * 1.3 + i * 0.8) * 0.08 + 0.04));

      // The hour: everything eases between golden afternoon and blue dusk.
      visit.dusk += (visit.target - visit.dusk) * (1 - Math.exp(-dt * 3));
      const d = visit.dusk;
      skyColors.top.value.lerpColors(DAY.sky, DUSK.sky, d);
      skyColors.bottom.value.lerpColors(DAY.horizon, DUSK.horizon, d);
      scene.background.copy(skyColors.top.value);
      scene.fog.color.lerpColors(DAY.fog, DUSK.fog, d);
      scene.fog.near = 22 - 10 * d;
      scene.fog.far = 72 - 46 * d;
      sun.color.lerpColors(DAY.sun, DUSK.sun, d);
      sun.intensity = 3.1 - 2.75 * d;
      hemi.color.lerpColors(DAY.hemi, DUSK.hemi, d);
      hemi.intensity = 0.62 - 0.3 * d;
      scene.environmentIntensity = 0.2 - 0.08 * d;
      const flicker = 1 + Math.sin(t * 8.3) * 0.09 + Math.sin(t * 13.7 + 1.2) * 0.06 + Math.sin(t * 3.1) * 0.05;
      hallLamp.intensity = 0.7 + 3.5 * d;
      backLamp.intensity = 1.0 + 2.6 * d;
      landingLamp.intensity = 0.9 + 3.1 * d;
      FLOOR_LAMPS[visit.level].forEach((lamp, i) => {
        floorLamps[i].intensity = (lamp.day + (lamp.dusk - lamp.day) * d) * (lamp.flicker ? flicker : 1);
      });
      // The stair's halfway dim, so the lamps that swap between floors do it
      // while nothing they light is in view.
      const rise = stairHeight(eye.x, eye.z);
      if (rise !== null) {
        const away = 1 - Math.abs(rise / INN.loft - 0.5) * 2;
        for (const lamp of floorLamps) lamp.intensity *= 1 - away * 0.9;
      }
      M.shade.emissiveIntensity = 0.12 + 1.5 * d;
      M.redShade.emissiveIntensity = 0.12 + 1.5 * d;
      M.bulb.emissiveIntensity = 0.25 + 2 * d;
      M.ember.emissiveIntensity = (0.8 + 0.8 * d) * flicker;
      M.flame.emissiveIntensity = 1.05 + 0.45 * d;
      M.flameCore.emissiveIntensity = 1.1 + 0.5 * d;
      M.glass.emissiveIntensity = 0.05 * (1 - d);
      M.glass.opacity = 0.14 + d * 0.16;
      M.frosted.emissiveIntensity = 0.42 - 0.34 * d;
      M.net.emissiveIntensity = 0.2 - 0.16 * d;
    },
    diagnostics: () => ({
      level: visit.level,
      zone: visit.zone,
      floor: eye.y - INN.eye,
      breakfast: visit.breakfast.phase,
      eaten: visit.breakfast.eaten,
      music: visit.music,
      bath: visit.bathFill,
      roomsDrawn: Object.values(rooms).filter((parts) => parts.root.visible).length,
    }),
  };
  use("ground");
  return room;
}
