import { test, expect } from "@playwright/test";
import {
  FACES,
  FOOTPATH,
  GORSE,
  QUARRY as Q,
  TRACK,
  BENCH,
  FLOOR,
  TOP,
  faceDistance,
  findHeight,
  liftAt,
  quarryColliders,
  quarryGrass,
  quarryGround,
  quarryHeight,
  quarryPlanting,
  ridgeHeight,
} from "../src/regions/quarry-layout.js";
import { ORCHARD } from "../src/regions/orchard-layout.js";
import { ALLOTMENTS } from "../src/regions/allotments-layout.js";
import { regionColliders } from "../src/regions/index.js";
import { WORLD, regionAt, terrainHeight } from "../src/world-layout.js";
import { collides } from "../src/game/navigation.js";
import { FOSSILS, FOSSIL_PETALS, agnesTopic, lendHammer, splitStone } from "../src/game/quarry.js";
import { FOSSIL_LINES, FOSSIL_PROMPTS, AGNES_TIPS } from "../src/content/quarry.js";
import { defaultState, loadState } from "../src/game/save.js";
import { journalEntries } from "../src/content/journal.js";

test("the ridge meets the lawn at every edge, and the quarry steps down it in sheer lifts", { tag: "@logic" }, () => {
  const { minX, maxX, minZ, maxZ } = Q.ground;
  for (let t = 0; t <= 1; t += 0.02) {
    const x = minX + (maxX - minX) * t,
      z = minZ + (maxZ - minZ) * t;
    for (const [px, pz] of [
      [x, minZ],
      [x, maxZ],
      [minX, z],
      [maxX, z],
    ])
      expect(quarryHeight(px, pz), `${px}, ${pz}`).toBeCloseTo(0, 6);
  }
  // A few metres high, and lower than the orchard hill, which stays the
  // map's highest ground.
  let highest = 0;
  for (let x = minX; x < maxX; x += 0.25)
    for (let z = minZ; z < maxZ; z += 0.25) highest = Math.max(highest, ridgeHeight(x, z));
  expect(highest).toBeGreaterThan(3);
  expect(highest).toBeLessThan(ORCHARD.height);
  // The floor is level with the lawn, the bench a lift above it, the top
  // another above that; terrainHeight evaluates the cut exactly.
  expect(liftAt(-33, 33)).toBe(FLOOR);
  expect(quarryHeight(-33, 33)).toBe(0);
  expect(liftAt(-39.6, 32)).toBe(BENCH);
  expect(quarryHeight(-39.6, 32)).toBe(Q.bench);
  expect(liftAt(-37, 28.6)).toBe(BENCH);
  expect(quarryHeight(-37, 28.6)).toBe(Q.bench);
  expect(liftAt(-42, 29)).toBe(TOP);
  expect(quarryHeight(-42, 29)).toBeGreaterThan(Q.bench + 1.2);
  expect(terrainHeight(-39.6, 32)).toBe(quarryHeight(-39.6, 32));
  expect(terrainHeight(-38.7, 31)).toBe(Q.bench);
  expect(terrainHeight(-38.5, 31)).toBe(0);
  // Every face runs along the ground mesh's grid, so it is sheer, and its
  // tallest stretch is about a lift high.
  for (const face of FACES) {
    const offset = (face.at - (face.axis === "x" ? minX : minZ)) / Q.step;
    expect(Math.abs(offset - Math.round(offset)), face.id).toBeLessThan(1e-9);
    expect(face.runs.length, face.id).toBeGreaterThan(0);
    const tallest = Math.max(...face.stations.map((s) => s.hi - s.lo));
    expect(tallest, face.id).toBeGreaterThan(Q.bench - 0.15);
    expect(tallest, face.id).toBeLessThan(Q.bench + 0.3);
  }
  // The label names it, south of the wood and west of the allotments.
  expect(regionAt(-33, 33).name).toBe("The stone quarry");
  expect(regionAt(-40, 25).name).toBe("The stone quarry");
  expect(regionAt(-30, 20).name).toBe("The old wood");
  expect(regionAt(-20, 30).name).toBe("The allotments");
});

