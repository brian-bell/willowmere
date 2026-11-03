// Benches, picket fences and the kitchen garden's enclosure (its beds and
// plants live in garden.js).

import { createGarden } from "../garden.js";

export function buildFurniture(kit) {
  const {
    T,
    scene,
    box,
    wood,
    darkWood,
    colliders,
    trim,
    mesh,
    beam,
    mat,
    path,
    interactables,
  } = kit;
  function bench(x, z, rot = 0) {
    const p = new T.Group();
    p.position.set(x, 0, z);
    p.rotation.y = rot;
    scene.add(p);
    for (let zz of [-0.22, 0, 0.22])
      box(wood, 0, 0.61, zz, 1.95, 0.11, 0.17, p);
    for (let yy of [0.98, 1.24]) box(wood, 0, yy, -0.35, 1.95, 0.18, 0.095, p);
    for (let xx of [-0.75, 0.75]) {
      box(darkWood, xx, 0.33, 0, 0.13, 0.65, 0.6, p);
      box(darkWood, xx, 0.86, -0.35, 0.11, 0.92, 0.11, p);
    }
    colliders.push({ x, z, r: 1 });
  }
  bench(-4.6, 3.1, Math.PI / 2);
  bench(2.7, 2.7, -Math.PI / 2);
  bench(-5, 10.9, Math.PI);
  bench(17, 5.7, Math.PI);
  // Enclosed kitchen garden; its beds, plants and clutter live in garden.js.
  function fence(x1, z1, x2, z2) {
    colliders.push({
      x: (x1 + x2) / 2,
      z: (z1 + z2) / 2,
      w: Math.max(0.12, Math.abs(x2 - x1)),
      d: Math.max(0.12, Math.abs(z2 - z1)),
    });
    const len = Math.hypot(x2 - x1, z2 - z1),
      n = Math.ceil(len / 1.45);
    for (let i = 0; i <= n; i++) {
      let f = i / n,
        x = x1 + (x2 - x1) * f,
        z = z1 + (z2 - z1) * f;
      box(trim, x, 0.57, z, 0.13, 1.1, 0.13);
      mesh(new T.ConeGeometry(0.12, 0.15, 4), trim, x, 1.19, z);
      if (i < n)
        for (let y of [0.47, 0.87])
          beam(
            trim,
            [x, y, z],
            [x + (x2 - x1) / n, y, z + (z2 - z1) / n],
            0.085,
          );
    }
  }
  fence(-19, 6, -19, 13.7);
  fence(-19, 13.7, -13.8, 13.7);
  fence(-13.8, 13.7, -13.8, 11);
  fence(-19, 6, -14, 6);
  fence(-13.8, 6, -13.8, 8);
  scene.add(createGarden({ wood, darkWood, trim, soil: mat("#796146"), path }));
  interactables.push({
    id: "garden",
    name: "Community Garden",
    type: "garden",
    x: -13,
    z: 9.4,
    radius: 2,
  });
  colliders.push({ x: -16.6, z: 9.6, w: 4.5, d: 7.5 });
  return { fence };
}
