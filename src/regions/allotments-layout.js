// @ts-check
// The allotments' shape: the fenced plots south of the kitchen garden, their
// paths and gates, the four plots the player can rent and the four the
// neighbours keep, the shed, the cold frames, the compost bays, the water
// butt, the scarecrow and where Basil, the allotment keeper, stands. Pure
// data and functions, loaded with the village: the colliders, grass and
// region label need it before the allotments' meshes stream in
// (src/regions/allotments.js builds those).
//
// The allotments fill the map south of the village's west half, between the
// willow marsh to the east and the open south-west fields. They are flat, on
// the open country's own grass. North is -z.

export const ALLOTMENTS = {
  // The label: south of the village, west of the marsh.
  area: { minX: -24, maxX: 0, minZ: 21 },
  // The post-and-rail fence round the plots, with a gate in its north side
  // where the path comes down from the kitchen garden, and gates east and
  // west where the cross path meets it.
  fence: { minX: -22.6, maxX: -1.4, minZ: 21.8, maxZ: 37.4 },
  gateHalfWidth: 0.85,
  // The paths: one south from the village's garden road through the north
  // gate to the shed, and one across, out through the west and east gates.
  path: { x: -12, fromZ: 15.4, toZ: 35.1, halfWidth: 0.65 },
  crossPath: { z: 28.6, fromX: -23.5, toX: -0.5, halfWidth: 0.55 },
  // The beds, each a raised timber frame: its centre and size. The four on
  // the east side are to let; the neighbours keep the four on the west side.
  plots: [
    { id: "carrots", crop: "carrot", x: -8.6, z: 25.1, w: 3.6, d: 5 },
    { id: "lettuces", crop: "lettuce", x: -4.4, z: 25.1, w: 3.6, d: 5 },
    { id: "beans", crop: "bean", x: -8.6, z: 32.2, w: 3.6, d: 4.4 },
    { id: "pumpkins", crop: "pumpkin", x: -4.4, z: 32.2, w: 3.6, d: 4.4 },
  ],
  neighbours: [
    { id: "cabbages", x: -19.6, z: 25.1, w: 3.6, d: 5 },
    { id: "sunflowers", x: -15.4, z: 25.1, w: 3.6, d: 5 },
    { id: "potatoes", x: -19.6, z: 32.2, w: 3.6, d: 4.4 },
    { id: "rhubarb", x: -15.4, z: 32.2, w: 3.6, d: 4.4 },
  ],
  // How high a bed's frame stands, and the soil in it.
  frame: 0.22,
  soil: 0.17,
  // The potting shed at the path's south end, its door facing north up the
  // path; the water butt by its east wall.
  shed: { x: -12, z: 36.25, w: 3.2, d: 2, h: 2.1 },
  butt: { x: -9.8, z: 36.4, r: 0.38 },
  // Cold frames along the south fence, compost bays in the south-east corner.
  coldFrames: { x: -19.4, z: 36.2, w: 3.6, d: 1, count: 3 },
  compost: { x: -4.6, z: 36.3, w: 3.6, d: 1.4, count: 3 },
  // The scarecrow minds the potatoes; a noticeboard stands inside the north
  // gate; a wheelbarrow rests by the cross path.
  scarecrow: { x: -19.6, z: 32.2 },
  noticeboard: { x: -13.25, z: 22.3 },
  barrow: { x: -14.2, z: 29.75, turn: 0.3 },
  // Basil keeps the allotments, by the shed.
  residents: { basil: { x: -10.9, z: 33.5 } },
};

const A = ALLOTMENTS;

/** Whether (x, z) lies within the allotments' fence. */
export const insideFence = (x, z) =>
  x >= A.fence.minX && x <= A.fence.maxX && z >= A.fence.minZ && z <= A.fence.maxZ;

/** The rentable plot with this id. */
export const plotById = (id) => A.plots.find((plot) => plot.id === id);

/**
 * Where the player stands to tend a plot: on the cross path, at the middle of
 * the bed's side that faces it.
 * @param {{ x: number, z: number, d: number }} plot
 */
export function plotFront(plot) {
  const north = plot.z < A.crossPath.z;
  return { x: plot.x, z: north ? plot.z + plot.d / 2 + 0.45 : plot.z - plot.d / 2 - 0.45 };
}

