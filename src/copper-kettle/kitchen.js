import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { KETTLE_SIGNS as SIGNS } from "../content/copper-kettle.js";
import { FIXTURES as F, KETTLE as K } from "./layout.js";
import { paintClock } from "./tea-room.js";

const TAU = Math.PI * 2;
export const TRAY_SIZE = 12;

// The kitchen behind the tea room: the black range under the stack with its
// oven and a kettle on the hob, the scrubbed table where the scones are cut,
// copper pans on a rack over it, the butler sink under the rear window, the
// pantry shelves of jam, the cooling rack, Hazel's recipe book and the flour
// sacks. Returns the parts that move.
export function buildKitchen(parts, surfaces, keep) {
  const { b, rb, rod, cyl, orb, torus, turned, group, range, random, mergeGroup, mesh, root } = parts;
  const { M, cell, decal, disc, text, SERIF, HAND } = surfaces;
  const northFace = K.partition - K.wall / 2;

  // ----------------------------------------------------------------- the range
  const R = K.range,
    rw = R.maxX - R.minX,
    rx = (R.minX + R.maxX) / 2,
    rFront = northFace - R.depth,
    rz = (northFace + rFront) / 2,
    top = 1.0;
  b(M.iron, rx, top / 2, rz, rw, top, R.depth);
  rb(M.ironLight, rx, top + 0.02, rz - 0.02, rw + 0.06, 0.04, R.depth + 0.04, 0.01);
  b(M.iron, rx, 0.05, rFront - 0.02, rw + 0.04, 0.1, 0.06);
  // Two hotplates under their lids, and a towel on the brass rail.
  for (const x of [rx - 0.5, rx + 0.45]) {
    cyl(M.ironLight, x, top + 0.05, rz, 0.24, 0.04, 0.25, root, 24);
    turned(M.ironLight, [[0.24, 0], [0.22, 0.06], [0.1, 0.1], [0.001, 0.11]], x, top + 0.07, rz, 20);
    torus(M.brass, x, top + 0.2, rz, 0.04, 0.01).rotation.x = Math.PI / 2;
  }
  rod(M.brass, [R.minX + 0.05, 0.86, rFront - 0.1], [R.maxX - 0.05, 0.86, rFront - 0.1], 0.016, 8);
  for (const x of [R.minX + 0.08, R.maxX - 0.08]) rod(M.brass, [x, 0.86, rFront - 0.1], [x, 0.86, rFront], 0.014, 6);
  const towel = b(M.gingham, rx + 0.55, 0.68, rFront - 0.1, 0.42, 0.36, 0.015);
  towel.castShadow = false;
  // The oven door, hinged along its foot, and the scones rising behind it.
  const oven = { x: rx - 0.45, y: 0.5 };
  const glow = b(M.ovenGlow, oven.x, oven.y, rFront + 0.25, 0.6, 0.5, 0.04);
  glow.castShadow = false;
  b(M.soot, oven.x, oven.y, rFront + 0.1, 0.66, 0.56, 0.24);
  b(M.ironLight, oven.x, oven.y - 0.16, rFront + 0.08, 0.6, 0.015, 0.24);
  for (let i = 0; i < 6; i++) {
    const sx = oven.x - 0.2 + (i % 3) * 0.2,
      sz = rFront + 0.04 + Math.floor(i / 3) * 0.1;
    cyl(M.scone, sx, oven.y - 0.13, sz, 0.045, 0.05, 0.04, root, 10);
  }
  const ovenDoor = group(oven.x, oven.y - 0.3, rFront - 0.015, Math.PI);
  rb(M.iron, 0, 0.3, 0, 0.66, 0.6, 0.05, 0.01, ovenDoor);
  rb(M.ironLight, 0, 0.3, 0.03, 0.5, 0.44, 0.02, 0.008, ovenDoor);
  rod(M.brass, [-0.24, 0.52, 0.07], [0.24, 0.52, 0.07], 0.016, 8, ovenDoor);
  for (const x of [-0.24, 0.24]) rod(M.brass, [x, 0.52, 0.07], [x, 0.52, 0.025], 0.012, 6, ovenDoor);
  keep.add(ovenDoor);
  mergeGroup(ovenDoor);
  // The firebox door and the warming oven.
  rb(M.iron, rx + 0.45, 0.62, rFront - 0.015, 0.5, 0.5, 0.05, 0.01);
  for (let i = 0; i < 5; i++) b(M.ironLight, rx + 0.3 + i * 0.075, 0.62, rFront - 0.045, 0.03, 0.3, 0.02);
  rb(M.iron, rx + 0.45, 0.22, rFront - 0.015, 0.5, 0.22, 0.05, 0.01);
  orb(M.brass, rx + 0.45, 0.22, rFront - 0.05, 0.025);
  // A blue enamel kettle on the hob, which keeps a curl of steam going.
  const kettle = group(rx + 0.45, top + 0.07, rz, 0.4);
  turned(M.chinaBlue, [[0.001, 0], [0.15, 0], [0.16, 0.12], [0.1, 0.2], [0.04, 0.22], [0.001, 0.23]], 0, 0, 0, 20, kettle);
  parts.tube(M.chinaBlue, [[-0.14, 0.06, 0], [-0.21, 0.13, 0], [-0.25, 0.2, 0]], 0.02, kettle);
  torus(M.iron, 0, 0.22, 0, 0.1, 0.01, kettle, Math.PI).rotation.y = Math.PI / 2;
  const steamAt = new T.Vector3(-0.25, 0.21, 0);
  kettle.updateMatrixWorld(true);
  kettle.localToWorld(steamAt);
  // On the shelf over the range: tins, a salt box and a pair of candlesticks.
  const shelfY = 2.0;
  for (const [i, x] of [R.minX + 0.2, R.minX + 0.5, R.minX + 0.8, R.maxX - 0.8, R.maxX - 0.5].entries())
    cyl(parts.mat(["#7a2620", "#2f4b58", "#c79c3a", "#3f6a3d", "#efe6d0"][i], 0.4, 0.3), x, shelfY + 0.15, northFace - 0.32, 0.1, 0.26, 0.1, root, 14);
  // The kitchen clock on the stack.
  const clock = { x: F.clock.x, y: F.clock.y, z: F.clock.z };
  cyl(M.oakDark, clock.x, clock.y, clock.z + 0.02, 0.32, 0.05, 0.32, root, 28).rotation.x = Math.PI / 2;
  const face = cell(256, 256, (c, w) => paintClock(c, w, SERIF));
  disc(face, clock.x, clock.y, clock.z - 0.01, 0.28).rotation.y = Math.PI;
  const hands = group(clock.x, clock.y, clock.z - 0.02, Math.PI);
  const minute = group(0, 0, 0.01, 0, hands),
    hour = group(0, 0, 0.015, 0, hands);
  b(M.black, 0, 0.1, 0, 0.012, 0.22, 0.006, minute);
  b(M.black, 0, 0.065, 0, 0.018, 0.14, 0.006, hour);
  orb(M.brass, 0, 0, 0.02, 0.014, 0.014, 0.01, hands);
  keep.add(hands);

  // ---------------------------------------------------------------- the table
  const tb = K.table,
    TH = tb.height;
  for (const lx of [-1, 1])
    for (const lz of [-1, 1]) {
      const leg = turned(M.pine, [[0.05, 0], [0.04, 0.2], [0.05, 0.3], [0.04, 0.95], [0.055, 1.0], [0.055, TH - 0.05]], tb.x + lx * (tb.w / 2 - 0.12), 0, tb.z + lz * (tb.d / 2 - 0.12), 10);
      void leg;
    }
  b(M.pine, tb.x, TH - 0.12, tb.z, tb.w - 0.2, 0.14, tb.d - 0.2);
  rb(M.pine, tb.x, TH - 0.025, tb.z, tb.w, 0.05, tb.d, 0.012);
  b(M.pine, tb.x, 0.22, tb.z, tb.w - 0.24, 0.04, 0.06);
  // A floured slab of dough, the cutter, the rolling pin and the mixing bowl.
  const doughAt = { x: tb.x - 0.35, z: tb.z };
  for (let i = 0; i < 9; i++) {
    const flourDust = cyl(M.flour, doughAt.x + range(-0.35, 0.35), TH + 0.002, doughAt.z + range(-0.3, 0.3), range(0.06, 0.16), 0.002, range(0.06, 0.16), root, 10);
    flourDust.castShadow = false;
  }
  const dough = cyl(M.dough, doughAt.x, TH + 0.02, doughAt.z, 0.3, 0.04, 0.32, root, 24);
  dough.scale.z = 0.75;
  for (let i = 0; i < 3; i++) {
    const hole = cyl(M.pine, doughAt.x - 0.12 + i * 0.12, TH + 0.041, doughAt.z + 0.08, 0.05, 0.002, 0.05, root, 12);
    hole.castShadow = false;
  }
  const cutter = group(doughAt.x + 0.12, TH + 0.04, doughAt.z - 0.08);
  cyl(M.ironLight, 0, 0.025, 0, 0.055, 0.05, 0.055, cutter, 14);
  torus(M.ironLight, 0, 0.055, 0, 0.055, 0.006, cutter).rotation.x = Math.PI / 2;
  keep.add(cutter);
  mergeGroup(cutter);
  const pin = cyl(M.pine, doughAt.x - 0.1, TH + 0.045, doughAt.z - 0.32, 0.04, 0.42, 0.04, root, 12);
  pin.rotation.set(0, 0.2, Math.PI / 2);
  for (const sxs of [-1, 1]) {
    const handle = cyl(M.pine, doughAt.x - 0.1 + sxs * 0.27 * Math.cos(0.2), TH + 0.045, doughAt.z - 0.32 - sxs * 0.27 * Math.sin(0.2), 0.018, 0.12, 0.018, root, 8);
    handle.rotation.set(0, 0.2, Math.PI / 2);
  }
  turned(M.enamel, [[0.001, 0], [0.12, 0], [0.2, 0.08], [0.24, 0.17], [0.235, 0.18]], tb.x - 1.1, TH, tb.z + 0.15, 20);
  torus(M.enamelRim, tb.x - 1.1, TH + 0.18, tb.z + 0.15, 0.235, 0.008).rotation.x = Math.PI / 2;
  cyl(M.dough, tb.x - 1.1, TH + 0.13, tb.z + 0.15, 0.19, 0.03, 0.19, root, 18);
  rod(parts.mat("#c9a271", 0.8), [tb.x - 1.05, TH + 0.15, tb.z + 0.15], [tb.x - 0.95, TH + 0.4, tb.z + 0.05], 0.012, 6);
  // The baking tray the cut scones go on.
  const trayAt = { x: F.scones.x + 0.18, z: tb.z };
  rb(M.ironLight, trayAt.x, TH + 0.008, trayAt.z, 0.62, 0.016, 0.46, 0.006);
  const sconeParts = Array.from({ length: TRAY_SIZE }, (_, i) => {
    const sx = trayAt.x - 0.225 + (i % 4) * 0.15,
      sz = trayAt.z - 0.15 + Math.floor(i / 4) * 0.15;
    const g = new T.CylinderGeometry(0.052, 0.058, 0.05, 12);
    g.translate(sx, TH + 0.041, sz);
    return g;
  });
  const sconeGeometry = (n) => (n ? mergeGeometries(sconeParts.slice(0, n)) : new T.BufferGeometry());
  const tray = mesh(sconeGeometry(3), M.dough);
  tray.castShadow = false;
  keep.add(tray);
  // Stools at either end.
  for (const s of K.stools) {
    for (const a of [0.4, 2.0, 3.6, 5.2]) rod(M.pine, [s.x + Math.cos(a) * 0.08, 0.68, s.z + Math.sin(a) * 0.08], [s.x + Math.cos(a) * 0.17, 0, s.z + Math.sin(a) * 0.17], 0.02, 5);
    cyl(M.pine, s.x, 0.7, s.z, 0.2, 0.05, 0.2, root, 16);
  }

  // ---------------------------------------------- the copper pans over the table
  const rackY = 3.5;
  rod(M.iron, [tb.x - 1.2, rackY, tb.z], [tb.x + 1.2, rackY, tb.z], 0.022, 6);
  for (const x of [tb.x - 1.1, tb.x + 1.1]) rod(M.iron, [x, rackY, tb.z], [x, K.ceiling, tb.z], 0.01, 4);
  for (let i = 0; i < 7; i++) {
    const x = tb.x - 1.0 + i * 0.33,
      r = 0.13 - i * 0.009,
      drop = 0.3 + r;
    rod(M.iron, [x, rackY, tb.z], [x, rackY - 0.14, tb.z], 0.008, 4);
    const pan = group(x, rackY - 0.14, tb.z, 0);
    rod(M.copperDark, [0, 0, 0], [0, -0.3, 0], 0.012, 6, pan);
    const potBody = cyl(M.copper, 0, -drop, 0, r, r * 0.9, r, pan, 20);
    potBody.rotation.x = Math.PI / 2;
    cyl(M.copperDark, 0, -drop, -r * 0.45 - 0.002, r * 0.98, 0.004, r * 0.98, pan, 20).rotation.x = Math.PI / 2;
  }
  // Herbs drying over the window, and onions on a string.
  for (let i = 0; i < 5; i++) {
    const x = K.rearWindow.x[0] + 0.25 + i * 0.48;
    rod(M.linen, [x, 3.62, K.back + 0.3], [x, 3.4, K.back + 0.3], 0.005, 3);
    for (let k = 0; k < 5; k++) orb(i % 2 ? M.leafDark : M.lavender, x + range(-0.05, 0.05), 3.3 - k * 0.05, K.back + 0.3 + range(-0.04, 0.04), 0.05, 0.08, 0.05);
  }

  // ------------------------------------------------------------ the sink run
  const S = K.sinkRun,
    sw = S.maxX - S.minX,
    sx = (S.minX + S.maxX) / 2,
    sz = K.back + S.depth / 2,
    sh = S.height;
  b(M.cream, sx, (sh - 0.06) / 2, sz, sw, sh - 0.06, S.depth);
  for (let i = 0; i < 4; i++) {
    const x = S.minX + (i + 0.5) * (sw / 4);
    rb(M.sage, x, 0.58, K.back + S.depth + 0.004, sw / 4 - 0.1, 0.86, 0.02, 0.008);
    orb(M.brass, x + (i % 2 ? -0.32 : 0.32), 0.8, K.back + S.depth + 0.03, 0.02);
  }
  rb(M.oak, sx, sh - 0.03, sz, sw + 0.04, 0.06, S.depth + 0.04, 0.012);
  // The butler sink, deep and white, sunk into the worktop under the window.
  const sinkX = F.sink.x,
    sinkW = 0.9,
    sinkD = 0.58,
    sinkZ = K.back + 0.34;
  b(M.china, sinkX, sh - 0.12, sinkZ - sinkD / 2 + 0.02, sinkW, 0.3, 0.04);
  b(M.china, sinkX, sh - 0.12, sinkZ + sinkD / 2 - 0.02, sinkW, 0.3, 0.04);
  for (const sxs of [-1, 1]) b(M.china, sinkX + sxs * (sinkW / 2 - 0.02), sh - 0.12, sinkZ, 0.04, 0.3, sinkD);
  b(M.china, sinkX, sh - 0.26, sinkZ, sinkW, 0.03, sinkD);
  const water = b(parts.mat("#b9cfd3", 0.05, 0.1), sinkX, sh - 0.12, sinkZ, sinkW - 0.08, 0.005, sinkD - 0.08);
  water.castShadow = false;
  for (const sxs of [-1, 1]) {
    const tx = sinkX + sxs * 0.15;
    rod(M.brass, [tx, sh, K.back + 0.06], [tx, sh + 0.28, K.back + 0.06], 0.018, 8);
    rod(M.brass, [tx, sh + 0.28, K.back + 0.06], [tx, sh + 0.24, K.back + 0.2], 0.014, 8);
    cyl(M.china, tx, sh + 0.32, K.back + 0.06, 0.03, 0.03, 0.03, root, 8);
  }
  // The drainer: a plate rack and cups upside down to dry.
  const drainX = sinkX + 0.85;
  for (let i = 0; i < 6; i++) {
    const plate = cyl([M.china, M.chinaRose, M.chinaBlue][i % 3], drainX - 0.2 + i * 0.08, sh + 0.14, K.back + 0.3, 0.13, 0.012, 0.13, root, 16);
    plate.rotation.z = Math.PI / 2;
  }
  for (const x of [drainX - 0.26, drainX + 0.26]) b(M.pine, x, sh + 0.08, K.back + 0.3, 0.03, 0.16, 0.3);
  for (let i = 0; i < 3; i++) {
    const cup = turned([M.chinaRose, M.chinaGreen, M.chinaYellow][i], [[0.001, 0], [0.04, 0], [0.055, 0.02], [0.06, 0.075]], sinkX - 0.75 + i * 0.16, sh + 0.075, K.back + 0.32 + (i % 2) * 0.12, 12);
    cup.rotation.x = Math.PI;
  }
  // A geranium and a jam jar of mint on the sill.
  const sillY = K.rearWindow.y[0] - 0.02;
  cyl(M.terracotta, F.garden.x - 0.7, sillY + 0.09, K.back + 0.12, 0.08, 0.16, 0.1, root, 12);
  for (let i = 0; i < 5; i++) orb(M.leaf, F.garden.x - 0.7 + range(-0.08, 0.08), sillY + 0.25 + range(0, 0.06), K.back + 0.12 + range(-0.04, 0.04), 0.06, 0.04, 0.06);
  cyl(M.dome, F.garden.x + 0.7, sillY + 0.08, K.back + 0.12, 0.05, 0.14, 0.05, root, 12).castShadow = false;
  for (let i = 0; i < 6; i++) orb(M.leafDark, F.garden.x + 0.7 + range(-0.05, 0.05), sillY + 0.2 + range(0, 0.1), K.back + 0.12 + range(-0.04, 0.04), 0.035, 0.025, 0.035);

  // --------------------------------------------------------- the pantry shelves
  const P = K.pantry,
    pz = (P.minZ + P.maxZ) / 2,
    plen = P.maxZ - P.minZ,
    px = -K.halfW + P.depth / 2;
  for (const z of [P.minZ + 0.03, P.maxZ - 0.03]) b(M.pine, px, 1.9, z, P.depth, 3.8, 0.05);
  b(M.pine, -K.halfW + 0.02, 1.9, pz, 0.03, 3.8, plen);
  const jamTones = ["#a0212e", "#5c2a4a", "#9cae5a", "#3a1f2e", "#d39a3c", "#efd36a", "#d9822b", "#c2506b", "#6b2a4a"];
  const jamLabels = SIGNS.jams.map((name) =>
    cell(180, 110, (c, w, h) => {
      c.fillStyle = "#f6efdc";
      c.fillRect(0, 0, w, h);
      c.strokeStyle = "#a0212e";
      c.lineWidth = 3;
      c.strokeRect(6, 6, w - 12, h - 12);
      text(c, name, w / 2, h / 2 - 8, 26, "#3a2a1c", { font: HAND, max: w - 20 });
      text(c, `’${String(20 + Math.floor(random() * 6)).padStart(2, "0")}`, w / 2, h / 2 + 26, 18, "#7a6a58", { font: SERIF });
    }),
  );
  const levels = [0.4, 1.1, 1.8, 2.5, 3.2];
  for (const [li, y] of levels.entries()) {
    b(M.pine, px, y, pz, P.depth, 0.04, plen - 0.06);
    if (li === 0) {
      // Flour and sugar bins, and a crock of eggs.
      for (const [i, label] of ["FLOUR", "SUGAR", "OATS"].entries()) {
        const z = P.minZ + 0.45 + i * 0.75;
        cyl(M.enamel, px, y + 0.27, z, 0.2, 0.5, 0.2, root, 18);
        cyl(M.enamelRim, px, y + 0.54, z, 0.21, 0.04, 0.21, root, 18);
        const tag = cell(160, 60, (c, w, h) => {
          c.fillStyle = "#efeadc";
          c.fillRect(0, 0, w, h);
          text(c, label, w / 2, h / 2, 34, "#2f4b58", { font: SERIF, weight: "bold" });
        });
        decal(tag, px + 0.205, y + 0.3, z, 0.24, 0.09, Math.PI / 2);
      }
      turned(M.wicker, [[0.001, 0], [0.18, 0], [0.22, 0.14]], px, y + 0.02, P.maxZ - 0.4, 16);
      for (let i = 0; i < 7; i++) orb(parts.mat("#e8d3b0", 0.6), px + range(-0.1, 0.1), y + 0.13, P.maxZ - 0.4 + range(-0.1, 0.1), 0.045, 0.06, 0.045);
      continue;
    }
    // Jam, row upon row, each with a gingham hat and a label.
    let z = P.minZ + 0.2,
      k = li * 3;
    while (z < P.maxZ - 0.15) {
      const tone = parts.mat(jamTones[k % jamTones.length], 0.18),
        h = li === 4 ? 0.22 : 0.17;
      cyl(tone, px + 0.05, y + h / 2 + 0.02, z, 0.08, h, 0.08, root, 12);
      cyl(M.gingham, px + 0.05, y + h + 0.035, z, 0.1, 0.02, 0.095, root, 12);
      decal(jamLabels[k % jamLabels.length], px + 0.132, y + h / 2 + 0.02, z, 0.11, 0.07, Math.PI / 2);
      z += 0.22;
      k++;
    }
  }

  // ---------------------------------------------------------- the cooling rack
  const Rk = K.rack,
    rkw = Rk.maxX - Rk.minX,
    rkx = (Rk.minX + Rk.maxX) / 2,
    rkz = K.back + Rk.depth / 2;
  for (const x of [Rk.minX + 0.1, Rk.maxX - 0.1]) b(M.pine, x, Rk.height / 2, rkz, 0.08, Rk.height, Rk.depth - 0.1);
  b(M.pine, rkx, 0.3, rkz, rkw - 0.1, 0.04, Rk.depth - 0.1);
  rb(M.pine, rkx, Rk.height - 0.03, rkz, rkw, 0.06, Rk.depth, 0.012);
  for (let i = 0; i < 4; i++) cyl(M.sack, Rk.minX + 0.45 + i * 0.36, 0.5, rkz, 0.15, 0.36, 0.15, root, 14);
  // Two wire racks of scones and a lattice pie, and a bread crock.
  for (const [ri, cx] of [rkx - 0.7, rkx + 0.15].entries()) {
    const ry = Rk.height + 0.05;
    for (const lx of [-0.28, 0.28]) b(M.ironLight, cx + lx, ry - 0.02, rkz, 0.01, 0.04, 0.42);
    for (let i = 0; i < 9; i++) b(M.ironLight, cx, ry, rkz - 0.2 + i * 0.05, 0.58, 0.006, 0.006);
    if (ri === 0)
      for (let i = 0; i < 8; i++) {
        const sxs = cx - 0.21 + (i % 4) * 0.14,
          szs = rkz - 0.08 + Math.floor(i / 4) * 0.15;
        cyl(M.scone, sxs, ry + 0.028, szs, 0.052, 0.05, 0.058, root, 12);
        cyl(M.sconeTop, sxs, ry + 0.055, szs, 0.048, 0.008, 0.052, root, 12);
      }
    else {
      cyl(M.crust, cx, ry + 0.03, rkz, 0.22, 0.05, 0.2, root, 24);
      for (let i = 0; i < 5; i++) {
        b(M.sconeTop, cx - 0.16 + i * 0.08, ry + 0.06, rkz, 0.025, 0.01, 0.38);
        b(M.sconeTop, cx, ry + 0.065, rkz - 0.16 + i * 0.08, 0.38, 0.01, 0.025);
      }
    }
  }
  turned(M.terracotta, [[0.001, 0], [0.2, 0], [0.24, 0.3], [0.22, 0.34]], Rk.maxX - 0.4, Rk.height, rkz, 18);
  cyl(M.cream, Rk.maxX - 0.4, Rk.height + 0.36, rkz, 0.23, 0.04, 0.23, root, 18);
  for (let i = 0; i < 5; i++) orb(parts.mat("#efd36a", 0.6), Rk.minX + 0.3 + range(-0.08, 0.08), Rk.height + 0.06, rkz + range(-0.12, 0.12), 0.055, 0.045, 0.045);

  // ----------------------------------------------------- the recipe book's stand
  const rs = K.recipeStand,
    rsx = K.halfW - rs.depth / 2,
    rsz = (rs.minZ + rs.maxZ) / 2;
  b(M.pine, rsx, 0.6, rsz, rs.depth, 1.2, rs.maxZ - rs.minZ);
  rb(M.pine, rsx, 1.21, rsz, rs.depth + 0.04, 0.04, rs.maxZ - rs.minZ + 0.04, 0.01);
  const stand = group(rsx, 1.24, rsz, -Math.PI / 2);
  b(M.oakDark, 0, 0.14, 0.02, 0.52, 0.3, 0.02, stand).rotation.x = -0.45;
  const page = cell(560, 360, (c, w, h) => {
    c.fillStyle = "#f3e9cf";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "rgba(160,33,46,0.18)";
    c.beginPath();
    c.ellipse(w * 0.78, h * 0.75, 40, 26, 0.4, 0, TAU);
    c.fill();
    c.fillStyle = "rgba(80,60,40,0.35)";
    c.fillRect(w / 2 - 2, 0, 4, h);
    text(c, "Scones", w / 4, 46, 36, "#5c2a2a", { font: HAND });
    text(c, "Victoria Sponge", (3 * w) / 4, 46, 30, "#5c2a2a", { font: HAND });
    const lines = [["8 oz flour", "4 eggs, weighed"], ["2 oz butter", "the same of butter"], ["a pinch of salt", "the same of sugar"], ["¼ pint milk", "the same of flour"], ["a light hand", "jam! cream!"]];
    lines.forEach(([l, r], i) => {
      text(c, l, w / 4, 100 + i * 46, 24, "#3a2a1c", { font: HAND });
      text(c, r, (3 * w) / 4, 100 + i * 46, 24, "#3a2a1c", { font: HAND });
    });
  });
  decal(page, 0, 0.17, 0.045, 0.5, 0.32, 0, stand, -0.45);
  b(M.ledger, 0, 0.17, 0.035, 0.54, 0.34, 0.02, stand).rotation.x = -0.45;

  // ------------------------------------------------------------ the flour sacks
  const sk = K.sacks;
  for (const [i, [x, z, h]] of [
    [sk.minX + 0.3, sk.minZ + 0.28, 0.75],
    [sk.maxX - 0.32, sk.minZ + 0.3, 0.68],
    [sk.minX + 0.52, sk.maxZ - 0.25, 0.62],
  ].entries()) {
    rb(M.sack, x, h / 2, z, 0.5, h, 0.42, 0.12).rotation.y = (i - 1) * 0.3;
    orb(M.sack, x, h + 0.02, z, 0.16, 0.08, 0.13);
    rod(M.linen, [x - 0.08, h + 0.02, z], [x + 0.08, h + 0.02, z], 0.012, 4);
  }
  const stencil = cell(200, 120, (c, w, h) => {
    c.fillStyle = "#c6b08a";
    c.fillRect(0, 0, w, h);
    text(c, "WILLOWMERE", w / 2, 38, 26, "#5a4632", { font: SERIF, weight: "bold" });
    text(c, "MILL", w / 2, 82, 40, "#5a4632", { font: SERIF, weight: "bold" });
  });
  decal(stencil, sk.minX + 0.3, 0.42, sk.minZ + 0.07, 0.36, 0.22, Math.PI - 0.3);

  return { ovenDoor, tray, sconeGeometry, steamAt, minute, hour, cutter };
}
