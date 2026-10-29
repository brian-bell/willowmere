// The village walkers and Cinnamon share the same face, coat details, and
// articulated ears. All dimensions are in the game's world units.
export function createCat(THREE, colors, material, sleeping = false) {
  const root = new THREE.Group();
  const sphereGeometry = new THREE.SphereGeometry(1, 12, 9);
  const coneGeometry = new THREE.ConeGeometry(1, 1, 3);
  const fur = colors.fur;
  const stripe = colors.stripe;
  const cream = colors.cream;
  const pink = colors.pink ?? 0xb77e79;
  const dark = 0x403a32;
  const part = (parent, color, x, y, z, sx, sy, sz = sx) => {
    const mesh = new THREE.Mesh(sphereGeometry, material(color));
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const line = (parent, color, points, radius) => {
    const curve = new THREE.CatmullRomCurve3(
      points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    );
    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, Math.max(5, points.length * 3), radius, 5, false),
      material(color),
    );
    mesh.castShadow = false;
    parent.add(mesh);
    return mesh;
  };
  const ears = [];
  const eyes = [];
  function makeHead(parent, x, y, z, closed) {
    const head = new THREE.Group();
    head.position.set(x, y, z);
    parent.add(head);
    part(head, fur, 0, 0, 0, 0.19, 0.175, 0.17);
    // Broad cheeks and a short muzzle give the face a feline silhouette.
    for (const side of [-1, 1]) {
      part(head, fur, side * 0.13, -0.075, 0.07, 0.07, 0.07, 0.085);
      part(head, cream, side * 0.051, -0.085, 0.155, 0.07, 0.052, 0.055);
      const ear = new THREE.Group();
      ear.position.set(side * 0.125, 0.148, -0.025);
      ear.rotation.z = -side * 0.16;
      head.add(ear);
      const outer = new THREE.Mesh(coneGeometry, material(fur));
      outer.position.y = 0.048;
      outer.scale.set(0.092, 0.17, 0.077);
      outer.castShadow = true;
      ear.add(outer);
      const inner = new THREE.Mesh(coneGeometry, material(pink));
      inner.position.set(0, 0.046, 0.045);
      inner.scale.set(0.055, 0.112, 0.022);
      ear.add(inner);
      ears.push(ear);
      if (closed) {
        line(
          head,
          stripe,
          [
            [side * 0.043, 0.015, 0.154],
            [side * 0.079, -0.004, 0.17],
            [side * 0.123, 0.014, 0.141],
          ],
          0.006,
        );
      } else {
        const eye = new THREE.Group();
        eye.position.set(side * 0.083, 0.014, 0.147);
        eye.rotation.y = side * 0.23;
        head.add(eye);
        part(eye, stripe, 0, 0, 0, 0.041, 0.046, 0.016);
        part(eye, colors.eye, 0, 0, 0.013, 0.032, 0.039, 0.013);
        part(eye, dark, 0, 0, 0.025, 0.008, 0.032, 0.007);
        part(eye, 0xfff6dc, -0.01, 0.013, 0.031, 0.007, 0.009, 0.005);
        eyes.push(eye);
      }
      // A few fine, swept-back whiskers remain legible in the bakery close-up.
      for (let i = 0; i < 3; i++)
        line(
          head,
          cream,
          [
            [side * 0.104, -0.091 + i * 0.015, 0.182],
            [side * 0.207, -0.09 + i * 0.037, 0.183],
            [side * 0.29, -0.117 + i * 0.052, 0.163],
          ],
          0.0035,
        );
      line(
        head,
        stripe,
        [
          [side * 0.025, 0.133, 0.137],
          [side * 0.043, 0.092, 0.165],
          [side * 0.05, 0.067, 0.175],
        ],
        0.009,
      );
    }
    const nose = new THREE.Mesh(coneGeometry, material(pink));
    nose.position.set(0, -0.065, 0.211);
    nose.rotation.z = Math.PI;
    nose.scale.set(0.03, 0.028, 0.016);
    head.add(nose);
    line(head, dark, [[0, -0.08, 0.211], [0, -0.115, 0.205]], 0.0035);
    for (const side of [-1, 1])
      line(
        head,
        dark,
        [[0, -0.115, 0.205], [side * 0.025, -0.131, 0.196]],
        0.0035,
      );
    return head;
  }

  if (sleeping) {
    const torso = new THREE.Group();
    root.add(torso);
    part(torso, fur, -0.03, 0.22, -0.04, 0.37, 0.21, 0.49);
    part(torso, fur, -0.13, 0.23, -0.24, 0.28, 0.205, 0.29);
    part(torso, cream, 0.19, 0.13, 0.21, 0.17, 0.09, 0.2);
    // Soft tabby stripes follow the curvature of the curled back.
    for (let i = 0; i < 4; i++) {
      const mark = part(
        torso,
        stripe,
        -0.29 + i * 0.12,
        0.413 + Math.sin(i * 0.8) * 0.008,
        -0.24 + i * 0.12,
        0.028,
        0.012,
        0.11,
      );
      mark.rotation.y = -0.6;
    }
    const head = makeHead(root, 0.16, 0.34, 0.32, true);
    head.rotation.z = -0.16;
    part(root, cream, 0.02, 0.105, 0.39, 0.11, 0.052, 0.09);
    part(root, cream, 0.2, 0.104, 0.43, 0.1, 0.05, 0.08);
    line(
      root,
      fur,
      [
        [-0.25, 0.25, -0.37],
        [-0.43, 0.2, -0.28],
        [-0.47, 0.15, -0.03],
        [-0.4, 0.13, 0.25],
      ],
      0.072,
    );
    const tailTip = new THREE.Group();
    tailTip.position.set(-0.4, 0.13, 0.25);
    root.add(tailTip);
    line(
      tailTip,
      stripe,
      [[0, 0, 0], [0.11, -0.012, 0.13], [0.28, 0.004, 0.12]],
      0.059,
    );
    part(tailTip, stripe, 0.28, 0.004, 0.12, 0.059, 0.058, 0.058);
    return { root, torso, head, ears, eyes, tailTip, legs: [] };
  }

  const body = new THREE.Group();
  root.add(body);
  const torso = new THREE.Group();
  torso.position.set(0, 0.36, -0.055);
  body.add(torso);
  part(torso, fur, 0, 0, -0.025, 0.205, 0.165, 0.35);
  part(torso, fur, 0, 0.015, -0.25, 0.205, 0.17, 0.19);
  part(torso, fur, 0, 0.015, 0.225, 0.185, 0.18, 0.18);
  part(torso, cream, 0, -0.065, 0.333, 0.13, 0.12, 0.07);
  part(torso, stripe, 0, 0.158, -0.06, 0.064, 0.014, 0.28);
  for (const side of [-1, 1])
    for (let i = 0; i < 3; i++) {
      const mark = part(
        torso,
        stripe,
        side * (0.188 - i * 0.006),
        0.045,
        -0.25 + i * 0.2,
        0.018,
        0.075,
        0.045,
      );
      mark.rotation.z = side * 0.35;
      mark.rotation.x = -0.27;
    }
  const head = makeHead(body, 0, 0.56, 0.36, false);
  const legs = [];
  for (const hind of [true, false])
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.name = `${hind ? "Hind" : "Front"} ${side < 0 ? "left" : "right"} leg`;
      leg.position.set(side * 0.15, hind ? 0.355 : 0.33, hind ? -0.28 : 0.255);
      body.add(leg);
      part(leg, fur, 0, -0.07, 0, hind ? 0.093 : 0.067, hind ? 0.15 : 0.14, 0.075);
      part(leg, fur, 0, -0.205, hind ? 0.015 : 0.005, 0.052, 0.12, 0.051);
      const paw = new THREE.Group();
      paw.position.set(0, hind ? -0.31 : -0.285, 0.045);
      leg.add(paw);
      part(paw, cream, 0, 0, 0.018, 0.078, 0.041, 0.105);
      for (const toe of [-1, 0, 1])
        part(paw, cream, toe * 0.041, -0.006, 0.093, 0.029, 0.029, 0.038);
      legs.push({ leg, paw, hind, side });
    }
  const tail = new THREE.Group();
  tail.position.set(0, 0.39, -0.36);
  body.add(tail);
  line(
    tail,
    fur,
    [[0, 0, 0], [0, 0.055, -0.16], [0, 0.22, -0.25], [0, 0.39, -0.23]],
    0.054,
  );
  const tailTip = new THREE.Group();
  tailTip.position.set(0, 0.39, -0.23);
  tail.add(tailTip);
  line(
    tailTip,
    stripe,
    [[0, 0, 0], [0, 0.1, 0.025], [0, 0.15, 0.11]],
    0.047,
  );
  part(tailTip, stripe, 0, 0.15, 0.11, 0.047, 0.05, 0.047);
  return { root, body, torso, head, ears, eyes, legs, tail, tailTip };
}
