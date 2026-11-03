// The allotments south of the kitchen garden: a post-and-rail fence with
// three gates, gravel paths, eight raised beds (the four the neighbours keep,
// full of cabbages, onions, sunflowers, potatoes and rhubarb, and the four to
// let, where the player's carrots, lettuces, runner beans and pumpkins grow),
// a potting shed with its water butt, cold frames, compost bays, a scarecrow,
// a wheelbarrow, a noticeboard, and Basil, who keeps them. Loaded with
// import() once the village is on screen and built by the streamer a piece at
// a time. Its shape and colliders live in allotments-layout.js, which loads
// with the village.
//
// The structures are two vertex-coloured meshes, one each side of the main
// path, and the neighbours' crops a third; the player's crops are one instanced mesh
// per bed that draws only while something grows there, and the beds' "to
// let" boards one more, both hidden when the overview zooms far out. No
// textures and no new shader programs.
import { chunkRandom } from "../world-layout.js";
import { createKit } from "./kit.js";
import { ALLOTMENTS as A, FENCE_RUNS, plotFront } from "./allotments-layout.js";
import { ALLOTMENT_RESIDENTS } from "../content/allotments.js";
import { CROPS } from "../game/allotments.js";

const TAU = Math.PI * 2;

const COLOR = {
  timber: "#8b6c4a",
  timberDark: "#6e5539",
  soil: "#6a4e36",
  soilDark: "#5a4230",
  fence: "#9c8767",
  leaf: "#5f8a3c",
  leafDark: "#476f30",
  leafPale: "#8fb456",
  cane: "#b9a477",
};

/**
 * Streamer jobs for the allotments. `game.life` takes Basil once his shed
 * stands. The region also hands back `beds`, which shows each rented bed's
 * crop at its stage (activities.js keeps it up to date).
 */
export function allotmentJobs(T, world, { life } = {}) {
  const rand = chunkRandom(-1, 2, 23),
    range = (a, b) => a + (b - a) * rand();
  const material = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 });
  const job = (key, x, z, step, added) => ({ key, x, z, step, added });
  // The marsh's mere is the nearest water, and only its far side would show
  // the fence: nothing here goes into the reflections.
  const added = (meshes, options) => {
    for (const mesh of meshes) {
      world.addStreamed(mesh, options);
      world.water.excludeFromCaptures(mesh);
    }
  };
  const beds = createBeds(T, material);
  const jobs = [
    job("allotment paths", A.path.x, A.crossPath.z, () => [paths(T, world.materials.path)], added),
    job(
      "allotments west",
      -17.5,
      29,
      () => {
        const k = createKit(T, { segments: 6, sphereDetail: 0 }),
          crops = k.layer();
        fence(k, (x) => x < A.path.x);
        for (const plot of A.neighbours) {
          bed(k, plot);
          k.into(crops, () => NEIGHBOUR_CROPS[plot.id](k, plot, range));
        }
        scarecrow(k, A.scarecrow);
        coldFrames(k, A.coldFrames);
        noticeboard(k, A.noticeboard);
        barrow(k, A.barrow);
        const meshes = [k.mesh("Allotments (west)", material), k.mesh("Allotment neighbours' crops", material, crops)];
        k.dispose();
        return meshes;
      },
      ([structures, crops]) => {
        // Zoomed far out, their shadows are a few pixels, and the crops,
        // like the player's, hide.
        added([structures], { fineShadow: true });
        added([crops], { far: true, fineShadow: true });
        world.interactables.push(
          { id: "scarecrow", name: "Scarecrow", x: A.scarecrow.x + 2.3, z: A.crossPath.z, radius: 1.1 },
          { id: "cold-frames", name: "Cold frames", x: A.coldFrames.x, z: A.coldFrames.z - 1.05, radius: 1.2 },
          { id: "allotment-board", name: "Noticeboard", x: A.noticeboard.x + 0.7, z: A.noticeboard.z, radius: 1 },
        );
      },
    ),
    job(
      "allotments east",
      -7,
      30,
      () => {
        const k = createKit(T, { segments: 6, sphereDetail: 0 });
        fence(k, (x) => x >= A.path.x);
        for (const plot of A.plots) {
          bed(k, plot);
          PLOT_FIXTURES[plot.crop]?.(k, plot);
        }
        shed(k, A.shed);
        waterButt(k, A.butt);
        compost(k, A.compost, range);
        const mesh = k.mesh("Allotments (east)", material);
        k.dispose();
        return [mesh];
      },
      (meshes) => {
        added(meshes, { fineShadow: true });
        world.interactables.push(
          { id: "potting-shed", name: "Potting shed", x: A.shed.x - 0.8, z: A.shed.z - A.shed.d / 2 - 0.6, radius: 1.1 },
          { id: "water-butt", name: "Water butt", x: A.butt.x + 0.1, z: A.butt.z - 0.75, radius: 0.9 },
          { id: "compost", name: "Compost bays", x: A.compost.x, z: A.compost.z - 1.15, radius: 1.3 },
        );
      },
    ),
    job("allotment crops", -6.5, 28.6, () => beds.build(), (meshes) => {
      // Zoomed far out, the crops and boards are a pixel or two: they hide.
      added(meshes, { far: true, fineShadow: true });
      beds.start();
      for (const plot of A.plots) {
        const front = plotFront(plot);
        world.interactables.push({
          id: `plot-${plot.id}`,
          type: "plot",
          plot: plot.id,
          name: CROPS[plot.crop].name,
          x: front.x,
          z: front.z,
          radius: 1.3,
        });
      }
    }),
    // Basil joins once his shed stands.
    job("allotment keeper", A.residents.basil.x, A.residents.basil.z, () => [], () => {
      for (const resident of ALLOTMENT_RESIDENTS) life?.addResident(resident);
    }),
  ];
  return { jobs, beds };
}

