// @ts-check
// Thistledown on paper: every wall, door, window and big piece of furniture,
// free of three.js. The builders read their geometry from here and the walker
// reads its colliders from the same lists, so the two cannot drift apart.
//
// One unit is a metre and the eye stands 1.62 up, as in The Drowsy Heron. The
// lane is +z, the back garden -z. The ridge runs front to back, so upstairs the
// ceilings slope down toward ±x and the two gables hold the windows.
//
//   Ground floor                        Under the eaves
//   ┌ back door ──────────────┐         ┌─────────┬ window ┬───────┐
//   │ kitchen │ back │private │         │ Linnet  │ landing│ bath  │
//   │  range  │ hall │ rooms  │         │ (twin)  │   ↑    ├───────┤
//   │         ├──────┼────────┤         │         │ stair  │ alcove│
//   │         │ pass │▒stair▒ │ sitting ├─────────┤  well  │  fire │
//   ├─hatch───┤ age  │▒flight▒│  fire   │ airing  │        │       │
//   │breakfast│      │        │ room    ├─────────┴door────┘       │
//   │ room    ◄ hall ►        │         │   Goldfinch (double)     │
//   └─ window ┴ door ┴ window ┘         └───── gable window ───────┘

/**
 * @typedef {{ from: number, to: number, bottom?: number, top: number, door?: boolean, shut?: boolean,
 *   hinge?: "from" | "to", swing?: -1 | 1, open?: number, inside?: -1 | 1, kind?: string, id?: string }} Opening
 *   A gap along a wall. A door with `shut` still blocks the walker; `swing` is
 *   the side an open leaf folds back to, `open` how far it turns (radians), and
 *   `inside` the side a window faces.
 * @typedef {{ id: string, axis: "x" | "z", at: number, thick: number, from: number, to: number,
 *   faces: [string | null, string | null], openings?: Opening[], height?: number }} Wall
 *   A wall along `axis`, centred on `at`. `faces` names the finish toward each
 *   way along the other axis: [toward minus, toward plus].
 * @typedef {{ x: number, z: number, w: number, d: number, rotation?: number } | { x: number, z: number, r: number }} Collider
 */

export const INN = {
  name: "Thistledown",
  halfW: 5.5,
  front: 4.8,
  back: -4.8,
  hall: 1.5,
  partition: 0.2,
  sittingBack: -2,
  ceiling: 2.55,
  loft: 2.8,
  eye: 1.62,
  outer: 0.3,
  inner: 0.14,
  // Upstairs: walls stop at the knee walls, the slope climbs to a flat ceiling.
  knee: { x: 4.7, y: 1.75 },
  slopeX: 3.8,
  upperCeiling: 2.45,
  upperFront: 1.35,
  linnetFront: -0.7,
  stair: { minX: 0.45, maxX: 1.5, bottomZ: 1.28, topZ: -2.4, risers: 13 },
};

const { halfW, front, back, hall, partition, sittingBack, outer, inner, knee, upperFront, linnetFront, stair } = INN;
const eaves = halfW + outer;
const DOOR = 2.05;
const out = front + outer / 2,
  rear = back - outer / 2;

