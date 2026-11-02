import { FISH } from "../fishing.js";

// The welcome quests, in the order the quest card lists them.
export const QUESTS = ["mabel", "flower", "plant"];

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The journal's entries as [title, text] rows, for a save's `state` and the
 * region id the player stands in. The millpond, orchard and market lane
 * entries appear once the player has been there or done something there.
 */
export function journalEntries(state, here) {
  const rows = [
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
  ];
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
  return rows;
}
