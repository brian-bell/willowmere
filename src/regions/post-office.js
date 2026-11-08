// The post office from the lane, and the planting round it. Red brick on a
// stone plinth with dressed quoins, a sill band and a corbelled band under the
// eaves; a coursed slate roof with ridge tiles, cream bargeboards and finials,
// gutters and downpipes, and a corbelled stack with two pots. The front is a
// painted shopfront: pilasters, a fascia carrying the sign between two
// consoles under a cornice, a panelled stall riser, a three-light window with
// notices stuck in it, and a half-glazed door with its letter plate and a
// clipped box in a pot either side. Hanging baskets at the shopfront's ends,
// a stamp machine on the wall, a bench, parcels, a noticeboard and the
// postman's bicycle round the side, and the pillar box at the lane.
//
// Built as two kits like the tea room: the building, and its small things,
// which the overview hides zoomed far out, where each is a pixel. Everything
// here draws from its own seeded stream, never the lane's shared one.
import { MARKET as M } from "./market-layout.js";
import { createKit } from "./kit.js";

const TAU = Math.PI * 2;

const C = {
  brick: "#b97a5e",
  brickDark: "#985c46",
  bricks: ["#a86a50", "#c4876a", "#9e6249", "#b5745a", "#cf9173", "#a5654d"],
  plinth: "#8e8a7e",
  plinthCap: "#a6a194",
  stone: "#ddd3bb",
  trim: "#e6dcc4",
  green: "#3f5f4a",
  greenLight: "#4d6f58",
  door: "#4f6b56",
  slate: "#6d7a80",
  slates: ["#68757b", "#737f85"],
  slateEave: "#5a656b",
  ridge: "#56626a",
  iron: "#3a3d3f",
  red: "#b3392f",
  redDark: "#8f2b24",
  gold: "#d8b25a",
  glass: "#ffcf73",
  wood: "#7f6145",
  woodDark: "#65513e",
  terracotta: "#b5653f",
  terracottaDark: "#9c5535",
  soil: "#5d4a38",
};

// The shopfront's fascia: centred `x` from the building's middle, its sign
// `y` up, as wide as the shopfront from the west pilaster to the door's east one.
const FASCIA = { x: -0.285, y: 2.21, w: 3.41, h: 0.5 };

/** Where the painted "POST OFFICE" board hangs: on the fascia. */
export const postSignAt = () => ({
  x: M.postOffice.x + FASCIA.x,
  y: FASCIA.y,
  z: M.postOffice.z + M.postOffice.d / 2 + 0.11,
  width: 1.9,
});

function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The post office, its pillar box and its planting, as two kits: `main`, the
 * building with its glass, and `fine`, its small things.
 */
export function postOfficeKits(T) {
  const main = createKit(T),
    fine = createKit(T),
    p = M.postOffice,
    rand = seeded(5150),
    shapes = {
      // A leaf: a flattened diamond, seen from either side.
      leaf: new T.OctahedronGeometry(1, 0),
      pot: new T.CylinderGeometry(1, 0.74, 1, 10),
      wheel: new T.TorusGeometry(1, 0.075, 4, 16),
    };
  const b = { m: main, f: fine, T, rand, shapes };
  main.placed(p.x, 0, p.z, 0, () =>
    fine.placed(p.x, 0, p.z, 0, () => {
      shell(b, p);
      roof(b, p);
      shopfront(b, p);
      sides(b, p);
    }),
  );
  pillarBox(b);
  for (const plant of M.postGarden) PLANTS[plant.kind](b, plant);
  for (const shape of Object.values(shapes)) shape.dispose();
  return { main, fine };
}

// --- The building ---------------------------------------------------------------

