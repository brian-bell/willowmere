// The millpond north of the village: its banks and bed, two water bodies (the
// pond above the weir and the brook below it), the weir's cascade, a
// footbridge, the fishing jetty, a boathouse, a moored boat, reeds and lilies.
// Loaded with import() once the village is on screen and built by the streamer
// a piece at a time. Its shape, colliders and ground heights live in
// millpond-layout.js, which loads with the village.
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { chunkRandom } from "../world-layout.js";
import { createReeds } from "../reeds.js";
import {
  MILLPOND as M,
  brookEdge,
  footbridgeDeck,
  millpondGround,
  pondShore,
} from "./millpond-layout.js";

// Spacing of the ground mesh's vertices, in metres.
const GROUND_STEP = 0.2;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Streamer jobs for the millpond, nearest the player first. */
export function millpondJobs(T, world) {
  const rand = chunkRandom(1, -2, 3),
    range = (a, b) => a + (b - a) * rand();
  const job = (key, x, z, step, added) => ({ key, x, z, step, added });
  return [
    job("millpond ground", 12, -28, groundBuilder(T, world), ([mesh]) =>
      world.addStreamed(mesh),
    ),
    job(
      "millpond water",
      12,
      -27,
      () => water(T, world),
      ([sheet]) => {
        world.addStreamed(sheet);
        const time = sheet.material.userData.time;
        world.animate(M.brookX, M.weir.crest, (dt, t, clock) => {
          time.value = clock;
        });
      },
    ),
    job(
      "millpond structures",
      10,
      -26,
      () => structures(T, range),
      ([mesh]) => {
        world.addStreamed(mesh);
        world.interactables.push({
          id: "jetty",
          name: "Fishing jetty",
          type: "fishing",
          x: M.jetty.x,
          z: M.jetty.minZ + 0.5,
          radius: 1.3,
        });
      },
    ),
    job("millpond stones", 12, -30, () => stones(T, range), ([mesh]) =>
      world.addStreamed(mesh),
    ),
    job("millpond lilies", 13, -31, () => lilies(T, range), (meshes) => {
      for (const mesh of meshes) {
        world.addStreamed(mesh);
        // Flat on the water, they would show in its reflection as slivers.
        world.water.excludeFromCaptures(mesh);
      }
    }),
    job("millpond reeds", 13, -32, () => reeds(range), ([group]) => {
      for (const mesh of group.children) world.addStreamed(mesh);
      const update = group.userData.update;
      world.animate(M.centre.x, M.centre.z, (dt, t) => update(t));
    }),
  ];
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
  const lawn = new T.Color(1, 1, 1),
    lush = tint(T, "#78a05a"),
    earth = tint(T, "#a2926e"),
    damp = tint(T, "#6f7560"),
    sand = tint(T, "#c9b688"),
    bed = tint(T, "#6d6a50"),
    deep = tint(T, "#4d5243"),
    stoneBed = tint(T, "#8b9277"),
    color = new T.Color();
  let row = 0;
  function colorAt(x, z, y) {
    const s = pondShore(x, z),
      across = Math.abs(x - M.brookX),
      brook = z > M.weir.downstream && across < brookEdge(z) + 1.05;
    // Mottled patches of sand and earth along the waterline.
    const patch =
      Math.sin(x * 0.9 + 1.3) * Math.sin(z * 1.1 - 0.4) +
      0.4 * Math.sin(x * 2.3 + z * 1.7);
    if (brook) {
      const u = (across - brookEdge(z)) / 1.05;
      if (u < 0) return color.copy(stoneBed).lerp(damp, 0.3);
      return color.copy(damp).lerp(earth, smooth(0, 0.4, u)).lerp(lawn, smooth(0.35, 1, u));
    }
    if (s > 0.25) {
      // Under water: mud deepening to a dark bed.
      return color.copy(bed).lerp(deep, smooth(0.4, 2.6, s));
    }
    if (s > -0.8) {
      // The waterline: damp earth, with sandy patches.
      color.copy(damp).lerp(earth, smooth(0.2, -0.5, s));
      if (patch > 0.55) color.lerp(sand, smooth(0.55, 0.9, patch) * 0.85);
      return color.lerp(lush, smooth(-0.45, -0.8, s));
    }
    // The bank's crest is a touch lusher, fading to the plain lawn.
    return color.copy(lush).lerp(lawn, smooth(-1.2, -3.2, s));
  }
  return (deadline) => {
    for (; row < rows; row++) {
      if (performance.now() > deadline) return null;
      const z = minZ + row * GROUND_STEP;
      for (let col = 0; col < cols; col++) {
        const x = minX + col * GROUND_STEP,
          y = millpondGround(x, z),
          i = row * cols + col;
        positions.set([x, y, z], i * 3);
        uvs.set([x / 33.5, -z / 41.6], i * 2);
        // The mesh's edge stays plain lawn, to meet the fields' grass.
        const edge = col === 0 || row === 0 || col === cols - 1 || row === rows - 1;
        (edge ? color.copy(lawn) : colorAt(x, z, y)).toArray(colors, i * 3);
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
    mesh.name = "Millpond banks and bed";
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    return mesh;
  };
}

// --- Water ----------------------------------------------------------------

// The pond's body spans the water above the weir; the brook's runs from the
// weir's foot to the village's brook, which it meets under the footbridge.
const POND_BOX = { minX: 3.6, maxX: 21.8, minZ: -36.8, maxZ: M.weir.crest };

function water(T, world) {
  const pondX = (POND_BOX.minX + POND_BOX.maxX) / 2,
    pondZ = (POND_BOX.minZ + POND_BOX.maxZ) / 2;
  world.water.addBody({
    id: "millpond",
    x: pondX,
    y: M.surface,
    z: pondZ,
    size: [POND_BOX.maxX - POND_BOX.minX, POND_BOX.maxZ - POND_BOX.minZ],
    shore: (x, z) => pondShore(x + pondX, z + pondZ),
    depth: M.depth,
    ramp: 2.2,
    openEnds: false,
    // About 16 cm cells: still water needs less than the brook's 6.6 cm.
    grid: [112, 78],
    segments: [72, 50],
    amplitude: 0.006,
    absorption: [1.25, 0.52, 0.4],
    scatter: "#2d5e55",
    roughness: 0.14,
    // Still water changes slowly; refresh its reflection a third as often.
    reflectionEvery: 3,
  });
  const brookZ = (M.brook.minZ + M.brook.maxZ) / 2;
  world.water.addBody({
    id: "brook-north",
    x: M.brookX,
    y: M.brookSurface,
    z: brookZ,
    size: [4.2, M.brook.maxZ - M.brook.minZ],
    // The same edge as the village's brook, so the two meet without a step.
    shore: (x, z) => brookEdge(z + brookZ) - Math.abs(x),
    depth: 0.82,
    flow: 0.44,
    amplitude: 0.024,
    grid: [64, 48],
    segments: [48, 36],
  });
  // White water where the cascade lands.
  for (let i = 0; i < 6; i++)
    world.water.addSource("brook-north", {
      x: 10.35 + i * 0.66,
      z: M.weir.downstream + 0.62,
      radius: 0.16,
      strength: 0.01,
      interval: 0.19 + (i % 3) * 0.03,
      phase: i * 0.07,
    });
  return cascade(T);
}

// A sheet of water over the weir's crest and down its sloping face.
function cascade(T) {
  const width = 4.1,
    across = 24,
    along = 10,
    positions = [],
    uvs = [],
    index = [];
  for (let j = 0; j <= along; j++) {
    const t = j / along,
      z = M.weir.crest + t * 0.92,
      // Leaves the crest level, then curls down the face to the brook.
      y = M.surface + 0.004 - (M.surface - M.brookSurface - 0.006) * smooth(0.12, 1, t);
    for (let i = 0; i <= across; i++) {
      const u = i / across;
      positions.push(M.brookX - width / 2 + u * width, y, z);
      uvs.push(u, t);
      if (i < across && j < along) {
        const a = j * (across + 1) + i,
          b = a + across + 1;
        index.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  const time = { value: 0 };
  const material = new T.MeshStandardMaterial({
    color: "#dcebe4",
    roughness: 0.25,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  material.userData.time = time;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCascadeTime = time;
    shader.vertexShader = "varying vec2 vCascade;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvCascade = uv;",
    );
    shader.fragmentShader =
      "uniform float uCascadeTime; varying vec2 vCascade;\n" + shader.fragmentShader;
    // Streaks run down the face; the foot of the fall turns to foam.
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <alphamap_fragment>",
      `#include <alphamap_fragment>
      float lane = vCascade.x * 46.0 + sin(vCascade.x * 13.0) * 2.0;
      float streak = 0.5 + 0.5 * sin(lane + sin(lane * 0.37) * 3.0)
        * sin(vCascade.y * 9.0 - uCascadeTime * 7.0 + lane * 0.21);
      float foot = smoothstep(0.55, 1.0, vCascade.y);
      diffuseColor.a *= mix(0.45 + 0.4 * streak, 0.95, foot)
        * smoothstep(0.0, 0.04, vCascade.x) * smoothstep(1.0, 0.96, vCascade.x)
        * smoothstep(0.0, 0.1, vCascade.y);
      diffuseColor.rgb = mix(diffuseColor.rgb * (0.82 + 0.18 * streak), vec3(0.93, 0.96, 0.94), foot * 0.7);`,
    );
  };
  material.customProgramCacheKey = () => "millpond-cascade";
  const mesh = new T.Mesh(geometry, material);
  mesh.name = "Millpond weir cascade";
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  return mesh;
}

// --- Structures -----------------------------------------------------------

// Every structure shares one vertex-coloured material: one draw per pass.
function structures(T, range) {
  const parts = [],
    color = new T.Color(),
    matrix = new T.Matrix4(),
    rotation = new T.Euler(),
    quaternion = new T.Quaternion(),
    position = new T.Vector3(),
    scale = new T.Vector3();
  const unitBox = new T.BoxGeometry(1, 1, 1),
    unitCylinder = new T.CylinderGeometry(1, 1, 1, 10),
    unitSphere = new T.IcosahedronGeometry(1, 2);
  function add(base, hex, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
    const geometry = base.clone();
    matrix.compose(
      position.set(x, y, z),
      quaternion.setFromEuler(rotation.set(rx, ry, rz)),
      scale.set(sx, sy, sz),
    );
    geometry.applyMatrix4(matrix);
    color.set(hex);
    const count = geometry.attributes.position.count,
      colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) color.toArray(colors, i * 3);
    geometry.setAttribute("color", new T.BufferAttribute(colors, 3));
    parts.push(geometry);
  }
  const box = (hex, x, y, z, w, h, d, ry = 0, rx = 0, rz = 0) =>
    add(unitBox, hex, x, y, z, w, h, d, rx, ry, rz);
  const post = (hex, x, z, bottom, top, r = 0.07) =>
    add(unitCylinder, hex, x, (bottom + top) / 2, z, r, top - bottom, r);
  // A beam between two points.
  const up = new T.Vector3(0, 1, 0),
    from = new T.Vector3(),
    to = new T.Vector3();
  function beam(hex, a, b, width = 0.08) {
    from.set(...a);
    to.set(...b);
    const length = from.distanceTo(to),
      geometry = unitBox.clone();
    quaternion.setFromUnitVectors(up, to.clone().sub(from).normalize());
    matrix.compose(
      position.copy(from).add(to).multiplyScalar(0.5),
      quaternion,
      scale.set(width, length, width),
    );
    geometry.applyMatrix4(matrix);
    color.set(hex);
    const count = geometry.attributes.position.count,
      colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) color.toArray(colors, i * 3);
    geometry.setAttribute("color", new T.BufferAttribute(colors, 3));
    parts.push(geometry);
  }
  const wood = ["#8a6a4a", "#7f6145", "#93724f"],
    darkWood = "#5f4c3a",
    weathered = "#9b8a72",
    stone = ["#a9a89a", "#9a9c8f", "#b3ad9b", "#8f978c"],
    trim = "#e5d8b6",
    roof = ["#7d949a", "#738b92", "#87a0a4"];
  const pick = (list) => list[Math.floor(range(0, list.length))];

  // The weir: a sill of dressed stones across the brook, wing walls into the
  // banks and a sloping apron under the cascade.
  const { weir } = M;
  for (let x = 9.35; x < 14.7; x += 0.58) {
    const top = weir.top + range(-0.015, 0.02);
    box(pick(stone), x + 0.29, top / 2 - 0.2, weir.crest, 0.56, top + 0.4, 0.52, range(-0.03, 0.03));
  }
  for (let x = 9.9; x < 14.1; x += 0.52)
    box(pick(stone), x + 0.26, 0.12, weir.downstream + 0.42, 0.5, 0.18, 0.66, 0, -0.42);
  for (const side of [-1, 1])
    for (let i = 0; i < 4; i++)
      box(
        pick(stone),
        M.brookX + side * (2.75 + i * 0.5),
        0.36 - i * 0.05,
        weir.crest + range(-0.05, 0.05),
        0.52,
        0.42,
        0.6 + i * 0.08,
        range(-0.1, 0.1),
      );

  // The footbridge: planks over a humped pair of stringers, posts and rails.
  const fb = M.footbridge,
    planks = 20;
  for (let i = 0; i < planks; i++) {
    const x = fb.minX + ((i + 0.5) / planks) * (fb.maxX - fb.minX),
      y = footbridgeDeck(x) - 0.04,
      slope = Math.atan(
        ((footbridgeDeck(x + 0.05) - footbridgeDeck(x - 0.05)) / 0.1),
      );
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
      add(unitSphere, trim, x, deck + 0.86, z, 0.075, 0.075, 0.075);
      rail.push([x, deck + 0.78, z]);
    }
    for (let i = 0; i < rail.length - 1; i++) {
      beam(wood[0], rail[i], rail[i + 1], 0.075);
      beam(wood[1], [rail[i][0], rail[i][1] - 0.35, z], [rail[i + 1][0], rail[i + 1][1] - 0.35, z], 0.06);
    }
  }

  // The jetty: planks across two stringers on posts driven into the bed.
  const j = M.jetty,
    deckY = j.deck;
  for (let z = j.maxZ - 0.1; z > j.minZ; z -= 0.21)
    box(pick(wood), j.x + range(-0.02, 0.02), deckY - 0.035, z, j.halfWidth * 2, 0.07, 0.18, range(-0.02, 0.02));
  for (const side of [-1, 1])
    box(darkWood, j.x + side * (j.halfWidth - 0.12), deckY - 0.13, (j.minZ + j.maxZ) / 2, 0.1, 0.13, j.maxZ - j.minZ);
  for (let z = j.maxZ - 0.35; z > j.minZ; z -= 1.35)
    for (const side of [-1, 1]) {
      const x = j.x + side * (j.halfWidth - 0.05),
        bottom = millpondGround(x, z) - 0.1;
      post(weathered, x, z, bottom, deckY - 0.02, 0.075);
    }
  // Mooring posts at the end, and a bucket and tackle box for the angler.
  for (const side of [-1, 1]) {
    const x = j.x + side * (j.halfWidth - 0.05),
      z = j.minZ + 0.12;
    post(weathered, x, z, millpondGround(x, z) - 0.1, deckY + 0.36, 0.085);
    add(unitCylinder, darkWood, x, deckY + 0.38, z, 0.095, 0.04, 0.095);
  }
  add(unitCylinder, "#7c8b86", j.x + 0.38, deckY + 0.13, j.minZ + 0.75, 0.13, 0.26, 0.13);
  add(unitCylinder, "#5d6966", j.x + 0.38, deckY + 0.26, j.minZ + 0.75, 0.135, 0.02, 0.135);
  box("#7a5b3f", j.x - 0.36, deckY + 0.09, j.minZ + 0.9, 0.36, 0.18, 0.24, 0.3);
  box("#9a7a52", j.x - 0.36, deckY + 0.185, j.minZ + 0.9, 0.38, 0.02, 0.26, 0.3);

  // A rowing boat moored at the jetty's east side.
  const boat = { x: j.x + 1.3, z: -28.9, y: M.surface };
  const hull = new T.SphereGeometry(1, 16, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  add(hull, "#4f7d78", boat.x, boat.y + 0.14, boat.z, 0.55, 0.34, 1.4, 0, 0.12);
  add(
    new T.TorusGeometry(1, 0.045, 5, 28).rotateX(Math.PI / 2),
    trim,
    boat.x,
    boat.y + 0.15,
    boat.z,
    0.55,
    1,
    1.4,
    0,
    0.12,
  );
  add(unitCylinder, "#a07a52", boat.x, boat.y + 0.05, boat.z, 0.5, 0.02, 1.3, 0, 0.12);
  for (const offset of [-0.45, 0.35])
    box("#8a6a4a", boat.x + Math.sin(0.12) * offset, boat.y + 0.12, boat.z + Math.cos(0.12) * offset, 0.92, 0.04, 0.22, 0.12);
  for (const side of [-1, 1])
    beam("#b59a6e", [boat.x + side * 0.2, boat.y + 0.18, boat.z + 0.9], [boat.x + side * 0.42, boat.y + 0.2, boat.z - 0.9], 0.04);
  // Its painter rope runs to the nearest mooring post.
  beam("#cdbb8f", [boat.x, boat.y + 0.18, boat.z - 1.32], [j.x + j.halfWidth - 0.05, deckY + 0.2, -29.4], 0.018);

  // The boathouse: weatherboarded walls on a stone base, its open gable over
  // the water, and a slipway into the pond.
  const h = M.boathouse,
    hw = h.width / 2,
    hd = h.depth / 2,
    floor = 0.56,
    eaves = 2.25,
    ridge = 3.25,
    front = h.z + hd,
    back = h.z - hd;
  box(pick(stone), h.x, 0.3, back + 0.9, h.width + 0.12, 0.5, 1.9);
  box("#7d6b55", h.x, floor - 0.04, h.z - 0.2, h.width - 0.2, 0.08, h.depth - 0.4);
  for (const x of [h.x - hw + 0.1, h.x + hw - 0.1])
    for (const z of [front - 0.12, front - 1.2])
      post(weathered, x, z, millpondGround(x, z) - 0.1, eaves, 0.08);
  // Side and back walls of vertical boards.
  for (const side of [-1, 1])
    for (let z = back + 0.1; z < front - 0.05; z += 0.24)
      box(pick(["#6b5442", "#735a46", "#664f3e"]), h.x + side * hw, (floor + eaves) / 2, z + 0.12, 0.08, eaves - floor, 0.23);
  for (let x = h.x - hw; x < h.x + hw - 0.05; x += 0.24)
    box(pick(["#6b5442", "#735a46", "#664f3e"]), x + 0.12, (floor + eaves) / 2, back, 0.23, eaves - floor, 0.08);
  // A small window in the east wall, facing the village.
  box(darkWood, h.x + hw + 0.05, 1.55, h.z - 0.3, 0.06, 0.62, 0.78);
  box("#ffcf73", h.x + hw + 0.08, 1.55, h.z - 0.3, 0.02, 0.48, 0.62);
  // The gables, solid behind and open in front above a lintel.
  for (const [z, open] of [
    [back, false],
    [front, true],
  ]) {
    const shape = new T.Shape();
    shape.moveTo(-hw - 0.05, 0);
    shape.lineTo(0, ridge - eaves);
    shape.lineTo(hw + 0.05, 0);
    shape.closePath();
    const gable = new T.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false });
    gable.translate(0, 0, -0.04);
    add(gable, open ? "#735a46" : "#6b5442", h.x, eaves, z, 1, 1, 1);
    if (open) box(darkWood, h.x, eaves - 0.08, z + 0.02, h.width + 0.1, 0.16, 0.14);
  }
  // A pitched roof of slate-blue boards, its ridge running toward the pond.
  const pitch = Math.atan2(ridge - eaves, hw + 0.35),
    slope = Math.hypot(ridge - eaves, hw + 0.35);
  for (const side of [-1, 1]) {
    box(
      pick(roof),
      h.x + side * (hw + 0.35) * 0.5,
      (ridge + eaves) / 2 + 0.06,
      h.z,
      slope + 0.1,
      0.08,
      h.depth + 0.6,
      0,
      0,
      -side * pitch,
    );
    for (let k = 1; k < 5; k++) {
      const f = k / 5;
      box(
        "#6a8186",
        h.x + side * (hw + 0.35) * f,
        ridge - (ridge - eaves) * f + 0.1 + 0.02,
        h.z,
        0.04,
        0.03,
        h.depth + 0.62,
        0,
        0,
        -side * pitch,
      );
    }
  }
  box(darkWood, h.x, ridge + 0.13, h.z, 0.16, 0.12, h.depth + 0.66);
  // The slipway: planks sloping from the floor into the water.
  for (let i = 0; i < 9; i++) {
    const t = i / 8,
      z = front - 0.05 + t * 1.1,
      y = floor - 0.06 - t * 0.38;
    box(pick(wood), h.x, y, z, 1.5, 0.05, 0.13, 0, -0.33);
  }

  // A bench on the bank's crest, looking across the pond to the boathouse.
  const bench = { x: 17.6, z: -26.5, turn: Math.PI + 0.55 },
    ground = millpondGround(bench.x, bench.z),
    benchMatrix = new T.Matrix4().compose(
      new T.Vector3(bench.x, ground, bench.z),
      new T.Quaternion().setFromEuler(new T.Euler(0, bench.turn, 0)),
      new T.Vector3(1, 1, 1),
    );
  const before = parts.length;
  for (const zz of [-0.22, 0, 0.22]) box(pick(wood), 0, 0.55, zz, 1.8, 0.09, 0.16);
  for (const yy of [0.9, 1.12]) box(pick(wood), 0, yy, -0.33, 1.8, 0.15, 0.08);
  for (const xx of [-0.7, 0.7]) {
    box(darkWood, xx, 0.27, 0, 0.12, 0.6, 0.56);
    box(darkWood, xx, 0.78, -0.33, 0.1, 0.86, 0.1);
  }
  for (let i = before; i < parts.length; i++) parts[i].applyMatrix4(benchMatrix);

  const geometry = mergeGeometries(
    parts.map((part) => (part.index ? part.toNonIndexed() : part)),
    false,
  );
  for (const part of parts) part.dispose();
  for (const base of [unitBox, unitCylinder, unitSphere, hull]) base.dispose();
  geometry.computeBoundingSphere();
  const mesh = new T.Mesh(
    geometry,
    new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 }),
  );
  mesh.name = "Millpond weir, footbridge, jetty and boathouse";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  return mesh;
}

