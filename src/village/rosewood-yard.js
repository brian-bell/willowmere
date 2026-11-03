// Rosewood from outside, behind the cottage: a single-storey kitchen
// extension with a stable door, and a small fenced back garden with Bark's
// kennel, a washing line, a bird bath, a bench and his dig spot. It matches
// the rooms inside (src/rosewood.js). Nothing here draws from the village's
// random stream, so it moves nothing else.

// The extension's footprint and the patio by its door, where the village's
// grass is cleared (src/village/plants.js).
export const ROSEWOOD_YARD = {
  extension: { minX: -9.4, maxX: -4.6, minZ: -9.8, maxZ: -8.1 },
  patio: { minX: -6.2, maxX: -4.8, minZ: -10.6, maxZ: -9.8 },
  fence: { minX: -9.75, maxX: -4.25, minZ: -12.5, maxZ: -9.8 },
};

const inside = (b, x, z, pad = 0) =>
  x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad;

/** Whether the village's meadow grass may grow at (x, z). */
export const yardAllowsGrass = (x, z) =>
  !inside(ROSEWOOD_YARD.extension, x, z, 0.15) && !inside(ROSEWOOD_YARD.patio, x, z, 0.1);

export function buildRosewoodYard(kit, { fence, contact }) {
  const { T, box, cyl, orb, beam, mat, label, colliders, ivory, stone, wood, darkWood, trim, roofBlue, glass, animate } = kit;
  const { extension: ext, fence: yard } = ROSEWOOD_YARD;
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
  for (let r = 0; r < rows; r++) {
    const f = (r + 0.5) / rows - 0.5,
      z = roofZ + f * roofDepth * Math.cos(slope),
      y = roofY + 0.07 - f * roofDepth * Math.sin(-slope);
    for (let c = 0; c < 11; c++) {
      const tile = box((r + c) % 3 ? roofBlue : shade, ext.minX - 0.2 + (c + 0.5) * ((w + 0.4) / 11), y, z, (w + 0.4) / 11 - 0.02, 0.05, roofDepth / rows + 0.04);
      tile.rotation.x = slope;
    }
  }
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
  const windowX = -7.9;
  box(darkWood, windowX, 1.75, face, 0.9, 0.72, 0.06);
  box(glass, windowX, 1.75, face - 0.03, 0.74, 0.56, 0.02);
  box(trim, windowX, 1.75, face - 0.05, 0.05, 0.56, 0.03);
  box(trim, windowX, 1.36, face - 0.12, 1.0, 0.06, 0.2);
  for (let i = 0; i < 3; i++) {
    cyl(mat("#b86f4f"), windowX - 0.25 + i * 0.25, 1.45, face - 0.12, 0.07, 0.12);
    orb(mat("#5f8a4a"), windowX - 0.25 + i * 0.25, 1.56, face - 0.12, 0.08, 0.07, 0.08);
  }
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
  colliders.push({ x: -8.85, z: -11.65, w: 0.7, d: 0.66 });
  contact(-8.85, -11.65, 1, 1);
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
}
