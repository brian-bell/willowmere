import {
  MILLPOND,
  inMillpondGround,
  millpondGround,
} from "./regions/millpond-layout.js";

// One description of the map's extent, its chunk grid, its named regions and
// its ground height. Movement, routing, the overview camera, shadows, scatter
// and planting read their limits from here instead of keeping their own copies.

const box = (minX, maxX, minZ, maxZ) => ({ minX, maxX, minZ, maxZ });
export const inset = (b, x, z = x) =>
  box(b.minX + x, b.maxX - x, b.minZ + z, b.maxZ - z);

// The village: the original 48 × 42 m island, now the middle of the map. Its
// layout and scatter keep these limits so it stays exactly as it was.
const village = box(-24, 24, -21, 21);
// The ground slab and its soil rim, 4x the village's area. Everything the
// world builds sits inside it.
const ground = box(-48, 48, -42, 42);
// The player's centre stays inside this box.
const walk = inset(ground, 3, 4);

export const WORLD = {
  village,
  ground,
  walk,
  // Flowers can be planted a step beyond the walk box's edge.
  plantable: inset(walk, -1),
  // Light-space bounds of every receiver: the ground plus a margin for
  // anything that overhangs the rim.
  shadow: inset(ground, -0.6, 0),
  // Shadow map sizes are fractions of this box's light-space extent: the
  // village's old receivers, so texel density never depends on the map's size.
  shadowReference: inset(village, -0.6, 0),
  // The overview camera's target stays this far inside the walk box. The
  // camera looks from +x, +z, so the near (east and south) margins are smaller.
  camera: { minX: walk.minX + 9, maxX: walk.maxX - 7, minZ: walk.minZ + 8, maxZ: walk.maxZ - 6 },
  // Static scenery is baked and culled per chunk. The village is the 3 × 3
  // chunks from (-1, -1) to (1, 1); the map's 7 × 7 chunks run from (-3, -3)
  // to (3, 3), the outermost ring half as wide and deep as the rest.
  chunk: { width: 16, depth: 14, originX: -8, originZ: -7 },
  // The tallest canopy above the ground beneath it.
  canopy: 9.5,
};

/** Integer chunk coordinates of a point. */
export function chunkCoords(x, z) {
  const { width, depth, originX, originZ } = WORLD.chunk;
  return [Math.floor((x - originX) / width), Math.floor((z - originZ) / depth)];
}

export function chunkKey(x, z) {
  const [cx, cz] = chunkCoords(x, z);
  return `${cx},${cz}`;
}

/** Footprint of chunk (cx, cz) on the ground plane. */
export function chunkBounds(cx, cz) {
  const { width, depth, originX, originZ } = WORLD.chunk;
  const minX = originX + cx * width,
    minZ = originZ + cz * depth;
  return box(minX, minX + width, minZ, minZ + depth);
}

/**
 * A random stream that depends only on a chunk's coordinates, so chunks can be
 * built in any order and adding one never moves another. The village keeps the
 * single legacy stream in world.js; new chunks use these.
 */
export function chunkRandom(cx, cz, salt = 0) {
  let seed =
    (Math.imul(cx | 0, 73856093) ^
      Math.imul(cz | 0, 19349663) ^
      Math.imul(salt | 0, 83492791) ^
      0x5bd1e995) >>>
    0;
  // Mulberry32: unlike a plain LCG, successive draws taken as (x, z) pairs
  // scatter evenly instead of lining up in visible rows.
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Whether (x, z) lies within the original village island. */
export const inVillage = (x, z) =>
  x >= village.minX && x <= village.maxX && z >= village.minZ && z <= village.maxZ;

// Named areas for the location label, first match wins. Bounds are open
// (strict comparisons) and a missing side is unbounded. The village's areas
// keep to the village, reaching a hair past its edge so the edge itself still
// belongs to them; everything beyond is open country until its regions arrive.
const villageArea = inset(village, -1e-6),
  withinVillage = (r) => ({
    ...r,
    minX: Math.max(villageArea.minX, r.minX ?? -Infinity),
    maxX: Math.min(villageArea.maxX, r.maxX ?? Infinity),
    minZ: Math.max(villageArea.minZ, r.minZ ?? -Infinity),
    maxZ: Math.min(villageArea.maxZ, r.maxZ ?? Infinity),
  });
export const REGIONS = [
  { id: "brook", name: "The willow brook", minX: 10 },
  { id: "lane", name: "The cottage lane", maxZ: -5 },
  { id: "meadow", name: "The wildflower meadow", maxX: -8 },
  { id: "gardens", name: "The kitchen gardens", minZ: 7 },
  { id: "green", name: "The village green" },
]
  .map(withinVillage)
  .concat(
    // The pond, its banks and the brook up to it, north of the village.
    { id: "millpond", name: "The millpond", minX: 0, maxX: 26, maxZ: -21 },
    { id: "fields", name: "The open fields" },
  );

export function regionAt(x, z) {
  return REGIONS.find(
    (r) =>
      !(x <= r.minX || x >= r.maxX || z <= r.minZ || z >= r.maxZ),
  );
}

// Terrain heights, one sample per metre over the ground slab. The village
// stays flat; new regions bring their own heights: the millpond's banks and
// bed so far.
const TERRAIN_STEP = 1,
  terrainCols = Math.round((ground.maxX - ground.minX) / TERRAIN_STEP) + 1,
  terrainRows = Math.round((ground.maxZ - ground.minZ) / TERRAIN_STEP) + 1,
  terrain = new Float32Array(terrainCols * terrainRows);
let terrainMax = 0;
for (let row = 0; row < terrainRows; row++)
  for (let col = 0; col < terrainCols; col++) {
    const x = ground.minX + col * TERRAIN_STEP,
      z = ground.minZ + row * TERRAIN_STEP;
    if (inVillage(x, z) || !inMillpondGround(x, z)) continue;
    // Heights are above the lawn's top, which sits 5 cm over the terrain.
    const height = millpondGround(x, z) - MILLPOND.lawn;
    terrain[row * terrainCols + col] = height;
    terrainMax = Math.max(terrainMax, height);
  }
export const terrainField = {
  step: TERRAIN_STEP,
  cols: terrainCols,
  rows: terrainRows,
  heights: terrain,
  max: terrainMax,
};

/** Height of the bare ground at (x, z), bilinear between samples. */
export function terrainHeight(x, z) {
  const fx = Math.min(
      Math.max((x - ground.minX) / TERRAIN_STEP, 0),
      terrainCols - 1,
    ),
    fz = Math.min(
      Math.max((z - ground.minZ) / TERRAIN_STEP, 0),
      terrainRows - 1,
    ),
    x0 = Math.min(Math.floor(fx), terrainCols - 2),
    z0 = Math.min(Math.floor(fz), terrainRows - 2),
    tx = fx - x0,
    tz = fz - z0,
    i = z0 * terrainCols + x0,
    a = terrain[i] + (terrain[i + 1] - terrain[i]) * tx,
    b =
      terrain[i + terrainCols] +
      (terrain[i + terrainCols + 1] - terrain[i + terrainCols]) * tx;
  return a + (b - a) * tz;
}
