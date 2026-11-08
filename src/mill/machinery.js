import * as T from "three";
import { MILL as K } from "./layout.js";

const TAU = Math.PI * 2;

// The mill's gearing, as a small water mill's is: the wheel's axle carries the
// pit wheel, whose face cogs turn the wallower at the foot of the upright shaft;
// the great spur wheel at the shaft's head turns the stone nut, and its quant
// drives the runner stone down in the tun. Over the tun the hopper feeds the
// shoe, which the damsel on the quant shakes. Each rigid train is merged into
// one mesh per material and none casts into the cached shadow map, so turning
// the mill is setting a few angles. A wheel's speed follows from its radius.
export function buildMachinery(parts, surfaces, keep) {
  const { b, rb, cyl, rod, group, mergeGroup, root } = parts;
  const { M } = surfaces;
  const H = K.ceiling,
    st = K.stones;

  /** A timber wheel about its local y axis: a segmented rim, crossing arms and a hub. */
  function wheel(p, { r, rim = 0.12, width = 0.16, arms = 2, hub = 0.22, y = 0 }) {
    const segments = Math.max(14, Math.round(r * 14)),
      step = TAU / segments;
    for (let i = 0; i < segments; i++) {
      const a = i * step + step / 2,
        seg = b(M.timber, Math.sin(a) * r, y, Math.cos(a) * r, 2 * r * Math.sin(step / 2) + 0.012, width, rim, p);
      seg.rotation.y = a;
    }
    for (let n = 0; n < arms; n++) {
      const a = (n / arms) * Math.PI;
      for (const off of [-hub * 0.5, hub * 0.5]) {
        const arm = b(M.timberDark, Math.cos(a) * off, y, -Math.sin(a) * off, 0.09, width * 0.8, 2 * r, p);
        arm.rotation.y = a;
      }
    }
    cyl(M.timberDark, 0, y, 0, hub, width + 0.06, hub, p, 8);
  }
  /** Cogs round a wheel about local y: `way` "out" (radial), or pegs "down" or "up" off its face. */
  function cogs(p, { r, count, y = 0, way = "out", length = 0.1 }) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU;
      if (way === "out") {
        const cog = b(M.cog, Math.sin(a) * (r + length / 2), y, Math.cos(a) * (r + length / 2), 0.07, 0.1, length, p);
        cog.rotation.y = a;
      } else b(M.cog, Math.sin(a) * r, y + ((way === "up" ? 1 : -1) * length) / 2, Math.cos(a) * r, 0.06, length, 0.06, p);
    }
  }

  // ------------------------------------------------------------- the pit wheel
  // On the axle by the west wall, half down in its pit, cogs on its east face.
  const pr = K.pitWheel.r;
  const pitMount = group(K.pitWheel.x, K.axle.y, K.axle.z);
  pitMount.rotation.z = -Math.PI / 2; // Local y is now world +x, along the axle.
  const pit = group(0, 0, 0, 0, pitMount);
  wheel(pit, { r: pr, rim: 0.16, width: 0.2, arms: 2, hub: 0.3 });
  cogs(pit, { r: pr - 0.02, count: 40, y: 0.1, way: "up", length: 0.14 });
  // Iron hoops round the hub, where the arms clasp the axle.
  for (const y of [-0.12, 0.12]) cyl(M.ironDark, 0, y, 0, 0.32, 0.04, 0.32, pit, 12);
  keep.add(pitMount);
  mergeGroup(pit);

  // ------------------------------------------------- the upright shaft's train
  const shaftMount = group(K.shaft.x, 0, K.shaft.z);
  const shaft = group(0, 0, 0, 0, shaftMount);
  // The shaft itself, from its footstep down in the pit to the beam overhead.
  const foot = -K.pit.depth;
  cyl(M.timberDark, 0, (foot + H - 0.4) / 2, 0, 0.17, H - 0.4 - foot, 0.17, shaft, 8);
  for (const y of [0.4, 2.2, K.spur.y - 0.35, K.wallower.y + 0.25]) cyl(M.ironDark, 0, y, 0, 0.19, 0.05, 0.19, shaft, 8);
  // The wallower, its pegs reaching down to the pit wheel's face.
  const wr = K.wallower.r;
  for (const y of [K.wallower.y, K.wallower.y + 0.14]) {
    const disc = cyl(M.timber, 0, y, 0, wr, 0.06, wr, shaft, 20);
    disc.castShadow = false;
  }
  cogs(shaft, { r: wr - 0.05, count: 14, y: K.wallower.y + 0.14, way: "down", length: 0.22 });
  // The great spur wheel, cogs outward.
  const sr = K.spur.r;
  wheel(shaft, { r: sr, y: K.spur.y, arms: 2, hub: 0.24 });
  cogs(shaft, { r: sr + 0.04, count: 48, y: K.spur.y, way: "out", length: 0.12 });
  keep.add(shaftMount);
  mergeGroup(shaft);
  // Its bearings: a stone footstep in the pit and a brass collar in the beam.
  b(M.stone, K.shaft.x, foot + 0.1, K.shaft.z, 0.5, 0.2, 0.5);
  cyl(M.brass, K.shaft.x, H - 0.44, K.shaft.z, 0.22, 0.08, 0.22, root, 12);

  // ---------------------------------------------------- the stones and the tun
  const nr = K.stoneNut.r;
  const nutMount = group(st.x, 0, st.z);
  const nut = group(0, 0, 0, 0, nutMount);
  cyl(M.timberDark, 0, K.spur.y, 0, nr, 0.16, nr, nut, 14);
  cogs(nut, { r: nr, count: 12, y: K.spur.y, way: "out", length: 0.09 });
  // The quant, down from the stone nut to the runner's eye, and the damsel on
  // it at the shoe's height: a square iron collar with knuckles.
  cyl(M.iron, 0, (st.height + 0.3 + K.spur.y) / 2, 0, 0.045, K.spur.y - st.height - 0.3, 0.045, nut, 8);
  b(M.iron, 0, st.height + 0.75, 0, 0.16, 0.2, 0.16, nut);
  for (const a of [0, Math.PI / 2]) {
    const knuckle = b(M.ironDark, 0, st.height + 0.75, 0, 0.26, 0.05, 0.05, nut);
    knuckle.rotation.y = a;
  }
  keep.add(nutMount);
  mergeGroup(nut);
  // The stone nut's bridge: a beam across from the summer beam to the wall plate.
  rb(M.beam, st.x, K.spur.y + 0.45, st.z, 0.24, 0.22, 2.2, 0.02);
  cyl(M.brass, st.x, K.spur.y + 0.28, st.z, 0.09, 0.12, 0.09, root, 10);
  // The tun: staved and hooped round the stones, on a low stone bed.
  b(M.stone, st.x, 0.06, st.z, 2 * st.r + 0.35, 0.12, 2 * st.r + 0.35);
  const staves = 22;
  for (let i = 0; i < staves; i++) {
    const a = (i / staves) * TAU,
      stave = b(M.oak, st.x + Math.sin(a) * st.r, 0.12 + (st.height - 0.12) / 2, st.z + Math.cos(a) * st.r, (TAU * st.r) / staves + 0.01, st.height - 0.12, 0.06);
    stave.rotation.y = a;
  }
  for (const y of [0.32, st.height - 0.12]) {
    const hoop = parts.torus(M.ironDark, st.x, y, st.z, st.r + 0.035, 0.018);
    hoop.rotation.x = Math.PI / 2;
  }
  // The lid, floury, with an iron ring round the runner's eye.
  cyl(M.oak, st.x, st.height, st.z, st.r + 0.03, 0.05, st.r + 0.03, root, 28);
  cyl(M.meal, st.x, st.height + 0.03, st.z, st.r - 0.3, 0.012, st.r - 0.3, root, 28).castShadow = false;
  parts.torus(M.ironDark, st.x, st.height + 0.04, st.z, 0.13, 0.02).rotation.x = Math.PI / 2;
  // The horse: four legs on the lid holding the hopper.
  const hx = st.x,
    hz = st.z - 0.32,
    hopTop = 2.15,
    hopBottom = 1.6;
  for (const [dx, dz] of [[-0.42, -0.36], [0.42, -0.36], [-0.42, 0.36], [0.42, 0.36]]) b(M.timber, hx + dx, (st.height + hopBottom + 0.1) / 2, hz + dz, 0.07, hopBottom + 0.1 - st.height, 0.07);
  // The hopper: an open timber funnel.
  const slope = (x, z, w, h, d, rx, rz) => {
    const side = b(M.pine, x, (hopTop + hopBottom) / 2, z, w, h, d);
    side.rotation.set(rx, 0, rz);
  };
  const lean = 0.42;
  slope(hx, hz - 0.3, 0.9, 0.62, 0.04, -lean, 0);
  slope(hx, hz + 0.3, 0.9, 0.62, 0.04, lean, 0);
  slope(hx - 0.3, hz, 0.04, 0.62, 0.9, 0, lean);
  slope(hx + 0.3, hz, 0.04, 0.62, 0.9, 0, -lean);
  // The top of what is in it, rising as you tip wheat in and sinking as the
  // stones take it, and widening with the funnel.
  const grain = group(hx, hopBottom + 0.04, hz);
  b(M.wheat, 0, 0, 0, 1, 0.03, 1, grain).castShadow = false;
  keep.add(grain);
  // The shoe, a trough from the hopper's mouth to the eye, which the damsel shakes.
  const shoe = group(hx, hopBottom - 0.06, hz + 0.05);
  const trough = b(M.pine, 0, 0, 0.18, 0.22, 0.04, 0.5, shoe);
  trough.rotation.x = 0.35;
  for (const sx of [-1, 1]) {
    const lip = b(M.pine, sx * 0.11, 0.04, 0.18, 0.02, 0.08, 0.5, shoe);
    lip.rotation.x = 0.35;
  }
  b(M.wheat, 0, 0.02, 0.12, 0.16, 0.02, 0.34, shoe).rotation.x = 0.35;
  keep.add(shoe);
  parts.mergeGroup(shoe);
  // The grain spout, down from a trap in the loft to the hopper.
  b(M.pine, hx, (hopTop + 0.25 + H) / 2, hz - 0.08, 0.24, H - hopTop - 0.25, 0.24);
  // The meal spout from the tun's side to the sack, and the sack on its hooks.
  const ms = K.mealSack,
    out = new T.Vector3(ms.x - st.x, 0, ms.z - st.z).normalize();
  rod(M.pine, [st.x + out.x * (st.r - 0.05), 0.92, st.z + out.z * (st.r - 0.05)], [ms.x - out.x * 0.1, 0.8, ms.z - out.z * 0.1], 0.07, 4);
  const hooks = rb(M.iron, ms.x, 0.86, ms.z, 0.5, 0.04, 0.04, 0.01);
  hooks.rotation.y = Math.atan2(out.x, out.z) + Math.PI / 2;
  for (const sx of [-1, 1]) rod(M.iron, [ms.x + sx * 0.22 * out.z, 0.86, ms.z - sx * 0.22 * out.x], [ms.x + sx * 0.22 * out.z, 0, ms.z - sx * 0.22 * out.x], 0.014, 4);
  const sack = group(ms.x, 0, ms.z);
  sack.rotation.y = Math.atan2(out.x, out.z);
  const sackBody = parts.box(M.sack, 0, 0.38, 0, 0.5, 0.76, 0.42, 0.1, sack);
  sackBody.castShadow = false;
  keep.add(sack);

  // ------------------------------------------------------------- the sluice
  // A long oak lever on an iron pivot, its rod running out through the wall to
  // the sluice gate.
  const sl = K.sluice,
    lx = -K.halfW + 0.3;
  b(M.ironDark, -K.halfW + 0.1, 0.95, sl.z, 0.2, 0.3, 0.3);
  rod(M.iron, [-K.halfW - 0.1, 0.95, sl.z], [lx, 0.95, sl.z], 0.03, 6);
  const lever = group(lx, 0.95, sl.z);
  b(M.oak, 0, 0.75, 0, 0.1, 1.7, 0.12, lever);
  b(M.leather, 0, 1.45, 0, 0.13, 0.3, 0.15, lever);
  b(M.iron, 0, 0, 0, 0.16, 0.16, 0.2, lever);
  keep.add(lever);
  mergeGroup(lever);
  // A notched quadrant on the wall the lever drops into.
  for (let i = 0; i < 5; i++) {
    const a = -0.5 + i * 0.25,
      notch = b(M.timberDark, -K.halfW + 0.04, 0.95 + Math.cos(a) * 1.25, sl.z + Math.sin(a) * 1.25, 0.06, 0.14, 0.08);
    notch.rotation.x = -a;
  }
  // Painted on the wall beside it.
  const stencil = surfaces.paint(512, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    surfaces.text(c, "SLUICE", w / 2, h * 0.32, 92, "rgba(70,55,40,0.85)", "'Arial Black', Arial, sans-serif");
    surfaces.text(c, "UP · RUN   DOWN · STOP", w / 2, h * 0.72, 40, "rgba(70,55,40,0.8)", "Georgia, serif");
  }, false);
  const sign = parts.mesh(new T.PlaneGeometry(0.9, 0.45), new T.MeshStandardMaterial({ map: stencil, transparent: true, roughness: 0.9, depthWrite: false }), -K.halfW + 0.01, 3.05, sl.z);
  sign.rotation.y = Math.PI / 2;
  sign.castShadow = false;

  // Speeds: each wheel turns as many times faster as its partner is larger.
  const toWallower = pr / wr,
    toNut = sr / nr;
  return {
    sack,
    grain,
    shoe,
    lever,
    hopper: { x: hx, z: hz, bottom: hopBottom + 0.04, top: hopTop - 0.05 },
    /** Sets every train's angle from the wheel's. */
    update(turn) {
      pit.rotation.y = -turn;
      shaft.rotation.y = turn * toWallower;
      nut.rotation.y = -turn * toWallower * toNut;
    },
    /** How fast the stones turn for a wheel turning at `rate`. */
    stoneRate: (rate) => rate * toWallower * toNut,
  };
}
