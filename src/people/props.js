// What people carry. A held prop is built in a group that stays upright whatever
// the arm is doing, its origin at the palm. Everything here is the figure's own
// geometry, merged with the arm that holds it.
import { shade } from "./kit.js";
import { COAT } from "./shapes.js";

const brass = 0xc9a65a,
  leather = 0x6a4a31;
// The arm's lengths, as src/people/index.js builds it.
export const SHOULDER_Y = 1.062,
  UPPER_ARM = 0.155,
  FOREARM = 0.125,
  PALM = 0.06;

const HELD = {
  // A florist's arrangement, wrapped in parchment and tied.
  bouquet(kit, g) {
    const paper = 0xe8d6ac;
    kit.part(g, "flare", paper, 0, 0.045, 0, 0.082, 0.21, 0.076);
    kit.part(g, "slab", shade(paper, 0.9), 0.03, 0.06, 0.066, 0.05, 0.14, 0.004, 0, 0.36, -0.14);
    kit.part(g, "tube", 0xc25c55, 0, 0.01, 0, 0.052, 0.016, 0.05);
    kit.part(g, "soft", 0xc25c55, 0.05, 0.004, 0.034, 0.022, 0.012, 0.01, 0, 0, 0.5);
    const blooms = [
      [0, 0.195, 0, 0xd68187],
      [-0.06, 0.17, 0.03, 0xe4ba57],
      [0.06, 0.175, 0.024, 0xf1e6d4],
      [-0.032, 0.17, -0.052, 0xb889b6],
      [0.04, 0.165, -0.05, 0xd68187],
      [0.002, 0.15, 0.068, 0xe4ba57],
    ];
    for (const [x, y, z, color] of blooms) {
      for (let p = 0; p < 5; p++) {
        const a = p * 1.256;
        kit.part(g, "bead", color, x + Math.cos(a) * 0.024, y, z + Math.sin(a) * 0.024, 0.023, 0.016, 0.023);
      }
      kit.part(g, "bead", 0xefcf72, x, y + 0.008, z, 0.014, 0.012, 0.014);
    }
    for (const [x, z, turn] of [[-0.074, -0.02, 0.5], [0.08, -0.012, -0.5], [0, -0.08, 0]])
      kit.part(g, "lock", 0x6d8446, x, 0.15, z, 0.012, 0.056, 0.022, 0, 0, Math.PI + turn);
  },
  // A round loaf on a folded cloth, still warm.
  loaf(kit, g) {
    kit.part(g, "slab", 0xe8dcc0, 0, 0.012, 0.02, 0.2, 0.012, 0.15);
    kit.part(g, "ball", 0xc08a4a, 0, 0.066, 0.02, 0.108, 0.064, 0.094);
    kit.part(g, "soft", 0xd8a766, 0, 0.09, 0.02, 0.086, 0.04, 0.074);
    for (const x of [-0.044, 0, 0.044])
      kit.part(g, "bead", 0xeed4a0, x, 0.122, 0.02, 0.012, 0.005, 0.05, 0.25);
  },
  // A tin watering can, its rose held forward.
  can(kit, g) {
    const tin = 0x8c9a97;
    kit.part(g, "tube", tin, 0, -0.16, 0, 0.078, 0.14, 0.072);
    kit.part(g, "tube", shade(tin, 0.78), 0, -0.095, 0, 0.082, 0.012, 0.076);
    kit.part(g, "tube", shade(tin, 0.78), 0, -0.228, 0, 0.082, 0.012, 0.076);
    kit.part(g, kit.shapes.hoop, shade(tin, 0.72), 0, -0.09, 0, 0.066, 0.1, 0.066, 0, Math.PI / 2, 0);
    kit.span(g, "peg", tin, [0, -0.2, 0.06], [0, -0.1, 0.19], 0.02);
    kit.part(g, "tube", shade(tin, 0.85), 0, -0.092, 0.2, 0.036, 0.018, 0.036, -0.65);
  },
  // Hazel's copper kettle, to which the Copper Kettle owes its name.
  kettle(kit, g) {
    const copper = 0xbf6f3e;
    kit.part(g, kit.shapes.kettle, copper, 0, -0.22, 0, 0.102, 0.135, 0.102);
    kit.part(g, kit.shapes.roll(0.096, 0.006), shade(copper, 0.72), 0, -0.2, 0);
    kit.part(g, "bead", 0x3d2b23, 0, -0.078, 0, 0.018, 0.016, 0.018);
    kit.span(g, "peg", copper, [0, -0.18, 0.08], [0, -0.11, 0.165], 0.022);
    kit.part(g, kit.shapes.hoop, 0x3d2b23, 0, -0.1, 0, 0.08, 0.075, 0.08, 0, 0, 0);
  },
  // A sealed letter for someone on the lane.
  letter(kit, g) {
    kit.part(g, "slab", 0xf2e8d0, 0, 0.035, 0.012, 0.12, 0.082, 0.005, 0.14);
    kit.part(g, "prism", 0xdfd2b0, 0, 0.056, 0.019, 0.05, 0.003, 0.05, Math.PI / 2 + 0.14);
    kit.part(g, "bead", 0xb23f36, 0, 0.042, 0.022, 0.012, 0.012, 0.005);
  },
  // A forager's wicker basket on the crook of the arm, with the day's finds.
  basket(kit, g) {
    const wicker = 0xb58a53;
    kit.part(g, kit.shapes.wicker, wicker, 0, -0.17, 0.03, 0.128, 0.12, 0.105);
    kit.part(g, kit.shapes.hoop, shade(wicker, 0.8), 0, -0.05, 0.03, 0.11, 0.11, 0.11);
    for (const [x, z, h, cap] of [[-0.05, 0.05, 0.03, 0xc8a273], [0.042, 0.022, 0.04, 0xa4563e], [-0.012, -0.015, 0.024, 0xd9bc8a]]) {
      kit.part(g, "peg", 0xefe3c8, x, -0.06 + h / 2, z, 0.012, h + 0.03, 0.012);
      kit.part(g, "soft", cap, x, -0.05 + h, z, 0.04, 0.024, 0.04);
    }
    for (const [x, z, turn] of [[0.08, 0.07, -0.7], [-0.09, 0.0, 0.7], [0.02, 0.1, 0]])
      kit.part(g, "lock", 0x6d8446, x, -0.02, z, 0.013, 0.06, 0.028, 0.2, 0, Math.PI + turn);
  },
  // Wren's bird book, open at today's page.
  book(kit, g) {
    kit.part(g, "slab", 0x66543c, 0, 0.012, 0.03, 0.17, 0.008, 0.125, 0.25);
    for (const side of [-1, 1])
      kit.part(g, "slab", 0xf3ebd6, side * 0.041, 0.022, 0.028, 0.078, 0.01, 0.112, 0.25, 0, -side * 0.08);
    kit.part(g, "slab", 0x8a8069, -0.041, 0.031, 0.015, 0.05, 0.002, 0.004, 0.25, 0, 0.08);
    kit.part(g, "slab", 0x8a8069, -0.041, 0.029, 0.033, 0.05, 0.002, 0.004, 0.25, 0, 0.08);
    kit.part(g, "slab", 0x8a8069, 0.041, 0.029, 0.033, 0.05, 0.002, 0.004, 0.25, 0, -0.08);
  },
  pencil(kit, g) {
    kit.span(g, "peg", 0xd6a24e, [0, -0.01, 0.0], [-0.05, 0.05, 0.1], 0.0075);
  },
  // A long-handled garden fork, planted at the side of its owner.
  fork(kit, g, look, ground) {
    const ash = 0xa98a5e,
      iron = 0x5f6668;
    kit.part(g, "peg", ash, 0, ground + 0.5, 0.03, 0.016, 0.82, 0.016);
    kit.part(g, kit.shapes.hoop, ash, 0, ground + 0.91, 0.03, 0.05, 0.05, 0.03, 0, 0, 0);
    kit.part(g, "slab", ash, 0, ground + 0.91, 0.03, 0.1, 0.014, 0.018);
    kit.part(g, "slab", iron, 0, ground + 0.22, 0.03, 0.09, 0.022, 0.018);
    for (const x of [-0.042, -0.014, 0.014, 0.042])
      kit.part(g, "prism", iron, x, ground + 0.11, 0.03, 0.009, 0.2, 0.009);
  },
  // A mason's round beech mallet, its head worn smooth.
  mallet(kit, g) {
    const beech = 0xb08d62;
    kit.part(g, "peg", 0x9c7c55, 0, 0.06, 0.02, 0.016, 0.16, 0.016);
    kit.part(g, "tube", beech, 0, 0.17, 0.02, 0.058, 0.1, 0.058);
    kit.part(g, "tube", shade(beech, 0.82), 0, 0.12, 0.02, 0.06, 0.012, 0.06);
  },
  // An innkeeper's pewter tankard, with a head on it.
  tankard(kit, g) {
    const pewter = 0x9a9c97;
    kit.part(g, "tube", pewter, 0, 0.06, 0.02, 0.062, 0.13, 0.062);
    kit.part(g, "tube", shade(pewter, 0.76), 0, 0.012, 0.02, 0.066, 0.014, 0.066);
    kit.part(g, "tube", shade(pewter, 0.76), 0, 0.118, 0.02, 0.066, 0.012, 0.066);
    kit.part(g, "soft", 0xf5ecd9, 0, 0.132, 0.02, 0.058, 0.03, 0.058);
    kit.part(g, kit.shapes.hoop, shade(pewter, 0.8), 0, 0.066, -0.043, 0.04, 0.045, 0.04, 0, Math.PI / 2, Math.PI / 2);
  },
};

