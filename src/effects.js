import * as T from "three";
export function createEffects(scene) {
  const bursts = [];
  const geo = new T.PlaneGeometry(0.09, 0.15);
  const materials = ["#fff1b6", "#e4be77", "#b9cf91"].map(
    (color) =>
      new T.MeshBasicMaterial({
        color,
        side: T.DoubleSide,
        transparent: true,
        depthWrite: false,
      }),
  );
  return {
    burst(x, y, z) {
      const g = new T.Group();
      g.position.set(x, y, z);
      for (let i = 0; i < 15; i++) {
        const p = new T.Mesh(geo, materials[i % 3]);
        p.userData = {
          vx: Math.cos(i * 2.4) * (0.3 + Math.random() * 0.4),
          vz: Math.sin(i * 2.4) * (0.3 + Math.random() * 0.4),
          vy: 1.1 + Math.random() * 0.8,
        };
        g.add(p);
      }
      scene.add(g);
      bursts.push({ g, age: 0 });
    },
    update(dt, enabled) {
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i];
        b.age += dt;
        for (const p of b.g.children) {
          p.position.x += p.userData.vx * dt;
          p.position.z += p.userData.vz * dt;
          p.position.y += p.userData.vy * dt;
          p.userData.vy -= dt * 1.4;
          p.rotation.x += dt * 2;
          p.rotation.y += dt * 3;
          const scale = Math.max(0, 1 - b.age / 1.6);
          p.scale.setScalar(scale);
        }
        if (b.age > 1.6 || !enabled) {
          scene.remove(b.g);
          bursts.splice(i, 1);
        }
      }
    },
  };
}
