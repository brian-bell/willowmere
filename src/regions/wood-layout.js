// The old wood's shape: the strip of woodland west of the wildflower meadow,
// its low rolling floor, the trails through it, the mossy clearing with its
// fairy ring, the great oak, the hollow log, Rowan's stump table and where
// each tree and woodland flower stands. Pure data and functions, loaded with
// the village: the terrain, colliders, grass and region label need it before
// the wood's meshes stream in (src/regions/wood.js builds those).
//
// The wood fills the map west of the village, between the orchard hill to the
// north and the open south-west corner. Its ground rolls gently, never more
// than about a metre, and settles to the lawn at every edge. North is -z.
import { curve, lineDistance } from "./lines.js";

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export const WOOD = {
  // The lawn's top around the wood.
  lawn: 0.05,
  // Ground the wood's own mesh covers; the open country's grass is cut away
  // over it. Its east edge meets the village's grass; a strip of the fields'
  // grass keeps it apart from the orchard hill's ground to the north.
  ground: { minX: -47.4, maxX: -23.8, minZ: -20.4, maxZ: 20.8 },
  // The label: everything west of the village, between the orchard hill and
  // the fields to the south-west.
  area: { maxX: -24, minZ: -21, maxZ: 21 },
  // The mossy clearing in the wood's heart, and the fairy ring of mushrooms
  // in it. The clearing's floor is level.
  clearing: { x: -35, z: 0.6, r: 4.8 },
  ring: { x: -35.7, z: 1.5, r: 1.45, count: 14 },
  // The great oak north of the clearing, the wood's oldest tree.
  oak: { x: -39.6, z: -7, scale: 1.5 },
  // The hollow log lies beside the north trail: its middle, length, radius
  // and the way it points (radians about y, 0 along +x).
  log: { x: -30.6, z: -9.2, length: 3.4, radius: 0.42, turn: 0.55 },
  // Rowan's stump table by the clearing's east edge, with her basket and
  // flower press on it; Rowan stands beside it.
  table: { x: -30.4, z: 5.6, r: 0.5 },
  residents: { rowan: { x: -31.5, z: 4.5 } },
  // A fingerpost where the trail leaves the meadow.
  signpost: { x: -25.3, z: 6.4 },
  // Where each woodland flower grows: one patch of each, by id.
  flowers: {
    primrose: { x: -27, z: 7.4 },
    campion: { x: -28.4, z: 15.8 },
    bluebell: { x: -37.6, z: 12.8 },
    honeysuckle: { x: -40.6, z: 2.4 },
    foxglove: { x: -31.6, z: -15.6 },
    sorrel: { x: -29, z: -7.9 },
    anemone: { x: -37.6, z: -9 },
  },
  // Old stumps and fallen branches about the wood: [x, z, size].
  stumps: [
    [-40.6, 2.4, 1],
    [-27.8, -4.2, 0.8],
    [-43.2, -14.6, 0.9],
    [-41.8, 16.2, 0.85],
    [-33.4, 18.4, 0.75],
  ],
  trailHalfWidth: 0.55,
};

const W = WOOD;

// Earth trails: in from the meadow to the clearing; a loop north past the
// great oak, the hollow log and the foxgloves, back to the way in; and south
// from the clearing to the bluebell dell and out to the wood's south-east
// edge.
export const TRAILS = [
  curve([
    [-23.8, 5.2],
    [-26.2, 4.7],
    [-28.6, 3.5],
    [-31, 2.3],
    [-32.8, 1.3],
  ]),
  curve([
    [-35.4, -3.4],
    [-36.4, -6.2],
    [-35.4, -10.4],
    [-32.4, -12.8],
    [-28.6, -12.4],
    [-26.6, -9.6],
    [-26.4, -5.6],
    [-26.8, -1.2],
    [-27.4, 3.9],
  ]),
  curve([
    [-36, 4.9],
    [-36.8, 8.6],
    [-35.4, 12.2],
    [-32.4, 14.6],
    [-29, 16.6],
    [-25.6, 18.6],
  ]),
];

/** Whether (x, z) lies within the wood's ground mesh. */
export const inWoodGround = (x, z) =>
  x >= W.ground.minX && x <= W.ground.maxX && z >= W.ground.minZ && z <= W.ground.maxZ;

/** Distance from (x, z) to the nearest trail's centre line (Infinity when over `reach` away). */
export function trailDistance(x, z, reach = Infinity) {
  let best = Infinity;
  for (const trail of TRAILS) best = Math.min(best, lineDistance(trail, x, z, reach));
  return best;
}

