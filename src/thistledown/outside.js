import * as T from "three";
import { createParts } from "./parts.js";

// What the windows look out on: the lane to the front, side lawns with a hedge
// and an apple tree, and the back garden with its beans, hens and very white
// sheets. Nothing out here is walked on, so it is built to be seen from indoors.

export function buildOutside(M, sheet) {
  const P = createParts("outside", M, sheet);
  const { box, cyl, orb, group, slab, mat, keep, random, range } = P;

  slab(M.grass, -48, 48, -0.3, -0.12, -48, 48, 2.2, { shadow: false }).castShadow = false;

  // The flagged path from the front door to the gate, and the lane beyond it.
  slab(M.flags, -0.75, 0.75, -0.14, -0.1, 5, 9.5, 1.3, { shadow: false, alongZ: true });
  slab(mat("#b9a57e", 0.95), -48, 48, -0.14, -0.1, 10.3, 13.3, 1.3, { shadow: false });
  // A picket fence along the lane, with the gate standing open, and beds below.
  const fence = mat("#f0eadb", 0.7);
  box(fence, -5.25, 0.45, 9.7, 8.9, 0.05, 0.03);
  box(fence, -5.25, 0.25, 9.7, 8.9, 0.05, 0.03);
  box(fence, 5.25, 0.45, 9.7, 8.9, 0.05, 0.03);
  box(fence, 5.25, 0.25, 9.7, 8.9, 0.05, 0.03);
  for (let x = -9.6; x < 9.7; x += 0.2) {
    if (Math.abs(x) < 0.8) continue;
    box(fence, x, 0.3, 9.72, 0.08, 0.72, 0.016);
  }
  for (const s of [-1, 1]) box(M.darkOak, s * 0.82, 0.5, 9.7, 0.11, 1.04, 0.11);
  const bloom = ["#e9c54f", "#d6a0c0", "#efe7d6", "#c8413a", "#8e7aa0", "#efb65a"].map((c) => mat(c, 0.82));
  const clump = (x, z, r, n = 9) => {
    orb(M.apple, x, 0.05, z, r, r * 0.65, r);
    for (let i = 0; i < n; i++) {
      const a = random() * Math.PI * 2,
        rr = r * random();
      P.dot(bloom[Math.floor(random() * bloom.length)], x + Math.cos(a) * rr, 0.14 + random() * 0.18, z + Math.sin(a) * rr, 0.036, 0.03, 0.036);
    }
  };
  for (const s of [-1, 1])
    for (let i = 0; i < 9; i++) {
      clump(s * (1.2 + i * 0.5), 5.4 + (i % 2) * 0.25, 0.26);
      clump(s * (1.1 + (i % 3) * 0.4), 6.2 + i * 0.4, 0.2, 6);
      clump(s * (1.4 + i * 0.9), 9.1, 0.32, 10);
    }

  // Green hedges right round the plot, thick enough to end the view.
  const hedge = mat("#3f6238", 0.92),
    hedgeDark = mat("#355733", 0.92);
  const hedgeRun = (x0, z0, x1, z1, h = 1.5) => {
    const length = Math.hypot(x1 - x0, z1 - z0),
      n = Math.round(length / 0.5);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      P.dot(i % 3 ? hedge : hedgeDark, x0 + (x1 - x0) * t + range(-0.2, 0.2), h * range(0.32, 0.58), z0 + (z1 - z0) * t + range(-0.2, 0.2), range(0.42, 0.72), h * range(0.34, 0.52), range(0.42, 0.72));
    }
  };
  hedgeRun(-12, -16, -12, 9.4);
  hedgeRun(12, -16, 12, 9.4);
  hedgeRun(-12, -16, 12, -16, 1.8);
  hedgeRun(-40, 14.2, 40, 14.2, 1.6);
  // Fields rising beyond the lane and the back hedge, with far trees.
  const hill = mat("#74894f", 0.98),
    farHill = mat("#84996f", 0.98);
  for (const [x, z, a, b, m] of [
    [-22, 34, 30, 7, hill],
    [20, 37, 34, 9, farHill],
    [4, -40, 40, 12, hill],
    [-30, -36, 26, 8, farHill],
    [-46, 2, 16, 8, farHill],
    [46, 6, 16, 8, farHill],
  ])
    orb(m, x, -1, z, a, b, 14);
  const tree = (x, z, s = 1) => {
    const g = group(x, -0.12, z, range(0, 6)),
      leaf = mat(["#4c6d40", "#587a44", "#416238"][Math.floor(random() * 3)], 0.86);
    cyl(M.darkOak, 0, 0.9 * s, 0, 0.11 * s, 1.8 * s, 0.07 * s, g, 8);
    orb(leaf, 0, 2.35 * s, 0, 0.82 * s, 0.76 * s, 0.82 * s, g);
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9 + range(-0.2, 0.2),
        lobe = range(0.46, 0.72) * s;
      orb(leaf, Math.cos(a) * 0.72 * s, range(1.85, 2.75) * s, Math.sin(a) * 0.72 * s, lobe, lobe * 0.9, lobe, g);
    }
    return g;
  };
  tree(-8.6, 2.5, 1.25);
  tree(8.8, 3, 1.1);
  tree(9, -8, 1.3);
  tree(-9, -9, 1.2);
  for (const [x, z, s] of [[-16, 18, 1.6], [6, 19, 1.8], [18, 17, 1.5], [-5, 26, 2], [-30, 22, 2.2], [30, 25, 2.2], [-22, -22, 2], [10, -24, 2.2], [24, -20, 1.6], [-32, -6, 2.2], [32, -4, 2.4]]) tree(x, z, s);
  // Apples on the nearest tree, and a blue bench in its shade.
  for (let i = 0; i < 14; i++) {
    const a = i * 1.9;
    P.dot(mat("#b6432f", 0.5), -8.6 + Math.cos(a) * 1.05, 2.3 + Math.sin(i) * 0.7, 2.5 + Math.sin(a) * 1.05, 0.055);
  }
  const bench = group(-8.2, -0.12, 0.4, 0.7);
  box(mat("#5f82ad", 0.6), 0, 0.42, 0, 1.3, 0.04, 0.38, 0, bench);
  box(mat("#5f82ad", 0.6), 0, 0.72, -0.18, 1.3, 0.5, 0.03, 0, bench);
  for (const s of [-1, 1]) box(mat("#5f82ad", 0.6), s * 0.6, 0.21, 0, 0.05, 0.42, 0.36, 0, bench);

  // The back garden: a washing line of sheets that stir, the beans and the hens.
  const washing = group(-3.2, -0.12, -9.5);
  for (const s of [-1, 1]) {
    cyl(M.oak, s * 3, 1.15, 0, 0.04, 2.3, 0.035, washing, 7);
  }
  box(M.black, 0, 2.2, 0, 6, 0.012, 0.012, 0, washing);
  const sheets = group(0, 2.2, 0, 0, washing);
  keep.add(sheets);
  const linen = mat("#fbfaf4", 0.96).clone();
  linen.side = T.DoubleSide;
  const moving = [];
  for (const [x, w, h] of [[-2.1, 1.2, 1.3], [-0.5, 1.5, 1.45], [1.2, 1.2, 1.25], [2.4, 0.5, 0.7]]) {
    const geo = new T.PlaneGeometry(w, h, 8, 3);
    geo.translate(0, -h / 2, 0);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 4) * 0.05);
    geo.computeVertexNormals();
    const m = new T.Mesh(geo, linen);
    m.position.x = x;
    sheets.add(m);
    moving.push(m);
    for (const k of [-0.46, 0.46]) box(M.oak, k * w, 0, 0.005, 0.03, 0.06, 0.03, 0, m);
  }
  // Bean rows up their canes.
  for (let row = 0; row < 3; row++) {
    const z = -6.6 - row * 1.1,
      x0 = 1.6;
    for (let i = 0; i < 9; i++) {
      const x = x0 + i * 0.5;
      P.beam(M.pine, [x - 0.08, -0.12, z - 0.14], [x, 1.7, z], 0.025);
      P.beam(M.pine, [x + 0.08, -0.12, z + 0.14], [x, 1.7, z], 0.025);
      for (let k = 0; k < 4; k++) P.dot(i % 2 ? M.apple : mat("#6f9154", 0.84), x + range(-0.12, 0.12), 0.25 + k * 0.38, z + range(-0.16, 0.16), 0.17, 0.2, 0.14);
    }
    box(mat("#6a4f39", 0.98), x0 + 2, -0.1, z, 4.8, 0.05, 0.6);
  }
  // The hen coop, and three hens with opinions.
  const coop = group(-3.8, -0.12, -12.6, 0.15);
  box(M.pine, 0, 0.72, 0, 1.6, 0.8, 1.1, 0, coop);
  box(mat("#7a5a44", 0.9), 0, 1.24, 0, 1.8, 0.1, 1.3, 0, coop).rotation.z = 0.28;
  for (const s of [-1, 1]) box(M.pine, s * 0.7, 0.16, 0, 0.1, 0.32, 1.1, 0, coop);
  box(M.black, 0, 0.6, 0.56, 0.34, 0.4, 0.01, 0, coop);
  const hen = (x, z, turn, tone) => {
    const g = group(x, -0.12, z, turn);
    orb(mat(tone, 0.95), 0, 0.2, 0, 0.14, 0.13, 0.2, g);
    orb(mat(tone, 0.95), 0, 0.34, 0.16, 0.07, 0.08, 0.07, g);
    P.dot(mat("#b5402f", 0.8), 0, 0.42, 0.16, 0.02, 0.03, 0.03, g);
    box(mat("#e0a93a", 0.8), 0, 0.33, 0.24, 0.03, 0.02, 0.04, 0, g);
    box(mat(tone, 0.95), 0, 0.28, -0.2, 0.05, 0.16, 0.1, 0, g);
    for (const s of [-1, 1]) box(mat("#c29a3a", 0.7), s * 0.05, 0.04, 0, 0.012, 0.1, 0.012, 0, g);
  };
  hen(-1.3, -10.6, 2.2, "#b0713f");
  hen(0.3, -9.9, -0.7, "#efe7d6");
  hen(-0.1, -11.2, 0.9, "#8d5a33");
  // The low sun comes over all of this, so none of it may stop it at the glass.
  M.grass.color.set("#9dab8c");
  P.root.traverse((o) => (o.castShadow = false));
  return { parts: P, sheets: moving };
}
