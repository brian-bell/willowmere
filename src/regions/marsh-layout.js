// The willow marsh's shape: the brook south of the village, the reedy mere it
// spreads into, the boardwalk on stilts across its western shallows, the bird
// hide on its far shore, the trails round it and the footbridge where the
// brook leaves the village. Pure data and functions, loaded with the village:
// the terrain, colliders, decks, grass and region label need it before the
// marsh's meshes stream in (src/regions/marsh.js builds those).
//
// The brook used to end at the village's south edge (z = 21). It now runs on
// under a footbridge for a few metres, then opens into the mere at the same
// level. North is -z; the brook flows south (+z) at x = 12.
import { BROOK_BANK, brookEdge } from "./millpond-layout.js";
import { curve, lineDistance } from "./lines.js";

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// Smooth maximum: rounds the corner where two shapes meet.
const smax = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + (h * h * k) / 4;
};
const box = (x, z, w, d) => ({ x, z, w, d });

export const MARSH = {
  // The brook's level: the mere is the brook spread out, so they share it.
  surface: 0.108,
  // The lawn's top everywhere else, and the low bank's crest round the water.
  lawn: 0.05,
  rim: 0.16,
  // The mere's deepest water, shallower than the brook's 0.82 m.
  depth: 0.5,
  brookX: 12,
  // The mere: an oval with a wandering shore, the brook entering at its north.
  centre: { x: 13, z: 30 },
  radii: { x: 8.2, z: 4.8 },
  // Where the brook's channel stops: it has opened into the mere by here.
  mouth: 28,
  // Two low reed islands in the mere.
  islands: [
    { x: 15.9, z: 30.8, r: 1.25 },
    { x: 9.6, z: 28.6, r: 0.85 },
  ],
  // The footbridge over the seam between the village's brook and the marsh's.
  footbridge: { minX: 9.2, maxX: 14.8, minZ: 20.15, maxZ: 21.85 },
  // The boardwalk: planks on stilts from the west trail across the shallows
  // to the hide. Its ends ramp down to the ground over `ramp` metres.
  boardwalk: {
    points: [
      [3.8, 26.6],
      [6.4, 28],
      [7.8, 31.2],
      [10.4, 33.2],
      [11.4, 35.6],
    ],
    halfWidth: 0.62,
    deck: 0.34,
    ramp: 1.2,
  },
  // The bird hide on the south shore: its front, with the viewing slot, stands
  // in the water on stilts; its door is at the back.
  hide: { x: 13.5, z: 35, w: 2.8, d: 2.2, floor: 0.42 },
  // A bench by the east trail, looking west over the mere.
  bench: { x: 24.3, z: 30.6, turn: -Math.PI / 2 },
  // Weeping willows on the banks: trunk base, and the way each leans.
  willows: [
    { x: 3.2, z: 22.6, lean: 0.4, scale: 1 },
    { x: 21.6, z: 22.9, lean: -2.6, scale: 0.92 },
    { x: 25, z: 35.6, lean: 3.4, scale: 1.05 },
    { x: 4.2, z: 33.9, lean: -0.1, scale: 0.96 },
  ],
  // The heron wades the north-east shallows between these shore angles
  // (radians round the mere's centre, 0 east, + south), `depth` metres in.
  heron: { from: -1.25, to: -0.3, depth: 0.55 },
  // Wren keeps watch by the bench, looking out for the heron.
  residents: { wren: { x: 24.5, z: 28.3 } },
  trailHalfWidth: 0.55,
  // Ground the marsh's own mesh covers; the open country's grass is cut away
  // over it. Its north edge meets the village's grass, its others the fields'.
  ground: { minX: 0, maxX: 27, minZ: 20.8, maxZ: 40.6 },
  // The label: the brook's stretch and the mere, south of the village.
  area: { minX: 0, maxX: 27, minZ: 21 },
};

const M = MARSH;

// Earth trails: from the footbridge's west end to the boardwalk, and from its
// east end round the mere to the hide's door.
export const TRAILS = [
  curve([
    [9.1, 21],
    [7.4, 22.4],
    [5.4, 24.2],
    [3.8, 26.6],
  ]),
  curve([
    [14.9, 21],
    [17.4, 22.6],
    [20.6, 25.2],
    [22.9, 28.6],
    [23, 32.4],
    [20.8, 35.6],
    [17.6, 37],
    [14.8, 37.2],
  ]),
];

/** Whether (x, z) lies within the marsh's ground mesh. */
export const inMarshGround = (x, z) =>
  x >= M.ground.minX && x <= M.ground.maxX && z >= M.ground.minZ && z <= M.ground.maxZ;