test("walkers reach the floor, the bench and the ridge's top, but never step off a face", { tag: "@logic" }, () => {
  const colliders = regionColliders(),
    { walk } = WORLD,
    step = 0.2,
    radius = 0.27;
  // Every tall stretch of face blocks walkers on both its sides.
  for (const face of FACES)
    for (const [from, to] of face.runs)
      for (let s = from + 0.1; s < to; s += 0.3)
        for (const side of [-0.35, 0.35]) {
          const [x, z] = face.axis === "x" ? [face.at + side, s] : [s, face.at + side];
          if (z < walk.maxZ - radius) expect(collides(colliders, x, z, radius), `${face.id} ${x}, ${z}`).toBe(true);
        }
  // A flood over the walkable ground from the allotments' west gate, never
  // climbing or dropping more than a stride between neighbours.
  const x0 = walk.minX,
    z0 = 18,
    cols = Math.round((-21 - x0) / step),
    rows = Math.round((walk.maxZ - z0) / step),
    seen = new Uint8Array(cols * rows),
    at = (i, j) => [x0 + i * step, z0 + j * step],
    open = (x, z) =>
      x > walk.minX + radius && x < walk.maxX - radius && z < walk.maxZ - radius && !collides(colliders, x, z, radius);
  const start = [Math.round((ALLOTMENTS.fence.minX - 1 - x0) / step), Math.round((ALLOTMENTS.crossPath.z - z0) / step)];
  expect(open(...at(...start))).toBe(true);
  const queue = [start];
  seen[start[1] * cols + start[0]] = 1;
  while (queue.length) {
    const [i, j] = queue.pop(),
      [x, z] = at(i, j);
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const ni = i + di,
        nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= cols || nj >= rows || seen[nj * cols + ni]) continue;
      const [nx, nz] = at(ni, nj);
      if (!open(nx, nz) || Math.abs(terrainHeight(nx, nz) - terrainHeight(x, z)) > Q.stride) continue;
      seen[nj * cols + ni] = 1;
      queue.push([ni, nj]);
    }
  }
  const reached = (x, z) => {
    const i = Math.round((x - x0) / step),
      j = Math.round((z - z0) / step);
    return [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].some(([di, dj]) => seen[(j + dj) * cols + i + di]);
  };
  // Every fossil's spot, on its own lift, and Agnes's banker.
  for (const fossil of FOSSILS) {
    const spot = Q.finds[fossil.id];
    expect(reached(spot.x, spot.z), fossil.id).toBe(true);
    expect(collides(colliders, spot.x, spot.z, radius), fossil.id).toBe(false);
    expect(liftAt(spot.x, spot.z), fossil.id).toBe({ floor: FLOOR, bench: BENCH, top: TOP }[spot.where]);
    expect(regionAt(spot.x, spot.z).id, fossil.id).toBe("quarry");
  }
  expect(reached(Q.residents.agnes.x + 0.4, Q.residents.agnes.z)).toBe(true);
  // The bench's finds are a lift above the nearest floor a walker reaches,
  // so they answer only from the bench.
  for (const id of ["crinoid", "urchin"]) {
    const spot = Q.finds[id];
    expect(findHeight(id) - quarryGround(spot.x + (id === "urchin" ? 1.4 : 0), spot.z + (id === "crinoid" ? 1.4 : 0))).toBeGreaterThan(1.2);
  }
  // The track runs from the allotments' cross path onto the floor, and the
  // footpath down from the wood's south trail meets it; both are walkable.
  expect(TRACK[0]).toEqual([-23.6, ALLOTMENTS.crossPath.z]);
  expect(liftAt(...TRACK.at(-1))).toBe(FLOOR);
  for (const [x, z] of [...TRACK, ...FOOTPATH]) {
    expect(collides(colliders, x, z, radius), `${x}, ${z}`).toBe(false);
    expect(quarryGrass(x, z)).toBe(false);
    expect(quarryPlanting(x, z)).toBe(false);
  }
});