/** The ground floor's walls. Faces name finishes in src/thistledown/shell.js. */
/** @type {Wall[]} */
export const GROUND_WALLS = [
  {
    id: "front-breakfast", axis: "x", at: out, thick: outer, from: -eaves, to: -hall, faces: ["breakfast", "render"],
    openings: [{ id: "breakfast-front", from: -4.25, to: -2.75, bottom: 0.82, top: 2.08, inside: -1 }],
  },
  {
    id: "front-hall", axis: "x", at: out, thick: outer, from: -hall, to: hall, faces: ["hall", "render"],
    openings: [{ id: "front-door", from: -0.52, to: 0.52, top: 2.4, door: true, shut: true, kind: "front" }],
  },
  {
    id: "front-sitting", axis: "x", at: out, thick: outer, from: hall, to: eaves, faces: ["sitting", "render"],
    openings: [{ id: "sitting-front", from: 2.75, to: 4.25, bottom: 0.82, top: 2.08, inside: -1 }],
  },
  {
    id: "back-kitchen", axis: "x", at: rear, thick: outer, from: -eaves, to: -hall, faces: ["render", "kitchenLow"],
    openings: [{ id: "kitchen-back", from: -4.2, to: -2.9, bottom: 1.08, top: 2.0, inside: 1 }],
  },
  {
    id: "back-hall", axis: "x", at: rear, thick: outer, from: -hall, to: hall, faces: ["render", "hall"],
    openings: [{ id: "back-door", from: -0.46, to: 0.46, top: DOOR, door: true, shut: true, kind: "back" }],
  },
  {
    id: "west-breakfast", axis: "z", at: -halfW - outer / 2, thick: outer, from: partition, to: out, faces: ["render", "breakfast"],
    openings: [{ id: "breakfast-west", from: 1.75, to: 3.15, bottom: 0.82, top: 2.08, inside: 1 }],
  },
  {
    id: "west-kitchen", axis: "z", at: -halfW - outer / 2, thick: outer, from: rear, to: partition, faces: ["render", "kitchen"],
    openings: [{ id: "kitchen-west", from: -3.3, to: -2.2, bottom: 1.0, top: 2.0, inside: 1 }],
  },
  {
    id: "east-sitting", axis: "z", at: halfW + outer / 2, thick: outer, from: sittingBack, to: out, faces: ["sitting", "render"],
    openings: [{ id: "sitting-east", from: 0.5, to: 1.9, bottom: 0.82, top: 2.08, inside: -1 }],
  },
  {
    id: "hall-west-front", axis: "z", at: -hall, thick: inner, from: partition, to: front, faces: ["breakfast", "hall"],
    openings: [{ id: "to-breakfast", from: 2.6, to: 3.5, top: DOOR, door: true, hinge: "from", swing: -1 }],
  },
  {
    id: "hall-west-back", axis: "z", at: -hall, thick: inner, from: back, to: partition, faces: ["kitchen", "hall"],
    openings: [{ id: "to-kitchen", from: -3.9, to: -3, top: DOOR, door: true, hinge: "from", swing: -1 }],
  },
  {
    id: "hall-east-front", axis: "z", at: hall, thick: inner, from: sittingBack, to: front, faces: ["hall", "sitting"],
    openings: [{ id: "to-sitting", from: 2.6, to: 3.5, top: DOOR, door: true, hinge: "from", swing: 1 }],
  },
  {
    id: "hall-east-back", axis: "z", at: hall, thick: inner, from: back, to: sittingBack, faces: ["hall", null],
    openings: [{ id: "private", from: -3.9, to: -3, top: DOOR, door: true, shut: true, kind: "private" }],
  },
  {
    id: "kitchen-breakfast", axis: "x", at: partition, thick: inner, from: -halfW, to: -hall, faces: ["kitchenLow", "breakfast"],
    openings: [
      { id: "hatch", from: -4.1, to: -3, bottom: 0.96, top: 1.66, kind: "hatch" },
      { id: "swing-door", from: -2.45, to: -1.65, top: DOOR, door: true, hinge: "to", swing: -1, open: 1.6 },
    ],
  },
  { id: "sitting-back", axis: "x", at: sittingBack, thick: inner, from: hall, to: halfW, faces: [null, "sitting"] },
  { id: "under-stair", axis: "x", at: stair.topZ, thick: 0.1, from: stair.minX - 0.06, to: stair.maxX, faces: ["hall", null], height: INN.ceiling },
];

