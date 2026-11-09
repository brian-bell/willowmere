import * as THREE from "three";
import { createFlowerFactory } from "../flowers.js";
import { MILLPOND } from "../regions/millpond-layout.js";
import { FRUIT_TREES } from "../regions/orchard-layout.js";
import { DELIVERY_THANKS, STALL_LINES, STALL_PROMPTS } from "../content/market.js";
import { STALLS, buyFromStall, deliverLoaf, finnDelivery, stallOffer } from "./market.js";
import { BIRD_LINES, HIDE_QUIET, HIDE_SETTLE, WREN_DONE, WREN_TIPS } from "../content/marsh.js";
import { birdToSeek, watchBirds as watchFromHide } from "./marsh.js";
import {
  FLOWER_AGAIN,
  FLOWER_CLOSED,
  FLOWER_LINES,
  FLOWER_PROMPTS,
  ROWAN_DONE,
  ROWAN_TIPS,
} from "../content/wood.js";
import { flowerById, flowerOpen, flowerToSeek, pressFlower as pressInJournal } from "./wood.js";
import { BASIL_TIPS, PLOT_LINES, PLOT_PROMPTS } from "../content/allotments.js";
import { CROPS, PLOTS, RENT, basilTopic, plotStage, tendPlot as tendInSave, waterPlot } from "./allotments.js";
import { plotById, plotFront } from "../regions/allotments-layout.js";
import {
  AGNES_DONE,
  AGNES_HAMMER,
  AGNES_TIPS,
  FOSSIL_AGAIN,
  FOSSIL_LINES,
  FOSSIL_PROMPTS,
  NO_HAMMER,
} from "../content/quarry.js";
import { agnesTopic, fossilById, lendHammer as lendInSave, splitStone as splitInSave } from "./quarry.js";

// What the player does and earns: the welcome quests, gathering and planting
// flowers, fishing from the millpond's jetty, the orchard's fruit and honey,
// which Finn buys, the market lane's bread deliveries and stalls,
// birdwatching from the marsh's hide, pressing the old wood's flowers, the
// allotment beds, whose vegetables Finn buys too, the stone quarry's
// fossils, and a goal kicked in at the school.
// Each changes the save, then updates the HUD, saves and chimes.

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
// The paper lantern from the market hangs by Rosewood's gate.
const COTTAGE_LANTERN = { x: -4.55, z: -2.75 };
// A shaken tree ripens again, and a hive refills, after a few minutes.
const FRUIT_REGROW_MS = 4 * 60 * 1000,
  HONEY_REFILL_MS = 6 * 60 * 1000,
  HARVEST_PRICE = {
    apple: 2,
    pear: 2,
    honey: 6,
    ...Object.fromEntries(Object.entries(CROPS).map(([id, crop]) => [id, crop.price])),
  };
// What's in the basket, by name: one and many.
const GOODS = {
  apple: ["apple", "apples"],
  pear: ["pear", "pears"],
  honey: ["jar of honey", "jars of honey"],
  ...Object.fromEntries(Object.entries(CROPS).map(([id, crop]) => [id, [crop.one, crop.many]])),
};

/**
 * `blocked(x, z, r)` is the walking test planting keeps clear of;
 * `nextPlantId` comes with the loaded save; `motion()` says whether
 * decorative motion (bursts, shaking) plays; `setPipHat(on)` dresses Pip.
 */
