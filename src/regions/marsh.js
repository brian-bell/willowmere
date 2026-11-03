// The willow marsh south of the village: its wet meadow, the brook's stretch
// and the reedy mere it opens into (one water body), a footbridge where the
// brook leaves the village, a boardwalk on stilts across the shallows, the
// bird hide, a bench, weeping willows, reedbeds, lilies and marsh flowers, a
// wading heron, fireflies at blue hour, and Wren, who watches the birds.
// Loaded with import() once the village is on screen and built by the
// streamer a piece at a time. Its shape, colliders and ground heights live in
// marsh-layout.js, which loads with the village.
//
// The structures share one vertex-coloured mesh; the willows share the
// village trees' bark, leaf blade and wind shader; the reeds the village's
// reed shader. The marsh adds no new shader programs beyond the fireflies'.
import { chunkRandom } from "../world-layout.js";
import { createKit, limb } from "./kit.js";
import { createReedBuilder } from "../reeds.js";
import { crownShells } from "../trees.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { brookEdge } from "./millpond-layout.js";
import {
  MARSH as M,
  boardwalkDeck,
  footbridgeDeck,
  hideDoor,
  marshGround,
  marshShore,
  shorePoint,
  trailDistance,
} from "./marsh-layout.js";
import { MARSH_RESIDENTS } from "../content/marsh.js";

const TAU = Math.PI * 2;
// Spacing of the ground mesh's vertices, in metres.
const GROUND_STEP = 0.2;
// Reed plants grown per slice; each takes about a millisecond.
const REEDS_PER_SLICE = 12;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Streamer jobs for the marsh. `game.life` takes its resident once the hide
 * stands; `game.dusk()` says how far into blue hour the day is (0 to 1), for
 * the fireflies.
 */
export function marshJobs(T, world, { life, dusk = () => 0 } = {}) {
  const rand = chunkRandom(0, 2, 11),
    range = (a, b) => a + (b - a) * rand();
  const job = (key, x, z, step, added) => ({ key, x, z, step, added });
  const added = (meshes) => {
    for (const mesh of meshes) world.addStreamed(mesh);
  };
  const reeds = reedPlacements(range),
    material = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 });
  const jobs = [
    job("marsh ground", 13, 29, groundBuilder(T, world), added),
    job("marsh water", 12, 25, () => {
      water(world);
      return [];
    }),
    job("marsh footbridge and boardwalk", 8, 27, () => crossings(T, range, material), (meshes) => {
      added(meshes);
      world.interactables.push({
        id: "marsh-footbridge",
        name: "Marsh footbridge",
        x: M.brookX,
        z: 21,
        radius: 1.1,
      });
    }),
    job("marsh hide and bench", M.hide.x, M.hide.z, () => hideAndBench(T, range, material), (meshes) => {
      added(meshes);
      const door = hideDoor(),
        b = M.bench;
      world.interactables.push(
        { id: "bird-hide", name: "Bird hide", x: door.x, z: door.z, radius: 1.3 },
        {
          id: "marsh-bench",
          name: "Marsh bench",
          x: b.x + Math.sin(b.turn) * 0.7,
          z: b.z + Math.cos(b.turn) * 0.7,
          radius: 1.3,
        },
      );
    }),
    // A job and a set of meshes per tree, so each culls on its own: two
    // willows stand just off the village's south edge.
    ...[
      ["west", M.willows.filter((w) => w.x < M.brookX)],
      ["east", M.willows.filter((w) => w.x >= M.brookX)],
    ].flatMap(([side, trees]) =>
      trees.map((tree, index) =>
        job(
          `marsh ${side} willow ${index + 1}`,
          tree.x,
          tree.z,
          willowBuilder(T, world, side, [tree], index),
          (meshes) => {
            const [wood, leaves, crown] = meshes;
            added(meshes);
            // The leaves' bounds enclose both blades and the wind's sway.
            leaves.geometry = leaves.userData.coarse;
            leaves.computeBoundingSphere();
            leaves.geometry = leaves.userData.fine;
            leaves.boundingSphere.radius += 0.14;
            world.water.excludeFromCaptures(leaves, crown);
            world.trees.adopt({
              mesh: leaves,
              fine: leaves.userData.fine,
              coarse: leaves.userData.coarse,
              crown,
              center: leaves.boundingSphere.center.clone(),
            });
          },
        ),
      ),
    ),
    job("marsh reeds", 12, 29, reedBuilder(reeds), ([group]) => {
      const meshes = [...group.children];
      for (const mesh of meshes) world.addStreamed(mesh);
      const update = group.userData.update;
      world.animate(M.centre.x, M.centre.z, (dt, t) => update(t));
    }),
    job("marsh lilies and flowers", 9, 31, () => [...lilies(T, range), ...flowers(T, range)], (meshes) => {
      const [pads, blooms, ...land] = meshes;
      for (const mesh of [pads, blooms]) {
        world.addStreamed(mesh);
        // Flat on the water, they would show in its reflection as slivers.
        world.water.excludeFromCaptures(mesh);
      }
      for (const mesh of land) world.addStreamed(mesh, { detail: true });
    }),
    job("marsh heron", 18.6, 27.6, () => heron(T), ([bird]) => {
      world.addStreamed(bird);
      const walk = bird.userData.walk;
      world.animate(18.6, 27.6, (dt, t, clock) => walk(clock, world.water));
    }),
    job("marsh fireflies", 13, 30, () => fireflies(T, range), ([swarm]) => {
      world.addStreamed(swarm);
      const glow = swarm.userData.glow;
      world.animate(M.centre.x, M.centre.z, (dt, t, clock) => glow(clock, dusk()));
    }),
    // Wren joins once the hide stands, by the bench on the east bank.
    job("marsh resident", M.residents.wren.x, M.residents.wren.z, () => [], () => {
      for (const resident of MARSH_RESIDENTS) life?.addResident(resident);
    }),
  ];
  return { jobs };
}

// --- Ground ---------------------------------------------------------------

// Vertex colours tint the open country's grass texture, so the lawn at the
// mesh's edge (white) matches the fields around it. Tints are the wanted
// colour over the grass texture's own (#7f9f5c), in linear terms.
function tint(T, hex) {
  const base = new T.Color("#7f9f5c"),
    color = new T.Color(hex);
  return new T.Color(color.r / base.r, color.g / base.g, color.b / base.b);
}

