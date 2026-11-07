// The old barrows on either side of the millpond: grassy mounds that sit on
// the ground, the kerbstones round the old mound, the long barrow's stone
// doorway and forecourt, the standing stones and a few sarsens, and the
// spirals carved into the stones, which glow at blue hour like the fairy ring.
// Loaded with import() once the village is on screen and built by the
// streamer a piece at a time. Their shape, colliders and walking heights live
// in barrows-layout.js, which loads with the village.
//
// The mounds share the open country's grass texture and blades, and the
// stones the kit's painted material, so the barrows add no shader programs.
import { chunkRandom } from "../world-layout.js";
import { createKit } from "./kit.js";
import {
  BARROWS as B,
  barrowLandmarks,
  carvedStone,
  doorU,
  forecourtStones,
  groundUnder,
  kerbstones,
  moundById,
  moundHeight,
  moundPoint,
} from "./barrows-layout.js";
import { MILLPOND } from "./millpond-layout.js";

const TAU = Math.PI * 2;
// The sun's direction across the ground (main.js's sun stands at -16, 32, 15).
const SUN = [-16, 32, 15].map((v) => v / Math.hypot(16, 32, 15));
// Spacing of the mounds' mesh vertices, in metres.
const MOUND_STEP = 0.2;
// Blades per square metre, the open country's density (outskirts.js).
const GRASS_DENSITY = 1.7;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Streamer jobs for the barrows: each side's mounds, then its stones. */
export function barrowsJobs(T, world) {
  const job = (key, x, z, step, added) => ({ key, x, z, step, added });
  const material = world.groundMaterial.clone();
  material.vertexColors = true;
  const stoneMaterial = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }),
    // Pale where the carving cuts the weathered skin; lit from within at
    // blue hour (glowMaterials raise its intensity).
    carving = new T.MeshStandardMaterial({
      color: "#e4ebe2",
      roughness: 0.7,
      emissive: "#78d0e4",
      emissiveIntensity: 0.25,
    });
  // The west side lies beside the pond, whose water reflects it; nothing on
  // the east side is near enough to show.
  const added = (side, { detail = false, captured = side === "west", field = false } = {}) =>
    (meshes) => {
      for (const mesh of meshes) {
        world.addStreamed(mesh, { detail, field });
        if (!captured) world.water.excludeFromCaptures(mesh);
      }
    };
  const centre = (side) => {
    const mounds = B.mounds.filter((m) => m.side === side);
    return [
      mounds.reduce((n, m) => n + m.x, 0) / mounds.length,
      mounds.reduce((n, m) => n + m.z, 0) / mounds.length,
    ];
  };
  const jobs = [];
  for (const [side, seed] of [
    ["west", 0],
    ["east", 1],
  ]) {
    const [x, z] = centre(side);
    jobs.push(
      job(`barrows ${side} mounds`, x, z, () => [mounds(T, side, material)], added(side)),
      job(
        `barrows ${side} grass`,
        x,
        z,
        () => [moundGrass(T, world, side, chunkRandom(seed, -3, 23))],
        added(side, { detail: true, captured: false, field: true }),
      ),
      job(
        `barrows ${side} stones`,
        x,
        z,
        () => stones(T, side, chunkRandom(seed, -3, 29), stoneMaterial, carving),
        (meshes) => {
          const [stonesMesh, carvings] = meshes;
          added(side)([stonesMesh]);
          // The carvings are a few pixels in a reflection.
          added(side, { captured: false })([carvings]);
          world.interactables.push(...barrowLandmarks().filter((l) => sideOf(l.x) === side));
        },
      ),
    );
  }
  return jobs;
}

// Which side of the pond a place lies on.
const sideOf = (x) => (x > MILLPOND.centre.x ? "east" : "west");

// --- Mounds -----------------------------------------------------------------

// Vertex colours tint the open country's grass texture, so a mound's foot
// (white) matches the lawn around it. Tints are the wanted colour over the
// grass texture's own (#7f9f5c), in linear terms.
function tint(T, hex) {
  const base = new T.Color("#7f9f5c"),
    color = new T.Color(hex);
  return new T.Color(color.r / base.r, color.g / base.g, color.b / base.b);
}

