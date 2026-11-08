import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { KETTLE_SIGNS as SIGNS } from "../content/copper-kettle.js";
import { KETTLE as K } from "./layout.js";

export const VIEW_DAY = new T.Color(1.12, 1.12, 1.08),
  VIEW_NIGHT = new T.Color(0.16, 0.2, 0.36);

// The building's fabric: the boards and the kitchen's quarry tiles, the walls
// with real openings for the sun (papered in the tea room above sage
// matchboard, limewashed in the kitchen), the bay and its window seat, the
// beamed ceiling, the chimney breast and its fireplace, the front door with its
// bell, the kitchen doorway's curtain, every window, and the painted views out
// of them. Returns what moves and what the hour changes.
export function buildShell(parts, surfaces, keep) {
  const { b, rb, tiled, cyl, orb, rod, torus, mesh, group, range, random, mergeGroup, root } = parts;
  const { M, cell, decal, clearDecal, goldLeaf, paint, shade, text } = surfaces;
  const H = K.ceiling,
    W = K.halfW,
    t = K.wall;
  const panes = [];
  const front = K.front + t / 2,
    back = K.back - t / 2,
    side = W + t / 2,
    southFace = K.partition + t / 2,
    northFace = K.partition - t / 2;

  // ------------------------------------------------------------------ floors
  const teaFloor = tiled(M.floor, 0, -0.05, (K.front + K.partition) / 2, 2 * W, 0.1, K.front - K.partition, 1.6);
  teaFloor.castShadow = false;
  const kitchenFloor = tiled(M.quarry, 0, -0.05, (K.partition + K.back) / 2, 2 * W, 0.1, K.partition - K.back, 1.2);
  kitchenFloor.castShadow = false;
  // A worn oak threshold where the boards meet the tiles.
  rb(M.oakDark, (K.kitchenDoor.x[0] + K.kitchenDoor.x[1]) / 2, 0.01, K.partition, K.kitchenDoor.x[1] - K.kitchenDoor.x[0], 0.03, t + 0.06, 0.008).castShadow = false;

  // ------------------------------------------------------------------- walls
  // A run of wall along one axis, with its openings left open.
  function wall(axis, at, from, to, openings, material, thick = t) {
    const piece = (a, c, bottom, top) => {
      if (c - a < 0.001 || top - bottom < 0.001) return;
      const mid = (a + c) / 2,
        cy = (bottom + top) / 2;
      if (axis === "x") tiled(material, mid, cy, at, c - a, top - bottom, thick, 1.0);
      else tiled(material, at, cy, mid, thick, top - bottom, c - a, 1.0);
    };
    let cursor = from;
    for (const { span, rise } of openings) {
      piece(cursor, span[0], 0, H);
      piece(span[0], span[1], 0, rise[0]);
      piece(span[0], span[1], rise[1], H);
      cursor = span[1];
    }
    piece(cursor, to, 0, H);
  }
  const bayOpening = { span: K.bay.x, rise: [0, K.bay.y[1]] };
  wall("x", front, -W - t, W + t, [bayOpening, { span: K.door.x, rise: K.door.y }, { span: K.eastWindow.x, rise: K.eastWindow.y }], M.wallpaper);
  wall("x", back, -W - t, W + t, [{ span: K.rearWindow.x, rise: K.rearWindow.y }], M.limewash);
  const sideOpening = [{ span: K.sideWindow.z, rise: K.sideWindow.y }];
  wall("z", -side, K.partition, K.front + t, sideOpening, M.wallpaper);
  wall("z", side, K.partition, K.front + t, sideOpening, M.wallpaper);
  wall("z", -side, K.back - t, K.partition, [], M.limewash);
  wall("z", side, K.back - t, K.partition, [], M.limewash);
  // The partition: papered on the tea room's face, limewashed on the kitchen's.
  const door = [{ span: K.kitchenDoor.x, rise: K.kitchenDoor.y }];
  wall("x", K.partition + t / 4, -W, W, door, M.wallpaper, t / 2);
  wall("x", K.partition - t / 4, -W, W, door, M.limewash, t / 2);

  // A veneer along a wall's face: `dir` is the way the face looks.
  function veneer(axis, at, from, to, dir, bottom, top, depth, material, su = 1.0) {
    const mid = (from + to) / 2,
      cy = (bottom + top) / 2;
    return axis === "x"
      ? tiled(material, mid, cy, at + (dir * depth) / 2, to - from, top - bottom, depth, su, su, root, bottom)
      : tiled(material, at + (dir * depth) / 2, cy, mid, depth, top - bottom, to - from, su, su, root, bottom);
  }
  const ch = K.chimney,
    d = K.dado;
  // Sage matchboard to the dado rail, with an oak rail and skirting.
  const dadoRuns = [
    ["x", K.front, -W, K.bay.x[0], -1],
    ["x", K.front, K.bay.x[1], K.door.x[0] - 0.12, -1],
    ["x", K.front, K.door.x[1] + 0.12, W, -1],
    ["z", -W, southFace, K.front, 1],
    ["z", W, southFace, K.front, -1],
    ["x", southFace, -W, K.kitchenDoor.x[0] - 0.12, 1],
    ["x", southFace, K.kitchenDoor.x[1] + 0.12, ch.minX, 1],
    ["x", southFace, ch.maxX, W, 1],
  ];
  for (const [axis, at, from, to, dir] of dadoRuns) {
    veneer(axis, at, from, to, dir, 0, d, 0.03, M.matchboard, 0.8);
    const mid = (from + to) / 2;
    if (axis === "x") {
      rb(M.oak, mid, d + 0.03, at + dir * 0.045, to - from, 0.07, 0.07, 0.02);
      b(M.oakDark, mid, 0.08, at + dir * 0.05, to - from, 0.16, 0.05);
    } else {
      rb(M.oak, at + dir * 0.045, d + 0.03, mid, 0.07, 0.07, to - from, 0.02);
      b(M.oakDark, at + dir * 0.05, 0.08, mid, 0.05, 0.16, to - from);
    }
  }
  // Picture rail and cornice round the tea room.
  for (const [axis, at, from, to, dir] of [
    ["x", K.front, -W, W, -1],
    ["z", -W, southFace, K.front, 1],
    ["z", W, southFace, K.front, -1],
    ["x", southFace, -W, W, 1],
  ]) {
    const mid = (from + to) / 2;
    if (axis === "x") {
      b(M.oak, mid, 3.5, at + dir * 0.025, to - from, 0.06, 0.05);
      rb(M.trim, mid, H - 0.09, at + dir * 0.05, to - from, 0.18, 0.1, 0.03);
    } else {
      b(M.oak, at + dir * 0.025, 3.5, mid, 0.05, 0.06, to - from);
      rb(M.trim, at + dir * 0.05, H - 0.09, mid, 0.1, 0.18, to - from, 0.03);
    }
  }
  // The kitchen: a sage band to the waist and a quarry-red skirting.
  for (const [axis, at, from, to, dir] of [
    ["z", -W, K.back, northFace, 1],
    ["z", W, K.back, northFace, -1],
    ["x", northFace, -W, K.kitchenDoor.x[0] - 0.1, -1],
    ["x", northFace, K.kitchenDoor.x[1] + 0.1, K.range.minX, -1],
    ["x", northFace, K.range.maxX, W, -1],
  ]) {
    veneer(axis, at, from, to, dir, 0, 1.05, 0.012, M.sageDark, 1);
    const mid = (from + to) / 2;
    if (axis === "x") b(M.cream, mid, 1.07, at + dir * 0.02, to - from, 0.05, 0.04);
    else b(M.cream, at + dir * 0.02, 1.07, mid, 0.04, 0.05, to - from);
  }
  // White tiles behind the sink, and behind the rack.
  const tileBack = (minX, maxX, top) => {
    for (let y = 1.3; y < top - 0.01; y += 0.2)
      for (let x = minX + 0.1; x < maxX - 0.01; x += 0.2) b(M.china, x, y + 0.1, K.back + 0.012, 0.19, 0.19, 0.014);
  };
  tileBack(K.sinkRun.minX, K.rearWindow.x[0] - 0.12, 2.1);
  tileBack(K.rearWindow.x[1] + 0.12, K.sinkRun.maxX, 2.1);
  tileBack(K.rack.minX, K.rack.maxX, 1.9);

  // ----------------------------------------------------------------- ceiling
  tiled(M.ceiling, 0, H + 0.1, (K.front + K.back) / 2, 2 * W + 2 * t, 0.2, K.front - K.back + 2 * t, 1.4);
  for (const z of [3.3, 1.05, -1.25, -4.2]) {
    const beam = rb(M.beam, 0, H - 0.14, z, 2 * W, 0.28, 0.3, 0.03);
    beam.castShadow = false;
  }
  // The bay's own little ceiling.
  b(M.ceiling, (K.bay.x[0] + K.bay.x[1]) / 2, K.bay.y[1] + 0.06, K.front + K.bay.depth / 2, K.bay.x[1] - K.bay.x[0], 0.12, K.bay.depth + t);

  // ----------------------------------------------------------------- windows
  /** Frame and glazing bars for an opening: `turn` looks its local +z into the room. */
  function casement(cx, cy, cz, w, h, turn, bars, sill = 0.2, frame = M.trim) {
    const g = group(cx, cy, cz, turn),
      frameW = 0.09;
    for (const sx of [-1, 1]) b(frame, (sx * (w - frameW)) / 2, 0, 0, frameW, h, t * 0.8, g);
    for (const sy of [-1, 1]) b(frame, 0, (sy * (h - frameW)) / 2, 0, w, frameW, t * 0.8, g);
    for (const x of bars.x ?? []) b(frame, x, 0, 0.02, 0.045, h, 0.05, g);
    for (const y of bars.y ?? []) b(frame, 0, y, 0.02, w, 0.045, 0.05, g);
    for (const sx of [-1, 1]) rb(M.trim, (sx * (w + 0.1)) / 2, 0, t / 2 + 0.02, 0.15, h + 0.24, 0.05, 0.012, g);
    rb(M.trim, 0, h / 2 + 0.09, t / 2 + 0.03, w + 0.34, 0.13, 0.07, 0.015, g);
    if (sill) rb(M.oak, 0, -h / 2 - 0.05, t / 2 + sill / 2 - 0.04, w + 0.3, 0.07, sill, 0.015, g);
    const pane = new T.PlaneGeometry(w, h);
    pane.applyMatrix4(new T.Matrix4().compose(new T.Vector3(cx, cy, cz), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), turn), new T.Vector3(1, 1, 1)));
    panes.push(pane);
    return g;
  }
  const bay = K.bay,
    bayW = bay.x[1] - bay.x[0],
    bayX = (bay.x[0] + bay.x[1]) / 2,
    bayH = bay.y[1] - bay.y[0],
    bayY = (bay.y[0] + bay.y[1]) / 2,
    bayFront = K.front + bay.depth;
  // The bay: a panelled front below its lights, and narrow lights in its cheeks.
  b(M.cream, bayX, bay.y[0] / 2, bayFront + t / 2, bayW + t * 2, bay.y[0], t);
  b(M.cream, bayX, H - (H - bay.y[1]) / 2 + 0.06, bayFront + t / 2, bayW + t * 2, H - bay.y[1] - 0.12, t);
  casement(bayX, bayY, bayFront + t / 2, bayW, bayH, Math.PI, { x: [-bayW / 6, bayW / 6], y: [0.62] }, 0);
  for (const [x, turn] of [[bay.x[0] - t / 2, Math.PI / 2], [bay.x[1] + t / 2, -Math.PI / 2]]) {
    b(M.cream, x, bay.y[0] / 2, K.front + bay.depth / 2, t, bay.y[0], bay.depth);
    casement(x, bayY, K.front + bay.depth / 2 + 0.02, bay.depth - 0.1, bayH, turn, { y: [0.62] }, 0);
  }
  // Gold leaf across the bay's middle light, reading backwards from in here.
  clearDecal(
    2048,
    520,
    (c, w, h) => goldLeaf(c, w, h, [[SIGNS.window, 210, 190, "italic bold"], [SIGNS.subline, 420, 78]]),
    bayX,
    bayY + 0.35,
    bayFront + 0.02,
    bayW - 0.5,
    0.62,
    Math.PI,
  );
  // The window seat: a panelled box filling the bay, a chintz cushion and bolsters.
  const seatTop = bay.seat;
  b(M.cream, bayX, seatTop / 2 - 0.03, K.front + bay.depth / 2, bayW - 0.02, seatTop - 0.06, bay.depth - 0.02);
  for (let i = 0; i < 4; i++) {
    const x = bay.x[0] + (i + 0.5) * (bayW / 4);
    rb(M.trim, x, 0.45, K.front + 0.005, bayW / 4 - 0.2, 0.5, 0.03, 0.01);
  }
  rb(M.oak, bayX, seatTop - 0.02, K.front + bay.depth / 2 - 0.04, bayW + 0.04, 0.05, bay.depth + 0.06, 0.015);
  rb(M.chintz, bayX, seatTop + 0.07, K.front + bay.depth / 2, bayW - 0.1, 0.14, bay.depth - 0.12, 0.05);
  for (const x of [bay.x[0] + 0.25, bay.x[1] - 0.25]) {
    const bolster = cyl(M.chintz, x, seatTop + 0.26, K.front + bay.depth / 2 + 0.05, 0.13, bay.depth - 0.3, 0.13, root, 14);
    bolster.rotation.x = Math.PI / 2;
  }
  for (const [x, color] of [[bayX + 0.55, M.velvet], [bayX + 1.05, M.sage]]) {
    const pillow = rb(color, x, seatTop + 0.42, bayFront - 0.18, 0.5, 0.42, 0.14, 0.06);
    pillow.rotation.x = -0.25;
  }
  // A geranium in a pot on each cheek's sill, catching the light.
  for (const x of [bay.x[0] + 0.25, bay.x[1] - 0.25]) {
    cyl(M.terracotta, x, seatTop + 0.6, bayFront - 0.22, 0.1, 0.2, 0.13, root, 12);
    for (let i = 0; i < 6; i++) orb(M.leaf, x + range(-0.12, 0.12), seatTop + 0.78 + range(0, 0.08), bayFront - 0.22 + range(-0.1, 0.1), 0.08, 0.05, 0.08);
    for (let i = 0; i < 4; i++) orb(parts.mat("#d24b4a", 0.8), x + range(-0.08, 0.08), seatTop + 0.92 + range(0, 0.08), bayFront - 0.22 + range(-0.07, 0.07), 0.045);
  }

  // Side windows, the east window on the lane, and the kitchen's rear window.
  const sw = K.sideWindow,
    sideW = sw.z[1] - sw.z[0],
    sideH = sw.y[1] - sw.y[0],
    sideZ = (sw.z[0] + sw.z[1]) / 2,
    sideY = (sw.y[0] + sw.y[1]) / 2;
  casement(-side, sideY, sideZ, sideW, sideH, Math.PI / 2, { x: [0], y: [0.25] });
  casement(side, sideY, sideZ, sideW, sideH, -Math.PI / 2, { x: [0], y: [0.25] });
  const ew = K.eastWindow,
    eastW = ew.x[1] - ew.x[0],
    eastX = (ew.x[0] + ew.x[1]) / 2;
  casement(eastX, (ew.y[0] + ew.y[1]) / 2, front, eastW, ew.y[1] - ew.y[0], Math.PI, { x: [-eastW / 6, eastW / 6], y: [0.45] }, 0.28);
  const rw = K.rearWindow,
    rearW = rw.x[1] - rw.x[0];
  casement((rw.x[0] + rw.x[1]) / 2, (rw.y[0] + rw.y[1]) / 2, back, rearW, rw.y[1] - rw.y[0], 0, { x: [0], y: [0.32] }, 0.22, M.cream);
  // Café curtains on brass rods across the lower lights.
  const cafeCurtain = (x, z, w, y, turn) => {
    const g = group(x, y, z, turn);
    rod(M.brass, [-w / 2 - 0.05, 0, 0.1], [w / 2 + 0.05, 0, 0.1], 0.014, 6, g);
    for (let i = 0; i < Math.round(w / 0.16); i++) {
      const fold = b(M.lace, -w / 2 + 0.08 + i * 0.16, -0.36, 0.1 + (i % 2) * 0.025, 0.17, 0.72, 0.012, g);
      fold.castShadow = false;
    }
    return g;
  };
  cafeCurtain(eastX, K.front - 0.05, eastW, ew.y[0] + 0.86, Math.PI);

  // ---------------------------------------------------------- the front door
  const dw = K.door.x[1] - K.door.x[0],
    dh = K.door.y[1],
    leafW = dw - 0.08,
    stile = 0.15;
  const doorLeaf = group(0, 0, K.front + t * 0.4, Math.PI);
  for (const sx of [-1, 1]) b(M.door, (sx * (leafW - stile)) / 2, dh / 2, 0, stile, dh, 0.08, doorLeaf);
  b(M.door, 0, 0.13, 0, leafW, 0.26, 0.08, doorLeaf);
  b(M.door, 0, 1.3, 0, leafW, 0.18, 0.08, doorLeaf);
  b(M.door, 0, dh - 0.09, 0, leafW, 0.18, 0.08, doorLeaf);
  b(M.door, 0, 0.72, 0, leafW - 0.1, 0.9, 0.05, doorLeaf);
  for (const sx of [-1, 1]) rb(parts.mat("#5f7f77", 0.45), sx * 0.22, 0.72, 0.04, 0.34, 0.7, 0.025, 0.008, doorLeaf);
  // The glazed upper half, its bars and a lace panel; the knob and the bolt.
  for (const x of [-leafW / 6, leafW / 6]) b(M.door, x, 2.25, 0.02, 0.04, dh - 1.48, 0.05, doorLeaf);
  b(M.door, 0, 2.3, 0.02, leafW - 2 * stile, 0.04, 0.05, doorLeaf);
  panes.push(new T.PlaneGeometry(leafW - 2 * stile, dh - 1.57).applyMatrix4(new T.Matrix4().makeTranslation(0, 1.39 + (dh - 1.57) / 2 + 0.02, K.front + t * 0.42)));
  orb(M.brass, 0.58, 1.5, 0.08, 0.05, 0.05, 0.05, doorLeaf);
  rb(M.brass, 0.58, 1.5, 0.045, 0.08, 0.2, 0.012, 0.004, doorLeaf);
  b(M.iron, -0.6, 2.9, 0.05, 0.05, 0.28, 0.025, doorLeaf);
  // The OPEN card on its string, reading backwards from in here: CLOSED.
  const card = cell(512, 256, (c, w, h) => {
    c.fillStyle = "#efe4c4";
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "#7f9a7c";
    c.lineWidth = 10;
    c.strokeRect(10, 10, w - 20, h - 20);
    text(c, "Sorry, we’re", w / 2, 82, 42, "#5e4a38", { font: surfaces.SERIF, weight: "italic" });
    text(c, "CLOSED", w / 2, 160, 84, "#8b3a32", { font: surfaces.SERIF, weight: "bold" });
  });
  decal(card, 0, 2.3, -0.06, 0.5, 0.25, Math.PI, doorLeaf);
  rod(M.linen, [-0.2, 2.43, -0.06], [0, 2.62, -0.06], 0.004, 4, doorLeaf);
  rod(M.linen, [0.2, 2.43, -0.06], [0, 2.62, -0.06], 0.004, 4, doorLeaf);
  clearDecal(1024, 400, (c, w, h) => goldLeaf(c, w, h, [["TEAS", 140, 130], ["& CAKES", 290, 96]]), 0, 2.85, K.front + t * 0.39, 0.95, 0.37, Math.PI);
  for (const x of K.door.x) rb(M.trim, x, dh / 2 + 0.05, K.front - 0.02, 0.18, dh + 0.1, 0.06, 0.012);
  rb(M.trim, 0, dh + 0.1, K.front - 0.025, dw + 0.38, 0.15, 0.07, 0.015);
  rb(M.brass, 0, 0.012, K.front + 0.06, dw, 0.024, 0.18, 0.006).castShadow = false;
  // The doormat.
  rb(parts.mat("#8a6a44", 1), 0, 0.012, K.front - 0.55, 1.5, 0.024, 0.8, 0.01).castShadow = false;
  // The bell on its curled spring over the door, which rings you in.
  const spring = group(0.72, dh + 0.2, K.front - 0.12);
  b(M.iron, 0.72, dh + 0.26, K.front - 0.05, 0.05, 0.22, 0.04);
  rod(M.iron, [0, 0, 0], [0, -0.06, -0.24], 0.01, 5, spring);
  const dome = group(0, -0.06, -0.24, 0, spring);
  parts.turned(M.brass, [[0.001, 0], [0.09, 0.0], [0.085, 0.03], [0.06, 0.1], [0.02, 0.13], [0.001, 0.135]], 0, -0.13, 0, 18, dome);
  orb(M.brass, 0, -0.15, 0, 0.022, 0.022, 0.022, dome);
  keep.add(spring);
  mergeGroup(spring);

  // ---------------------------------------------- the doorway to the kitchen
  const kd = K.kitchenDoor,
    kdw = kd.x[1] - kd.x[0],
    kdx = (kd.x[0] + kd.x[1]) / 2;
  for (const x of kd.x) b(M.oakDark, x, kd.y[1] / 2, K.partition, 0.14, kd.y[1], t + 0.1);
  b(M.oakDark, kdx, kd.y[1] + 0.07, K.partition, kdw + 0.28, 0.14, t + 0.1);
  // A gingham curtain, drawn and tied back to the west jamb.
  const curtainGroup = group(kd.x[0] + 0.06, 0, southFace + 0.08);
  rod(M.brass, [-0.05, kd.y[1] - 0.12, 0], [kdw - 0.05, kd.y[1] - 0.12, 0], 0.016, 6, curtainGroup);
  for (let i = 0; i < 5; i++) {
    const top = kd.y[1] - 0.15,
      x = 0.06 + i * 0.065,
      lean = 0.08 - i * 0.012;
    const fold = parts.box(M.gingham, x, top / 2 + 0.08, 0.02 * (i % 2), 0.09, top - 0.16, 0.018, 0.008, curtainGroup);
    fold.rotation.z = lean;
    fold.castShadow = false;
  }
  torus(M.sageDark, 0.2, 1.35, 0.02, 0.09, 0.022, curtainGroup).rotation.x = Math.PI / 2;

  // ------------------------------------------------- the chimney breast
  const fp = K.fireplace,
    breastFront = southFace + ch.depth,
    breastZ = southFace + ch.depth / 2;
  b(M.wallpaper, (ch.minX + fp.x[0]) / 2, H / 2, breastZ, fp.x[0] - ch.minX, H, ch.depth);
  b(M.wallpaper, (fp.x[1] + ch.maxX) / 2, H / 2, breastZ, ch.maxX - fp.x[1], H, ch.depth);
  b(M.wallpaper, (fp.x[0] + fp.x[1]) / 2, (fp.y[1] + H) / 2, breastZ, fp.x[1] - fp.x[0], H - fp.y[1], ch.depth);
  // Brick inside the opening and a sooty fireback.
  const fpw = fp.x[1] - fp.x[0];
  b(M.soot, (fp.x[0] + fp.x[1]) / 2, fp.y[1] / 2, southFace + 0.1, fpw, fp.y[1], 0.06);
  for (const x of fp.x) b(M.brick, x + (x === fp.x[0] ? 0.05 : -0.05), fp.y[1] / 2, breastZ, 0.1, fp.y[1], ch.depth - 0.04);
  // A brick surround with a stone lintel, and an oak mantel shelf.
  for (const x of [fp.x[0] - 0.14, fp.x[1] + 0.14]) tiled(M.brick, x, fp.y[1] / 2 + 0.1, breastFront + 0.03, 0.28, fp.y[1] + 0.2, 0.06, 0.8);
  rb(M.stone, (fp.x[0] + fp.x[1]) / 2, fp.y[1] + 0.12, breastFront + 0.035, fpw + 0.56, 0.24, 0.07, 0.012);
  rb(M.oak, (ch.minX + ch.maxX) / 2, ch.mantel, breastFront + 0.06, ch.maxX - ch.minX + 0.2, 0.09, 0.3, 0.02);
  for (const x of [ch.minX + 0.2, ch.maxX - 0.2]) b(M.oak, x, ch.mantel - 0.14, breastFront + 0.08, 0.08, 0.2, 0.12);
  // The hearth: a stone slab, and a brass fender round it.
  rb(M.hearth, (fp.x[0] + fp.x[1]) / 2, 0.03, breastFront + fp.hearth / 2, fpw + 0.7, 0.06, fp.hearth + 0.02, 0.01).castShadow = false;
  const fender = { x0: fp.x[0] - 0.18, x1: fp.x[1] + 0.18, z: breastFront + fp.hearth - 0.02 };
  rod(M.brass, [fender.x0, 0.2, fender.z], [fender.x1, 0.2, fender.z], 0.022, 8);
  rod(M.brass, [fender.x0, 0.06, fender.z], [fender.x1, 0.06, fender.z], 0.014, 6);
  for (const x of [fender.x0, fender.x1]) {
    rod(M.brass, [x, 0.2, fender.z], [x, 0.2, breastFront + 0.02], 0.022, 8);
    orb(M.brass, x, 0.24, fender.z, 0.04);
  }
  for (let i = 1; i < 8; i++) rod(M.brass, [fender.x0 + (i * (fender.x1 - fender.x0)) / 8, 0.06, fender.z], [fender.x0 + (i * (fender.x1 - fender.x0)) / 8, 0.2, fender.z], 0.007, 4);
  // The kitchen's side: the stack rises over the range, limewashed.
  b(M.limewash, (K.range.minX + K.range.maxX) / 2, (1.95 + H) / 2, northFace - 0.2, K.range.maxX - K.range.minX + 0.2, H - 1.95, 0.4);
  rb(M.oak, (K.range.minX + K.range.maxX) / 2, 1.95, northFace - 0.32, K.range.maxX - K.range.minX + 0.36, 0.1, 0.36, 0.02);

  // ----------------------------------------------------- the view out of doors
  // A painted card outside each window: never lit, a little over-bright so the
  // openings bloom, and tinted as the hour changes.
  const sky = (c, w, horizon) => {
    const g = c.createLinearGradient(0, 0, 0, horizon);
    g.addColorStop(0, "#77a9cc");
    g.addColorStop(1, "#eae0c4");
    c.fillStyle = g;
    c.fillRect(0, 0, w, horizon);
    for (let i = 0; i < 12; i++) {
      const x = random() * w,
        y = random() * horizon * 0.7;
      c.fillStyle = "rgba(255,250,238,0.42)";
      for (let k = 0; k < 6; k++) {
        c.beginPath();
        c.ellipse(x + k * range(14, 26), y + range(-5, 5), range(18, 42), range(7, 15), 0, 0, Math.PI * 2);
        c.fill();
      }
    }
  };
  const treeLine = (c, w, y, tall, colour) => {
    for (let x = -20; x < w + 20; x += range(20, 46)) {
      const r = range(tall * 0.6, tall),
        cy = y - range(0, tall * 0.35);
      c.fillStyle = shade(colour, range(-0.3, -0.18));
      c.beginPath();
      c.ellipse(x, cy, r * 1.05, r, 0, 0, Math.PI * 2);
      c.fill();
      for (let k = 0; k < 12; k++) {
        const a = random() * Math.PI * 2,
          dd = Math.sqrt(random()) * r * 0.85,
          lit = 1 - (Math.sin(a) * dd) / r;
        c.fillStyle = shade(colour, -0.2 + lit * 0.2 + range(-0.05, 0.05));
        c.beginPath();
        c.arc(x + Math.cos(a) * dd - r * 0.08, cy + Math.sin(a) * dd - r * 0.1, r * range(0.16, 0.34), 0, Math.PI * 2);
        c.fill();
      }
    }
  };
  const gravel = (c, w, top, h) => {
    c.fillStyle = "#c9b991";
    c.fillRect(0, top, w, h - top);
    for (let i = 0; i < 4000; i++) {
      c.fillStyle = random() > 0.5 ? "rgba(255,245,220,0.3)" : "rgba(90,75,50,0.25)";
      c.fillRect(random() * w, top + random() * (h - top), range(1, 4), range(1, 2));
    }
  };
  // South: the terrace, the square's stalls and the bunting.
  const market = paint(
    1536,
    768,
    (c, w, h) => {
      const horizon = h * 0.52;
      sky(c, w, horizon);
      treeLine(c, w, horizon + 5, 44, "#6b8f55");
      c.fillStyle = "#86a85c";
      c.fillRect(0, horizon, w, h);
      gravel(c, w, horizon + 40, h);
      const stripes = ["#6f9a5a", "#c46a4a", "#5f7fa3", "#d39a3c"];
      for (let i = 0; i < 4; i++) {
        const x = w * (0.08 + i * 0.24),
          sw2 = 190,
          ay = horizon - 10;
        c.fillStyle = "#65513e";
        c.fillRect(x, ay, 8, 118);
        c.fillRect(x + sw2 - 8, ay, 8, 118);
        c.fillStyle = "#8a6a4a";
        c.fillRect(x - 4, ay + 70, sw2 + 8, 50);
        for (let s = 0; s < 8; s++) {
          c.fillStyle = s % 2 ? "#f2ead5" : stripes[i];
          c.beginPath();
          c.moveTo(x + (s * sw2) / 8, ay - 36);
          c.lineTo(x + ((s + 1) * sw2) / 8, ay - 36);
          c.lineTo(x + ((s + 1) * sw2) / 8 + 3, ay);
          c.lineTo(x + (s * sw2) / 8 - 3, ay);
          c.fill();
        }
      }
      c.strokeStyle = "#5a4a3a";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, horizon - 150);
      c.quadraticCurveTo(w * 0.5, horizon - 40, w, horizon - 160);
      c.stroke();
      for (let i = 0; i < 30; i++) {
        const f = (i + 0.5) / 30,
          x = f * w,
          y = (1 - f) ** 2 * (horizon - 150) + 2 * f * (1 - f) * (horizon - 40) + f * f * (horizon - 160);
        c.fillStyle = ["#d24b4a", "#f2d27a", "#5f7fa3", "#f2ead5", "#6f9a5a"][i % 5];
        c.beginPath();
        c.moveTo(x - 11, y);
        c.lineTo(x + 11, y);
        c.lineTo(x, y + 26);
        c.fill();
      }
      // The terrace's two tables, close by, with their teapots.
      for (const [x, pot] of [[w * 0.22, "#8ca5b0"], [w * 0.74, "#b87333"]]) {
        c.fillStyle = "rgba(60,45,30,0.25)";
        c.beginPath();
        c.ellipse(x, h * 0.93, 150, 24, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#6a5442";
        c.fillRect(x - 9, h * 0.72, 18, h * 0.2);
        c.fillStyle = "#e9dfc6";
        c.beginPath();
        c.ellipse(x, h * 0.72, 140, 20, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = pot;
        c.beginPath();
        c.ellipse(x + 26, h * 0.67, 30, 26, 0, 0, Math.PI * 2);
        c.fill();
      }
    },
    false,
  );
  const country = paint(
    1024,
    512,
    (c, w, h) => {
      const horizon = h * 0.58;
      sky(c, w, horizon);
      c.fillStyle = "#88a862";
      c.beginPath();
      c.moveTo(0, horizon);
      c.bezierCurveTo(w * 0.3, horizon - 60, w * 0.5, horizon + 8, w, horizon - 34);
      c.lineTo(w, h);
      c.lineTo(0, h);
      c.fill();
      treeLine(c, w, horizon + 6, 36, "#5f8549");
      c.fillStyle = "#7da355";
      c.fillRect(0, horizon + 18, w, h);
      treeLine(c, w, horizon + 118, 44, "#456b35");
    },
    false,
  );
  // North: the herb garden, a lavender hedge and the washing line.
  const garden = paint(
    1024,
    512,
    (c, w, h) => {
      const horizon = h * 0.5;
      sky(c, w, horizon);
      treeLine(c, w, horizon + 4, 40, "#5f8549");
      c.fillStyle = "#7da355";
      c.fillRect(0, horizon, w, h);
      c.strokeStyle = "#8a7a64";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(w * 0.1, horizon - 50);
      c.quadraticCurveTo(w * 0.5, horizon - 20, w * 0.9, horizon - 50);
      c.stroke();
      ["#f2ede0", "#d8e3ec", "#f2ede0", "#e7c5c9"].forEach((cloth, i) => {
        const x = w * (0.22 + i * 0.16);
        c.fillStyle = cloth;
        c.fillRect(x, horizon - 38 + Math.abs(i - 1.5) * -5, 62, 70);
      });
      for (let x = 0; x < w; x += 18) {
        c.fillStyle = shade("#7f6aa8", range(-0.15, 0.15));
        c.beginPath();
        c.ellipse(x, h * 0.72, 16, 34, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#5f7f4d";
        c.fillRect(x - 6, h * 0.74, 12, 40);
      }
      for (let i = 0; i < 7; i++) {
        const x = w * (0.08 + i * 0.14);
        c.fillStyle = "#ad6a4b";
        c.fillRect(x - 26, h * 0.86, 52, 44);
        c.fillStyle = "#5f8f4a";
        c.beginPath();
        c.ellipse(x, h * 0.85, 40, 24, 0, 0, Math.PI * 2);
        c.fill();
      }
    },
    false,
  );
  const views = [
    { map: market, x: bayX + 2.4, z: K.front + 8, turn: Math.PI, w: 28, h: 14, y: 3.2 },
    { map: country, x: -W - 6, z: sideZ, turn: Math.PI / 2, w: 20, h: 10, y: 3.2 },
    { map: country, x: W + 6, z: sideZ, turn: -Math.PI / 2, w: 20, h: 10, y: 3.2 },
    { map: garden, x: -1.4, z: K.back - 6, turn: 0, w: 20, h: 10, y: 3.0 },
  ];
  const viewMaterials = new Map();
  for (const view of views) {
    if (!viewMaterials.has(view.map))
      viewMaterials.set(view.map, new T.MeshBasicMaterial({ map: view.map, color: VIEW_DAY.clone() }));
    const card2 = mesh(new T.PlaneGeometry(view.w, view.h), viewMaterials.get(view.map), view.x, view.y, view.z);
    card2.rotation.y = view.turn;
    card2.castShadow = card2.receiveShadow = false;
  }
  // All the room's window glass, as one sheet that casts nothing.
  const glass = mesh(mergeGeometries(panes), M.glass);
  glass.castShadow = glass.receiveShadow = false;
  panes.forEach((g) => g.dispose());

  return { viewMaterials: [...viewMaterials.values()], spring, dome };
}
