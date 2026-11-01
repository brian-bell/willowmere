// The millpond's shape: where its water, banks, weir, footbridge and jetty lie.
// Pure data and functions, loaded with the village: the terrain, colliders,
// ground height and region label need it before the pond's meshes stream in
// (src/regions/millpond.js builds those).
//
// The brook used to end at the village's north edge (z = -21). It now runs on
// under a footbridge to a stone weir, and above the weir it widens into the
// pond. North is -z; the brook flows south (+z) at x = 12.

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// Smooth maximum: rounds the corner where two shapes meet.
const smax = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + (h * h * k) / 4;
};

export const MILLPOND = {
  // Water levels: the pond stands behind the weir, above the brook.
  surface: 0.42,
  brookSurface: 0.108,
  // The lawn's top everywhere else.
  lawn: 0.05,
  // The bank's crest around the pond, and its deepest water.
  rim: 0.5,
  depth: 0.85,
  centre: { x: 12.5, z: -31.2 },
  radii: { x: 8.4, z: 5 },
  brookX: 12,
  // The outlet channel between the pond and the weir.
  channelHalfWidth: 2.1,
  // The weir's sill runs across the brook between these lines; the pond's
  // water reaches the sill's middle and the cascade leaves its downstream face.
  weir: { upstream: -24.55, crest: -24.3, downstream: -24.05, top: 0.4 },
  // The brook between the weir and the village, its own water body.
  brook: { minZ: -24.1, maxZ: -21 },
  // The footbridge over the seam between that stretch and the village's brook.
  footbridge: { minX: 9.2, maxX: 14.8, minZ: -21.85, maxZ: -20.15 },
  // The jetty runs north from the south bank into the pond.
  jetty: { x: 7, halfWidth: 0.65, minZ: -30.6, maxZ: -26.2, deck: 0.62 },
  // The boathouse sits on the north bank, its open end over the water.
  boathouse: { x: 16.2, z: -35.9, width: 3.2, depth: 3.2 },
  // Ground the pond's own mesh covers; the open country's grass is cut away
  // over it. Its south edge meets the village's grass, its others the fields'.
  ground: { minX: 0, maxX: 26, minZ: -40.4, maxZ: -20.8 },
};

const M = MILLPOND;

/**
 * Metres inside the pond's water at (x, z), negative on dry ground. The
 * shoreline wanders a little; the outlet channel joins it with rounded corners
 * and ends at the weir's crest.
 */
export function pondShore(x, z) {
  const dx = (x - M.centre.x) / M.radii.x,
    dz = (z - M.centre.z) / M.radii.z,
    rho = Math.hypot(dx, dz),
    // First-order distance to the ellipse, good near its edge.
    gradient = Math.max(
      Math.hypot(dx / M.radii.x, dz / M.radii.z) / Math.max(rho, 1e-3),
      1 / Math.max(M.radii.x, M.radii.z),
    ),
    angle = Math.atan2(dz, dx),
    wobble =
      0.38 * Math.sin(angle * 3 + 1.1) +
      0.22 * Math.sin(angle * 5 + 2.3) +
      0.12 * Math.sin(angle * 9 + 0.4),
    pond = (1 - rho) / gradient + wobble,
    channel = Math.min(
      M.channelHalfWidth - Math.abs(x - M.brookX) + 0.04 * Math.sin(z * 1.9),
      M.weir.crest - z,
      z + 29.5,
    );
  return smax(pond, channel, 1.4);
}

/** Whether (x, z) lies within the pond's ground mesh. */
export const inMillpondGround = (x, z) =>
  x >= M.ground.minX && x <= M.ground.maxX && z >= M.ground.minZ && z <= M.ground.maxZ;

// The brook below the weir keeps the village brook's cross-section: the
// water's edge at 2.1 m from its middle, then a 1.05 m bank (src/riverbank.js).
export const brookEdge = (z) =>
    2.1 + 0.045 * Math.sin(z * 1.7) + 0.025 * Math.sin(z * 4.1 + 0.7),
  BROOK_BANK = 1.05;

// The pond's bank: the ground crosses the water's surface 0.25 m inside the
// water's edge, so the bank always hides that edge, then rises to the crest
// and falls back to the lawn over a few metres.
const WATERLINE = 0.25;
function pondProfile(s) {
  if (s >= WATERLINE)
    return M.surface - M.depth * smooth(WATERLINE, 2.4, s) - 0.02 * smooth(WATERLINE, 0.6, s);
  if (s >= -0.7) return M.surface + (M.rim - M.surface) * smooth(WATERLINE, -0.7, s);
  return M.lawn + (M.rim - M.lawn) * (1 - smooth(-0.7, -3.4, s));
}

