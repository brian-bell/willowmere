// @ts-check
// The old windmill on paper, with no three.js: the tower's size, its floors and
// ladders, where the walker may stand on each, and how a ladder is climbed. The
// room's builders, its walk and the tests all read this, and the tower's outside
// (src/regions/orchard.js) reads its windows, so the two cannot disagree.
//
// Inside is the outside's shape at a walkable scale. Bearings are `theta`,
// radians about the tower's axis measured from the door: x = r sin theta,
// z = r cos theta. The door is theta 0, at +z, so a visitor walks in facing -z.
//
// The middle of the tower is open from the floor to the cap, with the mill's
// shaft and wheels standing in it. Each platform is a crescent on the wall, and
// the ascent winds round in the direction of increasing theta: along a platform,
// up a ladder laid against the wall, and onto the start of the next platform.

import { ORCHARD } from "../regions/orchard-layout.js";

const { windmill: W } = ORCHARD;
const TAU = Math.PI * 2;

export const SCALE = 2.33;

export const TOWER = {
  eye: 1.65,
  wall: 0.45,
  // Where the tower's wall ends and the turning cap begins, and the cap's height.
  curb: W.height * SCALE,
  cap: W.capHeight * SCALE,
  // How high the windshaft runs, above the curb.
  shaftY: (W.height + W.shaftRise) * SCALE,
  shaftTheta: W.shaftBearing - W.doorBearing,
  door: { width: 1.15, height: 2.3 },
};

/** The inside face of the tower's wall at height `y`. */
export const wallRadius = (y) => (W.radius - W.taper * (y / TOWER.curb)) * SCALE - TOWER.wall;

/** A point at radius `r` on bearing `theta`. */
export const polar = (r, theta) => ({ x: r * Math.sin(theta), z: r * Math.cos(theta) });

const DECK = 1.35; // How far each platform reaches from the wall.
const LADDER_RUN = 1.12; // A ladder's length along the floor, about 70 degrees.
const RUNG = 0.3; // Between rungs.
const STRIDE = 0.75; // Walked distance per footstep sound (src/interior.js).
export const LADDER_HALF_WIDTH = 0.33;

// The platforms' heights, and each one's length along the wall, in radians, from
// the ladder that reaches it to the foot of the ladder leaving it.
const HEIGHTS = [0, 2.9, 5.4, 7.9, 10.4];
const SPANS = [2.6, 2.5, 1.55];
const FIRST_LADDER = 0.85; // On the right as you walk in.
const PAST_LADDER = 0.18; // How far a deck runs on beyond a ladder's foot.
const TOP_GAP = 0.72; // The hole the last ladder comes up through.

/**
 * @typedef {{
 *   id: string, y: number, whole?: boolean, start?: number, end?: number, inner?: number,
 *   deck?: { r: number }, gangway?: { theta: number, halfWidth: number },
 * }} Floor
 * @typedef {{
 *   id: string, from: number, to: number, foot: {x: number, z: number}, head: {x: number, z: number},
 *   footTheta: number, headTheta: number, axis: {x: number, z: number}, side: {x: number, z: number},
 *   run: number, rise: number, rungs: number, pace: number,
 * }} Ladder
 */

/** @type {Floor[]} */
export const FLOORS = [
  { id: "meal", y: HEIGHTS[0], whole: true },
  { id: "stone", y: HEIGHTS[1] },
  { id: "bin", y: HEIGHTS[2] },
  { id: "seat", y: HEIGHTS[3] },
  { id: "dust", y: HEIGHTS[4] },
];

const middle = (i) => (i === 0 ? wallRadius(0) - 0.85 : wallRadius(HEIGHTS[i]) - DECK / 2);

