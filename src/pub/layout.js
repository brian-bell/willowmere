// @ts-check
// The Drowsy Heron on paper: every dimension, wall, table and bed, free of
// three.js. The builders read their geometry from here, the study's walk reads
// its colliders and floor heights, and the plan drawing reads the same lists,
// so the model, the walk and the drawing cannot drift apart.
//
// One unit is a metre. The street is +z, the rear yard -z, the hearth -x and
// the stairs +x. The plan is an E: a central range between two gabled wings
// that stand forward, with the gallery (the front balcony) in the gap.
//
//                          rear yard (-z)
//   ┌───────────────────────────────┬─────kitchen─────┐
//   │ snug    dresser │ back bar  casks       landing │
//   │═settle═         │═══════ the bar ═══════════════│
//   │ hearth   ┌──── the well ────┐  common loft  st │
//   │ (fire)   │   long table     │  above, table  ai │
//   │═settle═  └──────────────────┘               rs │
//   ├──────┐     stools    door     stools     ┌──────┤
//   │ west │─────────────gallery above─────────│ east │
//   │ wing │                                   │ wing │
//   └──────┘             street (+z)           └──────┘

/**
 * @typedef {{ at: number, w: number, y0: number, h: number, door?: boolean, arch?: boolean, flue?: boolean }} Opening
 * @typedef {{ axis: "x" | "z", from: number, to: number, a: number, b: number, openings?: Opening[], id: string }} Wall
 *   A wall along `axis` between from and to; a and b bound its thickness on the other axis.
 * @typedef {{ x: number, z: number, w: number, d: number, rotation?: number } | { x: number, z: number, r: number }} Collider
 */

export const PUB = {
  name: "The Drowsy Heron",
  halfW: 7,
  halfD: 4,
  wall: 0.35,
  upperWall: 0.2,
  ceiling: 3.0,
  loft: 3.25,
  eaves: 5.5,
  ridge: 10,
  roofOver: 0.45,
  gableOver: 0.32,
  eye: 1.65,
  wing: {
    inner: 3,
    front: 5.2,
    jetty: 5.6,
    apexFront: 5.8,
    roofFront: 6.1,
    apexY: 7.9,
  },
  gallery: { halfW: 3, front: 5.4, railY: 1.02, eave: 5.42 },
  well: { minX: -4.6, maxX: 2, minZ: -1.55, maxZ: 1.55 },
  stair: { minX: 5.55, maxX: 6.65, bottomZ: 2.6, topZ: -1.6, risers: 16 },
  hearth: {
    breastX: -5.75,
    halfZ: 2.1,
    openHalfZ: 1.45,
    openH: 1.75,
    backX: -7.75,
    stoneX: -4.9,
  },
  kitchen: { minX: 1.8, maxX: 6, minZ: -6.2, wallY: 3.1, lowY: 2.45 },
  yard: { halfW: 26, front: 26 },
};

const { halfW, halfD, wall, upperWall, wing, gallery, stair } = PUB;
const inX = halfW - wall;
const rearIn = -(halfD - wall);
const frontIn = halfD - wall;

// The main roof's height over the plan, ignoring its eaves overhang.
/** @param {number} z */
export function mainRoofY(z) {
  return (
    PUB.ridge - (Math.abs(z) / halfD) * (PUB.ridge - PUB.eaves)
  );
}

/** The ground storey's brick walls, each with its window and door openings. */
/** @type {Wall[]} */
export const GROUND_WALLS = [
  {
    id: "rear",
    axis: "x",
    from: -halfW,
    to: halfW,
    a: -halfD,
    b: rearIn,
    openings: [
      { at: -5.1, w: 1.5, y0: 1.0, h: 1.3 },
      { at: 3.4, w: 0.98, y0: 0, h: 2.1, door: true, arch: true },
    ],
  },
  {
    id: "front",
    axis: "x",
    from: -wing.inner,
    to: wing.inner,
    a: frontIn,
    b: halfD,
    openings: [
      { at: 0, w: 1.3, y0: 0, h: 2.3, door: true, arch: true },
      { at: -2.05, w: 1.15, y0: 0.95, h: 1.35 },
      { at: 2.05, w: 1.15, y0: 0.95, h: 1.35 },
    ],
  },
  {
    id: "west-wing",
    axis: "x",
    from: -halfW,
    to: -wing.inner,
    a: wing.front - wall,
    b: wing.front,
    openings: [{ at: -5, w: 2.5, y0: 0.85, h: 1.65 }],
  },
  {
    id: "east-wing",
    axis: "x",
    from: wing.inner,
    to: halfW,
    a: wing.front - wall,
    b: wing.front,
    openings: [{ at: 5, w: 2.5, y0: 0.85, h: 1.65 }],
  },
  { id: "west-return", axis: "z", from: frontIn, to: wing.front, a: -wing.inner - wall, b: -wing.inner },
  { id: "east-return", axis: "z", from: frontIn, to: wing.front, a: wing.inner, b: wing.inner + wall },
  {
    id: "west",
    axis: "z",
    from: -halfD,
    to: wing.front,
    a: -halfW,
    b: -inX,
    openings: [
      { at: 3.45, w: 1.2, y0: 1.0, h: 1.3 },
      { at: -3.05, w: 0.8, y0: 1.2, h: 1.05 },
      // The fireplace runs through this wall into the stack outside it.
      { at: 0, w: 2.9, y0: 0, h: 2.02, flue: true },
    ],
  },
  {
    id: "east",
    axis: "z",
    from: -halfD,
    to: wing.front,
    a: inX,
    b: halfW,
    openings: [
      { at: 3.75, w: 1.2, y0: 1.0, h: 1.3 },
      { at: -2.7, w: 1.0, y0: 1.15, h: 1.1 },
    ],
  },
];

