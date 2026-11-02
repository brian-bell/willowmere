import { test, expect } from "@playwright/test";
import { createNavigation } from "../src/game/navigation.js";
import { regionColliders } from "../src/regions/index.js";
import { WORLD } from "../src/world-layout.js";
import { MILLPOND } from "../src/regions/millpond-layout.js";

const walk = { minX: -10, maxX: 10, minZ: -8, maxZ: 8 };
const steps = (route, start) =>
  route.map((p, i) => {
    const from = i ? route[i - 1] : start;
    return Math.hypot(p.x - from.x, p.z - from.z);
  });

test("the walk box, circles, boxes and shaped colliders block walking", { tag: "@logic" }, () => {
  const shaped = {
    minX: 4,
    maxX: 6,
    minZ: -6,
    maxZ: -4,
    blocks: (x, z, r) => Math.hypot(x - 5, z + 5) < 1 + r,
  };
  const { blocked } = createNavigation({
    walk,
    colliders: [{ x: 0, z: 0, r: 1 }, { x: -5, z: 3, w: 2, d: 4 }, shaped],
  });
  expect(blocked(0, 0)).toBe(true);
  expect(blocked(1.2, 0)).toBe(true);
  expect(blocked(1.3, 0)).toBe(false);
  expect(blocked(-5, 4.9)).toBe(true);
  expect(blocked(-5, 5.3)).toBe(false);
  expect(blocked(5, -5)).toBe(true);
  expect(blocked(5, -3.6)).toBe(false);
  // The radius keeps the walker inside the walk box.
  expect(blocked(9.8, 0)).toBe(true);
  expect(blocked(9.7, 0)).toBe(false);
  expect(blocked(9.7, 0, 0.4)).toBe(true);
});

test("routes go around colliders and end exactly at the goal", { tag: "@logic" }, () => {
  // A wall across the middle with a gap at its north end.
  const { blocked, findPath } = createNavigation({
    walk,
    colliders: [{ x: 0, z: 1, w: 1, d: 14 }],
  });
  const start = { x: -6, z: 0 },
    goal = { x: 6, z: 0 },
    route = findPath(start, goal);
  expect(route.length).toBeGreaterThan(0);
  expect(route.at(-1)).toEqual(goal);
  expect(route.filter((p) => blocked(p.x, p.z, 0.3))).toEqual([]);
  // Diagonal steps on a 0.65 m grid, then the hop onto the goal.
  for (const d of steps(route.slice(0, -1), route[0]).slice(1)) expect(d).toBeLessThan(0.93);
  // It passes through the gap, south of the wall's end.
  expect(Math.min(...route.map((p) => p.z))).toBeLessThan(-6);
});

test("blocked and unreachable goals have no route", { tag: "@logic" }, () => {
  const { findPath } = createNavigation({
    walk,
    // A ring of boxes closes off the middle.
    colliders: [
      { x: 0, z: 3, w: 8, d: 1 },
      { x: 0, z: -3, w: 8, d: 1 },
      { x: 3.5, z: 0, w: 1, d: 7 },
      { x: -3.5, z: 0, w: 1, d: 7 },
    ],
  });
  expect(findPath({ x: -7, z: 6 }, { x: 0, z: 0 })).toEqual([]);
  expect(findPath({ x: -7, z: 6 }, { x: 0, z: 3 })).toEqual([]);
  expect(findPath({ x: -7, z: 6 }, { x: 30, z: 0 })).toEqual([]);
  expect(findPath({ x: -7, z: 6 }, { x: 7, z: -6 }).length).toBeGreaterThan(0);
});

test("the route grid samples in rows until a deadline", { tag: "@logic" }, () => {
  const navigation = createNavigation({ walk: WORLD.walk, colliders: regionColliders() });
  expect(navigation.route.cols).toBe(139);
  expect(navigation.route.rows).toBe(117);
  // A past deadline still samples one row.
  expect(navigation.sampleRows(0)).toBe(false);
  expect(navigation.sampleRows()).toBe(true);
  // The millpond's jetty reaches out over water that blocks walking.
  const { jetty } = MILLPOND,
    from = { x: jetty.x, z: jetty.maxZ + 3 },
    end = { x: jetty.x, z: jetty.minZ + 0.4 },
    route = navigation.findPath(from, end);
  expect(route.length).toBeGreaterThan(0);
  expect(navigation.blocked(jetty.x + jetty.halfWidth + 0.3, -29)).toBe(true);
});