/** Puts what `look.carry` names into each hand: `{ right, left }`. */
export function carry(kit, figure, look) {
  const { carry: held = {} } = look;
  [held.right, held.left].forEach((name, i) => {
    if (!name) return;
    const [shoulder, elbow] = look.armPose[i];
    // The palm's height, for a prop that stands on the ground.
    const palm =
      SHOULDER_Y -
      UPPER_ARM * Math.cos(shoulder) -
      (FOREARM + PALM) * Math.cos(shoulder + elbow);
    const g = kit.group(figure.hands[i], 0, -PALM, 0.012, -(shoulder + elbow));
    HELD[name](kit, g, look, -palm);
    kit.flatten(g);
  });
}

// The rest are worn rather than held.

/** The traveler's rucksack and bedroll, and its straps over the coat. */
export function rucksack(kit, body) {
  const canvas = 0x766645,
    flap = 0x8d7a50,
    pocket = 0x6a5b3c,
    strap = 0x5c4a30;
  kit.part(body, "ball", canvas, 0, 0.93, -0.235, 0.18, 0.225, 0.105);
  kit.part(body, "soft", flap, 0, 1.075, -0.24, 0.165, 0.075, 0.102);
  kit.part(body, "slab", flap, 0, 1.0, -0.336, 0.25, 0.1, 0.016, -0.14);
  kit.part(body, "soft", pocket, 0, 0.855, -0.33, 0.115, 0.082, 0.038);
  kit.span(body, "slab", strap, [0, 1.03, -0.345], [0, 0.92, -0.368], 0.03, 0.008);
  kit.part(body, "slab", brass, 0, 0.945, -0.366, 0.036, 0.034, 0.006);
  for (const side of [-1, 1]) {
    kit.part(body, "soft", pocket, side * 0.172, 0.875, -0.235, 0.038, 0.09, 0.06);
    // The shoulder straps, over the coat and under the arm.
    const points = [
      [side * 0.12, 1.16, -0.1],
      [side * 0.135, 1.14, 0.06],
      [side * 0.15, 1.04, kit.onBody(COAT, side * 0.15, 1.04, 0.012)],
      [side * 0.178, 0.88, 0.09],
    ];
    for (let i = 0; i < points.length - 1; i++)
      kit.span(body, "slab", strap, points[i], points[i + 1], 0.036, 0.012);
  }
  // The bedroll, tied over the top.
  kit.part(body, "tube", 0x9caa89, 0, 1.17, -0.245, 0.078, 0.4, 0.078, 0, 0, Math.PI / 2);
  for (const side of [-1, 1]) {
    kit.part(body, "tube", 0x7d8a6c, side * 0.2, 1.17, -0.245, 0.074, 0.006, 0.074, 0, 0, Math.PI / 2);
    kit.part(body, "tube", strap, side * 0.11, 1.17, -0.245, 0.082, 0.02, 0.082, 0, 0, Math.PI / 2);
  }
  // A tin mug at the side, clipped on.
  const tin = 0xa9b0ad;
  kit.part(body, "tube", tin, 0.2, 0.975, -0.255, 0.04, 0.064, 0.04);
  kit.part(body, "ring", tin, 0.244, 0.975, -0.255, 0.022, 0.022, 0.022, Math.PI / 2);
}

