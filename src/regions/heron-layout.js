// @ts-check
// Where The Drowsy Heron stands on the map: on the north side of the market
// square, between the tea room and the post office and set back behind them,
// its street front facing south across the stalls. Like every building here it
// faces the overview's camera. The building's own design lives in
// src/pub/layout.js, in its own coordinates and full size; this sets it down at
// a scale that sits among its neighbours (the door opens onto the full-size
// room). Pure data and functions, loaded with the village: colliders, grass and
// the label need them before the meshes stream in (src/regions/heron.js builds
// those).
import { PUB, YARD } from "../pub/layout.js";

export const HERON = {
  x: 36,
  z: -17,
  scale: 0.82,
  area: { minX: 28, maxX: 44.4, minZ: -22.5, maxZ: -9 },
  // The forecourt, in the building's own coordinates.
  court: { halfW: 7.4, front: 9.4 },
  // Where the innkeeper stands, in the building's own coordinates.
  keeper: { x: -2.6, z: 6.5 },
  // The short path from the forecourt to the square, on the map.
  path: [
    [35, -9.4],
    [34.75, -5.6],
    [34.5, -3.2],
    [34.2, -1],
  ],
  pathHalfWidth: 0.72,
};

/**
 * A point in the building's coordinates, on the map.
 * @param {number} x
 * @param {number} z
 * @returns {{ x: number, z: number }}
 */
export const onMap = (x, z) => ({ x: HERON.x + x * HERON.scale, z: HERON.z + z * HERON.scale });

// A box in the building's coordinates, on the map.
const boxOnMap = (x0, z0, x1, z1) => ({
  ...onMap((x0 + x1) / 2, (z0 + z1) / 2),
  w: Math.abs(x1 - x0) * HERON.scale,
  d: Math.abs(z1 - z0) * HERON.scale,
});
const roundOnMap = (x, z, r) => ({ ...onMap(x, z), r: r * HERON.scale });

const { halfW, halfD, wing, kitchen: k, hearth, gallery } = PUB;

/** Where E answers at the front door, under the gallery. */
export const HERON_DOOR = onMap(0, halfD + 0.75);

/** The lanterns under the gallery, which the lamp pool visits at dusk. */
export const heronLamps = () => [onMap(-2.85, gallery.front + 0.2), onMap(2.85, gallery.front + 0.2)];

/** The building and everything in its yard, as colliders on the map. */
export function heronColliders() {
  return [
    boxOnMap(-halfW, -halfD, halfW, halfD),
    boxOnMap(-halfW, halfD, -wing.inner, wing.front),
    boxOnMap(wing.inner, halfD, halfW, wing.front),
    // The great west stack and the kitchen behind.
    boxOnMap(hearth.backX - 0.32, -2, -halfW, 2),
    boxOnMap(k.minX - 0.24, k.minZ - 0.24, k.maxX + 0.24, -halfD),
    // The cellar flap and the rear yard's casks and wood store.
    boxOnMap(-1.92, -5.42, -0.2, -halfD),
    boxOnMap(-3.55, -5.5, -2.25, -4.25),
    boxOnMap(-6.6, -5.28, -4.4, -4.04),
    // The gallery's posts and the benches beneath it.
    ...[-2.85, -1.2, 1.2, 2.85].map((x) => roundOnMap(x, gallery.front - 0.1, 0.16)),
    boxOnMap(-2.55, halfD, -1.55, halfD + 0.45),
    boxOnMap(1.55, halfD, 2.55, halfD + 0.45),
    // The yard.
    roundOnMap(YARD.signPost.x, YARD.signPost.z, 0.18),
    ...YARD.benches.map((b) => boxOnMap(b.x - 0.9, b.z - 0.76, b.x + 0.9, b.z + 0.76)),
    boxOnMap(YARD.trough.x - 0.36, YARD.trough.z - 0.95, YARD.trough.x + 0.36, YARD.trough.z + 0.95),
    boxOnMap(YARD.hitchingRail.x - 0.1, YARD.hitchingRail.z - 1.25, YARD.hitchingRail.x + 0.1, YARD.hitchingRail.z + 1.25),
    // The two pots by the door.
    roundOnMap(-1.15, gallery.front + 0.75, 0.24),
    roundOnMap(1.15, gallery.front + 0.75, 0.24),
  ];
}

const grassFree = boxOnMap(-HERON.court.halfW - 1.4, k.minZ - 0.5, HERON.court.halfW + 2.5, HERON.court.front + 0.1);

/**
 * Distance from (x, z) to the path's centre line.
 * @param {number} x
 * @param {number} z
 */
function pathDistance(x, z) {
  let best = Infinity;
  for (let i = 0; i < HERON.path.length - 1; i++) {
    const [ax, az] = HERON.path[i],
      [bx, bz] = HERON.path[i + 1],
      dx = bx - ax,
      dz = bz - az,
      t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

/**
 * Where meadow grass may grow: not through the building, its forecourt or path.
 * @param {number} x
 * @param {number} z
 */
export function heronGrass(x, z) {
  if (Math.abs(x - grassFree.x) <= grassFree.w / 2 && Math.abs(z - grassFree.z) <= grassFree.d / 2) return false;
  return pathDistance(x, z) > HERON.pathHalfWidth + 0.08;
}

/** The inn's entry in the region registry (src/regions/index.js). */
export const heronRegion = {
  id: "heron",
  name: PUB.name,
  area: HERON.area,
  colliders: heronColliders,
  grass: heronGrass,
  stream: (T, world, game) =>
    import("./heron.js").then(({ heronJobs }) => heronJobs(T, world, game)),
};
