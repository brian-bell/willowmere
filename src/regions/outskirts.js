// The open country around the village: meadow grass on the ground slab, over
// every region's ground where its grass mask allows (src/regions/index.js):
// up to the millpond's banks and over the orchard hill. Loaded with import()
// after the village is on screen, and built by the streamer one patch at a
// time.
import {
  WORLD,
  chunkBounds,
  chunkRandom,
  terrainHeight,
} from "../world-layout.js";
import { allowsGrass } from "./index.js";

// Blades per square metre, about the village meadow's density.
const GRASS_DENSITY = 1.7;
// Blades stay this far inside the grass slab's edge.
const RIM_MARGIN = 0.5;

/**
 * One grass patch per chunk around the village. The rim's half-width chunks
 * join their inner neighbours, so every patch is a full chunk or larger:
 * 16 patches of about 3,400–5,100 triangles each.
 */
export function outskirtsJobs(T, world) {
  const { ground } = WORLD,
    { geometry, material } = world.grassBlade,
    jobs = [];
  for (let cx = -2; cx <= 2; cx++)
    for (let cz = -2; cz <= 2; cz++) {
      if (Math.abs(cx) <= 1 && Math.abs(cz) <= 1) continue;
      const b = chunkBounds(cx, cz),
        minX = (cx === -2 ? ground.minX : b.minX) + (cx === -2 ? RIM_MARGIN : 0),
        maxX = (cx === 2 ? ground.maxX : b.maxX) - (cx === 2 ? RIM_MARGIN : 0),
        minZ = (cz === -2 ? ground.minZ : b.minZ) + (cz === -2 ? RIM_MARGIN : 0),
        maxZ = (cz === 2 ? ground.maxZ : b.maxZ) - (cz === 2 ? RIM_MARGIN : 0);
      jobs.push({
        key: `${cx},${cz}`,
        x: (minX + maxX) / 2,
        z: (minZ + maxZ) / 2,
        step: () =>
          grassPatch(T, geometry, material, chunkRandom(cx, cz, 1), {
            minX,
            maxX,
            minZ,
            maxZ,
          }, `${cx},${cz}`),
        added: ([mesh]) => {
          world.addStreamed(mesh, { detail: true, field: true });
          // The brook's reflections would show these as specks at most.
          world.water.excludeFromCaptures(mesh);
        },
      });
    }
  return jobs;
}

function grassPatch(T, geometry, material, rand, b, key) {
  const range = (a, c) => a + (c - a) * rand(),
    count = Math.round((b.maxX - b.minX) * (b.maxZ - b.minZ) * GRASS_DENSITY),
    blades = new T.InstancedMesh(geometry, material, count),
    dummy = new T.Object3D();
  let placed = 0;
  for (let i = 0; i < count; i++) {
    const x = range(b.minX, b.maxX),
      z = range(b.minZ, b.maxZ),
      tilt = range(-0.3, 0.3),
      turn = rand() * 6.28,
      lean = range(-0.3, 0.3),
      height = range(0.6, 1.4);
    // Every blade draws its random numbers, so a skipped one moves no other.
    if (!allowsGrass(x, z)) continue;
    dummy.position.set(x, terrainHeight(x, z) + 0.15, z);
    dummy.rotation.set(tilt, turn, lean);
    dummy.scale.set(1, height, 1);
    dummy.updateMatrix();
    blades.setMatrixAt(placed++, dummy.matrix);
  }
  blades.count = placed;
  blades.name = `Grass blades (open country ${key})`;
  blades.receiveShadow = true;
  blades.matrixAutoUpdate = false;
  blades.updateMatrix();
  blades.computeBoundingSphere();
  return blades;
}
