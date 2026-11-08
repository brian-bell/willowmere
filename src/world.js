import { bakeScenery, createChunks, createDetail } from "./bake.js";
import { weldVertices } from "./geometry-weld.js";
import { createWaterSystem } from "./water.js";
import { WORLD, inVillage, terrainHeight } from "./world-layout.js";
import { allowsPlanting, regionDeck, regionWater, regions } from "./regions/index.js";
import { MILLPOND } from "./regions/millpond-layout.js";
import { MARKET } from "./regions/market-layout.js";
import { MARSH } from "./regions/marsh-layout.js";
import { createVillageKit } from "./village/kit.js";
import { buildGround } from "./village/ground.js";
import { buildPaths } from "./village/paths.js";
import { buildBrook, buildBridge } from "./village/brook.js";
import { buildBuildings } from "./village/buildings.js";
import { buildFountain } from "./village/fountain.js";
import { buildFurniture } from "./village/furniture.js";
import { buildLamps } from "./village/lamps.js";
import { buildPlants } from "./village/plants.js";
import { buildAccents } from "./village/accents.js";
import { buildRosewoodYard } from "./village/rosewood-yard.js";
import { buildRears } from "./village/rears.js";

// The world: the village (built by the modules in src/village/), the water,
// the collision layout shared with the regions, the chunk bake, and what the
// game and streamed regions read and register with.
export function createWorld(T, scene) {
  const initialChildren = new Set(scene.children);
  const water = createWaterSystem(scene);
  const colliders = [],
    interactables = [];
  // Static scenery, instanced detail, glowing materials and animations are
  // grouped by chunk, so a view only pays for the chunks it can see.
  const grid = createChunks(T),
    { chunks, chunkOf, animate } = grid;
  // Animations that span the whole map (wind, reeds, dust) run every frame;
  // the rest belong to the chunk they move in and pause while it is out of view.
  const animated = [];
  // The village's builders share one random stream, drawn in build order, so
  // the order of the calls below is part of the village's layout: moving one
  // call moves everything placed after it.
  const kit = createVillageKit(T, scene, {
      water,
      colliders,
      interactables,
      animate,
      animated,
    }),
    { grass, path, glass } = kit;
  const { flat, fieldGround, contact, contacts } = buildGround(kit);
  buildPaths(kit, { flat });
  const { riverConfig, dum } = buildBrook(kit, { flat });
  // The brook blocks walking along its whole length; the bridges' spans are
  // the gaps between its pieces: the village's bridge, and south of it the
  // market lane's footbridge, whose rails are the market's own colliders.
  // North, it runs on under the millpond's footbridge, whose rail starts the
  // millpond's own colliders; south, under the marsh's footbridge, likewise.
  const footbridgeSouth = MILLPOND.footbridge.maxZ,
    { minZ: crossingNorth, maxZ: crossingSouth } = MARKET.bridge,
    brookPiece = (north, south) => ({ x: 12, z: (north + south) / 2, w: 4.3, d: south - north });
  const crossing = [
      brookPiece(4.75, crossingNorth),
      brookPiece(crossingSouth, MARSH.footbridge.minZ),
    ],
    regionSets = regions.map((r) => [r.id, r.colliders?.() ?? []]),
    // Regions that came after the village's scatter was settled (all but
    // the millpond's and the orchard's).
    laterSet = new Set([
      ...crossing,
      ...regionSets.filter(([id]) => id !== "millpond" && id !== "orchard").flatMap(([, set]) => set),
    ]);
  colliders.push(
    brookPiece(footbridgeSouth, 1.25),
    ...crossing,
    ...regionSets.flatMap(([, set]) => set),
  );
  // The village's grass scatter draws its random stream against the colliders
  // it always had: the brook in one piece south of the bridge, and no market
  // lane, marsh or wood, so every blade, and everything placed after them,
  // stays where it was. Their footings clear their grass after the scatter
  // instead.
  const scatterColliders = () => [
    ...colliders.filter((c) => !laterSet.has(c)),
    brookPiece(4.75, 21.25),
  ];
  buildBridge(kit);
  const { flowerMats } = buildBuildings(kit, { contact });
  buildFountain(kit);
  const { fence } = buildFurniture(kit);
  const { lamps, lampsByDistance, lanterns, placeLanterns, lightLanterns } = buildLamps(kit);
  const { trees, bushes, blades, inRoad, isBlocked, reeds } = buildPlants(kit, {
    contact,
    dum,
    fence,
    flowerMats,
    riverConfig,
    scatterColliders,
  });
  buildAccents(kit);
  // Rosewood's kitchen extension and back garden, and the backs of the
  // houses, draw no random numbers. Their small detail stays out of the bake
  // so that it can hide zoomed far out (village/fine.js).
  const fine = [...buildRosewoodYard(kit, { fence, contact }), ...buildRears(kit, { contact })];
  // Bake the village into its chunks, and let first person hide small
  // detail far from the eye (see bake.js).
  const glowMaterials = bakeScenery(T, scene, grid, {
      skip: new Set([...initialChildren, ...fine]),
      selfCulled: [trees.group],
    }),
    detail = createDetail(chunks, fieldGround, [reeds.group, bushes.group]);
  // The bake and the builders leave geometry non-indexed so it can merge;
  // welding its identical vertices shades each one once (geometry-weld.js).
  const welded = new WeakSet();
  const weld = (geometry) => {
    if (geometry.index || welded.has(geometry)) return;
    welded.add(geometry);
    weldVertices(T, geometry);
  };
  scene.traverse((node) => node.isMesh && weld(node.geometry));
  /**
   * Registers a mesh that streamed in after startup with the chunk under its
   * centre, and with first person's detail range when `detail` is set;
   * zoomed far out, the overview hides it when `far` is set and drops its
   * shadow when `fineShadow` is.
   */
  function addStreamed(mesh, { detail: small = false, field = false, far = undefined, fineShadow = undefined } = {}) {
    if (mesh.isMesh) weld(mesh.geometry);
    mesh.updateMatrixWorld();
    const chunk = chunkOf(mesh);
    chunk.meshes.push(mesh);
    if (mesh.material?.emissive?.getHex() > 0) {
      chunk.glow.add(mesh.material);
      glowMaterials.add(mesh.material);
    }
    detail.addCaster(mesh, fineShadow);
    if (small || far) detail.addDetail(mesh, field, far);
    if (field) detail.addField(mesh);
  }
  for (const mesh of fine) addStreamed(mesh, { far: true });
  water.excludeFromCaptures(...fine, ...contacts);
  // Zoomed far out, the meadow's grass and blossoms reflect as a pixel or two.
  water.excludeFromFarCaptures(...detail.grassAndBlossoms());
  let clock = 0;
  // The walking surface: the bridge deck's hump, a region's decks (the
  // millpond's footbridge and jetty), otherwise the terrain's grass.
  const getGroundHeight = (x, z) =>
    x >= 9.1 && x <= 14.86 && z >= 1.25 && z <= 4.75
      ? 0.33 + Math.sin(((x - 9.1) / 5.76) * Math.PI) * 0.39
      : (regionDeck(x, z) ?? terrainHeight(x, z) + 0.05);
  // What a click lands on: the walking surface, or water where it covers it.
  const surfaceHeight = (x, z) =>
    Math.max(getGroundHeight(x, z), regionWater(x, z) ?? -Infinity);
  const { plantable } = WORLD;
  const isPlantable = (x, z) =>
    x > plantable.minX &&
    x < plantable.maxX &&
    z > plantable.minZ &&
    z < plantable.maxZ &&
    !isBlocked(x, z) &&
    // Village paths, the plaza's open middle and the brook's banks stay clear.
    !(inVillage(x, z) && (inRoad(x, z) || Math.abs(x - 12) <= 2)) &&
    // Each region keeps its own clear (the millpond's water, banks, jetty and
    // boathouse; the orchard's path and footings).
    allowsPlanting(x, z) &&
    Math.hypot(x, z) > 2.5;
  return {
    water,
    // Shared by the village's meadow grass and the open country's.
    grassBlade: { geometry: blades.geometry, material: blades.material },
    addStreamed,
    /**
     * Shows or hides the open country (for measuring its cost): true, false,
     * or "ground" to hide only its grass.
     */
    showFields: detail.showFields,
    /** First person: hides small detail more than DETAIL_RANGE (bake.js) from (x, z). */
    setDetailFocus(x, z) {
      water.setFarCaptures(false);
      detail.setDetailFocus(x, z);
    },
    /**
     * The overview: shows small detail, or drops the smallest, and leaves the
     * smallest things out of reflections, when zoomed far out.
     */
    setOverviewDetail(near) {
      water.setFarCaptures(!near);
      detail.setOverviewDetail(near);
    },
    getGroundHeight,
    surfaceHeight,
    isPlantable,
    // The open country's grass, which streamed regions shape their ground with.
    groundMaterial: grass,
    /**
     * Registers an animation for a streamed piece at (x, z); it runs while
     * that chunk is in view, like the village's own.
     */
    animate,
    colliders,
    trees,
    bushes,
    treeCanopies: trees.canopyBounds,
    interactables,
    spawn: { x: -2.8, z: 6.2 },
    chunks,
    terrainHeight,
    /**
     * Advances water and animations. `frustums` lists the views being drawn
     * (the camera, the shadow camera); a chunk outside all of them skips its
     * animations. Without frustums every chunk animates.
     */
    update(dt, time, frustums) {
      water.update(dt);
      clock += dt;
      for (const f of animated) f(dt, time, clock);
      grid.update(dt, time, clock, frustums);
    },
    animatedChunks: grid.animatedChunks,
    lanterns,
    lamps,
    placeLanterns,
    lightLanterns,
    /** Lamps a region streamed in, at the glass's height; the light pool visits them too. */
    addLamps(points) {
      for (const { x, z } of points) {
        const lamp = new T.Vector3(x, 2.4, z);
        lamps.push(lamp);
        lampsByDistance.push(lamp);
      }
    },
    // Lit windows and lamp glass, which brighten at blue hour.
    glowMaterials,
    // Shared with streamed regions, so their paths and lamps match the village's.
    materials: { path, glass },
  };
}
