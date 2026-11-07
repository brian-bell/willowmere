// @ts-check
// The old windmill's sails, shared by the tower's inside (src/windmill/room.js)
// and the orchard's model of it (src/regions/orchard.js), so the brake leant on
// upstairs holds the sails you see from the hill. Whichever view is drawn steps
// them; the other picks up where it left off. No three.js, so @logic tests can
// run it.

/** How fast the sails turn with the wind full in them, in radians a second. */
export const SAIL_RATE = 0.32;

// How quickly the brake takes the way off the sails, and the wind puts it back.
const BRAKING = 2.2,
  PICKING_UP = 0.9,
  // Below this share of the wind's turn the sails have stopped.
  STOPPED = 0.02;

export function createSails() {
  const sails = {
    braked: false,
    /** How much of the wind's turn the sails have, from 0 (held) to 1. */
    drive: 1,
    /** How far the sails have turned, in radians. */
    turn: 0,
    /** Leans on the brake, or lets it go; says which. */
    toggleBrake() {
      sails.braked = !sails.braked;
      return sails.braked;
    },
    /**
     * Moves the sails on `dt` seconds. The brake takes them down over a few
     * seconds and the wind picks them up again; without `motion` they hold
     * their angle.
     * @param {number} dt
     * @param {boolean} [motion]
     */
    step(dt, motion = true) {
      const rate = sails.braked ? BRAKING : PICKING_UP;
      sails.drive += ((sails.braked ? 0 : 1) - sails.drive) * (1 - Math.exp(-dt * rate));
      // Once it has them, the brake holds them dead still.
      if (sails.braked && sails.drive < STOPPED) sails.drive = 0;
      if (motion) sails.turn += dt * sails.drive * SAIL_RATE;
    },
    get turning() {
      return sails.drive > STOPPED;
    },
  };
  return sails;
}

/** The one windmill's sails. */
export const millSails = createSails();
