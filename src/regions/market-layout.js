// @ts-check
// The market lane's shape: the lane east from the mill to the map's edge, the
// market square and its stalls, the tea room and the post office, and the
// footbridge that crosses the brook south of the village's own bridge. Pure
// data and functions, loaded with the village: the colliders, grass, decks and
// region label need it before the lane's meshes stream in (src/regions/market.js
// builds those).
//
// The lane is flat, like the village it leaves. North is -z.

import { curve, lineDistance } from "./lines.js";

const box = (x, z, w, d) => ({ x, z, w, d });

export const MARKET = {
  // The label's bounds: east of the village, between the millpond's latitude
  // and the southern fields.
  area: { minX: 24, minZ: -17, maxZ: 17 },
  // The market square: a gravel oval the lane runs through.
  square: { x: 33.5, z: 2.6, rx: 6.6, rz: 4.3 },
  // The footbridge over the brook, south of the village's bridge: its deck
  // spans the channel between the banks; rails run along both sides.
  bridge: { minX: 9, maxX: 15, minZ: 9.85, maxZ: 11.35, base: 0.14, rise: 0.34 },
  // Buildings face south, onto the lane: { x, z } is the footprint's centre.
  teaRoom: { x: 27.2, z: -7.2, w: 5, d: 4.2, h: 2.9 },
  // The post office's door stands `door` east of its middle, as it does
  // inside (src/post-office/layout.js).
  postOffice: { x: 41.4, z: -6, w: 4.4, d: 3.6, h: 2.7, door: 0.7 },
  postBox: { x: 43.5, z: -3.3 },
  // The tea room's terrace tables.
  tables: [
    { x: 25.3, z: -3.3 },
    { x: 29.1, z: -3.4 },
  ],
  // Stalls: `facing` is the way their counters look (radians about y, 0 is +z).
  stalls: [
    { id: "seeds", x: 31, z: -2, facing: 0 },
    { id: "lanterns", x: 36.4, z: -2, facing: 0 },
    { id: "hats", x: 30.4, z: 7.6, facing: Math.PI },
    { id: "produce", x: 36.8, z: 7.6, facing: Math.PI },
  ],
  stallSize: { w: 2.4, d: 1.2 },
  // Poles that carry the bunting across the square.
  poles: [
    { x: 28.3, z: -0.5 },
    { x: 38.9, z: -0.6 },
    { x: 28.5, z: 5.9 },
    { x: 38.7, z: 5.7 },
  ],
  lamps: [
    { x: 23.4, z: 5.3 },
    { x: 33.7, z: -1.8 },
    { x: 40.4, z: 4.4 },
  ],
  // The lane runs off the map here, past a signpost and a parked cart.
  signpost: { x: 45.4, z: -1.1 },
  cart: { x: 43.6, z: 3.6, w: 1.5, d: 2.4 },
  // Hedgerows where the lane runs off the map, and flowering shrubs by the
  // tea room and the square: [x, z, look] of each clump, where `look` picks
  // its blossom and the turn of its leaves.
  hedges: [
    { from: [44, -1.95], to: [47.5, -2.05] },
    { from: [44.9, 2.75], to: [47.5, 2.6] },
  ],
  shrubs: [
    [24.4, -5.6, 0],
    [30.1, -6.2, 1],
    [23.9, 9.2, 4],
    [38.5, 9.9, 5],
  ],
  // The post office's planting: a bed along its west wall (a hydrangea at the
  // front corner, two lavenders, a laurel at the back) and a rose and a
  // clipped box by its east wall. `r` and `h` are each plant's spread and height.
  postGarden: [
    { kind: "hydrangea", x: 38.55, z: -4.6, r: 0.6, h: 1.0 },
    { kind: "lavender", x: 38.72, z: -5.5, r: 0.4, h: 0.58 },
    { kind: "lavender", x: 38.76, z: -6.25, r: 0.36, h: 0.52 },
    { kind: "laurel", x: 38.55, z: -7.3, r: 0.6, h: 1.45 },
    { kind: "rose", x: 44.1, z: -6.8, r: 0.5, h: 0.95 },
    { kind: "box", x: 44.02, z: -7.62, r: 0.34, h: 0.62 },
  ],
  // Where the residents stand.
  residents: {
    hazel: { x: 28.4, z: -2.1 },
    bram: { x: 40, z: -2.9 },
  },
  laneHalfWidth: 1.25,
  pathHalfWidth: 0.72,
};

const M = MARKET;

// The lane leaves the mill road's southern end, just east of the village's
// bridge, and runs east through the square to the rim.
export const LANE = curve([
  [16.3, 3],
  [18.6, 3.5],
  [21.5, 3.6],
  [24.5, 3.1],
  [27.5, 2.6],
  [30.5, 2.4],
  [33.5, 2.4],
  [36.5, 2.3],
  [39.5, 1.8],
  [42.5, 1.1],
  [45.5, 0.6],
  [48, 0.4],
]);

// Narrower paths: from the footbridge to the square's south side, from the
// footbridge west to the kitchen gardens' road, and from each door to the lane.
export const PATHS = [
  curve([
    [14.8, 10.6],
    [17.2, 11.3],
    [20, 12],
    [23, 11.7],
    [26, 11],
    [29.5, 10.8],
    [32.4, 9.6],
    [33.5, 7.2],
  ]),
  curve([
    [9.2, 10.6],
    [6.5, 10.9],
    [3.5, 10.9],
    [0.4, 10.4],
  ]),
  curve([
    [M.teaRoom.x, M.teaRoom.z + M.teaRoom.d / 2],
    [M.teaRoom.x + 0.1, -2.2],
    [M.teaRoom.x + 0.2, 1.8],
  ]),
  curve([
    [M.postOffice.x + M.postOffice.door, M.postOffice.z + M.postOffice.d / 2],
    [M.postOffice.x + M.postOffice.door - 0.15, -2],
    [M.postOffice.x + M.postOffice.door - 0.4, 0.9],
  ]),
];

