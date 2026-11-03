// Small village accents: mailboxes, barrels, firewood, flags and the dust
// motes drifting in the sun.

export function buildAccents(kit) {
  const {
    cyl,
    wood,
    darkStone,
    darkWood,
    box,
    roofBlue,
    trim,
    T,
    scene,
    beam,
    mesh,
    range,
    animated,
  } = kit;
  // Handcrafted village accents: mailboxes, well used barrels, stacked firewood and flags.
  function barrel(x, z) {
    cyl(wood, x, 0.42, z, 0.31, 0.76);
    for (let y of [0.14, 0.67]) cyl(darkStone, x, y, z, 0.325, 0.05);
    cyl(darkWood, x, 0.81, z, 0.27, 0.045);
  }
  barrel(-10, -5);
  barrel(-10, -5.8);
  barrel(4.25, -7.1);
  barrel(19.5, -5.9);
  for (let i = 0; i < 8; i++) {
    const o = cyl(
      wood,
      -4.1 + (i % 4) * 0.27,
      0.21 + Math.floor(i / 4) * 0.23,
      -6.6,
      0.115,
      0.65,
    );
    o.rotation.x = Math.PI / 2;
  }
  box(wood, -4.7, 0.65, -2.65, 0.08, 1.3, 0.08);
  box(roofBlue, -4.7, 1.35, -2.65, 0.56, 0.38, 0.45);
  box(trim, -4.7, 1.37, -2.405, 0.38, 0.13, 0.01);
  const flags = new T.Group();
  scene.add(flags);
  beam(darkWood, [-4.2, 3.2, -2.5], [4.7, 3.2, -2.5], 0.025, flags);
  for (let i = 0; i < 13; i++) {
    let x = -3.8 + i * 0.65,
      y = 3.12 - Math.sin((i / 12) * Math.PI) * 0.45;
    const shape = new T.Shape();
    shape.moveTo(-0.2, 0);
    shape.lineTo(0.2, 0);
    shape.lineTo(0, -0.38);
    shape.closePath();
    mesh(
      new T.ShapeGeometry(shape),
      new T.MeshStandardMaterial({
        color: ["#b58462", "#d8c491", "#819a97"][i % 3],
        side: T.DoubleSide,
      }),
      x,
      y,
      -2.5,
      1,
      1,
      1,
      flags,
    );
  }
  // Sunny dust motes drifting subtly through the air.
  const pGeo = new T.BufferGeometry(),
    pos = new Float32Array(120 * 3);
  for (let i = 0; i < 120; i++) {
    pos[i * 3] = range(-20, 20);
    pos[i * 3 + 1] = range(0.6, 5);
    pos[i * 3 + 2] = range(-16, 17);
  }
  pGeo.setAttribute("position", new T.BufferAttribute(pos, 3));
  const particles = new T.Points(
    pGeo,
    new T.PointsMaterial({
      color: "#f8e4b4",
      size: 0.045,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    }),
  );
  scene.add(particles);
  animated.push((dt, t) => {
    particles.rotation.y = Math.sin(t * 0.04) * 0.015;
    particles.position.y = Math.sin(t * 0.3) * 0.1;
  });
}