/**
 * Height of the bare ground around the pond: the bank, the pond's bed, and
 * the brook's channel and bed below the weir. Outside the pond's ground mesh
 * this is the lawn.
 */
export function millpondGround(x, z) {
  if (!inMillpondGround(x, z)) return M.lawn;
  const bank = pondProfile(pondShore(x, z));
  if (z < M.weir.downstream) return bank;
  // Below the weir the brook's channel cuts through the bank.
  const across = Math.abs(x - M.brookX),
    edge = brookEdge(z);
  if (across < edge) {
    const shore = edge - across;
    return M.brookSurface - 0.82 * Math.min(1, Math.max(0.025, shore / 0.72)) - 0.018;
  }
  const u = (across - edge) / BROOK_BANK;
  if (u >= 1) return bank;
  const rise = Math.sin(Math.PI * Math.pow(u, 0.72));
  // Under the footbridge the village's own banks take over; stay just below
  // them there.
  const seam = z > -21.05 ? -0.03 : 0;
  return (
    0.054 + 0.018 * (1 - u) + rise * 0.077 + (bank - M.lawn) * smooth(0, 1, u) + seam
  );
}

/** The water's surface height at (x, z) in the pond or its brook, else null. */
export function millpondWater(x, z) {
  if (!inMillpondGround(x, z)) return null;
  if (z < M.weir.crest) return pondShore(x, z) > 0 ? M.surface : null;
  return Math.abs(x - M.brookX) < brookEdge(z) ? M.brookSurface : null;
}

/** Deck height where the footbridge or the jetty carries the player, else null. */
export function millpondDeck(x, z) {
  const { footbridge: f, jetty: j } = M;
  if (x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ)
    return footbridgeDeck(x);
  if (Math.abs(x - j.x) <= j.halfWidth && z >= j.minZ && z <= j.maxZ) return j.deck;
  return null;
}

/** The footbridge's walking surface, humped over the water. */
export function footbridgeDeck(x) {
  const { minX, maxX } = M.footbridge;
  return 0.26 + Math.sin(((x - minX) / (maxX - minX)) * Math.PI) * 0.2;
}

/**
 * Colliders for the pond and its brook, in the shapes main.js's blocked()
 * understands. The pond's is a shape: it blocks a body of radius r whose
 * centre would stand in the water, except on the jetty's deck.
 */
export function millpondColliders() {
  const { jetty: j, footbridge: f, weir: w, boathouse: h } = M,
    margin = 0.4;
  return [
    {
      minX: M.ground.minX,
      maxX: M.ground.maxX,
      minZ: M.ground.minZ,
      maxZ: M.ground.maxZ,
      blocks(x, z, r) {
        if (
          Math.abs(x - j.x) < j.halfWidth - r * 0.4 &&
          z > j.minZ + r * 0.4 &&
          z < j.maxZ
        )
          return false;
        return pondShore(x, z) + r > margin;
      },
    },
    // The weir's sill and the brook between it and the footbridge's rail.
    { x: M.brookX, z: w.crest, w: 4.9, d: w.downstream - w.upstream + 0.2 },
    {
      x: M.brookX,
      z: (w.downstream + f.minZ) / 2,
      w: 4.3,
      d: f.minZ - w.downstream,
    },
    // The footbridge's rails.
    { x: M.brookX, z: f.minZ + 0.06, w: f.maxX - f.minX, d: 0.18 },
    { x: M.brookX, z: f.maxZ - 0.06, w: f.maxX - f.minX, d: 0.18 },
    // The boathouse.
    { x: h.x, z: h.z, w: h.width + 0.1, d: h.depth + 0.1 },
  ];
}

/** Where meadow grass may grow inside the pond's ground: dry, level-ish lawn. */
export function millpondGrass(x, z) {
  if (!inMillpondGround(x, z)) return true;
  if (pondShore(x, z) > -0.6) return false;
  // The brook's channel and banks below the weir.
  if (z > M.weir.upstream - 0.4 && Math.abs(x - M.brookX) < 3.3) return false;
  const { jetty: j, boathouse: h } = M;
  if (Math.abs(x - j.x) < j.halfWidth + 0.2 && z > j.minZ && z < j.maxZ + 0.3) return false;
  if (Math.abs(x - h.x) < h.width / 2 + 0.4 && Math.abs(z - h.z) < h.depth / 2 + 0.4)
    return false;
  return true;
}
