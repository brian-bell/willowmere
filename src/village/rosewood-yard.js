// Rosewood from outside, behind the cottage: a single-storey kitchen
// extension with a stable door, and a small fenced back garden with Bark's
// kennel, a washing line, a bird bath, a bench and his dig spot, a rose arch
// over the gate and borders along the fence. It matches the rooms inside
// (src/rosewood.js). Nothing here draws from the village's random stream, so
// it moves nothing else. Flowers, climbers and small hardware go into a fine
// mesh that hides zoomed far out (fine.js).

import { createFine } from "./fine.js";

// The extension's footprint and the patio by its door, where the village's
// grass is cleared (src/village/plants.js).
export const ROSEWOOD_YARD = {
  extension: { minX: -9.4, maxX: -4.6, minZ: -9.8, maxZ: -8.1 },
  patio: { minX: -6.2, maxX: -4.8, minZ: -10.6, maxZ: -9.8 },
  fence: { minX: -9.75, maxX: -4.25, minZ: -12.5, maxZ: -9.8 },
  // Flower borders inside the back fence, either side of Bark's dig spot,
  // and the herb trough under the kitchen window.
  borders: [
    { minX: -8.4, maxX: -7.8, minZ: -12.46, maxZ: -12.06 },
    { minX: -7.0, maxX: -5.7, minZ: -12.46, maxZ: -12.06 },
  ],
};

const inside = (b, x, z, pad = 0) =>
  x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad;

/** Whether the village's meadow grass may grow at (x, z). */
export const yardAllowsGrass = (x, z) =>
  !inside(ROSEWOOD_YARD.extension, x, z, 0.15) &&
  !inside(ROSEWOOD_YARD.patio, x, z, 0.1) &&
  !ROSEWOOD_YARD.borders.some((b) => inside(b, x, z, 0.05));