/** The upper floor's walls, measured up from its boards. */
/** @type {Wall[]} */
export const UPPER_WALLS = [
  {
    id: "gable-front", axis: "x", at: out, thick: outer, from: -knee.x, to: knee.x, faces: ["goldfinch", "render"],
    openings: [{ id: "goldfinch-gable", from: -0.8, to: 0.8, bottom: 0.72, top: 2.02, inside: -1 }],
  },
  {
    id: "gable-linnet", axis: "x", at: rear, thick: outer, from: -knee.x, to: -hall, faces: ["render", "linnet"],
    openings: [{ id: "linnet-gable", from: -3.65, to: -2.55, bottom: 0.85, top: 1.95, inside: 1 }],
  },
  {
    id: "gable-landing", axis: "x", at: rear, thick: outer, from: -hall, to: hall, faces: ["render", "landing"],
    openings: [{ id: "landing-gable", from: -0.62, to: 0.62, bottom: 0.72, top: 1.98, inside: 1 }],
  },
  {
    id: "gable-bath", axis: "x", at: rear, thick: outer, from: hall, to: knee.x, faces: ["render", "bathLow"],
    openings: [{ id: "bath-gable", from: 2.62, to: 3.32, bottom: 1.15, top: 1.9, inside: 1, kind: "frosted" }],
  },
  { id: "knee-linnet", axis: "z", at: -knee.x - inner / 2, thick: inner, from: back, to: linnetFront, faces: [null, "linnet"] },
  { id: "knee-goldfinch-west", axis: "z", at: -knee.x - inner / 2, thick: inner, from: upperFront, to: front, faces: [null, "goldfinch"] },
  { id: "knee-bath", axis: "z", at: knee.x + inner / 2, thick: inner, from: back, to: sittingBack, faces: ["bathLow", null] },
  { id: "knee-goldfinch-east", axis: "z", at: knee.x + inner / 2, thick: inner, from: sittingBack, to: front, faces: ["goldfinch", null] },
  {
    id: "goldfinch-landing", axis: "x", at: upperFront, thick: inner, from: -knee.x, to: hall, faces: ["landing", "goldfinch"],
    openings: [{ id: "to-goldfinch", from: -1.25, to: -0.35, top: DOOR, door: true, hinge: "to", swing: 1, kind: "goldfinch", open: 2.5 }],
  },
  {
    id: "linnet-landing", axis: "z", at: -hall, thick: inner, from: back, to: linnetFront, faces: ["linnet", "landing"],
    openings: [{ id: "to-linnet", from: -3.9, to: -3, top: DOOR, door: true, hinge: "from", swing: -1, kind: "linnet" }],
  },
  {
    id: "airing-landing", axis: "z", at: -hall, thick: inner, from: linnetFront, to: upperFront, faces: [null, "landing"],
    openings: [{ id: "airing", from: -0.3, to: 0.6, top: DOOR, kind: "airing" }],
  },
  { id: "linnet-front", axis: "x", at: linnetFront, thick: inner, from: -knee.x, to: -hall, faces: ["linnet", null] },
  {
    id: "bath-landing", axis: "z", at: hall, thick: inner, from: back, to: sittingBack, faces: ["landing", "bath"],
    openings: [{ id: "to-bath", from: -3.9, to: -3, top: DOOR, door: true, hinge: "from", swing: 1, kind: "bath" }],
  },
  { id: "goldfinch-well", axis: "z", at: hall, thick: inner, from: sittingBack, to: upperFront, faces: ["well", "goldfinch"] },
  { id: "bath-alcove", axis: "x", at: sittingBack, thick: inner, from: hall, to: knee.x, faces: ["bath", "goldfinch"] },
];