/** One side's mounds, one mesh: a grid over each mound, kept where it rises. */
function mounds(T, side, material) {
  const lawn = new T.Color(1, 1, 1),
    foot = tint(T, "#5e8a45"),
    lush = tint(T, "#6f9a50"),
    crown = tint(T, "#98ad62"),
    sunlit = tint(T, "#a6bd6c"),
    shade = tint(T, "#557a46"),
    worn = tint(T, "#a39a78"),
    color = new T.Color(),
    positions = [],
    colors = [],
    uvs = [],
    index = [];
  for (const m of B.mounds.filter((m) => m.side === side)) {
    const R = (m.half ?? 0) + m.r + MOUND_STEP,
      cols = Math.ceil((2 * R) / MOUND_STEP) + 1,
      first = positions.length / 3,
      heights = [];
    for (let row = 0; row < cols; row++)
      for (let col = 0; col < cols; col++) {
        const x = m.x - R + col * MOUND_STEP,
          z = m.z - R + row * MOUND_STEP,
          h = moundHeight(m, x, z),
          ground = groundUnder(x, z);
        heights.push(h);
        positions.push(x, ground + h - B.sink, z);
        uvs.push(x / 33.5, -z / 41.6);
        // A darker, lusher ring at the foot, rich flanks and a paler crown
        // where the wind keeps the grass short; slopes facing the sun are
        // lighter, the others in shade, so each mound reads from above. A
        // trodden patch lies in the long barrow's doorway.
        const rise = h / m.h,
          gx = (moundHeight(m, x + 0.1, z) - moundHeight(m, x - 0.1, z)) / 0.2,
          gz = (moundHeight(m, x, z + 0.1) - moundHeight(m, x, z - 0.1)) / 0.2,
          facing = (-gx * SUN[0] - gz * SUN[2]) / Math.hypot(gx, 1, gz);
        color
          .copy(lawn)
          .lerp(foot, smooth(0, 0.05, rise) * (1 - smooth(0.12, 0.4, rise)) * 0.75)
          .lerp(lush, smooth(0.3, 0.55, rise) * 0.7)
          .lerp(crown, smooth(0.72, 1, rise) * 0.55);
        if (facing > 0) color.lerp(sunlit, Math.min(1, facing * 1.6) * 0.65);
        else color.lerp(shade, Math.min(1, -facing * 1.8) * 0.75);
        if (m.door) {
          const p = moundPoint(m, doorU(m) + 0.5, 0),
            d = Math.hypot(x - p.x, z - p.z);
          color.lerp(worn, (1 - smooth(0.5, 1.3, d)) * 0.7);
        }
        color.toArray(colors, positions.length - 3);
      }
    for (let r = 0; r < cols - 1; r++)
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c,
          b = a + 1,
          d = a + cols,
          e = d + 1;
        // Only the cells that rise; the rest would lie under the lawn.
        if (Math.max(heights[a], heights[b], heights[d], heights[e]) <= 0) continue;
        index.push(first + a, first + d, first + b, first + b, first + d, first + e);
      }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  // Drop the vertices no cell uses.
  const compact = compacted(T, geometry);
  compact.computeBoundingSphere();
  const mesh = new T.Mesh(compact, material);
  mesh.name = `Barrows (${side})`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  return mesh;
}

/** The geometry with only the vertices its triangles use. */
function compacted(T, geometry) {
  const index = geometry.index.array,
    remap = new Map(),
    out = new T.BufferGeometry(),
    attributes = Object.entries(geometry.attributes),
    arrays = attributes.map(() => []);
  const indices = [];
  for (const i of index) {
    if (!remap.has(i)) {
      remap.set(i, remap.size);
      attributes.forEach(([, a], k) => {
        for (let j = 0; j < a.itemSize; j++) arrays[k].push(a.array[i * a.itemSize + j]);
      });
    }
    indices.push(remap.get(i));
  }
  attributes.forEach(([name, a], k) =>
    out.setAttribute(name, new T.Float32BufferAttribute(arrays[k], a.itemSize)),
  );
  out.setIndex(indices);
  geometry.dispose();
  return out;
}