const within = (b, x, z, margin = 0) =>
  Math.abs(x - b.x) < b.w / 2 + margin && Math.abs(z - b.z) < b.d / 2 + margin;

/** Distance from (x, z) to the nearest path's centre line. */
export function pathDistance(x, z) {
  const p = A.path,
    c = A.crossPath,
    down = Math.hypot(x - p.x, Math.max(p.fromZ - z, 0, z - p.toZ)),
    across = Math.hypot(Math.max(c.fromX - x, 0, x - c.toX), z - c.z);
  return Math.min(down - p.halfWidth, across - c.halfWidth);
}

// The fence's runs, as [x1, z1, x2, z2], leaving the three gates open.
export const FENCE_RUNS = (() => {
  const f = A.fence,
    g = A.gateHalfWidth,
    p = A.path.x,
    c = A.crossPath.z;
  return [
    [f.minX, f.minZ, p - g, f.minZ],
    [p + g, f.minZ, f.maxX, f.minZ],
    [f.minX, f.maxZ, f.maxX, f.maxZ],
    [f.minX, f.minZ, f.minX, c - g],
    [f.minX, c + g, f.minX, f.maxZ],
    [f.maxX, f.minZ, f.maxX, c - g],
    [f.maxX, c + g, f.maxX, f.maxZ],
  ];
})();

// Small footings that stand on their own: [x, z, r].
const FOOTINGS = [
  [A.butt.x, A.butt.z, A.butt.r],
  [A.noticeboard.x, A.noticeboard.z, 0.3],
  [A.barrow.x, A.barrow.z, 0.55],
];

/**
 * Colliders for the beds, the fence, the shed, the cold frames, the compost
 * bays and the small footings, in the shapes collides() (src/game/navigation.js)
 * understands. The scarecrow stands in its bed.
 */
export function allotmentColliders() {
  const rect = (b) => ({ x: b.x, z: b.z, w: b.w, d: b.d });
  return [
    ...[...A.plots, ...A.neighbours].map(rect),
    ...FENCE_RUNS.map(([x1, z1, x2, z2]) => ({
      x: (x1 + x2) / 2,
      z: (z1 + z2) / 2,
      w: Math.max(0.12, Math.abs(x2 - x1)),
      d: Math.max(0.12, Math.abs(z2 - z1)),
    })),
    rect(A.shed),
    rect(A.coldFrames),
    rect(A.compost),
    ...FOOTINGS.map(([x, z, r]) => ({ x, z, r })),
  ];
}

/** Whether (x, z) lies under a bed, the shed, the cold frames or the compost bays, `margin` out. */
function onFooting(x, z, margin) {
  if ([...A.plots, ...A.neighbours, A.shed, A.coldFrames, A.compost].some((b) => within(b, x, z, margin)))
    return true;
  return FOOTINGS.some(([fx, fz, r]) => Math.hypot(x - fx, z - fz) < r + margin);
}

// The region's own box, a little beyond the fence: grass and planting rules
// apply only inside it.
const near = (x, z) => x > A.fence.minX - 1 && x < A.fence.maxX + 1 && z > A.path.fromZ - 1 && z < A.fence.maxZ + 1;

/** Where meadow grass may grow at the allotments: off the beds, paths and footings. */
export function allotmentGrass(x, z) {
  if (!near(x, z)) return true;
  if (pathDistance(x, z) < 0.1) return false;
  return !onFooting(x, z, 0.12);
}

/** Where flowers may be planted at the allotments: off the beds, paths and footings, with room to spare. */
export function allotmentPlanting(x, z) {
  if (!near(x, z)) return true;
  if (pathDistance(x, z) < 0.25) return false;
  return !onFooting(x, z, 0.35);
}

/** The allotments' entry in the region registry (src/regions/index.js). */
export const allotmentsRegion = {
  id: "allotments",
  name: "The allotments",
  area: A.area,
  colliders: allotmentColliders,
  grass: allotmentGrass,
  planting: allotmentPlanting,
  // Its builder also brings Basil, and the beds' crops.
  stream: (T, world, game) =>
    import("./allotments.js").then(({ allotmentJobs }) => allotmentJobs(T, world, game)),
};
