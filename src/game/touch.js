// @ts-check
// Touch-first controls: which devices get them, and the pure gesture maths the
// thumbstick and the map's pinch, twist and tilt share. No DOM or three.js
// here, so the @logic tests run it in Node.

/**
 * What the page can learn about the device's input.
 * @typedef {object} DeviceTraits
 * @property {boolean} coarse  the main pointer is a finger, `(pointer: coarse)`
 * @property {number} maxTouchPoints
 * @property {string} platform  `navigator.platform`
 * @property {string} userAgent
 */

/** The player's choice in settings; "auto" follows the device. */
export const CONTROL_MODES = /** @type {const} */ (["auto", "touch", "desktop"]);

/**
 * True when a device starts in touch mode: its main pointer is a finger
 * (phones, iPads, Android tablets), or it is an iPad asking for desktop sites,
 * which reports itself as a Mac but has touch points. A laptop with a touch
 * screen keeps the mouse, its main pointer.
 * @param {DeviceTraits} device
 * @param {string} [mode] "auto" (the default), "touch" or "desktop"
 */
export function prefersTouch(device, mode = "auto") {
  if (mode === "touch") return true;
  if (mode === "desktop") return false;
  if (!(device.maxTouchPoints > 0)) return false;
  if (device.coarse) return true;
  return device.maxTouchPoints > 1 && /Mac/.test(device.platform || device.userAgent);
}

/** How far, in CSS pixels, the thumbstick's knob travels to full deflection. */
export const STICK_RADIUS = 48;
/** The share of the stick's travel that does nothing, so a resting thumb stands still. */
export const STICK_DEAD_ZONE = 0.14;
/** Past this deflection the walk becomes a run. */
export const STICK_RUN = 0.9;

/**
 * A thumb's offset from where it landed, as a deflection: `x` right and `y`
 * down, each up to 1, and `magnitude` from 0 (inside the dead zone) to 1.
 * @param {number} dx
 * @param {number} dy
 * @param {number} [radius]
 */
export function stickVector(dx, dy, radius = STICK_RADIUS) {
  const distance = Math.hypot(dx, dy);
  const reach = Math.min(distance / radius, 1);
  if (reach <= STICK_DEAD_ZONE) return { x: 0, y: 0, magnitude: 0 };
  const magnitude = (reach - STICK_DEAD_ZONE) / (1 - STICK_DEAD_ZONE);
  return { x: (dx / distance) * magnitude, y: (dy / distance) * magnitude, magnitude };
}

/**
 * Walking speed for a deflection: it builds to a walk by three quarters of the
 * way, then a run at the rim.
 * @param {number} magnitude 0 to 1
 * @param {number} walk
 * @param {number} run
 */
export function stickSpeed(magnitude, walk, run) {
  if (magnitude >= STICK_RUN) return run;
  return walk * Math.min(1, magnitude / 0.75);
}

/** A finger that moves less than this, in CSS pixels, is still tapping. */
export const TAP_SLOP = 10;

/**
 * True when a press counts as a tap: the finger lifted near where it landed.
 * How long it was held does not matter, as nothing waits on a long press, and
 * a slow frame between the press and the lift must not lose the tap.
 * @param {number} moved  the farthest the finger strayed, in CSS pixels
 */
export function isTap(moved) {
  return moved < TAP_SLOP;
}

/**
 * @typedef {{ x: number, y: number }} Point
 * @typedef {object} TwoFinger
 * @property {number} scale  the fingers' spread now over at the start
 * @property {number} rotation  radians the line between them has turned, clockwise on screen
 * @property {number} dx  how far their midpoint has moved, in CSS pixels
 * @property {number} dy
 */

/**
 * How a pair of fingers has moved since the gesture began.
 * @param {Point} a0 first finger at the start
 * @param {Point} b0 second finger at the start
 * @param {Point} a1 first finger now
 * @param {Point} b1 second finger now
 * @returns {TwoFinger}
 */
export function twoFinger(a0, b0, a1, b1) {
  const spread0 = Math.max(1, Math.hypot(b0.x - a0.x, b0.y - a0.y)),
    spread1 = Math.max(1, Math.hypot(b1.x - a1.x, b1.y - a1.y));
  let rotation =
    Math.atan2(b1.y - a1.y, b1.x - a1.x) - Math.atan2(b0.y - a0.y, b0.x - a0.x);
  rotation = Math.atan2(Math.sin(rotation), Math.cos(rotation));
  return {
    scale: spread1 / spread0,
    rotation,
    dx: (a1.x + b1.x - a0.x - b0.x) / 2,
    dy: (a1.y + b1.y - a0.y - b0.y) / 2,
  };
}

/** A twist turns the view once the fingers have turned this far, in radians (about 11°). */
export const TWIST_START = 0.2;
/** Both fingers sliding this far together, in CSS pixels, tilts the view. */
export const TILT_START = 24;

/**
 * @typedef {object} TwoFingerModes
 * @property {boolean} zoom
 * @property {boolean} twist
 * @property {boolean} tilt
 */

/**
 * Which parts of a two-finger gesture are under way, so a pinch does not also
 * turn the map by accident. A pinch zooms from the start; a twist past
 * `TWIST_START` turns the view as well; both fingers sliding up or down
 * together, with little pinch or twist, tilts it and then only tilts. Once a
 * part is under way it stays on until the fingers lift.
 * @param {TwoFinger} gesture
 * @param {TwoFingerModes} [modes] the parts already under way
 * @returns {TwoFingerModes}
 */
export function twoFingerModes(gesture, modes = { zoom: true, twist: false, tilt: false }) {
  if (modes.tilt) return modes;
  const steady =
    Math.abs(Math.log(gesture.scale)) < 0.1 && Math.abs(gesture.rotation) < TWIST_START;
  if (!modes.twist && steady && Math.abs(gesture.dy) > TILT_START && Math.abs(gesture.dy) > Math.abs(gesture.dx))
    return { zoom: false, twist: false, tilt: true };
  if (!modes.twist && Math.abs(gesture.rotation) > TWIST_START) return { zoom: true, twist: true, tilt: false };
  return modes;
}
