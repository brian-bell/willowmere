import { test, expect } from "@playwright/test";
import { createInteriorWalker } from "../src/interior-movement.js";
import { WINDMILL_POINTS } from "../src/content/windmill.js";
import { ORCHARD } from "../src/regions/orchard-layout.js";
import {
  FLOORS,
  FURNITURE,
  HURST,
  LADDERS,
  LADDER_HALF_WIDTH,
  SPAWN,
  TOWER,
  WALK_BOUNDS,
  WINDOWS,
  collidersFor,
  floorHeight,
  levelAt,
  onFloor,
  outsideWindows,
  polar,
  railAt,
  wallRadius,
} from "../src/windmill/layout.js";

// A visitor with the room's own walker, whose colliders and ladder follow its
// level exactly as src/windmill/room.js swaps them.
function visitor(start = "meal", spawn = SPAWN) {
  let level = start;
  const colliders = [...collidersFor(level)],
    walker = createInteriorWalker({
      bounds: WALK_BOUNDS,
      colliders,
      spawn,
      rail: (x, z) => railAt(level, x, z),
    });
  return {
    walker,
    get level() {
      return level;
    },
    get y() {
      return floorHeight(level, walker.position.x, walker.position.z);
    },
    tick(forward, strafe = 0, dt = 1 / 60) {
      walker.update(dt, forward, strafe);
      const next = levelAt(level, walker.position.x, walker.position.z);
      if (next !== level) {
        level = next;
        colliders.length = 0;
        colliders.push(...collidersFor(level));
      }
    },
    /** Turns to face (x, z) and walks a frame toward it. */
    toward(x, z) {
      const { position } = walker;
      walker.place({ yaw: Math.atan2(position.x - x, position.z - z) });
      this.tick(1);
    },
  };
}

const closeTo = (v, x, z, within) => Math.hypot(v.walker.position.x - x, v.walker.position.z - z) < within;

// The clear way along a floor: beside the rail, inside anything stood at the wall.
const lane = (f) => (f.inner ? f.inner + 0.38 : wallRadius(f.y) - 1.4);

const follow = (v, target) => {
  for (let n = 0; n < 600 && !closeTo(v, target.x, target.z, 0.16); n++) v.toward(target.x, target.z);
  expect(closeTo(v, target.x, target.z, 0.16), `reached ${target.x.toFixed(2)}, ${target.z.toFixed(2)} on ${v.level}`).toBe(true);
};

// Walks round floor `floor` by way of its lane, from bearing `from` to `to`.
function walkRound(v, floor, from, to) {
  const f = FLOORS[floor],
    steps = Math.ceil(Math.abs(to - from) / 0.25);
  for (let i = 1; i <= steps; i++) follow(v, polar(lane(f), from + ((to - from) * i) / steps));
}

test("holding the key climbs a ladder rung by rung, and the floor never jumps", { tag: "@logic" }, () => {
  for (const ladder of LADDERS) {
    const standing = {
      x: ladder.foot.x - ladder.axis.x * 0.4,
      z: ladder.foot.z - ladder.axis.z * 0.4,
      yaw: Math.atan2(-ladder.axis.x, -ladder.axis.z),
    };
    const v = visitor(FLOORS[ladder.from].id, standing);
    let previous = v.y,
      frames = 0,
      seen = false;
    const start = v.walker.distance;
    while (v.level !== FLOORS[ladder.to].id && frames++ < 1200) {
      v.tick(1);
      expect(v.y - previous, ladder.id).toBeLessThan(0.08);
      expect(v.y, ladder.id).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = v.y;
      seen ||= v.level === ladder.id;
    }
    expect(seen, `${ladder.id} is climbed, not skipped`).toBe(true);
    expect(v.level).toBe(FLOORS[ladder.to].id);
    // A climb takes a few unhurried seconds at the walking pace.
    expect(frames / 60).toBeGreaterThan(1.5);
    expect(frames / 60).toBeLessThan(6);
    // And one footstep's worth of walking is about one rung.
    const steps = (v.walker.distance - start) / 0.75;
    expect(Math.abs(steps - ladder.rungs)).toBeLessThan(2);

    // Turning to face down the ladder, the same key brings you down again.
    v.walker.place({ yaw: Math.atan2(ladder.axis.x, ladder.axis.z) });
    frames = 0;
    while (v.level !== FLOORS[ladder.from].id && frames++ < 1200) {
      v.tick(1);
      expect(previous - v.y, ladder.id).toBeLessThan(0.08);
      previous = v.y;
    }
    expect(v.level, `down ${ladder.id}`).toBe(FLOORS[ladder.from].id);
    expect(v.y).toBe(FLOORS[ladder.from].y);
  }
});

