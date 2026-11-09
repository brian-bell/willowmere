// The school's children: eight at football, one on a swing, one skipping
// and one at hopscotch, with the ball, the swings' seats and the skipping
// rope. Every child is a person from src/people/ in a child's size, and all
// of them, the ball, the seats and the rope are one skinned mesh: each
// joint of each figure is a bone, each part is bound rigidly to its joint's
// bone, and the bones are posed every frame. So eleven running, kicking,
// swinging children cost one draw and one sun-shadow draw, and a second,
// coarser mesh on the same skeleton takes over when the overview zooms far
// out. Where the footballers go is src/game/school.js.
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { weldVertices } from "../geometry-weld.js";
import { createPeople } from "../people/index.js";
import { createMatch, MATCH } from "../game/school.js";
import { SCHOOL as S, PITCH } from "./school-layout.js";
import { SCHOOL_CHILDREN } from "../content/school.js";

const TAU = Math.PI * 2;
// A figure's hips above its feet, before its size (src/people/index.js).
const HIPS = 0.58;
// A child's head is bigger for their size than a grown-up's.
const HEAD = 1.12;
// The swings: how long the chains are, how far the seat is above the
// ground, and how long a swing takes there and back.
const SEAT = 0.48,
  SWING_PERIOD = 2.75;
// A part's shape for the far mesh, where a child is a few pixels tall:
// round parts with five or six segments round and as few rows.
function farShape(T, geometry) {
  const p = geometry.parameters;
  if (geometry.type === "LatheGeometry") {
    const rows = p.points.length,
      points = p.points.filter((_, i) => rows < 5 || i % 2 === 0 || i === rows - 1);
    return new T.LatheGeometry(points, 6, p.phiStart, p.phiLength);
  }
  if (geometry.type === "SphereGeometry")
    return new T.SphereGeometry(p.radius, 6, 4, p.phiStart, p.phiLength, p.thetaStart, p.thetaLength);
  if (geometry.type === "CylinderGeometry")
    return new T.CylinderGeometry(p.radiusTop, p.radiusBottom, p.height, 5, 1, p.openEnded, p.thetaStart, p.thetaLength);
  return geometry.clone();
}
const smooth = (x) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/**
 * The children and their match, built a child at a time: `step(deadline)`
 * works until the deadline, as a streamer job's step does, and returns the
 * meshes once they are done, when `kids` holds the rest (see `build`).
 */
export function createKids(T, options) {
  const work = build(T, options);
  const builder = {
    kids: null,
    step(deadline) {
      do {
        const { done, value } = work.next();
        if (done) {
          builder.kids = value;
          return value.meshes;
        }
      } while (performance.now() < deadline);
    },
  };
  return builder;
}

/**
 * Builds the children. `groundHeight(x, z)` seats them; `player` is the
 * visitor's figure, whose position they read each frame; `obstacles` are
 * what the ball comes off and the children go round. Yields between
 * pieces of work, and returns the meshes, the match, `update` and a
 * description for tests.
 */