// The plinth, the brick walls with their bands, quoins and a scatter of
// bricks a shade off the rest, the gables and the stack.
function shell({ m, f, rand }, p) {
  const { w, d, h } = p,
    pitch = 1.1,
    front = d / 2;
  m.box(C.plinth, 0, 0.18, 0, w + 0.08, 0.36, d + 0.08);
  m.box(C.plinthCap, 0, 0.38, 0, w + 0.12, 0.05, d + 0.12);
  m.box(C.brick, 0, h / 2 + 0.18, 0, w, h - 0.36, d);
  // A band of darker brick at the windows' sills, and a corbelled one under the eaves.
  m.box(C.brickDark, 0, 0.9, 0, w + 0.02, 0.08, d + 0.02);
  m.box(C.brickDark, 0, h - 0.07, 0, w + 0.04, 0.1, d + 0.04);
  f.box(C.brickDark, 0, h - 0.16, 0, w + 0.02, 0.05, d + 0.02);
  for (const side of [-1, 1])
    m.gable(
      C.brick,
      side < 0 ? -w / 2 : w / 2 - 0.06,
      h - 0.08,
      0,
      [
        [-d / 2, 0],
        [d / 2, 0],
        [0, pitch],
      ],
      0.06,
    );
  // Dressed stone quoins up each corner, long and short in turn.
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      for (let i = 0; i < 8; i++) {
        const [ax, az] = i % 2 ? [0.2, 0.36] : [0.36, 0.2];
        f.box(C.stone, sx * (w / 2 - ax / 2 + 0.014), 0.54 + i * 0.28, sz * (d / 2 - az / 2 + 0.014), ax, 0.25, az);
      }
  // Odd bricks, a shade lighter or darker, laid to the courses on the back
  // and sides (the shopfront covers most of the front), clear of the openings.
  const course = 0.075,
    length = 0.225;
  const faces = [
    // [normal x, normal z, half width along the face, openings as [u0, u1, y0, y1]]
    [0, -1, w / 2, [[0.7, 1.9, 0.92, 1.9]]],
    [1, 0, d / 2, [[-0.55, 0.55, 0.85, 1.85], [0.55, 1.4, 1.1, 1.85]]],
    [-1, 0, d / 2, [[-0.55, 0.55, 0.85, 1.85]]],
  ];
  for (const [nx, nz, half, openings] of faces) {
    let placed = 0;
    for (let tries = 0; placed < 46 && tries < 400; tries++) {
      const c = Math.floor(rand() * 40),
        y = 0.45 + c * course + course / 2,
        offset = c % 2 ? length / 2 : 0,
        j = Math.floor(rand() * 24),
        u = -half + offset + j * length + length / 2;
      // Up to the eaves, or under the gable's slope on the sides.
      const top = nz ? h - 0.24 : h - 0.12 + pitch * (1 - Math.abs(u) / (d / 2)) - 0.14;
      if (y > top || Math.abs(u) > half - 0.42) continue;
      if (Math.abs(y - 0.9) < 0.08 || Math.abs(y - (h - 0.1)) < 0.12) continue;
      if (openings.some(([u0, u1, y0, y1]) => u > u0 - 0.15 && u < u1 + 0.15 && y > y0 - 0.06 && y < y1 + 0.06)) continue;
      const color = C.bricks[Math.floor(rand() * C.bricks.length)];
      // `u` runs along the face: x on the back, z on the sides.
      if (nz) f.box(color, u, y, nz * (d / 2 + 0.004), length - 0.018, course - 0.014, 0.02);
      else f.box(color, nx * (w / 2 + 0.004), y, u, 0.02, course - 0.014, length - 0.018);
      placed++;
    }
  }
  // The stack: brick, two oversailing courses and lead flashing, and two pots.
  const sx = -1.3,
    sz = -0.5;
  m.box("#a8705a", sx, h + 1.05, sz, 0.45, 1.2, 0.45);
  m.box(C.brickDark, sx, h + 1.6, sz, 0.53, 0.07, 0.53);
  m.box("#a8705a", sx, h + 1.68, sz, 0.57, 0.07, 0.57);
  f.box("#7d8487", sx, h + 0.82, sz, 0.5, 0.06, 0.5);
  for (const [i, px] of [-0.1, 0.11].entries()) {
    f.cyl(C.terracotta, sx + px, h + 1.86, sz, 0.075, 0.3 - i * 0.06);
    f.cyl(C.terracottaDark, sx + px, h + 2.0 - i * 0.06, sz, 0.09, 0.04);
  }
  // A gutter's downpipe at each corner, with its shoe at the foot.
  for (const sz2 of [-1, 1])
    for (const sx2 of [-1, 1]) {
      const x = sx2 * (w / 2 + 0.14),
        z = sz2 * (front + 0.13);
      f.post(C.iron, x, z, 0.06, h - 0.15, 0.032);
      f.rod(C.iron, [x, h - 0.15, z], [x, h - 0.02, sz2 * (front + 0.4)], 0.032);
      f.box(C.iron, x, 0.07, z + sz2 * 0.06, 0.09, 0.06, 0.14);
    }
}

