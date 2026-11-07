// @ts-check
// The stone quarry's fossils, as pure decisions on the save's state: which
// fossils the quarry holds, lending the player Agnes's hammer, what splitting
// a stone at each spot turns up and earns, and which fossil Agnes tells the
// player to look for. No three.js and no DOM, so the logic tests run it in
// Node; activities.js shows the results.

// The fossils, one place for each (QUARRY.finds in
// src/regions/quarry-layout.js).
export const FOSSILS = [
  { id: "ammonite", name: "Ammonite" },
  { id: "belemnite", name: "Belemnite" },
  { id: "gryphaea", name: "Devil’s toenail" },
  { id: "crinoid", name: "St Cuthbert’s beads" },
  { id: "urchin", name: "Shepherd’s crown" },
  { id: "brachiopod", name: "Lamp shell" },
];

// The first of each fossil found earns petals.
export const FOSSIL_PETALS = 5;

/** The quarry's part of a fresh save: fossils found, by id, and whether Agnes has lent her hammer. */
export function quarryDefaults() {
  return { fossils: /** @type {Record<string, boolean>} */ ({}), hammer: false };
}

/** The fossil with this id. */
export const fossilById = (id) => FOSSILS.find((fossil) => fossil.id === id);

/**
 * Agnes lends the player her old hammer. Returns true the first time, false
 * once it is already lent.
 * @param {{ hammer: boolean }} state
 */
export function lendHammer(state) {
  if (state.hammer) return false;
  state.hammer = true;
  return true;
}

/**
 * Splits a stone where fossil `id` lies. Returns { kind: "no-hammer" } until
 * Agnes lends her hammer, { kind: "again" } once that fossil is found, else
 * { kind: "found", fossil, petals } with the find recorded and paid.
 * @param {{ fossils: Record<string, boolean>, hammer: boolean, coins: number }} state
 * @param {string} id
 */
export function splitStone(state, id) {
  const fossil = fossilById(id);
  if (!fossil) return { kind: "none" };
  if (!state.hammer) return { kind: "no-hammer", fossil };
  if (state.fossils[id]) return { kind: "again", fossil };
  state.fossils[id] = true;
  state.coins += FOSSIL_PETALS;
  return { kind: "found", fossil, petals: FOSSIL_PETALS };
}

/**
 * What Agnes talks about: lending her hammer if she has not yet, then a
 * fossil still to find, then nothing more once all are found.
 * @param {{ fossils: Record<string, boolean>, hammer: boolean }} state
 * @returns {{ topic: "hammer" | "seek" | "done", fossil?: typeof FOSSILS[number] }}
 */
export function agnesTopic(state) {
  if (!state.hammer) return { topic: "hammer" };
  const fossil = FOSSILS.find((f) => !state.fossils[f.id]);
  return fossil ? { topic: "seek", fossil } : { topic: "done" };
}
