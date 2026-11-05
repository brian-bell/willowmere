import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { painted } from "../pub/parts.js";

// The windmill's materials and the batch its builders add parts to. A batch is
// every part of one material merged into one mesh, tinted by vertex colour, with
// UVs in metres and the grain along a timber's length. So all the mill's timber
// is one draw, and each thing that turns is one more.

function rng(seed) {
  return () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
}

// Pale, so a part's vertex colour decides its timber. The grain runs along u.
function paintTimber(c, h, size) {
  const random = rng(5021);
  c.fillStyle = "#d8cfc0";
  c.fillRect(0, 0, size, size);
  h.fillStyle = "#808080";
  h.fillRect(0, 0, size, size);
  for (let i = 0; i < 9000; i++) {
    const y = random() * size,
      x = random() * size,
      length = 20 + random() * 260,
      dark = random() > 0.42,
      alpha = 0.02 + random() * 0.07;
    c.fillStyle = dark ? `rgba(60,38,20,${alpha})` : `rgba(255,244,222,${alpha})`;
    c.fillRect(x, y, length, 0.6 + random() * 1.6);
    if (i % 3 === 0) {
      h.fillStyle = dark ? "rgba(40,40,40,0.16)" : "rgba(210,210,210,0.12)";
      h.fillRect(x, y, length, 1 + random() * 1.5);
    }
  }
  for (let i = 0; i < 90; i++) {
    const y = random() * size;
    c.strokeStyle = `rgba(52,31,15,${0.05 + random() * 0.1})`;
    c.lineWidth = 0.6 + random() * 1.4;
    c.beginPath();
    c.moveTo(0, y);
    c.bezierCurveTo(size * 0.3, y + random() * 12 - 6, size * 0.7, y + random() * 18 - 9, size, y);
    c.stroke();
  }
  // A few knots.
  for (let i = 0; i < 7; i++) {
    const x = random() * size,
      y = random() * size,
      r = 4 + random() * 8;
    const knot = c.createRadialGradient(x, y, 0, x, y, r * 2.2);
    knot.addColorStop(0, "rgba(46,27,14,0.6)");
    knot.addColorStop(1, "rgba(46,27,14,0)");
    c.fillStyle = knot;
    c.beginPath();
    c.ellipse(x, y, r * 2.6, r * 1.2, 0, 0, Math.PI * 2);
    c.fill();
  }
}