export function createActivities({
  scene,
  world,
  player,
  setPipHat,
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
      setTimeout(() => toast("A warm welcome, complete. +25 petals. It’s kept in your journal now."), 500);
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
    // Beside an empty allotment bed, the seed goes in there.
    const p0 = player.position,
      bed = PLOTS.find((plot) => {
        const front = plotFront(plotById(plot.id));
        return (
          Math.hypot(front.x - p0.x, front.z - p0.z) < 1.6 &&
          plotStage(state, plot.id, Date.now()).stage === "empty"
        );
      });
    if (bed) {
      if (tendPlot(bed.id) === PLOT_LINES.noSeeds) toast(PLOT_LINES.noSeeds);
      return;
    }
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
  /** Waters a dry allotment bed in reach, else the nearest thirsty planted flower. */
  function water() {
    const p = player.position,
      bed = PLOTS.find((plot) => {
        const front = plotFront(plotById(plot.id));
        return Math.hypot(front.x - p.x, front.z - p.z) < 1.6 && waterPlot(state, plot.id, Date.now());
      });
    if (bed) {
      wateredBed(bed.id, PLOT_LINES.watered);
      return;
    }
    const thirsty = state.plants.find((q) => Math.hypot(q.x - p.x, q.z - p.z) < 2 && !q.watered);
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
  /** Finn (or Basil, `who`) tops up a nearly empty seed pouch. */
  function restockSeeds(who = "Finn") {
    if (state.seeds >= 3) return;
    state.seeds += 3;
    updateUI();
    save();
    toast(`${who} tucked three seeds into your pouch.`);
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
  const basketCount = () => Object.values(state.basket).reduce((n, count) => n + count, 0);
  // Finn buys the orchard's fruit and honey and the allotments' vegetables
  // for the bakery.
  function sellBasket() {
    const kinds = Object.keys(GOODS).filter((kind) => state.basket[kind] > 0),
      petals = kinds.reduce((n, kind) => n + state.basket[kind] * HARVEST_PRICE[kind], 0),
      goods = kinds.map((kind) => {
        const n = state.basket[kind],
          [one, many] = GOODS[kind];
        return `${n} ${n === 1 ? one : many}`;
      });
    for (const kind of Object.keys(state.basket)) state.basket[kind] = 0;
    state.coins += petals;
    reward(
      `Finn takes ${goods.join(" and ").replace(/ and (?=.* and )/, ", ")} for the bakery. +${petals} petals`,
    );
  }

  // The market lane: Finn's bread deliveries, and the stalls.
  /** Finn's part in a delivery round: "give", "carrying" or "resting" (see market.js). */
  const finnDeliveries = () => finnDelivery(state, Date.now());
  function deliveryGiven() {
    save();
    toast("Two warm loaves, wrapped in a cloth, go into your bag. One for Hazel, one for Bram.");
  }
  /** Whether `resident` has a loaf coming. */
  const expectsLoaf = (resident) => state.deliveries.carrying.includes(resident);
  function deliver(resident) {
    const result = deliverLoaf(state, resident, Date.now());
    if (!result) return;
    reward(
      result.round
        ? `That’s the round done. Finn will be pleased. +${result.petals} petals`
        : `One loaf delivered. +${result.petals} petals`,
    );
  }
  const thanks = (resident) => DELIVERY_THANKS[resident];
  // The keepsakes show once bought: Pip's hat, and the lantern by the gate.
  let cottageLantern = null;
  function showKeepsakes() {
    setPipHat(state.bought.pipHat);
    if (state.bought.lantern && !cottageLantern) {
      cottageLantern = lanternPost(THREE, world.materials.glass);
      const { x, z } = COTTAGE_LANTERN;
      cottageLantern.position.set(x, world.terrainHeight(x, z), z);
      scene.add(cottageLantern);
      cottageLantern.updateMatrixWorld(true);
    }
  }
  showKeepsakes();
  /** The prompt at a stall. */
  function stallLabel(id, dusk) {
    const offer = stallOffer(state, id, dusk);
    if (!offer.open) return `${offer.name} · closed`;
    if (offer.owned) return offer.name;
    return STALL_PROMPTS[id](offer.price);
  }
  /** Buys from a stall; returns the line its stallholder's sign answers with. */
  function shop(id, dusk) {
    const result = buyFromStall(state, id, dusk),
      price = STALLS[id].price;
    if (result === "closed") return STALL_LINES.closed;
    if (result === "browse")
      return STALL_LINES.browse[Math.floor(Math.random() * STALL_LINES.browse.length)];
    if (result === "owned") return STALL_LINES.owned[id];
    if (result === "short") return STALL_LINES.short(price);
    showKeepsakes();
    if (motion()) effects.burst(player.position.x, player.position.y + 1, player.position.z);
    reward(`−${price} petals`);
    return STALL_LINES.bought[id];
  }

  // The school, once its builder has loaded.
  let school = null;

  // Birdwatching from the marsh's hide.
  const oneOf = (list) => list[Math.floor(Math.random() * list.length)];
  /** A watch from the hide: returns the hide's lines, the sighting saved and paid. */
  function watchBirds(dusk) {
    const result = watchFromHide(state, { dusk, now: Date.now(), roll: Math.random });
    if (result.kind === "quiet") return [oneOf(HIDE_QUIET)];
    const line = `${BIRD_LINES[result.bird.id]}${result.first ? ` A new one for the journal. +${result.petals} petals` : ""}`;
    updateUI();
    save();
    if (result.first) audio.chime();
    return [oneOf(HIDE_SETTLE), line];
  }
  /** What Wren says: a tip for a bird still to see, at this time of day if she can. */
  function wrenLine(dusk) {
    const bird = birdToSeek(state, dusk);
    return bird ? WREN_TIPS[bird.id] : oneOf(WREN_DONE);
  }

  // Pressing the old wood's flowers.
  /** The prompt at a woodland flower's patch. */
  function flowerLabel(id, dusk) {
    const flower = flowerById(id);
    if (!flowerOpen(flower, dusk)) return `${flower.name} · closed`;
    if (state.pressed[id]) return `${flower.name} · pressed`;
    return FLOWER_PROMPTS[id];
  }
  /** Presses a bloom into the journal: returns the line it answers with. */
  function pressFlower(id, dusk) {
    const result = pressInJournal(state, id, { dusk });
    if (result.kind === "closed") return FLOWER_CLOSED[id];
    if (result.kind === "again") return oneOf(FLOWER_AGAIN);
    if (result.kind !== "pressed") return "";
    if (motion()) effects.burst(player.position.x, player.position.y + 1, player.position.z);
    reward(`${result.flower.name} pressed · +${result.petals} petals`);
    return `${FLOWER_LINES[id]} A new page for the journal.`;
  }
  /** What Rowan says: a tip for a flower still to press, open at this hour if she can. */
  function rowanLine(dusk) {
    const flower = flowerToSeek(state, dusk);
    return flower ? ROWAN_TIPS[flower.id] : oneOf(ROWAN_DONE);
  }

  // The allotments: renting, sowing, watering and harvesting the beds. The
  // beds' crops stream in with the allotments.
  let beds = null;
  /** Shows each bed's crop at its stage. */
  function updateAllotments() {
    if (!beds) return;
    const now = Date.now();
    for (const plot of PLOTS) {
      const { stage, growth } = plotStage(state, plot.id, now);
      beds.show(plot.id, stage, growth);
    }
  }
  /** Keeps the orchard's trees and the allotment beds up to date. */
  function updateHarvests() {
    updateOrchard();
    updateAllotments();
  }
  function wateredBed(id, message) {
    if (motion()) {
      const front = plotFront(plotById(id));
      effects.burst(front.x, 0.5, front.z);
    }
    updateAllotments();
    reward(message);
  }
  /** The prompt at an allotment bed. */
  function plotLabel(id) {
    const crop = CROPS[plotById(id).crop],
      { stage } = plotStage(state, id, Date.now());
    return stage === "free" ? PLOT_PROMPTS.free(RENT) : PLOT_PROMPTS[stage](crop);
  }
  /** Does what a bed needs next: returns the line it answers with. */
  function tendPlot(id) {
    const result = tendInSave(state, id, Date.now());
    const crop = CROPS[plotById(id).crop];
    if (result.kind === "short") return PLOT_LINES.short(result.price);
    if (result.kind === "no-seeds") return PLOT_LINES.noSeeds;
    if (result.kind === "growing") return PLOT_LINES.growing(result.growth);
    if (result.kind === "none") return "";
    updateAllotments();
    const front = plotFront(plotById(id));
    if (result.kind === "watered") {
      wateredBed(id, `${crop.name} watered. Now they grow.`);
      return PLOT_LINES.watered;
    }
    if (motion()) effects.burst(front.x, 0.5, front.z);
    if (result.kind === "rented") {
      reward(`${crop.name} bed rented · −${result.price} petals`);
      return PLOT_LINES.rented(result.price);
    }
    if (result.kind === "sown") {
      reward(`${crop.name} sown. They’ll want water.`);
      return `${PLOT_LINES.sown[result.crop]} ${PLOT_LINES.needsWater}`;
    }
    reward(
      `${result.count} ${crop.many} into the basket.${result.first ? ` +${result.petals} petals` : ""}`,
    );
    return `${PLOT_LINES.harvested[result.crop]} Finn will buy them for the bakery.`;
  }
  /** What Basil says about the beds. */
  function basilLine() {
    const { topic, crop } = basilTopic(state, Date.now());
    return topic === "rent" ? BASIL_TIPS.rent(RENT) : BASIL_TIPS[topic](CROPS[crop]);
  }

  // The stone quarry's fossils, split from the stone with Agnes's hammer.
  /** The prompt at a fossil's spot. */
  function fossilLabel(id) {
    const fossil = fossilById(id);
    if (state.fossils[id]) return `${fossil.name} · found`;
    return FOSSIL_PROMPTS[id];
  }
  /** Splits a stone where a fossil lies: returns the line it answers with. */
  function splitStone(id) {
    const result = splitInSave(state, id);
    if (result.kind === "no-hammer") return NO_HAMMER;
    if (result.kind === "again") return oneOf(FOSSIL_AGAIN);
    if (result.kind !== "found") return "";
    if (motion()) effects.burst(player.position.x, player.position.y + 0.6, player.position.z);
    reward(`${result.fossil.name} found · +${result.petals} petals`);
    return `${FOSSIL_LINES[id]} A new page for the journal.`;
  }
  /** What Agnes says: the offer of her hammer, then a tip for a fossil still to find. */
  function agnesLine() {
    const { topic, fossil } = agnesTopic(state);
    return topic === "hammer" ? AGNES_HAMMER : topic === "seek" ? AGNES_TIPS[fossil.id] : oneOf(AGNES_DONE);
  }
  /** Agnes lends her hammer, the first time she is asked. */
  function lendHammer() {
    if (lendInSave(state)) reward("Agnes lent you her hammer. Look for fossils about the quarry.");
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
    updateHarvests,
    shakeTree,
    collectHoney,
    basketCount,
    sellBasket,
    finnDeliveries,
    deliveryGiven,
    expectsLoaf,
    deliver,
    thanks,
    stallLabel,
    shop,
    watchBirds,
    wrenLine,
    flowerLabel,
    pressFlower,
    rowanLine,
    plotLabel,
    tendPlot,
    basilLine,
    fossilLabel,
    splitStone,
    agnesLine,
    lendHammer,
    /** The school's children and their match, once they have streamed in. */
    get school() {
      return school;
    },
    get orchardReady() {
      return !!orchard;
    },
    get pipHat() {
      return state.bought.pipHat;
    },
    /** What each region's builder hands back besides its jobs, by region id. */
    regionLoaded: {
      orchard({ harvest }) {
        orchard = harvest;
        updateOrchard();
      },
      allotments(loaded) {
        beds = loaded.beds;
        updateAllotments();
      },
      // The children cheer a goal the visitor kicks in.
      school(loaded) {
        school = loaded.school;
        school.onGoal = (team, scorer) => {
          if (scorer === "walker") toast(oneOf(school.goalLines));
        };
      },
    },
  };
}

// A shepherd's-crook post with a paper lantern hung from it, its glass the
// village lamps' (which glows at blue hour).
function lanternPost(T, glass) {
  const group = new T.Group(),
    wood = new T.MeshStandardMaterial({ color: "#65513e", roughness: 0.9 });
  group.name = "Cottage lantern";
  const part = (geometry, material, x, y, z, rz = 0) => {
    const mesh = new T.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.z = rz;
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  part(new T.CylinderGeometry(0.035, 0.045, 1.7, 8), wood, 0, 0.85, 0);
  part(new T.TorusGeometry(0.16, 0.025, 6, 12, Math.PI), wood, -0.16, 1.7, 0);
  part(new T.CylinderGeometry(0.006, 0.006, 0.22, 4), wood, -0.32, 1.59, 0);
  part(new T.SphereGeometry(0.12, 12, 9), glass, -0.32, 1.38, 0).scale.y = 1.2;
  part(new T.CylinderGeometry(0.06, 0.06, 0.04, 8), wood, -0.32, 1.53, 0);
  return group;
}