/** Bram's satchel, its strap across the chest from shoulder to hip. */
export function satchel(kit, body, look) {
  const strap = shade(leather, 0.82),
    color = leather;
  const points = [
    [0.13, 1.135, -0.045],
    [0.125, 1.125, 0.09],
    [0.03, 1.02, kit.onBody(COAT, 0.03, 1.02, 0.014)],
    [-0.1, 0.88, kit.onBody(COAT, -0.1, 0.88, 0.014)],
    [-0.205, 0.77, 0.06],
    [-0.27, 0.72, -0.015],
  ];
  for (let i = 0; i < points.length - 1; i++)
    kit.span(body, "slab", strap, points[i], points[i + 1], 0.03, 0.01);
  // And round the back to the same hip.
  const behind = [
    [0.13, 1.135, -0.045],
    [0.03, 1.02, -kit.onBody(COAT, 0.03, 1.02, 0.014)],
    [-0.1, 0.88, -kit.onBody(COAT, -0.1, 0.88, 0.014)],
    [-0.205, 0.77, -0.06],
    [-0.27, 0.72, -0.015],
  ];
  for (let i = 0; i < behind.length - 1; i++)
    kit.span(body, "slab", strap, behind[i], behind[i + 1], 0.03, 0.01);
  kit.part(body, "soft", color, -0.272, 0.66, -0.012, 0.042, 0.092, 0.122);
  kit.part(body, "slab", shade(color, 1.16), -0.312, 0.692, -0.012, 0.012, 0.09, 0.2);
  kit.part(body, "slab", brass, -0.32, 0.66, -0.012, 0.006, 0.034, 0.034);
  // Letters poking out of it.
  kit.part(body, "slab", 0xf2e8d0, -0.262, 0.745, 0.026, 0.008, 0.05, 0.075, 0, 0, 0.08);
  kit.part(body, "slab", 0xe4d6b4, -0.272, 0.74, -0.05, 0.008, 0.046, 0.07, 0, 0, 0.06);
  if (look.trim) kit.part(body, "bead", look.trim, -0.32, 0.66, -0.012, 0.008, 0.012, 0.012);
}