test("on a ladder you can look around, stop, back down, and never step off the side", { tag: "@logic" }, () => {
  const ladder = LADDERS[1],
    v = visitor(FLOORS[1].id, {
      x: ladder.foot.x,
      z: ladder.foot.z,
      yaw: Math.atan2(-ladder.axis.x, -ladder.axis.z),
    });
  for (let n = 0; n < 60; n++) v.tick(1);
  expect(v.level).toBe(ladder.id);
  const halfway = v.y;
  expect(halfway).toBeGreaterThan(FLOORS[1].y);
  // Letting go stays put.
  for (let n = 0; n < 40; n++) v.tick(0);
  expect(v.y).toBeCloseTo(halfway, 1);
  // Looking out over the well, the keys still go up the ladder.
  v.walker.place({ yaw: Math.atan2(-ladder.side.x, -ladder.side.z) });
  for (let n = 0; n < 20; n++) v.tick(1);
  expect(v.y).toBeGreaterThan(halfway);
  // Strafing does nothing but look around.
  const { x, z } = v.walker.position;
  for (let n = 0; n < 60; n++) v.tick(0, 1);
  expect(Math.hypot(v.walker.position.x - x, v.walker.position.z - z)).toBeLessThan(0.05);
  // Backing all the way down leaves you on the floor you started from.
  v.walker.place({ yaw: Math.atan2(-ladder.axis.x, -ladder.axis.z) });
  for (let n = 0; n < 1200 && v.level === ladder.id; n++) v.tick(-1);
  expect(v.level).toBe(FLOORS[1].id);
});

test("walking past a ladder's foot does not pick you up", { tag: "@logic" }, () => {
  const ladder = LADDERS[0],
    beside = {
      x: ladder.foot.x - ladder.axis.x * 0.45 + ladder.side.x * 1.2,
      z: ladder.foot.z - ladder.axis.z * 0.45 + ladder.side.z * 1.2,
    },
    v = visitor("meal", { ...beside, yaw: Math.atan2(ladder.side.x, ladder.side.z) });
  for (let n = 0; n < 90; n++) v.tick(1);
  expect(v.level).toBe("meal");
  expect(v.y).toBe(0);
});

test("a visitor can walk from the door to the very top and back", { tag: "@logic" }, () => {
  const v = visitor();
  for (let i = 0; i < LADDERS.length; i++) {
    const ladder = LADDERS[i],
      f = FLOORS[i],
      from = i ? f.start + 0.3 : 0.2;
    expect(v.level).toBe(f.id);
    walkRound(v, i, from, ladder.footTheta - 0.3);
    follow(v, { x: ladder.foot.x - ladder.axis.x * 0.5, z: ladder.foot.z - ladder.axis.z * 0.5 });
    v.walker.place({ yaw: Math.atan2(-ladder.axis.x, -ladder.axis.z) });
    for (let n = 0; n < 1200 && v.level !== FLOORS[i + 1].id; n++) v.tick(1);
    expect(v.level, `up ${ladder.id}`).toBe(FLOORS[i + 1].id);
  }
  expect(v.y).toBe(FLOORS.at(-1).y);
  // And down again, the way you'd come, walking face first.
  for (let i = LADDERS.length - 1; i >= 0; i--) {
    const ladder = LADDERS[i],
      f = FLOORS[i + 1],
      over = { x: ladder.head.x + ladder.axis.x * 0.35, z: ladder.head.z + ladder.axis.z * 0.35 };
    if (i < LADDERS.length - 1) {
      walkRound(v, i + 1, LADDERS[i + 1].footTheta - 0.3, f.start + 0.3);
    } else follow(v, polar(lane(f), f.start + 0.3));
    follow(v, over);
    v.walker.place({ yaw: Math.atan2(ladder.axis.x, ladder.axis.z) });
    for (let n = 0; n < 1200 && v.level !== FLOORS[i].id; n++) v.tick(1);
    expect(v.level, `down ${ladder.id}`).toBe(FLOORS[i].id);
    // Back round to the floor's clear lane.
    follow(v, polar(lane(FLOORS[i]), ladder.footTheta - 0.3));
  }
  expect(v.level).toBe("meal");
  expect(v.y).toBe(0);
});

