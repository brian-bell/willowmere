import { test, expect } from "@playwright/test";
import * as T from "three";
import { DEER, ROAM, createHerd, inRoam, roamArea } from "../src/game/deer.js";
import { createDeer } from "../src/deer.js";
import { regionColliders } from "../src/regions/index.js";
import { collides } from "../src/game/navigation.js";
import { WORLD, inVillage, terrainHeight } from "../src/world-layout.js";

const colliders = regionColliders();

test("the deer's range keeps to the hill, the wood and the fields, inside the walk box", { tag: "@logic" }, () => {
  const { walk } = WORLD;
  for (const b of ROAM) {
    expect(b.minX).toBeGreaterThanOrEqual(walk.minX);
    expect(b.maxX).toBeLessThanOrEqual(walk.maxX);
    expect(b.minZ).toBeGreaterThanOrEqual(walk.minZ);
    expect(b.maxZ).toBeLessThanOrEqual(walk.maxZ);
  }
  for (let x = -48; x <= 48; x += 0.5)
    for (let z = -42; z <= 42; z += 0.5) if (inRoam(x, z)) expect(inVillage(x, z), `${x}, ${z}`).toBe(false);
  expect(roamArea(-25, -30)).toBe("orchard");
  expect(roamArea(-35, 0)).toBe("wood");
  expect(roamArea(-35, 30)).toBe("fields");
  expect(roamArea(0, 0)).toBe(null);
});

test("the doe roams all her range and the fawn keeps at her heels, never through a collider", { tag: "@logic" }, () => {
  for (const seed of [1, 2, 3]) {
    const herd = createHerd({ colliders, seed }),
      { doe, fawn } = herd,
      seen = new Set(),
      activities = new Set(),
      problems = [];
    let last = { x: doe.x, z: doe.z },
      lastFawn = { x: fawn.x, z: fawn.z },
      travelled = 0,
      farthest = 0;
    // An hour of game time.
    for (let i = 0; i < 30 * 3600; i++) {
      herd.update(1 / 30, null);
      for (const [a, before, r] of [
        [doe, last, DEER.doe.radius],
        [fawn, lastFawn, DEER.fawn.radius],
      ]) {
        // No jumps: never faster than a deer runs.
        if (Math.hypot(a.x - before.x, a.z - before.z) > 0.2) problems.push(`jump at ${a.x}, ${a.z}`);
        if (i % 10 === 0 && (!inRoam(a.x, a.z) || collides(colliders, a.x, a.z, r - 0.02)))
          problems.push(`blocked at ${a.x}, ${a.z}`);
      }
      travelled += Math.hypot(doe.x - last.x, doe.z - last.z);
      farthest = Math.max(farthest, Math.hypot(doe.x - fawn.x, doe.z - fawn.z));
      last = { x: doe.x, z: doe.z };
      lastFawn = { x: fawn.x, z: fawn.z };
      seen.add(roamArea(doe.x, doe.z));
      activities.add(doe.activity).add(`fawn ${fawn.activity}`);
    }
    expect(problems.slice(0, 5)).toEqual([]);
    expect([...seen].sort()).toEqual(["fields", "orchard", "wood"]);
    expect(travelled).toBeGreaterThan(300);
    expect(farthest).toBeLessThan(5);
    for (const activity of ["graze", "look", "walk", "fawn follow", "fawn play"])
      expect(activities.has(activity), activity).toBe(true);
  }
});

test("a visitor who comes close sends both bounding away, and one who waits is forgiven", { tag: "@logic" }, () => {
  const herd = createHerd({ colliders, seed: 7 }),
    { doe, fawn } = herd;
  for (let i = 0; i < 300; i++) herd.update(1 / 30, null);
  // Walking straight at her.
  const player = { x: doe.x + 15, z: doe.z };
  const seen = new Set();
  let closest = Infinity;
  for (let i = 0; i < 30 * 12; i++) {
    const d = Math.hypot(player.x - doe.x, player.z - doe.z);
    if (d > 1) {
      player.x += ((doe.x - player.x) / d) * 0.1;
      player.z += ((doe.z - player.z) / d) * 0.1;
    }
    herd.update(1 / 30, player);
    seen.add(doe.activity);
    if (i > 30 * 4) closest = Math.min(closest, d);
    expect(Math.hypot(doe.x - fawn.x, doe.z - fawn.z)).toBeLessThan(5);
  }
  expect(seen.has("alert")).toBe(true);
  expect(seen.has("flee")).toBe(true);
  // She outruns a walker.
  expect(closest).toBeGreaterThan(DEER.flee - 1);

  // Standing still nearby: she stares, then goes back to grazing.
  const calm = createHerd({ colliders, seed: 8 });
  for (let i = 0; i < 300; i++) calm.update(1 / 30, null);
  const still = { x: calm.doe.x + 7.5, z: calm.doe.z },
    activities = [];
  for (let i = 0; i < 30 * 20; i++) {
    calm.update(1 / 30, still);
    activities.push(calm.doe.activity);
  }
  expect(activities[30]).toBe("alert");
  expect(activities).not.toContain("flee");
  expect(activities.slice(-30 * 5).some((a) => a === "graze" || a === "step" || a === "look")).toBe(true);
});

