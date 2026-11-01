// The orchard hill's shape: its ground, the path up it, where its fruit trees,
// beehives, windmill and bench stand. Pure data and functions, loaded with the
// village: the terrain, colliders, grass and region label need it before the
// hill's meshes stream in (src/regions/orchard.js builds those).
//
// The hill rises north-west of the village, the map's only real height: a
// rounded knoll about 3.6 m high whose slopes reach the lawn again before the
// village, the millpond's ground and the map's rim. North is -z.

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export const ORCHARD = {
  // The lawn's top everywhere around the hill.
  lawn: 0.05,
  summit: { x: -25, z: -32 },
  height: 3.6,
  // How far each slope reaches from the summit before meeting the lawn.
  reach: { west: 20, east: 22, north: 8.4, south: 11 },
  // Ground the hill's own mesh covers; the open country's grass is cut away
  // over it. Its south edge meets the village's grass.
  ground: { minX: -46, maxX: -2, minZ: -40.6, maxZ: -20.8 },
  // The windmill on the summit; its door faces the path, south-east.
  windmill: { x: -25.4, z: -32.6, radius: 1.85 },
  // The bench beside the path near the top, looking out over the village.
  bench: { x: -20, z: -29.4 },
  // The beehives on the sunny west slope.
  hives: [
    { id: "hive-1", x: -37.8, z: -31.5 },
    { id: "hive-2", x: -36.3, z: -32.2 },
    { id: "hive-3", x: -34.8, z: -31.7 },
  ],
  hiveSize: 0.62,
  pathHalfWidth: 0.62,
};

const O = ORCHARD;

/** Height of the hill above the lawn at (x, z): 0 off the hill. */
export function hillHeight(x, z) {
  const dx = x - O.summit.x,
    dz = z - O.summit.z,
    rx = dx < 0 ? O.reach.west : O.reach.east,
    rz = dz < 0 ? O.reach.north : O.reach.south,
    r2 = (dx / rx) ** 2 + (dz / rz) ** 2;
  if (r2 >= 1) return 0;
  // A rounded top and a foot that eases into the lawn, with a little swell
  // so the slope does not read as a perfect dome.
  const bump = (1 - r2) ** 2,
    swell = 1 + 0.07 * Math.sin(x * 0.29 + 1.2) * Math.sin(z * 0.41 - 0.7);
  return O.height * bump * swell;
}

/** Whether (x, z) lies within the hill's ground mesh. */
export const inOrchardGround = (x, z) =>
  x >= O.ground.minX && x <= O.ground.maxX && z >= O.ground.minZ && z <= O.ground.maxZ;

/** Height of the bare ground on the hill: the lawn level plus the hill. */
export const orchardGround = (x, z) => O.lawn + hillHeight(x, z);

