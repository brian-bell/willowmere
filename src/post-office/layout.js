// @ts-check
// The post office on paper: its three spaces, where each fitting stands, and
// the colliders that keep a visitor out of them. No three.js, so the logic tests
// walk the same plan the builders dress. Room coordinates, as in the other
// rooms: +z is the front door and the lane, -z the back of the building, +x the
// door's side; the eye is 2.45 above the floor, so everything is a little larger
// than life. The door and the big window stand on the same sides as outside
// (src/regions/market.js), and the chimney breast under the roof's stack.
//
//   z = 4.8  ┌── big window ──┬───── door ─────┐
//            │ desk      PUBLIC HALL   notices │ boxes
//   z = 1.15 ├── counter + grille ──┐flap┌─────┤
//            │ table      SORTING        desk  │ (side windows)
//   z = -3.66├─ pigeonholes ───────┐door┌──────┤
//            │ stove   BACK ROOM    bike       │
//   z = -7   └── parcels ───────── rear window ┘
//       x = -6.4                            x = 6.4

/** @typedef {{ x: number, z: number, w: number, d: number, rotation?: number }} BoxCollider */
/** @typedef {{ x: number, z: number, r: number }} RoundCollider */

export const POST_OFFICE = {
  halfW: 6.4,
  front: 4.8,
  back: -7,
  ceiling: 4.3,
  wall: 0.26,
  eye: 2.45,
  dado: 1.45,
  // The wall between the sorting office and the back room.
  partition: -3.53,
  // Openings as [from, to] along their wall, [bottom, top] up it.
  door: { x: [1.6, 3.6], y: [0, 3.3] },
  bigWindow: { x: [-5.2, -0.3], y: [0.95, 3.35] },
  sideWindow: { z: [-2.1, -0.1], y: [1.45, 3.35] },
  rearWindow: { x: [2.3, 4.5], y: [1.5, 3.3] },
  backDoor: { x: [1.7, 3.7], y: [0, 3] },
  // The counter: west run under the grille, the flap's gap, the shop's short run.
  counter: { minZ: -0.15, maxZ: 1.15, height: 1.52, grilleZ: 0.34, westEnd: 1.9, eastStart: 3.5 },
  grilleBays: [
    { from: -5.9, to: -3.35 },
    { from: -3.35, to: -0.8 },
    { from: -0.8, to: 1.9 },
  ],
  // The sorting frame on the partition's south face, and the cabinet under it.
  frame: { minX: -5.9, maxX: 1.45, front: -2.9, bottom: 1.14, cols: 15, rows: 6, cell: 0.49, rowH: 0.385 },
  dresser: { minX: 3.95, maxX: 6.3, front: -2.85 },
  table: { minX: -4.9, maxX: -1.3, minZ: -1.85, maxZ: -1.02, height: 1.46 },
  telegraphDesk: { minX: 5.3, maxX: 6.4, minZ: -2.5, maxZ: -0.3, height: 1.34 },
  // The hall's fittings.
  boxes: { z: 2.95, cols: 8, rows: 6, cell: 0.4, bottom: 0.92, depth: 0.34, mine: { col: 4, row: 2 } },
  writingDesk: { minZ: 2.15, maxZ: 4.45, depth: 0.82, height: 1.5 },
  spinner: { x: -1.75, z: 2.85, r: 0.5 },
  pennyScale: { x: -5.82, z: 1.72 },
  bench: { minX: 3.95, maxX: 5.8, depth: 0.58 },
  sill: { depth: 0.46 },
  // The back room's.
  chimney: { minX: -4.4, maxX: -2.4, depth: 0.62 },
  stove: { x: -3.4, z: -4.82, r: 0.56 },
  armchair: { x: -5.42, z: -4.72, w: 1.28, d: 1.2, rotation: 1.4 },
  sideTable: { x: -5.95, z: -5.62, r: 0.36 },
  switchStool: { x: -5.55, z: -6.2, r: 0.24 },
  shelves: { minX: -4.45, maxX: 1.95, depth: 0.72, levels: [0.3, 1.18, 2.06, 2.94, 3.76] },
  switchboard: { minX: -6.4, maxX: -4.72, depth: 0.62 },
  sacks: { minX: -1.7, maxX: 1.4, depth: 1.06 },
  hamper: { x: 0.95, z: -5.2, w: 1.25, d: 0.9, rotation: 0.16 },
  ladder: { x: -0.9, footZ: -5.62 },
  crates: { minX: 4.55, maxX: 5.55, depth: 0.65 },
  workbench: { minX: 2.35, maxX: 4.5, depth: 0.72, height: 1.3 },
  bicycle: { x: 5.86, z: -5.2, w: 0.5, d: 2.95 },
};

