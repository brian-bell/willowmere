// @ts-check
// The school's football match, as pure rules: eight children, four a side
// (a keeper and three who run), one ball, two goals, and the walker, who can
// put a foot to the ball. No three.js and no DOM; src/regions/school-kids.js
// poses the children from this state every frame.
//
// It is children's football. The nearest child of each side runs at the
// ball and the rest drift with play; whoever reaches it shoots when the goal
// is near, passes now and then, and otherwise knocks it on and chases it.
// Keepers shuffle along their line and catch what they can, then throw it
// out. There are no throw-ins: the ball runs on to the railings and comes
// back off them. A goal is cheered for a few seconds, then the beaten keeper
// fetches the ball out of the net and play goes on.

/**
 * @typedef {{ minX: number, maxX: number, minZ: number, maxZ: number }} Box
 * @typedef {{ x: number, z: number, r: number }} Circle
 * @typedef {"run" | "kick" | "cheer" | "ready" | "hold" | "throw" | "dive"} Action
 * @typedef {{
 *   id: string, team: number, keeper: boolean, slot: number, pace: number,
 *   x: number, z: number, vx: number, vz: number, heading: number, speed: number,
 *   action: Action, actionTime: number, cooldown: number, side: number,
 *   saving: number,
 * }} Kid
 * @typedef {{
 *   x: number, z: number, y: number, vx: number, vz: number, vy: number,
 *   heldBy: Kid | null, inNet: number, spin: number,
 * }} Ball
 * @typedef {{ x: number, z: number, vx: number, vz: number }} Walker
 */

export const MATCH = {
  ball: 0.11,
  // The ball's roll dies away at this rate (per second, exponential), and it
  // keeps this much of its speed off the railings and the posts.
  roll: 0.85,
  bounce: 0.55,
  gravity: 9.8,
  // A child plays the ball within this of their middle, and waits this long
  // after a touch before the next.
  reach: 0.42,
  cooldown: 0.45,
  // How long a kick, a throw and a dive take, and a celebration lasts.
  kick: 0.32,
  throw: 0.45,
  dive: 0.8,
  cheer: 3.4,
  hold: 1.3,
  // Speeds in metres a second, and how fast a child gets up to speed.
  keeperPace: 2.2,
  accel: 7,
  // Children keep this far apart, and this far from the walker.
  apart: 0.62,
  walker: 0.85,
  // Shots come from inside this distance of the goal.
  shooting: 7.5,
};

