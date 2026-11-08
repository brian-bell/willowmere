import { test, expect } from "@playwright/test";
import {
  LANE,
  MARKET,
  PATHS,
  bridgeDeck,
  hedgeClumps,
  marketColliders,
  marketGrass,
  onGravel,
  stallFront,
} from "../src/regions/market-layout.js";
import { regionColliders } from "../src/regions/index.js";
import { WORLD, inVillage, regionAt, terrainHeight } from "../src/world-layout.js";
import { collides, createNavigation } from "../src/game/navigation.js";
import {
  DELIVERY,
  STALLS,
  buyFromStall,
  deliverLoaf,
  finnDelivery,
  stallOffer,
} from "../src/game/market.js";
import { defaultState, loadState } from "../src/game/save.js";

test("the lane runs from the mill road to the map's edge, flat and clear", { tag: "@logic" }, () => {
  // It leaves the village by the mill road and ends at the rim.
  expect(inVillage(...LANE[0])).toBe(true);
  expect(LANE.at(-1)[0]).toBeGreaterThanOrEqual(WORLD.ground.maxX);
  const colliders = marketColliders();
  // The door paths start at the doors, so their first steps meet the walls.
  const [toBridge, toGardens, ...toDoors] = PATHS;
  for (const [x, z] of [...LANE, ...toBridge, ...toGardens, ...toDoors.flatMap((p) => p.slice(4))]) {
    if (x > WORLD.walk.maxX - 0.3) continue;
    // Nothing of the market's stands on its gravel, and no grass grows there.
    expect(collides(colliders, x, z), `${x}, ${z}`).toBe(false);
    expect(marketGrass(x, z)).toBe(false);
    // The lane stays as flat as the village.
    expect(terrainHeight(x, z)).toBe(0);
  }
  // Grass grows beside it, not under the buildings or stalls.
  expect(marketGrass(33.5, 13)).toBe(true);
  expect(marketGrass(MARKET.teaRoom.x, MARKET.teaRoom.z)).toBe(false);
  for (const stall of MARKET.stalls) {
    expect(marketGrass(stall.x, stall.z)).toBe(false);
    expect(collides(colliders, stall.x, stall.z)).toBe(true);
    // A shopper can stand at each counter, on the square's gravel.
    const front = stallFront(stall);
    expect(collides(colliders, front.x, front.z), stall.id).toBe(false);
    expect(onGravel(front.x, front.z, 0.3), stall.id).toBe(true);
  }
  for (const resident of Object.values(MARKET.residents))
    expect(collides(colliders, resident.x, resident.z, 0.2)).toBe(false);
  expect(regionAt(MARKET.square.x, MARKET.square.z).name).toBe("The market lane");
  // Its shrubs and hedgerow clumps are walked through; nothing else is.
  const soft = colliders.filter((c) => c.passable);
  expect(soft.length).toBe(MARKET.shrubs.length + MARKET.postGarden.length + hedgeClumps().length);
  expect(soft.every((c) => c.r <= 0.42)).toBe(true);
  // The post office's planting grows beside its walls, off the gravel, and
  // leaves its door and the path to it clear.
  const po = MARKET.postOffice,
    door = { x: po.x + po.door, z: po.z + po.d / 2 + 0.6 };
  for (const plant of MARKET.postGarden) {
    expect(Math.abs(plant.x - po.x) < po.w / 2 && Math.abs(plant.z - po.z) < po.d / 2, plant.kind).toBe(false);
    expect(onGravel(plant.x, plant.z, plant.r * 0.5), plant.kind).toBe(false);
    expect(marketGrass(plant.x, plant.z), plant.kind).toBe(false);
    expect(Math.hypot(plant.x - door.x, plant.z - door.z), plant.kind).toBeGreaterThan(2);
  }
  expect(collides(colliders, door.x, door.z, 0.3)).toBe(false);
});