function* build(T, { groundHeight, player, obstacles }) {
  const yard = S.yard,
    bounds = { minX: S.fence.minX + 0.12, maxX: S.fence.maxX - 0.12, minZ: yard.minZ + 0.1, maxZ: S.fence.maxZ - 0.12 };
  const match = createMatch({ pitch: S.pitch, goal: S.goal, bounds, obstacles, seed: 11 });

  // --- The rig -----------------------------------------------------------

  const bones = [],
    boneIndex = new Map(),
    nearParts = [],
    farParts = [];
  const addBone = (parent, name) => {
    const bone = new T.Bone();
    bone.name = name;
    parent?.add(bone);
    boneIndex.set(bone, bones.length);
    bones.push(bone);
    return bone;
  };
  const root = addBone(null, "Schoolchildren");
  const colour = new T.Color();
  // A part, in the rig's rest pose, painted and bound to `bone`. `far` makes
  // the far mesh's copy from it as well (coarse round parts, no tiny ones).
  function bind(bone, geometry, matrix, hex, far = true) {
    for (const [list, shape] of [
      [nearParts, geometry],
      [far ? farParts : null, far === true ? null : far],
    ]) {
      if (!list) continue;
      const g = (shape ?? geometry).clone().applyMatrix4(matrix);
      const piece = g.index ? g.toNonIndexed() : g;
      if (piece !== g) g.dispose();
      for (const name of Object.keys(piece.attributes))
        if (!["position", "normal", "tone"].includes(name)) piece.deleteAttribute(name);
      const count = piece.attributes.position.count,
        colors = new Float32Array(count * 3),
        skinIndex = new Uint16Array(count * 4),
        skinWeight = new Float32Array(count * 4),
        shade = piece.attributes.tone;
      colour.set(hex);
      for (let i = 0; i < count; i++) {
        const k = shade && list === nearParts ? shade.getX(i) : 1;
        colors[i * 3] = colour.r * k;
        colors[i * 3 + 1] = colour.g * k;
        colors[i * 3 + 2] = colour.b * k;
        skinIndex[i * 4] = boneIndex.get(bone);
        skinWeight[i * 4] = 1;
      }
      piece.deleteAttribute("tone");
      piece.setAttribute("color", new T.BufferAttribute(colors, 3));
      piece.setAttribute("skinIndex", new T.Uint16BufferAttribute(skinIndex, 4));
      piece.setAttribute("skinWeight", new T.BufferAttribute(skinWeight, 4));
      list.push(piece);
    }
  }

  // People are built from groups of meshes; each group becomes a bone and
  // each mesh a part bound to it.
  const materials = new Map();
  const material = (hex) => {
    if (!materials.has(hex)) materials.set(hex, new T.MeshBasicMaterial({ color: hex }));
    return materials.get(hex);
  };
  const person = createPeople(T, material, () => {});
  const partScale = new T.Vector3();
  function figureToBones(figure, parent, name) {
    figure.head.scale.multiplyScalar(HEAD);
    figure.root.updateMatrixWorld(true);
    const map = new Map();
    const walk = (group, parentBone) => {
      const bone = addBone(parentBone, `${name}: ${group === figure.root ? "root" : "joint"}`);
      bone.position.copy(group.position);
      bone.quaternion.copy(group.quaternion);
      bone.scale.copy(group.scale);
      map.set(group, bone);
      for (const child of group.children) if (!child.isMesh) walk(child, bone);
      return bone;
    };
    walk(figure.root, parent);
    // The bones' rest pose is the figure's, wherever the rig's root stands:
    // parts bake in the figure's own frame, which is the rig's at rest.
    figure.root.traverse((o) => {
      if (!o.isMesh) return;
      const bone = map.get(o.parent);
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      o.getWorldScale(partScale);
      const size = o.geometry.boundingSphere.radius * Math.max(partScale.x, partScale.y, partScale.z);
      let far = size >= 0.05;
      if (far && o.geometry.type === "LatheGeometry") {
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        const { min, max } = o.geometry.boundingBox;
        far = (max.y - min.y) * partScale.y >= 0.08;
      }
      const coarse = far && farShape(T, o.geometry);
      bind(bone, o.geometry, o.matrixWorld, o.material.color.getHex(), coarse);
      if (coarse) coarse.dispose();
    });
    const b = (g) => map.get(g);
    return {
      root: b(figure.root),
      body: b(figure.body),
      head: b(figure.head),
      eyes: b(figure.eyes),
      legs: figure.legs.map(b),
      knees: figure.knees.map(b),
      arms: figure.arms.map(b),
      elbows: figure.elbows.map(b),
      armPose: figure.armPose,
      elbowPose: figure.elbowPose,
      armOut: figure.arms.map((a) => a.rotation.z),
      seed: figure.seed,
      phase: 0,
      lastX: 0,
      lastZ: 0,
      size: figure.root.scale.x,
    };
  }

  const kids = [];
  for (const [i, look] of SCHOOL_CHILDREN.entries()) {
    kids.push(figureToBones(person(look), root, `Child ${i + 1}`));
    yield;
  }
  const footballers = kids.slice(0, match.kids.length),
    [swinger, skipper, hopper] = kids.slice(match.kids.length);

  // The ball: a white panelled ball with black patches.
  const ballBone = addBone(root, "Football");
  {
    const r = MATCH.ball,
      ball = new T.IcosahedronGeometry(r, 2),
      corners = new T.IcosahedronGeometry(1, 0).attributes.position,
      tips = [];
    for (let i = 0; i < corners.count; i++) {
      const v = new T.Vector3().fromBufferAttribute(corners, i).normalize();
      if (!tips.some((t) => t.distanceTo(v) < 1e-3)) tips.push(v);
    }
    const p = ball.attributes.position,
      white = [],
      black = [],
      centre = new T.Vector3(),
      a = new T.Vector3();
    for (let f = 0; f < p.count; f += 3) {
      centre.set(0, 0, 0);
      for (let k = 0; k < 3; k++) centre.add(a.fromBufferAttribute(p, f + k));
      centre.normalize();
      (tips.some((t) => t.dot(centre) > 0.94) ? black : white).push(f);
    }
    const take = (faces) => {
      const g = new T.BufferGeometry(),
        out = new Float32Array(faces.length * 9);
      faces.forEach((f, i) => {
        for (let k = 0; k < 9; k++) out[i * 9 + k] = p.array[f * 3 + k];
      });
      g.setAttribute("position", new T.BufferAttribute(out, 3));
      g.computeVertexNormals();
      return g;
    };
    const identity = new T.Matrix4();
    const plain = new T.IcosahedronGeometry(r, 1);
    bind(ballBone, take(white), identity, 0xf4f1e8, plain);
    bind(ballBone, take(black), identity, 0x26231f, false);
    plain.dispose();
  }

  // The swings' seats and chains, each on a bone at the top bar.
  const swingBones = S.swings.seats.map((dx, i) => {
    const bone = addBone(root, `Swing ${i + 1}`),
      drop = S.swings.height - SEAT,
      m = new T.Matrix4();
    bone.position.set(S.swings.x + dx, S.swings.height, S.swings.z);
    // Bound in the bone's own frame: the rig's rest pose puts it there.
    const local = (x, y, z, sx, sy, sz) =>
      m.compose(
        new T.Vector3(x + bone.position.x, y + bone.position.y, z + bone.position.z),
        new T.Quaternion(),
        new T.Vector3(sx, sy, sz),
      );
    const box = new T.BoxGeometry(1, 1, 1),
      rod = new T.CylinderGeometry(1, 1, 1, 5);
    bind(bone, box, local(0, -drop, 0, 0.46, 0.04, 0.2), 0x7b5a3a);
    for (const side of [-1, 1]) bind(bone, rod, local(side * 0.21, -drop / 2, 0, 0.008, drop, 0.008), 0x6b6f72, false);
    return bone;
  });

  // The skipping rope, a bow from hand to hand on a bone at the skipper's
  // hands, which turns it over their head and under their feet.
  const ropeBone = addBone(skipper.root, "Skipping rope");
  ropeBone.position.set(0, 0.74, 0.04);
  {
    const R = 0.92,
      points = [];
    for (let i = 0; i <= 16; i++) {
      const s = (i / 16) * Math.PI;
      points.push(new T.Vector3(-0.27 * Math.cos(s) * (1 + 0.4 * Math.sin(s)), R * Math.sin(s) ** 0.7, 0));
    }
    const rope = new T.TubeGeometry(new T.CatmullRomCurve3(points), 24, 0.011, 4, false),
      m = new T.Matrix4();
    // The rope bakes where its bone stands at rest: in the skipper's frame,
    // whose root stands at the rig's origin.
    root.updateMatrixWorld(true);
    m.copy(ropeBone.matrixWorld);
    bind(ropeBone, rope, m, 0xd0453a, false);
    rope.dispose();
  }

  // Bake both meshes, bound to one skeleton in the rest pose.
  root.updateMatrixWorld(true);
  const material0 = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 });
  material0.name = "Schoolchildren";
  const merge = (parts) => {
    const geometry = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    return geometry;
  };
  yield;
  const nearGeometry = merge(nearParts);
  yield;
  weldVertices(T, nearGeometry);
  yield;
  const farGeometry = merge(farParts);
  weldVertices(T, farGeometry);
  yield;
  const near = new T.SkinnedMesh(nearGeometry, material0),
    far = new T.SkinnedMesh(farGeometry, material0);
  near.name = "Schoolchildren";
  far.name = "Schoolchildren (far)";
  near.add(root);
  near.castShadow = true;
  near.receiveShadow = far.receiveShadow = true;
  far.castShadow = false;
  far.visible = false;
  near.updateMatrixWorld(true);
  const skeleton = new T.Skeleton(bones);
  near.bind(skeleton);
  far.bind(skeleton, near.bindMatrix);
  // Now bound, the swinger can sit on the first seat.
  swingBones[0].add(swinger.root);
  swinger.root.position.set(0, -(S.swings.height - SEAT) - HIPS * swinger.size + 0.06, -0.02);
  for (const g of materials.values()) g.dispose();
  // Culling reads this sphere, which follows the children every frame.
  const sphere = new T.Sphere(new T.Vector3(PITCH.x, 0.6, (S.yard.minZ + S.fence.maxZ) / 2), 12);
  near.boundingSphere = sphere;
  far.boundingSphere = sphere;
  near.frustumCulled = far.frustumCulled = true;

  // Soft contact shadows, one instance under each child and the ball.
  const shadowMaterial = new T.MeshBasicMaterial({ color: 0x324030, transparent: true, opacity: 0.12, depthWrite: false });
  const shadowGeometry = new T.CircleGeometry(1, 16).rotateX(-Math.PI / 2);
  const contacts = new T.InstancedMesh(shadowGeometry, shadowMaterial, kids.length + 1);
  contacts.name = "Schoolchildren: contact shadows";
  contacts.castShadow = contacts.receiveShadow = false;
  contacts.boundingSphere = sphere;
  contacts.frustumCulled = true;

  // --- Poses -------------------------------------------------------------

  const dummy = new T.Object3D();
  // Every joint to its rest, before a pose sets what moves.
  function rest(kid) {
    kid.body.position.set(0, 0, 0);
    kid.body.rotation.set(0, 0, 0);
    kid.head.rotation.set(0, 0, 0);
    for (let i = 0; i < 2; i++) {
      kid.legs[i].rotation.set(0, 0, 0);
      kid.knees[i].rotation.set(0, 0, 0);
      kid.arms[i].rotation.set(kid.armPose[i], 0, kid.armOut[i]);
      kid.elbows[i].rotation.set(kid.elbowPose[i], 0, 0);
    }
  }
  const blink = (kid, time) => (kid.eyes.scale.y = Math.sin(time * 0.91 + kid.seed * 2) > 0.997 ? 0.13 : 1);

  // A run (or a walk, or a keeper's shuffle) by `speed`, at `phase`.
  function run(kid, speed, time) {
    const r = Math.min(1, speed / 3),
      g = Math.min(1, speed / 0.6),
      s = Math.sin(kid.phase),
      c = Math.cos(kid.phase),
      swing = (0.3 + 0.42 * r) * g;
    kid.legs[0].rotation.x = s * swing;
    kid.legs[1].rotation.x = -s * swing;
    kid.knees[0].rotation.x = Math.max(0, -c) * (0.8 + 0.9 * r) * g;
    kid.knees[1].rotation.x = Math.max(0, c) * (0.8 + 0.9 * r) * g;
    kid.body.rotation.x = (0.05 + 0.16 * r) * g;
    kid.body.rotation.y = s * 0.08 * g;
    kid.body.position.y = HIPS * (Math.cos(s * swing) - 1) + Math.abs(c) * 0.045 * r + Math.sin(time * 1.6 + kid.seed) * 0.006;
    kid.head.rotation.x = -kid.body.rotation.x * 0.6;
    const pump = (0.25 + 0.55 * r) * g;
    kid.arms[0].rotation.x = kid.armPose[0] - s * pump;
    kid.arms[1].rotation.x = kid.armPose[1] + s * pump;
    kid.elbows[0].rotation.x = kid.elbowPose[0] - (0.3 + 0.9 * r) * g;
    kid.elbows[1].rotation.x = kid.elbowPose[1] - (0.3 + 0.9 * r) * g;
  }

  // Where each footballer stands and what they are doing, from the match.
  function poseFootballer(kid, k, time) {
    rest(kid);
    const ground = groundHeight(k.x, k.z);
    kid.root.position.set(k.x, ground, k.z);
    kid.root.rotation.set(0, k.heading, 0);
    // The stride follows the ground covered, so feet do not slide.
    const moved = Math.hypot(k.x - kid.lastX, k.z - kid.lastZ);
    kid.lastX = k.x;
    kid.lastZ = k.z;
    if (moved < 1) kid.phase = (kid.phase + (moved / (1.15 * kid.size)) * Math.PI) % TAU;
    const t = k.actionTime;
    if (k.action === "kick") {
      // Wind the leg back, then swing it through the ball.
      const u = Math.min(1, t / MATCH.kick),
        kicker = k.side > 0 ? 1 : 0,
        other = 1 - kicker;
      run(kid, k.speed * 0.5, time);
      const leg = u < 0.4 ? 0.55 * smooth(u / 0.4) : 0.55 - 1.75 * smooth((u - 0.4) / 0.6);
      kid.legs[kicker].rotation.x = leg;
      kid.knees[kicker].rotation.x = u < 0.4 ? 1.2 * smooth(u / 0.4) : 1.2 * (1 - smooth((u - 0.4) / 0.45));
      kid.legs[other].rotation.x = 0.12;
      kid.knees[other].rotation.x = 0.15;
      kid.body.rotation.x = -0.08;
      kid.body.position.y = -0.02;
      for (const i of [0, 1]) kid.arms[i].rotation.z = kid.armOut[i] + (i ? 1 : -1) * 0.55;
    } else if (k.action === "cheer") {
      run(kid, k.speed, time);
      for (const i of [0, 1]) {
        kid.arms[i].rotation.x = -2.85 + Math.sin(time * 9 + i * 2 + kid.seed) * 0.22;
        kid.arms[i].rotation.z = kid.armOut[i] + (i ? 1 : -1) * 0.25;
        kid.elbows[i].rotation.x = -0.15;
      }
      kid.root.position.y += Math.abs(Math.sin(time * 7 + kid.seed)) * 0.12 * (k.speed < 1 ? 1 : 0.3);
    } else if (k.keeper) {
      if (k.action === "dive") {
        const u = t / MATCH.dive,
          fall = u < 0.3 ? smooth(u / 0.3) : u > 0.8 ? 1 - smooth((u - 0.8) / 0.2) : 1;
        kid.root.rotation.set(0, k.heading, -k.side * 1.25 * fall);
        for (const i of [0, 1]) {
          kid.arms[i].rotation.x = -2.9;
          kid.elbows[i].rotation.x = -0.1;
        }
        kid.legs[0].rotation.z = -0.2 * fall;
        kid.legs[1].rotation.z = 0.2 * fall;
      } else if (k.action === "hold" || k.action === "throw") {
        const u = k.action === "throw" ? Math.min(1, t / MATCH.throw) : 0;
        for (const i of [0, 1]) {
          kid.arms[i].rotation.x = k.action === "throw" ? -2.8 + 1.9 * smooth(u) : -1.05;
          kid.arms[i].rotation.z = kid.armOut[i] + (i ? -1 : 1) * 0.12;
          kid.elbows[i].rotation.x = k.action === "throw" ? -0.2 : -1.35;
        }
      } else {
        // Ready: knees bent, arms out, shuffling along the line.
        run(kid, k.speed * 0.7, time);
        for (const i of [0, 1]) {
          kid.legs[i].rotation.x += -0.3;
          kid.knees[i].rotation.x += 0.62;
          kid.arms[i].rotation.x = -0.85;
          kid.arms[i].rotation.z = kid.armOut[i] + (i ? 1 : -1) * 0.5;
          kid.elbows[i].rotation.x = -0.55;
        }
        kid.body.rotation.x += 0.2;
        kid.body.position.y -= 0.075;
      }
    } else run(kid, k.speed, time);
    blink(kid, time);
  }

  // On the swing: pumping legs forward on the way up, tucking them back.
  function poseSwinger(time) {
    const kid = swinger,
      a = -0.55 * Math.sin((time / SWING_PERIOD) * TAU),
      pump = Math.cos((time / SWING_PERIOD) * TAU);
    swingBones[0].rotation.x = a;
    // The empty seat stirs.
    swingBones[1].rotation.x = 0.06 * Math.sin(time * 2.2 + 1);
    rest(kid);
    for (const i of [0, 1]) {
      kid.legs[i].rotation.x = -1.4 - 0.25 * pump;
      kid.knees[i].rotation.x = 1.35 + 0.45 * pump;
      kid.arms[i].rotation.x = -2.55;
      kid.arms[i].rotation.z = kid.armOut[i] + (i ? 1 : -1) * 0.02;
      kid.elbows[i].rotation.x = -0.35;
    }
    kid.body.rotation.x = -0.12 * pump;
    kid.head.rotation.x = 0.1 * pump;
    blink(kid, time);
  }

  // Skipping: the rope turns over and under; she hops as it passes her feet.
  function poseSkipper(time) {
    const kid = skipper,
      turn = time * TAU * 1.45,
      hop = Math.max(0, Math.cos(turn - Math.PI)) ** 3 * 0.13;
    rest(kid);
    ropeBone.rotation.x = turn % TAU;
    kid.root.position.set(S.skipping.x, groundHeight(S.skipping.x, S.skipping.z) + hop, S.skipping.z);
    kid.root.rotation.set(0, 0.55, 0);
    const land = 1 - hop / 0.13;
    for (const i of [0, 1]) {
      kid.arms[i].rotation.x = -0.4 + Math.sin(turn) * 0.12;
      kid.arms[i].rotation.z = kid.armOut[i] + (i ? 1 : -1) * 0.38;
      kid.elbows[i].rotation.x = -0.95;
      kid.legs[i].rotation.x = -0.18 * land;
      kid.knees[i].rotation.x = 0.36 * land + 0.1;
    }
    kid.body.position.y = -0.035 * land;
    blink(kid, time);
  }

  // Hopscotch: up the squares and back, hopping on one foot on the single
  // squares and landing astride the doubles, turning round at the top.
  const ROWS = [false, false, true, false, true, false, true, false];
  const HOP = 0.42,
    TURN = 0.9,
    lap = ROWS.length * HOP * 2 + TURN * 2;
  function poseHopper(time) {
    const kid = hopper,
      h = S.hopscotch,
      t = (time + 3) % lap,
      leg = ROWS.length * HOP;
    let row, u, heading, turning;
    if (t < leg) [row, u, heading, turning] = [t / HOP, (t % HOP) / HOP, Math.PI / 2, false];
    else if (t < leg + TURN) [row, u, heading, turning] = [ROWS.length, 0, Math.PI / 2 + Math.PI * smooth((t - leg) / TURN), true];
    else if (t < leg * 2 + TURN) [row, u, heading, turning] = [ROWS.length - (t - leg - TURN) / HOP, ((t - leg - TURN) % HOP) / HOP, -Math.PI / 2, false];
    else [row, u, heading, turning] = [0, 0, -Math.PI / 2 + Math.PI * smooth((t - 2 * leg - TURN) / TURN), true];
    const x = h.x - h.square / 2 + row * h.square,
      lift = turning ? 0 : Math.sin(u * Math.PI) * 0.15,
      square = Math.min(ROWS.length - 1, Math.max(0, Math.round(row))),
      astride = !turning && ROWS[square] && u > 0.75;
    rest(kid);
    kid.root.position.set(x, groundHeight(x, h.z) + lift, h.z);
    kid.root.rotation.set(0, heading, 0);
    for (const i of [0, 1]) {
      kid.arms[i].rotation.x = -0.3;
      kid.arms[i].rotation.z = kid.armOut[i] + (i ? 1 : -1) * 0.75;
      kid.elbows[i].rotation.x = -0.4;
    }
    if (astride) {
      kid.legs[0].rotation.z = -0.22;
      kid.legs[1].rotation.z = 0.22;
    } else if (!turning) {
      // The left foot stays tucked up behind.
      kid.legs[0].rotation.x = 0.35;
      kid.knees[0].rotation.x = 1.35;
      kid.knees[1].rotation.x = 0.25 * (1 - Math.sin(u * Math.PI));
    }
    kid.body.position.y = turning ? 0 : -0.03 * (1 - Math.sin(u * Math.PI));
    blink(kid, time);
  }

  const contactAt = (i, x, z, sx, sz) => {
    dummy.position.set(x, groundHeight(x, z) + 0.035, z);
    dummy.scale.set(sx, 1, sz);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    contacts.setMatrixAt(i, dummy.matrix);
  };
  const roll = new T.Quaternion(),
    axis = new T.Vector3();
  function poseAll(time) {
    footballers.forEach((kid, i) => poseFootballer(kid, match.kids[i], time));
    poseSwinger(time);
    poseSkipper(time);
    poseHopper(time);
    const b = match.ball;
    ballBone.position.set(b.x, groundHeight(b.x, b.z) + MATCH.ball + b.y, b.z);
    // Roll the ball the way it goes.
    const speed = Math.hypot(b.vx, b.vz);
    if (speed > 0.01 && !b.heldBy) {
      axis.set(b.vz / speed, 0, -b.vx / speed);
      roll.setFromAxisAngle(axis, (speed * lastDt) / MATCH.ball);
      ballBone.quaternion.premultiply(roll);
    }
    // Contact shadows, and the culling sphere round everyone.
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    kids.forEach((kid, i) => {
      kid.root.getWorldPosition(dummy.position);
      const { x, z } = dummy.position;
      contactAt(i, x, z, 0.3 * kid.size / 0.74, 0.22 * kid.size / 0.74);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    });
    contactAt(kids.length, b.x, b.z, MATCH.ball * 1.1, MATCH.ball * 1.1);
    contacts.instanceMatrix.needsUpdate = true;
    sphere.center.set((minX + maxX) / 2, 0.8, (minZ + maxZ) / 2);
    sphere.radius = Math.hypot(maxX - minX, maxZ - minZ) / 2 + 1.6;
  }

  let time = 0,
    lastDt = 0,
    lastClock = null,
    farShown = false;
  const walker = { x: 0, z: 0, vx: 0, vz: 0 },
    last = { x: player?.position.x ?? 0, z: player?.position.z ?? 0 };
  poseAll(0);
  const meshes = [near, far, contacts];
  return {
    meshes,
    match,
    /**
     * Advances the match and poses everyone. A chunk's animation calls it,
     * once per frame whichever chunks are in view: `clock` tells frames
     * apart. `farView` swaps in the coarse mesh and drops the cast shadow.
     */
    update(dt, clock, farView) {
      if (farView !== farShown) {
        farShown = farView;
        near.visible = !farView;
        far.visible = farView;
        near.castShadow = !farView;
      }
      if (clock === lastClock) return;
      lastClock = clock;
      if (dt <= 0) return;
      time += dt;
      lastDt = dt;
      let w = null;
      if (player) {
        const { x, z } = player.position;
        walker.vx = (x - last.x) / dt;
        walker.vz = (z - last.z) / dt;
        walker.x = last.x = x;
        walker.z = last.z = z;
        // A jump across the map is not a run.
        if (Math.hypot(walker.vx, walker.vz) > 12) walker.vx = walker.vz = 0;
        w = walker;
      }
      match.update(dt, w);
      poseAll(time);
    },
    /** Where each footballer and the ball are, for tests. */
    describe: () => ({
      phase: match.phase,
      score: [...match.score],
      ball: { x: match.ball.x, z: match.ball.z, y: match.ball.y, held: !!match.ball.heldBy },
      kids: match.kids.map((k) => ({ id: k.id, x: k.x, z: k.z, action: k.action })),
      inScene: !!near.parent,
      far: farShown,
    }),
  };
}
