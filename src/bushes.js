import * as T from "three";

// Deliberate planting pockets leave the paths, doors, bridge and river clear.
// x, z, spread, height, variety (woodland / sage / flowering).
const placements = [
  // Cottage fence ends and the shaded space behind Rosewood.
  [-17.8, -5.7, 0.85, 1.05, 2],
  [-18.6, -5.25, 0.55, 0.65, 2],
  [-11, -7.8, 0.75, 0.85, 1],
  [-10.7, -8.9, 0.6, 0.7, 1],
  [-8.8, -9.7, 0.9, 1.05, 2],
  [-7.4, -10, 0.6, 0.7, 2],
  [-4.7, -10.3, 0.8, 0.9, 0],
  [-10.95, -2.6, 0.65, 0.75, 2],
  [-11.85, -2.9, 0.45, 0.55, 2],
  // Bakery rear and mill orchard, away from their working entrances.
  [4.2, -11.1, 0.8, 0.95, 1],
  [5.45, -11.5, 0.65, 0.7, 1],
  [19.9, -9.9, 0.9, 1.15, 0],
  [20.8, -9.2, 0.55, 0.7, 0],
  [19.6, -4.5, 0.7, 0.8, 2],
  // Outside the kitchen garden: uneven drifts along two fence corners.
  [-20, 6.6, 0.8, 0.9, 1],
  [-20.2, 7.9, 0.55, 0.65, 1],
  [-19.7, 13.9, 0.95, 1.05, 2],
  [-18.45, 14.7, 0.65, 0.75, 2],
  [-17.4, 14.9, 0.5, 0.6, 1],
  [-14.1, 14.65, 0.7, 0.8, 1],
  // Low flowering shrubs behind the garden bench; sage on the east lawn.
  [-8.5, 12.8, 0.7, 0.75, 2],
  [-7.45, 13.15, 0.45, 0.5, 2],
  [7.6, -0.8, 0.65, 0.7, 1],
  [8.4, -1.7, 0.45, 0.55, 1],
  // Woodland understory: irregular groups, with long open meadow gaps.
  [-20.5, -11.7, 0.95, 1.2, 0],
  [-19.3, -11.1, 0.6, 0.7, 0],
  [-16.8, -13.8, 0.8, 0.95, 1],
  [-5.9, -14.6, 1.05, 1.25, 0],
  [-4.4, -13.8, 0.65, 0.8, 0],
  [-3.55, -14.5, 0.5, 0.6, 1],
  [5.7, -14.5, 0.95, 1.15, 0],
  [7.15, -15.2, 0.6, 0.75, 1],
  [-21.4, 1.9, 0.9, 1.1, 0],
  [-20.6, 2.9, 0.6, 0.7, 0],
  [-6.5, 15.6, 0.85, 0.95, 1],
  [-5.25, 15.9, 0.65, 0.65, 1],
  [-4.35, 15.35, 0.45, 0.55, 2],
  [2.1, 16.9, 1, 1.15, 0],
  [3.5, 16.45, 0.65, 0.8, 0],
  [6.1, 14.7, 0.75, 0.85, 1],
  [18.4, 13.5, 0.95, 1.1, 0],
  [19.65, 13.9, 0.65, 0.75, 0],
  [20.15, 12.9, 0.45, 0.6, 1],
  [21.65, -0.2, 0.9, 1.1, 1],
  [21, 0.9, 0.6, 0.7, 1],
];

// A cupped, folded leaf, with real edges and a lighter central ridge.
function leafGeometry() {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute(
    "position",
    new T.Float32BufferAttribute(
      [
        0, 0, 0, -0.34, 0.025, 0.38, 0, 0.13, 0.45, 0.34, 0.025, 0.38, -0.22,
        0.02, 0.73, 0.22, 0.02, 0.73, 0, 0.04, 1,
      ],
      3,
    ),
  );
  geometry.setAttribute(
    "color",
    new T.Float32BufferAttribute(
      [
        0.72, 0.77, 0.64, 0.79, 0.84, 0.71, 1, 1, 0.92, 0.86, 0.91, 0.78, 0.88,
        0.92, 0.8, 0.94, 0.98, 0.85, 1, 1, 0.92,
      ],
      3,
    ),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3, 1, 4, 2, 3, 2, 5, 4, 6, 2, 2, 6, 5]);
  geometry.computeVertexNormals();
  return geometry;
}

