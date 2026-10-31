import { test, expect } from "@playwright/test";
import {
  WORLD,
  chunkBounds,
  chunkCoords,
  chunkRandom,
  regionAt,
  terrainHeight,
} from "../src/world-layout.js";

test("world bounds reproduce the village's limits", () => {
  expect(WORLD.walk).toEqual({ minX: -21, maxX: 21, minZ: -17, maxZ: 17 });
  expect(WORLD.camera).toEqual({ minX: -12, maxX: 14, minZ: -9, maxZ: 11 });
  expect(WORLD.shadow).toEqual({ minX: -24.6, maxX: 24.6, minZ: -21, maxZ: 21 });
  expect(WORLD.plantable).toEqual({ minX: -22, maxX: 22, minZ: -18, maxZ: 18 });
  // The village is exactly the 3 × 3 chunks around the origin.
  expect(chunkBounds(-1, -1)).toMatchObject({ minX: -24, minZ: -21 });
  expect(chunkBounds(1, 1)).toMatchObject({ maxX: 24, maxZ: 21 });
  expect(chunkCoords(0, 0)).toEqual([0, 0]);
  expect(chunkCoords(-8.01, 7)).toEqual([-1, 1]);
  expect(chunkCoords(23.9, -20.9)).toEqual([1, -1]);
});

test("regions name the same places the location label always did", () => {
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
  for (let x = -21; x <= 21; x += 0.5)
    for (let z = -17; z <= 17; z += 0.5)
      expect(regionAt(x, z).name).toBe(legacy(x, z));
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
