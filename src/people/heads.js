// Faces, hair and hats. Head-local units: the origin is the neck's pivot, the
// face's centre is y 0.045, and the head is scaled up 1.17 afterward.
import { mix, shade } from "./kit.js";
import { HAT_CROWN } from "./shapes.js";

const CAP = { y: 0.092, z: -0.049 };

function face(kit, head, look) {
  const { skin } = look,
    brow = look.brow ?? shade(look.hair, 0.82),
    tilt = look.browTilt ?? 0.14;
  kit.part(head, kit.shapes.head, skin, 0, 0.045, 0.008, 0.184, 0.208, 0.171);
  for (const side of [-1, 1]) {
    kit.part(head, "soft", skin, side * 0.176, 0.035, 0.018, 0.034, 0.056, 0.038);
    kit.part(head, "bead", shade(skin, 0.78), side * 0.19, 0.032, 0.03, 0.014, 0.03, 0.012);
    kit.part(head, "soft", mix(skin, 0xd8604e, 0.3), side * 0.102, -0.012, 0.128, 0.044, 0.028, 0.02);
    kit.part(head, "bead", brow, side * 0.066, 0.117, 0.154, 0.035, 0.0095, 0.012, 0, 0, -side * tilt);
    if (look.lined) {
      // The fine lines of an older face, at the eyes' corners.
      kit.part(head, "bead", shade(skin, 0.84), side * 0.118, 0.052, 0.128, 0.014, 0.003, 0.004, 0, 0, -side * 0.35);
    }
  }
  if (look.freckles)
    for (const [x, y] of [[-0.11, 0.008], [-0.084, 0.022], [-0.058, 0.005], [0.058, 0.005], [0.084, 0.022], [0.11, 0.008]])
      kit.part(head, "bead", shade(skin, 0.72), x, y, 0.156 - Math.abs(x) * 0.17, 0.0045, 0.0045, 0.003);
  kit.part(head, "soft", shade(skin, 1.02), 0, 0.008, 0.178, 0.026 * (look.nose ?? 1), 0.03 * (look.nose ?? 1), 0.03 * (look.nose ?? 1));
  const smile = kit.part(head, "smile", look.lips ?? mix(skin, 0x7e3a33, 0.62), 0, -0.024, 0.163, 1.05, 1.05, 1.1);
  smile.rotation.z = Math.PI;

  // The eyes blink, so they are the one thing with a joint of their own.
  const eyes = kit.group(head, 0, 0.052, 0);
  for (const side of [-1, 1]) {
    kit.part(eyes, "soft", look.eye ?? 0x2d2925, side * 0.065, 0, 0.158, 0.022, 0.029, 0.014);
    kit.part(eyes, "bead", 0xfff8e6, side * 0.065 - 0.007, 0.011, 0.17, 0.0065, 0.0075, 0.004);
  }
  for (const mesh of eyes.children) mesh.castShadow = false;
  return eyes;
}

// A fringe of locks across the forehead, each `{ x, width, drop }`, and the
// hair that shows at the temples and the nape.
function fringe(kit, head, color, locks, hatted) {
  // Under a brim the hair starts lower, so it shows rather than peeps out.
  const y = hatted ? 0.205 : 0.235,
    z = hatted ? 0.142 : 0.115,
    wrap = hatted ? 0.6 : 0.24;
  for (const [x, width, drop, turn] of locks)
    kit.part(head, "lock", color, x, y, z - Math.abs(x) * wrap, width, drop, 0.034, -0.1, 0, turn);
}
function nape(kit, head, color, long = 0.1) {
  for (const [x, z] of [[-0.1, -0.15], [0, -0.178], [0.1, -0.15]])
    kit.part(head, "lock", color, x, 0.015, z, 0.066, long + 0.01, 0.046, 0.14, 0, x * 0.9);
}

