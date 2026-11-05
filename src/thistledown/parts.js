import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createRoomKit } from "../interior-kit.js";

// The furniture and small things every room at Thistledown is dressed with.
// `createParts` binds them to one room: everything is parented to `base` (a
// group at that floor's boards), so a room is written in floor coordinates.
// Geometry is kept small: most boxes are sharp, and round things have few sides,
// since a thousand teaspoons add up.

const sphere = new T.SphereGeometry(1, 12, 8),
  smallSphere = new T.SphereGeometry(1, 7, 5);

const seedOf = (name) => [...name].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 11);

export function createParts(name, M, sheet, floorY = 0) {
  const root = new T.Group(),
    kit = createRoomKit(root, seedOf(name)),
    { random, range, mat } = kit,
    base = new T.Group();
  base.position.y = floorY;
  root.add(base);
  root.name = name;
  const keep = new Set();

  const box = (m, x, y, z, w, h, d, r = 0, p = base) => kit.box(m, x, y, z, w, h, d, r, p);
  const cyl = (m, x, y, z, r, h, rt = r, p = base, seg = 12) => kit.cyl(m, x, y, z, r, h, rt, p, seg);
  const orb = (m, x, y, z, a, b = a, c = a, p = base) => {
    const o = kit.mesh(sphere, m, x, y, z, p);
    o.scale.set(a, b, c);
    return o;
  };
  const dot = (m, x, y, z, a, b = a, c = a, p = base) => {
    const o = kit.mesh(smallSphere, m, x, y, z, p);
    o.scale.set(a, b, c);
    return o;
  };
  const group = (x, y, z, turn = 0, p = base) => kit.group(x, y, z, turn, p);
  const beam = (m, a, b, width = 0.05, p = base) => kit.beam(m, a, b, width, p);
  const torus = (m, x, y, z, r, t = 0.012, p = base, arc = Math.PI * 2) => {
    const geo = new T.TorusGeometry(r, t, 5, 12, arc);
    return kit.mesh(geo, m, x, y, z, p);
  };
  // A box whose texture is laid by the metre in world space, so wallpaper and
  // floorboards run on across every wall and opening without a seam. `alongZ`
  // turns a floor's boards to run along z.
  function slab(m, minX, maxX, minY, maxY, minZ, maxZ, tile = 1, { alongZ = false, p = base, shadow = true } = {}) {
    const g = new T.BoxGeometry(maxX - minX, maxY - minY, maxZ - minZ);
    g.translate((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
    const pos = g.attributes.position,
      normal = g.attributes.normal,
      uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        y = pos.getY(i),
        z = pos.getZ(i);
      if (Math.abs(normal.getX(i)) > 0.5) uv.setXY(i, z / tile, y / tile);
      else if (Math.abs(normal.getZ(i)) > 0.5) uv.setXY(i, x / tile, y / tile);
      else if (alongZ) uv.setXY(i, z / tile, x / tile);
      else uv.setXY(i, x / tile, z / tile);
    }
    const o = kit.mesh(g, m, 0, 0, 0, p);
    o.castShadow = shadow;
    return o;
  }
  // A rectangle of the shared picture sheet, facing local +z. A little frame
  // goes round it when asked.
  function sheetPlane(cell, x, y, z, w, h, turn = 0, p = base) {
    const g = new T.PlaneGeometry(w, h);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) ? cell.u1 : cell.u0, uv.getY(i) ? cell.v1 : cell.v0);
    }
    const o = kit.mesh(g, sheet.material, x, y, z, p);
    o.rotation.y = turn;
    o.castShadow = false;
    return o;
  }
  function picture(cell, x, y, z, w, h, turn = 0, frame = M.darkOak, p = base) {
    const g = group(x, y, z, turn, p);
    box(frame, 0, 0, -0.012, w + 0.07, h + 0.07, 0.024, 0, g);
    box(M.ivory, 0, 0, -0.002, w + 0.015, h + 0.015, 0.008, 0, g);
    sheetPlane(cell, 0, 0, 0.004, w, h, 0, g);
    return g;
  }

  // A looking glass: the same painted sheen on every one in the house, since
  // nothing here reflects for real.
  function mirrorGlass(x, y, z, w, h, turn = 0, p = base) {
    sheet.mirror ??= sheet.cell(160, 200, (c, cw, ch) => {
      const g = c.createLinearGradient(0, 0, cw, ch);
      g.addColorStop(0, "#dfe6e2");
      g.addColorStop(0.42, "#b9c7c4");
      g.addColorStop(0.62, "#d3d9d1");
      g.addColorStop(1, "#8f9d9b");
      c.fillStyle = g;
      c.fillRect(0, 0, cw, ch);
      c.fillStyle = "rgba(255,255,250,0.4)";
      c.beginPath();
      c.moveTo(cw * 0.2, 0);
      c.lineTo(cw * 0.52, 0);
      c.lineTo(cw * 0.12, ch);
      c.lineTo(0, ch);
      c.lineTo(0, ch * 0.5);
      c.fill();
    });
    return sheetPlane(sheet.mirror, x, y, z, w, h, turn, p);
  }
  // Merges a moving group's meshes into a single draw, keeping it out of the
  // room's bake. Its parts should not need to move against each other.
  function fuse(g) {
    g.updateWorldMatrix(true, true);
    const inverse = g.matrixWorld.clone().invert(),
      meshes = [],
      m4 = new T.Matrix4();
    g.traverse((o) => o.isMesh && meshes.push(o));
    const pieces = meshes.map((o) => {
      const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      geo.applyMatrix4(m4.multiplyMatrices(inverse, o.matrixWorld));
      const count = geo.attributes.position.count,
        colors = new Float32Array(count * 3),
        { r, g: green, b } = o.material.color;
      for (let i = 0; i < count; i++) colors.set([r, green, b], i * 3);
      geo.setAttribute("color", new T.BufferAttribute(colors, 3));
      return geo;
    });
    const merged = mergeGeometries(pieces);
    pieces.forEach((geo) => geo.dispose());
    while (g.children.length) g.remove(g.children[0]);
    const mesh = new T.Mesh(merged, M.figure);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    g.add(mesh);
    keep.add(g);
    return g;
  }

  // ---------------------------------------------------------------- furniture
  function chair(x, z, turn, { wood = M.oak, seat = M.ginghamRed, h = 0.46, p = base } = {}) {
    const g = group(x, 0, z, turn, p),
      w = 0.42;
    box(wood, 0, h - 0.02, 0, w, 0.04, w, 0.01, g);
    box(seat, 0, h + 0.015, 0.015, w - 0.05, 0.032, w - 0.07, 0.012, g);
    for (const [lx, lz] of [[-1, 1], [1, 1]]) box(wood, (lx * w) / 2 - lx * 0.03, h / 2 - 0.01, (lz * w) / 2 - 0.03, 0.036, h - 0.03, 0.036, 0, g);
    for (const lx of [-1, 1]) {
      box(wood, (lx * w) / 2 - lx * 0.03, 0.46, -w / 2 + 0.03, 0.036, 0.92, 0.036, 0, g);
    }
    for (const yy of [0.58, 0.72, 0.86]) box(wood, 0, yy, -w / 2 + 0.03, w - 0.06, 0.05, 0.016, 0, g);
    box(wood, 0, 0.14, w / 2 - 0.03, w - 0.08, 0.018, 0.018, 0, g);
    for (const lx of [-1, 1]) box(wood, (lx * w) / 2 - lx * 0.03, 0.2, 0, 0.018, 0.018, w - 0.08, 0, g);
    return g;
  }
  function table(x, z, w, d, h, wood = M.oak, p = base) {
    const g = group(x, 0, z, 0, p);
    box(wood, 0, h - 0.018, 0, w, 0.036, d, 0.008, g);
    box(wood, 0, h - 0.07, d / 2 - 0.05, w - 0.1, 0.07, 0.022, 0, g);
    box(wood, 0, h - 0.07, -d / 2 + 0.05, w - 0.1, 0.07, 0.022, 0, g);
    box(wood, w / 2 - 0.05, h - 0.07, 0, 0.022, 0.07, d - 0.1, 0, g);
    box(wood, -w / 2 + 0.05, h - 0.07, 0, 0.022, 0.07, d - 0.1, 0, g);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
      cyl(wood, (a * w) / 2 - a * 0.05, (h - 0.04) / 2, (b * d) / 2 - b * 0.05, 0.018, h - 0.04, 0.032, g, 8);
    return g;
  }
  // A cloth hung over a table, with soft corners. Returns the top's height.
  function clothOver(g, w, d, h, cloth, drop = 0.26) {
    const top = h + 0.004;
    box(cloth, 0, top, 0, w + 0.03, 0.006, d + 0.03, 0, g);
    for (const [ax, az, sx, sz] of [
      [0, d / 2 + 0.016, w + 0.03, 0.008],
      [0, -d / 2 - 0.016, w + 0.03, 0.008],
      [w / 2 + 0.016, 0, 0.008, d + 0.03],
      [-w / 2 - 0.016, 0, 0.008, d + 0.03],
    ])
      box(cloth, ax, top - drop / 2, az, sx, drop, sz, 0, g);
    return top + 0.003;
  }
  function roundClothTable(x, z, r, h, cloth, p = base) {
    const g = group(x, 0, z, 0, p);
    cyl(M.oak, 0, h / 2, 0, 0.035, h, 0.035, g, 10);
    cyl(M.oak, 0, 0.04, 0, 0.26, 0.05, 0.1, g, 14);
    cyl(M.oak, 0, h - 0.018, 0, r, 0.036, r, g, 28);
    kit.mesh(new T.CylinderGeometry(r + 0.012, r + 0.12, 0.3, 28, 1, true), cloth, 0, h - 0.15, 0, g);
    cyl(cloth, 0, h + 0.003, 0, r + 0.014, 0.008, r + 0.014, g, 28);
    return g;
  }
  function armchair(x, z, turn, cover = M.chintz, trim = M.sageVelvet, p = base) {
    const g = group(x, 0, z, turn, p);
    box(cover, 0, 0.24, 0, 0.74, 0.32, 0.72, 0.03, g);
    box(trim, 0, 0.45, 0.04, 0.6, 0.13, 0.62, 0.05, g);
    box(cover, 0, 0.72, -0.31, 0.74, 0.72, 0.16, 0.05, g);
    for (const s of [-1, 1]) {
      box(cover, s * 0.33, 0.48, 0.02, 0.16, 0.3, 0.68, 0.05, g);
      orb(cover, s * 0.33, 0.62, 0.34, 0.08, 0.05, 0.05, g);
      // The wings.
      box(cover, s * 0.33, 0.9, -0.2, 0.1, 0.34, 0.26, 0.03, g);
    }
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
      cyl(M.darkOak, a * 0.31, 0.045, b * 0.28, 0.02, 0.09, 0.03, g, 7);
    // An antimacassar over the back.
    box(M.linen, 0, 1.04, -0.31, 0.32, 0.02, 0.18, 0.005, g);
    box(M.linen, 0, 0.96, -0.228, 0.32, 0.17, 0.008, 0, g);
    return g;
  }
  function bookRow(x, y, z, length, h, turn = 0, p = base, palette = BOOK_COLOURS) {
    const g = group(x, y, z, turn, p);
    let at = -length / 2;
    while (at < length / 2 - 0.02) {
      const w = range(0.022, 0.05),
        tall = h * range(0.72, 1),
        lean = random() > 0.88 ? range(-0.12, 0.12) : 0,
        colour = palette[Math.floor(random() * palette.length)];
      const b = box(mat(colour, 0.78), at + w / 2, tall / 2, 0, w - 0.002, tall, range(0.12, 0.16), 0, g);
      b.rotation.z = lean;
      if (random() > 0.72) box(M.butter, at + w / 2, tall * 0.78, 0.075, w - 0.006, 0.012, 0.004, 0, g);
      at += w + (lean ? 0.016 : 0.001);
    }
    return g;
  }
  function bookcase(x, z, turn, w, h, d, shelves, wood = M.darkOak, p = base, fill = true) {
    const g = group(x, 0, z, turn, p);
    for (const s of [-1, 1]) box(wood, (s * (w - 0.03)) / 2, h / 2, 0, 0.03, h, d, 0, g);
    box(wood, 0, h / 2, -d / 2 + 0.008, w, h, 0.016, 0, g);
    box(wood, 0, h + 0.012, 0.012, w + 0.05, 0.04, d + 0.04, 0.006, g);
    box(wood, 0, 0.05, 0.005, w, 0.1, d + 0.01, 0, g);
    const step = (h - 0.12) / shelves,
      levels = [];
    for (let i = 0; i < shelves; i++) {
      const y = 0.1 + i * step;
      box(wood, 0, y, 0, w - 0.03, 0.02, d - 0.01, 0, g);
      levels.push(y + 0.01);
      if (fill) bookRow(0, y + 0.01, 0.01, w - 0.09, step - 0.05, 0, g);
    }
    return { g, levels, step };
  }
  function lamp(x, y, z, { height = 0.34, r = 0.14, stem = M.brass, shadeMat = M.shade, p = base } = {}) {
    const g = group(x, y, z, 0, p);
    cyl(stem, 0, 0.01, 0, 0.06, 0.02, 0.05, g, 12);
    cyl(stem, 0, height * 0.4, 0, 0.014, height * 0.8, 0.014, g, 7);
    orb(stem, 0, height * 0.28, 0, 0.042, 0.05, 0.042, g);
    const s = kit.mesh(new T.CylinderGeometry(r * 0.55, r, r * 1.05, 16, 1, true), shadeMat, 0, height + r * 0.2, 0, g);
    s.castShadow = false;
    return g;
  }
  function pendant(x, ceiling, z, drop, r = 0.2, shadeMat = M.shade, p = base) {
    const g = group(x, ceiling, z, 0, p);
    cyl(M.brass, 0, -0.012, 0, 0.05, 0.024, 0.05, g, 10);
    box(M.black, 0, -drop / 2, 0, 0.008, drop, 0.008, 0, g);
    const s = kit.mesh(new T.ConeGeometry(r, r * 0.7, 18, 1, true), shadeMat, 0, -drop - r * 0.25, 0, g);
    s.castShadow = false;
    orb(M.bulb, 0, -drop - r * 0.4, 0, 0.04, 0.05, 0.04, g);
    return g;
  }
  function potPlant(x, y, z, size = 0.16, leaves = 7, p = base, glaze = M.rust) {
    const g = group(x, y, z, range(0, 6), p);
    cyl(glaze, 0, size * 0.42, 0, size * 0.6, size * 0.84, size * 0.82, g, 11);
    cyl(M.soot, 0, size * 0.83, 0, size * 0.74, 0.012, size * 0.74, g, 11);
    for (let i = 0; i < leaves; i++) {
      const a = (i / leaves) * Math.PI * 2 + range(-0.3, 0.3),
        tip = range(1.2, 2.2) * size,
        spread = size * range(0.6, 1.35);
      const l = kit.leaf(
        i % 2 ? M.leaf : M.leafPale,
        Math.cos(a) * size * 0.2,
        size * 0.84,
        Math.sin(a) * size * 0.2,
        size * 0.3,
        tip,
        g,
      );
      l.rotation.set(Math.sin(a) * (spread / tip), -a + Math.PI / 2, -Math.cos(a) * (spread / tip), "YXZ");
      l.castShadow = false;
    }
    return g;
  }
  function vase(x, y, z, colours = ["#e9c54f", "#f1ead0", "#c56b6b"], p = base, glaze = M.willow) {
    const g = group(x, y, z, 0, p);
    cyl(glaze, 0, 0.055, 0, 0.032, 0.11, 0.045, g, 9);
    for (let i = 0; i < 7; i++) {
      const a = i * 2.2,
        top = [Math.cos(a) * 0.055, 0.17 + (i % 3) * 0.02, Math.sin(a) * 0.055];
      beam(M.apple, [0, 0.1, 0], top, 0.005, g);
      dot(mat(colours[i % colours.length], 0.82), ...top, 0.022, 0.018, 0.022, g);
    }
    return g;
  }

  // --------------------------------------------------------------- the table
  function cup(x, y, z, turn = 0, p = base, china = M.china) {
    const g = group(x, y, z, turn, p);
    cyl(china, 0, 0.005, 0, 0.042, 0.01, 0.066, g, 12);
    cyl(china, 0, 0.038, 0, 0.026, 0.05, 0.04, g, 11);
    cyl(mat("#7a4a22", 0.15), 0, 0.058, 0, 0.034, 0.002, 0.034, g, 10);
    const h = torus(china, 0.044, 0.04, 0, 0.012, 0.003, g, Math.PI * 1.1);
    h.rotation.z = -Math.PI * 0.55;
    return g;
  }
  function plate(x, y, z, r = 0.115, china = M.china, p = base, rim = M.willow) {
    cyl(china, x, y + 0.006, z, r * 0.62, 0.012, r, p, 18);
    if (rim) {
      const o = torus(rim, x, y + 0.012, z, r * 0.84, 0.0035, p);
      o.rotation.x = Math.PI / 2;
    }
  }
  function cutlery(x, y, z, turn, p = base) {
    const g = group(x, y, z, turn, p);
    box(M.silver, -0.15, 0.003, 0, 0.012, 0.004, 0.17, 0, g);
    for (const f of [-1, 0, 1]) box(M.silver, -0.15 + f * 0.006, 0.003, -0.095, 0.003, 0.004, 0.03, 0, g);
    box(M.silver, 0.15, 0.003, 0, 0.012, 0.004, 0.18, 0, g);
    box(M.silver, 0.15, 0.003, -0.075, 0.02, 0.004, 0.06, 0, g);
    return g;
  }
  // One guest's place at table, looking along local -z from its edge.
  function place(x, y, z, turn, napkin = M.ginghamBlue, p = base) {
    const g = group(x, y, z, turn, p);
    plate(0, 0, 0, 0.11, M.china, g);
    plate(-0.2, 0, -0.1, 0.066, M.china, g);
    cutlery(0, 0, 0, 0, g);
    cup(0.2, 0, -0.1, 0.5, g);
    box(napkin, 0, 0.028, 0, 0.1, 0.03, 0.05, 0.004, g);
    return g;
  }
  function teapot(x, y, z, china = M.willow, turn = 0, p = base) {
    const g = group(x, y, z, turn, p);
    orb(china, 0, 0.075, 0, 0.083, 0.075, 0.083, g);
    cyl(china, 0, 0.14, 0, 0.042, 0.016, 0.052, g, 11);
    dot(china, 0, 0.158, 0, 0.012, 0.012, 0.012, g);
    beam(china, [0.07, 0.07, 0], [0.13, 0.12, 0], 0.014, g);
    const h = torus(china, -0.08, 0.08, 0, 0.038, 0.007, g, Math.PI);
    h.rotation.z = Math.PI / 2;
    return g;
  }
  function jamJar(x, y, z, fruit = "#7a2f3d", label = true, p = base) {
    const g = group(x, y, z, range(-0.5, 0.5), p);
    cyl(mat(fruit, 0.22), 0, 0.045, 0, 0.032, 0.09, 0.032, g, 10);
    cyl(M.linen, 0, 0.098, 0, 0.036, 0.012, 0.038, g, 10);
    if (label) box(M.ivory, 0, 0.044, 0.032, 0.036, 0.03, 0.002, 0, g);
    return g;
  }
  function toastRack(x, y, z, turn = 0, slices = 4, p = base) {
    const g = group(x, y, z, turn, p);
    box(M.silver, 0, 0.004, 0, 0.1, 0.006, 0.17, 0, g);
    for (let i = 0; i < 6; i++) {
      const zz = -0.075 + i * 0.03;
      const a = torus(M.silver, 0, 0.045, zz, 0.04, 0.002, g, Math.PI);
      a.rotation.y = 0;
      if (i < slices) box(mat("#c99a5b", 0.95), 0, 0.058, zz + 0.015, 0.082, 0.094, 0.008, 0, g);
    }
    return g;
  }
  function eggCup(x, y, z, p = base) {
    cyl(M.china, x, y + 0.008, z, 0.024, 0.016, 0.018, p, 9);
    cyl(M.china, x, y + 0.03, z, 0.016, 0.028, 0.026, p, 9);
    dot(mat("#d9b98f", 0.7), x, y + 0.058, z, 0.022, 0.03, 0.022, p);
  }
  function cruet(x, y, z, p = base) {
    cyl(M.china, x - 0.025, y + 0.03, z, 0.016, 0.06, 0.012, p, 7);
    dot(M.silver, x - 0.025, y + 0.064, z, 0.012, 0.01, 0.012, p);
    cyl(M.black, x + 0.025, y + 0.03, z, 0.016, 0.06, 0.012, p, 7);
    dot(M.silver, x + 0.025, y + 0.064, z, 0.012, 0.01, 0.012, p);
  }
  function milkJug(x, y, z, china = M.china, p = base) {
    cyl(china, x, y + 0.04, z, 0.03, 0.08, 0.036, p, 10);
    cyl(M.white, x, y + 0.081, z, 0.027, 0.002, 0.027, p, 10);
    const h = torus(china, x + 0.038, y + 0.045, z, 0.018, 0.004, p, Math.PI);
    h.rotation.z = -Math.PI / 2;
  }
  function tableCard(text, x, y, z, turn = 0, p = base) {
    const cell = sheet.cell(96, 64, (c, w, h) => {
      c.fillStyle = "#f6efdc";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#3f4b3e";
      c.font = "italic 30px Georgia";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(text, w / 2, h / 2 + 2);
    });
    const g = group(x, y, z, turn, p);
    sheetPlane(cell, 0, 0.026, 0.002, 0.08, 0.05, 0, g);
    box(M.ivory, 0, 0.026, -0.002, 0.08, 0.05, 0.002, 0, g);
    return g;
  }
  // ------------------------------------------------------------------- beds
  function pillow(x, y, z, w, turn = 0, cover = M.linen, p = base) {
    const g = group(x, y, z, turn, p);
    orb(cover, 0, 0, 0, w / 2, 0.075, 0.2, g);
    return g;
  }
  function bed(piece, { quilt, foot, headboard = "oak", pillows = 2, width = piece.w, turn = 0, p = base }) {
    const g = group(piece.x, 0, piece.z, turn, p),
      w = width,
      l = piece.d,
      top = 0.5;
    // Base and legs: the head is at -z.
    box(M.darkOak, 0, 0.2, 0, w, 0.14, l, 0.008, g);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(M.darkOak, (a * w) / 2 - a * 0.04, 0.07, (b * l) / 2 - b * 0.04, 0.06, 0.14, 0.06, 0, g);
    box(M.linen, 0, 0.36, 0, w - 0.04, 0.18, l - 0.05, 0.04, g);
    // The quilt hangs down each side and over the foot.
    const qStart = -l / 2 + 0.56,
      qLength = l - 0.56;
    kit.box(quilt, 0, top - 0.015, qStart + qLength / 2, w + 0.06, 0.065, qLength + 0.02, 0.03, g);
    for (const s of [-1, 1]) box(quilt, (s * (w + 0.065)) / 2, 0.31, qStart + qLength / 2, 0.016, 0.33, qLength + 0.02, 0, g);
    box(quilt, 0, 0.31, l / 2 + 0.024, w + 0.08, 0.33, 0.016, 0, g);
    // The sheet turned back over the quilt.
    box(M.white, 0, top + 0.022, qStart + 0.14, w + 0.05, 0.014, 0.3, 0.006, g);
    for (let i = 0; i < pillows; i++) {
      const across = pillows === 1 ? 0 : (i ? 1 : -1) * (w / 4 - 0.01);
      pillow(across, top + 0.05, -l / 2 + 0.27, w / pillows - 0.08, 0, M.linen, g);
      pillow(across + 0.01, top + 0.15, -l / 2 + 0.24, w / pillows - 0.12, 0, M.white, g).rotation.x = -0.36;
    }
    if (foot) box(foot, 0, top + 0.05, l / 2 - 0.34, w + 0.04, 0.05, 0.46, 0.012, g);
    // A folded towel and a wrapped soap on the foot, because they always are.
    box(M.white, 0, top + 0.1, l / 2 - 0.36, 0.32, 0.05, 0.22, 0.012, g);
    box(M.sage, 0, top + 0.14, l / 2 - 0.37, 0.26, 0.03, 0.18, 0.008, g);
    box(M.butter, 0, top + 0.165, l / 2 - 0.38, 0.08, 0.02, 0.05, 0.004, g);
    if (headboard === "brass") {
      for (const s of [-1, 1]) {
        cyl(M.brass, (s * w) / 2, 0.55, -l / 2 + 0.005, 0.018, 1.1, 0.018, g, 8);
        dot(M.brass, (s * w) / 2, 1.13, -l / 2 + 0.005, 0.033, 0.033, 0.033, g);
        cyl(M.brass, (s * w) / 2, 0.3, l / 2 - 0.005, 0.016, 0.6, 0.016, g, 8);
        dot(M.brass, (s * w) / 2, 0.62, l / 2 - 0.005, 0.028, 0.028, 0.028, g);
      }
      const rail = cyl(M.brass, 0, 1.06, -l / 2 + 0.005, 0.014, w, 0.014, g, 7);
      rail.rotation.z = Math.PI / 2;
      const low = cyl(M.brass, 0, 0.72, -l / 2 + 0.005, 0.01, w, 0.01, g, 7);
      low.rotation.z = Math.PI / 2;
      for (let i = 1; i < 7; i++) {
        const xx = -w / 2 + (i / 7) * w;
        cyl(M.brass, xx, 0.89, -l / 2 + 0.005, 0.008, 0.34, 0.008, g, 6);
      }
      const foot2 = cyl(M.brass, 0, 0.52, l / 2 - 0.005, 0.012, w, 0.012, g, 7);
      foot2.rotation.z = Math.PI / 2;
    } else {
      box(M.oak, 0, 0.56, -l / 2 + 0.01, w + 0.02, 0.92, 0.04, 0.006, g);
      box(M.darkOak, 0, 1.03, -l / 2 + 0.01, w + 0.08, 0.04, 0.06, 0.006, g);
      for (const s of [-1, 1]) box(M.darkOak, (s * (w + 0.02)) / 2, 0.5, -l / 2 + 0.01, 0.05, 1, 0.05, 0, g);
    }
    return g;
  }
  function bedside(piece, { p = base, book = true, lampOn = true } = {}) {
    const g = group(piece.x, 0, piece.z, 0, p),
      w = piece.w,
      d = piece.d,
      h = 0.58;
    box(M.oak, 0, h, 0, w, 0.024, d, 0.006, g);
    box(M.oak, 0, 0.3, -d / 2 + 0.012, w - 0.02, 0.54, 0.016, 0, g);
    for (const s of [-1, 1]) box(M.oak, (s * (w - 0.02)) / 2, h / 2, 0, 0.018, h, d - 0.01, 0, g);
    box(M.oak, 0, 0.22, 0, w - 0.03, 0.016, d - 0.03, 0, g);
    box(M.darkOak, 0, 0.44, d / 2 - 0.005, w - 0.05, 0.13, 0.016, 0, g);
    dot(M.brass, 0, 0.44, d / 2 + 0.012, 0.012, 0.012, 0.012, g);
    for (const s of [-1, 1]) box(M.oak, (s * (w - 0.06)) / 2, 0.05, (d - 0.06) / 2, 0.03, 0.1, 0.03, 0, g);
    if (book) box(mat("#7a3e3a", 0.8), -0.08, h + 0.03, 0.08, 0.13, 0.03, 0.19, 0.003, g);
    if (lampOn) lamp(0.08, h + 0.012, -0.04, { height: 0.26, r: 0.11, p: g });
    return g;
  }
  function chest(x, z, w, d, h, turn = 0, drawers = 3, wood = M.oak, p = base) {
    const g = group(x, 0, z, turn, p);
    box(wood, 0, h / 2 + 0.05, 0, w, h - 0.1, d, 0, g);
    box(wood, 0, h, 0, w + 0.03, 0.026, d + 0.03, 0.006, g);
    const step = (h - 0.14) / drawers;
    for (let i = 0; i < drawers; i++) {
      const y = 0.1 + step * (i + 0.5);
      box(M.darkOak, 0, y, d / 2 + 0.004, w - 0.04, step - 0.018, 0.012, 0, g);
      for (const s of [-1, 1]) dot(M.brass, s * w * 0.26, y, d / 2 + 0.016, 0.014, 0.014, 0.014, g);
    }
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(wood, (a * w) / 2 - a * 0.03, 0.04, (b * d) / 2 - b * 0.03, 0.04, 0.08, 0.04, 0, g);
    return g;
  }
  function rug(x, z, w, d, m, { turn = 0, fringe = true, y = 0.008, p = base } = {}) {
    const g = group(x, y, z, turn, p);
    const r = box(m, 0, 0, 0, w, 0.012, d, 0, g);
    r.castShadow = false;
    if (fringe)
      for (const s of [-1, 1]) {
        const f = box(M.cream, 0, -0.002, (s * (d + 0.05)) / 2, w, 0.006, 0.05, 0, g);
        f.castShadow = false;
      }
    return g;
  }
  // A folded stack of towels or sheets, each its own colour.
  function linenStack(x, y, z, w, d, colours, each = 0.045, p = base) {
    let at = y;
    for (const c of colours) {
      box(typeof c === "string" ? mat(c, 0.96) : c, x + range(-0.006, 0.006), at + each / 2, z + range(-0.006, 0.006), w, each - 0.002, d, 0.012, p);
      at += each;
    }
    return at;
  }
  function logs(x, y, z, count = 3, p = base) {
    for (let i = 0; i < count; i++) {
      const lg = cyl(M.darkOak, x + (i - (count - 1) / 2) * 0.11, y + 0.05 + (i % 2) * 0.03, z + (i % 2) * 0.02, 0.05, 0.42, 0.05, p, 7);
      lg.rotation.x = Math.PI / 2;
      lg.rotation.z = (i - 1) * 0.1;
    }
  }

  return {
    root, base, kit, keep, random, range, mat,
    box, cyl, orb, dot, group, beam, torus, slab, sheetPlane, picture, mirrorGlass, fuse,
    chair, table, clothOver, roundClothTable, armchair, bookRow, bookcase, lamp, pendant, potPlant, vase,
    cup, plate, cutlery, place, teapot, jamJar, toastRack, eggCup, cruet, milkJug, tableCard,
    pillow, bed, bedside, chest, rug, linenStack, logs,
    /** Bakes the room's static meshes; call once it is dressed. */
    finish(finishes) {
      root.traverse((o) => {
        if (o.isMesh && o.material.transparent) o.castShadow = o.receiveShadow = false;
      });
      for (const g of keep) g.traverse((o) => (o.castShadow = false));
      kit.paintFlat(keep, finishes);
      kit.bake(keep);
    },
  };
}

export const BOOK_COLOURS = [
  "#7a3e3a", "#3f5a70", "#55704f", "#a47f3e", "#6d4a5a", "#34424f", "#8f5a35", "#caa964",
  "#59463a", "#94a18a", "#b5805f", "#2f3d36", "#a55a4b", "#e0d2ac", "#47566b",
];