function groundBuilder(T, world) {
  const { minX, maxX, minZ, maxZ } = M.ground,
    cols = Math.round((maxX - minX) / GROUND_STEP) + 1,
    rows = Math.round((maxZ - minZ) / GROUND_STEP) + 1,
    positions = new Float32Array(cols * rows * 3),
    colors = new Float32Array(cols * rows * 3),
    uvs = new Float32Array(cols * rows * 2);
  // The marsh is greener and bluer than the fields: lush wet meadow, darker
  // rushy patches, mud at the waterline and a dark peaty bed.
  const lawn = new T.Color(1, 1, 1),
    meadow = tint(T, "#6f9c63"),
    rushes = tint(T, "#5c8656"),
    damp = tint(T, "#6a7458"),
    mud = tint(T, "#7b7052"),
    bed = tint(T, "#5d5e47"),
    deep = tint(T, "#43493c"),
    stoneBed = tint(T, "#8b9277"),
    earth = tint(T, "#a8966c"),
    worn = tint(T, "#93a066"),
    shade = tint(T, "#5f7e50"),
    color = new T.Color();
  function colorAt(x, z) {
    const s = marshShore(x, z),
      across = Math.abs(x - M.brookX),
      edge = brookEdge(z);
    const patch =
      Math.sin(x * 0.8 + 1.1) * Math.sin(z * 1.05 - 0.6) + 0.45 * Math.sin(x * 2.1 + z * 1.6);
    // The brook's stretch keeps the village brook's stony bed and banks.
    if (z < 25 && across < edge + 1.05) {
      const u = (across - edge) / 1.05;
      if (u < 0) return color.copy(stoneBed).lerp(damp, 0.3);
      return color.copy(damp).lerp(meadow, smooth(0, 0.5, u)).lerp(lawn, smooth(0.5, 1, u) * smooth(25, 22, z) * 0.5);
    }
    if (s > 0.25) return color.copy(bed).lerp(deep, smooth(0.4, 2.2, s));
    if (s > -0.8) {
      // The waterline: mud, with damp patches.
      color.copy(mud).lerp(damp, smooth(0.1, -0.5, s));
      if (patch > 0.4) color.lerp(damp, 0.5);
      return color.lerp(meadow, smooth(-0.4, -0.8, s));
    }
    // Wet meadow round the water, rushy in patches, fading to the lawn.
    color.copy(meadow);
    if (patch > 0.3) color.lerp(rushes, smooth(0.3, 0.9, patch) * 0.8);
    color.lerp(lawn, smooth(-3.5, -7.5, s));
    // Shade under the boardwalk's ends, the hide and the willows.
    for (const w of M.willows) {
      const d = Math.hypot(x - w.x, z - w.z);
      if (d < 2.6) color.lerp(shade, (1 - smooth(0.6, 2.6, d)) * 0.6);
    }
    // The trails: bare earth down the middle, worn grass at the edges.
    const trail = 1 - trailDistance(x, z, 1) / (M.trailHalfWidth + 0.25);
    if (trail > 0) color.lerp(worn, smooth(0, 0.4, trail)).lerp(earth, smooth(0.35, 0.9, trail) * 0.85);
    return color;
  }
  let row = 0;
  return (deadline) => {
    for (; row < rows; row++) {
      if (performance.now() > deadline) return null;
      const z = minZ + row * GROUND_STEP;
      for (let col = 0; col < cols; col++) {
        const x = minX + col * GROUND_STEP,
          i = row * cols + col;
        positions.set([x, marshGround(x, z), z], i * 3);
        uvs.set([x / 33.5, -z / 41.6], i * 2);
        // The mesh's edge stays plain lawn, to meet the fields' grass.
        const outer = col === 0 || row === 0 || col === cols - 1 || row === rows - 1;
        (outer ? color.copy(lawn) : colorAt(x, z)).toArray(colors, i * 3);
      }
    }
    const index = new Uint32Array((cols - 1) * (rows - 1) * 6);
    let n = 0;
    for (let r = 0; r < rows - 1; r++)
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c,
          b = a + 1,
          d = a + cols,
          e = d + 1;
        index.set([a, d, b, b, d, e], n);
        n += 6;
      }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new T.BufferAttribute(colors, 3));
    geometry.setAttribute("uv", new T.BufferAttribute(uvs, 2));
    geometry.setIndex(new T.BufferAttribute(index, 1));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const material = world.groundMaterial.clone();
    material.vertexColors = true;
    const mesh = new T.Mesh(geometry, material);
    mesh.name = "Marsh ground, banks and bed";
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    return mesh;
  };
}

// --- Water ----------------------------------------------------------------

// One body carries the brook's stretch from the village's edge, where it meets
// the village's brook under the footbridge, and the mere it opens into. Its
// current is gentler than the brook's: the marsh slows the water down.
const WATER_BOX = { minX: 3.4, maxX: 22.6, minZ: 21, maxZ: 35.4 };

function water(world) {
  const x = (WATER_BOX.minX + WATER_BOX.maxX) / 2,
    z = (WATER_BOX.minZ + WATER_BOX.maxZ) / 2;
  world.water.addBody({
    id: "marsh",
    x,
    y: M.surface,
    z,
    size: [WATER_BOX.maxX - WATER_BOX.minX, WATER_BOX.maxZ - WATER_BOX.minZ],
    shore: (lx, lz) => marshShore(lx + x, lz + z),
    depth: 0.6,
    ramp: 1.1,
    flow: 0.16,
    amplitude: 0.012,
    // About 16 cm cells, like the millpond's.
    grid: [120, 90],
    segments: [84, 64],
    // Peaty, greener water than the brook's.
    absorption: [1.15, 0.52, 0.5],
    scatter: "#3a5b47",
    roughness: 0.16,
    reflectionEvery: 2,
  });
}

// --- Structures -----------------------------------------------------------

// The structures share one vertex-coloured material, a mesh (one draw per
// pass) for the crossings and one for the hide and bench.
const wood = ["#8a6a4a", "#7f6145", "#93724f"],
  boards = ["#7a6a52", "#71624b", "#80705a"],
  darkWood = "#5f4c3a",
  weathered = "#9b8a72",
  trim = "#e5d8b6";