/** Metres inside the mere's open water at (x, z), negative on dry ground. */
export function mereShore(x, z) {
  const dx = (x - M.centre.x) / M.radii.x,
    dz = (z - M.centre.z) / M.radii.z,
    rho = Math.hypot(dx, dz),
    gradient = Math.max(
      Math.hypot(dx / M.radii.x, dz / M.radii.z) / Math.max(rho, 1e-3),
      1 / Math.max(M.radii.x, M.radii.z),
    ),
    angle = Math.atan2(dz, dx),
    wobble =
      0.42 * Math.sin(angle * 3 + 0.6) +
      0.26 * Math.sin(angle * 5 + 1.9) +
      0.14 * Math.sin(angle * 8 + 0.3);
  return (1 - rho) / gradient + wobble;
}

/**
 * Metres inside the marsh's water at (x, z), negative on dry ground: the
 * brook's channel opening into the mere, with rounded corners where they
 * meet, less the islands.
 */
export function marshShore(x, z) {
  const channel = Math.min(brookEdge(z) - Math.abs(x - M.brookX), M.mouth - z);
  let s = smax(mereShore(x, z), channel, 1.4);
  for (const i of M.islands) {
    const angle = Math.atan2(z - i.z, x - i.x),
      edge = i.r + 0.12 * Math.sin(angle * 3 + i.x);
    s = Math.min(s, Math.hypot(x - i.x, z - i.z) - edge);
  }
  return s;
}

/** A point on the mere's shore at `angle` round its centre, `s` metres into the water. */
export function shorePoint(angle, s) {
  let x = M.centre.x + Math.cos(angle) * M.radii.x,
    z = M.centre.z + Math.sin(angle) * M.radii.z;
  // Walk along the shore's gradient to the wanted depth.
  for (let i = 0; i < 6; i++) {
    const e = 0.05,
      here = mereShore(x, z) - s,
      gx = (mereShore(x + e, z) - mereShore(x - e, z)) / (2 * e),
      gz = (mereShore(x, z + e) - mereShore(x, z - e)) / (2 * e),
      g2 = gx * gx + gz * gz || 1;
    x -= (here * gx) / g2;
    z -= (here * gz) / g2;
  }
  return [x, z];
}

// The bank: the ground crosses the water's surface 0.25 m inside the water's
// edge, so the bank hides that edge, then rises to a low crest and settles
// back to the lawn: a few centimetres, a wet meadow rather than a dyke.
const WATERLINE = 0.25;
function bankProfile(s) {
  if (s >= WATERLINE)
    return M.surface - M.depth * smooth(WATERLINE, 2.4, s) - 0.02 * smooth(WATERLINE, 0.6, s);
  if (s >= -0.7) return M.surface + (M.rim - M.surface) * smooth(WATERLINE, -0.7, s);
  return M.lawn + (M.rim - M.lawn) * (1 - smooth(-0.7, -3.4, s));
}

// The brook's stretch keeps the village brook's cross-section: its bed, then
// a 1.05 m bank (src/riverbank.js). Under the footbridge it stays just below
// the village's own bed and banks, which reach to z = 21.
function brookProfile(x, z) {
  const across = Math.abs(x - M.brookX),
    edge = brookEdge(z),
    seam = z < 21.05 ? -0.03 : 0;
  if (across < edge) {
    const shore = edge - across;
    return M.surface - 0.82 * Math.min(1, Math.max(0.025, shore / 0.72)) - 0.018 + seam;
  }
  const u = (across - edge) / BROOK_BANK;
  if (u >= 1) return M.lawn;
  const rise = Math.sin(Math.PI * Math.pow(u, 0.72));
  return 0.054 + 0.018 * (1 - u) + rise * 0.077 + seam;
}

/**
 * Height of the bare ground in the marsh: the brook's channel and banks below
 * the footbridge, easing into the mere's bed and low banks. Outside the
 * marsh's ground mesh this is the lawn.
 */
export function marshGround(x, z) {
  if (!inMarshGround(x, z)) return M.lawn;
  const mere = bankProfile(marshShore(x, z)),
    t = Math.max(smooth(22.4, 25.4, z), smooth(3.5, 5, Math.abs(x - M.brookX)));
  if (t >= 1) return mere;
  return brookProfile(x, z) * (1 - t) + mere * t;
}

/** The marsh's water surface at (x, z), else null. */
export function marshWater(x, z) {
  if (!inMarshGround(x, z) || z < 21) return null;
  return marshShore(x, z) > 0 ? M.surface : null;
}

/** Distance from (x, z) to the boardwalk's centre line, and how far along it. */
function boardwalkAt(x, z) {
  const { points } = M.boardwalk;
  let best = Infinity,
    along = 0,
    walked = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i],
      [bx, bz] = points[i + 1],
      ex = bx - ax,
      ez = bz - az,
      length = Math.hypot(ex, ez),
      t = Math.min(1, Math.max(0, ((x - ax) * ex + (z - az) * ez) / (length * length))),
      d = Math.hypot(x - ax - ex * t, z - az - ez * t);
    if (d < best) {
      best = d;
      along = walked + t * length;
    }
    walked += length;
  }
  return { distance: best, along, length: walked };
}

