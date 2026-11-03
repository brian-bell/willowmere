import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// The parts every walkable interior is built from: one seeded random stream,
// cached materials and rounded boxes, canvas surface textures, and the
// primitives (boxes, orbs, cylinders, tori, tubes, beams, leaves, arches and
// painted plaques). Everything is parented to `root`, which `bake()` merges
// by material once the room is dressed. A room draws from the random stream
// in the order it builds, so a new random() call moves what comes after it.
export function createRoomKit(root, seed) {
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const range = (a, b) => a + random() * (b - a);
  const materials = new Map(),
    geometries = new Map();
  const mat = (color, roughness = 0.65, metalness = 0) => {
    const key = `${color}/${roughness}/${metalness}`;
    if (!materials.has(key))
      materials.set(
        key,
        new T.MeshStandardMaterial({ color, roughness, metalness }),
      );
    return materials.get(key);
  };
  // A 512 px repeating texture: wood grain ("wood") or a fine mottle.
  function surface(kind, base) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const c = canvas.getContext("2d");
    c.fillStyle = base;
    c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 12000; i++) {
      c.fillStyle =
        random() > 0.5
          ? `rgba(255,236,197,${range(0.015, 0.08)})`
          : `rgba(37,23,13,${range(0.02, 0.09)})`;
      const x = random() * 512,
        y = random() * 512;
      c.fillRect(
        x,
        y,
        kind === "wood" ? range(4, 110) : range(0.5, 3),
        range(0.4, 1.5),
      );
    }
    if (kind === "wood") {
      for (let i = 0; i < 100; i++) {
        c.strokeStyle = `rgba(42,24,12,${range(0.03, 0.12)})`;
        c.beginPath();
        const y = range(0, 512);
        c.moveTo(0, y);
        c.bezierCurveTo(
          160,
          y + range(-7, 7),
          350,
          y + range(-12, 12),
          512,
          y + range(-8, 8),
        );
        c.stroke();
      }
    }
    const map = new T.CanvasTexture(canvas);
    map.colorSpace = T.SRGBColorSpace;
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.anisotropy = 8;
    return map;
  }
  function mesh(geo, material, x = 0, y = 0, z = 0, parent = root) {
    const m = new T.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function box(m, x, y, z, w, h, d, r = 0.025, p = root) {
    const key = [w, h, d, r].join();
    if (!geometries.has(key))
      geometries.set(
        key,
        r
          ? new RoundedBoxGeometry(w, h, d, r <= 0.015 ? 1 : 2, r)
          : new T.BoxGeometry(w, h, d),
      );
    return mesh(geometries.get(key), m, x, y, z, p);
  }
  const sphere = new T.SphereGeometry(1, 20, 14);
  function orb(m, x, y, z, a, b = a, c = a, p = root) {
    const o = mesh(sphere, m, x, y, z, p);
    o.scale.set(a, b, c);
    return o;
  }
  function cyl(m, x, y, z, r, h, rt = r, p = root, segments = 32) {
    return mesh(new T.CylinderGeometry(rt, r, h, segments), m, x, y, z, p);
  }
  function torus(m, x, y, z, r, t = 0.025, p = root, arc = Math.PI * 2) {
    return mesh(new T.TorusGeometry(r, t, 8, 48, arc), m, x, y, z, p);
  }
  function tube(m, points, radius = 0.025, p = root) {
    const curve = new T.CatmullRomCurve3(
      points.map((v) => new T.Vector3(...v)),
    );
    return mesh(
      new T.TubeGeometry(
        curve,
        Math.max(12, points.length * 5),
        radius,
        7,
        false,
      ),
      m,
      0,
      0,
      0,
      p,
    );
  }
  function beam(m, a, b, width = 0.08, p = root) {
    const start = new T.Vector3(...a),
      end = new T.Vector3(...b);
    const o = box(
      m,
      ...start.clone().add(end).multiplyScalar(0.5),
      width,
      start.distanceTo(end),
      width,
      0.012,
      p,
    );
    o.quaternion.setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      end.sub(start).normalize(),
    );
    return o;
  }
  function group(x, y, z, rotation = 0, parent = root) {
    const p = new T.Group();
    p.position.set(x, y, z);
    p.rotation.y = rotation;
    parent.add(p);
    return p;
  }
  // A curled, pointed leaf blade of `length` along local +Y.
  function leaf(material, x, y, z, width, length, p = root) {
    const vertices = [],
      uv = [],
      indices = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8,
        w = Math.pow(Math.sin(t * Math.PI), 0.8) * width;
      for (let side = -1; side <= 1; side++) {
        vertices.push(
          side * w,
          t * length,
          Math.sin(t * Math.PI) * length * 0.16 - Math.abs(side) * w * 0.26,
        );
        uv.push((side + 1) / 2, t);
      }
      if (i < 8)
        for (let j = 0; j < 2; j++) {
          const k = i * 3 + j;
          indices.push(k, k + 1, k + 3, k + 1, k + 4, k + 3);
        }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
    geo.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return mesh(geo, material, x, y, z, p);
  }
  function archShape(w, h) {
    const s = new T.Shape(),
      r = w / 2;
    s.moveTo(-r, 0);
    s.lineTo(r, 0);
    s.lineTo(r, h - r);
    s.absarc(0, h - r, r, 0, Math.PI, false);
    s.lineTo(-r, 0);
    return s;
  }
  function arch(m, x, y, z, w, h, depth = 0.12, p = root) {
    return mesh(
      new T.ExtrudeGeometry(archShape(w, h), {
        depth,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.025,
        bevelThickness: 0.02,
        curveSegments: 32,
      }),
      m,
      x,
      y,
      z,
      p,
    );
  }
  // A framed, lettered sign: `lines` are [text, size, y, font?].
  function plaque(lines, w, h, bg = "#254b41", fg = "#ebd8ab") {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = Math.round((1024 * h) / w);
    const c = canvas.getContext("2d");
    c.fillStyle = bg;
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.strokeStyle = fg;
    c.lineWidth = 2;
    c.strokeRect(15, 15, 994, canvas.height - 30);
    c.strokeStyle = fg + "66";
    c.strokeRect(23, 23, 978, canvas.height - 46);
    c.fillStyle = fg;
    c.textAlign = "center";
    c.textBaseline = "middle";
    lines.forEach(([text, size, y, font = "Georgia"]) => {
      c.font = `${size}px ${font}`;
      c.fillText(text, 512, canvas.height * y, 930);
    });
    const map = new T.CanvasTexture(canvas);
    map.colorSpace = T.SRGBColorSpace;
    map.anisotropy = 8;
    return new T.MeshStandardMaterial({ map, roughness: 0.8 });
  }
  // Merges root's static meshes into one mesh per material and shadow role.
  // Transparent meshes and everything under a `keep` object stay separate.
  function bake(keep = new Set()) {
    root.updateMatrixWorld(true);
    const batches = new Map();
    root.traverse((o) => {
      if (!o.isMesh || o.material.transparent) return;
      for (let p = o; p && p !== root; p = p.parent) if (keep.has(p)) return;
      const key = `${o.material.uuid}/${o.castShadow}/${o.receiveShadow}`;
      if (!batches.has(key))
        batches.set(key, { material: o.material, items: [] });
      batches.get(key).items.push(o);
    });
    for (const { material, items } of batches.values()) {
      if (items.length < 2) continue;
      const parts = items.map((o) => {
        let g = o.geometry.index
          ? o.geometry.toNonIndexed()
          : o.geometry.clone();
        g.applyMatrix4(o.matrixWorld);
        return g;
      });
      const merged = mergeGeometries(parts);
      parts.forEach((g) => g.dispose());
      if (merged) {
        const m = new T.Mesh(merged, material);
        m.castShadow = items[0].castShadow;
        m.receiveShadow = items[0].receiveShadow;
        root.add(m);
        items.forEach((o) => o.removeFromParent());
      }
    }
  }
  return {
    random,
    range,
    mat,
    surface,
    mesh,
    box,
    orb,
    cyl,
    torus,
    tube,
    beam,
    group,
    leaf,
    archShape,
    arch,
    plaque,
    bake,
  };
}
