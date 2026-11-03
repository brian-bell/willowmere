import { test, expect } from "@playwright/test";
import {
  SAVE_VERSION,
  STORAGE,
  defaultState,
  loadState,
  mergeSave,
  saveState,
} from "../src/game/save.js";

const memory = (saved) => {
  const items = new Map(saved === undefined ? [] : [[STORAGE, saved]]);
  return () => ({
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, String(value)),
  });
};

test("a first visit, an unreadable save and blocked storage start from the defaults", { tag: "@logic" }, () => {
  for (const storage of [
    memory(),
    memory("{not json"),
    memory(JSON.stringify({ coins: 5 })),
    () => {
      throw new Error("blocked");
    },
  ])
    expect(loadState(storage)).toEqual({ state: defaultState(), nextPlantId: 0 });
});

test("a save from before versions gets plant ids and every default it lacks", { tag: "@logic" }, () => {
  const saved = {
    coins: 7,
    quests: { mabel: true },
    plants: [{ x: 1, z: 2, watered: true }, { id: 4, x: 3, z: 4 }, { x: 5, z: 6 }],
  };
  const { state, nextPlantId } = loadState(memory(JSON.stringify(saved)));
  expect(state.version).toBe(SAVE_VERSION);
  expect(state.coins).toBe(7);
  expect(state.seeds).toBe(5);
  expect(state.basket).toEqual({ apple: 0, pear: 0, honey: 0, carrot: 0, lettuce: 0, bean: 0, pumpkin: 0 });
  // Quests the save never heard of start undone; its own keep their answer.
  expect(state.quests).toEqual({ mabel: true, flower: false, plant: false });
  expect(state.plants.map((p) => p.id)).toEqual([5, 4, 6]);
  expect(nextPlantId).toBe(7);
});

test("a field added to the defaults later reaches old saves", { tag: "@logic" }, () => {
  // An old basket without a fruit that a later version adds.
  const defaults = { ...defaultState(), basket: { apple: 0, pear: 0, honey: 0, plum: 0 } };
  const saved = { ...defaultState(), basket: { apple: 3, pear: 1, honey: 2 } };
  const merged = mergeSave(defaults, saved);
  expect(merged.basket).toEqual({ apple: 3, pear: 1, honey: 2, plum: 0 });
  merged.basket.plum += 2;
  expect(merged.basket.plum).toBe(2);
});

test("merging keeps saved records, and defaults replace values of the wrong kind", { tag: "@logic" }, () => {
  const saved = {
    ...defaultState(),
    // Per-item records the defaults leave empty.
    fish: { perch: 2 },
    orchard: { "tree-3": 1234 },
    birds: { heron: 1 },
    // JSON writes NaN as null; a broken field falls back to its default.
    coins: null,
    harvested: { apple: "lots", pear: 4 },
    deliveries: { carrying: "none", made: 2 },
    // A field from a newer version stays for it.
    later: { kept: true },
  };
  const { state } = loadState(memory(JSON.stringify(saved)));
  expect(state.fish).toEqual({ perch: 2 });
  expect(state.orchard).toEqual({ "tree-3": 1234 });
  expect(state.birds).toEqual({ heron: 1 });
  expect(state.coins).toBe(120);
  expect(state.harvested).toEqual({ ...defaultState().harvested, pear: 4 });
  expect(state.deliveries).toEqual({ carrying: [], made: 2, rounds: 0, last: 0 });
  expect(state.later).toEqual({ kept: true });
});

test("migrations run once: a current save is left alone, a newer one keeps its version", { tag: "@logic" }, () => {
  // The id migration is for old saves only, so a current save loads as written.
  const current = { ...defaultState(), plants: [{ x: 0, z: 0 }] };
  expect(loadState(memory(JSON.stringify(current))).state).toEqual(current);
  const newer = { ...defaultState(), version: SAVE_VERSION + 1 };
  expect(loadState(memory(JSON.stringify(newer))).state.version).toBe(SAVE_VERSION + 1);
});

test("saving round-trips, and reports a refused write", { tag: "@logic" }, () => {
  const storage = memory(),
    state = { ...defaultState(), coins: 99, plants: [{ id: 0, x: 1, z: 1 }] };
  expect(saveState(storage, state)).toBe(true);
  expect(loadState(storage).state).toEqual(state);
  expect(
    saveState(
      () => ({
        setItem() {
          throw new Error("quota");
        },
      }),
      state,
    ),
  ).toBe(false);
});