// The slate roof: two slabs, the slate courses standing proud of them, a
// row of ridge tiles, gutters along both eaves, bargeboards and finials.
function roof({ m, f }, p) {
  const { w, d, h } = p,
    pitch = 1.1,
    run = d / 2 + 0.38,
    angle = Math.atan2(pitch, d / 2),
    slope = Math.hypot(run, (run / (d / 2)) * pitch),
    centreY = h + pitch / 2 + 0.02 - ((run - d / 2) / (d / 2)) * pitch * 0.5,
    courses = 12;
  for (const side of [-1, 1]) {
    m.box(C.slate, 0, centreY, (side * run) / 2, w + 0.5, 0.13, slope, 0, side * angle);
    const down = [side * Math.cos(angle), -Math.sin(angle)],
      out = [side * Math.sin(angle), Math.cos(angle)],
      top = [-(down[0] * slope) / 2 + (side * run) / 2, centreY - (down[1] * slope) / 2];
    for (let i = 1; i <= courses; i++) {
      const t = i / courses,
        z = top[0] + down[0] * slope * t - down[0] * 0.03 + out[0] * 0.07,
        y = top[1] + down[1] * slope * t - down[1] * 0.03 + out[1] * 0.07;
      f.box(i === courses ? C.slateEave : C.slates[i % 2], 0, y, z, w + 0.5, 0.035, 0.13, 0, side * (angle + 0.1));
    }
    // The gutter, a half-round on brackets just under the eave.
    const ez = top[0] + down[0] * slope,
      ey = top[1] + down[1] * slope;
    m.cyl(C.iron, 0, ey - 0.06, ez + side * 0.03, 0.055, w + 0.5, 0, Math.PI / 2);
  }
  const ridgeY = h + pitch + 0.07;
  m.box(C.ridge, 0, ridgeY, 0, w + 0.56, 0.12, 0.22);
  for (let i = 0; i <= 9; i++) f.box("#4c575e", -(w + 0.5) / 2 + (i * (w + 0.5)) / 9, ridgeY + 0.01, 0, 0.035, 0.135, 0.235);
  // Cream bargeboards along the gables' rakes, a finial at each apex.
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 + 0.25);
    for (const side of [-1, 1]) {
      const zEave = side * run,
        yEave = h - ((run - d / 2) / (d / 2)) * pitch,
        length = Math.hypot(run, h + pitch + 0.02 - yEave);
      m.box(C.trim, x, (yEave + h + pitch + 0.02) / 2 - 0.08, zEave / 2, 0.05, 0.2, length, 0, side * angle);
    }
    f.post(C.trim, x, 0, ridgeY - 0.12, ridgeY + 0.24, 0.03);
    f.pyramid(C.trim, x, ridgeY + 0.3, 0, 0.05, 0.12);
    f.post(C.trim, x, 0, h + pitch - 0.42, h + pitch - 0.1, 0.028);
  }
}

