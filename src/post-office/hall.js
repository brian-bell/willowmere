import * as T from "three";
import { FIXTURES as F, POST_OFFICE as P } from "./layout.js";
import { parcel } from "./counter.js";

// The public side: the wall of boxes, the writing desk under the district map,
// the notice board over the bench, the telephone, the poster and the stamp
// series between the window and the door, the postcard rack, the penny scale,
// the window's display, and the bell on its spring. Returns what moves.
export function buildHall(parts, surfaces, keep) {
  const { b, rb, rod, cyl, orb, torus, turned, tube, group, range, leaf, mesh, mergeGroup, root } = parts;
  const { M, A, decal, disc, clearDecal, boxFaces } = surfaces;
  const W = P.halfW,
    front = P.front;

  // ------------------------------------------------------- the wall of boxes
  const B = P.boxes,
    bw = B.cols * B.cell,
    bh = B.rows * B.cell,
    faceX = W - B.depth,
    midX = W - B.depth / 2;
  // The cabinet: a plinth and panelled base, the face, and a crown.
  rb(M.mahoganyDark, midX, 0.1, B.z, B.depth + 0.03, 0.2, bw + 0.2, 0.012);
  rb(M.mahogany, midX, B.bottom / 2 + 0.05, B.z, B.depth, B.bottom - 0.1, bw + 0.14, 0.012);
  for (let i = 0; i < 4; i++) {
    const z = B.z - bw / 2 + (i + 0.5) * (bw / 4);
    rb(M.mahoganyDark, faceX - 0.008, 0.56, z, 0.016, 0.56, bw / 4 - 0.14, 0.004);
    rb(M.mahogany, faceX - 0.018, 0.56, z, 0.018, 0.42, bw / 4 - 0.28, 0.004);
  }
  rb(M.mahogany, midX, B.bottom + bh / 2, B.z, B.depth, bh + 0.08, bw + 0.14, 0.012);
  rb(M.mahoganyDark, midX - 0.02, B.bottom + bh + 0.08, B.z, B.depth + 0.06, 0.08, bw + 0.26, 0.016);
  rb(M.mahogany, midX - 0.03, B.bottom + bh + 0.15, B.z, B.depth + 0.04, 0.06, bw + 0.34, 0.016);
  // Each brass door; numbers, windows and keyholes are one sheet laid over them.
  for (let row = 0; row < B.rows; row++)
    for (let col = 0; col < B.cols; col++) {
      if (col === B.mine.col && row === B.mine.row) continue;
      const z = B.z - bw / 2 + (col + 0.5) * B.cell,
        y = B.bottom + (B.rows - row - 0.5) * B.cell;
      b(M.brassFlat, faceX - 0.008, y, z, 0.016, B.cell - 0.05, B.cell - 0.05);
      b(M.brass, faceX - 0.024, y - B.cell * 0.31, z + B.cell * 0.27, 0.02, 0.018, 0.04);
    }
  clearDecal(1024, 768, boxFaces, faceX - 0.018, B.bottom + bh / 2, B.z, bw, bh, -Math.PI / 2);
  // Your own box: a dark mouth, and a door on real hinges.
  const mineZ = B.z - bw / 2 + (B.mine.col + 0.5) * B.cell,
    mineY = B.bottom + (B.rows - B.mine.row - 0.5) * B.cell,
    mouth = b(M.holeBack, faceX - 0.002, mineY, mineZ, 0.006, B.cell - 0.05, B.cell - 0.05);
  mouth.castShadow = false;
  decal(A.envelopes[3], faceX - 0.008, mineY - 0.02, mineZ, 0.26, 0.17, -Math.PI / 2);
  const hingeZ = mineZ - (B.cell - 0.05) / 2,
    myDoor = group(faceX - 0.016, mineY, hingeZ);
  const doorFace = b(M.brassFlat, 0, 0, (B.cell - 0.05) / 2, 0.018, B.cell - 0.05, B.cell - 0.05, myDoor);
  doorFace.castShadow = false;
  b(M.brass, -0.016, -B.cell * 0.31, B.cell * 0.27 + (B.cell - 0.05) / 2, 0.02, 0.018, 0.04, myDoor);
  decal(A.myBox, -0.0105, 0, (B.cell - 0.05) / 2, B.cell - 0.05, B.cell - 0.05, -Math.PI / 2, myDoor);
  keep.add(myDoor);

  // ---------------------------------------------------------- the writing desk
  const D = P.writingDesk,
    deskX = -W + D.depth / 2,
    deskZ = (D.minZ + D.maxZ) / 2,
    deskL = D.maxZ - D.minZ;
  for (const z of [D.minZ + 0.08, D.maxZ - 0.08, deskZ]) {
    rb(M.mahogany, deskX, (D.height - 0.1) / 2, z, D.depth - 0.1, D.height - 0.1, 0.09, 0.012);
    rb(M.mahoganyDark, deskX + 0.04, 0.1, z, D.depth - 0.02, 0.2, 0.12, 0.01);
  }
  b(M.mahoganyDark, -W + 0.07, 0.8, deskZ, 0.04, 1.2, deskL);
  rb(M.mahogany, deskX, 0.34, deskZ, D.depth - 0.16, 0.05, deskL - 0.14, 0.01);
  // A shelf of old directories under the slope.
  for (let i = 0; i < 14; i++) {
    const z = D.minZ + 0.25 + i * 0.13 + (i > 6 ? 0.08 : 0),
      h = range(0.3, 0.42);
    b([M.oxblood, M.doorGreen, M.beam, M.paperBuff][i % 4], -W + 0.33, 0.365 + h / 2, z, 0.34, h, 0.11);
  }
  // The sloping top, with its ledge, and an inkwell and a chained pen per place.
  const slope = group(deskX, D.height - 0.02, deskZ);
  slope.rotation.z = -0.15;
  rb(M.mahogany, 0, 0, 0, D.depth, 0.05, deskL, 0.012, slope);
  decal(A.ledger, 0.04, 0.028, -0.62, 0.48, 0.34, Math.PI / 2, slope, -Math.PI / 2);
  b(M.paperWhite, 0.03, 0.03, 0.46, 0.48, 0.006, 0.38, slope);
  b(M.black, 0.03, 0.034, 0.46, 0.36, 0.001, 0.003, slope);
  rb(M.mahoganyDark, D.depth / 2 + 0.012, 0.03, 0, 0.03, 0.04, deskL, 0.006, slope);
  rb(M.mahogany, -W + 0.16, D.height + 0.13, deskZ, 0.26, 0.05, deskL, 0.01);
  for (const z of [D.minZ + 0.55, D.maxZ - 0.55]) {
    cyl(M.china, -W + 0.14, D.height + 0.19, z, 0.05, 0.08, 0.04, root, 12);
    cyl(M.brass, -W + 0.14, D.height + 0.235, z, 0.04, 0.012, 0.03, root, 12);
    // The pen, on its bead chain, lying where the last person let it fall.
    const px = deskX + 0.16,
      py = D.height + 0.03;
    rod(M.black, [px - 0.12, py, z - 0.16], [px + 0.12, py - 0.03, z + 0.12], 0.009, 6);
    tube(M.brassDull, [[-W + 0.28, D.height + 0.16, z], [-W + 0.5, D.height + 0.02, z + 0.04], [px - 0.1, py + 0.01, z - 0.12]], 0.0045);
  }
  // Rack of blank forms at the back.
  rb(M.mahogany, -W + 0.1, D.height + 0.34, deskZ, 0.14, 0.34, 1.0, 0.008);
  for (let i = 0; i < 4; i++) b([M.paperWhite, M.paperBuff, M.paperBlue, M.paperRose][i], -W + 0.178, D.height + 0.37, deskZ - 0.37 + i * 0.25, 0.008, 0.32, 0.22);

  // ------------------------------------------------- the map and what's framed
  const mapZ = deskZ,
    mapH = 1.46,
    mapW = (mapH * 1040) / 860,
    mapY = 2.84;
  rb(M.mahoganyDark, -W + 0.04, mapY, mapZ, 0.05, mapH + 0.14, mapW + 0.14, 0.012);
  rb(M.brassDull, -W + 0.05, mapY, mapZ, 0.05, mapH + 0.05, mapW + 0.05, 0.006);
  const sheet = mesh(new T.PlaneGeometry(mapW, mapH), M.map, -W + 0.078, mapY, mapZ);
  sheet.rotation.y = Math.PI / 2;
  sheet.castShadow = false;
  // The red pin stands proud of the paper, where the map says it is.
  const pinZ = mapZ + (0.5 - A.mapHere.u) * mapW,
    pinY = mapY + (0.5 - A.mapHere.v) * mapH;
  rod(M.iron, [-W + 0.08, pinY, pinZ], [-W + 0.16, pinY + 0.02, pinZ], 0.005, 4);
  orb(M.post, -W + 0.17, pinY + 0.022, pinZ, 0.02, 0.02, 0.02);
  // The poster on the wall by the counter, over the penny scale's shoulder.
  framed(-W + 0.03, 3.05, 1.72, 0.54, 0.76, A.savingsPoster, Math.PI / 2);

  function framed(x, y, z, w, h, rect, turn, frame = M.mahoganyDark) {
    const g = group(x, y, z, turn);
    rb(frame, 0, 0, 0, w + 0.08, h + 0.08, 0.04, 0.008, g);
    decal(rect, 0, 0, 0.024, w, h, 0, g);
    return g;
  }

  // -------------------------------------------- between the window and the door
  const face = front - 0.02;
  framed(0.3, 2.62, face, 0.74, 1.0, A.stampSheet, Math.PI);
  // The telephone: enamel sign, oak box, two bells, the receiver on its hook.
  const phone = group(F.telephone.x, 0, face, Math.PI);
  decal(A.telephoneSign, 0, 3.25, 0.012, 0.66, 0.45, 0, phone);
  b(M.ironLight, 0, 3.25, 0.004, 0.68, 0.47, 0.01, phone);
  rb(M.mahogany, 0, 2.3, 0.07, 0.44, 0.72, 0.14, 0.016, phone);
  for (const side of [-1, 1]) {
    orb(M.brass, side * 0.09, 2.54, 0.165, 0.065, 0.065, 0.04, phone);
  }
  rod(M.iron, [0, 2.5, 0.145], [0, 2.56, 0.17], 0.008, 4, phone);
  rb(M.pine, 0, 2.05, 0.2, 0.46, 0.04, 0.2, 0.008, phone);
  // A mouthpiece on its arm, the crank at the side.
  rod(M.black, [0, 2.3, 0.14], [0, 2.3, 0.28], 0.016, 8, phone);
  turned(M.black, [[0.02, 0], [0.05, 0.05], [0.05, 0.075]], 0, 2.3, 0.28, 12, phone).rotation.x = Math.PI / 2;
  rod(M.brass, [0.25, 2.16, 0.07], [0.32, 2.16, 0.07], 0.01, 6, phone);
  rod(M.brass, [0.32, 2.16, 0.07], [0.32, 2.06, 0.1], 0.008, 6, phone);
  rod(M.black, [-0.23, 2.36, 0.09], [-0.32, 2.36, 0.09], 0.01, 6, phone);
  rod(M.black, [-0.33, 2.47, 0.1], [-0.33, 2.17, 0.1], 0.024, 8, phone);
  cyl(M.black, -0.33, 2.15, 0.1, 0.05, 0.05, 0.03, phone, 12);
  tube(M.oxblood, [[-0.33, 2.47, 0.1], [-0.42, 2.25, 0.06], [-0.26, 2.0, 0.09], [-0.2, 2.1, 0.12]], 0.007, phone);
  // A directory on the shelf, its pencil on a string.
  rb(M.oxblood, 0.02, 2.09, 0.2, 0.34, 0.04, 0.17, 0.006, phone);

  // ---------------------------------------------- the notice board and the bench
  const noticeX = F.notices.x,
    boardY = 2.55,
    boardW = 2.34,
    boardH = 1.46,
    boards = group(noticeX, boardY, face, Math.PI);
  rb(M.mahoganyDark, 0, 0, 0, boardW + 0.12, boardH + 0.12, 0.05, 0.012, boards);
  const corkFace = mesh(new T.BoxGeometry(boardW, boardH, 0.02), M.cork, 0, 0, 0.022, boards);
  corkFace.castShadow = false;
  const notes = [
    { i: 0, x: -0.84, y: 0.2, w: 0.5, roll: -0.03 },
    { i: 1, x: -0.27, y: 0.26, w: 0.46, roll: 0.05 },
    { i: 2, x: 0.33, y: 0.18, w: 0.54, roll: -0.02 },
    { i: 3, x: 0.87, y: 0.3, w: 0.42, roll: 0.06 },
    { i: 4, x: -0.5, y: -0.36, w: 0.44, roll: 0.04 },
    { i: 5, x: 0.72, y: -0.36, w: 0.42, roll: -0.05 },
  ];
  for (const { i, x, y, w, roll } of notes) {
    const h = w / A.notices[i].aspect,
      pin = i % 3 === 0 ? M.post : i % 3 === 1 ? M.brass : M.doorGreen;
    decal(A.notices[i], x, y, 0.035 + i * 0.0006, w, h, 0, boards, 0, roll);
    orb(pin, x + Math.sin(roll) * (h / 2 - 0.03), y + Math.cos(roll) * (h / 2 - 0.03), 0.05, 0.016, 0.016, 0.012, boards);
  }
  decal(A.postcards[3], 0.12, -0.42, 0.036, 0.46, 0.31, 0, boards, 0, -0.04);
  orb(M.post, 0.12, -0.3, 0.05, 0.015, 0.015, 0.012, boards);
  // The bench below, a place to wait while Bram is five minutes.
  const benchZ = front - P.bench.depth / 2,
    benchX = (P.bench.minX + P.bench.maxX) / 2,
    benchL = P.bench.maxX - P.bench.minX;
  rb(M.mahogany, benchX, 0.72, benchZ, benchL, 0.06, P.bench.depth, 0.016);
  for (const x of [P.bench.minX + 0.08, P.bench.maxX - 0.08, benchX]) {
    rb(M.mahoganyDark, x, 0.34, benchZ + 0.02, 0.08, 0.68, P.bench.depth - 0.14, 0.01);
    rb(M.mahogany, x, 1.06, front - 0.05, 0.09, 0.7, 0.05, 0.01);
  }
  rb(M.mahogany, benchX, 1.33, front - 0.045, benchL, 0.12, 0.05, 0.012);
  rb(M.mahogany, benchX, 1.05, front - 0.04, benchL, 0.1, 0.03, 0.01);
  // An umbrella left on it, and a parcel beneath.
  rod(M.black, [P.bench.maxX - 0.3, 0.76, benchZ + 0.1], [P.bench.maxX - 1.02, 0.76, benchZ - 0.05], 0.032, 8);
  rod(M.brass, [P.bench.maxX - 1.02, 0.76, benchZ - 0.05], [P.bench.maxX - 1.14, 0.76, benchZ - 0.08], 0.009, 5);
  tube(M.beam, [[P.bench.maxX - 0.3, 0.76, benchZ + 0.1], [P.bench.maxX - 0.21, 0.76, benchZ + 0.13], [P.bench.maxX - 0.17, 0.8, benchZ + 0.08], [P.bench.maxX - 0.22, 0.82, benchZ + 0.05]], 0.012);
  parcel(parts, M, benchX - 0.4, 0.19, benchZ, 0.6, 0.38, 0.4, 0.1, 1, decal, A.parcelLabels[4]);

  // -------------------------------------------------- the rack of postcards
  const S = P.spinner,
    spinnerBase = group(S.x, 0, S.z);
  turned(M.iron, [[0.34, 0], [0.32, 0.03], [0.13, 0.08], [0, 0.09]], 0, 0, 0, 18, spinnerBase);
  const spinner = group(S.x, 0.1, S.z);
  rod(M.ironLight, [0, 0, 0], [0, 2.36, 0], 0.016, 8, spinner);
  const tiers = 5,
    faces = 6,
    across = 0.37,
    apothem = 0.36,
    tierY = (tier) => 0.72 + tier * 0.34;
  for (let tier = 0; tier < tiers; tier++) {
    const y = tierY(tier);
    for (let k = 0; k < faces; k++) {
      const a = (k / faces) * Math.PI * 2,
        cx = Math.sin(a) * apothem,
        cz = Math.cos(a) * apothem,
        rect = A.postcards[(k + tier * 2) % A.postcards.length];
      // A little stack of the same card, leaning in its wire pocket.
      b(M.paperWhite, cx - Math.sin(a) * 0.012, y + 0.002, cz - Math.cos(a) * 0.012, across, across / rect.aspect, 0.016, spinner).rotation.set(-0.14, a, 0, "YXZ");
      decal(rect, cx, y, cz, across, across / rect.aspect, a, spinner, -0.14);
    }
    const ring = torus(M.ironLight, 0, y - 0.135, 0, apothem + 0.05, 0.0055, spinner);
    ring.rotation.x = Math.PI / 2;
    for (let k = 0; k < faces; k++) {
      const a = ((k + 0.5) / faces) * Math.PI * 2;
      rod(M.ironLight, [0, y - 0.135, 0], [Math.sin(a) * (apothem + 0.05), y - 0.135, Math.cos(a) * (apothem + 0.05)], 0.004, 4, spinner);
    }
  }
  for (let k = 0; k < faces; k++) {
    const a = ((k + 0.5) / faces) * Math.PI * 2,
      r = apothem + 0.05;
    rod(M.ironLight, [Math.sin(a) * r, tierY(0) - 0.135, Math.cos(a) * r], [Math.sin(a) * r, tierY(tiers - 1) + 0.13, Math.cos(a) * r], 0.005, 4, spinner);
  }
  // A card on top says what they're for.
  for (const turn of [0, Math.PI]) decal(A.postcards[5], Math.sin(turn) * 0.02, 2.5, Math.cos(turn) * 0.02, 0.36, 0.24, turn, spinner);
  mergeGroup(spinner);
  keep.add(spinner);

  // ---------------------------------------------------------- the penny scale
  const Q = P.pennyScale,
    scale = group(Q.x, 0, Q.z, Math.PI / 2 - 0.35);
  rb(M.iron, 0, 0.05, 0, 0.84, 0.1, 0.84, 0.03, scale);
  rb(M.ironLight, 0, 0.11, 0.12, 0.62, 0.03, 0.46, 0.01, scale);
  rb(M.brassDull, 0, 0.13, 0.12, 0.5, 0.012, 0.36, 0.004, scale);
  turned(M.post, [[0.2, 0.1], [0.15, 0.22], [0.11, 0.32], [0.09, 1.75], [0.12, 1.85], [0.17, 1.92]], 0, 0, -0.26, 18, scale);
  const headY = 2.28,
    head = group(0, headY, -0.26, 0, scale);
  const drum = cyl(M.post, 0, 0, 0, 0.42, 0.2, 0.42, head, 32);
  drum.rotation.x = Math.PI / 2;
  const rim = torus(M.brass, 0, 0, 0.102, 0.37, 0.018, head);
  rim.castShadow = false;
  disc(A.scaleDial, 0, 0, 0.102, 0.35, head);
  cyl(M.post, 0, 0.46, 0, 0.12, 0.14, 0.05, head, 14);
  orb(M.brass, 0, 0.56, 0, 0.055, 0.055, 0.055, head);
  decal(A.scaleSign, 0, -0.6, 0.075, 0.32, 0.1, 0, head);
  const needle = group(Q.x, 0, Q.z, 0);
  needle.rotation.order = "YXZ";
  needle.rotation.y = Math.PI / 2 - 0.35;
  // The needle's pivot in the room: the dial's centre, carried by the scale's turn.
  scale.updateMatrixWorld(true);
  const centre = new T.Vector3(0, 0, 0.114);
  head.localToWorld(centre);
  needle.position.copy(centre);
  const needleArm = group(0, 0, 0, 0, needle);
  b(M.black, 0, 0.13, 0, 0.012, 0.3, 0.004, needleArm);
  orb(M.brass, 0, 0, 0, 0.022, 0.022, 0.008, needleArm);
  mergeGroup(needleArm);
  keep.add(needle);
  // A slot and a little brass tray for the fortune card.
  rb(M.brass, 0, 1.68, -0.15, 0.13, 0.05, 0.02, 0.005, scale);
  rb(M.brass, 0, 1.3, -0.15, 0.2, 0.07, 0.07, 0.006, scale);
  b(M.paperRose, 0, 1.33, -0.14, 0.14, 0.004, 0.09, scale);

  // ------------------------------------------------------ the window's display
  const win = P.bigWindow,
    shelfZ = front - P.sill.depth / 2,
    shelfX = (win.x[0] + win.x[1]) / 2,
    shelfW = win.x[1] - win.x[0] + 0.28,
    top = win.y[0] - 0.02;
  rb(M.mahogany, shelfX, top - 0.03, shelfZ, shelfW, 0.06, P.sill.depth, 0.014);
  b(M.mahogany, shelfX, (top - 0.06) / 2, shelfZ + 0.02, shelfW, top - 0.06, P.sill.depth - 0.04);
  rb(M.mahoganyDark, shelfX, 0.11, front - P.sill.depth + 0.015, shelfW, 0.22, 0.04, 0.01);
  for (let i = 0; i < 5; i++) {
    const x = win.x[0] + (i + 0.5) * ((win.x[1] - win.x[0]) / 5);
    rb(M.mahoganyDark, x, 0.53, front - P.sill.depth + 0.005, 0.86, 0.52, 0.012, 0.004);
    rb(M.mahogany, x, 0.53, front - P.sill.depth - 0.004, 0.7, 0.38, 0.018, 0.005);
  }
  // Geraniums in clay pots, leaning toward the lane.
  const geranium = (x, z, size) => {
    const g = group(x, top, z);
    turned(M.terracotta, [[size * 0.5, 0], [size * 0.68, size * 0.72], [size * 0.76, size * 0.74], [size * 0.76, size * 0.86], [size * 0.66, size * 0.86]], 0, 0, 0, 12, g);
    cyl(M.soil, 0, size * 0.82, 0, size * 0.66, 0.01, size * 0.66, g, 12);
    for (let i = 0; i < 12; i++) {
      const a = i * 2.4,
        r = range(size * 0.2, size * 0.75),
        yy = size * range(1.1, 1.9),
        tipX = Math.cos(a) * r,
        tipZ = Math.sin(a) * r + size * 0.18;
      rod(M.leafDark, [0, size * 0.85, 0], [tipX, yy, tipZ], 0.008, 4, g);
      const blade = leaf(i % 3 ? M.leaf : M.leafDark, tipX, yy, tipZ, size * 0.2, size * 0.42, g);
      blade.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(Math.cos(a), 0.5, Math.sin(a)).normalize());
    }
    for (let i = 0; i < 4; i++) {
      const a = i * 1.7 + 0.4,
        fx = Math.cos(a) * size * 0.35,
        fz = Math.sin(a) * size * 0.35 + size * 0.2,
        fy = size * range(1.95, 2.3);
      rod(M.leafDark, [0, size * 1.1, 0], [fx, fy, fz], 0.007, 4, g);
      for (let p = 0; p < 7; p++) orb(M.geranium, fx + range(-0.05, 0.05), fy + range(-0.02, 0.05), fz + range(-0.05, 0.05), 0.03, 0.03, 0.03);
    }
    return g;
  };
  geranium(-4.72, shelfZ + 0.02, 0.2);
  geranium(-0.78, shelfZ, 0.2);
  // The card in the window, on its easel; a pillar-box money box; postcards fanned.
  const wc = group(-2.4, top, shelfZ + 0.05, 0.05);
  rb(M.mahoganyDark, 0, 0.21, -0.03, 0.46, 0.34, 0.012, 0.004, wc).rotation.x = -0.18;
  decal(A.windowCard, 0, 0.21, -0.01, 0.42, 0.27, 0, wc, -0.18);
  rod(M.mahoganyDark, [-0.17, 0, -0.08], [-0.17, 0.38, -0.02], 0.01, 4, wc);
  rod(M.mahoganyDark, [0.17, 0, -0.08], [0.17, 0.38, -0.02], 0.01, 4, wc);
  const moneyBox = group(-3.56, top, shelfZ + 0.02, 0.3);
  cyl(M.post, 0, 0.17, 0, 0.1, 0.34, 0.1, moneyBox, 14);
  orb(M.post, 0, 0.34, 0, 0.105, 0.06, 0.105, moneyBox);
  b(M.black, 0, 0.27, 0.098, 0.1, 0.014, 0.012, moneyBox);
  cyl(M.black, 0, 0.012, 0, 0.115, 0.024, 0.115, moneyBox, 14);
  parcel(parts, M, -1.5, top + 0.15, shelfZ, 0.5, 0.3, 0.3, 0.2, 2, decal, A.parcelLabels[5]);
  parcel(parts, M, -1.46, top + 0.38, shelfZ + 0.01, 0.34, 0.16, 0.22, -0.2, 0);
  // Sun-faded postcards propped against the glass.
  A.postcards.slice(0, 4).forEach((rect, i) => {
    decal(rect, -3.1 + i * 0.32 - (i > 1 ? 0.0 : 0), top + 0.12 + (i % 2) * 0.03, shelfZ + 0.02 - i * 0.012, 0.3, 0.2, Math.PI, root, 0.22, (i - 1.5) * 0.05);
  });
  // The café curtain on its brass rail, under the gold leaf.
  const railY = 1.72,
    railZ = front - 0.04;
  rod(M.brass, [win.x[0] + 0.05, railY, railZ], [win.x[1] - 0.05, railY, railZ], 0.016, 8);
  for (let i = 0; i <= 3; i++) orb(M.brass, win.x[0] + 0.05 + (i * (win.x[1] - win.x[0] - 0.1)) / 3, railY, railZ, 0.024, 0.024, 0.024);
  const netW = win.x[1] - win.x[0] - 0.1,
    net = new T.PlaneGeometry(netW, railY - win.y[0], 96, 1),
    netPos = net.attributes.position;
  for (let i = 0; i < netPos.count; i++) netPos.setZ(i, Math.sin(netPos.getX(i) * 34) * 0.018 + Math.sin(netPos.getX(i) * 11) * 0.01);
  net.computeVertexNormals();
  const netMat = parts.mat("#f0e9d6", 0.92);
  netMat.side = T.DoubleSide;
  const netMesh = mesh(net, netMat, (win.x[0] + win.x[1]) / 2, (railY + win.y[0]) / 2, railZ);
  netMesh.rotation.y = Math.PI;
  netMesh.castShadow = false;

  // ------------------------------------------------- the bell on its spring
  const springX = P.door.x[1] - 0.2,
    springY = P.door.y[1] + 0.3,
    springZ = front - 0.05;
  b(M.iron, springX, springY + 0.05, springZ, 0.08, 0.08, 0.05);
  const spring = group(springX, springY, springZ - 0.02);
  const coil = [];
  for (let i = 0; i <= 22; i++) {
    const a = i * 0.95,
      f = i / 22;
    coil.push([Math.cos(a) * 0.024 * (1 - f * 0.4), -f * 0.14, Math.sin(a) * 0.024 * (1 - f * 0.4) - f * 0.09]);
  }
  tube(M.ironLight, coil, 0.0035, spring);
  const dome = group(0, -0.16, -0.1, 0, spring);
  turned(M.brass, [[0.076, -0.06], [0.07, -0.05], [0.058, 0.01], [0.03, 0.04], [0.012, 0.045]], 0, 0, 0, 14, dome);
  rod(M.iron, [0, 0, 0], [0.005, -0.075, 0], 0.005, 4, dome);
  mergeGroup(dome);
  mergeGroup(spring, new Set([dome]));
  keep.add(spring);
  return { spinner, needleArm, myDoor, spring, dome };
}