/** Distance from (x, z) to the lane's centre line (Infinity when over `reach` away). */
export const laneDistance = (x, z, reach) => lineDistance(LANE, x, z, reach);

/** Distance from (x, z) to the nearest narrow path's centre line (Infinity when over `reach` away). */
export function pathDistance(x, z, reach) {
  let best = Infinity;
  for (const path of PATHS) best = Math.min(best, lineDistance(path, x, z, reach));
  return best;
}

/** Inside the market square's oval, 1 at the centre and 0 at its edge. */
export function squareWeight(x, z) {
  const { x: cx, z: cz, rx, rz } = M.square;
  return 1 - Math.hypot((x - cx) / rx, (z - cz) / rz);
}

/** Whether (x, z) is on the lane, the square or a path, with `margin` to spare. */
export function onGravel(x, z, margin = 0) {
  return (
    laneDistance(x, z, 2) < M.laneHalfWidth + margin ||
    pathDistance(x, z, 2) < M.pathHalfWidth + margin ||
    squareWeight(x, z) > -margin / M.square.rz
  );
}

/** A stall's footprint, turned to face its way. */
export function stallBox(stall) {
  const { w, d } = M.stallSize,
    across = Math.abs(Math.sin(stall.facing)) > 0.5;
  return box(stall.x, stall.z, across ? d : w, across ? w : d);
}

/** Where a shopper stands at a stall: in front of its counter. */
export function stallFront(stall, distance = 1.25) {
  return {
    x: stall.x + Math.sin(stall.facing) * distance,
    z: stall.z + Math.cos(stall.facing) * distance,
  };
}

/** Walking height on the footbridge's deck, or null off it. */
export function bridgeDeck(x, z) {
  const b = M.bridge;
  if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) return null;
  return b.base + Math.sin(((x - b.minX) / (b.maxX - b.minX)) * Math.PI) * b.rise;
}

const buildingBox = (b) => box(b.x, b.z, b.w, b.d);

/** The clumps along each hedgerow, about 0.7 m apart. */
export function hedgeClumps() {
  return M.hedges.flatMap(({ from, to }) => {
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]),
      count = Math.max(2, Math.round(length / 0.7) + 1);
    return Array.from({ length: count }, (_, i) => {
      const t = i / (count - 1);
      return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
    });
  });
}

/**
 * Colliders for the lane's buildings, stalls, tables, poles, lamps and cart,
 * and the footbridge's rails, in the shapes collides() (src/game/navigation.js)
 * understands. The brook's own colliders leave the bridge's span open
 * (world.js).
 */
export function marketColliders() {
  const b = M.bridge,
    span = b.maxX - b.minX;
  return [
    buildingBox(M.teaRoom),
    buildingBox(M.postOffice),
    ...M.stalls.map(stallBox),
    ...M.tables.map((t) => ({ x: t.x, z: t.z, r: 0.62 })),
    ...M.poles.map((p) => ({ x: p.x, z: p.z, r: 0.1 })),
    ...M.lamps.map((l) => ({ x: l.x, z: l.z, r: 0.18 })),
    { x: M.postBox.x, z: M.postBox.z, r: 0.26 },
    { x: M.signpost.x, z: M.signpost.z, r: 0.14 },
    box(M.cart.x, M.cart.z, M.cart.w, M.cart.d),
    // The player walks through the hedgerows and shrubs (see collides()).
    ...hedgeClumps().map(([x, z]) => ({ x, z, r: 0.42, passable: true })),
    ...M.shrubs.map(([x, z]) => ({ x, z, r: 0.4, passable: true })),
    ...M.postGarden.map(({ x, z, r }) => ({ x, z, r: Math.min(r, 0.4), passable: true })),
    box((b.minX + b.maxX) / 2, b.minZ, span, 0.16),
    box((b.minX + b.maxX) / 2, b.maxZ, span, 0.16),
  ];
}

// Every footing, for the grass mask; colliders never move.
let footings = null;
// Everything of the market's lies inside this box.
const extent = { minX: -1, maxX: 49, minZ: -10, maxZ: 13.5 };

/** Where meadow grass may grow: off the gravel and every footing. */
export function marketGrass(x, z) {
  if (x < extent.minX || x > extent.maxX || z < extent.minZ || z > extent.maxZ) return true;
  if (onGravel(x, z, 0.08)) return false;
  if (bridgeDeck(x, z) != null) return false;
  const clear = (c, margin) =>
    c.r !== undefined
      ? Math.hypot(x - c.x, z - c.z) < c.r + margin
      : Math.abs(x - c.x) < c.w / 2 + margin && Math.abs(z - c.z) < c.d / 2 + margin;
  for (const c of (footings ??= marketColliders())) if (clear(c, 0.25)) return false;
  return true;
}

/** The market lane's entry in the region registry (src/regions/index.js). */
export const marketRegion = {
  id: "market",
  name: "The market lane",
  area: M.area,
  deck: bridgeDeck,
  colliders: marketColliders,
  grass: marketGrass,
  // Its builder also brings the lane's two residents.
  stream: (T, world, game) =>
    import("./market.js").then(({ marketJobs }) => marketJobs(T, world, game)),
};
