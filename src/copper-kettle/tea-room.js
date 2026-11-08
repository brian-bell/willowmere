import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { KETTLE_SIGNS as SIGNS } from "../content/copper-kettle.js";
import { FIXTURES as F, KETTLE as K, teaChairs } from "./layout.js";

const TAU = Math.PI * 2;

// The tea room: the sage-fronted counter with its till, bell, cake under a
// dome and Finn's loaf, the shelves of caddies and teapots and the copper urn
// behind it, the dresser of odd cups, four tea tables under gingham, the tea
// laid for one in the bay with Crumpet asleep beside it, the fireside with its
// armchairs, rug, fire and the copper kettle on the mantel, the gramophone,
// the photographs and the chalked menu. Returns the parts that move.
export function buildTeaRoom(parts, surfaces, keep) {
  const { b, rb, rod, cyl, orb, torus, turned, group, range, random, tube, mergeGroup, mesh, root } = parts;
  const { M, cell, decal, disc, text, SERIF, HAND } = surfaces;
  const C = K.counter,
    H = C.height,
    southFace = K.partition + K.wall / 2,
    TH = K.tableHeight;
  const china = [M.china, M.chinaRose, M.chinaBlue, M.chinaGreen, M.chinaYellow];

  // ------------------------------------------------------------- small china
  /** A cup on its saucer at (x, y, z), its handle turned to `turn`. */
  function cupAndSaucer(x, y, z, cup = M.china, turn = 0, p = root) {
    const g = group(x, y, z, turn, p);
    cyl(cup, 0, 0.008, 0, 0.1, 0.016, 0.115, g, 16);
    turned(cup, [[0.001, 0], [0.045, 0], [0.06, 0.02], [0.068, 0.085], [0.064, 0.09]], 0, 0.016, 0, 14, g);
    torus(cup, 0.075, 0.07, 0, 0.022, 0.007, g, Math.PI * 1.3).rotation.z = -Math.PI * 0.65;
    return g;
  }
  /** A round-bellied teapot, spout to local -x. */
  function teapot(x, y, z, body, turn = 0, p = root) {
    const g = group(x, y, z, turn, p);
    turned(body, [[0.001, 0], [0.09, 0], [0.135, 0.06], [0.14, 0.11], [0.12, 0.17], [0.07, 0.2], [0.001, 0.205]], 0, 0, 0, 16, g);
    orb(body, 0, 0.215, 0, 0.022, 0.02, 0.022, g);
    tube(body, [[-0.11, 0.06, 0], [-0.17, 0.1, 0], [-0.21, 0.17, 0], [-0.235, 0.2, 0]], 0.016, g);
    torus(body, 0.15, 0.115, 0, 0.055, 0.011, g, Math.PI).rotation.z = -Math.PI / 2;
    return g;
  }
  /** Cut flowers in a little jug. */
  function posy(x, y, z, jug, colors) {
    turned(jug, [[0.001, 0], [0.045, 0], [0.055, 0.05], [0.035, 0.1], [0.045, 0.12]], x, y, z, 12);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU,
        r = range(0.02, 0.06),
        h = range(0.18, 0.26);
      rod(M.leafDark, [x, y + 0.08, z], [x + Math.cos(a) * r, y + h, z + Math.sin(a) * r], 0.004, 3);
      orb(colors[i % colors.length], x + Math.cos(a) * r, y + h, z + Math.sin(a) * r, 0.026, 0.02, 0.026);
    }
  }

  // ----------------------------------------------------------------- the counter
  const front = C.maxZ,
    cw = C.maxX - C.minX,
    cmid = (C.minX + C.maxX) / 2;
  b(M.sage, cmid, H / 2, (C.minZ + front - 0.05) / 2, cw, H, front - C.minZ - 0.05);
  // Tongue-and-groove front, plinth and an oak top.
  for (let x = C.minX + 0.12; x < C.maxX - 0.05; x += 0.14) b(M.sageDark, x, H / 2 - 0.05, front - 0.04, 0.012, H - 0.32, 0.012);
  b(M.oakDark, cmid, 0.08, front - 0.03, cw, 0.16, 0.04);
  rb(M.oak, cmid, H + 0.035, (C.minZ + front) / 2 + 0.03, cw + 0.08, 0.07, front - C.minZ + 0.1, 0.02);
  // The end panel by the gap.
  rb(M.sage, C.maxX - 0.02, H / 2, (C.minZ + front) / 2, 0.06, H, front - C.minZ, 0.01);
  // Shelves on Hazel's side, with tins and stacked plates.
  for (const y of [0.35, 0.85]) b(M.oak, cmid, y, C.minZ + 0.2, cw - 0.1, 0.03, 0.36);
  for (let x = C.minX + 0.3; x < C.maxX - 0.3; x += range(0.32, 0.5)) {
    if (random() < 0.5) for (let s = 0; s < 6; s++) cyl(M.china, x, 0.39 + s * 0.022, C.minZ + 0.2, 0.13, 0.016, 0.14, root, 16);
    else cyl(china[Math.floor(random() * 5)], x, 0.97, C.minZ + 0.2, 0.08, 0.22, 0.08, root, 10);
  }

  // The till: brass, with keys in rows and a drawer that springs out.
  const till = group(F.till.x, H + 0.07, F.till.z, 0);
  rb(M.brass, 0, 0.14, -0.05, 0.46, 0.28, 0.4, 0.02, till);
  const keys = rb(M.brass, 0, 0.32, 0.03, 0.46, 0.08, 0.32, 0.02, till);
  keys.rotation.x = 0.5;
  for (let row = 0; row < 3; row++)
    for (let i = 0; i < 5; i++)
      cyl(M.cream, -0.16 + i * 0.08, 0.36 + row * 0.035, 0.12 - row * 0.06, 0.022, 0.03, 0.022, till, 8).rotation.x = 0.5;
  rb(M.brass, 0, 0.5, -0.12, 0.3, 0.16, 0.06, 0.015, till);
  const tillFlag = cell(256, 96, (c, w, h) => {
    c.fillStyle = "#f3ead2";
    c.fillRect(0, 0, w, h);
    text(c, "NO SALE", w / 2, h / 2, 46, "#3b2c20", { font: SERIF, weight: "bold" });
  });
  decal(tillFlag, 0, 0.5, -0.088, 0.24, 0.09, 0, till);
  const drawer = group(0, 0.04, 0.12, 0, till);
  rb(M.brass, 0, 0, 0, 0.44, 0.08, 0.1, 0.012, drawer);
  orb(M.brass, 0, 0, 0.06, 0.02, 0.02, 0.02, drawer);
  keep.add(till);
  mergeGroup(till, new Set([drawer]));
  mergeGroup(drawer);

  // The counter bell.
  turned(M.brass, [[0.001, 0], [0.07, 0], [0.07, 0.012], [0.06, 0.03], [0.035, 0.07], [0.001, 0.08]], F.bell.x, H + 0.07, F.bell.z, 16);
  rod(M.iron, [F.bell.x, H + 0.15, F.bell.z], [F.bell.x, H + 0.18, F.bell.z], 0.008, 5);

  // The Victoria sponge on a stand, under a glass dome, and the cake knife.
  const stand = { x: F.cake.x, y: H + 0.07, z: F.cake.z };
  turned(M.china, [[0.001, 0], [0.1, 0], [0.1, 0.012], [0.03, 0.03], [0.025, 0.14], [0.2, 0.15], [0.21, 0.165], [0.001, 0.165]], stand.x, stand.y, stand.z, 24);
  const cakeTop = stand.y + 0.165;
  const wedges = cakeWedges(T, 0.17, 8),
    cake = mesh(mergeGeometries(wedges), M.cake, stand.x, cakeTop, stand.z);
  cake.castShadow = false;
  keep.add(cake);
  const dome = turned(M.dome, [[0.215, 0], [0.215, 0.18], [0.19, 0.26], [0.12, 0.31], [0.001, 0.33]], stand.x, cakeTop - 0.005, stand.z, 28);
  dome.castShadow = dome.receiveShadow = false;
  orb(M.dome, stand.x, cakeTop + 0.345, stand.z, 0.025).castShadow = false;
  b(M.iron, stand.x + 0.28, H + 0.075, stand.z + 0.12, 0.26, 0.008, 0.03).rotation.y = 0.4;
  // A three-tier stand of scones and sandwiches beside it.
  const tier = { x: -5.1, z: -0.7 };
  rod(M.gold, [tier.x, H + 0.07, tier.z], [tier.x, H + 0.62, tier.z], 0.008, 6);
  [[0.19, 0.08], [0.15, 0.26], [0.11, 0.44]].forEach(([r, y], i) => {
    cyl(M.china, tier.x, H + y, tier.z, r, 0.012, r, root, 20);
    const n = i === 2 ? 4 : 5;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + i,
        px = tier.x + Math.cos(a) * r * 0.6,
        pz = tier.z + Math.sin(a) * r * 0.6;
      if (i === 1) b(M.linen, px, H + y + 0.03, pz, 0.08, 0.04, 0.05).rotation.y = a;
      else {
        cyl(M.scone, px, H + y + 0.028, pz, 0.038, 0.045, 0.034, root, 10);
        cyl(M.sconeTop, px, H + y + 0.053, pz, 0.034, 0.008, 0.03, root, 10);
      }
    }
  });
  orb(M.gold, tier.x, H + 0.65, tier.z, 0.02);
  // Finn's loaf on the bread board, once Hazel has had one.
  rb(M.oak, F.loaf.x, H + 0.085, F.loaf.z, 0.48, 0.03, 0.3, 0.01);
  const loaf = group(F.loaf.x, H + 0.1, F.loaf.z);
  orb(M.crust, -0.03, 0.07, 0, 0.17, 0.085, 0.1, loaf);
  cyl(M.crumb, 0.135, 0.06, 0, 0.075, 0.012, 0.075, loaf, 14).rotation.z = Math.PI / 2;
  for (let i = 0; i < 2; i++) {
    const slice = cyl(M.crumb, 0.2 + i * 0.05, 0.02, 0.04 - i * 0.02, 0.075, 0.015, 0.07, loaf, 14);
    slice.rotation.set(0.15, 0.3, Math.PI / 2 + 0.6);
  }
  keep.add(loaf);
  mergeGroup(loaf);
  // A saucer of change and a little card.
  cyl(M.chinaBlue, -2.95, H + 0.08, -0.05, 0.08, 0.012, 0.09, root, 14);
  for (let i = 0; i < 5; i++) cyl(M.brass, -2.95 + range(-0.04, 0.04), H + 0.09 + i * 0.004, -0.05 + range(-0.04, 0.04), 0.018, 0.004, 0.018, root, 8);

  // ------------------------------------------------- the shelves behind the counter
  const shelfMax = K.backShelf.maxX,
    sw = shelfMax + K.halfW,
    sx = (shelfMax - K.halfW) / 2,
    sd = K.backShelf.depth,
    sz = southFace + sd / 2;
  b(M.oakDark, sx, 0.55, sz, sw, 1.1, sd);
  rb(M.oak, sx, 1.13, sz + 0.01, sw + 0.04, 0.05, sd + 0.04, 0.012);
  for (let x = -K.halfW + 0.55; x < shelfMax - 0.3; x += 0.9) rb(M.oak, x, 0.55, southFace + sd + 0.004, 0.75, 0.85, 0.02, 0.008);
  const caddyTones = ["#7a2620", "#2f4b58", "#3f6a3d", "#c79c3a", "#7a4f84", "#1f3b33", "#a64d2b", "#5d6a48", "#2b2b2b"];
  const caddyLabels = SIGNS.caddies.map((name, i) =>
    cell(220, 120, (c, w, h) => {
      c.fillStyle = caddyTones[i];
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#efe1bd";
      c.fillRect(14, 18, w - 28, h - 36);
      text(c, name, w / 2, h / 2 + 2, name.length > 7 ? 24 : 32, "#3a2a1c", { font: SERIF, weight: "bold", max: w - 40 });
    }),
  );
  for (const [i, y] of [2.0, 2.6, 3.2].entries()) {
    rb(M.oak, sx + 0.1, y, southFace + 0.17, sw - 0.2, 0.05, 0.34, 0.01);
    for (let x = -K.halfW + 0.4; x < shelfMax; x += 1.3) b(M.iron, x, y - 0.1, southFace + 0.06, 0.03, 0.16, 0.12);
    // Caddies on the middle shelf, teapots above and below.
    if (i === 1) {
      SIGNS.caddies.forEach((_, k) => {
        const x = -6.05 + k * 0.44,
          tone = parts.mat(caddyTones[k], 0.4, 0.3);
        if (k % 3 === 2) cyl(tone, x, y + 0.2, southFace + 0.18, 0.12, 0.36, 0.12, root, 16);
        else rb(tone, x, y + 0.19, southFace + 0.18, 0.26, 0.34, 0.22, 0.012);
        cyl(tone, x, y + 0.39, southFace + 0.18, 0.08, 0.04, 0.08, root, 12);
        decal(caddyLabels[k], x, y + 0.2, southFace + 0.295 + (k % 3 === 2 ? 0.01 : 0), 0.22, 0.12);
      });
    } else {
      for (let k = 0; k < 7; k++) {
        const x = -6.0 + k * 0.6 + range(-0.06, 0.06);
        teapot(x, y + 0.025, southFace + 0.18, china[(k + i) % 5], range(-0.5, 0.5));
      }
    }
  }
  // The copper tea urn on the worktop, with a brass tap and a jug under it.
  const urn = { x: F.urn.x, y: 1.155, z: southFace + 0.2 };
  for (const a of [0.5, 2.6, 4.7]) rod(M.iron, [urn.x + Math.cos(a) * 0.14, urn.y, urn.z + Math.sin(a) * 0.12], [urn.x + Math.cos(a) * 0.1, urn.y + 0.12, urn.z + Math.sin(a) * 0.08], 0.012, 5);
  turned(M.copper, [[0.001, 0.12], [0.16, 0.12], [0.2, 0.2], [0.21, 0.6], [0.18, 0.7], [0.12, 0.74], [0.13, 0.78], [0.05, 0.82], [0.001, 0.84]], urn.x, urn.y, urn.z, 24);
  orb(M.brass, urn.x, urn.y + 0.87, urn.z, 0.035);
  for (const sxs of [-1, 1]) torus(M.brass, urn.x + sxs * 0.22, urn.y + 0.62, urn.z, 0.045, 0.01).rotation.y = Math.PI / 2;
  rod(M.brass, [urn.x, urn.y + 0.26, urn.z + 0.19], [urn.x, urn.y + 0.26, urn.z + 0.29], 0.018, 8);
  rod(M.brass, [urn.x, urn.y + 0.26, urn.z + 0.29], [urn.x, urn.y + 0.2, urn.z + 0.3], 0.014, 8);
  b(M.brass, urn.x, urn.y + 0.31, urn.z + 0.27, 0.08, 0.02, 0.02);
  turned(M.enamel, [[0.001, 0], [0.06, 0], [0.07, 0.12], [0.065, 0.14]], urn.x, 1.155, urn.z + 0.3 - 0.01, 12);
  const urnSpout = new T.Vector3(urn.x, urn.y + 0.3, urn.z + 0.3);

  // ------------------------------------------------------------ the dresser
  const dr = K.dresser,
    dx = -K.halfW + dr.depth / 2,
    dz = (dr.minZ + dr.maxZ) / 2,
    dlen = dr.maxZ - dr.minZ;
  b(M.sage, dx, 0.55, dz, dr.depth, 1.1, dlen);
  rb(M.oak, dx + 0.02, 1.13, dz, dr.depth + 0.06, 0.05, dlen + 0.06, 0.012);
  for (const z of [dr.minZ + dlen / 4, dr.maxZ - dlen / 4]) {
    rb(M.sageDark, -K.halfW + dr.depth + 0.004, 0.55, z, 0.02, 0.8, dlen / 2 - 0.12, 0.008);
    orb(M.brass, -K.halfW + dr.depth + 0.03, 0.6, z + (z < dz ? 0.32 : -0.32), 0.022);
  }
  const back2 = -K.halfW + 0.02;
  b(M.sage, -K.halfW + 0.02, 2.35, dz, 0.04, 2.4, dlen);
  for (const z of [dr.minZ + 0.03, dr.maxZ - 0.03]) b(M.sage, -K.halfW + 0.17, 2.35, z, 0.3, 2.4, 0.05);
  rb(M.sage, -K.halfW + 0.2, 3.58, dz, 0.42, 0.08, dlen + 0.1, 0.015);
  for (const y of [1.75, 2.35, 2.95]) {
    b(M.sage, -K.halfW + 0.17, y, dz, 0.3, 0.035, dlen - 0.08);
    // A rail to keep the plates up, and the plates against it.
    b(M.sageDark, -K.halfW + 0.3, y + 0.07, dz, 0.015, 0.025, dlen - 0.1);
    for (let z = dr.minZ + 0.18; z < dr.maxZ - 0.1; z += 0.27) {
      const plate = cyl(china[Math.floor(random() * 5)], back2 + 0.1, y + 0.17, z, 0.13, 0.015, 0.13, root, 18);
      plate.rotation.z = Math.PI / 2 - 0.2;
    }
    // Cups hung from hooks under the shelf above.
    if (y < 2.9)
      for (let z = dr.minZ + 0.25; z < dr.maxZ - 0.1; z += 0.34) {
        const cup = turned(china[Math.floor(random() * 5)], [[0.001, 0], [0.04, 0], [0.055, 0.02], [0.06, 0.075]], -K.halfW + 0.27, y + 0.43, z, 12);
        cup.rotation.x = Math.PI;
      }
  }
  // On the dresser's top: a cottage teapot, a jug of cornflowers, a cake tin.
  teapot(dx + 0.04, 1.155, dr.minZ + 0.35, M.chinaYellow, 0.4);
  b(M.terracotta, dx + 0.04, 1.27, dr.minZ + 0.35, 0.14, 0.04, 0.12);
  posy(dx + 0.05, 1.155, dz, M.chinaBlue, [parts.mat("#5f7fc9", 0.8), parts.mat("#f2ead5", 0.8)]);
  cyl(parts.mat("#7a2620", 0.4, 0.4), dx + 0.04, 1.27, dr.maxZ - 0.35, 0.15, 0.22, 0.15, root, 18);
  cyl(M.gold, dx + 0.04, 1.39, dr.maxZ - 0.35, 0.155, 0.02, 0.155, root, 18);

  // --------------------------------------------------------------- the tables
  function chair(c) {
    const g = group(c.x, 0, c.z, c.face);
    for (const lx of [-0.2, 0.2])
      for (const lz of [-0.2, 0.2]) b(M.oakDark, lx, 0.36, lz, 0.05, 0.72, 0.05, g);
    rb(M.oak, 0, 0.74, 0, 0.5, 0.05, 0.5, 0.012, g);
    rb(M.gingham, 0, 0.79, -0.01, 0.42, 0.05, 0.42, 0.02, g).castShadow = false;
    for (const lx of [-0.2, 0.2]) b(M.oakDark, lx, 1.15, 0.21, 0.05, 0.8, 0.05, g);
    rb(M.oak, 0, 1.52, 0.21, 0.5, 0.1, 0.05, 0.01, g);
    for (const lx of [-0.1, 0, 0.1]) b(M.oak, lx, 1.12, 0.21, 0.035, 0.7, 0.03, g);
    b(M.oakDark, 0, 0.18, 0.2, 0.4, 0.03, 0.03, g);
  }
  teaChairs().forEach(chair);
  // Round tables under gingham, with a cloth that falls in a drape.
  const flowerTones = [parts.mat("#e4a3b8", 0.8), parts.mat("#f3e3a2", 0.8), parts.mat("#b7a6d6", 0.8), parts.mat("#d98b8b", 0.8)];
  for (const [i, table] of K.roundTables.entries()) {
    cyl(M.oakDark, table.x, 0.04, table.z, 0.3, 0.06, 0.32, root, 18);
    cyl(M.oakDark, table.x, TH / 2, table.z, 0.06, TH, 0.06, root, 10);
    cyl(M.oak, table.x, TH - 0.02, table.z, table.r, 0.04, table.r, root, 28);
    const drape = mesh(new T.CylinderGeometry(table.r + 0.03, table.r + 0.11, 0.3, 32, 1, true), M.gingham, table.x, TH - 0.15, table.z);
    drape.castShadow = false;
    const top = mesh(new T.CircleGeometry(table.r + 0.03, 32), M.gingham, table.x, TH + 0.002, table.z);
    top.rotation.x = -Math.PI / 2;
    top.castShadow = false;
    posy(table.x + 0.12, TH, table.z - 0.1, china[(i + 1) % 5], [flowerTones[i], flowerTones[(i + 2) % 4]]);
    cyl(M.china, table.x - 0.15, TH + 0.04, table.z - 0.12, 0.06, 0.08, 0.05, root, 12);
    for (const a of table.seats)
      cupAndSaucer(table.x + Math.sin(a) * table.r * 0.6, TH + 0.005, table.z + Math.cos(a) * table.r * 0.6, china[Math.floor(random() * 5)], range(0, TAU));
  }
  // The visitors' book, open on the window table, and a pen.
  const book = cell(512, 340, (c, w, h) => {
    c.fillStyle = "#f6efdc";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "rgba(80,60,40,0.4)";
    c.fillRect(w / 2 - 2, 0, 4, h);
    for (let side = 0; side < 2; side++)
      for (let line = 0; line < 9; line++) {
        const x0 = side * (w / 2) + 22,
          y = 34 + line * 33;
        c.strokeStyle = "rgba(120,140,170,0.35)";
        c.beginPath();
        c.moveTo(x0, y + 10);
        c.lineTo(x0 + w / 2 - 44, y + 10);
        c.stroke();
        if (side && line > 5) continue;
        c.strokeStyle = "rgba(40,40,80,0.75)";
        c.lineWidth = 1.6;
        c.beginPath();
        let x = x0 + 4;
        c.moveTo(x, y + 4);
        while (x < x0 + range(120, w / 2 - 50)) {
          x += range(4, 9);
          c.lineTo(x, y + 4 + range(-5, 5));
        }
        c.stroke();
      }
  });
  const bk = K.roundTables[2];
  b(M.ledger, bk.x, TH + 0.012, bk.z + 0.1, 0.62, 0.018, 0.42).rotation.y = 0.25;
  decal(book, bk.x, TH + 0.024, bk.z + 0.1, 0.58, 0.39, 0.25, root, -Math.PI / 2);
  rod(M.black, [bk.x + 0.12, TH + 0.035, bk.z + 0.26], [bk.x + 0.28, TH + 0.035, bk.z + 0.18], 0.008, 5);
  // The bay table, square, with a lace runner: tea laid for one.
  const bt = K.bayTable;
  for (const lx of [-1, 1])
    for (const lz of [-1, 1]) b(M.oakDark, bt.x + lx * (bt.w / 2 - 0.08), TH / 2, bt.z + lz * (bt.d / 2 - 0.08), 0.07, TH, 0.07);
  rb(M.oak, bt.x, TH - 0.02, bt.z, bt.w, 0.04, bt.d, 0.012);
  b(M.lace, bt.x, TH + 0.003, bt.z, bt.w - 0.25, 0.004, bt.d + 0.12).castShadow = false;
  const cupAt = { x: bt.x - 0.15, z: bt.z + 0.05 };
  const cup = cupAndSaucer(cupAt.x, TH + 0.005, cupAt.z, M.chinaRose, 0.5);
  const teaLevel = cyl(M.tea, cupAt.x, TH + 0.03, cupAt.z, 0.06, 0.004, 0.06, root, 14);
  teaLevel.castShadow = false;
  keep.add(teaLevel);
  void cup;
  // The teapot, on a pivot under its spout so it tips towards the cup.
  const potAt = { x: F.pour.x + 0.12, z: bt.z - 0.02 },
    pivot = group(potAt.x - 0.12, TH + 0.005, potAt.z),
    pot = teapot(0.12, 0, 0, M.chinaRose, 0, pivot);
  orb(M.chinaRose, 0.12, 0.21, 0, 0.03, 0.02, 0.03, pot);
  keep.add(pivot);
  mergeGroup(pivot);
  // The stream of tea, from the spout to the cup, while it pours.
  const stream = mesh(new T.CylinderGeometry(0.008, 0.006, 1, 6), M.tea, 0, 0, 0);
  stream.castShadow = false;
  stream.visible = false;
  keep.add(stream);
  // A milk jug, a scone with jam and cream, a sugar bowl and a spoon.
  turned(M.china, [[0.001, 0], [0.04, 0], [0.05, 0.05], [0.04, 0.09], [0.046, 0.1]], bt.x - 0.32, TH + 0.005, bt.z - 0.25, 12);
  cyl(M.china, bt.x + 0.02, TH + 0.012, bt.z + 0.28, 0.11, 0.014, 0.12, root, 18);
  for (const sxs of [-1, 1]) {
    cyl(M.scone, bt.x + 0.02 + sxs * 0.045, TH + 0.035, bt.z + 0.28, 0.04, 0.035, 0.037, root, 10);
    cyl(M.jam, bt.x + 0.02 + sxs * 0.045, TH + 0.055, bt.z + 0.28, 0.034, 0.008, 0.034, root, 10);
    orb(M.whip, bt.x + 0.02 + sxs * 0.045, TH + 0.065, bt.z + 0.28, 0.025, 0.014, 0.025);
  }
  turned(M.chinaBlue, [[0.001, 0], [0.04, 0], [0.055, 0.04], [0.05, 0.06]], bt.x + 0.32, TH + 0.005, bt.z + 0.25, 12);
  b(M.brass, cupAt.x + 0.12, TH + 0.016, cupAt.z + 0.06, 0.12, 0.006, 0.014).rotation.y = 0.7;

  // ------------------------------------------------------------- Crumpet
  // A ginger tom asleep at the west end of the window seat, curled nose to tail.
  const cat = group(F.cat.x, K.bay.seat + 0.14, F.cat.z, 0.35);
  const body = group(0, 0, 0, 0, cat);
  orb(M.ginger, 0, 0.11, 0, 0.24, 0.13, 0.17, body);
  orb(M.gingerPale, 0.03, 0.08, 0.1, 0.18, 0.09, 0.08, body);
  for (let i = 0; i < 5; i++) b(parts.mat("#b4692e", 0.95), -0.15 + i * 0.07, 0.22, 0, 0.03, 0.02, 0.2, body).rotation.z = 0.2;
  orb(M.ginger, 0.12, 0.05, 0.13, 0.07, 0.04, 0.05, body);
  orb(M.gingerPale, 0.2, 0.04, 0.15, 0.05, 0.03, 0.04, body);
  const head = group(0.21, 0.12, 0.08, 0, cat);
  orb(M.ginger, 0, 0, 0, 0.1, 0.085, 0.09, head);
  orb(M.gingerPale, 0.06, -0.025, 0.03, 0.05, 0.035, 0.045, head);
  for (const ez of [-0.05, 0.05]) {
    const ear = parts.mesh(new T.ConeGeometry(0.035, 0.07, 4), M.ginger, -0.01, 0.08, ez, head);
    ear.rotation.z = -0.25;
    b(M.black, 0.075, 0.015, ez * 0.75, 0.005, 0.004, 0.025, head);
  }
  orb(parts.mat("#c97a7a", 0.6), 0.1, -0.005, 0.03, 0.012, 0.01, 0.012, head);
  const tail = group(-0.2, 0.06, -0.05, 0, cat);
  tube(M.ginger, [[0, 0, 0], [-0.08, -0.02, 0.1], [-0.02, -0.03, 0.2], [0.12, -0.03, 0.22], [0.22, -0.02, 0.18]], 0.03, tail);
  keep.add(cat);
  mergeGroup(body);
  mergeGroup(head);
  mergeGroup(tail);

  // ------------------------------------------------------------- the fireside
  const fp = K.fireplace,
    fx = (fp.x[0] + fp.x[1]) / 2,
    breastFront = southFace + K.chimney.depth;
  // An iron basket of apple logs, with embers and flames.
  const basket = { x: fx, z: southFace + 0.42 };
  b(M.iron, basket.x, 0.24, basket.z, 0.8, 0.04, 0.4);
  for (const lx of [-0.36, 0.36]) b(M.iron, basket.x + lx, 0.15, basket.z, 0.05, 0.3, 0.42);
  for (let i = 0; i < 6; i++) rod(M.iron, [basket.x - 0.36 + i * 0.144, 0.24, basket.z + 0.21], [basket.x - 0.36 + i * 0.144, 0.46, basket.z + 0.24], 0.012, 4);
  const embers = b(M.fireGlow, basket.x, 0.29, basket.z, 0.7, 0.06, 0.34);
  embers.castShadow = false;
  for (const [lx, a] of [[-0.12, 0.2], [0.14, -0.25], [0, 0.05]]) {
    const log = cyl(parts.mat("#6b4a32", 0.95), basket.x + lx, 0.36 + (lx === 0 ? 0.1 : 0), basket.z, 0.075, 0.66, 0.075, root, 10);
    log.rotation.set(0, a, Math.PI / 2);
  }
  const flameMat = new T.MeshBasicMaterial({ color: "#ff9a3c", transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false });
  const flames = [-0.18, 0.02, 0.2].map((lx, i) => {
    const flame = mesh(new T.ConeGeometry(0.09 - i * 0.012, 0.42, 8, 1, true), flameMat, basket.x + lx, 0.62, basket.z + 0.02);
    flame.castShadow = flame.receiveShadow = false;
    keep.add(flame);
    return flame;
  });
  // Fire irons, a coal scuttle and the hearth rug.
  for (const [i, lx] of [-0.32, -0.22].entries()) rod(M.brass, [fp.x[1] + 0.32 + lx, 0.06, breastFront + 0.12], [fp.x[1] + 0.32 + lx + 0.02, 0.85 - i * 0.08, breastFront + 0.1], 0.012, 6);
  orb(M.brass, fp.x[1] + 0.13, 0.88, breastFront + 0.1, 0.03);
  turned(M.copperDark, [[0.001, 0], [0.14, 0], [0.17, 0.2], [0.15, 0.32]], fp.x[0] - 0.42, 0, breastFront + 0.2, 16);
  const rugMesh = mesh(new T.CircleGeometry(1.05, 48), M.rug, fx, 0.006, breastFront + 1.15);
  rugMesh.rotation.x = -Math.PI / 2;
  rugMesh.castShadow = false;
  // On the mantel: the copper kettle itself, brass candlesticks, a little clock.
  const kettle = group(F.kettle.x, K.chimney.mantel + 0.045, F.kettle.z, -0.5);
  kettle.scale.setScalar(1.45);
  turned(M.copper, [[0.001, 0], [0.13, 0], [0.16, 0.05], [0.165, 0.11], [0.13, 0.18], [0.07, 0.21], [0.075, 0.23], [0.001, 0.24]], 0, 0, 0, 24, kettle);
  orb(M.brass, 0, 0.255, 0, 0.022, 0.02, 0.022, kettle);
  tube(M.copper, [[-0.13, 0.05, 0], [-0.2, 0.1, 0], [-0.25, 0.19, 0], [-0.29, 0.23, 0]], 0.018, kettle);
  torus(M.copper, 0, 0.23, 0, 0.11, 0.013, kettle, Math.PI).rotation.y = Math.PI / 2;
  for (const x of [K.chimney.minX + 0.3, K.chimney.maxX - 0.3]) {
    turned(M.brass, [[0.001, 0], [0.05, 0], [0.05, 0.015], [0.018, 0.04], [0.014, 0.22], [0.03, 0.24], [0.016, 0.25]], x, K.chimney.mantel + 0.045, breastFront + 0.05, 12);
    cyl(M.cream, x, K.chimney.mantel + 0.36, breastFront + 0.05, 0.014, 0.18, 0.014, root, 8);
  }
  const mantelClock = { x: 3.4, y: K.chimney.mantel + 0.045, z: breastFront + 0.06 };
  rb(M.oakDark, mantelClock.x, mantelClock.y + 0.12, mantelClock.z, 0.3, 0.24, 0.12, 0.03);
  const clockFace = cell(128, 128, (c, w) => paintClock(c, w, SERIF));
  disc(clockFace, mantelClock.x, mantelClock.y + 0.13, mantelClock.z + 0.062, 0.08);
  // Copper jelly moulds and a horse brass along the breast.
  turned(M.copper, [[0.001, 0], [0.08, 0], [0.09, 0.03], [0.07, 0.06], [0.08, 0.09], [0.04, 0.12], [0.001, 0.13]], 4.0, K.chimney.mantel + 0.045, breastFront + 0.06, 16);
  // A sampler over the mantel: "Home is where the kettle is".
  const sampler = cell(400, 300, (c, w, h) => {
    c.fillStyle = "#efe6cf";
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "#7f9a7c";
    c.lineWidth = 6;
    c.setLineDash([8, 6]);
    c.strokeRect(20, 20, w - 40, h - 40);
    c.setLineDash([]);
    text(c, "Home is where", w / 2, 110, 40, "#8e4b4f", { font: HAND });
    text(c, "the kettle is", w / 2, 165, 40, "#8e4b4f", { font: HAND });
    for (let i = 0; i < 5; i++) {
      c.fillStyle = ["#c26f7b", "#7f9a7c", "#c79c3a"][i % 3];
      c.beginPath();
      c.arc(90 + i * 55, 228, 9, 0, TAU);
      c.fill();
    }
  });
  rb(M.oakDark, fx, 2.65, breastFront + 0.02, 0.86, 0.68, 0.04, 0.008);
  decal(sampler, fx, 2.65, breastFront + 0.045, 0.74, 0.56);
  // The armchairs, plump and faded, each with a cushion.
  function armchair(a) {
    const g = group(a.x, 0, a.z, a.face);
    for (const lx of [-0.4, 0.4]) for (const lz of [-0.36, 0.36]) b(M.oakDark, lx, 0.07, lz, 0.06, 0.14, 0.06, g);
    rb(M.velvet, 0, 0.42, 0, 0.98, 0.56, 0.9, 0.08, g);
    rb(M.chintz, 0, 0.75, -0.04, 0.68, 0.14, 0.72, 0.06, g);
    rb(M.velvet, 0, 1.22, 0.39, 0.98, 1.05, 0.2, 0.09, g);
    for (const lx of [-0.43, 0.43]) {
      rb(M.velvet, lx, 0.88, 0, 0.17, 0.4, 0.86, 0.07, g);
      cyl(M.velvetDark, lx, 1.08, 0, 0.1, 0.84, 0.1, g, 12).rotation.x = Math.PI / 2;
    }
    rb(M.cushion, 0.1, 1.05, 0.22, 0.4, 0.36, 0.12, 0.05, g).rotation.set(-0.2, 0, 0.3);
    return g;
  }
  K.armchairs.forEach(armchair);
  // A little table by the east chair, with a cup and a novel face down.
  cyl(M.oakDark, 6.05, 0.4, -1.35, 0.03, 0.8, 0.03, root, 8);
  cyl(M.oak, 6.05, 0.82, -1.35, 0.24, 0.03, 0.24, root, 18);
  cupAndSaucer(6.0, 0.835, -1.3, M.chinaGreen, 2);
  b(parts.mat("#3f6a6b", 0.7), 6.1, 0.86, -1.48, 0.18, 0.04, 0.12).rotation.y = 0.5;

  // ------------------------------------------------ the gramophone and pictures
  const gr = K.gramophone,
    gx = K.halfW - gr.depth / 2,
    gz = (gr.minZ + gr.maxZ) / 2;
  b(M.oakDark, gx, 0.5, gz, gr.depth, 1.0, gr.maxZ - gr.minZ);
  rb(M.oak, gx, 1.02, gz, gr.depth + 0.04, 0.04, gr.maxZ - gr.minZ + 0.04, 0.01);
  for (const z of [gz - 0.2, gz + 0.2]) rb(M.oak, K.halfW - gr.depth - 0.004, 0.55, z, 0.02, 0.72, 0.36, 0.006);
  rb(M.oak, gx, 1.12, gz, 0.46, 0.16, 0.46, 0.015);
  const record = group(gx, 1.21, gz);
  cyl(M.record, 0, 0, 0, 0.19, 0.01, 0.19, record, 28);
  const label = cell(128, 128, (c, w) => {
    c.fillStyle = "#8b3a32";
    c.beginPath();
    c.arc(w / 2, w / 2, w / 2, 0, TAU);
    c.fill();
    text(c, "Tea Dance", w / 2, w / 2 - 14, 18, "#f2e3bd", { font: SERIF, weight: "bold" });
    text(c, "No. 7", w / 2, w / 2 + 16, 14, "#f2e3bd", { font: SERIF });
  });
  disc(label, 0, 0.006, 0, 0.06, record).rotation.x = -Math.PI / 2;
  keep.add(record);
  mergeGroup(record);
  rod(M.brass, [gx + 0.16, 1.22, gz + 0.16], [gx - 0.02, 1.26, gz + 0.04], 0.01, 6);
  rod(M.brass, [gx + 0.16, 1.2, gz + 0.16], [gx + 0.16, 1.32, gz + 0.16], 0.012, 6);
  // The horn, flaring up and out towards the room.
  const horn = turned(M.brass, [[0.025, 0], [0.03, 0.2], [0.05, 0.36], [0.1, 0.5], [0.2, 0.6], [0.28, 0.63]], 0, 0, 0, 20);
  horn.material = parts.mat("#c9944f", 0.3, 0.75);
  horn.material.side = T.DoubleSide;
  horn.position.set(gx + 0.12, 1.3, gz + 0.16);
  horn.rotation.set(0, 0, 0.9);
  const crank = group(gx - 0.03, 1.12, gz - 0.24);
  rod(M.iron, [0, 0, 0], [0, 0, -0.1], 0.01, 5, crank);
  rod(M.iron, [0, 0, -0.1], [0, -0.1, -0.1], 0.01, 5, crank);
  orb(M.oakDark, 0, -0.1, -0.13, 0.02, 0.02, 0.03, crank);
  keep.add(crank);
  mergeGroup(crank);
  // The photographs, framed in a cluster on the east wall.
  const photos = [
    [0.52, 0.4, 2.95, 2.4, "opening"],
    [0.36, 0.46, 2.2, 2.4, "snow"],
    [0.4, 0.32, 2.45, 3.0, "finn"],
    [0.6, 0.42, 3.15, 3.0, "wedding"],
    [0.32, 0.4, 3.7, 2.6, "bunting"],
  ];
  for (const [w, h, z, y, kind] of photos) {
    const pic = cell(Math.round(w * 400), Math.round(h * 400), (c, pw, ph) => paintPhoto(c, pw, ph, kind, random, range));
    b(M.oakDark, K.halfW - 0.02, y, z, 0.03, h + 0.08, w + 0.08);
    decal(pic, K.halfW - 0.04, y, z, w, h, -Math.PI / 2);
  }

  // --------------------------------------------------------------- the menu
  const menu = cell(880, 560, (c, w, h) => {
    c.fillStyle = "#2c3230";
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      c.fillStyle = `rgba(255,255,255,${range(0.01, 0.05)})`;
      c.fillRect(random() * w, random() * h, range(2, 30), range(1, 3));
    }
    let y = 70;
    for (const [line, size] of SIGNS.menu) {
      text(c, line, w / 2, y, size * 1.1, "#f3efe2", { font: HAND });
      y += size * 1.1 + 22;
    }
    c.strokeStyle = "rgba(243,239,226,0.8)";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(w * 0.3, 112);
    c.lineTo(w * 0.7, 112);
    c.stroke();
    // The cat, and its moustache.
    c.beginPath();
    c.arc(w - 90, h - 70, 26, 0, TAU);
    c.moveTo(w - 110, h - 88);
    c.lineTo(w - 104, h - 110);
    c.lineTo(w - 94, h - 94);
    c.moveTo(w - 70, h - 88);
    c.lineTo(w - 76, h - 110);
    c.lineTo(w - 86, h - 94);
    c.moveTo(w - 112, h - 62);
    c.quadraticCurveTo(w - 90, h - 74, w - 68, h - 62);
    c.stroke();
  });
  const mx = F.menu.x;
  rb(M.oakDark, mx, F.menu.y, southFace + 0.02, 2.04, 1.34, 0.05, 0.01);
  decal(menu, mx, F.menu.y, southFace + 0.05, 1.9, 1.2);
  b(M.oak, mx, F.menu.y - 0.7, southFace + 0.07, 1.9, 0.04, 0.08);
  for (let i = 0; i < 3; i++) b(M.cream, mx - 0.6 + i * 0.08, F.menu.y - 0.67, southFace + 0.08, 0.06, 0.02, 0.02);

  // ------------------------------------------------------------ the hat stand
  const hs = K.hatStand;
  for (const a of [0, 2.1, 4.2]) rod(M.oakDark, [hs.x, 0.3, hs.z], [hs.x + Math.cos(a) * 0.26, 0.02, hs.z + Math.sin(a) * 0.26], 0.02, 5);
  rod(M.oakDark, [hs.x, 0.05, hs.z], [hs.x, 2.7, hs.z], 0.035, 8);
  orb(M.oakDark, hs.x, 2.74, hs.z, 0.05);
  for (const a of [0.4, 1.9, 3.4, 4.9]) rod(M.brass, [hs.x, 2.55, hs.z], [hs.x + Math.cos(a) * 0.17, 2.62, hs.z + Math.sin(a) * 0.17], 0.01, 4);
  cyl(parts.mat("#e2c98a", 0.95), hs.x + 0.1, 2.62, hs.z + 0.08, 0.22, 0.02, 0.22, root, 18).rotation.z = 0.3;
  cyl(parts.mat("#e2c98a", 0.95), hs.x + 0.1, 2.68, hs.z + 0.08, 0.1, 0.1, 0.11, root, 14).rotation.z = 0.3;
  b(parts.mat("#9a6a8a", 0.95), hs.x - 0.12, 2.2, hs.z, 0.08, 0.7, 0.14).rotation.z = 0.08;
  rod(parts.mat("#2f4b58", 0.6), [hs.x + 0.22, 0.05, hs.z - 0.1], [hs.x + 0.12, 1.4, hs.z - 0.05], 0.03, 6);

  return {
    till,
    drawer,
    cake,
    wedges,
    pivot,
    stream,
    teaLevel,
    cupAt: { x: cupAt.x, y: TH + 0.005, z: cupAt.z },
    cat,
    body,
    head,
    tail,
    flames,
    embers,
    record,
    crank,
    loaf,
    urnSpout,
  };
}

