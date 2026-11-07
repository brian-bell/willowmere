// The regions' parts kit. A region's structures are posed unit shapes, each
// painted one colour, merged into one vertex-coloured mesh per structure, so
// a whole building costs one draw per pass. Parts can go to other layers
// instead: a layer of unpainted parts for the village's glass, which glows at
// blue hour, or a second painted mesh that moves on its own (the windmill's
// sails). Every region builds with the same kit, so a beam, a post or a box
// means the same thing in each.
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { chunkKey } from "../world-layout.js";

/**
 * A fresh kit: `segments` round each cylinder, `sphereDetail` subdivides
 * each ball. Every call adds one part to the current layer and returns its
 * geometry.
 */
export function createKit(T, { segments = 12, sphereDetail = 1 } = {}) {
  const color = new T.Color(),
    matrix = new T.Matrix4(),
    rotation = new T.Euler(),
    quaternion = new T.Quaternion(),
    position = new T.Vector3(),
    scale = new T.Vector3(),
    up = new T.Vector3(0, 1, 0),
    from = new T.Vector3(),
    to = new T.Vector3();
  const unit = {
    box: new T.BoxGeometry(1, 1, 1),
    cylinder: new T.CylinderGeometry(1, 1, 1, segments),
    sphere: new T.IcosahedronGeometry(1, sphereDetail),
    cone: new T.ConeGeometry(1, 1, 4),
  };
  const layer = (painted) => ({ parts: [], painted }),
    main = layer(true),
    glass = layer(false),
    layers = [main, glass];
  let into = main;
  function paint(geometry, hex) {
    color.set(hex);
    const count = geometry.attributes.position.count,
      colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) color.toArray(colors, i * 3);
    geometry.setAttribute("color", new T.BufferAttribute(colors, 3));
  }
  // Paints a part for a painted layer (a part that carries its own colours
  // passes no hex), and strips colour from a part for an unpainted one.
  function push(geometry, hex) {
    if (!into.painted) geometry.deleteAttribute("color");
    else if (hex != null) paint(geometry, hex);
    into.parts.push(geometry);
    return geometry;
  }
  // Builds parts, then moves every part `build` added, in every layer, by `frame`.
  function transformed(frame, build) {
    const before = into,
      marks = layers.map((l) => l.parts.length);
    build();
    layers.forEach((l, i) => {
      for (let j = marks[i]; j < l.parts.length; j++) l.parts[j].applyMatrix4(frame);
    });
    into = before;
  }
  function merge(list) {
    const flat = list.map((part) => {
      for (const name of Object.keys(part.attributes))
        if (!["position", "normal", "color"].includes(name)) part.deleteAttribute(name);
      return part.index ? part.toNonIndexed() : part;
    });
    const geometry = mergeGeometries(flat, false);
    for (const part of list) part.dispose();
    geometry.computeBoundingSphere();
    return geometry;
  }
  const k = {
    unit,
    /** `base` cloned, scaled, turned (y, then x, then z) and placed at (x, y, z). */
    add(base, hex, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
      const geometry = base.clone();
      matrix.compose(
        position.set(x, y, z),
        quaternion.setFromEuler(rotation.set(rx, ry, rz, "YXZ")),
        scale.set(sx, sy, sz),
      );
      geometry.applyMatrix4(matrix);
      return push(geometry, hex);
    },
    /** A geometry already in place; without `hex` it keeps its own colours. */
    piece: (geometry, hex) => push(geometry, hex),
    paint,
    box: (hex, x, y, z, w, h, d, ry = 0, rx = 0, rz = 0) =>
      k.add(unit.box, hex, x, y, z, w, h, d, rx, ry, rz),
    cyl: (hex, x, y, z, r, h, rx = 0, rz = 0) =>
      k.add(unit.cylinder, hex, x, y, z, r, h, r, rx, 0, rz),
    /** An upright round post at (x, z) from `bottom` to `top`. */
    post: (hex, x, z, bottom, top, r = 0.07) =>
      k.add(unit.cylinder, hex, x, (bottom + top) / 2, z, r, top - bottom, r),
    ball: (hex, x, y, z, sx, sy = sx, sz = sx) => k.add(unit.sphere, hex, x, y, z, sx, sy, sz),
    pyramid: (hex, x, y, z, r, h, ry = Math.PI / 4) =>
      k.add(unit.cone, hex, x, y, z, r, h, r, 0, ry),
    /** A square timber from a to b ([x, y, z] each), `width` across. */
    beam(hex, a, b, width = 0.08) {
      from.set(...a);
      to.set(...b);
      const length = from.distanceTo(to),
        geometry = unit.box.clone();
      quaternion.setFromUnitVectors(up, to.clone().sub(from).normalize());
      matrix.compose(
        position.copy(from).add(to).multiplyScalar(0.5),
        quaternion,
        scale.set(width, length, width),
      );
      geometry.applyMatrix4(matrix);
      return push(geometry, hex);
    },
    /** A round bar from a to b ([x, y, z] each), radius `r`. */
    rod(hex, a, b, r) {
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        dz = b[2] - a[2],
        length = Math.hypot(dx, dy, dz),
        geometry = unit.cylinder.clone();
      geometry.applyMatrix4(matrix.makeScale(r, length, r));
      quaternion.setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        new T.Vector3(dx / length, dy / length, dz / length),
      );
      geometry.applyMatrix4(matrix.makeRotationFromQuaternion(quaternion));
      geometry.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
      return push(geometry, hex);
    },
    /** A flat-sided solid from an outline in a vertical plane, `depth` thick along x. */
    gable(hex, x, y, z, outline, depth) {
      const shape = new T.Shape(outline.map(([u, v]) => new T.Vector2(u, v))),
        geometry = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
      geometry.rotateY(Math.PI / 2);
      geometry.translate(x, y, z);
      return push(geometry, hex);
    },
    /** A new layer: painted parts for a second mesh, or unpainted ones (glass). */
    layer({ painted = true } = {}) {
      const l = layer(painted);
      layers.push(l);
      return l;
    },
    /** Parts added inside `build` go to `target` (a layer from `layer`). */
    into(target, build) {
      const before = into;
      into = target;
      build();
      into = before;
    },
    /** Parts added inside `build` go to the glass layer. */
    glazed: (build) => k.into(glass, build),
    /** The glass layer merged, or null when nothing was glazed. */
    glass: () => k.geometry(glass),
    transformed,
    /** Builds parts in a local frame, then moves them to (x, y, z) turned by ry. */
    placed(x, y, z, ry, build) {
      transformed(
        new T.Matrix4().compose(
          new T.Vector3(x, y, z),
          new T.Quaternion().setFromEuler(new T.Euler(0, ry, 0)),
          new T.Vector3(1, 1, 1),
        ),
        build,
      );
    },
    /** The layer's parts merged into one geometry, or null when it has none. */
    geometry: (target = main) => (target.parts.length ? merge(target.parts) : null),
    /** The layer's parts as one mesh that casts and takes shadows and never moves. */
    mesh(name, material, target = main) {
      const mesh = new T.Mesh(merge(target.parts), material);
      mesh.name = name;
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      return mesh;
    },
    /** Frees the unit shapes once every mesh is made. */
    dispose() {
      for (const geometry of Object.values(unit)) geometry.dispose();
    },
  };
  return k;
}