// --- Paths ---------------------------------------------------------------

// The gravel paths: flat strips just above the grass, in the village paths'
// gravel, their edges a little uneven and their ends rounded.
function paths(T, material) {
  const positions = [];
  const push = (...points) => {
    for (const [x, y, z] of points) positions.push(x, y, z);
  };
  const edge = (u, side) => Math.sin(u * 2.9 + side) * 0.035 + Math.sin(u * 6.3 - side) * 0.02;
  // A straight strip from (x1, z1) to (x2, z2), half `half` wide.
  function strip(x1, z1, x2, z2, half, y) {
    const length = Math.hypot(x2 - x1, z2 - z1),
      ux = (x2 - x1) / length,
      uz = (z2 - z1) / length,
      nx = -uz,
      nz = ux,
      steps = Math.ceil(length / 0.4);
    const at = (s, side) => {
      const u = (s / steps) * length,
        w = (half + edge(u + x1 + z1, side * 2)) * side;
      return [x1 + ux * u + nx * w, y, z1 + uz * u + nz * w];
    };
    for (let s = 0; s < steps; s++) push(at(s, 1), at(s, -1), at(s + 1, 1), at(s + 1, 1), at(s, -1), at(s + 1, -1));
    for (const [x, z, heading] of [
      [x1, z1, Math.atan2(-ux, -uz)],
      [x2, z2, Math.atan2(ux, uz)],
    ]) {
      const n = 10;
      for (let i = 0; i < n; i++) {
        const a0 = heading - Math.PI / 2 + (i / n) * Math.PI,
          a1 = heading - Math.PI / 2 + ((i + 1) / n) * Math.PI;
        push([x, y, z], [x + Math.sin(a1) * half, y, z + Math.cos(a1) * half], [x + Math.sin(a0) * half, y, z + Math.cos(a0) * half]);
      }
    }
  }
  const p = A.path,
    c = A.crossPath;
  strip(p.x, p.fromZ, p.x, p.toZ, p.halfWidth, 0.1);
  // The cross path runs out through the east and west gates.
  strip(c.fromX, c.z, c.toX, c.z, c.halfWidth, 0.098);
  // Every triangle faces up, whichever way it was wound.
  for (let i = 0; i < positions.length; i += 9) {
    const ax = positions[i + 3] - positions[i],
      az = positions[i + 5] - positions[i + 2],
      bx = positions[i + 6] - positions[i],
      bz = positions[i + 8] - positions[i + 2];
    if (az * bx - ax * bz < 0)
      for (let k = 0; k < 3; k++) {
        const t = positions[i + 3 + k];
        positions[i + 3 + k] = positions[i + 6 + k];
        positions[i + 6 + k] = t;
      }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const mesh = new T.Mesh(geometry, material);
  mesh.name = "Allotment paths";
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  return mesh;
}

// --- Structures ----------------------------------------------------------

// The fence's runs on one side of the main path (`side(x)`), split where a
// run crosses it: square posts about every 2 m and two rails, taller posts
// at each gate.
function fence(k, side) {
  const g = A.gateHalfWidth,
    gatePosts = [
      [A.path.x - g, A.fence.minZ],
      [A.path.x + g, A.fence.minZ],
      [A.fence.minX, A.crossPath.z - g],
      [A.fence.minX, A.crossPath.z + g],
      [A.fence.maxX, A.crossPath.z - g],
      [A.fence.maxX, A.crossPath.z + g],
    ];
  const runs = FENCE_RUNS.flatMap(([x1, z1, x2, z2]) =>
    x1 < A.path.x && x2 > A.path.x
      ? [
          [x1, z1, A.path.x, z2],
          [A.path.x, z1, x2, z2],
        ]
      : [[x1, z1, x2, z2]],
  ).filter(([x1, , x2]) => side((x1 + x2) / 2));
  for (const [x1, z1, x2, z2] of runs) {
    const length = Math.hypot(x2 - x1, z2 - z1),
      n = Math.max(1, Math.round(length / 2));
    for (let i = 0; i <= n; i++) {
      const x = x1 + ((x2 - x1) * i) / n,
        z = z1 + ((z2 - z1) * i) / n;
      // A run split at the main path shares its post there with the other side.
      if (i === n && x === A.path.x && Math.abs(x2 - x1) > 0.01 && !side(x + 0.01)) continue;
      k.box(COLOR.fence, x, 0.5, z, 0.1, 1, 0.1);
    }
    for (const y of [0.42, 0.82]) k.beam(COLOR.fence, [x1, y, z1], [x2, y, z2], 0.06);
  }
  for (const [x, z] of gatePosts.filter(([x]) => side(x))) {
    k.box(COLOR.timberDark, x, 0.62, z, 0.14, 1.24, 0.14);
    k.pyramid(COLOR.timberDark, x, 1.3, z, 0.11, 0.12);
  }
}

// A raised bed: a timber frame round a bed of dark soil.
function bed(k, { x, z, w, d }) {
  const t = 0.08,
    h = A.frame;
  k.box(COLOR.soil, x, A.soil / 2, z, w - t, A.soil, d - t);
  for (const s of [-1, 1]) {
    k.box(COLOR.timber, x + (s * (w - t)) / 2, h / 2, z, t, h, d);
    k.box(COLOR.timber, x, h / 2, z + (s * (d - t)) / 2, w - 2 * t, h, t);
  }
  // Corner pegs.
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) k.box(COLOR.timberDark, x + (sx * (w - t)) / 2, h / 2 + 0.03, z + (sz * (d - t)) / 2, 0.1, h + 0.06, 0.1);
}

