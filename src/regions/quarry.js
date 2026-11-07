// The stone quarry in the map's south-west corner: the ridge's rough grass
// and gorse, two sheer lifts of bedded honey-coloured stone cut into it, the
// pale floor below, a timber derrick crane with a block on its hook, the
// mason's lean-to and banker, stacks of dressed blocks, a block split open,
// the spoil heap, a stone cart, ladders, the fence along the brow, the cart
// track in from the allotments, the footpath down from the old wood, and
// Agnes, the mason. Loaded with import() once the village is on screen and
// built by the streamer a piece at a time. Its shape, colliders and ground
// heights live in quarry-layout.js, which loads with the village.
//
// The ground is one mesh on the fields' grass material, the faces and the
// works one vertex-coloured mesh each, the hanging block one more that sways,
// the rubble one instanced mesh per chunk and the gorse one merged mesh. No
// textures and no new shader programs.
import { chunkRandom, terrainHeight } from "../world-layout.js";
import { createKit, splitByChunk } from "./kit.js";
import {
  BENCH,
  FACES,
  FLOOR,
  FOOTPATH,
  GORSE,
  QUARRY as Q,
  TOP,
  TRACK,
  bareness,
  faceById,
  faceDistance,
  findHeight,
  liftAt,
  liftHeight,
  quarryGround,
  ridgeHeight,
} from "./quarry-layout.js";
import { QUARRY_RESIDENTS } from "../content/quarry.js";
import { FOSSILS } from "../game/quarry.js";

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const COLOR = {
  timber: "#7d6246",
  timberDark: "#5e4934",
  iron: "#4d5153",
  rope: "#b8a57f",
  fresh: ["#e3d4ae", "#dccba3", "#e9dcbb", "#d3c197"],
  weathered: ["#cabd9b", "#beb193", "#c6b48f", "#b5aa90"],
  stain: "#c39a64",
  grey: "#aaa396",
  joint: "#8a7b63",
  moss: "#6d8743",
  ivy: ["#3f5e2e", "#4b6c34", "#38552a"],
};

/**
 * Streamer jobs for the stone quarry. `game.life` takes Agnes once her
 * banker stands.
 */
