// The village's people. A look (see the residents in src/life.js and
// src/content/) says what someone wears and carries; this puts them together.
// They keep the same chunky wooden-doll proportions throughout: about three and a
// half heads tall, the figure facing +z with the ground at y 0.
//
// Joints cost draws, so a figure only keeps the joints it uses. Someone who walks
// (`walks`) has hips, knees and elbows. Someone who stands has their legs and
// bent arms folded into the parts that do move, and the arm still breathes.
import { boot, dressTorso } from "./clothes.js";
import { buildHead } from "./heads.js";
import { createKit, shade } from "./kit.js";
import { carry, FOREARM, keys, rucksack, satchel, SHOULDER_Y, spyglass, UPPER_ARM } from "./props.js";

const HEAD_SCALE = 1.17,
  HIPS = 0.58,
  // How far a leg swings when walking, and how far its toes reach past the ankle.
  SWING = 0.5,
  TOES = 0.177,
  KNEE = 1.15;
const LOOK = {
  skin: 0xe9b38e,
  hair: 0x5b3930,
  garment: "coat",
  hat: false,
  shirt: 0xe9d9b7,
  trousers: 0x5a6461,
  boots: 0x634836,
  soles: 0x2f2822,
  buttons: 0xddbf80,
};

function legs(kit, body, look, walks) {
  const hips = kit.group(body, 0, HIPS, 0),
    legGroups = [],
    knees = [],
    hidden = look.garment === "dress" && !look.short,
    color = look.trousers;
  for (const side of [-1, 1]) {
    const leg = kit.group(hips, side * 0.115, 0, 0);
    if (!hidden) kit.part(leg, "limb", color, 0, 0, 0, 0.088, 0.3, 0.092);
    const knee = kit.group(leg, 0, -0.29, 0);
    if (!hidden) {
      kit.part(knee, "limb", color, 0, 0.012, 0, 0.076, 0.2, 0.08);
      if (look.patches) {
        kit.part(knee, "soft", look.patches, 0, 0.012, 0.066, 0.052, 0.056, 0.018);
        kit.part(knee, "soft", shade(look.patches, 0.8), 0, 0.012, 0.062, 0.057, 0.061, 0.016);
      }
      if (look.stripe) {
        kit.part(leg, "slab", look.stripe, side * 0.087, -0.14, 0, 0.006, 0.26, 0.02);
        kit.part(knee, "slab", look.stripe, side * 0.073, -0.06, 0, 0.006, 0.17, 0.018);
      }
    }
    boot(kit, knee, look, -0.29);
    legGroups.push(leg);
    knees.push(knee);
  }
  if (walks) return { legs: legGroups, knees };
  for (const [i, knee] of knees.entries()) {
    kit.flatten(knee);
    kit.flatten(legGroups[i]);
  }
  kit.flatten(hips);
  return { legs: null, knees: null };
}

function arm(kit, body, look, side, [shoulder, bend]) {
  const color = look.sleeve ?? look.coat,
    rolled = look.rolled,
    puffed = look.puffed;
  const group = kit.group(body, side * 0.228, SHOULDER_Y, 0, shoulder, 0, side * (look.armOut ?? 0.06));
  kit.part(group, "shoulder", color);
  if (puffed) {
    kit.part(group, "ball", color, side * 0.004, -0.018, 0, 0.102, 0.082, 0.102);
    kit.part(group, "tube", shade(color, 0.82), 0, -0.096, 0, 0.082, 0.014, 0.084);
  }
  const elbow = kit.group(group, 0, -UPPER_ARM, 0, bend);
  kit.part(elbow, "limb", rolled ? look.skin : color, 0, 0.012, 0, 0.066, 0.128, 0.066);
  if (rolled) {
    kit.part(elbow, "tube", shade(color, 0.92), 0, 0.012, 0, 0.076, 0.04, 0.078);
    kit.part(elbow, "tube", shade(color, 1.1), 0, 0.03, 0, 0.074, 0.012, 0.076);
  } else {
    kit.part(elbow, "tube", look.cuff ?? look.shirt, 0, -0.1, 0, 0.061, 0.034, 0.063);
    kit.part(elbow, "tube", look.cuffBand ?? shade(color, 0.8), 0, -0.078, 0, 0.066, 0.018, 0.068);
  }
  const hand = kit.group(elbow, 0, -FOREARM, 0.006);
  const skin = look.skin;
  // A mitten of a hand, with its fingers only drawn in.
  kit.part(hand, "soft", skin, 0, -0.042, 0, 0.05, 0.054, 0.039);
  kit.part(hand, "soft", skin, 0, -0.078, 0.006, 0.046, 0.04, 0.032);
  kit.part(hand, "bead", skin, -side * 0.044, -0.04, 0.014, 0.017, 0.032, 0.018, 0, 0, side * 0.5);
  for (const x of [-0.015, 0.015])
    kit.part(hand, "bead", shade(skin, 0.76), x, -0.086, 0.036, 0.0028, 0.024, 0.004);
  return { arm: group, elbow, hand };
}

