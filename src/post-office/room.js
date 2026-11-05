import * as T from "three";
import { LOAF_NOTE, POST_OFFICE_NOTES, POST_OFFICE_POINTS, POST_OFFICE_ROOM, SHOP_BELL } from "../content/post-office.js";
import { buildBackRoom } from "./back-room.js";
import { buildCounter } from "./counter.js";
import { buildHall } from "./hall.js";
import { FIXTURES as F, POST_OFFICE as P, postOfficeLayout } from "./layout.js";
import { createParts } from "./parts.js";
import { VIEW_DAY, VIEW_NIGHT, buildShell } from "./shell.js";
import { buildSorting } from "./sorting.js";
import { createSurfaces } from "./surfaces.js";

// The post office as a walkable room (src/interior.js): a public hall, the
// sorting office behind the counter's flap, and a back room through a door
// nobody has shut in years. Nothing that moves casts a shadow, so its one sun
// map is drawn on opening and kept. `state` is read and never written: it only
// asks whether Bram has had his loaf.
export function createPostOffice({ state }) {
  const scene = new T.Scene();
  scene.background = new T.Color("#a9cbd6");
  const root = new T.Group();
  scene.add(root);
  const parts = createParts(root, 4127),
    surfaces = createSurfaces(parts),
    { M } = surfaces,
    { orb, cyl, rod, turned, group, range, bake } = parts,
    keep = new Set();
  const shell = buildShell(parts, surfaces),
    counter = buildCounter(parts, surfaces, keep),
    sorting = buildSorting(parts, surfaces, keep),
    hall = buildHall(parts, surfaces, keep),
    back = buildBackRoom(parts, surfaces, keep);

  // ------------------------------------------------------------------- lamps
  // Enamel-shaded pendants on brass rods: the room's point lights hang under them.
  const pendantAt = (x, z, drop) => {
    const y = P.ceiling - drop;
    rod(M.brassDull, [x, P.ceiling, z], [x, y + 0.14, z], 0.011, 6);
    cyl(M.brass, x, P.ceiling - 0.03, z, 0.07, 0.04, 0.05, root, 12);
    turned(M.shade, [[0.3, 0], [0.27, 0.02], [0.07, 0.17], [0.04, 0.2]], x, y, z, 20);
    turned(M.shadeUnder, [[0.29, 0], [0.27, 0.015], [0.07, 0.16], [0.04, 0.19]], x, y, z, 20).castShadow = false;
    const bulb = orb(M.bulb, x, y + 0.05, z, 0.058, 0.07, 0.058);
    bulb.castShadow = false;
  };
  const lampSpots = [
    { x: -3.5, z: 2.75, drop: 0.86, day: 1.5, night: 12, distance: 7.5 },
    { x: 0.95, z: 2.75, drop: 0.86, day: 1.5, night: 11, distance: 7.5 },
    { x: -3.2, z: -1.5, drop: 0.86, day: 3, night: 13, distance: 7 },
    { x: 3.9, z: -1.5, drop: 0.86, day: 2.5, night: 11, distance: 7 },
    { x: -0.3, z: -5.25, drop: 0.86, day: 4.5, night: 11, distance: 8 },
  ];
  const lamps = lampSpots.map((spot) => {
    pendantAt(spot.x, spot.z, spot.drop);
    const light = new T.PointLight("#ffd9a0", spot.day, spot.distance, 2);
    light.position.set(spot.x, P.ceiling - spot.drop - 0.12, spot.z);
    scene.add(light);
    return { light, ...spot };
  });
  const fireLight = new T.PointLight("#ff9a45", 4, 6.5, 2);
  fireLight.position.set(P.stove.x, 1.05, P.stove.z - 0.75);
  scene.add(fireLight);
  // What the big window and the rear one spill across the room by day.
  const hallFill = new T.PointLight("#fff0cf", 3.5, 9, 1.6);
  hallFill.position.set(-2.6, 2.6, 3.5);
  scene.add(hallFill);
  const rearFill = new T.PointLight("#cfe0ee", 4, 7, 1.6);
  rearFill.position.set(3.4, 2.4, -5.9);
  scene.add(rearFill);
  const ambient = new T.HemisphereLight("#fff1dc", "#7a644e", 0.7);
  scene.add(ambient);
  // Afternoon sun from the south-west, through the big window and the door's
  // glass and the west window, with every bar and letter in its shadow.
  const sun = new T.DirectionalLight("#ffdca6", 5.2);
  sun.position.set(-11, 12, 14);
  sun.target.position.set(-1, 0, 1);
  scene.add(sun, sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 12, bottom: -12, near: 1, far: 42 });
  // A shadow camera keeps the frustum it was made with until told otherwise.
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.normalBias = 0.022;
  sun.shadow.bias = -0.00016;
  sun.shadow.radius = 1.6;

  // ---------------------------------------------- dust in the light, and steam
  const dustGeo = new T.BufferGeometry(),
    dustPositions = new Float32Array(70 * 3);
  for (let i = 0; i < 70; i++) {
    dustPositions[i * 3] = range(-5.5, 2.5);
    dustPositions[i * 3 + 1] = range(0.3, 3.3);
    dustPositions[i * 3 + 2] = range(1.2, 4.6);
  }
  dustGeo.setAttribute("position", new T.BufferAttribute(dustPositions, 3));
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
  const dustMat = new T.PointsMaterial({ color: "#ffe9b8", map: softDot, size: 0.03, transparent: true, opacity: 0.4, depthWrite: false });
  const dust = new T.Points(dustGeo, dustMat);
  scene.add(dust);
  const steamGeo = new T.BufferGeometry(),
    steamPositions = new Float32Array(8 * 3);
  steamGeo.setAttribute("position", new T.BufferAttribute(steamPositions, 3));
  const steam = new T.Points(steamGeo, new T.PointsMaterial({ color: "#ffffff", map: softDot, size: 0.34, transparent: true, opacity: 0.1, depthWrite: false }));
  scene.add(steam);
  const steamAt = new T.Vector3(0.31, 0.2, 0);
  back.kettle.localToWorld(steamAt);

  // Glass and everything that moves stay out of the shadow map and the bake.
  root.traverse((o) => {
    if (o.isMesh && o.material.transparent) o.castShadow = o.receiveShadow = false;
  });
  for (const g of keep) g.traverse((o) => (o.castShadow = false));
  bake(keep);

  // --------------------------------------------------------------- behaviour
  let night = false,
    toll = 0,
    pending = null,
    tickClock = 0,
    hasLoaf = false;
  const notes = POST_OFFICE_NOTES;
  // Timers that count down from a press; each part reads its own.
  const timers = { bell: 0, stamp: 0, coo: 0, morse: 0, spring: 0, scale: 0, box: 0, board: 0 },
    timerNames = Object.keys(timers);
  const scale = { tilt: 0.09, target: 0.09 };
  const needleState = { angle: 0, target: 0.5 };
  let spin = 0.0,
    spinAngle = 0,
    wireless = false,
    postmarks = 0,
    stampFell = true,
    boxOpen = 0;
  const lines = {};
  const nextLine = (id, list) => {
    lines[id] = (lines[id] ?? -1) + 1;
    return list[lines[id] % list.length];
  };
  /** A fresh black ring on the envelope, wherever the hand happened to land. */
  function postmark() {
    const c = counter.postmarkCanvas.getContext("2d");
    if (postmarks && postmarks % 14 === 0) counter.resetEnvelope();
    postmarks++;
    const x = 140 + range(-42, 80),
      y = 66 + range(-22, 40),
      r = 42;
    c.save();
    c.translate(x, y);
    c.rotate(range(-0.32, 0.32));
    c.strokeStyle = c.fillStyle = `rgba(22,20,24,${range(0.72, 0.92)})`;
    c.lineWidth = 3;
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.stroke();
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(0, 0, r * 0.6, 0, Math.PI * 2);
    c.stroke();
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = "bold 13px Georgia";
    "WILLOWMERE".split("").forEach((letter, i) => {
      const a = -1.32 + i * 0.29;
      c.save();
      c.rotate(a);
      c.fillText(letter, 0, -r * 0.8);
      c.restore();
    });
    c.font = "bold 15px Georgia";
    c.fillText("THUR", 0, -5);
    c.font = "12px Georgia";
    c.fillText("LAST POST", 0, 12);
    c.restore();
    counter.postmarkMap.needsUpdate = true;
  }
  /** The room's own reply to E. Anything without a note falls back to the point. */
  function interact(point) {
    const { id } = point;
    if (id === "loaf") return { title: LOAF_NOTE.title, text: LOAF_NOTE.lines[0] };
    const note = notes[id];
    if (!note) return null;
    if (id === "bell") timers.bell = 0.7;
    if (id === "stamp") {
      timers.stamp = 0.6;
      stampFell = false;
    }
    if (id === "pigeon") timers.coo = 2.2;
    if (id === "telegraph") timers.morse = 2.1;
    if (id === "scale") {
      scale.target = scale.target > 0 ? -0.11 : 0.09;
      timers.scale = 2.6;
    }
    if (id === "boxes") timers.box = 7;
    if (id === "spinner") spin = Math.min(spin + 3.1, 6);
    if (id === "penny-scale") needleState.target = range(0.8, 5.2);
    if (id === "wireless") wireless = !wireless;
    if (id === "switchboard") timers.board = 3.5;
    // Off again, the wireless says so and asks for no more words.
    if (id === "wireless" && !wireless) return { title: note.title, text: "A soft click, and the room goes back to ticking.", sound: "click" };
    return { title: note.title, text: nextLine(id, note.lines), sound: note.sound };
  }

  const room = {
    ...POST_OFFICE_ROOM,
    scene,
    sun,
    shadowLights: [sun],
    // Nothing that moves casts a shadow, so the map never needs refreshing.
    staticShadows: true,
    exposure: 1.02,
    environmentIntensity: 0.2,
    points: POST_OFFICE_POINTS.map((point) =>
      point.id === "loaf" ? { ...point, available: () => hasLoaf } : point,
    ),
    layout: postOfficeLayout(),
    interact,
    enter() {
      hasLoaf = state.deliveries.made > 0;
      back.loaf.visible = hasLoaf;
      timers.spring = 2.4;
      pending = { title: SHOP_BELL.title, text: nextLine("greeting", SHOP_BELL.lines), sound: "shopbell" };
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
        k = 1 - Math.exp(-dt * 3);
      toll += dt;
      for (const name of timerNames) timers[name] = Math.max(0, timers[name] - dt);
      // ---- the clock, which is a little slower than time
      const swing = Math.sin(t * 2.2);
      sorting.pendulum.rotation.z = swing * 0.14;
      sorting.minute.rotation.z = -1.1 - t * 0.02;
      sorting.hour.rotation.z = -2.2 - (t * 0.02) / 12;
      tickClock += dt;
      if (tickClock > 1.43 && !pending) {
        tickClock = 0;
        pending = { sound: "tick" };
      }
      // ---- Second Class breathes, bobs and looks about
      const cooing = timers.coo > 0,
        bob = cooing ? Math.sin(t * 13) * 0.016 : Math.sin(t * 1.6) * 0.003,
        look = Math.sin(t * 0.42) * 0.4 + Math.sin(t * 0.97) * 0.16;
      sorting.body.scale.setScalar(1 + (cooing ? 0.04 + Math.sin(t * 13) * 0.02 : Math.sin(t * 1.7) * 0.012));
      sorting.head.rotation.y = cooing ? 0 : look;
      sorting.head.rotation.x = cooing ? 0.22 + Math.sin(t * 13) * 0.16 : Math.sin(t * 0.8) * 0.05;
      sorting.head.position.z = 0.1 + bob * 2.4;
      sorting.tail.rotation.x = Math.sin(t * 0.7) * 0.05;
      // ---- the bell on its spring, and the one on the counter
      // With reduced motion the bell still rings, but keeps still.
      const ring = motion ? timers.spring / 2.4 : 0;
      hall.spring.rotation.x = Math.sin(toll * 19) * 0.22 * ring * ring;
      hall.dome.rotation.z = Math.sin(toll * 27) * 0.42 * ring;
      counter.bell.position.y = P.counter.height + 0.002 + (timers.bell > 0 ? Math.abs(Math.sin(timers.bell * 34)) * 0.006 * timers.bell : 0);
      counter.bell.rotation.z = timers.bell > 0 ? Math.sin(timers.bell * 40) * 0.03 * timers.bell : 0;
      // ---- the scales settle, the way scales do, for a long time
      const settling = timers.scale / 2.6;
      counter.beamPivot.rotation.z = scale.target + Math.cos(timers.scale * 7) * 0.13 * settling * settling;
      for (const pan of counter.pans) pan.rotation.z = -counter.beamPivot.rotation.z;
      // ---- the date stamp comes down and goes back up
      const stampPhase = timers.stamp / 0.6;
      const fall = stampPhase > 0 ? Math.sin(stampPhase * Math.PI) ** 0.7 : 0;
      counter.stamper.position.y = P.counter.height + 0.34 - fall * 0.235;
      if (!stampFell && stampPhase < 0.5) {
        stampFell = true;
        postmark();
      }
      // ---- the sounder clacks out the line
      const morse = timers.morse > 0 ? Math.sin(timers.morse * 15) + Math.sin(timers.morse * 37) > 0.25 : false;
      sorting.sounder.rotation.z = morse ? -0.07 : 0;
      sorting.keyLever.rotation.z = morse ? 0.028 : 0;
      // ---- the rack spins down
      spinAngle += spin * dt;
      spin *= Math.exp(-dt * 0.8);
      hall.spinner.rotation.y = spinAngle;
      // ---- the needle swings up and comes to rest; your box opens and swings to
      needleState.angle += (needleState.target - needleState.angle) * (1 - Math.exp(-dt * 2.6));
      hall.needleArm.rotation.z = -needleState.angle;
      const openTo = timers.box > 0 ? 1 : 0;
      boxOpen += (openTo - boxOpen) * (1 - Math.exp(-dt * 6));
      hall.myDoor.rotation.y = boxOpen * 1.95;
      // ---- the fire, the kettle's steam and the wireless's glow
      const flicker = Math.sin(t * 8) * 0.8 + Math.sin(t * 13) * 0.45 + Math.sin(t * 3.1) * 0.4;
      fireLight.intensity = (night ? 10 : 4) + flicker;
      M.fireGlow.emissiveIntensity = 1.7 + flicker * 0.32;
      const steamPos = steamGeo.attributes.position;
      for (let i = 0; i < 8; i++) {
        const f = (t * 0.26 + i / 8) % 1;
        steamPos.setXYZ(i, steamAt.x + f * 0.2 + Math.sin(f * 7 + i) * 0.04, steamAt.y + f * 0.9, steamAt.z + Math.sin(f * 5 + i * 2) * 0.05);
      }
      steamPos.needsUpdate = true;
      M.dial.emissiveIntensity += ((wireless ? 2.4 : 0.15) - M.dial.emissiveIntensity) * k;
      back.needle.position.x = F.wireless.x - 0.08 + Math.sin(t * 0.3) * 0.015;
      // ---- the exchange's lamps wink, busily when somebody's just listened in
      const board = timers.board > 0;
      M.boardLamp.emissiveIntensity = Math.sin(t * (board ? 11 : 1.4)) > (board ? -0.1 : 0.5) ? (board ? 3 : 1.6) : 0.2;
      // ---- dust turns in the sun
      dust.rotation.y = Math.sin(t * 0.04) * 0.04;
      dust.position.y = Math.sin(t * 0.3) * 0.07;
      // ---- evening: the sun goes, the sky cools, the pendants come up
      sun.intensity += ((night ? 0.3 : 5.2) - sun.intensity) * k;
      sun.color.lerp(night ? COOL : WARM, k);
      ambient.intensity += ((night ? 0.4 : 0.7) - ambient.intensity) * k;
      hallFill.intensity += ((night ? 1.2 : 3.5) - hallFill.intensity) * k;
      rearFill.intensity += ((night ? 1 : 4) - rearFill.intensity) * k;
      for (const lamp of lamps) lamp.light.intensity += ((night ? lamp.night : lamp.day) - lamp.light.intensity) * k;
      M.bulb.emissiveIntensity += ((night ? 2.8 : 0.5) - M.bulb.emissiveIntensity) * k;
      M.shadeUnder.emissiveIntensity += ((night ? 1.3 : 0.12) - M.shadeUnder.emissiveIntensity) * k;
      for (const material of shell.viewMaterials) material.color.lerp(night ? VIEW_NIGHT : VIEW_DAY, k);
      scene.background.lerp(night ? DUSK : DAY, k);
      dustMat.opacity = night ? 0.12 : 0.4;
    },
    diagnostics: () => ({
      postmarks,
      wireless,
      boxOpen: boxOpen > 0.5,
      spinning: spin > 0.2,
      loaf: back.loaf.visible,
    }),
  };
  return room;
}

const WARM = new T.Color("#ffdca6"),
  COOL = new T.Color("#9fb3e0"),
  DAY = new T.Color("#a9cbd6"),
  DUSK = new T.Color("#1d2c4a");