const U = PUB.loft;
/** The timber-framed walls of the upper storey (heights count from y = 0). */
/** @type {Wall[]} */
export const UPPER_WALLS = [
  {
    id: "rear",
    axis: "x",
    from: -halfW,
    to: halfW,
    a: -halfD,
    b: -halfD + upperWall,
    openings: [
      { at: -5.2, w: 1.0, y0: U + 0.75, h: 1.05 },
      { at: -1.8, w: 1.0, y0: U + 0.75, h: 1.05 },
      { at: 1.6, w: 1.0, y0: U + 0.75, h: 1.05 },
      { at: 5, w: 1.0, y0: U + 0.75, h: 1.05 },
    ],
  },
  {
    id: "front",
    axis: "x",
    from: -wing.inner,
    to: wing.inner,
    a: halfD - upperWall,
    b: halfD,
    openings: [
      { at: 0, w: 1.0, y0: U, h: 2.05, door: true },
      { at: -1.95, w: 1.15, y0: U + 0.72, h: 1.12 },
      { at: 1.95, w: 1.15, y0: U + 0.72, h: 1.12 },
    ],
  },
  {
    id: "west-wing",
    axis: "x",
    from: -halfW,
    to: -wing.inner,
    a: wing.jetty - upperWall,
    b: wing.jetty,
    openings: [{ at: -5, w: 2.3, y0: U + 0.7, h: 1.2 }],
  },
  {
    id: "east-wing",
    axis: "x",
    from: wing.inner,
    to: halfW,
    a: wing.jetty - upperWall,
    b: wing.jetty,
    openings: [{ at: 5, w: 2.3, y0: U + 0.7, h: 1.2 }],
  },
  { id: "west-return", axis: "z", from: halfD, to: wing.jetty, a: -wing.inner - upperWall, b: -wing.inner },
  { id: "east-return", axis: "z", from: halfD, to: wing.jetty, a: wing.inner, b: wing.inner + upperWall },
  {
    id: "west",
    axis: "z",
    from: -halfD,
    to: wing.jetty,
    a: -halfW,
    b: -halfW + upperWall,
    openings: [
      { at: 3.0, w: 0.9, y0: U + 0.75, h: 1.05 },
      { at: -2.9, w: 0.9, y0: U + 0.75, h: 1.05 },
    ],
  },
  {
    id: "east",
    axis: "z",
    from: -halfD,
    to: wing.jetty,
    a: halfW - upperWall,
    b: halfW,
    openings: [
      { at: 0.9, w: 1.1, y0: U + 0.7, h: 1.15 },
      { at: 3.6, w: 0.9, y0: U + 0.75, h: 1.05 },
      { at: -2.6, w: 0.9, y0: U + 0.75, h: 1.05 },
    ],
  },
];

