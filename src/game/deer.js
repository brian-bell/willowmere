// @ts-check
// A doe and her fawn, who roam the orchard hill, the old wood and the open
// fields beside them: where they may go, and what each does from moment to
// moment. Pure rules with no three.js and no DOM, so the logic tests run them
// in Node; src/deer.js builds the two animals and poses them from this state.
//
// The doe grazes, looks up, and walks on in short hops toward a far goal
// somewhere in her range. A visitor who comes close makes her stop and stare;
// one who comes closer, or keeps coming, sends her bounding away, white tail
// up. She leaves a trail of footprints, and the fawn walks it a few paces
// behind her, so wherever she can go, he can follow. While she grazes he
// grazes too, or skips off to play near her and comes back when she moves on.
//
// Every step either takes is along a straight segment checked clear of the
// world's colliders, so neither ever walks into a tree, a hive or a wall.
import { collides } from "./navigation.js";

/** @typedef {{ minX: number, maxX: number, minZ: number, maxZ: number }} Box */
/** @typedef {{ x: number, z: number }} Point */
/**
 * @typedef {object} Deer One animal's state, which src/deer.js poses.
 * @property {number} x
 * @property {number} z
 * @property {number} heading radians about y, 0 facing +z
 * @property {number} speed metres a second along the ground
 * @property {string} activity graze, look, walk, alert, flee (the doe);
 *   follow, graze, play, return (the fawn)
 * @property {number} headDown 0 head up, 1 head down in the grass
 * @property {number} lookYaw where the head turns, radians from the heading
 * @property {boolean} alert ears forward and head high
 * @property {boolean} tailUp the white flag of a fleeing deer
 * @property {boolean} bounce the fawn's playful springing
 * @property {number} timer seconds left in the activity
 * @property {Point[]} route the points still to walk to, in order
 */

// Where the two may go: the orchard hill short of the millpond's ground, the
// old wood with the strip of fields between it and the hill, and the open
// fields south-west of the wood. Each stays inside the walk box
// (src/world-layout.js) and keeps half a metre or so off the village.
export const ROAM = [
  { id: "orchard", minX: -45, maxX: -3, minZ: -38, maxZ: -21.4, share: 0.4 },
  { id: "wood", minX: -45, maxX: -24.6, minZ: -21.4, maxZ: 21.4, share: 0.3 },
  { id: "fields", minX: -45, maxX: -24.6, minZ: 21.4, maxZ: 37.6, share: 0.3 },
];

export const DEER = {
  // Clearance from colliders, in metres, and speeds in metres a second.
  doe: { radius: 0.55, graze: 0.3, walk: 0.8, run: 4.4 },
  fawn: { radius: 0.36, play: 1.7, run: 5.2 },
  // The doe looks up at a visitor closer than `alert`, bolts from one closer
  // than `flee` or one coming on inside `wary`, and settles once they are
  // further than `calm`. A visitor who stands still long enough is forgiven.
  alert: 9,
  wary: 6.5,
  flee: 4.6,
  calm: 12,
  forgive: 6,
  // How far behind the doe, along her trail, the fawn keeps.
  lag: 1.5,
  // A footprint every so many metres.
  crumb: 0.3,
  // Hops toward the goal, and bounds away from a visitor.
  hop: [2.5, 8],
  bound: [5, 9],
  // Turning on the spot before a hop more than this far round, radians.
  pivot: 1.2,
};

const TAU = Math.PI * 2;
const wrap = (/** @type {number} */ a) => Math.atan2(Math.sin(a), Math.cos(a));

/** Whether (x, z) lies in the deer's range. */
export const inRoam = (/** @type {number} */ x, /** @type {number} */ z) =>
  ROAM.some((b) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ);

/** Which part of the range (x, z) lies in: orchard, wood or fields, else null. */
export const roamArea = (/** @type {number} */ x, /** @type {number} */ z) =>
  ROAM.find((b) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ)?.id ?? null;