test("the footbridge carries walkers over the brook, humped in the middle", { tag: "@logic" }, () => {
  const b = MARKET.bridge,
    middle = (b.minZ + b.maxZ) / 2;
  expect(bridgeDeck(b.minX - 0.1, middle)).toBe(null);
  expect(bridgeDeck(12, b.maxZ + 0.1)).toBe(null);
  const ends = bridgeDeck(b.minX, middle),
    crown = bridgeDeck((b.minX + b.maxX) / 2, middle);
  expect(ends).toBeCloseTo(b.base, 5);
  expect(crown).toBeCloseTo(b.base + b.rise, 5);
  // It spans the brook's channel (x 9.7 to 14.3) with its footings on the banks.
  expect(b.minX).toBeLessThan(9.7);
  expect(b.maxX).toBeGreaterThan(14.3);
  // Its rails keep walkers on the deck; the deck itself is clear.
  const colliders = regionColliders();
  expect(collides(colliders, 12, middle)).toBe(false);
  expect(collides(colliders, 12, b.minZ)).toBe(true);
  expect(collides(colliders, 12, b.maxZ)).toBe(true);
  // The kitchen gardens' path to it, and the square beyond, route clear of
  // every region's colliders.
  const { findPath } = createNavigation({ walk: WORLD.walk, colliders });
  const route = findPath({ x: 8.6, z: 10.6 }, { x: MARKET.square.x, z: MARKET.square.z });
  expect(route.length).toBeGreaterThan(10);
});

test("Finn's bread rounds pay for each loaf, then rest", { tag: "@logic" }, () => {
  const state = defaultState(),
    start = state.coins;
  // The first talk hands over a loaf for each of the lane's residents.
  expect(finnDelivery(state, 1000)).toBe("give");
  expect(state.deliveries.carrying).toEqual(DELIVERY.recipients);
  expect(finnDelivery(state, 2000)).toBe("carrying");
  // Only the residents with a loaf coming take one.
  expect(deliverLoaf(state, "mabel", 3000)).toBe(null);
  expect(deliverLoaf(state, "hazel", 3000)).toEqual({ petals: DELIVERY.perLoaf, round: false });
  expect(deliverLoaf(state, "hazel", 3100)).toBe(null);
  expect(deliverLoaf(state, "bram", 4000)).toEqual({
    petals: DELIVERY.perLoaf + DELIVERY.roundBonus,
    round: true,
  });
  expect(state.coins).toBe(start + 2 * DELIVERY.perLoaf + DELIVERY.roundBonus);
  expect(state.deliveries).toMatchObject({ carrying: [], made: 2, rounds: 1, last: 4000 });
  // The next batch comes out of the oven a little later.
  expect(finnDelivery(state, 4000 + DELIVERY.restMs - 1)).toBe("resting");
  expect(finnDelivery(state, 4000 + DELIVERY.restMs)).toBe("give");
});

test("the stalls sell seeds and keepsakes in the afternoon only", { tag: "@logic" }, () => {
  const state = defaultState();
  state.coins = 40;
  // At blue hour every stall is covered.
  for (const id of Object.keys(STALLS)) expect(buyFromStall(state, id, true)).toBe("closed");
  expect(state.coins).toBe(40);
  // Seeds by the packet, as often as the purse allows.
  expect(buyFromStall(state, "seeds", false)).toBe("bought");
  expect(state.seeds).toBe(5 + STALLS.seeds.seeds);
  expect(state.coins).toBe(40 - STALLS.seeds.price);
  // A keepsake once; then it is owned.
  expect(buyFromStall(state, "hats", false)).toBe("bought");
  expect(state.bought.pipHat).toBe(true);
  expect(buyFromStall(state, "hats", false)).toBe("owned");
  expect(stallOffer(state, "hats", false)).toMatchObject({ open: true, owned: true });
  // Too few petals for the lantern.
  expect(state.coins).toBeLessThan(STALLS.lanterns.price);
  expect(buyFromStall(state, "lanterns", false)).toBe("short");
  expect(state.bought.lantern).toBe(false);
  // The greengrocer's is for looking.
  expect(buyFromStall(state, "produce", false)).toBe("browse");
  // Saves from before the market get its state.
  const storage = () => ({
    getItem: () => JSON.stringify({ quests: { mabel: true }, plants: [], coins: 9 }),
  });
  const { state: loaded } = loadState(storage);
  expect(loaded.coins).toBe(9);
  expect(loaded.deliveries).toEqual({ carrying: [], made: 0, rounds: 0, last: 0 });
  expect(loaded.bought).toEqual({ lantern: false, pipHat: false, seeds: 0 });
});