/** The great room's furniture, in the order it is built. */
export const GREAT_ROOM = {
  longTable: { x: -1.4, z: 0, length: 4, width: 0.95 },
  // Round tables either side of the door, and a square one by the stairs.
  roundTables: [
    { x: -2.4, z: 2.62, r: 0.6 },
    { x: 2.4, z: 2.62, r: 0.6 },
  ],
  squareTable: { x: 3.55, z: 0.6, size: 0.95 },
  // Each wing's window booth: a table, a settle under the window and a bench.
  booths: [
    { x: -5, z: 3.98, length: 2.0 },
    { x: 4.9, z: 3.98, length: 2.0 },
  ],
  snug: { x: -5.1, z: -3.0, length: 1.5 },
  settles: [
    { x: -4.85, z: -2.05, length: 1.75, faces: 1 },
    { x: -4.85, z: 2.05, length: 1.75, faces: -1 },
  ],
  wingChair: { x: -3.85, z: 0.45, rotation: 1.95 },
  rug: { x: -4.3, z: 0, w: 1.9, d: 2.5 },
  dresser: { x: -3.3, z: rearIn + 0.24, w: 1.7, d: 0.46 },
  bar: { minX: -1.2, maxX: stair.minX - 0.1, minZ: -2.2, maxZ: -1.55, returnMinX: -1.75, returnMinZ: -2.9 },
  backBar: { minZ: rearIn, maxZ: rearIn + 0.45, runs: [[-0.6, 2.72], [3.95, 4.62]] },
  casks: { x: 5.65, z: -3.0 },
  stools: [0, 0.95, 1.9, 2.85, 3.8, 4.75].map((x) => ({ x, z: -1.18 })),
  posts: [
    [-4.6, -1.55],
    [-4.6, 1.55],
    [-1.3, -1.55],
    [-1.3, 1.55],
    [2, -1.55],
    [2, 1.55],
  ],
};

/** The sleeping loft: every bed in the inn, and who is asleep in it. */
export const LOFT = {
  // Cots run along x; `head` is the end the pillow is at.
  cots: [
    { x: -2.0, z: 3.25, head: -1 },
    { x: 2.0, z: 3.25, head: 1 },
    { x: -5.3, z: -3.3, head: -1, sleeper: true },
    { x: -3.05, z: -3.3, head: 1 },
    { x: -0.8, z: -3.3, head: -1 },
    { x: 1.45, z: -3.3, head: 1, sleeper: true },
    { x: 3.7, z: -3.3, head: -1 },
    { x: 4.55, z: -0.92, head: 1 },
    { x: 4.55, z: 0, head: 1, sleeper: true },
    { x: 4.55, z: 0.92, head: 1 },
  ],
  // The curtained four-posters under the wing gables, for those who can pay.
  beds: [
    { x: -5, z: 4.7 },
    { x: 5, z: 4.7 },
  ],
  cot: { length: 1.9, width: 0.84 },
  bed: { length: 2.1, width: 1.45 },
  washstand: { x: 5.9, z: rearIn + 0.42 + upperWall - wall },
  dryingRack: { x: -5.3, z: 0 },
  chests: [
    { x: -3.6, z: 3.45 },
    { x: 3.6, z: 3.45 },
    { x: -5.6, z: 2.6 },
  ],
  galleryTable: { x: -1.9, z: 4.75 },
};

/** Where the yard's fixed things stand. */
export const YARD = {
  signPost: { x: -5.4, z: 8.9 },
  benches: [
    { x: 1.75, z: 8.6, rotation: 0.05 },
    { x: 5.2, z: 8.2, rotation: -0.08 },
  ],
  trough: { x: 8.9, z: 6.2 },
  hitchingRail: { x: 8.9, z: 3.2 },
  trees: [
    { x: -15, z: -9, placement: [-20, -14, 1] },
    { x: 14.5, z: -8.5, placement: [0, 0, 1] },
    { x: -21, z: 3.5, placement: [0, 0, 0.82] },
  ],
};

/**
 * The stair's rise at a point on its flight, or null off the flight.
 * @param {number} x
 * @param {number} z
 */
export function stairHeight(x, z) {
  if (x < stair.minX || x > stair.maxX) return null;
  if (z > stair.bottomZ || z < stair.topZ) return null;
  return ((stair.bottomZ - z) / (stair.bottomZ - stair.topZ)) * PUB.loft;
}

/**
 * Which storey a walker on `level` is on after standing at (x, z): the flight
 * is the only way between them, and its halfway point decides.
 * @param {"ground" | "loft"} level
 * @param {number} x
 * @param {number} z
 * @returns {"ground" | "loft"}
 */
export function levelAt(level, x, z) {
  const rise = stairHeight(x, z);
  if (rise === null) return level;
  return rise > PUB.loft / 2 ? "loft" : "ground";
}

/**
 * The floor under a walker on `level` at (x, z).
 * @param {"ground" | "loft"} level
 * @param {number} x
 * @param {number} z
 */
export function floorHeight(level, x, z) {
  return stairHeight(x, z) ?? (level === "loft" ? PUB.loft : 0);
}

/**
 * A wall's solid runs as box colliders, cut at its doors.
 * @param {Wall} wall
 * @returns {Collider[]}
 */
