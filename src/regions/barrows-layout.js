// @ts-check
// The old barrows: grassy burial mounds on either side of the millpond, far
// older than the village or the mill. West of the pond, between its bank and
// the orchard hill's foot, a round barrow ringed by kerbstones and a smaller
// one beside it; east of the pond, in the open fields, a long barrow whose
// stone doorway faces the morning, two round barrows and a standing stone.
// The spirals carved into their stones glow at blue hour. Nobody in
// Willowmere knows who built them.
//
// Pure data and functions, loaded with the village: walking heights,
// colliders, grass and the location label need them before the meshes
// stream in (src/regions/barrows.js builds those). The mounds are meshes that
// sit on the ground (the fields' lawn, the pond's bank and the hill's foot),
// and their surface is a deck the player walks over, so they need no ground
// mesh of their own. North is -z.
import { MILLPOND, inMillpondGround, millpondGround } from "./millpond-layout.js";
import { inOrchardGround, orchardGround } from "./orchard-layout.js";

const smooth = (/** @type {number} */ a, /** @type {number} */ b, /** @type {number} */ x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * A mound: centre (x, z), radius `r` and height `h`. A long barrow also has a
 * spine, `half` metres either side of its centre along `turn` (radians from
 * +x toward +z, toward its head), narrowing to `tailR` and sinking to `tailH`
 * at its tail. A `door` cuts a notch into its head for a stone doorway,
 * `width` across, set `inset` of the head's radius back from its foot.
 * @typedef {{ id: string, side: "west" | "east", x: number, z: number, r: number, h: number,
 *   turn?: number, half?: number, tailR?: number, tailH?: number,
 *   door?: { width: number, inset: number } }} Mound
 */

export const BARROWS = {
  // The lawn's top around the mounds.
  lawn: MILLPOND.lawn,
  // A mound's mesh starts this far under the ground, so its foot never shows
  // an edge; the walking surface follows the mesh.
  sink: 0.025,
  /** @type {Mound[]} */
  mounds: [
    // West of the pond: the old mound, between the bank and the hill.
    { id: "old-mound", side: "west", x: -1.1, z: -32.6, r: 3, h: 1.75 },
    { id: "west-small", side: "west", x: 0.5, z: -37.3, r: 1.9, h: 1 },
    // East of the pond: the long barrow, its head to the east-south-east.
    {
      id: "long-barrow",
      side: "east",
      x: 31.4,
      z: -32.6,
      r: 2.4,
      h: 1.8,
      turn: 0.35,
      half: 3.3,
      tailR: 1.65,
      tailH: 1.15,
      door: { width: 1.1, inset: 0.58 },
    },
    { id: "east-north", side: "east", x: 27.8, z: -37.3, r: 2.4, h: 1.3 },
    { id: "east-south", side: "east", x: 37.8, z: -26.4, r: 1.9, h: 1 },
  ],
  // Kerbstones ring the old mound's foot, `count` of them, leaving a gap at
  // `gap` (radians from +x toward +z) for its carved stone.
  kerb: { mound: "old-mound", count: 11, radius: 2.85, gap: 1.2, size: 0.26 },
  // The standing stones: where each stands, its height, and which way its
  // carved face looks (radians from +x toward +z).
  stones: [
    { id: "west-stone", x: 1.1, z: -27.7, height: 2.0, face: 1.15, lean: 0.1 },
    { id: "east-stone", x: 34.4, z: -28.1, height: 1.7, face: 1.05, lean: -0.07 },
  ],
  // The forecourt's uprights before the long barrow's door: an angle round the
  // door (0 straight out) and a distance from it.
  forecourt: [
    [-1.2, 1.9, 0.95],
    [-0.62, 2.3, 0.7],
    [0.62, 2.3, 0.75],
    [1.2, 1.9, 1.05],
  ],
  // The location label's bounds on each side of the pond.
  west: { minX: -4.6, maxX: 2.8, minZ: -40.5, maxZ: -26 },
  east: { minX: 26, maxX: 40.6, maxZ: -24.2 },
};

const B = BARROWS;
/** @param {string} id */
export const moundById = (id) => /** @type {Mound} */ (B.mounds.find((m) => m.id === id));

/**
 * (x, z) in a mound's own frame: `u` along its spine toward the head, `v`
 * across it.
 * @param {Mound} m
 * @param {number} x
 * @param {number} z
 */
export function moundFrame(m, x, z) {
  const turn = m.turn ?? 0,
    c = Math.cos(turn),
    s = Math.sin(turn),
    dx = x - m.x,
    dz = z - m.z;
  return { u: dx * c + dz * s, v: -dx * s + dz * c };
}

/**
 * A point in a mound's frame, on the map.
 * @param {Mound} m
 * @param {number} u
 * @param {number} v
 */
export function moundPoint(m, u, v) {
  const turn = m.turn ?? 0,
    c = Math.cos(turn),
    s = Math.sin(turn);
  return { x: m.x + u * c - v * s, z: m.z + u * s + v * c };
}

/**
 * Where a long barrow's doorway stands: `u` along its spine. Its head's foot
 * lies at half + r.
 * @param {Mound} m
 */
export const doorU = (m) => (m.half ?? 0) + m.r * (1 - (m.door?.inset ?? 0));

/** How far a mound reaches from its centre, for quick rejection. */
const reach = (/** @type {Mound} */ m) => (m.half ?? 0) + m.r;

/**
 * A mound's height above the ground beneath it at (x, z), 0 off it: a rounded
 * crown easing into the lawn at its foot, swelling a little so it never
 * reads as a perfect dome. A long barrow's notch for its door is cut out.
 * @param {Mound} m
 * @param {number} x
 * @param {number} z
 */
export function moundHeight(m, x, z) {
  const R = reach(m);
  if (Math.abs(x - m.x) > R || Math.abs(z - m.z) > R) return 0;
  const { u, v } = moundFrame(m, x, z),
    half = m.half ?? 0,
    along = Math.max(-half, Math.min(half, u)),
    t = half ? (along + half) / (2 * half) : 1,
    r = (m.tailR ?? m.r) + (m.r - (m.tailR ?? m.r)) * t,
    h = (m.tailH ?? m.h) + (m.h - (m.tailH ?? m.h)) * t,
    rho = Math.hypot(u - along, v) / r;
  if (rho >= 1) return 0;
  const swell = 1 + 0.05 * Math.sin(x * 1.7 + z * 0.6) * Math.sin(z * 1.3 - x * 0.4);
  let height = h * (1 - rho * rho) ** 1.5 * swell;
  if (m.door) {
    // The notch: level ground in front of the door, turf banks either side.
    const w = m.door.width / 2,
      cut = (1 - smooth(w, w + 0.75, Math.abs(v))) * smooth(doorU(m) - 0.35, doorU(m) + 0.05, u);
    height *= 1 - cut;
  }
  return height;
}

/**
 * The tallest mound's height above the ground at (x, z), 0 off every mound.
 * @param {number} x
 * @param {number} z
 */
export function barrowHeight(x, z) {
  let height = 0;
  for (const m of B.mounds) height = Math.max(height, moundHeight(m, x, z));
  return height;
}

/**
 * The bare ground under the mounds: the pond's bank on the west side's east
 * edge, the hill's foot on its west edge, the lawn everywhere else.
 * @param {number} x
 * @param {number} z
 */
export function groundUnder(x, z) {
  if (inMillpondGround(x, z)) return millpondGround(x, z);
  if (inOrchardGround(x, z)) return orchardGround(x, z);
  return B.lawn;
}

/**
 * A mound's surface at (x, z), where the player walks over it, else null.
 * @param {number} x
 * @param {number} z
 */
export function barrowsDeck(x, z) {
  const height = barrowHeight(x, z);
  return height > B.sink ? groundUnder(x, z) + height - B.sink : null;
}

/**
 * Where each kerbstone stands round the old mound, and the carved stone in
 * the ring's gap.
 */
export function kerbstones() {
  const k = B.kerb,
    m = moundById(k.mound),
    stones = [];
  for (let i = 0; i < k.count; i++) {
    // The ring leaves one stone's space for the carved stone.
    const a = k.gap + ((i + 1) / (k.count + 1)) * Math.PI * 2;
    stones.push({
      x: m.x + Math.cos(a) * k.radius,
      z: m.z + Math.sin(a) * k.radius,
      angle: a,
      size: k.size * (0.85 + 0.3 * Math.abs(Math.sin(i * 2.7))),
    });
  }
  return stones;
}

/** The carved stone in the old mound's kerb, facing out of the ring's gap. */
export function carvedStone() {
  const k = B.kerb,
    m = moundById(k.mound),
    r = k.radius + 0.12;
  return { x: m.x + Math.cos(k.gap) * r, z: m.z + Math.sin(k.gap) * r, angle: k.gap };
}

/** The long barrow's forecourt uprights, on the map, with their heights. */
export function forecourtStones() {
  const m = moundById("long-barrow"),
    u0 = doorU(m);
  return B.forecourt.map(([a, d, height]) => ({
    ...moundPoint(m, u0 + Math.cos(a) * d, Math.sin(a) * d),
    height,
  }));
}

/** Where E answers at each place: the doorway, the carved stone, the standing stones. */
export function barrowLandmarks() {
  const m = moundById("long-barrow"),
    door = moundPoint(m, doorU(m) + 1.15, 0),
    carved = carvedStone();
  return [
    { id: "long-barrow", name: "The long barrow", ...door, radius: 1.5 },
    {
      id: "old-mound",
      name: "The old mound",
      x: carved.x + Math.cos(carved.angle) * 0.9,
      z: carved.z + Math.sin(carved.angle) * 0.9,
      radius: 1.4,
    },
    ...B.stones.map((s) => ({
      id: "standing-stone",
      name: "Standing stone",
      x: s.x + Math.cos(s.face) * 0.8,
      z: s.z + Math.sin(s.face) * 0.8,
      radius: 1.4,
    })),
  ];
}

/**
 * Colliders for the barrows' stones, in the shapes collides()
 * (src/game/navigation.js) understands. The mounds themselves are walked
 * over; their doorway is not.
 */
export function barrowsColliders() {
  const m = moundById("long-barrow"),
    door = moundPoint(m, doorU(m) - 0.15, 0),
    carved = carvedStone();
  return [
    // The doorway's portal stones, capstone and door stone.
    { x: door.x, z: door.z, r: 0.85 },
    ...forecourtStones().map((s) => ({ x: s.x, z: s.z, r: 0.28 })),
    ...kerbstones().map((s) => ({ x: s.x, z: s.z, r: s.size * 0.9 })),
    { x: carved.x, z: carved.z, r: 0.42 },
    ...B.stones.map((s) => ({ x: s.x, z: s.z, r: 0.42 })),
  ];
}

/**
 * Where meadow grass may grow: not up the mounds (their own grass does) nor
 * through their stones.
 * @param {number} x
 * @param {number} z
 */
export function barrowsGrass(x, z) {
  if (!(inBox(B.west, x, z) || inBox(B.east, x, z))) return true;
  if (barrowHeight(x, z) > 0.04) return false;
  for (const c of footings) if (Math.hypot(x - c.x, z - c.z) < c.r + 0.1) return false;
  return true;
}
const inBox = (/** @type {{ minX?: number, maxX?: number, minZ?: number, maxZ?: number }} */ b, /** @type {number} */ x, /** @type {number} */ z) =>
  x >= (b.minX ?? -Infinity) && x <= (b.maxX ?? Infinity) && z >= (b.minZ ?? -Infinity) && z <= (b.maxZ ?? Infinity);
const footings = barrowsColliders();

/** The east side's entry in the region registry (src/regions/index.js). */
export const barrowsRegion = {
  id: "barrows",
  name: "The old barrows",
  area: B.east,
  deck: barrowsDeck,
  colliders: barrowsColliders,
  grass: barrowsGrass,
  stream: (/** @type {any} */ T, /** @type {any} */ world) =>
    import("./barrows.js").then(({ barrowsJobs }) => ({ jobs: barrowsJobs(T, world) })),
};

/**
 * The west side's label: it lies within the millpond's and the orchard's
 * areas, so its entry comes before theirs in the registry. Everything else
 * comes from barrowsRegion.
 */
export const westBarrowsRegion = {
  id: "barrows-west",
  name: "The old barrows",
  area: B.west,
};
