// @ts-check
// The stone quarry's shape: the ridge in the map's south-west corner, the two
// lifts cut into its east and south sides, the cart track in from the
// allotments, the footpath down from the old wood, and where the derrick
// crane, the mason's lean-to, the block stacks, the spoil heap, the cart, the
// gorse and Agnes, the mason, stand. Pure data and functions, loaded with the
// village: the terrain, colliders, grass and region label need it before the
// quarry's meshes stream in (src/regions/quarry.js builds those).
//
// The ridge is an L: one arm along the map's west rim, one along the old
// wood's south edge, highest where they meet. The quarry has eaten its inner
// corner. Two lifts step down from the ridge's grassy top to the floor, each
// a straight, sheer face of bedded stone, so the faces look south and east,
// toward the overview's camera and the afternoon sun. The floor is level with
// the lawn and runs out into the fields to the south and east, where the
// ridge was never high enough to cut. North is -z.
import { curve, lineDistance } from "./lines.js";

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export const QUARRY = {
  // The lawn's top around the quarry.
  lawn: 0.05,
  // Ground the quarry's own mesh covers; the open country's grass is cut away
  // over it. Strips of the fields' grass keep it apart from the old wood's
  // ground to the north and the allotments to the east. The ground mesh's
  // vertices lie on a 0.4 m grid from its north-west corner, and every face
  // below runs along a grid line, so the faces are sheer.
  ground: { minX: -47.4, maxX: -23.8, minZ: 21.2, maxZ: 41.6 },
  step: 0.4,
  // The label: everything south of the old wood and west of the allotments.
  area: { maxX: -24, minZ: 21 },
  // The ridge: its height above the lawn, where its west arm rises from the
  // rim and its north arm from the wood's edge, and where its arms taper
  // away to the east and the south. Between them its top is level, give or
  // take a gentle swell.
  ridge: {
    height: 3.3,
    rise: { west: [-47.4, -42.2], north: [21.2, 26.6] },
    taper: { east: [-38.6, -26], south: [31, 41.6] },
  },
  // The two lifts. The upper face runs along x = upper.x (facing east) and
  // z = upper.z (facing south) and stands from the bench to the ridge's top;
  // the lower face, two metres in, stands from the floor to the bench.
  upper: { x: -40.6, z: 27.6 },
  lower: { x: -38.6, z: 29.6 },
  bench: 1.7,
  // A face lower than this is a step a walker takes in their stride.
  stride: 0.3,
  // Walkers keep this far from a face's line, on either side (beyond their
  // own radius), clear of the brow's fence and the blocks at the foot.
  faceClearance: 0.18,
  // The derrick crane on the floor by the lifts' inner corner: its mast,
  // and the bearing its jib points along (radians about y, 0 along +x),
  // reaching over the bench; and the stakes its guy ropes run to, two on
  // the ridge's top and one on the floor.
  derrick: {
    x: -36.2,
    z: 31.8,
    mast: 5.4,
    jib: 5,
    turn: 2.42,
    guys: [
      [-42.2, 31.4],
      [-36.4, 25.0],
      [-36.9, 37.3],
    ],
  },
  // The mason's lean-to, backed against the lower face, its open front to
  // the south; the banker (the mason's bench) out in front of it.
  shed: { x: -33.4, z: 30.6, w: 2.8, d: 1.5, h: 2.3 },
  banker: { x: -33.5, z: 32.35, w: 1.1, d: 0.7, h: 0.86 },
  // Dressed blocks stacked on timber bearers, ready to go: centre, size of
  // one block, blocks along and across, courses, and turn.
  stacks: [
    { x: -36.5, z: 35.4, w: 0.9, d: 0.6, h: 0.5, along: 2, across: 2, courses: 2, turn: 0.08 },
    { x: -34.4, z: 37.0, w: 1.1, d: 0.7, h: 0.55, along: 2, across: 1, courses: 3, turn: -0.12 },
    { x: -30.6, z: 30.75, w: 0.8, d: 0.8, h: 0.45, along: 1, across: 2, courses: 1, turn: 0.05 },
  ],
  // A big block split open on the floor, where the devil's toenails are.
  split: { x: -33.2, z: 35.3, turn: 0.5 },
  // The spoil heap of broken stone, south-east on the floor.
  heap: { x: -30.2, z: 36.9, r: 2.2, h: 1.05 },
  // The stone cart, parked off the track with a load of blocks.
  cart: { x: -27.6, z: 34.0, turn: 0.42, length: 2.3, width: 1.25 },
  // The quarry's board where the track comes in, on its north side,
  // facing it.
  sign: { x: -27.4, z: 28.5 },
  // Ladders: one up the lower face, one up the upper.
  ladders: [
    { face: "lower-west", at: 31.6 },
    { face: "upper-north", at: -37.2 },
  ],
  // Where each fossil turns up, by id: on the floor, on the bench, or on
  // the ridge's top. `y` is the ground there, so a spot on the bench
  // answers only to someone standing on the bench.
  finds: {
    ammonite: { x: -31.7, z: 35.0, where: "floor" },
    belemnite: { x: -37.9, z: 33.6, where: "floor" },
    crinoid: { x: -35.4, z: 28.6, where: "bench" },
    gryphaea: { x: -33.2, z: 34.4, where: "floor" },
    urchin: { x: -39.6, z: 33.8, where: "bench" },
    brachiopod: { x: -37.8, z: 25.3, where: "top" },
  },
  // Agnes, the mason, at her banker.
  residents: { agnes: { x: -32.4, z: 32.55 } },
  trackHalfWidth: 0.85,
  footpathHalfWidth: 0.45,
};