export function wallColliders(wall) {
  const doors = (wall.openings || [])
    .filter((o) => o.door)
    .sort((p, q) => p.at - q.at);
  const runs = [];
  let start = wall.from;
  for (const door of doors) {
    runs.push([start, door.at - door.w / 2]);
    start = door.at + door.w / 2;
  }
  runs.push([start, wall.to]);
  const across = (wall.a + wall.b) / 2,
    thick = Math.abs(wall.b - wall.a);
  return runs
    .filter(([p, q]) => q > p)
    .map(([p, q]) =>
      wall.axis === "x"
        ? { x: (p + q) / 2, z: across, w: q - p, d: thick }
        : { x: across, z: (p + q) / 2, w: thick, d: q - p },
    );
}

// The flight's two sides, in both storeys' colliders, and the end that closes
// it on each: nobody walks under the top of the stair or steps off the landing.
const flightWall = {
  x: stair.minX - 0.04,
  z: (stair.bottomZ + stair.topZ) / 2,
  w: 0.08,
  d: stair.bottomZ - stair.topZ,
};

/**
 * Everything a walker on the ground storey bumps into, outdoors included.
 * @returns {Collider[]}
 */
export function groundColliders() {
  const g = GREAT_ROOM,
    h = PUB.hearth,
    /** @type {Collider[]} */ list = GROUND_WALLS.flatMap(wallColliders);
  list.push(flightWall);
  // Under the top of the stair: the panelled cupboard and the tap room's wall.
  list.push({ x: (stair.minX + stair.maxX) / 2, z: stair.topZ + 0.75, w: stair.maxX - stair.minX, d: 1.5 });
  // The hearth: the breast either side of the opening and the fire itself.
  list.push({
    x: (h.breastX - inX) / 2,
    z: 0,
    w: inX + h.breastX + 0.6,
    d: h.halfZ * 2,
  });
  const b = g.bar;
  list.push({ x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2, w: b.maxX - b.minX, d: b.maxZ - b.minZ });
  list.push({ x: (b.returnMinX + b.minX) / 2, z: (b.returnMinZ + b.maxZ) / 2, w: b.minX - b.returnMinX, d: b.maxZ - b.returnMinZ });
  for (const [from, to] of g.backBar.runs)
    list.push({ x: (from + to) / 2, z: (g.backBar.minZ + g.backBar.maxZ) / 2, w: to - from, d: g.backBar.maxZ - g.backBar.minZ });
  list.push({ x: g.casks.x, z: g.casks.z, w: 1.95, d: 1.05 });
  const t = g.longTable;
  list.push({ x: t.x, z: t.z, w: t.length, d: t.width + 0.72 });
  for (const r of g.roundTables) list.push({ x: r.x, z: r.z, r: r.r + 0.2 });
  list.push({ x: g.squareTable.x, z: g.squareTable.z, w: g.squareTable.size + 0.8, d: g.squareTable.size + 0.8 });
  for (const o of g.booths) list.push({ x: o.x, z: o.z + 0.1, w: o.length, d: 1.62 });
  list.push({ x: g.snug.x, z: g.snug.z - 0.1, w: g.snug.length, d: 1.1 });
  for (const s of g.settles) list.push({ x: s.x, z: s.z, w: s.length, d: 0.55 });
  list.push({ x: g.wingChair.x, z: g.wingChair.z, r: 0.42 });
  list.push({ x: g.dresser.x, z: g.dresser.z, w: g.dresser.w, d: g.dresser.d });
  for (const s of g.stools) list.push({ x: s.x, z: s.z, r: 0.17 });
  for (const [x, z] of g.posts) list.push({ x, z, r: 0.17 });
  // The kitchen behind the bar: its walls and its table.
  const k = PUB.kitchen;
  list.push({ x: k.minX - 0.12, z: (k.minZ - halfD) / 2, w: 0.24, d: -k.minZ - halfD });
  list.push({ x: k.maxX + 0.12, z: (k.minZ - halfD) / 2, w: 0.24, d: -k.minZ - halfD });
  list.push({ x: (k.minX + k.maxX) / 2, z: k.minZ - 0.12, w: k.maxX - k.minX + 0.48, d: 0.24 });
  list.push({ x: 3.4, z: -5.3, w: 1.4, d: 0.7 });
  // The west stack, the gallery's posts and the yard.
  list.push({ x: -7.6, z: 0, w: 1.2, d: 3.5 });
  for (const x of [-2.85, -1.2, 1.2, 2.85]) list.push({ x, z: gallery.front - 0.1, r: 0.16 });
  const y = YARD;
  list.push({ x: y.signPost.x, z: y.signPost.z, r: 0.18 });
  for (const o of y.benches) list.push({ x: o.x, z: o.z, w: 1.75, d: 1.5 });
  list.push({ x: y.trough.x, z: y.trough.z, w: 0.75, d: 1.9 });
  list.push({ x: y.hitchingRail.x, z: y.hitchingRail.z, w: 0.2, d: 2.5 });
  for (const t of y.trees) list.push({ x: t.x, z: t.z, r: 0.5 });
  return list;
}