// Coursed rubble, limewashed long ago and worn through in patches. A course is
// about a third of a metre; the map repeats every 2.8 m round and up the wall.
function paintStone(c, h, size) {
  const random = rng(7717),
    courses = 8,
    row = size / courses;
  c.fillStyle = "#a9a08c";
  c.fillRect(0, 0, size, size);
  h.fillStyle = "#3c3c3c";
  h.fillRect(0, 0, size, size);
  const stones = ["#d5ccb6", "#cbc1ab", "#c2b8a1", "#dbd2bd", "#b9af98", "#cfc5ae", "#c7b89e"];
  for (let j = 0; j < courses; j++) {
    const count = 4 + Math.floor(random() * 2),
      widths = Array.from({ length: count }, () => 0.7 + random() * 0.8),
      total = widths.reduce((a, b) => a + b, 0),
      shift = random() * size;
    let x = 0;
    for (const w of widths) {
      const width = (w / total) * size,
        inset = size * 0.0045,
        top = j * row + inset + random() * inset,
        height = row - inset * 2 - random() * inset,
        colour = stones[Math.floor(random() * stones.length)],
        lift = 150 + Math.floor(random() * 60);
      // Drawn twice over the seam, so the texture wraps.
      for (const wrap of [-size, 0, size]) {
        const left = (x + shift) % size + wrap + inset;
        c.fillStyle = colour;
        c.beginPath();
        c.roundRect(left, top, width - inset * 2, height, size * 0.008);
        c.fill();
        h.fillStyle = `rgb(${lift},${lift},${lift})`;
        h.beginPath();
        h.roundRect(left, top, width - inset * 2, height, size * 0.008);
        h.fill();
      }
      x += width;
    }
  }
  // Limewash worn through and stained, then fine pitting.
  for (let i = 0; i < 90; i++) {
    const x = random() * size,
      y = random() * size,
      r = 30 + random() * 140,
      dark = random() > 0.55;
    for (const [ox, oy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
      const patch = c.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      patch.addColorStop(0, dark ? "rgba(84,70,52,0.13)" : "rgba(244,238,222,0.2)");
      patch.addColorStop(1, dark ? "rgba(84,70,52,0)" : "rgba(244,238,222,0)");
      c.fillStyle = patch;
      c.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
  for (let i = 0; i < 18000; i++) {
    const x = random() * size,
      y = random() * size,
      s = 0.7 + random() * 1.7;
    c.fillStyle = random() > 0.5 ? `rgba(255,248,232,${random() * 0.09})` : `rgba(44,33,22,${random() * 0.11})`;
    c.fillRect(x, y, s, s);
    if (i % 2) {
      h.fillStyle = random() > 0.5 ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.14)";
      h.fillRect(x, y, s, s);
    }
  }
}

function paintSacking(c, h, size) {
  const random = rng(311);
  c.fillStyle = "#d9cdb3";
  c.fillRect(0, 0, size, size);
  h.fillStyle = "#808080";
  h.fillRect(0, 0, size, size);
  const weave = size / 40;
  for (let i = 0; i < 40; i++)
    for (let j = 0; j < 40; j++) {
      const over = (i + j) % 2 === 0;
      c.fillStyle = `rgba(${over ? "118,98,66" : "255,246,224"},${0.05 + random() * 0.12})`;
      c.fillRect(i * weave, j * weave, over ? weave : weave * 0.8, over ? weave * 0.8 : weave);
      const v = over ? 170 : 90;
      h.fillStyle = `rgb(${v},${v},${v})`;
      h.fillRect(i * weave + 0.5, j * weave + 0.5, weave - 1, weave - 1);
    }
}

function paintStoneFace(c, size) {
  // The grinding face: a harp of furrows swept round the eye.
  const random = rng(911),
    mid = size / 2;
  c.fillStyle = "#b6b0a2";
  c.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i++) {
    c.fillStyle = random() > 0.5 ? `rgba(238,232,218,${random() * 0.3})` : `rgba(66,60,50,${random() * 0.22})`;
    c.fillRect(random() * size, random() * size, 1 + random() * 3, 1 + random() * 3);
  }
  c.translate(mid, mid);
  for (let harp = 0; harp < 8; harp++) {
    c.rotate((Math.PI * 2) / 8);
    for (let k = 0; k < 4; k++) {
      c.strokeStyle = `rgba(58,52,44,${0.66 - k * 0.07})`;
      c.lineWidth = size * 0.012;
      c.beginPath();
      const offset = size * (0.03 + k * 0.05);
      c.moveTo(size * 0.1, -offset * 0.4);
      c.lineTo(size * (0.49 - k * 0.018), size * 0.22 - offset);
      c.stroke();
    }
  }
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = "#3a3630";
  c.beginPath();
  c.arc(mid, mid, size * 0.09, 0, Math.PI * 2);
  c.fill();
  // A dusting of flour.
  const flour = c.createRadialGradient(mid, mid, size * 0.12, mid, mid, size * 0.5);
  flour.addColorStop(0, "rgba(246,240,226,0.5)");
  flour.addColorStop(1, "rgba(246,240,226,0.04)");
  c.fillStyle = flour;
  c.fillRect(0, 0, size, size);
}

// The miller's tally beside the door: chalk strokes in fives on a slate.
function paintSlate(c, width, height) {
  const random = rng(1907);
  c.fillStyle = "#3a403f";
  c.fillRect(0, 0, width, height);
  for (let i = 0; i < 900; i++) {
    c.fillStyle = `rgba(255,255,255,${random() * 0.02})`;
    c.fillRect(random() * width, random() * height, 2 + random() * 26, 1 + random() * 3);
  }
  c.lineCap = "round";
  let x = 26,
    y = 26;
  for (let group = 0; group < 46; group++) {
    const fade = 0.32 + (group / 46) * 0.58;
    c.strokeStyle = `rgba(238,233,218,${fade})`;
    c.lineWidth = 2.4;
    for (let n = 0; n < 4; n++) {
      c.beginPath();
      c.moveTo(x + n * 8 + random() * 2, y + random() * 3);
      c.lineTo(x + n * 8 + random() * 2, y + 28 + random() * 3);
      c.stroke();
    }
    c.beginPath();
    c.moveTo(x - 4, y + 25 + random() * 3);
    c.lineTo(x + 28, y + 3 + random() * 3);
    c.stroke();
    x += 50;
    if (x > width - 46) {
      x = 26;
      y += 44;
    }
  }
}

export function canvasMaterial(width, height, draw, options = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d"), width, height);
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  map.anisotropy = 8;
  return new T.MeshStandardMaterial({ map, roughness: 0.85, ...options });
}

export function createWindmillMaterials() {
  const timber = painted(1024, 1.7, paintTimber, { roughness: 0.8, bump: 0.012 }),
    stone = painted(1536, 2.8, paintStone, { roughness: 0.96, bump: 0.035 }),
    cloth = painted(256, 0.3, paintSacking, { roughness: 1, bump: 0.008 });
  for (const m of [timber, stone, cloth]) m.vertexColors = true;
  return {
    timber,
    stone,
    cloth,
    iron: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.56, metalness: 0.6 }),
    face: canvasMaterial(512, 512, (c, size) => paintStoneFace(c, size), { roughness: 0.95 }),
    slate: canvasMaterial(512, 330, paintSlate, { roughness: 0.9 }),
    glow: new T.MeshStandardMaterial({
      color: "#ffd8a0",
      emissive: "#ffae5e",
      emissiveIntensity: 1.6,
      roughness: 0.5,
    }),
    glass: new T.MeshStandardMaterial({
      color: "#dfeef0",
      roughness: 0.3,
      metalness: 0,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
    }),
  };
}