function crossings(T, range, material) {
  const k = createKit(T, { segments: 10, sphereDetail: 2 }),
    { box, post, beam, ball } = k;
  const pick = (list) => list[Math.floor(range(0, list.length))];

  // The footbridge: planks over a humped pair of stringers, posts and rails,
  // over the seam between the village's brook and the marsh's water.
  const fb = M.footbridge,
    planks = 20;
  for (let i = 0; i < planks; i++) {
    const x = fb.minX + ((i + 0.5) / planks) * (fb.maxX - fb.minX),
      y = footbridgeDeck(x) - 0.04,
      slope = Math.atan((footbridgeDeck(x + 0.05) - footbridgeDeck(x - 0.05)) / 0.1);
    box(pick(wood), x, y, (fb.minZ + fb.maxZ) / 2, 0.26, 0.07, fb.maxZ - fb.minZ - 0.1, 0, 0, slope);
  }
  for (const z of [fb.minZ + 0.18, fb.maxZ - 0.18])
    for (let i = 0; i < 8; i++) {
      const x0 = fb.minX + (i / 8) * (fb.maxX - fb.minX),
        x1 = fb.minX + ((i + 1) / 8) * (fb.maxX - fb.minX);
      beam(darkWood, [x0, footbridgeDeck(x0) - 0.12, z], [x1, footbridgeDeck(x1) - 0.12, z], 0.12);
    }
  for (const z of [fb.minZ + 0.06, fb.maxZ - 0.06]) {
    const rail = [];
    for (let i = 0; i <= 4; i++) {
      const x = fb.minX + 0.1 + (i / 4) * (fb.maxX - fb.minX - 0.2),
        deck = footbridgeDeck(x);
      post(darkWood, x, z, Math.min(deck, 0.1) - 0.15, deck + 0.82, 0.055);
      ball(trim, x, deck + 0.86, z, 0.075);
      rail.push([x, deck + 0.78, z]);
    }
    for (let i = 0; i < rail.length - 1; i++) {
      beam(wood[0], rail[i], rail[i + 1], 0.075);
      beam(wood[1], [rail[i][0], rail[i][1] - 0.35, z], [rail[i + 1][0], rail[i + 1][1] - 0.35, z], 0.06);
    }
  }

  // The boardwalk: cross planks on two stringers, carried on posts driven
  // into the bed, with a low kerb along each edge.
  const { points, halfWidth } = M.boardwalk;
  let along = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i],
      [bx, bz] = points[i + 1],
      dx = bx - ax,
      dz = bz - az,
      length = Math.hypot(dx, dz),
      heading = Math.atan2(dx, dz),
      // Across the boardwalk, to its right.
      sx = dz / length,
      sz = -dx / length,
      at = (t) => [ax + dx * t, az + dz * t];
    for (let d = 0.11; d < length; d += 0.23) {
      const [x, z] = at(d / length),
        deck = boardwalkDeck(along + d),
        slope = (boardwalkDeck(along + d + 0.05) - boardwalkDeck(along + d - 0.05)) / 0.1;
      box(pick(boards), x + range(-0.015, 0.015), deck - 0.03, z, halfWidth * 2, 0.06, 0.2, heading + range(-0.02, 0.02), -Math.atan(slope));
    }
    // Stringers and kerbs, a piece every half metre so they follow the ramps.
    const pieces = Math.ceil(length / 0.5);
    for (let j = 0; j < pieces; j++) {
      const t0 = j / pieces,
        t1 = (j + 1) / pieces,
        [x0, z0] = at(t0),
        [x1, z1] = at(t1),
        h0 = boardwalkDeck(along + t0 * length),
        h1 = boardwalkDeck(along + t1 * length);
      for (const side of [-1, 1]) {
        const o = side * (halfWidth - 0.1),
          k0 = side * (halfWidth - 0.03);
        beam(darkWood, [x0 + sx * o, h0 - 0.11, z0 + sz * o], [x1 + sx * o, h1 - 0.11, z1 + sz * o], 0.1);
        beam(weathered, [x0 + sx * k0, h0 + 0.03, z0 + sz * k0], [x1 + sx * k0, h1 + 0.03, z1 + sz * k0], 0.06);
      }
    }
    // Posts, wherever the deck stands clear of the ground.
    for (let d = 0.5; d < length; d += 1.5) {
      const [x, z] = at(d / length),
        deck = boardwalkDeck(along + d);
      for (const side of [-1, 1]) {
        const px = x + sx * side * (halfWidth - 0.04),
          pz = z + sz * side * (halfWidth - 0.04),
          ground = marshGround(px, pz);
        if (deck - ground > 0.12) post(weathered, px, pz, ground - 0.1, deck - 0.05, 0.065);
      }
    }
    along += length;
  }
  const mesh = k.mesh("Marsh footbridge and boardwalk", material);
  k.dispose();
  return [mesh];
}

