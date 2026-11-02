// The willow marsh's birdwatching, as pure decisions on the save's state: who
// shows themselves at the bird hide, what a first sighting earns, and which
// bird Wren tells the player to look out for. No three.js and no DOM, so the
// logic tests run it in Node; activities.js shows the results.

// The marsh's birds. Some keep to the afternoon, some only come out at blue
// hour (the day toggle; there is no clock), the rest show at either.
export const BIRDS = [
  { id: "heron", name: "Grey heron", when: "any" },
  { id: "moorhen", name: "Moorhen", when: "any" },
  { id: "grebe", name: "Little grebe", when: "any" },
  { id: "warbler", name: "Reed warbler", when: "day" },
  { id: "kingfisher", name: "Kingfisher", when: "day" },
  { id: "owl", name: "Barn owl", when: "dusk" },
  { id: "bittern", name: "Bittern", when: "dusk" },
];

// A watch from the hide takes a little while to settle; a bird the player
// has not yet seen is the likelier sighting; the first of each earns petals.
export const WATCH = { restMs: 20 * 1000, newChance: 0.6, firstPetals: 5 };

/** The marsh's part of a fresh save: sightings by bird, and the last watch's time. */
export function marshDefaults() {
  return { birds: {}, watched: 0 };
}

/** Whether `bird` shows itself at this time of day. */
export const birdAbout = (bird, dusk) => bird.when === "any" || (bird.when === "dusk") === dusk;

/**
 * A watch from the hide at time `now` (ms), at blue hour when `dusk`. `roll`
 * returns a number in [0, 1). Returns { kind: "quiet" } while the reeds are
 * still settling after the last watch, else { kind: "seen", bird, first,
 * petals } with the sighting recorded and any petals paid.
 */
export function watchBirds(state, { dusk, now, roll }) {
  if (state.watched && now - state.watched < WATCH.restMs) return { kind: "quiet" };
  const about = BIRDS.filter((bird) => birdAbout(bird, dusk)),
    unseen = about.filter((bird) => !state.birds[bird.id]),
    pool = unseen.length && roll() < WATCH.newChance ? unseen : about,
    bird = pool[Math.min(pool.length - 1, Math.floor(roll() * pool.length))],
    first = !state.birds[bird.id],
    petals = first ? WATCH.firstPetals : 0;
  state.birds[bird.id] = (state.birds[bird.id] || 0) + 1;
  state.watched = now;
  state.coins += petals;
  return { kind: "seen", bird, first, petals };
}

/**
 * The bird Wren mentions: one not yet seen, about at this time of day if any
 * is, else one that keeps the other hours; null once every bird is seen.
 */
export function birdToSeek(state, dusk) {
  const unseen = BIRDS.filter((bird) => !state.birds[bird.id]);
  return unseen.find((bird) => birdAbout(bird, dusk)) ?? unseen[0] ?? null;
}