// Soil ridged along each row, a little proud of the bed.
function ridges(k, plot, offsets, hex = COLOR.soilDark) {
  for (const ox of offsets) k.box(hex, plot.x + ox, A.soil + 0.015, plot.z, 0.34, 0.04, plot.d - 0.5);
}

// The potting shed: weatherboarded walls, a felted pitched roof, its door
// and window facing north up the path, flowerpots stacked by the door.
function shed(k, { x, z, w, d, h }) {
  k.placed(x, 0, z, 0, () => {
    k.box("#6f5a43", 0, 0.08, 0, w + 0.1, 0.16, d + 0.1);
    k.box("#7e8f6c", 0, h / 2, 0, w, h, d);
    // Weatherboard lines on the long walls.
    for (let y = 0.35; y < h - 0.1; y += 0.28)
      for (const s of [-1, 1]) k.box("#6f8060", 0, y, (s * d) / 2, w + 0.02, 0.03, 0.02);
    // The roof, ridged along x, overhanging all round.
    const pitch = 0.42,
      half = d / 2 + 0.25,
      slope = half / Math.cos(pitch);
    for (const s of [-1, 1])
      k.box("#4b4a47", 0, h + Math.tan(pitch) * (d / 2 - half / 2) + 0.03, (s * half) / 2, w + 0.4, 0.06, slope, 0, s * pitch);
    k.gable("#7e8f6c", -w / 2, h, 0, [
      [-d / 2, 0],
      [d / 2, 0],
      [0, Math.tan(pitch) * (d / 2)],
    ], w);
    // Door and window on the north face, the door left of centre.
    k.box("#4f6046", -0.55, 0.92, -d / 2 - 0.02, 0.8, 1.72, 0.05);
    k.box("#c8b25a", -0.28, 0.95, -d / 2 - 0.06, 0.06, 0.06, 0.04);
    k.box("#e7e0cc", 0.75, 1.3, -d / 2 - 0.02, 0.86, 0.66, 0.05);
    k.box("#3c4a4a", 0.75, 1.3, -d / 2 - 0.04, 0.72, 0.52, 0.04);
    k.box("#e7e0cc", 0.75, 1.3, -d / 2 - 0.06, 0.04, 0.52, 0.03);
    // A bench under the window with pots on it, and pots stacked by the door.
    k.box(COLOR.timber, 0.75, 0.5, -d / 2 - 0.28, 1.2, 0.06, 0.4);
    for (const s of [-1, 1]) k.box(COLOR.timberDark, 0.75 + s * 0.5, 0.25, -d / 2 - 0.28, 0.06, 0.5, 0.36);
    for (const [px, py, r] of [
      [0.42, 0.62, 0.09],
      [0.7, 0.6, 0.07],
      [1.05, 0.63, 0.1],
      [-1.2, 0.1, 0.12],
      [-1.2, 0.26, 0.11],
      [-1.2, 0.41, 0.1],
    ])
      k.add(k.unit.cylinder, "#b8653d", px, py, -d / 2 - 0.3, r, r * 1.5, r);
    // A seedling in each pot on the bench.
    for (const px of [0.42, 0.7, 1.05]) k.ball(COLOR.leafPale, px, 0.74, -d / 2 - 0.3, 0.07, 0.05, 0.07);
  });
}