function hideAndBench(T, range, material) {
  const k = createKit(T, { segments: 10, sphereDetail: 2 }),
    { box, post, beam, ball } = k;
  const pick = (list) => list[Math.floor(range(0, list.length))];

  // The bird hide: a weatherboarded hut on stilts, its viewing slot over the
  // water under a propped shutter, its door at the back up two steps, and a
  // turf roof sloping away from the water.
  const h = M.hide,
    hw = h.w / 2,
    hd = h.d / 2,
    floor = h.floor,
    front = h.z - hd,
    back = h.z + hd,
    frontTop = 2.35,
    backTop = 2.0,
    walls = ["#6b5a45", "#665641", "#72604a"],
    slotLow = floor + 0.78,
    slotHigh = floor + 1.06;
  for (const x of [h.x - hw + 0.12, h.x, h.x + hw - 0.12])
    for (const z of [front + 0.12, back - 0.12])
      post(weathered, x, z, marshGround(x, z) - 0.1, floor, 0.08);
  box(darkWood, h.x, floor - 0.06, h.z, h.w + 0.1, 0.1, h.d + 0.1);
  // Side walls of vertical boards, cut to the roof's slope.
  for (const side of [-1, 1])
    for (let z = front; z < back - 0.05; z += 0.22) {
      const t = (z + 0.11 - front) / h.d,
        top = frontTop + (backTop - frontTop) * t;
      box(pick(walls), h.x + side * hw, (floor + top) / 2, z + 0.11, 0.08, top - floor, 0.21);
    }
  // The back wall, with the door in its middle.
  for (let x = h.x - hw; x < h.x + hw - 0.05; x += 0.22)
    box(pick(walls), x + 0.11, (floor + backTop) / 2, back, 0.21, backTop - floor, 0.08);
  box(darkWood, h.x, floor + 0.78, back + 0.05, 0.78, 1.5, 0.05);
  box("#57663f", h.x, floor + 0.78, back + 0.07, 0.64, 1.36, 0.04);
  ball("#c9a85a", h.x + 0.22, floor + 0.8, back + 0.1, 0.03);
  // Steps up to the door.
  const stepGround = marshGround(h.x, back + 0.4);
  box(pick(wood), h.x, stepGround + (floor - stepGround) * 0.33, back + 0.42, 0.9, 0.06, 0.28);
  box(pick(wood), h.x, stepGround + (floor - stepGround) * 0.66, back + 0.22, 0.9, 0.06, 0.26);
  for (const side of [-1, 1]) beam(darkWood, [h.x + side * 0.42, stepGround, back + 0.56], [h.x + side * 0.42, floor - 0.04, back + 0.06], 0.07);
  // The front: boards below and above the long viewing slot, dark within.
  for (let x = h.x - hw; x < h.x + hw - 0.05; x += 0.22) {
    box(pick(walls), x + 0.11, (floor + slotLow) / 2, front, 0.21, slotLow - floor, 0.08);
    box(pick(walls), x + 0.11, (slotHigh + frontTop) / 2, front, 0.21, frontTop - slotHigh, 0.08);
  }
  box("#2b2722", h.x, (slotLow + slotHigh) / 2, front + 0.12, h.w - 0.3, slotHigh - slotLow, 0.04);
  box(darkWood, h.x, slotLow - 0.02, front - 0.06, h.w - 0.2, 0.05, 0.16);
  // The shutter, hinged at the slot's top and propped open over the water.
  box(pick(walls), h.x, slotHigh + 0.1, front - 0.17, h.w - 0.3, 0.05, 0.36, 0, 0.6);
  for (const side of [-1, 1]) beam(darkWood, [h.x + side * 1.1, slotLow, front - 0.06], [h.x + side * 1.1, slotHigh + 0.18, front - 0.31], 0.03);
  // The roof: boards under a mossy turf, overhanging every side.
  const pitch = Math.atan2(frontTop - backTop, h.d),
    run = Math.hypot(frontTop - backTop, h.d) + 0.5;
  box(darkWood, h.x, (frontTop + backTop) / 2 + 0.03, h.z, h.w + 0.5, 0.08, run, 0, pitch);
  box("#6f8a52", h.x, (frontTop + backTop) / 2 + 0.11, h.z, h.w + 0.4, 0.1, run - 0.1, 0, pitch);
  for (let i = 0; i < 14; i++) {
    const t = range(0.05, 0.95),
      z = front - 0.2 + t * (h.d + 0.4),
      y = frontTop + (backTop - frontTop) * ((z - front) / h.d) + 0.17;
    ball(pick(["#7e9a5c", "#64804a", "#8aa363", "#d9cf8a"]), h.x + range(-hw, hw), y, z, range(0.07, 0.13), range(0.04, 0.07));
  }

  // A bench by the east trail, looking west over the mere.
  const bench = M.bench,
    benchGround = marshGround(bench.x, bench.z);
  k.placed(bench.x, benchGround, bench.z, bench.turn, () => {
    for (const zz of [-0.22, 0, 0.22]) box(pick(wood), 0, 0.55, zz, 1.8, 0.09, 0.16);
    for (const yy of [0.9, 1.12]) box(pick(wood), 0, yy, -0.33, 1.8, 0.15, 0.08);
    for (const xx of [-0.7, 0.7]) {
      box(darkWood, xx, 0.27, 0, 0.12, 0.6, 0.56);
      box(darkWood, xx, 0.78, -0.33, 0.1, 0.86, 0.1);
    }
  });
  // A nest box on a pole beside the bench.
  const nest = { x: bench.x + 0.4, z: bench.z - 1.6 };
  post(darkWood, nest.x, nest.z, marshGround(nest.x, nest.z) - 0.1, 2.1, 0.045);
  k.placed(nest.x, 2.1, nest.z, -Math.PI / 2, () => {
    box("#8a7456", 0, 0.16, 0, 0.24, 0.32, 0.22);
    box(darkWood, 0, 0.35, 0.02, 0.3, 0.04, 0.3, 0, -0.25);
    box("#2b2722", 0, 0.2, 0.115, 0.07, 0.07, 0.01);
  });

  const mesh = k.mesh("Marsh hide and bench", material);
  k.dispose();
  return [mesh];
}

// --- Weeping willows ----------------------------------------------------------

const WILLOW_LEAVES = ["#567c58", "#6b925b", "#82a464", "#9ab577", "#739659"];

/**
 * Builds willows a tree per slice (`first` numbers the first of them), then
 * returns their three meshes:
 * wood, the leaves, and the distant crowns. (No shady shells inside the
 * crowns, as other trees have: through a willow's thin curtains they show as
 * dark balls.) Each willow's limbs arch up and out from a short leaning trunk, and
 * curtains of leafy strands hang from them almost to the ground.
 */
