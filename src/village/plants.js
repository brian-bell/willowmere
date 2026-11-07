// The village's trees, shrubs, meadow grass and blossoms, reeds and lilies
// along the brook, lavender beds and the cobbles at path edges.

import { createBushes } from "../bushes.js";
import { createReeds } from "../reeds.js";
import { allowsGrass, regionDeck } from "../regions/index.js";
import { yardAllowsGrass } from "./rosewood-yard.js";
import { createTrees } from "../trees.js";
import { sampleWaterField } from "../water.js";
import { terrainHeight } from "../world-layout.js";

export function buildPlants(
  kit,
  {
    contact,
    dum,
    fence,
    flowerMats,
    riverConfig,
    scatterColliders,
  },
) {
  const {
    scene,
    colliders,
    animated,
    water,
    T,
    mat,
    sphereG,
    range,
    rand,
    mesh,
    orb,
    animate,
    stone,
  } = kit;
  // Each tree keeps four material batches so offscreen specimens can be culled.
  const treePlacements = [
    [-20, -14, 1.3],
    [-16, -13, 1.2],
    [-11, -13, 1.4],
    [-4, -15, 1.5],
    [3, -15, 1.1],
    [7, -13, 1.35],
    [18, -15, 1.5],
    [22, -11, 1.2],
    [21, -1, 1.35],
    [20, 10, 1.1],
    [18, 15, 1.45],
    [8, 16, 1.5],
    [3, 16, 1.15],
    [-3, 17, 1.3],
    [-9, 16, 1.15],
    [-18, 17, 1.3],
    [-22, 8, 1.1],
    [-21, 1, 1.4],
    [-18, -7, 1],
    [-9, 8, 1.05],
    [6, -5, 0.9],
    [6.7, 8.5, 1.1],
  ];
  const trees = createTrees(treePlacements, terrainHeight);
  scene.add(trees.group, trees.crowns);
  for (const [x, z, s] of treePlacements) {
    contact(x, z, 2.1 * s, 2.1 * s);
    colliders.push({ x, z, r: 0.33 * s });
  }
  animated.push((dt, time) => trees.update(time));
  // Orchard and picket details around the first cottages.
  fence(-10, -3.2, -9, -3.2);
  fence(-5, -3.2, -3.8, -3.2);
  fence(-10.4, -3.2, -10.4, -7);
  fence(-18, -0.7, -15.6, -0.7);
  fence(-13.7, -0.7, -12.5, -0.7);
  // Shrub pockets follow cottage fences, garden corners and woodland understory.
  const bushes = createBushes(terrainHeight);
  scene.add(bushes.group);
  // Pools barely resolve single leaves; their captures skip the dense foliage.
  water.excludeFromCaptures(...trees.foliage, trees.crowns, bushes.group);
  // The player walks through shrubs; everything else still keeps off them.
  for (const footprint of bushes.footprints) {
    colliders.push({ ...footprint, passable: true });
    contact(footprint.x, footprint.z, footprint.r * 2.5, footprint.r * 2.1);
  }
  // Garden border flowers and meadow grass.
  const blades = new T.InstancedMesh(
    new T.ConeGeometry(0.035, 0.32, 3),
    mat("#66834a"),
    3400,
  );
  const blossoms = new T.InstancedMesh(sphereG, flowerMats[0], 950);
  blossoms.instanceColor = new T.InstancedBufferAttribute(
    new Float32Array(950 * 3),
    3,
  );
  let bi = 0,
    fi = 0;
  function inRoad(x, z) {
    return (
      (Math.abs(z - 3) < 2 && x > -17 && x < 10) ||
      (Math.abs(x + 2) < 2 && z > -8 && z < 5) ||
      (Math.abs(x + 7) < 2 && z > -5 && z < 3) ||
      (Math.abs(x + 12) < 1.9 && z > 3) ||
      (Math.abs(z - 10.3) < 1.7 && x > -13 && x < 1) ||
      Math.hypot(x + 1, (z - 2.7) * 1.16) < 5.35 ||
      (x > 9.4 && x < 14.6) ||
      (x > 14.4 && x < 17.6 && z > -5 && z < 5)
    );
  }
  function isBlocked(x, z, list = colliders) {
    return list.some((c) =>
      c.w
        ? Math.abs(x - c.x) < c.w / 2 + 0.45 &&
          Math.abs(z - c.z) < c.d / 2 + 0.45
        : Math.hypot(x - c.x, z - c.z) < c.r + 0.2,
    );
  }
  let tries = 0;
  const scatterBlockers = scatterColliders();
  while (bi < 3400 && tries++ < 22000) {
    const x = range(-22.7, 22.7),
      z = range(-19.5, 19.5);
    if (inRoad(x, z) || isBlocked(x, z, scatterBlockers)) continue;
    const y = terrainHeight(x, z);
    dum.position.set(x, y + 0.15, z);
    dum.rotation.set(range(-0.3, 0.3), rand() * 6.28, range(-0.3, 0.3));
    dum.scale.set(1, range(0.6, 1.4), 1);
    dum.updateMatrix();
    blades.setMatrixAt(bi++, dum.matrix);
    if (
      fi < 950 &&
      rand() < 0.34 &&
      Math.sin(x * 0.72) + Math.sin(z * 0.84) + Math.sin((x + z) * 0.47) > 0.65
    ) {
      dum.position.y = y + 0.28;
      dum.scale.set(0.07, 0.045, 0.07);
      dum.updateMatrix();
      blossoms.setMatrixAt(fi, dum.matrix);
      blossoms.setColorAt(
        fi,
        new T.Color(
          ["#f0db9a", "#e0baab", "#d9d8c5", "#b2a3c9"][Math.floor(rand() * 4)],
        ),
      );
      fi++;
    }
  }
  // Regions' paths that reach into the village (the market lane's) stay
  // clear. Dropping blades after the scatter leaves every other placement,
  // and the random stream after it, as it was.
  const at = new T.Vector3(),
    tint = new T.Color(),
    keep = (mesh, count, colors) => {
      let kept = 0;
      for (let i = 0; i < count; i++) {
        mesh.getMatrixAt(i, dum.matrix);
        at.setFromMatrixPosition(dum.matrix);
        if (!allowsGrass(at.x, at.z) || !yardAllowsGrass(at.x, at.z)) continue;
        if (kept !== i) {
          mesh.setMatrixAt(kept, dum.matrix);
          if (colors) {
            mesh.getColorAt(i, tint);
            mesh.setColorAt(kept, tint);
          }
        }
        kept++;
      }
      return kept;
    };
  bi = keep(blades, bi);
  fi = keep(blossoms, fi, true);
  blades.count = bi;
  blossoms.count = fi;
  blades.name = "Grass blades";
  blossoms.name = "Meadow blossoms";
  blades.receiveShadow = true;
  scene.add(blades, blossoms);

  // Reeds and broad lily leaves interrupt the water edge with natural silhouettes.
  const reedPlacements = [],
    lilyMat = mat("#71926a");
  for (let i = 0; i < 35; i++) {
    const z = range(-18, 18);
    if (z > 0.3 && z < 5.6) continue;
    const x = rand() > 0.5 ? 10.22 : 13.78;
    for (let k = 0; k < 3; k++) {
      const xx = x + range(-0.17, 0.17),
        zz = z + range(-0.25, 0.25),
        h = range(0.45, 0.85);
      // Settle into the shallows on the waterward side of the bank stones.
      reedPlacements.push({
        x: xx + (x < 12 ? 0.22 : -0.22),
        z: zz,
        height: h,
      });
    }
  }
  // None stand under a region's bridge deck (the market lane's footbridge).
  // Each reed seeds its own shape from where it stands, so the rest keep theirs.
  const underDeck = (x, z) => [-0.4, 0, 0.4].some((dz) => regionDeck(x, z + dz) != null);
  const reeds = createReeds(reedPlacements.filter((p) => !underDeck(p.x, p.z)), (x, z) => {
    const [depth] = sampleWaterField(riverConfig, x - riverConfig.x, z);
    return riverConfig.y - depth - 0.02;
  });
  scene.add(reeds.group);
  animated.push((dt, time) => reeds.update(time));
  for (const [x, z] of [
    [11.1, 8],
    [13, -11],
    [11.4, 13],
    [12.7, -3],
  ]) {
    const floating = new T.Group();
    floating.userData.dynamic = true;
    floating.position.set(x, 0.139, z);
    scene.add(floating);
    const leaf = mesh(
      new T.CircleGeometry(0.26, 28, 0, Math.PI * 1.85),
      lilyMat,
      0,
      0,
      0,
      1,
      1,
      1,
      floating,
    );
    leaf.rotation.x = -Math.PI / 2;
    leaf.rotation.z = rand() * 6.28;
    orb(flowerMats[1], 0.02, 0.06, 0, 0.09, 0.05, 0.09, floating);
    animate(x, z, () => {
      const t = water.time;
      floating.position.y =
        0.139 + Math.sin(x * 1.01 + z * 3.46 - t * 5.95) * 0.011;
      floating.rotation.z = Math.sin(z * 2.1 - t * 3.6) * 0.025;
      floating.rotation.x = Math.cos(x * 2.3 + t * 2.8) * 0.02;
    });
  }
  // Curving beds of lavender near front walkway.
  const stalkMat = mat("#79916a"),
    lavender = mat("#a59cb5");
  for (let i = 0; i < 26; i++) {
    let a = i * 0.35,
      x = -5 + Math.cos(a) * range(0.8, 1.4),
      z = 7 + Math.sin(a) * 0.45;
    mesh(new T.ConeGeometry(0.08, 0.44, 5), lavender, x, 0.43, z);
  }
  // Irregular cobbles settle into path edges and the fountain apron.
  const stones = new T.InstancedMesh(
    new T.DodecahedronGeometry(1, 0),
    stone,
    220,
  );
  for (let i = 0; i < 220; i++) {
    let x, z;
    if (i < 90) {
      let a = (i / 90) * 6.283;
      x = -1 + Math.cos(a) * range(2.1, 2.8);
      z = 2.5 + Math.sin(a) * range(2.1, 2.8);
    } else {
      x = range(-16, 8.5);
      z = 3 + (rand() > 0.5 ? 1 : -1) * range(1.35, 1.62);
    }
    dum.position.set(x, 0.108, z);
    dum.rotation.set(0, rand() * 6.28, 0);
    dum.scale.set(range(0.11, 0.2), 0.045, range(0.12, 0.24));
    dum.updateMatrix();
    stones.setMatrixAt(i, dum.matrix);
  }
  stones.name = "Path cobbles";
  stones.receiveShadow = true;
  scene.add(stones);
  return { trees, bushes, blades, inRoad, isBlocked, reeds };
}
