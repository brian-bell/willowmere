// @ts-check
// The allotments' plots, as pure decisions on the save's state: renting a plot
// with petals, sowing it from the seed pouch, watering it, and harvesting the
// crop once it has grown, into the basket Finn buys from. No three.js and no
// DOM, so the logic tests run it in Node; activities.js shows the results.
//
// Crops grow in real time from their watering, like the orchard's fruit
// ripening again; there is no game clock.
import { ALLOTMENTS } from "../regions/allotments-layout.js";

/** @typedef {import("./save.js").SaveState} SaveState */

// Each plot grows one crop: how long it takes from watering, how much one
// sowing yields, and what Finn pays for each.
export const CROPS = {
  carrot: { name: "Carrots", one: "carrot", many: "carrots", growMs: 3 * 60 * 1000, yield: 6, price: 1 },
  lettuce: { name: "Lettuces", one: "lettuce", many: "lettuces", growMs: 2 * 60 * 1000, yield: 3, price: 2 },
  bean: { name: "Runner beans", one: "runner bean", many: "runner beans", growMs: 4 * 60 * 1000, yield: 8, price: 1 },
  pumpkin: { name: "Pumpkins", one: "pumpkin", many: "pumpkins", growMs: 6 * 60 * 1000, yield: 2, price: 5 },
};

// Renting a plot costs petals once; the first harvest of each crop pays a
// little extra.
export const RENT = 15;
export const FIRST_HARVEST_PETALS = 5;

export const PLOTS = ALLOTMENTS.plots.map(({ id, crop }) => ({ id, crop }));

/** The allotments' part of a fresh save: each plot's lease and sowing, by id. */
export function allotmentDefaults() {
  return { plots: {} };
}

/** The crop's goods in the basket: one key per crop, all at zero. */
export function cropBasket() {
  return Object.fromEntries(Object.keys(CROPS).map((crop) => [crop, 0]));
}

const plotState = (state, id) => state.plots[id];
const plotById = (id) => PLOTS.find((plot) => plot.id === id);

/**
 * Where plot `id` stands at time `now`: "free" (not rented), "empty" (rented,
 * nothing sown), "sown" (waiting for water), "growing" or "ripe", with how
 * far it has grown (0 to 1).
 * @param {SaveState} state
 * @returns {{ stage: "free" | "empty" | "sown" | "growing" | "ripe", growth: number }}
 */
export function plotStage(state, id, now) {
  const plot = plotById(id),
    p = plotState(state, id);
  if (!plot || !p?.rented) return { stage: "free", growth: 0 };
  if (!p.sown) return { stage: "empty", growth: 0 };
  if (!p.watered) return { stage: "sown", growth: 0 };
  const growth = Math.min(1, Math.max(0, (now - p.watered) / CROPS[plot.crop].growMs));
  return { stage: growth >= 1 ? "ripe" : "growing", growth };
}

/**
 * Does the next thing a plot needs, as pressing E beside it: rents it, sows
 * it, waters it or harvests it. Returns what happened:
 *   { kind: "short", price }       not enough petals to rent
 *   { kind: "rented", price }      the lease paid
 *   { kind: "no-seeds" }           the pouch is empty
 *   { kind: "sown", crop }         a seed from the pouch went in
 *   { kind: "watered", crop }      it starts to grow
 *   { kind: "growing", crop, growth }
 *   { kind: "harvested", crop, count, first, petals }  into the basket
 * @param {SaveState} state
 */
export function tendPlot(state, id, now) {
  const plot = plotById(id);
  if (!plot) return { kind: "none" };
  const crop = plot.crop,
    { stage, growth } = plotStage(state, id, now);
  if (stage === "free") {
    if (state.coins < RENT) return { kind: "short", price: RENT };
    state.coins -= RENT;
    state.plots[id] = { rented: true, sown: 0, watered: 0 };
    return { kind: "rented", price: RENT };
  }
  const p = state.plots[id];
  if (stage === "empty") {
    if (state.seeds <= 0) return { kind: "no-seeds" };
    state.seeds--;
    p.sown = now;
    return { kind: "sown", crop };
  }
  if (stage === "sown") {
    p.watered = now;
    return { kind: "watered", crop };
  }
  if (stage === "growing") return { kind: "growing", crop, growth };
  const count = CROPS[crop].yield,
    first = !state.harvested[crop];
  state.basket[crop] += count;
  state.harvested[crop] += count;
  p.sown = p.watered = 0;
  const petals = first ? FIRST_HARVEST_PETALS : 0;
  state.coins += petals;
  return { kind: "harvested", crop, count, first, petals };
}

/**
 * Waters plot `id` if it is sown and dry, as the watering can does; returns
 * whether it did.
 * @param {SaveState} state
 */
export function waterPlot(state, id, now) {
  if (plotStage(state, id, now).stage !== "sown") return false;
  state.plots[id].watered = now;
  return true;
}

/**
 * What Basil talks about: the first plot that is ripe, waiting for water or
 * seed, then a free plot to rent, then one still growing, with its crop.
 * @param {SaveState} state
 * @returns {{ topic: "ripe" | "sown" | "empty" | "rent" | "growing", crop: string }}
 */
export function basilTopic(state, now) {
  const stages = PLOTS.map((plot) => ({ ...plot, ...plotStage(state, plot.id, now) }));
  for (const [stage, topic] of /** @type {const} */ ([
    ["ripe", "ripe"],
    ["sown", "sown"],
    ["empty", "empty"],
    ["free", "rent"],
    ["growing", "growing"],
  ])) {
    const plot = stages.find((s) => s.stage === stage);
    if (plot) return { topic, crop: plot.crop };
  }
  return { topic: "growing", crop: PLOTS[0].crop };
}