/** @type {Ladder[]} */
export const LADDERS = [];
{
  let theta = FIRST_LADDER;
  for (let i = 0; i < FLOORS.length - 1; i++) {
    const r0 = middle(i),
      r1 = middle(i + 1),
      headTheta = theta + LADDER_RUN / ((r0 + r1) / 2),
      foot = polar(r0, theta),
      head = polar(r1, headTheta),
      run = Math.hypot(head.x - foot.x, head.z - foot.z),
      axis = { x: (head.x - foot.x) / run, z: (head.z - foot.z) / run },
      rise = FLOORS[i + 1].y - FLOORS[i].y,
      rungs = Math.round(rise / RUNG);
    LADDERS.push({
      id: `ladder-${i}`,
      from: i,
      to: i + 1,
      foot,
      head,
      footTheta: theta,
      headTheta,
      axis,
      side: { x: axis.z, z: -axis.x },
      run,
      rise,
      rungs,
      // Slow enough along the floor that one footstep's walking is one rung.
      pace: run / rungs / STRIDE,
    });
    const next = FLOORS[i + 1];
    next.start = headTheta;
    next.inner = wallRadius(next.y) - DECK;
    if (i < SPANS.length) {
      theta = headTheta + SPANS[i];
      next.end = theta + PAST_LADDER;
    } else next.end = headTheta + TAU - TOP_GAP;
  }
}

// The stone floor also has a round deck in the middle of the well, on a gangway
// from the middle of its crescent, where the stones stand around the shaft.
{
  const stone = FLOORS[1];
  stone.deck = { r: 1.5 };
  stone.gangway = { theta: (stone.start + stone.end) / 2, halfWidth: 0.55 };
}
FLOORS[4].inner = 1.5;

/** The levels a walker can be on: every floor and every ladder, by id. */
const FLOOR_INDEX = Object.fromEntries(FLOORS.map((f, i) => [f.id, i]));
const LADDER_BY_ID = Object.fromEntries(LADDERS.map((l) => [l.id, l]));

/** `theta` moved by whole turns into the turn beginning at `from`. */
const unwrap = (theta, from) => from + ((((theta - from) % TAU) + TAU) % TAU);

const along = (l, x, z) => (x - l.foot.x) * l.axis.x + (z - l.foot.z) * l.axis.z;
const across = (l, x, z) => (x - l.foot.x) * l.side.x + (z - l.foot.z) * l.side.z;

/**
 * Whether (x, z) stands on floor `i`'s boards, at least `c` from its edges.
 * @param {number} i
 * @param {number} x
 * @param {number} z
 * @param {number} c
 */
export function onFloor(i, x, z, c = 0) {
  const f = FLOORS[i],
    r = Math.hypot(x, z);
  if (r > wallRadius(f.y) - c) return false;
  if (f.whole) return true;
  if (f.deck && r < f.deck.r - c) return true;
  if (f.gangway) {
    const s = Math.sin(f.gangway.theta),
      k = Math.cos(f.gangway.theta),
      out = x * s + z * k,
      sideways = x * k - z * s;
    if (out > 0 && out < f.inner + 0.3 && Math.abs(sideways) < f.gangway.halfWidth - c) return true;
  }
  if (r < f.inner + c) return false;
  const a = unwrap(Math.atan2(x, z), f.start);
  return (a - f.start) * r > c && (f.end - a) * r > c;
}

const SLOT = 0.6; // How far a ladder's opening runs back into the deck at its head.

/**
 * Whether floor `i` keeps a walker of clearance `c` out of (x, z). A ladder's
 * sides and back are solid from the floor at its foot, but the walker walks in
 * between its rails; at its head the rail is open, and only there.
 */
function floorBlocks(i, x, z, c) {
  for (const l of LADDERS) {
    if (l.from !== i && l.to !== i) continue;
    const a = along(l, x, z),
      s = Math.abs(across(l, x, z));
    if (l.to === i && s < LADDER_HALF_WIDTH && a >= l.run - 0.02 && a < l.run + SLOT) return false;
    if (l.from === i && a > -c && a < l.run + c && s < LADDER_HALF_WIDTH + c) {
      if (s >= LADDER_HALF_WIDTH || a >= l.run) return true;
    }
  }
  return !onFloor(i, x, z, c);
}

// What stands on each floor, as colliders the walker understands. The builders
// put their furniture on the same spots.
const at = (r, theta, more) => ({ ...polar(r, theta), ...more });
const boxAt = (r, theta, w, d) => ({ ...polar(r, theta), w, d, rotation: theta });

