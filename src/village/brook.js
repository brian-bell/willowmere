// The brook through the village: its water body and carved bed, pebbles,
// wet stones and their ripples, the falls by the mill and the banks.

import { createRiverbank } from "../riverbank.js";
import { sampleWaterField } from "../water.js";

export function buildBrook(kit, { flat }) {
  const { water, mat, texture, T, mesh, range, rand, scene, darkStone, orb } = kit;
  // A shared bathymetry field drives both the carved bed and the fluid boundary.
  const riverLayoutSeed = kit.seed;
  const riverConfig = {
    id: "river",
    x: 12,
    y: 0.108,
    z: 0,
    size: [4.2, 42],
    depth: 0.82,
    flow: 0.44,
    amplitude: 0.024,
    obstacles: [
      { x: -0.84, z: -4.7, radius: 0.22 },
      { x: 0.84, z: 7.2, radius: 0.2 },
      { x: -0.72, z: 12.5, radius: 0.27 },
      { x: 1.72, z: -6.5, radius: 0.18 },
    ],
  };
  water.addBody(riverConfig);
  const bedMaterial = mat("#8b9277", 0.96);
  bedMaterial.map = texture("#8b9277", "stone");
  bedMaterial.color.set("#ffffff");
  bedMaterial.map.repeat.set(3, 28);
  const bedGeometry = new T.PlaneGeometry(4.6, 42, 56, 420).rotateX(
    -Math.PI / 2,
  );
  const bedPositions = bedGeometry.attributes.position;
  for (let i = 0; i < bedPositions.count; i++) {
    const x = bedPositions.getX(i),
      z = bedPositions.getZ(i);
    const field = sampleWaterField(riverConfig, x, z);
    const bottom = field[3] ? riverConfig.y - field[0] - 0.018 : 0.045;
    bedPositions.setY(
      i,
      bottom + (field[0] > 0.12 ? Math.sin(x * 11 + z * 2.7) * 0.025 : 0),
    );
  }
  bedGeometry.computeVertexNormals();
  flat.push(mesh(bedGeometry, bedMaterial, 12, 0, 0));
  for (const m of flat) m.castShadow = false;
  const pebbleColors = ["#9a987e", "#78877b", "#a8a088", "#677b72"].map(
    (c) => new T.Color(c),
  );
  const pebbles = new T.InstancedMesh(
    new T.IcosahedronGeometry(1, 1),
    new T.MeshStandardMaterial({ roughness: 0.85 }),
    430,
  );
  const dum = new T.Object3D();
  for (let i = 0; i < pebbles.count; i++) {
    const x = range(-1.94, 1.94),
      z = range(-20.8, 20.8);
    const [depth] = sampleWaterField(riverConfig, x, z);
    dum.position.set(12 + x, riverConfig.y - depth - 0.01, z);
    dum.scale.set(range(0.035, 0.1), range(0.025, 0.065), range(0.045, 0.13));
    dum.rotation.set(rand(), rand() * 6.28, rand());
    dum.updateMatrix();
    pebbles.setMatrixAt(i, dum.matrix);
    pebbles.setColorAt(i, pebbleColors[i % pebbleColors.length]);
  }
  pebbles.name = "River pebbles";
  pebbles.receiveShadow = true;
  scene.add(pebbles);
  // Saturated stone is darker and smoother just below the lapping waterline.
  function wetStone(base) {
    const material = base.clone();
    material.onBeforeCompile = (shader) => {
      shader.vertexShader =
        "varying float vStoneHeight;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvStoneHeight = (modelMatrix * vec4(transformed, 1.0)).y;",
      );
      shader.fragmentShader =
        "varying float vStoneHeight;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        "#include <color_fragment>\ndiffuseColor.rgb *= mix(0.62, 1.0, smoothstep(0.08, 0.22, vStoneHeight));",
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor = mix(0.34, roughnessFactor, smoothstep(0.08, 0.22, vStoneHeight));",
      );
    };
    material.customProgramCacheKey = () => "river-wet-stone";
    return material;
  }
  const wetRiverStone = wetStone(darkStone);
  for (const rock of riverConfig.obstacles) {
    orb(
      wetRiverStone,
      12 + rock.x,
      0.07,
      rock.z,
      rock.radius * 1.16,
      0.18,
      rock.radius * 1.24,
    );
    water.addSource("river", {
      x: 12 + rock.x,
      z: rock.z + rock.radius + 0.09,
      radius: 0.11,
      strength: 0.004,
      interval: 0.31,
    });
  }
  water.addJet("river", {
    start: [13.78, 0.48, -6.48],
    end: [13.79, 0.108, -6.1],
    arc: 0.015,
    radius: 0.009,
  });
  water.addJet("river", {
    start: [13.9, 0.35, -6.34],
    end: [13.89, 0.108, -5.98],
    arc: 0.01,
    radius: 0.007,
    phase: 0.07,
  });
  createRiverbank(scene);
  // Keep downstream village placements stable after replacing the old bank stones.
  kit.seed = riverLayoutSeed;
  for (let i = 0; i < 568; i++) rand();
  dum.rotation.set(0, 0, 0);
  return { riverConfig, dum };
}

export function buildBridge(kit) {
  const { box, wood, darkWood, orb, trim, beam, colliders } = kit;
  // Timber bridge with graceful hump, cap rails and peg details.
  for (let i = 0; i < 19; i++) {
    const x = 9.1 + i * 0.32,
      y = 0.24 + Math.sin((i / 18) * Math.PI) * 0.39;
    box(wood, x, y, 3, 0.305, 0.18, 3.5);
    for (let z of [1.32, 4.68])
      if (i % 3 === 0) {
        box(darkWood, x, y + 0.5, z, 0.13, 0.95, 0.13);
        orb(trim, x, y + 1.01, z, 0.105);
      }
  }
  for (let side of [1.3, 4.7])
    for (let i = 0; i < 6; i++) {
      const x = 9.1 + i * 0.96,
        y = 0.24 + Math.sin((i / 6) * Math.PI) * 0.39;
      beam(
        wood,
        [x, y + 0.97, side],
        [
          x + 0.96,
          0.24 + Math.sin(((i + 1) / 6) * Math.PI) * 0.39 + 0.97,
          side,
        ],
        0.13,
      );
    }
  colliders.push(
    { x: 12, z: 1.2, w: 6, d: 0.18 },
    { x: 12, z: 4.8, w: 6, d: 0.18 },
  );
}
