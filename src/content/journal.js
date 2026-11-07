// @ts-check
import { FISH } from "../fishing.js";
import { BIRDS } from "../game/marsh.js";
import { FLOWERS } from "../game/wood.js";
import { CROPS, PLOTS } from "../game/allotments.js";
import { FOSSILS } from "../game/quarry.js";

// The welcome quests, in the order the quest card lists them.
export const QUESTS = ["mabel", "flower", "plant"];

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The journal's entries as [title, text] rows, for a save's `state` and the
 * region id the player stands in. The millpond, orchard, market lane,
 * marsh, old wood, allotment and quarry entries appear once the player has
 * been there or done something there.
 */
export function journalEntries(state, here) {
  const rows = [];
  // Once all three are done the quest card leaves the screen; the journal
  // keeps the welcome.
  if (QUESTS.every((quest) => state.quests[quest]))
    rows.push([
      "A warm welcome ✓",
      "All three little things, done: you met Mabel, gathered wildflowers and planted something of your own. You belong here.",
    ]);
  rows.push(
    [
      "Meet the neighbors",
      state.quests.mabel
        ? "Mabel saved you a place among the flowers."
        : "Mabel tends the flowers just west of the fountain.",
    ],
    [
      "A pocketful of sunshine",
      `You’ve gathered ${state.flowers} wildflower${state.flowers === 1 ? "" : "s"}. Look for the pale rings around little bouquets.`,
    ],
    [
      "Put down roots",
      state.quests.plant
        ? `${state.plants.length} new patch${state.plants.length === 1 ? "" : "es"} of flowers make the village a little more yours.`
        : "Choose the seed pouch (3), find an open patch, and press E.",
    ],
  );
  const caught = FISH.filter((fish) => state.fish[fish.id]);
  if (caught.length || here === "millpond")
    rows.push([
      "Quiet waters",
      caught.length
        ? `You’ve met ${caught.length} of ${FISH.length} millpond fish: ${caught.map((fish) => fish.name).join(", ")}.`
        : "Cast a line from the millpond’s jetty, north of the village, and press E when the float dips.",
    ]);
  const { apple, pear, honey } = state.harvested,
    basket = state.basket.apple + state.basket.pear + state.basket.honey;
  if (apple || pear || honey || here === "orchard")
    rows.push([
      "The orchard hill",
      apple || pear || honey
        ? `You’ve gathered ${plural(apple, "apple")}, ${plural(pear, "pear")} and ${plural(honey, "jar", "jars")} of honey. ${basket ? "Finn will buy what’s in your basket." : "Finn buys fruit and honey for his bakes."}`
        : "Shake a ripe apple or pear tree on the hill north-west of the village, and look in on the beehives. Finn buys fruit and honey for his bakes.",
    ]);
  const { made, carrying } = state.deliveries,
    { lantern, pipHat, seeds } = state.bought;
  if (made || carrying.length || lantern || pipHat || seeds || here === "market") {
    const keepsakes = [pipHat && "a straw hat for Pip", lantern && "a lantern for your gate"].filter(Boolean);
    rows.push([
      "The market lane",
      carrying.length
        ? `Warm loaves in your bag for ${carrying.map((id) => (id === "hazel" ? "Hazel at the Copper Kettle" : "Bram at the post office")).join(" and ")}. The lane runs east from the mill bridge.`
        : made || keepsakes.length || seeds
          ? `You’ve delivered ${plural(made, "loaf", "loaves")} for Finn${keepsakes.length ? `, and bought ${keepsakes.join(" and ")}` : ""}. The stalls trade in the golden afternoon.`
          : "Finn sends bread to the market lane, east of the mill. The stalls there trade in the golden afternoon: seeds, lanterns, and a hat for Pip.",
    ]);
  }
  const spotted = BIRDS.filter((bird) => state.birds[bird.id]);
  if (spotted.length || here === "marsh")
    rows.push([
      "The willow marsh",
      spotted.length
        ? `You’ve spotted ${spotted.length} of ${BIRDS.length} marsh birds from the hide: ${spotted.map((bird) => bird.name.toLowerCase()).join(", ")}.${spotted.length < BIRDS.length ? " Some only come out at blue hour." : ""}`
        : "Sit in the bird hide across the willow marsh, south of the village, and watch the reeds. Some birds only come out at blue hour.",
    ]);
  const pressed = FLOWERS.filter((flower) => state.pressed[flower.id]);
  if (pressed.length || here === "wood")
    rows.push([
      "The old wood",
      pressed.length
        ? `You’ve pressed ${pressed.length} of ${FLOWERS.length} woodland flowers: ${pressed.map((flower) => flower.name.toLowerCase()).join(", ")}.${pressed.length < FLOWERS.length ? " Rowan, by the clearing, knows where the others grow." : ""}`
        : "Find the woodland flowers in the old wood, west of the meadow, and press one of each. Rowan, by the clearing, knows where they grow.",
    ]);
  const rented = PLOTS.filter((plot) => state.plots[plot.id]?.rented),
    grown = Object.keys(CROPS).filter((crop) => state.harvested[crop]);
  if (rented.length || here === "allotments")
    rows.push([
      "The allotments",
      grown.length
        ? `You’ve grown ${grown.map((crop) => plural(state.harvested[crop], CROPS[crop].one, CROPS[crop].many)).join(", ")} on ${plural(rented.length, "bed")} of your own. Finn buys every one.`
        : rented.length
          ? `You rent ${plural(rented.length, "bed")} of ${PLOTS.length} at the allotments. Sow, water, then wait for them to grow.`
          : "Rent a bed at the allotments, south of the kitchen garden, and grow vegetables for Finn. Basil, by the shed, keeps the plots.",
    ]);
  const found = FOSSILS.filter((fossil) => state.fossils[fossil.id]);
  if (found.length || state.hammer || here === "quarry")
    rows.push([
      "The stone quarry",
      found.length
        ? `You’ve found ${found.length} of ${FOSSILS.length} fossils: ${found.map((fossil) => fossil.name.toLowerCase()).join(", ")}.${found.length < FOSSILS.length ? " Agnes, at her banker, knows where the others hide." : ""}`
        : state.hammer
          ? "Agnes lent you her hammer. Split stones about the quarry, on its floor, its bench and the ridge above, and see what the hill has kept."
          : "Look for fossils at the stone quarry, west of the allotments. Agnes, the mason, will lend you a hammer.",
    ]);
  return rows;
}
