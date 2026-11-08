// @ts-check
// Willow Mill on paper: the one big room of its ground floor, where the water's
// gearing stands, where each fitting is, and the colliders that keep a visitor
// out of them. No three.js, so the logic tests walk the same plan the builders
// dress. Room coordinates, as in the other rooms: +z is the front door and the
// green, -z the back of the building, +x east; -x is the brook and the wheel.
// The eye is 2.45 above the floor, so everything is a little larger than life.
// The openings stand where they do outside (src/village/buildings.js and the
// house backs in src/village/rears.js): the outside's 4.4 m square is SCALE times
// smaller across.
//
//   z = 5.3  ┌── window ──┬─ pegs ─ door ─ board ──┬── window ──┐
//            │ hoist                                     bolter │
//            │   ┌ pit ┐  meal sack                             │
//   axle ════╪═ wheel  shaft  tun                          desk │
//            │   └─────┘                              ╷ window  │
//            │ sluice              chair  stove       ╵         │
//   (window) │                                     spare stone  │
//            │ bins            mouse                     sacks  │
//   z = -5.3 └──────────── window ──────── back door ───────────┘
//       x = -5.3                                          x = 5.3

/** @typedef {{ x: number, z: number, w: number, d: number, rotation?: number }} BoxCollider */
/** @typedef {{ x: number, z: number, r: number }} RoundCollider */

const HALF = 5.3;

export const MILL = {
  halfW: HALF,
  front: HALF,
  back: -HALF,
  ceiling: 4.9,
  wall: 0.4,
  eye: 2.45,
  /** How many times larger across the room is than the outside's footprint. */
  scale: (2 * HALF) / 4.4,
  // Openings as [from, to] along their wall, [bottom, top] up it.
  door: { x: [-0.95, 0.95], y: [0, 3.1] },
  frontWindows: [
    { x: [-4.1, -2.26], y: [1.35, 3.0] },
    { x: [2.26, 4.1], y: [1.35, 3.0] },
  ],
  eastWindow: { z: [-1.08, 1.08], y: [1.3, 2.9] },
  westWindow: { z: [-3.75, -2.35], y: [1.45, 2.75] },
  backWindow: { x: [-2.68, -0.94], y: [1.3, 2.65] },
  backDoor: { x: [1.34, 3.24], y: [0, 3.0] },
  // The drive: the wheel's axle comes through the west wall into the pit
  // wheel, which turns the wallower at the foot of the upright shaft; the great
  // spur wheel at its head turns the stone nut on the stones' quant.
  axle: { z: 1.2, y: 1.2 },
  pit: { minX: -HALF, maxX: -3.55, minZ: -0.75, maxZ: 3.15, depth: 0.7 },
  pitWheel: { x: -4.6, r: 1.6 },
  shaft: { x: -3.95, z: 1.2 },
  wallower: { r: 0.5, y: 2.86 },
  spur: { r: 1.2, y: 3.95 },
  stoneNut: { r: 0.32 },
  // The stones in their tun, the hopper over them and the meal sack they fill.
  stones: { x: -2.49, z: 1.91, r: 0.92, height: 0.98 },
  mealSack: { x: -1.6, z: 2.95, r: 0.34 },
  // The sack hoist's chain, down through the trapdoors in the front corner.
  hoist: { x: -4.45, z: 4.3, r: 0.4 },
  trap: { minX: -5.0, maxX: -3.9, minZ: 3.76, maxZ: 4.84 },
  // The sluice lever on the west wall, between the pit and the window.
  sluice: { z: -1.7, depth: 0.72, w: 0.8 },
  // Along the back: the grain bins, the back door's clear space, the sacks.
  bins: { maxX: -2.9, depth: 0.85, height: 1.25 },
  sacks: { minX: 3.55, minZ: -4.15 },
  sackTruck: { x: 0.75, z: -4.95, r: 0.32 },
  mouseHole: { x: -1.45, z: -HALF },
  mouse: { x: -2.65, z: -4.05 },
  // The miller's corner: the stove, the rocking chair, the desk and its stool.
  stove: { x: 2.95, z: -1.7, w: 0.82, d: 0.72 },
  hearth: { w: 1.5, d: 1.3 },
  chair: { x: 1.65, z: -0.45, r: 0.5, face: -2.25 },
  desk: { minZ: 1.55, maxZ: 3.55, depth: 0.78, height: 1.18 },
  stool: { x: 4.05, z: 2.55, r: 0.25 },
  // The bolter, the spare stone, and a peg rail by the door.
  bolter: { minZ: 3.75, maxZ: 5.3, depth: 0.95, height: 1.35 },
  spare: { z: -2.75, r: 0.95 },
  pegs: { x: -1.6 },
  board: { x: 1.6 },
};

const M = MILL;

