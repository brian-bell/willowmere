import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createCat } from "./cats.js";

// An authored, deterministic set: all materials and objects are made locally.
// Static props are merged by material after dressing; moving details stay separate.
export function createBakery() {
  const scene = new T.Scene();
  scene.background = new T.Color("#253b38");
  const root = new T.Group();
  scene.add(root);
  let seed = 7216;
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
  const oakTexture = surface("wood", "#a97443");
  const oak = new T.MeshStandardMaterial({
    map: oakTexture,
    roughness: 0.67,
    bumpMap: oakTexture,
    bumpScale: 0.025,
  });
  const walnut = new T.MeshStandardMaterial({
    map: surface("wood", "#61412e"),
    roughness: 0.61,
  });
  const plasterTexture = surface("plaster", "#dbc7a0");
  const plaster = new T.MeshStandardMaterial({
    map: plasterTexture,
    roughness: 0.92,
    bumpMap: plasterTexture,
    bumpScale: 0.04,
  });
  const teal = mat("#285b52"),
    tealLight = mat("#3f7666"),
    tealDark = mat("#1d403b");
  const brass = mat("#cda464", 0.3, 0.72),
    copper = mat("#b66b40", 0.32, 0.72);
  const cream = mat("#f2e1bb"),
    porcelain = mat("#d9e2d5", 0.24),
    dark = mat("#292f29");
  const breadMats = ["#c38136", "#da9b49", "#ad632e", "#e1af61"].map((c) =>
    mat(c, 0.83),
  );
  for (const [i, material] of breadMats.entries()) {
    const texture = surface(
      "crust",
      ["#c38136", "#d69b51", "#ad632e", "#dbae70"][i],
    );
    material.color.set("#ffffff");
    material.map = texture;
    material.bumpMap = texture;
    material.bumpScale = 0.018;
  }
  const flour = mat("#f4e6c5", 0.94),
    linen = mat("#c8ba94", 0.96);
  const brick = ["#b17451", "#c08b61", "#a9664b", "#d09b70", "#b88261"].map(
    (c) => mat(c, 0.9),
  );
  const leaves = ["#47754b", "#63864f", "#7f984f", "#315d41"].map((c) =>
    mat(c, 0.8),
  );
  leaves.forEach((m) => {
    m.side = T.DoubleSide;
  });
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
  function cyl(m, x, y, z, r, h, rt = r, p = root) {
    return mesh(new T.CylinderGeometry(rt, r, h, 32), m, x, y, z, p);
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
  function group(x, y, z, rotation = 0) {
    const p = new T.Group();
    p.position.set(x, y, z);
    p.rotation.y = rotation;
    root.add(p);
    return p;
  }
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
  function pot(x, y, z, size = 0.4, p = root) {
    cyl(mat("#ac694c"), x, y + size * 0.4, z, size * 0.68, size * 0.8, size, p);
    torus(mat("#ca8b66"), x, y + size * 0.82, z, size, 0.05, p).rotation.x =
      Math.PI / 2;
    cyl(mat("#3f3427"), x, y + size * 0.82, z, size * 0.9, 0.02, size * 0.9, p);
    for (let i = 0; i < 13; i++) {
      const a = i * 2.4,
        r = range(size * 0.4, size * 1.35),
        yy = y + size * range(1.3, 2.4);
      tube(
        leaves[0],
        [
          [x, y + size * 0.7, z],
          [x + Math.cos(a) * r * 0.6, yy, z + Math.sin(a) * r * 0.6],
          [x + Math.cos(a) * r, yy - 0.1, z + Math.sin(a) * r],
        ],
        0.016,
        p,
      );
      const l = leaf(
        leaves[i % 4],
        x + Math.cos(a) * r,
        yy - 0.1,
        z + Math.sin(a) * r,
        size * 0.3,
        size * 1.15,
        p,
      );
      l.quaternion.setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        new T.Vector3(Math.cos(a), 0.24, Math.sin(a)).normalize(),
      );
    }
  }
  function jar(x, y, z, r = 0.18, h = 0.48, color = "#bd8953", p = root) {
    cyl(mat(color, 0.25), x, y + h / 2, z, r, h, r * 0.86, p);
    cyl(brass, x, y + h, z, r * 0.92, 0.07, r * 0.92, p);
    box(
      cream,
      x,
      y + h * 0.52,
      z + r * 0.94,
      r * 1.3,
      h * 0.35,
      0.015,
      0.008,
      p,
    );
    box(teal, x, y + h * 0.52, z + r + 0.006, r * 0.75, 0.018, 0.012, 0, p);
  }
  function loaf(x, y, z, size = 0.5, rotation = 0, p = root) {
    const g = new T.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotation;
    p.add(g);
    orb(
      breadMats[Math.floor(random() * 4)],
      0,
      size * 0.34,
      0,
      size * 0.86,
      size * 0.4,
      size * 0.52,
      g,
    );
    for (let i = -1; i <= 1; i++) {
      const verts = [],
        inds = [];
      for (let j = 0; j <= 8; j++)
        for (const side of [-1, 1]) {
          const zz = -0.32 + j * 0.08,
            xx =
              i * 0.39 + zz * 0.36 + side * 0.025 * Math.sin((j / 8) * Math.PI);
          const yy =
            0.34 +
            0.4 *
              Math.sqrt(Math.max(0, 1 - (xx / 0.86) ** 2 - (zz / 0.52) ** 2));
          verts.push(xx * size, (yy + 0.002) * size, zz * size);
          if (j < 8 && side === -1) {
            const k = j * 2;
            inds.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
          }
        }
      const score = new T.BufferGeometry();
      score.setAttribute("position", new T.Float32BufferAttribute(verts, 3));
      score.setIndex(inds);
      score.computeVertexNormals();
      const scoreMat = mat("#e1b67c", 0.95);
      scoreMat.side = T.DoubleSide;
      mesh(score, scoreMat, 0, 0, 0, g);
    }
    for (let i = 0; i < 12; i++)
      orb(
        flour,
        range(-size * 0.6, size * 0.6),
        size * range(0.68, 0.72),
        range(-size * 0.2, size * 0.2),
        size * 0.013,
        size * 0.008,
        size * 0.018,
        g,
      );
    return g;
  }
  function croissant(x, y, z, s = 0.5, rot = 0, p = root) {
    const g = new T.Group();
    g.position.set(x, y, z);
    g.rotation.y = rot;
    p.add(g);
    const vertices = [],
      uvs = [],
      indices = [],
      segments = 80,
      sides = 16;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments,
        a = -1.64 + t * 3.28,
        full = Math.pow(Math.sin(t * Math.PI), 0.8);
      const radius =
        s * (0.016 + full * 0.26) * (1 + Math.sin(t * Math.PI * 18) * 0.085);
      for (let j = 0; j <= sides; j++) {
        const v = (j / sides) * Math.PI * 2;
        vertices.push(
          Math.sin(a) * (s * 0.65 + Math.cos(v) * radius),
          s * 0.23 + Math.sin(v) * radius * 0.82,
          -Math.cos(a) * (s * 0.65 + Math.cos(v) * radius) + s * 0.25,
        );
        uvs.push(t * 3, j / sides);
        if (i < segments && j < sides) {
          const k = i * (sides + 1) + j;
          indices.push(
            k,
            k + 1,
            k + sides + 1,
            k + 1,
            k + sides + 2,
            k + sides + 1,
          );
        }
      }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
    geo.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    mesh(geo, breadMats[0], 0, 0, 0, g);
    for (let i = 1; i < 9; i++) {
      const t = i / 9,
        a = -1.64 + t * 3.28,
        rr = s * (0.016 + Math.pow(Math.sin(t * Math.PI), 0.8) * 0.26),
        points = [];
      for (let j = 0; j <= 10; j++) {
        const v = (j / 10) * Math.PI;
        points.push([
          Math.sin(a) * (s * 0.65 + Math.cos(v) * rr),
          s * 0.23 + Math.sin(v) * rr * 0.84,
          -Math.cos(a) * (s * 0.65 + Math.cos(v) * rr) + s * 0.25,
        ]);
      }
      tube(breadMats[2], points, s * 0.009, g);
    }
  }
  function plate(x, y, z, r = 0.5, p = root) {
    cyl(porcelain, x, y, z, r, 0.05, r, p);
    torus(porcelain, x, y + 0.03, z, r * 0.91, 0.045, p).rotation.x =
      Math.PI / 2;
    torus(brass, x, y + 0.055, z, r * 0.95, 0.009, p).rotation.x = Math.PI / 2;
  }
  function cup(x, y, z, p = root) {
    cyl(porcelain, x, y + 0.12, z, 0.13, 0.22, 0.16, p);
    cyl(mat("#5b3826"), x, y + 0.231, z, 0.14, 0.008, 0.14, p);
    torus(porcelain, x + 0.17, y + 0.13, z, 0.085, 0.027, p);
    torus(brass, x, y + 0.23, z, 0.15, 0.012, p).rotation.x = Math.PI / 2;
  }
  function cabinet(x, z, w, h = 1.65, d = 1, p = root) {
    box(tealDark, x, h / 2, z, w, h, d, 0.04, p);
    box(walnut, x, 0.12, z, w + 0.12, 0.2, d + 0.12, 0.035, p);
    const count = Math.round(w / 0.9);
    for (let i = 0; i < count; i++) {
      const xx = x - w / 2 + ((i + 0.5) * w) / count,
        ww = w / count - 0.055;
      box(
        teal,
        xx,
        h / 2 + 0.06,
        z + d / 2 + 0.025,
        ww,
        h - 0.28,
        0.09,
        0.03,
        p,
      );
      box(
        tealLight,
        xx,
        h / 2 + 0.06,
        z + d / 2 + 0.08,
        ww - 0.14,
        h - 0.48,
        0.035,
        0.015,
        p,
      );
      box(
        teal,
        xx,
        h / 2 + 0.06,
        z + d / 2 + 0.105,
        ww - 0.21,
        h - 0.57,
        0.02,
        0.012,
        p,
      );
      orb(
        brass,
        xx + ww * 0.3,
        h - 0.32,
        z + d / 2 + 0.17,
        0.045,
        0.045,
        0.035,
        p,
      );
    }
    box(oak, x, h + 0.07, z, w + 0.2, 0.18, d + 0.22, 0.045, p);
  }
  // Floating architectural base, with inlaid edge and individually jointed parquet.
  box(walnut, 0, -0.42, 0, 15.8, 0.75, 12.2, 0.16);
  box(tealDark, 0, -0.17, 0, 15.96, 0.17, 12.34, 0.06);
  box(brass, 0, -0.065, 0, 15.89, 0.035, 12.27, 0.012);
  box(walnut, 0, 0, 0, 15.8, 0.12, 12.2, 0.04);
  const floorMats = Array.from(
    { length: 7 },
    (_, i) =>
      new T.MeshStandardMaterial({
        map: oakTexture,
        color: new T.Color().setHSL(0.09, 0.18, 0.66 + i * 0.045),
        roughness: 0.73,
        bumpMap: oakTexture,
        bumpScale: 0.025,
      }),
  );
  // Basketweave parquet retains real bevels and small dark joints at close range.
  for (let ix = 0; ix < 15; ix++)
    for (let iz = 0; iz < 11; iz++)
      for (let k = 0; k < 3; k++) {
        const x = -7 + ix,
          z = -5 + iz,
          turn = (ix + iz) % 2;
        const b = box(
          floorMats[Math.floor(random() * 7)],
          x + (turn ? 0 : (k - 1) / 3),
          0.09,
          z + (turn ? (k - 1) / 3 : 0),
          turn ? 0.975 : 0.313,
          0.08,
          turn ? 0.313 : 0.975,
          0.012,
        );
        if (turn) b.material = floorMats[(ix + iz + k) % 7];
      }
  for (const x of [-7.62, 7.62]) box(oak, x, 0.11, 0, 0.22, 0.1, 12, 0.015);
  for (const z of [-5.7, 5.7]) box(oak, 0, 0.11, z, 15.3, 0.1, 0.28, 0.015);
  // Two cutaway walls: soft limewash above green paneled wainscoting.
  box(plaster, 0, 3, -5.85, 15.6, 5.9, 0.28, 0.045);
  box(plaster, -7.7, 3, 0, 0.28, 5.9, 11.8, 0.045);
  box(teal, -7.5, 0.85, 0, 0.13, 1.5, 11.6, 0.02);
  box(teal, 0, 0.85, -5.65, 15.2, 1.5, 0.13, 0.02);
  for (let x = -7; x <= 7; x += 0.8) {
    box(tealLight, x, 0.85, -5.55, 0.045, 1.35, 0.05, 0.006);
    box(tealDark, x + 0.37, 0.85, -5.56, 0.66, 1.15, 0.04, 0.008);
  }
  for (let z = -5.2; z <= 5.3; z += 0.8)
    box(tealLight, -7.4, 0.85, z, 0.05, 1.35, 0.045, 0.006);
  for (const y of [0.25, 1.58, 1.7]) {
    box(y === 1.7 ? oak : tealLight, 0, y, -5.5, 15.5, 0.085, 0.17, 0.014);
    box(y === 1.7 ? oak : tealLight, -7.35, y, 0, 0.17, 0.085, 11.6, 0.014);
  }
  for (const x of [-7.45, -2.65, 2.75, 7.45]) {
    box(walnut, x, 3.1, -5.43, 0.22, 5.8, 0.3, 0.045);
    box(oak, x + 0.012, 3.1, -5.25, 0.09, 5.7, 0.025, 0.008);
    beam(walnut, [x, 5.35, -5.4], [x + (x > 0 ? -0.7 : 0.7), 5.92, -5.4], 0.17);
  }
  box(walnut, 0, 5.95, -5.48, 15.7, 0.34, 0.48, 0.065);
  box(oak, 0, 5.78, -5.2, 15.7, 0.07, 0.05, 0.012);
  box(walnut, -7.4, 5.95, 0, 0.42, 0.34, 11.9, 0.065);
  box(walnut, -7.4, 3.0, 5.65, 0.38, 5.9, 0.38, 0.045);
  // The great round oven: terracotta voussoirs, a deep firebox and copper flue.
  const oven = group(-4.8, 0, -3.7);
  box(mat("#6c5b46"), 0, 0.73, 0, 3.45, 1.32, 2.7, 0.1, oven);
  for (let row = 0; row < 4; row++)
    for (let i = 0; i < 7; i++)
      box(
        brick[(i + row) % 5],
        -1.49 + i * 0.49 + (row % 2) * 0.05,
        0.26 + row * 0.27,
        1.38,
        0.46,
        0.24,
        0.2,
        0.025,
        oven,
      );
  box(mat("#cdb38a"), 0, 1.39, 0.2, 3.7, 0.22, 3.05, 0.09, oven);
  orb(plaster, 0, 1.62, -0.1, 1.7, 1.82, 1.4, oven);
  arch(dark, 0, 1.47, 1.13, 2.05, 1.65, 0.08, oven);
  const fireMat = new T.MeshStandardMaterial({
    color: "#26150e",
    emissive: "#9d2e08",
    emissiveIntensity: 0.07,
    roughness: 1,
  });
  arch(fireMat, 0, 1.5, 1.235, 1.65, 1.38, 0.02, oven);
  for (const side of [-1, 1])
    for (let j = 0; j < 3; j++)
      box(
        brick[j % 5],
        side * 1.14,
        1.63 + j * 0.25,
        1.3,
        0.35,
        0.235,
        0.36,
        0.03,
        oven,
      );
  for (let i = 0; i < 13; i++) {
    const a = (i * Math.PI) / 12;
    const b = box(
      brick[i % 5],
      Math.cos(a) * 1.13,
      2.12 + Math.sin(a) * 1.13,
      1.3,
      0.29,
      0.39,
      0.36,
      0.025,
      oven,
    );
    b.rotation.z = a - Math.PI / 2;
  }
  box(dark, 0, 1.5, 1.53, 2.3, 0.09, 0.5, 0.025, oven);
  for (let i = 0; i < 5; i++) {
    const log = cyl(
      mat("#40271b"),
      -0.65 + i * 0.32,
      1.64,
      1.28,
      0.11,
      0.55,
      0.09,
      oven,
    );
    log.rotation.x = Math.PI / 2;
    orb(
      mat("#f3ac40", 0.85),
      -0.65 + i * 0.32,
      1.64,
      1.57,
      0.08,
      0.08,
      0.015,
      oven,
    );
  }
  const flameMaterial = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
    blending: T.AdditiveBlending,
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `
      varying vec2 vUv; uniform float time;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){
        vec2 p=vUv; float n=noise(vec2(p.x*7.,p.y*4.-time*1.8))*.65+noise(vec2(p.x*16.,p.y*7.-time*3.))*.35;
        float envelope=pow(max(0.,1.-abs(p.x-.5)*1.95),.5);
        float heat=envelope*(1.-p.y)-n*.55;
        float alpha=smoothstep(.04,.22,heat)*smoothstep(0.,.1,p.y);
        vec3 color=mix(vec3(1.,.16,.015),vec3(2.4,1.6,.5),smoothstep(.22,.6,heat));
        gl_FragColor=vec4(color,alpha*.92);
      }`,
  });
  const flame = mesh(
    new T.PlaneGeometry(1.8, 1.12),
    flameMaterial,
    0,
    2.04,
    1.47,
    oven,
  );
  flame.castShadow = flame.receiveShadow = false;
  cyl(copper, 0, 4.1, -0.35, 0.49, 1.7, 0.43, oven);
  for (const y of [3.43, 3.64, 4.65, 4.89])
    cyl(brass, 0, y, -0.35, 0.5, 0.075, 0.5, oven);
  cyl(copper, 0, 5.2, -0.35, 0.43, 0.65, 0.43, oven);
  for (let i = 0; i < 8; i++)
    orb(
      brass,
      Math.sin((i * Math.PI) / 4) * 0.5,
      3.64,
      -0.35 + Math.cos((i * Math.PI) / 4) * 0.5,
      0.035,
      0.035,
      0.035,
      oven,
    );
  box(
    plaque(
      [
        ["EMBER & ASH", 60, 0.4],
        ["EST. 1892", 32, 0.72],
      ],
      1.2,
      0.4,
    ),
    0,
    3.22,
    1.07,
    1.1,
    0.35,
    0.04,
    0.01,
    oven,
  );
  const fireLight = new T.PointLight("#ff952f", 19, 7, 2);
  fireLight.position.set(-4.8, 2, -1.7);
  scene.add(fireLight);
  // Firewood under the left side and a long baker's peel leaning against the hearth.
  for (let row = 0; row < 3; row++)
    for (let i = 0; i < 4 - row; i++) {
      const xx = -6.55 + i * 0.34 + row * 0.17,
        yy = 0.3 + row * 0.28;
      const o = cyl(walnut, xx, yy, -1.3, 0.16, 0.76);
      o.rotation.x = Math.PI / 2;
      orb(oak, xx, yy, -0.91, 0.14, 0.14, 0.017);
      torus(walnut, xx, yy, -0.89, 0.08, 0.009);
    }
  const peel = group(-2.85, 0.18, -2.45, -0.14);
  peel.rotation.z = -0.18;
  box(oak, 0, 2, 0, 0.09, 3.4, 0.1, 0.035, peel);
  box(oak, 0, 0.4, 0, 0.7, 0.85, 0.095, 0.16, peel);
  torus(brass, 0, 3.68, 0, 0.08, 0.02, peel);
  // Leaded arched window, colored panes and an illustrated orchard beyond.
  const windowGroup = group(0.0, 2.05, -5.34);
  arch(walnut, 0, -0.12, -0.03, 3.65, 3.7, 0.2, windowGroup);
  arch(brass, 0, -0.025, 0.18, 3.35, 3.44, 0.035, windowGroup);
  const skyCanvas = document.createElement("canvas");
  skyCanvas.width = 512;
  skyCanvas.height = 640;
  const sky = skyCanvas.getContext("2d"),
    sg = sky.createLinearGradient(0, 0, 0, 640);
  sg.addColorStop(0, "#85b6b1");
  sg.addColorStop(0.55, "#e9e5b5");
  sg.addColorStop(1, "#5c8667");
  sky.fillStyle = sg;
  sky.fillRect(0, 0, 512, 640);
  for (let i = 0; i < 70; i++) {
    sky.fillStyle = ["#4d7863", "#759576", "#aec196", "#93ab7e"][i % 4];
    sky.beginPath();
    sky.ellipse(
      range(-70, 580),
      range(360, 730),
      range(20, 90),
      range(15, 65),
      0,
      0,
      Math.PI * 2,
    );
    sky.fill();
  }
  const skyTexture = new T.CanvasTexture(skyCanvas);
  skyTexture.colorSpace = T.SRGBColorSpace;
  const windowMat = new T.MeshStandardMaterial({
    map: skyTexture,
    color: "#e5efc9",
    emissive: "#d2e7c3",
    emissiveMap: skyTexture,
    emissiveIntensity: 0.42,
    roughness: 0.3,
  });
  const pane = arch(windowMat, 0, 0.05, 0.23, 3.12, 3.28, 0.015, windowGroup);
  const uv = pane.geometry.attributes.uv,
    pos = pane.geometry.attributes.position;
  for (let i = 0; i < uv.count; i++)
    uv.setXY(i, (pos.getX(i) + 1.56) / 3.12, pos.getY(i) / 3.28);
  box(walnut, 0, 1.63, 0.31, 0.07, 3.25, 0.08, 0.008, windowGroup);
  box(walnut, 0, 1.74, 0.31, 3.08, 0.075, 0.08, 0.008, windowGroup);
  for (const x of [-1.03, -0.52, 0.52, 1.03])
    box(brass, x, 1.33, 0.32, 0.022, 2.5, 0.026, 0, windowGroup);
  for (const y of [0.55, 1.08, 2.25])
    box(brass, 0, y, 0.32, y > 2 ? 2.78 : 3.05, 0.023, 0.026, 0, windowGroup);
  for (const side of [-1, 1]) {
    tube(
      walnut,
      [
        [0, 1.74, 0.33],
        [side * 0.48, 2.1, 0.33],
        [side * 0.87, 2.55, 0.33],
        [side * 1.08, 2.75, 0.33],
      ],
      0.035,
      windowGroup,
    );
  }
  torus(brass, 0, 2.72, 0.35, 0.27, 0.025, windowGroup);
  orb(mat("#e5bc6d", 0.25), 0, 2.72, 0.35, 0.17, 0.17, 0.025, windowGroup);
  box(oak, 0, 0, -0.02, 3.8, 0.18, 0.9, 0.05, windowGroup);
  pot(-1.3, 2.16, -4.98, 0.23);
  pot(1.27, 2.16, -5.03, 0.22);
  // Continuous preparation dresser, utensils and jars beneath the window.
  cabinet(0, -4.7, 4.6, 1.57, 1.35);
  for (let i = 0; i < 4; i++)
    jar(
      -1.65 + i * 0.42,
      1.76,
      -4.63,
      0.16,
      range(0.34, 0.55),
      ["#c28a41", "#e0ccb2", "#688978", "#795047"][i],
    );
  cyl(porcelain, 0.6, 1.96, -4.55, 0.23, 0.37, 0.45);
  cyl(flour, 0.6, 2.14, -4.55, 0.4, 0.02, 0.4);
  beam(oak, [0.6, 2.04, -4.55], [1.05, 2.7, -4.43], 0.05);
  for (let i = 0; i < 3; i++) plate(1.75, 1.77 + i * 0.065, -4.5, 0.37);
  // Wall bread dresser with turned edging, baskets, jars and a crescent clock.
  cabinet(5.05, -4.75, 4.15, 1.65, 1.2);
  box(tealDark, 5.05, 3.4, -5.43, 4.15, 3.25, 0.25, 0.03);
  for (const x of [2.97, 7.13]) box(teal, x, 3.4, -5.1, 0.16, 3.4, 0.65, 0.03);
  for (const y of [2.05, 3.06, 4.13, 5.05]) {
    box(oak, 5.05, y, -5.03, 4.28, 0.11, 0.93, 0.025);
    box(brass, 5.05, y - 0.08, -4.57, 4.19, 0.045, 0.045, 0.008);
  }
  for (let row = 0; row < 3; row++)
    for (let i = 0; i < 6; i++) {
      if (row === 2)
        jar(
          3.42 + i * 0.65,
          4.2,
          -5,
          0.2,
          range(0.42, 0.68),
          ["#a76c35", "#cda665", "#557d6a"][i % 3],
        );
      else
        loaf(
          3.45 + i * 0.63,
          2.13 + row * 1.01,
          -4.94,
          range(0.28, 0.36),
          range(-0.35, 0.35),
        );
    }
  box(
    plaque(
      [
        ["THE DAILY LOAF", 74, 0.45],
        ["GOOD THINGS TAKE THYME", 25, 0.76],
      ],
      3.7,
      0.62,
    ),
    5.05,
    5.48,
    -5.15,
    3.8,
    0.65,
    0.16,
    0.055,
  );
  // Ceramic tile backsplash in the narrow side kitchen.
  for (let iz = 0; iz < 9; iz++)
    for (let iy = 0; iy < 4; iy++)
      box(
        mat((iz + iy) % 4 === 0 ? "#759c8b" : "#d9d9bc", 0.3),
        -7.47,
        1.92 + iy * 0.31,
        -4.7 + iz * 0.44,
        0.035,
        0.286,
        0.414,
        0.015,
      );
  // Copper pans are hung where sunlight can pick out their rolled rims.
  beam(brass, [-7.13, 4.22, -4.7], [-7.13, 4.22, -1.1], 0.055);
  for (let i = 0; i < 4; i++) {
    const g = group(-7.05, 3.35, -4.2 + i * 0.85, Math.PI / 2),
      r = 0.25 + i * 0.045;
    const pan = cyl(copper, 0, 0, 0, r, 0.1, r, g);
    pan.rotation.x = Math.PI / 2;
    torus(brass, 0, 0, 0.06, r, 0.023, g);
    box(walnut, 0, 0.52, 0, 0.085, 0.55, 0.1, 0.025, g);
    torus(brass, 0, 0.84, 0, 0.06, 0.018, g);
  }
  // A round rose window over the tea nook, with radial brass tracery.
  const rose = group(-7.49, 3.65, 2.05, Math.PI / 2);
  const rg = cyl(windowMat, 0, 0, 0, 1.18, 0.035, 1.18, rose);
  rg.rotation.x = Math.PI / 2;
  torus(walnut, 0, 0, 0.04, 1.27, 0.12, rose);
  torus(brass, 0, 0, 0.16, 1.12, 0.025, rose);
  torus(brass, 0, 0, 0.16, 0.39, 0.035, rose);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    beam(
      brass,
      [Math.sin(a) * 0.4, Math.cos(a) * 0.4, 0.16],
      [Math.sin(a) * 1.12, Math.cos(a) * 1.12, 0.16],
      0.028,
      rose,
    );
  }
  box(oak, -7.13, 2.25, 2.05, 0.9, 0.13, 3.15, 0.04);
  pot(-7.05, 2.34, 3.12, 0.27);
  // Botanical rug: woven field, scalloped border, tiny leaves and tasseled ends.
  const rug = group(-4.25, 0.16, 2.5, -0.1);
  box(mat("#8c5141"), 0, 0, 0, 4.4, 0.028, 3.45, 0.12, rug);
  box(mat("#c39868"), 0, 0.017, 0, 4.13, 0.016, 3.19, 0.08, rug);
  box(mat("#587669"), 0, 0.028, 0, 3.95, 0.016, 3.01, 0.07, rug);
  for (let i = 0; i < 23; i++)
    for (const side of [-1, 1]) {
      beam(
        linen,
        [-2.13, 0.025, -1.55 + i * 0.14],
        [-2.31, 0.02, -1.55 + i * 0.14],
        0.018,
        rug,
      );
      beam(
        linen,
        [2.13, 0.025, -1.55 + i * 0.14],
        [2.31, 0.02, -1.55 + i * 0.14],
        0.018,
        rug,
      );
      const l = orb(
        mat("#d4ba82"),
        -1.85 + i * 0.17,
        0.05,
        side * 1.34,
        0.04,
        0.006,
        0.085,
        rug,
      );
      l.rotation.y = side * 0.6;
    }
  for (let i = 0; i < 5; i++)
    for (let j = 0; j < 3; j++) {
      const x = -1.5 + i * 0.75,
        z = -0.8 + j * 0.8;
      const stem = box(mat("#b6b78a"), x, 0.048, z, 0.018, 0.006, 0.35, 0, rug);
      stem.rotation.y = -0.3;
      for (const side of [-1, 1]) {
        const l = orb(
          mat("#b6b78a"),
          x + side * 0.07,
          0.052,
          z + side * 0.06,
          0.09,
          0.006,
          0.04,
          rug,
        );
        l.rotation.y = side * 0.4;
      }
    }
  function chair(x, z, rot = 0) {
    const p = group(x, 0.18, z, rot);
    for (const xx of [-0.28, 0.28])
      for (const zz of [-0.28, 0.28])
        beam(walnut, [xx, 0, zz], [xx * 0.8, 0.9, zz * 0.8], 0.075, p);
    cyl(oak, 0, 0.9, 0, 0.45, 0.13, 0.45, p);
    cyl(mat("#c79861"), 0, 1.0, 0, 0.39, 0.1, 0.39, p);
    for (const side of [-1, 1])
      beam(
        walnut,
        [side * 0.34, 0.85, -0.28],
        [side * 0.37, 1.85, -0.3],
        0.07,
        p,
      );
    const hoop = torus(walnut, 0, 1.65, -0.3, 0.37, 0.055, p, Math.PI);
    hoop.rotation.z = 0;
    for (const xx of [-0.19, 0, 0.19])
      beam(
        oak,
        [xx, 1.05, -0.3],
        [xx, 1.94 - Math.abs(xx) * 0.3, -0.3],
        0.035,
        p,
      );
  }
  chair(-5.85, 2.5, 0.7);
  chair(-3.4, 3.55, -2.5);
  const tea = group(-4.7, 0, 2.5);
  cyl(walnut, 0, 0.86, 0, 0.11, 1.45, 0.14, tea);
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3;
    beam(
      walnut,
      [0, 0.5, 0],
      [Math.cos(a) * 0.65, 0.18, Math.sin(a) * 0.65],
      0.12,
      tea,
    );
  }
  cyl(oak, 0, 1.62, 0, 0.99, 0.15, 0.99, tea);
  torus(brass, 0, 1.69, 0, 0.93, 0.012, tea).rotation.x = Math.PI / 2;
  plate(-0.35, 1.72, 0.24, 0.29, tea);
  croissant(-0.35, 1.77, 0.24, 0.32, 0.4, tea);
  plate(0.43, 1.72, 0.26, 0.23, tea);
  cup(0.43, 1.77, 0.26, tea);
  // A squat teapot with a curved spout and a little gold acorn on its lid.
  orb(porcelain, 0, 1.95, -0.3, 0.27, 0.26, 0.25, tea);
  cyl(porcelain, 0, 2.18, -0.3, 0.2, 0.055, 0.18, tea);
  orb(brass, 0, 2.24, -0.3, 0.045, 0.055, 0.045, tea);
  tube(
    porcelain,
    [
      [0.18, 1.9, -0.3],
      [0.35, 1.93, -0.3],
      [0.43, 2.15, -0.3],
    ],
    0.065,
    tea,
  );
  torus(porcelain, -0.28, 1.99, -0.3, 0.16, 0.045, tea);
  const steam = group(-4.27, 2.08, 2.76);
  const steamMat = new T.MeshBasicMaterial({
    color: "#f8ecd3",
    transparent: true,
    opacity: 0.17,
    depthWrite: false,
  });
  for (let i = 0; i < 3; i++) {
    const points = [];
    for (let j = 0; j < 18; j++) {
      const t = j / 17;
      points.push([
        Math.sin(t * 8 + i * 2) * 0.045,
        t * 0.68,
        Math.cos(t * 8 + i * 2) * 0.045,
      ]);
    }
    const curl = tube(steamMat, points, 0.008, steam);
    curl.castShadow = false;
  }
  // Sleeping cinnamon cat, curled into a velvet window bench.
  const bench = group(-6.6, 0, 0.25);
  box(teal, 0, 0.5, 0, 1.15, 0.75, 2.0, 0.06, bench);
  box(mat("#b78257"), 0, 0.94, 0, 1.2, 0.2, 2.02, 0.1, bench);
  const cinnamon = createCat(
    T,
    {
      fur: "#bf824d",
      stripe: "#925b37",
      cream: "#f2d3a3",
      pink: "#bb827b",
    },
    mat,
    true,
  );
  const cat = cinnamon.root;
  cat.name = "Cinnamon the sleeping cat";
  cat.position.set(-6.5, 1.01, 0.45);
  cat.rotation.y = 0.3;
  root.add(cat);
  // The baker's work island, with pegged legs, lower shelf and draped ticking cloth.
  const work = group(-0.6, 0, 0.1, -0.06);
  for (const x of [-1.6, 1.6])
    for (const z of [-0.65, 0.65]) {
      box(walnut, x, 0.92, z, 0.17, 1.65, 0.17, 0.03, work);
      cyl(oak, x, 0.55, z, 0.13, 0.12, 0.13, work);
    }
  box(oak, 0, 0.45, 0, 3.45, 0.12, 1.45, 0.025, work);
  box(walnut, 0, 1.55, 0, 3.55, 0.25, 1.55, 0.025, work);
  for (let i = 0; i < 5; i++)
    box(oak, 0, 1.77, -0.68 + i * 0.34, 3.9, 0.18, 0.33, 0.025, work);
  for (let i = 0; i < 3; i++) {
    box(walnut, -1.15 + i * 1.15, 1.5, 0.82, 0.95, 0.29, 0.08, 0.025, work);
    torus(
      brass,
      -1.15 + i * 1.15,
      1.5,
      0.88,
      0.065,
      0.015,
      work,
      Math.PI,
    ).rotation.z = Math.PI;
  }
  const clothMat = new T.MeshStandardMaterial({
    map: surface("linen", "#c6bb9b"),
    roughness: 1,
    side: T.DoubleSide,
  });
  const clothGeo = new T.PlaneGeometry(0.86, 1.95, 16, 32),
    cp = clothGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i),
      v = (cp.getY(i) + 0.975) / 1.95;
    cp.setXYZ(
      i,
      x,
      v < 0.71 ? 1.875 : 1.875 - (v - 0.71) * 2.4,
      -0.55 + v * 1.95 + (v > 0.71 ? -(v - 0.71) * 1.6 : 0),
    );
    cp.setY(i, cp.getY(i) + Math.sin(x * 30 + v * 4) * 0.018);
  }
  clothGeo.computeVertexNormals();
  mesh(clothGeo, clothMat, 0.94, 0, 0, work);
  for (const x of [0.6, 0.65, 1.23, 1.28])
    tube(
      mat("#6d8274"),
      [
        [x, 1.895, -0.54],
        [x, 1.895, 0.3],
        [x, 1.87, 0.83],
        [x, 1.2, 0.94],
      ],
      0.009,
      work,
    );
  // Flour constellation, hand-scored dough, rolling pin and an open recipe book.
  for (let i = 0; i < 140; i++) {
    const x = range(-1.45, 0.35),
      z = range(-0.5, 0.6);
    orb(
      flour,
      x,
      1.872,
      z,
      range(0.008, 0.035),
      0.004,
      range(0.008, 0.03),
      work,
    );
  }
  loaf(-0.75, 1.9, 0.14, 0.57, -0.4, work);
  loaf(0.05, 1.89, -0.3, 0.4, 0.3, work);
  const pin = cyl(oak, -0.65, 1.98, -0.46, 0.1, 1.05, 0.1, work);
  pin.rotation.z = Math.PI / 2;
  beam(walnut, [-1.35, 1.98, -0.46], [0.05, 1.98, -0.46], 0.07, work);
  cyl(porcelain, 1.35, 2.02, -0.35, 0.17, 0.3, 0.33, work);
  cyl(flour, 1.35, 2.16, -0.35, 0.3, 0.012, 0.3, work);
  const recipe = group(0, 1.91, 0.52, -0.18);
  work.add(recipe);
  recipe.position.set(-1.27, 1.91, 0.53);
  box(mat("#854d38"), 0, 0, 0, 0.74, 0.045, 0.53, 0.02, recipe);
  for (const side of [-1, 1]) {
    const page = box(
      cream,
      side * 0.18,
      0.045,
      0,
      0.35,
      0.055,
      0.49,
      0.008,
      recipe,
    );
    page.rotation.z = side * 0.08;
    for (let i = 0; i < 6; i++)
      box(
        mat("#9b8d6c"),
        side * 0.18,
        0.081,
        -0.16 + i * 0.057,
        range(0.15, 0.25),
        0.003,
        0.008,
        0,
        recipe,
      );
  }
  // Wicker proving baskets, stored bowls and sacks under the island.
  for (const x of [-1.05, 0.12, 1.15]) {
    cyl(linen, x, 0.68, 0, 0.38, 0.37, 0.48, work);
    for (let j = 0; j < 5; j++)
      torus(
        oak,
        x,
        0.51 + j * 0.075,
        0,
        0.38 + j * 0.02,
        0.022,
        work,
      ).rotation.x = Math.PI / 2;
  }
  // Shop counter: raised panels, marble top and a finely framed pastry vitrine.
  cabinet(4.55, 1.7, 4.6, 1.65, 1.75);
  const marble = new T.MeshStandardMaterial({
    map: surface("stone", "#e0d6b8"),
    roughness: 0.28,
  });
  box(marble, 4.55, 1.82, 1.7, 4.85, 0.15, 1.95, 0.07);
  box(tealDark, 4.55, 2.0, 1.68, 4.25, 0.16, 1.55, 0.04);
  const glass = new T.MeshPhysicalMaterial({
    color: "#ecfff5",
    transparent: true,
    opacity: 0.065,
    roughness: 0.08,
    metalness: 0,
    envMapIntensity: 0.15,
    depthWrite: false,
    side: T.FrontSide,
  });
  box(glass, 4.55, 2.66, 2.43, 4.2, 1.2, 0.025, 0);
  box(glass, 4.55, 3.27, 1.7, 4.2, 0.025, 1.5, 0);
  for (const x of [2.45, 6.65]) {
    box(glass, x, 2.66, 1.7, 0.025, 1.2, 1.5, 0);
    for (const z of [0.96, 2.43]) beam(brass, [x, 2.02, z], [x, 3.3, z], 0.045);
    beam(brass, [x, 3.3, 0.96], [x, 3.3, 2.43], 0.045);
  }
  for (const y of [2.08, 3.3])
    for (const z of [0.96, 2.43])
      beam(brass, [2.44, y, z], [6.66, y, z], 0.045);
  box(glass, 4.55, 2.62, 1.7, 4.15, 0.028, 1.45, 0);
  beam(brass, [2.45, 2.63, 2.43], [6.65, 2.63, 2.43], 0.025);
  for (let i = 0; i < 3; i++) {
    const x = 3.15 + i * 1.4;
    plate(x, 2.16, 1.72, 0.52);
    croissant(x, 2.21, 1.72, 0.52, -0.25 + i * 0.4);
    plate(x, 2.69, 1.7, 0.44);
    // Berry tartlets and pistachio nests on the upper shelf.
    cyl(breadMats[1], x, 2.79, 1.7, 0.3, 0.12, 0.33);
    cyl(cream, x, 2.86, 1.7, 0.28, 0.07, 0.28);
    for (let j = 0; j < 8; j++) {
      const a = j * 2.4;
      orb(
        mat(i === 1 ? "#70914f" : "#853c4c", 0.34),
        x + Math.sin(a) * 0.19,
        2.94,
        1.7 + Math.cos(a) * 0.19,
        0.075,
        0.08,
        0.075,
      );
    }
    box(
      plaque(
        [
          [
            ["MOON CROISSANTS", "BERRY DAYDREAMS", "PISTACHIO CLOUDS"][i],
            36,
            0.4,
          ],
          ["made with a little magic", 25, 0.72],
        ],
        0.9,
        0.23,
        "#eee0bb",
        "#4e5945",
      ),
      x,
      2.24,
      2.49,
      1.06,
      0.27,
      0.02,
      0.01,
    );
  }
  for (const x of [3, 4.55, 6.1]) {
    const med = torus(brass, x, 0.94, 2.64, 0.2, 0.018);
    med.scale.x = 0.7;
    beam(brass, [x, 0.77, 2.65], [x, 1.12, 2.65], 0.018);
    for (let i = 0; i < 4; i++)
      for (const side of [-1, 1]) {
        const l = orb(
          brass,
          x + side * 0.06,
          0.85 + i * 0.06,
          2.65,
          0.05,
          0.018,
          0.01,
        );
        l.rotation.z = side * 0.6;
      }
  }
  // Side table with a bell and parcels tied with string.
  const register = group(6.05, 0, -0.7);
  box(teal, 0, 0.87, 0, 1.55, 1.6, 1.1, 0.06, register);
  box(oak, 0, 1.73, 0, 1.7, 0.16, 1.2, 0.04, register);
  cyl(walnut, 0.4, 1.88, 0.1, 0.23, 0.09, 0.23, register);
  orb(brass, 0.4, 1.98, 0.1, 0.18, 0.15, 0.18, register);
  orb(brass, 0.4, 2.14, 0.1, 0.05, 0.055, 0.05, register);
  for (let i = 0; i < 2; i++) {
    box(
      mat("#b99a6b"),
      -0.3,
      1.96 + i * 0.28,
      -0.14,
      0.65,
      0.27,
      0.52,
      0.025,
      register,
    );
    box(linen, -0.3, 2.105 + i * 0.28, -0.14, 0.025, 0.014, 0.52, 0, register);
    box(linen, -0.3, 2.11 + i * 0.28, -0.14, 0.65, 0.014, 0.025, 0, register);
  }
  // Freestanding chalkboard and a harvest basket beside the entrance.
  const sign = group(6.3, 0.18, 4.5, -0.24);
  for (const x of [-0.52, 0.52])
    for (const side of [-1, 1])
      beam(oak, [x, 0, side * 0.37], [x, 1.9, 0], 0.08, sign);
  box(walnut, 0, 1.08, 0.09, 1.28, 1.4, 0.14, 0.045, sign);
  box(
    plaque(
      [
        ["TODAY’S LITTLE JOYS", 49, 0.16],
        ["Moon croissants", 57, 0.39],
        ["Lavender & honey", 47, 0.57],
        ["A moment to yourself", 40, 0.79],
      ],
      1.1,
      1.23,
      "#293e35",
      "#dedfc0",
    ),
    0,
    1.08,
    0.17,
    1.1,
    1.23,
    0.015,
    0.01,
    sign,
  );
  cyl(linen, 6.55, 0.55, 3.4, 0.49, 0.75, 0.65);
  for (let i = 0; i < 8; i++)
    torus(oak, 6.55, 0.22 + i * 0.09, 3.4, 0.49 + i * 0.022, 0.023).rotation.x =
      Math.PI / 2;
  for (let i = 0; i < 5; i++) {
    const g = group(
      6.3 + (i % 3) * 0.23,
      0.75,
      3.2 + Math.floor(i / 3) * 0.25,
      range(-0.4, 0.4),
    );
    g.rotation.z = range(-0.25, 0.25);
    orb(breadMats[i % 4], 0, 0.38, 0, 0.13, 0.72, 0.12, g);
    for (let k = 0; k < 4; k++) {
      const cut = box(
        mat("#dfb67b"),
        0,
        0.12 + k * 0.21,
        0.115,
        0.12,
        0.013,
        0.008,
        0.003,
        g,
      );
      cut.rotation.z = -0.6;
    }
  }
  // A little flour spirit watches the room from its sack: the bakery's secret keeper.
  const sack = group(-2.9, 0.15, 0.5);
  orb(linen, 0, 0.52, 0, 0.44, 0.58, 0.38, sack);
  torus(oak, 0, 0.95, 0, 0.29, 0.045, sack).rotation.x = Math.PI / 2;
  orb(flour, 0, 1.12, 0, 0.28, 0.3, 0.25, sack);
  for (const side of [-1, 1])
    orb(dark, side * 0.085, 1.18, 0.231, 0.025, 0.035, 0.015, sack);
  const hat = mesh(new T.ConeGeometry(0.26, 0.5, 24), teal, 0, 1.53, 0, sack);
  hat.rotation.z = -0.24;
  torus(brass, 0, 1.3, 0, 0.25, 0.026, sack).rotation.x = Math.PI / 2;
  box(
    plaque(
      [
        ["MOON", 70, 0.38],
        ["FLOUR", 65, 0.7],
      ],
      0.48,
      0.43,
      "#d1bc91",
      "#5a6250",
    ),
    0,
    0.53,
    0.402,
    0.48,
    0.43,
    0.015,
    0.008,
    sack,
  );
  // A vintage weighing scale, a hanging herb garden and small copper lamps.
  const scale = group(2.1, 1.8, 1.7);
  box(teal, 0, 0.08, 0, 0.6, 0.16, 0.55, 0.05, scale);
  box(teal, 0, 0.35, 0, 0.35, 0.48, 0.22, 0.08, scale);
  const dial = cyl(cream, 0, 0.42, 0.15, 0.22, 0.035, 0.22, scale);
  dial.rotation.x = Math.PI / 2;
  torus(brass, 0, 0.42, 0.18, 0.23, 0.025, scale);
  beam(dark, [0, 0.42, 0.21], [-0.09, 0.53, 0.21], 0.014, scale);
  cyl(brass, 0, 0.69, 0, 0.3, 0.05, 0.42, scale);
  // Hanging garland follows the architecture instead of crossing the focal objects.
  const garlandPoints = [];
  for (let i = 0; i <= 24; i++)
    garlandPoints.push([
      -7.15 + i * 0.6,
      5.67 - Math.sin((i / 24) * Math.PI) * 0.46,
      -4.91,
    ]);
  tube(leaves[0], garlandPoints, 0.025);
  for (let i = 0; i < 49; i++) {
    const x = -7.15 + i * 0.3,
      y = 5.67 - Math.sin((i / 48) * Math.PI) * 0.46;
    const l = leaf(leaves[i % 4], x, y, -4.9, 0.11, 0.4);
    l.rotation.z = Math.PI + (i % 2 ? 1 : -1) * 0.6;
    if (i % 5 === 0) orb(mat("#b56d43"), x, y - 0.2, -4.85, 0.07, 0.07, 0.07);
  }
  for (let i = 0; i < 3; i++) {
    const z = -0.7 + i * 0.7;
    tube(
      linen,
      [
        [-7.15, 5.7, z],
        [-6.95, 4.7, z],
      ],
      0.015,
    );
    for (let j = 0; j < 9; j++) {
      const a = j * 2.4;
      const x = -6.95 + Math.sin(a) * 0.14,
        zz = z + Math.cos(a) * 0.13;
      beam(leaves[0], [x, 4.75, zz], [x, 4.25 - range(0, 0.3), zz], 0.015);
      orb(mat(i === 1 ? "#9686a0" : "#7d8b56"), x, 4.3, zz, 0.06, 0.21, 0.05);
    }
  }
  const pendants = [];
  for (const [x, z, h] of [
    [-1.1, 0.3, 4.7],
    [4.5, 1.3, 4.95],
  ]) {
    beam(dark, [x, 6.4, z], [x, h + 0.4, z], 0.025);
    const shade = mesh(
      new T.CylinderGeometry(0.13, 0.53, 0.31, 48, 1, true),
      copper,
      x,
      h + 0.2,
      z,
    );
    shade.material = copper.clone();
    shade.material.side = T.DoubleSide;
    torus(brass, x, h + 0.045, z, 0.53, 0.025).rotation.x = Math.PI / 2;
    orb(
      new T.MeshStandardMaterial({
        color: "#fff0bc",
        emissive: "#ffd080",
        emissiveIntensity: 2.2,
      }),
      x,
      h,
      z,
      0.12,
      0.17,
      0.12,
    );
    const light = new T.PointLight("#ffd194", 15, 7, 2);
    light.position.set(x, h - 0.16, z);
    scene.add(light);
    pendants.push(light);
  }
  // A slow-turning mobile of three tiny brass stars above the dough.
  const mobile = group(0.2, 3.9, -0.8);
  function star(x, y, z, r, p = root) {
    const shape = new T.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 + Math.PI / 2,
        rr = i % 2 ? r * 0.45 : r;
      i
        ? shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
        : shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    shape.closePath();
    return mesh(
      new T.ExtrudeGeometry(shape, {
        depth: 0.025,
        bevelEnabled: true,
        bevelSize: 0.006,
        bevelThickness: 0.005,
        bevelSegments: 1,
      }),
      brass,
      x,
      y,
      z,
      p,
    );
  }
  for (let i = 0; i < 3; i++) {
    const x = -0.6 + i * 0.58,
      y = 0.3 + Math.sin(i * 2) * 0.23;
    tube(
      brass,
      [
        [x, 1.2, 0],
        [x, y + 0.16, 0],
      ],
      0.006,
      mobile,
    );
    star(x, y, 0, 0.16, mobile);
  }
  // Complete the room around the visitor. These walls and the timber ceiling
  // make every direction a finished interior, including the entrance behind you.
  box(plaster, 7.7, 3, 0, 0.28, 5.9, 11.8, 0.045);
  box(plaster, 0, 3, 5.85, 15.6, 5.9, 0.28, 0.045);
  box(teal, 7.5, 0.85, 0, 0.13, 1.5, 11.6, 0.02);
  box(teal, 0, 0.85, 5.65, 15.2, 1.5, 0.13, 0.02);
  for (let z = -5.2; z <= 5.3; z += 0.8)
    box(tealLight, 7.4, 0.85, z, 0.05, 1.35, 0.045, 0.006);
  for (let x = -7; x <= 7; x += 0.8)
    box(tealLight, x, 0.85, 5.55, 0.045, 1.35, 0.05, 0.006);
  for (const y of [0.25, 1.58, 1.7]) {
    box(y === 1.7 ? oak : tealLight, 0, y, 5.5, 15.5, 0.085, 0.17, 0.014);
    box(y === 1.7 ? oak : tealLight, 7.35, y, 0, 0.17, 0.085, 11.6, 0.014);
  }
  box(walnut, 0, 5.95, 5.48, 15.7, 0.34, 0.48, 0.065);
  box(walnut, 7.4, 5.95, 0, 0.42, 0.34, 11.9, 0.065);
  for (const z of [-5.5, 0, 5.5]) box(walnut, 7.4, 3, z, 0.3, 5.9, 0.3, 0.04);
  const ceiling = box(plaster, 0, 6.1, 0, 15.5, 0.18, 11.7, 0.025);
  // The ceiling receives indoor light; the exterior key remains an indirect fill.
  ceiling.castShadow = false;
  for (let z = -4.6; z <= 5; z += 2.35) {
    box(walnut, 0, 5.78, z, 15.5, 0.36, 0.24, 0.04);
    for (const side of [-1, 1])
      beam(walnut, [side * 7.4, 5.05, z], [side * 6.6, 5.78, z], 0.16);
  }
  cyl(copper, -4.8, 5.78, -4.05, 0.43, 0.55, 0.43);
  const entrance = group(4.8, 0.16, 5.43, Math.PI);
  arch(walnut, 0, 0, 0, 2.65, 4.1, 0.16, entrance);
  arch(brass, 0, 0.05, 0.17, 2.43, 3.9, 0.025, entrance);
  arch(teal, 0, 0.08, 0.21, 2.32, 3.8, 0.055, entrance);
  for (const x of [-0.58, 0.58]) {
    box(tealDark, x, 1.2, 0.285, 0.93, 1.95, 0.035, 0.025, entrance);
    box(tealLight, x, 1.2, 0.31, 0.8, 1.79, 0.022, 0.02, entrance);
    box(teal, x, 1.2, 0.33, 0.7, 1.68, 0.022, 0.012, entrance);
  }
  arch(windowMat, 0, 2.35, 0.29, 1.91, 1.23, 0.015, entrance);
  for (const x of [-0.6, 0, 0.6])
    box(brass, x, 2.82, 0.34, 0.035, 0.86, 0.03, 0.005, entrance);
  box(brass, 0, 2.74, 0.34, 1.9, 0.04, 0.03, 0.005, entrance);
  box(brass, 0.87, 1.64, 0.36, 0.15, 0.39, 0.025, 0.025, entrance);
  orb(brass, 0.87, 1.68, 0.43, 0.085, 0.085, 0.07, entrance);
  box(
    plaque([["THE VILLAGE AWAITS", 52, 0.5]], 1.8, 0.3),
    0,
    2.13,
    0.36,
    1.8,
    0.3,
    0.03,
    0.015,
    entrance,
  );
  box(mat("#866c47"), 4.8, 0.16, 4.9, 2.3, 0.035, 0.95, 0.035);
  for (let x = 3.75; x < 5.9; x += 0.12)
    box(linen, x, 0.182, 4.9, 0.025, 0.006, 0.8, 0);
  // A broad front window and a handwritten menu reward turning around.
  const frontWindow = group(-2.9, 2.2, 5.45, Math.PI);
  arch(walnut, 0, 0, 0, 4.4, 3.25, 0.16, frontWindow);
  arch(windowMat, 0, 0.13, 0.19, 4.05, 2.94, 0.025, frontWindow);
  for (const x of [-1.34, 0, 1.34])
    box(walnut, x, 1.29, 0.25, 0.055, 2.35, 0.05, 0.008, frontWindow);
  box(walnut, 0, 1.23, 0.25, 4.04, 0.07, 0.05, 0.008, frontWindow);
  box(oak, 0, 0, 0.16, 4.6, 0.15, 0.5, 0.04, frontWindow);
  pot(-4.25, 2.3, 5.12, 0.22);
  pot(-1.45, 2.3, 5.12, 0.22);
  const menu = group(7.42, 3.35, -0.7, -Math.PI / 2);
  box(walnut, 0, 0, 0, 2.6, 2.45, 0.13, 0.05, menu);
  box(
    plaque(
      [
        ["FROM FINN’S OVEN", 64, 0.15],
        ["Moon croissants", 57, 0.35],
        ["Wild honey buns", 57, 0.5],
        ["Lavender shortbread", 50, 0.65],
        ["There is always enough to share.", 33, 0.85],
      ],
      2.4,
      2.25,
    ),
    0,
    0,
    0.08,
    2.4,
    2.25,
    0.025,
    0.02,
    menu,
  );
  const frontFill = new T.PointLight("#ffe3b4", 20, 12, 2);
  frontFill.position.set(-2.9, 4, 4.7);
  scene.add(frontFill);
  // The exterior threshold is just beyond the closed entrance.
  box(oak, 4.8, 0.01, 6.25, 2.9, 0.17, 0.7, 0.06);
  box(walnut, 4.8, -0.15, 6.65, 3.3, 0.18, 0.45, 0.05);
  box(
    plaque(
      [
        ["THE DAILY LOAF", 70, 0.42],
        ["W I L L O W M E R E", 27, 0.75],
      ],
      3.2,
      0.5,
      "#25483f",
      "#d9bd80",
    ),
    -1.8,
    -0.36,
    6.115,
    3.2,
    0.48,
    0.025,
    0.02,
  );
  pot(7.15, 0.17, 4.88, 0.42);
  // Grounding shadows under the set and small soft contacts under the furniture.
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 128;
  const sc = shadowCanvas.getContext("2d"),
    gradient = sc.createRadialGradient(64, 64, 2, 64, 64, 64);
  gradient.addColorStop(0, "rgba(9,19,16,.5)");
  gradient.addColorStop(0.45, "rgba(9,19,16,.25)");
  gradient.addColorStop(1, "rgba(9,19,16,0)");
  sc.fillStyle = gradient;
  sc.fillRect(0, 0, 128, 128);
  const shadowMat = new T.MeshBasicMaterial({
    map: new T.CanvasTexture(shadowCanvas),
    transparent: true,
    depthWrite: false,
  });
  for (const [x, z, w, d] of [
    [-0.6, 0.1, 5, 2.9],
    [-4.7, 2.5, 3, 3],
    [4.5, 1.7, 6, 3],
    [-4.8, -3, 4, 4],
    [6.55, 3.4, 1.6, 1.6],
  ]) {
    const shadow = mesh(new T.PlaneGeometry(w, d), shadowMat, x, 0.145, z);
    shadow.rotation.x = -Math.PI / 2;
    shadow.castShadow = false;
  }
  const floor = mesh(
    new T.PlaneGeometry(400, 400),
    new T.MeshBasicMaterial({ color: "#253b38" }),
    0,
    -0.84,
    0,
    scene,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.castShadow = false;
  floor.receiveShadow = false;
  const groundShadow = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 vUv;void main(){vec2 p=(vUv-.5)*2.;float r=dot(p,p);float dither=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)/255.;float a=exp(-r*3.5)*.5*(1.-smoothstep(.65,1.,r));gl_FragColor=vec4(.025,.06,.045,max(0.,a-dither));}`,
  });
  const setShadow = mesh(
    new T.PlaneGeometry(25, 21),
    groundShadow,
    0,
    -0.825,
    0,
    scene,
  );
  setShadow.rotation.x = -Math.PI / 2;
  setShadow.castShadow = false;
  const ambient = new T.HemisphereLight("#f4e6d1", "#476759", 1.2);
  scene.add(ambient);
  const sun = new T.DirectionalLight("#ffe2b4", 2.7);
  sun.position.set(-8, 10, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, {
    left: -13,
    right: 13,
    top: 12,
    bottom: -12,
    near: 0.5,
    far: 40,
  });
  sun.shadow.normalBias = 0.025;
  sun.shadow.bias = -0.00015;
  sun.shadow.radius = 3;
  scene.add(sun);
  const rim = new T.DirectionalLight("#9ac8c5", 1.5);
  rim.position.set(8, 9, -5);
  scene.add(rim);
  const windowLight = new T.SpotLight("#fff2be", 150, 18, 0.7, 0.5, 1.7);
  windowLight.position.set(0, 4.2, -4.6);
  windowLight.target.position.set(-0.2, 0, 3.5);
  scene.add(windowLight, windowLight.target);
  // Window-shaped sunlight breaks up the floor and makes the light feel motivated.
  const goboCanvas = document.createElement("canvas");
  goboCanvas.width = goboCanvas.height = 512;
  const gc = goboCanvas.getContext("2d");
  gc.fillStyle = "#fff";
  gc.fillRect(0, 0, 512, 512);
  gc.fillStyle = "#111";
  for (const x of [125, 250, 375]) gc.fillRect(x, 0, 8, 512);
  for (const y of [128, 256, 384]) gc.fillRect(0, y, 512, 8);
  windowLight.map = new T.CanvasTexture(goboCanvas);
  windowLight.castShadow = true;
  windowLight.shadow.mapSize.set(1024, 1024);
  windowLight.shadow.bias = -0.0002;
  const rayMaterial = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
    blending: T.AdditiveBlending,
    uniforms: { strength: { value: 0.035 } },
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 vUv;uniform float strength;void main(){float edge=pow(max(0.,1.-abs(vUv.x-.5)*2.),2.);float end=smoothstep(0.,.12,vUv.y)*(1.-smoothstep(.6,1.,vUv.y));gl_FragColor=vec4(1.,.79,.43,edge*end*strength);}`,
  });
  for (const x of [-1.05, 0, 1.05]) {
    const geo = new T.BufferGeometry();
    geo.setAttribute(
      "position",
      new T.Float32BufferAttribute(
        [
          x - 0.18,
          3.9,
          -4.9,
          x + 0.18,
          3.9,
          -4.9,
          x + 1.1,
          0.2,
          3.7,
          x - 0.65,
          0.2,
          3.7,
        ],
        3,
      ),
    );
    geo.setAttribute(
      "uv",
      new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2),
    );
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    geo.computeVertexNormals();
    const ray = mesh(geo, rayMaterial);
    ray.castShadow = ray.receiveShadow = false;
  }
  // Fine drifting dust, restrained enough to read as atmosphere rather than glitter.
  const dustGeo = new T.BufferGeometry(),
    dustPositions = new Float32Array(95 * 3);
  for (let i = 0; i < 95; i++) {
    dustPositions[i * 3] = range(-6.8, 6.8);
    dustPositions[i * 3 + 1] = range(0.4, 5.6);
    dustPositions[i * 3 + 2] = range(-4.9, 4.9);
  }
  dustGeo.setAttribute("position", new T.BufferAttribute(dustPositions, 3));
  const dust = new T.Points(
    dustGeo,
    new T.PointsMaterial({
      color: "#ffe5ac",
      size: 0.027,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    }),
  );
  scene.add(dust);
  root.traverse((o) => {
    if (o.isMesh && o.material === glass) {
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });
  // Bake static meshes into material batches. Curves, bevels and all surface detail survive.
  root.updateMatrixWorld(true);
  const batches = new Map(),
    keep = new Set([cat, mobile]);
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
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
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
  let night = false;
  return {
    scene,
    sun,
    layout: {
      bounds: { minX: -7.35, maxX: 7.35, minZ: -5.5, maxZ: 5.5 },
      spawn: { x: 4.8, z: 4.65, yaw: 0.93 },
      colliders: [
        { x: -4.8, z: -3.7, w: 3.7, d: 3.1 },
        { x: 0, z: -4.7, w: 4.8, d: 1.57 },
        { x: 5.05, z: -4.75, w: 4.35, d: 1.42 },
        { x: -0.6, z: 0.1, w: 3.9, d: 1.7, rotation: -0.06 },
        { x: 4.55, z: 1.7, w: 4.85, d: 1.95 },
        { x: 6.05, z: -0.7, w: 1.7, d: 1.2 },
        { x: -4.7, z: 2.5, r: 1.0 },
        { x: -5.85, z: 2.5, r: 0.49 },
        { x: -3.4, z: 3.55, r: 0.49 },
        { x: -6.6, z: 0.25, w: 1.25, d: 2.1 },
        { x: -6.1, z: -1.3, w: 1.5, d: 0.8 },
        { x: -2.9, z: 0.5, r: 0.46 },
        { x: 6.55, z: 3.4, r: 0.66 },
        { x: 6.3, z: 4.5, w: 1.35, d: 0.9, rotation: -0.24 },
        { x: 7.15, z: 4.88, r: 0.58 },
      ],
    },
    setNight(value) {
      night = value;
    },
    update(time, motion = true) {
      const t = motion ? time : 0;
      flameMaterial.uniforms.time.value = t;
      steam.rotation.y = t * 0.25;
      steamMat.opacity = 0.12 + Math.sin(t * 0.8) * 0.04;
      fireLight.intensity = 18 + Math.sin(t * 4) * 1.8 + Math.sin(t * 7) * 1.2;
      cinnamon.torso.scale.y = 1 + Math.sin(t * 1.7) * 0.035;
      cinnamon.head.rotation.z = -0.16 + Math.sin(t * 1.7 + 0.4) * 0.012;
      cinnamon.tailTip.rotation.y = Math.sin(t * 0.85) * 0.09;
      cinnamon.ears[0].rotation.x = Math.sin(t * 1.3) > 0.992 ? -0.18 : 0;
      cinnamon.ears[1].rotation.x = Math.sin(t * 1.1 + 2) > 0.994 ? 0.13 : 0;
      mobile.rotation.y = Math.sin(t * 0.35) * 0.16;
      dust.rotation.y = Math.sin(t * 0.04) * 0.08;
      dust.position.y = Math.sin(t * 0.3) * 0.1;
      const mix = night ? 1 : 0;
      sun.intensity = T.MathUtils.lerp(sun.intensity, night ? 0.45 : 2.7, 0.06);
      ambient.intensity = T.MathUtils.lerp(
        ambient.intensity,
        night ? 0.65 : 1.2,
        0.06,
      );
      rim.intensity = T.MathUtils.lerp(rim.intensity, night ? 1.8 : 1.5, 0.06);
      rim.color.set(night ? "#839ecb" : "#9ac8c5");
      windowMat.emissiveIntensity = night ? 0.16 : 0.42;
      windowMat.color.set(night ? "#7398a9" : "#e5efc9");
      windowLight.intensity = night ? 22 : 150;
      rayMaterial.uniforms.strength.value = night ? 0.012 : 0.035;
      pendants.forEach((l) => (l.intensity = night ? 28 : 15));
      scene.background.lerp(new T.Color(mix ? "#15282d" : "#253b38"), 0.06);
      floor.material.color.copy(scene.background);
    },
  };
}