// The shopfront: pilasters, fascia, consoles and cornice, the stall riser and
// the window, the door, the pots either side of it, the hanging baskets, the
// stamp machine, the bench and the parcels.
function shopfront(b, p) {
  const { m, f } = b,
    front = p.d / 2,
    west = FASCIA.x - FASCIA.w / 2,
    east = FASCIA.x + FASCIA.w / 2;
  // ---- the fascia under its cornice, a bead below it, and a console at each end
  m.box(C.green, FASCIA.x, FASCIA.y, front + 0.05, FASCIA.w, FASCIA.h, 0.1);
  m.box(C.trim, FASCIA.x, FASCIA.y + FASCIA.h / 2 + 0.03, front + 0.09, FASCIA.w + 0.2, 0.06, 0.18);
  f.box(C.green, FASCIA.x, FASCIA.y + FASCIA.h / 2 + 0.075, front + 0.07, FASCIA.w + 0.16, 0.03, 0.12);
  m.box(C.trim, FASCIA.x, FASCIA.y - FASCIA.h / 2 - 0.025, front + 0.075, FASCIA.w + 0.04, 0.05, 0.13);
  for (const x of [west, east]) {
    m.box(C.green, x, FASCIA.y - 0.02, front + 0.1, 0.17, FASCIA.h + 0.06, 0.15);
    f.box(C.trim, x, FASCIA.y + 0.18, front + 0.18, 0.19, 0.06, 0.03);
    f.box(C.gold, x, FASCIA.y - 0.02, front + 0.178, 0.06, 0.2, 0.012);
    f.box(C.green, x, FASCIA.y - FASCIA.h / 2 - 0.07, front + 0.12, 0.11, 0.08, 0.1);
  }
  // ---- pilasters: either end of the shopfront and between window and door
  for (const x of [west, -0.0, east]) {
    m.box(C.trim, x, 0.99, front + 0.045, 0.13, 1.9, 0.09);
    m.box(C.green, x, 0.15, front + 0.06, 0.17, 0.3, 0.12);
    f.box(C.trim, x, 1.86, front + 0.06, 0.17, 0.05, 0.12);
    f.box(C.stone, x, 1.2, front + 0.093, 0.06, 1.1, 0.012);
  }
  // ---- the stall riser, with two fielded panels
  const wx = -1.0,
    ww = 1.6,
    wy0 = 0.9,
    wy1 = 1.84,
    wyc = (wy0 + wy1) / 2,
    wh = wy1 - wy0;
  m.box(C.green, wx, 0.52, front + 0.04, ww + 0.14, 0.72, 0.08);
  for (const x of [wx - 0.42, wx + 0.42]) {
    f.box(C.greenLight, x, 0.52, front + 0.085, 0.68, 0.44, 0.015);
    f.box(C.green, x, 0.52, front + 0.095, 0.54, 0.3, 0.012);
  }
  // ---- the window: three lights with small panes above a transom
  m.glazed(() => m.box(C.glass, wx, wyc, front + 0.06, ww, wh, 0.04));
  m.box(C.trim, wx, wy0 - 0.03, front + 0.12, ww + 0.18, 0.06, 0.16);
  m.box(C.trim, wx, wy1 + 0.03, front + 0.08, ww + 0.12, 0.06, 0.06);
  for (const s of [-1, 1]) m.box(C.trim, wx + s * (ww / 2 + 0.02), wyc, front + 0.08, 0.06, wh, 0.06);
  for (const s of [-1, 1]) m.box(C.trim, wx + (s * ww) / 6, wyc, front + 0.09, 0.045, wh, 0.045);
  m.box(C.trim, wx, 1.6, front + 0.09, ww, 0.045, 0.045);
  for (const s of [-1, 0, 1]) f.box(C.trim, wx + (s * ww) / 3, 1.72, front + 0.09, 0.025, 0.24, 0.025);
  // Notices stuck inside the glass: a poster, a timetable and a card.
  f.box("#f2ead5", wx - 0.53, 1.18, front + 0.085, 0.26, 0.34, 0.006);
  f.box(C.red, wx - 0.53, 1.3, front + 0.089, 0.26, 0.06, 0.004);
  for (let i = 0; i < 3; i++) f.box("#8a8478", wx - 0.53, 1.2 - i * 0.06, front + 0.089, 0.18, 0.015, 0.004);
  f.box("#c9d8e4", wx + 0.02, 1.08, front + 0.085, 0.3, 0.22, 0.006);
  f.box("#5f7fa3", wx + 0.02, 1.15, front + 0.089, 0.3, 0.04, 0.004);
  f.box("#e9c46a", wx + 0.52, 1.24, front + 0.085, 0.2, 0.26, 0.006);
  // ---- the door: half-glazed, four panes, two panels, a letter plate
  const dx = p.door,
    dw = 0.86,
    dy0 = 0.15,
    dy1 = 1.8,
    dz = front + 0.02;
  m.box(C.door, dx, (dy0 + dy1) / 2, dz, dw, dy1 - dy0, 0.08);
  m.glazed(() => m.box(C.glass, dx, 1.42, dz + 0.045, 0.58, 0.52, 0.02));
  for (const s of [-1, 1]) m.box(C.trim, dx + s * (dw / 2 + 0.05), (dy0 + dy1) / 2 + 0.03, front + 0.06, 0.1, dy1 - dy0 + 0.1, 0.08);
  m.box(C.trim, dx, dy1 + 0.07, front + 0.075, dw + 0.26, 0.1, 0.11);
  m.box("#a8a294", dx, 0.08, front + 0.3, 1.2, 0.12, 0.45);
  f.box(C.door, dx, 1.42, dz + 0.06, 0.03, 0.52, 0.02);
  f.box(C.door, dx, 1.42, dz + 0.06, 0.58, 0.03, 0.02);
  for (const s of [-1, 1]) {
    f.box("#5f7b66", dx + s * 0.18, 0.6, dz + 0.05, 0.28, 0.58, 0.02);
    f.box(C.door, dx + s * 0.18, 0.6, dz + 0.058, 0.2, 0.48, 0.015);
  }
  f.box(C.gold, dx, 1.04, dz + 0.055, 0.3, 0.07, 0.015);
  f.box("#2f2a26", dx, 1.04, dz + 0.064, 0.22, 0.02, 0.005);
  f.ball(C.gold, dx + 0.32, 1.02, dz + 0.075, 0.032);
  f.box("#9c8a5a", dx, 0.2, dz + 0.05, dw - 0.06, 0.1, 0.012);
  f.box(C.gold, dx + dw / 2 + 0.05, 1.2, front + 0.105, 0.04, 0.06, 0.012);
  f.box("#8a6a4a", dx, 0.145, front + 0.32, 0.62, 0.012, 0.34);
  // A clipped box in a terracotta pot either side of the step.
  for (const x of [dx - 0.78, dx + 0.78]) {
    m.add(b.shapes.pot, C.terracotta, x, 0.17, front + 0.25, 0.16, 0.34, 0.16);
    m.cyl(C.terracottaDark, x, 0.345, front + 0.25, 0.175, 0.05);
    clipped(b, x, 0.6, front + 0.25, 0.21, 0.22);
  }
  // ---- hanging baskets on scrolled brackets at the shopfront's ends
  for (const x of [west, east]) {
    const z = front + 0.48,
      y = 1.42;
    f.box("#2f2c2a", x, 1.9, front + 0.2, 0.05, 0.03, 0.4);
    f.beam("#2f2c2a", [x, 1.64, front + 0.13], [x, 1.89, front + 0.34], 0.022);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU;
      f.rod("#2f2c2a", [x, 1.89, z], [x + Math.cos(a) * 0.17, y + 0.04, z + Math.sin(a) * 0.17], 0.005);
    }
    f.ball("#6b5a3e", x, y, z, 0.19, 0.13, 0.19);
    foliage(b, { x, y: y + 0.06, z, rx: 0.24, ry: 0.15, rz: 0.24, count: 46, size: 0.07, colors: ["#4d7a42", "#5c8a4a", "#6c9a55"], floor: -0.7 });
    blooms(b, { x, y: y + 0.06, z, rx: 0.24, ry: 0.16, rz: 0.24, count: 9, size: 0.04, colors: ["#e4a3b8", "#f2ead5", "#b7a6d6", "#d98b8b"], floor: -0.5 });
    // A trail of ivy falling over the rim.
    for (let i = 0; i < 5; i++) {
      const a = i * 1.37 + (x > 0 ? 0.6 : 0),
        tx = x + Math.cos(a) * 0.2,
        tz = z + Math.sin(a) * 0.2;
      for (let j = 0; j < 4; j++) b.f.add(b.shapes.leaf, j % 2 ? "#3f6a3a" : "#4d7a42", tx, y - 0.05 - j * 0.07, tz, 0.045, 0.008, 0.03, 1.2, a, 0);
    }
  }
  // ---- the stamp machine on the wall east of the shopfront
  const sm = { x: 1.72, y: 1.2, z: front + 0.09 };
  f.box(C.red, sm.x, sm.y, sm.z, 0.3, 0.46, 0.14);
  f.box(C.red, sm.x, sm.y + 0.25, sm.z + 0.02, 0.34, 0.04, 0.18);
  f.box("#f2ead5", sm.x, sm.y + 0.11, sm.z + 0.072, 0.2, 0.09, 0.006);
  for (const s of [-1, 1]) {
    f.box("#2f2a26", sm.x + s * 0.06, sm.y - 0.04, sm.z + 0.073, 0.035, 0.1, 0.006);
    f.box(C.gold, sm.x + s * 0.06, sm.y - 0.11, sm.z + 0.075, 0.04, 0.025, 0.01);
  }
  f.box("#2f2a26", sm.x, sm.y - 0.18, sm.z + 0.08, 0.18, 0.03, 0.02);
  // ---- the bench under the window, and parcels waiting by the door
  m.box(C.wood, wx, 0.44, front + 0.62, 1.5, 0.06, 0.36);
  m.box(C.wood, wx, 0.7, front + 0.46, 1.5, 0.3, 0.05);
  for (const x of [wx - 0.6, wx + 0.6]) m.box(C.woodDark, x, 0.22, front + 0.62, 0.06, 0.44, 0.3);
  for (const s of [-1, 1]) {
    f.box(C.woodDark, wx + s * 0.72, 0.62, front + 0.64, 0.05, 0.04, 0.36);
    f.box(C.woodDark, wx + s * 0.72, 0.53, front + 0.78, 0.04, 0.18, 0.04);
  }
  for (let i = 0; i < 4; i++) f.box("#6f5640", wx, 0.474, front + 0.49 + i * 0.087, 1.5, 0.006, 0.012);
  m.box("#c9a676", 1.95, 0.2, front + 0.36, 0.5, 0.4, 0.4, 0.2);
  m.box("#d6b689", 1.9, 0.52, front + 0.34, 0.36, 0.26, 0.3, -0.15);
  m.box("#b8915f", 2.0, 0.11, front + 0.86, 0.36, 0.22, 0.3, 0.5);
  f.box("#efe3c2", 1.95, 0.2, front + 0.36, 0.51, 0.41, 0.025, 0.2);
  f.box("#efe3c2", 1.95, 0.2, front + 0.36, 0.025, 0.41, 0.41, 0.2);
  f.box("#efe3c2", 1.9, 0.52, front + 0.34, 0.37, 0.265, 0.025, -0.15);
  f.box("#f2ead5", 2.0, 0.225, front + 0.86, 0.16, 0.006, 0.1, 0.5);
}

