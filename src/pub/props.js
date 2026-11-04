import * as T from "three";
import { caskGeometry } from "./parts.js";

// The furniture and small things both floors share: seats, tables, candles,
// tankards and casks. Each takes its storey `s`, the shared materials `m` and,
// where it matters, a parent group.

export function createProps(s, m) {
  const { box, cyl, torus, orb, bar, group, mesh, random, range } = s;

  function candle(x, y, z, p = s.root) {
    cyl(m.wax, x, y + 0.055, z, 0.016, 0.11, 0.015, p, 8);
    const flame = new T.Mesh(new T.ConeGeometry(0.012, 0.042, 6), m.candleGlow);
    flame.position.set(x, y + 0.135, z);
    flame.castShadow = flame.receiveShadow = false;
    p.add(flame);
    return flame;
  }

  function candlestick(x, y, z, metal = m.brass, p = s.root) {
    cyl(metal, x, y + 0.012, z, 0.055, 0.024, 0.05, p, 12);
    cyl(metal, x, y + 0.07, z, 0.012, 0.1, 0.012, p, 8);
    cyl(metal, x, y + 0.125, z, 0.03, 0.012, 0.03, p, 10);
    return candle(x, y + 0.13, z, p);
  }

  function tankard(x, y, z, turn = 0, metal = m.pewter, p = s.root) {
    const g = group(x, y, z, turn, p);
    cyl(metal, 0, 0.07, 0, 0.042, 0.14, 0.04, g, 12);
    cyl(s.mat("#f0e3c6", 0.82), 0, 0.142, 0, 0.037, 0.008, 0.037, g, 10);
    const handle = torus(metal, 0.048, 0.075, 0, 0.032, 0.007, g, Math.PI * 1.2);
    handle.rotation.z = -Math.PI * 0.6;
    return g;
  }

  function plate(x, y, z, r = 0.11, material = m.pewter, p = s.root) {
    cyl(material, x, y + 0.007, z, r * 0.62, 0.014, r, p, 18);
  }

  // A plate with supper on it, one of a few kinds.
  function supper(x, y, z, kind, p = s.root) {
    plate(x, y, z, 0.115, m.pewter, p);
    const top = y + 0.02;
    if (kind === 0) {
      // A wedge of pie and a heel of bread.
      orb(s.mat("#c58a45", 0.85), x - 0.02, top + 0.028, z, 0.065, 0.032, 0.05, p);
      orb(s.mat("#d69c54", 0.85), x + 0.052, top + 0.018, z + 0.03, 0.035, 0.022, 0.03, p);
    } else if (kind === 1) {
      // Stew, a wooden spoon resting in it.
      cyl(s.mat("#7d5a3a", 0.8), x, top + 0.024, z, 0.056, 0.048, 0.075, p, 14);
      cyl(s.mat("#8a4f2c", 0.5), x, top + 0.049, z, 0.066, 0.004, 0.066, p, 14);
      bar(m.oakWarm, [x + 0.02, top + 0.05, z], [x + 0.11, top + 0.09, z + 0.03], 0.012, 0.006, p);
    } else {
      // Cheese, an apple and a sprig.
      box(s.mat("#e4c26f", 0.8), x - 0.02, top + 0.026, z - 0.01, 0.075, 0.05, 0.05, 0.006, p);
      orb(s.mat("#b6523a", 0.45), x + 0.05, top + 0.03, z + 0.03, 0.03, 0.03, 0.03, p);
      orb(s.mat("#d9b45f", 0.8), x - 0.045, top + 0.024, z + 0.05, 0.028, 0.018, 0.022, p);
    }
  }

  function bread(x, y, z, r = 0.14, turn = 0, p = s.root) {
    const loaf = orb(s.mat("#c98b45", 0.86), x, y + r * 0.42, z, r, r * 0.5, r * 0.72, p);
    loaf.rotation.y = turn;
    box(s.mat("#7d5a3a", 0.75), x, y + 0.008, z, r * 2.3, 0.016, r * 1.7, 0.005, p).rotation.y = turn;
  }

  function stool(x, z, y = 0, seat = 0.46, r = 0.15, p = s.root) {
    cyl(m.oakWarm, x, y + seat, z, r, 0.045, r, p, 16);
    for (let i = 0; i < 3; i++) {
      const a = i * 2.094 + 0.4;
      s.bar(m.oakDark, [x + Math.cos(a) * r * 0.5, y + seat - 0.02, z + Math.sin(a) * r * 0.5], [x + Math.cos(a) * r * 0.95, y, z + Math.sin(a) * r * 0.95], 0.03, 0.03, p);
    }
    if (seat > 0.6) {
      // A rung for your boots at the taller bar stools.
      torus(m.oakDark, x, y + seat * 0.38, z, r * 0.82, 0.011, p).rotation.x = Math.PI / 2;
    }
  }

  // A joined chair, its back to local -z.
  function chair(x, z, rotation = 0, y = 0, p = s.root) {
    const g = group(x, y, z, rotation, p),
      w = 0.46;
    box(m.oakWarm, 0, 0.46, 0, w, 0.04, 0.42, 0.012, g);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
      box(m.oakDark, (dx * w) / 2 - dx * 0.03, 0.22, (dz * 0.42) / 2 - dz * 0.03, 0.05, 0.46, 0.05, 0.008, g);
    for (const dx of [-1, 1]) box(m.oakDark, (dx * w) / 2 - dx * 0.03, 0.76, -0.18, 0.05, 0.6, 0.05, 0.008, g);
    box(m.oakWarm, 0, 1.02, -0.18, w, 0.11, 0.04, 0.01, g);
    box(m.oakWarm, 0, 0.74, -0.18, w - 0.04, 0.075, 0.03, 0.008, g);
    box(m.oakDark, 0, 0.12, 0, w - 0.06, 0.03, 0.03, 0.006, g);
    return g;
  }

  // A plain bench, along local x.
  function bench(x, z, length, rotation = 0, y = 0, p = s.root) {
    const g = group(x, y, z, rotation, p);
    box(m.oakWarm, 0, 0.45, 0, length, 0.055, 0.3, 0.012, g);
    for (const dx of [-1, 1]) {
      box(m.oakDark, (dx * length) / 2 - dx * 0.15, 0.21, 0, 0.055, 0.42, 0.25, 0.01, g);
    }
    box(m.oakDark, 0, 0.26, 0, length - 0.36, 0.05, 0.03, 0.006, g);
    return g;
  }

  // A high-backed settle: panelled back, solid ends, a long seat, facing +z.
  function settle(x, z, length, rotation = 0, y = 0, p = s.root) {
    const g = group(x, y, z, rotation, p),
      back = 1.5;
    box(m.oakDark, 0, back / 2, -0.24, length, back, 0.05, 0.008, g);
    const panels = Math.round(length / 0.42);
    for (let i = 0; i < panels; i++) {
      const u = -length / 2 + ((i + 0.5) * length) / panels;
      box(m.oakWarm, u, 0.98, -0.21, length / panels - 0.08, 0.76, 0.018, 0.005, g);
    }
    box(m.oakWarm, 0, back + 0.015, -0.24, length + 0.1, 0.04, 0.12, 0.01, g);
    box(m.oakWarm, 0, 0.45, -0.02, length, 0.05, 0.46, 0.012, g);
    for (const dx of [-1, 1]) {
      const u = (dx * length) / 2;
      box(m.oakDark, u, back / 2 - 0.25, -0.05, 0.055, back - 0.5, 0.42, 0.01, g);
      box(m.oakWarm, u, 0.72, 0.06, 0.07, 0.05, 0.42, 0.012, g);
    }
    // A thin wool cushion the length of the seat.
    box(s.mat("#7d4a3e", 0.97), 0, 0.5, -0.02, length - 0.12, 0.05, 0.42, 0.018, g);
    return g;
  }

  function roundTable(x, z, r = 0.6, y = 0, p = s.root) {
    cyl(m.tabletop, x, y + 0.74, z, r, 0.05, r, p, 28);
    torus(m.oakDark, x, y + 0.72, z, r * 0.98, 0.012, p).rotation.x = Math.PI / 2;
    cyl(m.oakDark, x, y + 0.38, z, 0.07, 0.66, 0.07, p, 10);
    for (let i = 0; i < 3; i++) {
      const a = i * 2.094;
      s.bar(m.oakDark, [x, y + 0.08, z], [x + Math.cos(a) * r * 0.62, y + 0.02, z + Math.sin(a) * r * 0.62], 0.05, 0.05, p);
    }
  }

  // A long trestle: thick planks on two carved trestles, a stretcher between.
  function trestleTable(x, z, length, width, y = 0, p = s.root) {
    const g = group(x, y, z, 0, p),
      planks = 3,
      plankW = width / planks;
    for (let i = 0; i < planks; i++)
      box(m.tabletop, 0, 0.76, -width / 2 + plankW * (i + 0.5), length, 0.065, plankW - 0.005, 0.008, g);
    for (const dx of [-1, 1]) {
      const u = (dx * length) / 2 - dx * 0.34;
      box(m.oakDark, u, 0.37, 0, 0.1, 0.66, width * 0.28, 0.012, g);
      box(m.oakDark, u, 0.03, 0, 0.13, 0.06, width * 0.86, 0.012, g);
      box(m.oakDark, u, 0.71, 0, 0.11, 0.05, width * 0.86, 0.012, g);
    }
    box(m.oakDark, 0, 0.34, 0, length - 0.7, 0.09, 0.06, 0.008, g);
    return g;
  }

  // An oak-hooped cask along local +Y; `axis` "x" lays it down.
  function cask(x, y, z, r, length, axis = "y", p = s.root, wood = m.oakWarm) {
    const o = mesh(caskGeometry(r, length), wood, x, y, z, p);
    const g = group(x, y, z, 0, p);
    if (axis === "x") {
      o.rotation.z = Math.PI / 2;
      g.rotation.z = Math.PI / 2;
    } else if (axis === "z") {
      o.rotation.x = Math.PI / 2;
      g.rotation.x = Math.PI / 2;
    }
    for (const t of [-0.42, -0.2, 0.2, 0.42]) {
      const bulge = 0.78 + 0.22 * Math.sin((t + 0.5) * Math.PI);
      const hoop = torus(m.iron, 0, t * length, 0, r * bulge + 0.004, 0.009, g);
      hoop.rotation.x = Math.PI / 2;
    }
    return o;
  }

  // Bottles, jugs and crocks for shelves.
  function bottle(x, y, z, kind = 0, p = s.root) {
    const material = kind % 2 ? m.bottleBrown : m.bottleGreen;
    cyl(material, x, y + 0.085, z, 0.034, 0.17, 0.034, p, 10);
    cyl(material, x, y + 0.2, z, 0.015, 0.07, 0.03, p, 8);
    cyl(s.mat("#8f6a43", 0.9), x, y + 0.245, z, 0.015, 0.025, 0.015, p, 6);
  }

  function jug(x, y, z, colour = "#c9b892", p = s.root) {
    const glaze = s.mat(colour, 0.42);
    const profile = [
      [0.001, 0], [0.05, 0], [0.075, 0.05], [0.082, 0.1], [0.068, 0.15], [0.048, 0.19], [0.056, 0.24], [0.001, 0.24],
    ].map(([a, b]) => new T.Vector2(a, b));
    mesh(new T.LatheGeometry(profile, 14), glaze, x, y, z, p);
    const handle = torus(glaze, x + 0.075, y + 0.14, z, 0.05, 0.01, p, Math.PI * 1.1);
    handle.rotation.z = -Math.PI * 0.55;
  }

  // A hop bine: a twine, thick with soft leaves and pale cones, along points.
  function hops(points, p = s.root) {
    const leaves = [s.mat("#6f8a4d", 0.85), s.mat("#7f9a57", 0.85), s.mat("#5d7843", 0.85)],
      cones = s.mat("#c3c784", 0.8);
    const curve = new T.CatmullRomCurve3(points.map((q) => new T.Vector3(...q)));
    s.tube(s.mat("#5a4a2e", 0.9), points, 0.008, p).castShadow = false;
    const length = curve.getLength(),
      count = Math.round(length * 26),
      leaf = new T.SphereGeometry(1, 6, 4);
    for (let i = 0; i < count; i++) {
      const at = curve.getPointAt(i / count);
      const o = mesh(leaf, leaves[i % 3], at.x + range(-0.07, 0.07), at.y + range(-0.08, 0.04), at.z + range(-0.07, 0.07), p);
      o.scale.set(range(0.03, 0.05), range(0.009, 0.014), range(0.024, 0.04));
      o.rotation.set(random() * 2.4 - 1.2, random() * 6, random() * 2.4 - 1.2);
      o.castShadow = false;
      if (i % 4 === 0) {
        const c = mesh(leaf, cones, at.x + range(-0.05, 0.05), at.y - range(0.05, 0.12), at.z + range(-0.05, 0.05), p);
        c.scale.set(0.017, 0.03, 0.017);
        c.castShadow = false;
      }
    }
  }

  // Wrought-iron wheel chandelier: `n` candles round a hoop, hung from `top`.
  function chandelier(x, y, z, top, r = 0.62, n = 8) {
    const flames = [];
    torus(m.iron, x, y, z, r, 0.018, undefined).rotation.x = Math.PI / 2;
    torus(m.iron, x, y + 0.12, z, r * 0.34, 0.012, undefined).rotation.x = Math.PI / 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2,
        cx = x + Math.cos(a) * r,
        cz = z + Math.sin(a) * r;
      bar(m.iron, [x, y, z], [cx, y, cz], 0.012, 0.012);
      cyl(m.iron, cx, y + 0.02, cz, 0.04, 0.012, 0.03, undefined, 8);
      flames.push(candle(cx, y + 0.025, cz));
      if (i % 2 === 0) bar(m.iron, [x, y + 0.36, z], [cx, y + 0.02, cz], 0.008, 0.008);
    }
    bar(m.iron, [x, y, z], [x, top, z], 0.02, 0.02);
    orb(m.iron, x, y, z, 0.05, 0.05, 0.05);
    return flames;
  }

  return {
    candle, candlestick, tankard, plate, supper, bread, stool, chair, bench, settle,
    roundTable, trestleTable, cask, bottle, jug, hops, chandelier,
  };
}
