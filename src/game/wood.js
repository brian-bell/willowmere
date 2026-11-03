// The old wood's pressed flowers, as pure decisions on the save's state: which
// woodland flowers are open, what pressing one earns, and which flower Rowan
// tells the player to look for. No three.js and no DOM, so the logic tests
// run it in Node; activities.js shows the results.

// The wood's flowers, one patch of each. Wood anemones close in the evening
// and honeysuckle opens only at blue hour (the day toggle; there is no
// clock); the rest are open at either.
export const FLOWERS = [
  { id: "primrose", name: "Primrose", when: "any" },
  { id: "bluebell", name: "Bluebell", when: "any" },
  { id: "campion", name: "Red campion", when: "any" },
  { id: "foxglove", name: "Foxglove", when: "any" },
  { id: "sorrel", name: "Wood sorrel", when: "any" },
  { id: "anemone", name: "Wood anemone", when: "day" },
  { id: "honeysuckle", name: "Honeysuckle", when: "dusk" },
];

// The first of each flower pressed earns petals.
export const PRESS = { firstPetals: 4 };

/** The wood's part of a fresh save: flowers pressed, by id. */
export function woodDefaults() {
  return { pressed: {} };
}

/** Whether `flower` is open at this time of day. */
export const flowerOpen = (flower, dusk) =>
  flower.when === "any" || (flower.when === "dusk") === dusk;

/** The flower with this id. */
export const flowerById = (id) => FLOWERS.find((flower) => flower.id === id);

/**
 * Presses a bloom of flower `id`, at blue hour when `dusk`. Returns
 * { kind: "closed" } while the flower is shut, { kind: "again" } once one is
 * already pressed, else { kind: "pressed", flower, petals } with the pressing
 * recorded and paid.
 */
export function pressFlower(state, id, { dusk }) {
  const flower = flowerById(id);
  if (!flower) return { kind: "none" };
  if (!flowerOpen(flower, dusk)) return { kind: "closed", flower };
  if (state.pressed[id]) return { kind: "again", flower };
  state.pressed[id] = true;
  state.coins += PRESS.firstPetals;
  return { kind: "pressed", flower, petals: PRESS.firstPetals };
}

/**
 * The flower Rowan mentions: one not yet pressed, open at this time of day if
 * any is, else one that keeps the other hours; null once all are pressed.
 */
export function flowerToSeek(state, dusk) {
  const unpressed = FLOWERS.filter((flower) => !state.pressed[flower.id]);
  return unpressed.find((flower) => flowerOpen(flower, dusk)) ?? unpressed[0] ?? null;
}