// Flood-fills what can be walked to from the door, level by level, with the
// room's own colliders, crossing only where levelAt lets a walker.
function walkableFromTheDoor() {
  const step = 0.08,
    blockers = {},
    blocker = (level) =>
      (blockers[level] ??= createInteriorWalker({
        bounds: WALK_BOUNDS,
        colliders: collidersFor(level),
        spawn: SPAWN,
      })),
    key = (level, i, j) => `${level}/${i}/${j}`,
    start = ["meal", Math.round(SPAWN.x / step), Math.round(SPAWN.z / step)],
    seen = new Set([key(...start)]),
    queue = [start];
  while (queue.length) {
    const [level, i, j] = queue.pop();
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = (i + di) * step,
        z = (j + dj) * step;
      if (blocker(level).blocked(x, z)) continue;
      const next = levelAt(level, x, z),
        k = key(next, i + di, j + dj);
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push([next, i + di, j + dj]);
    }
  }
  return {
    step,
    seen,
    reached: (level, x, z, reach = 0.16) => {
      const r = Math.round(reach / step);
      for (let a = -r; a <= r; a++)
        for (let b = -r; b <= r; b++)
          if (seen.has(key(level, Math.round(x / step) + a, Math.round(z / step) + b))) return true;
      return false;
    },
  };
}

test("every floor can be reached, and nobody can fall down the well", { tag: "@logic" }, () => {
  const { reached, seen } = walkableFromTheDoor();
  const levels = new Set([...seen].map((k) => k.split("/")[0]));
  for (const f of FLOORS) expect(levels, f.id).toContain(f.id);
  for (const l of LADDERS) expect(levels, l.id).toContain(l.id);

  for (const f of FLOORS.slice(1)) {
    // Both ends of the crescent, and its middle.
    for (const t of [0.15, 0.5, 0.82]) {
      const p = polar(lane(f), f.start + (f.end - f.start) * t);
      expect(reached(f.id, p.x, p.z), `${f.id} at ${t}`).toBe(true);
    }
    // Over the rail into the open well, and through the wall.
    const well = polar(f.inner - 0.3, (f.start + f.end) / 2 + Math.PI / 2);
    expect(reached(f.id, well.x, well.z, 0), `${f.id}'s well`).toBe(false);
    const out = polar(wallRadius(f.y) + 0.1, (f.start + f.end) / 2);
    expect(reached(f.id, out.x, out.z, 0), `${f.id}'s wall`).toBe(false);
  }
  // Through the gangway to the stones' deck, on the shaft's near side.
  const stone = FLOORS[1],
    near = polar(0.7, stone.gangway.theta);
  expect(reached("stone", near.x, near.z), "the stones' deck").toBe(true);
  expect(reached("stone", 0, 0, 0), "standing in the shaft").toBe(false);
  // Round the gangway is a drop.
  const off = polar(1.9, stone.gangway.theta + 0.6);
  expect(onFloor(1, off.x, off.z)).toBe(false);
  expect(reached("stone", off.x, off.z, 0)).toBe(false);
  // You can walk all the way round the top.
  const dust = FLOORS.at(-1);
  for (let t = 0.05; t < 0.97; t += 0.1) {
    const p = polar(lane(dust), dust.start + (dust.end - dust.start) * t);
    expect(reached("dust", p.x, p.z), `the top at ${t.toFixed(2)}`).toBe(true);
  }
});

test("everything E answers to can be stood beside on its own floor", { tag: "@logic" }, () => {
  const { reached } = walkableFromTheDoor();
  for (const point of WINDMILL_POINTS) {
    const { x, z } = polar(point.r, point.theta);
    let near = false;
    for (let d = 0; d <= point.range - 0.1 && !near; d += 0.1)
      for (let a = 0; a < Math.PI * 2 && !near; a += Math.PI / 8)
        near = reached(point.level, x + Math.sin(a) * d, z + Math.cos(a) * d, 0);
    expect(near, point.id).toBe(true);
  }
});

test("climbing, the head passes through open air and never a deck", { tag: "@logic" }, () => {
  for (const l of LADDERS)
    for (let t = 0; t <= 1; t += 0.02) {
      const x = l.foot.x + (l.head.x - l.foot.x) * t,
        z = l.foot.z + (l.head.z - l.foot.z) * t,
        feet = FLOORS[l.from].y + l.rise * t,
        eye = feet + TOWER.eye + 0.15;
      for (let i = 0; i < FLOORS.length; i++) {
        const f = FLOORS[i];
        if (f.y > feet + 0.05 && f.y < eye)
          expect(onFloor(i, x, z), `${l.id} at ${t.toFixed(2)} goes through ${f.id}`).toBe(false);
      }
    }
});

