import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { POST_OFFICE_SIGNS as SIGNS } from "../content/post-office.js";
import { MARKET } from "../regions/market-layout.js";
import { POST_OFFICE as P } from "./layout.js";

export const VIEW_DAY = new T.Color(1.12, 1.12, 1.08),
  VIEW_NIGHT = new T.Color(0.16, 0.2, 0.36);

// The building's fabric: the floors, the four walls and the partition with
// real openings for the sun to come through, the dado, frieze and cornice, the
// ceiling and its beams, the front door and every window, and what is seen
// through them. Returns what the hour changes.
export function buildShell(parts, surfaces) {
  const { b, rb, tiled, strip, cyl, mesh, group, range, random, root } = parts;
  const { M, A, decal, clearDecal, goldLeaf, paint, shade } = surfaces;
  const H = P.ceiling,
    W = P.halfW,
    t = P.wall;
  const panes = [];

  // ------------------------------------------------------------------ floors
  const seam = 0.5;
  const tile = tiled(M.encaustic, 0, -0.05, (P.front + seam) / 2, 2 * W, 0.1, P.front - seam, 1.28);
  tile.castShadow = false;
  const boards = tiled(M.planks, 0, -0.05, (P.back + seam) / 2, 2 * W, 0.1, seam - P.back, 2.56);
  boards.castShadow = false;
  // The floor's border runs round the public side; a brass strip meets the boards.
  const band = 0.4,
    y = 0.004,
    hall = { minZ: P.counter.maxZ, maxZ: P.front };
  strip(M.border, 0, y, hall.maxZ - band / 2, 2 * W, band, 1.6);
  strip(M.border, 0, y, hall.minZ + band / 2, 2 * W, band, 1.6);
  strip(M.border, -W + band / 2, y, (hall.minZ + hall.maxZ) / 2, hall.maxZ - hall.minZ, band, 1.6, Math.PI / 2);
  strip(M.border, W - band / 2, y, (hall.minZ + hall.maxZ) / 2, hall.maxZ - hall.minZ, band, 1.6, Math.PI / 2);
  rb(M.brass, (P.counter.westEnd + P.counter.eastStart) / 2, 0.006, seam, P.counter.eastStart - P.counter.westEnd, 0.016, 0.08, 0.004).castShadow = false;
  const mat = decal(A.doormat, (P.door.x[0] + P.door.x[1]) / 2, 0.012, P.front - 0.72, 2, 1, 0, root, -Math.PI / 2);
  mat.receiveShadow = true;

  // ------------------------------------------------------------------- walls
  // A run of wall along one axis, with its openings' lintels and sills built.
  function wall(axis, at, from, to, openings, material = M.plaster) {
    const piece = (a, c, bottom, top) => {
      if (c - a < 0.001 || top - bottom < 0.001) return;
      const mid = (a + c) / 2,
        cy = (bottom + top) / 2;
      if (axis === "x") tiled(material, mid, cy, at, c - a, top - bottom, t, 1.8);
      else tiled(material, at, cy, mid, t, top - bottom, c - a, 1.8);
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
  const front = P.front + t / 2,
    back = P.back - t / 2,
    side = W + t / 2;
  wall("x", front, -W - t, W + t, [
    { span: P.bigWindow.x, rise: P.bigWindow.y },
    { span: P.door.x, rise: P.door.y },
  ]);
  wall("x", back, -W - t, W + t, [{ span: P.rearWindow.x, rise: P.rearWindow.y }]);
  const sideOpening = [{ span: P.sideWindow.z, rise: P.sideWindow.y }];
  wall("z", -side, P.back, P.front, sideOpening);
  wall("z", side, P.back, P.front, sideOpening);
  wall("x", P.partition, -W, W, [{ span: P.backDoor.x, rise: P.backDoor.y }]);

  // A veneer along a wall's face: `dir` is the way the face looks.
  function veneer(axis, at, from, to, dir, bottom, top, depth, material, su = 1.6, sv = top - bottom, v0 = bottom) {
    const mid = (from + to) / 2,
      cy = (bottom + top) / 2;
    return axis === "x"
      ? tiled(material, mid, cy, at + (dir * depth) / 2, to - from, top - bottom, depth, su, sv, root, v0)
      : tiled(material, at + (dir * depth) / 2, cy, mid, depth, top - bottom, to - from, su, sv, root, v0);
  }
  const southFace = P.partition + t / 2,
    northFace = P.partition - t / 2,
    d = P.dado;
  // The tiled dado through the hall and the sorting office.
  const tiledRuns = [
    ["x", P.front, -W, P.bigWindow.x[0] - 0.14, -1],
    ["x", P.front, P.bigWindow.x[1] + 0.14, P.door.x[0] - 0.14, -1],
    ["x", P.front, P.door.x[1] + 0.14, W, -1],
    ["z", -W, southFace, P.front, 1],
    ["z", W, southFace, P.front, -1],
    ["x", southFace, P.frame.maxX, P.backDoor.x[0], 1],
    ["x", southFace, P.backDoor.x[1], P.dresser.minX, 1],
  ];
  for (const [axis, at, from, to, dir] of tiledRuns) {
    veneer(axis, at, from, to, dir, 0, d, 0.035, M.dado);
    const mid = (from + to) / 2;
    if (axis === "x") rb(M.capTile, mid, d + 0.03, at + dir * 0.045, to - from, 0.07, 0.09, 0.024);
    else rb(M.capTile, at + dir * 0.045, d + 0.03, mid, 0.09, 0.07, to - from, 0.024);
  }
  // The back room: limewash above plain green matchboard, capped with a rail.
  const backRuns = [
    ["z", -W, P.back, northFace, 1],
    ["z", W, P.back, northFace, -1],
    ["x", P.back, P.workbench.maxX, W, 1],
    ["x", northFace, -W, P.backDoor.x[0], -1],
    ["x", northFace, P.backDoor.x[1], W, -1],
  ];
  for (const [axis, at, from, to, dir] of backRuns) {
    veneer(axis, at, from, to, dir, 0, 1.45, 0.03, M.matchboard, 0.8, 1.6);
    const mid = (from + to) / 2;
    if (axis === "x") b(M.mahoganyDark, mid, 1.47, at + dir * 0.04, to - from, 0.05, 0.08);
    else b(M.mahoganyDark, at + dir * 0.04, 1.47, mid, 0.08, 0.05, to - from);
  }
  // The stencilled frieze, picture rail and cornice round the public rooms.
  const roomRuns = [
    ["x", P.front, -W, W, -1],
    ["z", -W, southFace, P.front, 1],
    ["z", W, southFace, P.front, -1],
    ["x", southFace, -W, W, 1],
  ];
  for (const [axis, at, from, to, dir] of roomRuns) {
    const mid = (from + to) / 2;
    veneer(axis, at, from, to, dir, 3.66, 3.9, 0.012, M.frieze, 1.92, 0.24);
    if (axis === "x") {
      b(M.mahoganyDark, mid, 3.63, at + dir * 0.03, to - from, 0.07, 0.06);
      rb(M.trim, mid, H - 0.11, at + dir * 0.06, to - from, 0.22, 0.12, 0.03);
    } else {
      b(M.mahoganyDark, at + dir * 0.03, 3.63, mid, 0.06, 0.07, to - from);
      rb(M.trim, at + dir * 0.06, H - 0.11, mid, 0.12, 0.22, to - from, 0.03);
    }
  }
  const whitewash = (axis, at, from, to, dir, bottom = 1.5, top = H) =>
    veneer(axis, at, from, to, dir, bottom, top, 0.014, M.whitewash, 1.8, 1.8);
  whitewash("z", -W, P.back, northFace, 1);
  whitewash("z", W, P.back, northFace, -1);
  // Round the rear window, and over and either side of the door through.
  whitewash("x", P.back, -W, P.rearWindow.x[0], 1);
  whitewash("x", P.back, P.rearWindow.x[1], W, 1);
  whitewash("x", P.back, P.rearWindow.x[0], P.rearWindow.x[1], 1, P.rearWindow.y[1], H);
  whitewash("x", northFace, -W, P.backDoor.x[0], -1);
  whitewash("x", northFace, P.backDoor.x[1], W, -1);
  whitewash("x", northFace, P.backDoor.x[0], P.backDoor.x[1], -1, P.backDoor.y[1], H);
  for (const [axis, at, from, to, dir] of [
    ["z", -W, P.back, northFace, 1],
    ["z", W, P.back, northFace, -1],
    ["x", P.back, -W, W, 1],
    ["x", northFace, -W, W, -1],
  ]) {
    const mid = (from + to) / 2;
    if (axis === "x") rb(M.trim, mid, H - 0.08, at + dir * 0.05, to - from, 0.16, 0.1, 0.02);
    else rb(M.trim, at + dir * 0.05, H - 0.08, mid, 0.1, 0.16, to - from, 0.02);
  }

  // ----------------------------------------------------------------- ceiling
  tiled(M.ceilingBoards, 0, H + 0.1, (P.front + P.back) / 2, 2 * W + 2 * t, 0.2, P.front - P.back + 2 * t, 1.2);
  for (const z of [3.05, 0.95, -1.35, -5.3]) rb(M.beam, 0, H - 0.13, z, 2 * W, 0.26, 0.26, 0.025).castShadow = false;
  // Old iron brackets along the hall's beam, from a rail long gone.
  for (const x of [-4.8, 0, 4.8]) b(M.iron, x, H - 0.28, 3.05, 0.1, 0.05, 0.3);

  // ----------------------------------------------------------------- windows
  /** Sash bars and frame for an opening: `turn` looks its local +z into the room. */
  function casement(cx, cy, cz, w, h, turn, bars, sill = 0.2) {
    const g = group(cx, cy, cz, turn),
      frameW = 0.1;
    for (const sx of [-1, 1]) b(M.trim, (sx * (w - frameW)) / 2, 0, 0, frameW, h, t * 0.9, g);
    for (const sy of [-1, 1]) b(M.trim, 0, (sy * (h - frameW)) / 2, 0, w, frameW, t * 0.9, g);
    for (const x of bars.x ?? []) b(M.trim, x, 0, 0.02, 0.05, h, 0.06, g);
    for (const y of bars.y ?? []) b(M.trim, 0, y, 0.02, w, 0.05, 0.06, g);
    // Architrave on the room's face.
    for (const sx of [-1, 1]) rb(M.trim, (sx * (w + 0.1)) / 2, 0, t / 2 + 0.02, 0.16, h + 0.26, 0.05, 0.012, g);
    rb(M.trim, 0, h / 2 + 0.09, t / 2 + 0.03, w + 0.36, 0.14, 0.07, 0.015, g);
    if (sill) rb(M.trim, 0, -h / 2 - 0.05, t / 2 + 0.05, w + 0.3, 0.07, sill, 0.015, g);
    // Queued for the room's one merged sheet of glass.
    g.updateMatrixWorld(true);
    const pane = new T.PlaneGeometry(w, h);
    pane.applyMatrix4(new T.Matrix4().compose(new T.Vector3(cx, cy, cz), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), turn), new T.Vector3(1, 1, 1)));
    panes.push(pane);
    return g;
  }
  const big = P.bigWindow,
    bw = big.x[1] - big.x[0],
    bh = big.y[1] - big.y[0],
    bx = (big.x[0] + big.x[1]) / 2,
    by = (big.y[0] + big.y[1]) / 2;
  casement(bx, by, front, bw, bh, Math.PI, { x: [-bw / 6, bw / 6], y: [0.72] }, 0);
  // Gold leaf on the inside of the glass, reading backwards from in here.
  clearDecal(
    2048,
    560,
    (c, w, h) => goldLeaf(c, w, h, [[SIGNS.window, 190, 250], [SIGNS.subline, 432, 96]]),
    bx,
    by - 0.1,
    P.front + 0.02,
    bw - 0.4,
    1.1,
    Math.PI,
  );
  const sw = P.sideWindow,
    sideW = sw.z[1] - sw.z[0],
    sideH = sw.y[1] - sw.y[0],
    sideZ = (sw.z[0] + sw.z[1]) / 2,
    sideY = (sw.y[0] + sw.y[1]) / 2;
  casement(-side, sideY, sideZ, sideW, sideH, Math.PI / 2, { x: [0], y: [0.22] });
  casement(side, sideY, sideZ, sideW, sideH, -Math.PI / 2, { x: [0], y: [0.22] });
  const rw = P.rearWindow,
    rearW = rw.x[1] - rw.x[0],
    rearH = rw.y[1] - rw.y[0];
  casement((rw.x[0] + rw.x[1]) / 2, (rw.y[0] + rw.y[1]) / 2, back, rearW, rearH, 0, { x: [0], y: [0.3] }, 0.16);

  // ---------------------------------------------------------- the front door
  const dx = (P.door.x[0] + P.door.x[1]) / 2,
    dw = P.door.x[1] - P.door.x[0],
    dh = P.door.y[1];
  const door = group(dx, 0, P.front + t * 0.4, Math.PI);
  const stile = 0.17,
    leaf = dw - 0.1;
  for (const sx of [-1, 1]) b(M.doorGreen, (sx * (leaf - stile)) / 2, dh / 2, 0, stile, dh, 0.08, door);
  b(M.doorGreen, 0, 0.13, 0, leaf, 0.26, 0.08, door);
  b(M.doorGreen, 0, 1.36, 0, leaf, 0.2, 0.08, door);
  b(M.doorGreen, 0, dh - 0.09, 0, leaf, 0.18, 0.08, door);
  b(M.doorGreen, 0, 0.8, 0, leaf - 0.1, 0.92, 0.05, door);
  for (const sx of [-1, 1]) {
    rb(M.doorGreen, sx * 0.4, 0.8, 0.035, 0.62, 0.72, 0.03, 0.01, door);
    rb(parts.mat("#435c49", 0.45), sx * 0.4, 0.8, 0.052, 0.46, 0.56, 0.015, 0.006, door);
  }
  // The letter flap, the bolt and the knob, on the room's side.
  rb(M.brass, 0, 1.36, 0.05, 0.46, 0.09, 0.015, 0.006, door);
  b(M.brassDull, 0, 1.36, 0.06, 0.34, 0.015, 0.01, door);
  parts.orb(M.brass, 0.72, 1.56, 0.1, 0.05, 0.05, 0.05, door);
  cyl(M.brass, 0.72, 1.56, 0.06, 0.018, 0.09, 0.018, door, 8).rotation.x = Math.PI / 2;
  rb(M.brass, 0.72, 1.56, 0.046, 0.1, 0.24, 0.012, 0.004, door);
  b(M.iron, -0.72, 2.95, 0.05, 0.05, 0.3, 0.025, door);
  panes.push(new T.PlaneGeometry(leaf - 2 * stile, dh - 1.64).applyMatrix4(new T.Matrix4().makeTranslation(dx, 1.46 + (dh - 1.64) / 2 + 0.08, P.front + t * 0.42)));
  clearDecal(
    1024,
    640,
    (c, w, h) => goldLeaf(c, w, h, [["POST", 200, 170], ["OFFICE", 400, 170], ["Pull", 560, 70]]),
    dx,
    2.3,
    P.front + t * 0.39,
    1.3,
    0.82,
    Math.PI,
  );
  // The door's frame and its brass-capped threshold.
  for (const x of P.door.x) rb(M.trim, x, dh / 2 + 0.05, P.front - 0.02, 0.2, dh + 0.1, 0.06, 0.012);
  rb(M.trim, dx, dh + 0.1, P.front - 0.025, dw + 0.42, 0.16, 0.07, 0.015);
  rb(M.brass, dx, 0.012, P.front + 0.06, dw, 0.024, 0.2, 0.006).castShadow = false;

  // ------------------------------------------------- the door to the back room
  const pd = P.backDoor,
    pdw = pd.x[1] - pd.x[0];
  for (const x of pd.x) {
    b(M.mahoganyDark, x, pd.y[1] / 2, P.partition, 0.14, pd.y[1], t + 0.1);
  }
  b(M.mahoganyDark, (pd.x[0] + pd.x[1]) / 2, pd.y[1] + 0.07, P.partition, pdw + 0.28, 0.14, t + 0.1);
  // The door itself stands wide open, flat against the back room's wall.
  const leafW = pdw - 0.12,
    openDoor = group(pd.x[1] + 0.08 + leafW / 2, 0, northFace - 0.065);
  b(M.mahogany, 0, pd.y[1] / 2 - 0.02, 0, leafW, pd.y[1] - 0.06, 0.06, openDoor);
  for (const [py, ph] of [[0.72, 1.05], [2.1, 1.25]]) {
    rb(M.mahoganyDark, 0, py, -0.035, leafW - 0.34, ph, 0.02, 0.008, openDoor);
    rb(M.mahogany, 0, py, -0.05, leafW - 0.52, ph - 0.18, 0.018, 0.006, openDoor);
  }
  parts.orb(M.brass, -leafW / 2 + 0.14, 1.5, -0.07, 0.05, 0.05, 0.05, openDoor);
  decal(A.privateSign, 0, 2.45, -0.064, 0.72, 0.26, Math.PI, openDoor);

  // ----------------------------------------------------- the view out of doors
  // A painted card outside each window: never lit, a little over-bright so the
  // openings bloom, and tinted as the hour changes.
  const stripes = ["#d39a3c", "#5f7fa3", "#c46a4a", "#6f9a5a"];
  const sky = (c, w, h, horizon) => {
    const g = c.createLinearGradient(0, 0, 0, horizon);
    g.addColorStop(0, "#74a9cc");
    g.addColorStop(1, "#e9e0c4");
    c.fillStyle = g;
    c.fillRect(0, 0, w, horizon);
    for (let i = 0; i < 14; i++) {
      const x = random() * w,
        y = random() * horizon * 0.72;
      c.fillStyle = "rgba(255,250,238,0.42)";
      for (let k = 0; k < 6; k++) {
        c.beginPath();
        c.ellipse(x + k * range(14, 26), y + range(-5, 5), range(18, 42), range(7, 15), 0, 0, Math.PI * 2);
        c.fill();
      }
    }
  };
  // A row of crowns, each dark below and catching the light high on its west.
  const treeLine = (c, w, y, tall, colour) => {
    for (let x = -20; x < w + 20; x += range(20, 46)) {
      const r = range(tall * 0.6, tall),
        cy = y - range(0, tall * 0.35);
      c.fillStyle = shade(colour, range(-0.3, -0.18));
      c.beginPath();
      c.ellipse(x, cy, r * 1.05, r, 0, 0, Math.PI * 2);
      c.fill();
      for (let k = 0; k < 16; k++) {
        const a = random() * Math.PI * 2,
          d = Math.sqrt(random()) * r * 0.85,
          lit = 1 - (Math.sin(a) * d) / r;
        c.fillStyle = shade(colour, -0.2 + lit * 0.2 + range(-0.05, 0.05));
        c.beginPath();
        c.arc(x + Math.cos(a) * d - r * 0.08, cy + Math.sin(a) * d - r * 0.1, r * range(0.16, 0.34), 0, Math.PI * 2);
        c.fill();
      }
    }
  };
  const lane = paint(
    1536,
    768,
    (c, w, h) => {
      const horizon = h * 0.56;
      sky(c, w, h, horizon);
      treeLine(c, w, horizon + 5, 44, "#6b8f55");
      c.fillStyle = "#86a85c";
      c.fillRect(0, horizon, w, h);
      // The hedge across the lane and the gravel in front of it.
      treeLine(c, w, horizon + 60, 26, "#4f7a3d");
      c.fillStyle = "#c7b68f";
      c.fillRect(0, horizon + 66, w, h);
      for (let i = 0; i < 5000; i++) {
        c.fillStyle = random() > 0.5 ? "rgba(255,245,220,0.3)" : "rgba(90,75,50,0.25)";
        c.fillRect(random() * w, horizon + 66 + random() * (h - horizon), range(1, 4), range(1, 2));
      }
      // Two of the square's stalls off to the west, under their awnings.
      MARKET.stalls.slice(2).forEach((stall, i) => {
        const x = w * (0.6 + i * 0.2),
          sw2 = 170,
          ay = horizon - 18;
        c.fillStyle = "#65513e";
        c.fillRect(x, ay, 8, 112);
        c.fillRect(x + sw2 - 8, ay, 8, 112);
        c.fillStyle = "#8a6a4a";
        c.fillRect(x - 4, ay + 66, sw2 + 8, 48);
        for (let s = 0; s < 8; s++) {
          c.fillStyle = s % 2 ? "#f2ead5" : stripes[i];
          c.beginPath();
          c.moveTo(x + (s * sw2) / 8, ay - 34);
          c.lineTo(x + ((s + 1) * sw2) / 8, ay - 34);
          c.lineTo(x + ((s + 1) * sw2) / 8 + 3, ay);
          c.lineTo(x + (s * sw2) / 8 - 3, ay);
          c.fill();
        }
      });
      // The bunting across the square, and the lamp by the lane.
      c.strokeStyle = "#5a4a3a";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(w * 0.5, horizon - 150);
      c.quadraticCurveTo(w * 0.75, horizon - 70, w, horizon - 158);
      c.stroke();
      for (let i = 0; i < 18; i++) {
        const f = (i + 0.5) / 18,
          x = w * 0.5 + f * w * 0.5,
          y = (1 - f) ** 2 * (horizon - 150) + 2 * f * (1 - f) * (horizon - 70) + f * f * (horizon - 158);
        c.fillStyle = ["#d24b4a", "#f2d27a", "#5f7fa3", "#f2ead5", "#6f9a5a"][i % 5];
        c.beginPath();
        c.moveTo(x - 10, y);
        c.lineTo(x + 10, y);
        c.lineTo(x, y + 25);
        c.fill();
      }
      c.fillStyle = "#2c2d2f";
      c.fillRect(w * 0.38, horizon - 110, 8, 200);
      c.fillStyle = "#f2d27a";
      c.fillRect(w * 0.38 - 12, horizon - 142, 32, 40);
      c.strokeStyle = "#2c2d2f";
      c.lineWidth = 5;
      c.strokeRect(w * 0.38 - 12, horizon - 142, 32, 40);
    },
    false,
  );
  const country = paint(
    1024,
    512,
    (c, w, h) => {
      const horizon = h * 0.58;
      sky(c, w, h, horizon);
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
      for (let i = 0; i < 2400; i++) {
        c.fillStyle = random() > 0.5 ? "rgba(190,220,130,0.4)" : "rgba(60,95,50,0.3)";
        c.fillRect(random() * w, horizon + 18 + random() * (h - horizon), 1.6, range(2, 7));
      }
      treeLine(c, w, horizon + 118, 44, "#456b35");
    },
    false,
  );
  const views = [
    { map: lane, x: bx + 1.4, z: P.front + 7, turn: Math.PI, w: 26, h: 13, y: 3.3 },
    { map: country, x: -W - 6, z: sideZ, turn: Math.PI / 2, w: 20, h: 10, y: 3.2 },
    { map: country, x: W + 6, z: sideZ, turn: -Math.PI / 2, w: 20, h: 10, y: 3.2 },
    { map: country, x: 3.4, z: P.back - 6, turn: 0, w: 20, h: 10, y: 3.2 },
  ];
  const viewMaterials = new Map();
  for (const view of views) {
    if (!viewMaterials.has(view.map))
      viewMaterials.set(view.map, new T.MeshBasicMaterial({ map: view.map, color: VIEW_DAY.clone() }));
    const card = mesh(new T.PlaneGeometry(view.w, view.h), viewMaterials.get(view.map), view.x, view.y, view.z);
    card.rotation.y = view.turn;
    card.castShadow = card.receiveShadow = false;
  }

  // All the room's window glass, as one sheet that casts nothing.
  const glass = mesh(mergeGeometries(panes), M.glass);
  glass.castShadow = glass.receiveShadow = false;
  panes.forEach((g) => g.dispose());

  return { viewMaterials: [...viewMaterials.values()] };
}