test("the doe and fawn are one skinned draw each, stand on the ground and move their joints", { tag: "@logic" }, () => {
  const deer = createDeer(T, { groundHeight: terrainHeight, colliders, avoid: () => [], seed: 3 });
  expect(deer.meshes.map((m) => m.name)).toEqual(["The doe", "The fawn"]);
  for (const mesh of deer.meshes) {
    expect(mesh.isSkinnedMesh).toBe(true);
    const triangles = mesh.geometry.index.count / 3;
    expect(triangles).toBeGreaterThan(3000);
    expect(triangles).toBeLessThan(12000);
    for (const attribute of Object.values(mesh.geometry.attributes))
      expect(attribute.array.every(Number.isFinite)).toBe(true);
  }
  const doe = deer.meshes[0],
    leg = doe.getObjectByName("Front left leg"),
    neck = doe.getObjectByName("Neck");
  const before = [leg.rotation.x, neck.rotation.x];
  let moved = false;
  for (let i = 0; i < 30 * 60; i++) {
    deer.update(1 / 30, null);
    if (leg.rotation.x !== before[0] || neck.rotation.x !== before[1]) moved = true;
    for (const mesh of deer.meshes) {
      const { x, z } = mesh.position;
      // Seated on the ground (a springing fawn leaves it a little).
      expect(mesh.position.y).toBeGreaterThanOrEqual(terrainHeight(x, z) - 1e-6);
      expect(mesh.position.y).toBeLessThan(terrainHeight(x, z) + 0.2);
    }
  }
  expect(moved).toBe(true);
  // The hooves reach the ground in the rest pose.
  const fresh = createDeer(T, { groundHeight: () => 0, colliders, avoid: () => [], seed: 3 });
  for (const mesh of fresh.meshes) {
    mesh.position.set(0, 0, 0);
    mesh.updateMatrixWorld(true);
    // Lowest point of the hooves, and of everything else (a grazing head).
    let hooves = Infinity,
      rest = Infinity;
    const v = new T.Vector3(),
      { position, skinIndex } = mesh.geometry.attributes;
    for (let i = 0; i < position.count; i++) {
      const y = mesh.applyBoneTransform(i, v.fromBufferAttribute(position, i)).y,
        bone = mesh.skeleton.bones[skinIndex.getX(i)].name;
      if (/below/.test(bone)) hooves = Math.min(hooves, y);
      else rest = Math.min(rest, y);
    }
    expect(Math.abs(hooves)).toBeLessThan(0.02);
    expect(rest).toBeGreaterThan(0);
  }
  // Held still with decorative motion off.
  const at = deer.describe();
  for (let i = 0; i < 30; i++) deer.update(1 / 30, null, false);
  expect(deer.describe()).toEqual(at);
});

test("the deer stream in on the map and bolt from a visitor who walks up", async ({ page }) => {
  test.setTimeout(600000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript(() => {
    localStorage.setItem(
      "willowmere.save.v1",
      JSON.stringify({ started: true, quests: { mabel: false, flower: false, plant: false }, plants: [] }),
    );
  });
  await page.goto("/?resolution=fixed");
  await page.waitForFunction(() => window.__willowmere?.getWater().frame > 2);
  await page.waitForFunction(() => window.__willowmere.getDeer().every((d) => d.inScene), null, {
    timeout: 300000,
    polling: 1000,
  });
  // In the open fields south-west of the wood, then a visitor three metres off.
  expect(await page.evaluate(() => window.__willowmere.placeDeer(-35, 29, 1.2))).toBe(true);
  const [doe] = await page.evaluate(() => window.__willowmere.getDeer());
  await page.evaluate(([x, z]) => window.__willowmere.moveTo(x + 3, z), [doe.x, doe.z]);
  await page.waitForFunction(() => window.__willowmere.getDeer()[0].activity === "flee", null, {
    timeout: 30000,
  });
  await page.waitForFunction(
    () => {
      const w = window.__willowmere,
        player = w.getPlayer(),
        [doe, fawn] = w.getDeer();
      return (
        Math.hypot(doe.x - player.x, doe.z - player.z) > 8 &&
        Math.hypot(doe.x - fawn.x, doe.z - fawn.z) < 5
      );
    },
    null,
    { timeout: 60000 },
  );
  expect(errors).toEqual([]);
});
