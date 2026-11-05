import * as T from "three";
import { LADDER_NOTE, WINDMILL_NOTES, WINDMILL_POINTS, WINDMILL_ROOM } from "../content/windmill.js";
import {
  FLOORS,
  SPAWN,
  TOWER,
  WALK_BOUNDS,
  collidersFor,
  floorHeight,
  levelAt,
  onLadder,
  polar,
  railAt,
  rungLurch,
} from "./layout.js";
import { buildMachinery } from "./machinery.js";
import { createBatch, createWindmillMaterials } from "./parts.js";
import { createWindmillSetting } from "./setting.js";
import { buildTower } from "./tower.js";

// The old windmill as a walkable room (src/interior.js): an open tower with the
// mill's machinery standing in its well, and platforms winding up the wall from
// the flags to the cap, joined by ladders. The walker's colliders change with its
// level as they do on the inn's stair, and on a ladder it keeps to the ladder's
// line. Nothing that moves casts a shadow, so the sun's map renders once.

// How fast the sails turn outside (src/regions/orchard.js).
const SAIL_RATE = 0.32;

const FLOOR_Y = Object.fromEntries(FLOORS.map((f) => [f.id, f.y]));

export function createWindmillRoom() {
  const scene = new T.Scene();
  scene.background = new T.Color("#e4e0cc");
  scene.fog = new T.Fog("#d9cfba", 10, 70);
  const materials = createWindmillMaterials(),
    tower = buildTower(materials),
    machinery = buildMachinery(materials),
    setting = createWindmillSetting(scene, materials);
  scene.add(tower.group, machinery.group);

  // The owl turns its head to watch you, as far as an owl's head goes.
  const owlHead = (() => {
    const b = createBatch(8101);
    b.ball("#a98c66", 0, 0, 0, 0.115, 0.095, 0.1, { vary: 0 });
    b.ball("#eadfc8", 0, -0.005, 0.066, 0.09, 0.075, 0.042, { vary: 0 });
    for (const s of [-1, 1]) {
      b.ball("#17120d", s * 0.038, 0.012, 0.102, 0.02, 0.02, 0.02, { detail: 8, vary: 0 });
      b.ball("#ffffff", s * 0.04, 0.018, 0.118, 0.005, 0.005, 0.005, { detail: 6, vary: 0 });
    }
    b.ball("#c9a65c", 0, -0.018, 0.105, 0.012, 0.018, 0.012, { detail: 6, vary: 0 });
    const head = b.mesh("Windmill owl's head", new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), {
      cast: false,
      moving: true,
    });
    head.position.set(tower.owlHead.x, tower.owlHead.y, tower.owlHead.z);
    scene.add(head);
    return head;
  })();
  // At rest it looks out over the well.
  const owlRest = 2.2 + Math.PI;
  owlHead.rotation.y = owlRest;

  const state = {
    level: "meal",
    dusk: 0,
    target: 0,
    turn: 0,
    drive: 1,
    braked: false,
    climbed: false,
    owl: owlRest,
  };
  const colliders = [...collidersFor(state.level)];
  const use = (level) => {
    state.level = level;
    colliders.length = 0;
    colliders.push(...collidersFor(level));
  };

  const eye = new T.Vector3(0, TOWER.eye, SPAWN.z);
  let note = null;

  const points = WINDMILL_POINTS.map((point) => ({
    ...point,
    ...polar(point.r, point.theta),
    y: FLOOR_Y[point.level] + point.y,
    available: () => state.level === point.level,
  }));

  const room = {
    ...WINDMILL_ROOM,
    scene,
    sun: setting.sun,
    shadowLights: [setting.sun],
    staticShadows: true,
    exposure: 1.02,
    environmentIntensity: 0.26,
    night: false,
    points,
    layout: {
      bounds: WALK_BOUNDS,
      spawn: SPAWN,
      colliders,
      rail: (x, z) => railAt(state.level, x, z),
    },
    setNight(value) {
      state.target = value ? 1 : 0;
    },
    interact(point) {
      if (point.id === "brake") {
        state.braked = !state.braked;
        return { ...(state.braked ? WINDMILL_NOTES.brakeOn : WINDMILL_NOTES.brakeOff), sound: "creak" };
      }
      const said = WINDMILL_NOTES[point.id];
      if (!said) return null;
      // Sitting in the window lets the light move on, or brings it back.
      return point.rest ? { ...said, night: !room.night } : said;
    },
    enter() {
      use("meal");
      state.dusk = state.target;
      state.drive = state.braked ? 0 : 1;
    },
    /** Stands the walker on a level as well as a spot (benchmarks and tests). */
    place({ level }) {
      if (level && level !== state.level) use(level);
    },
    /** How high the eye stands, on any floor or part way up a ladder. */
    eyeAt(walker) {
      const { x, z } = walker.position;
      return floorHeight(state.level, x, z) + TOWER.eye + rungLurch(state.level, x, z);
    },
    /** Says once how ladders go, the first time you set foot on one. */
    takeNote() {
      const said = note;
      note = null;
      return said;
    },
    update(time, motion = true, { dt = 0, walker } = {}) {
      const t = motion ? time : 0;
      if (walker) {
        const { x, z } = walker.position,
          next = levelAt(state.level, x, z);
        if (next !== state.level) {
          use(next);
          if (onLadder(next) && !state.climbed) {
            state.climbed = true;
            note = LADDER_NOTE;
          }
        }
        eye.set(x, room.eyeAt(walker), z);
      }
      state.dusk += (state.target - state.dusk) * (1 - Math.exp(-dt * 2.4));
      // The brake takes the sails down over a few seconds; the wind picks them up.
      state.drive += ((state.braked ? 0 : 1) - state.drive) * (1 - Math.exp(-dt * (state.braked ? 2.2 : 0.9)));
      if (motion) state.turn += dt * state.drive * SAIL_RATE;
      machinery.update(-state.turn);
      setting.apply(state.dusk, t, eye, innerHeight);
      // Within sight the owl follows you, by the shortest way round.
      if (motion) {
        const dx = eye.x - owlHead.position.x,
          dy = eye.y - owlHead.position.y,
          dz = eye.z - owlHead.position.z,
          near = Math.hypot(dx, dy, dz) < 5.2;
        let want = owlRest;
        if (near) {
          let off = Math.atan2(dx, dz) - owlRest;
          off = Math.atan2(Math.sin(off), Math.cos(off));
          want = owlRest + Math.max(-2.2, Math.min(2.2, off));
        }
        state.owl += (want - state.owl) * (1 - Math.exp(-dt * 2.6));
        owlHead.rotation.y = state.owl;
      }
    },
    diagnostics: () => ({
      level: state.level,
      floor: eye.y - TOWER.eye,
      turning: state.drive > 0.02,
      braked: state.braked,
    }),
  };
  return room;
}
