import * as T from "three";
import { FLOORS, HURST, SCALE, TOWER, polar, wallRadius } from "./layout.js";
import { createBatch } from "./parts.js";

// The mill's moving parts, geared as a real tower mill is: the sails and brake
// wheel on the windshaft, the brake wheel turning the wallower at the top of the
// long upright shaft, which carries the crown wheel and the spur wheel, which
// turns the two stone nuts and their runner stones. Each rigid train is one mesh
// (and none casts into the cached shadow map), so turning the mill is setting a
// handful of angles. A wheel's speed follows from its radius and its neighbour's.

const TAU = Math.PI * 2;

const WOOD = "#8c6d4c",
  DARK = "#5a4532",
  COG = "#c0a176",
  STOCK = "#6b5644",
  LATH = "#7b6450",
  CLOTH = "#ece3cc",
  IRON = "#3f3c37";

const BRAKE = { r: 1.25, offset: 0.7 }, // On the windshaft, this far along from the tower's axis.
  WALLOWER = { r: 0.7, y: TOWER.shaftY - BRAKE.r - 0.18 },
  CROWN = { r: 1.2, y: FLOORS[2].y + 1.3 },
  SPUR = { r: 0.75, y: 2.28 },
  NUT = { r: 0.25 };

/** A timber wheel about its own y axis, at height y. */
function wheel(b, { y = 0, r, width = 0.16, rim = 0.11, arms = 2, cogs, cogLength = 0.07, cogWay = "out", hub = 0.2 }) {
  const segments = Math.max(14, Math.round(r * 15)),
    step = TAU / segments;
  for (let i = 0; i < segments; i++) {
    const a = i * step,
      p = polar(r, a + step / 2);
    b.box(WOOD, p.x, y, p.z, 2 * r * Math.sin(step / 2) + 0.012, width, rim, { ry: a + step / 2, r: 0.01 });
  }
  // Clasp arms, in crossing pairs around the shaft: the old way, with no mortice
  // to weaken the axle.
  for (let n = 0; n < arms; n++) {
    const a = (n / arms) * Math.PI;
    for (const s of [-1, 1]) {
      const off = s * hub * 0.9,
        ox = Math.cos(a) * off,
        oz = -Math.sin(a) * off,
        reach = Math.sqrt(Math.max(0.01, r * r - off * off)) - rim * 0.3,
        ax = Math.sin(a) * reach,
        az = Math.cos(a) * reach;
      b.beam(DARK, [ox - ax, y, oz - az], [ox + ax, y, oz + az], 0.09, 0.09, { roll: -a });
    }
  }
  if (cogs) {
    const cogStep = TAU / cogs;
    for (let i = 0; i < cogs; i++) {
      const a = i * cogStep;
      if (cogWay === "out") {
        const p = polar(r + rim / 2 + cogLength / 2, a);
        b.box(COG, p.x, y, p.z, 0.06, width * 0.85, cogLength, { ry: a, r: 0.012, vary: 0.05 });
      } else {
        const dir = cogWay === "up" ? 1 : -1,
          p = polar(r, a);
        b.box(COG, p.x, y + dir * (width / 2 + cogLength / 2), p.z, 0.06, cogLength, rim * 0.85, { ry: a, r: 0.012, vary: 0.05 });
      }
    }
  }
}

/** A pair of discs and staves: a stone nut, with its teeth as round pins. */
function lanternPinion(b, y, r) {
  b.drum(DARK, 0, y + 0.1, 0, r, 0.035, { segments: 16 });
  b.drum(DARK, 0, y - 0.1, 0, r, 0.035, { segments: 16 });
  const pins = 10;
  for (let i = 0; i < pins; i++) {
    const p = polar(r - 0.012, (i / pins) * TAU);
    b.drum(COG, p.x, y, p.z, 0.02, 0.2, { segments: 6, vary: 0.04 });
  }
}

/** A mesh that turns about `axis` through `origin`. */
function turning(batch, name, material, origin, axis) {
  const mesh = batch.mesh(name, material, { cast: false, receive: true, moving: true }),
    rest = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), axis),
    spin = new T.Quaternion(),
    up = new T.Vector3(0, 1, 0);
  mesh.position.copy(origin);
  mesh.quaternion.copy(rest);
  return {
    mesh,
    set(angle) {
      mesh.quaternion.copy(rest).multiply(spin.setFromAxisAngle(up, angle));
    },
  };
}