function waterButt(k, { x, z, r }) {
  k.cyl("#3f5a3f", x, 0.47, z, r, 0.9);
  k.cyl("#33493a", x, 0.94, z, r + 0.02, 0.04);
  for (const y of [0.2, 0.72]) k.cyl("#2f4335", x, y, z, r + 0.015, 0.04);
  // The tap, and a watering can waiting under it.
  k.box("#8e8a7e", x, 0.18, z - r - 0.04, 0.05, 0.05, 0.1);
  k.cyl("#6f8f9a", x + 0.05, 0.12, z - r - 0.3, 0.12, 0.24);
  k.rod("#6f8f9a", [x + 0.05, 0.16, z - r - 0.42], [x + 0.05, 0.32, z - r - 0.68], 0.018);
}

// Cold frames: low timber boxes with sloping glazed lids, seedlings inside.
function coldFrames(k, { x, z, w, d, count }) {
  const each = w / count;
  for (let i = 0; i < count; i++) {
    const cx = x - w / 2 + each * (i + 0.5);
    k.box(COLOR.timber, cx, 0.16, z + 0.08, each - 0.08, 0.32, d - 0.1);
    k.box(COLOR.timber, cx, 0.28, z - d / 2 + 0.1, each - 0.08, 0.16, 0.06);
    for (let j = 0; j < 3; j++) k.ball(COLOR.leafPale, cx - 0.3 + j * 0.3, 0.34, z, 0.08, 0.05, 0.08);
    // The lid, propped open on the middle frame.
    const open = i === 1 ? 0.35 : 0;
    k.box("#c4d6d3", cx, 0.4 + open * 0.3, z + 0.02, each - 0.12, 0.03, d - 0.08, 0, 0.22 + open);
    k.box(COLOR.timberDark, cx, 0.42 + open * 0.3, z + 0.02, 0.04, 0.035, d - 0.08, 0, 0.22 + open);
  }
}

// Compost bays: slatted sides and backs, open to the north, heaped up.
function compost(k, { x, z, w, d, count }, range) {
  const each = w / count;
  for (let i = 0; i <= count; i++) {
    const sx = x - w / 2 + each * i;
    for (let y = 0.1; y < 0.9; y += 0.16) k.box(COLOR.timberDark, sx, y, z, 0.05, 0.12, d);
  }
  for (let y = 0.1; y < 0.9; y += 0.16) k.box(COLOR.timberDark, x, y, z + d / 2, w, 0.12, 0.05);
  for (let i = 0; i < count; i++) {
    const cx = x - w / 2 + each * (i + 0.5),
      height = [0.62, 0.45, 0.3][i];
    k.ball(i === 2 ? "#6e7a3e" : "#4b3826", cx, height * 0.4, z + 0.1, each * 0.44, height * 0.6, d * 0.42);
    // Fresh cuttings on top of the newest heap.
    if (i === 2)
      for (let j = 0; j < 4; j++) k.ball(COLOR.leaf, cx + range(-0.3, 0.3), height * 0.55, z + range(-0.3, 0.3), 0.12, 0.05, 0.1);
  }
  // A fork stuck in the middle heap.
  k.rod("#7a6448", [x + 0.05, 0.25, z - 0.1], [x + 0.2, 1.25, z - 0.25], 0.02);
}

function scarecrow(k, { x, z }) {
  k.post(COLOR.timberDark, x, z, A.soil, 1.75, 0.04);
  k.beam(COLOR.timberDark, [x - 0.62, 1.28, z], [x + 0.62, 1.28, z], 0.05);
  // An old blue coat, a sack face and a straw hat.
  k.box("#4d6180", x, 1.12, z, 0.42, 0.6, 0.22);
  for (const s of [-1, 1]) k.box("#4d6180", x + s * 0.4, 1.27, z, 0.42, 0.14, 0.16);
  k.ball("#d8c08e", x, 1.62, z, 0.15, 0.17, 0.14);
  k.cyl("#cfae5b", x, 1.76, z, 0.3, 0.025);
  k.cyl("#cfae5b", x, 1.83, z, 0.15, 0.12);
  k.cyl("#9b3b2f", x, 1.79, z, 0.152, 0.03);
  for (const s of [-1, 1]) k.ball("#cfae5b", x + s * 0.64, 1.25, z, 0.07, 0.05, 0.05);
}

