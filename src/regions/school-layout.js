// @ts-check
// The village school's shape: the schoolroom and the schoolhouse beside it,
// the playground in front, the football pitch beyond, the railings round the
// lot with the gate in their north side, the path from the market's footpath
// to the gate, the swings, the hopscotch, and where Miss Juniper, the
// teacher, stands. Pure data and functions, loaded with the village: the
// colliders, grass and region label need it before the school's meshes stream
// in (src/regions/school.js builds those, src/regions/school-kids.js the
// children, and src/game/school.js plays their match).
//
// The school fills the map's south-east corner, south of the market lane and
// east of the willow marsh. It is flat, on the open country's own grass.
// North is -z; the buildings face south, onto the playground, so the
// overview's camera sees their fronts.
import { curve, lineDistance } from "./lines.js";

export const SCHOOL = {
  // The label: the corner south of the market lane, east of the marsh.
  area: { minX: 27, minZ: 17 },
  // The railings round the whole lot, with the gate in the north side where
  // the path comes in.
  fence: { minX: 27.4, maxX: 45.4, minZ: 17.4, maxZ: 38.2 },
  gate: { x: 30, halfWidth: 0.85 },
  // The schoolroom: one tall room under a steep roof, its long front facing
  // the playground, a bellcote on its west gable. `h` is the eaves' height.
  school: { x: 36.5, z: 21, w: 9, d: 4.8, h: 3.1, ridge: 5.6 },
  // The porch on the schoolroom's front, at its west end, and the door in it.
  porch: { x: 33.6, z: 23.95, w: 1.9, d: 1.1, h: 2.5 },
  // The schoolhouse, where the teacher lives: two storeys against the
  // schoolroom's east gable.
  house: { x: 42.9, z: 21.2, w: 3.8, d: 4.6, h: 4.6, ridge: 6.4 },
  // The playground: tarmac in front of both buildings.
  yard: { minX: 29.3, maxX: 44.8, minZ: 23.4, maxZ: 27.4 },
  // The pitch: grass mown in stripes, its lines painted white, a goal at each
  // end on the goal line. Goals are 3 m wide and 1.3 m high, children's size.
  pitch: { minX: 29.2, maxX: 44, minZ: 28.6, maxZ: 37 },
  goal: { width: 3, height: 1.3, depth: 0.9, post: 0.05 },
  // The swings at the playground's east end: an A-frame each end of the top
  // bar, which runs along x; the seats swing along z.
  swings: { x: 42.6, z: 25.6, span: 3.2, height: 2.2, seats: [-0.7, 0.7] },
  // Hopscotch chalked on the tarmac, along x from its first square, and a
  // clear patch for skipping.
  hopscotch: { x: 30.6, z: 25.4, square: 0.44 },
  skipping: { x: 37.4, z: 25.5 },
  // A bench and a bicycle rack in the corner west of the schoolroom, the
  // school's board outside the gate.
  bench: { x: 28.3, z: 20.6, turn: Math.PI / 2 },
  rack: { x: 28.1, z: 23.2 },
  board: { x: 31.6, z: 16.6 },
  // A lamp outside the gate, lit at blue hour.
  lamp: { x: 28.7, z: 16.85 },
  // The path from the market's footpath, through the gate and down the
  // schoolroom's west side to the playground.
  path: { halfWidth: 0.7 },
  residents: { juniper: { x: 36.6, z: 27.8 } },
};

const S = SCHOOL;

export const SCHOOL_PATH = curve([
  [30.9, 10.3],
  [30.5, 13.5],
  [30.1, 16.4],
  [30, 19.5],
  [30, 23.6],
]);

/** Distance from (x, z) to the path's centre line (Infinity when over `reach` away). */
export const pathDistance = (/** @type {number} */ x, /** @type {number} */ z, reach = Infinity) =>
  lineDistance(SCHOOL_PATH, x, z, reach);

/** The pitch's middle, and the x of each goal line: goal 0 at the west end. */
export const PITCH = {
  x: (S.pitch.minX + S.pitch.maxX) / 2,
  z: (S.pitch.minZ + S.pitch.maxZ) / 2,
  goals: [S.pitch.minX, S.pitch.maxX],
};

/**
 * The fence's runs, as [x1, z1, x2, z2], leaving the gate open.
 * @type {[number, number, number, number][]}
 */
export const FENCE_RUNS = (() => {
  const f = S.fence,
    g = S.gate;
  return [
    [f.minX, f.minZ, g.x - g.halfWidth, f.minZ],
    [g.x + g.halfWidth, f.minZ, f.maxX, f.minZ],
    [f.minX, f.maxZ, f.maxX, f.maxZ],
    [f.minX, f.minZ, f.minX, f.maxZ],
    [f.maxX, f.minZ, f.maxX, f.maxZ],
  ];
})();

