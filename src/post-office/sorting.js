import { FIXTURES as F, PIGEON_HOLE, POST_OFFICE as P, pigeonholeAt } from "./layout.js";
import { bundle } from "./counter.js";

// Behind the counter: the great sorting frame with a cabinet of little drawers
// under it (and a pigeon in one of its holes), the sorting table under the west
// window, the telegraph desk under the east one, the stationery dresser, and the
// clock over the back room's door. Returns what moves.
export function buildSorting(parts, surfaces, keep) {
  const { b, rb, rod, cyl, orb, torus, turned, tube, group, random, range, beam, mergeGroup, root } = parts;
  const { M, A, decal, disc } = surfaces;
  const f = P.frame,
    width = f.maxX - f.minX,
    midX = (f.minX + f.maxX) / 2,
    wallFace = P.partition + P.wall / 2,
    depth = f.front - wallFace,
    midZ = (f.front + wallFace) / 2,
    top = f.bottom + f.rows * f.rowH;

  // ---------------------------------------------------------- drawers below it
  const drawerRows = 3,
    drawerH = (f.bottom - 0.2) / drawerRows;
  b(M.mahoganyDark, midX, 0.1, midZ, width + 0.06, 0.2, depth + 0.05);
  b(M.mahogany, midX, f.bottom / 2 + 0.1, midZ, width, f.bottom - 0.2, depth - 0.02);
  for (let row = 0; row < drawerRows; row++)
    for (let col = 0; col < f.cols; col++) {
      const x = f.minX + (col + 0.5) * f.cell,
        y = 0.2 + (row + 0.5) * drawerH;
      rb(M.mahogany, x, y, f.front + 0.012, f.cell - 0.035, drawerH - 0.035, 0.03, 0.006);
      b(M.brassDull, x, y + 0.045, f.front + 0.03, 0.15, 0.056, 0.006);
      decal(A.drawerLabels[(row * 5 + col * 3) % A.drawerLabels.length], x, y + 0.045, f.front + 0.034, 0.13, 0.044);
      // The brass cup pull.
      b(M.brass, x, y - 0.045, f.front + 0.038, 0.13, 0.034, 0.024);
    }
  rb(M.mahogany, midX, f.bottom - 0.005, midZ + 0.04, width + 0.12, 0.05, depth + 0.1, 0.012);

  // --------------------------------------------------------- the pigeonholes
  b(M.holeBack, midX, (f.bottom + top) / 2, wallFace + 0.02, width, top - f.bottom, 0.04);
  for (let col = 0; col <= f.cols; col++)
    b(M.pine, f.minX + col * f.cell, (f.bottom + top) / 2, midZ + 0.01, 0.024, top - f.bottom, depth - 0.02);
  for (let row = 0; row <= f.rows; row++)
    b(M.pine, midX, f.bottom + row * f.rowH, midZ + 0.01, width, 0.024, depth - 0.02);
  // Each row's label strip along its shelf's edge.
  for (let row = 0; row < f.rows; row++) {
    const y = top - (row + 1) * f.rowH + 0.02;
    decal(A.pigeonLabels[row], midX, y, f.front + 0.012, width, 0.046);
  }
  // A crown to finish it.
  rb(M.mahogany, midX, top + 0.05, midZ + 0.03, width + 0.1, 0.1, depth + 0.08, 0.016);
  rb(M.mahoganyDark, midX, top + 0.13, midZ + 0.05, width + 0.2, 0.07, depth + 0.14, 0.014);
  // The mail: anything from nothing to a stuffed hole, standing on edge.
  const tones = [M.paperWhite, M.paperBuff, M.paperBlue, M.paperRose];
  for (let row = 0; row < f.rows; row++)
    for (let col = 0; col < f.cols; col++) {
      if (row === PIGEON_HOLE.row && col === PIGEON_HOLE.col) continue;
      const cell = pigeonholeAt(col, row),
        floor = cell.y - f.rowH / 2 + 0.014,
        roll = random();
      if (roll < 0.14) continue;
      const count = roll < 0.66 ? 1 + Math.floor(random() * 3) : 3 + Math.floor(random() * 5);
      for (let i = 0; i < count; i++) {
        const lw = f.cell - range(0.1, 0.17),
          lh = range(0.14, f.rowH - 0.16),
          letter = b(tones[Math.floor(random() * 4)], cell.x + range(-0.015, 0.015), floor + lh / 2, cell.z - 0.02 - i * 0.03, lw, lh, 0.012);
        letter.rotation.x = range(-0.1, 0.14);
        letter.rotation.z = range(-0.04, 0.04);
      }
    }

  // ------------------------------------------------- Second Class, in his hole
  const hole = pigeonholeAt(PIGEON_HOLE.col, PIGEON_HOLE.row),
    pigeon = group(hole.x, hole.y - f.rowH / 2 + 0.02, hole.z - 0.1, 0.22),
    grey = parts.mat("#8c95a2", 0.72),
    dark = parts.mat("#5d6673", 0.75),
    neck = parts.mat("#5c7f78", 0.32, 0.25),
    violet = parts.mat("#6d5a86", 0.32, 0.25),
    coral = parts.mat("#c9685a", 0.6),
    pale = parts.mat("#e9e4d7", 0.8),
    amber = parts.mat("#d98a2d", 0.3);
  // A nest of shredded forms under him.
  for (let i = 0; i < 16; i++) {
    const a = random() * Math.PI * 2,
      r = random() * 0.17,
      shred = b(tones[i % 4], Math.cos(a) * r, 0.012 + random() * 0.02, Math.sin(a) * r * 0.75, 0.1, 0.006, 0.02, pigeon);
    shred.rotation.y = random() * 3;
    shred.rotation.z = range(-0.3, 0.3);
  }
  const body = group(0, 0.035, 0, 0, pigeon);
  orb(grey, 0, 0.125, -0.01, 0.112, 0.105, 0.148, body);
  orb(grey, 0, 0.13, 0.085, 0.09, 0.09, 0.075, body);
  orb(violet, 0, 0.195, 0.082, 0.062, 0.05, 0.055, body);
  for (const side of [-1, 1]) {
    const wing = orb(dark, side * 0.098, 0.125, -0.035, 0.036, 0.085, 0.135, body);
    wing.rotation.x = -0.25;
    // The two black bars across each wing.
    for (const z of [-0.075, -0.125]) b(M.black, side * 0.128, 0.11, z, 0.008, 0.075, 0.016, body);
  }
  for (const side of [-1, 1]) {
    cyl(coral, side * 0.044, 0.016, 0.05, 0.009, 0.05, 0.009, pigeon, 5);
    b(coral, side * 0.044, 0.006, 0.075, 0.03, 0.01, 0.055, pigeon);
  }
  const tail = group(0, 0.13, -0.135, 0, body);
  b(dark, 0, 0, -0.06, 0.09, 0.024, 0.14, tail);
  b(M.black, 0, 0, -0.127, 0.092, 0.026, 0.02, tail);
  mergeGroup(tail);
  const head = group(0, 0.225, 0.1, 0, body);
  orb(neck, 0, -0.03, -0.005, 0.054, 0.06, 0.05, head);
  orb(grey, 0, 0.022, 0.012, 0.048, 0.046, 0.053, head);
  for (const side of [-1, 1]) {
    orb(amber, side * 0.038, 0.032, 0.024, 0.012, 0.012, 0.012, head);
    orb(M.black, side * 0.044, 0.032, 0.028, 0.006, 0.006, 0.006, head);
  }
  cyl(M.pewter, 0, 0.018, 0.075, 0.005, 0.038, 0.013, head, 6).rotation.x = Math.PI / 2;
  orb(pale, 0, 0.033, 0.055, 0.014, 0.01, 0.014, head);
  mergeGroup(head);
  mergeGroup(body, new Set([tail, head]));
  mergeGroup(pigeon, new Set([body]));
  keep.add(pigeon);

  // ------------------------------------------------------- the sorting table
  const t = P.table,
    tx = (t.minX + t.maxX) / 2,
    tz = (t.minZ + t.maxZ) / 2,
    th = t.height;
  rb(M.pine, tx, th - 0.04, tz, t.maxX - t.minX, 0.08, t.maxZ - t.minZ, 0.018);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) rb(M.beam, tx + sx * ((t.maxX - t.minX) / 2 - 0.12), (th - 0.08) / 2, tz + sz * ((t.maxZ - t.minZ) / 2 - 0.12), 0.11, th - 0.08, 0.11, 0.012);
  rb(M.beam, tx, 0.4, tz, t.maxX - t.minX - 0.3, 0.07, 0.07, 0.01);
  // The rail under its front edge.
  rb(M.beam, tx, th - 0.14, t.maxZ - 0.05, t.maxX - t.minX - 0.2, 0.12, 0.05, 0.01);
  // The round's bundles, each tied with a bow.
  const deck = th + 0.002;
  [
    [-4.45, -1.55, 0.36, 0.24, 5, 0.1],
    [-4.42, -1.25, 0.34, 0.22, 7, -0.2],
    [-3.92, -1.62, 0.36, 0.25, 4, 0.3],
    [-2.05, -1.25, 0.34, 0.24, 6, 0.08],
  ].forEach(([x, z, w, d, count, turn]) => bundle(parts, M, x, deck, z, w, d, count, turn));
  // A tray of loose post on edge.
  const tray = group(-2.0, deck, -1.62, -0.04);
  b(M.wicker, 0, 0.05, -0.17, 0.62, 0.1, 0.02, tray);
  b(M.wicker, 0, 0.05, 0.17, 0.62, 0.1, 0.02, tray);
  b(M.wicker, -0.31, 0.05, 0, 0.02, 0.1, 0.36, tray);
  b(M.wicker, 0.31, 0.05, 0, 0.02, 0.1, 0.36, tray);
  b(M.wicker, 0, 0.008, 0, 0.62, 0.012, 0.36, tray);
  for (let i = 0; i < 16; i++) {
    const letter = b(tones[Math.floor(random() * 4)], -0.26 + i * 0.034, 0.095, range(-0.012, 0.012), 0.022, 0.15, 0.28, tray);
    letter.rotation.z = range(-0.14, 0.14);
  }
  // The open ledger and a pen across it, the set-apart envelope, the cold tea.
  const ledgerX = -3.1;
  b(M.oxblood, ledgerX, deck + 0.02, -1.42, 0.82, 0.04, 0.56);
  decal(A.ledger, ledgerX, deck + 0.043, -1.42, 0.78, 0.52, 0, root, -Math.PI / 2);
  rod(M.black, [ledgerX + 0.16, deck + 0.052, -1.28], [ledgerX + 0.42, deck + 0.052, -1.55], 0.007, 6);
  rb(M.brass, ledgerX + 0.15, deck + 0.052, -1.27, 0.02, 0.012, 0.02, 0.003);
  decal(A.envelopes[2], -2.64, deck + 0.004, -1.2, 0.3, 0.19, 0.2, root, -Math.PI / 2);
  // A magnifying glass.
  const glassX = -3.72,
    glassZ = -1.18;
  const lens = torus(M.brass, glassX, deck + 0.012, glassZ, 0.075, 0.01);
  lens.rotation.x = Math.PI / 2;
  cyl(M.china, glassX, deck + 0.01, glassZ, 0.067, 0.004, 0.067, root, 16);
  rod(M.beam, [glassX + 0.07, deck + 0.012, glassZ + 0.05], [glassX + 0.22, deck + 0.012, glassZ + 0.16], 0.012, 6);
  // Mug and saucer of cold tea.
  const teaX = -1.6,
    teaZ = -1.2;
  cyl(M.china, teaX, deck + 0.008, teaZ, 0.09, 0.012, 0.075, root, 14);
  cyl(M.china, teaX, deck + 0.07, teaZ, 0.056, 0.11, 0.05, root, 14);
  cyl(M.tea, teaX, deck + 0.122, teaZ, 0.05, 0.003, 0.05, root, 14);
  torus(M.china, teaX + 0.066, deck + 0.07, teaZ, 0.027, 0.008);
  // The banker's lamp, its green shade over the ledger.
  const lampX = -3.1,
    lampZ = -1.72;
  cyl(M.brass, lampX, deck + 0.02, lampZ, 0.1, 0.04, 0.08, root, 14);
  rod(M.brass, [lampX, deck, lampZ], [lampX, deck + 0.42, lampZ], 0.012, 6);
  rod(M.brass, [lampX, deck + 0.42, lampZ], [lampX, deck + 0.42, lampZ + 0.12], 0.01, 6);
  const lampShade = cyl(M.shade, lampX, deck + 0.42, lampZ + 0.12, 0.09, 0.42, 0.09, root, 12);
  lampShade.rotation.z = Math.PI / 2;
  lampShade.scale.z = 1;
  const lampBulb = cyl(M.bulb, lampX, deck + 0.375, lampZ + 0.12, 0.02, 0.34, 0.02, root, 8);
  lampBulb.rotation.z = Math.PI / 2;
  lampBulb.castShadow = false;
  // The tall stool at the table's west end, with a worn round seat.
  stool(parts, M, -5.42, -1.42, 1.0);

  // ------------------------------------------------------- the telegraph desk
  const g = P.telegraphDesk,
    gx = (g.minX + g.maxX) / 2,
    gz = (g.minZ + g.maxZ) / 2;
  rb(M.mahogany, gx, g.height - 0.04, gz, g.maxX - g.minX, 0.08, g.maxZ - g.minZ, 0.016);
  b(M.mahoganyDark, gx + 0.25, 0.65, gz, g.maxX - g.minX - 0.5, 1.2, g.maxZ - g.minZ - 0.1);
  for (let i = 0; i < 3; i++) {
    const dz = g.minZ + 0.38 + i * 0.72;
    rb(M.mahogany, g.minX + 0.235, 0.62, dz, 0.03, 0.95, 0.66, 0.008);
    b(M.brass, g.minX + 0.21, 0.82, dz, 0.018, 0.045, 0.14);
  }
  rb(M.mahoganyDark, g.minX + 0.05, 0.6, gz, 0.1, 1.2, g.maxZ - g.minZ - 0.06, 0.01);
  const desk = g.height + 0.002,
    keyX = F.telegraph.x - 0.08,
    keyZ = F.telegraph.z + 0.34;
  // The key: a brass lever on its slate, with a black knob.
  rb(M.ironLight, keyX, desk + 0.012, keyZ, 0.42, 0.024, 0.2, 0.006);
  const keyLever = group(keyX, desk + 0.075, keyZ);
  rod(M.brass, [-0.15, 0, 0], [0.14, 0, 0], 0.013, 6, keyLever);
  orb(M.black, -0.17, 0.02, 0, 0.034, 0.018, 0.034, keyLever);
  mergeGroup(keyLever);
  keep.add(keyLever);
  for (const [x, h] of [[0.03, 0.06], [0.12, 0.05], [-0.09, 0.03]]) cyl(M.brass, keyX + x, desk + 0.024 + h / 2, keyZ, 0.02, h, 0.02, root, 8);
  // The sounder: two coils, and the arm that clacks down on them.
  const soundX = F.telegraph.x - 0.08,
    soundZ = F.telegraph.z - 0.2;
  rb(M.mahoganyDark, soundX, desk + 0.018, soundZ, 0.46, 0.036, 0.26, 0.008);
  for (const dz of [-0.05, 0.05]) cyl(M.oxblood, soundX + 0.06, desk + 0.09, soundZ + dz, 0.04, 0.11, 0.04, root, 10);
  rod(M.brass, [soundX - 0.17, desk + 0.04, soundZ], [soundX - 0.17, desk + 0.16, soundZ], 0.015, 6);
  const sounder = group(soundX - 0.17, desk + 0.16, soundZ);
  rod(M.brass, [0, 0, 0], [0.33, 0, 0], 0.014, 6, sounder);
  rb(M.brassDull, 0.23, -0.016, 0, 0.1, 0.02, 0.1, 0.004, sounder);
  mergeGroup(sounder);
  keep.add(sounder);
  // Paper tape, the message pad and its pencil.
  turned(M.paperWhite, [[0, 0], [0.07, 0], [0.07, 0.02], [0, 0.02]], F.telegraph.x + 0.28, desk + 0.02, F.telegraph.z + 0.7, 14);
  tube(M.paperWhite, [[F.telegraph.x + 0.25, desk + 0.03, F.telegraph.z + 0.66], [F.telegraph.x + 0.2, desk + 0.006, F.telegraph.z + 0.45], [F.telegraph.x + 0.27, desk + 0.006, F.telegraph.z + 0.1], [F.telegraph.x + 0.2, desk + 0.006, F.telegraph.z - 0.02]], 0.005);
  b(M.paperWhite, F.telegraph.x + 0.16, desk + 0.01, F.telegraph.z - 0.62, 0.34, 0.02, 0.48);
  rod(M.oxblood, [F.telegraph.x + 0.04, desk + 0.028, F.telegraph.z - 0.5], [F.telegraph.x + 0.27, desk + 0.028, F.telegraph.z - 0.74], 0.008, 6);
  // Two glass battery jars under the east window, and the wires up the wall.
  for (const dz of [-0.92, -0.62]) {
    const jz = F.telegraph.z + dz + 0.1;
    cyl(M.paperBlue, g.maxX - 0.18, desk + 0.14, jz, 0.09, 0.28, 0.09, root, 12);
    cyl(M.pewter, g.maxX - 0.18, desk + 0.31, jz, 0.042, 0.1, 0.042, root, 8);
    rod(M.black, [g.maxX - 0.18, desk + 0.35, jz], [g.maxX - 0.03, desk + 0.6, jz], 0.004, 4);
  }
  for (const dz of [0.05, 0.11]) {
    rod(M.black, [g.maxX - 0.03, desk + 0.6, F.telegraph.z - 0.82], [g.maxX - 0.03, desk + 0.6, dz], 0.005, 4);
    rod(M.black, [g.maxX - 0.03, desk + 0.6, dz], [g.maxX - 0.03, 3.5, dz], 0.005, 4);
    turned(M.china, [[0, 0], [0.03, 0], [0.034, 0.03], [0.018, 0.05], [0.02, 0.08], [0, 0.09]], g.maxX - 0.05, 3.48, dz, 10);
  }
  stool(parts, M, 4.82, -1.42, 0.92);

  // ----------------------------------------------------------- the stationery
  const dr = P.dresser,
    dw = dr.maxX - dr.minX,
    dx = (dr.minX + dr.maxX) / 2,
    dz = (dr.front + wallFace) / 2,
    dd = dr.front - wallFace;
  b(M.mahoganyDark, dx, 0.08, dz, dw + 0.04, 0.16, dd + 0.03);
  b(M.mahogany, dx, 0.74, dz - 0.02, dw, 1.16, dd - 0.04);
  for (let i = 0; i < 3; i++) {
    const cx = dr.minX + (i + 0.5) * (dw / 3);
    rb(M.mahogany, cx, 0.74, dr.front - 0.015, dw / 3 - 0.05, 1.08, 0.03, 0.008);
    rb(M.mahoganyDark, cx, 0.74, dr.front + 0.002, dw / 3 - 0.24, 0.84, 0.012, 0.004);
    orb(M.brass, cx + (i === 1 ? 0 : (i === 0 ? 1 : -1) * 0.28), 1.0, dr.front + 0.03, 0.022, 0.022, 0.022);
  }
  rb(M.mahogany, dx, 1.35, dz + 0.01, dw + 0.06, 0.05, dd + 0.04, 0.012);
  const shelfTop = 3.5,
    backZ = wallFace + 0.02;
  b(M.mahoganyDark, dx, (1.35 + shelfTop) / 2, backZ, dw, shelfTop - 1.35, 0.03);
  for (const x of [dr.minX, dr.maxX]) b(M.mahogany, x, (1.35 + shelfTop) / 2, backZ + 0.15, 0.05, shelfTop - 1.35, 0.3);
  const shelfYs = [1.94, 2.52, 3.04];
  for (const y of shelfYs) b(M.mahogany, dx, y, backZ + 0.15, dw, 0.035, 0.3);
  rb(M.mahoganyDark, dx, shelfTop + 0.03, backZ + 0.17, dw + 0.14, 0.08, 0.38, 0.016);
  const shelfZ = backZ + 0.17;
  // On the ledge: brown-paper rolls, balls of string and sealing wax.
  rod(M.parcels[1], [dr.minX + 0.2, 1.44, shelfZ + 0.02], [dr.minX + 1.1, 1.44, shelfZ + 0.02], 0.07, 12);
  rod(M.parcels[2], [dr.minX + 0.25, 1.56, shelfZ - 0.01], [dr.minX + 1.15, 1.56, shelfZ - 0.01], 0.06, 12);
  for (let i = 0; i < 3; i++) orb(M.twine, dr.minX + 1.34 + i * 0.2, 1.47, shelfZ, 0.09, 0.09, 0.09);
  for (let i = 0; i < 5; i++) rod(M.wax, [dr.maxX - 0.42 + i * 0.02, 1.4, shelfZ - 0.06 + i * 0.03], [dr.maxX - 0.14 + i * 0.02, 1.4, shelfZ - 0.06 + i * 0.03], 0.012, 5);
  // Ink in three blues, then tins.
  for (let i = 0; i < 7; i++) {
    const x = dr.minX + 0.22 + i * 0.2,
      y = shelfYs[0] + 0.018,
      ink = [M.paperBlue, parts.mat("#2e3f6a", 0.25), parts.mat("#1e2a4a", 0.25)][i % 3];
    cyl(ink, x, y + 0.08, shelfZ, 0.05, 0.16, 0.045, root, 10);
    cyl(M.black, x, y + 0.18, shelfZ, 0.024, 0.04, 0.024, root, 8);
  }
  [0, 1, 2, 3].forEach((i) => {
    const x = dr.minX + 0.34 + i * 0.56,
      y = shelfYs[1] + 0.018;
    b(M.pewter, x, y + 0.13, shelfZ, 0.42, 0.26, 0.24);
    decal(A.tin[i], x, y + 0.13, shelfZ + 0.122, 0.34, 0.2);
    rb(M.pewter, x, y + 0.27, shelfZ, 0.43, 0.022, 0.25, 0.005);
  });
  // Eighty years of ledgers on top; the pencil jar at the end.
  decal(A.ledgerSpines, dx - 0.2, shelfYs[2] + 0.2, shelfZ + 0.1, dw - 0.68, 0.38);
  b(M.beam, dx - 0.2, shelfYs[2] + 0.2, shelfZ - 0.02, dw - 0.68, 0.38, 0.24);
  cyl(M.terracotta, dr.maxX - 0.22, shelfYs[2] + 0.1, shelfZ, 0.08, 0.18, 0.09, root, 10);
  for (let i = 0; i < 5; i++) rod(i % 2 ? M.oxblood : M.doorGreen, [dr.maxX - 0.22, shelfYs[2] + 0.1, shelfZ], [dr.maxX - 0.22 + range(-0.05, 0.05), shelfYs[2] + 0.34, shelfZ + range(-0.05, 0.05)], 0.006, 5);

  // ------------------------------------------------- the clock over the door
  const clockX = (P.backDoor.x[0] + P.backDoor.x[1]) / 2,
    clockY = 3.74,
    clockZ = wallFace + 0.05,
    clockR = 0.42;
  const dialCase = cyl(M.mahogany, clockX, clockY, clockZ, clockR + 0.06, 0.08, clockR + 0.06, root, 40);
  dialCase.rotation.x = Math.PI / 2;
  const dialRim = torus(M.brass, clockX, clockY, clockZ + 0.045, clockR, 0.018);
  dialRim.castShadow = false;
  disc(A.clockFace, clockX, clockY, clockZ + 0.042, clockR);
  // The drop below the dial, with a window on the pendulum's swing.
  rb(M.mahogany, clockX, clockY - clockR - 0.17, clockZ - 0.01, 0.46, 0.46, 0.09, 0.016);
  b(M.holeBack, clockX, clockY - clockR - 0.17, clockZ + 0.036, 0.34, 0.34, 0.006);
  const face = clockZ + 0.052;
  const minute = group(clockX, clockY, face + 0.004);
  beam(M.black, [0, -0.04, 0], [0, 0.33, 0], 0.012, minute);
  keep.add(minute);
  const hour = group(clockX, clockY, face + 0.008);
  beam(M.black, [0, -0.03, 0], [0, 0.21, 0], 0.017, hour);
  keep.add(hour);
  orb(M.black, clockX, clockY, face + 0.012, 0.018, 0.018, 0.008);
  const pendulum = group(clockX, clockY - clockR + 0.02, clockZ + 0.043);
  rod(M.brassDull, [0, 0, 0], [0, -0.3, 0], 0.005, 4, pendulum);
  cyl(M.brass, 0, -0.32, 0, 0.038, 0.012, 0.038, pendulum, 14).rotation.x = Math.PI / 2;
  mergeGroup(pendulum);
  keep.add(pendulum);

  return { pigeon, head, tail, body, keyLever, sounder, minute, hour, pendulum };
}

/** A tall round stool with a footring. */
export function stool(parts, M, x, z, h) {
  const { rb, rod, cyl, torus, group, root } = parts,
    g = group(x, 0, z, 0.4, root);
  cyl(M.beam, 0, h - 0.035, 0, 0.27, 0.07, 0.29, g, 18);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    rod(M.beam, [Math.cos(a) * 0.14, h - 0.08, Math.sin(a) * 0.14], [Math.cos(a) * 0.27, 0, Math.sin(a) * 0.27], 0.024, 6, g);
  }
  const ring = torus(M.iron, 0, h * 0.34, 0, 0.21, 0.012, g);
  ring.rotation.x = Math.PI / 2;
  rb(M.tweed, 0, h + 0.008, 0, 0.42, 0.02, 0.42, 0.008, g);
  return g;
}