const HAIR = {
  short(kit, head, color, look) {
    fringe(kit, head, color, [
      [-0.085, 0.048, 0.06, 0.34],
      [-0.028, 0.05, 0.07, 0.1],
      [0.034, 0.05, 0.066, -0.14],
      [0.09, 0.046, 0.058, -0.36],
    ], look.hat);
    const y = look.hat ? 0.09 : 0.13;
    for (const side of [-1, 1])
      kit.part(head, "lock", color, side * 0.163, y, 0.0, 0.04, look.hat ? 0.056 : 0.078, 0.05, 0, 0, side * 0.1);
    nape(kit, head, color);
  },
  // Thin on top, as forty years under a cap will do; a tuft over each ear.
  balding(kit, head, color) {
    for (const side of [-1, 1]) {
      kit.part(head, "lock", color, side * 0.17, 0.1, -0.02, 0.042, 0.075, 0.05, 0, 0, side * 0.12);
      kit.part(head, "soft", shade(color, 1.04), side * 0.152, 0.012, -0.08, 0.044, 0.05, 0.05);
    }
    nape(kit, head, color, 0.06);
  },
  // Long and loose over the shoulders.
  loose(kit, head, color, look) {
    fringe(kit, head, color, [
      [-0.06, 0.06, 0.05, 0.62],
      [0.06, 0.06, 0.05, -0.62],
    ], look.hat);
    for (const side of [-1, 1]) {
      kit.part(head, "lock", color, side * 0.172, 0.08, -0.03, 0.052, 0.19, 0.075, 0, 0, side * 0.06);
      kit.part(head, "lock", shade(color, 0.92), side * 0.1, 0.03, -0.14, 0.078, 0.2, 0.06, 0.08);
    }
    kit.part(head, "lock", color, 0, 0.03, -0.17, 0.09, 0.21, 0.05, 0.08);
  },
  wavy(kit, head, color, look) {
    fringe(kit, head, color, [
      [-0.09, 0.052, 0.058, 0.42],
      [-0.03, 0.054, 0.06, 0.2],
      [0.03, 0.054, 0.056, -0.2],
      [0.09, 0.05, 0.05, -0.42],
    ], look.hat);
    for (const side of [-1, 1]) {
      kit.part(head, "lock", color, side * 0.168, 0.1, -0.03, 0.05, 0.095, 0.06, 0, 0, side * 0.16);
      kit.part(head, "soft", shade(color, 1.06), side * 0.15, -0.03, -0.11, 0.048, 0.04, 0.05);
      kit.part(head, "soft", color, side * 0.085, -0.075, -0.15, 0.052, 0.042, 0.05);
    }
    kit.part(head, "soft", shade(color, 1.05), 0, -0.09, -0.17, 0.056, 0.044, 0.05);
  },
  bob(kit, head, color, look) {
    fringe(kit, head, color, [
      [-0.07, 0.056, 0.068, 0.3],
      [0, 0.058, 0.074, 0],
      [0.07, 0.056, 0.068, -0.3],
    ], look.hat);
    for (const side of [-1, 1]) {
      kit.part(head, "lock", color, side * 0.176, 0.09, -0.03, 0.058, 0.17, 0.085, 0, 0, side * 0.05);
      kit.part(head, "lock", shade(color, 0.94), side * 0.09, 0.05, -0.15, 0.08, 0.16, 0.06, 0.05);
    }
    kit.part(head, "lock", color, 0, 0.05, -0.178, 0.09, 0.175, 0.05, 0.05);
  },
  // Parted in the middle and drawn back into a bun.
  bun(kit, head, color) {
    for (const side of [-1, 1]) {
      // Swept back from the parting, over the temples.
      kit.part(head, "ball", color, side * 0.098, 0.2, 0.052, 0.098, 0.066, 0.078, -0.42, 0, -side * 0.62);
      kit.part(head, "ball", shade(color, 1.05), side * 0.158, 0.11, -0.02, 0.05, 0.072, 0.062, 0, 0, side * 0.2);
    }
    const y = 0.23,
      z = -0.17;
    kit.part(head, "ball", color, 0, y, z, 0.096, 0.09, 0.092);
    kit.part(head, kit.shapes.roll(0.084, 0.018), shade(color, 0.82), 0, y, z, 1, 1, 1, Math.PI / 2 - 0.5);
    kit.span(head, "peg", 0xb88a4a, [-0.08, y + 0.08, z - 0.03], [0.09, y - 0.03, z + 0.03], 0.0075);
    nape(kit, head, color, 0.05);
  },
  // Long hair, plaited over one shoulder.
  plait(kit, head, color, look) {
    fringe(kit, head, color, [
      [-0.06, 0.06, 0.05, 0.62],
      [0.06, 0.06, 0.05, -0.62],
    ], look.hat);
    const side = look.plaitSide ?? 1;
    kit.part(head, "lock", color, -side * 0.165, 0.12, -0.02, 0.046, 0.085, 0.052, 0, 0, -side * 0.12);
    kit.part(head, "soft", color, side * 0.14, -0.015, -0.09, 0.062, 0.062, 0.062);
    nape(kit, head, color, 0.05);
    // From behind the ear, forward over the shoulder and down the chest.
    const from = [side * 0.178, -0.05, 0.0],
      to = [side * 0.15, -0.48, 0.135];
    const mesh = kit.span(head, kit.shapes.plait, color, from, to, 0.04, 0.04);
    mesh.scale.y *= 1.04;
    kit.part(head, "bead", look.tie ?? 0xc25c55, to[0], to[1], to[2], 0.021, 0.014, 0.021);
    kit.part(head, "lock", color, to[0], to[1] - 0.005, to[2], 0.021, 0.05, 0.021);
  },
  // Bunches that swing as she walks, so each has a joint.
  pigtails(kit, head, color, look) {
    HAIR.short(kit, head, color, look);
    return [-1, 1].map((side) => {
      const hair = kit.group(head, side * 0.18, 0.06, -0.04);
      kit.part(hair, "ball", color, side * 0.035, -0.02, -0.022, 0.072, 0.1, 0.072);
      kit.part(hair, "soft", shade(color, 0.92), side * 0.058, -0.1, -0.01, 0.054, 0.066, 0.054);
      kit.part(hair, "lock", color, side * 0.066, -0.14, -0.002, 0.04, 0.06, 0.04);
      const bow = look.bow ?? 0xf8dfad;
      for (const z of [-0.042, 0.042])
        kit.part(hair, "soft", bow, side * 0.05, 0.036, z - 0.01, 0.024, 0.03, 0.038, 0, 0, side * 0.2);
      kit.part(hair, "bead", shade(bow, 0.82), side * 0.052, 0.036, -0.01, 0.016);
      return hair;
    });
  },
  tucked(kit, head, color) {
    for (const side of [-1, 1])
      kit.part(head, "lock", color, side * 0.164, 0.12, 0.01, 0.04, 0.09, 0.05, 0, 0, side * 0.12);
    nape(kit, head, color, 0.04);
  },
};