// Where the big pieces of furniture stand: x and z are the centre, w along x
// and d along z. A small thing on one of them lives in that room's builder.
export const GROUND = {
  // The hall.
  desk: { x: -1.14, z: 1.05, w: 0.58, d: 1.45 },
  clock: { x: -1.24, z: -1.15, w: 0.38, d: 0.46 },
  bench: { x: -1.2, z: 4.12, w: 0.44, d: 1.05 },
  console: { x: 1.27, z: 4.02, w: 0.32, d: 0.66 },
  umbrellas: { x: 1.26, z: 4.56, r: 0.13 },
  bootRack: { x: -1.25, z: -4.35, w: 0.36, d: 0.72 },
  fern: { x: 1.2, z: -4.45, r: 0.2 },
  // The breakfast room.
  tableWindow: { x: -3.5, z: 3.92, w: 0.82, d: 0.82 },
  tableSide: { x: -4.78, z: 2.45, w: 0.82, d: 0.82 },
  tableRound: { x: -3.0, z: 1.62, r: 0.5 },
  sideboard: { x: -4.82, z: 0.53, w: 1.25, d: 0.52 },
  dresser: { x: -1.82, z: 4.15, w: 0.5, d: 1.2 },
  canary: { x: -5.15, z: 4.42, r: 0.19 },
  // The kitchen.
  range: { x: -5.1, z: -0.7, w: 0.8, d: 1.25 },
  sink: { x: -3.55, z: -4.5, w: 1.7, d: 0.6 },
  worktop: { x: -3.58, z: -0.17, w: 1.62, d: 0.6 },
  kitchenTable: { x: -3.55, z: -2.3, w: 0.85, d: 1.5 },
  jamShelves: { x: -1.8, z: -1.35, w: 0.46, d: 1.55 },
  larder: { x: -5.2, z: -4.42, w: 0.6, d: 0.76 },
  // The sitting room.
  breast: { x: 3.5, z: -1.64, w: 2, d: 0.58 },
  fender: { x: 3.5, z: -1.14, w: 1.5, d: 0.36 },
  shelvesWest: { x: 2.02, z: -1.74, w: 0.9, d: 0.38 },
  shelvesEast: { x: 5, z: -1.74, w: 0.98, d: 0.38 },
  chairWest: { x: 2.3, z: -0.2, r: 0.44 },
  chairEast: { x: 4.72, z: -0.2, r: 0.44 },
  sofa: { x: 3.42, z: 1.45, w: 1.9, d: 0.84 },
  piano: { x: 1.83, z: 0.72, w: 0.54, d: 1.45 },
  stool: { x: 2.36, z: 0.72, r: 0.18 },
  lowTable: { x: 3.3, z: 0.22, w: 0.72, d: 0.42 },
  jigsaw: { x: 3.5, z: 3.8, r: 0.52 },
  windowSeat: { x: 5.28, z: 1.2, w: 0.44, d: 1.4 },
  lamp: { x: 5.2, z: 2.25, r: 0.15 },
  bookcase: { x: 5.33, z: 3.6, w: 0.34, d: 1.8 },
  thimble: { x: 3.2, z: -0.45, r: 0.16 },
};

export const UPPER = {
  // The landing.
  landingSeat: { x: 0, z: -4.54, w: 1.46, d: 0.52 },
  landingTable: { x: -1.26, z: -1.72, w: 0.34, d: 0.8 },
  // Goldfinch, the double at the front.
  goldfinchBed: { x: -2.95, z: 2.45, w: 1.6, d: 2.06 },
  bedsideWest: { x: -4.06, z: 1.68, w: 0.48, d: 0.46 },
  bedsideEast: { x: -1.84, z: 1.68, w: 0.48, d: 0.46 },
  blanketBox: { x: -2.95, z: 3.74, w: 1.1, d: 0.42 },
  washstand: { x: -2.95, z: 4.52, w: 1.05, d: 0.5 },
  writingDesk: { x: 0, z: 4.5, w: 1.2, d: 0.56 },
  deskChair: { x: 0, z: 3.92, r: 0.2 },
  wardrobe: { x: 3.05, z: 4.46, w: 1.25, d: 0.62 },
  teaChest: { x: 0.92, z: 1.66, w: 1.02, d: 0.48 },
  upperBreast: { x: 3.5, z: -1.66, w: 1.7, d: 0.52 },
  fireside: { x: 2.35, z: -0.55, r: 0.42 },
  // Linnet, the twin at the back.
  linnetBedWest: { x: -3.78, z: -1.86, w: 0.98, d: 2.06 },
  linnetBedEast: { x: -2.3, z: -1.86, w: 0.98, d: 2.06 },
  linnetBedside: { x: -3.04, z: -1.06, w: 0.42, d: 0.46 },
  linnetChest: { x: -3.1, z: -4.54, w: 1.15, d: 0.5 },
  luggage: { x: -4.3, z: -3.5, w: 0.52, d: 0.82 },
  linnetChair: { x: -2.0, z: -4.32, r: 0.2 },
  // The bathroom.
  tub: { x: 3.42, z: -2.48, w: 1.78, d: 0.82 },
  basin: { x: 2.2, z: -4.56, w: 0.62, d: 0.46 },
  wc: { x: 3.82, z: -4.44, w: 0.5, d: 0.72 },
  hamper: { x: 4.32, z: -3.42, r: 0.22 },
};

