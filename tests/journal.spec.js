import { test, expect } from "@playwright/test";
import { journalEntries } from "../src/content/journal.js";
import { defaultState } from "../src/game/save.js";

const titles = (rows) => rows.map(([title]) => title);

test("the journal lists the welcome quests, then the millpond and orchard once visited", { tag: "@logic" }, () => {
  const state = defaultState();
  expect(titles(journalEntries(state, "green"))).toEqual([
    "Meet the neighbors",
    "A pocketful of sunshine",
    "Put down roots",
  ]);
  expect(titles(journalEntries(state, "millpond")).at(-1)).toBe("Quiet waters");
  expect(titles(journalEntries(state, "orchard")).at(-1)).toBe("The orchard hill");

  state.quests.mabel = state.quests.plant = true;
  state.flowers = 1;
  state.plants.push({ id: 0, x: 0, z: 0 });
  state.fish = { roach: 2, carp: 1 };
  state.harvested = { apple: 1, pear: 0, honey: 2 };
  state.basket.honey = 1;
  const rows = Object.fromEntries(journalEntries(state, "green"));
  expect(rows["Meet the neighbors"]).toBe("Mabel saved you a place among the flowers.");
  expect(rows["A pocketful of sunshine"]).toMatch(/^You’ve gathered 1 wildflower\./);
  expect(rows["Put down roots"]).toMatch(/^1 new patch of flowers/);
  expect(rows["Quiet waters"]).toBe("You’ve met 2 of 6 millpond fish: roach, golden carp.");
  expect(rows["The orchard hill"]).toBe(
    "You’ve gathered 1 apple, 0 pears and 2 jars of honey. Finn will buy what’s in your basket.",
  );
});