function willowBuilder(T, world, side, trees, first = 0) {
  const { materials, blades } = world.trees,
    leafMaterials = materials.grounded(new T.Vector4(0, 0, -1e4, 0)),
    wood = [],
    leaves = [],
    crownClusters = [],
    leafColors = WILLOW_LEAVES.map((c) => new T.Color(c)),
    axis = new T.Vector3(0, 0, 1);
  let next = 0;
  function leaf(position, direction, size, color, base, rand) {
    const quaternion = new T.Quaternion()
      .setFromUnitVectors(axis, direction.normalize())
      .multiply(new T.Quaternion().setFromAxisAngle(axis, (rand() - 0.5) * 2));
    leaves.push({
      position,
      quaternion,
      scale: new T.Vector3(0.49, 1, 1).multiplyScalar(size),
      color: color
        .clone()
        .offsetHSL((rand() - 0.5) * 0.03, (rand() - 0.5) * 0.06, (rand() - 0.5) * 0.08),
      lift: base,
    });
  }
  // Builds a tree a bough at a time, pausing (yield) after each.
  function* build(tree, index) {
    const rand = chunkRandom(index, side === "west" ? 61 : 67, 13),
      range = (a, b) => a + (b - a) * rand(),
      s = tree.scale,
      base = marshGround(tree.x, tree.z) - 0.04,
      at = (x, y, z) => new T.Vector3(tree.x + x * s, base + y * s, tree.z + z * s),
      curve = (points) => new T.CatmullRomCurve3(points.map((p) => at(...p))),
      lx = Math.cos(tree.lean) * 0.6,
      lz = Math.sin(tree.lean) * 0.6,
      trunkTop = 2.1,
      rotation = range(0, TAU);
    // A short, stout trunk leaning toward the water, flaring at its foot.
    limb(T, curve([[0, -0.05, 0], [lx * 0.2, 0.8, lz * 0.2], [lx * 0.65, 1.6, lz * 0.65], [lx, trunkTop, lz]]), 0.3 * s, 0.17 * s, 8, 10, wood);
    for (let i = 0; i < 4; i++) {
      const a = rotation + (i * TAU) / 4 + range(-0.3, 0.3);
      limb(T, curve([[0, 0.4, 0], [Math.cos(a) * 0.3, 0.1, Math.sin(a) * 0.3], [Math.cos(a) * 0.55, -0.04, Math.sin(a) * 0.55]]), 0.12 * s, 0.04 * s, 4, 6, wood);
    }
    const tops = [];
    const limbs = 6;
    for (let i = 0; i < limbs; i++) {
      const a = rotation + (i * TAU) / limbs + range(-0.3, 0.3),
        reach = range(1.5, 2.1),
        height = range(3.3, 4),
        out = [Math.cos(a), Math.sin(a)],
        end = [lx + out[0] * reach, height, lz + out[1] * reach],
        middle = [lx + out[0] * reach * 0.35, trunkTop + (height - trunkTop) * 0.82, lz + out[1] * reach * 0.35],
        bough = curve([[lx, trunkTop - 0.1, lz], middle, end]);
      limb(T, bough, 0.12 * s, 0.035 * s, 6, 6, wood);
      // The crown's top: a cluster at the bough's end and one along it, so
      // the clusters close into one dome.
      const along = bough.getPointAt(0.55);
      tops.push(
        { at: end, radius: range(0.7, 0.85) },
        {
          at: [(along.x - tree.x) / s, (along.y - base) / s + 0.25, (along.z - tree.z) / s],
          radius: range(0.6, 0.72),
        },
      );
      // The curtain: strands springing from the bough's outer half, arching
      // out a little, then hanging.
      const strands = 9;
      let low = Infinity;
      for (let k = 0; k < strands; k++) {
        const start = bough.getPointAt(0.42 + 0.58 * (k / (strands - 1))),
          sa = a + range(-0.75, 0.75),
          ox = Math.cos(sa),
          oz = Math.sin(sa),
          drop = range(1.7, 2.7) * s,
          tipY = Math.max(start.y - drop, base + 0.45, M.surface + 0.25),
          spread = range(0.35, 0.7) * s,
          tip = new T.Vector3(start.x + ox * spread, tipY, start.z + oz * spread),
          arch = start.clone().lerp(tip, 0.25).add(new T.Vector3(ox * 0.12 * s, 0.22 * s, oz * 0.12 * s)),
          strand = new T.CatmullRomCurve3([start, arch, tip]);
        limb(T, strand, 0.014 * s, 0.003 * s, 6, 3, wood);
        low = Math.min(low, tipY);
        const nodes = 11;
        for (let n = 1; n <= nodes; n++) {
          const point = strand.getPointAt(n / nodes);
          for (const sideOf of [-1, 1]) {
            const turn = sa + sideOf * 1.2;
            leaf(
              point.clone().add(new T.Vector3(Math.cos(turn) * 0.03, 0, Math.sin(turn) * 0.03)),
              new T.Vector3(Math.cos(turn) * 0.45 + ox * 0.25, -1, Math.sin(turn) * 0.45 + oz * 0.25),
              range(0.22, 0.32) * s,
              leafColors[(index + i + n) % leafColors.length],
              base,
              rand,
            );
          }
        }
      }
      // The curtain's distant crown: a tall shell around the hanging leaves.
      const curtain = at(...end).add(new T.Vector3(Math.cos(a) * 0.35 * s, 0, Math.sin(a) * 0.35 * s));
      curtain.y = (curtain.y + low) / 2;
      crownClusters.push({ center: curtain, radius: 0.8 * s, color: leafColors[(index + i) % leafColors.length] });
      yield;
    }
    tops.push({ at: [lx, 4.1, lz], radius: 0.95 });
    // The crown's top: leaves spread over each cluster's outer layer.
    for (const [c, cluster] of tops.entries()) {
      const center = at(...cluster.at),
        radius = cluster.radius * s,
        baseColor = leafColors[(index + c) % leafColors.length];
      crownClusters.push({ center, radius, color: baseColor });
      const count = 84;
      for (let j = 0; j < count; j++) {
        const y = 1 - (2 * (j + 0.5)) / count,
          ring = Math.sqrt(1 - y * y),
          a = j * 2.39996 + c * 0.7 + rotation,
          direction = new T.Vector3(Math.cos(a) * ring, y * 0.8 - 0.35, Math.sin(a) * ring),
          depth = range(0.7, 1.04);
        leaf(
          center.clone().add(new T.Vector3(Math.cos(a) * ring * radius * depth, y * radius * 0.8 * depth, Math.sin(a) * ring * radius * depth)),
          direction,
          range(0.22, 0.3) * s,
          baseColor,
          base,
          rand,
        );
      }
      if (c % 4 === 3) yield;
    }
  }
  let building = null;
  return (deadline) => {
    while (next < trees.length) {
      building ??= build(trees[next], first + next);
      if (building.next().done) {
        building = null;
        next++;
      }
      if (performance.now() > deadline) return null;
    }
    // Merging and instancing run in a slice of their own.
    if (next++ === trees.length) return null;
    const name = trees.length === 1 ? `Willow (${side} ${first + 1})` : `Willows (${side})`;
    const woodGeometry = mergeGeometries(wood, false);
    for (const part of wood) part.dispose();
    woodGeometry.computeBoundingSphere();
    const woodMesh = new T.Mesh(woodGeometry, materials.wood);
    woodMesh.name = `${name}: bark and boughs`;
    const ordered = [...leaves.filter((_, i) => i % 2 === 0), ...leaves.filter((_, i) => i % 2)],
      lift = new T.InstancedBufferAttribute(Float32Array.from(ordered, (l) => l.lift), 1),
      fine = blades.fine.clone(),
      coarse = blades.coarse.clone();
    fine.setAttribute("groundLift", lift);
    coarse.setAttribute("groundLift", lift);
    const leafMesh = new T.InstancedMesh(fine, leafMaterials.leaf, ordered.length),
      dummy = new T.Object3D();
    ordered.forEach((record, i) => {
      dummy.position.copy(record.position);
      dummy.quaternion.copy(record.quaternion);
      dummy.scale.copy(record.scale);
      dummy.updateMatrix();
      leafMesh.setMatrixAt(i, dummy.matrix);
      leafMesh.setColorAt(i, record.color);
    });
    leafMesh.customDepthMaterial = leafMaterials.depth;
    leafMesh.userData.fine = fine;
    leafMesh.userData.coarse = coarse;
    leafMesh.name = `${name}: leaves`;
    leafMesh.castShadow = true;
    // Willows' distant crowns hang lower than they spread.
    const crownMesh = crownShells(crownClusters, 1.3, materials.crown, new T.IcosahedronGeometry(1, 1));
    crownMesh.name = `${name}: distant crowns`;
    for (const mesh of [woodMesh, leafMesh, crownMesh]) {
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
    }
    woodMesh.castShadow = true;
    return [woodMesh, leafMesh, crownMesh];
  };
}

