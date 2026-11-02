import { test, expect } from "@playwright/test";
import { STORAGE, defaultState, loadState, saveState } from "../src/game/save.js";

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

test("a save spreads over the defaults, and old planted flowers get ids", { tag: "@logic" }, () => {
  const saved = {
    coins: 7,
    quests: { mabel: true },
    plants: [{ x: 1, z: 2, watered: true }, { id: 4, x: 3, z: 4 }, { x: 5, z: 6 }],
  };
  const { state, nextPlantId } = loadState(memory(JSON.stringify(saved)));
  expect(state.coins).toBe(7);
  expect(state.seeds).toBe(5);
  expect(state.basket).toEqual({ apple: 0, pear: 0, honey: 0 });
  // Nested fields come from the save as they are.
  expect(state.quests).toEqual({ mabel: true });
  expect(state.plants.map((p) => p.id)).toEqual([5, 4, 6]);
  expect(nextPlantId).toBe(7);
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