/** The open country's grass, grown over one side's mounds. */
function moundGrass(T, world, side, rand) {
  const { geometry, material } = world.grassBlade,
    list = B.mounds.filter((m) => m.side === side),
    range = (a, b) => a + (b - a) * rand(),
    area = list.reduce((n, m) => n + (2 * (m.half ?? 0) + 2 * m.r) * 2 * m.r, 0),
    count = Math.round(area * GRASS_DENSITY),
    blades = new T.InstancedMesh(geometry, material, count),
    dummy = new T.Object3D();
  let placed = 0;
  for (const m of list) {
    const R = (m.half ?? 0) + m.r,
      share = Math.round(((2 * R * 2 * m.r) / area) * count);
    for (let i = 0; i < share && placed < count; i++) {
      // A point in the mound's own frame, so the long barrow's box fits it.
      const u = range(-R, R),
        v = range(-m.r, m.r),
        { x, z } = moundPoint(m, u, v),
        tilt = range(-0.3, 0.3),
        turn = range(0, TAU),
        lean = range(-0.3, 0.3),
        height = range(0.6, 1.3),
        h = moundHeight(m, x, z);
      // Every blade draws its random numbers, so a skipped one moves no other.
      if (h <= 0.04) continue;
      dummy.position.set(x, groundUnder(x, z) + h - B.sink + 0.1, z);
      dummy.rotation.set(tilt, turn, lean);
      dummy.scale.set(1, height, 1);
      dummy.updateMatrix();
      blades.setMatrixAt(placed++, dummy.matrix);
    }
  }
  blades.count = placed;
  blades.name = `Barrows grass (${side})`;
  blades.receiveShadow = true;
  blades.matrixAutoUpdate = false;
  blades.updateMatrix();
  blades.computeBoundingSphere();
  return blades;
}

// --- Stones -------------------------------------------------------------------

const GREYS = ["#9a9a8c", "#a5a393", "#8e938a", "#b0aa98", "#97958a"],
  LICHEN = ["#b9b46e", "#d4d2bf", "#c7c089"],
  MOSS = "#6f8350",
  DARK = "#151311";

/**
 * A weathered stone: a lumpy, flat-faced ball (scale it to shape), each face
 * grey with a few spotted with lichen or moss.
 */
function rock(T, rand, grey, { lichen = 0.14, moss = 0.08, rough = 0.2 } = {}) {
  const geometry = new T.IcosahedronGeometry(1, 1),
    p = geometry.attributes.position,
    seed = rand() * 100;
  // The same position always moves the same way, so shared corners stay shared.
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i),
      n =
        Math.sin(x * 3.1 + seed) * Math.sin(y * 2.7 + seed * 0.7) +
        0.6 * Math.sin(z * 4.3 - seed * 1.3 + x * 1.1);
    p.setXYZ(i, x * (1 + rough * n * 0.5), y * (1 + rough * n * 0.5), z * (1 + rough * n * 0.5));
  }
  geometry.computeVertexNormals();
  paintFaces(T, geometry, rand, grey, lichen, moss);
  return geometry;
}

/**
 * A standing slab, its foot at y = 0 and its broad face to +z: it narrows
 * toward a top that slopes from front to back, and its front stays one flat
 * face for the carvings. `taper` narrows its width at the top.
 */
function slab(T, rand, grey, w, h, d, { taper = 0.72, slope = 0.12, lichen = 0.1 } = {}) {
  const geometry = new T.BoxGeometry(1, 1, 1).toNonIndexed(),
    p = geometry.attributes.position,
    skew = (rand() - 0.5) * 0.18;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    if (y > 0) {
      x = x * taper + skew;
      // The back leans in toward the front; the front stays plumb.
      if (z < 0) z = z * 0.7 + 0.15;
      y += z > 0 ? 0 : -slope;
    }
    p.setXYZ(i, x * w, (y + 0.5) * h, z * d);
  }
  geometry.computeVertexNormals();
  // Each side is two triangles: paint them alike.
  paintFaces(T, geometry, rand, grey, lichen, 0.05, 6);
  return geometry;
}

/** Paints each face (`group` vertices) grey, or spotted with lichen or moss. */
function paintFaces(T, geometry, rand, grey, lichen, moss, group = 3) {
  const count = geometry.attributes.position.count,
    colors = new Float32Array(count * 3),
    base = new T.Color(grey),
    color = new T.Color();
  for (let f = 0; f < count; f += group) {
    const roll = rand();
    if (roll < lichen) color.set(LICHEN[Math.floor(rand() * LICHEN.length)]);
    else if (roll < lichen + moss) color.set(MOSS);
    else color.copy(base).multiplyScalar(0.92 + rand() * 0.14);
    for (let k = 0; k < group; k++) color.toArray(colors, (f + k) * 3);
  }
  geometry.setAttribute("color", new T.BufferAttribute(colors, 3));
}

/**
 * A spiral cut into a face: a thin tube winding out from (cx, cy) in the
 * face's plane (z = 0), `turns` times to `radius`, clockwise when `dir` < 0.
 */