// groundHeight(x, z) seats each shrub pocket on the terrain under it.
export function createBushes(groundHeight = () => 0) {
  let seed = 28719;
  const rand = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const range = (a, b) => a + (b - a) * rand();
  const group = new T.Group();
  group.name = "Village shrub pockets";
  group.userData.dynamic = true; // Preserve instancing through the world's static bake.
  const leaves = [],
    stems = [],
    flowers = [];
  const dummy = new T.Object3D(),
    up = new T.Vector3(0, 1, 0),
    facing = new T.Vector3(),
    outward = new T.Vector3();
  const palettes = [
    ["#35583e", "#4b7147", "#64834e", "#7c9259"],
    ["#60795b", "#7c926b", "#91a378", "#a0ab80"],
    ["#496248", "#5d7c50", "#78935b", "#91a36b"],
  ];
  function stem(a, b, width) {
    dummy.position.copy(a).add(b).multiplyScalar(0.5);
    dummy.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize());
    dummy.scale.set(width, a.distanceTo(b), width);
    dummy.updateMatrix();
    stems.push(dummy.matrix.clone());
  }
  // Lift every part of a pocket by the ground height at its centre.
  const seat = (records, from, y, matrixOf) => {
    if (y) for (let i = from; i < records.length; i++) matrixOf(records[i]).elements[13] += y;
  };
  for (const [x, z, spread, height, variety] of placements) {
    const first = [stems.length, leaves.length, flowers.length];
    const turn = rand() * Math.PI * 2;
    // Unequal crowns grow from several woody shoots rather than a solid ball.
    for (let crown = 0; crown < 5; crown++) {
      const angle = turn + crown * 2.4;
      const offset = crown ? range(0.25, 0.62) * spread : 0;
      const center = new T.Vector3(
        x + Math.cos(angle) * offset,
        0.05 + height * (crown ? range(0.38, 0.62) : 0.68),
        z + Math.sin(angle) * offset * 0.8,
      );
      const radius = spread * (crown ? range(0.35, 0.49) : 0.53);
      const rise = height * (crown ? range(0.28, 0.4) : 0.38);
      const base = new T.Vector3(
        x + Math.cos(angle) * 0.09,
        0.07,
        z + Math.sin(angle) * 0.09,
      );
      stem(base, center, 0.018 * spread);
      for (let twig = 0; twig < 3; twig++) {
        const a = angle + twig * 2.1;
        stem(
          center.clone().lerp(base, 0.35),
          center
            .clone()
            .add(
              new T.Vector3(
                Math.cos(a) * radius * 0.8,
                rise * 0.45,
                Math.sin(a) * radius * 0.8,
              ),
            ),
          0.009 * spread,
        );
      }
      // Fill an irregular ellipsoid, biased toward its shell. Small gaps expose twigs.
      for (let i = 0; i < 135; i++) {
        const az = rand() * Math.PI * 2,
          yy = range(-1, 1),
          ring = Math.sqrt(1 - yy * yy);
        const r = Math.pow(rand(), 0.22);
        dummy.position.set(
          center.x + Math.cos(az) * ring * radius * r,
          Math.max(0.13, center.y + yy * rise * r),
          center.z + Math.sin(az) * ring * radius * r * 0.85,
        );
        dummy.rotation.set(
          range(-1.1, 1.1),
          az + range(-0.7, 0.7),
          range(-0.9, 0.9),
        );
        const length = range(0.13, 0.23) * Math.sqrt(spread);
        dummy.scale.set(length * (variety === 1 ? 0.85 : 1), length, length);
        // Single-sided blades turn their upper face out of the crown, so the
        // shell that faces the viewer stays as full as the double-sided one.
        facing.copy(up).applyQuaternion(dummy.quaternion);
        if (facing.dot(outward.copy(dummy.position).sub(center)) < 0)
          dummy.rotateZ(Math.PI);
        dummy.updateMatrix();
        const color = new T.Color(
          palettes[variety][
            Math.min(3, Math.floor((yy + 1) * 1.6 + rand() * 0.6))
          ],
        );
        color.multiplyScalar(range(0.9, 1.08));
        leaves.push({ matrix: dummy.matrix.clone(), color });
        if (variety === 2 && yy > 0.25 && i % 14 === 0) {
          flowers.push({
            position: dummy.position.clone(),
            size: range(0.035, 0.05),
            pink: rand() > 0.6,
          });
        }
      }
    }
    const y = groundHeight(x, z);
    seat(stems, first[0], y, (m) => m);
    seat(leaves, first[1], y, (leaf) => leaf.matrix);
    if (y) for (let i = first[2]; i < flowers.length; i++) flowers[i].position.y += y;
  }
  const foliage = new T.InstancedMesh(
    leafGeometry(),
    new T.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.87,
      // Thin blades cast from both faces; FrontSide would default to back faces.
      shadowSide: T.DoubleSide,
    }),
    leaves.length,
  );
  foliage.name = "Folded shrub leaves";
  leaves.forEach(({ matrix, color }, i) => {
    foliage.setMatrixAt(i, matrix);
    foliage.setColorAt(i, color);
  });
  const wood = new T.InstancedMesh(
    new T.CylinderGeometry(0.7, 1, 1, 5),
    new T.MeshStandardMaterial({ color: "#75604a", roughness: 1 }),
    stems.length,
  );
  wood.name = "Shrub branching stems";
  stems.forEach((matrix, i) => wood.setMatrixAt(i, matrix));
  const blooms = new T.InstancedMesh(
    new T.IcosahedronGeometry(1, 0),
    new T.MeshStandardMaterial({ roughness: 0.95 }),
    flowers.length * 5,
  );
  blooms.name = "Small cream and blush blossoms";
  flowers.forEach(({ position, size, pink }, i) => {
    for (let petal = 0; petal < 5; petal++) {
      const a = (petal * Math.PI * 2) / 5;
      dummy.position
        .copy(position)
        .add(
          new T.Vector3(
            Math.cos(a) * size * 0.8,
            0.015,
            Math.sin(a) * size * 0.8,
          ),
        );
      dummy.rotation.set(0, a, 0.2);
      dummy.scale.set(size, size * 0.38, size * 0.7);
      dummy.updateMatrix();
      blooms.setMatrixAt(i * 5 + petal, dummy.matrix);
      blooms.setColorAt(
        i * 5 + petal,
        new T.Color(pink ? "#cfb3a6" : "#e4dbb9"),
      );
    }
  });
  for (const mesh of [foliage, wood, blooms]) {
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  return {
    group,
    footprints: placements.map(([x, z, r]) => ({ x, z, r: r * 0.95 })),
  };
}