/** Each swing frame's two feet, [x, z], at the bar's west and east ends. */
export function swingFeet() {
  const s = S.swings,
    out = [];
  for (const end of [-1, 1])
    for (const side of [-1, 1]) out.push([s.x + (end * s.span) / 2, s.z + side * 0.75]);
  return out;
}

/** The goal frames' posts, [x, z], two on each goal line and two at the back. */
export function goalPosts() {
  const { width, depth } = S.goal;
  return PITCH.goals.flatMap((x, i) => {
    const back = x + (i === 0 ? -depth : depth);
    return [-1, 1].flatMap((side) => [
      [x, PITCH.z + (side * width) / 2],
      [back, PITCH.z + (side * width) / 2],
    ]);
  });
}

const rect = (/** @type {{ x: number, z: number, w: number, d: number }} */ b) => ({
  x: b.x,
  z: b.z,
  w: b.w,
  d: b.d,
});

/**
 * Colliders for the buildings, the railings, the swings' feet, the goal
 * frames' posts, the bench, the rack, the board and the lamp, in the shapes collides()
 * (src/game/navigation.js) understands. The children and their ball move,
 * so they are not colliders; they keep clear of the walker themselves.
 */
export function schoolColliders() {
  return [
    rect(S.school),
    rect(S.porch),
    rect(S.house),
    ...FENCE_RUNS.map(([x1, z1, x2, z2]) => ({
      x: (x1 + x2) / 2,
      z: (z1 + z2) / 2,
      w: Math.max(0.12, Math.abs(x2 - x1)),
      d: Math.max(0.12, Math.abs(z2 - z1)),
    })),
    ...swingFeet().map(([x, z]) => ({ x, z, r: 0.1 })),
    ...goalPosts().map(([x, z]) => ({ x, z, r: 0.07 })),
    { x: S.bench.x, z: S.bench.z, w: 0.55, d: 1.5 },
    { x: S.rack.x, z: S.rack.z, w: 0.5, d: 1.3 },
    { x: S.board.x, z: S.board.z, r: 0.2 },
    { x: S.lamp.x, z: S.lamp.z, r: 0.18 },
  ];
}

const within = (/** @type {{ minX: number, maxX: number, minZ: number, maxZ: number }} */ b, /** @type {number} */ x, /** @type {number} */ z, margin = 0) =>
  x >= b.minX - margin && x <= b.maxX + margin && z >= b.minZ - margin && z <= b.maxZ + margin;

/** Whether (x, z) lies on the playground's tarmac or the mown pitch, `margin` out. */
export const onPlayground = (/** @type {number} */ x, /** @type {number} */ z, margin = 0) =>
  within(S.yard, x, z, margin) ||
  // The pitch's mown grass runs a metre past its lines.
  within(S.pitch, x, z, margin + 1);

// Everything of the school's lies inside this box: the lot and its path.
const extent = { minX: 27, maxX: 46, minZ: 9.5, maxZ: 38.8 };

let footings = /** @type {any[] | null} */ (null);

/** Where meadow grass may grow at the school: off the path, the playground, the pitch and every footing. */
export function schoolGrass(/** @type {number} */ x, /** @type {number} */ z) {
  if (x < extent.minX || x > extent.maxX || z < extent.minZ || z > extent.maxZ) return true;
  if (pathDistance(x, z, 2) < S.path.halfWidth + 0.08) return false;
  if (onPlayground(x, z, 0.08)) return false;
  for (const c of (footings ??= schoolColliders()))
    if (
      c.r !== undefined
        ? Math.hypot(x - c.x, z - c.z) < c.r + 0.2
        : Math.abs(x - c.x) < c.w / 2 + 0.2 && Math.abs(z - c.z) < c.d / 2 + 0.2
    )
      return false;
  return true;
}

/**
 * Where flowers may be planted at the school: nowhere inside the railings,
 * where the children run, nor on the path.
 */
export function schoolPlanting(/** @type {number} */ x, /** @type {number} */ z) {
  if (within(S.fence, x, z, 0.4)) return false;
  return pathDistance(x, z, 2) > S.path.halfWidth + 0.25;
}

/** The school's entry in the region registry (src/regions/index.js). */
export const schoolRegion = {
  id: "school",
  name: "The village school",
  area: S.area,
  colliders: schoolColliders,
  grass: schoolGrass,
  planting: schoolPlanting,
  // Its builder also brings Miss Juniper, and the children and their match.
  stream: (/** @type {any} */ T, /** @type {any} */ world, /** @type {any} */ game) =>
    import("./school.js").then(({ schoolJobs }) => schoolJobs(T, world, game)),
};