test("grass grows on the ridge and the lawn, never on the cut stone", { tag: "@logic" }, () => {
  const share = (minX, maxX, minZ, maxZ, allows = quarryGrass) => {
    let grows = 0,
      all = 0;
    for (let x = minX; x < maxX; x += 0.13)
      for (let z = minZ; z < maxZ; z += 0.17) {
        all++;
        if (allows(x, z)) grows++;
      }
    return grows / all;
  };
  // The ridge's untouched top (between its gorse), the floor at the faces'
  // feet, and the bench.
  expect(share(-45, -42, 24, 32)).toBeGreaterThan(0.7);
  expect(share(-37.5, -33.5, 32, 34)).toBeLessThan(0.05);
  expect(share(-40.3, -38.9, 30, 34)).toBeLessThan(0.05);
  for (const [x, z] of GORSE) {
    expect(quarryGrass(x, z)).toBe(false);
    expect(liftAt(x, z)).toBe(TOP);
  }
  // Nothing to plant on the floor, the bench or the faces.
  expect(quarryPlanting(-34, 33)).toBe(false);
  expect(quarryPlanting(-39.6, 31)).toBe(false);
  expect(faceDistance(-38.6, 31)).toBe(0);
  expect(share(-45, -42, 24, 32, quarryPlanting)).toBeGreaterThan(0.6);
  expect(quarryColliders()[0].blocks(-38.6, 31, 0.27)).toBe(true);
});

test("Agnes lends her hammer, and each fossil is found once", { tag: "@logic" }, () => {
  const state = defaultState(),
    start = state.coins;
  expect(state).toMatchObject({ fossils: {}, hammer: false });
  // Without the hammer the stone keeps its secrets, and Agnes offers hers.
  expect(splitStone(state, "ammonite")).toMatchObject({ kind: "no-hammer" });
  expect(agnesTopic(state)).toEqual({ topic: "hammer" });
  expect(lendHammer(state)).toBe(true);
  expect(lendHammer(state)).toBe(false);
  expect(agnesTopic(state)).toMatchObject({ topic: "seek", fossil: FOSSILS[0] });
  expect(splitStone(state, "ammonite")).toMatchObject({ kind: "found", petals: FOSSIL_PETALS });
  expect(splitStone(state, "ammonite")).toMatchObject({ kind: "again" });
  expect(state.coins).toBe(start + FOSSIL_PETALS);
  expect(agnesTopic(state).fossil.id).not.toBe("ammonite");
  for (const fossil of FOSSILS) splitStone(state, fossil.id);
  expect(state.coins).toBe(start + FOSSILS.length * FOSSIL_PETALS);
  expect(agnesTopic(state)).toEqual({ topic: "done" });
  // Every fossil has its place, its prompt, its line and Agnes's tip.
  for (const fossil of FOSSILS) {
    expect(Q.finds[fossil.id], fossil.id).toBeTruthy();
    expect(FOSSIL_PROMPTS[fossil.id], fossil.id).toBeTruthy();
    expect(FOSSIL_LINES[fossil.id], fossil.id).toBeTruthy();
    expect(AGNES_TIPS[fossil.id], fossil.id).toBeTruthy();
  }
  // The journal's entry appears at the quarry, and counts the finds.
  expect(journalEntries(defaultState(), "green").some(([title]) => title === "The stone quarry")).toBe(false);
  expect(journalEntries(defaultState(), "quarry").some(([title]) => title === "The stone quarry")).toBe(true);
  const entry = journalEntries(state, "green").find(([title]) => title === "The stone quarry");
  expect(entry[1]).toContain(`${FOSSILS.length} of ${FOSSILS.length} fossils`);
  // Saves from before the quarry get its state.
  const storage = () => ({
    getItem: () => JSON.stringify({ quests: { mabel: true }, plants: [], coins: 9 }),
  });
  expect(loadState(storage).state).toMatchObject({ coins: 9, fossils: {}, hammer: false });
});

