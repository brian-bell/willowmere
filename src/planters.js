import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Doorstep pots, window boxes and foundation beds share one vertex-colored
// material, so every planting in the village bakes into a single draw.
const material = new T.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.82,
  // Leaves are single-sided and face out of their clump; shadows use both faces.
  shadowSide: T.DoubleSide,
});

// A small cupped leaf with a raised midrib, pointing along +Z.
function leafTemplate() {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute(
    "position",
    new T.Float32BufferAttribute(
      [
        0, 0, 0, -0.34, 0.03, 0.38, 0, 0.12, 0.45, 0.34, 0.03, 0.38, -0.2, 0.02,
        0.74, 0.2, 0.02, 0.74, 0, 0.05, 1,
      ],
      3,
    ),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3, 1, 4, 2, 3, 2, 5, 4, 6, 2, 2, 6, 5]);
  return geometry.toNonIndexed();
}
// A narrow strap leaf for lavender and foxglove rosettes.
function strapTemplate() {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute(
    "position",
    new T.Float32BufferAttribute(
      [0, 0, 0, -0.12, 0.04, 0.45, 0, 0.09, 0.5, 0.12, 0.04, 0.45, 0, 0.03, 1],
      3,
    ),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3, 1, 4, 2, 2, 4, 3]);
  return geometry.toNonIndexed();
}
const templates = {
  leaf: leafTemplate(),
  strap: strapTemplate(),
  bud: new T.OctahedronGeometry(1, 0),
  floret: new T.IcosahedronGeometry(1, 0),
  stem: new T.CylinderGeometry(1, 1, 1, 3, 1, true)
    .translate(0, 0.5, 0)
    .toNonIndexed(),
  pebble: new T.DodecahedronGeometry(1, 0).toNonIndexed(),
};
for (const geometry of Object.values(templates)) {
  geometry.deleteAttribute("uv");
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
}

// Planting palettes. Foliage runs shadowed to sunlit; flowers are [main, eye].
const foliage = {
  geranium: ["#3d5f37", "#4f733f", "#668a4a", "#7e9b56"],
  lavender: ["#66786a", "#7d8f7c", "#93a28d", "#a9b39b"],
  box: ["#36553a", "#46663f", "#587a48", "#6d8f52"],
  fern: ["#47693a", "#5c7f43", "#73964d", "#8aa95a"],
  ivy: ["#2f4f33", "#3f6339", "#557a43", "#6b8b4c"],
};
const blooms = {
  rose: ["#d9798a", "#f2c7c5"],
  coral: ["#e3735c", "#f4b29a"],
  scarlet: ["#c9463f", "#e88a6c"],
  white: ["#f3eedc", "#e7c95c"],
  butter: ["#f1d272", "#c98a2f"],
  lilac: ["#a691c8", "#d3c6e6"],
  lavender: ["#8571b4", "#a996d0"],
  blush: ["#e8a3b0", "#f7d9d4"],
  marigold: ["#ec9a3a", "#b4561f"],
  sky: ["#8aa7d6", "#e9e3b8"],
};

