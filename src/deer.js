import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createHerd } from "./game/deer.js";

// The doe and her fawn: their bodies, and how they move. Where they go and
// what they do is src/game/deer.js; this builds each as one skinned mesh, so
// an animal of some forty parts and fourteen joints is one draw (and one in
// the sun's shadow), and poses its bones from that state every frame.
//
// A deer faces +z. Its parts are painted spheres and tapered rods, built in
// metres around a rest pose standing square, then bound rigidly to the bone
// they move with.

const DOE = {
  coat: 0x9a6a44,
  back: 0x86593a,
  belly: 0xe6d7bd,
  white: 0xf1ebdf,
  muzzle: 0x4b3a2d,
  dark: 0x1d1713,
  ear: 0xcba78b,
  hoof: 0x2c241d,
};
const FAWN = {
  ...DOE,
  coat: 0xad6c3c,
  back: 0x9a5d35,
  belly: 0xeedfc4,
  spot: 0xead6b4,
};

// Strides in the rest pose's metres, per gait, and the speeds (in those
// metres a second) where one gait gives way to the next.
const STRIDE = { walk: 0.95, trot: 1.55, bound: 2.7 };
const GAIT = { trot: [1.05, 1.6], bound: [2.3, 3.1] };
// Where each foot falls in a cycle, for the front left, front right, hind
// left and hind right: a walk's four beats, a trot's diagonal pairs and a
// bound's hind pair then fore pair.
const BEATS = {
  walk: [0.25, 0.75, 0, 0.5],
  trot: [0, 0.5, 0.5, 0],
  bound: [0.45, 0.55, 0, 0.08],
};

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const ease = (value, target, rate, dt) => value + (target - value) * (1 - Math.exp(-rate * dt));

/**
 * Builds one deer. `look` sets its colours and proportions: `legs`, `head`
 * and `ears` lengthen those parts (a fawn is mostly legs and ears), `body`
 * its length, and `spots` dapples its back.
 */