// The side windows framed in stone and brick, the rear window, the
// noticeboard and the bicycle on the east wall.
function sides(b, p) {
  const { m, f } = b,
    { w, d } = p,
    front = d / 2;
  for (const sx of [-1, 1]) {
    const x = (sx * w) / 2;
    m.glazed(() => m.box(C.glass, x + sx * 0.02, 1.35, 0, 0.05, 0.7, 0.75));
    m.box(C.stone, x + sx * 0.06, 0.96, 0, 0.12, 0.06, 0.92);
    m.box(C.brickDark, x + sx * 0.012, 1.78, 0, 0.03, 0.14, 0.97);
    f.box(C.trim, x + sx * 0.04, 1.35, 0, 0.04, 0.7, 0.04);
    f.box(C.trim, x + sx * 0.04, 1.47, 0, 0.04, 0.035, 0.75);
    for (const z of [-0.4, 0.4]) f.box(C.trim, x + sx * 0.04, 1.35, z, 0.05, 0.76, 0.06);
    f.box(C.trim, x + sx * 0.04, 1.71, 0, 0.05, 0.05, 0.86);
  }
  // The back room's window, in the rear wall.
  const rx = 1.3,
    rz = -front;
  m.glazed(() => m.box(C.glass, rx, 1.4, rz - 0.02, 0.85, 0.7, 0.05));
  m.box(C.brickDark, rx, 1.83, rz - 0.012, 1.05, 0.14, 0.03);
  m.box(C.stone, rx, 1.0, rz - 0.07, 1.09, 0.06, 0.14);
  for (const x of [rx - 0.46, rx + 0.46]) m.box(C.trim, x, 1.4, rz - 0.04, 0.07, 0.74, 0.07);
  m.box(C.trim, rx, 1.76, rz - 0.04, 0.99, 0.06, 0.07);
  f.box(C.trim, rx, 1.4, rz - 0.05, 0.035, 0.7, 0.035);
  f.box(C.trim, rx, 1.52, rz - 0.05, 0.85, 0.035, 0.035);
  // A noticeboard under a little roof, on the east wall near the front.
  const nx = w / 2,
    nz = 0.98,
    ny = 1.45;
  f.box(C.green, nx + 0.025, ny, nz, 0.05, 0.6, 0.72);
  f.box("#b08a5a", nx + 0.055, ny, nz, 0.012, 0.5, 0.62);
  f.box(C.green, nx + 0.08, ny + 0.34, nz, 0.14, 0.04, 0.8, 0, 0, -0.35);
  [
    ["#f2ead5", -0.16, 0.08, 0.16, 0.2],
    ["#e9c46a", 0.1, 0.1, 0.18, 0.13],
    ["#c9d8e4", 0.15, -0.1, 0.14, 0.18],
    ["#f2ead5", -0.08, -0.12, 0.2, 0.14],
    ["#e4a3b8", -0.22, -0.13, 0.1, 0.12],
  ].forEach(([color, dz, dy, cw, ch]) => f.box(color, nx + 0.064, ny + dy, nz + dz, 0.006, ch, cw));
  bicycle(b, w / 2 + 0.26, 0.92);
}