export function quarryJobs(T, world, { life } = {}) {
  // Each job draws from its own stream: the streamer runs the job nearest
  // the player first, so a shared one would place things differently
  // depending on where the player stood.
  const stream = (salt) => {
    const rand = chunkRandom(-3, 2, salt);
    return (a, b) => a + (b - a) * rand();
  };
  const job = (key, x, z, step, added) => ({ key, x, z, step, added });
  // The nearest water, the marsh's mere, lies 30 m off behind the
  // allotments: nothing here would show in its reflections.
  const added = (meshes, options) => {
    for (const mesh of meshes) {
      world.addStreamed(mesh, options);
      world.water.excludeFromCaptures(mesh);
    }
  };
  const painted = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const d = Q.derrick;
  const jobs = [
    job("quarry ground", -36, 31, groundBuilder(T, world), (meshes) => added(meshes)),
    job("quarry faces", Q.lower.x, Q.lower.z, () => [faces(T, painted)], (meshes) => {
      added(meshes);
      // Each fossil turns up in its own place; those on the bench and the
      // ridge's top answer only to someone standing up there.
      for (const fossil of FOSSILS) {
        const at = Q.finds[fossil.id];
        world.interactables.push({
          id: `quarry-${fossil.id}`,
          type: "fossil",
          fossil: fossil.id,
          name: fossil.name,
          x: at.x,
          z: at.z,
          y: findHeight(fossil.id),
          radius: 1.25,
        });
      }
    }),
    job("quarry paths", -28, 29, () => [paths(T, world.materials.path)], (meshes) => added(meshes)),
    job(
      "quarry works",
      d.x,
      d.z,
      () => works(T, painted, world.materials.glass, stream(29)),
      ([mesh, block, glass]) => {
        // Zoomed far out, their shadows are a few pixels.
        added([mesh, glass], { fineShadow: true });
        added([block], { fineShadow: true });
        const sway = block.userData.sway;
        world.animate(d.x, d.z, (dt, t, clock) => sway(clock));
        world.addLamps([LANTERN]);
        const s = Q.shed,
          c = Q.cart,
          first = Q.stacks[0];
        world.interactables.push(
          { id: "quarry-derrick", name: "Derrick crane", x: d.x + 0.6, z: d.z - 0.75, radius: 1.2 },
          { id: "mason-lean-to", name: "Mason’s lean-to", x: s.x - s.w / 2 + 0.35, z: s.z + s.d / 2 + 0.45, radius: 1 },
          { id: "quarry-board", name: "Quarry board", x: Q.sign.x, z: Q.sign.z + 0.7, radius: 1.1 },
          { id: "stone-stacks", name: "Dressed stone", x: first.x + 0.4, z: first.z - 1.15, radius: 1 },
          {
            id: "stone-cart",
            name: "Stone cart",
            x: c.x - Math.sin(c.turn) * 1.1,
            z: c.z - Math.cos(c.turn) * 1.1,
            radius: 1.1,
          },
        );
      },
    ),
    // A chunk with only a few stones joins its neighbour's part.
    job("quarry rubble", -34, 34, () => splitByChunk(T, rubble(T, stream(30)), { least: 40 }), (meshes) => {
      // Small stones are a pixel or two zoomed far out, and first person
      // drops them beyond its detail range.
      for (const mesh of meshes) {
        world.addStreamed(mesh, { detail: true, far: true });
        world.water.excludeFromCaptures(mesh);
      }
    }),
    job("quarry gorse", -41, 30, () => [gorse(T, painted, stream(32))], (meshes) => added(meshes, { fineShadow: true })),
    // Agnes joins once her banker stands.
    job("quarry mason", Q.residents.agnes.x, Q.residents.agnes.z, () => [], () => {
      for (const resident of QUARRY_RESIDENTS) life?.addResident(resident);
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

// A slow wander in [-1, 1], so the floor's edge and the moss do not follow
// the ridge's smooth contours.
const wander = (x, z) =>
  0.5 * Math.sin(x * 0.53 + z * 0.21 + 0.4) +
  0.3 * Math.sin(x * 0.27 - z * 0.61 + 2.1) +
  0.2 * Math.sin(x * 1.13 + z * 0.91 - 0.7);

/**
 * The ground: one cell per grid square, each cell's corners on its own lift,
 * so where two lifts meet along a face the cells either side stop at their
 * own heights and the face (faces() below) fills the drop between them.
 */
function groundBuilder(T, world) {
  const { minX, maxX, minZ, maxZ } = Q.ground,
    step = Q.step,
    cols = Math.round((maxX - minX) / step),
    rows = Math.round((maxZ - minZ) / step),
    positions = new Float32Array(cols * rows * 18),
    normals = new Float32Array(cols * rows * 18),
    colors = new Float32Array(cols * rows * 18),
    uvs = new Float32Array(cols * rows * 12);
  const lawn = new T.Color(1, 1, 1),
    rough = tint(T, "#8d985a"),
    heather = tint(T, "#7c6a6c"),
    brow = tint(T, "#a39577"),
    ledge = tint(T, "#bfb08e"),
    ledgeDark = tint(T, "#a99a7a"),
    moss = tint(T, "#86955c"),
    dust = tint(T, "#dacdaa"),
    gravel = tint(T, "#c2b593"),
    damp = tint(T, "#aa9e80"),
    chips = tint(T, "#e6dbbd"),
    color = new T.Color(),
    normal = new T.Vector3();
  function colorAt(x, z, lift) {
    const mottle =
        Math.sin(x * 0.9 + 0.4) * Math.sin(z * 1.1 - 1.3) + 0.5 * Math.sin(x * 2.3 + z * 1.7),
      ridge = ridgeHeight(x, z);
    color.copy(lawn);
    if (lift === TOP) {
      // Rough grass and heather as the ridge rises, thin soil and bare stone
      // along the brow.
      const up = smooth(0.2, 1.4, ridge);
      color.lerp(rough, up * 0.75);
      if (mottle > 0.35) color.lerp(heather, smooth(0.35, 1.2, mottle) * up * 0.6);
      color.lerp(brow, (1 - smooth(0.15, 0.8, faceDistance(x, z))) * up * 0.85);
      return color;
    }
    const bare = smooth(0.12, 0.6, ridge - liftHeight(lift, x, z) + 0.18 * wander(x, z));
    if (lift === BENCH) {
      // The bench was worked out long ago: weathered, rubbly, mossy in places.
      color.copy(ledge);
      if (mottle > 0.2) color.lerp(ledgeDark, smooth(0.2, 1, mottle) * 0.6);
      if (wander(x * 1.7, z * 1.7) > 0.25) color.lerp(moss, 0.55);
    } else {
      // The floor: pale dust and gravel, damp patches, fresh chippings at the
      // faces' feet.
      color.copy(dust).lerp(gravel, smooth(-0.6, 1, mottle) * 0.6);
      if (wander(x * 1.3 + 4, z * 1.3) > 0.45) color.lerp(damp, 0.45);
      color.lerp(chips, (1 - smooth(0.15, 1.6, faceDistance(x, z))) * 0.7);
    }
    return color.lerp(lawn, 1 - bare);
  }
  // The ground's normal at a corner: the ridge's slope where the ridge is
  // what stands there, else level.
  function normalAt(x, z, lift) {
    const ridge = ridgeHeight(x, z);
    if (ridge <= liftHeight(lift, x, z) + 1e-9) {
      const e = 0.05,
        gx = (ridgeHeight(x + e, z) - ridgeHeight(x - e, z)) / (2 * e),
        gz = (ridgeHeight(x, z + e) - ridgeHeight(x, z - e)) / (2 * e);
      return normal.set(-gx, 1, -gz).normalize();
    }
    return normal.set(0, 1, 0);
  }
  let row = 0,
    v = 0;
  return (deadline) => {
    for (; row < rows; row++) {
      if (performance.now() > deadline) return null;
      const z0 = minZ + row * step,
        z1 = z0 + step;
      for (let col = 0; col < cols; col++) {
        const x0 = minX + col * step,
          x1 = x0 + step,
          lift = liftAt(x0 + step / 2, z0 + step / 2);
        // Two triangles, wound to face up.
        for (const [x, z] of [
          [x0, z0],
          [x0, z1],
          [x1, z0],
          [x1, z0],
          [x0, z1],
          [x1, z1],
        ]) {
          // The mesh's edge stays plain lawn, to meet the fields' grass.
          const edge =
            Math.abs(x - minX) < 1e-6 ||
            Math.abs(x - maxX) < 1e-6 ||
            Math.abs(z - minZ) < 1e-6 ||
            Math.abs(z - maxZ) < 1e-6;
          positions.set([x, Q.lawn + liftHeight(lift, x, z), z], v * 3);
          normalAt(x, z, lift).toArray(normals, v * 3);
          (edge ? lawn : colorAt(x, z, lift)).toArray(colors, v * 3);
          uvs.set([x / 33.5, -z / 41.6], v * 2);
          v++;
        }
      }
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new T.BufferAttribute(normals, 3));
    geometry.setAttribute("color", new T.BufferAttribute(colors, 3));
    geometry.setAttribute("uv", new T.BufferAttribute(uvs, 2));
    geometry.computeBoundingSphere();
    const material = world.groundMaterial.clone();
    material.vertexColors = true;
    const mesh = new T.Mesh(geometry, material);
    mesh.name = "Quarry ground";
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    return [mesh];
  };
}

// --- Faces ----------------------------------------------------------------

// Bedding planes above the lawn: the courses the faces are cut along,
// thicker low down where the best stone lies.
const COURSES = [0, 0.36, 0.78, 1.22, 1.7, 2.05, 2.42, 2.82, 3.25, 3.7];

/** A face's point at `s` along it, `out` metres in front and `y` up. */
function facePoint(face, s, y, out = 0) {
  return face.axis === "x" ? [face.at + out, y, s] : [s, y, face.at + out];
}

/** The ground above and below a face at `s`, between its stations. */
function faceAt(face, s) {
  const st = face.stations,
    i = Math.min(st.length - 2, Math.max(0, Math.floor((s - face.from) / Q.step))),
    t = Math.min(1, Math.max(0, (s - st[i].s) / Q.step));
  return {
    hi: st[i].hi + (st[i + 1].hi - st[i].hi) * t,
    lo: st[i].lo + (st[i + 1].lo - st[i].lo) * t,
  };
}

/**
 * The faces: a sheer backing along each face's line, from the lift below to
 * the lift above, which closes the ground between them, and in front of it
 * blocks of stone course by course, each standing a few centimetres proud,
 * the upper lift's weathered and lichened, the lower's fresh. Ivy trails
 * down the upper faces and moss caps the brow.
 */
function faces(T, material) {
  const k = createKit(T, { segments: 6, sphereDetail: 0 }),
    rand = chunkRandom(-3, 2, 31),
    range = (a, b) => a + (b - a) * rand(),
    pick = (list) => list[Math.floor(rand() * list.length)],
    color = new T.Color();
  const backing = [],
    backColors = [],
    backNormals = [];
  const joint = new T.Color(COLOR.joint);
  for (const face of FACES) {
    const [nx, nz] = face.normal;
    // The backing, a quad per grid step, wound to face out of the face.
    for (let i = 0; i < face.stations.length - 1; i++) {
      const a = face.stations[i],
        b = face.stations[i + 1];
      if (Math.max(a.hi - a.lo, b.hi - b.lo) < 0.005) continue;
      const p = [
        facePoint(face, a.s, Q.lawn + a.lo),
        facePoint(face, b.s, Q.lawn + b.lo),
        facePoint(face, b.s, Q.lawn + b.hi),
        facePoint(face, a.s, Q.lawn + a.hi),
      ];
      // Along +s, then up: the winding faces -x on an x face, +z on a z face.
      const order = face.axis === "x" ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
      for (const j of order) {
        backing.push(...p[j]);
        backNormals.push(nx, 0, nz);
        backColors.push(joint.r, joint.g, joint.b);
      }
    }
    // The blocks, course by course.
    const fresh = face.below === FLOOR;
    for (let c = 0; c < COURSES.length - 1; c++) {
      const yb = COURSES[c],
        yt = COURSES[c + 1],
        tone = pick(fresh ? COLOR.fresh : COLOR.weathered);
      let s = face.from + range(0, 0.6);
      while (s < face.to - 0.2) {
        const length = range(0.55, 1.35),
          s1 = Math.min(face.to, s + length);
        let hi = Infinity,
          lo = -Infinity;
        for (let u = s; u <= s1 + 1e-6; u += Math.min(Q.step, (s1 - s) / 2)) {
          const at = faceAt(face, u);
          hi = Math.min(hi, at.hi);
          lo = Math.max(lo, at.lo);
        }
        const top = Math.min(yt - 0.018, hi),
          bottom = Math.max(yb + 0.018, lo + 0.012),
          height = top - bottom;
        if (height > 0.1) {
          const proud = fresh ? range(0.02, 0.07) : range(0.03, 0.13),
            depth = proud + 0.14,
            mid = (s + s1) / 2,
            hex = rand() < 0.07 ? COLOR.stain : rand() < 0.08 ? COLOR.grey : tone;
          color.set(hex).multiplyScalar(range(0.93, 1.05));
          const [x, , z] = facePoint(face, mid, 0, proud - depth / 2);
          k.box(
            `#${color.getHexString()}`,
            x,
            Q.lawn + bottom + height / 2,
            z,
            face.axis === "x" ? depth : s1 - s - 0.035,
            height,
            face.axis === "x" ? s1 - s - 0.035 : depth,
          );
          // Moss on the brow's last course.
          if (!fresh && hi - top < 0.05 && rand() < 0.55) {
            const [mx, , mz] = facePoint(face, mid, 0, proud - 0.06);
            k.box(
              COLOR.moss,
              mx,
              Q.lawn + top + 0.015,
              mz,
              face.axis === "x" ? 0.16 : s1 - s - 0.06,
              0.04,
              face.axis === "x" ? s1 - s - 0.06 : 0.16,
            );
          }
        }
        s = s1;
      }
    }
    // Ivy trails down the upper faces where they stand tall.
    if (!fresh)
      for (let s = face.from + 0.6; s < face.to - 0.6; s += range(1.6, 3.2)) {
        const at = faceAt(face, s);
        if (at.hi - at.lo < 1.1 || rand() < 0.35) continue;
        const reach = range(0.6, 1.3),
          leaves = Math.round(reach / 0.13);
        for (let i = 0; i < leaves; i++) {
          const y = Q.lawn + at.hi - (i / leaves) * reach,
            spread = 0.08 + 0.12 * (i / leaves),
            [x, , z] = facePoint(face, s + range(-spread, spread), 0, 0.15);
          k.ball(pick(COLOR.ivy), x, y, z, range(0.09, 0.15), range(0.07, 0.1), range(0.09, 0.15));
        }
      }
  }
  const back = new T.BufferGeometry();
  back.setAttribute("position", new T.Float32BufferAttribute(backing, 3));
  back.setAttribute("normal", new T.Float32BufferAttribute(backNormals, 3));
  back.setAttribute("color", new T.Float32BufferAttribute(backColors, 3));
  k.piece(back);
  const mesh = k.mesh("Quarry faces", material);
  k.dispose();
  return mesh;
}

// --- Paths -----------------------------------------------------------------

/**
 * The cart track and the footpath: strips just above the ground in the
 * village paths' gravel, their edges a little uneven and their ends rounded.
 */
function paths(T, material) {
  const positions = [],
    lift = 0.048;
  const at = (x, z) => [x, Q.lawn + terrainHeight(x, z) + lift, z];
  const edge = (u, side) => Math.sin(u * 2.9 + side) * 0.04 + Math.sin(u * 6.3 - side) * 0.025;
  function strip(line, half) {
    let u = 0;
    const side = line.map(([x, z], i) => {
      const [ax, az] = line[Math.max(0, i - 1)],
        [bx, bz] = line[Math.min(line.length - 1, i + 1)],
        length = Math.hypot(bx - ax, bz - az),
        nx = -(bz - az) / length,
        nz = (bx - ax) / length;
      if (i) u += Math.hypot(x - line[i - 1][0], z - line[i - 1][1]);
      const left = half + edge(u + x, 1),
        right = half + edge(u + z, -1);
      return [at(x + nx * left, z + nz * left), at(x - nx * right, z - nz * right)];
    });
    for (let i = 0; i < side.length - 1; i++) {
      const [a, b] = side[i],
        [c, d] = side[i + 1];
      positions.push(...a, ...b, ...c, ...c, ...b, ...d);
    }
    for (const [[x, z], [px, pz]] of [
      [line[0], line[1]],
      [line.at(-1), line.at(-2)],
    ]) {
      const heading = Math.atan2(x - px, z - pz),
        n = 10;
      for (let i = 0; i < n; i++) {
        const a0 = heading - Math.PI / 2 + (i / n) * Math.PI,
          a1 = heading - Math.PI / 2 + ((i + 1) / n) * Math.PI;
        positions.push(
          ...at(x, z),
          ...at(x + Math.sin(a1) * half, z + Math.cos(a1) * half),
          ...at(x + Math.sin(a0) * half, z + Math.cos(a0) * half),
        );
      }
    }
  }
  strip(TRACK, Q.trackHalfWidth);
  strip(FOOTPATH, Q.footpathHalfWidth);
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
  mesh.name = "Quarry track";
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  return mesh;
}

// --- The works ------------------------------------------------------------

// The lantern under the lean-to's eaves, by its front east post.
const LANTERN = { x: Q.shed.x + Q.shed.w / 2 - 0.05, z: Q.shed.z + Q.shed.d / 2 + 0.22 };

/** The derrick's jib tip, where the hoist hangs. */
function jibTip() {
  const d = Q.derrick,
    floor = quarryGround(d.x, d.z),
    angle = 0.96,
    reach = d.jib * Math.cos(angle);
  return [
    d.x + Math.cos(d.turn) * reach,
    floor + 0.6 + d.jib * Math.sin(angle),
    d.z - Math.sin(d.turn) * reach,
  ];
}

/**
 * The derrick, the lean-to and banker, the stacks, the split block, the
 * heap, the cart, the board, the ladders and the fence along the brow, as
 * one mesh; the block on the derrick's hook as a second, which sways; and
 * the lantern's glass.
 */
function works(T, material, glassMaterial, range) {
  const k = createKit(T, { segments: 8, sphereDetail: 0 }),
    hook = k.layer(),
    color = new T.Color(),
    jitter = (hex, a = 0.92, b = 1.05) => `#${color.set(hex).multiplyScalar(range(a, b)).getHexString()}`,
    stone = () => jitter(COLOR.fresh[Math.floor(range(0, COLOR.fresh.length))]);
  derrick(k, hook, range);
  leanTo(k);
  banker(k);
  for (const stack of Q.stacks) blockStack(k, stack, stone, range);
  splitBlock(k, stone);
  heap(k, T, range);
  cart(k, stone);
  board(k);
  for (const { face, at } of Q.ladders) ladder(k, faceById(face), at);
  fence(k);
  findMarks(k, range);
  const mesh = k.mesh("Quarry works", material),
    block = k.mesh("Quarry derrick's load", material, hook),
    glass = new T.Mesh(k.glass(), glassMaterial);
  glass.name = "Quarry lantern glass";
  glass.matrixAutoUpdate = false;
  k.dispose();
  // The load hangs from the jib's tip, and sways a little.
  const [tx, ty, tz] = jibTip();
  block.position.set(tx, ty, tz);
  block.updateMatrix();
  block.userData.sway = (clock) => {
    block.rotation.set(0.035 * Math.sin(clock * 0.83), 0, 0.03 * Math.sin(clock * 0.61 + 1.3));
    block.updateMatrix();
    block.updateMatrixWorld();
  };
  return [mesh, block, glass];
}

function derrick(k, hook, range) {
  const d = Q.derrick,
    floor = quarryGround(d.x, d.z),
    top = floor + d.mast,
    tip = jibTip(),
    heel = [d.x + Math.cos(d.turn) * 0.16, floor + 0.6, d.z - Math.sin(d.turn) * 0.16];
  // The mast on its stone sill, capped in iron.
  k.box("#cbbd9a", d.x, floor + 0.12, d.z, 0.8, 0.24, 0.8);
  k.box(COLOR.timber, d.x, (floor + 0.24 + top) / 2, d.z, 0.24, top - floor - 0.24, 0.24);
  k.box(COLOR.iron, d.x, top + 0.04, d.z, 0.3, 0.08, 0.3);
  k.cyl(COLOR.iron, d.x, top + 0.16, d.z, 0.05, 0.2);
  // The jib, pinned at the mast's foot, and its iron heel.
  k.beam(COLOR.timberDark, heel, tip, 0.19);
  k.box(COLOR.iron, heel[0], heel[1], heel[2], 0.3, 0.22, 0.3, -d.turn);
  // Topping ropes from the mast head to the jib's tip, the hoist rope down
  // the jib to the winch.
  const side = [Math.sin(d.turn) * 0.06, 0, Math.cos(d.turn) * 0.06];
  for (const s of [-1, 1])
    k.rod(COLOR.rope, [d.x + side[0] * s, top, d.z + side[2] * s], [tip[0] + side[0] * s, tip[1] + 0.05, tip[2] + side[2] * s], 0.016);
  const winch = { x: d.x + 0.75, z: d.z + 0.55 };
  k.rod(COLOR.rope, [tip[0], tip[1] - 0.12, tip[2]], [heel[0], heel[1] - 0.06, heel[2]], 0.013);
  k.rod(COLOR.rope, [heel[0], heel[1] - 0.06, heel[2]], [winch.x, floor + 0.47, winch.z], 0.013);
  k.cyl(COLOR.iron, tip[0], tip[1] - 0.06, tip[2], 0.11, 0.06);
  // Guy ropes to stakes on the ridge, and one on the floor.
  for (const [gx, gz] of d.guys) {
    const ground = quarryGround(gx, gz);
    k.rod(COLOR.rope, [d.x, top - 0.08, d.z], [gx, ground + 0.32, gz], 0.012);
    k.post(COLOR.timberDark, gx, gz, ground - 0.1, ground + 0.4, 0.05);
    k.box(COLOR.grey, gx + 0.12, ground + 0.06, gz + 0.1, 0.3, 0.14, 0.24, range(0, 1));
  }
  // The crab winch: two iron cheeks, a drum wound with rope, two cranks.
  for (const s of [-1, 1]) {
    k.box(COLOR.iron, winch.x + s * 0.28, floor + 0.36, winch.z, 0.05, 0.62, 0.55);
    k.rod(COLOR.iron, [winch.x + s * 0.33, floor + 0.47, winch.z], [winch.x + s * 0.36, floor + 0.47 + 0.2, winch.z + 0.08 * s], 0.018);
    k.rod(COLOR.timberDark, [winch.x + s * 0.36, floor + 0.67, winch.z + 0.08 * s], [winch.x + s * 0.5, floor + 0.67, winch.z + 0.08 * s], 0.025);
  }
  k.cyl(COLOR.rope, winch.x, floor + 0.47, winch.z, 0.15, 0.5, 0, Math.PI / 2);
  k.box(COLOR.timberDark, winch.x, floor + 0.04, winch.z, 0.7, 0.08, 0.7);
  // On the hook: a chain, a shackle, the sling and a fresh block.
  k.into(hook, () => {
    k.rod(COLOR.iron, [0, -0.08, 0], [0, -0.75, 0], 0.022);
    k.box(COLOR.iron, 0, -0.8, 0, 0.1, 0.1, 0.04);
    for (const s of [-1, 1]) k.rod(COLOR.rope, [0, -0.82, 0], [s * 0.3, -1.08, 0], 0.016);
    k.box("#e4d6b1", 0, -1.31, 0, 0.78, 0.46, 0.52, 0.3);
  });
}

function leanTo(k) {
  const s = Q.shed,
    floor = quarryGround(s.x, s.z),
    back = s.z - s.d / 2,
    front = s.z + s.d / 2,
    west = s.x - s.w / 2,
    east = s.x + s.w / 2,
    rise = 0.32,
    tilt = Math.atan2(rise, s.d);
  // Posts, taller at the back against the face, and the plates they carry.
  for (const x of [west + 0.06, east - 0.06]) {
    k.post(COLOR.timber, x, back + 0.08, floor, floor + s.h + rise, 0.07);
    k.post(COLOR.timber, x, front - 0.06, floor, floor + s.h, 0.07);
    k.beam(COLOR.timberDark, [x, floor + s.h + rise - 0.06, back + 0.08], [x, floor + s.h - 0.06, front - 0.06], 0.09);
  }
  k.beam(COLOR.timberDark, [west - 0.1, floor + s.h - 0.03, front - 0.06], [east + 0.1, floor + s.h - 0.03, front - 0.06], 0.1);
  // A corrugated iron roof, in ribs of two shades.
  const ribs = 14;
  for (let i = 0; i < ribs; i++) {
    const x = west - 0.15 + ((i + 0.5) / ribs) * (s.w + 0.3);
    k.box(i % 2 ? "#7d7a72" : "#8d877c", x, floor + s.h + rise / 2 + 0.04 + (i % 2) * 0.02, s.z + 0.05, (s.w + 0.3) / ribs + 0.01, 0.03, s.d + 0.45, 0, tilt);
  }
  k.box("#a2603c", west + 0.4, floor + s.h + rise * 0.7 + 0.08, s.z - 0.1, 0.5, 0.032, 0.6, 0.1, tilt);
  // Boards along the west side, and a rack of tools on the back.
  for (let i = 0; i < 6; i++) {
    const z = back + 0.12 + i * ((s.d - 0.2) / 6);
    k.box(i % 2 ? COLOR.timber : "#876a4c", west + 0.02, floor + (s.h + rise * (1 - i / 6)) / 2, z + 0.11, 0.04, s.h + rise * (1 - i / 6) - 0.1, 0.22);
  }
  k.box(COLOR.timberDark, s.x, floor + 1.35, back + 0.1, s.w - 0.3, 0.6, 0.04);
  for (let i = 0; i < 9; i++) {
    const x = west + 0.4 + i * 0.25;
    if (i % 3 === 0) {
      // A mallet.
      k.rod("#9c7c55", [x, floor + 1.15, back + 0.15], [x, floor + 1.4, back + 0.15], 0.018);
      k.cyl("#a8875e", x, floor + 1.47, back + 0.15, 0.06, 0.12);
    } else k.rod(COLOR.iron, [x, floor + 1.18, back + 0.15], [x + 0.02, floor + 1.5, back + 0.15], 0.012);
  }
  // Wooden templates leaning in the corner, and a treadle grindstone by the
  // east post.
  for (let i = 0; i < 3; i++)
    k.box(i % 2 ? "#b49a72" : "#a68b62", west + 0.35 + i * 0.07, floor + 0.55, back + 0.45 + i * 0.12, 0.02, 1, 0.5, 0, 0, -0.12);
  const g = { x: east - 0.55, z: front - 0.5 };
  k.box(COLOR.timberDark, g.x, floor + 0.3, g.z, 0.6, 0.06, 0.34);
  for (const dx of [-0.25, 0.25]) k.post(COLOR.timberDark, g.x + dx, g.z, floor, floor + 0.62, 0.035);
  k.cyl("#b9b1a2", g.x, floor + 0.62, g.z, 0.3, 0.1, Math.PI / 2);
  k.rod(COLOR.iron, [g.x, floor + 0.62, g.z - 0.14], [g.x, floor + 0.62, g.z + 0.14], 0.02);
  // The lantern on its bracket.
  const l = LANTERN;
  k.rod(COLOR.iron, [l.x, floor + 2.12, front - 0.06], [l.x, floor + 2.12, l.z], 0.015);
  k.rod(COLOR.iron, [l.x, floor + 2.12, l.z], [l.x, floor + 1.98, l.z], 0.008);
  k.box(COLOR.iron, l.x, floor + 1.96, l.z, 0.16, 0.025, 0.16);
  k.box(COLOR.iron, l.x, floor + 1.72, l.z, 0.17, 0.03, 0.17);
  k.glazed(() => k.box("#ffcf73", l.x, floor + 1.84, l.z, 0.13, 0.22, 0.13));
}

function banker(k) {
  const b = Q.banker,
    floor = quarryGround(b.x, b.z),
    top = floor + b.h;
  // Two stone piers and a thick elm top, and a finial half carved on it.
  for (const s of [-1, 1]) k.box("#c9ba96", b.x + s * (b.w / 2 - 0.16), floor + (b.h - 0.1) / 2, b.z, 0.28, b.h - 0.1, b.d - 0.08);
  k.box("#8a6d4c", b.x, top - 0.05, b.z, b.w, 0.1, b.d);
  k.box("#e6d9b6", b.x - 0.12, top + 0.11, b.z, 0.42, 0.22, 0.42);
  k.cyl("#e6d9b6", b.x - 0.12, top + 0.28, b.z, 0.12, 0.12);
  k.ball("#e9dcba", b.x - 0.12, top + 0.48, b.z, 0.17, 0.17, 0.17);
  // A dummy mallet and two chisels on the top, and chippings at its feet.
  k.cyl("#a8875e", b.x + 0.3, top + 0.06, b.z + 0.12, 0.065, 0.12, 0, Math.PI / 2);
  k.rod("#9c7c55", [b.x + 0.36, top + 0.06, b.z + 0.12], [b.x + 0.48, top + 0.03, b.z + 0.2], 0.016);
  k.rod(COLOR.iron, [b.x + 0.2, top + 0.012, b.z - 0.15], [b.x + 0.42, top + 0.012, b.z - 0.2], 0.011);
  k.rod(COLOR.iron, [b.x + 0.25, top + 0.012, b.z - 0.25], [b.x + 0.44, top + 0.012, b.z - 0.24], 0.011);
}

// What shows where the bench's and the ridge's fossils lie, a step from
// where the finder stands: a bed of crinoids by the upper face, round
// nodules on the west bench, and a rabbit scrape on the ridge's top.
function findMarks(k, range) {
  const c = Q.finds.crinoid,
    cy = quarryGround(c.x, c.z);
  k.box("#a29d8f", c.x, cy + 0.04, c.z - 0.55, 0.8, 0.1, 0.34, 0.08);
  for (let i = 0; i < 6; i++)
    k.cyl("#d3caaf", c.x - 0.3 + i * 0.12, cy + 0.1, c.z - 0.55 + range(-0.1, 0.1), 0.035, 0.035, Math.PI / 2, range(0, 1.5));
  const u = Q.finds.urchin,
    uy = quarryGround(u.x, u.z);
  for (let i = 0; i < 4; i++)
    k.ball("#a3977b", u.x - 0.55 + range(-0.08, 0.08), uy + 0.04, u.z - 0.45 + i * 0.3, range(0.12, 0.17), range(0.09, 0.12), range(0.12, 0.17));
  const b = Q.finds.brachiopod,
    bx = b.x - 0.5,
    bz = b.z - 0.35,
    by = quarryGround(bx, bz);
  k.ball("#7a5f40", bx, by - 0.03, bz, 0.45, 0.13, 0.34);
  k.ball("#3a2d21", bx - 0.22, by + 0.03, bz - 0.12, 0.15, 0.11, 0.12);
  for (let i = 0; i < 3; i++)
    k.ball("#ded4ba", bx + 0.08 + i * 0.12, by + 0.08, bz + range(-0.1, 0.1), 0.045, 0.025, 0.04);
}

function blockStack(k, s, stone, range) {
  const floor = quarryGround(s.x, s.z),
    w = s.w * s.along,
    d = s.d * s.across;
  k.placed(s.x, floor, s.z, s.turn, () => {
    // Timber bearers, then the courses of blocks.
    for (const side of [-1, 1]) k.box(COLOR.timberDark, 0, 0.05, side * (d / 2 - 0.16), w + 0.2, 0.1, 0.12);
    for (let c = 0; c < s.courses; c++)
      for (let i = 0; i < s.along; i++)
        for (let j = 0; j < s.across; j++) {
          // The top course is never quite full.
          if (c === s.courses - 1 && s.courses > 1 && (i + j + c) % 3 === 2) continue;
          k.box(
            stone(),
            (i - (s.along - 1) / 2) * s.w + range(-0.02, 0.02),
            0.1 + c * s.h + s.h / 2,
            (j - (s.across - 1) / 2) * s.d + range(-0.02, 0.02),
            s.w - 0.035,
            s.h - 0.02,
            s.d - 0.035,
            range(-0.03, 0.03),
          );
        }
  });
}

function splitBlock(k, stone) {
  const s = Q.split,
    floor = quarryGround(s.x, s.z);
  k.placed(s.x, floor, s.z, s.turn, () => {
    // Two halves fallen apart along a bedding plane, with the iron wedges
    // that split it, and the shells it was full of.
    const hex = stone();
    k.box(hex, -0.3, 0.3, 0, 0.55, 0.6, 0.8, 0, 0, 0.13);
    k.box(hex, 0.32, 0.29, 0, 0.55, 0.58, 0.8, 0, 0, -0.16);
    for (const z of [-0.22, 0.05, 0.27]) k.box(COLOR.iron, 0.02, 0.62, z, 0.05, 0.1, 0.05);
    for (const [x, y, z] of [
      [-0.12, 0.52, -0.2],
      [-0.08, 0.38, 0.15],
      [0.1, 0.45, 0.02],
    ])
      k.ball("#6f6658", x, y, z, 0.05, 0.035, 0.04);
    // A sledgehammer propped against it.
    k.rod("#9c7c55", [0.75, 0.02, 0.1], [0.62, 0.78, 0.2], 0.022);
    k.box(COLOR.iron, 0.62, 0.82, 0.2, 0.08, 0.08, 0.24);
  });
}

/** The heap's surface height `r` from its middle. */
const heapRise = (r) => Q.heap.h * Math.pow(Math.max(0, 1 - (r / Q.heap.r) ** 2), 0.9);

function heap(k, T, range) {
  const h = Q.heap,
    floor = quarryGround(h.x, h.z),
    rings = 6,
    segments = 16,
    positions = [],
    colors = [],
    shade = new T.Color(),
    base = new T.Color("#9f937b"),
    grey = new T.Color("#8e877a");
  // A mound of broken stone: rings out from the top, each point nudged.
  const point = (ring, seg) => {
    const t = ring / rings,
      a = (seg / segments) * Math.PI * 2,
      r = t * h.r * (1 + 0.08 * Math.sin(a * 3 + 1) + 0.05 * Math.sin(a * 7)),
      y = ring === rings ? -0.02 : heapRise(t * h.r) + (ring && ring < rings ? 0.06 * Math.sin(a * 5 + ring) : 0);
    return [h.x + Math.cos(a) * r, floor + y, h.z + Math.sin(a) * r];
  };
  for (let ring = 0; ring < rings; ring++)
    for (let seg = 0; seg < segments; seg++) {
      const quad = [point(ring, seg), point(ring + 1, seg), point(ring + 1, seg + 1), point(ring, seg + 1)];
      for (const j of [0, 2, 1, 0, 3, 2]) {
        positions.push(...quad[j]);
        shade.copy(base).lerp(grey, 0.5 + 0.5 * Math.sin(quad[j][0] * 3.1 + quad[j][2] * 2.3)).multiplyScalar(range(0.94, 1.04));
        colors.push(shade.r, shade.g, shade.b);
      }
    }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  k.piece(geometry);
  // Broken blocks and slabs tipped over it, so it reads as rubble from any
  // height (the small stones hide zoomed far out).
  const tones = ["#cbbd99", "#b8ab8c", "#a99f8a", "#d7c9a6", "#9a9282"];
  for (let i = 0; i < 46; i++) {
    const a = range(0, Math.PI * 2),
      r = Math.sqrt(range(0, 1)) * h.r * 0.95,
      size = range(0.16, 0.38) * (1.15 - (r / h.r) * 0.5);
    k.add(
      k.unit.sphere,
      tones[Math.floor(range(0, tones.length))],
      h.x + Math.cos(a) * r,
      floor + heapRise(r) - size * 0.15,
      h.z + Math.sin(a) * r,
      size * range(0.9, 1.4),
      size * range(0.45, 0.7),
      size * range(0.8, 1.2),
      range(-0.4, 0.4),
      range(0, 6.3),
      range(-0.4, 0.4),
    );
  }
}

function cart(k, stone) {
  const c = Q.cart,
    floor = quarryGround(c.x, c.z),
    half = c.length / 2,
    across = c.width / 2;
  k.placed(c.x, floor, c.z, c.turn, () => {
    // The bed, its rails and the load.
    k.box("#7a6047", 0, 0.72, 0, c.length, 0.09, c.width);
    for (const s of [-1, 1]) k.box(COLOR.timberDark, 0, 0.82, s * (across - 0.03), c.length, 0.12, 0.05);
    k.box(stone(), -0.45, 1.01, 0, 0.95, 0.5, 0.7, 0.04);
    k.box(stone(), 0.55, 0.96, 0.05, 0.8, 0.4, 0.62, -0.06);
    // Wheels on their axles.
    for (const x of [-half + 0.45, half - 0.45]) {
      k.rod(COLOR.iron, [x, 0.38, -across - 0.04], [x, 0.38, across + 0.04], 0.03);
      for (const s of [-1, 1]) {
        k.cyl("#6a5440", x, 0.38, s * (across + 0.02), 0.37, 0.07, Math.PI / 2);
        k.cyl(COLOR.iron, x, 0.38, s * (across + 0.02), 0.38, 0.03, Math.PI / 2);
        k.cyl(COLOR.timberDark, x, 0.38, s * (across + 0.07), 0.08, 0.08, Math.PI / 2);
      }
    }
    // The shafts, resting on the ground.
    for (const s of [-0.4, 0.4]) k.beam(COLOR.timber, [half - 0.1, 0.72, s], [half + 0.75, 0.06, s * 0.85], 0.07);
  });
}

function board(k) {
  const s = Q.sign,
    floor = quarryGround(s.x, s.z);
  // A painted board facing the track (south): a dark border, a cream field
  // and two rows of lettering.
  for (const dx of [-0.55, 0.55]) k.post(COLOR.timberDark, s.x + dx, s.z, floor - 0.1, floor + 1.7, 0.05);
  k.box("#3f4a3a", s.x, floor + 1.32, s.z + 0.04, 1.3, 0.6, 0.04);
  k.box("#e8dcc0", s.x, floor + 1.32, s.z + 0.065, 1.18, 0.48, 0.02);
  k.box("#3f4a3a", s.x, floor + 1.43, s.z + 0.078, 0.86, 0.08, 0.008);
  k.box("#7a4b36", s.x, floor + 1.25, s.z + 0.078, 0.66, 0.05, 0.008);
  k.box("#3f4a3a", s.x, floor + 1.63, s.z + 0.04, 1.36, 0.05, 0.1);
}

function ladder(k, face, at) {
  const { hi, lo } = faceAt(face, at),
    rise = hi - lo + 0.35,
    rungs = Math.floor(rise / 0.3);
  // Two rails leaning from a foot out on the lower lift to just above the
  // brow, and the rungs between them.
  const point = (side, t) =>
    facePoint(face, at + side * 0.21, Q.lawn + lo + rise * t, 0.42 + (0.06 - 0.42) * t);
  for (const side of [-1, 1]) k.beam(COLOR.timber, point(side, 0), point(side, 1), 0.055);
  for (let i = 1; i < rungs; i++) k.rod(COLOR.timberDark, point(-1, i / rungs), point(1, i / rungs), 0.018);
}

// The fence along the brow of the upper faces, a step back from the edge,
// wherever the drop is worth fencing.
function fence(k) {
  for (const id of ["upper-west", "upper-north"]) {
    const face = faceById(id),
      back = -0.12,
      posts = [];
    for (let s = face.from; s <= face.to; s += 1.5) {
      const { hi, lo } = faceAt(face, s);
      if (hi - lo < 0.45) break;
      posts.push([s, hi]);
    }
    posts.forEach(([s, hi], i) => {
      const [x, , z] = facePoint(face, s, 0, back);
      k.post(COLOR.timberDark, x, z, Q.lawn + hi - 0.15, Q.lawn + hi + 0.95, 0.045);
      if (!i) return;
      const [ps, phi] = posts[i - 1],
        [px, , pz] = facePoint(face, ps, 0, back);
      for (const y of [0.45, 0.85]) k.beam(COLOR.timber, [px, Q.lawn + phi + y, pz], [x, Q.lawn + hi + y, z], 0.05);
    });
  }
}

// --- Rubble ---------------------------------------------------------------

/**
 * Broken stone: scree at the faces' feet and along the bench's edge, the
 * spoil heap's surface, chippings round the banker and the split block, and
 * a scatter over the floor. One instanced mesh, split per chunk where it is
 * built.
 */
function rubble(T, range) {
  const stones = [],
    add = (x, z, size, y = quarryGround(x, z)) => stones.push([x, y + size * 0.25, z, size]);
  for (const face of FACES)
    for (let s = face.from; s < face.to; s += 0.32) {
      const { hi, lo } = faceAt(face, s);
      if (hi - lo < 0.35) continue;
      for (let n = 0; n < 2; n++) {
        const out = 0.08 + Math.pow(range(0, 1), 1.8) * 0.8,
          [x, , z] = facePoint(face, s + range(-0.15, 0.15), 0, out);
        add(x, z, range(0.05, 0.2) * (1.1 - out * 0.5));
      }
    }
  const h = Q.heap;
  for (let i = 0; i < 150; i++) {
    const a = range(0, Math.PI * 2),
      r = Math.sqrt(range(0, 1)) * h.r * 1.05,
      x = h.x + Math.cos(a) * r,
      z = h.z + Math.sin(a) * r;
    add(x, z, range(0.07, 0.24), quarryGround(x, z) + heapRise(Math.min(r, h.r)) - 0.04);
  }
  for (const [cx, cz, count, spread] of [
    [Q.banker.x, Q.banker.z, 26, 0.9],
    [Q.split.x, Q.split.z, 16, 0.8],
  ])
    for (let i = 0; i < count; i++) {
      const a = range(0, Math.PI * 2),
        r = range(0.45, spread);
      add(cx + Math.cos(a) * r, cz + Math.sin(a) * r, range(0.03, 0.07));
    }
  for (let i = 0; i < 60; i++) {
    const x = range(-38.2, -27),
      z = range(30, 39.5);
    if (bareness(x, z) < 0.5) continue;
    add(x, z, range(0.05, 0.14));
  }
  const geometry = new T.IcosahedronGeometry(1, 0),
    material = new T.MeshStandardMaterial({ roughness: 0.92 }),
    mesh = new T.InstancedMesh(geometry, material, stones.length),
    dummy = new T.Object3D(),
    color = new T.Color(),
    tones = ["#d8c9a4", "#c7b893", "#b6ab93", "#e2d5b4", "#a9a092"];
  stones.forEach(([x, y, z, size], i) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(range(0, 3), range(0, 6.3), range(0, 3));
    dummy.scale.set(size * range(0.8, 1.3), size * range(0.45, 0.75), size * range(0.8, 1.2));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, color.set(tones[Math.floor(range(0, tones.length))]).multiplyScalar(range(0.9, 1.04)));
  });
  mesh.name = "Quarry rubble";
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  mesh.computeBoundingSphere();
  return mesh;
}

// --- Gorse ----------------------------------------------------------------

/** Gorse bushes on the ridge: dark, prickly mounds starred with yellow flowers. */
function gorse(T, material, range) {
  const k = createKit(T, { segments: 6, sphereDetail: 0 }),
    greens = ["#4a6a33", "#557638", "#41602e"],
    yellows = ["#e8c33e", "#f1d45a", "#dcb337"];
  for (const [x, z, size] of GORSE) {
    const ground = quarryGround(x, z),
      clumps = 3 + Math.floor(range(0, 2));
    for (let i = 0; i < clumps; i++) {
      const a = (i / clumps) * Math.PI * 2 + range(0, 1),
        r = i ? 0.28 * size : 0,
        sx = range(0.36, 0.48) * size,
        sy = range(0.3, 0.42) * size;
      k.ball(greens[i % 3], x + Math.cos(a) * r, ground + sy * 0.75, z + Math.sin(a) * r, sx, sy, sx * range(0.85, 1.1));
    }
    for (let i = 0; i < 16; i++) {
      const a = range(0, Math.PI * 2),
        up = range(0.15, 1),
        r = Math.sqrt(1 - up * up) * 0.5 * size + 0.05;
      k.box(
        yellows[i % 3],
        x + Math.cos(a) * r,
        ground + 0.25 * size + up * 0.38 * size,
        z + Math.sin(a) * r,
        0.07,
        0.05,
        0.07,
        range(0, 1.5),
      );
    }
  }
  const mesh = k.mesh("Quarry gorse", material);
  k.dispose();
  return mesh;
}