// The noticeboard inside the north gate, facing the path.
function noticeboard(k, { x, z }) {
  k.placed(x, 0, z, Math.PI / 2, () => {
    for (const s of [-1, 1]) k.post(COLOR.timberDark, s * 0.45, 0, 0, 1.55, 0.045);
    k.box(COLOR.timber, 0, 1.15, 0, 1.0, 0.62, 0.05);
    k.box("#e6dcc0", -0.18, 1.18, 0.03, 0.34, 0.24, 0.02);
    k.box("#d9c9a0", 0.22, 1.1, 0.03, 0.28, 0.34, 0.02);
    k.box("#a8c2c9", 0.12, 1.32, 0.03, 0.2, 0.12, 0.02);
    k.box("#5e4a35", 0, 1.5, 0, 1.14, 0.05, 0.22, 0, 0.25);
  });
}

function barrow(k, { x, z, turn }) {
  k.placed(x, 0, z, turn, () => {
    k.box("#6f8a82", 0, 0.42, 0, 0.62, 0.06, 0.8);
    for (const s of [-1, 1]) {
      k.box("#6f8a82", s * 0.32, 0.53, 0, 0.05, 0.2, 0.8, 0, 0, s * 0.25);
      k.beam(COLOR.timberDark, [s * 0.22, 0.4, 0.3], [s * 0.27, 0.55, -0.75], 0.04);
      k.beam(COLOR.timberDark, [s * 0.22, 0.4, -0.2], [s * 0.22, 0, -0.25], 0.035);
    }
    k.box("#6f8a82", 0, 0.53, 0.4, 0.62, 0.2, 0.05, 0, -0.3);
    k.add(k.unit.cylinder, "#3d3a36", 0, 0.17, 0.48, 0.17, 0.07, 0.17, 0, 0, Math.PI / 2);
    // A load of weeds.
    k.ball(COLOR.leafDark, 0, 0.5, 0, 0.26, 0.1, 0.33);
  });
}

// Canes and mounds that stay in the player's beds whatever grows there.
const PLOT_FIXTURES = {
  bean(k, plot) {
    // Two rows of canes leaning in to a ridge cane, an A-frame along the bed.
    for (const s of [-1, 1])
      for (const z of beanCanes(plot)) k.rod(COLOR.cane, [plot.x + s * 0.5, A.soil, z], [plot.x - s * 0.06, 2, z], 0.016);
    k.rod(COLOR.cane, [plot.x, 1.93, plot.z - plot.d / 2 + 0.3], [plot.x, 1.93, plot.z + plot.d / 2 - 0.3], 0.016);
  },
  pumpkin(k, plot) {
    for (const [ox, oz] of pumpkinMounds()) k.ball(COLOR.soilDark, plot.x + ox, A.soil, plot.z + oz, 0.42, 0.1, 0.42);
  },
  carrot(k, plot) {
    ridges(k, plot, carrotRows());
  },
  lettuce(k, plot) {
    ridges(k, plot, lettuceRows());
  },
};
const carrotRows = () => [-1.05, 0, 1.05];
const lettuceRows = () => [-1.05, 0, 1.05];
const beanCanes = (plot) => Array.from({ length: 5 }, (_, i) => plot.z - 1.6 + i * 0.8);
const pumpkinMounds = () => [
  [-0.8, -1.3],
  [0.8, -1.3],
  [-0.8, 0],
  [0.8, 0],
  [-0.8, 1.3],
  [0.8, 1.3],
];

// --- The neighbours' beds ---------------------------------------------------