// The postman's red bicycle, leaning on the wall with a basket on the front.
function bicycle({ f, T, shapes }, x, z) {
  const lean = new T.Matrix4().compose(
    new T.Vector3(x, 0, z),
    new T.Quaternion().setFromEuler(new T.Euler(0, 0, 0.2)),
    new T.Vector3(1, 1, 1),
  );
  f.transformed(lean, () => {
    const red = "#a8332b",
      dark = "#2b2a28",
      r = 0.31,
      rear = [0, r, -0.52],
      hub = [0, r, 0.52],
      bracket = [0, 0.3, -0.07],
      seat = [0, 0.82, -0.2],
      head = [0, 0.84, 0.34];
    for (const at of [rear, hub]) {
      f.add(shapes.wheel, dark, ...at, r, r, r, 0, Math.PI / 2);
      f.add(shapes.wheel, "#9a9a92", ...at, r - 0.03, r - 0.03, r * 0.4, 0, Math.PI / 2);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI;
        f.beam("#b8b8b0", [0, at[1] + Math.sin(a) * (r - 0.03), at[2] + Math.cos(a) * (r - 0.03)], [0, at[1] - Math.sin(a) * (r - 0.03), at[2] - Math.cos(a) * (r - 0.03)], 0.006);
      }
    }
    for (const [a, c] of [
      [bracket, seat],
      [seat, head],
      [bracket, head],
      [rear, bracket],
      [rear, seat],
      [head, hub],
    ])
      f.beam(red, a, c, 0.032);
    f.box("#5a3e2c", 0, 0.88, -0.22, 0.1, 0.05, 0.22);
    f.beam(dark, [0, 0.8, -0.2], [0, 0.88, -0.22], 0.02);
    f.beam(dark, head, [0, 0.96, 0.31], 0.024);
    f.box(dark, 0, 0.96, 0.29, 0.44, 0.022, 0.022, 1.25);
    f.box("#2b2a28", 0, 0.3, -0.07, 0.12, 0.06, 0.06);
    // The basket, with a bundle of letters in it.
    f.box("#b08a5a", 0, 0.82, 0.56, 0.18, 0.18, 0.26);
    f.box("#7a5c3c", 0, 0.9, 0.56, 0.15, 0.012, 0.22);
    f.box("#f2ead5", 0, 0.92, 0.55, 0.12, 0.04, 0.17, 0.2);
  });
}

