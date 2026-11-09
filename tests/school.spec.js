import { test, expect } from "@playwright/test";
import * as T from "three";
import {
  FENCE_RUNS,
  PITCH,
  SCHOOL as S,
  SCHOOL_PATH,
  goalPosts,
  onPlayground,
  schoolColliders,
  schoolGrass,
  schoolPlanting,
  swingFeet,
} from "../src/regions/school-layout.js";
import { regionColliders, regions } from "../src/regions/index.js";
import { WORLD, regionAt, terrainHeight } from "../src/world-layout.js";
import { collides, createNavigation } from "../src/game/navigation.js";
import { createMatch, MATCH } from "../src/game/school.js";
import { createKids } from "../src/regions/school-kids.js";
import { SCHOOL_CHILDREN } from "../src/content/school.js";

const bounds = { minX: S.fence.minX + 0.12, maxX: S.fence.maxX - 0.12, minZ: S.yard.minZ + 0.1, maxZ: S.fence.maxZ - 0.12 };
const inside = (b, x, z, margin = 0) =>
  x >= b.minX - margin && x <= b.maxX + margin && z >= b.minZ - margin && z <= b.maxZ + margin;

test("the school lies flat in the south-east corner, railed, with a path to its gate", { tag: "@logic" }, () => {
  // Flat, on the fields' own grass, inside the map and clear of every other
  // region's ground.
  for (let x = S.fence.minX; x <= S.fence.maxX; x += 1)
    for (let z = S.fence.minZ; z <= S.fence.maxZ; z += 1) {
      expect(terrainHeight(x, z)).toBe(0);
      expect(regionAt(x, z).name).toBe("The village school");
      expect(regions.some((r) => r.ground && inside(r.ground, x, z))).toBe(false);
    }
  // East of the village island, so none of its houses or paths reach in.
  expect(S.fence.minX).toBeGreaterThan(WORLD.village.maxX);
  // The pitch, the playground and the buildings stand where walkers can go.
  for (const b of [S.pitch, S.yard]) {
    expect(b.minX).toBeGreaterThan(WORLD.walk.minX);
    expect(b.maxX).toBeLessThan(WORLD.walk.maxX);
    expect(b.maxZ).toBeLessThan(WORLD.walk.maxZ);
  }
  const colliders = schoolColliders();
  // The railings close everywhere but the gate, where the path comes in.
  for (const [x1, z1, x2, z2] of FENCE_RUNS)
    for (let t = 0.05; t < 1; t += 0.1) expect(collides(colliders, x1 + (x2 - x1) * t, z1 + (z2 - z1) * t)).toBe(true);
  for (const [x, z] of SCHOOL_PATH) {
    expect(collides(regionColliders(), x, z), `path ${x} ${z}`).toBe(false);
    expect(schoolGrass(x, z)).toBe(false);
    expect(schoolPlanting(x, z)).toBe(false);
  }
  // Buildings, swings and goal posts block walking; the pitch and the
  // playground grow no meadow grass, and nothing is planted inside the lot.
  for (const b of [S.school, S.porch, S.house]) expect(collides(colliders, b.x, b.z)).toBe(true);
  for (const [x, z] of [...swingFeet(), ...goalPosts()]) expect(collides(colliders, x, z, 0.05)).toBe(true);
  for (let x = S.pitch.minX; x <= S.pitch.maxX; x += 0.7)
    for (let z = S.yard.minZ + 0.2; z <= S.pitch.maxZ; z += 0.7) {
      expect(onPlayground(x, z) || schoolGrass(x, z)).toBe(true);
      expect(schoolPlanting(x, z)).toBe(false);
    }
  expect(schoolGrass(PITCH.x, PITCH.z)).toBe(false);
  expect(schoolGrass(25, 20)).toBe(true);
  expect(schoolGrass(-30, 30)).toBe(true);
});

test("walkers reach the playground, the pitch, Miss Juniper and the swings from the market", { tag: "@logic" }, () => {
  const colliders = schoolColliders();
  const { findPath } = createNavigation({ walk: WORLD.walk, colliders: regionColliders() });
  const from = { x: 33.5, z: 4 },
    spots = {
      door: { x: S.porch.x, z: S.porch.z + S.porch.d / 2 + 0.6 },
      board: { x: S.board.x - 0.1, z: S.board.z - 0.7 },
      swings: { x: S.swings.x, z: S.swings.z + 1.6 },
      centre: { x: PITCH.x, z: PITCH.z + 1.5 },
      east: { x: PITCH.goals[1] - 1.5, z: PITCH.z },
      west: { x: PITCH.goals[0] + 1.5, z: PITCH.z },
      corner: { x: S.bench.x + 0.7, z: S.bench.z },
    };
  for (const [id, at] of Object.entries(spots)) {
    expect(collides(colliders, at.x, at.z, 0.3), id).toBe(false);
    expect(findPath(from, at).length, id).toBeGreaterThan(3);
  }
  // Miss Juniper stands on the touchline, clear of every footing.
  const { juniper } = S.residents;
  expect(collides(colliders, juniper.x, juniper.z, 0.25)).toBe(false);
  expect(juniper.z).toBeGreaterThan(S.yard.maxZ);
  expect(juniper.z).toBeLessThan(S.pitch.minZ);
});

