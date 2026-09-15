/** Hand-built inhabitants and wildlife. Coordinates are in the village's X/Z plane. */
export function createLife(THREE, scene) {
  const materials = new Map();
  const mat = (color, roughness = 0.86) => {
    const key = `${color}:${roughness}`;
    if (!materials.has(key))
      materials.set(key, new THREE.MeshStandardMaterial({ color, roughness }));
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
  function person({
    coat,
    skin = 0xe9b38e,
    hair = 0x5b3930,
    hat = true,
    pack = false,
    apron = false,
    flowers = false,
    size = 1,
  }) {
    const root = new THREE.Group(),
      body = new THREE.Group();
    if (apron) body.scale.x = 1.09;
    root.add(body);
    root.scale.setScalar(size);
    shadow(root, 0.4, 0.25);
    const hips = new THREE.Group();
    hips.position.y = 0.58;
    body.add(hips);
    const legs = [],
      arms = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.115, 0, 0);
      hips.add(leg);
      m(leg, "cylinder", 0x4e5b59, 0, -0.19, 0, 0.073, 0.36, 0.08);
      m(leg, "cylinder", 0x634a38, 0, -0.385, 0.01, 0.078, 0.14, 0.089);
      sphere(leg, 0x543f34, 0, -0.44, 0.045, 0.085, 0.085, 0.15);
      m(leg, "box", 0x382f28, 0, -0.491, 0.045, 0.17, 0.032, 0.265);
      legs.push(leg);
    }
    const coatGeo = new THREE.CylinderGeometry(0.19, 0.255, 0.54, 14);
    const torso = new THREE.Mesh(coatGeo, mat(coat));
    torso.position.y = 0.87;
    torso.castShadow = true;
    body.add(torso);
    sphere(body, coat, 0, 1.08, 0, 0.226, 0.145, 0.165);
    // Folded collar, central seam, and small wooden buttons are readable at close zoom.
    const collarLeft = m(
      body,
      "box",
      0xe9d9b7,
      -0.075,
      1.105,
      0.158,
      0.092,
      0.11,
      0.029,
    );
    collarLeft.rotation.z = -0.4;
    const collarRight = m(
      body,
      "box",
      0xe9d9b7,
      0.075,
      1.105,
      0.158,
      0.092,
      0.11,
      0.029,
    );
    collarRight.rotation.z = 0.4;
    m(body, "box", 0x735344, 0, 0.86, 0.216, 0.012, 0.37, 0.016);
    for (let i = 0; i < (apron ? 0 : 3); i++)
      sphere(body, 0xddbf80, 0.03, 0.96 - i * 0.115, 0.23, 0.018, 0.018, 0.013);
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.245, 1.055, 0);
      body.add(arm);
      sphere(arm, coat, side * 0.018, -0.125, 0, 0.079, 0.185, 0.085);
      m(
        arm,
        "cylinder",
        0xdcc8a5,
        side * 0.024,
        -0.259,
        0.003,
        0.07,
        0.052,
        0.072,
      );
      sphere(arm, skin, side * 0.024, -0.3, 0.01, 0.068, 0.078, 0.065);
      arms.push(arm);
    }
    m(body, "cylinder", skin, 0, 1.165, 0, 0.072, 0.14, 0.078);
    // Rounded sculptural face with the features deliberately clear of the hair cap.
    sphere(body, skin, 0, 1.345, 0.008, 0.184, 0.208, 0.171);
    sphere(body, hair, 0, 1.392, -0.049, 0.196, 0.196, 0.151);
    for (const side of [-1, 1]) {
      sphere(body, skin, side * 0.173, 1.333, 0.022, 0.036, 0.057, 0.04);
      sphere(body, 0x302f2a, side * 0.065, 1.352, 0.163, 0.019, 0.025, 0.012);
      sphere(body, 0xd9957c, side * 0.099, 1.301, 0.149, 0.035, 0.018, 0.014);
      sphere(body, hair, side * 0.15, 1.427, 0.058, 0.062, 0.105, 0.091);
    }
    sphere(body, skin, 0, 1.313, 0.18, 0.027, 0.03, 0.031);
    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(0.026, 0.005, 4, 8, Math.PI),
      mat(0x9e6553),
    );
    smile.rotation.z = Math.PI;
    smile.position.set(0, 1.28, 0.164);
    body.add(smile);
    if (hat) {
      m(body, "cylinder", 0xf1dfab, 0, 1.51, -0.015, 0.313, 0.043, 0.255);
      const crown = new THREE.Mesh(
        new THREE.CylinderGeometry(0.153, 0.193, 0.19, 18),
        mat(0xe7d29b),
      );
      crown.position.set(0, 1.616, -0.02);
      crown.castShadow = true;
      body.add(crown);
      m(
        body,
        "cylinder",
        pack ? 0x365c62 : 0x7e6654,
        0,
        1.555,
        -0.02,
        0.191,
        0.035,
        0.191,
      );
      sphere(
        body,
        pack ? 0x365c62 : 0xa46552,
        -0.185,
        1.565,
        0.045,
        0.053,
        0.036,
        0.024,
      );
      sphere(
        body,
        pack ? 0x365c62 : 0xa46552,
        -0.187,
        1.565,
        -0.013,
        0.053,
        0.036,
        0.024,
      );
    } else if (apron) {
      m(body, "cylinder", 0xf4ebd7, 0, 1.5, -0.012, 0.197, 0.068, 0.192);
      sphere(body, 0xf5ecd9, 0, 1.575, -0.015, 0.213, 0.125, 0.183);
    } else {
      sphere(body, hair, 0, 1.54, -0.033, 0.148, 0.078, 0.122);
    }
    let scarf = null;
    if (pack) {
      // The traveler’s deep teal scarf and hat band remain distinct at village zoom.
      m(body, "cylinder", 0x406d70, 0, 1.173, 0.012, 0.105, 0.061, 0.107);
      scarf = new THREE.Group();
      scarf.position.set(-0.085, 1.15, 0.175);
      body.add(scarf);
      const scarfTail = m(
        scarf,
        "box",
        0x406d70,
        -0.018,
        -0.105,
        0.018,
        0.078,
        0.235,
        0.028,
      );
      scarfTail.rotation.z = -0.13;
      m(scarf, "box", 0xd6b472, -0.031, -0.209, 0.035, 0.071, 0.017, 0.008);
      sphere(body, 0x766645, 0, 0.943, -0.235, 0.18, 0.23, 0.105);
      m(body, "box", 0xa79060, 0, 1.06, -0.315, 0.285, 0.07, 0.035);
      m(body, "box", 0xcbb482, 0, 0.906, -0.342, 0.18, 0.14, 0.025);
      m(body, "box", 0x604b35, 0, 1.017, -0.35, 0.04, 0.12, 0.023);
      for (const s of [-1, 1]) {
        const strap = m(
          body,
          "box",
          0x806f49,
          s * 0.151,
          0.973,
          0.172,
          0.036,
          0.255,
          0.026,
        );
        strap.rotation.z = s * 0.1;
      }
      const roll = m(
        body,
        "cylinder",
        0x9caa89,
        0,
        1.162,
        -0.245,
        0.078,
        0.38,
        0.078,
      );
      roll.rotation.z = Math.PI / 2;
    }
    if (apron) {
      m(body, "box", 0xeaddbd, 0, 0.813, 0.245, 0.29, 0.38, 0.022);
      m(body, "box", 0xf5e6c9, 0, 0.987, 0.227, 0.18, 0.21, 0.025);
      m(body, "box", 0xc8b68f, 0, 0.77, 0.267, 0.15, 0.1, 0.018);
    }
    if (flowers) {
      // Florist carries an arrangement wrapped in parchment.
      const bouquet = new THREE.Group();
      bouquet.position.set(-0.065, -0.28, 0.055);
      bouquet.rotation.z = -0.25;
      arms[0].add(bouquet);
      for (let i = 0; i < 6; i++) {
        const a = i * 2.4,
          x = Math.cos(a) * 0.083,
          z = Math.sin(a) * 0.065,
          y = 0.14 + (i % 3) * 0.045;
        m(
          bouquet,
          "cylinder",
          0x657f42,
          x * 0.5,
          y / 2,
          z * 0.5,
          0.012,
          y,
          0.012,
        );
        for (let p = 0; p < 5; p++)
          sphere(
            bouquet,
            i % 2 ? 0xe4ba57 : 0xd68187,
            x + Math.cos(p * 1.256) * 0.027,
            y,
            z + Math.sin(p * 1.256) * 0.027,
            0.035,
            0.022,
            0.035,
          );
        sphere(bouquet, 0xefcf72, x, y + 0.008, z, 0.019, 0.02, 0.019);
      }
    }
    const head = new THREE.Group();
    head.position.y = 1.3;
    for (const child of [...body.children]) {
      if (child.position.y >= 1.2) {
        body.remove(child);
        child.position.y -= 1.3;
        head.add(child);
      }
    }
    head.scale.setScalar(1.17);
    body.add(head);
    return {
      root,
      body,
      legs,
      arms,
      scarf,
      armPose: flowers ? [-0.48, -0.04] : apron ? [-0.14, 0.05] : [0, 0],
      seed: Math.random() * 6.28,
    };
  }
  const traveler = person({
    coat: 0xb84f35,
    hair: 0x624031,
    pack: true,
    size: 1.12,
  });
  const player = traveler.root;
  player.name = "Traveler";
  scene.add(player);
  const npcDefinitions = [
    {
      id: "mabel",
      name: "Mabel",
      x: -5,
      z: 1,
      coat: 0x81966d,
      hair: 0x79533d,
      skin: 0xe4b594,
      flowers: true,
      hat: true,
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
      apron: true,
      hat: false,
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
      hat: true,
      size: 0.96,
      dialogue: [
        "Listen — even the leaves have something to say.",
        "These beds take a little care each day. Nothing grand. Just kindness.",
        "I think the garden likes having you here.",
      ],
    },
  ];
  const residents = npcDefinitions.map((def) => {
    const figure = person(def);
    figure.root.position.set(def.x, 0, def.z);
    figure.root.rotation.y = def.id === "finn" ? 0.2 : -0.5;
    figure.root.name = def.name;
    scene.add(figure.root);
    return { ...def, group: figure.root, figure };
  });
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
    scene.add(root);
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
  const cats = [];
  [
    [-2, 6, 0xbf9867],
    [6, -2, 0x757c7a],
  ].forEach(([x, z, color], i) => {
    const root = new THREE.Group(),
      body = new THREE.Group();
    root.add(body);
    root.position.set(x, 0, z);
    root.scale.setScalar(1.15);
    shadow(root, 0.4, 0.19);
    scene.add(root);
    sphere(body, color, 0, 0.28, 0, 0.15, 0.17, 0.29);
    sphere(body, color, 0, 0.41, 0.26, 0.143, 0.14, 0.12);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(
        new THREE.ConeGeometry(0.073, 0.15, 3),
        mat(color),
      );
      ear.position.set(s * 0.095, 0.535, 0.255);
      ear.rotation.z = s * -0.2;
      body.add(ear);
      sphere(body, 0xcab584, s * 0.066, 0.432, 0.366, 0.027, 0.017, 0.01);
      sphere(body, 0x3d4637, s * 0.066, 0.432, 0.375, 0.006, 0.014, 0.006);
      for (const zz of [-0.17, 0.17])
        sphere(body, color, s * 0.1, 0.125, zz, 0.057, 0.13, 0.067);
    }
    sphere(body, 0xb78e87, 0, 0.386, 0.379, 0.019, 0.014, 0.009);
    const tail = new THREE.Group();
    tail.position.set(0, 0.33, -0.24);
    body.add(tail);
    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.04, 0.17, -0.13),
      new THREE.Vector3(0.08, 0.36, -0.13),
      new THREE.Vector3(0.11, 0.42, -0.06),
    ]);
    const tailMesh = new THREE.Mesh(
      new THREE.TubeGeometry(tailCurve, 10, 0.034, 6, false),
      mat(color),
    );
    tail.add(tailMesh);
    cats.push({ root, body, tail, x, z, seed: i * 2.4 });
  });
  const birds = [];
  for (let i = 0; i < 4; i++) {
    const root = new THREE.Group();
    scene.add(root);
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
  let velocityX = 0,
    velocityZ = 0,
    walkPhase = 0,
    walkBlend = 0,
    animationTime = 0;
  function setPlayerMotion(vx, vz) {
    velocityX = vx;
    velocityZ = vz;
  }
  function animatePerson(figure, phase, blend, time) {
    figure.body.position.y =
      Math.abs(Math.sin(phase)) * 0.052 * blend +
      Math.sin(time * 1.6 + figure.seed) * 0.008;
    figure.legs[0].rotation.x = Math.sin(phase) * 0.48 * blend;
    figure.legs[1].rotation.x = -Math.sin(phase) * 0.48 * blend;
    figure.arms[0].rotation.x =
      figure.armPose[0] -
      Math.sin(phase) * 0.32 * blend +
      Math.sin(time * 1.4 + figure.seed) * 0.025;
    figure.arms[1].rotation.x =
      figure.armPose[1] + Math.sin(phase) * 0.32 * blend;
    figure.body.rotation.z = Math.sin(phase) * 0.022 * blend;
    if (figure.scarf)
      figure.scarf.rotation.x = Math.sin(phase + 0.4) * 0.11 * blend;
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
    for (const npc of residents) {
      animatePerson(npc.figure, 0, 0, time);
      const distance = npc.group.position.distanceTo(player.position);
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
      }
    }
    butterflies.forEach(({ root, wings, x, z, seed }) => {
      const t = time * 0.55 + seed;
      root.position.set(
        x + Math.sin(t) * 0.9,
        0.9 + Math.sin(t * 1.7) * 0.32,
        z + Math.cos(t * 0.9) * 0.65,
      );
      root.rotation.set(0.2, Math.atan2(Math.cos(t), -Math.sin(t * 0.9)), 0);
      wings[0].rotation.y = Math.sin(time * 14 + seed) * 1.05;
      wings[1].rotation.y = -wings[0].rotation.y;
    });
    cats.forEach(({ root, body, tail, x, z, seed }) => {
      const t = time * 0.13 + seed;
      root.position.set(x + Math.cos(t) * 1.5, 0, z + Math.sin(t) * 0.6);
      root.rotation.y = Math.atan2(-Math.sin(t) * 1.5, Math.cos(t) * 0.6);
      body.position.y = Math.sin(time * 6 + seed) * 0.009;
      tail.rotation.z = Math.sin(time * 1.6 + seed) * 0.13;
    });
    for (let i = 0; i < 18; i++) {
      const t = time * 0.22 + i * 2.399;
      motePositions[i * 3] = -8 + Math.sin(t) * 2.5 + Math.cos(i * 1.7) * 2;
      motePositions[i * 3 + 1] =
        0.6 + Math.sin(t * 0.71 + i) * 0.27 + (i % 3) * 0.22;
      motePositions[i * 3 + 2] =
        6 + Math.cos(t * 0.63) * 1.8 + Math.sin(i * 1.5) * 2;
    }
    moteGeometry.attributes.position.needsUpdate = true;
    birds.forEach(({ root, wings, seed }) => {
      const t = time * 0.12 + seed;
      root.position.set(
        Math.cos(t) * 14,
        6.5 + Math.sin(t * 2) * 0.4,
        Math.sin(t) * 9 - 1,
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
  return {
    player,
    npcs: residents.map(({ figure, ...npc }) => npc),
    update,
    setPlayerMotion,
  };
}