const gangway = FLOORS[1].gangway.theta;
export const HURST = {
  // The stone deck's four great posts, square to the door so that from it they
  // frame the shaft, and the two stones to either side, clear of the gangway.
  legs: [1, 3, 5, 7].map((n) => ({ theta: (n * Math.PI) / 4, r: 1.2 })),
  stones: [gangway + 2, gangway - 2].map((theta) => ({ theta, r: 1 })),
  tun: 0.42,
  // The chutes that bring the flour down from the stones, and where they end.
  spout: 1.32,
};

export const FURNITURE = {
  sacks: { r: 3.05, theta: -0.66, radius: 0.62 },
  desk: { r: 3.32, theta: -1.28, w: 1.15, d: 0.6 },
  barrow: { r: 3.25, theta: -2.15, radius: 0.34 },
  scale: { r: 3.2, theta: 2.1, radius: 0.42 },
  crates: { r: 3.25, theta: 3.25, w: 1.0, d: 0.7 },
  spareStone: { r: 3.25, theta: 1.72, w: 1.05, d: 0.4 },
  crane: { r: 3.15, theta: 3.3, radius: 0.22 },
  bins: [4.68, 5.92].map((theta) => ({ r: 3.0, theta, w: 1.15, d: 0.66 })),
  seat: { theta: 1.15, r: 2.84, w: 1.2, d: 0.42 },
  lever: { r: 2.5, theta: 4.65, radius: 0.1 },
  bundle: { r: 2.5, theta: 1.05, radius: 0.28 },
};

const F = FURNITURE;
const FLOOR_THINGS = {
  meal: [
    { x: 0, z: 0, r: 0.24 },
    ...HURST.legs.map(({ r, theta }) => at(r, theta, { r: 0.12 })),
    ...HURST.stones.map(({ theta }) => at(HURST.spout, theta, { r: 0.32 })),
    at(F.sacks.r, F.sacks.theta, { r: F.sacks.radius }),
    boxAt(F.desk.r, F.desk.theta, F.desk.w, F.desk.d),
    at(F.barrow.r, F.barrow.theta, { r: F.barrow.radius }),
    at(F.scale.r, F.scale.theta, { r: F.scale.radius }),
    boxAt(F.crates.r, F.crates.theta, F.crates.w, F.crates.d),
  ],
  stone: [
    { x: 0, z: 0, r: 0.18 },
    ...HURST.stones.map(({ r, theta }) => at(r, theta, { r: HURST.tun + 0.02 })),
    boxAt(F.spareStone.r, F.spareStone.theta, F.spareStone.w, F.spareStone.d),
    at(F.crane.r, F.crane.theta, { r: F.crane.radius }),
  ],
  bin: F.bins.map((b) => boxAt(b.r, b.theta, b.w, b.d)),
  seat: [boxAt(F.seat.r, F.seat.theta, F.seat.w, F.seat.d)],
  dust: [at(F.lever.r, F.lever.theta, { r: F.lever.radius }), at(F.bundle.r, F.bundle.theta, { r: F.bundle.radius })],
};

/**
 * The colliders that hold on a level, in the shapes src/interior-movement.js
 * understands.
 * @param {string} level
 */
export function collidersFor(level) {
  const ladder = LADDER_BY_ID[level];
  if (ladder)
    return [
      {
        blocks: (x, z) => {
          const a = along(ladder, x, z);
          return Math.abs(across(ladder, x, z)) > LADDER_HALF_WIDTH + 0.02 || a < -0.08 || a > ladder.run + 0.08;
        },
      },
    ];
  const i = FLOOR_INDEX[level];
  return [{ blocks: (x, z, c) => floorBlocks(i, x, z, c) }, ...FLOOR_THINGS[level]];
}

/**
 * Which level a walker on `level` is on after standing at (x, z). A ladder is
 * got onto by walking in between its rails from a floor it touches, and off by
 * walking out past either end.
 * @param {string} level
 * @param {number} x
 * @param {number} z
 */