test("the match keeps ball and children inside the railings, and both sides score", { tag: "@logic" }, () => {
  const obstacles = [
    { minX: S.porch.x - S.porch.w / 2, maxX: S.porch.x + S.porch.w / 2, minZ: S.porch.z - S.porch.d / 2, maxZ: S.porch.z + S.porch.d / 2 },
    { x: S.residents.juniper.x, z: S.residents.juniper.z, r: 0.32 },
  ];
  const match = createMatch({ pitch: S.pitch, goal: S.goal, bounds, obstacles, seed: 4 });
  expect(match.kids).toHaveLength(8);
  expect(match.kids.filter((k) => k.keeper)).toHaveLength(2);
  const goals = [];
  match.onGoal = (team, scorer) => goals.push({ team, scorer, time: match.phaseTime });
  let catches = 0,
    held = null,
    kicks = 0,
    cheers = 0;
  // Checked by hand each step and asserted once: 27,000 steps of expect()
  // calls would take minutes.
  const strays = [];
  for (let i = 0; i < 30 * 60 * 15; i++) {
    match.update(1 / 30);
    const b = match.ball;
    if (!(Number.isFinite(b.x) && Number.isFinite(b.z) && Number.isFinite(b.y)) || !inside(bounds, b.x, b.z, 1e-6) || b.y < 0)
      strays.push(`ball at step ${i}: ${b.x}, ${b.y}, ${b.z}`);
    if (b.heldBy && b.heldBy !== held) catches++;
    held = b.heldBy;
    for (const k of match.kids) {
      if (!inside(bounds, k.x, k.z, 1e-6) || !Number.isFinite(k.heading)) strays.push(`${k.id} at step ${i}: ${k.x}, ${k.z}`);
      if (k.action === "kick" && k.actionTime === 1 / 30) kicks++;
      if (k.action === "cheer" && k.actionTime === 1 / 30) cheers++;
    }
  }
  expect(strays.slice(0, 5)).toEqual([]);
  // A lively game: goals for both sides every minute or two, saves, kicks
  // and celebrations, and the score agrees with the goals called.
  expect(goals.length).toBeGreaterThan(5);
  expect(goals.length).toBeLessThan(15 * 6);
  expect(goals.some((g) => g.team === 0) && goals.some((g) => g.team === 1)).toBe(true);
  expect(match.score[0] + match.score[1]).toBe(goals.length);
  expect(catches).toBeGreaterThan(10);
  expect(kicks).toBeGreaterThan(200);
  expect(cheers).toBeGreaterThan(0);
  // Each side's keeper keeps to its own end.
  for (const k of match.kids.filter((k) => k.keeper))
    expect(Math.abs(k.x - PITCH.goals[k.team])).toBeLessThan(3);
});

test("a visitor who walks into the ball kicks it the way they walk, and can score", { tag: "@logic" }, () => {
  const match = createMatch({ pitch: S.pitch, goal: S.goal, bounds, seed: 9 });
  // Children well away, so nobody gets there first.
  for (const k of match.kids) Object.assign(k, { x: S.pitch.minX + 1, z: S.pitch.minZ + 0.5, keeper: false });
  Object.assign(match.ball, { x: PITCH.x, z: PITCH.z, vx: 0, vz: 0 });
  const walker = { x: PITCH.x - 0.45, z: PITCH.z, vx: 3, vz: 0 };
  match.update(1 / 30, walker);
  expect(match.ball.vx).toBeGreaterThan(5);
  expect(Math.abs(match.ball.vz)).toBeLessThan(0.5);
  expect(match.lastTouch).toBe("walker");
  // Standing still, the ball stops against their feet instead.
  const still = createMatch({ pitch: S.pitch, goal: S.goal, bounds, seed: 9 });
  for (const k of still.kids) Object.assign(k, { x: S.pitch.minX + 1, z: S.pitch.minZ + 0.5, keeper: false });
  Object.assign(still.ball, { x: PITCH.x, z: PITCH.z, vx: -3, vz: 0 });
  still.update(1 / 30, { x: PITCH.x - 0.45, z: PITCH.z, vx: 0, vz: 0 });
  expect(still.ball.vx).toBeGreaterThan(-0.5);
  // A kick from in front of the east goal goes in, and is the walker's.
  const shot = createMatch({ pitch: S.pitch, goal: S.goal, bounds, seed: 2 });
  for (const k of shot.kids) Object.assign(k, { x: S.pitch.minX + 1, z: S.pitch.minZ + 0.5, keeper: false });
  const goals = [];
  shot.onGoal = (team, scorer) => goals.push([team, scorer]);
  Object.assign(shot.ball, { x: PITCH.goals[1] - 2, z: PITCH.z, vx: 0, vz: 0 });
  shot.update(1 / 30, { x: PITCH.goals[1] - 2.45, z: PITCH.z, vx: 3, vz: 0 });
  for (let i = 0; i < 60; i++) shot.update(1 / 30, null);
  expect(goals).toEqual([[0, "walker"]]);
  expect(shot.ball.inNet).toBe(1);
  expect(shot.phase).toBe("goal");
});

