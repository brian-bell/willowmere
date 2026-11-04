import * as T from "three";
import { PUB_NOTES, PUB_POINTS, PUB_ROOM } from "../content/pub.js";
import { createPub } from "./index.js";
import { PUB, floorHeight, groundColliders, insideTheHouse, levelAt, loftColliders } from "./layout.js";
import { createPubSetting } from "./setting.js";

// The Drowsy Heron as a walkable room (src/interior.js): the whole building
// from the study, two storeys and a balcony. Its stair is the only way between
// them; the walker's colliders are swapped for the storey's as it climbs, and
// the eye follows the floor. Nothing that moves casts a shadow.

const { kitchen, gallery, eye: EYE_HEIGHT, halfD, wall } = PUB;

export function createHeronRoom() {
  const scene = new T.Scene();
  scene.background = new T.Color("#dcdcc4");
  const pub = createPub();
  scene.add(pub.group);
  const setting = createPubSetting(scene, pub.materials.glass, {
    reach: 60,
    shadowSize: 2048,
    shadowReach: 13,
  });
  // The storeys' colliders, with the front door shut behind you: leaving is E.
  const storeys = {
    ground: [...groundColliders(), { x: 0, z: halfD - wall / 2, w: 1.4, d: wall }],
    loft: loftColliders(),
  };
  const colliders = [...storeys.ground];
  const state = { level: "ground", dusk: 0, indoors: 1, target: 0 };
  const use = (level) => {
    state.level = level;
    colliders.length = 0;
    colliders.push(...storeys[level]);
  };
  const eye = new T.Vector3();
  const points = PUB_POINTS.map((point) => ({
    ...point,
    y: (point.level === "loft" ? PUB.loft : 0) + (point.y ?? 1),
    available: () => state.level === point.level,
  }));
  const room = {
    ...PUB_ROOM,
    scene,
    sun: setting.sun,
    shadowLights: [setting.sun, setting.fire],
    staticShadows: true,
    exposure: 1.02,
    environmentIntensity: 0.3,
    night: false,
    points,
    layout: {
      bounds: { minX: -PUB.halfW, maxX: PUB.halfW, minZ: kitchen.minZ, maxZ: gallery.front },
      spawn: { x: 0, z: halfD - wall - 0.65, yaw: 0 },
      colliders,
    },
    setNight(value) {
      state.target = value ? 1 : 0;
    },
    interact(point) {
      const note = PUB_NOTES[point.id];
      if (!note) return null;
      // Lying down lets the day go by, or brings it back.
      return point.rest ? { ...note, night: !room.night } : note;
    },
    enter() {
      use("ground");
      state.dusk = state.target;
      state.indoors = 1;
    },
    /** The eye's height over the floor under it, on either storey or the stair. */
    eyeAt(walker) {
      return floorHeight(state.level, walker.position.x, walker.position.z) + EYE_HEIGHT;
    },
    update(time, motion = true, { dt = 0, walker } = {}) {
      const t = motion ? time : 0;
      if (walker) {
        const next = levelAt(state.level, walker.position.x, walker.position.z);
        if (next !== state.level) use(next);
        eye.set(walker.position.x, room.eyeAt(walker), walker.position.z);
      }
      state.dusk += (state.target - state.dusk) * (1 - Math.exp(-dt * 3.5));
      const under = insideTheHouse(eye.x, eye.y, eye.z) ? 1 : 0;
      state.indoors += (under - state.indoors) * (1 - Math.exp(-dt * 6));
      setting.apply(state.dusk, state.indoors, t, eye);
      pub.update(t);
    },
    diagnostics: () => ({ level: state.level, floor: eye.y - EYE_HEIGHT }),
  };
  return room;
}