// --- Reeds ---------------------------------------------------------------------

// Clear of the boardwalk, the hide, the footbridge and the heron's shallows.
function reedsAllowed(x, z) {
  if (M.boardwalk.points.some(([px, pz]) => Math.hypot(x - px, z - pz) < 1.1)) return false;
  const { points } = M.boardwalk;
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i],
      [bx, bz] = points[i + 1],
      ex = bx - ax,
      ez = bz - az,
      t = Math.min(1, Math.max(0, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez)));
    if (Math.hypot(x - ax - ex * t, z - az - ez * t) < M.boardwalk.halfWidth + 0.45) return false;
  }
  const h = M.hide;
  if (Math.abs(x - h.x) < h.w / 2 + 0.7 && z > h.z - h.d / 2 - 1.4 && z < h.z + h.d / 2 + 1.2) return false;
  if (z < M.footbridge.maxZ + 0.6) return false;
  if (trailDistance(x, z, 1.5) < M.trailHalfWidth + 0.35) return false;
  return true;
}

/** Where the marsh's reeds grow: beds round the mere, on its islands and along the brook. */
function reedPlacements(range) {
  const placements = [],
    plant = (x, z, count, spread) => {
      for (let k = 0; k < count; k++) {
        const px = x + range(-spread, spread),
          pz = z + range(-spread, spread);
        if (reedsAllowed(px, pz)) placements.push({ x: px, z: pz, height: range(0.45, 0.95) });
      }
    };
  // Beds round the shore, dense in places, thin in others: from the dry bank
  // out into the shallows.
  const heron = M.heron;
  for (let angle = -Math.PI; angle < Math.PI; angle += 0.055) {
    const bed = 0.5 + 0.5 * Math.sin(angle * 4 + 1.2) * Math.sin(angle * 7 + 0.4);
    if (range(0, 1) > 0.25 + bed * 0.75) continue;
    // The heron's shallows stay open water.
    const open = angle > heron.from - 0.1 && angle < heron.to + 0.1;
    const [x, z] = shorePoint(angle, open ? range(-0.9, -0.1) : range(-0.7, 0.9));
    if (z < 26.2 && Math.abs(x - M.brookX) < 3.4) continue;
    plant(x, z, Math.round(range(2, 4)), 0.28);
  }
  // The islands are reed from shore to shore.
  for (const island of M.islands)
    for (let c = 0; c < island.r * 14; c++) {
      const a = range(0, TAU),
        r = Math.sqrt(range(0, 1)) * (island.r + 0.25);
      plant(island.x + Math.cos(a) * r, island.z + Math.sin(a) * r, 2, 0.18);
    }
  // Clumps along the brook's banks, in its shallows.
  for (let z = 22.6; z < 26.5; z += 0.45)
    for (const sideOf of [-1, 1])
      if (range(0, 1) < 0.6) plant(M.brookX + sideOf * (brookEdge(z) + range(-0.25, 0.35)), z, 2, 0.15);
  // A few stragglers out in the wet meadow.
  for (let i = 0; i < 26; i++) {
    const [x, z] = shorePoint(range(-Math.PI, Math.PI), range(-3.2, -1.4));
    plant(x, z, 2, 0.2);
  }
  return placements;
}

/** A plant at a time; the merge runs in slices of its own. */
function reedBuilder(placements) {
  // Seen from further off than the village's, they make do with fewer segments.
  const reeds = createReedBuilder((x, z) => marshGround(x, z) - 0.02, {
    blade: 8,
    stem: [6, 4],
    head: 6,
    // Small batches, so those out of view, and their shadows, are culled.
    cell: 5,
  });
  let next = 0;
  return (deadline) => {
    while (next < placements.length) {
      for (let i = 0; i < REEDS_PER_SLICE && next < placements.length; i++) reeds.add(placements[next++]);
      if (performance.now() > deadline) return null;
    }
    if (!reeds.merge(deadline)) return null;
    reeds.group.name = "Marsh reeds";
    reeds.group.userData.update = reeds.update;
    return [reeds.group];
  };
}

