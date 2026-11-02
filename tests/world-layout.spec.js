import { test, expect } from "@playwright/test";
import {
  WORLD,
  chunkBounds,
  chunkCoords,
  chunkRandom,
  inVillage,
  regionAt,
  terrainField,
  terrainHeight,
} from "../src/world-layout.js";
import { regions } from "../src/regions/index.js";

test("the map is four times the village, with the village in the middle", { tag: "@logic" }, () => {
  expect(WORLD.village).toEqual({ minX: -24, maxX: 24, minZ: -21, maxZ: 21 });
  expect(WORLD.ground).toEqual({ minX: -48, maxX: 48, minZ: -42, maxZ: 42 });
  const area = (b) => (b.maxX - b.minX) * (b.maxZ - b.minZ);
  expect(area(WORLD.ground)).toBe(4 * area(WORLD.village));
  // The walk box, plantable area and camera clamp keep their margins from the
  // edge they always had, now at the map's rim.
  expect(WORLD.walk).toEqual({ minX: -45, maxX: 45, minZ: -38, maxZ: 38 });
  expect(WORLD.plantable).toEqual({ minX: -46, maxX: 46, minZ: -39, maxZ: 39 });
  expect(WORLD.camera).toEqual({ minX: -36, maxX: 38, minZ: -30, maxZ: 32 });
  expect(WORLD.shadow).toEqual({ minX: -48.6, maxX: 48.6, minZ: -42, maxZ: 42 });
  // Shadow texel sizes still refer to the village's old receivers.
  expect(WORLD.shadowReference).toEqual({ minX: -24.6, maxX: 24.6, minZ: -21, maxZ: 21 });
  // The village is exactly the 3 × 3 chunks around the origin.
  expect(chunkBounds(-1, -1)).toMatchObject({ minX: -24, minZ: -21 });
  expect(chunkBounds(1, 1)).toMatchObject({ maxX: 24, maxZ: 21 });
  expect(chunkCoords(0, 0)).toEqual([0, 0]);
  expect(chunkCoords(-8.01, 7)).toEqual([-1, 1]);
  expect(chunkCoords(23.9, -20.9)).toEqual([1, -1]);
  // The map's corners fall in the half-width rim chunks.
  expect(chunkCoords(-47.9, -41.9)).toEqual([-3, -3]);
  expect(chunkCoords(47.9, 41.9)).toEqual([3, 3]);
  expect(inVillage(0, 0)).toBe(true);
  expect(inVillage(24, -21)).toBe(true);
  expect(inVillage(24.1, 0)).toBe(false);
});

test("regions name the same village places as always, and the fields beyond", { tag: "@logic" }, () => {
  const legacy = (x, z) =>
    x > 10
      ? "The willow brook"
      : z < -5
        ? "The cottage lane"
        : x < -8
          ? "The wildflower meadow"
          : z > 7
            ? "The kitchen gardens"
            : "The village green";
  for (let x = -24; x <= 24; x += 0.5)
    for (let z = -21; z <= 21; z += 0.5)
      expect(regionAt(x, z).name).toBe(legacy(x, z));
  for (const [x, z] of [
    [-30, 0],
    [30, 0],
    [0, -30],
    [12, 30],
    [-47, 41],
  ])
    expect(regionAt(x, z).name).toBe("The open fields");
});

test("chunk seeds are independent of build order", { tag: "@logic" }, () => {
  const sample = (cx, cz) => {
    const rand = chunkRandom(cx, cz);
    return [rand(), rand(), rand()];
  };
  const first = sample(2, -3);
  sample(0, 0);
  sample(-4, 1);
  expect(sample(2, -3)).toEqual(first);
  expect(sample(2, -2)).not.toEqual(first);
  expect(sample(-3, 2)).not.toEqual(first);
  for (const value of first) {
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  }
});

test("terrain is flat in the village and rises only at the millpond and orchard hill", { tag: "@logic" }, () => {
  for (const [x, z] of [
    [0, 0],
    [-24, -21],
    [24, 21],
    [12.3, -4.7],
    [12, -21],
    [-30, 10],
    [-47, -41],
    [35, 10],
    [100, -100],
  ])
    expect(terrainHeight(x, z)).toBe(0);
  for (let x = -24; x <= 24; x += 1)
    for (let z = -21; z <= 21; z += 1) expect(terrainHeight(x, z)).toBe(0);
  // The pond's bank rises about half a metre; its bed lies below the lawn.
  expect(terrainHeight(17.6, -26.5)).toBeGreaterThan(0.35);
  expect(terrainHeight(12.5, -31.2)).toBeLessThan(-0.3);
  // The orchard hill is the map's highest ground, a few metres up.
  expect(terrainHeight(-25, -32)).toBeGreaterThan(3.2);
  expect(terrainField.max).toBeGreaterThan(3.2);
  expect(terrainField.max).toBeLessThan(4);
  expect(regionAt(12.5, -31).name).toBe("The millpond");
  expect(regionAt(-25, -32).name).toBe("The orchard hill");
  expect(regionAt(-2, -22).name).toBe("The orchard hill");
  expect(regionAt(7, -28).name).toBe("The millpond");
  expect(regionAt(12, -20.5).name).toBe("The willow brook");
});

test("the region registry's ground boxes fit the open country's cut-outs", { tag: "@logic" }, () => {
  expect(new Set(regions.map((r) => r.id)).size).toBe(regions.length);
  // The open fields come last and catch everything else.
  expect(regions.at(-1)).toMatchObject({ id: "fields", area: {} });
  const grounds = regions.filter((r) => r.ground).map((r) => r.ground),
    villageGrass = { minX: -23.8, maxX: 23.8, minZ: -20.8, maxZ: 20.8 },
    overlap = (a, b) =>
      a.minX < b.maxX - 1e-6 &&
      b.minX < a.maxX - 1e-6 &&
      a.minZ < b.maxZ - 1e-6 &&
      b.minZ < a.maxZ - 1e-6;
  for (const [i, a] of grounds.entries()) {
    // world.js cuts each region's ground out of the field grass: beside the
    // village as a notch in its edge, otherwise as a hole of its own.
    expect(overlap(a, villageGrass)).toBe(false);
    for (const b of grounds.slice(i + 1)) expect(overlap(a, b)).toBe(false);
  }
  // A region's own terrain applies inside its ground box.
  for (const r of regions.filter((r) => r.exactHeight)) {
    const { minX, maxX, minZ, maxZ } = r.ground,
      x = (minX + maxX) / 2,
      z = (minZ + maxZ) / 2;
    expect(terrainHeight(x, z)).toBe(r.height(x, z));
  }
});
