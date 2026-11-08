import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createCat } from "./cats.js";
import { animatePerson, createPeople } from "./people/index.js";

/**
 * Hand-built inhabitants and wildlife. Coordinates are in the village's X/Z
 * plane; groundHeight(x, z) lifts everyone onto the terrain under them.
 * `water`, if given, leaves them out of its reflections zoomed far out.
 */
export function createLife(THREE, scene, groundHeight = () => 0, water = null) {
  // Everything that walks, flies or wags, whose cast shadows the overview
  // drops when zoomed far out (each keeps its soft contact shadow), as the
  // water's reflections drop the figures themselves.
  const figures = [];
  const addFigure = (root) => {
    figures.push(root);
    scene.add(root);
    water?.excludeFromFarCaptures(root);
  };
  let casters = null,
    castsShadows = true;
  // The plain colours batchParts may bake into vertex colours.
  const palette = new Set();
  const materials = new Map();
  const mat = (color, roughness = 0.86) => {
    const key = `${color}:${roughness}`;
    if (!materials.has(key)) {
      const material = new THREE.MeshStandardMaterial({ color, roughness });
      materials.set(key, material);
      palette.add(material);
    }
    return materials.get(key);
  };
  const geometry = {
    sphere: new THREE.SphereGeometry(1, 12, 9),
    round: new THREE.SphereGeometry(1, 16, 12),
    box: new THREE.BoxGeometry(1, 1, 1),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 16),
  };
  const m = (parent, kind, color, x, y, z, sx, sy, sz = sx) => {
    const mesh = new THREE.Mesh(geometry[kind], mat(color));
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const sphere = (...args) => m(args[0], "sphere", ...args.slice(1));
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x324030,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
  });
  const shadowGeo = new THREE.CircleGeometry(1, 24);
  const shadow = (parent, sx, sz) => {
    const s = new THREE.Mesh(shadowGeo, shadowMat);
    s.rotation.x = -Math.PI / 2;
    s.position.y = 0.025;
    s.scale.set(sx, sz, 1);
    parent.add(s);
    return s;
  };
  const person = createPeople(THREE, mat, shadow);
  const traveler = person({
    coat: 0xb84f35,
    hair: 0x624031,
    belt: true,
    hat: "straw",
    ribbon: 0x365c62,
    feather: 0xc9a24f,
    neck: "scarf",
    neckColor: 0x406d70,
    pack: true,
    size: 1.12,
    walks: true,
  });
  const player = traveler.root;
  player.name = "Traveler";
  addFigure(player);
  const npcDefinitions = [
    {
      id: "mabel",
      name: "Mabel",
      x: -5,
      z: 1,
      coat: 0x81966d,
      hair: 0x79533d,
      skin: 0xe4b594,
      garment: "dress",
      apron: "half",
      apronColor: 0xe6d9b8,
      collar: "round",
      hat: "sunhat",
      hairStyle: "plait",
      carry: { right: "bouquet" },
      armPose: [
        [-0.42, -1.05],
        [0, -0.16],
      ],
      size: 0.94,
      dialogue: [
        "Every flower has its own little way of saying hello.",
        "The bluebells by the brook are happiest after rain.",
        "Take your time, dear. Beautiful things are rarely in a hurry.",
      ],
    },
    {
      id: "finn",
      name: "Finn",
      x: 2,
      z: -4,
      coat: 0x708d91,
      hair: 0x824b2e,
      skin: 0xc88e65,
      garment: "shirt",
      rolled: true,
      apron: "bib",
      flour: true,
      stout: 1.09,
      trousers: 0x6b6255,
      hat: "toque",
      beard: "short",
      neck: "kerchief",
      neckColor: 0xb5584a,
      carry: { left: "loaf" },
      armPose: [
        [-0.05, -0.14],
        [-0.3, -1.35],
      ],
      size: 1.04,
      dialogue: [
        "The first loaf is always for whoever follows the smell.",
        "I tucked a little rosemary into today’s bread. A village secret.",
        "A warm oven, good company. That’s a pretty fine day.",
      ],
    },
    {
      id: "elio",
      name: "Elio",
      x: -7,
      z: 7,
      coat: 0xc49c58,
      hair: 0x493c32,
      skin: 0xbc8768,
      garment: "smock",
      rolled: true,
      trousers: 0x6b5a48,
      patches: 0x8a7350,
      hat: "straw",
      straw: 0xdcc78c,
      ribbon: 0x6b4f3a,
      hatTilt: 0.06,
      hairStyle: "wavy",
      neck: "kerchief",
      neckColor: 0x8c4a3c,
      carry: { left: "can" },
      armPose: [
        [0, -0.12],
        [-0.05, -0.12],
      ],
      size: 0.96,
      dialogue: [
        "Listen — even the leaves have something to say.",
        "These beds take a little care each day. Nothing grand. Just kindness.",
        "I think the garden likes having you here.",
      ],
    },
  ];
  function resident(def) {
    const figure = person(def);
    figure.root.position.set(def.x, groundHeight(def.x, def.z), def.z);
    figure.root.rotation.y = def.facing ?? (def.id === "finn" ? 0.2 : -0.5);
    figure.root.name = def.name;
    addFigure(figure.root);
    return { ...def, group: figure.root, figure };
  }
  const residents = npcDefinitions.map(resident);
  // Lily and Pip take a quiet lap of the open lane east of the fountain.
  const girl = person({
    coat: 0xc77b9a,
    hair: 0x613e2c,
    skin: 0xe8b591,
    garment: "dress",
    short: true,
    apron: "bib",
    apronColor: 0xf6edda,
    collar: "round",
    collarColor: 0xfdf6e6,
    puffed: true,
    trousers: 0xe9dfcc,
    boots: 0x7a4a3a,
    bootStyle: "shoe",
    hairStyle: "pigtails",
    freckles: true,
    size: 0.8,
    walks: true,
    armPose: [
      [0, -0.12],
      [-0.45, -0.25],
    ],
  });
  girl.root.name = "Lily";
  addFigure(girl.root);
  const { pigtails } = girl;
  const leashHand = new THREE.Object3D();
  leashHand.position.set(0, -0.06, 0.012);
  girl.hands[1].add(leashHand);

  const puppy = new THREE.Group(),
    puppyBody = new THREE.Group();
  puppy.name = "Pip the puppy";
  puppy.add(puppyBody);
  addFigure(puppy);
  shadow(puppy, 0.4, 0.27);
  const fur = 0xcfa168,
    cream = 0xf4e2bb,
    darkFur = 0x9c6a41;
  sphere(puppyBody, fur, 0, 0.32, 0, 0.205, 0.23, 0.33);
  sphere(puppyBody, cream, 0, 0.3, 0.25, 0.145, 0.18, 0.12);
  const puppyHead = new THREE.Group();
  puppyHead.position.set(0, 0.48, 0.24);
  puppyBody.add(puppyHead);
  sphere(puppyHead, fur, 0, 0.07, 0.02, 0.215, 0.21, 0.19);
  sphere(puppyHead, cream, 0, -0.015, 0.18, 0.125, 0.09, 0.105);
  sphere(puppyHead, 0x35312c, 0, 0.01, 0.275, 0.057, 0.039, 0.031);
  sphere(puppyHead, cream, 0, 0.12, 0.185, 0.045, 0.1, 0.017);
  const ears = [];
  for (const side of [-1, 1]) {
    sphere(
      puppyHead,
      0x352f28,
      side * 0.092,
      0.105,
      0.186,
      0.027,
      0.035,
      0.015,
    );
    sphere(
      puppyHead,
      0xfff6dc,
      side * 0.092 - 0.007,
      0.116,
      0.198,
      0.009,
      0.011,
      0.006,
    );
    const ear = new THREE.Group();
    ear.position.set(side * 0.19, 0.13, -0.005);
    puppyHead.add(ear);
    sphere(ear, darkFur, side * 0.025, -0.12, -0.015, 0.075, 0.185, 0.105);
    ears.push(ear);
  }
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.15, 0.032, 6, 18),
    mat(0x729aa0),
  );
  collar.position.set(0, 0.46, 0.22);
  collar.rotation.x = Math.PI / 2;
  puppyBody.add(collar);
  sphere(puppyBody, 0xd8b05b, 0, 0.37, 0.365, 0.047, 0.053, 0.022);
  const collarClip = new THREE.Object3D();
  collarClip.position.set(0, 0.51, 0.16);
  puppyBody.add(collarClip);
  const paws = [];
  for (const side of [-1, 1])
    for (const z of [-0.2, 0.2]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.135, 0.26, z);
      puppyBody.add(leg);
      sphere(leg, fur, 0, -0.075, 0, 0.065, 0.12, 0.07);
      sphere(leg, cream, 0, -0.19, 0.035, 0.083, 0.06, 0.11);
      paws.push(leg);
    }
  const puppyTail = new THREE.Group();
  puppyTail.position.set(0, 0.36, -0.29);
  puppyBody.add(puppyTail);
  const tailPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.13, -0.15),
    new THREE.Vector3(0, 0.33, -0.23),
    new THREE.Vector3(0, 0.39, -0.18),
  ]);
  const waggingTail = new THREE.Mesh(
    new THREE.TubeGeometry(tailPath, 12, 0.045, 7, false),
    mat(fur),
  );
  waggingTail.castShadow = true;
  puppyTail.add(waggingTail);
  sphere(puppyTail, cream, 0, 0.39, -0.18, 0.046, 0.057, 0.046);
  // A little straw boater from the market's milliner, once it is bought.
  const pipHat = new THREE.Group();
  pipHat.name = "Pip's straw hat";
  pipHat.position.set(0, 0.25, 0.0);
  pipHat.rotation.x = -0.12;
  pipHat.visible = false;
  puppyHead.add(pipHat);
  m(pipHat, "cylinder", 0xe3c27a, 0, 0, 0, 0.2, 0.018, 0.2);
  m(pipHat, "cylinder", 0xe8c983, 0, 0.055, 0, 0.12, 0.1, 0.12);
  m(pipHat, "cylinder", 0xb5584a, 0, 0.03, 0, 0.123, 0.032, 0.123);

  const leash = new THREE.Group();
  leash.name = "Lily and Pip leash";
  addFigure(leash);
  const leashGeometry = new THREE.CylinderGeometry(0.019, 0.019, 1, 6);
  for (let i = 0; i < 12; i++) {
    const segment = new THREE.Mesh(leashGeometry, mat(0x735671));
    leash.add(segment);
  }
  const route = new THREE.CatmullRomCurve3(
    Array.from({ length: 12 }, (_, i) => {
      const angle = (i / 12) * Math.PI * 2;
      return new THREE.Vector3(
        6.3 + Math.cos(angle) * 1.4,
        0.05,
        3 + Math.sin(angle) * 0.65,
      );
    }),
    true,
    "centripetal",
  );
  const routeLength = route.getLength(),
    up = new THREE.Vector3(0, 1, 0);
  const position = new THREE.Vector3(),
    tangent = new THREE.Vector3(),
    right = new THREE.Vector3();
  const handPosition = new THREE.Vector3(),
    collarPosition = new THREE.Vector3();
  const leashStart = new THREE.Vector3(),
    leashEnd = new THREE.Vector3(),
    segmentDirection = new THREE.Vector3();
  const lily = {
    id: "lily",
    name: "Lily",
    group: girl.root,
    dialogue: [
      "This is Pip! He thinks every walk is a very big adventure.",
      "We’re taking the long way home. There are still so many things to sniff!",
    ],
  };
  function updatePuppyWalk(time) {
    const duration = 20,
      ramp = 1,
      t = time % 25;
    const walkingTime = Math.min(t, duration);
    const distance =
      walkingTime < ramp
        ? (walkingTime * walkingTime) / (2 * ramp)
        : walkingTime > duration - ramp
          ? duration - ramp - (duration - walkingTime) ** 2 / (2 * ramp)
          : walkingTime - ramp / 2;
    const u = (distance / (duration - ramp) + 0.28) % 1;
    const blend =
      t < duration
        ? Math.min(walkingTime / ramp, (duration - walkingTime) / ramp, 1)
        : 0;
    route.getPointAt(u, position);
    route.getTangentAt(u, tangent).normalize();
    right.set(tangent.z, 0, -tangent.x);
    girl.root.position.copy(position);
    girl.root.position.y += groundHeight(position.x, position.z);
    girl.root.rotation.y = Math.atan2(tangent.x, tangent.z);
    const phase =
      (((distance / (duration - ramp)) * routeLength) / 0.38) * Math.PI * 2;
    animatePerson(girl, phase, blend, time);
    girl.arms[1].rotation.x = -0.45;
    pigtails.forEach(
      (hair, i) =>
        (hair.rotation.z = Math.sin(phase + i * Math.PI) * 0.12 * blend),
    );
    puppy.position
      .copy(position)
      .addScaledVector(right, 0.64)
      .addScaledVector(tangent, 0.3);
    puppy.position.y += groundHeight(puppy.position.x, puppy.position.z);
    puppy.rotation.y =
      girl.root.rotation.y + Math.sin(time * 1.7) * 0.1 * (1 - blend);
    puppyBody.position.y = Math.abs(Math.sin(phase * 1.4)) * 0.025 * blend;
    paws.forEach(
      (leg, i) =>
        (leg.rotation.x =
          Math.sin(phase * 1.4 + (i === 0 || i === 3 ? 0 : Math.PI)) *
          0.43 *
          blend),
    );
    ears.forEach(
      (ear, i) => (ear.rotation.x = Math.sin(phase * 1.4 + i) * 0.14 * blend),
    );
    puppyTail.rotation.z = Math.sin(time * 8) * 0.42;
    puppyHead.rotation.x = (1 - blend) * (0.35 + Math.sin(time * 2) * 0.1);
    girl.root.updateMatrixWorld(true);
    puppy.updateMatrixWorld(true);
    leashHand.getWorldPosition(handPosition);
    collarClip.getWorldPosition(collarPosition);
    const sag = 0.13;
    for (let i = 0; i < leash.children.length; i++) {
      const a = i / leash.children.length,
        b = (i + 1) / leash.children.length;
      leashStart.lerpVectors(handPosition, collarPosition, a);
      leashStart.y -= Math.sin(a * Math.PI) * sag;
      leashEnd.lerpVectors(handPosition, collarPosition, b);
      leashEnd.y -= Math.sin(b * Math.PI) * sag;
      const segment = leash.children[i];
      segment.position.copy(leashStart).add(leashEnd).multiplyScalar(0.5);
      segmentDirection.subVectors(leashEnd, leashStart);
      segment.scale.y = segmentDirection.length();
      segment.quaternion.setFromUnitVectors(up, segmentDirection.normalize());
    }
  }
  updatePuppyWalk(0);

  // Butterflies have two independently hinged wings, not billboard sprites.
  const butterflies = [];
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.bezierCurveTo(0.24, 0.15, 0.29, 0.44, 0.1, 0.38);
  wingShape.bezierCurveTo(0.01, 0.33, 0.19, 0.13, 0.15, 0.035);
  wingShape.quadraticCurveTo(0.07, -0.075, 0, 0);
  const wingGeometry = new THREE.ShapeGeometry(wingShape, 8);
  const butterflyLocations = [
    [-9, 4],
    [-6, 8],
    [-4, 6],
    [6, 3],
    [-11, -2],
    [8, 7],
    [-14, 7],
  ];
  butterflyLocations.forEach(([x, z], i) => {
    const root = new THREE.Group();
    root.scale.setScalar(0.57 + (i % 3) * 0.06);
    addFigure(root);
    const wingMaterial = new THREE.MeshStandardMaterial({
      color: [0xe9bd66, 0xe8b7b9, 0x93b3be][i % 3],
      side: THREE.DoubleSide,
      roughness: 0.8,
    });
    const wings = [-1, 1].map((side) => {
      const pivot = new THREE.Group();
      root.add(pivot);
      const wing = new THREE.Mesh(wingGeometry, wingMaterial);
      wing.scale.x = side;
      pivot.add(wing);
      return pivot;
    });
    sphere(root, 0x5c5140, 0, 0.12, 0, 0.021, 0.145, 0.024);
    butterflies.push({ root, wings, x, z, seed: i * 1.91 });
  });
  const cats = [
    {
      name: "Bracken the tabby cat",
      center: [-2, 6],
      colors: { fur: 0xbf9360, stripe: 0x8b603c, cream: 0xf1d7ac, eye: 0x8caa62 },
    },
    {
      name: "Misty the gray cat",
      center: [6, -2],
      colors: { fur: 0x818b88, stripe: 0x4d666b, cream: 0xdde2d4, eye: 0xc6aa72 },
    },
  ].map(({ name, center, colors }, i) => {
    const cat = createCat(THREE, colors, mat);
    cat.root.name = name;
    cat.root.scale.setScalar(1.15);
    shadow(cat.root, 0.44, 0.25);
    addFigure(cat.root);
    const [x, z] = center;
    const route = new THREE.CatmullRomCurve3(
      [
        [-1.45, 0],
        [-1, -0.48],
        [0, -0.65],
        [1.3, -0.42],
        [1.5, 0.1],
        [0.8, 0.58],
        [-0.45, 0.65],
        [-1.3, 0.4],
      ].map(([dx, dz]) => new THREE.Vector3(x + dx, 0, z + dz)),
      true,
      "centripetal",
    );
    return {
      ...cat,
      route,
      routeLength: route.getLength(),
      position: new THREE.Vector3(),
      tangent: new THREE.Vector3(),
      offset: i * 0.43,
      seed: i * 2.4,
    };
  });
  const birds = [];
  for (let i = 0; i < 4; i++) {
    const root = new THREE.Group();
    addFigure(root);
    sphere(root, 0x65717a, 0, 0, 0, 0.075, 0.065, 0.19);
    const wings = [-1, 1].map((s) => {
      const pivot = new THREE.Group();
      root.add(pivot);
      const wing = sphere(pivot, 0x8d9490, s * 0.23, 0, 0, 0.26, 0.027, 0.105);
      return pivot;
    });
    birds.push({ root, wings, seed: i * 1.9 });
  }
  // Tiny emissive motes collect over the flowers and remain quiet in daylight.
  const motePositions = new Float32Array(18 * 3);
  const moteGeometry = new THREE.BufferGeometry();
  moteGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(motePositions, 3),
  );
  const moteMaterial = new THREE.PointsMaterial({
    color: 0xffe5a0,
    size: 0.042,
    transparent: true,
    opacity: 0.66,
    depthWrite: false,
  });
  const motes = new THREE.Points(moteGeometry, moteMaterial);
  scene.add(motes);

  // Bake only rigid siblings from our plain-color palette. The groups remain
  // independent joints, so gait, ears, tails, scarf and leash anchors still move.
  const batchMaterials = new Map();
  function batchParts(group) {
    const batches = new Map();
    for (const child of [...group.children]) {
      if (child.isGroup) batchParts(child);
      if (!child.isMesh || !palette.has(child.material)) continue;
      child.updateMatrix();
      child.matrixAutoUpdate = false;
      const key = `${child.material.roughness}/${child.castShadow}/${child.receiveShadow}`;
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key).push(child);
    }
    for (const [key, meshes] of batches) {
      if (meshes.length < 2) continue;
      if (!batchMaterials.has(key)) {
        const material = meshes[0].material.clone();
        material.color.set(0xffffff);
        material.vertexColors = true;
        batchMaterials.set(key, material);
      }
      const parts = meshes.map((mesh) => {
        const part = new THREE.BufferGeometry()
          .copy(mesh.geometry)
          .applyMatrix4(mesh.matrix);
        const colors = new Float32Array(part.attributes.position.count * 3);
        const { r, g, b } = mesh.material.color,
          tone = part.attributes.tone;
        for (let i = 0; i < colors.length; i += 3) {
          const k = tone ? tone.getX(i / 3) : 1;
          colors[i] = r * k;
          colors[i + 1] = g * k;
          colors[i + 2] = b * k;
        }
        part.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        part.deleteAttribute("tone");
        part.deleteAttribute("uv");
        return part;
      });
      const geometry = mergeGeometries(parts);
      parts.forEach((part) => part.dispose());
      const mesh = new THREE.Mesh(geometry, batchMaterials.get(key));
      mesh.castShadow = meshes[0].castShadow;
      mesh.receiveShadow = meshes[0].receiveShadow;
      mesh.matrixAutoUpdate = false;
      meshes.forEach((part) => part.removeFromParent());
      group.add(mesh);
    }
  }
  for (const root of [player, girl.root, puppy, ...cats.map((cat) => cat.root)])
    batchParts(root);

  let velocityX = 0,
    velocityZ = 0,
    walkPhase = 0,
    walkBlend = 0,
    animationTime = 0;
  function setPlayerMotion(vx, vz) {
    velocityX = vx;
    velocityZ = vz;
  }
  function update(dt, time, moving, animateWorld = true) {
    if (animateWorld) animationTime += dt;
    time = animationTime;
    const speed = Math.hypot(velocityX, velocityZ),
      target = animateWorld && moving && speed > 0.001 ? 1 : 0;
    walkBlend = THREE.MathUtils.lerp(walkBlend, target, 1 - Math.exp(-dt * 12));
    walkPhase += dt * Math.min(13, 7 + speed * 1.7) * walkBlend;
    if (speed > 0.001) {
      const desired = Math.atan2(velocityX, velocityZ);
      const angle = Math.atan2(
        Math.sin(desired - player.rotation.y),
        Math.cos(desired - player.rotation.y),
      );
      player.rotation.y += angle * (1 - Math.exp(-dt * 12));
    }
    animatePerson(traveler, walkPhase, walkBlend, time);
    updatePuppyWalk(time);
    for (const npc of residents) {
      animatePerson(npc.figure, 0, 0, time);
      const distance = npc.group.position.distanceTo(player.position);
      let glance = 0;
      if (distance < 3.4) {
        const desired = Math.atan2(
          player.position.x - npc.x,
          player.position.z - npc.z,
        );
        const angle = Math.atan2(
          Math.sin(desired - npc.group.rotation.y),
          Math.cos(desired - npc.group.rotation.y),
        );
        npc.group.rotation.y += angle * (1 - Math.exp(-dt * 2));
        // The head turns first, and the shoulders catch it up.
        glance = Math.max(-0.75, Math.min(0.75, angle));
      }
      npc.figure.lookY += (glance - npc.figure.lookY) * (1 - Math.exp(-dt * 5));
    }
    butterflies.forEach(({ root, wings, x, z, seed }) => {
      const t = time * 0.55 + seed;
      const bx = x + Math.sin(t) * 0.9,
        bz = z + Math.cos(t * 0.9) * 0.65;
      root.position.set(
        bx,
        groundHeight(bx, bz) + 0.9 + Math.sin(t * 1.7) * 0.32,
        bz,
      );
      root.rotation.set(0.2, Math.atan2(Math.cos(t), -Math.sin(t * 0.9)), 0);
      wings[0].rotation.y = Math.sin(time * 14 + seed) * 1.05;
      wings[1].rotation.y = -wings[0].rotation.y;
    });
    cats.forEach((cat) => {
      const { root, body, torso, head, legs, ears, eyes, tail, tailTip } = cat;
      const cycle = 26;
      const walkEnd = 19;
      const ramp = 1.4;
      const local = (time + cat.seed * 3) % cycle;
      const movingTime = Math.min(local, walkEnd);
      const distance =
        movingTime < ramp
          ? (movingTime * movingTime) / (2 * ramp)
          : movingTime > walkEnd - ramp
            ? walkEnd - ramp - (walkEnd - movingTime) ** 2 / (2 * ramp)
            : movingTime - ramp / 2;
      const walk =
        local < walkEnd
          ? Math.min(movingTime / ramp, (walkEnd - movingTime) / ramp, 1)
          : 0;
      const lap = distance / (walkEnd - ramp);
      const u = (lap + cat.offset) % 1;
      cat.route.getPointAt(u, cat.position);
      cat.route.getTangentAt(u, cat.tangent).normalize();
      root.position.copy(cat.position);
      root.position.y += groundHeight(cat.position.x, cat.position.z);
      root.rotation.y = Math.atan2(cat.tangent.x, cat.tangent.z);
      // A stride follows the arc actually travelled, including slow starts and stops.
      const phase = (lap * cat.routeLength * Math.PI * 2) / 0.43;
      const idle = Math.max(0, local - walkEnd);
      const sniff = Math.sin(Math.min(1, idle / 2.7) * Math.PI) ** 2;
      const groom = Math.sin(Math.max(0, Math.min(1, (idle - 2.6) / 4)) * Math.PI) ** 2;
      body.position.y =
        Math.abs(Math.sin(phase * 2)) * 0.015 * walk +
        Math.sin(time * 2.2 + cat.seed) * 0.004 -
        sniff * 0.027;
      body.rotation.z = Math.sin(phase) * 0.025 * walk;
      torso.rotation.x = sniff * 0.045;
      head.rotation.x = sniff * 0.37 + groom * 0.15;
      head.rotation.y =
        Math.sin(time * 0.82 + cat.seed) * (0.12 + (1 - walk) * 0.14);
      head.rotation.z = groom * Math.sin(time * 9) * 0.07;
      legs.forEach(({ leg, paw, hind, side }) => {
        const step = phase + (hind ? 0 : Math.PI) + (side > 0 ? Math.PI : 0);
        leg.rotation.x = Math.sin(step) * 0.43 * walk;
        paw.position.y = (hind ? -0.31 : -0.285) +
          Math.max(0, Math.sin(step)) * 0.048 * walk;
      });
      legs[2].leg.rotation.x -= groom * (1.05 + Math.sin(time * 9) * 0.13);
      legs[2].paw.position.y += groom * 0.09;
      tail.rotation.y = Math.sin(time * 2.1 + cat.seed) * (0.13 + (1 - walk) * 0.13);
      tail.rotation.z = Math.sin(time * 1.3 + cat.seed) * 0.08;
      tailTip.rotation.x = Math.sin(time * 2.5 + cat.seed) * 0.18;
      ears.forEach((ear, i) => {
        ear.rotation.x = Math.sin(time * 2.6 + cat.seed + i * 2) * 0.045 +
          groom * (i ? -0.11 : 0.08);
      });
      const blink = Math.sin(time * 0.91 + cat.seed * 2) > 0.997 ? 0.13 : 1;
      eyes.forEach((eye) => (eye.scale.y = blink));
    });
    for (let i = 0; i < 18; i++) {
      const t = time * 0.22 + i * 2.399;
      motePositions[i * 3] = -8 + Math.sin(t) * 2.5 + Math.cos(i * 1.7) * 2;
      motePositions[i * 3 + 2] =
        6 + Math.cos(t * 0.63) * 1.8 + Math.sin(i * 1.5) * 2;
      motePositions[i * 3 + 1] =
        groundHeight(motePositions[i * 3], motePositions[i * 3 + 2]) +
        0.6 +
        Math.sin(t * 0.71 + i) * 0.27 +
        (i % 3) * 0.22;
    }
    moteGeometry.attributes.position.needsUpdate = true;
    birds.forEach(({ root, wings, seed }) => {
      const t = time * 0.12 + seed;
      const bx = Math.cos(t) * 14,
        bz = Math.sin(t) * 9 - 1;
      root.position.set(
        bx,
        groundHeight(bx, bz) + 6.5 + Math.sin(t * 2) * 0.4,
        bz,
      );
      root.rotation.set(
        0,
        Math.atan2(-Math.sin(t) * 14, Math.cos(t) * 9),
        Math.sin(t) * 0.09,
      );
      wings[0].rotation.z = Math.sin(time * 5 + seed) * 0.3;
      wings[1].rotation.z = -wings[0].rotation.z;
    });
  }
  // Residents stand still but for a breath, so zoomed far out, where they are a
  // few pixels tall, each draws as one merged copy of its body in its resting
  // pose instead of its jointed batches. Their contact shadows stay. The copy
  // rebuilds round parts with fewer segments and leaves out the smallest (eyes,
  // buttons, spectacles), which are under a pixel there.
  const farFigures = [],
    farMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 }),
    farPartScale = new THREE.Vector3();
  function coarsePart(geometry, size) {
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
  function farFigure(figure) {
    const { body } = figure,
      parts = [],
      inverse = new THREE.Matrix4();
    body.updateWorldMatrix(true, true);
    inverse.copy(body.matrixWorld).invert();
    body.traverseVisible((o) => {
      if (!o.isMesh || o.material.transparent) return;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      o.getWorldScale(farPartScale);
      const size = o.geometry.boundingSphere.radius * Math.max(farPartScale.x, farPartScale.y, farPartScale.z);
      if (size < 0.04) return;
      // Trim laid round a body is a thin ring, however wide the ring is.
      if (o.geometry.type === "LatheGeometry") {
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        const { min, max } = o.geometry.boundingBox;
        if ((max.y - min.y) * farPartScale.y < 0.09) return;
      }
      const part = coarsePart(o.geometry, size).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, o.matrixWorld));
      for (const name of Object.keys(part.attributes))
        if (!["position", "normal", "color"].includes(name)) part.deleteAttribute(name);
      if (!part.attributes.color) {
        const { r, g, b } = o.material.color,
          colors = new Float32Array(part.attributes.position.count * 3);
        for (let i = 0; i < colors.length; i += 3) colors.set([r, g, b], i);
        part.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      }
      parts.push(part);
    });
    const proxy = new THREE.Mesh(mergeGeometries(parts), farMaterial);
    parts.forEach((part) => part.dispose());
    proxy.name = `${figure.root.name} (far)`;
    proxy.castShadow = false;
    proxy.receiveShadow = true;
    proxy.matrix.copy(body.matrix);
    proxy.matrixAutoUpdate = false;
    proxy.visible = false;
    figure.root.add(proxy);
    return { body, proxy };
  }
  function showFarFigures(far) {
    for (const { body, proxy } of farFigures) {
      body.visible = !far;
      proxy.visible = far;
    }
  }
  /** Cuts a resident's far copy from its parts, then merges them. */
  function finishResident(npc) {
    farFigures.push(farFigure(npc.figure));
    batchParts(npc.group);
  }
  residents.forEach(finishResident);
  const npcs = [
    ...residents.map(({ id, name, x, z, facing, dialogue, group }) => ({
      id,
      name,
      x,
      z,
      facing,
      dialogue,
      group,
    })),
    lily,
  ];
  return {
    player,
    npcs,
    update,
    setPlayerMotion,
    /** Adds a resident who streamed in with their region (the market lane's). */
    addResident(def) {
      const npc = resident(def);
      finishResident(npc);
      showFarFigures(!castsShadows);
      residents.push(npc);
      const { figure, ...entry } = npc;
      npcs.push(entry);
      return entry;
    },
    /**
     * Turns the figures' cast shadows on or off; their contact shadows stay.
     * Zoomed far out, a figure's shadow is a few pixels for a dozen draws.
     */
    setCastShadows(on) {
      if (on !== castsShadows) showFarFigures(!on);
      if (on === castsShadows && casters?.figures === figures.length) return;
      if (casters?.figures !== figures.length) {
        // Residents stream in later; gather every caster again when they do.
        casters = { figures: figures.length, meshes: [] };
        for (const root of figures)
          root.traverse((o) => {
            if (o.isMesh && (o.castShadow || o.userData.castsShadow)) {
              o.userData.castsShadow = true;
              casters.meshes.push(o);
            }
          });
      }
      castsShadows = on;
      for (const mesh of casters.meshes) mesh.castShadow = on;
    },
    /** Shows or hides Pip's straw hat. */
    setPipHat(on) {
      pipHat.visible = on;
    },
  };
}