/** Mulberry32: a seeded stream of numbers in [0, 1). */
function stream(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (/** @type {number} */ v, /** @type {number} */ a, /** @type {number} */ b) =>
  Math.min(b, Math.max(a, v));

/**
 * A match on `pitch`, with goals `goal.width` wide on its two short ends
 * (goal 0 at minX, which team 0 defends). The ball and the children stay
 * inside `bounds` (the railings, less the buildings), and the ball comes off
 * `obstacles` (boxes and circles), as the children go round them.
 *
 * @param {{
 *   pitch: Box, goal: { width: number, height: number, depth: number, post: number },
 *   bounds: Box, obstacles?: (Box | Circle)[], seed?: number,
 * }} options
 */
export function createMatch({ pitch, goal, bounds, obstacles = [], seed = 7 }) {
  const rand = stream(seed),
    centre = { x: (pitch.minX + pitch.maxX) / 2, z: (pitch.minZ + pitch.maxZ) / 2 },
    length = pitch.maxX - pitch.minX,
    goals = [pitch.minX, pitch.maxX],
    mouth = { minZ: centre.z - goal.width / 2, maxZ: centre.z + goal.width / 2 };
  // Which way each team attacks: team 0 towards +x.
  const forward = (/** @type {number} */ team) => (team === 0 ? 1 : -1);
  // Where each runner plays, for a team attacking +x: [along the pitch from
  // its own goal as a fraction of its length, across from the middle].
  const SLOTS = [
    [0.3, 0],
    [0.55, -2.2],
    [0.6, 2.3],
  ];
  /** @type {Kid[]} */
  const kids = [];
  for (const team of [0, 1])
    for (let slot = -1; slot < 3; slot++) {
      const keeper = slot < 0,
        home = homeOf(team, slot, centre.x);
      kids.push({
        id: `${team ? "blue" : "red"}-${keeper ? "keeper" : slot}`,
        team,
        keeper,
        slot,
        pace: keeper ? MATCH.keeperPace : 2.7 + rand() * 0.7,
        x: home.x,
        z: home.z,
        vx: 0,
        vz: 0,
        heading: team === 0 ? Math.PI / 2 : -Math.PI / 2,
        speed: 0,
        action: keeper ? "ready" : "run",
        actionTime: 0,
        cooldown: 0,
        side: 1,
        saving: 0,
      });
    }
  /** @type {Ball} */
  const ball = { x: centre.x, z: centre.z, y: 0, vx: 0, vz: 0, vy: 0, heldBy: null, inNet: -1, spin: 0 };
  const score = [0, 0];
  const match = {
    kids,
    ball,
    score,
    /** "play", or "goal" while a goal is cheered. */
    phase: "play",
    phaseTime: 0,
    /** Who touched the ball last: a child, "walker", or null. */
    lastTouch: /** @type {Kid | "walker" | null} */ (null),
    /** Called with (team, scorer) when a goal goes in. */
    onGoal: /** @type {((team: number, scorer: Kid | "walker" | null) => void) | null} */ (null),
    update,
    centre,
    mouth,
  };
  // Kick off: the ball rolls a little towards team 0's first runner.
  ball.vx = -1.2;

  /** Where a child plays when the ball is at x. */
  function homeOf(/** @type {number} */ team, /** @type {number} */ slot, /** @type {number} */ ballX) {
    const own = team === 0 ? pitch.minX : pitch.maxX,
      dir = forward(team);
    if (slot < 0) return { x: own + dir * 0.55, z: centre.z };
    const [along, across] = SLOTS[slot],
      // The team leans the way play has gone.
      shift = (ballX - centre.x) * 0.45;
    return {
      x: clamp(own + dir * along * length + shift, pitch.minX + 1.2, pitch.maxX - 1.2),
      z: centre.z + across,
    };
  }

  // --- The ball ----------------------------------------------------------

  /** Sends the ball off from `from` towards (x, z) at `speed`, lifted by `lift`. */
  function strike(/** @type {Kid | "walker"} */ from, /** @type {number} */ x, /** @type {number} */ z, /** @type {number} */ speed, lift = 0) {
    const dx = x - ball.x,
      dz = z - ball.z,
      d = Math.hypot(dx, dz) || 1;
    ball.vx = (dx / d) * speed;
    ball.vz = (dz / d) * speed;
    ball.vy = lift;
    ball.heldBy = null;
    match.lastTouch = from;
  }

  /** Pushes the ball out of a box or circle it has rolled into, and bounces it. */
  function bounceOff(/** @type {Box | Circle} */ o) {
    const r = MATCH.ball;
    if ("r" in o) {
      const dx = ball.x - o.x,
        dz = ball.z - o.z,
        d = Math.hypot(dx, dz),
        min = o.r + r;
      if (d >= min || d === 0) return;
      const nx = dx / d,
        nz = dz / d,
        along = ball.vx * nx + ball.vz * nz;
      ball.x = o.x + nx * min;
      ball.z = o.z + nz * min;
      if (along < 0) {
        ball.vx -= (1 + MATCH.bounce) * along * nx;
        ball.vz -= (1 + MATCH.bounce) * along * nz;
      }
      return;
    }
    if (ball.x < o.minX - r || ball.x > o.maxX + r || ball.z < o.minZ - r || ball.z > o.maxZ + r) return;
    // Out along the shallowest side.
    const west = ball.x - (o.minX - r),
      east = o.maxX + r - ball.x,
      north = ball.z - (o.minZ - r),
      south = o.maxZ + r - ball.z,
      least = Math.min(west, east, north, south);
    if (least === west) {
      ball.x = o.minX - r;
      ball.vx = -Math.abs(ball.vx) * MATCH.bounce;
    } else if (least === east) {
      ball.x = o.maxX + r;
      ball.vx = Math.abs(ball.vx) * MATCH.bounce;
    } else if (least === north) {
      ball.z = o.minZ - r;
      ball.vz = -Math.abs(ball.vz) * MATCH.bounce;
    } else {
      ball.z = o.maxZ + r;
      ball.vz = Math.abs(ball.vz) * MATCH.bounce;
    }
  }

  // The goal frames: a post at each end of each goal line, and the netted
  // box behind, which the ball enters only through its mouth.
  const posts = goals.flatMap((x) => [
    { x, z: mouth.minZ, r: goal.post },
    { x, z: mouth.maxZ, r: goal.post },
  ]);
  const netBoxes = goals.map((x, i) =>
    i === 0
      ? { minX: x - goal.depth, maxX: x, minZ: mouth.minZ, maxZ: mouth.maxZ }
      : { minX: x, maxX: x + goal.depth, minZ: mouth.minZ, maxZ: mouth.maxZ },
  );

  function moveBall(/** @type {number} */ dt) {
    if (ball.heldBy) {
      const k = ball.heldBy;
      ball.x = k.x + Math.sin(k.heading) * 0.24;
      ball.z = k.z + Math.cos(k.heading) * 0.24;
      ball.y = 0.42;
      ball.vx = ball.vz = ball.vy = 0;
      return;
    }
    const px = ball.x;
    ball.x += ball.vx * dt;
    ball.z += ball.vz * dt;
    // In the air it falls and bounces; on the grass it rolls to a stop.
    if (ball.y > 0 || ball.vy > 0) {
      ball.vy -= MATCH.gravity * dt;
      ball.y += ball.vy * dt;
      if (ball.y <= 0) {
        ball.y = 0;
        ball.vy = ball.vy < -1.2 ? -ball.vy * 0.45 : 0;
      }
    }
    const roll = Math.exp(-(ball.y > 0 ? 0.15 : MATCH.roll) * dt);
    ball.vx *= roll;
    ball.vz *= roll;
    if (Math.hypot(ball.vx, ball.vz) < 0.05) ball.vx = ball.vz = 0;
    ball.spin += (Math.hypot(ball.vx, ball.vz) * dt) / MATCH.ball;

    // Across a goal line, between the posts and under the bar: in the net.
    if (ball.inNet < 0)
      goals.forEach((x, i) => {
        const crossed = i === 0 ? px >= x && ball.x < x : px <= x && ball.x > x;
        if (crossed && ball.z > mouth.minZ && ball.z < mouth.maxZ && ball.y < goal.height) {
          ball.inNet = i;
          scored(i === 0 ? 1 : 0);
        }
      });
    if (ball.inNet >= 0) {
      // The net holds it.
      const box = netBoxes[ball.inNet],
        r = MATCH.ball;
      if (ball.x < box.minX + r || ball.x > box.maxX - r) {
        ball.x = clamp(ball.x, box.minX + r, box.maxX - r);
        ball.vx *= -0.15;
        ball.vz *= 0.5;
      }
      if (ball.z < box.minZ + r || ball.z > box.maxZ - r) {
        ball.z = clamp(ball.z, box.minZ + r, box.maxZ - r);
        ball.vz *= -0.2;
      }
      ball.y = Math.min(ball.y, goal.height - r);
      return;
    }
    netBoxes.forEach((box, i) => {
      // A ball coming in through the mouth has not reached the line yet.
      const front = i === 0 ? px >= goals[0] : px <= goals[1];
      if (front && ball.z > mouth.minZ && ball.z < mouth.maxZ) return;
      bounceOff(box);
    });
    if (ball.y < goal.height) for (const post of posts) bounceOff(post);
    for (const o of obstacles) bounceOff(o);
    // The railings.
    const r = MATCH.ball;
    if (ball.x < bounds.minX + r) {
      ball.x = bounds.minX + r;
      ball.vx = Math.abs(ball.vx) * MATCH.bounce;
    } else if (ball.x > bounds.maxX - r) {
      ball.x = bounds.maxX - r;
      ball.vx = -Math.abs(ball.vx) * MATCH.bounce;
    }
    if (ball.z < bounds.minZ + r) {
      ball.z = bounds.minZ + r;
      ball.vz = Math.abs(ball.vz) * MATCH.bounce;
    } else if (ball.z > bounds.maxZ - r) {
      ball.z = bounds.maxZ - r;
      ball.vz = -Math.abs(ball.vz) * MATCH.bounce;
    }
  }

  function scored(/** @type {number} */ team) {
    score[team]++;
    match.phase = "goal";
    match.phaseTime = 0;
    for (const k of kids)
      if (k.team === team && !k.keeper) {
        k.action = "cheer";
        k.actionTime = 0;
      }
    match.onGoal?.(team, match.lastTouch);
  }

  // --- The children ------------------------------------------------------

  /** Steers a child towards (x, z) at up to `pace`, slowing to arrive. */
  function steer(/** @type {Kid} */ k, /** @type {number} */ x, /** @type {number} */ z, /** @type {number} */ pace, /** @type {Walker | null} */ walker, /** @type {number} */ dt) {
    let dx = x - k.x,
      dz = z - k.z;
    const d = Math.hypot(dx, dz),
      want = d > 0.05 ? Math.min(pace, d * 2.2) : 0;
    let wx = d > 0.05 ? (dx / d) * want : 0,
      wz = d > 0.05 ? (dz / d) * want : 0;
    // Keep apart from each other and from the walker.
    for (const o of kids) {
      if (o === k) continue;
      const ox = k.x - o.x,
        oz = k.z - o.z,
        od = Math.hypot(ox, oz);
      if (od < MATCH.apart && od > 1e-4) {
        const push = ((MATCH.apart - od) / MATCH.apart) * 3;
        wx += (ox / od) * push;
        wz += (oz / od) * push;
      }
    }
    if (walker) {
      const ox = k.x - walker.x,
        oz = k.z - walker.z,
        od = Math.hypot(ox, oz);
      if (od < MATCH.walker && od > 1e-4) {
        const push = ((MATCH.walker - od) / MATCH.walker) * 4;
        wx += (ox / od) * push;
        wz += (oz / od) * push;
      }
    }
    for (const o of obstacles) {
      // Round a box or circle, by its nearest point.
      const nx = "r" in o ? o.x : clamp(k.x, o.minX, o.maxX),
        nz = "r" in o ? o.z : clamp(k.z, o.minZ, o.maxZ),
        ox = k.x - nx,
        oz = k.z - nz,
        od = Math.hypot(ox, oz) - ("r" in o ? o.r : 0);
      if (od < 0.4 && od > -1) {
        const len = Math.hypot(ox, oz) || 1;
        wx += (ox / len) * (0.4 - od) * 6;
        wz += (oz / len) * (0.4 - od) * 6;
      }
    }
    const ax = wx - k.vx,
      az = wz - k.vz,
      a = Math.hypot(ax, az),
      step = Math.min(1, (MATCH.accel * dt) / (a || 1));
    k.vx += ax * step;
    k.vz += az * step;
    k.x = clamp(k.x + k.vx * dt, bounds.minX + 0.25, bounds.maxX - 0.25);
    k.z = clamp(k.z + k.vz * dt, bounds.minZ + 0.25, bounds.maxZ - 0.25);
    k.speed = Math.hypot(k.vx, k.vz);
    // Face the way they run, or the ball when standing.
    const face =
      k.speed > 0.3 ? Math.atan2(k.vx, k.vz) : Math.atan2(ball.x - k.x, ball.z - k.z);
    let turn = face - k.heading;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    k.heading += turn * Math.min(1, dt * (k.speed > 0.3 ? 10 : 4));
  }

  /** The child plays the ball where it lies: a shot, a pass or a knock on. */
  function play(/** @type {Kid} */ k) {
    const dir = forward(k.team),
      goalX = goals[k.team === 0 ? 1 : 0],
      toGoal = Math.hypot(goalX - ball.x, centre.z - ball.z);
    k.action = "kick";
    k.actionTime = 0;
    k.cooldown = MATCH.cooldown;
    k.side = rand() < 0.7 ? 1 : -1;
    if (toGoal < MATCH.shooting) {
      const aim = centre.z + (rand() - 0.5) * goal.width * 1.5;
      strike(k, goalX + dir * 1, aim, 6.2 + rand() * 2.6, rand() < 0.35 ? 1.4 + rand() * 1.8 : 0);
      return;
    }
    const mates = kids.filter((o) => o.team === k.team && !o.keeper && o !== k);
    const ahead = mates.filter((o) => (o.x - k.x) * dir > 1.5);
    if (ahead.length && rand() < 0.4) {
      const mate = ahead[Math.floor(rand() * ahead.length)],
        d = Math.hypot(mate.x - ball.x, mate.z - ball.z),
        // Lead the pass a step ahead of them, weighted to stop there.
        tx = mate.x + dir * 0.8;
      strike(k, tx, mate.z, MATCH.roll * (d + 1.2) + 0.4);
      return;
    }
    // Knock it on towards goal, away from the nearest opponent.
    let nearest = null,
      best = Infinity;
    for (const o of kids)
      if (o.team !== k.team) {
        const d = Math.hypot(o.x - k.x, o.z - k.z);
        if (d < best) {
          best = d;
          nearest = o;
        }
      }
    const dodge = nearest && best < 2.5 ? Math.sign(k.z - nearest.z || rand() - 0.5) * 1.6 : 0,
      tz = clamp(ball.z + dodge + (centre.z - ball.z) * 0.25 + (rand() - 0.5) * 1.2, pitch.minZ + 0.6, pitch.maxZ - 0.6);
    strike(k, ball.x + dir * 3, tz, 2.4 + rand() * 1.2);
  }

  function keeperUpdate(/** @type {Kid} */ k, /** @type {Walker | null} */ walker, /** @type {number} */ dt) {
    const goalX = goals[k.team === 0 ? 0 : 1],
      dir = forward(k.team);
    if (ball.heldBy === k) {
      k.speed = 0;
      k.vx = k.vz = 0;
      k.action = "hold";
      if (k.actionTime > MATCH.hold && match.phase === "play") {
        // Throw it out to the runner with the most room.
        let best = null,
          room = -Infinity;
        for (const o of kids)
          if (o.team === k.team && !o.keeper) {
            let free = Infinity;
            for (const p of kids)
              if (p.team !== k.team) free = Math.min(free, Math.hypot(p.x - o.x, p.z - o.z));
            if (free > room) {
              room = free;
              best = o;
            }
          }
        if (best) {
          const d = Math.hypot(best.x - k.x, best.z - k.z);
          ball.x = k.x + dir * 0.4;
          strike(k, best.x, best.z, MATCH.roll * (d + 0.5) + 0.6, 1.6);
          k.action = "throw";
          k.actionTime = 0;
          k.cooldown = 0.5;
        }
      }
      return;
    }
    if (k.action === "throw" && k.actionTime < MATCH.throw) return steer(k, k.x, k.z, 0, walker, dt);
    if (k.action === "dive" && k.actionTime < MATCH.dive) {
      k.vx *= 0.9;
      k.vz *= 0.9;
      k.x += k.vx * dt;
      k.z += k.vz * dt;
      return;
    }
    k.action = "ready";
    // After a goal against them, they fetch the ball from the net.
    if (ball.inNet >= 0 && goals[ball.inNet] === goalX && match.phase === "play") {
      steer(k, ball.x - dir * 0.2, ball.z, 1.6, walker, dt);
      if (Math.hypot(ball.x - k.x, ball.z - k.z) < 0.5) take(k);
      return;
    }
    // Along the line, between the ball and the middle of the goal; out to
    // meet a ball loose near them.
    const near = Math.hypot(ball.x - goalX, ball.z - centre.z),
      out = clamp(0.45 + (near < 3.2 ? (3.2 - near) * 0.35 : 0), 0.45, 1.6);
    let tz = clamp(centre.z + (ball.z - centre.z) * 0.6, mouth.minZ + 0.35, mouth.maxZ - 0.35);
    const comingIn = (ball.vx * -dir > 1.2);
    if (comingIn && Math.abs(ball.vx) > 0.1) {
      // Where the ball will cross their line.
      const t = (goalX + dir * 0.5 - ball.x) / ball.vx;
      if (t > 0 && t < 2) tz = clamp(ball.z + ball.vz * t, mouth.minZ - 0.2, mouth.maxZ + 0.2);
    }
    steer(k, goalX + dir * out, tz, k.pace, walker, dt);
    k.cooldown -= dt;
    const d = Math.hypot(ball.x - k.x, ball.z - k.z);
    if (match.phase !== "play" || k.cooldown > 0 || ball.inNet >= 0 || ball.y > goal.height + 0.2) return;
    if (d < 0.75) {
      // A ball within arm's reach is caught, unless it is struck too hard,
      // which is decided once per ball.
      if (!k.saving) k.saving = rand() < (Math.hypot(ball.vx, ball.vz) > 6 ? 0.75 : 0.97) ? 1 : -1;
      if (k.saving > 0) take(k);
    } else if (d < 1.4 && comingIn && !k.saving) {
      // A slow ball they go and gather; a hard one they may not reach.
      k.saving = Math.hypot(ball.vx, ball.vz) < 4.5 || rand() < 0.6 ? 1 : -1;
      if (k.saving < 0) {
        // A dive at it that does not get there.
        k.action = "dive";
        k.actionTime = 0;
        k.side = Math.sign(ball.z - k.z) || 1;
        k.vz = k.side * 2.6;
        k.vx = 0;
      }
    } else if (d > 2) k.saving = 0;
  }

  /** The keeper gathers the ball into their arms. */
  function take(/** @type {Kid} */ k) {
    ball.heldBy = k;
    ball.inNet = -1;
    match.lastTouch = k;
    k.action = "hold";
    k.actionTime = 0;
    k.saving = 0;
  }

  function runnerUpdate(/** @type {Kid} */ k, /** @type {boolean} */ chasing, /** @type {Walker | null} */ walker, /** @type {number} */ dt) {
    k.cooldown -= dt;
    if (k.action === "cheer") {
      // A lap of joy, arms up, round where they scored.
      const t = k.actionTime + k.slot * 1.3,
        cx = centre.x + forward(k.team) * length * 0.25;
      steer(k, cx + Math.sin(t * 1.4) * 2.4, centre.z + Math.cos(t * 1.4) * 1.8, 2.4, walker, dt);
      if (k.actionTime > MATCH.cheer) k.action = "run";
      return;
    }
    if (k.action === "kick" && k.actionTime > MATCH.kick) k.action = "run";
    const dir = forward(k.team);
    if (chasing && !ball.heldBy && ball.inNet < 0 && match.phase === "play") {
      // Come at the ball from behind it, the goal beyond.
      const goalX = goals[k.team === 0 ? 1 : 0],
        gx = goalX - ball.x,
        gz = centre.z - ball.z,
        gd = Math.hypot(gx, gz) || 1,
        // Lead a rolling ball.
        lead = Math.min(0.6, Math.hypot(k.x - ball.x, k.z - ball.z) / k.pace),
        bx = ball.x + ball.vx * lead,
        bz = ball.z + ball.vz * lead,
        behind = Math.hypot(k.x - bx, k.z - bz) > 0.9 ? 0.32 : 0.12;
      steer(k, bx - (gx / gd) * behind, bz - (gz / gd) * behind, k.pace, walker, dt);
      if (k.cooldown <= 0 && ball.y < 0.45 && Math.hypot(ball.x - k.x, ball.z - k.z) < MATCH.reach) play(k);
      return;
    }
    // Drift with play, never quite still.
    const home = homeOf(k.team, k.slot, ball.x),
      wobble = Math.sin(match.phaseTime * 0.4 + k.slot * 2.1 + k.team * 1.7) * 0.9;
    steer(k, home.x + dir * wobble * 0.5, home.z + wobble, k.pace * 0.6, walker, dt);
  }

  /** The walker puts a foot to the ball when they walk into it. */
  function walkerTouch(/** @type {Walker} */ w) {
    if (ball.heldBy || ball.inNet >= 0 || ball.y > 0.5) return;
    const dx = ball.x - w.x,
      dz = ball.z - w.z,
      d = Math.hypot(dx, dz);
    if (d > 0.5 || d < 1e-4) return;
    const speed = Math.hypot(w.vx, w.vz),
      towards = (w.vx * dx + w.vz * dz) / d;
    if (speed > 0.4 && towards > 0.2) {
      // Along the way they walk, harder the faster they go.
      const kick = speed * 1.7 + 1.6;
      ball.vx = (w.vx / speed) * kick;
      ball.vz = (w.vz / speed) * kick;
      ball.vy = speed > 4 ? 1.2 : 0;
      match.lastTouch = "walker";
    } else {
      // Stood in its way, it stops against their feet.
      const along = ball.vx * (dx / d) + ball.vz * (dz / d);
      if (along < 0) {
        ball.vx -= 1.4 * along * (dx / d);
        ball.vz -= 1.4 * along * (dz / d);
      }
    }
    ball.x = w.x + (dx / d) * 0.5;
    ball.z = w.z + (dz / d) * 0.5;
  }

  /**
   * Advances the match by `dt` seconds. `walker` is the visitor's position
   * and velocity, or null when they are elsewhere.
   * @param {number} dt
   * @param {Walker | null} [walker]
   */
  function update(dt, walker = null) {
    dt = Math.min(dt, 0.1);
    const steps = Math.ceil(dt / (1 / 30));
    for (let s = 0; s < steps; s++) tick(dt / steps, walker);
  }

  let flip = false;
  function tick(/** @type {number} */ dt, /** @type {Walker | null} */ walker) {
    match.phaseTime += dt;
    if (match.phase === "goal" && match.phaseTime > MATCH.cheer) {
      match.phase = "play";
      match.phaseTime = 0;
    }
    // Each side's nearest runner goes for the ball.
    const chasers = [0, 1].map((team) => {
      let pick = null,
        best = Infinity;
      for (const k of kids)
        if (k.team === team && !k.keeper && k.action !== "cheer") {
          const d = Math.hypot(k.x - ball.x, k.z - ball.z);
          if (d < best) {
            best = d;
            pick = k;
          }
        }
      return pick;
    });
    // Every other tick the blues move first, so neither side always gets
    // to a loose ball a tick sooner.
    flip = !flip;
    for (let i = 0; i < kids.length; i++) {
      const k = kids[flip ? kids.length - 1 - i : i];
      k.actionTime += dt;
      if (k.keeper) keeperUpdate(k, walker, dt);
      else runnerUpdate(k, chasers[k.team] === k, walker, dt);
    }
    if (walker) walkerTouch(walker);
    moveBall(dt);
  }

  return match;
}