function buildDeer(T, material, look) {
  const { colors, legs: L = 1, head: H = 1, ears: E = 1, body: B = 1, spots = false } = look;
  const bones = [],
    parts = [];
  const bone = (parent, name, x, y, z) => {
    const b = new T.Bone();
    b.name = name;
    b.position.set(x, y, z);
    parent?.add(b);
    bones.push(b);
    return b;
  };
  const sphere = new T.SphereGeometry(1, 12, 9),
    bead = new T.SphereGeometry(1, 7, 5);
  const euler = new T.Euler(),
    quaternion = new T.Quaternion();
  const part = (b, geometry, color, x, y, z, sx, sy, sz = sx, rx = 0, rz = 0) => {
    const matrix = new T.Matrix4().compose(
      new T.Vector3(x, y, z),
      quaternion.setFromEuler(euler.set(rx, 0, rz)),
      new T.Vector3(sx, sy, sz),
    );
    parts.push({ bone: b, geometry, color, matrix });
  };
  const ball = (b, color, x, y, z, sx, sy, sz, rx, rz) => part(b, sphere, color, x, y, z, sx, sy, sz, rx, rz);
  const dot = (b, color, x, y, z, sx, sy, sz, rx, rz) => part(b, bead, color, x, y, z, sx, sy, sz, rx, rz);
  // A rod from y = 0 down to y = -length, tapering.
  const rod = (b, color, top, bottom, length, y = 0, z = 0) =>
    part(b, new T.CylinderGeometry(top, bottom, length, 7), color, 0, y - length / 2, z, 1, 1, 1);

  // Legs: the front stands on a forearm and cannon, the hind on a haunch and
  // a longer cannon below the hock. Both reach the ground from the body.
  const frontUpper = 0.33 * L,
    frontLower = 0.45 * L,
    hindUpper = 0.36 * L + 0.02,
    hindLower = 0.42 * L + 0.02,
    height = frontUpper + frontLower + 0.04;
  const root = bone(null, "Root", 0, 0, 0),
    body = bone(root, "Body", 0, height, 0);
  const c = colors;
  // The barrel, chest and rump, a darker saddle, the pale belly and the
  // white patch under the tail.
  ball(body, c.coat, 0, 0, -0.02 * B, 0.2, 0.22, 0.46 * B);
  ball(body, c.coat, 0, -0.01, 0.28 * B, 0.19, 0.23, 0.22 * B);
  ball(body, c.coat, 0, 0.03, -0.33 * B, 0.2, 0.22, 0.22 * B);
  ball(body, c.back, 0, 0.085, -0.04 * B, 0.13, 0.15, 0.44 * B);
  ball(body, c.belly, 0, -0.1, 0.02 * B, 0.155, 0.13, 0.38 * B);
  ball(body, c.white, 0, -0.04, -0.5 * B, 0.07, 0.1, 0.05);
  ball(body, c.belly, 0, -0.06, 0.4 * B, 0.12, 0.14, 0.08);
  if (spots) {
    // Two rows each side of the spine, and a scatter lower on the flanks,
    // laid on the barrel's surface so each just shows.
    const rows = [
      [0.42, 9],
      [0.8, 8],
      [1.15, 5],
    ];
    for (const side of [-1, 1])
      for (const [angle, count] of rows)
        for (let i = 0; i < count; i++) {
          const t = -0.72 + (1.44 * (i + (angle > 1 ? 0.5 : 0))) / count,
            ring = Math.sqrt(1 - t * t),
            x = side * 0.197 * Math.sin(angle) * ring,
            y = 0.217 * Math.cos(angle) * ring,
            z = -0.02 * B + 0.455 * B * t;
          dot(body, c.spot, x, y, z, 0.014, 0.014, 0.017);
        }
  }

  // The neck rises from inside the chest and leans forward; the head sits
  // on its tip. Turning the neck about the body's vertical (YXZ) lets her
  // look round without twisting it.
  const neck = bone(body, "Neck", 0, 0.03, 0.31 * B);
  neck.rotation.order = "YXZ";
  const neckLength = 0.52 * H;
  ball(neck, c.coat, 0, neckLength * 0.5, 0, 0.085, neckLength * 0.56, 0.1);
  ball(neck, c.belly, 0, neckLength * 0.42, 0.05, 0.06, neckLength * 0.42, 0.065);
  const head = bone(neck, "Head", 0, neckLength, 0.01);
  const h = 0.98 * H;
  ball(head, c.coat, 0, 0, 0, 0.095 * h, 0.095 * h, 0.12 * h);
  ball(head, c.coat, 0, -0.035 * h, 0.14 * h, 0.06 * h, 0.058 * h, 0.11 * h, -0.12);
  ball(head, c.belly, 0, -0.075 * h, 0.1 * h, 0.05 * h, 0.03 * h, 0.08 * h);
  ball(head, c.muzzle, 0, -0.03 * h, 0.235 * h, 0.042 * h, 0.04 * h, 0.035 * h);
  dot(head, c.dark, 0, -0.018 * h, 0.262 * h, 0.03 * h, 0.022 * h, 0.016 * h);
  ball(head, c.white, 0, -0.065 * h, 0.2 * h, 0.04 * h, 0.022 * h, 0.04 * h);
  for (const side of [-1, 1]) {
    // Eyes set wide, each in a pale ring.
    dot(head, c.white, side * 0.073 * h, 0.022 * h, 0.06 * h, 0.012 * h, 0.03 * h, 0.03 * h);
    dot(head, c.dark, side * 0.079 * h, 0.022 * h, 0.065 * h, 0.012 * h, 0.022 * h, 0.024 * h);
  }
  const ears = [-1, 1].map((side) => {
    const ear = bone(head, side < 0 ? "Left ear" : "Right ear", side * 0.06 * h, 0.075 * h, -0.045 * h);
    const e = E * h;
    ball(ear, c.coat, 0, 0.095 * e, 0, 0.046 * e, 0.1 * e, 0.03 * e);
    ball(ear, c.ear, 0, 0.1 * e, 0.016 * e, 0.032 * e, 0.078 * e, 0.016 * e);
    return { ear, side };
  });

  // The tail hangs from the rump, brown above and white beneath, so raised
  // it shows the white flag.
  const tail = bone(body, "Tail", 0, 0.1, -0.5 * B);
  ball(tail, c.coat, 0, -0.07, -0.012, 0.045, 0.085, 0.03);
  ball(tail, c.white, 0, -0.075, 0.008, 0.042, 0.08, 0.03);

  const legBones = [];
  for (const hind of [false, true])
    for (const side of [-1, 1]) {
      const name = `${hind ? "Hind" : "Front"} ${side < 0 ? "left" : "right"} leg`,
        upper = bone(body, name, side * (hind ? 0.12 : 0.115), hind ? 0 : -0.04, (hind ? -0.36 : 0.3) * B),
        upperLength = hind ? hindUpper : frontUpper,
        lowerLength = hind ? hindLower : frontLower;
      if (hind) {
        // The haunch and the gaskin below it.
        ball(upper, c.coat, 0, -0.06, 0.03, 0.08, 0.19, 0.14);
        ball(upper, c.coat, 0, -upperLength * 0.75, -0.03, 0.045, upperLength * 0.3, 0.06);
      } else {
        ball(upper, c.coat, 0, -0.03, 0, 0.058, 0.13, 0.075);
        ball(upper, c.coat, 0, -upperLength * 0.62, 0.005, 0.04, upperLength * 0.42, 0.05);
      }
      const lower = bone(upper, `${name} below the ${hind ? "hock" : "knee"}`, 0, -upperLength, hind ? -0.03 : 0);
      dot(lower, c.coat, 0, 0, hind ? -0.012 : 0.004, 0.034, 0.04, 0.038);
      rod(lower, c.coat, 0.026, 0.019, lowerLength - 0.05);
      // Dew-claws' dark fetlock, and the cloven hoof.
      dot(lower, c.back, 0, -lowerLength + 0.075, -0.01, 0.024, 0.03, 0.026);
      rod(lower, c.hoof, 0.019, 0.025, 0.05, -lowerLength + 0.05, 0.008);
      legBones.push({ upper, lower, hind, side });
    }

  // Bind every part rigidly to its bone, in the rest pose.
  root.updateMatrixWorld(true);
  const index = new Map(bones.map((b, i) => [b, i])),
    color = new T.Color(),
    matrix = new T.Matrix4();
  const pieces = parts.map(({ bone: b, geometry, color: hex, matrix: local }) => {
    const piece = geometry.clone().applyMatrix4(matrix.multiplyMatrices(b.matrixWorld, local));
    piece.deleteAttribute("uv");
    const count = piece.attributes.position.count,
      colors = new Float32Array(count * 3),
      skinIndex = new Uint16Array(count * 4),
      skinWeight = new Float32Array(count * 4);
    color.set(hex);
    for (let i = 0; i < count; i++) {
      colors.set([color.r, color.g, color.b], i * 3);
      skinIndex[i * 4] = index.get(b);
      skinWeight[i * 4] = 1;
    }
    piece.setAttribute("color", new T.BufferAttribute(colors, 3));
    piece.setAttribute("skinIndex", new T.Uint16BufferAttribute(skinIndex, 4));
    piece.setAttribute("skinWeight", new T.BufferAttribute(skinWeight, 4));
    return piece;
  });
  const geometry = mergeGeometries(pieces);
  pieces.forEach((piece) => piece.dispose());
  for (const g of new Set(parts.map((p) => p.geometry))) g.dispose();
  const mesh = new T.SkinnedMesh(geometry, material);
  mesh.add(root);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.updateMatrixWorld(true);
  mesh.bind(new T.Skeleton(bones));
  // Culling reads this sphere, computed once in the rest pose and grown to
  // hold a lowered head or a bound's stretch.
  mesh.computeBoundingSphere();
  mesh.boundingSphere.radius *= 1.35;
  return {
    mesh,
    body,
    neck,
    head,
    ears,
    tail,
    legs: legBones,
    height,
    rest: {
      body: height,
      // Hocks set a little back and the cannons a little forward, at rest.
      legs: legBones.map(({ hind }) => (hind ? [0.1, -0.12] : [0, 0])),
    },
  };
}