/** Mulberry32, so the two roam the same way for the same seed. */
function random(/** @type {number} */ seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A collider's footprint on the ground, `margin` metres wider all round. */
function footprint(/** @type {any} */ c, /** @type {number} */ margin) {
  if (c.minX !== undefined)
    return { minX: c.minX - margin, maxX: c.maxX + margin, minZ: c.minZ - margin, maxZ: c.maxZ + margin };
  const w = (c.w !== undefined ? c.w / 2 : c.r) + margin,
    d = (c.d !== undefined ? c.d / 2 : c.r) + margin;
  return { minX: c.x - w, maxX: c.x + w, minZ: c.z - d, maxZ: c.z + d };
}

// The range's colliders are filed in square cells, so a test looks only at
// the few in its own cell. A collider joins every cell it could block from.
const CELL = 4,
  REACH = 1;
const bounds = {
  minX: Math.min(...ROAM.map((b) => b.minX)) - CELL,
  minZ: Math.min(...ROAM.map((b) => b.minZ)) - CELL,
  maxX: Math.max(...ROAM.map((b) => b.maxX)) + CELL,
  maxZ: Math.max(...ROAM.map((b) => b.maxZ)) + CELL,
};
const COLS = Math.ceil((bounds.maxX - bounds.minX) / CELL),
  ROWS = Math.ceil((bounds.maxZ - bounds.minZ) / CELL);
function fileColliders(/** @type {object[]} */ colliders) {
  const cells = Array.from({ length: COLS * ROWS }, () => /** @type {object[]} */ ([]));
  for (const c of colliders) {
    const f = footprint(c, REACH),
      x0 = Math.max(0, Math.floor((f.minX - bounds.minX) / CELL)),
      x1 = Math.min(COLS - 1, Math.floor((f.maxX - bounds.minX) / CELL)),
      z0 = Math.max(0, Math.floor((f.minZ - bounds.minZ) / CELL)),
      z1 = Math.min(ROWS - 1, Math.floor((f.maxZ - bounds.minZ) / CELL));
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) cells[z * COLS + x].push(c);
  }
  return cells;
}

/**
 * The doe and the fawn. `colliders` is the world's list (colliders never
 * move; only those near the range are kept); `avoid()` lists people the two
 * keep a couple of metres from, read live, since residents stream in.
 *
 * @param {{ colliders: object[], avoid?: () => Point[], seed?: number, start?: Point }} options
 */
