// @ts-check
// Willow Mill's water wheel, shared by the village's model of it
// (src/village/buildings.js) and the mill's inside (src/mill/room.js), so the
// sluice shut indoors stills the wheel you see from the green. Whichever view is
// drawn steps it; the other picks up where it left off. No three.js, so @logic
// tests can run it.

/** How fast the wheel turns with the sluice open, in radians a second. */
export const WHEEL_RATE = 0.18;

// How quickly the wheel runs down once the water is shut off, and how quickly
// the race brings it back up to speed.
const RUNNING_DOWN = 0.9,
  PICKING_UP = 0.6,
  // Below this share of its speed the wheel has stopped.
  STOPPED = 0.02;

export function createWheel() {
  const wheel = {
    /** Whether the sluice gate is down, holding the water back. */
    shut: false,
    /** How much of its full speed the wheel has, from 0 (still) to 1. */
    drive: 1,
    /** How far the wheel has turned, in radians. */
    turn: 0,
    /** Drops the sluice gate, or lifts it; says whether it is now shut. */
    toggleSluice() {
      wheel.shut = !wheel.shut;
      return wheel.shut;
    },
    /**
     * Moves the wheel on `dt` seconds. With the water shut off it slows over a
     * few seconds and stands; without `motion` it holds its angle.
     * @param {number} dt
     * @param {boolean} [motion]
     */
    step(dt, motion = true) {
      const rate = wheel.shut ? RUNNING_DOWN : PICKING_UP;
      wheel.drive += ((wheel.shut ? 0 : 1) - wheel.drive) * (1 - Math.exp(-dt * rate));
      if (wheel.shut && wheel.drive < STOPPED) wheel.drive = 0;
      if (motion) wheel.turn += dt * wheel.drive * WHEEL_RATE;
    },
    get turning() {
      return wheel.drive > STOPPED;
    },
  };
  return wheel;
}

/** The one mill wheel. */
export const millWheel = createWheel();