test("a floor has headroom, and a platform's ladder lands on its boards", { tag: "@logic" }, () => {
  for (let i = 0; i < FLOORS.length - 1; i++)
    expect(FLOORS[i + 1].y - FLOORS[i].y).toBeGreaterThan(TOWER.eye + 0.8);
  for (const l of LADDERS) {
    // Each foot stands on the floor it leaves, with the rails clear of its edge.
    for (const s of [-LADDER_HALF_WIDTH, LADDER_HALF_WIDTH]) {
      const x = l.foot.x + l.side.x * s,
        z = l.foot.z + l.side.z * s;
      expect(onFloor(l.from, x, z), `${l.id}'s foot`).toBe(true);
    }
    // A ladder is steep, about seventy degrees.
    const pitch = Math.atan2(l.rise, l.run);
    expect(pitch).toBeGreaterThan(1.1);
    expect(pitch).toBeLessThan(1.35);
    // And inside the wall, top and bottom.
    expect(Math.hypot(l.foot.x, l.foot.z) + LADDER_HALF_WIDTH).toBeLessThan(wallRadius(FLOORS[l.from].y));
    expect(Math.hypot(l.head.x, l.head.z) + LADDER_HALF_WIDTH).toBeLessThan(wallRadius(FLOORS[l.to].y));
  }
  // The stones stand on their deck, round the shaft.
  for (const s of HURST.stones) expect(s.r + HURST.tun).toBeLessThan(FLOORS[1].deck.r);
});

test("the windows inside are the windows outside, each with a floor to look from", { tag: "@logic" }, () => {
  const { windmill: w } = ORCHARD,
    outside = outsideWindows();
  expect(outside).toHaveLength(WINDOWS.length);
  for (const [i, [angle, y]] of outside.entries()) {
    expect(angle).toBe(WINDOWS[i].theta);
    // On the tower's wall, under its cap.
    expect(y).toBeGreaterThan(0.3);
    expect(y).toBeLessThan(w.height);
  }
  for (const win of WINDOWS) {
    const i = FLOORS.findIndex((f) => f.id === win.floor),
      f = FLOORS[i],
      // Standing a pace in from the sill.
      p = polar(wallRadius(win.y) - 0.5, win.theta);
    expect(win.y - win.h / 2, `${win.id}'s sill clears its floor`).toBeGreaterThan(f.y + 0.25);
    expect(win.y + win.h / 2, `${win.id} is under the curb`).toBeLessThan(TOWER.curb);
    expect(onFloor(i, p.x, p.z), `${win.id} has boards before it`).toBe(true);
  }
});

// Stands at the windmill's door in the game, with every region streamed in.
async function atTheDoor(page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "willowmere.save.v1",
      JSON.stringify({ started: true, quests: { mabel: false, flower: false, plant: false }, plants: [] }),
    );
  });
  await page.goto("/?resolution=fixed");
  await page.waitForFunction(() => window.__willowmere?.getWater().frame > 2);
  await page.waitForFunction(() => !window.__willowmere.getStreaming().pending, null, {
    timeout: 600000,
    polling: 1000,
  });
}