// --- Stones, lilies and reeds -----------------------------------------------

// Points along the pond's waterline, s metres inside the water.
function shorePoint(angle, s) {
  let x = M.centre.x + Math.cos(angle) * M.radii.x,
    z = M.centre.z + Math.sin(angle) * M.radii.z;
  // Walk along the shore's gradient to the wanted depth.
  for (let i = 0; i < 6; i++) {
    const e = 0.05,
      here = pondShore(x, z) - s,
      gx = (pondShore(x + e, z) - pondShore(x - e, z)) / (2 * e),
      gz = (pondShore(x, z + e) - pondShore(x, z - e)) / (2 * e),
      g2 = gx * gx + gz * gz || 1;
    x -= (here * gx) / g2;
    z -= (here * gz) / g2;
  }
  return [x, z];
}

// Kept clear of the jetty, the outlet and weir, and the boathouse's slipway.
function clearOfStructures(x, z, margin = 0) {
  const { jetty: j, boathouse: h } = M;
  if (Math.abs(x - j.x) < j.halfWidth + 1.6 + margin && z > j.minZ - 0.6 && z < j.maxZ + 0.5)
    return false;
  if (Math.abs(x - M.brookX) < 3.4 + margin && z > -27.2) return false;
  if (Math.abs(x - h.x) < h.width / 2 + 0.6 + margin && z < h.z + h.depth / 2 + 1.4)
    return false;
  return true;
}