function spiral(T, cx, cy, radius, turns, dir = 1, start = 0) {
  const points = [],
    steps = Math.round(turns * 20);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      a = start + dir * t * turns * TAU,
      r = radius * (0.12 + 0.88 * t);
    points.push(new T.Vector3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0));
  }
  const curve = new T.CatmullRomCurve3(points);
  return new T.TubeGeometry(curve, steps, radius * 0.12, 3, false);
}

/**
 * Two spirals joined by an S, one above the other: the old mound's and the
 * standing stones' sign.
 */
function doubleSpiral(T, cx, cy, radius) {
  const turns = 2.25,
    end = turns * TAU;
  const lower = spiral(T, cx, cy - radius * 1.02, radius, turns, 1, -end + Math.PI / 2),
    upper = spiral(T, cx, cy + radius * 1.02, radius, turns, 1, -end - Math.PI / 2);
  return [lower, upper];
}

/** A placement matrix: at (x, y, z), turned to face `face` and leaning by `lean`. */
function placing(T, x, y, z, face, lean = 0, roll = 0) {
  return new T.Matrix4().compose(
    new T.Vector3(x, y, z),
    new T.Quaternion().setFromEuler(new T.Euler(lean, Math.PI / 2 - face, roll, "YXZ")),
    new T.Vector3(1, 1, 1),
  );
}

/** The ground under a stone: the lawn, or the mound it stands on. */
function seat(x, z) {
  let rise = 0;
  for (const m of B.mounds) rise = Math.max(rise, moundHeight(m, x, z));
  return groundUnder(x, z) + Math.max(0, rise - B.sink);
}