export function createHerd({ colliders, avoid = () => [], seed = 0x0d0e, start }) {
  const rand = random(seed),
    cells = fileColliders(colliders),
    range = (/** @type {number} */ a, /** @type {number} */ b) => a + (b - a) * rand();
  let people = /** @type {Point[]} */ ([]),
    peopleAge = Infinity;

  /** Whether an animal of radius `r` may stand at (x, z). */
  function clear(/** @type {number} */ x, /** @type {number} */ z, /** @type {number} */ r) {
    if (!inRoam(x, z)) return false;
    const cell = cells[Math.floor((z - bounds.minZ) / CELL) * COLS + Math.floor((x - bounds.minX) / CELL)];
    if (collides(cell, x, z, r)) return false;
    for (const p of people) if (Math.hypot(x - p.x, z - p.z) < 2 + r) return false;
    return true;
  }
  /** Whether the straight walk from a to b is clear for radius `r`. */
  function open(
    /** @type {number} */ ax,
    /** @type {number} */ az,
    /** @type {number} */ bx,
    /** @type {number} */ bz,
    /** @type {number} */ r,
  ) {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.25));
    for (let i = 1; i <= n; i++)
      if (!clear(ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n, r)) return false;
    return true;
  }
  /**
   * A clear spot somewhere in the range: a part picked by its share (the
   * wood lies between the other two, so she crosses it on the way), then a
   * spot in it.
   */
  function anywhere(/** @type {number} */ r) {
    for (let i = 0; i < 60; i++) {
      let pick = rand(),
        k = 0;
      while (pick > ROAM[k].share && k < ROAM.length - 1) pick -= ROAM[k++].share;
      const b = ROAM[k],
        x = range(b.minX + 1, b.maxX - 1),
        z = range(b.minZ + 1, b.maxZ - 1);
      if (clear(x, z, r + 0.3)) return { x, z };
    }
    return null;
  }

  /** @returns {Deer} */
  const animal = (/** @type {number} */ x, /** @type {number} */ z, /** @type {number} */ heading, /** @type {string} */ activity) => ({
    x,
    z,
    heading,
    speed: 0,
    activity,
    headDown: 1,
    lookYaw: 0,
    alert: false,
    tailUp: false,
    bounce: false,
    timer: range(3, 7),
    route: [],
  });

  // Where they start: the first clear spot of a few in the wood and on the
  // hill's west slope, the fawn a pace behind.
  const r0 = DEER.doe.radius;
  const starts = start ? [start] : [{ x: -41.6, z: -16.5 }, { x: -42, z: -25.8 }, { x: -38.6, z: 26 }];
  let first = starts.find((p) => clear(p.x, p.z, r0 + 0.3)) ?? anywhere(r0) ?? { x: -40, z: 30 };
  const doe = animal(first.x, first.z, Math.PI / 2, "graze");
  let fawnStart = null;
  for (let i = 0; i < 16 && !fawnStart; i++) {
    const a = doe.heading + Math.PI + (i % 2 ? 1 : -1) * Math.floor((i + 1) / 2) * 0.4,
      fx = doe.x + Math.sin(a) * DEER.lag,
      fz = doe.z + Math.cos(a) * DEER.lag;
    if (clear(fx, fz, DEER.fawn.radius) && open(fx, fz, doe.x, doe.z, DEER.fawn.radius))
      fawnStart = { x: fx, z: fz };
  }
  fawnStart ??= { x: doe.x, z: doe.z };
  const fawn = animal(fawnStart.x, fawnStart.z, doe.heading, "follow");
  // The doe's footprints not yet reached by the fawn, oldest first. The last
  // leg runs from the newest footprint to the doe herself.
  const trail = /** @type {Point[]} */ ([]);
  let lastCrumb = { x: doe.x, z: doe.z };
  if (fawnStart.x !== doe.x || fawnStart.z !== doe.z) trail.push(lastCrumb);
  let goal = anywhere(r0),
    goalAge = 0,
    last = /** @type {Point | null} */ (null),
    standing = 0,
    forgiveTime = 0,
    wary = false,
    anchor = /** @type {Point | null} */ (null),
    doeStill = 0;
  const doePoint = { x: 0, z: 0 };

  /**
   * Moves `a` up to `distance` along `route` (popping the points it reaches),
   * turning toward where it goes at `turn` radians a second. Returns how far
   * it went.
   */
  function advance(
    /** @type {Deer} */ a,
    /** @type {Point[]} */ route,
    /** @type {number} */ distance,
    /** @type {number} */ turn,
    /** @type {number} */ dt,
    /** @type {Point | null} */ end = null,
  ) {
    let moved = 0;
    while (distance > 1e-6) {
      const target = route[0] ?? end;
      if (!target) break;
      const dx = target.x - a.x,
        dz = target.z - a.z,
        gap = Math.hypot(dx, dz);
      if (gap < 1e-4) {
        if (route.length) route.shift();
        else break;
        continue;
      }
      const step = Math.min(distance, gap);
      a.x += (dx / gap) * step;
      a.z += (dz / gap) * step;
      moved += step;
      distance -= step;
      const off = wrap(Math.atan2(dx, dz) - a.heading);
      a.heading = wrap(a.heading + Math.sign(off) * Math.min(Math.abs(off), turn * dt));
      if (step === gap) {
        if (route.length) route.shift();
        else break;
      }
    }
    return moved;
  }
  /** Length of a walk through `route` from `a`, then on to `end`. */
  function length(/** @type {Point} */ a, /** @type {Point[]} */ route, /** @type {Point | null} */ end = null) {
    let total = 0,
      x = a.x,
      z = a.z;
    for (const p of route) {
      total += Math.hypot(p.x - x, p.z - z);
      x = p.x;
      z = p.z;
    }
    return end ? total + Math.hypot(end.x - x, end.z - z) : total;
  }
  /**
   * Walks `a` along its route at up to `top`, easing in at `accel` and out
   * so it stops where the route ends; first turns on the spot to face a hop
   * that starts far round. Returns how far it went.
   */
  function walk(/** @type {Deer} */ a, /** @type {number} */ top, /** @type {number} */ accel, /** @type {number} */ turn, /** @type {number} */ dt) {
    const target = a.route[0];
    if (!target) {
      a.speed = 0;
      return 0;
    }
    const off = wrap(Math.atan2(target.x - a.x, target.z - a.z) - a.heading);
    if (a.speed < 0.25 && Math.abs(off) > DEER.pivot) {
      a.speed = 0;
      a.heading = wrap(a.heading + Math.sign(off) * Math.min(Math.abs(off), turn * 0.7 * dt));
      return 0;
    }
    const remaining = length(a, a.route);
    a.speed = Math.min(top, a.speed + accel * dt, Math.sqrt(2 * accel * remaining) + 0.12);
    return advance(a, a.route, a.speed * dt, turn, dt);
  }

  /**
   * A hop from the doe: `away` from the visitor at `from`, else toward the
   * goal and not toward the visitor. Picks the best of a few clear
   * candidates, or none.
   */
  function hop(
    /** @type {Point | null} */ from,
    /** @type {boolean} */ away,
    /** @type {number} */ heading,
    /** @type {Point} */ at = doe,
  ) {
    const [near, far] = away ? DEER.bound : DEER.hop,
      r = DEER.doe.radius;
    let best = null,
      bestScore = -Infinity;
    const toward = away && from
      ? Math.atan2(at.x - from.x, at.z - from.z)
      : goal
        ? Math.atan2(goal.x - at.x, goal.z - at.z)
        : heading;
    for (let i = 0; i < 16; i++) {
      const spread = away ? 1.5 : 1.3,
        angle = toward + (rand() - 0.5) * 2 * spread * (i < 8 ? 0.6 : 1),
        d = range(near, far),
        x = at.x + Math.sin(angle) * d,
        z = at.z + Math.cos(angle) * d;
      if (!away && from && Math.hypot(x - from.x, z - from.z) < DEER.alert) continue;
      if (!clear(x, z, r) || !open(at.x, at.z, x, z, r)) continue;
      const score = away && from
        ? Math.hypot(x - from.x, z - from.z) - Math.abs(wrap(angle - heading)) * 1.2 + rand()
        : goal
          ? Math.hypot(at.x - goal.x, at.z - goal.z) - Math.hypot(x - goal.x, z - goal.z) + rand() * 2
          : rand();
      if (score > bestScore) {
        best = { x, z };
        bestScore = score;
      }
    }
    return best;
  }

  function startFlee(/** @type {Point} */ player) {
    const next = hop(player, true, doe.heading);
    if (!next) {
      doe.activity = "alert";
      doe.timer = range(1.5, 3);
      doe.route.length = 0;
      return;
    }
    doe.activity = "flee";
    doe.route.length = 0;
    doe.route.push(next);
    doe.tailUp = true;
    doe.alert = true;
    doe.headDown = 0;
    wary = false;
    forgiveTime = 0;
    // Somewhere new to go, away from whoever startled her.
    goal = anywhere(DEER.doe.radius);
    goalAge = 0;
  }

  /** What the doe does next after an activity ends. */
  function next(/** @type {Point | null} */ player) {
    const roll = rand();
    doe.lookYaw = 0;
    if (doe.activity === "graze") {
      if (roll < 0.45) {
        doe.activity = "look";
        doe.timer = range(1.5, wary ? 4.5 : 3.5);
        doe.lookYaw = (rand() - 0.5) * 2.2;
        return;
      }
      if (roll < 0.75) {
        // A pace or two on through the grass, head still down.
        const angle = doe.heading + (rand() - 0.5) * 1.6,
          d = range(0.5, 1.3),
          x = doe.x + Math.sin(angle) * d,
          z = doe.z + Math.cos(angle) * d;
        if (clear(x, z, DEER.doe.radius) && open(doe.x, doe.z, x, z, DEER.doe.radius)) {
          doe.activity = "step";
          doe.route.push({ x, z });
          return;
        }
      }
      doe.timer = range(4, 10);
      return;
    }
    if (doe.activity === "look" && roll < 0.5) {
      doe.activity = "graze";
      doe.timer = range(4, 10);
      return;
    }
    if (doe.activity === "look" || doe.activity === "alert") {
      if (!goal || Math.hypot(goal.x - doe.x, goal.z - doe.z) < 4) goal = anywhere(DEER.doe.radius);
      const target = hop(player, false, doe.heading);
      if (target) {
        doe.activity = "walk";
        doe.route.push(target);
        return;
      }
      goal = anywhere(DEER.doe.radius);
      doe.activity = "graze";
      doe.timer = range(3, 6);
      return;
    }
    // After a walk or a pace: mostly back to grazing.
    doe.activity = roll < 0.35 ? "look" : "graze";
    doe.timer = doe.activity === "look" ? range(1.5, 3) : range(5, 11);
    if (doe.activity === "look") doe.lookYaw = (rand() - 0.5) * 2;
  }

  function updateDoe(/** @type {number} */ dt, /** @type {Point | null} */ player) {
    const d = player ? Math.hypot(player.x - doe.x, player.z - doe.z) : Infinity;
    // Coming on: the visitor's own pace toward her, not hers toward them.
    let approaching = false;
    if (player && last) {
      const toward = ((player.x - last.x) * (doe.x - player.x) + (player.z - last.z) * (doe.z - player.z)) / Math.max(d, 1e-6);
      approaching = toward > 0.6 * dt;
    }
    if (player) {
      last ??= { x: 0, z: 0 };
      last.x = player.x;
      last.z = player.z;
    } else last = null;
    standing = player && !approaching ? standing + dt : 0;
    goalAge += dt;
    if (goalAge > 300) {
      goal = anywhere(DEER.doe.radius);
      goalAge = 0;
    }
    if (doe.activity !== "flee" && player) {
      if (d < DEER.flee || (d < DEER.wary && approaching)) startFlee(player);
      else if (d < DEER.alert && doe.activity !== "alert" && (!wary || approaching)) {
        doe.activity = "alert";
        doe.route.length = 0;
        doe.timer = range(2, 4);
        forgiveTime = 0;
      }
    }
    const top =
      doe.activity === "flee" ? DEER.doe.run : doe.activity === "step" ? DEER.doe.graze : DEER.doe.walk;
    const moved = walk(doe, top, doe.activity === "flee" ? 5 : 1.4, doe.activity === "flee" ? 5 : 2.6, dt);
    doeStill = moved > 0 ? 0 : doeStill + dt;
    if (moved > 0 && Math.hypot(doe.x - lastCrumb.x, doe.z - lastCrumb.z) >= DEER.crumb) {
      lastCrumb = { x: doe.x, z: doe.z };
      trail.push(lastCrumb);
    }

    // What she looks like doing it.
    const grazing = doe.activity === "graze" || doe.activity === "step";
    doe.headDown = grazing ? 1 : 0;
    doe.alert = doe.activity === "alert" || doe.activity === "flee";
    if (doe.activity !== "flee") doe.tailUp = false;
    if (doe.activity === "alert" && player)
      doe.lookYaw = Math.max(-1.3, Math.min(1.3, wrap(Math.atan2(player.x - doe.x, player.z - doe.z) - doe.heading)));

    if (doe.activity === "flee") {
      doe.lookYaw = 0;
      // Still chased: plan the next bound before this one ends, so she runs
      // on through it instead of pulling up.
      const end = doe.route.at(-1);
      if (end && player && doe.route.length === 1 && d < DEER.calm && length(doe, doe.route) < 2.5) {
        const more = hop(
          player,
          true,
          Math.atan2(end.x - doe.x, end.z - doe.z),
          end,
        );
        if (more) doe.route.push(more);
      }
      if (doe.route.length) return;
      // Far enough? Then turn and look back; else bound on.
      if (d > DEER.calm) {
        doe.activity = "alert";
        doe.timer = range(2.5, 4.5);
        doe.tailUp = false;
      } else if (player) {
        const more = hop(player, true, doe.heading);
        if (more) doe.route.push(more);
        else {
          doe.activity = "alert";
          doe.timer = range(2, 3);
        }
      }
      return;
    }
    if (doe.activity === "alert") {
      // Gone, or standing still long enough to be trusted.
      if (d > DEER.alert) {
        doe.timer -= dt;
        if (doe.timer <= 0) next(player);
      } else if (standing > 0) {
        forgiveTime += dt;
        if (forgiveTime > DEER.forgive) {
          wary = true;
          doe.activity = "graze";
          doe.timer = range(3, 7);
        }
      }
      return;
    }
    if (d > DEER.calm) wary = false;
    if (doe.activity === "walk" || doe.activity === "step") {
      if (!doe.route.length) next(player);
      return;
    }
    doe.timer -= dt;
    if (doe.timer <= 0) next(player);
  }

  /** Picks a spot near the doe for the fawn to skip to from where he stands. */
  function playSpot() {
    const r = DEER.fawn.radius;
    for (let i = 0; i < 10; i++) {
      const angle = rand() * TAU,
        d = range(1.1, 2.8),
        x = doe.x + Math.sin(angle) * d,
        z = doe.z + Math.cos(angle) * d;
      if (Math.hypot(x - fawn.x, z - fawn.z) < 0.8) continue;
      // Not through her.
      const ex = x - fawn.x,
        ez = z - fawn.z,
        t = Math.max(0, Math.min(1, ((doe.x - fawn.x) * ex + (doe.z - fawn.z) * ez) / (ex * ex + ez * ez)));
      if (Math.hypot(fawn.x + ex * t - doe.x, fawn.z + ez * t - doe.z) < 0.75) continue;
      if (clear(x, z, r) && open(fawn.x, fawn.z, x, z, r)) return { x, z };
    }
    return null;
  }

  function updateFawn(/** @type {number} */ dt, /** @type {Point | null} */ player) {
    doePoint.x = doe.x;
    doePoint.z = doe.z;
    const fleeing = doe.activity === "flee",
      lag = fleeing ? 1.2 : DEER.lag,
      doeMoving = doe.route.length > 0;
    fawn.bounce = false;
    // Off playing: come back to the trail before following on.
    if (fawn.activity === "play" || fawn.activity === "return") {
      if (doeMoving && fawn.activity === "play" && anchor) {
        fawn.activity = "return";
        fawn.route.length = 0;
        fawn.route.push(anchor);
      }
      const top = fawn.activity === "return" && fleeing ? DEER.fawn.run : DEER.fawn.play;
      walk(fawn, top, 4, 5, dt);
      fawn.bounce = fawn.activity === "play" && fawn.speed > 0.4;
      fawn.headDown = 0;
      if (fawn.route.length) return;
      if (fawn.activity === "play") {
        // A moment at the spot, then back.
        fawn.timer -= dt;
        fawn.headDown = 1;
        if (fawn.timer <= 0 && anchor) {
          fawn.activity = "return";
          fawn.route.push(anchor);
        }
        return;
      }
      fawn.activity = "follow";
      anchor = null;
    }
    // Following: walk the doe's footprints, keeping `lag` behind her.
    const ahead = length(fawn, trail, doePoint);
    if (ahead > lag + 0.02) {
      const want = Math.min(
          DEER.fawn.run,
          Math.max(doe.speed, 0.5) * (fleeing ? 1.1 : 1) + Math.max(0, ahead - lag - 0.3) * 1.3,
        ),
        accel = fleeing ? 8 : 3;
      fawn.speed = Math.min(want, fawn.speed + accel * dt, Math.sqrt(2 * accel * (ahead - lag)) + 0.1);
      advance(fawn, trail, Math.min(fawn.speed * dt, ahead - lag), fleeing ? 6 : 4, dt, doePoint);
      fawn.activity = "follow";
      fawn.headDown = 0;
      fawn.timer = range(2, 5);
    } else {
      fawn.speed = 0;
      // Keep turning to face her when she is well round.
      const off = wrap(Math.atan2(doe.x - fawn.x, doe.z - fawn.z) - fawn.heading);
      if (Math.abs(off) > 0.9) fawn.heading = wrap(fawn.heading + Math.sign(off) * Math.min(Math.abs(off), 1.4 * dt));
      fawn.headDown = doe.headDown && doeStill > 1.5 ? 1 : 0;
      fawn.timer -= dt;
      const nearPlayer = player && Math.hypot(player.x - fawn.x, player.z - fawn.z) < DEER.alert;
      if (fawn.timer <= 0) {
        fawn.timer = range(3, 8);
        if (doe.activity === "graze" && doeStill > 2 && !nearPlayer && rand() < 0.5) {
          const spot = playSpot();
          if (spot) {
            anchor = { x: fawn.x, z: fawn.z };
            fawn.activity = "play";
            fawn.route.push(spot);
            fawn.timer = range(1.5, 4);
          }
        }
      }
    }
    fawn.alert = doe.alert;
    fawn.tailUp = fleeing;
    fawn.lookYaw = doe.activity === "alert" && player
      ? Math.max(-1.3, Math.min(1.3, wrap(Math.atan2(player.x - fawn.x, player.z - fawn.z) - fawn.heading)))
      : 0;
    // Should the two ever part (they should not), he catches her up.
    if (Math.hypot(doe.x - fawn.x, doe.z - fawn.z) > 25) {
      fawn.x = doe.x;
      fawn.z = doe.z;
      trail.length = 0;
    }
  }

  return {
    doe,
    fawn,
    /** The doe's footprints still ahead of the fawn. */
    trail,
    /** Where the doe is heading, far off. */
    get goal() {
      return goal;
    },
    clear,
    open,
    /**
     * Advances both by `dt` seconds. `player` is the visitor's ground
     * position, or null when there is nobody to notice.
     */
    update(/** @type {number} */ dt, /** @type {Point | null} */ player) {
      dt = Math.min(dt, 0.1);
      peopleAge += dt;
      if (peopleAge > 3) {
        peopleAge = 0;
        people = avoid().filter((p) => inRoam(p.x, p.z) || ROAM.some((b) => p.x > b.minX - 3 && p.x < b.maxX + 3 && p.z > b.minZ - 3 && p.z < b.maxZ + 3));
      }
      updateDoe(dt, player);
      updateFawn(dt, player);
    },
  };
}
