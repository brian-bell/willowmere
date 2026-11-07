import { test, expect } from "@playwright/test";
import {
  BARROWS,
  barrowHeight,
  barrowLandmarks,
  barrowsColliders,
  barrowsDeck,
  barrowsGrass,
  groundUnder,
  moundHeight,
} from "../src/regions/barrows-layout.js";
import { MILLPOND, pondShore, millpondColliders } from "../src/regions/millpond-layout.js";
import { FRUIT_TREES, pathDistance } from "../src/regions/orchard-layout.js";
import { allowsGrass, allowsPlanting, regionColliders, regionDeck } from "../src/regions/index.js";
import { WORLD, regionAt, terrainHeight } from "../src/world-layout.js";
import { collides, createNavigation } from "../src/game/navigation.js";
import { LANDMARK_LINES } from "../src/content/landmarks.js";

// Every sample point over a mound's footprint, with its height.
function* footprint(m, step = 0.2) {
  const R = (m.half ?? 0) + m.r;
  for (let x = m.x - R; x <= m.x + R; x += step)
    for (let z = m.z - R; z <= m.z + R; z += step) {
      const h = moundHeight(m, x, z);
      if (h > 0) yield { x, z, h };
    }
}

test("the barrows lie on dry ground either side of the millpond", { tag: "@logic" }, () => {
  const west = BARROWS.mounds.filter((m) => m.side === "west"),
    east = BARROWS.mounds.filter((m) => m.side === "east");
  expect(west.length).toBeGreaterThan(0);
  expect(east.length).toBeGreaterThan(0);
  for (const m of west) expect(m.x + m.r).toBeLessThan(MILLPOND.centre.x - MILLPOND.radii.x);
  for (const m of east)
    expect(m.x - (m.half ?? 0) - m.r).toBeGreaterThan(MILLPOND.centre.x + MILLPOND.radii.x);
  for (const m of BARROWS.mounds) {
    // The long barrow is the tallest, not much above a person's head.
    expect(m.h).toBeLessThanOrEqual(1.8);
    for (const { x, z } of footprint(m, 0.4)) {
      // Clear of the pond's water and its bank's waterline, the orchard's
      // path and trees, and inside the map's ground.
      expect(pondShore(x, z), `${m.id} ${x}, ${z}`).toBeLessThan(-1.2);
      expect(pathDistance(x, z)).toBeGreaterThan(1);
      for (const t of FRUIT_TREES) expect(Math.hypot(x - t.x, z - t.z)).toBeGreaterThan(1.5);
      expect(x).toBeGreaterThan(WORLD.ground.minX + 1);
      expect(z).toBeGreaterThan(WORLD.ground.minZ + 1);
      // Nowhere does the ground under a mound climb much: the pond's bank
      // and the hill's foot at most.
      expect(groundUnder(x, z) - BARROWS.lawn).toBeLessThan(0.3);
      expect(groundUnder(x, z)).toBeCloseTo(terrainHeight(x, z) + 0.05, 1);
    }
    // Its crown stands within the walk box, so the player can climb it.
    const { walk } = WORLD;
    expect(m.x > walk.minX && m.x < walk.maxX && m.z > walk.minZ && m.z < walk.maxZ, m.id).toBe(true);
  }
  // The label names them on both sides.
  expect(regionAt(-1.1, -32.6).name).toBe("The old barrows");
  expect(regionAt(31.4, -32.6).name).toBe("The old barrows");
  expect(regionAt(12.5, -31.2).name).toBe("The millpond");
});

test("the player walks over the mounds, never through their stones", { tag: "@logic" }, () => {
  const colliders = regionColliders();
  let steepest = 0;
  for (const m of BARROWS.mounds) {
    // On the crown, the walking surface is the mound's top.
    const top = regionDeck(m.x, m.z);
    expect(top, m.id).not.toBeNull();
    expect(top).toBeCloseTo(groundUnder(m.x, m.z) + moundHeight(m, m.x, m.z) - BARROWS.sink, 6);
    expect(top - groundUnder(m.x, m.z)).toBeGreaterThan(m.h * 0.8);
    for (const { x, z } of footprint(m, 0.25)) {
      // The long barrow's doorway stands where its notch is cut steeply.
      if (collides(colliders, x, z, 0.2)) continue;
      const here = barrowsDeck(x, z) ?? groundUnder(x, z),
        dx = (barrowsDeck(x + 0.05, z) ?? groundUnder(x + 0.05, z)) - (barrowsDeck(x - 0.05, z) ?? groundUnder(x - 0.05, z)),
        dz = (barrowsDeck(x, z + 0.05) ?? groundUnder(x, z + 0.05)) - (barrowsDeck(x, z - 0.05) ?? groundUnder(x, z - 0.05));
      expect(here).toBeGreaterThanOrEqual(groundUnder(x, z));
      steepest = Math.max(steepest, Math.hypot(dx, dz) / 0.1);
    }
  }
  // Steeper than the hill, but a scramble rather than a wall.
  expect(steepest).toBeLessThan(1.3);
  // Off the mounds, the ground is the terrain's.
  expect(barrowsDeck(20, -10)).toBeNull();
  expect(barrowsDeck(-1.1 + 3.2, -32.6)).toBeNull();

  expect(colliders).toEqual(expect.arrayContaining(barrowsColliders()));
  for (const c of barrowsColliders()) expect(collides(colliders, c.x, c.z)).toBe(true);
  // The barrows' stones keep clear of the pond's own colliders.
  for (const c of barrowsColliders())
    for (const p of millpondColliders())
      if ("r" in p) expect(Math.hypot(c.x - p.x, c.z - p.z)).toBeGreaterThan(c.r + p.r);

  // Every place E answers can be walked to from the village, and so can the
  // mounds' crowns.
  const { findPath } = createNavigation({ walk: WORLD.walk, colliders }),
    from = { x: 6, z: -12 };
  for (const l of barrowLandmarks()) {
    expect(collides(colliders, l.x, l.z, 0.3), l.id).toBe(false);
    expect(findPath(from, l).length, l.id).toBeGreaterThan(5);
    expect(LANDMARK_LINES[l.id]?.length, l.id).toBeGreaterThan(2);
  }
  for (const m of BARROWS.mounds) expect(findPath(from, m).length, m.id).toBeGreaterThan(5);
});

test("meadow grass stops at the mounds' feet and flowers aren't planted on them", { tag: "@logic" }, () => {
  for (const m of BARROWS.mounds) {
    expect(barrowsGrass(m.x, m.z)).toBe(false);
    expect(allowsGrass(m.x, m.z)).toBe(false);
    expect(allowsPlanting(m.x, m.z)).toBe(false);
    // The lawn just beyond each mound's foot still grows.
    const R = (m.half ?? 0) + m.r + 0.6;
    expect(barrowHeight(m.x, m.z - R)).toBe(0);
  }
  expect(barrowsGrass(31.4, -28)).toBe(true);
  expect(barrowsGrass(20, -10)).toBe(true);
});
