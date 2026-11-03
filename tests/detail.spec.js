import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { createBushes } from "../src/bushes.js";
import {
  COARSE_LEAVES_VIEW_HEIGHT,
  FAR_DETAIL_VIEW_HEIGHT,
  overviewFineDetail,
  overviewLeafLevel,
} from "../src/game/detail.js";
import { DEFAULT_VIEW_HEIGHT, MAX_VIEW_HEIGHT } from "../src/game/overview-camera.js";

test("zooming out only ever coarsens the overview, and the default view keeps its finest detail", { tag: "@logic" }, () => {
  let leaves = 0,
    fine = true;
  for (let height = 10; height <= MAX_VIEW_HEIGHT; height += 0.5) {
    expect(overviewLeafLevel(height)).toBeGreaterThanOrEqual(leaves);
    if (!fine) expect(overviewFineDetail(height)).toBe(false);
    leaves = overviewLeafLevel(height);
    fine = overviewFineDetail(height);
  }
  // The default view keeps every leaf and pebble; leaves coarsen before the
  // pebbles and fallen leaves go, and the cap drops both.
  expect(overviewLeafLevel(DEFAULT_VIEW_HEIGHT)).toBe(0);
  expect(overviewFineDetail(DEFAULT_VIEW_HEIGHT)).toBe(true);
  expect(FAR_DETAIL_VIEW_HEIGHT).toBeGreaterThan(COARSE_LEAVES_VIEW_HEIGHT);
  expect(overviewLeafLevel(MAX_VIEW_HEIGHT)).toBe(1);
  expect(overviewFineDetail(MAX_VIEW_HEIGHT)).toBe(false);
});

test("coarse shrub leaves keep every leaf and its outline at a third of the triangles", { tag: "@logic" }, () => {
  const bushes = createBushes(),
    [foliage] = bushes.group.children.filter((mesh) => mesh.name === "Folded shrub leaves");
  const count = foliage.count,
    box = (geometry) => new THREE.Box3().setFromBufferAttribute(geometry.attributes.position);
  const fine = foliage.geometry,
    fineBox = box(fine);
  bushes.setDetail(1);
  const coarse = foliage.geometry,
    coarseBox = box(coarse);
  expect(foliage.count).toBe(count);
  expect(coarse.index.count * 3).toBe(fine.index.count);
  expect(Object.keys(coarse.attributes).sort()).toEqual(Object.keys(fine.attributes).sort());
  // Same length from stem to tip, within the fine leaf's width and depth.
  expect(coarseBox.min.z).toBeCloseTo(fineBox.min.z, 5);
  expect(coarseBox.max.z).toBeCloseTo(fineBox.max.z, 5);
  expect(fineBox.containsBox(coarseBox)).toBe(true);
  expect(coarseBox.max.x).toBeGreaterThan(fineBox.max.x * 0.9);
  // A function picks each chunk's level from its centre, as for trees.
  const centers = [];
  bushes.setDetail((center) => (centers.push(center.clone()), 0));
  expect(foliage.geometry).toBe(fine);
  expect(centers).toHaveLength(1);
  expect(Number.isFinite(centers[0].x)).toBe(true);
});