/** The boardwalk's walking height `along` metres from its west end. */
export function boardwalkDeck(along) {
  const { points, deck, ramp, length } = boardwalkPath;
  const start = marshGround(...points[0]) + 0.05,
    end = marshGround(...points.at(-1)) + 0.05;
  if (along < ramp) return start + (deck - start) * smooth(0, ramp, along);
  if (along > length - ramp) return end + (deck - end) * smooth(0, ramp, length - along);
  return deck;
}
const boardwalkPath = { ...M.boardwalk, length: boardwalkAt(...M.boardwalk.points[0]).length };

/** The footbridge's walking surface, humped over the water. */
export function footbridgeDeck(x) {
  const { minX, maxX } = M.footbridge;
  return 0.26 + Math.sin(((x - minX) / (maxX - minX)) * Math.PI) * 0.2;
}

/** Walking height on the footbridge or the boardwalk, else null. */
export function marshDeck(x, z) {
  const f = M.footbridge;
  if (x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ) return footbridgeDeck(x);
  // Everything of the boardwalk's lies in this box.
  if (x < 3 || x > 12.2 || z < 25.8 || z > 36.4) return null;
  const { distance, along } = boardwalkAt(x, z);
  return distance <= M.boardwalk.halfWidth ? boardwalkDeck(along) : null;
}

/** Distance from (x, z) to the nearest trail's centre line (Infinity when over `reach` away). */
export function trailDistance(x, z, reach) {
  let best = Infinity;
  for (const trail of TRAILS) best = Math.min(best, lineDistance(trail, x, z, reach));
  return best;
}

/** Where the bird hide's door is, and where a watcher stands to open it. */
export const hideDoor = () => ({ x: M.hide.x, z: M.hide.z + M.hide.d / 2 + 0.9 });

/**
 * Colliders for the marsh in the shapes collides() (src/game/navigation.js)
 * understands. The water's is a shape: it blocks a body of radius r whose
 * centre would stand within reach of the water, except on the boardwalk and
 * the footbridge. The village's brook stops at the footbridge's north rail.
 */
export function marshColliders() {
  const f = M.footbridge,
    h = M.hide,
    b = M.bench,
    margin = 0.1;
  return [
    {
      minX: M.ground.minX,
      maxX: M.ground.maxX,
      minZ: M.ground.minZ,
      maxZ: M.ground.maxZ,
      blocks(x, z, r) {
        if (x >= f.minX && x <= f.maxX && z > f.minZ && z < f.maxZ) return false;
        if (x > 3 && x < 12.2 && z > 25.8 && z < 36.4) {
          const { distance } = boardwalkAt(x, z);
          if (distance < M.boardwalk.halfWidth - r * 0.4) return false;
        }
        return marshShore(x, z) + r > margin;
      },
    },
    // The footbridge's rails.
    box(M.brookX, f.minZ + 0.06, f.maxX - f.minX, 0.18),
    box(M.brookX, f.maxZ - 0.06, f.maxX - f.minX, 0.18),
    // The hide and its steps, the bench and the willows' trunks.
    box(h.x, h.z + 0.25, h.w + 0.1, h.d + 0.6),
    box(b.x, b.z, 0.7, 1.9),
    ...M.willows.map((w) => ({ x: w.x, z: w.z, r: 0.38 * w.scale })),
  ];
}

// Every footing, for the grass mask; colliders never move.
let footings = null;

/** Where meadow grass may grow inside the marsh: dry ground off its trails and footings. */
export function marshGrass(x, z) {
  if (!inMarshGround(x, z)) return true;
  if (marshShore(x, z) > -0.6) return false;
  // The brook's channel and banks above the mere.
  if (z < 26 && Math.abs(x - M.brookX) < 3.3) return false;
  if (marshDeck(x, z) != null) return false;
  if (trailDistance(x, z, 1.5) < M.trailHalfWidth + 0.1) return false;
  const clear = (c, margin) =>
    c.r !== undefined
      ? Math.hypot(x - c.x, z - c.z) < c.r + margin
      : c.w !== undefined &&
        Math.abs(x - c.x) < c.w / 2 + margin &&
        Math.abs(z - c.z) < c.d / 2 + margin;
  for (const c of (footings ??= marshColliders().slice(1))) if (clear(c, 0.3)) return false;
  return true;
}

/** The willow marsh's entry in the region registry (src/regions/index.js). */
export const marshRegion = {
  id: "marsh",
  name: "The willow marsh",
  area: M.area,
  ground: M.ground,
  height: (x, z) => marshGround(x, z) - M.lawn,
  // The brook's bed dips below the field soil's upper layer.
  deepBed: true,
  deck: marshDeck,
  water: marshWater,
  colliders: marshColliders,
  grass: marshGrass,
  // Its builder also brings the marsh's resident, and the hide's birdwatching.
  stream: (T, world, game) =>
    import("./marsh.js").then(({ marshJobs }) => marshJobs(T, world, game)),
};