// The pillar box: a plinth, the body, a capped dome, the aperture under its
// hood, the collection plate and the door's outline.
function pillarBox({ m, f }) {
  const { x, z } = M.postBox;
  m.cyl("#3d3a36", x, 0.05, z, 0.27, 0.1);
  m.cyl(C.red, x, 0.66, z, 0.22, 1.12);
  m.cyl(C.red, x, 1.235, z, 0.25, 0.05);
  m.ball(C.red, x, 1.26, z, 0.232, 0.13, 0.232);
  f.cyl(C.red, x, 0.15, z, 0.235, 0.07);
  f.cyl(C.redDark, x, 1.17, z, 0.226, 0.03);
  f.box("#221f1c", x, 1.02, z + 0.214, 0.2, 0.035, 0.03);
  f.box(C.red, x, 1.065, z + 0.222, 0.26, 0.03, 0.06);
  f.box("#f2ead5", x, 0.86, z + 0.218, 0.13, 0.09, 0.012);
  for (let i = 0; i < 2; i++) f.box("#3b3632", x, 0.875 - i * 0.03, z + 0.225, 0.09, 0.008, 0.004);
  f.box(C.gold, x, 0.66, z + 0.222, 0.07, 0.07, 0.01);
  for (const y of [0.3, 0.98]) f.box(C.redDark, x, y, z + 0.219, 0.24, 0.012, 0.01);
  for (const s of [-1, 1]) f.box(C.redDark, x + s * 0.12, 0.64, z + 0.2, 0.012, 0.68, 0.03);
}

// --- Planting -------------------------------------------------------------------

// Leaves over the upper part of an ellipsoid, each turned to face outwards,
// lighter towards the top. `floor` is the lowest leaf's height on the
// ellipsoid, from -1 (its foot) to 1 (its crown).
function foliage({ f, rand, shapes }, { x, y, z, rx, ry, rz, count, size, colors, floor = -0.25, depth = [0.86, 1.06] }) {
  for (let i = 0; i < count; i++) {
    const u = rand() * TAU,
      dy = floor + (1 - floor) * rand(),
      s = Math.sqrt(1 - dy * dy),
      dx = Math.cos(u) * s,
      dz = Math.sin(u) * s,
      k = depth[0] + (depth[1] - depth[0]) * rand(),
      length = size * (0.75 + rand() * 0.5),
      shade = Math.min(colors.length - 1, Math.floor(((dy + 1) / 2) * colors.length * 0.75 + rand() * colors.length * 0.5));
    f.add(
      shapes.leaf,
      colors[shade],
      x + dx * rx * k,
      y + dy * ry * k,
      z + dz * rz * k,
      length,
      length * 0.13,
      length * 0.52,
      Math.acos(dy) * (0.65 + rand() * 0.5),
      Math.atan2(dx, dz) + (rand() - 0.5) * 0.9,
      (rand() - 0.5) * 0.7,
    );
  }
}

// Small round flowers dotted over an ellipsoid's upper part.
function blooms({ f, rand }, { x, y, z, rx, ry, rz, count, size, colors, floor = 0 }) {
  for (let i = 0; i < count; i++) {
    const u = rand() * TAU,
      dy = floor + (1 - floor) * rand(),
      s = Math.sqrt(1 - dy * dy);
    f.ball(colors[i % colors.length], x + Math.cos(u) * s * rx, y + dy * ry, z + Math.sin(u) * s * rz, size * (0.8 + rand() * 0.4));
  }
}

// A clipped box ball: a smooth green core with a close nap of tiny leaves.
function clipped(b, x, y, z, r, ry) {
  b.m.ball("#3f6a35", x, y, z, r, ry, r);
  foliage(b, { x, y, z, rx: r, ry, rz: r, count: 44, size: 0.05, colors: ["#3a6331", "#43703a", "#4f7d43"], floor: -0.6, depth: [0.98, 1.03] });
}

// The soil a plant grows from: grass keeps off it (marketGrass).
const bed = (m, x, z, r) => m.cyl(C.soil, x, 0.012, z, r, 0.022);

