// @ts-check
// The visit's progress, saved to this browser. A save carries the version it
// was written at; loading runs the migrations it has missed, then merges it
// into the defaults field by field, so a field added to the defaults later
// (a new fruit in the basket, a new quest) arrives in old saves too.

import { marketDefaults } from "./market.js";
import { marshDefaults } from "./marsh.js";
import { woodDefaults } from "./wood.js";
import { allotmentDefaults, cropBasket } from "./allotments.js";
import { rosewoodDefaults } from "./rosewood.js";
import { quarryDefaults } from "./quarry.js";

// The key predates save versions; the version now lives inside the save.
export const STORAGE = "willowmere.save.v1";

/**
 * The version saves are written at. Raise it with a migration below whenever
 * a saved field changes meaning; adding a field only needs a default.
 */
export const SAVE_VERSION = 2;

/**
 * Upgrades from each version to the next: MIGRATIONS[n] turns a version n
 * save into a version n + 1 one, in place. Saves from before versions count
 * as version 1.
 * @type {Record<number, (saved: Record<string, any>) => void>}
 */
const MIGRATIONS = {
  // Planted flowers are keyed by id, so their meshes can be created in any
  // order. Saves from before ids get them in planting order.
  1(saved) {
    let next = Math.max(-1, ...saved.plants.map((p) => (Number.isInteger(p.id) ? p.id : -1))) + 1;
    for (const plant of saved.plants) if (!Number.isInteger(plant.id)) plant.id = next++;
  },
};

export function defaultState() {
  return {
    version: SAVE_VERSION,
    flowers: 0,
    seeds: 5,
    coins: 120,
    quests: { mabel: false, flower: false, plant: false },
    // Catches from the millpond, by species.
    fish: {},
    // The orchard's fruit and honey and the allotments' vegetables: what is
    // in the basket, what has been gathered all told, and when each tree was
    // shaken and each hive opened.
    basket: { apple: 0, pear: 0, honey: 0, ...cropBasket() },
    harvested: { apple: 0, pear: 0, honey: 0, ...cropBasket() },
    orchard: {},
    // Finn's bread deliveries and what the market stalls sold.
    ...marketDefaults(),
    // Birds spotted from the marsh's hide, and when the last watch was.
    ...marshDefaults(),
    // Woodland flowers pressed in the old wood.
    ...woodDefaults(),
    // The allotment plots rented, and what each has sown.
    ...allotmentDefaults(),
    // Bark's finds from the back garden, the jigsaw, and balls fetched.
    ...rosewoodDefaults(),
    // Fossils found at the stone quarry, and whether Agnes lent her hammer.
    ...quarryDefaults(),
    gathered: [],
    plants: [],
    started: false,
  };
}

/** The visit's progress, as saved. @typedef {ReturnType<typeof defaultState>} SaveState */

/** @param {unknown} value */
const isRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Merges `saved` into `defaults`, recursing into objects. A saved value
 * replaces its default only when it has the same kind (number, string,
 * boolean, array or object), so a field a save lacks, or one it holds as
 * null (JSON's NaN), keeps its default. Fields the defaults do not name are
 * kept as saved: per-item records such as `fish` and `orchard`, and anything
 * a newer version wrote.
 * @param {Record<string, any>} defaults
 * @param {Record<string, any>} saved
 * @returns {Record<string, any>}
 */
export function mergeSave(defaults, saved) {
  const merged = { ...saved };
  for (const [key, fallback] of Object.entries(defaults)) {
    const value = saved[key];
    if (isRecord(fallback)) merged[key] = mergeSave(fallback, isRecord(value) ? value : {});
    else if (Array.isArray(fallback)) merged[key] = Array.isArray(value) ? value : fallback;
    else merged[key] = typeof value === typeof fallback ? value : fallback;
  }
  return merged;
}

/**
 * Reads the save from `storage` (localStorage, or a stand-in in tests), or the
 * defaults when there is none or it cannot be read. Returns the state and the
 * next free planted-flower id.
 * @param {() => Pick<Storage, "getItem">} storage
 */
export function loadState(storage) {
  let state = defaultState();
  try {
    const saved = JSON.parse(storage().getItem(STORAGE) ?? "null");
    if (isRecord(saved) && isRecord(saved.quests) && Array.isArray(saved.plants)) {
      const from = Number.isInteger(saved.version) ? saved.version : 1;
      for (let version = from; version < SAVE_VERSION; version++) MIGRATIONS[version]?.(saved);
      state = /** @type {SaveState} */ (mergeSave(state, saved));
      // A save from a newer version (after a rollback) keeps its number, so
      // its migrations never run twice.
      state.version = Math.max(from, SAVE_VERSION);
    }
  } catch {
    state = defaultState();
  }
  const nextPlantId =
    Math.max(-1, ...state.plants.map((p) => (Number.isInteger(p.id) ? p.id : -1))) + 1;
  return { state, nextPlantId };
}

/**
 * Writes `state` to `storage`; returns false when the browser refuses.
 * @param {() => Pick<Storage, "setItem">} storage
 * @param {object} state
 */
export function saveState(storage, state) {
  try {
    storage().setItem(STORAGE, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