test("the quarry streams in, Agnes lends her hammer, and fossils turn up on the floor and the bench", async ({
  page,
}) => {
  test.setTimeout(1800000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem(
      "willowmere.save.v1",
      JSON.stringify({
        started: true,
        quests: { mabel: false, flower: false, plant: false },
        plants: [],
      }),
    );
  });
  await page.goto("/?resolution=fixed");
  await page.waitForFunction(() => window.__willowmere?.getWater().frame > 2);
  // Beside Agnes's banker, which puts the quarry's jobs first in the
  // streamer's queue.
  const agnes = Q.residents.agnes;
  await page.evaluate(({ x, z }) => window.__willowmere.moveTo(x + 0.5, z + 0.45), agnes);
  const expected = ["Quarry ground", "Quarry faces", "Quarry works", "Quarry track", "Quarry gorse"];
  await expect
    .poll(
      async () => {
        const names = new Set(
          (await page.evaluate(() => window.__willowmere.getChunks()))
            .flatMap((chunk) => chunk.meshes)
            .map((mesh) => mesh.name),
        );
        const { agnes } = await page.evaluate(() => window.__willowmere.getQuarry());
        return [...expected.filter((name) => !names.has(name)), ...(agnes ? [] : ["Agnes"])];
      },
      { timeout: 900000, intervals: [5000] },
    )
    .toEqual([]);
  await expect(page.locator("#location-name")).toHaveText("The stone quarry");
  const talk = async () => {
    await page.keyboard.press("e");
    await expect(page.locator("#dialogue")).toBeVisible({ timeout: 60000 });
    for (let i = 0; i < 4 && (await page.locator("#dialogue").isVisible()); i++) await page.keyboard.press("e");
    await expect(page.locator("#dialogue")).toBeHidden({ timeout: 60000 });
  };
  // Before the hammer, a spot only says to ask Agnes.
  const spot = (id) => Q.finds[id];
  await page.evaluate(({ x, z }) => window.__willowmere.moveTo(x, z), spot("ammonite"));
  await expect(page.locator("#interaction span")).toHaveText(FOSSIL_PROMPTS.ammonite, { timeout: 60000 });
  await talk();
  expect((await page.evaluate(() => window.__willowmere.getQuarry())).fossils).toEqual({});
  // Agnes lends it.
  await page.evaluate(({ x, z }) => window.__willowmere.moveTo(x + 0.5, z + 0.45), agnes);
  await expect(page.locator("#interaction span")).toHaveText("Say hello to Agnes", { timeout: 60000 });
  await talk();
  let quarry = await page.evaluate(() => window.__willowmere.getQuarry());
  expect(quarry.hammer).toBe(true);
  // An ammonite from the spoil heap.
  await page.evaluate(({ x, z }) => window.__willowmere.moveTo(x, z), spot("ammonite"));
  await expect(page.locator("#interaction span")).toHaveText(FOSSIL_PROMPTS.ammonite, { timeout: 60000 });
  await talk();
  quarry = await page.evaluate(() => window.__willowmere.getQuarry());
  expect(quarry.fossils).toEqual({ ammonite: true });
  expect(quarry.coins).toBe(120 + FOSSIL_PETALS);
  // Beneath the bench, the crinoids up on it do not answer; on the bench
  // they do.
  const crinoid = spot("crinoid");
  await page.evaluate(({ x, z }) => window.__willowmere.moveTo(x, z + 1.45), crinoid);
  await page.waitForTimeout(600);
  await expect(page.locator("#interaction span")).not.toHaveText(FOSSIL_PROMPTS.crinoid);
  await page.evaluate(({ x, z }) => window.__willowmere.moveTo(x, z), crinoid);
  await expect(page.locator("#interaction span")).toHaveText(FOSSIL_PROMPTS.crinoid, { timeout: 60000 });
  await talk();
  quarry = await page.evaluate(() => window.__willowmere.getQuarry());
  expect(quarry.fossils).toEqual({ ammonite: true, crinoid: true });
  await page.locator("#journal-button").click();
  await expect(page.locator("#journal-content")).toContainText("2 of 6 fossils");
  expect(errors).toEqual([]);
});