const TAU = Math.PI * 2;

// A tapered tube along a curve, with the village trees' bark colouring. Each
// call pushes one non-indexed geometry to `out`.
export function limb(T, curve, radius, tip, segments, radial, out) {
  const frames = curve.computeFrenetFrames(segments, false),
    vertices = [],
    normals = [],
    uvs = [],
    colors = [],
    indices = [],
    length = curve.getLength(),
    wood = new T.Color("#b49c7c"),
    color = new T.Color(),
    normal = new T.Vector3(),
    point = new T.Vector3();
  for (let j = 0; j <= segments; j++) {
    const t = j / segments,
      center = curve.getPointAt(t),
      r = radius + (tip - radius) * Math.pow(t, 0.8);
    for (let k = 0; k <= radial; k++) {
      const a = (k / radial) * TAU;
      normal
        .copy(frames.normals[j])
        .multiplyScalar(Math.cos(a))
        .addScaledVector(frames.binormals[j], Math.sin(a));
      point.copy(center).addScaledVector(normal, r);
      vertices.push(point.x, point.y, point.z);
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(k / radial, t * length * 0.85);
      color.copy(wood).multiplyScalar(0.8 + 0.1 * Math.sin(a * 3 + t * 4));
      colors.push(color.r, color.g, color.b);
      if (j < segments && k < radial) {
        const p = j * (radial + 1) + k,
          q = p + radial + 1;
        indices.push(p, p + 1, q, p + 1, q + 1, q);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  out.push(geometry.toNonIndexed());
  geometry.dispose();
}

/**
 * Splits an instanced mesh scattered over a region into one instanced mesh
 * per chunk, sharing its geometry and material, so each part culls on its
 * own: one mesh across a whole region has a bounding sphere that reaches
 * into views that never see it. A chunk with fewer than `least` instances
 * joins the part whose instances lie nearest, rather than costing a draw of
 * its own for a handful. Returns the parts (the mesh itself when its
 * instances all fall in one part).
 */
export function splitByChunk(T, mesh, { least = 0 } = {}) {
  const groups = new Map(),
    matrix = new T.Matrix4(),
    color = new T.Color();
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, matrix);
    const key = chunkKey(matrix.elements[12], matrix.elements[14]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(i);
  }
  if (least > 0) {
    const middle = (indices) => {
      let x = 0,
        z = 0;
      for (const i of indices) {
        mesh.getMatrixAt(i, matrix);
        x += matrix.elements[12];
        z += matrix.elements[14];
      }
      return [x / indices.length, z / indices.length];
    };
    for (const [key, indices] of [...groups].sort((a, b) => a[1].length - b[1].length)) {
      if (indices.length >= least || groups.size < 2) continue;
      const [x, z] = middle(indices);
      let nearest = null,
        best = Infinity;
      for (const [other, rest] of groups) {
        if (other === key) continue;
        const [ox, oz] = middle(rest),
          d = Math.hypot(ox - x, oz - z);
        if (d < best) {
          best = d;
          nearest = rest;
        }
      }
      nearest.push(...indices);
      groups.delete(key);
    }
  }
  if (groups.size < 2) return [mesh];
  return [...groups.values()].map((indices) => {
    const part = new T.InstancedMesh(mesh.geometry, mesh.material, indices.length);
    indices.forEach((source, i) => {
      mesh.getMatrixAt(source, matrix);
      part.setMatrixAt(i, matrix);
      if (mesh.instanceColor) {
        mesh.getColorAt(source, color);
        part.setColorAt(i, color);
      }
    });
    part.name = mesh.name;
    part.castShadow = mesh.castShadow;
    part.receiveShadow = mesh.receiveShadow;
    part.matrixAutoUpdate = mesh.matrixAutoUpdate;
    part.userData = mesh.userData;
    part.computeBoundingSphere();
    return part;
  });
}