export function buildRosewoodYard(kit, { fence, contact }) {
  const { T, box, cyl, orb, beam, mat, label, colliders, ivory, stone, wood, darkWood, trim, roofBlue, glass, animate } = kit;
  const { extension: ext, fence: yard } = ROSEWOOD_YARD,
    fine = createFine(T, 2711),
    { k, plant, planters } = fine;
  const cx = (ext.minX + ext.maxX) / 2,
    cz = (ext.minZ + ext.maxZ) / 2,
    w = ext.maxX - ext.minX,
    d = ext.maxZ - ext.minZ;
  // The extension: a stone footing, cottage walls and a lean-to roof whose
  // tiles alternate two shades, as the main roof's do.
  box(stone, cx, 0.2, cz, w + 0.12, 0.4, d + 0.1);
  box(ivory, cx, 1.45, cz, w, 2.1, d);
  box(darkWood, cx, 2.5, ext.minZ - 0.02, w + 0.1, 0.12, 0.1);
  for (const x of [ext.minX + 0.06, ext.maxX - 0.06]) box(darkWood, x, 1.45, ext.minZ - 0.03, 0.12, 2.1, 0.1);
  const slope = -0.36,
    roofDepth = d + 0.55,
    roofY = 2.98,
    roofZ = cz - 0.2;
  const lean = box(roofBlue, cx, roofY, roofZ, w + 0.5, 0.1, roofDepth);
  lean.rotation.x = slope;
  const shade = mat("#6e8a91");
  const rows = 6;
  // Each row of tiles lies on the slab, rising with it toward the house.
  for (let r = 0; r < rows; r++) {
    const f = (r + 0.5) / rows - 0.5,
      z = roofZ + f * roofDepth * Math.cos(slope) + 0.075 * Math.sin(slope),
      y = roofY + 0.075 * Math.cos(slope) - f * roofDepth * Math.sin(slope);
    for (let c = 0; c < 11; c++) {
      const tile = box((r + c) % 3 ? roofBlue : shade, ext.minX - 0.2 + (c + 0.5) * ((w + 0.4) / 11), y, z, (w + 0.4) / 11 - 0.02, 0.05, roofDepth / rows + 0.04);
      tile.rotation.x = slope;
    }
  }
  // A gutter along the roof's low edge, its downpipe running to a water butt
  // by the washing line.
  const metal = mat("#5f6b68", 0.6),
    lowZ = roofZ - (roofDepth / 2) * Math.cos(slope) - 0.02,
    lowY = roofY + (roofDepth / 2) * Math.sin(slope) - 0.08;
  box(metal, cx, lowY, lowZ, w + 0.5, 0.08, 0.1);
  for (const x of [ext.minX - 0.25, ext.maxX + 0.25]) box(metal, x, lowY, lowZ, 0.04, 0.11, 0.13);
  const pipeX = ext.minX + 0.12,
    pipeZ = ext.minZ - 0.08;
  beam(metal, [pipeX, lowY - 0.02, lowZ], [pipeX, lowY - 0.3, pipeZ], 0.07);
  cyl(metal, pipeX, (lowY - 0.3 + 1.05) / 2, pipeZ, 0.04, lowY - 0.3 - 1.05);
  beam(metal, [pipeX, 1.07, pipeZ], [-9.02, 0.95, -10.1], 0.07);
  cyl(mat("#56705f"), -9.0, 0.45, -10.16, 0.26, 0.8);
  for (const y of [0.16, 0.72]) cyl(kit.darkStone, -9.0, y, -10.16, 0.275, 0.04);
  cyl(darkWood, -9.0, 0.87, -10.16, 0.28, 0.04);
  colliders.push({ x: -9.0, z: -10.16, r: 0.3 });
  // The range's stovepipe, puffing a little.
  cyl(darkWood, -8.8, 3.4, -9.0, 0.11, 1.0);
  cyl(darkWood, -8.8, 3.95, -9.0, 0.16, 0.1);
  const puff = orb(
    new T.MeshStandardMaterial({ color: "#d4d3be", transparent: true, opacity: 0.14, depthWrite: false }),
    -8.8,
    4.4,
    -9.0,
    0.2,
    0.26,
    0.2,
  );
  animate(-8.8, -9.0, (dt, t) => {
    puff.position.y = 4.4 + ((t * 0.3) % 1) * 0.6;
    puff.position.x = -8.8 + Math.sin(t * 0.7) * 0.08;
  });
  // The stable door, its top half open, and the window over the sink.
  const doorX = -5.5,
    face = ext.minZ - 0.04;
  box(darkWood, doorX, 1.32, face, 0.9, 1.84, 0.06);
  box(mat("#5e7d66"), doorX, 0.95, face - 0.03, 0.74, 0.95, 0.05);
  box(mat("#2b2724"), doorX, 1.88, face - 0.01, 0.72, 0.7, 0.04);
  box(stone, doorX, 0.12, face - 0.35, 1.1, 0.22, 0.55);
  box(darkWood, doorX, 2.3, face - 0.03, 1.1, 0.12, 0.12);
  k.box("#2f2a26", doorX - 0.2, 0.62, face - 0.06, 0.32, 0.04, 0.012);
  k.box("#2f2a26", doorX - 0.2, 1.3, face - 0.06, 0.32, 0.04, 0.012);
  k.ball("#c9a65a", doorX + 0.27, 1.05, face - 0.07, 0.035);
  k.box("#3a3430", doorX + 0.27, 0.82, face - 0.065, 0.06, 0.1, 0.012);
  // A lantern by the door, lit at blue hour.
  const lanternX = doorX + 0.68;
  box(darkWood, lanternX, 2.02, face - 0.08, 0.05, 0.05, 0.18);
  box(darkWood, lanternX, 1.88, face - 0.2, 0.17, 0.03, 0.17);
  box(glass, lanternX, 1.78, face - 0.2, 0.12, 0.17, 0.12);
  box(darkWood, lanternX, 1.68, face - 0.2, 0.17, 0.03, 0.17);
  const windowX = -7.9;
  box(darkWood, windowX, 1.75, face, 0.9, 0.72, 0.06);
  box(glass, windowX, 1.75, face - 0.03, 0.74, 0.56, 0.02);
  box(trim, windowX, 1.75, face - 0.05, 0.05, 0.56, 0.03);
  box(trim, windowX, 1.36, face - 0.12, 1.0, 0.06, 0.2);
  for (let i = 0; i < 3; i++) {
    cyl(mat("#b86f4f"), windowX - 0.25 + i * 0.25, 1.45, face - 0.12, 0.07, 0.12);
    orb(mat("#5f8a4a"), windowX - 0.25 + i * 0.25, 1.56, face - 0.12, 0.08, 0.07, 0.08);
  }
  // Shutters either side of the kitchen window.
  for (const side of [-1, 1]) {
    const sx = windowX + side * 0.62;
    box(mat("#5e7d66"), sx, 1.75, face - 0.02, 0.3, 0.74, 0.05);
    for (const yy of [-0.24, 0.24]) box(darkWood, sx, 1.75 + yy, face - 0.055, 0.26, 0.045, 0.02);
  }
  // A herb trough on legs below it.
  box(wood, windowX, 0.62, face - 0.3, 0.9, 0.22, 0.3);
  for (const dx of [-0.38, 0.38]) box(darkWood, windowX + dx, 0.26, face - 0.3, 0.05, 0.52, 0.05);
  colliders.push({ x: windowX, z: face - 0.3, w: 0.95, d: 0.35 });
  for (let i = 0; i < 4; i++)
    plant(["daisies", "lavender", "geranium", "lavender"][i], ["white", "lavender", "scarlet", "lilac"][i], windowX - 0.33 + i * 0.22, 0.71, face - 0.3, 0.11);
  for (let i = 0; i < 3; i++) planters.trail(windowX - 0.3 + i * 0.3, 0.72, face - 0.45, 0.28, planters.foliage.ivy, 0, -1);
  // A climbing rose between the window and the door.
  fine.climber(-6.55, face + 0.01, 0.5, 1.95, "rose");
  colliders.push({ x: cx, z: cz, w: w + 0.12, d: d + 0.1 });
  contact(cx, cz, w + 1.2, d + 1.2);
  // The patio by the door.
  for (let i = 0; i < 4; i++) {
    const flag = cyl(stone, doorX + (i % 2 ? 0.18 : -0.18), 0.03, face - 0.85 - i * 0.38, 0.2, 0.04);
    flag.scale.z = 0.16;
  }
  // The garden fence: three sides, with a gate gap on the east.
  fence(yard.minX, yard.maxZ, yard.minX, yard.minZ);
  fence(yard.minX, yard.minZ, yard.maxX, yard.minZ);
  fence(yard.maxX, yard.minZ, yard.maxX, -11.1);
  // Bark's kennel, with his name over the door.
  const kennel = new T.Group();
  kennel.position.set(-8.85, 0, -11.65);
  kennel.rotation.y = 0.25;
  kit.scene.add(kennel);
  box(mat("#d1b289"), 0, 0.3, 0, 0.62, 0.6, 0.58, kennel);
  for (const side of [-1, 1]) {
    const r = box(mat("#b86f4f"), side * 0.19, 0.72, 0, 0.44, 0.05, 0.66, kennel);
    r.rotation.z = -side * 0.72;
  }
  box(mat("#2b2724"), 0, 0.22, 0.29, 0.28, 0.36, 0.02, kennel);
  box(label("BARK", "#8a4b3a"), 0, 0.5, 0.3, 0.36, 0.09, 0.02, kennel);
  // Its gables closed, a ridge board, corner battens and a plinth.
  const gable = new T.Shape();
  gable.moveTo(-0.31, 0);
  gable.lineTo(0, 0.27);
  gable.lineTo(0.31, 0);
  gable.closePath();
  const gableGeometry = new T.ExtrudeGeometry(gable, { depth: 0.56, bevelEnabled: false });
  kit.mesh(gableGeometry, mat("#d1b289"), 0, 0.6, -0.28, 1, 1, 1, kennel);
  box(darkWood, 0, 0.89, 0, 0.07, 0.06, 0.72, kennel);
  for (const sx of [-0.3, 0.3]) for (const sz of [-0.28, 0.28]) box(mat("#b8966c"), sx, 0.3, sz, 0.05, 0.6, 0.05, kennel);
  box(mat("#a98b66"), 0, 0.03, 0, 0.7, 0.06, 0.66, kennel);
  colliders.push({ x: -8.85, z: -11.65, w: 0.7, d: 0.66 });
  contact(-8.85, -11.65, 1, 1);
  // His bowls and a bone by the kennel.
  for (const [x, z, c] of [
    [-8.25, -11.2, "#c9473e"],
    [-8.05, -11.42, "#5f86b8"],
  ]) {
    k.cyl(c, x, 0.05, z, 0.11, 0.08);
    k.cyl(c === "#c9473e" ? "#8a5a3a" : "#8fc6d8", x, 0.09, z, 0.09, 0.01);
  }
  k.box("#efe6d2", -8.45, 0.03, -10.95, 0.16, 0.035, 0.035, 0.6);
  for (const e of [-1, 1]) k.ball("#efe6d2", -8.45 + e * 0.074, 0.035, -10.95 - e * 0.047, 0.03);
  // The washing line along the west fence, with Bark's red jumper.
  for (const z of [-10.15, -11.15]) {
    beam(darkWood, [-9.45, 0, z], [-9.45, 1.5, z], 0.05);
    colliders.push({ x: -9.45, z, r: 0.08 });
  }
  beam(mat("#e8e0cc"), [-9.45, 1.45, -10.15], [-9.45, 1.45, -11.15], 0.01);
  for (const [z, h, c] of [
    [-10.4, 0.42, "#f4efe4"],
    [-10.72, 0.32, "#d98b86"],
    [-10.96, 0.16, "#c9473e"],
  ])
    box(mat(c), -9.45, 1.45 - h / 2, z, 0.015, h, h > 0.3 ? 0.3 : 0.16);
  // A bird bath, a bench against the back fence, and the dig spot.
  cyl(stone, -6.6, 0.25, -11.2, 0.06, 0.5);
  cyl(stone, -6.6, 0.52, -11.2, 0.2, 0.06);
  cyl(mat("#8fc6d8", 0.2), -6.6, 0.555, -11.2, 0.17, 0.01);
  orb(mat("#d9603a"), -6.48, 0.6, -11.15, 0.035, 0.035, 0.035);
  colliders.push({ x: -6.6, z: -11.2, r: 0.22 });
  box(wood, -5.2, 0.27, -12.25, 0.8, 0.04, 0.26);
  box(wood, -5.2, 0.48, -12.37, 0.8, 0.1, 0.03);
  for (const x of [-5.55, -4.85]) box(darkWood, x, 0.2, -12.25, 0.04, 0.4, 0.22);
  colliders.push({ x: -5.2, z: -12.25, w: 0.85, d: 0.3 });
  cyl(mat("#6d523a", 1), -7.4, 0.02, -11.9, 0.32, 0.02);
  orb(mat("#d8453a", 0.5), -8.1, 0.06, -11.0, 0.06, 0.06, 0.06);
  // A little apple tree by the patio.
  cyl(darkWood, -4.85, 0.6, -10.55, 0.07, 1.2);
  for (const [x, y, z, r] of [
    [0, 1.45, 0, 0.42],
    [0.25, 1.3, 0.1, 0.3],
    [-0.22, 1.35, -0.12, 0.32],
  ])
    orb(mat("#5f8a4a"), -4.85 + x, y, -10.55 + z, r, r * 0.85, r);
  for (const [x, y, z] of [
    [0.2, 1.3, 0.3],
    [-0.3, 1.45, 0.1],
    [0.1, 1.6, -0.3],
  ])
    orb(mat("#c9473e", 0.5), -4.85 + x, y, -10.55 + z, 0.05, 0.05, 0.05);
  colliders.push({ x: -4.85, z: -10.55, r: 0.12 });
  contact(-4.85, -10.55, 1.2, 1.2);
  // A rose arch over the gate.
  const archX = yard.maxX,
    archZ = (yard.maxZ + -11.1) / 2,
    archR = 0.58,
    archY = 1.85,
    white = "#ece4cf";
  for (const side of [-1, 1]) {
    k.box(white, archX, archY / 2, archZ + side * archR, 0.07, archY, 0.07);
    colliders.push({ x: archX, z: archZ + side * archR, r: 0.06 });
  }
  const arc = (a) => [archX, archY + Math.sin(a) * archR, archZ + Math.cos(a) * archR];
  for (let i = 0; i < 6; i++) k.beam(white, arc((i / 6) * Math.PI), arc(((i + 1) / 6) * Math.PI), 0.06);
  for (let i = 0; i < 11; i++) {
    const f = i / 10,
      [x, y, z] =
        f < 0.3
          ? [archX, 0.3 + (f / 0.3) * (archY - 0.3), archZ + archR]
          : f > 0.7
            ? [archX, 0.3 + ((1 - f) / 0.3) * (archY - 0.3), archZ - archR]
            : arc(((f - 0.3) / 0.4) * Math.PI);
    plant("geranium", i % 3 ? "rose" : "blush", x + Math.sin(i * 2.1) * 0.05, y - 0.08, z, 0.15);
  }
  // Borders along the back fence: foxgloves at the back, cottage flowers in front.
  for (const b of ROSEWOOD_YARD.borders) {
    const length = b.maxX - b.minX,
      mx = (b.minX + b.maxX) / 2,
      mz = (b.minZ + b.maxZ) / 2,
      depth = b.maxZ - b.minZ;
    planters.bed(mx, mz, length, depth);
    const spires = Math.max(1, Math.round(length / 0.45));
    for (let i = 0; i < spires; i++)
      plant("spires", ["rose", "lilac", "blush"][i % 3], b.minX + ((i + 0.5) / spires) * length, 0.12, mz - depth * 0.22, 0.2, 1.0 + 0.2 * Math.sin(i * 1.9) ** 2);
    const fronts = Math.max(1, Math.round(length / 0.32));
    for (let i = 0; i < fronts; i++)
      plant(["daisies", "geranium", "lavender"][i % 3], ["white", "coral", "lavender"][i % 3], b.minX + ((i + 0.5) / fronts) * length, 0.12, mz + depth * 0.2, 0.16);
    colliders.push({ x: mx, z: mz, w: length, d: depth });
  }
  // Pots of geranium and lavender at the foot of the rose.
  for (const [x, z, s, recipe, bloom] of [
    [-6.2, -10.2, 0.5, "geranium", "scarlet"],
    [-6.75, -10.08, 0.4, "lavender", "lavender"],
  ]) {
    const soil = planters.pot(x, 0.02, z, s, "#b4725a");
    plant(recipe, bloom, x, soil - 0.02, z, s * 0.5);
    colliders.push({ x, z, r: s * 0.5 });
  }
  return [fine.finish("Rosewood garden detail", kit.scene)].filter(Boolean);
}
