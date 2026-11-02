// The region registry: every region beyond the village, in one list. The map's
// layout (src/world-layout.js), the world (src/world.js), the open country's
// grass (src/regions/outskirts.js) and the game (src/main.js) read regions
// from here, so a new region is a layout module, a builder and one line below.
//
// A region's entry lives in its layout module (e.g. millpond-layout.js), which
// loads with the village and imports no three.js. Every field but `id` and
// `name` is optional:
//
//   id, name      the location label's id and text.
//   area          the label's bounds { minX, maxX, minZ, maxZ }: open, a
//                 missing side unbounded. Village areas match first, then the
//                 regions in list order.
//   ground        the box the region's own ground mesh covers. The open
//                 country's grass surface is cut away over it, so a box beside
//                 the village touches one of its grass edges (inset 0.2 m)
//                 and the others stand apart. Boxes never overlap.
//   height(x, z)  terrain above the lawn inside `ground` (the village stays
//                 flat). Sampled once a metre into the terrain field and read
//                 bilinearly, unless `exactHeight` is set, when terrainHeight
//                 calls it directly.
//   deepBed       its ground dips below the field soil's upper layer, so only
//                 the soil's deepest layer runs under it.
//   deck(x, z)    walking height on its bridges and jetties, else null.
//   water(x, z)   its water's surface, where clicks land, else null.
//   colliders()   colliders in the shapes collides() (src/game/navigation.js) understands.
//   grass(x, z)   false where meadow grass may not grow (water, paths,
//                 footings). Called anywhere: true outside the region.
//   planting(x, z) where flowers may be planted; `grass` when missing.
//   stream(T, world)  loads the builder with import() once the village is on
//                 screen and resolves to { jobs, ...api } for the streamer;
//                 main.js hands the rest to the region's game logic
//                 (activities.regionLoaded).
import { millpondRegion } from "./millpond-layout.js";
import { orchardRegion } from "./orchard-layout.js";

export const regions = [
  millpondRegion,
  orchardRegion,
  // The open country: the label everywhere else, and its grass.
  {
    id: "fields",
    name: "The open fields",
    area: {},
    stream: (T, world) =>
      import("./outskirts.js").then(({ outskirtsJobs }) => ({ jobs: outskirtsJobs(T, world) })),
  },
];

const within = (b, x, z) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;

/** The region whose ground mesh covers (x, z), if any. */
export const groundRegionAt = (x, z) =>
  regions.find((r) => r.ground && within(r.ground, x, z));

/** Walking height on any region's bridge or jetty at (x, z), else null. */
export function regionDeck(x, z) {
  for (const r of regions) {
    const height = r.deck?.(x, z);
    if (height != null) return height;
  }
  return null;
}

/** Any region's water surface at (x, z), else null. */
export function regionWater(x, z) {
  for (const r of regions) {
    const height = r.water?.(x, z);
    if (height != null) return height;
  }
  return null;
}

/** Every region's colliders, in list order. */
export const regionColliders = () => regions.flatMap((r) => r.colliders?.() ?? []);

/** Whether meadow grass may grow at (x, z) as far as the regions are concerned. */
export const allowsGrass = (x, z) => regions.every((r) => !r.grass || r.grass(x, z));

/** Whether a flower may be planted at (x, z) as far as the regions are concerned. */
export const allowsPlanting = (x, z) =>
  regions.every((r) => {
    const test = r.planting ?? r.grass;
    return !test || test(x, z);
  });