const P = POST_OFFICE;

/** A box collider from its edges. */
const edges = (minX, maxX, minZ, maxZ) => ({
  x: (minX + maxX) / 2,
  z: (minZ + maxZ) / 2,
  w: maxX - minX,
  d: maxZ - minZ,
});

/**
 * Everything a visitor walks around. The walls are the walker's bounds, so
 * the door is shut until E opens it.
 * @returns {(BoxCollider | RoundCollider)[]}
 */
export function postOfficeColliders() {
  const c = P.counter,
    f = P.frame,
    wallBack = P.partition - P.wall / 2;
  return [
    // The counter's two runs, with the flap's gap between.
    edges(-P.halfW, c.westEnd, c.minZ, c.maxZ),
    edges(c.eastStart, P.halfW, c.minZ, c.maxZ),
    // The partition with what stands against it.
    edges(-P.halfW, P.backDoor.x[0], wallBack, f.front),
    edges(P.backDoor.x[1], P.halfW, wallBack, P.dresser.front),
    // The sorting office.
    edges(P.table.minX, P.table.maxX, P.table.minZ, P.table.maxZ),
    edges(P.telegraphDesk.minX, P.telegraphDesk.maxX, P.telegraphDesk.minZ, P.telegraphDesk.maxZ),
    { x: -5.42, z: -1.42, r: 0.34 },
    { x: 4.82, z: -1.42, r: 0.3 },
    // The hall.
    edges(P.bigWindow.x[0] - 0.14, P.bigWindow.x[1] + 0.14, P.front - P.sill.depth, P.front),
    edges(-P.halfW, -P.halfW + P.writingDesk.depth, P.writingDesk.minZ, P.writingDesk.maxZ),
    edges(P.halfW - P.boxes.depth, P.halfW, P.boxes.z - (P.boxes.cols * P.boxes.cell) / 2 - 0.1, P.boxes.z + (P.boxes.cols * P.boxes.cell) / 2 + 0.1),
    edges(P.bench.minX, P.bench.maxX, P.front - P.bench.depth, P.front),
    { x: P.spinner.x, z: P.spinner.z, r: P.spinner.r },
    { x: P.pennyScale.x, z: P.pennyScale.z, r: 0.46 },
    // The back room.
    edges(P.chimney.minX, P.chimney.maxX, wallBack - P.chimney.depth, wallBack),
    { x: P.stove.x, z: P.stove.z, r: P.stove.r },
    P.armchair,
    { x: P.sideTable.x, z: P.sideTable.z, r: P.sideTable.r },
    edges(P.shelves.minX, P.shelves.maxX, P.back, P.back + P.shelves.depth),
    edges(P.switchboard.minX, P.switchboard.maxX, P.back, P.back + P.switchboard.depth),
    edges(P.sacks.minX, P.sacks.maxX, wallBack - P.sacks.depth, wallBack),
    P.hamper,
    edges(P.workbench.minX, P.workbench.maxX, P.back, P.back + P.workbench.depth),
    P.bicycle,
    P.switchStool,
    edges(P.ladder.x - 0.36, P.ladder.x + 0.36, P.ladder.footZ - 0.4, P.ladder.footZ + 0.08),
    edges(P.crates.minX, P.crates.maxX, P.back, P.back + P.crates.depth),
  ];
}