function beard(kit, head, look) {
  const color = look.beardColor ?? look.hair;
  if (look.beard === "full" || look.beard === "short") {
    const full = look.beard === "full";
    kit.part(head, kit.shapes.jaw, color, 0, 0.043, 0.01, 0.189, 0.214, 0.178);
    for (const side of [-1, 1]) {
      if (full) kit.part(head, "lock", shade(color, 1.03), side * 0.078, -0.09, 0.118, 0.056, 0.088, 0.042, -0.05, 0, -side * 0.14);
    }
    if (full) {
      kit.part(head, "soft", color, 0, -0.1, 0.112, 0.112, 0.082, 0.062);
      kit.part(head, "lock", color, 0, -0.1, 0.138, 0.06, 0.112, 0.044, -0.05);
    } else kit.part(head, "soft", color, 0, -0.112, 0.135, 0.05, 0.034, 0.03);
  }
  if (look.beard)
    for (const side of [-1, 1])
      kit.part(head, "lock", shade(color, 1.05), side * 0.03, -0.006, 0.17, 0.017, 0.046, 0.016, 0, 0, side * (Math.PI / 2 - 0.15));
}

function glasses(kit, head) {
  const wire = 0x8d7a4e;
  for (const side of [-1, 1]) {
    kit.part(head, "ring", wire, side * 0.066, 0.052, 0.17, 0.036, 0.036, 0.03);
    kit.span(head, "peg", wire, [side * 0.103, 0.058, 0.152], [side * 0.181, 0.062, 0.04], 0.0045);
  }
  kit.part(head, "peg", wire, 0, 0.058, 0.182, 0.005, 0.03, 0.005, 0, 0, Math.PI / 2);
}

const brimOf = (kit, hat, color, r, depth) =>
  kit.part(hat, "brim", color, 0, 0, 0, r, 1, depth);
function crownOf(kit, hat, color, y = 0, scale = 1, depth = 0.92) {
  const geometry = kit.shapes.body(HAT_CROWN);
  kit.part(hat, geometry, color, 0, y, 0, scale, 1, scale * depth);
}
const hatBand = (kit, hat, color, y0 = 0.01, y1 = 0.05, scale = 1, depth = 0.92) =>
  kit.part(hat, kit.shapes.panel(HAT_CROWN, y0, y1, { lift: 0.006, segments: 14 }), color, 0, 0, 0, scale, 1, scale * depth);

