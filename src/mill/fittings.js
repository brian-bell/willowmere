import * as T from "three";
import { MILL as K, middle } from "./layout.js";

// What the mill is furnished with: the sack hoist's chain and its sack, the
// grain bins along the back, the sacks waiting for the cart, the sack truck,
// the mouse, Amos's corner (the stove, the rocking chair on its rug, the desk
// and its stool), the bolter, the spare stone under the mill bills, the peg
// rail and the chalkboard by the door, and the lanterns on their hooks.
// Returns what moves.
export function buildFittings(parts, surfaces, keep) {
  const { b, rb, cyl, orb, rod, tube, group, mergeGroup, range, root } = parts;
  const { M } = surfaces;
  const W = K.halfW,
    H = K.ceiling;

  // A filled sack standing on `y`, tied at the neck.
  function sack(x, z, s = 1, turn = 0, material = M.sack, p = root) {
    const g = group(x, 0, z, turn, p);
    parts.box(material, 0, 0.42 * s, 0, 0.62 * s, 0.84 * s, 0.46 * s, 0.13 * s, g);
    orb(material, 0, 0.86 * s, 0, 0.2 * s, 0.1 * s, 0.15 * s, g);
    cyl(M.sackTie, 0, 0.95 * s, 0, 0.05 * s, 0.07 * s, 0.05 * s, g, 8);
    orb(material, 0, 1.0 * s, 0, 0.08 * s, 0.06 * s, 0.08 * s, g);
    return g;
  }

  // ------------------------------------------------------------- the hoist
  // The chain hangs from the trap; the sack on its hook rides up into the loft.
  const ho = K.hoist;
  // The pull rope, looped down the wall beside it.
  tube(M.rope, [[-W + 0.08, H - 0.1, ho.z + 0.45], [-W + 0.1, 2.6, ho.z + 0.5], [-W + 0.12, 1.2, ho.z + 0.46], [-W + 0.14, 2.4, ho.z + 0.38], [-W + 0.1, H - 0.1, ho.z + 0.35]], 0.018);
  b(M.oak, -W + 0.06, 1.6, ho.z + 0.42, 0.1, 0.12, 0.24);
  const hoisted = group(ho.x, 0, ho.z);
  sack(0, 0, 1.05, 0.4, M.sack, hoisted);
  rod(M.ironDark, [0, 1.12, 0], [0, 1.0, 0], 0.012, 4, hoisted);
  parts.torus(M.ironDark, 0, 1.17, 0, 0.06, 0.012, hoisted);
  keep.add(hoisted);
  mergeGroup(hoisted);
  // The chain above the hook, which shortens as the sack rises.
  const chain = rod(M.ironDark, [0, 0, 0], [0, 1, 0], 0.016, 4, group(ho.x, 1.2, ho.z));
  chain.position.y = 0.5;
  keep.add(chain.parent);

  // -------------------------------------------------------- the grain bins
  // Three tall bins along the back wall, lids up on the first.
  const bins = K.bins,
    binW = (bins.maxX + W) / 3,
    binFront = K.back + bins.depth;
  for (let i = 0; i < 3; i++) {
    const x = -W + (i + 0.5) * binW;
    b(M.oak, x, bins.height / 2, binFront - 0.03, binW - 0.04, bins.height, 0.06);
    for (const sx of [-1, 1]) b(M.oak, x + sx * (binW / 2 - 0.03), bins.height / 2, K.back + bins.depth / 2, 0.06, bins.height, bins.depth);
    b(M.timberDark, x, bins.height - 0.06, binFront, binW + 0.02, 0.08, 0.08);
    const label = parts.mesh(new T.PlaneGeometry(binW * 0.7, binW * 0.22), M.binLabels[i], x, bins.height * 0.6, binFront + 0.002);
    label.castShadow = false;
    // The grain itself, heaped a little below the rim.
    b([M.wheat, M.barley, M.oats][i], x, bins.height - 0.2, K.back + bins.depth / 2, binW - 0.1, 0.06, bins.depth - 0.1).castShadow = false;
    // Lids: the first propped open against the wall, the others shut.
    const lid = b(M.pine, x, bins.height + 0.03, K.back + bins.depth / 2, binW - 0.02, 0.04, bins.depth + 0.04);
    if (i === 0) {
      lid.position.set(x, bins.height + bins.depth / 2 - 0.02, K.back + 0.06);
      lid.rotation.x = -Math.PI / 2 + 0.12;
    }
  }
  // A scoop left on the open bin, and a besom against the wall by it.
  {
    const x = -W + binW * 0.5;
    cyl(M.brass, x + 0.15, bins.height - 0.12, binFront - 0.3, 0.09, 0.16, 0.1, root, 12).rotation.z = Math.PI / 2;
    rod(M.timber, [x + 0.3, bins.height - 0.12, binFront - 0.3], [x + 0.5, bins.height - 0.08, binFront - 0.3], 0.018, 5);
    rod(M.timber, [bins.maxX + 0.25, 0.25, K.back + 0.12], [bins.maxX + 0.12, 2.1, K.back + 0.08], 0.025, 6);
    cyl(M.wheat, bins.maxX + 0.26, 0.22, K.back + 0.12, 0.16, 0.5, 0.05, root, 10);
  }

  // --------------------------------------------- the sacks, the sack truck
  // Sacks for the Daily Loaf, standing and lying in the back corner.
  const sk = K.sacks;
  for (const [x, z, s, turn] of [
    [sk.minX + 0.4, K.back + 0.35, 1, 0.1],
    [sk.minX + 1.05, K.back + 0.33, 1.02, -0.15],
    [W - 0.35, K.back + 0.4, 0.98, 0.3],
    [W - 0.4, K.back + 1.0, 0.96, -0.2],
    [sk.minX + 0.6, K.back + 0.9, 0.95, 0.5],
  ])
    sack(x, z, s, turn);
  for (const [x, y, z, turn] of [[sk.minX + 0.72, 0.98, K.back + 0.38, 0.1], [W - 0.38, 0.98, K.back + 0.65, Math.PI / 2 + 0.1]]) {
    const lying = parts.box(M.sack, x, y + 0.18, z, 0.9, 0.36, 0.5, 0.12);
    lying.rotation.y = turn;
  }
  // The sack truck, tipped back against the wall by the back door.
  const tr = K.sackTruck,
    truck = group(tr.x, 0, tr.z, 0.2);
  for (const sx of [-0.22, 0.22]) {
    const handle = b(M.timber, sx, 0.85, -0.12, 0.06, 1.7, 0.06, truck);
    handle.rotation.x = -0.2;
    const tyre = cyl(M.ironDark, sx * 1.25, 0.17, 0.08, 0.17, 0.05, 0.17, truck, 14);
    tyre.rotation.z = Math.PI / 2;
  }
  for (const y of [0.45, 1.0, 1.5]) b(M.timber, 0, y, -0.12 - y * 0.2, 0.5, 0.05, 0.05, truck);
  b(M.iron, 0, 0.05, 0.12, 0.5, 0.03, 0.26, truck);
  cyl(M.iron, 0, 0.17, 0.08, 0.03, 0.62, 0.03, truck, 6).rotation.z = Math.PI / 2;

  // ---------------------------------------------------------------- the mouse
  const mouse = group(K.mouse.x, 0, K.mouse.z, 0.6);
  const body = group(0, 0, 0, 0, mouse);
  orb(M.mouse, 0, 0.055, 0, 0.05, 0.045, 0.075, body);
  orb(M.mouse, 0, 0.07, 0.075, 0.032, 0.03, 0.04, body);
  orb(M.eye, 0, 0.07, 0.115, 0.008, 0.008, 0.008, body);
  for (const sx of [-1, 1]) {
    orb(M.mouseEar, sx * 0.022, 0.1, 0.07, 0.016, 0.018, 0.006, body);
    orb(M.eye, sx * 0.018, 0.08, 0.1, 0.006, 0.006, 0.006, body);
  }
  tube(M.mouseEar, [[0, 0.03, -0.07], [0.02, 0.012, -0.12], [-0.02, 0.008, -0.17], [0.01, 0.01, -0.21]], 0.005, body);
  keep.add(mouse);
  mergeGroup(body);
  // Its hole in the skirting under the back window.
  const hole = parts.mesh(new T.CircleGeometry(0.055, 12, 0, Math.PI), M.ironDark, K.mouseHole.x, 0.0, K.back + 0.026);
  hole.castShadow = false;

  // --------------------------------------------------------- Amos's corner
  const sv = K.stove;
  // A slate hearth, and a rag rug between the stove and the chair.
  rb(M.slate, sv.x, 0.02, sv.z, K.hearth.w, 0.04, K.hearth.d, 0.01).castShadow = false;
  const rug = cyl(M.rug, (sv.x + K.chair.x) / 2 - 0.1, 0.012, (sv.z + K.chair.z) / 2 + 0.2, 0.95, 0.02, 0.95, root, 28);
  rug.scale.z = 0.7;
  rug.castShadow = false;
  for (const r of [0.75, 0.5]) {
    const band = parts.torus(M.rugBand, (sv.x + K.chair.x) / 2 - 0.1, 0.024, (sv.z + K.chair.z) / 2 + 0.2, r, 0.03);
    band.rotation.x = Math.PI / 2;
    band.scale.y = 0.7;
    band.castShadow = false;
  }
  // The stove: a little iron box on legs, its door glowing, its pipe up through the loft.
  b(M.ironDark, sv.x, 0.55, sv.z, sv.w - 0.1, 0.7, sv.d - 0.1);
  rb(M.iron, sv.x, 0.93, sv.z, sv.w, 0.06, sv.d, 0.01);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b(M.ironDark, sv.x + dx * (sv.w / 2 - 0.1), 0.1, sv.z + dz * (sv.d / 2 - 0.1), 0.06, 0.2, 0.06);
  // Its door faces the chair, on the stove's west side.
  const doorX = sv.x - sv.w / 2 + 0.04;
  b(M.fireGlow, doorX - 0.005, 0.52, sv.z, 0.02, 0.3, 0.36);
  for (const z of [-0.12, 0, 0.12]) b(M.ironDark, doorX - 0.02, 0.52, sv.z + z, 0.02, 0.32, 0.03);
  b(M.brass, doorX - 0.04, 0.6, sv.z + 0.21, 0.03, 0.03, 0.08);
  cyl(M.ironDark, sv.x + 0.12, (0.96 + H) / 2, sv.z - 0.08, 0.075, H - 0.96, 0.075, root, 12);
  cyl(M.iron, sv.x + 0.12, 2.6, sv.z - 0.08, 0.09, 0.04, 0.09, root, 12);
  // The kettle and the milk pan on top.
  parts.turned(M.iron, [[0.001, 0], [0.13, 0], [0.15, 0.08], [0.12, 0.17], [0.05, 0.2], [0.001, 0.21]], sv.x - 0.15, 0.96, sv.z + 0.12, 16);
  rod(M.iron, [sv.x - 0.15 + 0.12, 1.08, sv.z + 0.12], [sv.x - 0.15 + 0.24, 1.18, sv.z + 0.12], 0.018, 5);
  parts.torus(M.ironDark, sv.x - 0.15, 1.24, sv.z + 0.12, 0.09, 0.012, root, Math.PI).rotation.y = Math.PI / 2;
  cyl(M.brass, sv.x + 0.2, 1.0, sv.z + 0.14, 0.1, 0.09, 0.1, root, 14);
  rod(M.timber, [sv.x + 0.3, 1.02, sv.z + 0.14], [sv.x + 0.5, 1.03, sv.z + 0.18], 0.012, 4);
  const steamAt = new T.Vector3(sv.x - 0.15 + 0.25, 1.2, sv.z + 0.12);
  // A coal scuttle and a poker by the hearth.
  parts.turned(M.ironDark, [[0.001, 0], [0.13, 0], [0.16, 0.25], [0.12, 0.3]], sv.x + 0.55, 0.04, sv.z + 0.5, 12);
  rod(M.iron, [sv.x - 0.55, 0.05, sv.z - 0.5], [sv.x - 0.5, 0.9, sv.z - 0.42], 0.012, 4);
  // The rocking chair, which rocks while you sit.
  const ch = K.chair,
    chair = group(ch.x, 0, ch.z, ch.face),
    rocking = group(0, 0, 0, 0, chair);
  for (const sx of [-0.27, 0.27]) {
    // Rockers, a curve under each side.
    const rocker = parts.torus(M.oak, sx, 0.95, 0, 0.95, 0.025, rocking, 0.9);
    rocker.rotation.set(0, Math.PI / 2, -Math.PI / 2 - 0.45);
    b(M.oak, sx, 0.32, 0.22, 0.05, 0.6, 0.05, rocking);
    b(M.oak, sx, 0.32, -0.22, 0.05, 0.6, 0.05, rocking);
    const back = b(M.oak, sx, 1.1, -0.28, 0.05, 1.0, 0.05, rocking);
    back.rotation.x = -0.15;
    b(M.oak, sx, 0.78, 0.0, 0.05, 0.04, 0.5, rocking);
  }
  rb(M.oak, 0, 0.62, 0, 0.6, 0.05, 0.5, 0.01, rocking);
  rb(M.cushion, 0, 0.67, 0.02, 0.52, 0.06, 0.44, 0.025, rocking);
  for (let i = 0; i < 5; i++) {
    const spindle = b(M.oak, -0.2 + i * 0.1, 1.1, -0.29, 0.03, 0.9, 0.03, rocking);
    spindle.rotation.x = -0.15;
  }
  const crest = rb(M.oak, 0, 1.6, -0.36, 0.62, 0.12, 0.06, 0.015, rocking);
  crest.rotation.x = -0.15;
  // A knitted blanket over the back.
  const blanket = rb(M.rugBand, 0, 1.25, -0.25, 0.56, 0.6, 0.04, 0.02, rocking);
  blanket.rotation.x = -0.15;
  keep.add(chair);
  mergeGroup(rocking);

  // --------------------------------------------------------- the desk, stool
  const dk = K.desk,
    deskX = W - dk.depth / 2,
    deskZ = (dk.minZ + dk.maxZ) / 2,
    deskL = dk.maxZ - dk.minZ;
  for (const dz of [-1, 1]) for (const dx of [-1, 1]) b(M.oak, deskX + dx * (dk.depth / 2 - 0.06), (dk.height - 0.1) / 2, deskZ + dz * (deskL / 2 - 0.06), 0.07, dk.height - 0.1, 0.07);
  const top = rb(M.oak, deskX, dk.height, deskZ, dk.depth, 0.06, deskL, 0.012);
  top.rotation.z = 0.08;
  b(M.oak, deskX + 0.2, dk.height + 0.22, deskZ, 0.3, 0.4, deskL);
  b(M.oak, deskX + 0.25, dk.height + 0.43, deskZ, 0.35, 0.04, deskL + 0.06);
  // Pigeonholes full of papers.
  for (let i = 0; i < 5; i++) b(M.timberDark, deskX + 0.04, dk.height + 0.22, dk.minZ + 0.1 + (i * (deskL - 0.2)) / 4, 0.02, 0.36, 0.02);
  for (let i = 0; i < 4; i++) b(M.flour, deskX + 0.12, dk.height + 0.15, dk.minZ + 0.35 + i * 0.44, 0.15, 0.2, 0.3);
  // The daybook, open, with a pencil; the inkpot; a hurricane lamp.
  for (const sz of [-1, 1]) {
    const page = b(M.flour, deskX - 0.1, dk.height + 0.045, deskZ + sz * 0.17, 0.4, 0.015, 0.32);
    page.rotation.set(sz * 0.06, 0, 0.08);
  }
  b(M.leather, deskX - 0.1, dk.height + 0.03, deskZ, 0.44, 0.012, 0.72).rotation.z = 0.08;
  rod(M.pine, [deskX - 0.28, dk.height + 0.06, deskZ + 0.3], [deskX - 0.12, dk.height + 0.07, deskZ + 0.45], 0.006, 5);
  cyl(M.slate, deskX + 0.05, dk.height + 0.08, dk.minZ + 0.25, 0.05, 0.09, 0.05, root, 10);
  // The stool.
  const sl = K.stool;
  cyl(M.oak, sl.x, 0.78, sl.z, sl.r, 0.06, sl.r, root, 16);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    rod(M.oak, [sl.x + Math.cos(a) * 0.12, 0.76, sl.z + Math.sin(a) * 0.12], [sl.x + Math.cos(a) * 0.22, 0, sl.z + Math.sin(a) * 0.22], 0.025, 5);
  }

  // --------------------------------------------------------------- the bolter
  // A long box on legs, its cloth reel turned by a crank on the room's side.
  const bo = K.bolter,
    boX = W - bo.depth / 2,
    boZ = (bo.minZ + bo.maxZ) / 2,
    boL = bo.maxZ - bo.minZ;
  b(M.pine, boX, bo.height - 0.35, boZ, bo.depth, 0.7, boL - 0.05);
  for (const z of [bo.minZ + 0.1, bo.maxZ - 0.15]) for (const dx of [-1, 1]) b(M.timber, boX + dx * (bo.depth / 2 - 0.06), (bo.height - 0.7) / 2, z, 0.08, bo.height - 0.7, 0.08);
  rb(M.oak, boX, bo.height + 0.02, boZ, bo.depth + 0.04, 0.05, boL, 0.01);
  // A flap at the side, and the two outlets: flour and bran into a bin and a basket.
  b(M.timberDark, boX - bo.depth / 2 - 0.005, bo.height - 0.35, boZ + 0.2, 0.02, 0.4, 0.7);
  b(M.oak, boX, 0.3, bo.minZ + 0.45, bo.depth - 0.1, 0.6, 0.55);
  b(M.flour, boX, 0.6, bo.minZ + 0.45, bo.depth - 0.18, 0.02, 0.45).castShadow = false;
  parts.turned(M.canvas, [[0.001, 0], [0.22, 0], [0.26, 0.3]], boX, 0.0, bo.maxZ - 0.45, 14);
  const crank = group(boX - bo.depth / 2 - 0.06, bo.height - 0.35, bo.minZ + 0.25);
  rod(M.iron, [0, 0, 0], [-0.08, 0, 0], 0.025, 6, crank);
  b(M.iron, -0.09, 0.14, 0, 0.03, 0.32, 0.04, crank);
  rod(M.timber, [-0.09, 0.28, 0], [-0.24, 0.28, 0], 0.025, 6, crank);
  keep.add(crank);
  mergeGroup(crank);
  const puffAt = new T.Vector3(boX - bo.depth / 2, bo.height - 0.1, boZ + 0.2);

  // ----------------------------------------------------- the spare stone
  // A runner off its spindle, leaning on the east wall, its face dressed in
  // harps of furrows; the mill bills on a rack over it.
  const sp = K.spare,
    stone = group(W - 0.25, sp.r, sp.z, -Math.PI / 2);
  const disc = cyl(M.burr, 0, 0, 0, sp.r, 0.24, sp.r, stone, 32);
  disc.rotation.x = Math.PI / 2 - 0.18;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    for (let k = 0; k < 3; k++) {
      const r = 0.25 + k * 0.2,
        furrow = b(M.slate, Math.cos(a + k * 0.12) * r, Math.sin(a + k * 0.12) * r, 0.13, 0.42, 0.04, 0.02, group(0, 0, 0, 0, stone));
      furrow.rotation.z = a + 0.5;
      furrow.parent.rotation.x = -0.18;
    }
  }
  cyl(M.ironDark, 0, 0, 0, 0.16, 0.26, 0.16, stone, 16).rotation.x = Math.PI / 2 - 0.18;
  cyl(M.ironDark, 0, 0, 0, sp.r + 0.02, 0.1, sp.r + 0.02, stone, 32).rotation.x = Math.PI / 2 - 0.18;
  b(M.timber, W - 0.05, 2.55, sp.z, 0.1, 0.1, 1.2);
  for (let i = 0; i < 5; i++) {
    const z = sp.z - 0.45 + i * 0.22;
    rod(M.timber, [W - 0.12, 2.55, z], [W - 0.18, 2.2, z], 0.02, 5);
    b(M.iron, W - 0.19, 2.15, z, 0.03, 0.04, 0.24);
  }

  // ------------------------------------------------ the pegs, the chalkboard
  const pg = K.pegs;
  b(M.oak, pg.x, 2.6, K.front - 0.04, 1.1, 0.1, 0.06);
  for (const dx of [-0.4, 0, 0.4]) rod(M.oak, [pg.x + dx, 2.6, K.front - 0.06], [pg.x + dx, 2.66, K.front - 0.2], 0.02, 5);
  // Amos's coat, hanging long, and his hat on the next peg.
  const coat = group(pg.x - 0.4, 2.62, K.front - 0.14);
  parts.box(M.canvas, 0, -0.75, 0, 0.5, 1.45, 0.12, 0.04, coat);
  parts.box(M.canvas, 0, -0.05, 0.02, 0.32, 0.16, 0.14, 0.04, coat);
  for (const sx of [-1, 1]) {
    const sleeve = parts.box(M.canvas, sx * 0.24, -0.6, 0.02, 0.12, 1.0, 0.12, 0.04, coat);
    sleeve.rotation.z = sx * 0.06;
  }
  for (const y of [-0.4, -0.7, -1.0]) orb(M.timberDark, 0.04, y, 0.065, 0.015, 0.015, 0.01, coat);
  for (let i = 0; i < 12; i++) orb(M.flour, range(-0.22, 0.22), range(-1.4, -0.2), 0.065, range(0.02, 0.05), range(0.02, 0.05), 0.005, coat);
  cyl(M.leather, pg.x, 2.6, K.front - 0.22, 0.17, 0.02, 0.17, root, 16).rotation.x = -0.2;
  cyl(M.leather, pg.x, 2.67, K.front - 0.21, 0.1, 0.14, 0.11, root, 14).rotation.x = -0.2;
  // A wicker eel trap on the last peg.
  const trap = parts.turned(M.rope, [[0.001, 0], [0.08, 0.02], [0.13, 0.2], [0.12, 0.55], [0.05, 0.75]], pg.x + 0.4, 2.0, K.front - 0.2, 10);
  trap.rotation.x = 0.08;
  // The chalkboard, in a pine frame.
  const bd = K.board;
  rb(M.pine, bd.x, 2.15, K.front - 0.025, 0.86, 1.22, 0.05, 0.01);
  const board = parts.mesh(new T.PlaneGeometry(0.76, 1.12), M.chalk, bd.x, 2.15, K.front - 0.055);
  board.rotation.y = Math.PI;
  board.castShadow = false;
  b(M.pine, bd.x, 1.52, K.front - 0.08, 0.7, 0.03, 0.08);
  b(M.flour, bd.x + 0.15, 1.55, K.front - 0.08, 0.08, 0.02, 0.02);

  // -------------------------------------------------------------- lanterns
  // Hurricane lanterns on the joists; the room's point lights hang in them.
  const lanternSpots = [
    { x: 0.2, z: 2.6, drop: 1.25 },
    { x: 1.6, z: -1.3, drop: 1.3 },
    { x: -1.4, z: -2.9, drop: 1.25 },
    { x: 4.1, z: 1.0, drop: 1.2 },
  ];
  for (const { x, z, drop } of lanternSpots) {
    const y = H - drop;
    rod(M.ironDark, [x, H - 0.2, z], [x, y + 0.36, z], 0.008, 4);
    parts.torus(M.ironDark, x, y + 0.36, z, 0.05, 0.01);
    cyl(M.iron, x, y + 0.28, z, 0.05, 0.08, 0.1, root, 12);
    cyl(M.iron, x, y - 0.17, z, 0.11, 0.05, 0.1, root, 12);
    orb(M.lantern, x, y + 0.03, z, 0.085, 0.13, 0.085).castShadow = false;
    for (const a of [0, 1, 2, 3]) rod(M.iron, [x + Math.cos(a * 1.57) * 0.1, y - 0.15, z + Math.sin(a * 1.57) * 0.1], [x + Math.cos(a * 1.57) * 0.08, y + 0.25, z + Math.sin(a * 1.57) * 0.08], 0.006, 4);
  }

  return { hoisted, chain, mouse, body, rocking, crank, steamAt, puffAt, lanternSpots };
}
