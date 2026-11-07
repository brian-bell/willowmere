// @ts-check
// The Copper Kettle on paper: its two spaces, where each fitting stands, and
// the colliders that keep a visitor out of them. No three.js, so the logic
// tests walk the same plan the builders dress. Room coordinates, as in the
// other rooms: +z is the front door and the lane, -z the back of the building,
// +x east; the eye is 2.45 above the floor, so everything is a little larger
// than life. The door, the bay and the east window stand where they do outside
// (src/regions/market.js), and the chimney breast is under the roof's stack.
//
//   z = 4.8  ┌──── bay ─────┬── door ──┬─ window ──┐
//            │ bay table        tea room  window tbl│
//            │ dresser  middle tbl   fire tbl  gram.│
//   z = 0.1  ├─ counter ──┐            armchairs    │ (side windows)
//            │  (behind)  │ menu  ┌─ fireplace ─┐   │
//   z = -2.4 ├─ shelves ──┴─door─┴── chimney ──┴───┤
//            │ pantry    table        range    sacks│
//   z = -6.2 └── sink + rear window ──── rack ──────┘
//       x = -6.4                                x = 6.4

/** @typedef {{ x: number, z: number, w: number, d: number, rotation?: number }} BoxCollider */
/** @typedef {{ x: number, z: number, r: number }} RoundCollider */
/** @typedef {{ x: number, z: number, face: number }} Chair */

export const KETTLE = {
  halfW: 6.4,
  front: 4.8,
  back: -6.2,
  ceiling: 4.2,
  wall: 0.26,
  eye: 2.45,
  dado: 1.3,
  // The wall between the tea room and the kitchen, and the stack in it.
  partition: -2.4,
  // Openings as [from, to] along their wall, [bottom, top] up it.
  door: { x: [-1, 1], y: [0, 3.25] },
  bay: { x: [-5.7, -2.0], y: [0.95, 3.15], depth: 1.15, seat: 0.92 },
  eastWindow: { x: [2.8, 5.1], y: [1.25, 3.15] },
  sideWindow: { z: [-1.55, 0.35], y: [1.75, 3.2] },
  rearWindow: { x: [-2.6, -0.2], y: [1.55, 3.2] },
  kitchenDoor: { x: [-1.9, -0.1], y: [0, 3.0] },
  // The chimney breast, standing into the tea room, and its fire.
  chimney: { minX: 2.7, maxX: 5.0, depth: 0.7, mantel: 1.72 },
  fireplace: { x: [3.3, 4.4], y: [0, 1.32], hearth: 0.42 },
  // The serving counter along the west wall, and the shelves behind it.
  counter: { minX: -6.4, maxX: -2.2, minZ: -0.95, maxZ: 0.1, height: 1.5 },
  backShelf: { maxX: -2.0, depth: 0.38 },
  dresser: { minZ: 0.65, maxZ: 2.75, depth: 0.58 },
  // The tea tables: the bay's square one for two, and three round ones.
  bayTable: { x: -3.85, z: 3.5, w: 1.15, d: 0.95 },
  roundTables: [
    { id: "middle", x: -3.4, z: 1.4, r: 0.6, seats: [-Math.PI / 2, Math.PI / 2, 0] },
    { id: "fireside", x: 1.7, z: 1.55, r: 0.55, seats: [Math.PI / 2, 0] },
    { id: "window", x: 4.15, z: 3.35, r: 0.55, seats: [-Math.PI / 2, Math.PI] },
  ],
  tableHeight: 1.12,
  chairFrom: 0.92,
  // By the fire: two armchairs, and the gramophone's cabinet on the east wall.
  armchairs: [
    { x: 2.15, z: -0.6, r: 0.58, face: -1.13 },
    { x: 5.65, z: -0.45, r: 0.58, face: 1.08 },
  ],
  gramophone: { minZ: 1.0, maxZ: 1.9, depth: 0.65 },
  hatStand: { x: 1.65, z: 4.3, r: 0.3 },
  // The kitchen's fittings.
  range: { minX: 2.75, maxX: 4.95, depth: 0.85 },
  table: { x: -0.9, z: -4.2, w: 3.0, d: 1.15, height: 1.12 },
  stools: [
    { x: -2.85, z: -4.2, r: 0.24 },
    { x: 1.05, z: -4.2, r: 0.24 },
  ],
  sinkRun: { minX: -3.4, maxX: 0.8, depth: 0.72, height: 1.25 },
  pantry: { minZ: -5.9, maxZ: -3.0, depth: 0.6 },
  rack: { minX: 2.4, maxX: 5.6, depth: 0.7, height: 1.25 },
  recipeStand: { minZ: -4.8, maxZ: -3.9, depth: 0.55 },
  sacks: { minX: 5.35, maxX: 6.4, minZ: -3.5, maxZ: -2.53 },
};