test("the children are one skinned draw, a coarser one far out, posed from the match", { tag: "@logic" }, () => {
  const builder = createKids(T, { groundHeight: () => 0.06, player: null, obstacles: [] });
  let meshes;
  for (let i = 0; i < 100 && !meshes; i++) meshes = builder.step(0);
  expect(meshes).toBeTruthy();
  const kids = builder.kids,
    [near, far, contacts] = meshes;
  expect(near.isSkinnedMesh && far.isSkinnedMesh).toBe(true);
  expect(far.skeleton).toBe(near.skeleton);
  expect(contacts.count).toBe(SCHOOL_CHILDREN.length + 1);
  const triangles = (m) => m.geometry.index.count / 3;
  // Eleven children: under a standing grown-up's 10,500 triangles each up
  // close, a quarter of that far out.
  expect(triangles(near)).toBeLessThan(SCHOOL_CHILDREN.length * 7000);
  expect(triangles(far)).toBeLessThan(triangles(near) / 3);
  for (const mesh of [near, far])
    for (const attribute of Object.values(mesh.geometry.attributes))
      expect(attribute.array.every(Number.isFinite)).toBe(true);
  // Each footballer's root bone stands where the match puts them, and the
  // culling sphere holds every child.
  for (let i = 0; i < 30 * 20; i++) kids.update(1 / 30, i, false);
  near.updateMatrixWorld(true);
  const roots = near.skeleton.bones.filter((b) => b.name.endsWith(": root"));
  expect(roots).toHaveLength(SCHOOL_CHILDREN.length);
  const p = new T.Vector3();
  kids.match.kids.forEach((k, i) => {
    roots[i].getWorldPosition(p);
    expect(Math.hypot(p.x - k.x, p.z - k.z)).toBeLessThan(1e-6);
    expect(p.y).toBeGreaterThanOrEqual(0.06 - 1e-6);
  });
  for (const root of roots) {
    root.getWorldPosition(p);
    expect(near.boundingSphere.distanceToPoint(p)).toBeLessThanOrEqual(-1);
  }
  // Far out, the coarse copy draws instead and nobody casts a shadow.
  kids.update(1 / 30, -1, true);
  expect([near.visible, far.visible, near.castShadow]).toEqual([false, true, false]);
  kids.update(1 / 30, -2, false);
  expect([near.visible, far.visible, near.castShadow]).toEqual([true, false, true]);
  // Held still with decorative motion off (no time passes).
  const at = JSON.stringify(kids.describe());
  kids.update(0, -3, false);
  expect(JSON.stringify(kids.describe())).toBe(at);
});

test("the school streams in, Miss Juniper watches, and the children play", async ({ page }) => {
  test.setTimeout(1200000);
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
  // Standing on the touchline puts the school's jobs first in the queue.
  await page.evaluate(({ x, z }) => window.__willowmere.moveTo(x, z), { x: PITCH.x - 3, z: S.yard.maxZ + 0.5 });
  const expected = ["School grounds", "School path", "Schoolroom", "Schoolroom glass", "Schoolhouse and playground"];
  await expect
    .poll(
      async () => {
        const names = new Set(
          (await page.evaluate(() => window.__willowmere.getChunks()))
            .flatMap((chunk) => chunk.meshes)
            .map((mesh) => mesh.name),
        );
        const { juniper, match } = await page.evaluate(() => window.__willowmere.getSchool());
        return [
          ...expected.filter((name) => !names.has(name)),
          ...(juniper ? [] : ["Miss Juniper"]),
          ...(match?.inScene ? [] : ["the children"]),
        ];
      },
      { timeout: 900000, intervals: [5000] },
    )
    .toEqual([]);
  await expect(page.locator("#location-name")).toHaveText("The village school");
  // The match goes on: the ball and the children move.
  const before = (await page.evaluate(() => window.__willowmere.getSchool())).match;
  await expect
    .poll(
      async () => {
        const { match } = await page.evaluate(() => window.__willowmere.getSchool());
        return match.kids.some((k, i) => Math.hypot(k.x - before.kids[i].x, k.z - before.kids[i].z) > 0.5);
      },
      { timeout: 120000 },
    )
    .toBe(true);
  // The ball, set still at the visitor's feet, is theirs to kick.
  expect(await page.evaluate(({ x, z }) => window.__willowmere.placeSchoolBall(x, z), { x: PITCH.x - 3, z: S.yard.maxZ + 1.5 })).toBe(true);
  expect(errors).toEqual([]);
});