export function createPlanters(seed = 4127) {
  const rand = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const range = (a, b) => a + (b - a) * rand();
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const dummy = new T.Object3D(),
    up = new T.Vector3(0, 1, 0),
    v = new T.Vector3(),
    n = new T.Vector3(),
    out = new T.Vector3(),
    tint = new T.Color();
  let parts = [];

  // Appends one transformed template. Normals bend toward `bend` (a clump
  // center), so a mound of leaves shades as one soft form instead of a mosaic,
  // and color darkens toward the clump's base to stand in for occlusion.
  function add(kind, matrix, color, bend = null, amount = 0.65, shade = null) {
    const geometry = templates[kind].clone().applyMatrix4(matrix);
    const position = geometry.attributes.position,
      normal = geometry.attributes.normal,
      colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i);
      n.fromBufferAttribute(normal, i);
      if (bend) {
        out.copy(v).sub(bend).normalize();
        n.lerp(out, amount).normalize();
        normal.setXYZ(i, n.x, n.y, n.z);
      }
      let light = 1;
      if (shade) {
        const [base, height] = shade;
        light = 0.55 + 0.45 * Math.min(1, Math.max(0, (v.y - base) / height));
      }
      colors[i * 3] = color.r * light;
      colors[i * 3 + 1] = color.g * light;
      colors[i * 3 + 2] = color.b * light;
    }
    geometry.setAttribute("color", new T.BufferAttribute(colors, 3));
    parts.push(geometry);
  }
  function place(x, y, z, rx, ry, rz, sx, sy = sx, sz = sx) {
    dummy.position.set(x, y, z);
    dummy.rotation.set(rx, ry, rz);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    return dummy.matrix;
  }
  function vary(hex, jitter = 0.08) {
    return tint.set(hex).multiplyScalar(range(1 - jitter, 1 + jitter));
  }
  function stem(a, b, width, hex) {
    dummy.position.copy(a);
    dummy.quaternion.setFromUnitVectors(up, v.copy(b).sub(a).normalize());
    dummy.scale.set(width, a.distanceTo(b), width);
    dummy.updateMatrix();
    add("stem", dummy.matrix, vary(hex, 0.05));
  }

  // A leafy dome. Leaves sit on a flattened shell, tilted outward and upward,
  // their upper faces turned away from the center.
  function mound(x, y, z, radius, height, palette, count, size = 0.11) {
    const center = new T.Vector3(x, y + height * 0.25, z);
    // A shadowed core closes the gaps, so the mound reads as one full plant.
    add(
      "floret",
      place(
        x,
        y + height * 0.3,
        z,
        0,
        rand() * 3,
        0,
        radius * 0.78,
        height * 0.62,
        radius * 0.78,
      ),
      tint.set(palette[0]).multiplyScalar(0.7),
      center,
      0.8,
    );
    size = Math.max(size, 0.075);
    for (let i = 0; i < count; i++) {
      const az = rand() * Math.PI * 2,
        lift = Math.pow(rand(), 0.7),
        r = radius * Math.sqrt(1 - lift * lift * 0.7) * range(0.55, 1);
      const px = x + Math.cos(az) * r,
        py = y + height * lift,
        pz = z + Math.sin(az) * r;
      dummy.position.set(px, py, pz);
      dummy.rotation.set(0, Math.PI / 2 - az, 0);
      // Pitch outer leaves down toward the rim, crown leaves up toward the sun.
      dummy.rotateX(-0.9 * lift + range(0.05, 0.55));
      dummy.rotateZ(range(-0.5, 0.5));
      const s = size * range(0.75, 1.2);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      const tone = Math.min(3, Math.floor(lift * 3 + rand() * 1.2));
      add("leaf", dummy.matrix, vary(palette[tone]), center, 0.6, [
        y - height * 0.1,
        height * 1.1,
      ]);
    }
    return center;
  }
  // Ball-headed umbels on short stalks, as geraniums carry them.
  function umbel(x, y, z, size, bloom) {
    const head = new T.Vector3(x, y, z);
    for (let i = 0; i < 9; i++) {
      const az = i * 2.4 + rand(),
        el = i ? range(0.25, 1.2) : Math.PI / 2;
      const fx = x + Math.cos(az) * Math.cos(el) * size,
        fy = y + Math.sin(el) * size * 0.75,
        fz = z + Math.sin(az) * Math.cos(el) * size;
      add(
        "bud",
        place(fx, fy, fz, rand() * 3, rand() * 3, 0, size * 0.48),
        vary(i % 4 ? bloom[0] : bloom[1], 0.07),
        head,
        0.5,
      );
    }
  }
  // An open daisy: a ring of flattened petals around a domed eye.
  function daisy(x, y, z, size, bloom, tilt = 0.25) {
    const yaw = rand() * Math.PI * 2;
    const face = new T.Object3D();
    face.position.set(x, y, z);
    face.rotation.set(range(-tilt, tilt), yaw, range(-tilt, tilt));
    face.updateMatrix();
    const local = new T.Matrix4();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      local.compose(
        new T.Vector3(Math.cos(a) * size * 0.62, 0, Math.sin(a) * size * 0.62),
        new T.Quaternion().setFromEuler(new T.Euler(0, -a, 0)),
        new T.Vector3(size * 0.55, size * 0.08, size * 0.2),
      );
      add("bud", local.premultiply(face.matrix), vary(bloom[0], 0.05));
    }
    local.compose(
      new T.Vector3(0, size * 0.06, 0),
      new T.Quaternion(),
      new T.Vector3(size * 0.28, size * 0.16, size * 0.28),
    );
    add("bud", local.premultiply(face.matrix), vary(bloom[1], 0.05));
  }
  // A tapering spike of buds: lavender, foxglove, salvia.
  function spike(x, y, z, height, bloom, width = 0.025, lean = 0.12) {
    const lx = range(-lean, lean),
      lz = range(-lean, lean);
    const base = new T.Vector3(x, y, z),
      tip = new T.Vector3(x + lx * height, y + height, z + lz * height);
    stem(base, tip, width * 0.22, "#6b7f57");
    const buds = Math.round(6 + height * (width > 0.03 ? 18 : 12)),
      axis = new T.Vector3();
    for (let i = 0; i < buds; i++) {
      const f = 0.45 + (i / buds) * 0.55,
        a = i * 2.4,
        r = width * (1.15 - f * 0.6);
      // Normals fan out from the stalk, so the spike shades as one rounded
      // column rather than as separate facets.
      axis.set(x + lx * height * f, y + height * f, z + lz * height * f);
      add(
        "bud",
        place(
          x + lx * height * f + Math.cos(a) * r,
          y + height * f,
          z + lz * height * f + Math.sin(a) * r,
          0,
          a,
          0,
          width * (1.25 - f * 0.55),
          width * 1.5,
        ),
        vary(f > 0.92 || i % 5 === 0 ? bloom[1] : bloom[0], 0.08),
        axis,
        0.7,
      );
    }
  }
  function strapTuft(x, y, z, radius, height, palette, count) {
    const center = new T.Vector3(x, y, z);
    for (let i = 0; i < count; i++) {
      const az = (i / count) * Math.PI * 2 + range(-0.3, 0.3);
      dummy.position.set(
        x + Math.cos(az) * radius * 0.15,
        y,
        z + Math.sin(az) * radius * 0.15,
      );
      dummy.rotation.set(0, Math.PI / 2 - az, 0);
      dummy.rotateX(-range(0.5, 1.15));
      dummy.scale.set(radius * 0.5, height, radius * range(0.9, 1.2));
      dummy.updateMatrix();
      add("strap", dummy.matrix, vary(pick(palette)), center, 0.35, [
        y,
        height,
      ]);
    }
  }
  // An ivy strand spilling over an edge and hanging down the front: a thin
  // vine with alternate leaves that shrink toward its tip.
  function trail(x, y, z, length, palette, dirX = 0, dirZ = 1) {
    const point = new T.Vector3(x, y, z),
      next = new T.Vector3();
    const steps = Math.round(length / 0.045);
    for (let i = 0; i < steps; i++) {
      const f = i / steps,
        reach = f < 0.25 ? 0.04 : 0.006;
      next.set(
        point.x + dirX * reach + range(-0.012, 0.012),
        point.y - (f < 0.2 ? 0.008 : 0.042),
        point.z + dirZ * reach,
      );
      stem(point, next, 0.004, "#56603f");
      point.copy(next);
      const side = i % 2 ? 1 : -1;
      dummy.position.copy(point);
      dummy.rotation.set(0, Math.atan2(dirX, dirZ) + side * 1.1, 0);
      dummy.rotateX(range(0.2, 0.7));
      const s = range(0.075, 0.1) * (1 - f * 0.4);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      add("leaf", dummy.matrix, vary(palette[Math.min(3, 1 + (i % 3))]));
    }
  }

  const recipes = {
    // Upright geranium mound with round umbels standing clear of the leaves.
    geranium(x, y, z, r, bloom) {
      mound(
        x,
        y,
        z,
        r,
        r * 0.75,
        foliage.geranium,
        Math.round(r * 300),
        r * 0.48,
      );
      const heads = Math.max(3, Math.round(r * 13));
      for (let i = 0; i < heads; i++) {
        const a = i * 2.4 + rand(),
          d = r * range(0.15, 0.7),
          hx = x + Math.cos(a) * d,
          hz = z + Math.sin(a) * d,
          hy = y + r * range(0.85, 1.15);
        stem(
          new T.Vector3(hx * 0.7 + x * 0.3, y + r * 0.4, hz * 0.7 + z * 0.3),
          new T.Vector3(hx, hy, hz),
          0.006,
          "#58733f",
        );
        umbel(hx, hy, hz, Math.max(r * 0.2, 0.045), bloom);
      }
    },
    lavender(x, y, z, r, bloom) {
      strapTuft(x, y, z, r, r * 0.65, foliage.lavender, 16);
      const spikes = Math.round(r * 30);
      for (let i = 0; i < spikes; i++) {
        const a = rand() * Math.PI * 2,
          d = r * Math.sqrt(rand()) * 0.35;
        spike(
          x + Math.cos(a) * d,
          y + r * 0.2,
          z + Math.sin(a) * d,
          r * range(1.1, 1.5),
          bloom,
          0.018,
          0.35,
        );
      }
    },
    daisies(x, y, z, r, bloom) {
      mound(x, y, z, r, r * 0.6, foliage.fern, Math.round(r * 270), r * 0.38);
      const heads = Math.max(4, Math.round(r * 22));
      for (let i = 0; i < heads; i++) {
        const a = i * 2.4 + rand(),
          d = r * Math.sqrt(rand()) * 0.85;
        const hx = x + Math.cos(a) * d,
          hz = z + Math.sin(a) * d,
          hy = y + r * range(0.6, 0.95);
        stem(
          new T.Vector3(hx, y + r * 0.3, hz),
          new T.Vector3(hx, hy, hz),
          0.005,
          "#5f7a45",
        );
        daisy(hx, hy, hz, Math.max(r * 0.16, 0.035), bloom);
      }
    },
    // Clipped box ball: a dense, tight shell of small dark leaves.
    topiary(x, y, z, r) {
      const center = new T.Vector3(x, y + r, z);
      stem(new T.Vector3(x, y, z), center, 0.02, "#6b5641");
      // A dark core fills the gaps between the outer leaves.
      add(
        "floret",
        place(x, center.y, z, 0, 0, 0, r * 0.88),
        tint.set(foliage.box[0]),
        center,
        1,
      );
      for (let i = 0; i < Math.round(r * 600); i++) {
        const yy = range(-1, 1),
          az = rand() * Math.PI * 2,
          ring = Math.sqrt(1 - yy * yy);
        const px = x + Math.cos(az) * ring * r,
          py = center.y + yy * r,
          pz = z + Math.sin(az) * ring * r;
        out.set(px, py, pz).sub(center).normalize();
        dummy.position.set(px, py, pz);
        dummy.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), out);
        dummy.rotateZ(rand() * 6.28);
        dummy.rotateX(-range(0.9, 1.4));
        const s = range(0.07, 0.1);
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        const tone = Math.min(3, Math.floor((yy + 1) * 1.6 + rand() * 0.8));
        add("leaf", dummy.matrix, vary(foliage.box[tone]), center, 0.75, [
          y + r * 0.1,
          r * 2,
        ]);
      }
    },
    // Tall foxglove or hollyhock spires above a rosette, set against a wall.
    spires(x, y, z, r, bloom, height = 1.3) {
      strapTuft(x, y, z, r * 1.2, r * 0.5, foliage.geranium, 12);
      const count = 3 + Math.floor(rand() * 2);
      for (let i = 0; i < count; i++) {
        const a = i * 2.2 + rand(),
          d = r * 0.3;
        spike(
          x + Math.cos(a) * d,
          y + 0.05,
          z + Math.sin(a) * d,
          height * range(0.75, 1.05),
          bloom,
          0.036,
          0.08,
        );
      }
    },
  };

  // A tapered terracotta pot with a rolled rim and a shadowed soil surface.
  function pot(x, y, z, s, glaze) {
    const profile = [
      [0, 0],
      [0.3, 0],
      [0.34, 0.06],
      [0.42, 0.62],
      [0.47, 0.64],
      [0.49, 0.72],
      [0.47, 0.8],
      [0.42, 0.8],
      [0.41, 0.74],
    ].map(([r, h]) => new T.Vector2(r * s, h * s));
    const lathe = new T.LatheGeometry(profile, 14).toNonIndexed();
    lathe.deleteAttribute("uv");
    lathe.translate(x, y, z);
    const position = lathe.attributes.position,
      colors = new Float32Array(position.count * 3);
    const body = new T.Color(glaze);
    for (let i = 0; i < position.count; i++) {
      const h = (position.getY(i) - y) / s;
      // Weathered base, a lighter sun-bleached rim and a darker inner lip.
      const inner =
        Math.hypot(position.getX(i) - x, position.getZ(i) - z) < 0.415 * s &&
        h > 0.7;
      const k = inner ? 0.55 : h > 0.63 ? 1.1 : 0.8 + h * 0.3;
      colors[i * 3] = body.r * k;
      colors[i * 3 + 1] = body.g * k;
      colors[i * 3 + 2] = body.b * k;
    }
    lathe.setAttribute("color", new T.BufferAttribute(colors, 3));
    parts.push(lathe);
    // Soil disc, slightly below the rim.
    add(
      "pebble",
      place(x, y + 0.72 * s, z, 0, 0, 0, 0.41 * s, 0.03 * s, 0.41 * s),
      tint.set("#4a3a2b"),
    );
    return y + 0.74 * s;
  }
  // A shallow soil strip with a few rounded edging stones along its front.
  function bed(x, z, length, depth) {
    add(
      "pebble",
      place(x, 0.1, z, 0, 0, 0, length / 2, 0.06, depth / 2),
      tint.set("#5c4733"),
    );
    const stones = Math.round(length / 0.12);
    for (let i = 0; i <= stones; i++) {
      const sx = x - length / 2 + (i / stones) * length;
      add(
        "bud",
        place(
          sx,
          0.12,
          z + depth / 2 + range(-0.02, 0.02),
          0,
          rand() * 3,
          0,
          range(0.055, 0.075),
          range(0.035, 0.05),
          range(0.05, 0.065),
        ),
        vary("#a39d8c", 0.12),
      );
    }
  }

  return {
    material,
    blooms,
    foliage,
    recipes,
    pot,
    bed,
    trail,
    range,
    rand,
    // Collects everything added since the last flush into one mesh.
    flush(parent) {
      if (!parts.length) return null;
      const geometry = mergeGeometries(parts, false);
      parts.forEach((part) => part.dispose());
      parts = [];
      const mesh = new T.Mesh(geometry, material);
      mesh.castShadow = mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    },
  };
}