/** A box collider from its edges. */
const edges = (minX, maxX, minZ, maxZ) => ({
  x: (minX + maxX) / 2,
  z: (minZ + maxZ) / 2,
  w: maxX - minX,
  d: maxZ - minZ,
});

/**
 * Everything a visitor walks around. The walls are the walker's bounds, so the
 * door is shut until E opens it.
 * @returns {(BoxCollider | RoundCollider)[]}
 */
export function millColliders() {
  const W = M.halfW,
    p = M.pit,
    s = M.stove;
  return [
    // The rails round the pit, with the upright shaft standing inside them.
    edges(p.minX, p.maxX, p.minZ, p.maxZ),
    // The tun and the meal sack under its spout.
    { x: M.stones.x, z: M.stones.z, r: M.stones.r + 0.08 },
    { x: M.mealSack.x, z: M.mealSack.z, r: M.mealSack.r },
    // The hoist's sack, waiting at the foot of the chain.
    { x: M.hoist.x, z: M.hoist.z, r: M.hoist.r },
    edges(-W, -W + M.sluice.depth, M.sluice.z - M.sluice.w / 2, M.sluice.z + M.sluice.w / 2),
    edges(-W, M.bins.maxX, M.back, M.back + M.bins.depth),
    edges(M.sacks.minX, W, M.back, M.sacks.minZ),
    { x: M.sackTruck.x, z: M.sackTruck.z, r: M.sackTruck.r },
    edges(s.x - s.w / 2, s.x + s.w / 2, s.z - s.d / 2, s.z + s.d / 2),
    { x: M.chair.x, z: M.chair.z, r: M.chair.r },
    edges(W - M.desk.depth, W, M.desk.minZ, M.desk.maxZ),
    { x: M.stool.x, z: M.stool.z, r: M.stool.r },
    edges(W - M.bolter.depth, W, M.bolter.minZ, M.bolter.maxZ),
    edges(W - 0.45, W, M.spare.z - M.spare.r, M.spare.z + M.spare.r),
  ];
}

export const MILL_SPAWN = { x: 0.2, z: 4.4, yaw: 0.35 };

/** What the walker needs: the walls as bounds, the fittings as colliders, the way in. */
export const millLayout = () => ({
  bounds: { minX: -M.halfW, maxX: M.halfW, minZ: M.back, maxZ: M.front },
  spawn: MILL_SPAWN,
  colliders: millColliders(),
});

/**
 * The middle of an opening's [from, to].
 * @param {number[]} span
 */
export const middle = (span) => (span[0] + span[1]) / 2;

// Where each thing the visitor can press E at stands, read by the builders and
// by the room's points (src/content/mill.js), so they cannot drift apart.
const W = M.halfW;
export const FIXTURES = {
  door: { x: 0, y: 2, z: M.front - 0.05 },
  pegs: { x: M.pegs.x, y: 2.5, z: M.front - 0.1 },
  board: { x: M.board.x, y: 2.15, z: M.front - 0.05 },
  green: { x: middle(M.frontWindows[0].x), y: 2.15, z: M.front - 0.05 },
  hoist: { x: M.hoist.x, y: 1.5, z: M.hoist.z },
  pitWheel: { x: M.pitWheel.x + 0.25, y: 1.3, z: M.axle.z },
  spur: { x: M.shaft.x + 0.7, y: M.spur.y, z: M.shaft.z + 0.6 },
  stones: { x: M.stones.x, y: M.stones.height, z: M.stones.z },
  hopper: { x: M.stones.x, y: 2.0, z: M.stones.z - 0.3 },
  meal: { x: M.mealSack.x, y: 0.9, z: M.mealSack.z },
  sluice: { x: -W + 0.35, y: 1.65, z: M.sluice.z },
  wheel: { x: -W - 0.05, y: 2.1, z: middle(M.westWindow.z) },
  bins: { x: (-W + M.bins.maxX) / 2, y: M.bins.height, z: M.back + M.bins.depth },
  mouse: { x: M.mouse.x, y: 0.15, z: M.mouse.z },
  garden: { x: middle(M.backWindow.x), y: 2.0, z: M.back + 0.05 },
  backDoor: { x: middle(M.backDoor.x), y: 1.8, z: M.back + 0.05 },
  sacks: { x: (M.sacks.minX + W) / 2, y: 1.15, z: M.sacks.minZ },
  spare: { x: W - 0.3, y: 1.0, z: M.spare.z },
  stove: { x: M.stove.x, y: 0.85, z: M.stove.z },
  chair: { x: M.chair.x, y: 1.2, z: M.chair.z },
  lane: { x: W - 0.05, y: 2.1, z: middle(M.eastWindow.z) },
  desk: { x: W - M.desk.depth / 2, y: M.desk.height + 0.05, z: (M.desk.minZ + M.desk.maxZ) / 2 },
  bolter: { x: W - M.bolter.depth / 2, y: 1.45, z: (M.bolter.minZ + M.bolter.maxZ) / 2 - 0.2 },
};