const PLANTS = {
  // A mophead hydrangea: broad leaves, and blue and lilac heads of florets.
  hydrangea(b, { x, z, r, h }) {
    const { m, f, rand, shapes } = b,
      cy = h * 0.48,
      ry = h * 0.52;
    bed(m, x, z, Math.min(r, 0.4) + 0.24);
    m.ball("#46703f", x, cy, z, r * 0.9, ry * 0.92, r * 0.9);
    foliage(b, { x, y: cy, z, rx: r, ry, rz: r, count: 150, size: 0.14, colors: ["#3f6a3a", "#4a7741", "#568548", "#649352"] });
    const heads = ["#8fa8dc", "#a99ad6", "#7f9fd0", "#b8a8e0"],
      florets = ["#c3d0f0", "#d3c8ee", "#aebfe8"];
    for (let i = 0; i < 9; i++) {
      const u = i * 2.39 + 0.4,
        dy = 0.25 + (i % 4) * 0.2,
        s = Math.sqrt(1 - dy * dy),
        hx = x + Math.cos(u) * s * r * 0.98,
        hy = cy + dy * ry * 0.98,
        hz = z + Math.sin(u) * s * r * 0.98;
      f.ball(heads[i % heads.length], hx, hy, hz, 0.12, 0.1, 0.12);
      for (let j = 0; j < 6; j++) {
        const a = rand() * TAU,
          e = rand() * 0.9;
        f.add(shapes.leaf, florets[j % florets.length], hx + Math.cos(a) * 0.1 * Math.cos(e), hy + Math.sin(e) * 0.09, hz + Math.sin(a) * 0.1 * Math.cos(e), 0.035, 0.012, 0.035, rand() * 3, rand() * 3);
      }
    }
  },
  // Lavender: a grey-green mound under a fan of purple spikes.
  lavender(b, { x, z, r, h }) {
    const { m, f, rand } = b;
    bed(m, x, z, Math.min(r, 0.4) + 0.2);
    m.ball("#7a8c6f", x, 0.12, z, r * 0.85, 0.2, r * 0.85);
    foliage(b, { x, y: 0.12, z, rx: r * 0.9, ry: 0.22, rz: r * 0.9, count: 46, size: 0.08, colors: ["#6e8064", "#7d8f72", "#8b9c80"], floor: -0.1 });
    const purples = ["#8a6fb8", "#9b7fc6", "#7a62a8"];
    for (let i = 0; i < 24; i++) {
      const a = rand() * TAU,
        d = Math.sqrt(rand()) * r * 0.75,
        bx = x + Math.cos(a) * d,
        bz = z + Math.sin(a) * d,
        lean = 0.15 + (d / r) * 0.35,
        tx = bx + Math.cos(a) * lean * (h - 0.2),
        tz = bz + Math.sin(a) * lean * (h - 0.2),
        top = h * (0.85 + rand() * 0.2);
      f.beam("#7d8f72", [bx, 0.2, bz], [tx, top - 0.12, tz], 0.012);
      f.beam(purples[i % 3], [tx, top - 0.13, tz], [tx + Math.cos(a) * 0.03, top + 0.04, tz + Math.sin(a) * 0.03], 0.032);
    }
  },
  // A cherry laurel: tall, dark and glossy, with big leaves.
  laurel(b, { x, z, r, h }) {
    const { m } = b,
      cy = h * 0.5,
      ry = h * 0.52;
    bed(m, x, z, Math.min(r, 0.4) + 0.24);
    m.ball("#2f5232", x, cy, z, r * 0.88, ry * 0.9, r * 0.88);
    foliage(b, { x, y: cy, z, rx: r, ry, rz: r, count: 170, size: 0.17, colors: ["#2d4f30", "#36603a", "#447046", "#55804f"], floor: -0.45 });
  },
  // A shrub rose: small dark leaves and pink roses.
  rose(b, { x, z, r, h }) {
    const { m } = b,
      cy = h * 0.5,
      ry = h * 0.5;
    bed(m, x, z, Math.min(r, 0.4) + 0.22);
    m.ball("#3c6036", x, cy, z, r * 0.86, ry * 0.9, r * 0.86);
    foliage(b, { x, y: cy, z, rx: r, ry, rz: r, count: 130, size: 0.09, colors: ["#33552f", "#3f6337", "#4b7140", "#577d47"], floor: -0.4 });
    blooms(b, { x, y: cy, z, rx: r * 1.02, ry: ry * 1.02, rz: r * 1.02, count: 14, size: 0.055, colors: ["#e4a3b8", "#d98b8b", "#f2c4cf", "#c96b7a"], floor: -0.1 });
  },
  // A box ball, clipped round.
  box(b, { x, z, r, h }) {
    bed(b.m, x, z, Math.min(r, 0.4) + 0.2);
    clipped(b, x, h * 0.5, z, r, h * 0.5);
  },
};