// The path climbs from the village's north-west edge to the windmill's door,
// as a smooth curve through these points.
const PATH_POINTS = [
  [-7.6, -20.8],
  [-8.6, -22.6],
  [-11.4, -24.3],
  [-15.2, -25.4],
  [-18.4, -26.6],
  [-20.9, -27.9],
  [-22.6, -29.6],
  [-23.9, -31.1],
];
// Catmull-Rom through the points, sampled every few centimetres.
export const PATH = (() => {
  const points = [];
  for (let i = 0; i < PATH_POINTS.length - 1; i++) {
    const p0 = PATH_POINTS[Math.max(i - 1, 0)],
      p1 = PATH_POINTS[i],
      p2 = PATH_POINTS[i + 1],
      p3 = PATH_POINTS[Math.min(i + 2, PATH_POINTS.length - 1)];
    for (let s = 0; s < 12; s++) {
      const t = s / 12,
        t2 = t * t,
        t3 = t2 * t,
        at = (k) =>
          0.5 *
          (2 * p1[k] +
            (-p0[k] + p2[k]) * t +
            (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
            (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      points.push([at(0), at(1)]);
    }
  }
  points.push(PATH_POINTS.at(-1));
  return points;
})();

/** Distance from (x, z) to the path's centre line, in metres. */
export function pathDistance(x, z) {
  let best = Infinity;
  for (let i = 0; i < PATH.length - 1; i++) {
    const [ax, az] = PATH[i],
      [bx, bz] = PATH[i + 1],
      ex = bx - ax,
      ez = bz - az,
      t = Math.min(1, Math.max(0, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez))),
      d = (x - ax - ex * t) ** 2 + (z - az - ez * t) ** 2;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

// The fruit trees: apples in two rows across the south slope, west of the
// path, and pears on the east shoulder. [x, z, scale]
const APPLES = [
  [-40.4, -24.9, 0.94],
  [-36.2, -24.5, 1.02],
  [-31.9, -24.8, 0.97],
  [-27.6, -24.4, 1.05],
  [-23.4, -24.7, 0.92],
  [-19.1, -24.2, 0.98],
  [-38.4, -28.1, 1],
  [-34.1, -27.7, 0.95],
  [-29.8, -28.0, 1.04],
  [-25.6, -27.8, 0.99],
];
const PEARS = [
  [-15.6, -28.9, 1.02],
  [-11.6, -27.6, 0.96],
  [-7.6, -26.2, 1],
  [-17.4, -32.6, 0.98],
  [-13.4, -31.4, 1.04],
  [-9.4, -30.1, 0.94],
];
export const FRUIT_TREES = [
  ...APPLES.map(([x, z, scale], i) => ({ id: `apple-${i + 1}`, kind: "apple", x, z, scale })),
  ...PEARS.map(([x, z, scale], i) => ({ id: `pear-${i + 1}`, kind: "pear", x, z, scale })),
];

/**
 * Colliders for the hill's trees, hives, windmill and bench, in the shapes
 * main.js's blocked() understands.
 */
export function orchardColliders() {
  const { windmill: w, bench: b } = O;
  return [
    ...FRUIT_TREES.map((t) => ({ x: t.x, z: t.z, r: 0.2 * t.scale })),
    ...O.hives.map((h) => ({ x: h.x, z: h.z, w: O.hiveSize, d: O.hiveSize })),
    { x: w.x, z: w.z, r: w.radius + 0.05 },
    { x: b.x - 0.45, z: b.z + 0.3, r: 0.42 },
    { x: b.x + 0.45, z: b.z - 0.3, r: 0.42 },
  ];
}

/** Where meadow grass may grow on the hill: off its path and footings. */
export function orchardGrass(x, z) {
  if (!inOrchardGround(x, z)) return true;
  if (pathDistance(x, z) < O.pathHalfWidth + 0.08) return false;
  const { windmill: w, bench: b } = O;
  if (Math.hypot(x - w.x, z - w.z) < w.radius + 0.35) return false;
  if (Math.hypot(x - b.x, z - b.z) < 1.1) return false;
  for (const h of O.hives)
    if (Math.abs(x - h.x) < 0.5 && Math.abs(z - h.z) < 0.5) return false;
  for (const t of FRUIT_TREES) if (Math.hypot(x - t.x, z - t.z) < 0.28 * t.scale) return false;
  return true;
}

/** How far into the path's mown edge (x, z) lies: 1 on the path, 0 off it. */
export function pathWeight(x, z) {
  return 1 - smooth(O.pathHalfWidth - 0.18, O.pathHalfWidth + 0.22, pathDistance(x, z));
}

/** The orchard hill's entry in the region registry (src/regions/index.js). */
export const orchardRegion = {
  id: "orchard",
  name: "The orchard hill",
  // The hill north-west of the village, west of the millpond.
  area: { maxX: 0, maxZ: -21 },
  ground: O.ground,
  height: hillHeight,
  // The hill's slopes are smooth: terrainHeight evaluates them exactly, so
  // the trees, walkers and its ground mesh agree.
  exactHeight: true,
  colliders: orchardColliders,
  grass: orchardGrass,
  // Its builder also hands back the harvest controller.
  stream: (T, world) => import("./orchard.js").then(({ orchardJobs }) => orchardJobs(T, world)),
};