/** The sponge's slices, each a wedge of sponge, jam, cream, sponge and sugar. */
export function cakeWedges(T, radius, count) {
  const layers = [
    [0, 0.05, "#e9c47e"],
    [0.05, 0.016, "#a0212e"],
    [0.066, 0.02, "#fbf6e6"],
    [0.086, 0.05, "#e2b46c"],
    [0.136, 0.006, "#f7f2e8"],
  ];
  const color = new T.Color();
  return Array.from({ length: count }, (_, i) => {
    const a0 = (i / count) * Math.PI * 2,
      a1 = ((i + 1) / count) * Math.PI * 2;
    const parts = layers.map(([y, h, hex]) => {
      const shape = new T.Shape();
      shape.moveTo(0, 0);
      for (let k = 0; k <= 6; k++) {
        const a = a0 + ((a1 - a0) * k) / 6;
        shape.lineTo(Math.cos(a) * radius * 0.995, Math.sin(a) * radius * 0.995);
      }
      shape.lineTo(0, 0);
      const g = new T.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      g.translate(0, y, 0);
      const flat = g.index ? g.toNonIndexed() : g;
      if (flat !== g) g.dispose();
      color.set(hex);
      const colors = new Float32Array(flat.attributes.position.count * 3);
      for (let k = 0; k < colors.length; k += 3) color.toArray(colors, k);
      flat.setAttribute("color", new T.BufferAttribute(colors, 3));
      flat.deleteAttribute("uv");
      return flat;
    });
    const wedge = mergeGeometries(parts);
    parts.forEach((g) => g.dispose());
    return wedge;
  });
}