const K = KETTLE;

/** A box collider from its edges. */
const edges = (minX, maxX, minZ, maxZ) => ({
  x: (minX + maxX) / 2,
  z: (minZ + maxZ) / 2,
  w: maxX - minX,
  d: maxZ - minZ,
});

/**
 * Every chair at a tea table: where it stands and the way its sitter faces.
 * @returns {Chair[]}
 */
export function teaChairs() {
  const t = K.bayTable,
    out = [
      { x: t.x - t.w / 2 - 0.68, z: t.z, face: -Math.PI / 2 },
      { x: t.x + t.w / 2 + 0.68, z: t.z, face: Math.PI / 2 },
    ];
  for (const table of K.roundTables)
    for (const a of table.seats)
      out.push({ x: table.x + Math.sin(a) * K.chairFrom, z: table.z + Math.cos(a) * K.chairFrom, face: a });
  return out;
}

/**
 * Everything a visitor walks around. The walls are the walker's bounds, so
 * the door is shut until E opens it.
 * @returns {(BoxCollider | RoundCollider)[]}
 */
export function kettleColliders() {
  const c = K.counter,
    southFace = K.partition + K.wall / 2,
    northFace = K.partition - K.wall / 2,
    ch = K.chimney,
    W = K.halfW;
  return [
    // The partition, either side of the kitchen door.
    edges(-W, K.kitchenDoor.x[0], northFace, southFace),
    edges(K.kitchenDoor.x[1], W, northFace, southFace),
    // The tea room.
    edges(c.minX, c.maxX, c.minZ, c.maxZ),
    edges(-W, K.backShelf.maxX, southFace, southFace + K.backShelf.depth),
    edges(ch.minX, ch.maxX, southFace, southFace + ch.depth),
    // The fender keeps you off the hearth.
    edges(K.fireplace.x[0] - 0.2, K.fireplace.x[1] + 0.2, southFace + ch.depth, southFace + ch.depth + K.fireplace.hearth),
    edges(-W, -W + K.dresser.depth, K.dresser.minZ, K.dresser.maxZ),
    edges(K.bayTable.x - K.bayTable.w / 2, K.bayTable.x + K.bayTable.w / 2, K.bayTable.z - K.bayTable.d / 2, K.bayTable.z + K.bayTable.d / 2),
    ...K.roundTables.map((t) => ({ x: t.x, z: t.z, r: t.r })),
    ...teaChairs().map((chair) => ({ x: chair.x, z: chair.z, r: 0.3 })),
    ...K.armchairs.map((a) => ({ x: a.x, z: a.z, r: a.r })),
    edges(W - K.gramophone.depth, W, K.gramophone.minZ, K.gramophone.maxZ),
    { x: K.hatStand.x, z: K.hatStand.z, r: K.hatStand.r },
    // The kitchen.
    edges(K.range.minX, K.range.maxX, northFace - K.range.depth, northFace),
    edges(K.table.x - K.table.w / 2, K.table.x + K.table.w / 2, K.table.z - K.table.d / 2, K.table.z + K.table.d / 2),
    ...K.stools,
    edges(K.sinkRun.minX, K.sinkRun.maxX, K.back, K.back + K.sinkRun.depth),
    edges(-W, -W + K.pantry.depth, K.pantry.minZ, K.pantry.maxZ),
    edges(K.rack.minX, K.rack.maxX, K.back, K.back + K.rack.depth),
    edges(W - K.recipeStand.depth, W, K.recipeStand.minZ, K.recipeStand.maxZ),
    edges(K.sacks.minX, K.sacks.maxX, K.sacks.minZ, K.sacks.maxZ),
  ];
}

export const KETTLE_SPAWN = { x: 0.15, z: 3.95, yaw: 0.3 };