/** One side's stones as one painted mesh, and their carvings as another. */
function stones(T, side, rand, material, carvingMaterial) {
  const k = createKit(T),
    range = (a, b) => a + (b - a) * rand(),
    grey = () => GREYS[Math.floor(rand() * GREYS.length)],
    carved = [];
  // A part built at the origin, moved into place.
  const put = (geometry, matrix) => k.piece(geometry.applyMatrix4(matrix));
  const carve = (parts, matrix) => {
    for (const part of parts) carved.push(part.applyMatrix4(matrix));
  };

  // Standing stones, each with a double spiral on its face.
  for (const s of B.stones.filter((s) => sideOf(s.x) === side)) {
    const w = s.height * 0.34,
      d = s.height * 0.2,
      at = placing(T, s.x, seat(s.x, s.z) - 0.12, s.z, s.face, s.lean, range(-0.04, 0.04));
    put(slab(T, rand, grey(), w, s.height + 0.12, d), at);
    const r = w * 0.2;
    carve(
      doubleSpiral(T, 0, s.height * 0.5, r).map((g) => g.translate(0, 0, d / 2 + 0.004)),
      at,
    );
    // A few stones fallen at its foot.
    for (let i = 0; i < 3; i++) {
      const a = range(0, TAU),
        dist = range(0.55, 0.95),
        x = s.x + Math.cos(a) * dist,
        z = s.z + Math.sin(a) * dist,
        size = range(0.08, 0.16);
      put(rock(T, rand, grey()), placing(T, x, seat(x, z) + size * 0.2, z, a).multiply(
        new T.Matrix4().makeScale(size * 1.3, size * 0.7, size),
      ));
    }
  }

  if (side === "west") {
    // The old mound's kerb: squat blocks leaning in toward the mound.
    for (const s of kerbstones()) {
      const size = s.size;
      put(
        rock(T, rand, grey(), { rough: 0.16 }),
        placing(T, s.x, seat(s.x, s.z) + size * 0.35, s.z, s.angle, -0.12).multiply(
          new T.Matrix4().makeScale(size * 1.25, size * 1.15, size * 0.85),
        ),
      );
    }
    // The carved stone in the ring's gap, facing out.
    const c = carvedStone(),
      at = placing(T, c.x, seat(c.x, c.z) - 0.1, c.z, c.angle, -0.08);
    put(slab(T, rand, grey(), 0.8, 0.95, 0.24, { taper: 0.82, slope: 0.08 }), at);
    carve(
      doubleSpiral(T, 0, 0.5, 0.11).map((g) => g.translate(0, 0, 0.124)),
      at,
    );
    // Sarsens in the grass toward the hill.
    for (const [x, z, size] of [
      [-4.1, -29.4, 0.34],
      [-3.4, -36.6, 0.28],
      [2.6, -34.9, 0.22],
    ])
      put(
        rock(T, rand, grey()),
        placing(T, x, seat(x, z) + size * 0.2, z, range(0, TAU)).multiply(
          new T.Matrix4().makeScale(size * 1.5, size * 0.75, size * 1.1),
        ),
      );
  } else {
    // The long barrow's doorway: two portal stones under a capstone, a dark
    // passage behind them, and the door stone pushed a little aside.
    const m = moundById("long-barrow"),
      u0 = doorU(m),
      door = moundPoint(m, u0, 0),
      at = placing(T, door.x, groundUnder(door.x, door.z) - 0.05, door.z, m.turn ?? 0);
    k.transformed(at, () => {
      k.box(DARK, 0, 0.55, -0.3, 0.8, 1.1, 0.7);
      // Its floor, worn smooth.
      k.box("#8c8576", 0, 0.03, 0.42, 1.25, 0.1, 0.55);
    });
    for (const across of [-1, 1])
      put(
        slab(T, rand, grey(), 0.36, 1.2, 0.5, { taper: 0.85, slope: 0.05 }),
        at.clone().multiply(new T.Matrix4().makeTranslation(across * 0.58, 0, -0.05)),
      );
    put(
      slab(T, rand, grey(), 1.75, 0.34, 1.0, { taper: 0.9, slope: 0.06 }),
      at.clone().multiply(new T.Matrix4().makeTranslation(0, 1.15, -0.2)),
    );
    // The door stone, ajar: a dark gap shows down its left edge.
    put(
      slab(T, rand, grey(), 0.66, 1.0, 0.16, { taper: 0.88, slope: 0.04 }),
      at.clone().multiply(
        new T.Matrix4().compose(
          new T.Vector3(0.16, 0, 0.12),
          new T.Quaternion().setFromEuler(new T.Euler(0, -0.32, 0)),
          new T.Vector3(1, 1, 1),
        ),
      ),
    );
    // A spiral on each portal stone, turning toward the door.
    for (const across of [-1, 1])
      carve(
        [spiral(T, across * 0.58, 0.68, 0.11, 2.4, -across)].map((g) => g.translate(0, 0, 0.205)),
        at,
      );
    // A row of cup marks along the capstone's lip.
    for (let i = -2; i <= 2; i++)
      carve([new T.TorusGeometry(0.035, 0.008, 3, 8).translate(i * 0.24, 1.3, 0.305)], at);
    // The forecourt's uprights, facing the door.
    for (const s of forecourtStones()) {
      const face = Math.atan2(door.z - s.z, door.x - s.x);
      put(
        slab(T, rand, grey(), s.height * 0.42, s.height + 0.1, s.height * 0.24, { taper: 0.7 }),
        placing(T, s.x, seat(s.x, s.z) - 0.1, s.z, face, range(-0.08, 0.08)),
      );
    }
    // A long stone lies fallen in the grass by the barrow's flank.
    const fallen = moundPoint(m, 0.6, m.r + 0.9);
    put(
      slab(T, rand, grey(), 0.5, 1.6, 0.3, { taper: 0.75 }),
      placing(T, fallen.x, seat(fallen.x, fallen.z) + 0.12, fallen.z, (m.turn ?? 0) + 0.3).multiply(
        new T.Matrix4().makeRotationX(Math.PI / 2 - 0.04),
      ),
    );
    // Sarsens scattered between the mounds.
    for (const [x, z, size] of [
      [30.2, -27.6, 0.3],
      [35.6, -35.4, 0.36],
      [25.9, -33.6, 0.24],
      [39.2, -30.2, 0.27],
    ])
      put(
        rock(T, rand, grey()),
        placing(T, x, seat(x, z) + size * 0.2, z, range(0, TAU)).multiply(
          new T.Matrix4().makeScale(size * 1.5, size * 0.75, size * 1.1),
        ),
      );
  }
  const mesh = k.mesh(`Barrow stones (${side})`, material),
    carvingGeometry = mergeCarvings(T, carved),
    carvings = new T.Mesh(carvingGeometry, carvingMaterial);
  carvings.name = `Barrow carvings (${side})`;
  carvings.matrixAutoUpdate = false;
  k.dispose();
  return [mesh, carvings];
}

function mergeCarvings(T, parts) {
  const k = createKit(T);
  for (const part of parts) {
    part.deleteAttribute("uv");
    k.piece(part, "#ffffff");
  }
  const geometry = k.geometry();
  geometry.deleteAttribute("color");
  k.dispose();
  return geometry;
}