/** A clock face, in the round. */
export function paintClock(c, w, font) {
  c.fillStyle = "#f4ecd6";
  c.beginPath();
  c.arc(w / 2, w / 2, w / 2, 0, TAU);
  c.fill();
  c.strokeStyle = "#3a2a1c";
  c.lineWidth = w / 40;
  c.stroke();
  c.fillStyle = "#3a2a1c";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = `${w / 9}px ${font}`;
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * TAU;
    c.fillText(["I", "II", "III", "IIII", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][i - 1], w / 2 + Math.sin(a) * w * 0.38, w / 2 - Math.cos(a) * w * 0.38);
  }
}

/** A faded photograph: sepia, with a white border. */
function paintPhoto(c, w, h, kind, random, range) {
  c.fillStyle = "#f2eadb";
  c.fillRect(0, 0, w, h);
  const m = Math.min(w, h) * 0.07,
    iw = w - 2 * m,
    ih = h - 2 * m;
  c.save();
  c.translate(m, m);
  const g = c.createLinearGradient(0, 0, 0, ih);
  g.addColorStop(0, kind === "snow" ? "#c9c2b4" : "#cdb48e");
  g.addColorStop(1, kind === "snow" ? "#efe9de" : "#8b6d4c");
  c.fillStyle = g;
  c.fillRect(0, 0, iw, ih);
  const ink = "rgba(62,40,22,0.75)";
  c.fillStyle = ink;
  if (kind === "opening" || kind === "snow" || kind === "bunting") {
    // The tea room, front on: its roof, door and bay.
    c.fillRect(iw * 0.2, ih * 0.38, iw * 0.6, ih * 0.5);
    c.beginPath();
    c.moveTo(iw * 0.15, ih * 0.4);
    c.lineTo(iw * 0.5, ih * 0.16);
    c.lineTo(iw * 0.85, ih * 0.4);
    c.fill();
    c.fillStyle = kind === "snow" ? "#f4f0e8" : "#d9c39b";
    c.fillRect(iw * 0.46, ih * 0.6, iw * 0.09, ih * 0.28);
    c.fillRect(iw * 0.26, ih * 0.52, iw * 0.14, ih * 0.16);
  }
  if (kind === "opening") {
    c.fillStyle = ink;
    c.beginPath();
    c.ellipse(iw * 0.66, ih * 0.66, iw * 0.04, ih * 0.06, 0, 0, TAU);
    c.fill();
    c.fillRect(iw * 0.62, ih * 0.7, iw * 0.08, ih * 0.22);
  }
  if (kind === "snow")
    for (let i = 0; i < 60; i++) {
      c.fillStyle = "rgba(255,255,255,0.8)";
      c.fillRect(random() * iw, random() * ih, 2, 2);
    }
  if (kind === "bunting")
    for (let i = 0; i < 9; i++) {
      c.fillStyle = "rgba(62,40,22,0.55)";
      c.beginPath();
      c.moveTo((i / 9) * iw, ih * 0.1);
      c.lineTo(((i + 1) / 9) * iw, ih * 0.12);
      c.lineTo(((i + 0.5) / 9) * iw, ih * 0.2);
      c.fill();
    }
  if (kind === "finn" || kind === "wedding") {
    const n = kind === "finn" ? 1 : 6;
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? iw / 2 : iw * (0.12 + i * 0.15),
        s = n === 1 ? 1.4 : range(0.8, 1);
      c.fillStyle = ink;
      c.beginPath();
      c.ellipse(x, ih * 0.38, iw * 0.04 * s, ih * 0.08 * s, 0, 0, TAU);
      c.fill();
      c.fillRect(x - iw * 0.05 * s, ih * 0.48, iw * 0.1 * s, ih * 0.5);
    }
    if (kind === "finn") {
      c.fillStyle = "rgba(255,255,255,0.7)";
      c.beginPath();
      c.arc(iw / 2, ih * 0.4, iw * 0.015, 0, TAU);
      c.fill();
    }
  }
  c.restore();
  // Age: a vignette and a few spots.
  const v = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.7);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(80,50,20,0.35)");
  c.fillStyle = v;
  c.fillRect(m, m, w - 2 * m, h - 2 * m);
}