export function createPeople(THREE, material, contactShadow) {
  const kit = createKit(THREE, material);
  return function person(def) {
    const look = { ...LOOK, trim: shade(def.coat, 0.8), ...def },
      walks = !!look.walks;
    look.armPose = look.armPose ?? [
      [0, -0.12],
      [0, -0.12],
    ];
    const root = new THREE.Group(),
      body = new THREE.Group();
    root.add(body);
    root.scale.setScalar(look.size ?? 1);
    if (look.stout) body.scale.x = look.stout;
    contactShadow(root, 0.4, 0.25);

    const { legs: legGroups, knees } = legs(kit, body, look, walks);
    const scarf = dressTorso(kit, body, look);
    if (look.pack) rucksack(kit, body);
    if (look.satchel) satchel(kit, body, look);
    if (look.spyglass) spyglass(kit, body);
    if (look.keys) keys(kit, body);

    const limbs = [-1, 1].map((side, i) => arm(kit, body, look, side, look.armPose[i]));
    const hands = limbs.map((limb) => limb.hand);
    const figure = {
      root,
      body,
      legs: legGroups,
      knees,
      arms: limbs.map((limb) => limb.arm),
      elbows: walks ? limbs.map((limb) => limb.elbow) : null,
      hands,
      scarf,
      walks,
      armPose: look.armPose.map(([shoulder]) => shoulder),
      elbowPose: look.armPose.map(([, bend]) => bend),
      headPose: look.headPose ?? [0, 0, 0],
      seed: Math.random() * 6.28,
      // How far the head has turned to someone nearby.
      lookY: 0,
    };
    carry(kit, figure, look);
    if (!walks)
      for (const limb of limbs) {
        kit.flatten(limb.hand);
        kit.flatten(limb.elbow);
      }

    const head = kit.group(body, 0, 1.3, 0);
    head.scale.setScalar(HEAD_SCALE);
    figure.head = head;
    Object.assign(figure, buildHead(kit, head, look));
    return figure;
  };
}

/**
 * One frame of a person's life: walking by `blend` at `phase`, otherwise
 * breathing, glancing about and blinking. Allocates nothing.
 */
export function animatePerson(figure, phase, blend, time) {
  const { seed, body, arms, head, eyes } = figure,
    stride = Math.sin(phase),
    step = Math.cos(phase);
  // The hips ride on the back foot's toes: a leg swung back reaches a little
  // less far down, but its toes reach further, so the sole stays on the ground.
  const swing = SWING * stride * blend;
  body.position.y =
    Math.sin(time * 1.6 + seed) * 0.008 +
    HIPS * (Math.cos(swing) - 1) +
    TOES * Math.abs(Math.sin(swing));
  arms[0].rotation.x =
    figure.armPose[0] - stride * 0.32 * blend + Math.sin(time * 1.4 + seed) * 0.025;
  arms[1].rotation.x = figure.armPose[1] + stride * 0.32 * blend;
  head.rotation.x =
    figure.headPose[0] + Math.sin(time * 0.53 + seed) * 0.018 + 0.012 * blend;
  head.rotation.y =
    figure.headPose[1] +
    figure.lookY +
    Math.sin(time * 0.31 + seed) * 0.1 * (1 - blend) -
    stride * 0.04 * blend;
  head.rotation.z = figure.headPose[2];
  eyes.scale.y = Math.sin(time * 0.91 + seed * 2) > 0.997 ? 0.13 : 1;
  if (!figure.walks) return;
  body.rotation.x = 0.035 * blend;
  body.rotation.y = stride * 0.045 * blend;
  body.rotation.z = stride * 0.022 * blend;
  figure.legs[0].rotation.x = stride * SWING * blend;
  figure.legs[1].rotation.x = -stride * SWING * blend;
  // A knee bends as its leg swings through, far enough that a foot with no
  // ankle of its own lifts its toes clear; it is straight under the weight.
  figure.knees[0].rotation.x = Math.max(0, -step) * KNEE * blend;
  figure.knees[1].rotation.x = Math.max(0, step) * KNEE * blend;
  figure.elbows[0].rotation.x = figure.elbowPose[0] - (0.18 + 0.22 * Math.max(0, -stride)) * blend;
  figure.elbows[1].rotation.x = figure.elbowPose[1] - (0.18 + 0.22 * Math.max(0, stride)) * blend;
  if (figure.scarf)
    figure.scarf.rotation.x = Math.sin(phase + 0.4) * 0.11 * blend;
}

/**
 * A part's shape cut with fewer segments for a figure's far copy, where it
 * is a few pixels tall: round parts keep at most 8 segments, small ones (under
 * `size` 0.12) fewer. Other shapes are copied as they are.
 */
export function coarseShape(THREE, geometry, size) {
  const p = geometry.parameters,
    small = size < 0.12;
  if (geometry.type === "LatheGeometry") {
    const rows = p.points.length,
      points = p.points.filter(
        (_, i) => rows < 6 || i % 2 === 0 || i === rows - 1,
      );
    return new THREE.LatheGeometry(
      points,
      Math.min(p.segments, 8),
      p.phiStart,
      p.phiLength,
    );
  }
  if (geometry.type === "SphereGeometry")
    return new THREE.SphereGeometry(
      p.radius,
      Math.min(p.widthSegments, small ? 6 : 8),
      Math.min(p.heightSegments, small ? 4 : 5),
      p.phiStart,
      p.phiLength,
      p.thetaStart,
      p.thetaLength,
    );
  if (geometry.type === "CylinderGeometry")
    return new THREE.CylinderGeometry(
      p.radiusTop,
      p.radiusBottom,
      p.height,
      Math.min(p.radialSegments, small ? 6 : 8),
      1,
      p.openEnded,
      p.thetaStart,
      p.thetaLength,
    );
  return new THREE.BufferGeometry().copy(geometry);
}