// --- Lilies and flowers ------------------------------------------------------------

function lilies(T, range) {
  const pads = new T.InstancedMesh(
      new T.CircleGeometry(0.24, 12, 0, Math.PI * 1.82).rotateX(-Math.PI / 2),
      new T.MeshStandardMaterial({ roughness: 0.7 }),
      80,
    ),
    blooms = new T.InstancedMesh(
      new T.IcosahedronGeometry(1, 1),
      new T.MeshStandardMaterial({ roughness: 0.6 }),
      26,
    ),
    dummy = new T.Object3D(),
    greens = ["#6d8f63", "#628759", "#789767", "#5b7c54"].map((c) => new T.Color(c)),
    flowers = ["#f6f1e6", "#f1dce4", "#f3e7b0"].map((c) => new T.Color(c));
  // Beds in the calm bays, clear of the boardwalk and the heron.
  const beds = [
    [12, 31.2, 1.3, 22],
    [17.8, 32.4, 1.3, 22],
    [15.2, 28.2, 0.9, 14],
    [10.8, 27, 0.8, 10],
    [20, 31.4, 0.7, 8],
  ];
  let p = 0,
    f = 0;
  for (const [bx, bz, radius, n] of beds)
    for (let k = 0; k < n && p < pads.count; k++) {
      const a = range(0, TAU),
        r = radius * Math.sqrt(range(0, 1)),
        x = bx + Math.cos(a) * r,
        z = bz + Math.sin(a) * r * 0.75;
      if (marshShore(x, z) < 0.5 || !reedsAllowed(x, z)) continue;
      const size = range(0.7, 1.3);
      dummy.position.set(x, M.surface + 0.012, z);
      dummy.rotation.set(0, range(0, TAU), 0);
      dummy.scale.set(size, 1, size);
      dummy.updateMatrix();
      pads.setMatrixAt(p, dummy.matrix);
      pads.setColorAt(p++, greens[Math.floor(range(0, greens.length))]);
      if (f < blooms.count && range(0, 1) < 0.3) {
        dummy.position.set(x + range(-0.05, 0.05), M.surface + 0.05, z + range(-0.05, 0.05));
        dummy.scale.set(0.075, 0.028, 0.075);
        dummy.updateMatrix();
        blooms.setMatrixAt(f, dummy.matrix);
        blooms.setColorAt(f++, flowers[Math.floor(range(0, flowers.length))]);
      }
    }
  pads.count = p;
  blooms.count = f;
  pads.name = "Marsh lily pads";
  blooms.name = "Marsh lily flowers";
  for (const mesh of [pads, blooms]) {
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.computeBoundingSphere();
  }
  return [pads, blooms];
}

// Purple loosestrife spikes and yellow flag irises in the wet meadow.
function flowers(T, range) {
  const spikes = new T.InstancedMesh(
      new T.ConeGeometry(1, 1, 6).translate(0, 0.5, 0),
      new T.MeshStandardMaterial({ roughness: 0.8 }),
      90,
    ),
    irises = new T.InstancedMesh(
      new T.IcosahedronGeometry(1, 1),
      new T.MeshStandardMaterial({ roughness: 0.7 }),
      70,
    ),
    dummy = new T.Object3D(),
    purples = ["#b1599a", "#c26fae", "#9d4f8c", "#cf86b8"].map((c) => new T.Color(c)),
    yellows = ["#e8c64a", "#f0d564", "#dcb43c"].map((c) => new T.Color(c));
  let s = 0,
    y = 0;
  for (let tries = 0; tries < 900 && (s < spikes.count || y < irises.count); tries++) {
    const [cx, cz] = shorePoint(range(-Math.PI, Math.PI), range(-2.6, -0.4));
    if (!reedsAllowed(cx, cz) || cz > 38.5) continue;
    for (let k = 0; k < 3; k++) {
      const x = cx + range(-0.4, 0.4),
        z = cz + range(-0.4, 0.4),
        ground = marshGround(x, z);
      if (marshShore(x, z) > -0.3) continue;
      if (range(0, 1) < 0.55 && s < spikes.count) {
        const height = range(0.45, 0.8);
        dummy.position.set(x, ground + 0.25, z);
        dummy.rotation.set(range(-0.1, 0.1), 0, range(-0.1, 0.1));
        dummy.scale.set(0.055, height, 0.055);
        dummy.updateMatrix();
        spikes.setMatrixAt(s, dummy.matrix);
        spikes.setColorAt(s++, purples[Math.floor(range(0, purples.length))]);
      } else if (y < irises.count) {
        dummy.position.set(x, ground + range(0.42, 0.58), z);
        dummy.rotation.set(0, range(0, TAU), 0);
        dummy.scale.set(0.06, 0.04, 0.06);
        dummy.updateMatrix();
        irises.setMatrixAt(y, dummy.matrix);
        irises.setColorAt(y++, yellows[Math.floor(range(0, yellows.length))]);
      }
    }
  }
  spikes.count = s;
  irises.count = y;
  spikes.name = "Marsh loosestrife";
  irises.name = "Marsh flag irises";
  for (const mesh of [spikes, irises]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.computeBoundingSphere();
  }
  return [spikes, irises];
}

// --- The heron -----------------------------------------------------------------

/**
 * A grey heron wading the north-east shallows: it steps to a new spot every
 * so often, stands, and now and then strikes at a fish, which ripples the
 * water. Its neck is a mesh of its own that bends for the strike.
 */