export const POST_OFFICE_SPAWN = { x: 2.6, z: 3.95, yaw: 0.42 };

/** What the walker needs: the walls as bounds, the fittings as colliders, the way in. */
export const postOfficeLayout = () => ({
  bounds: { minX: -P.halfW, maxX: P.halfW, minZ: P.back, maxZ: P.front },
  spawn: POST_OFFICE_SPAWN,
  colliders: postOfficeColliders(),
});

/** Which of the building's three spaces a point at `z` is in. */
export function spaceAt(z) {
  if (z >= P.counter.minZ) return "hall";
  return z >= P.partition ? "sorting" : "back";
}

// Every PO box's number reads left to right, top to bottom, as they do in a
// real wall of them; the visitor's own (Rosewood's) is `mine`.
export const boxNumber = (col, row) => row * P.boxes.cols + col + 1;
export const MY_BOX = boxNumber(P.boxes.mine.col, P.boxes.mine.row);

/** The middle of a sorting-frame hole's mouth; row 0 is the top row. */
export function pigeonholeAt(col, row) {
  const f = P.frame;
  return {
    x: f.minX + (col + 0.5) * f.cell,
    y: f.bottom + (f.rows - row - 0.5) * f.rowH,
    z: f.front,
  };
}
// The hole the pigeon has taken for himself, under the label that says so.
export const PIGEON_HOLE = { col: 8, row: 3 };
const pigeon = pigeonholeAt(PIGEON_HOLE.col, PIGEON_HOLE.row);

// Where each thing the visitor can press E at stands, read by the builders and
// by the room's points (src/content/post-office.js), so they cannot drift apart.
export const FIXTURES = {
  door: { x: 2.6, y: 2, z: P.front - 0.05 },
  bell: { x: 1.42, y: 1.72, z: 0.8 },
  card: { x: 0.45, y: 1.72, z: 0.84 },
  scale: { x: -2.05, y: 1.8, z: 0.75 },
  letterSlot: { x: -5.0, y: 1.1, z: 1.17 },
  jars: { x: 4.95, y: 2, z: 0.62 },
  stamp: { x: -1.6, y: 1.66, z: 0.02 },
  pigeonholes: { x: -3.6, y: 2.2, z: -2.95 },
  pigeon: { x: pigeon.x, y: pigeon.y + 0.05, z: -2.92 },
  sorting: { x: -3.1, y: 1.6, z: -1.43 },
  telegraph: { x: 5.82, y: 1.5, z: -1.42 },
  clock: { x: 2.7, y: 3.65, z: -3.36 },
  dresser: { x: 5.1, y: 2.2, z: -2.95 },
  boxes: { x: P.halfW - P.boxes.depth, y: 1.9, z: P.boxes.z },
  notices: { x: 4.9, y: 2.5, z: P.front - 0.05 },
  telephone: { x: 1.1, y: 2.45, z: P.front - 0.05 },
  pennyScale: { x: P.pennyScale.x, y: 1.9, z: P.pennyScale.z },
  window: { x: -2.75, y: 1.7, z: P.front - 0.1 },
  spinner: { x: P.spinner.x, y: 1.7, z: P.spinner.z },
  writing: { x: -P.halfW + P.writingDesk.depth / 2, y: 1.55, z: 3.3 },
  map: { x: -P.halfW + 0.05, y: 2.9, z: 3.3 },
  stove: { x: P.stove.x, y: 1.5, z: P.stove.z },
  wireless: { x: -3.05, y: 2.45, z: -4.38 },
  loaf: { x: P.sideTable.x, y: 1.05, z: P.sideTable.z },
  switchboard: { x: -5.55, y: 1.8, z: P.back + P.switchboard.depth },
  parcels: { x: -1.25, y: 2.1, z: P.back + P.shelves.depth },
  sacks: { x: -0.2, y: 1.7, z: P.partition - P.wall / 2 - P.sacks.depth },
  bicycle: { x: 5.72, y: 1.5, z: -5.1 },
  workbench: { x: 3.42, y: 1.45, z: P.back + P.workbench.depth / 2 },
};
