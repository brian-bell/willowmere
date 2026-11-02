import * as THREE from "three";
import { createFlowerFactory } from "../flowers.js";
import { MILLPOND } from "../regions/millpond-layout.js";
import { FRUIT_TREES } from "../regions/orchard-layout.js";

// What the player does and earns: the welcome quests, gathering and planting
// flowers, fishing from the millpond's jetty, and the orchard's fruit and
// honey, which Finn buys. Each changes the save, then updates the HUD, saves
// and chimes.

// Wildflower bouquets to gather, by index into the save's `gathered` list.
const GATHERING_SPOTS = [
  [-4, 7],
  [-9, 2],
  [-2, -3],
  [5, 2],
  [6, 7],
  [-12, 7],
  [0, 9],
  [-10, -1],
];
// A shaken tree ripens again, and a hive refills, after a few minutes.
const FRUIT_REGROW_MS = 4 * 60 * 1000,
  HONEY_REFILL_MS = 6 * 60 * 1000,
  HARVEST_PRICE = { apple: 2, pear: 2, honey: 6 };

/**
 * `blocked(x, z, r)` is the walking test planting keeps clear of;
 * `nextPlantId` comes with the loaded save; `motion()` says whether
 * decorative motion (bursts, shaking) plays.
 */
export function createActivities({
  scene,
  world,
  player,
  state,
  nextPlantId,
  hud,
  save,
  audio,
  effects,
  fishing,
  blocked,
  motion,
}) {
  const { toast, updateUI } = hud;
  // Saves progress and lets the player know.
  function reward(message) {
    updateUI();
    save();
    audio.chime();
    toast(message);
  }

  function complete(quest) {
    if (state.quests[quest]) return;
    state.quests[quest] = true;
    state.coins += 25;
    audio.chime();
    updateUI();
    save();
    if (Object.values(state.quests).every(Boolean))
      setTimeout(() => toast("A warm welcome, complete. You belong here. +25 petals"), 500);
  }

  // Flowers: bouquets to gather, and the ones the player planted, by id.
  const flowerGroups = new Map(),
    plantedGroups = new Map();
  const makeFlower = createFlowerFactory(scene);
  const flowerAt = (x, z, planted) => {
    const group = makeFlower(x, z, planted);
    group.position.y = world.terrainHeight(x, z);
    return group;
  };
  GATHERING_SPOTS.forEach(([x, z], i) => {
    if (!state.gathered.includes(i)) flowerGroups.set(i, flowerAt(x, z));
  });
  state.plants.forEach((p) => {
    const g = flowerAt(p.x, p.z, true);
    g.scale.setScalar(p.watered ? 1.35 : 0.7);
    plantedGroups.set(p.id, g);
  });
  function openGrass(x, z) {
    return (
      world.isPlantable(x, z) &&
      !blocked(x, z, 0.55) &&
      state.plants.every((p) => Math.hypot(x - p.x, z - p.z) > 0.75)
    );
  }
  /** Plants a seed a step ahead of the player, who faces `facing` (radians). */
  function plant(facing) {
    if (state.seeds <= 0) {
      toast("Your seed pouch is empty. Finn has a few to spare.");
      return;
    }
    const p = player.position;
    let fx = p.x + Math.sin(facing) * 0.8,
      fz = p.z + Math.cos(facing) * 0.8;
    if (!openGrass(fx, fz)) {
      toast("Find a little more room for those roots.");
      return;
    }
    const planted = { id: nextPlantId++, x: fx, z: fz, watered: false };
    state.plants.push(planted);
    if (motion()) effects.burst(fx, world.terrainHeight(fx, fz) + 0.4, fz);
    const g = flowerAt(fx, fz, true);
    g.scale.setScalar(0.7);
    plantedGroups.set(planted.id, g);
    state.seeds--;
    complete("plant");
    reward("A small beginning. Your flowers are planted.");
  }
  /** Waters the nearest thirsty planted flower within reach. */
  function water() {
    const p = player.position,
      thirsty = state.plants.find((q) => Math.hypot(q.x - p.x, q.z - p.z) < 2 && !q.watered);
    if (!thirsty) {
      toast("Plant some flowers first, then give them a drink.");
      return;
    }
    thirsty.watered = true;
    if (motion())
      effects.burst(thirsty.x, world.terrainHeight(thirsty.x, thirsty.z) + 0.4, thirsty.z);
    state.coins += 5;
    save();
    updateUI();
    audio.chime();
    toast("A little water, a little sunshine. +5 petals");
  }
  /** Picks the bouquet at gathering spot `id`. */
  function gather(id) {
    const fg = flowerGroups.get(id);
    if (motion()) effects.burst(fg.position.x, fg.position.y + 0.4, fg.position.z);
    scene.remove(fg);
    flowerGroups.delete(id);
    state.gathered.push(id);
    state.flowers++;
    if (state.flowers >= 3) complete("flower");
    save();
    updateUI();
    audio.chime();
    toast(`A wildflower for your pocket. ${state.flowers} gathered.`);
  }
  /** Planted flowers grow toward their size, larger once watered. */
  function grow(dt) {
    for (const p of state.plants) {
      const g = plantedGroups.get(p.id);
      if (!g) continue;
      const targetScale = p.watered ? 1.35 : 0.7;
      g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, targetScale, 1 - Math.exp(-dt * 1.5)));
    }
  }
  /** Finn tops up a nearly empty seed pouch. */
  function restockSeeds() {
    if (state.seeds >= 3) return;
    state.seeds += 3;
    updateUI();
    save();
    toast("Finn tucked three seeds into your pouch.");
  }

  // Fishing: the float and line stream in with the millpond's jetty.
  const fishingFrom = new THREE.Vector2(),
    rodTip = new THREE.Vector3();
  function castLine() {
    const p = player.position,
      { jetty } = MILLPOND;
    // Out over open water beyond the jetty's end.
    const x = jetty.x + (Math.random() - 0.5) * 1.4,
      z = jetty.minZ - 2.2 - Math.random() * 0.9;
    player.rotation.y = Math.atan2(x - p.x, z - p.z);
    fishing.cast(x, z);
    fishingFrom.set(p.x, p.z);
    toast("You cast a line. Watch the float, and press E when it dips.");
  }
  function fishingResult(result) {
    if (!result) return;
    if (result.kind === "early") {
      toast("Too soon. The ripples fade, and the fish drift off.");
      return;
    }
    if (result.kind === "miss") {
      toast("Something nibbled, and slipped away.");
      return;
    }
    const { fish } = result,
      first = !state.fish[fish.id];
    state.fish[fish.id] = (state.fish[fish.id] || 0) + 1;
    if (first) state.coins += 5;
    if (motion()) effects.burst(fishing.float.x, MILLPOND.surface + 0.3, fishing.float.z);
    reward(
      `${fish.line} You let it slip back into the pond.${first ? " A new one for the journal. +5 petals" : ""}`,
    );
  }
  /** Runs a cast: walking away reels the line in. */
  function updateFishing(dt, elapsed) {
    if (!fishing.active) return;
    const p = player.position;
    if (Math.hypot(p.x - fishingFrom.x, p.z - fishingFrom.y) > 0.8) fishing.cancel();
    rodTip
      .set(Math.sin(player.rotation.y) * 0.45, 1.25, Math.cos(player.rotation.y) * 0.45)
      .add(p);
    const result = fishing.update(dt, elapsed, rodTip);
    if (result) fishingResult(result);
  }

  // The orchard hill streams in later; its harvest controller arrives with it.
  let orchard = null;
  const harvestReady = (id, wait) => Date.now() - (state.orchard[id] ?? 0) >= wait;
  /** Shows each tree picked or ripe, by when it was last shaken. */
  function updateOrchard() {
    if (!orchard) return;
    for (const tree of FRUIT_TREES)
      orchard.setPicked(tree.id, !harvestReady(tree.id, FRUIT_REGROW_MS));
  }
  function shakeTree({ tree, kind }) {
    if (!orchard) return;
    if (!harvestReady(tree, FRUIT_REGROW_MS)) {
      toast(`Nothing more is ripe on this ${kind} tree yet. Give it a little while.`);
      return;
    }
    const count = orchard.shake(tree, motion());
    if (!count) return;
    const first = !state.harvested[kind];
    state.orchard[tree] = Date.now();
    state.basket[kind] += count;
    state.harvested[kind] += count;
    if (first) state.coins += 5;
    reward(
      `You give the trunk a shove, and ${count} ripe ${kind}s tumble into the grass. Into the basket they go.${first ? " +5 petals" : ""}`,
    );
  }
  function collectHoney({ hive }) {
    if (!orchard) return;
    orchard.disturbHive(hive);
    if (!harvestReady(hive, HONEY_REFILL_MS)) {
      toast("The bees are still filling the comb. Come back in a little while.");
      return;
    }
    const first = !state.harvested.honey;
    state.orchard[hive] = Date.now();
    state.basket.honey++;
    state.harvested.honey++;
    if (first) state.coins += 5;
    reward(
      `You lift the roof gently and take a jar of wildflower honey. The bees hardly mind.${first ? " +5 petals" : ""}`,
    );
  }
  const basketCount = () => state.basket.apple + state.basket.pear + state.basket.honey;
  // Finn buys the orchard's fruit and honey for the bakery.
  function sellBasket() {
    const { apple, pear, honey } = state.basket,
      petals =
        apple * HARVEST_PRICE.apple + pear * HARVEST_PRICE.pear + honey * HARVEST_PRICE.honey,
      goods = [
        [apple, "apple"],
        [pear, "pear"],
        [honey, "jar of honey", "jars of honey"],
      ]
        .filter(([n]) => n)
        .map(([n, one, many = `${one}s`]) => `${n} ${n === 1 ? one : many}`);
    state.basket = { apple: 0, pear: 0, honey: 0 };
    state.coins += petals;
    reward(
      `Finn takes ${goods.join(" and ").replace(/ and (?=.* and )/, ", ")} for the bakery. +${petals} petals`,
    );
  }

  return {
    complete,
    flowerGroups,
    plant,
    water,
    gather,
    grow,
    restockSeeds,
    castLine,
    fishingResult,
    updateFishing,
    updateOrchard,
    shakeTree,
    collectHoney,
    basketCount,
    sellBasket,
    get orchardReady() {
      return !!orchard;
    },
    /** What each region's builder hands back besides its jobs, by region id. */
    regionLoaded: {
      orchard({ harvest }) {
        orchard = harvest;
        updateOrchard();
      },
    },
  };
}
