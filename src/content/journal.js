import { FISH } from "../fishing.js";

// The welcome quests, in the order the quest card lists them.
export const QUESTS = ["mabel", "flower", "plant"];

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The journal's entries as [title, text] rows, for a save's `state` and the
 * region id the player stands in. The millpond and orchard entries appear
 * once the player has been there or gathered something from them.
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
  return rows;
}