// The walker keeps out of a room's soft furnishings at this reach: a chair's
// seat, the corner of a table.
const CHAIR = 0.2;

/** Where the breakfast chairs stand: table centres with a chair either side. */
export const BREAKFAST_CHAIRS = [
  { x: GROUND.tableWindow.x - 0.64, z: GROUND.tableWindow.z, r: CHAIR, faces: Math.PI / 2 },
  { x: GROUND.tableWindow.x + 0.64, z: GROUND.tableWindow.z, r: CHAIR, faces: -Math.PI / 2 },
  { x: GROUND.tableSide.x, z: GROUND.tableSide.z - 0.64, r: CHAIR, faces: 0 },
  { x: GROUND.tableSide.x, z: GROUND.tableSide.z + 0.64, r: CHAIR, faces: Math.PI },
  ...[0.25, 0.75, 1.25, 1.75].map((turn) => ({
    x: GROUND.tableRound.x + Math.cos(turn * Math.PI) * 0.82,
    z: GROUND.tableRound.z - Math.sin(turn * Math.PI) * 0.82,
    r: CHAIR,
    faces: turn * Math.PI + Math.PI / 2 + Math.PI,
  })),
];

/** The chair at the end of the scrubbed table. */
export const KITCHEN_CHAIRS = [
  { x: GROUND.kitchenTable.x, z: GROUND.kitchenTable.z + 0.98, r: CHAIR, faces: Math.PI },
];

/** The two seats at the sitting room's jigsaw table. */
export const JIGSAW_CHAIRS = [
  { x: GROUND.jigsaw.x - 0.8, z: GROUND.jigsaw.z - 0.06, r: CHAIR, faces: Math.PI / 2 },
  { x: GROUND.jigsaw.x + 0.8, z: GROUND.jigsaw.z - 0.06, r: CHAIR, faces: -Math.PI / 2 },
];

/**
 * The stair's rise at a point on its flight, or null off the flight.
 * @param {number} x
 * @param {number} z
 */
export function stairHeight(x, z) {
  if (x < stair.minX || x > stair.maxX) return null;
  if (z > stair.bottomZ || z < stair.topZ) return null;
  return ((stair.bottomZ - z) / (stair.bottomZ - stair.topZ)) * INN.loft;
}

/**
 * Which floor a walker on `level` is on after standing at (x, z): the flight is
 * the only way between them, and its halfway point decides.
 * @param {"ground" | "upper"} level
 * @param {number} x
 * @param {number} z
 * @returns {"ground" | "upper"}
 */
export function levelAt(level, x, z) {
  const rise = stairHeight(x, z);
  if (rise === null) return level;
  return rise > INN.loft / 2 ? "upper" : "ground";
}

/**
 * The floor under a walker on `level` at (x, z).
 * @param {"ground" | "upper"} level
 * @param {number} x
 * @param {number} z
 */
export function floorHeight(level, x, z) {
  return stairHeight(x, z) ?? (level === "upper" ? INN.loft : 0);
}

/**
 * The room a point stands in. E answers only within the visitor's own, so
 * nothing is reached through a wall or a ceiling.
 * @param {"ground" | "upper"} level
 * @param {number} x
 * @param {number} z
 */