/**
 * Everything a walker in the loft or on the gallery bumps into.
 * @returns {Collider[]}
 */
export function loftColliders() {
  const w = PUB.well,
    l = LOFT,
    /** @type {Collider[]} */ list = UPPER_WALLS.flatMap(wallColliders);
  list.push(flightWall);
  // The stairwell's rail at the flight's foot.
  list.push({ x: (stair.minX + stair.maxX) / 2, z: stair.bottomZ + 0.04, w: stair.maxX - stair.minX, d: 0.08 });
  // The well's four rails.
  const thin = 0.1;
  list.push({ x: (w.minX + w.maxX) / 2, z: w.minZ, w: w.maxX - w.minX, d: thin });
  list.push({ x: (w.minX + w.maxX) / 2, z: w.maxZ, w: w.maxX - w.minX, d: thin });
  list.push({ x: w.minX, z: 0, w: thin, d: w.maxZ - w.minZ });
  list.push({ x: w.maxX, z: 0, w: thin, d: w.maxZ - w.minZ });
  for (const c of l.cots) list.push({ x: c.x, z: c.z, w: l.cot.length, d: l.cot.width });
  for (const b of l.beds) list.push({ x: b.x, z: b.z, w: l.bed.length, d: l.bed.width });
  list.push({ x: l.washstand.x, z: l.washstand.z, w: 0.9, d: 0.5 });
  list.push({ x: l.dryingRack.x, z: l.dryingRack.z, w: 0.5, d: 1.5 });
  for (const c of l.chests) list.push({ x: c.x, z: c.z, w: 0.85, d: 0.5 });
  // The gallery: its rail runs the whole gap between the wings.
  list.push({ x: 0, z: gallery.front, w: gallery.halfW * 2, d: 0.1 });
  list.push({ x: l.galleryTable.x, z: l.galleryTable.z, r: 0.55 });
  // Nothing past the rail: the rest of the upper storey's outside is air.
  list.push({ x: 0, z: gallery.front + 1, w: 40, d: 1.9 });
  list.push({ x: 0, z: -halfD - 1, w: 40, d: 2 });
  list.push({ x: -halfW - 1, z: 0, w: 2, d: 20 });
  list.push({ x: halfW + 1, z: 0, w: 2, d: 20 });
  return list;
}

/**
 * Whether an eye at (x, y, z) stands under the pub's roof.
 * @param {number} x
 * @param {number} y
 * @param {number} z
 */
export function insideTheHouse(x, y, z) {
  const inWing = Math.abs(x) > wing.inner && z < wing.jetty;
  return (
    Math.abs(x) < halfW + 0.02 &&
    y < PUB.ridge &&
    z > PUB.kitchen.minZ &&
    (z < halfD || inWing) &&
    // The kitchen's outline behind the rear wall.
    (z > -halfD || (x > PUB.kitchen.minX && x < PUB.kitchen.maxX && y < PUB.kitchen.wallY))
  );
}

/** The walk's outer limit and starting pose, in the street facing the front. */
export const WALK = {
  bounds: { minX: -PUB.yard.halfW, maxX: PUB.yard.halfW, minZ: -PUB.yard.halfW, maxZ: PUB.yard.front },
  spawn: { x: 0, z: 11.5, yaw: 0 },
};

/** The floor area of each storey, in square metres, for the study's notes. */
export function floorAreas() {
  const inW = inX * 2,
    range = inW * (frontIn - rearIn),
    wings = 2 * (wing.front - wall - frontIn) * (halfW - wing.inner - wall * 2 + wall);
  const w = PUB.well,
    well = (w.maxX - w.minX) * (w.maxZ - w.minZ),
    flight = (stair.maxX - stair.minX) * (stair.bottomZ - stair.topZ),
    upperWings =
      2 * (wing.jetty - upperWall - frontIn) * (halfW - wing.inner - upperWall * 2 + wall);
  return {
    ground: Math.round(range + wings),
    loft: Math.round(range + upperWings - well - flight),
    gallery: Math.round(gallery.halfW * 2 * (gallery.front - halfD)),
  };
}

/** How many sleepers the inn holds: a cot sleeps one, a four-poster two. */
export function sleeps() {
  return LOFT.cots.length + LOFT.beds.length * 2;
}
