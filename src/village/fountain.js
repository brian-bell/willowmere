// The fountain on the green: its stone basins, their water and jets.

export function buildFountain(kit) {
  const { T, mesh, stone, cyl, darkStone, water, trim, orb, colliders, interactables } = kit;
  // Sealed stone walls enclose each pool below the rounded lip.
  function basinWall(x, y, z, inner, outer, height) {
    const ring = new T.Shape();
    ring.absarc(0, 0, outer, 0, Math.PI * 2, false);
    const hole = new T.Path();
    hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
    ring.holes.push(hole);
    const geometry = new T.ExtrudeGeometry(ring, {
      depth: height,
      steps: 1,
      bevelEnabled: false,
      curveSegments: 48,
    });
    geometry.rotateX(-Math.PI / 2);
    mesh(geometry, stone, x, y, z);
  }
  // Central fountain with shallow clear water, central carved basin and gentle jets.
  cyl(darkStone, -1, 0.18, 2.5, 1.65, 0.25);
  cyl(stone, -1, 0.32, 2.5, 1.53, 0.2);
  basinWall(-1, 0.42, 2.5, 1.32, 1.48, 0.15);
  water.addBody({
    id: "fountain-lower",
    x: -1,
    y: 0.5725,
    z: 2.5,
    radius: 1.32,
    hole: 0.285,
    depth: 0.15,
    amplitude: 0.004,
    absorption: [0.7, 0.24, 0.12],
    scatter: "#517e70",
    roughness: 0.13,
  });
  const rim = mesh(
    new T.TorusGeometry(1.43, 0.115, 8, 48),
    trim,
    -1,
    0.61,
    2.5,
  );
  rim.rotation.x = Math.PI / 2;
  cyl(stone, -1, 0.78, 2.5, 0.28, 0.7);
  cyl(trim, -1, 1.1, 2.5, 0.66, 0.09);
  basinWall(-1, 1.145, 2.5, 0.53, 0.63, 0.08);
  const bowl = mesh(
    new T.TorusGeometry(0.58, 0.09, 7, 32),
    stone,
    -1,
    1.23,
    2.5,
  );
  bowl.rotation.x = Math.PI / 2;
  water.addBody({
    id: "fountain-upper",
    x: -1,
    y: 1.22,
    z: 2.5,
    radius: 0.53,
    hole: 0.125,
    depth: 0.075,
    amplitude: 0.002,
    absorption: [0.55, 0.18, 0.1],
    scatter: "#517e70",
    roughness: 0.12,
  });
  cyl(stone, -1, 1.42, 2.5, 0.12, 0.48);
  orb(trim, -1, 1.72, 2.5, 0.21);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    water.addJet("fountain-lower", {
      start: [-1 + Math.cos(a) * 0.09, 1.65, 2.5 + Math.sin(a) * 0.09],
      end: [-1 + Math.cos(a) * 0.92, 0.5725, 2.5 + Math.sin(a) * 0.92],
      arc: 0.045,
      phase: i * 0.073,
      radius: 0.012,
    });
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    water.addJet("fountain-upper", {
      start: [-1 + Math.cos(a) * 0.16, 1.69, 2.5 + Math.sin(a) * 0.16],
      end: [-1 + Math.cos(a) * 0.35, 1.22, 2.5 + Math.sin(a) * 0.35],
      arc: 0.02,
      phase: i * 0.11,
      radius: 0.008,
    });
  }
  colliders.push({ x: -1, z: 2.5, r: 1.7 });
  interactables.push({
    id: "fountain",
    name: "Wishing Fountain",
    type: "fountain",
    x: -1,
    z: 4.6,
    radius: 2,
  });
}