const Q = QUARRY;

// The cart track, from the allotments' west gate into the quarry floor,
// and the footpath down from the old wood's south trail to meet it.
export const TRACK = curve([
  [-23.6, 28.6],
  [-25.6, 29.1],
  [-27.8, 30.6],
  [-30.4, 32.3],
  [-32.8, 33.6],
  [-35.0, 33.9],
]);
export const FOOTPATH = curve([
  [-25.6, 18.6],
  [-25.3, 21.4],
  [-25.0, 24.6],
  [-25.3, 27.4],
  [-25.9, 29.2],
]);

/** Whether (x, z) lies within the quarry's ground mesh. */
export const inQuarryGround = (x, z) =>
  x >= Q.ground.minX && x <= Q.ground.maxX && z >= Q.ground.minZ && z <= Q.ground.maxZ;

/** Height of the ridge above the lawn at (x, z), before the quarry cut it. */
export function ridgeHeight(x, z) {
  if (!inQuarryGround(x, z)) return 0;
  const { height, rise, taper } = Q.ridge,
    across =
      smooth(rise.west[0], rise.west[1], x) * (1 - smooth(taper.east[0], taper.east[1], x)),
    along =
      smooth(rise.north[0], rise.north[1], z) * (1 - smooth(taper.south[0], taper.south[1], z)),
    swell = 1 + 0.05 * Math.sin(x * 0.7 + z * 0.3) + 0.04 * Math.sin(z * 0.9 - x * 0.4 + 1);
  return height * across * along * swell;
}

// What the quarry left at each place: the ridge's top, the bench, or the floor.
export const TOP = 0,
  BENCH = 1,
  FLOOR = 2;
const LEVELS = [Infinity, Q.bench, 0];

/** Which lift (x, z) lies on: TOP (uncut), BENCH or FLOOR. */
export function liftAt(x, z) {
  if (x < Q.upper.x || z < Q.upper.z) return TOP;
  if (x < Q.lower.x || z < Q.lower.z) return BENCH;
  return FLOOR;
}

/** The ground at (x, z) on lift `lift`: the ridge, cut down to the lift's level. */
export const liftHeight = (lift, x, z) => Math.min(ridgeHeight(x, z), LEVELS[lift]);

/** Height of the ground above the lawn at (x, z): the ridge, cut down to its lift. */
export const quarryHeight = (x, z) => liftHeight(liftAt(x, z), x, z);

/** Height of the bare ground in the quarry: the lawn level plus the ground's. */
export const quarryGround = (x, z) => Q.lawn + quarryHeight(x, z);

/** How much stone was taken away at (x, z): the ridge less what is left of it. */
export const cutDepth = (x, z) => ridgeHeight(x, z) - quarryHeight(x, z);

/**
 * The faces, each a line along the grid where one lift drops to the next,
 * sampled every grid step: `axis` is the coordinate the face holds fixed at
 * `at`, `s` runs along it, and each station gives the ground above (`hi`)
 * and below (`lo`). `normal` points out of the face, toward the lower lift.
 */
