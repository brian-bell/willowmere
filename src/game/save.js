// The visit's progress, saved to this browser. Loading spreads a save over
// the defaults; saves from before planted flowers had ids get them here.

export const STORAGE = "willowmere.save.v1";

export function defaultState() {
  return {
    flowers: 0,
    seeds: 5,
    coins: 120,
    quests: { mabel: false, flower: false, plant: false },
    // Catches from the millpond, by species.
    fish: {},
    // The orchard's fruit and honey: what is in the basket, what has been
    // gathered all told, and when each tree was shaken and each hive opened.
    basket: { apple: 0, pear: 0, honey: 0 },
    harvested: { apple: 0, pear: 0, honey: 0 },
    orchard: {},
    gathered: [],
    plants: [],
    started: false,
  };
}

/**
 * Reads the save from `storage` (localStorage, or a stand-in in tests), or the
 * defaults when there is none or it cannot be read. Returns the state and the
 * next free planted-flower id.
 */
export function loadState(storage) {
  let state = defaultState();
  try {
    const saved = JSON.parse(storage().getItem(STORAGE));
    if (saved && saved.quests && Array.isArray(saved.plants)) state = { ...state, ...saved };
  } catch {}
  // Planted flowers are keyed by id, so their meshes can be created in any order.
  // Saves from before ids get them in planting order.
  let nextPlantId =
    Math.max(-1, ...state.plants.map((p) => (Number.isInteger(p.id) ? p.id : -1))) + 1;
  for (const plant of state.plants) if (!Number.isInteger(plant.id)) plant.id = nextPlantId++;
  return { state, nextPlantId };
}

/** Writes `state` to `storage`; returns false when the browser refuses. */
export function saveState(storage, state) {
  try {
    storage().setItem(STORAGE, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
