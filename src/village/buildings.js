// The village's buildings: roofs, window boxes, doorstep pots and wall beds,
// the cottages, the bakery with its flour store and display, and the mill
// with its hoist and turning wheel.

import { createPlanters } from "../planters.js";
import { MILL } from "../mill/layout.js";
import { millWheel } from "../mill/wheel.js";

export function buildBuildings(kit, { contact }) {
  const {
    ivory,
    T,
    mesh,
    roofBlue,
    mat,
    box,
    rand,
    scene,
    darkWood,
    glass,
    trim,
    wood,
    stone,
    beam,
    cyl,
    orb,
    animate,
    colliders,
    label,
    interactables,
    roofRust,
  } = kit;
  const roofVariants = new Map();
  function roof(x, z, w, d, base, height, ma, p) {
    if (ma === ivory) {
      const shape = new T.Shape();
      shape.moveTo(-w / 2, 0);
      shape.lineTo(0, height);
      shape.lineTo(w / 2, 0);
      shape.closePath();
      return mesh(
        new T.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false }),
        ma,
        x,
        base,
        z - d / 2,
        1,
        1,
        1,
        p,
      );
    }
    const slope = Math.atan2(height, w / 2),
      length = Math.hypot(height, w / 2);
    if (!roofVariants.has(ma)) {
      const c = ma === roofBlue ? "#78949b" : "#b77e61";
      roofVariants.set(
        ma,
        [-0.025, 0, 0.02, 0.04].map((v) => {
          const m = mat(c).clone();
          m.color.offsetHSL(0, 0, v);
          return m;
        }),
      );
    }
    const variants = roofVariants.get(ma),
      rows = Math.max(2, Math.ceil(length / 0.29)),
      cols = Math.max(2, Math.ceil(d / 0.44));
    for (let side of [-1, 1]) {
      const slab = box(
        ma,
        x + (side * w) / 4,
        base + height / 2,
        z,
        length + 0.04,
        0.1,
        d,
        p,
      );
      slab.rotation.z = -side * slope;
      for (let row = 0; row < rows; row++) {
        const f = (row + 0.5) / rows;
        for (let col = 0; col < cols; col++) {
          const zz = z - d / 2 + ((col + 0.5) * d) / cols;
          const tile = box(
            variants[rand() < 0.65 ? 1 : Math.floor(rand() * 4)],
            x + (side * f * w) / 2,
            base + height * (1 - f) + 0.074,
            zz,
            length / rows + 0.045,
            0.055,
            d / cols - 0.012,
            p,
          );
          tile.rotation.z = -side * slope;
        }
      }
    }
  }
  const flowerMats = ["#e4c471", "#e4a38f", "#d9d4b4", "#a49bbe"].map((c) =>
    mat(c),
  );
  // Each building keeps its own planting scheme: doorstep pots, window boxes
  // and the beds along its walls. All of it shares one vertex-colored draw.
  const planters = createPlanters();
  const { blooms, foliage, recipes } = planters;
  const plantings = {
    home: {
      pots: [
        ["geranium", blooms.rose],
        ["lavender", blooms.lavender],
      ],
      glaze: "#b4725a",
      box: [
        ["geranium", blooms.rose],
        ["daisies", blooms.white],
        ["geranium", blooms.blush],
      ],
      wall: ["spires", blooms.rose],
      bed: ["lavender", blooms.lavender],
      side: [0.05, 1.75], // The woodpile stands further back.
    },
    bakery: {
      pots: [["topiary"], ["topiary"]],
      glaze: "#8f8a7c",
      box: [
        ["geranium", blooms.scarlet],
        ["daisies", blooms.white],
        ["geranium", blooms.scarlet],
      ],
      wall: ["spires", blooms.butter],
      bed: ["daisies", blooms.butter],
    },
    mill: {
      pots: [
        ["lavender", blooms.lilac],
        ["daisies", blooms.white],
      ],
      glaze: "#a9765c",
      box: [
        ["daisies", blooms.sky],
        ["lavender", blooms.lavender],
        ["geranium", blooms.lilac],
      ],
      wall: ["spires", blooms.lilac],
      bed: ["daisies", blooms.white],
      side: [-1.75, 0.65], // Clear of the water barrel by the door.
    },
    thistledown: {
      pots: [
        ["geranium", blooms.coral],
        ["daisies", blooms.marigold],
      ],
      glaze: "#b8795a",
      box: [
        ["geranium", blooms.coral],
        ["daisies", blooms.butter],
        ["geranium", blooms.coral],
      ],
      wall: ["spires", blooms.blush],
      bed: ["daisies", blooms.marigold],
      side: [-1.35, 1.35],
    },
  };
  function plant([recipe, bloom], x, y, z, r, ...rest) {
    recipes[recipe](x, y, z, r, bloom, ...rest);
  }
  function pot(x, z, s, scheme, choice, p = scene) {
    const soilY = planters.pot(x, 0.02, z, s, scheme.glaze);
    plant(
      choice,
      x,
      soilY - 0.02,
      z,
      s * (choice[0] === "topiary" ? 0.42 : 0.5),
    );
    if (choice[0] !== "topiary")
      for (let i = 0; i < 3; i++) {
        const a = Math.PI * (0.15 + i * 0.35);
        planters.trail(
          x + Math.cos(a) * s * 0.46,
          soilY,
          z + Math.sin(a) * s * 0.46,
          s * 0.45,
          foliage.ivy,
          Math.cos(a),
          Math.sin(a),
        );
      }
    planters.flush(p);
  }
  // A strip bed against a wall, running along local X. Spires stand at the
  // back, kept short beneath window boxes so they never grow through them.
  function wallBed(scheme, x, z, length, p, windows = []) {
    const depth = 0.46;
    planters.bed(x, z, length, depth);
    const spires = Math.max(1, Math.round(length / 0.6));
    for (let i = 0; i < spires; i++) {
      const sx = x - length / 2 + ((i + 0.5) / spires) * length;
      const under = windows.some(([c, half]) => Math.abs(sx - c) < half);
      plant(
        scheme.wall,
        sx,
        0.12,
        z - depth * 0.22,
        0.22,
        under ? planters.range(0.62, 0.78) : planters.range(1.05, 1.4),
      );
    }
    const fronts = Math.max(1, Math.round(length / 0.42));
    for (let i = 0; i < fronts; i++)
      plant(
        i % 2 ? ["geranium", scheme.box[0][1]] : scheme.bed,
        x - length / 2 + ((i + 0.5) / fronts) * length,
        0.12,
        z + depth * 0.18,
        planters.range(0.17, 0.22),
      );
    planters.flush(p);
  }
  function windowAt(x, y, z, w = 0.8, h = 1.1, p = scene, scheme = null) {
    box(darkWood, x, y, z, w + 0.19, h + 0.19, 0.11, p);
    box(glass, x, y, z + 0.07, w, h, 0.03, p);
    box(trim, x, y, z + 0.095, 0.075, h + 0.1, 0.07, p);
    box(trim, x, y + 0.04, z + 0.1, w + 0.1, 0.065, 0.07, p);
    box(trim, x, y - h / 2 - 0.1, z + 0.16, w + 0.34, 0.12, 0.37, p);
    if (h > 0.8 && scheme) {
      box(wood, x, y - h / 2 - 0.2, z + 0.24, w + 0.16, 0.2, 0.3, p);
      box(darkWood, x, y - h / 2 - 0.105, z + 0.395, w + 0.2, 0.035, 0.035, p);
      const top = y - h / 2 - 0.1;
      for (let j = 0; j < 4; j++)
        plant(
          scheme.box[j % 3],
          x - w * 0.39 + j * w * 0.26,
          top,
          z + 0.25 + (j % 2) * 0.03,
          0.14,
        );
      for (let j = 0; j < 4; j++)
        planters.trail(
          x - w * 0.42 + j * w * 0.28 + planters.range(-0.04, 0.04),
          top + 0.02,
          z + 0.36,
          planters.range(0.22, 0.42),
          foliage.ivy,
        );
      planters.flush(p);
    }
    for (let side of [-1, 1]) {
      box(wood, x + side * (w / 2 + 0.22), y, z, 0.27, h + 0.16, 0.09, p);
      for (let yy = -2; yy <= 2; yy++)
        box(
          darkWood,
          x + side * (w / 2 + 0.22),
          y + yy * 0.17,
          z + 0.055,
          0.24,
          0.025,
          0.035,
          p,
        );
    }
  }
  function house(x, z, w, d, h, ro, sign, id) {
    contact(x, z, w + 2, d + 2);
    const p = new T.Group();
    p.position.set(x, 0, z);
    scene.add(p);
    box(stone, 0, 0.22, 0, w + 0.16, 0.42, d + 0.12, p);
    box(ivory, 0, h / 2 + 0.4, 0, w, h, d, p);
    roof(0, 0, w + 0.8, d + 0.8, h + 0.4, h * 0.69, ro, p);
    roof(0, d / 2 + 0.015, w, 0.055, h + 0.4, h * 0.69, ivory, p);
    for (let side of [-1, 1])
      beam(
        darkWood,
        [side * (w / 2 + 0.12), h + 0.42, d / 2 + 0.11],
        [0, h * 1.69 + 0.45, d / 2 + 0.11],
        0.15,
        p,
      );
    box(darkWood, 0, h + 0.42, d / 2 + 0.05, w + 0.3, 0.18, 0.19, p);
    box(darkWood, 0, h + 1.05, d / 2 + 0.1, 0.14, 1.3, 0.14, p);
    for (let xx of [-w / 2 + 0.07, w / 2 - 0.07])
      box(darkWood, xx, h / 2 + 0.4, d / 2 + 0.035, 0.15, h, 0.15, p);
    box(darkWood, 0, 0.62, d / 2 + 0.04, w, 0.16, 0.13, p);
    // Individual weatherboard fascia and roof ridge tiles.
    for (let zz = -d / 2 - 0.35; zz < d / 2 + 0.4; zz += 0.34)
      cyl(ro, 0, h * 1.69 + 0.43, zz, 0.11, 0.35, p).rotation.x = Math.PI / 2;
    // Stone chimney, brick offsets and copper cap. Rosewood's stands over its
    // living-room fireplace, on the west side.
    const cx = (id === "home" ? -1 : 1) * w * 0.28,
      cz = -d * 0.16,
      cy = h * 1.69;
    box(mat("#9d8973"), cx, cy, cz, 0.65, 1.8, 0.62, p);
    for (let yy = -3; yy < 4; yy++) {
      box(wood, cx, cy + yy * 0.22, cz + 0.316, 0.66, 0.027, 0.017, p);
      box(
        wood,
        cx + (yy % 2 ? 0.12 : -0.13),
        cy + yy * 0.22 + 0.1,
        cz + 0.32,
        0.02,
        0.2,
        0.017,
        p,
      );
    }
    box(stone, cx, cy + 0.93, cz, 0.83, 0.15, 0.79, p);
    for (let i = 0; i < 4; i++) {
      const puff = orb(
        new T.MeshStandardMaterial({
          color: "#d4d3be",
          transparent: true,
          opacity: 0.17 - i * 0.022,
          depthWrite: false,
        }),
        x + cx + i * 0.12,
        cy + 1.35 + i * 0.47,
        z + cz,
        0.26 + i * 0.12,
        0.4 + i * 0.12,
        0.26 + i * 0.12,
      );
      animate(x + cx, z + cz, (dt, t) => {
        puff.position.x = x + cx + i * 0.12 + Math.sin(t * 0.45 + i) * 0.14;
        puff.position.y = cy + 1.35 + i * 0.47 + Math.sin(t * 0.6 + i) * 0.09;
      });
    }
    const dz = d / 2 + 0.13;
    box(darkWood, 0, 1.25, dz, 0.97, 1.8, 0.1, p);
    box(wood, 0, 1.22, dz + 0.075, 0.79, 1.64, 0.08, p);
    for (let xx = -0.3; xx <= 0.3; xx += 0.15)
      box(darkWood, xx, 1.2, dz + 0.123, 0.015, 1.58, 0.013, p);
    box(glass, 0, 1.62, dz + 0.13, 0.49, 0.44, 0.016, p);
    orb(mat("#d0b067"), 0.25, 1.1, dz + 0.16, 0.05, 0.05, 0.05, p);
    box(stone, 0, 0.2, dz + 0.45, 1.5, 0.25, 0.7, p);
    box(stone, 0, 0.12, dz + 0.84, 1.75, 0.12, 0.3, p);
    const scheme = plantings[id];
    windowAt(-w * 0.3, 1.9, dz, 0.76, 1, p, scheme);
    windowAt(w * 0.3, 1.9, dz, 0.76, 1, p, scheme);
    windowAt(0, h + 0.94, dz, 0.67, 0.65, p);
    // The mill looks onto its wheel from a small west window, where the room
    // inside has it (src/mill/layout.js).
    if (id === "mill") {
      const west = new T.Group();
      west.position.set(-w / 2 - 0.05, 0, (MILL.westWindow.z[0] + MILL.westWindow.z[1]) / 2 / MILL.scale);
      west.rotation.y = -Math.PI / 2;
      p.add(west);
      windowAt(0, 1.8, 0, (MILL.westWindow.z[1] - MILL.westWindow.z[0]) / MILL.scale, 0.8, west);
    }
    // Right wall window visible to camera.
    const win = new T.Group();
    win.position.set(w / 2 + 0.05, 0, 0);
    win.rotation.y = Math.PI / 2;
    p.add(win);
    windowAt(0, 1.8, 0, 0.9, 1, win, scheme);
    // Pots flank the doorstep; beds fill the wall on either side of them.
    pot(-1.22, dz + 0.72, 0.62, scheme, scheme.pots[0], p);
    pot(1.22, dz + 0.68, 0.58, scheme, scheme.pots[1], p);
    // Narrow fronts leave the lawn running up to the wall instead.
    const bedLength = w / 2 - 1.62;
    if (bedLength > 0.5)
      for (const side of [-1, 1]) {
        wallBed(
          scheme,
          side * (w / 2 - bedLength / 2),
          dz + 0.2,
          bedLength,
          p,
          [
            [-w * 0.3, 0.62],
            [w * 0.3, 0.62],
          ],
        );
        colliders.push({
          x: x + side * (w / 2 - bedLength / 2),
          z: z + dz + 0.2,
          w: bedLength,
          d: 0.46,
        });
      }
    colliders.push(
      { x: x - 1.22, z: z + dz + 0.72, r: 0.3 },
      { x: x + 1.22, z: z + dz + 0.68, r: 0.28 },
    );
    if (scheme.side) {
      const [from, to] = scheme.side,
        length = to - from,
        mid = (from + to) / 2;
      const sideBed = new T.Group();
      sideBed.position.set(w / 2 + 0.31, 0, mid);
      sideBed.rotation.y = Math.PI / 2;
      p.add(sideBed);
      wallBed(scheme, 0, 0, length, sideBed, [[mid, 0.75]]);
      colliders.push({ x: x + w / 2 + 0.31, z: z + mid, w: 0.46, d: length });
    }
    box(darkWood, 0, 2.66, dz + 0.12, 2, 0.12, 0.12, p);
    box(label(sign), 0, 2.67, dz + 0.205, 1.78, 0.46, 0.07, p);
    // The B&B says so, on a board hung from its canopy.
    if (id === "thistledown") {
      for (const xx of [-0.4, 0.4]) box(darkWood, xx, 2.0, d / 2 + 1.04, 0.02, 0.2, 0.02, p);
      box(darkWood, 0, 1.82, d / 2 + 1.04, 1.24, 0.27, 0.05, p);
      box(label("BED & BREAKFAST", "#5b3a2c", 44), 0, 1.82, d / 2 + 1.07, 1.14, 0.2, 0.02, p);
    }
    // Entrance canopy, supported on carved posts.
    roof(0, d / 2 + 0.62, 1.85, 1.05, 2.15, 0.35, ro, p);
    for (let xx of [-0.77, 0.77]) {
      box(wood, xx, 1.22, d / 2 + 1.02, 0.09, 1.85, 0.09, p);
      beam(
        wood,
        [xx, 2.1, d / 2 + 1.02],
        [xx * 0.5, 2.1, d / 2 + 0.65],
        0.07,
        p,
      );
    }
    colliders.push({ x, z, w: w + 0.15, d: d + 0.2 });
    interactables.push({
      id,
      name: sign,
      type: id,
      x,
      z: z + d / 2 + 1.1,
      radius: 2,
    });
    return p;
  }
  house(-7, -6, 5.5, 4.3, 3.25, roofBlue, "ROSEWOOD", "home");
  house(1.2, -8.4, 4.8, 4.2, 3, roofRust, "THE DAILY LOAF", "bakery");
  house(17, -7, 4.4, 4.4, 3.5, roofBlue, "WILLOW MILL", "mill");
  house(-15, -3, 4, 3.6, 2.7, roofRust, "THISTLEDOWN", "thistledown");
  // Bakery's flour store has a lower shed roof and working delivery hatch.
  box(stone, 4.33, 0.18, -8.2, 1.6, 0.3, 3.15);
  box(ivory, 4.3, 1.13, -8.2, 1.6, 1.85, 3.1);
  const shed = box(roofRust, 4.32, 2.34, -8.2, 2.05, 0.15, 3.65);
  shed.rotation.z = -0.27;
  box(darkWood, 5.12, 1.22, -8.1, 0.08, 1.35, 1.3);
  for (let i = 0; i < 7; i++)
    box(wood, 5.18, 1.22, -8.68 + i * 0.19, 0.075, 1.3, 0.17);
  box(darkWood, 5.23, 1.22, -8.1, 0.08, 0.09, 1.35);
  colliders.push({ x: 4.4, z: -8.2, w: 1.8, d: 3.3 });
  contact(4.4, -8.2, 3, 4);
  // A gabled mill hoist rises above the wheel, with suspended flour sacks below.
  const hoist = new T.Group();
  hoist.position.set(15.4, 0, -5.6);
  scene.add(hoist);
  box(ivory, 0, 4.55, 0, 1.5, 1.8, 1.8, hoist);
  roof(0, 0, 1.83, 2.03, 5.45, 0.73, roofBlue, hoist);
  roof(0, 0.91, 1.5, 0.03, 5.45, 0.73, ivory, hoist);
  box(darkWood, 0, 4.65, 0.94, 0.8, 1.14, 0.06, hoist);
  box(wood, 0, 5.25, 1.38, 0.12, 0.14, 1.1, hoist);
  beam(darkWood, [0, 5.26, 1.8], [0, 3.22, 1.8], 0.025, hoist);
  orb(mat("#c0ae82"), 0, 2.99, 1.8, 0.28, 0.36, 0.22, hoist);
  for (let x of [-0.66, 0.66])
    box(darkWood, x, 4.6, 0.94, 0.1, 1.62, 0.1, hoist);
  // Bakery outdoor display with striped awning, crates and small loaves.
  box(wood, 3.9, 0.65, -4.4, 2.5, 0.85, 0.9);
  for (let i = 0; i < 7; i++)
    orb(mat("#c89b56"), 3.1 + i * 0.24, 1.16, -4.4, 0.18, 0.12, 0.11);
  for (let i = 0; i < 6; i++) {
    const aw = box(
      i % 2 ? trim : mat("#a66b52"),
      2.85 + i * 0.43,
      2.35,
      -4.3,
      0.43,
      0.08,
      1.35,
    );
    aw.rotation.x = 0.13;
  }
  for (let x of [2.7, 5.1]) box(wood, x, 1.2, -3.72, 0.07, 2.3, 0.07);
  // Working mill wheel, clean concentric rings and wooden paddles.
  const wheel = new T.Group();
  wheel.name = "Mill wheel";
  wheel.userData.dynamic = true;
  wheel.position.set(14.12, 1.43, -6.5);
  scene.add(wheel);
  wheel.rotation.z = Math.PI / 2;
  const torG = new T.TorusGeometry(1.38, 0.105, 6, 32);
  for (let y of [-0.35, 0.35]) {
    const ring = mesh(torG, darkWood, 0, y, 0, 1, 1, 1, wheel);
    ring.rotation.x = Math.PI / 2;
  }
  for (let i = 0; i < 12; i++) {
    let a = (i * Math.PI) / 6;
    const padd = box(
      wood,
      Math.cos(a) * 1.37,
      0,
      Math.sin(a) * 1.37,
      0.38,
      0.88,
      0.21,
      wheel,
    );
    padd.rotation.y = -a;
    beam(
      darkWood,
      [0, 0, 0],
      [Math.cos(a) * 1.35, 0, Math.sin(a) * 1.35],
      0.1,
      wheel,
    );
  }
  cyl(darkWood, 0, 0, 0, 0.18, 1.2, wheel);
  // Turn around the local axle after the wheel has been mounted vertically.
  // The wheel is shared with the mill's inside (src/mill/wheel.js): the sluice
  // lever in there stills it out here. Out of view it simply waits.
  const wheelMount = wheel.quaternion.clone(),
    wheelTurn = new T.Quaternion(),
    wheelAxle = new T.Vector3(0, 1, 0);
  animate(wheel.position.x, wheel.position.z, (dt) => {
    millWheel.step(dt);
    wheel.quaternion
      .copy(wheelMount)
      .multiply(wheelTurn.setFromAxisAngle(wheelAxle, millWheel.turn));
  });
  return { flowerMats };
}
