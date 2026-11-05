// @ts-check
// Breakfast at Thistledown as a pure decision: ring at the hatch, wait while it
// cooks, eat it at the window table, and ring again if you are still hungry. No
// three.js and no DOM, so the logic tests run it in Node; the room shows it.

// How long the frying takes, in seconds.
export const COOKING_SECONDS = 4.5;

/** @typedef {{ phase: "none" | "cooking" | "served" | "eaten", timer: number, eaten: number }} Breakfast */

/** @returns {Breakfast} */
export function createBreakfast() {
  return { phase: "none", timer: 0, eaten: 0 };
}

/**
 * Rings at the hatch. Starts the frying unless something is already on its way
 * or waiting on the table, and says which.
 * @param {Breakfast} b
 * @returns {"ordered" | "cooking" | "served"}
 */
export function orderBreakfast(b) {
  if (b.phase === "cooking" || b.phase === "served") return b.phase;
  b.phase = "cooking";
  b.timer = COOKING_SECONDS;
  return "ordered";
}

/**
 * Lets `dt` seconds of cooking pass; true on the moment the plate is ready.
 * @param {Breakfast} b
 * @param {number} dt
 */
export function cookBreakfast(b, dt) {
  if (b.phase !== "cooking") return false;
  b.timer -= dt;
  if (b.timer > 0) return false;
  b.timer = 0;
  b.phase = "served";
  return true;
}

/**
 * Eats what is on the table; false if nothing is.
 * @param {Breakfast} b
 */
export function eatBreakfast(b) {
  if (b.phase !== "served") return false;
  b.phase = "eaten";
  b.eaten++;
  return true;
}

/**
 * The next line of a list, wrapping round: for things read one press at a time.
 * @template T
 * @param {T[]} list
 * @param {number} n
 * @returns {T}
 */
export const nextOf = (list, n) => list[n % list.length];
