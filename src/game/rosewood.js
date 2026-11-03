// @ts-check
// Rosewood's activities as pure decisions on the save's state: what Bark digs
// up in the back garden, the jigsaw on the living-room table, and the trail
// Bark follows the visitor along. No three.js and no DOM, so the logic tests
// run it in Node; src/rosewood.js shows the results.

// What Bark digs up, in order; each one joins the hall's treasure shelf.
export const TREASURES = [
  { id: "button", name: "a brass button" },
  { id: "marble", name: "a blue glass marble" },
  { id: "key", name: "a tiny old key" },
  { id: "shell", name: "a seashell, very far from the sea" },
  { id: "spoon", name: "a silver teaspoon" },
  { id: "soldier", name: "a tin soldier with one arm" },
];

// Each new treasure earns petals; digging again finds Bark's own bone.
export const DIG = { petals: 3 };

// Pieces in the jigsaw of the village green.
export const PUZZLE_PIECES = 12;

/** Rosewood's part of a fresh save. */
export function rosewoodDefaults() {
  return { rosewood: { treasures: [], puzzle: 0, fetches: 0 } };
}

/** @typedef {ReturnType<typeof rosewoodDefaults>["rosewood"]} RosewoodState */

/**
 * Bark digs once. Returns { kind: "found", treasure, petals } for the next
 * treasure not yet on the shelf, recording and paying it, or { kind: "bone" }
 * once the shelf is full.
 * @param {{ rosewood: RosewoodState, coins: number }} state
 */
export function dig(state) {
  const found = new Set(state.rosewood.treasures);
  const treasure = TREASURES.find((t) => !found.has(t.id));
  if (!treasure) return { kind: "bone" };
  state.rosewood.treasures.push(treasure.id);
  state.coins += DIG.petals;
  return { kind: "found", treasure, petals: DIG.petals };
}

/**
 * Fits the next jigsaw piece. Returns { kind: "placed", placed, left } while
 * pieces remain, { kind: "done" } for the last one, and on a finished puzzle
 * tips it back into the box: { kind: "restart" }.
 * @param {{ rosewood: RosewoodState }} state
 */
export function placePiece(state) {
  const r = state.rosewood;
  if (r.puzzle >= PUZZLE_PIECES) {
    r.puzzle = 0;
    return { kind: "restart" };
  }
  r.puzzle++;
  if (r.puzzle === PUZZLE_PIECES) return { kind: "done" };
  return { kind: "placed", placed: r.puzzle, left: PUZZLE_PIECES - r.puzzle };
}

/**
 * The visitor's footsteps, as a polyline Bark trots along a little way
 * behind. The visitor only walks where the room allows, so the trail leads
 * through doorways and around furniture without any route finding.
 * `spacing` is how far apart points are recorded.
 */
export function createTrail(spacing = 0.2) {
  /** Footsteps `spacing` apart, then the visitor's latest position. */
  /** @type {{ x: number, z: number }[]} */
  let points = [];
  let head = { x: 0, z: 0 };
  const ahead = () => [...points, head];
  /** The trail's length from `dog`, through every point ahead of it. */
  function remaining(dog) {
    let total = 0,
      from = dog;
    for (const p of ahead()) {
      total += Math.hypot(p.x - from.x, p.z - from.z);
      from = p;
    }
    return total;
  }
  return {
    get points() {
      return ahead();
    },
    /** Starts the trail afresh as a straight line `from` → `to`. */
    reset(from, to) {
      points = [{ ...from }];
      head = { ...to };
    },
    /** Moves the trail's end to the visitor, keeping a footstep every `spacing`. */
    record(x, z) {
      head = { x, z };
      const last = points[points.length - 1];
      if (!last || Math.hypot(x - last.x, z - last.z) >= spacing) points.push({ x, z });
      if (points.length > 400) points = points.slice(-300);
    },
    /**
     * Moves `dog` ({ x, z }) along the trail toward the point `gap` short of
     * its end, at most `step` this frame. Returns the distance moved; the
     * footsteps it has passed are dropped.
     */
    follow(dog, step, gap) {
      let budget = Math.min(step, Math.max(0, remaining(dog) - gap)),
        moved = 0;
      while (budget > 1e-6) {
        const target = points[0] ?? head,
          dx = target.x - dog.x,
          dz = target.z - dog.z,
          d = Math.hypot(dx, dz);
        if (d <= budget) {
          dog.x = target.x;
          dog.z = target.z;
          budget -= d;
          moved += d;
          if (points.length) points.shift();
          else break;
        } else {
          dog.x += (dx / d) * budget;
          dog.z += (dz / d) * budget;
          moved += budget;
          budget = 0;
        }
      }
      return moved;
    },
    /** How far the trail runs from `dog` to the visitor. */
    remaining,
  };
}