/**
 * The doe and the fawn, in the scene once streamed in (`job`), roaming
 * by src/game/deer.js. `groundHeight(x, z)` seats them; `colliders` and
 * `avoid()` (people's positions, read live) are what they keep clear of.
 */
export function createDeer(T, { groundHeight, colliders, avoid, water, seed }) {
  const herd = createHerd({ colliders, avoid, seed });
  const material = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
  material.name = "Deer";
  const shadowMaterial = new T.MeshBasicMaterial({
    color: 0x324030,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
  });
  const shadowGeometry = new T.CircleGeometry(1, 20);
  const animals = [
    { name: "The doe", state: herd.doe, look: { colors: DOE }, scale: 1, shadow: [0.3, 0.62] },
    {
      name: "The fawn",
      state: herd.fawn,
      look: { colors: FAWN, legs: 1.2, head: 1.22, ears: 1.25, body: 0.86, spots: true },
      scale: 0.6,
      shadow: [0.3, 0.55],
    },
  ].map(({ name, state, look, scale, shadow }, i) => {
    const rig = buildDeer(T, material, look);
    rig.mesh.name = name;
    rig.mesh.scale.setScalar(scale);
    const contact = new T.Mesh(shadowGeometry, shadowMaterial);
    contact.name = `${name}: contact shadow`;
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = 0.03;
    contact.scale.set(shadow[0], shadow[1], 1);
    rig.mesh.add(contact);
    return {
      ...rig,
      state,
      scale,
      contact,
      seed: i * 2.7 + 0.4,
      phase: 0,
      gait: 0,
      speed: 0,
      headDown: state.headDown,
      alert: 0,
      tailUp: 0,
      look: 0,
      pitch: 0,
      hop: 0,
      lastX: state.x,
      lastZ: state.z,
    };
  });
  const meshes = animals.map((a) => a.mesh);
  water?.excludeFromCaptures(...meshes);
  let castsShadows = true;

  function pose(a, dt, time) {
    const { state: s, mesh, body, neck, head, ears, tail, legs, rest, scale } = a;
    // Position, heading and the slope under the feet.
    const ground = groundHeight(s.x, s.z),
      sin = Math.sin(s.heading),
      cos = Math.cos(s.heading),
      reach = 0.45 * scale,
      rise =
        groundHeight(s.x + sin * reach, s.z + cos * reach) -
        groundHeight(s.x - sin * reach, s.z - cos * reach),
      slope = Math.max(-0.5, Math.min(0.5, Math.atan2(rise, 2 * reach)));
    mesh.position.set(s.x, ground, s.z);
    mesh.rotation.y = s.heading;
    a.pitch = ease(a.pitch, slope, 8, dt);

    // The gait follows the ground actually covered, in the rest pose's
    // metres, so the hooves do not slide.
    const moved = Math.hypot(s.x - a.lastX, s.z - a.lastZ) / scale;
    a.lastX = s.x;
    a.lastZ = s.z;
    const speed = dt > 0 ? moved / dt : 0;
    a.speed = ease(a.speed, Math.min(speed, 8), 10, dt);
    a.hop = ease(a.hop, s.bounce ? 1 : 0, 6, dt);
    const v = a.speed,
      trot = smoothstep(...GAIT.trot, v),
      bound = Math.max(smoothstep(...GAIT.bound, v), a.hop),
      stride = STRIDE.walk + (STRIDE.trot - STRIDE.walk) * trot + (STRIDE.bound - STRIDE.trot) * bound;
    a.gait = ease(a.gait, v > 0.05 ? 1 : 0, 8, dt);
    a.phase = (a.phase + moved / stride) % 1;
    const TAU = Math.PI * 2,
      g = a.gait;

    // Body: a walk's sway, a trot's bob, a bound's rock and lift.
    const cycle = a.phase * TAU,
      lift =
        Math.abs(Math.sin(cycle)) * 0.012 * (1 - trot) * g +
        Math.abs(Math.sin(cycle * 2)) * 0.025 * trot * (1 - bound) * g +
        Math.max(0, Math.sin(cycle + 0.6)) * (0.07 + 0.08 * a.hop) * bound * g;
    a.headDown = ease(a.headDown, s.headDown, 2.6, dt);
    a.alert = ease(a.alert, s.alert ? 1 : 0, 5, dt);
    a.tailUp = ease(a.tailUp, s.tailUp ? 1 : 0, 6, dt);
    a.look = ease(a.look, s.lookYaw, 3, dt);
    const graze = a.headDown,
      breathe = Math.sin(time * 1.9 + a.seed) * 0.004;
    body.position.y = rest.body + lift + breathe;
    body.rotation.x = -a.pitch + Math.sin(cycle) * 0.1 * bound * g;
    body.rotation.z = Math.sin(cycle) * 0.02 * (1 - trot) * g;

    // Legs: each swings from the shoulder or hip and folds below as it
    // lifts, upright whatever the slope.
    for (let i = 0; i < 4; i++) {
      const { upper, lower, hind } = legs[i],
        beat =
          BEATS.walk[i] + (BEATS.trot[i] - BEATS.walk[i]) * trot + (BEATS.bound[i] - BEATS.trot[i]) * bound,
        phi = (a.phase + beat) * TAU,
        swing = (0.3 + 0.12 * trot + 0.35 * bound) * g,
        fold = (hind ? 0.55 : 0.85) * (0.55 + 0.35 * trot + 0.3 * bound) * g,
        // Springing fawns land stiff-legged.
        stiff = 1 - 0.7 * a.hop,
        [restUpper, restLower] = rest.legs[i];
      upper.rotation.x = restUpper * (1 - bound) - Math.sin(phi) * swing * stiff - body.rotation.x;
      lower.rotation.x = restLower + Math.max(0, Math.cos(phi)) * fold * stiff;
    }

    // Neck and head: up and level, higher still when alert, down to the
    // grass to graze, with a tug now and then as she crops it.
    const crop = graze * Math.max(0, Math.sin(time * 4.3 + a.seed)) ** 6 * 0.12;
    neck.rotation.x = 0.68 - a.alert * 0.4 + graze * 2.0 + crop + Math.sin(cycle * 2) * 0.05 * g;
    neck.rotation.y = a.look * 0.55;
    head.rotation.x = -neck.rotation.x + 0.28 - a.alert * 0.12 + graze * 1.25 + crop * 0.5;
    head.rotation.y = a.look * 0.35;
    head.rotation.z = Math.sin(time * 0.6 + a.seed) * 0.04 * (1 - graze);
    for (const { ear, side } of ears) {
      // Ears turn out at rest and prick forward when alert, and flick.
      const flick = Math.max(0, Math.sin(time * 1.3 + a.seed * 3 + side)) ** 24;
      ear.rotation.z = -side * (0.55 - a.alert * 0.2 - graze * 0.15) + flick * side * 0.3;
      ear.rotation.x = -0.25 + a.alert * 0.3 - graze * 0.55 - flick * 0.4;
    }
    const swish = Math.max(0, Math.sin(time * 0.9 + a.seed)) ** 8;
    tail.rotation.x = 0.35 + a.tailUp * 2.1 + Math.sin(time * 9) * 0.1 * swish;
    tail.rotation.z = Math.sin(time * 11 + a.seed) * 0.35 * swish * (1 - a.tailUp);

    // The hop of a springing fawn lifts all of him.
    mesh.position.y += Math.max(0, Math.sin(cycle)) * 0.16 * a.hop * scale * g;
    a.contact.rotation.x = -Math.PI / 2 - a.pitch;
    a.contact.position.y = 0.03 / scale - (mesh.position.y - ground) / scale;
  }

  function placeAll(dt, time) {
    for (const a of animals) pose(a, dt, time);
  }
  placeAll(0, 0);
  let time = 0;
  return {
    meshes,
    herd,
    /** The streamer's job: both join the scene once their shaders compile. */
    job: { x: herd.doe.x, z: herd.doe.z, step: () => meshes },
    /**
     * Advances them. `player` is the visitor's position (null indoors);
     * `animateWorld` false holds them still, as decorative motion is.
     */
    update(dt, player, animateWorld = true) {
      if (!animateWorld) return;
      time += dt;
      herd.update(dt, player);
      placeAll(dt, time);
    },
    /** Poses both from their state as it stands, without moving them on. */
    pose(dt) {
      time += dt;
      placeAll(dt, time);
    },
    /** Turns their cast shadows on or off; their contact shadows stay. */
    setCastShadows(on) {
      if (on === castsShadows) return;
      castsShadows = on;
      for (const mesh of meshes) mesh.castShadow = on;
    },
    /** Where each is and what it is doing, for tests. */
    describe: () =>
      animals.map(({ mesh, state: s }) => ({
        name: mesh.name,
        x: s.x,
        z: s.z,
        heading: s.heading,
        speed: s.speed,
        activity: s.activity,
        inScene: !!mesh.parent,
      })),
  };
}