export const FACES = (() => {
  const g = Q.ground,
    faces = [
      { id: "upper-west", axis: "x", at: Q.upper.x, from: Q.upper.z, to: g.maxZ, above: TOP, below: BENCH },
      { id: "upper-north", axis: "z", at: Q.upper.z, from: Q.upper.x, to: g.maxX, above: TOP, below: BENCH },
      { id: "lower-west", axis: "x", at: Q.lower.x, from: Q.lower.z, to: g.maxZ, above: BENCH, below: FLOOR },
      { id: "lower-north", axis: "z", at: Q.lower.z, from: Q.lower.x, to: g.maxX, above: BENCH, below: FLOOR },
    ];
  return faces.map((f) => {
    const count = Math.round((f.to - f.from) / Q.step),
      stations = [];
    for (let i = 0; i <= count; i++) {
      const s = f.from + i * Q.step,
        [x, z] = f.axis === "x" ? [f.at, s] : [s, f.at];
      stations.push({ s, hi: liftHeight(f.above, x, z), lo: liftHeight(f.below, x, z) });
    }
    // Stretches too tall to step up: [from, to] along the face.
    const runs = [];
    for (let i = 0; i < count; i++) {
      const tall = Math.max(stations[i].hi - stations[i].lo, stations[i + 1].hi - stations[i + 1].lo) > Q.stride;
      if (!tall) continue;
      if (runs.length && runs.at(-1)[1] === stations[i].s) runs.at(-1)[1] = stations[i + 1].s;
      else runs.push([stations[i].s, stations[i + 1].s]);
    }
    return { ...f, normal: f.axis === "x" ? [1, 0] : [0, 1], stations, runs };
  });
})();

/** The face with this id. */
export const faceById = (id) => FACES.find((face) => face.id === id);

/** Distance from (x, z) to the nearest stretch of face too tall to step. */
export function faceDistance(x, z) {
  let best = Infinity;
  for (const face of FACES) {
    const [u, v] = face.axis === "x" ? [z, x] : [x, z];
    for (const [from, to] of face.runs)
      best = Math.min(best, Math.hypot(Math.max(from - u, 0, u - to), v - face.at));
  }
  return best;
}

/** Distance from (x, z) to the track's or the footpath's centre line, less its half width. */
export function wayDistance(x, z, reach = 2) {
  return Math.min(
    lineDistance(TRACK, x, z, reach) - Q.trackHalfWidth,
    lineDistance(FOOTPATH, x, z, reach) - Q.footpathHalfWidth,
  );
}

// A small random stream of the layout's own, so the gorse stands where it
// stands whatever else changes (mulberry32).
function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The cart's corners turned, for its footprint.
const cartAxes = () => {
  const c = Q.cart;
  return { ex: Math.cos(c.turn), ez: -Math.sin(c.turn) };
};

// Small footings that stand on their own: [x, z, r].
const FOOTINGS = (() => {
  const d = Q.derrick,
    c = Q.cart,
    { ex, ez } = cartAxes();
  return [
    [d.x, d.z, 0.42],
    // The winch beside the mast.
    [d.x + 0.75, d.z + 0.55, 0.38],
    [Q.heap.x, Q.heap.z, Q.heap.r - 0.4],
    // The cart, as three discs along its length.
    ...[-1, 0, 1].map((k) => [c.x + ex * k * c.length * 0.32, c.z + ez * k * c.length * 0.32, c.width * 0.55]),
    [Q.sign.x, Q.sign.z, 0.2],
    [Q.split.x, Q.split.z, 0.55],
    ...d.guys.map(([x, z]) => [x, z, 0.22]),
  ];
})();

// Gorse on the ridge: darts thrown over its uncut top and flanks, kept off
// the brow, the paths, the fossil scrape and each other. [x, z, size].
export const GORSE = (() => {
  const rand = random(0x9025e),
    range = (a, b) => a + (b - a) * rand(),
    g = Q.ground,
    out = [];
  for (let i = 0; i < 900 && out.length < 22; i++) {
    const x = range(g.minX + 1, g.maxX - 1),
      z = range(g.minZ + 1, g.maxZ - 1),
      size = range(0.7, 1.15);
    if (liftAt(x, z) !== TOP || ridgeHeight(x, z) < 0.5) continue;
    if (faceDistance(x, z) < 1.1 || wayDistance(x, z) < 0.8) continue;
    if (Object.values(Q.finds).some((f) => Math.hypot(x - f.x, z - f.z) < 1.8)) continue;
    if (out.some(([ox, oz]) => Math.hypot(x - ox, z - oz) < 1.9)) continue;
    out.push([x, z, size]);
  }
  return out;
})();