/** Wren's brass spyglass on a strap at the hip. */
export function spyglass(kit, body) {
  kit.part(body, "tube", brass, 0.22, 0.72, 0.03, 0.026, 0.13, 0.026, 0.1);
  kit.part(body, "tube", shade(brass, 0.74), 0.22, 0.655, 0.024, 0.03, 0.03, 0.03, 0.1);
  kit.part(body, "tube", 0x4e3a2a, 0.22, 0.75, 0.033, 0.03, 0.03, 0.03, 0.1);
  kit.part(body, "tube", shade(brass, 1.08), 0.218, 0.8, 0.038, 0.021, 0.06, 0.021, 0.1);
}

/** Tamsin's ring of keys at the waist. */
export function keys(kit, body) {
  kit.part(body, "ring", 0xa6a29a, 0.15, 0.76, 0.152, 0.03, 0.03, 0.03);
  kit.span(body, "peg", 0x4e3a2a, [0.152, 0.87, 0.14], [0.15, 0.785, 0.152], 0.006);
  for (const [x, turn] of [[0.135, 0.3], [0.165, -0.3]]) {
    kit.span(body, "peg", 0x8d897f, [x, 0.75, 0.156], [x + turn * 0.05, 0.68, 0.158], 0.005);
    kit.part(body, "slab", 0x8d897f, x + turn * 0.05 + 0.006, 0.688, 0.158, 0.012, 0.012, 0.003);
  }
}