function flower(kit, hat, color, x, y, z) {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    kit.part(hat, "bead", color, x + Math.cos(a) * 0.024, y, z + Math.sin(a) * 0.024, 0.021, 0.012, 0.021);
  }
  kit.part(hat, "bead", 0xefcf72, x, y + 0.006, z, 0.012, 0.01, 0.012);
}

const HATS = {
  // A straw hat, its ribbon tied at the side with a bow.
  straw(kit, hat, look) {
    const straw = look.straw ?? 0xecd49a,
      ribbon = look.ribbon ?? 0x7e6654;
    brimOf(kit, hat, straw, 0.312, 0.262);
    crownOf(kit, hat, shade(straw, 0.97), 0.008);
    hatBand(kit, hat, ribbon);
    kit.part(hat, "soft", ribbon, -0.182, 0.03, 0.05, 0.016, 0.03, 0.044, 0, 0.3, 0);
    kit.part(hat, "soft", ribbon, -0.182, 0.03, -0.012, 0.016, 0.03, 0.04, 0, -0.3, 0);
    kit.part(hat, "bead", shade(ribbon, 0.8), -0.186, 0.03, 0.02, 0.012, 0.018, 0.014);
    if (look.feather) {
      kit.part(hat, "lock", look.feather, -0.178, 0.1, -0.03, 0.012, 0.13, 0.03, 0.5, 0, 0.14);
      kit.part(hat, "lock", shade(look.feather, 1.3), -0.178, 0.08, -0.012, 0.009, 0.1, 0.024, 0.2, 0, 0.14);
    }
  },
  // A florist's wide sun hat, flowers in its ribbon.
  sunhat(kit, hat, look) {
    const straw = look.straw ?? 0xeed7a0,
      ribbon = look.ribbon ?? 0xc97d82;
    brimOf(kit, hat, straw, 0.36, 0.31);
    crownOf(kit, hat, shade(straw, 0.97), 0.008, 0.98);
    hatBand(kit, hat, ribbon, 0.012, 0.055, 0.98);
    flower(kit, hat, 0xdc7f88, -0.158, 0.05, 0.075);
    flower(kit, hat, 0xe9c257, -0.182, 0.035, 0.002);
    flower(kit, hat, 0xf1e6d4, -0.14, 0.045, -0.078);
    for (const [x, z, turn] of [[-0.2, 0.09, 0.9], [-0.2, -0.05, -0.8]])
      kit.part(hat, "lock", 0x6d8446, x, 0.03, z, 0.018, 0.05, 0.008, Math.PI / 2, turn, 0);
  },
  // A postmaster's peaked cap with a brass badge.
  peaked(kit, hat, look) {
    const color = look.capColor ?? look.coat,
      { panel, body } = kit.shapes;
    const CAP_SHAPE = [
      [0.175, -0.012],
      [0.178, 0.04],
      [0.222, 0.082],
      [0.226, 0.105],
      [0.19, 0.122],
      [0, 0.13],
    ];
    kit.part(hat, body(CAP_SHAPE), color, 0, 0, 0, 1, 1, 0.95);
    kit.part(hat, panel(CAP_SHAPE, -0.01, 0.036, { lift: 0.004, segments: 14 }), shade(color, 0.62), 0, 0, 0, 1, 1, 0.95);
    kit.part(hat, panel(CAP_SHAPE, 0.1, 0.11, { lift: 0.002, segments: 14 }), look.trim, 0, 0, 0, 1, 1, 0.95);
    const PEAK = [
      [0.17, -0.006],
      [0.262, -0.036],
      [0.268, -0.046],
    ];
    kit.part(hat, panel(PEAK, -0.046, -0.006, { half: 0.95, lift: 0, segments: 8 }), 0x2c2a29);
    kit.part(hat, "slab", 0xcfae5f, 0, 0.012, 0.172, 0.032, 0.034, 0.008);
    kit.part(hat, "bead", 0xe4cd8c, 0, 0.012, 0.178, 0.011, 0.011, 0.005);
  },
  // A flat tweed cap, flopped forward over a short peak.
  flat(kit, hat, look) {
    const color = look.capColor ?? 0x7a7054;
    kit.part(hat, kit.shapes.hairCap, color, 0, 0.044, 0.02, 0.214, 0.08, 0.232, 0.14);
    kit.part(hat, "tube", shade(color, 0.86), 0, 0.012, 0, 0.183, 0.036, 0.18);
    const PEAK = [
      [0.18, 0.0],
      [0.265, -0.022],
      [0.272, -0.032],
    ];
    kit.part(hat, kit.shapes.panel(PEAK, -0.032, 0.0, { half: 0.78, lift: 0, segments: 8 }), shade(color, 0.92));
    kit.part(hat, "bead", shade(color, 0.7), 0, 0.122, 0.03, 0.016, 0.009, 0.016);
  },
  // A forager's felt hat, its brim loose and a fern in the band.
  felt(kit, hat, look) {
    const color = look.capColor ?? 0x5e4d3b;
    brimOf(kit, hat, color, 0.335, 0.285);
    crownOf(kit, hat, shade(color, 1.06), 0.008, 0.97);
    hatBand(kit, hat, shade(color, 0.62), 0.01, 0.04, 0.97);
    // A sprig of rowan: pointed leaves and a bunch of red berries.
    for (const [z, y, turn] of [[0.09, 0.06, -0.9], [0.03, 0.09, -0.15], [-0.03, 0.08, 0.5]])
      kit.part(hat, "lock", 0x627a3f, -0.172, y, z, 0.007, 0.075, 0.024, turn, 0, 0.12);
    for (const [z, y] of [[0.075, 0.03], [0.05, 0.05], [0.03, 0.028], [0.012, 0.048], [0.052, 0.012]])
      kit.part(hat, "bead", 0xc2402f, -0.18, y, z, 0.015);
  },
  // A birdwatcher's soft bucket hat, a feather from a walk in its band.
  bucket(kit, hat, look) {
    const color = look.capColor ?? 0x8b7d54;
    kit.part(hat, "brimDown", color, 0, 0.03, 0, 0.27, 1, 0.24);
    crownOf(kit, hat, shade(color, 1.05), 0.012, 0.97);
    hatBand(kit, hat, shade(color, 0.7), 0.015, 0.05, 0.97);
    kit.part(hat, "lock", look.feather ?? 0x9fb0ac, 0.17, 0.11, 0.02, 0.013, 0.12, 0.036, 0.3, 0, -0.32);
    kit.part(hat, "lock", shade(look.feather ?? 0x9fb0ac, 0.6), 0.172, 0.06, 0.022, 0.006, 0.07, 0.016, 0.3, 0, -0.32);
  },
  // A baker's cap: a puff of linen on a stiff band.
  toque(kit, hat, look) {
    const linen = look.linen ?? 0xf4ebd7;
    kit.part(hat, "tube", shade(linen, 0.96), 0, 0.012, 0, 0.196, 0.072, 0.192);
    kit.part(hat, "puff", linen, 0, 0.1, -0.006, 0.222, 0.128, 0.198);
    kit.part(hat, kit.shapes.roll(0.196, 0.006), shade(linen, 0.84), 0, 0.044, 0, 1, 1, 0.97);
  },
  // An innkeeper's mob cap: gathered cloth, a frill and a ribbon.
  mobcap(kit, hat, look) {
    const linen = look.linen ?? 0xf4ebd7;
    kit.part(hat, "puff", linen, 0, 0.055, -0.04, 0.215, 0.135, 0.205);
    kit.part(hat, "frill", shade(linen, 1.02), 0, -0.002, -0.022, 0.246, 0.32, 0.216);
    kit.part(hat, kit.shapes.roll(0.207, 0.008), look.ribbon ?? 0xa8524a, 0, 0.01, -0.04, 1, 1, 0.955);
    kit.part(hat, "soft", look.ribbon ?? 0xa8524a, 0, 0.018, 0.166, 0.03, 0.016, 0.01);
  },
};

/** The whole head into its group. Returns its eyes and Lily's two pigtails. */
export function buildHead(kit, head, look) {
  const eyes = face(kit, head, look);
  kit.part(head, kit.shapes.hairCap, look.hair, 0, CAP.y, CAP.z, 0.196, 0.196, 0.151);
  const pigtails = HAIR[look.hairStyle ?? "short"](kit, head, look.hair, look) ?? null;
  if (look.beard) beard(kit, head, look);
  if (look.glasses) glasses(kit, head);
  if (look.hat) {
    const hat = kit.group(head, 0, 0.212, -0.012, -0.05, 0, look.hatTilt ?? 0);
    HATS[look.hat](kit, hat, look);
    kit.flatten(hat);
  }
  return { eyes, pigtails };
}
