// The market lane's trade, as pure decisions on the save's state: Finn's bread
// deliveries to the lane's residents, and what the market stalls sell. No
// three.js and no DOM, so the logic tests run it in Node; activities.js shows
// the results.

// Finn bakes a loaf for each of the lane's residents; a round pays for each
// loaf and a little more once both are delivered. He has another batch ready
// a couple of minutes after the last round.
export const DELIVERY = {
  recipients: ["hazel", "bram"],
  perLoaf: 4,
  roundBonus: 4,
  restMs: 2 * 60 * 1000,
};

// The stalls trade in the golden afternoon and cover up at blue hour. Each
// sells one thing: seeds by the packet, or a single keepsake.
export const STALLS = {
  seeds: { name: "Seed stall", price: 6, seeds: 3 },
  lanterns: { name: "Lantern stall", price: 24, keepsake: "lantern" },
  hats: { name: "Milliner’s stall", price: 30, keepsake: "pipHat" },
  produce: { name: "Greengrocer’s stall" },
};

/** The lane's part of a fresh save. */
export function marketDefaults() {
  return {
    // Loaves in the bag, by recipient; loaves and rounds delivered; when the
    // last round was finished.
    deliveries: { carrying: [], made: 0, rounds: 0, last: 0 },
    // Keepsakes bought, and seed packets.
    bought: { lantern: false, pipHat: false, seeds: 0 },
  };
}

/**
 * What Finn does about deliveries when the player talks to him: "give" hands
 * over a new round (and puts the loaves in the bag), "carrying" means loaves
 * are still to deliver, "resting" that the next batch is not out of the oven.
 */
export function finnDelivery(state, now) {
  const d = state.deliveries;
  if (d.carrying.length) return "carrying";
  if (d.rounds && now - d.last < DELIVERY.restMs) return "resting";
  d.carrying = [...DELIVERY.recipients];
  return "give";
}

/**
 * Hands `resident` their loaf, if one is in the bag. Returns the petals it
 * earns and whether it finished the round, or null when there is none for them.
 */
export function deliverLoaf(state, resident, now) {
  const d = state.deliveries,
    at = d.carrying.indexOf(resident);
  if (at < 0) return null;
  d.carrying.splice(at, 1);
  d.made++;
  let petals = DELIVERY.perLoaf;
  const round = !d.carrying.length;
  if (round) {
    d.rounds++;
    d.last = now;
    petals += DELIVERY.roundBonus;
  }
  state.coins += petals;
  return { petals, round };
}

/**
 * What a stall offers right now: `open` at the golden afternoon, `owned`
 * once its keepsake is bought, and whether the purse covers the price.
 */
export function stallOffer(state, id, dusk) {
  const stall = STALLS[id];
  return {
    ...stall,
    open: !dusk,
    owned: !!(stall.keepsake && state.bought[stall.keepsake]),
    affordable: stall.price === undefined || state.coins >= stall.price,
  };
}

/**
 * Buys from a stall. Returns what happened: "closed" at blue hour, "browse"
 * at a stall with nothing for sale, "owned" for a keepsake already bought,
 * "short" when the purse is light, or "bought" (the state is updated).
 */
export function buyFromStall(state, id, dusk) {
  const offer = stallOffer(state, id, dusk);
  if (!offer.open) return "closed";
  if (offer.price === undefined) return "browse";
  if (offer.owned) return "owned";
  if (!offer.affordable) return "short";
  state.coins -= offer.price;
  if (offer.keepsake) state.bought[offer.keepsake] = true;
  if (offer.seeds) {
    state.seeds += offer.seeds;
    state.bought.seeds++;
  }
  return "bought";
}