function stones(T, range) {
  const count = 150,
    mesh = new T.InstancedMesh(
      new T.IcosahedronGeometry(1, 1),
      new T.MeshStandardMaterial({ roughness: 0.95, flatShading: true }),
      count,
    ),
    dummy = new T.Object3D(),
    palette = ["#92958a", "#aaa99a", "#777e76", "#b6ad99", "#858b79", "#a89b80"].map(
      (c) => new T.Color(c),
    );
  let n = 0;
  // Clusters along the waterline, a few boulders by the weir's wings.
  while (n < count - 10) {
    const angle = range(0, Math.PI * 2),
      group = Math.floor(range(1, 5)),
      [cx, cz] = shorePoint(angle, range(-0.1, 0.3));
    if (!clearOfStructures(cx, cz, -0.8)) continue;
    for (let k = 0; k < group && n < count - 10; k++) {
      const x = cx + range(-0.35, 0.35),
        z = cz + range(-0.35, 0.35),
        size = range(0.07, 0.26),
        y = Math.max(millpondGround(x, z), M.surface - 0.1);
      dummy.position.set(x, y + size * 0.15, z);
      dummy.rotation.set(range(-0.3, 0.3), range(0, 6.28), range(-0.3, 0.3));
      dummy.scale.set(size * range(0.8, 1.5), size * range(0.45, 0.8), size * range(0.8, 1.5));
      dummy.updateMatrix();
      mesh.setMatrixAt(n, dummy.matrix);
      mesh.setColorAt(n++, palette[Math.floor(range(0, palette.length))]);
    }
  }
  for (const side of [-1, 1])
    for (let k = 0; k < 5; k++) {
      const x = M.brookX + side * range(3.2, 4.6),
        z = M.weir.crest + range(-0.9, 0.9),
        size = range(0.18, 0.34);
      dummy.position.set(x, millpondGround(x, z) + size * 0.2, z);
      dummy.rotation.set(range(-0.3, 0.3), range(0, 6.28), range(-0.3, 0.3));
      dummy.scale.set(size * 1.3, size * 0.7, size * 1.1);
      dummy.updateMatrix();
      mesh.setMatrixAt(n, dummy.matrix);
      mesh.setColorAt(n++, palette[Math.floor(range(0, palette.length))]);
    }
  mesh.count = n;
  mesh.name = "Millpond shore stones";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  mesh.computeBoundingSphere();
  return mesh;
}