// The floor's undulation before the clearing levels it: two crossing swells
// and a low knoll west of the clearing, about a metre at its top.
function rolling(x, z) {
  return (
    0.34 +
    0.22 * Math.sin(x * 0.31 + 0.8) * Math.sin(z * 0.27 - 0.4) +
    0.12 * Math.sin(x * 0.63 - z * 0.41 + 1.7) +
    0.62 * Math.exp(-((x + 42) ** 2 + (z + 3) ** 2) / 30) +
    0.3 * Math.exp(-((x + 33) ** 2 + (z - 15) ** 2) / 18)
  );
}
const CLEARING_LEVEL = rolling(W.clearing.x, W.clearing.z);

/**
 * Height of the wood's floor above the lawn at (x, z): 0 at the ground mesh's
 * edges, rising over a few metres (more gently toward the village), level
 * across the clearing.
 */
export function woodHeight(x, z) {
  if (!inWoodGround(x, z)) return 0;
  const g = W.ground,
    fade =
      smooth(0, 4, x - g.minX) *
      // Toward the village the floor settles over 7 m, flat by its edge.
      smooth(0, 7, g.maxX - 0.2 - x) *
      smooth(0, 4, z - g.minZ) *
      smooth(0, 4, g.maxZ - z),
    c = W.clearing,
    level = 1 - smooth(c.r - 1, c.r + 2.5, Math.hypot(x - c.x, z - c.z)),
    floor = rolling(x, z) + (CLEARING_LEVEL - rolling(x, z)) * level;
  return Math.max(0, floor * fade);
}

// A slow wander in [-1, 1] that keeps the floor's border with the fields from
// following the ground mesh's straight sides.
const wander = (x, z) =>
  0.5 * Math.sin(x * 0.43 + z * 0.19 + 0.9) +
  0.3 * Math.sin(x * 0.21 - z * 0.47 + 2.3) +
  0.2 * Math.sin(x * 0.97 + z * 0.83 - 1.1);

/**
 * How much of the wood's own floor shows at (x, z), its moss and litter
 * rather than the fields' lawn: 0 at the ground mesh's edges, 1 within the
 * wood. The border wanders between about 0.3 and 2.3 m in from each side,
 * then the floor fades in over 4.6 m toward the meadow and 3.5 m to the north
 * and south. To the west it runs on to the map's rim. The floor's colours and
 * the grass's thinning share it.
 */
export function woodFloor(x, z) {
  if (!inWoodGround(x, z)) return 0;
  const g = W.ground,
    inset = 1.3 + wander(x, z);
  return (
    smooth(inset, inset + 4.6, g.maxX - x) *
    smooth(inset, inset + 3.5, z - g.minZ) *
    smooth(inset, inset + 3.5, g.maxZ - z)
  );
}

/** Height of the bare ground in the wood: the lawn level plus the floor's. */
export const woodGround = (x, z) => W.lawn + woodHeight(x, z);

// A small random stream of the layout's own, so the trees stand where they
// stand whatever else changes (mulberry32).
function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Distance from (x, z) to the hollow log's axis. */
export function logDistance(x, z) {
  const { x: lx, z: lz, length, turn } = W.log,
    ex = Math.cos(turn),
    ez = Math.sin(turn),
    t = Math.max(-length / 2, Math.min(length / 2, (x - lx) * ex + (z - lz) * ez));
  return Math.hypot(x - lx - ex * t, z - lz - ez * t);
}

