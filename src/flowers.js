import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Every bouquet shares three baked meshes. Gathering releases only its instance;
// planting and watering reuse the geometry without rebuilding individual petals.
export function createFlowerFactory(scene) {
  const materials = [
    new T.MeshStandardMaterial({ color: "#56733e" }),
    new T.MeshStandardMaterial({ color: "#d99a3e" }),
    new T.MeshStandardMaterial({ color: "#fff1b3", roughness: 0.8 }),
  ];
  const parts = materials.map(() => []);
  const dummy = new T.Object3D();
  for (let i = 0; i < 5; i++) {
    const a = i * 2.4,
      r = 0.14 + i * 0.035,
      x = Math.cos(a) * r,
      z = Math.sin(a) * r,
      h = 0.32 + (i % 3) * 0.11;
    parts[0].push(
      new T.CylinderGeometry(0.017, 0.02, h, 4).translate(x, h / 2, z),
    );
    parts[1].push(new T.SphereGeometry(0.055, 6, 4).translate(x, h, z));
    for (let p = 0; p < 5; p++) {
      const b = (p * Math.PI * 2) / 5;
      dummy.position.set(x + Math.cos(b) * 0.07, h, z + Math.sin(b) * 0.07);
      dummy.rotation.y = -b;
      dummy.scale.set(1, 0.35, 1.5);
      dummy.updateMatrix();
      parts[2].push(
        new T.SphereGeometry(0.065, 6, 4).applyMatrix4(dummy.matrix),
      );
    }
  }
  const geometries = parts.map((pieces) => {
    const geometry = mergeGeometries(pieces);
    pieces.forEach((piece) => piece.dispose());
    return geometry;
  });
  const haloGeometry = new T.RingGeometry(0.37, 0.4, 32);
  const haloMaterial = new T.MeshBasicMaterial({
    color: "#f6e5ae",
    transparent: true,
    opacity: 0.6,
    side: T.DoubleSide,
  });
  return (x, z, planted = false) => {
    const group = new T.Group();
    group.position.set(x, 0, z);
    geometries.forEach((geometry, i) => {
      const mesh = new T.Mesh(geometry, materials[i]);
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    });
    if (!planted) {
      const halo = new T.Mesh(haloGeometry, haloMaterial);
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.025;
      halo.updateMatrix();
      halo.matrixAutoUpdate = false;
      group.add(halo);
    }
    scene.add(group);
    return group;
  };
}