const NEIGHBOUR_CROPS = {
  // Two rows of cabbages, green and red, and a row of onions.
  cabbages(k, plot, range) {
    ridges(k, plot, [-1.05, 0, 1.05]);
    const top = A.soil;
    for (const [ox, hex, dark] of [
      [-1.05, "#8fae6a", "#6e914f"],
      [0, "#8a6a9a", "#6f4f7d"],
    ])
      for (let i = 0; i < 6; i++) {
        const x = plot.x + ox + range(-0.05, 0.05),
          z = plot.z - 2.05 + i * 0.82;
        k.ball(hex, x, top + 0.14, z, 0.17, 0.15, 0.17);
        for (let j = 0; j < 4; j++) {
          const a = (j / 4) * TAU + range(0, 1);
          k.ball(dark, x + Math.cos(a) * 0.17, top + 0.07, z + Math.sin(a) * 0.17, 0.16, 0.05, 0.16);
        }
      }
    for (let i = 0; i < 10; i++) {
      const x = plot.x + 1.05,
        z = plot.z - 2.1 + i * 0.47;
      k.ball("#e2d6b0", x, top + 0.05, z, 0.07, 0.06, 0.07);
      for (let j = 0; j < 3; j++)
        k.add(k.unit.cone, "#6f9a48", x + (j - 1) * 0.03, top + 0.25, z, 0.02, 0.36, 0.02, (j - 1) * 0.2, 0, 0);
    }
  },
  // Sunflowers along the back, a bean wigwam, and ruby chard.
  sunflowers(k, plot, range) {
    const top = A.soil;
    for (let i = 0; i < 5; i++) {
      const x = plot.x + 1.25,
        z = plot.z - 2 + i * 1,
        h = range(1.9, 2.4);
      k.post("#6c8f3c", x, z, top, top + h, 0.03);
      for (const s of [-1, 1]) k.ball(COLOR.leaf, x + s * 0.12, top + h * 0.5, z, 0.14, 0.03, 0.09);
      // Their faces turned north, to the gate, and a little up.
      k.add(k.unit.cylinder, "#f0b92a", x, top + h, z - 0.05, 0.2, 0.04, 0.2, 0.3 - Math.PI / 2);
      k.add(k.unit.cylinder, "#5a3d22", x, top + h + 0.01, z - 0.08, 0.1, 0.05, 0.1, 0.3 - Math.PI / 2);
    }
    const wx = plot.x - 0.6,
      wz = plot.z - 1;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      k.rod(COLOR.cane, [wx + Math.cos(a) * 0.5, top, wz + Math.sin(a) * 0.5], [wx, 2, wz], 0.015);
      for (let j = 0; j < 4; j++) {
        const f = 0.2 + j * 0.2;
        k.ball(j % 2 ? COLOR.leaf : COLOR.leafDark, wx + Math.cos(a) * 0.5 * (1 - f), top + 1.83 * f, wz + Math.sin(a) * 0.5 * (1 - f), 0.13, 0.11, 0.13);
      }
      k.ball("#d4492f", wx + Math.cos(a + 0.4) * 0.3, top + 1.1, wz + Math.sin(a + 0.4) * 0.3, 0.035);
    }
    for (let i = 0; i < 5; i++) {
      const x = plot.x - 0.6 + range(-0.08, 0.08),
        z = plot.z + 0.6 + i * 0.4;
      for (let j = 0; j < 4; j++) {
        const a = (j / 4) * TAU + range(0, 0.6);
        k.rod("#b8333a", [x, top, z], [x + Math.cos(a) * 0.1, top + 0.32, z + Math.sin(a) * 0.1], 0.012);
        k.ball("#4f7a38", x + Math.cos(a) * 0.14, top + 0.36, z + Math.sin(a) * 0.14, 0.1, 0.03, 0.13);
      }
    }
  },
  // Earthed-up rows of potatoes, the scarecrow in the middle.
  potatoes(k, plot, range) {
    const top = A.soil;
    for (const ox of [-1.1, -0.4, 0.4, 1.1]) {
      k.box(COLOR.soilDark, plot.x + ox, top + 0.06, plot.z, 0.42, 0.12, plot.d - 0.5);
      for (let i = 0; i < 6; i++) {
        const z = plot.z - 1.7 + i * 0.68;
        if (Math.abs(ox) < 0.5 && Math.abs(z - plot.z) < 0.6) continue;
        k.ball(i % 2 ? COLOR.leaf : COLOR.leafDark, plot.x + ox + range(-0.04, 0.04), top + 0.24, z, 0.24, 0.16, 0.22);
        if (i % 3 === 0) k.ball("#f2efe2", plot.x + ox, top + 0.38, z + 0.05, 0.035);
      }
    }
  },
  // Rhubarb crowns under great leaves, a forcing pot, and strawberries.
  rhubarb(k, plot, range) {
    const top = A.soil;
    for (const oz of [-1.3, 0, 1.3]) {
      const x = plot.x - 0.8,
        z = plot.z + oz;
      for (let j = 0; j < 5; j++) {
        const a = (j / 5) * TAU + range(0, 0.5),
          lx = x + Math.cos(a) * 0.36,
          lz = z + Math.sin(a) * 0.36;
        k.rod("#c0444a", [x, top, z], [lx, top + 0.4, lz], 0.02);
        k.ball("#4a7a32", lx, top + 0.45, lz, 0.32, 0.05, 0.28);
      }
    }
    k.add(k.unit.cylinder, "#b8653d", plot.x - 0.8, top + 0.25, plot.z + 2.15 - 0.4, 0.2, 0.5, 0.2, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const z = plot.z - 1.8 + i * 0.6;
      k.ball("#5e8f40", plot.x + 0.9, top + 0.08, z, 0.17, 0.08, 0.17);
      k.ball("#d8343a", plot.x + 0.9 + range(-0.1, 0.1), top + 0.1, z + range(-0.1, 0.1), 0.035);
    }
  },
};