// Trees: darts thrown over the floor, each kept only if it stands far enough
// from the trees already placed, off the trails, out of the clearing, clear
// of the flower patches and footings and of the great oak. Toward the meadow
// they thin out, so the wood has an edge; to the west they run on to the
// map's rim. Beeches (amber) and oaks (green) mix, the beeches more to the
// west. Young trees then fill the gaps between them, below their crowns.
function place(trees, rand, { count, tries, spacing, scale, young }) {
  const range = (a, b) => a + (b - a) * rand(),
    flowers = Object.values(W.flowers),
    c = W.clearing,
    g = W.ground;
  for (let i = 0; i < tries && count > 0; i++) {
    const x = range(g.minX + 0.6, g.maxX - 1.2),
      z = range(g.minZ + 1, g.maxZ - 1.1),
      s = range(...scale),
      amber = rand() < 0.22 + 0.32 * smooth(-28, -42, x),
      keep = rand(),
      clear = young ? 0.9 : 1.35;
    // Thinning toward the meadow.
    if (x > g.maxX - 6 && keep > smooth(g.maxX - 1, g.maxX - 6, x) * 0.8) continue;
    if (trailDistance(x, z) < clear) continue;
    if (Math.hypot(x - c.x, z - c.z) < c.r + 0.6) continue;
    if (Math.hypot(x - W.oak.x, z - W.oak.z) < (young ? 3.4 : 4.6)) continue;
    if (flowers.some((f) => Math.hypot(x - f.x, z - f.z) < 1.6)) continue;
    if (Math.hypot(x - W.table.x, z - W.table.z) < 2.6) continue;
    if (Math.hypot(x - W.residents.rowan.x, z - W.residents.rowan.z) < 2) continue;
    if (Math.hypot(x - W.signpost.x, z - W.signpost.z) < 1.6) continue;
    if (logDistance(x, z) < 2) continue;
    if (W.stumps.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < 1.6)) continue;
    if (trees.some((t) => Math.hypot(x - t.x, z - t.z) < (t.young || young ? spacing * 0.75 : spacing)))
      continue;
    trees.push({ id: `tree-${trees.length + 1}`, kind: amber ? "beech" : "oak", x, z, scale: s, young });
    count--;
  }
}
export const TREES = (() => {
  const rand = random(0x01d00d),
    trees = [];
  place(trees, rand, { count: 48, tries: 6000, spacing: 3.1, scale: [0.88, 1.18], young: false });
  place(trees, rand, { count: 16, tries: 4000, spacing: 2.2, scale: [0.5, 0.68], young: true });
  return trees;
})();

/**
 * Colliders for the wood's trees, the great oak, the hollow log, the stumps,
 * Rowan's table and the signpost, in the shapes collides()
 * (src/game/navigation.js) understands.
 */
export function woodColliders() {
  const l = W.log,
    ex = Math.cos(l.turn),
    ez = Math.sin(l.turn);
  return [
    ...TREES.map((t) => ({ x: t.x, z: t.z, r: 0.3 * t.scale })),
    { x: W.oak.x, z: W.oak.z, r: 0.62 * W.oak.scale },
    // The log, as three discs along its length.
    ...[-1, 0, 1].map((k) => ({
      x: l.x + ex * k * l.length * 0.36,
      z: l.z + ez * k * l.length * 0.36,
      r: l.radius + 0.12,
    })),
    ...W.stumps.map(([x, z, s]) => ({ x, z, r: 0.34 * s })),
    { x: W.table.x, z: W.table.z, r: W.table.r },
    { x: W.signpost.x, z: W.signpost.z, r: 0.14 },
  ];
}

// Every footing, for the grass mask; colliders never move.
let footings = null;

// A fixed hash of a point, in [0, 1): where grass thins under the canopy.
const hash = (x, z) => {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * Where meadow grass may grow in the wood: off its trails and footings, and
 * only along its borders with the fields.
 */
export function woodGrass(x, z) {
  if (!inWoodGround(x, z)) return true;
  if (trailDistance(x, z, 1.5) < W.trailHalfWidth + 0.1) return false;
  for (const c of (footings ??= woodColliders()))
    if (Math.hypot(x - c.x, z - c.z) < c.r + 0.15) return false;
  // Scattered blades read as spikes, so the grass gives out over the band
  // where the floor fades in instead: the wood's floor is moss and leaves.
  return hash(x, z) < 1 - smooth(0.05, 0.9, woodFloor(x, z));
}

/** Where flowers may be planted in the wood: off the trails, footings and flower patches. */
export function woodPlanting(x, z) {
  if (!inWoodGround(x, z)) return true;
  if (trailDistance(x, z, 1.5) < W.trailHalfWidth + 0.2) return false;
  for (const c of (footings ??= woodColliders()))
    if (Math.hypot(x - c.x, z - c.z) < c.r + 0.3) return false;
  return !Object.values(W.flowers).some((f) => Math.hypot(x - f.x, z - f.z) < 1.2);
}

/** How far into a trail's worn middle (x, z) lies: 1 on it, 0 off it. */
export function trailWeight(x, z) {
  return 1 - smooth(W.trailHalfWidth - 0.2, W.trailHalfWidth + 0.25, trailDistance(x, z, 1));
}

/** The old wood's entry in the region registry (src/regions/index.js). */
export const woodRegion = {
  id: "wood",
  name: "The old wood",
  area: W.area,
  ground: W.ground,
  height: woodHeight,
  // Its swells are smooth: terrainHeight evaluates them exactly, so the
  // trees, walkers and its ground mesh agree.
  exactHeight: true,
  colliders: woodColliders,
  grass: woodGrass,
  planting: woodPlanting,
  // Its builder also brings the wood's resident.
  stream: (T, world, game) => import("./wood.js").then(({ woodJobs }) => woodJobs(T, world, game)),
};
