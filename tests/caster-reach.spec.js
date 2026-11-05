import { test, expect } from "@playwright/test";
import { casterReachesView, viewWedge } from "../src/game/caster-reach.js";

const FLOOR = -1.4;
// Straight overhead, so a shadow falls directly under its caster.
const OVERHEAD = { x: 0, y: 1, z: 0 };
// Low in the west, so a shadow falls a long way east (+x).
const LOW_WEST = { x: -Math.SQRT1_2, y: Math.SQRT1_2, z: 0 };
// Everything with x above zero is in view.
const EAST = [[1, 0, 0, 0]];

test("a caster outside the view, whose shadow falls away from it, is left out", { tag: "@logic" }, () => {
  expect(casterReachesView({ x: -5, y: 2, z: 0 }, 1, OVERHEAD, FLOOR, EAST)).toBe(false);
  // The sun behind the view: the shadow runs further out.
  const lowEast = { x: Math.SQRT1_2, y: Math.SQRT1_2, z: 0 };
  expect(casterReachesView({ x: -5, y: 2, z: 0 }, 1, lowEast, FLOOR, EAST)).toBe(false);
});

test("a caster outside the view still counts if its shadow can reach in", { tag: "@logic" }, () => {
  // 3.4 m above the floor at 45 degrees: the shadow runs up to 4.4 m east.
  expect(casterReachesView({ x: -4, y: 2, z: 0 }, 1, LOW_WEST, FLOOR, EAST)).toBe(true);
  // Twice as far off, it falls short.
  expect(casterReachesView({ x: -8, y: 2, z: 0 }, 1, LOW_WEST, FLOOR, EAST)).toBe(false);
});

test("a caster's size counts, whichever side its centre is on", { tag: "@logic" }, () => {
  expect(casterReachesView({ x: -0.5, y: 2, z: 0 }, 1, OVERHEAD, FLOOR, EAST)).toBe(true);
  expect(casterReachesView({ x: 3, y: 2, z: 0 }, 1, OVERHEAD, FLOOR, EAST)).toBe(true);
});

test("with no planes, every caster counts", { tag: "@logic" }, () => {
  expect(casterReachesView({ x: -500, y: 2, z: 0 }, 1, OVERHEAD, FLOOR, [])).toBe(true);
});

test("a view's wedge holds what's ahead and leaves out what's behind and beside", { tag: "@logic" }, () => {
  const eye = { x: 3, z: -2 },
    forward = { x: 0, z: -1 },
    // 90 degrees across, seen from above.
    rays = [
      { x: -1, z: -1 },
      { x: 1, z: -1 },
    ],
    planes = viewWedge(eye, forward, rays, 0, 0),
    at = (x, z) => casterReachesView({ x, y: 1, z }, 0.1, OVERHEAD, FLOOR, planes);
  expect(planes).toHaveLength(2);
  expect(at(3, -10)).toBe(true);
  expect(at(0, -10)).toBe(true);
  expect(at(6, -10)).toBe(true);
  expect(at(3, 5)).toBe(false);
  expect(at(-8, -2)).toBe(false);
  expect(at(14, -2)).toBe(false);
});

test("the wedge's margin and step back only ever widen it", { tag: "@logic" }, () => {
  const eye = { x: 0, z: 0 },
    forward = { x: 1, z: 0 },
    rays = [
      { x: 1, z: -1 },
      { x: 1, z: 1 },
    ],
    at = (planes, x, z) => casterReachesView({ x, y: 1, z }, 0, OVERHEAD, FLOOR, planes),
    tight = viewWedge(eye, forward, rays, 0, 0),
    wide = viewWedge(eye, forward, rays, 0.05, 0.5);
  expect(at(tight, -0.1, 0)).toBe(false);
  expect(at(wide, -0.1, 0)).toBe(true);
  expect(at(tight, 5, 5.2)).toBe(false);
  expect(at(wide, 5, 5.2)).toBe(true);
});

test("a view spanning a half turn or more has no wedge", { tag: "@logic" }, () => {
  const rays = [
    { x: -1, z: -0.01 },
    { x: 1, z: -0.01 },
    { x: 0, z: 1 },
  ];
  expect(viewWedge({ x: 0, z: 0 }, { x: 0, z: -1 }, rays, 0.05, 0.5)).toEqual([]);
});