// --- The player's beds -------------------------------------------------------

// Each crop as one small plant, base at the origin, for the bed's instanced
// mesh: where each plant stands in its bed, and how it grows.
function cropShapes(T) {
  const shape = (build, sphereDetail = 0) => {
    const k = createKit(T, { segments: 6, sphereDetail });
    build(k);
    const geometry = k.geometry();
    k.dispose();
    return geometry;
  };
  return {
    carrot: {
      geometry: shape((k) => {
        k.cyl("#e07a2a", 0, 0.01, 0, 0.035, 0.04);
        // Feathery tops, splayed: flat fronds round a taller middle one.
        for (let j = 0; j < 6; j++) {
          const a = (j / 6) * TAU;
          k.add(k.unit.cone, j % 2 ? "#6fa046" : "#5e9038", Math.cos(a) * 0.06, 0.13, Math.sin(a) * 0.06, 0.07, 0.26, 0.025, Math.sin(a) * 0.5, a, -Math.cos(a) * 0.5);
        }
        k.add(k.unit.cone, "#78aa4c", 0, 0.17, 0, 0.06, 0.32, 0.03);
      }),
      slots: (plot) =>
        carrotRows().flatMap((ox) => Array.from({ length: 8 }, (_, i) => [ox, -2 + i * 0.57])),
    },
    lettuce: {
      geometry: shape((k) => {
        k.ball("#b4d27a", 0, 0.11, 0, 0.13, 0.11, 0.13);
        for (let j = 0; j < 6; j++) {
          const a = (j / 6) * TAU;
          k.ball(j % 2 ? "#8fbb5a" : "#9cc566", Math.cos(a) * 0.13, 0.07, Math.sin(a) * 0.13, 0.13, 0.07, 0.11);
        }
      }),
      slots: () => lettuceRows().flatMap((ox) => Array.from({ length: 5 }, (_, i) => [ox, -1.9 + i * 0.95])),
    },
    bean: {
      // A vine climbing its cane (upright here; each instance leans with its cane).
      geometry: shape((k) => {
        for (let j = 0; j < 10; j++) {
          const y = 0.12 + j * 0.18,
            a = j * 2.1;
          k.ball(j % 3 ? COLOR.leaf : COLOR.leafDark, Math.cos(a) * 0.08, y, Math.sin(a) * 0.08, 0.11, 0.09, 0.1);
        }
        for (let j = 0; j < 4; j++) {
          const y = 0.6 + j * 0.3,
            a = j * 1.7 + 0.5;
          k.add(k.unit.cylinder, "#5f9a3a", Math.cos(a) * 0.13, y, Math.sin(a) * 0.13, 0.012, 0.22, 0.012, 0, 0, 0.15);
          k.ball("#d4492f", Math.cos(a + 1) * 0.11, y + 0.1, Math.sin(a + 1) * 0.11, 0.03);
        }
      }),
      slots: (plot) => [-1, 1].flatMap((s) => beanCanes(plot).map((z) => [s * 0.5, z - plot.z, s])),
    },
    pumpkin: {
      geometry: shape((k) => {
        for (let j = 0; j < 3; j++) {
          const a = (j / 3) * TAU + 0.5;
          k.ball(j % 2 ? COLOR.leaf : COLOR.leafDark, Math.cos(a) * 0.3, 0.1, Math.sin(a) * 0.3, 0.26, 0.05, 0.24);
        }
        k.ball("#df8a2e", 0, 0.2, 0, 0.27, 0.2, 0.27);
        k.ball("#cf7826", 0, 0.2, 0, 0.21, 0.22, 0.31);
        k.ball("#cf7826", 0, 0.2, 0, 0.31, 0.22, 0.21);
        k.cyl("#6b7a3a", 0, 0.43, 0, 0.03, 0.08);
        // Six to a bed: rounder than the leafy crops.
      }, 1),
      slots: () => pumpkinMounds().map(([ox, oz]) => [ox, oz]),
    },
  };
}