test("the market lane streams in, and its residents take Finn's bread", async ({ page }) => {
  test.setTimeout(1800000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    if (!localStorage.getItem("willowmere.save.v1"))
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
  await expect
    .poll(async () => (await page.evaluate(() => window.__willowmere.getStreaming())).pending, {
      timeout: 900000,
    })
    .toBe(0);
  const names = (await page.evaluate(() => window.__willowmere.getChunks()))
    .flatMap((chunk) => chunk.meshes)
    .map((mesh) => mesh.name);
  for (const name of [
    "Market lane gravel",
    "Market footbridge",
    "Market tea room",
    "Market tea room glass",
    "Market tea room detail",
    "Market post office",
    "Market stalls and bunting",
    "Market stalls detail",
    "Market stall boards",
    "Market signpost and cart",
    "Market sign: THE COPPER KETTLE",
  ])
    expect(names).toContain(name);
  let market = await page.evaluate(() => window.__willowmere.getMarket());
  expect(market.residents).toEqual(expect.arrayContaining(["hazel", "bram"]));
  // The footbridge's deck lifts the player, and a click from the green
  // routes all the way to the square.
  const deck = await page.evaluate(() => {
    window.__willowmere.moveTo(12, 10.6);
    return window.__willowmere.getDiagnostics().position[1];
  });
  expect(deck).toBeGreaterThan(0.4);
  const route = await page.evaluate(() =>
    window.__willowmere.findPath({ x: -2.8, z: 6.2 }, { x: 33.5, z: 2.6 }),
  );
  expect(route.length).toBeGreaterThan(20);
  // Finn hands over a round of loaves.
  const talk = async (x, z, label) => {
    await page.evaluate(([x, z]) => window.__willowmere.moveTo(x, z), [x, z]);
    await expect(page.locator("#interaction span")).toHaveText(label, { timeout: 180000 });
    await page.keyboard.press("e");
    await expect(page.locator("#dialogue")).toBeVisible({ timeout: 60000 });
    await page.keyboard.press("e");
    await expect(page.locator("#dialogue")).toBeHidden({ timeout: 60000 });
  };
  await talk(3, -3.2, "Say hello to Finn");
  market = await page.evaluate(() => window.__willowmere.getMarket());
  expect(market.deliveries.carrying).toEqual(["hazel", "bram"]);
  // Hazel and Bram each take theirs.
  await talk(28.4, -1, "Say hello to Hazel");
  await expect(page.locator("#location-name")).toHaveText("The market lane");
  await talk(40, -1.8, "Say hello to Bram");
  market = await page.evaluate(() => window.__willowmere.getMarket());
  expect(market.deliveries).toMatchObject({ carrying: [], made: 2, rounds: 1 });
  expect(market.coins).toBe(120 + 12);
  // The milliner sells Pip a hat, which he wears at once.
  await page.evaluate(() => window.__willowmere.moveTo(30.4, 6.3));
  await expect(page.locator("#interaction span")).toHaveText("Buy a hat for Pip · 30 petals", {
    timeout: 180000,
  });
  await page.keyboard.press("e");
  await expect(page.locator("#dialogue")).toBeVisible({ timeout: 60000 });
  market = await page.evaluate(() => window.__willowmere.getMarket());
  expect(market).toMatchObject({ coins: 102, bought: { pipHat: true }, pipHat: true });
  await page.keyboard.press("e");
  // At blue hour the stalls cover up.
  await page.evaluate(() => {
    const select = document.querySelector("#day-select");
    select.value = "dusk";
    select.dispatchEvent(new Event("change"));
  });
  await expect(page.locator("#interaction span")).toHaveText("Milliner’s stall · closed", {
    timeout: 180000,
  });
  // The hat survives a reload.
  await page.reload();
  await page.waitForFunction(() => window.__willowmere?.getMarket().pipHat, null, {
    timeout: 600000,
  });
  expect(errors).toEqual([]);
});
