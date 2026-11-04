import * as T from "three";
import { createCat } from "../cats.js";
import { buildExterior } from "./exterior.js";
import { buildGreatRoom } from "./great-room.js";
import { buildLoft } from "./loft.js";
import { createPubMaterials, createStorey } from "./parts.js";

// The Drowsy Heron, whole: its three parts stack, so the study can lift the
// roof, then the loft, off the great room. Each part merges to one draw per
// material; what moves (the fire, the sign, the sleepers) stays apart.

function createSmoke(stacks) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const c = canvas.getContext("2d"),
    g = c.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, "rgba(240,236,226,.5)");
  g.addColorStop(1, "rgba(240,236,226,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  const map = new T.CanvasTexture(canvas);
  const group = new T.Group(),
    puffs = [];
  stacks.forEach((stack, s) => {
    for (let i = 0; i < 5; i++) {
      const sprite = new T.Sprite(
        new T.SpriteMaterial({ map, transparent: true, depthWrite: false, opacity: 0 }),
      );
      sprite.userData = { stack, phase: i / 5 + s * 0.13, seed: s * 7.3 + i * 2.1 };
      group.add(sprite);
      puffs.push(sprite);
    }
  });
  return {
    group,
    update(t) {
      for (const p of puffs) {
        const { stack, phase, seed } = p.userData,
          life = (t * 0.1 + phase) % 1;
        p.position.set(
          stack[0] + life * 1.8 + Math.sin(seed + t * 0.5) * 0.14 * life,
          stack[1] + life * 3.8,
          stack[2] + Math.cos(seed + t * 0.4) * 0.22 * life,
        );
        p.scale.setScalar(0.28 + life * 1.5);
        p.material.opacity = Math.sin(life * Math.PI) * 0.42;
      }
    },
  };
}

export function createPub() {
  const materials = createPubMaterials(),
    group = new T.Group(),
    groups = { ground: new T.Group(), upper: new T.Group(), roof: new T.Group() };
  group.add(groups.ground, groups.upper, groups.roof);
  const ground = createStorey(groups.ground, 8101, materials),
    upper = createStorey(groups.upper, 8102, materials),
    roof = createStorey(groups.roof, 8103, materials),
    uniforms = { time: { value: 0 } };

  const shell = buildExterior({ ground, upper, roof }, materials);
  buildGreatRoom(ground, upper, materials, uniforms);
  const loft = buildLoft({ upper, roof }, materials);

  // Cinnamon's cousin, asleep on the hearth rug: every inn has one.
  const cat = createCat(
    T,
    { fur: "#6d6d68", stripe: "#45453f", cream: "#ddd6c4", pink: "#b58a82" },
    (color) => new T.MeshStandardMaterial({ color, roughness: 0.9 }),
    true,
  );
  cat.root.position.set(-4.72, 0.03, -0.72);
  cat.root.rotation.y = 0.9;
  cat.root.scale.setScalar(0.62);
  groups.ground.add(cat.root);
  ground.apart(cat.root);

  const smoke = createSmoke(shell.smoke);
  group.add(smoke.group);

  ground.finish();
  upper.finish();
  roof.finish();

  return {
    group,
    groups,
    materials,
    update(t) {
      uniforms.time.value = t;
      smoke.update(t);
      shell.sign.rotation.x = Math.sin(t * 0.75) * 0.05 + Math.sin(t * 1.9) * 0.012;
      for (const [i, s] of loft.sleepers.entries())
        s.scale.y = 1 + Math.sin(t * 1.05 + i * 2.1) * 0.09;
    },
  };
}