function heron(T) {
  const k = createKit(T, { segments: 8, sphereDetail: 2 }),
    { ball, rod } = k,
    grey = "#9aa3a6",
    wing = "#7c868b",
    pale = "#e3e5df",
    legs = "#8f805c",
    beak = "#d6ad45",
    black = "#2c2f31";
  // The body, facing +z, its feet at the origin.
  for (const side of [-1, 1]) {
    rod(legs, [side * 0.05, 0, 0.02], [side * 0.05, 0.46, 0], 0.012);
    rod(legs, [side * 0.05, 0.002, 0.02], [side * 0.05, 0.002, 0.11], 0.008);
  }
  ball(grey, 0, 0.6, 0, 0.13, 0.13, 0.25);
  ball(wing, 0, 0.64, -0.03, 0.14, 0.11, 0.24);
  ball(wing, 0, 0.6, -0.27, 0.07, 0.04, 0.09);
  ball(pale, 0, 0.6, 0.15, 0.1, 0.11, 0.1);
  // The neck, its own layer, built about its base.
  const neck = k.layer();
  k.into(neck, () => {
    const points = [
      [0, 0, 0],
      [0, 0.12, 0.05],
      [0, 0.22, 0.01],
      [0, 0.31, 0.06],
    ];
    for (let i = 0; i < points.length - 1; i++) rod(pale, points[i], points[i + 1], 0.034);
    ball(pale, 0, 0.12, 0.05, 0.036);
    ball(pale, 0, 0.22, 0.01, 0.036);
    ball(pale, 0, 0.33, 0.08, 0.045, 0.045, 0.065);
    ball(black, 0, 0.355, 0.05, 0.02, 0.012, 0.07);
    ball(black, 0, 0.35, 0.0, 0.012, 0.008, 0.06);
    k.add(k.unit.cone, beak, 0, 0.33, 0.19, 0.018, 0.14, 0.018, Math.PI / 2);
    ball(black, 0.03, 0.34, 0.1, 0.008);
    ball(black, -0.03, 0.34, 0.1, 0.008);
  });
  const material = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
    body = new T.Mesh(k.geometry(), material),
    head = new T.Mesh(k.geometry(neck), material);
  k.dispose();
  body.name = "Marsh heron";
  head.name = "Marsh heron's neck";
  for (const mesh of [body, head]) mesh.castShadow = mesh.receiveShadow = true;
  head.position.set(0, 0.68, 0.18);
  body.add(head);
  // Where it wades: spots along the shallows, a step or two apart.
  const { from, to, depth } = M.heron,
    spot = (n) => {
      const u = 0.5 + 0.45 * Math.sin(n * 2.3 + 0.7) * Math.cos(n * 0.9);
      return shorePoint(from + (to - from) * u, depth);
    },
    centre = M.centre,
    PERIOD = 14,
    WALK = 4,
    STRIKE = 7.2;
  let struck = -1;
  const headingAt = (from, to, fallback) =>
    Math.hypot(to[0] - from[0], to[1] - from[1]) < 1e-3 ? fallback : Math.atan2(to[0] - from[0], to[1] - from[1]);
  const lerpAngle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
  function walk(clock, water) {
    const n = Math.floor(clock / PERIOD),
      phase = clock - n * PERIOD,
      a = spot(n),
      b = spot(n + 1),
      t = smooth(0, WALK, phase),
      x = a[0] + (b[0] - a[0]) * t,
      z = a[1] + (b[1] - a[1]) * t,
      facing = (p) => Math.atan2(centre.x - p[0], centre.z - p[1]),
      stride = headingAt(a, b, facing(b));
    // Turns from the water to its way, walks, then turns back to the water.
    let heading = lerpAngle(facing(a), stride, smooth(0, 0.8, phase));
    heading = lerpAngle(heading, facing(b), smooth(WALK - 0.4, WALK + 0.8, phase));
    const stepping = phase < WALK ? Math.abs(Math.sin(phase * Math.PI * 1.6)) : 0;
    body.position.set(x, marshGround(x, z) + 0.02 + stepping * 0.015, z);
    body.rotation.y = heading;
    // The strike: the neck darts forward and down, and back.
    const s = phase > STRIKE && phase < STRIKE + 0.9 ? Math.sin(((phase - STRIKE) / 0.9) * Math.PI) : 0;
    head.rotation.x = s * 1.25 + (phase > WALK ? Math.sin(clock * 0.7) * 0.05 : 0.25 * stepping);
    if (s > 0.9 && struck !== n) {
      struck = n;
      water?.disturb("marsh", x + Math.sin(heading) * 0.45, z + Math.cos(heading) * 0.45, 0.02, 0.1);
    }
  }
  walk(0, null);
  body.userData.walk = walk;
  return [body];
}

// --- Fireflies -----------------------------------------------------------------

/**
 * Fireflies over the reeds and the wet meadow: unseen by day, they come out
 * as blue hour falls, drifting and blinking. Their matrices update only
 * while they show.
 */
function fireflies(T, range) {
  const count = 80,
    mesh = new T.InstancedMesh(
      new T.IcosahedronGeometry(0.045, 0),
      new T.MeshBasicMaterial({
        // Brighter than white, so the bloom gathers a halo round each.
        color: new T.Color("#f3f7a4").multiplyScalar(3),
        transparent: true,
        // Clear until blue hour; drawn from the start, so its shader
        // compiles while streaming rather than on the first dusk.
        opacity: 0,
        blending: T.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
      count,
    ),
    dummy = new T.Object3D(),
    flies = [];
  for (let i = 0; i < count; i++) {
    const [x, z] = shorePoint(range(-Math.PI, Math.PI), range(-2.4, 1.2));
    flies.push({
      x,
      z,
      y: Math.max(marshGround(x, z), M.surface) + range(0.35, 1.5),
      speed: range(0.25, 0.6),
      phase: range(0, TAU),
      blink: range(1.4, 3.2),
    });
  }
  mesh.name = "Marsh fireflies";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.matrixAutoUpdate = false;
  mesh.frustumCulled = true;
  const place = (time, level) => {
    flies.forEach((f, i) => {
      const glow = Math.pow(Math.max(0, Math.sin(time * f.blink + f.phase)), 3) * level;
      dummy.position.set(
        f.x + Math.sin(time * f.speed + f.phase) * 0.6,
        f.y + Math.sin(time * f.speed * 1.7 + f.phase * 2) * 0.25,
        f.z + Math.cos(time * f.speed * 0.8 + f.phase) * 0.6,
      );
      dummy.scale.setScalar(0.4 + glow * 0.9);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  place(0, 1);
  mesh.computeBoundingSphere();
  mesh.boundingSphere.radius += 1;
  mesh.userData.glow = (clock, dusk) => {
    const level = smooth(0.35, 0.9, dusk);
    mesh.visible = level > 0.01;
    if (!mesh.visible) return;
    mesh.material.opacity = 0.95 * level;
    place(clock, level);
  };
  return [mesh];
}