export function levelAt(level, x, z) {
  const ladder = LADDER_BY_ID[level];
  if (ladder) {
    const a = along(ladder, x, z);
    if (a < 0) return FLOORS[ladder.from].id;
    if (a > ladder.run) return FLOORS[ladder.to].id;
    return level;
  }
  const i = FLOOR_INDEX[level];
  for (const l of LADDERS) {
    if (l.from !== i && l.to !== i) continue;
    const a = along(l, x, z);
    if (a >= 0 && a <= l.run && Math.abs(across(l, x, z)) < LADDER_HALF_WIDTH) return l.id;
  }
  return level;
}

/**
 * The feet's height on `level` at (x, z): a floor's boards, or how far up a
 * ladder the walker has come.
 * @param {string} level
 * @param {number} x
 * @param {number} z
 */
export function floorHeight(level, x, z) {
  const ladder = LADDER_BY_ID[level];
  if (!ladder) return FLOORS[FLOOR_INDEX[level]].y;
  const t = Math.min(1, Math.max(0, along(ladder, x, z) / ladder.run));
  return FLOORS[ladder.from].y + ladder.rise * t;
}

/**
 * The little rise and fall of pulling up one rung at a time, on top of the
 * feet's height; nothing off a ladder.
 * @param {string} level
 * @param {number} x
 * @param {number} z
 */
export function rungLurch(level, x, z) {
  const ladder = LADDER_BY_ID[level];
  if (!ladder) return 0;
  const t = Math.min(1, Math.max(0, along(ladder, x, z) / ladder.run));
  return Math.sin(t * ladder.rungs * TAU) * 0.03 * Math.min(1, Math.min(t, 1 - t) * 12);
}

const rail = { x: 0, z: 0, pace: 1, dx: 0, dz: 0 };

/**
 * The line a walker on a ladder keeps to, for src/interior-movement.js: its
 * direction up the ladder, how fast along the floor, and the step back to the
 * ladder's middle. Null on a floor. The same object comes back each frame.
 * @param {string} level
 * @param {number} x
 * @param {number} z
 */
export function railAt(level, x, z) {
  const ladder = LADDER_BY_ID[level];
  if (!ladder) return null;
  const off = across(ladder, x, z);
  rail.x = ladder.axis.x;
  rail.z = ladder.axis.z;
  rail.pace = ladder.pace;
  rail.dx = -off * ladder.side.x;
  rail.dz = -off * ladder.side.z;
  return rail;
}

/** Whether `level` is a ladder rather than a floor. */
export const onLadder = (level) => level in LADDER_BY_ID;

// The windows, each a bearing, a height and a size, and which floor looks out of
// it. Those on the side the afternoon sun comes from let a shaft of it in; the
// top one looks through the turning sails at the village.
export const WINDOWS = [
  { id: "meal", floor: "meal", theta: -1.28, y: 1.85, w: 0.95, h: 1.15 },
  { id: "stone", floor: "stone", theta: 2.72, y: 4.55, w: 0.95, h: 1.15 },
  { id: "bin", floor: "bin", theta: 5.32, y: 7.05, w: 0.95, h: 1.15 },
  { id: "seat", floor: "seat", theta: FURNITURE.seat.theta, y: 9.5, w: 1.1, h: 1.2 },
  { id: "sails", floor: "dust", theta: TOWER.shaftTheta, y: 11.6, w: 1.05, h: 1.2 },
  { id: "hills", floor: "dust", theta: 3.75, y: 11.6, w: 0.85, h: 1.2 },
];

/** The windows as the tower's outside places them: an angle from the door and a height, in its own metres. */
export const outsideWindows = () => WINDOWS.map((w) => [w.theta, w.y / SCALE]);

// The spawn just inside the door, facing the shaft and the first ladder.
export const SPAWN = { x: 0, z: wallRadius(0) - 0.8, yaw: 0 };

export const WALK_BOUNDS = (() => {
  const r = wallRadius(0) + 0.5;
  return { minX: -r, maxX: r, minZ: -r, maxZ: r };
})();
