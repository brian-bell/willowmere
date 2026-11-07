import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  CAKE_GONE,
  DOOR_BELL,
  KETTLE_NOTES,
  KETTLE_POINTS,
  KETTLE_ROOM,
  LOAF_NOTE,
  POUR_LINES,
  TRAY_FULL,
} from "../content/copper-kettle.js";
import { hazelHasLoaf } from "../game/market.js";
import { createParts } from "../post-office/parts.js";
import { TRAY_SIZE, buildKitchen } from "./kitchen.js";
import { KETTLE as K, answersFrom, kettleLayout } from "./layout.js";
import { VIEW_DAY, VIEW_NIGHT, buildShell } from "./shell.js";
import { createSurfaces } from "./surfaces.js";
import { buildTeaRoom } from "./tea-room.js";

const SLICES = 8;

// The Copper Kettle as a walkable room (src/interior.js): the tea room behind
// the bay window, and Hazel's kitchen through the curtained doorway. Hazel is
// out on the terrace with a tray. Nothing that moves casts a shadow, so its one
// sun map is drawn on opening and kept. `state` is read and never written: it
// only asks whether Hazel has had her loaf.
export function createCopperKettle({ state }) {
  const scene = new T.Scene();
  scene.background = new T.Color("#a9cbd6");
  const root = new T.Group();
  scene.add(root);
  const parts = createParts(root, 5381),
    surfaces = createSurfaces(parts),
    { M } = surfaces,
    { orb, cyl, rod, turned, range, bake, paintFlat } = parts,
    keep = new Set();
  const shell = buildShell(parts, surfaces, keep),
    tea = buildTeaRoom(parts, surfaces, keep),
    kitchen = buildKitchen(parts, surfaces, keep);

  // ------------------------------------------------------------------- lamps
  // Cream enamel shades on brass rods; the room's point lights hang under them.
  const pendantAt = (x, z, drop) => {
    const y = K.ceiling - drop;
    rod(M.brass, [x, K.ceiling, z], [x, y + 0.14, z], 0.011, 6);
    cyl(M.brass, x, K.ceiling - 0.03, z, 0.07, 0.04, 0.05, root, 12);
    turned(M.shade, [[0.3, 0], [0.27, 0.02], [0.08, 0.17], [0.04, 0.2]], x, y, z, 20);
    turned(M.shadeUnder, [[0.29, 0], [0.27, 0.015], [0.08, 0.16], [0.04, 0.19]], x, y, z, 20).castShadow = false;
    orb(M.bulb, x, y + 0.05, z, 0.058, 0.07, 0.058).castShadow = false;
  };
  const lampSpots = [
    { x: -3.6, z: 2.2, drop: 0.95, day: 1.4, night: 11, distance: 7.5 },
    { x: 2.9, z: 2.4, drop: 0.95, day: 1.4, night: 11, distance: 7.5 },
    { x: -4.2, z: -0.9, drop: 0.95, day: 2.2, night: 10, distance: 6.5 },
    { x: -0.9, z: -4.2, drop: 1.25, day: 3.5, night: 12, distance: 7.5 },
    { x: 3.9, z: -4.6, drop: 1.0, day: 2.5, night: 9, distance: 6.5 },
  ];
  const lamps = lampSpots.map((spot) => {
    pendantAt(spot.x, spot.z, spot.drop);
    const light = new T.PointLight("#ffd9a0", spot.day, spot.distance, 2);
    light.position.set(spot.x, K.ceiling - spot.drop - 0.12, spot.z);
    scene.add(light);
    return { light, ...spot };
  });
  const fireX = (K.fireplace.x[0] + K.fireplace.x[1]) / 2,
    southFace = K.partition + K.wall / 2;
  const fireLight = new T.PointLight("#ff9a45", 4, 6.5, 2);
  fireLight.position.set(fireX, 0.9, southFace + K.chimney.depth + 0.4);
  scene.add(fireLight);
  // What the bay and the east window spill across the room by day, and the
  // rear window into the kitchen.
  const bayFill = new T.PointLight("#fff0cf", 3.6, 8, 1.6);
  bayFill.position.set(-3.85, 2.6, 4.2);
  scene.add(bayFill);
  const eastFill = new T.PointLight("#fff0cf", 2.4, 7, 1.6);
  eastFill.position.set(3.9, 2.6, 4.1);
  scene.add(eastFill);
  const rearFill = new T.PointLight("#cfe0ee", 3.6, 7, 1.6);
  rearFill.position.set(-1.4, 2.4, K.back + 0.8);
  scene.add(rearFill);
  const ambient = new T.HemisphereLight("#fff1dc", "#7a644e", 0.75);
  scene.add(ambient);
  // Afternoon sun from the south-west, through the bay and the door's glass.
  const sun = new T.DirectionalLight("#ffdca6", 5.0);
  sun.position.set(-12, 11, 14);
  sun.target.position.set(-1.5, 0, 1.5);
  scene.add(sun, sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 12, bottom: -12, near: 1, far: 44 });
  // A shadow camera keeps the frustum it was made with until told otherwise.
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.normalBias = 0.022;
  sun.shadow.bias = -0.00016;
  sun.shadow.radius = 1.6;

  // ------------------------------------------------------- dust and steam
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
  const dustGeo = new T.BufferGeometry(),
    dustPositions = new Float32Array(60 * 3);
  for (let i = 0; i < 60; i++) {
    dustPositions[i * 3] = range(-5.6, -1.6);
    dustPositions[i * 3 + 1] = range(0.4, 3.3);
    dustPositions[i * 3 + 2] = range(1.6, 4.6);
  }
  dustGeo.setAttribute("position", new T.BufferAttribute(dustPositions, 3));
  const dustMat = new T.PointsMaterial({ color: "#ffe9b8", map: softDot, size: 0.03, transparent: true, opacity: 0.4, depthWrite: false });
  const dust = new T.Points(dustGeo, dustMat);
  scene.add(dust);
  // One cloud of steam, its puffs shared between the hob's kettle, the urn
  // and the cup, so steam is a single draw.
  const PUFFS = 18;
  const steamGeo = new T.BufferGeometry(),
    steamPositions = new Float32Array(PUFFS * 3);
  steamGeo.setAttribute("position", new T.BufferAttribute(steamPositions, 3));
  const steam = new T.Points(steamGeo, new T.PointsMaterial({ color: "#ffffff", map: softDot, size: 0.3, transparent: true, opacity: 0.12, depthWrite: false }));
  steam.frustumCulled = false;
  scene.add(steam);

  // Glass and everything that moves stay out of the shadow map and the bake.
  root.traverse((o) => {
    if (o.isMesh && o.material.transparent) o.castShadow = o.receiveShadow = false;
  });
  for (const g of keep) g.traverse((o) => (o.castShadow = false));
  paintFlat(keep);
  bake(keep);

  // --------------------------------------------------------------- behaviour
  let night = false,
    pending = null,
    hasLoaf = false,
    playing = false,
    slices = SLICES,
    scones = 3,
    cups = 0,
    spin = 0,
    here = { x: 0, z: 0 };
  const timers = { spring: 0, till: 0, pour: 0, purr: 0, urn: 0, oven: 0, cutter: 0, bell: 0 },
    timerNames = Object.keys(timers);
  const lines = {};
  const nextLine = (id, list) => {
    lines[id] = (lines[id] ?? -1) + 1;
    return list[lines[id] % list.length];
  };
  let drawerOut = 0,
    ovenOpen = 0,
    tilt = 0;
  const cakeGeometry = (n) => (n ? mergeGeometries(tea.wedges.slice(0, n)) : new T.BufferGeometry());
  function setCake(n) {
    slices = n;
    tea.cake.geometry.dispose();
    tea.cake.geometry = cakeGeometry(n);
  }
  function setScones(n) {
    scones = n;
    kitchen.tray.geometry.dispose();
    kitchen.tray.geometry = kitchen.sconeGeometry(n);
  }
  const spout = new T.Vector3(),
    cupTop = new T.Vector3(tea.cupAt.x, tea.cupAt.y + 0.09, tea.cupAt.z),
    up = new T.Vector3(0, 1, 0);

  /** The room's own reply to E. Anything without a note falls back to the point. */
  function interact(point) {
    const { id } = point;
    if (id === "loaf") return { title: LOAF_NOTE.title, text: LOAF_NOTE.lines[0] };
    const note = KETTLE_NOTES[id];
    if (!note) return null;
    if (id === "bell") timers.bell = 0.7;
    if (id === "till") timers.till = 1.8;
    if (id === "cat") timers.purr = 4;
    if (id === "urn") timers.urn = 2.4;
    if (id === "oven") timers.oven = 3.2;
    if (id === "gramophone") {
      playing = !playing;
      if (!playing) return { title: note.title, text: "You lift the needle. The tune stops mid-phrase, and the fire carries on where it left off.", sound: "click" };
    }
    if (id === "sit") return { title: note.title, text: note.lines[0], sound: note.sound, night: !night };
    if (id === "cake") {
      if (slices === 0) {
        setCake(SLICES);
        return { ...CAKE_GONE, sound: "chime" };
      }
      setCake(slices - 1);
    }
    if (id === "scones") {
      timers.cutter = 0.5;
      if (scones === TRAY_SIZE) {
        setScones(0);
        return { ...TRAY_FULL, sound: "thump" };
      }
      setScones(scones + 1);
    }
    if (id === "pour") {
      timers.pour = 2;
      cups++;
      const tea2 = POUR_LINES[(cups - 1) % POUR_LINES.length];
      return { title: note.title, text: `${note.lines[0]} Today it is ${tea2}.`, sound: note.sound };
    }
    return { title: note.title, text: nextLine(id, note.lines), sound: note.sound };
  }

  const room = {
    ...KETTLE_ROOM,
    scene,
    sun,
    shadowLights: [sun],
    // Nothing that moves casts a shadow, so the map never needs refreshing.
    staticShadows: true,
    exposure: 1.02,
    environmentIntensity: 0.2,
    // A point answers only from its own side of the partition (or, for the
    // urn, from behind the counter), wherever the visitor stood last frame.
    points: KETTLE_POINTS.map((point) => ({
      ...point,
      available: point.id === "loaf" ? () => hasLoaf : () => answersFrom(point, here.x, here.z),
    })),
    layout: kettleLayout(),
    interact,
    enter() {
      hasLoaf = hazelHasLoaf(state.deliveries);
      tea.loaf.visible = hasLoaf;
      timers.spring = 2.4;
      pending = { title: DOOR_BELL.title, text: nextLine("greeting", DOOR_BELL.lines), sound: "shopbell" };
    },
    place({ x, z } = {}) {
      if (x !== undefined) here = { x, z };
    },
    setNight(value) {
      night = value;
    },
    takeNote() {
      const note = pending;
      pending = null;
      return note;
    },
    update(time, motion = true, { dt = 0, walker } = {}) {
      if (walker) here = walker.position;
      const t = motion ? time : 0,
        k = 1 - Math.exp(-dt * 3),
        ease = (rate) => 1 - Math.exp(-dt * rate);
      for (const name of timerNames) timers[name] = Math.max(0, timers[name] - dt);
      // ---- the kitchen clock, a little fast
      kitchen.minute.rotation.z = -1.1 - t * 0.02;
      kitchen.hour.rotation.z = -2.2 - (t * 0.02) / 12;
      // ---- the bell on its spring over the door
      const ring = motion ? timers.spring / 2.4 : 0;
      shell.spring.rotation.x = Math.sin(time * 19) * 0.2 * ring * ring;
      shell.dome.rotation.z = Math.sin(time * 27) * 0.42 * ring;
      // ---- the till's drawer springs out and is pushed home
      drawerOut += ((timers.till > 0 ? 1 : 0) - drawerOut) * ease(timers.till > 0 ? 14 : 5);
      tea.drawer.position.z = 0.12 + drawerOut * 0.26;
      // ---- the teapot tips, pours and goes back; the cup fills, then cools down
      const pouring = timers.pour > 0.35 && timers.pour < 1.75;
      tilt += ((timers.pour > 0.2 ? 0.78 : 0) - tilt) * ease(6);
      tea.pivot.rotation.z = tilt;
      tea.pivot.updateMatrixWorld(true);
      spout.set(-0.235 + 0.12, 0.2, 0).applyMatrix4(tea.pivot.matrixWorld);
      tea.stream.visible = pouring;
      if (pouring) {
        const length = spout.distanceTo(cupTop);
        tea.stream.position.copy(spout).add(cupTop).multiplyScalar(0.5);
        tea.stream.scale.set(1, length, 1);
        tea.stream.quaternion.setFromUnitVectors(up, spout.clone().sub(cupTop).normalize());
      }
      const full = cups > 0 ? (timers.pour > 0 ? Math.min(1, (2 - timers.pour) / 1.5) : 1) : 0;
      tea.teaLevel.position.y = tea.cupAt.y + 0.025 + full * 0.06;
      tea.teaLevel.visible = full > 0;
      // ---- Crumpet breathes, and stretches and swishes when stroked
      const purring = timers.purr > 0;
      tea.body.scale.set(1, 1 + Math.sin(t * (purring ? 3 : 1.6)) * (purring ? 0.035 : 0.02), 1);
      tea.head.rotation.z = purring ? 0.12 + Math.sin(t * 2) * 0.04 : Math.sin(t * 0.3) * 0.02;
      tea.tail.rotation.y = Math.sin(t * (purring ? 2.4 : 0.6)) * (purring ? 0.35 : 0.06);
      // ---- the record turns while it plays
      spin += ((playing ? 3.5 : 0) - spin) * ease(2);
      tea.record.rotation.y -= spin * dt;
      tea.crank.rotation.z += spin * dt * 0.15;
      // ---- the oven door drops open and swings back up
      ovenOpen += ((timers.oven > 0 ? 1 : 0) - ovenOpen) * ease(5);
      kitchen.ovenDoor.rotation.x = ovenOpen * 1.35;
      M.ovenGlow.emissiveIntensity = 0.6 + ovenOpen * 1.6;
      // ---- the cutter comes down on the dough
      const press = timers.cutter > 0 ? Math.sin((timers.cutter / 0.5) * Math.PI) : 0;
      kitchen.cutter.position.y = K.table.height + 0.04 + 0.06 * (1 - press);
      // ---- the fire, the urn's sigh, and steam from the hob and the cup
      const flicker = Math.sin(t * 8) * 0.8 + Math.sin(t * 13) * 0.45 + Math.sin(t * 3.1) * 0.4;
      fireLight.intensity = (night ? 10 : 4) + flicker;
      M.fireGlow.emissiveIntensity = 1.7 + flicker * 0.32;
      tea.flames.forEach((flame, i) => {
        const f = Math.sin(t * (9 + i * 2.3) + i) * 0.5 + Math.sin(t * (14 + i) + i * 2) * 0.3;
        flame.scale.set(1 + f * 0.12, 1 + f * 0.28, 1 + f * 0.12);
        flame.position.y = 0.6 + f * 0.04;
      });
      const steamPos = steamGeo.attributes.position,
        sources = [kitchen.steamAt, timers.urn > 0 ? tea.urnSpout : kitchen.steamAt, cups > 0 ? cupTop : kitchen.steamAt];
      for (let i = 0; i < PUFFS; i++) {
        const source = sources[i % 3],
          f = (t * 0.26 + i / PUFFS) % 1;
        steamPos.setXYZ(i, source.x + Math.sin(f * 7 + i) * 0.04, source.y + f * (source === tea.urnSpout ? 0.7 : 0.55), source.z + Math.sin(f * 5 + i * 2) * 0.05 + (source === kitchen.steamAt ? -f * 0.1 : 0));
      }
      steamPos.needsUpdate = true;
      // ---- dust turns in the sun
      dust.rotation.y = Math.sin(t * 0.04) * 0.04;
      dust.position.y = Math.sin(t * 0.3) * 0.07;
      // ---- evening: the sun goes, the sky cools, the pendants come up
      sun.intensity += ((night ? 0.3 : 5.0) - sun.intensity) * k;
      sun.color.lerp(night ? COOL : WARM, k);
      ambient.intensity += ((night ? 0.4 : 0.75) - ambient.intensity) * k;
      bayFill.intensity += ((night ? 1.0 : 3.6) - bayFill.intensity) * k;
      eastFill.intensity += ((night ? 0.8 : 2.4) - eastFill.intensity) * k;
      rearFill.intensity += ((night ? 0.8 : 3.6) - rearFill.intensity) * k;
      for (const lamp of lamps) lamp.light.intensity += ((night ? lamp.night : lamp.day) - lamp.light.intensity) * k;
      M.bulb.emissiveIntensity += ((night ? 2.8 : 0.5) - M.bulb.emissiveIntensity) * k;
      M.shadeUnder.emissiveIntensity += ((night ? 1.3 : 0.12) - M.shadeUnder.emissiveIntensity) * k;
      for (const material of shell.viewMaterials) material.color.lerp(night ? VIEW_NIGHT : VIEW_DAY, k);
      scene.background.lerp(night ? DUSK : DAY, k);
      dustMat.opacity = night ? 0.12 : 0.4;
    },
    diagnostics: () => ({
      slices,
      scones,
      cups,
      playing,
      purring: timers.purr > 0,
      ovenOpen: ovenOpen > 0.5,
      drawerOut: drawerOut > 0.5,
      loaf: tea.loaf.visible,
    }),
  };
  return room;
}

const WARM = new T.Color("#ffdca6"),
  COOL = new T.Color("#9fb3e0"),
  DAY = new T.Color("#a9cbd6"),
  DUSK = new T.Color("#1d2c4a");