/** What the walker needs: the walls as bounds, the fittings as colliders, the way in. */
export const kettleLayout = () => ({
  bounds: { minX: -K.halfW, maxX: K.halfW, minZ: K.back, maxZ: K.front },
  spawn: KETTLE_SPAWN,
  colliders: kettleColliders(),
});

/** Which space a point is in: the tea room, behind its counter, or the kitchen. */
export function spaceAt(x, z) {
  if (z < K.partition) return "kitchen";
  if (z < K.counter.minZ && x < K.counter.maxX) return "counter";
  return "tea room";
}

/**
 * Whether a point answers a visitor at (x, z): from its own side of the
 * partition, or only from the spaces it names (`from`), since the room's scan
 * lets the last metre of an approach pass through anything, a wall included.
 * @param {{ x: number, z: number, from?: string[] }} point
 */
export function answersFrom(point, x, z) {
  const here = spaceAt(x, z);
  if (point.from) return point.from.includes(here);
  return (here === "kitchen") === (spaceAt(point.x, point.z) === "kitchen");
}

// Where each thing the visitor can press E at stands, read by the builders and
// by the room's points (src/content/copper-kettle.js), so they cannot drift apart.
const southFace = K.partition + K.wall / 2,
  northFace = K.partition - K.wall / 2,
  fireX = (K.fireplace.x[0] + K.fireplace.x[1]) / 2;
export const FIXTURES = {
  door: { x: 0, y: 2, z: K.front - 0.05 },
  bell: { x: -2.55, y: 1.62, z: -0.2 },
  till: { x: -3.35, y: 1.85, z: -0.42 },
  cake: { x: -4.45, y: 1.78, z: -0.38 },
  loaf: { x: -5.6, y: 1.62, z: -0.4 },
  urn: { x: -4.7, y: 1.75, z: southFace + 0.2 },
  caddies: { x: -3.1, y: 2.85, z: southFace + 0.1 },
  menu: { x: 1.35, y: 2.55, z: southFace + 0.03 },
  fire: { x: fireX, y: 0.72, z: southFace + K.chimney.depth + 0.05 },
  kettle: { x: 4.5, y: K.chimney.mantel + 0.28, z: southFace + K.chimney.depth - 0.12 },
  sit: { x: K.armchairs[0].x, y: 1.3, z: K.armchairs[0].z },
  cat: { x: -5.1, y: 1.12, z: K.front + 0.5 },
  bay: { x: (K.bay.x[0] + K.bay.x[1]) / 2, y: 2.1, z: K.front + 0.3 },
  pour: { x: K.bayTable.x + 0.22, y: K.tableHeight + 0.16, z: K.bayTable.z },
  eastWindow: { x: (K.eastWindow.x[0] + K.eastWindow.x[1]) / 2, y: 2.1, z: K.front - 0.05 },
  book: { x: K.roundTables[2].x, y: K.tableHeight + 0.05, z: K.roundTables[2].z + 0.05 },
  gramophone: { x: K.halfW - K.gramophone.depth / 2, y: 1.75, z: (K.gramophone.minZ + K.gramophone.maxZ) / 2 },
  photos: { x: K.halfW - 0.05, y: 2.75, z: 2.7 },
  dresser: { x: -K.halfW + K.dresser.depth, y: 2.2, z: (K.dresser.minZ + K.dresser.maxZ) / 2 },
  oven: { x: (K.range.minX + K.range.maxX) / 2, y: 0.85, z: northFace - K.range.depth },
  scones: { x: K.table.x + 0.45, y: K.table.height + 0.06, z: K.table.z },
  sink: { x: -1.4, y: 1.3, z: K.back + 0.62 },
  garden: { x: (K.rearWindow.x[0] + K.rearWindow.x[1]) / 2, y: 2.4, z: K.back + 0.05 },
  pantry: { x: -K.halfW + K.pantry.depth, y: 2.1, z: -4.45 },
  rack: { x: 3.9, y: 1.45, z: K.back + K.rack.depth },
  recipes: { x: K.halfW - K.recipeStand.depth / 2, y: 1.45, z: (K.recipeStand.minZ + K.recipeStand.maxZ) / 2 },
  pans: { x: K.table.x - 0.4, y: 3.35, z: K.table.z },
  clock: { x: (K.range.minX + K.range.maxX) / 2, y: 3.1, z: northFace - 0.42 },
};