function lilies(T, range) {
  const pads = new T.InstancedMesh(
      new T.CircleGeometry(0.26, 12, 0, Math.PI * 1.82).rotateX(-Math.PI / 2),
      new T.MeshStandardMaterial({ roughness: 0.7 }),
      90,
    ),
    flowers = new T.InstancedMesh(
      new T.IcosahedronGeometry(1, 1),
      new T.MeshStandardMaterial({ roughness: 0.6 }),
      30,
    ),
    dummy = new T.Object3D(),
    greens = ["#71926a", "#668a5e", "#7c9a6c", "#5f7f58"].map((c) => new T.Color(c)),
    blooms = ["#f1dce4", "#e9b8c8", "#f6f1e6"].map((c) => new T.Color(c));
  // Beds in the calm bays, away from the jetty's fishing water.
  const beds = [
    [17.6, -30.4, 1.6, 26],
    [9.2, -34.4, 1.3, 20],
    [19.4, -33.6, 1.1, 14],
    [14.4, -28.4, 1.0, 12],
    [5.6, -32.4, 0.9, 10],
  ];
  let p = 0,
    f = 0;
  for (const [bx, bz, radius, n] of beds)
    for (let k = 0; k < n && p < pads.count; k++) {
      const a = range(0, Math.PI * 2),
        r = radius * Math.sqrt(range(0, 1)),
        x = bx + Math.cos(a) * r,
        z = bz + Math.sin(a) * r * 0.75;
      if (pondShore(x, z) < 0.5) continue;
      const size = range(0.7, 1.35);
      dummy.position.set(x, M.surface + 0.012, z);
      dummy.rotation.set(0, range(0, 6.28), 0);
      dummy.scale.set(size, 1, size);
      dummy.updateMatrix();
      pads.setMatrixAt(p, dummy.matrix);
      pads.setColorAt(p++, greens[Math.floor(range(0, greens.length))]);
      if (f < flowers.count && range(0, 1) < 0.28) {
        dummy.position.set(x + range(-0.05, 0.05), M.surface + 0.05, z + range(-0.05, 0.05));
        dummy.scale.set(0.085, 0.05, 0.085);
        dummy.updateMatrix();
        flowers.setMatrixAt(f, dummy.matrix);
        flowers.setColorAt(f++, blooms[Math.floor(range(0, blooms.length))]);
      }
    }
  pads.count = p;
  flowers.count = f;
  pads.name = "Millpond lily pads";
  flowers.name = "Millpond lily flowers";
  for (const mesh of [pads, flowers]) {
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.computeBoundingSphere();
  }
  return [pads, flowers];
}

function reeds(range) {
  const placements = [],
    // Reed heights are measured from the brook's surface; the pond stands
    // higher, so its reeds grow taller to show as much above the water.
    lift = (M.surface - M.brookSurface) / 0.74;
  // Beds along the shore, each a run of clumps around the pond's edge.
  const beds = [
    [2.6, 0.7, 9],
    [3.55, 0.45, 6],
    [4.35, 0.5, 7],
    [5.3, 0.55, 7],
    [0.55, 0.35, 5],
  ];
  for (const [centre, spread, clumps] of beds)
    for (let c = 0; c < clumps; c++) {
      const angle = centre + range(-spread, spread),
        [x, z] = shorePoint(angle, range(0.3, 0.75));
      if (!clearOfStructures(x, z)) continue;
      for (let k = 0; k < 3; k++)
        placements.push({
          x: x + range(-0.2, 0.2),
          z: z + range(-0.2, 0.2),
          height: range(0.45, 0.85) + lift,
        });
    }
  const reedBeds = createReeds(placements, (x, z) => millpondGround(x, z) - 0.02);
  reedBeds.group.name = "Millpond reeds";
  reedBeds.group.userData.update = reedBeds.update;
  return reedBeds.group;
}