export function zoneAt(level, x, z) {
  if (level === "ground") {
    if (x < -hall) return z < partition ? "kitchen" : "breakfast";
    if (x > hall) return "sitting";
    return "hall";
  }
  if (x < -hall) return z < linnetFront ? "linnet" : "goldfinch";
  if (x > hall) return z < sittingBack ? "bath" : "goldfinch";
  return z > upperFront ? "goldfinch" : "landing";
}

// What can be seen from each room, through its doors, hatch and stairwell. The
// rooms each draw only while one of these lists them.
export const SEEN_FROM = {
  hall: ["hall", "breakfast", "sitting", "kitchen", "landing"],
  breakfast: ["breakfast", "hall", "sitting", "kitchen"],
  sitting: ["sitting", "hall", "breakfast"],
  kitchen: ["kitchen", "breakfast", "hall"],
  landing: ["landing", "goldfinch", "linnet", "bath", "hall"],
  goldfinch: ["goldfinch", "landing"],
  linnet: ["linnet", "landing", "bath"],
  bath: ["bath", "landing", "linnet"],
};

/**
 * A wall's solid runs as box colliders, cut only at the doors you can walk through.
 * @param {Wall} wall
 * @returns {Collider[]}
 */
export function wallColliders(wall) {
  const doors = (wall.openings || []).filter((o) => o.door && !o.shut).sort((p, q) => p.from - q.from);
  const runs = [];
  let start = wall.from;
  for (const door of doors) {
    runs.push([start, door.from]);
    start = door.to;
  }
  runs.push([start, wall.to]);
  return runs
    .filter(([p, q]) => q > p)
    .map(([p, q]) =>
      wall.axis === "x"
        ? { x: (p + q) / 2, z: wall.at, w: q - p, d: wall.thick }
        : { x: wall.at, z: (p + q) / 2, w: wall.thick, d: q - p },
    );
}

const flightWall = {
  x: stair.minX - 0.04,
  z: (stair.bottomZ + stair.topZ) / 2,
  w: 0.08,
  d: stair.bottomZ - stair.topZ,
};

// A piece of furniture's footprint as the walker sees it.
/** @returns {Collider} */
const footprint = (/** @type {any} */ p) =>
  p.r !== undefined ? { x: p.x, z: p.z, r: p.r } : { x: p.x, z: p.z, w: p.w, d: p.d };

/**
 * Everything a walker on the ground floor bumps into.
 * @returns {Collider[]}
 */
export function groundColliders() {
  return [
    ...GROUND_WALLS.flatMap(wallColliders),
    flightWall,
    ...Object.values(GROUND).map(footprint),
    ...BREAKFAST_CHAIRS.map(footprint),
    ...KITCHEN_CHAIRS.map(footprint),
    ...JIGSAW_CHAIRS.map(footprint),
  ];
}

/**
 * Everything a walker upstairs bumps into, including the well's rail: the
 * flight's own wall is the same, so the rail is there on the way up and down.
 * @returns {Collider[]}
 */
export function upperColliders() {
  return [
    ...UPPER_WALLS.flatMap(wallColliders),
    flightWall,
    // The store behind the landing, and everything past the knee walls.
    { x: -3.1, z: (linnetFront + upperFront) / 2, w: 3.2, d: upperFront - linnetFront },
    { x: (knee.x + halfW) / 2 + 0.1, z: 0, w: halfW - knee.x + 0.2, d: front - back },
    { x: -(knee.x + halfW) / 2 - 0.1, z: 0, w: halfW - knee.x + 0.2, d: front - back },
    ...Object.values(UPPER).map(footprint),
  ];
}

/** The walkable box and the spot just inside the front door. */
export const WALK = {
  bounds: { minX: -halfW, maxX: halfW, minZ: back, maxZ: front },
  spawn: { x: 0, z: front - 0.72, yaw: 0 },
};
