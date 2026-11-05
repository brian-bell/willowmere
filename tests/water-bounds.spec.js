import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { boundsToPixels, clipBoxBounds, mergeRects } from "../src/water-bounds.js";

// A stretch of water 2 m wide and 40 m long, as long as the brook.
const BOX = new THREE.Box3(new THREE.Vector3(-1, -0.2, -20), new THREE.Vector3(1, 0.2, 20));

function eyeLevelCamera(z) {
  const camera = new THREE.PerspectiveCamera(66, 1.6, 0.06, 72);
  camera.position.set(3, 1.65, z);
  camera.lookAt(0, 0, z - 8);
  camera.updateMatrixWorld();
  return camera;
}

function cornersInClipSpace(camera, box = BOX) {
  const matrix = new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    ),
    corners = new Float64Array(24),
    corner = new THREE.Vector4();
  for (let i = 0; i < 8; i++) {
    corner
      .set(
        i & 1 ? box.max.x : box.min.x,
        i & 2 ? box.max.y : box.min.y,
        i & 4 ? box.max.z : box.min.z,
        1,
      )
      .applyMatrix4(matrix);
    corners.set([corner.x, corner.y, corner.w], i * 3);
  }
  return corners;
}

// Every part of the box the camera can draw lands inside the bounds, whatever
// the box does behind the eye: these are the pixels water can refract from.
function expectBoundsCoverBox(camera, bounds) {
  const point = new THREE.Vector3();
  let seen = 0;
  for (let i = 0; i <= 12; i++)
    for (let j = 0; j <= 12; j++)
      for (let k = 0; k <= 2; k++) {
        point
          .set(
            THREE.MathUtils.lerp(BOX.min.x, BOX.max.x, i / 12),
            THREE.MathUtils.lerp(BOX.min.y, BOX.max.y, k / 2),
            THREE.MathUtils.lerp(BOX.min.z, BOX.max.z, j / 12),
          )
          .applyMatrix4(camera.matrixWorldInverse);
        // Nearer than the near plane, the camera draws nothing.
        if (-point.z < camera.near) continue;
        point.applyMatrix4(camera.projectionMatrix);
        seen++;
        // Points on the box's corners project to its bounds, less rounding.
        expect(point.x).toBeGreaterThanOrEqual(bounds.minX - 1e-9);
        expect(point.x).toBeLessThanOrEqual(bounds.maxX + 1e-9);
        expect(point.y).toBeGreaterThanOrEqual(bounds.minY - 1e-9);
        expect(point.y).toBeLessThanOrEqual(bounds.maxY + 1e-9);
      }
  expect(seen).toBeGreaterThan(0);
}

test("an orthographic view's bounds are the box's projected corners", { tag: "@logic" }, () => {
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
  camera.position.set(0, 50, 0);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const bounds = {};
  expect(clipBoxBounds(cornersInClipSpace(camera), bounds)).toBe(true);
  // 2 m wide and 40 m long, on a view 20 m across, looking straight down.
  expect(bounds.minX).toBeCloseTo(-0.1);
  expect(bounds.maxX).toBeCloseTo(0.1);
  expect(bounds.maxY - bounds.minY).toBeCloseTo(4);
  expectBoundsCoverBox(camera, bounds);
});

test("bounds cover a long box that runs past and behind the eye", { tag: "@logic" }, () => {
  // Beside the brook, whose far corners are ahead and whose near ones are behind.
  const camera = eyeLevelCamera(0),
    corners = cornersInClipSpace(camera),
    bounds = {};
  const behind = [0, 1, 2, 3, 4, 5, 6, 7].filter((i) => corners[i * 3 + 2] <= 0);
  expect(behind.length).toBeGreaterThan(0);
  expect(behind.length).toBeLessThan(8);
  expect(clipBoxBounds(corners, bounds)).toBe(true);
  for (const value of Object.values(bounds)) expect(Number.isFinite(value)).toBe(true);
  expectBoundsCoverBox(camera, bounds);
});

test("a box wholly behind the eye has no bounds", { tag: "@logic" }, () => {
  const camera = eyeLevelCamera(40);
  camera.lookAt(3, 1, 80);
  camera.updateMatrixWorld();
  expect(clipBoxBounds(cornersInClipSpace(camera), {})).toBe(false);
});

test("pixel rectangles grow by the reach and stop at the screen's edges", { tag: "@logic" }, () => {
  const rect = {},
    pixels = (minX, minY, maxX, maxY, reach = 0) =>
      boundsToPixels({ minX, minY, maxX, maxY }, reach, 2000, 1000, rect);
  expect(pixels(-0.5, -0.5, 0.5, 0.5)).toBe(true);
  expect(rect).toEqual({ x0: 500, y0: 250, x1: 1500, y1: 750 });
  expect(pixels(-0.5, -0.5, 0.5, 0.5, 0.1)).toBe(true);
  expect(rect).toEqual({ x0: 400, y0: 200, x1: 1600, y1: 800 });
  // Bounds far past the screen, as a box behind the eye gives, stop at its edges.
  expect(pixels(-400, -2, 300, 5)).toBe(true);
  expect(rect).toEqual({ x0: 0, y0: 0, x1: 2000, y1: 1000 });
  // A fraction of a pixel still counts as the whole pixel.
  expect(pixels(0.0001, 0, 0.0002, 0.1)).toBe(true);
  expect(rect).toEqual({ x0: 1000, y0: 500, x1: 1001, y1: 550 });
  // Nothing on screen, even after growing by the reach.
  expect(pixels(1.2, -0.5, 1.5, 0.5, 0.1)).toBe(false);
  expect(pixels(-0.5, -3, 0.5, -1.2, 0.1)).toBe(false);
});

test("rectangles join when one covering both is no larger than the two", { tag: "@logic" }, () => {
  const rect = (x0, y0, x1, y1) => ({ x0, y0, x1, y1 });
  const covered = (kept, r) =>
    kept.some((k) => k.x0 <= r.x0 && k.y0 <= r.y0 && k.x1 >= r.x1 && k.y1 >= r.y1);

  // A long strip and a far pool: covering both would be mostly empty.
  const apart = [rect(0, 0, 100, 10), rect(500, 500, 510, 510)];
  expect(mergeRects(apart, 2)).toBe(2);
  expect(apart[0]).toEqual(rect(0, 0, 100, 10));

  // Two overlapping fountains' basins.
  const overlapping = [rect(0, 0, 100, 100), rect(50, 0, 150, 100)];
  expect(mergeRects(overlapping, 2)).toBe(1);
  expect(overlapping[0]).toEqual(rect(0, 0, 150, 100));

  // A chain: joining the first two is what brings the third into reach.
  const original = [
    rect(0, 0, 100, 100),
    rect(300, 0, 400, 100),
    rect(90, 0, 310, 100),
    rect(2000, 2000, 2010, 2010),
  ];
  const chain = original.map((r) => ({ ...r })),
    objects = new Set(chain),
    count = mergeRects(chain, 4);
  expect(count).toBe(2);
  for (const r of original) expect(covered(chain.slice(0, count), r)).toBe(true);
  // The pool keeps every object, so the next frame's rectangles stay distinct.
  expect(new Set(chain)).toEqual(objects);
  expect(new Set(chain).size).toBe(4);

  // Only the rectangles in use take part.
  const unused = [rect(0, 0, 10, 10), rect(0, 0, 10, 10)];
  expect(mergeRects(unused, 1)).toBe(1);
  expect(mergeRects(unused, 0)).toBe(0);
});