export function buildMachinery(materials) {
  const group = new T.Group(),
    { timber } = materials,
    shaftAway = polar(1, TOWER.shaftTheta),
    shaftAxis = new T.Vector3(shaftAway.x, 0, shaftAway.z);

  // The upright shaft: an eight-sided oak post from the flags to the cap, banded
  // with iron, with the three wheels it carries.
  const up = createBatch(7001);
  const top = TOWER.curb + 0.42;
  up.drum(WOOD, 0, top / 2, 0, 0.14, top, { segments: 8 });
  for (let y = 1.2; y < top; y += 2.05) up.drum(IRON, 0, y, 0, 0.152, 0.05, { segments: 8, vary: 0.02 });
  wheel(up, { y: SPUR.y, r: SPUR.r, width: 0.17, cogs: 30, cogLength: NUT.r * 0.32, hub: 0.17 });
  wheel(up, { y: CROWN.y, r: CROWN.r, width: 0.16, rim: 0.11, cogs: 52, cogWay: "up", cogLength: 0.08, hub: 0.17 });
  wheel(up, { y: WALLOWER.y, r: WALLOWER.r - 0.05, width: 0.2, rim: 0.1, cogs: 26, cogLength: 0.06, cogWay: "up", hub: 0.17 });
  up.drum(DARK, 0, WALLOWER.y, 0, 0.2, 0.3, { segments: 8 });
  const upright = turning(up, "Windmill upright shaft and wheels", timber, new T.Vector3(), new T.Vector3(0, 1, 0));
  group.add(upright.mesh);

  // The windshaft and brake wheel, built along local y from the tower's axis.
  const wind = createBatch(7103);
  const outside = wallRadius(TOWER.curb) + 1.0;
  wind.drum(DARK, 0, (outside - 1.5) / 2, 0, 0.16, outside + 1.5, { segments: 8 });
  wheel(wind, { y: BRAKE.offset, r: BRAKE.r, width: 0.2, rim: 0.14, cogs: 48, cogWay: "down", cogLength: 0.09, hub: 0.2, arms: 2 });
  wind.drum(IRON, 0, BRAKE.offset, 0, 0.22, 0.34, { segments: 8, vary: 0.02 });
  const windshaft = turning(wind, "Windmill brake wheel", timber, new T.Vector3(0, TOWER.shaftY, 0), shaftAxis);
  group.add(windshaft.mesh);

  // The stone nuts, spindles and, on the open pair, the runner stone on top.
  const deck = FLOORS[1].y,
    nuts = HURST.stones.map(({ r, theta }, n) => {
      const b = createBatch(7207 + n),
        origin = polar(r, theta);
      lanternPinion(b, SPUR.y, NUT.r);
      b.drum(IRON, 0, (SPUR.y + deck + 0.34) / 2, 0, 0.04, deck + 0.34 - SPUR.y, { segments: 8, vary: 0.02 });
      if (n === 1) b.drum("#a29c8e", 0, deck + 0.3, 0, HURST.tun - 0.04, 0.16, { segments: 26 });
      else {
        // The damsel: a square iron rod that knocks the shoe as it turns.
        b.box(IRON, 0, deck + 0.82, 0, 0.05, 0.86, 0.05, { r: 0.008, vary: 0.02 });
      }
      const nut = turning(b, `Windmill stone nut ${n + 1}`, timber, new T.Vector3(origin.x, 0, origin.z), new T.Vector3(0, 1, 0));
      group.add(nut.mesh);
      return nut;
    });

  // The furrowed face of the runner you can see, turning with it.
  const face = new T.Mesh(new T.CircleGeometry(HURST.tun - 0.05, 30), materials.face);
  face.rotation.x = -Math.PI / 2;
  face.position.y = deck + 0.385;
  face.receiveShadow = true;
  nuts[1].mesh.add(face);

  // The sails, turning on the windshaft outside the cap: the outside's sails at
  // this scale, so one sweeps past the top window every five seconds.
  const s = createBatch(7307),
    length = 3.7 * SCALE,
    width = 0.86 * SCALE,
    hubAt = wallRadius(TOWER.curb) + TOWER.wall + 0.55 * SCALE,
    arm = 0.2 * SCALE;
  for (let n = 0; n < 4; n++) {
    const a = (n * Math.PI) / 2,
      m = new T.Matrix4().makeRotationY(a);
    s.framed(m, () => {
      // In the frame of the turning: y along the shaft, each sail along local z.
      s.box(STOCK, 0, arm, length / 2, 0.22, 0.22, length + 0.4, { r: 0.02 });
      for (const x of [0.28, width])
        s.box(LATH, x, arm, length / 2 + 1.3, 0.1, 0.1, length - 2.1, { r: 0.015 });
      for (let i = 0; i < 9; i++) {
        const z = 2.1 + (i / 8) * (length - 2.45);
        s.box(LATH, width / 2 + 0.14, arm, z, width - 0.08, 0.08, 0.08, { r: 0.012 });
      }
      s.box(CLOTH, width / 2 + 0.15, arm + 0.07, length / 2 + 1.3, width - 0.22, 0.03, length - 2.35, { r: 0, vary: 0.03 });
    });
  }
  s.drum("#4e3f33", 0, arm * 0.6, 0, 0.5, 0.7, { segments: 12 });
  const sails = turning(
    s,
    "Windmill sails",
    timber,
    new T.Vector3(shaftAxis.x * hubAt, TOWER.shaftY, shaftAxis.z * hubAt),
    shaftAxis,
  );
  group.add(sails.mesh);

  // Teeth that meet turn so their rims keep pace: the wallower with the brake
  // wheel it meets on the wheel's underside, the nuts against the spur wheel.
  const wallowerRate = BRAKE.r / WALLOWER.r,
    nutRate = -SPUR.r / NUT.r;
  return {
    group,
    /** Poses every train for the sails' turn of `angle` radians. */
    update(angle) {
      windshaft.set(angle);
      sails.set(angle);
      const uprightAngle = angle * wallowerRate;
      upright.set(uprightAngle);
      const nutAngle = uprightAngle * nutRate;
      nuts[0].set(nutAngle);
      nuts[1].set(nutAngle + 0.4);
    },
  };
}
