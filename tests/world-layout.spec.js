import { test, expect } from "@playwright/test";
import {
  WORLD,
  chunkBounds,
  chunkCoords,
  chunkRandom,
  inVillage,
  regionAt,
  terrainHeight,
} from "../src/world-layout.js";

test("the map is four times the village, with the village in the middle", () => {
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

test("regions name the same village places as always, and the fields beyond", () => {
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

test("chunk seeds are independent of build order", () => {
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

test("terrain is flat until a region brings height data", () => {
  for (const [x, z] of [
    [0, 0],
    [-24, -21],
    [24, 21],
    [12.3, -4.7],
    [100, -100],
  ])
    expect(terrainHeight(x, z)).toBe(0);
});
