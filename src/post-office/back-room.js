import * as T from "three";
import { FIXTURES as F, POST_OFFICE as P } from "./layout.js";
import { bundle, parcel } from "./counter.js";
import { stool } from "./sorting.js";

// Through the door marked Private: the parcel shelves and their ladder, the
// exchange, Bram's armchair by the pot-bellied stove with his socks on the airer
// above it, the mantel and the wireless, the rack of mail sacks and the wicker
// hamper, the packing bench under the rear window, and the red bicycle. Returns
// what moves or glows.
export function buildBackRoom(parts, surfaces, keep) {
  const { b, rb, rod, cyl, orb, torus, turned, tube, group, random, range, mesh, mergeGroup, root } = parts;
  const { M, A, decal } = surfaces;
  const W = P.halfW,
    back = P.back,
    wallFace = P.partition - P.wall / 2;

  // ------------------------------------------------------- the parcel shelves
  const S = P.shelves,
    sW = S.maxX - S.minX,
    sX = (S.minX + S.maxX) / 2,
    sZ = back + S.depth / 2,
    sTop = S.levels[S.levels.length - 1] + 0.06;
  const bays = 4;
  for (let i = 0; i <= bays; i++) b(M.pine, S.minX + (i * sW) / bays, sTop / 2, sZ, 0.08, sTop, S.depth);
  for (const y of S.levels) rb(M.pine, sX, y, sZ, sW, 0.05, S.depth, 0.008);
  b(M.mahoganyDark, sX, sTop / 2, back + 0.03, sW, sTop, 0.03);
  decal(A.parcelsSign, 0.72, S.levels[3] - 0.14, back + S.depth + 0.004, 1.0, 0.24);
  b(M.ironLight, 0.72, S.levels[3] - 0.14, back + S.depth, 1.02, 0.26, 0.006);
  for (const dx of [-0.38, 0.38]) rod(M.iron, [0.72 + dx, S.levels[3] - 0.02, back + S.depth + 0.004], [0.72 + dx, S.levels[3] + 0.02, back + S.depth], 0.006, 4);
  const labelled = [0, 1, 2, 3, 4, 5];
  S.levels.slice(0, -1).forEach((y, level) => {
    let x = S.minX + 0.12;
    const room = S.levels[level + 1] - y - 0.1;
    while (x < S.maxX - 0.36) {
      const w = range(0.36, Math.min(0.92, S.maxX - x - 0.1)),
        h = range(0.26, Math.max(0.3, room * (level === 3 ? 0.62 : 0.84))),
        d = range(0.34, S.depth - 0.12);
      if (random() < 0.88) {
        const stacked = h < room * 0.45 && random() < 0.5;
        parcel(parts, M, x + w / 2, y + 0.025 + h / 2, sZ + (S.depth - d) / 2 - 0.05, w, h, d, range(-0.04, 0.04), Math.floor(random() * 3), decal, random() < 0.42 ? A.parcelLabels[labelled[Math.floor(random() * 6)]] : null);
        if (stacked) {
          const w2 = w * range(0.55, 0.85),
            h2 = Math.min(h * 0.75, room - h - 0.06);
          if (h2 > 0.1) parcel(parts, M, x + w / 2 + range(-0.03, 0.03), y + 0.025 + h + h2 / 2, sZ + (S.depth - d) / 2 - 0.05, w2, h2, d * 0.8, range(-0.15, 0.15), Math.floor(random() * 3));
        }
      }
      x += w + range(0.03, 0.16);
    }
  });
  // The ladder on its rail: leans out to the walkway and hooks over the rail.
  const railY = S.levels[4] + 0.16,
    railZ = back + S.depth + 0.05;
  rod(M.iron, [S.minX, railY, railZ], [S.maxX, railY, railZ], 0.016, 8);
  for (const x of [S.minX + 0.05, sX, S.maxX - 0.05]) rod(M.iron, [x, railY, railZ], [x, railY, back + S.depth - 0.04], 0.012, 5);
  const L = P.ladder,
    footZ = L.footZ - 0.15,
    topZ = railZ + 0.01;
  for (const side of [-1, 1]) {
    const sx = L.x + side * 0.27;
    rod(M.pine, [sx, 0.03, footZ], [sx, railY + 0.06, topZ], 0.03, 8);
    rod(M.iron, [sx, railY + 0.06, topZ], [sx, railY + 0.06, topZ - 0.05], 0.01, 4);
  }
  for (let i = 1; i < 11; i++) {
    const f = i / 11,
      y = 0.03 + (railY + 0.03) * f,
      z = footZ + (topZ - footZ) * f;
    rod(M.pine, [L.x - 0.27, y, z], [L.x + 0.27, y, z], 0.016, 6);
  }

  // ---------------------------------------------------------- the switchboard
  const X = P.switchboard,
    xW = X.maxX - X.minX,
    xX = (X.minX + X.maxX) / 2,
    xZ = back + X.depth / 2;
  rb(M.mahogany, xX, 0.72, xZ, xW, 1.44, X.depth, 0.014);
  for (let i = 0; i < 2; i++) {
    const px = xX + (i - 0.5) * (xW / 2);
    rb(M.mahoganyDark, px, 0.72, back + X.depth + 0.003, xW / 2 - 0.12, 1.02, 0.012, 0.004);
    rb(M.mahogany, px, 0.72, back + X.depth + 0.012, xW / 2 - 0.24, 0.84, 0.014, 0.004);
  }
  rb(M.mahogany, xX, 1.47, xZ + 0.08, xW + 0.06, 0.05, X.depth + 0.16, 0.012);
  rb(M.mahogany, xX, 2.3, back + 0.14, xW, 1.7, 0.26, 0.014);
  rb(M.mahoganyDark, xX, 3.17, back + 0.16, xW + 0.1, 0.07, 0.34, 0.012);
  decal(A.switchPanel, xX, 2.26, back + 0.272, xW - 0.14, ((xW - 0.14) * 360) / 520);
  // The wink: a row of little lamps along the panel's top.
  for (let i = 0; i < 9; i++) orb(M.boardLamp, xX - 0.62 + i * 0.155, 2.94, back + 0.276, 0.016, 0.016, 0.01);
  // Plugs and cords on the shelf, some of them looped up into their jacks.
  const cordColours = [M.oxblood, M.black, M.doorGreen];
  for (let i = 0; i < 6; i++) {
    const cx = xX - 0.55 + i * 0.22,
      cz = back + X.depth + 0.02;
    cyl(M.brass, cx, 1.52, cz, 0.015, 0.05, 0.012, root, 6);
    cyl(M.black, cx, 1.56, cz, 0.018, 0.05, 0.018, root, 6);
    if (i % 2 === 0)
      tube(cordColours[i % 3], [[cx, 1.58, cz], [cx + 0.03, 1.8, cz + 0.08], [xX - 0.5 + ((i * 7) % 5) * 0.28, 2.05, back + 0.33], [xX - 0.5 + ((i * 7) % 5) * 0.28, 2.15, back + 0.28]], 0.0065);
    else tube(cordColours[i % 3], [[cx, 1.52, cz], [cx + 0.01, 1.47, cz + 0.05], [cx - 0.02, 1.2, cz + 0.08]], 0.0065);
  }
  // The headset, on its hook.
  const phones = torus(M.black, xX + 0.74, 2.88, back + 0.3, 0.09, 0.012, root, Math.PI);
  phones.rotation.y = 0.2;
  cyl(M.black, xX + 0.65, 2.86, back + 0.31, 0.034, 0.03, 0.034, root, 10).rotation.x = Math.PI / 2;
  cyl(M.black, xX + 0.83, 2.86, back + 0.29, 0.034, 0.03, 0.034, root, 10).rotation.x = Math.PI / 2;
  stool(parts, M, P.switchStool.x, P.switchStool.z, 0.86);
  // The spare window card, pinned up here until Thursday comes round.
  decal(A.windowCard, xX - 0.06, 3.5, back + 0.022, 0.48, 0.31);

  // ---------------------------------------------- the chimney breast and mantel
  const C = P.chimney,
    cW = C.maxX - C.minX,
    cX = (C.minX + C.maxX) / 2,
    cZ = wallFace - C.depth / 2,
    H = P.ceiling;
  const breast = parts.tiled(M.brick, cX, H / 2, cZ, cW, H, C.depth, 1.0, 1.0);
  breast.receiveShadow = true;
  // The hearth, a slab of slate, with an iron back plate glowing a little.
  const hearth = rb(M.ironLight, cX, 0.03, wallFace - 1.12, cW + 0.4, 0.06, 1.1, 0.012);
  hearth.castShadow = false;
  b(M.iron, cX, 1.0, cZ - C.depth / 2 - 0.01, 1.4, 1.9, 0.02);
  // The mantel on two corbels: the room's bits and pieces live up here.
  const shelf = 2.3,
    mantelFace = cZ - C.depth / 2;
  rb(M.mahogany, cX, shelf, mantelFace - 0.17, cW + 0.3, 0.08, 0.4, 0.016);
  for (const side of [-1, 1]) rb(M.mahoganyDark, cX + side * (cW / 2 - 0.1), shelf - 0.17, mantelFace - 0.1, 0.12, 0.26, 0.2, 0.012);
  const on = shelf + 0.04;
  // The wireless: walnut with a cloth grille and an amber dial.
  const wx = F.wireless.x,
    wz = F.wireless.z - 0.02;
  rb(M.beam, wx, on + 0.24, wz, 0.64, 0.48, 0.3, 0.05);
  rb(M.tweed, wx, on + 0.31, wz - 0.152, 0.5, 0.26, 0.01, 0.006);
  for (let i = 0; i < 5; i++) b(M.beam, wx - 0.2 + i * 0.1, on + 0.31, wz - 0.16, 0.012, 0.25, 0.008);
  const dial = rb(M.dial, wx, on + 0.11, wz - 0.154, 0.34, 0.08, 0.01, 0.004);
  dial.castShadow = false;
  for (const side of [-1, 1]) {
    const knob = cyl(M.brassDull, wx + side * 0.24, on + 0.11, wz - 0.165, 0.028, 0.03, 0.024, root, 10);
    knob.rotation.x = Math.PI / 2;
  }
  const needle = b(M.oxblood, wx - 0.08, on + 0.11, wz - 0.162, 0.006, 0.07, 0.003);
  needle.castShadow = false;
  // Beside it: a tin, his mother's picture, a candlestick and a pipe.
  const tinX = cX + 0.75;
  cyl(M.oxblood, tinX + 0.15, on + 0.1, mantelFace - 0.17, 0.08, 0.2, 0.08, root, 12);
  decal(A.photos[0], cX - 0.75, on + 0.21, mantelFace - 0.2, 0.26, 0.34, Math.PI - 0.15);
  rb(M.brassDull, cX - 0.75, on + 0.21, mantelFace - 0.19, 0.3, 0.38, 0.015, 0.004).rotation.y = -0.15;
  decal(A.photos[1], cX - 0.32, on + 0.16, mantelFace - 0.2, 0.19, 0.25, Math.PI + 0.1);
  rb(M.mahoganyDark, cX - 0.32, on + 0.16, mantelFace - 0.19, 0.23, 0.29, 0.015, 0.004).rotation.y = 0.1;
  turned(M.brass, [[0.05, 0], [0.018, 0.02], [0.012, 0.15], [0.03, 0.17], [0.012, 0.18], [0.02, 0.2]], cX - 1.05, on, mantelFace - 0.17, 10);
  cyl(M.paperWhite, cX - 1.05, on + 0.28, mantelFace - 0.17, 0.014, 0.15, 0.012, root, 8);
  // The airer on its ropes, with Bram's socks and a blue-striped shirt.
  const airY = 3.5,
    airX0 = cX - 1.05,
    airX1 = cX + 1.05;
  for (const x of [airX0 + 0.04, airX1 - 0.04]) {
    rb(M.pine, x, airY, F.stove.z - 0.1, 0.05, 0.1, 0.84, 0.008);
    rod(M.string, [x, airY + 0.05, F.stove.z - 0.1], [x, H - 0.05, F.stove.z - 0.1], 0.007, 4);
  }
  for (const z of [-0.45, -0.25, -0.05, 0.15, 0.3]) rod(M.pine, [airX0, airY - 0.02, F.stove.z + z], [airX1, airY - 0.02, F.stove.z + z], 0.018, 6);
  const sock = (x, z, turn = 0) => {
    const g = group(x, airY - 0.02, z, turn);
    b(M.wool, 0, -0.17, 0, 0.11, 0.34, 0.03, g);
    b(M.wool, 0.06, -0.37, 0, 0.23, 0.11, 0.03, g);
    b(M.oxblood, 0, -0.02, 0, 0.12, 0.04, 0.034, g);
  };
  sock(cX - 0.7, F.stove.z - 0.25);
  sock(cX - 0.48, F.stove.z - 0.25, 0.1);
  sock(cX + 0.68, F.stove.z - 0.05, -0.1);
  // A shirt over two rails.
  const shirt = group(cX + 0.05, airY - 0.02, F.stove.z - 0.15);
  b(M.paperBlue, 0, -0.32, -0.1, 0.72, 0.62, 0.012, shirt);
  b(M.paperBlue, 0, -0.26, 0.1, 0.72, 0.5, 0.012, shirt);
  b(M.paperBlue, 0, 0.012, 0, 0.72, 0.014, 0.22, shirt);

  // ----------------------------------------------------------------- the stove
  const St = P.stove,
    stove = group(St.x, 0, St.z);
  // Feet, ash door, belly, collar, top plate and a door with a mica window.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    cyl(M.iron, Math.cos(a) * 0.32, 0.1, Math.sin(a) * 0.32, 0.05, 0.2, 0.035, stove, 8);
  }
  turned(M.iron, [[0.3, 0.14], [0.4, 0.2], [0.44, 0.28], [0.34, 0.42], [0.42, 0.56], [0.52, 0.82], [0.54, 1.0], [0.5, 1.2], [0.36, 1.38], [0.3, 1.44], [0.38, 1.46], [0.38, 1.5], [0.2, 1.54]], 0, 0, 0, 24, stove);
  const belt = torus(M.brassDull, 0, 1.0, 0, 0.54, 0.014, stove);
  belt.rotation.x = Math.PI / 2;
  // Facing the room, which is north here.
  const glow = rb(M.fireGlow, 0, 0.92, -0.53, 0.36, 0.3, 0.02, 0.006, stove);
  glow.castShadow = false;
  for (const dx of [-0.11, 0, 0.11]) b(M.iron, dx, 0.92, -0.545, 0.016, 0.3, 0.012, stove);
  for (const dy of [-0.15, 0.15]) rb(M.iron, 0, 0.92 + dy, -0.54, 0.44, 0.05, 0.03, 0.006, stove);
  for (const side of [-1, 1]) rb(M.iron, side * 0.21, 0.92, -0.54, 0.05, 0.36, 0.03, 0.006, stove);
  rb(M.brass, 0.17, 0.92, -0.565, 0.1, 0.022, 0.022, 0.005, stove);
  rb(M.iron, 0, 0.3, -0.42, 0.26, 0.12, 0.02, 0.005, stove);
  // The flue, up and back into the breast.
  const flueZ = St.z,
    flueY = 2.02;
  rod(M.iron, [St.x, 1.5, flueZ], [St.x, flueY, flueZ], 0.1, 14);
  rod(M.iron, [St.x, flueY, flueZ], [St.x, flueY, mantelFace], 0.1, 14);
  orb(M.iron, St.x, flueY, flueZ, 0.102, 0.102, 0.102);
  torus(M.ironLight, St.x, 1.78, flueZ, 0.104, 0.008).rotation.x = Math.PI / 2;
  // The kettle on top, muttering.
  const kettle = group(St.x + 0.04, 1.54, St.z - 0.05);
  turned(M.pewter, [[0, 0], [0.17, 0], [0.2, 0.05], [0.2, 0.13], [0.14, 0.2], [0.05, 0.22], [0, 0.23]], 0, 0, 0, 16, kettle);
  orb(M.black, 0, 0.25, 0, 0.022, 0.022, 0.022, kettle);
  const kettleHandle = torus(M.iron, 0, 0.21, 0, 0.14, 0.009, kettle, Math.PI);
  kettleHandle.castShadow = false;
  tube(M.pewter, [[0.17, 0.08, 0], [0.26, 0.14, 0], [0.31, 0.2, 0]], 0.016, kettle);
  // The coal scuttle and the poker and tongs.
  const scuttle = group(St.x + 0.82, 0.05, St.z + 0.02, -0.3);
  turned(M.ironLight, [[0.14, 0], [0.19, 0.2], [0.2, 0.34]], 0, 0, 0, 12, scuttle);
  cyl(M.black, 0, 0.3, 0, 0.18, 0.05, 0.18, scuttle, 12);
  for (let i = 0; i < 9; i++) orb(M.black, range(-0.1, 0.1), 0.34 + range(0, 0.05), range(-0.1, 0.1), 0.045, 0.04, 0.045);
  torus(M.iron, 0, 0.42, 0, 0.17, 0.008, scuttle, Math.PI).rotation.y = 0.5;
  for (const dx of [0, 0.09]) {
    const tool = rod(M.iron, [St.x - 0.9 + dx, 0.06, St.z + 0.3], [St.x - 0.96 + dx, 0.9, St.z + 0.42], 0.012, 5);
    tool.castShadow = false;
    orb(M.brass, St.x - 0.96 + dx, 0.92, St.z + 0.42, 0.024, 0.024, 0.024);
  }

  // ----------------------------------------------------- Bram's armchair corner
  const A0 = P.armchair,
    chair = group(A0.x, 0, A0.z, A0.rotation);
  const seatH = 0.78;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(M.beam, sx * 0.5, 0.09, sz * 0.46, 0.05, 0.18, 0.04, chair, 8);
  rb(M.leather, 0, 0.42, 0, 1.2, 0.48, 1.1, 0.07, chair);
  rb(M.leatherDark, 0, seatH - 0.08, 0.04, 0.84, 0.2, 0.92, 0.08, chair);
  rb(M.leather, 0, seatH + 0.02, 0.08, 0.82, 0.14, 0.86, 0.06, chair);
  rb(M.leather, 0, 1.35, -0.46, 1.16, 1.25, 0.28, 0.1, chair);
  rb(M.leatherDark, 0, 1.28, -0.31, 0.82, 0.96, 0.14, 0.06, chair);
  for (const side of [-1, 1]) {
    rb(M.leather, side * 0.52, 0.86, 0.03, 0.22, 0.44, 1.08, 0.08, chair);
    orb(M.leatherDark, side * 0.52, 0.94, 0.56, 0.12, 0.12, 0.08, chair);
  }
  // A cushion gone flat, and a crocheted square on the headrest.
  rb(M.tweed, 0.05, 1.08, -0.2, 0.56, 0.42, 0.14, 0.06, chair).rotation.x = -0.2;
  rb(M.paperWhite, 0, 1.76, -0.32, 0.44, 0.3, 0.012, 0.004, chair);
  // The rag rug by the fire.
  const rug = decal(A.rug, St.x - 0.15, 0.013, -5.25, 2.6, 1.5, 0, root, -Math.PI / 2);
  rug.receiveShadow = true;
  // The side table: a mug, a book face down, spectacles, a plate for Finn's loaf.
  const Ta = P.sideTable,
    tableH = 0.98;
  cyl(M.mahogany, Ta.x, tableH - 0.02, Ta.z, Ta.r, 0.04, Ta.r, root, 24);
  turned(M.mahoganyDark, [[0.05, 0], [0.12, 0.06], [0.04, 0.12], [0.05, 0.5], [0.03, 0.8], [0.06, tableH - 0.04]], Ta.x, 0, Ta.z, 12);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    rod(M.mahoganyDark, [Ta.x, 0.2, Ta.z], [Ta.x + Math.cos(a) * 0.3, 0.02, Ta.z + Math.sin(a) * 0.3], 0.02, 6);
  }
  const top = tableH;
  const plate = group(Ta.x + 0.03, top, Ta.z + 0.07);
  turned(M.china, [[0.2, 0.024], [0.18, 0.016], [0.13, 0.002], [0, 0]], 0, 0, 0, 18, plate);
  const loaf = group(Ta.x + 0.03, top + 0.02, Ta.z + 0.07, 0.6);
  orb(M.crust, 0, 0.055, 0, 0.14, 0.075, 0.095, loaf);
  cyl(M.crumb, 0.135, 0.055, 0, 0.082, 0.012, 0.082, loaf, 12).rotation.z = Math.PI / 2;
  rod(M.pewter, [-0.08, 0.135, 0.09], [0.2, 0.012, -0.11], 0.006, 4, loaf);
  mergeGroup(loaf);
  keep.add(loaf);
  loaf.visible = false;
  // The mug, on the far side.
  cyl(M.oxblood, Ta.x - 0.18, top + 0.07, Ta.z - 0.12, 0.05, 0.13, 0.055, root, 12);
  torus(M.oxblood, Ta.x - 0.12, top + 0.07, Ta.z - 0.12, 0.028, 0.008);
  b(M.doorGreen, Ta.x + 0.09, top + 0.012, Ta.z - 0.18, 0.24, 0.022, 0.18).rotation.y = 0.3;
  // Pegs on the wall: his spare jacket and the satchel.
  const pegZ = -5.62;
  rb(M.mahogany, -W + 0.03, 2.98, pegZ - 0.05, 0.03, 0.09, 1.3, 0.008);
  for (const dz of [-0.48, -0.02, 0.42]) rod(M.brass, [-W + 0.04, 2.98, pegZ + dz], [-W + 0.12, 3.01, pegZ + dz], 0.012, 6);
  const jacket = group(-W + 0.09, 2.98, pegZ - 0.48);
  const coat = new T.Shape();
  coat.moveTo(-0.1, 0);
  for (const [a, c] of [[-0.3, -0.07], [-0.44, -0.2], [-0.47, -0.45], [-0.46, -1.06], [-0.33, -1.06], [-0.32, -0.5], [-0.33, -1.3], [0.33, -1.3], [0.32, -0.5], [0.33, -1.06], [0.46, -1.06], [0.47, -0.45], [0.44, -0.2], [0.3, -0.07], [0.1, 0]])
    coat.lineTo(a, c);
  coat.closePath();
  const coatBody = mesh(new T.ExtrudeGeometry(coat, { depth: 0.09, bevelEnabled: true, bevelSize: 0.018, bevelThickness: 0.018, bevelSegments: 2, curveSegments: 4 }), M.jacket, 0, 0, 0, jacket);
  coatBody.rotation.y = Math.PI / 2;
  // Collar, the line where it buttons, two pocket flaps.
  rb(parts.mat("#34485c", 0.9), 0.1, -0.1, 0, 0.03, 0.2, 0.34, 0.012, jacket);
  b(parts.mat("#34485c", 0.9), 0.112, -0.72, 0.03, 0.006, 1.14, 0.012, jacket);
  for (const side of [-1, 1]) b(parts.mat("#34485c", 0.9), 0.116, -0.92, side * 0.18, 0.012, 0.09, 0.22, jacket);
  for (let i = 0; i < 4; i++) orb(M.brass, 0.118, -0.32 - i * 0.26, -0.015, 0.014, 0.02, 0.02, jacket);
  const satchel = group(-W + 0.1, 2.98, pegZ + 0.42);
  tube(M.beam, [[0, 0, 0], [0.02, -0.5, -0.17], [0.02, -0.85, 0], [0.02, -0.5, 0.17], [0, 0, 0]], 0.012, satchel);
  rb(M.tweed, 0.03, -1.03, 0, 0.17, 0.46, 0.56, 0.05, satchel);
  rb(M.beam, 0.115, -0.91, 0, 0.012, 0.24, 0.52, 0.006, satchel);
  rb(M.brass, 0.125, -0.98, 0, 0.012, 0.06, 0.08, 0.004, satchel);

  // ---------------------------------------------------------- the mail sacks
  const K = P.sacks,
    sackRail = K.minX + 0.12,
    frameZ = wallFace - 0.38,
    rackY = 2.82;
  for (const x of [K.minX + 0.04, K.maxX - 0.04]) {
    rod(M.iron, [x, 0, frameZ + 0.3], [x, rackY, frameZ + 0.3], 0.018, 8);
    rod(M.iron, [x, 0, frameZ - 0.3], [x, rackY, frameZ - 0.3], 0.018, 8);
    rod(M.iron, [x, rackY, frameZ + 0.3], [x, rackY, frameZ - 0.3], 0.016, 6);
    rod(M.iron, [x, 0.9, frameZ + 0.3], [x, 0.9, frameZ - 0.3], 0.012, 6);
  }
  for (const z of [frameZ - 0.3, frameZ + 0.3]) rod(M.iron, [K.minX + 0.04, rackY, z], [K.maxX - 0.04, rackY, z], 0.016, 6);
  const sackProfile = [[0.01, 0], [0.22, 0.02], [0.33, 0.14], [0.36, 0.5], [0.34, 1.0], [0.31, 1.45], [0.28, 1.86], [0.29, 1.92]];
  for (let i = 0; i < 4; i++) {
    const sx = sackRail + 0.28 + i * ((K.maxX - K.minX - 0.8) / 3),
      height = rackY - 2.02 - 0.03,
      sack = turned(i % 3 === 2 ? M.canvasDark : M.canvas, sackProfile, sx, height, frameZ, 18);
    const pos = sack.geometry.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v),
        y = pos.getY(v),
        z = pos.getZ(v),
        wobble = 1 + Math.sin(y * 7 + i + Math.atan2(z, x) * 3) * 0.05 * Math.min(1, (1.92 - y) * 2);
      pos.setXYZ(v, x * wobble, y, z * wobble);
    }
    sack.geometry.computeVertexNormals();
    // The rope hoop that holds its mouth open, on four hooks.
    const hoop = torus(M.string, sx, rackY - 0.09, frameZ, 0.29, 0.012);
    hoop.rotation.x = Math.PI / 2;
    for (const dz of [-1, 1]) rod(M.iron, [sx, rackY, frameZ + dz * 0.3], [sx, rackY - 0.1, frameZ + dz * 0.28], 0.007, 4);
    // The dark inside.
    cyl(M.holeBack, sx, rackY - 0.28, frameZ, 0.26, 0.01, 0.26, root, 14).castShadow = false;
    const stencil = mesh(new T.PlaneGeometry(0.5, 0.235), M.sackStencils[i % 2], sx, height + 0.9, frameZ - 0.345);
    stencil.rotation.y = Math.PI;
    stencil.castShadow = stencil.receiveShadow = false;
  }
  // Two full ones, tied at the neck, on the floor.
  const fatSack = (x, z, turn, material) => {
    const g = group(x, 0, z, turn);
    const s = orb(material, 0, 0.36, 0, 0.32, 0.36, 0.28, g);
    s.castShadow = true;
    cyl(material, 0, 0.74, 0, 0.1, 0.1, 0.06, g, 10);
    torus(M.string, 0, 0.72, 0, 0.065, 0.012, g).rotation.x = Math.PI / 2;
    turned(material, [[0.06, 0], [0.13, 0.08], [0.16, 0.13]], 0, 0.76, 0, 10, g);
  };
  fatSack(K.minX + 0.34, wallFace - 0.72, 0.4, M.canvasDark);
  fatSack(K.maxX - 0.42, wallFace - 0.72, -0.8, M.canvas);

  // ------------------------------------------------------------- the hamper
  const Hm = P.hamper,
    hamper = group(Hm.x, 0, Hm.z, Hm.rotation),
    bottom = 0.22,
    high = 0.88;
  const hw = Hm.w - 0.06,
    hd = Hm.d - 0.06;
  b(M.wicker, 0, bottom + high / 2, hd / 2, hw, high, 0.03, hamper);
  b(M.wicker, 0, bottom + high / 2, -hd / 2, hw, high, 0.03, hamper);
  b(M.wicker, hw / 2, bottom + high / 2, 0, 0.03, high, hd, hamper);
  b(M.wicker, -hw / 2, bottom + high / 2, 0, 0.03, high, hd, hamper);
  b(M.wicker, 0, bottom + 0.02, 0, hw, 0.04, hd, hamper);
  for (const sz of [-1, 1]) rb(M.beam, 0, bottom + high, (sz * hd) / 2, hw + 0.08, 0.05, 0.06, 0.012, hamper);
  for (const sx of [-1, 1]) rb(M.beam, (sx * hw) / 2, bottom + high, 0, 0.06, 0.05, hd + 0.08, 0.012, hamper);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const px = (sx * (hw - 0.1)) / 2,
      pz = (sz * (hd - 0.1)) / 2;
    rod(M.iron, [px, bottom, pz], [px, 0.1, pz], 0.012, 5, hamper);
    const wheel = cyl(M.iron, px, 0.085, pz, 0.08, 0.05, 0.08, hamper, 12);
    wheel.rotation.z = Math.PI / 2;
  }
  // Stuffed: a canvas lining, parcels and letters spilling up out of it.
  const lining = orb(M.canvas, 0, bottom + high - 0.08, 0, hw / 2 - 0.03, 0.14, hd / 2 - 0.03, hamper);
  lining.castShadow = false;
  const tones = [M.paperWhite, M.paperBuff, M.paperBlue, M.paperRose];
  for (let i = 0; i < 26; i++) {
    const letter = b(tones[i % 4], range(-hw / 2 + 0.15, hw / 2 - 0.15), bottom + high + range(0, 0.12), range(-hd / 2 + 0.12, hd / 2 - 0.12), 0.26, 0.012, 0.17, hamper);
    letter.rotation.set(range(-0.5, 0.5), random() * 3, range(-0.5, 0.5));
  }
  parcel(parts, M, Hm.x - 0.2, bottom + high + 0.1, Hm.z, 0.44, 0.26, 0.3, 0.3, 0, decal);

  // --------------------------------------------------- the packing bench
  const Pk = P.workbench,
    pW = Pk.maxX - Pk.minX,
    pX = (Pk.minX + Pk.maxX) / 2,
    pZ = back + Pk.depth / 2,
    pH = Pk.height;
  rb(M.pine, pX, pH - 0.04, pZ, pW, 0.08, Pk.depth, 0.014);
  for (const x of [Pk.minX + 0.08, Pk.maxX - 0.08]) for (const z of [back + 0.08, back + Pk.depth - 0.08]) b(M.beam, x, (pH - 0.08) / 2, z, 0.09, pH - 0.08, 0.09);
  rb(M.pine, pX, 0.34, pZ, pW - 0.1, 0.05, Pk.depth - 0.1, 0.008);
  for (let i = 0; i < 4; i++) rod(M.parcels[i % 3], [Pk.minX + 0.2, 0.42 + (i > 2 ? 0.1 : 0), back + 0.15 + i * 0.15], [Pk.minX + 1.5, 0.42 + (i > 2 ? 0.1 : 0), back + 0.15 + i * 0.15], 0.058, 10);
  const on2 = pH + 0.002;
  // Half-wrapped: a box on a spread sheet of paper, string waiting.
  b(M.parcels[2], pX - 0.28, on2 + 0.003, pZ, 0.9, 0.006, 0.54);
  b(M.pine, pX - 0.28, on2 + 0.13, pZ, 0.42, 0.25, 0.3);
  orb(M.twine, pX + 0.42, on2 + 0.09, pZ - 0.06, 0.09, 0.09, 0.09);
  tube(M.string, [[pX + 0.34, on2 + 0.05, pZ - 0.02], [pX + 0.2, on2 + 0.008, pZ + 0.08], [pX - 0.02, on2 + 0.02, pZ + 0.2], [pX - 0.1, on2 + 0.13, pZ + 0.15]], 0.005);
  // Scissors, the seal and the wax, a candle to melt it by.
  for (const side of [-1, 1]) {
    rod(M.ironLight, [pX + 0.68, on2 + 0.008, pZ + 0.16], [pX + 0.84 + side * 0.04, on2 + 0.008, pZ + 0.27], 0.008, 4);
    rod(M.ironLight, [pX + 0.68, on2 + 0.008, pZ + 0.16], [pX + 0.56 - side * 0.03, on2 + 0.008, pZ + 0.05], 0.005, 4);
  }
  rod(M.wax, [pX + 0.5, on2 + 0.012, pZ - 0.22], [pX + 0.76, on2 + 0.012, pZ - 0.15], 0.012, 6);
  turned(M.beam, [[0.03, 0], [0.02, 0.02], [0.02, 0.09], [0.035, 0.13], [0, 0.15]], pX + 0.75, on2, pZ + 0.02, 10);
  cyl(M.china, pX + 0.9, on2 + 0.012, pZ - 0.04, 0.06, 0.02, 0.06, root, 12);
  cyl(M.paperWhite, pX + 0.9, on2 + 0.07, pZ - 0.04, 0.016, 0.11, 0.014, root, 8);
  // On the sill, a jam jar of rubber bands.
  const sillY = P.rearWindow.y[0] - 0.01;
  cyl(M.paperBlue, pX - 0.72, sillY + 0.08, back + 0.1, 0.05, 0.14, 0.05, root, 10);
  // Crates in the corner, each stencilled, with one lid off.
  const K2 = P.crates,
    cCx = (K2.minX + K2.maxX) / 2;
  crate(parts, M, cCx, 0.28, back + K2.depth / 2 - 0.02, K2.maxX - K2.minX, 0.56, K2.depth - 0.04, 0.02);
  crate(parts, M, cCx + 0.03, 0.81, back + K2.depth / 2 - 0.04, K2.maxX - K2.minX - 0.16, 0.5, K2.depth - 0.12, -0.05);
  orb(M.twine, cCx - 0.2, 1.16, back + 0.3, 0.1, 0.1, 0.1);

  // ------------------------------------------------------- the red bicycle
  const Bk = P.bicycle,
    bike = group(Bk.x, 0, Bk.z, 0);
  const lean = group(-0.12, 0, 0, 0, bike);
  lean.rotation.z = -0.13;
  const R = 0.56,
    half = 0.82,
    wheelAt = (z) => {
      const g = group(0, R, z, Math.PI / 2, lean);
      torus(M.rubber, 0, 0, 0, R - 0.02, 0.026, g);
      torus(M.pewter, 0, 0, 0, R - 0.052, 0.012, g);
      cyl(M.pewter, 0, 0, 0, 0.04, 0.09, 0.04, g, 10).rotation.x = Math.PI / 2;
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        rod(M.pewter, [Math.cos(a) * 0.03, Math.sin(a) * 0.03, 0], [Math.cos(a) * (R - 0.05), Math.sin(a) * (R - 0.05), 0], 0.0028, 3, g);
      }
    };
  wheelAt(-half);
  wheelAt(half);
  const paint = M.post,
    bottomBracket = [0, 0.38, 0.0],
    saddleTube = [0, 1.22, -0.26],
    headTop = [0, 1.32, 0.56],
    headBottom = [0, 1.06, 0.66],
    frontAxle = [0, R, half],
    rearAxle = [0, R, -half];
  rod(paint, bottomBracket, saddleTube, 0.022, 8, lean);
  rod(paint, saddleTube, headTop, 0.022, 8, lean);
  rod(paint, bottomBracket, headBottom, 0.026, 8, lean);
  rod(paint, headTop, headBottom, 0.028, 8, lean);
  for (const side of [-1, 1]) {
    rod(paint, [side * 0.04, 0.38, 0], [side * 0.05, R, -half], 0.011, 6, lean);
    rod(paint, [side * 0.03, 1.2, -0.26], [side * 0.05, R, -half], 0.009, 6, lean);
    rod(paint, [side * 0.02, 1.06, 0.66], [side * 0.05, R, half], 0.013, 6, lean);
  }
  // Mudguards, in the same red.
  for (const z of [-half, half]) {
    const guard = torus(paint, 0, R, z, R + 0.05, 0.02, lean, Math.PI * 0.86);
    guard.rotation.y = Math.PI / 2;
    guard.rotation.z = z < 0 ? 0.42 : -0.05;
  }
  // Saddle on sprung seat post, chain guard, cranks and pedals.
  rod(M.pewter, saddleTube, [0, 1.36, -0.3], 0.015, 6, lean);
  rb(M.leatherDark, 0, 1.4, -0.34, 0.2, 0.07, 0.36, 0.03, lean);
  tube(M.pewter, [[-0.06, 1.36, -0.46], [-0.08, 1.3, -0.42], [-0.04, 1.34, -0.34]], 0.006, lean);
  tube(M.pewter, [[0.06, 1.36, -0.46], [0.08, 1.3, -0.42], [0.04, 1.34, -0.34]], 0.006, lean);
  const guard = rb(paint, -0.055, 0.45, -0.42, 0.015, 0.14, 0.84, 0.03, lean);
  guard.rotation.x = -0.1;
  const crank = torus(M.iron, -0.05, 0.38, 0, 0.1, 0.015, lean);
  crank.rotation.y = Math.PI / 2;
  rod(M.pewter, [-0.05, 0.38, 0], [-0.06, 0.2, 0.08], 0.01, 5, lean);
  rb(M.rubber, -0.14, 0.2, 0.08, 0.13, 0.024, 0.08, 0.006, lean);
  rod(M.pewter, [0.05, 0.38, 0], [0.06, 0.56, -0.08], 0.01, 5, lean);
  rb(M.rubber, 0.14, 0.56, -0.08, 0.13, 0.024, 0.08, 0.006, lean);
  // Handlebars with grips and the bell.
  rod(M.pewter, headTop, [0, 1.46, 0.53], 0.014, 6, lean);
  rod(M.pewter, [-0.3, 1.5, 0.5], [0.3, 1.5, 0.5], 0.012, 6, lean);
  rod(M.pewter, [0, 1.46, 0.53], [0, 1.5, 0.5], 0.012, 6, lean);
  for (const side of [-1, 1]) rod(M.rubber, [side * 0.24, 1.5, 0.5], [side * 0.36, 1.5, 0.46], 0.018, 6, lean);
  turned(M.brass, [[0.044, -0.008], [0.044, 0], [0.035, 0.03], [0.012, 0.04]], -0.13, 1.54, 0.5, 10, lean);
  // The big front basket, full of the afternoon's round, and the PO plate.
  const basket = group(0, 1.14, 0.98, 0, lean);
  b(M.wicker, 0, 0, 0.18, 0.56, 0.28, 0.02, basket);
  b(M.wicker, 0, 0, -0.18, 0.56, 0.28, 0.02, basket);
  b(M.wicker, 0.28, 0, 0, 0.02, 0.28, 0.36, basket);
  b(M.wicker, -0.28, 0, 0, 0.02, 0.28, 0.36, basket);
  b(M.wicker, 0, -0.14, 0, 0.56, 0.02, 0.36, basket);
  rod(M.iron, [0.2, -0.14, -0.1], [0.05, -0.5, -0.2], 0.008, 4, basket);
  rod(M.iron, [-0.2, -0.14, -0.1], [-0.05, -0.5, -0.2], 0.008, 4, basket);
  bundle(parts, M, 0, 0.03, 1.0, 0.34, 0.24, 6, 0.1);
  parcelIn(basket);
  function parcelIn(parent) {
    b(M.parcels[2], -0.08, 0.1, -0.03, 0.26, 0.2, 0.2, parent).rotation.y = 0.2;
    b(M.string, -0.08, 0.1, -0.03, 0.27, 0.21, 0.008, parent).rotation.y = 0.2;
  }
  rb(M.post, 0, 0.82, 0.2, 0.02, 0.24, 0.24, 0.004, lean);

  return { needle, kettle, loaf };
}

function crate(parts, M, x, y, z, w, h, d, turn) {
  const { b, group } = parts,
    g = group(x, y, z, turn);
  b(M.pine, 0, 0, 0, w - 0.04, h - 0.04, d - 0.04, g);
  for (const dy of [-1, 1]) {
    b(M.beam, 0, (dy * (h - 0.05)) / 2, d / 2 - 0.01, w, 0.05, 0.02, g);
    b(M.beam, w / 2 - 0.01, (dy * (h - 0.05)) / 2, 0, 0.02, 0.05, d, g);
  }
  for (const dx of [-1, 1]) b(M.beam, (dx * (w - 0.05)) / 2, 0, d / 2 - 0.01, 0.05, h, 0.02, g);
}