test("the door opens the tower, and the ladders climb it with the keys", async ({ page }) => {
  test.setTimeout(900000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await atTheDoor(page);
  const { windmill: w } = ORCHARD,
    door = { x: w.x + 1.6, z: w.z + 1.6 };
  await page.evaluate(({ x, z }) => window.__willowmere.moveTo(x, z, 0.8), door);
  await expect(page.locator("#interaction")).toContainText("Step inside the old windmill");
  const outside = await page.evaluate(() => window.__willowmere.getPlayer());
  await page.keyboard.press("e");
  await page.waitForFunction(() => window.__willowmere.getInterior().active, null, { timeout: 120000 });
  await expect(page).toHaveURL(/interior=windmill/);

  const inside = () => page.evaluate(() => window.__willowmere.getInterior());
  const place = (pose) => page.evaluate((p) => window.__willowmere.placeInterior(p), pose);
  expect((await inside()).level).toBe("meal");

  // A point upstairs says nothing to someone beneath it.
  const under = polar(2.2, 4.65);
  await place({ ...under, yaw: Math.PI / 2, pitch: 0 });
  await page.evaluate(() => new Promise(requestAnimationFrame));
  expect((await inside()).nearest).not.toBe("brake");

  // Up every ladder with the key held, the eye rising with the feet.
  for (const ladder of LADDERS) {
    await place({
      x: ladder.foot.x - ladder.axis.x * 0.45,
      z: ladder.foot.z - ladder.axis.z * 0.45,
      yaw: Math.atan2(-ladder.axis.x, -ladder.axis.z),
      pitch: 0,
      level: FLOORS[ladder.from].id,
    });
    await page.keyboard.down("w");
    await page.waitForFunction((id) => window.__willowmere.getInterior().level === id, ladder.id, { timeout: 60000 });
    await page.waitForFunction((id) => window.__willowmere.getInterior().level === id, FLOORS[ladder.to].id, {
      timeout: 60000,
    });
    await page.keyboard.up("w");
    const eye = await inside();
    expect(eye.floor).toBeCloseTo(FLOORS[ladder.to].y, 1);
  }
  // The first ladder says how ladders go.
  await expect(page.locator("#bakery-note")).toContainText("UP THE LADDERS");

  // Up here the brake answers, and stops the mill until it is let go.
  const lever = polar(2.05, 4.3),
    target = polar(2.5, 4.65);
  await place({ ...lever, yaw: Math.atan2(lever.x - target.x, lever.z - target.z), pitch: -0.2 });
  await expect.poll(async () => (await inside()).nearest).toBe("brake");
  await page.keyboard.press("e");
  await expect(page.locator("#bakery-note")).toContainText("THE BRAKE");
  await expect.poll(async () => (await inside()).turning, { timeout: 30000 }).toBe(false);
  await page.keyboard.press("e");
  await expect.poll(async () => (await inside()).turning, { timeout: 30000 }).toBe(true);

  // The window seat lets the light move on.
  const seat = polar(2.3, FURNITURE.seat.theta),
    sill = polar(3, FURNITURE.seat.theta);
  await place({ ...seat, yaw: Math.atan2(seat.x - sill.x, seat.z - sill.z), pitch: -0.1, level: "seat" });
  await expect.poll(async () => (await inside()).nearest).toBe("seat");
  await page.keyboard.press("e");
  await expect.poll(async () => (await inside()).night).toBe(true);

  // Back down by the last ladder, face first, and out where you came in.
  const down = LADDERS[0];
  await place({
    x: down.head.x + down.axis.x * 0.3,
    z: down.head.z + down.axis.z * 0.3,
    yaw: Math.atan2(down.axis.x, down.axis.z),
    pitch: 0,
    level: "stone",
  });
  await page.keyboard.down("w");
  await page.waitForFunction(() => window.__willowmere.getInterior().level === "meal", null, { timeout: 60000 });
  await page.keyboard.up("w");
  expect((await inside()).floor).toBe(0);
  await place({ x: 0, z: 3, yaw: Math.PI, pitch: 0 });
  await expect.poll(async () => (await inside()).nearest).toBe("door");
  await page.keyboard.press("e");
  await page.waitForFunction(() => !window.__willowmere.getInterior().active);
  const back = await page.evaluate(() => window.__willowmere.getPlayer());
  expect(Math.hypot(back.x - outside.x, back.z - outside.z)).toBeLessThan(0.1);
  expect(errors).toEqual([]);
});

test("the tower keeps the rooms' budget, and evening compiles nothing new", async ({ page }) => {
  test.setTimeout(300000);
  await page.goto("/?interior=windmill&resolution=fixed");
  await page.waitForFunction(() => window.__willowmere?.getInterior().active, null, { timeout: 120000 });
  const sample = () =>
    page.evaluate(async () => {
      const values = [];
      for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame);
      for (let i = 0; i < 6; i++) {
        await new Promise(requestAnimationFrame);
        values.push(window.__willowmere.getInterior());
      }
      return values;
    });
  const place = (pose) => page.evaluate((p) => window.__willowmere.placeInterior(p), pose);
  // From the flags looking up the well, where the most of the tower is in view.
  await place({ x: -1.9, z: 1.4, yaw: -0.85, pitch: 0.95 });
  let samples = await sample();
  const median = (list) => list.map((s) => s.drawCalls).sort((a, b) => a - b)[Math.floor(list.length / 2)];
  expect(median(samples)).toBeLessThan(120);
  expect(Math.max(...samples.map((s) => s.triangles))).toBeLessThan(0.6e6);
  // Nothing that moves casts into the sun's map, so it stays cached.
  expect(samples.at(-1).render.shadowAutoUpdate).toBe(false);
  // Out of the top window, through the sails.
  const eye = polar(2.3, TOWER.shaftTheta),
    out = polar(4, TOWER.shaftTheta);
  await place({ ...eye, yaw: Math.atan2(eye.x - out.x, eye.z - out.z), pitch: -0.12, level: "dust" });
  samples = await sample();
  expect(median(samples)).toBeLessThan(120);
  // Evening changes the lights' strength and the sky, and compiles nothing.
  const programs = samples.at(-1).programs;
  expect(programs).toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await page.click("#bakery-light");
  await page.click("#bakery-resume");
  await expect.poll(async () => (await sample()).at(-1).night).toBe(true);
  expect((await sample()).at(-1).programs).toBe(programs);
});