// A "to let" board on a stake, standing in a bed no one has rented.
function letBoard(T) {
  const k = createKit(T, { segments: 6, sphereDetail: 0 });
  k.box(COLOR.timberDark, 0, 0.35, 0, 0.05, 0.7, 0.05);
  k.box("#e9e0c4", 0, 0.68, -0.03, 0.5, 0.3, 0.03);
  k.box("#b0503a", 0, 0.72, -0.05, 0.36, 0.05, 0.01);
  k.box("#6d6250", 0, 0.62, -0.05, 0.3, 0.03, 0.01);
  const geometry = k.geometry();
  k.dispose();
  return geometry;
}

/**
 * The player's beds: one instanced mesh of its crop per bed, and one of "to
 * let" boards. `show(id, stage, growth)` sets a bed's crop to its stage
 * (see plotStage in src/game/allotments.js); before the meshes are built it
 * remembers the stage and applies it once they are.
 */
function createBeds(T, material) {
  const wanted = new Map(),
    meshes = new Map(),
    matrix = new T.Matrix4(),
    position = new T.Vector3(),
    quaternion = new T.Quaternion(),
    euler = new T.Euler(),
    scale = new T.Vector3();
  let shapes = null,
    boards = null,
    ready = false;
  const plots = A.plots;
  function place(mesh, plot, growth) {
    const { slots } = shapes[plot.crop],
      size = 0.12 + 0.88 * growth;
    slots(plot).forEach(([ox, oz, lean = 0], i) => {
      // Beans climb: their height follows the growth, their spread less so.
      const spread = plot.crop === "bean" ? 0.5 + 0.5 * size : size;
      euler.set(0, lean ? 0 : (i * 2.39) % TAU, lean * 0.3);
      matrix.compose(
        position.set(plot.x + ox, A.soil, plot.z + oz),
        quaternion.setFromEuler(euler),
        scale.set(spread, size, spread),
      );
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.userData.growth = growth;
  }
  // A bed's board stands in its corner by the cross path.
  const boardAt = (p, i) =>
    matrix
      .makeRotationY(0.12 * (i % 2 ? 1 : -1))
      .setPosition(p.x - 1.3, A.soil, plotFront(p).z < p.z ? p.z - p.d / 2 + 0.25 : p.z + p.d / 2 - 0.25);
  function apply(id) {
    const plot = plots.find((p) => p.id === id),
      mesh = meshes.get(id),
      { stage, growth } = wanted.get(id) ?? { stage: "free", growth: 0 };
    if (!mesh) return;
    // Hidden crops draw no instances and sit in no camera's layer, so no pass
    // draws or uploads them; visibility belongs to the zoom detail.
    const showing = stage === "growing" || stage === "ripe";
    mesh.count = showing ? shapes[plot.crop].slots(plot).length : 0;
    mesh.layers.mask = showing ? 1 : 0;
    const size = stage === "ripe" ? 1 : Math.round(growth * 40) / 40;
    if (showing && mesh.userData.growth !== size) place(mesh, plot, size);
    // The boards stand in the beds still to let.
    const free = plots.filter((p) => (wanted.get(p.id)?.stage ?? "free") === "free");
    free.forEach((p, i) => boards.setMatrixAt(i, boardAt(p, i)));
    boards.count = free.length;
    boards.layers.mask = free.length ? 1 : 0;
    boards.instanceMatrix.needsUpdate = true;
  }
  return {
    build() {
      shapes = cropShapes(T);
      const built = [];
      for (const plot of plots) {
        const { geometry, slots } = shapes[plot.crop],
          mesh = new T.InstancedMesh(geometry, material, slots(plot).length);
        mesh.name = `Allotment ${CROPS[plot.crop].many}`;
        mesh.castShadow = mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        // Bounds of the grown crop, which growing never leaves.
        place(mesh, plot, 1);
        mesh.userData.dynamic = true;
        meshes.set(plot.id, mesh);
        built.push(mesh);
      }
      boards = new T.InstancedMesh(letBoard(T), material, plots.length);
      boards.name = "Allotment to-let boards";
      boards.castShadow = boards.receiveShadow = true;
      boards.matrixAutoUpdate = false;
      plots.forEach((p, i) => boards.setMatrixAt(i, boardAt(p, i)));
      boards.userData.dynamic = true;
      built.push(boards);
      return built;
    },
    /**
     * Shows each bed at its stage, once its meshes have joined their chunks
     * (which size their bounds from every instance, grown).
     */
    start() {
      ready = true;
      for (const plot of plots) apply(plot.id);
    },
    show(id, stage, growth) {
      const before = wanted.get(id);
      if (before?.stage === stage && Math.abs(before.growth - growth) < 0.02) return;
      wanted.set(id, { stage, growth });
      if (ready) apply(id);
    },
  };
}