// Boxes: the lean-to, the banker and each stack, as { x, z, w, d }.
const BOXES = (() => {
  const boxes = [Q.shed, Q.banker].map(({ x, z, w, d }) => ({ x, z, w, d }));
  for (const s of Q.stacks) {
    const w = s.w * s.along + 0.1,
      d = s.d * s.across + 0.1,
      c = Math.abs(Math.cos(s.turn)),
      n = Math.abs(Math.sin(s.turn));
    boxes.push({ x: s.x, z: s.z, w: w * c + d * n, d: w * n + d * c });
  }
  return boxes;
})();

/**
 * Colliders for the faces, the derrick, the lean-to, the banker, the stacks,
 * the heap, the cart, the board and the gorse, in the shapes collides()
 * (src/game/navigation.js) understands. The faces are one shape: walkers
 * keep clear of every stretch too tall to step, from above or below.
 */
export function quarryColliders() {
  const pad = Q.faceClearance,
    g = Q.ground;
  return [
    {
      minX: g.minX,
      maxX: g.maxX,
      minZ: g.minZ,
      maxZ: g.maxZ,
      blocks: (x, z, r) => faceDistance(x, z) < r + pad,
    },
    ...BOXES,
    ...FOOTINGS.map(([x, z, r]) => ({ x, z, r })),
    ...GORSE.map(([x, z, s]) => ({ x, z, r: 0.42 * s })),
  ];
}

/** Whether (x, z) lies under a footing, `margin` out. */
function onFooting(x, z, margin) {
  if (BOXES.some((b) => Math.abs(x - b.x) < b.w / 2 + margin && Math.abs(z - b.z) < b.d / 2 + margin))
    return true;
  if (FOOTINGS.some(([fx, fz, r]) => Math.hypot(x - fx, z - fz) < r + margin)) return true;
  return GORSE.some(([gx, gz, s]) => Math.hypot(x - gx, z - gz) < 0.6 * s + margin);
}

// The footpath leaves the quarry's ground for the strip between it and the
// wood; grass and planting rules apply within this box.
const near = (x, z) => x > Q.ground.minX && x < Q.ground.maxX + 0.5 && z > 18 && z < Q.ground.maxZ;

/** How bare the ground is at (x, z): 1 where stone was cut away, 0 on the untouched ridge and lawn. */
export const bareness = (x, z) => smooth(0.12, 0.6, cutDepth(x, z));

// A fixed hash of a point, in [0, 1): where grass thins at the floor's edge.
const hash = (x, z) => {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * Where meadow grass may grow at the quarry: on the ridge's untouched top
 * and flanks and the lawn around the floor, thinning onto the floor's edge;
 * never on the cut stone, near a face, on the paths or under a footing.
 */
export function quarryGrass(x, z) {
  if (!near(x, z)) return true;
  if (wayDistance(x, z) < 0.1) return false;
  if (onFooting(x, z, 0.12)) return false;
  if (!inQuarryGround(x, z)) return true;
  if (faceDistance(x, z) < 0.5) return false;
  return hash(x, z) > bareness(x, z);
}

/** Where flowers may be planted at the quarry: off the cut stone, paths and footings, with room to spare. */
export function quarryPlanting(x, z) {
  if (!near(x, z)) return true;
  if (wayDistance(x, z) < 0.3) return false;
  if (onFooting(x, z, 0.35)) return false;
  if (!inQuarryGround(x, z)) return true;
  return faceDistance(x, z) > 0.9 && bareness(x, z) < 0.05;
}

/** The ground where a fossil turns up, for the bench's and the top's. */
export const findHeight = (id) => quarryGround(Q.finds[id].x, Q.finds[id].z);

/** The stone quarry's entry in the region registry (src/regions/index.js). */
export const quarryRegion = {
  id: "quarry",
  name: "The stone quarry",
  area: Q.area,
  ground: Q.ground,
  height: quarryHeight,
  // Its faces are sheer: terrainHeight evaluates the ground exactly, so
  // walkers on the bench and the floor beneath it each stand on their own.
  exactHeight: true,
  colliders: quarryColliders,
  grass: quarryGrass,
  planting: quarryPlanting,
  // Its builder also brings Agnes, the mason.
  stream: (T, world, game) =>
    import("./quarry.js").then(({ quarryJobs }) => quarryJobs(T, world, game)),
};