/**
 * Rewrites a posed-at-origin part's UVs in metres, projected along each face's
 * normal, with the grain along `grain` (the axis it runs along) wherever it can.
 */
function metricUV(geometry, grain, random) {
  const position = geometry.attributes.position,
    normal = geometry.attributes.normal,
    uv = new Float32Array(position.count * 2),
    offset = [random() * 7, random() * 7];
  for (let i = 0; i < position.count; i++) {
    const n = [normal.getX(i), normal.getY(i), normal.getZ(i)].map(Math.abs),
      facing = n.indexOf(Math.max(...n)),
      p = [position.getX(i), position.getY(i), position.getZ(i)],
      others = [0, 1, 2].filter((a) => a !== facing),
      along = others.includes(grain) ? grain : others[0],
      other = others.find((a) => a !== along);
    uv[i * 2] = p[along] + offset[0];
    uv[i * 2 + 1] = p[other] + offset[1];
  }
  geometry.setAttribute("uv", new T.BufferAttribute(uv, 2));
}

/** A batch of parts for one material, seeded for its small variations. */
export function createBatch(seed) {
  const random = rng(seed),
    parts = [],
    color = new T.Color(),
    matrix = new T.Matrix4(),
    quaternion = new T.Quaternion(),
    position = new T.Vector3(),
    scale = new T.Vector3(1, 1, 1),
    euler = new T.Euler(),
    up = new T.Vector3(0, 1, 0),
    from = new T.Vector3(),
    to = new T.Vector3();
  let frame = null;

  function push(geometry, hex, vary = 0.07) {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (flat !== geometry) geometry.dispose();
    if (hex !== null) {
      const shade = 1 + (random() - 0.5) * vary * 2;
      color.set(hex).multiplyScalar(shade);
      const count = flat.attributes.position.count,
        colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) color.toArray(colors, i * 3);
      flat.setAttribute("color", new T.BufferAttribute(colors, 3));
    }
    if (frame) flat.applyMatrix4(frame);
    parts.push(flat);
    return flat;
  }

  function pose(geometry, x, y, z, rx = 0, ry = 0, rz = 0) {
    matrix.compose(position.set(x, y, z), quaternion.setFromEuler(euler.set(rx, ry, rz, "YXZ")), scale.set(1, 1, 1));
    geometry.applyMatrix4(matrix);
    return geometry;
  }

  const rounded = (w, h, d, r) =>
    r > 0 ? new RoundedBoxGeometry(w, h, d, 1, Math.min(r, w / 2.01, h / 2.01, d / 2.01)) : new T.BoxGeometry(w, h, d);

  const b = {
    random,
    range: (a, c) => a + random() * (c - a),
    /** A timber or board w x h x d, centred at (x, y, z), its grain along its longest side. */
    box(hex, x, y, z, w, h, d, { ry = 0, rx = 0, rz = 0, r = 0.012, vary } = {}) {
      const geometry = rounded(w, h, d, r),
        sizes = [w, h, d];
      metricUV(geometry, sizes.indexOf(Math.max(...sizes)), random);
      pose(geometry, x, y, z, rx, ry, rz);
      return push(geometry, hex, vary);
    },
    /** A square timber from a to b ([x, y, z] each), `w` wide and `d` deep. */
    beam(hex, a, c, w = 0.09, d = w, { r = 0.012, roll = 0, vary } = {}) {
      from.set(...a);
      to.set(...c);
      const length = from.distanceTo(to),
        geometry = rounded(w, length, d, r);
      metricUV(geometry, 1, random);
      if (roll) geometry.rotateY(roll);
      quaternion.setFromUnitVectors(up, to.clone().sub(from).normalize());
      matrix.compose(position.copy(from).add(to).multiplyScalar(0.5), quaternion, scale.set(1, 1, 1));
      geometry.applyMatrix4(matrix);
      return push(geometry, hex, vary);
    },
    /** A round part along its own y: a shaft, drum or hoop, tapering to `rt` at the top. */
    drum(hex, x, y, z, r, h, { rt = r, segments = 14, rx = 0, ry = 0, rz = 0, vary, open = false, grain = "along" } = {}) {
      const geometry = new T.CylinderGeometry(rt, r, h, segments, 1, open),
        uv = geometry.attributes.uv,
        p = geometry.attributes.position,
        n = geometry.attributes.normal,
        c = Math.PI * (r + rt),
        offset = random() * 7;
      for (let i = 0; i < uv.count; i++) {
        if (Math.abs(n.getY(i)) > 0.9) uv.setXY(i, p.getX(i) + offset, p.getZ(i));
        else if (grain === "along") uv.setXY(i, p.getY(i) + offset, uv.getX(i) * c);
        else uv.setXY(i, uv.getX(i) * c + offset, p.getY(i));
      }
      pose(geometry, x, y, z, rx, ry, rz);
      return push(geometry, hex, vary);
    },
    /** A ball, squashed to (sx, sy, sz); `detail` rounds it. */
    ball(hex, x, y, z, sx, sy = sx, sz = sx, { detail = 12, rx = 0, ry = 0, rz = 0, vary } = {}) {
      const geometry = new T.SphereGeometry(1, detail, Math.max(6, Math.round(detail * 0.7))),
        uv = geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx * 6, uv.getY(i) * sy * 3);
      geometry.scale(sx, sy, sz);
      pose(geometry, x, y, z, rx, ry, rz);
      return push(geometry, hex, vary);
    },
    /** A geometry already posed; hex null keeps its own colours. */
    piece: (geometry, hex = null, vary) => push(geometry, hex, vary),
    /** Builds parts in a frame, turned by ry and placed at (x, y, z). */
    placed(x, y, z, ry, build) {
      b.framed(new T.Matrix4().compose(
        new T.Vector3(x, y, z),
        new T.Quaternion().setFromEuler(new T.Euler(0, ry, 0)),
        new T.Vector3(1, 1, 1),
      ), build);
    },
    /** Builds parts moved by a whole matrix. */
    framed(m, build) {
      const before = frame;
      frame = before ? before.clone().multiply(m) : m;
      build();
      frame = before;
    },
    get count() {
      return parts.length;
    },
    /** Everything so far as one mesh. Moving parts ask for no shadow. */
    mesh(name, material, { cast = true, receive = true, moving = false } = {}) {
      const merged = mergeGeometries(parts, false);
      for (const part of parts) part.dispose();
      parts.length = 0;
      merged.computeBoundingSphere();
      const mesh = new T.Mesh(merged, material);
      mesh.name = name;
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
      if (!moving) {
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
      }
      return mesh;
    },
  };
  return b;
}

/**
 * Non-indexed triangles with flat normals, for the shapes no primitive makes:
 * a list of quads ([a, b, c, d], counter-clockwise from the side that shows, each
 * corner [x, y, z, u, v]). Hex paints it all; `shade(x, y, z)` varies it per corner.
 */
export function quadsGeometry(quads, hex, shade) {
  const position = new Float32Array(quads.length * 18),
    uv = new Float32Array(quads.length * 12),
    colour = new Float32Array(quads.length * 18),
    base = new T.Color(hex),
    c = new T.Color();
  quads.forEach((quad, i) => {
    [0, 1, 2, 0, 2, 3].forEach((corner, j) => {
      const [x, y, z, u, v] = quad[corner];
      position.set([x, y, z], i * 18 + j * 3);
      uv.set([u, v], i * 12 + j * 2);
      c.copy(base);
      if (shade) c.multiplyScalar(shade(x, y, z));
      c.toArray(colour, i * 18 + j * 3);
    });
  });
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.BufferAttribute(position, 3));
  geometry.setAttribute("uv", new T.BufferAttribute(uv, 2));
  geometry.setAttribute("color", new T.BufferAttribute(colour, 3));
  geometry.computeVertexNormals();
  return geometry;
}
