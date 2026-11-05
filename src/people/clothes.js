// What people wear, from the neck to the boots. Body-local units: the ground is
// y 0, the hips 0.58 and the neck about 1.2, and the figure faces +z.
import { mix, shade } from "./kit.js";
import { BODICE, COAT, radiusAt, SKIRT_LONG, SKIRT_SHORT } from "./shapes.js";

const POCKET = 0.76;

function buttonsDown(kit, body, profile, color, top, step, count, x = 0) {
  for (let i = 0; i < count; i++) {
    const y = top - i * step;
    kit.part(body, "bead", color, x, y, kit.onBody(profile, x, y, 0.012), 0.017, 0.017, 0.009);
  }
}

function pockets(kit, body, color, y, width = 0.2) {
  for (const side of [-1, 1]) {
    const center = side * POCKET;
    kit.wear(body, kit.shapes.panel(COAT, y, y + 0.085, { center, half: width, lift: 0.005, segments: 3 }), shade(color, 0.93));
    kit.wear(body, kit.shapes.panel(COAT, y + 0.062, y + 0.1, { center, half: width + 0.03, lift: 0.01, segments: 3 }), shade(color, 0.8));
  }
}

function backOfCoat(kit, body, color) {
  const { panel } = kit.shapes;
  kit.wear(body, panel(COAT, 0.6, 0.78, { center: Math.PI, half: 0.025, lift: 0.003, segments: 1 }), shade(color, 0.55));
  kit.wear(body, panel(COAT, 0.78, 1.1, { center: Math.PI, half: 0.012, lift: 0.002, segments: 1 }), shade(color, 0.78));
  kit.wear(body, panel(COAT, 0.835, 0.875, { center: Math.PI, half: 0.5, lift: 0.008, segments: 4 }), shade(color, 0.84));
  for (const side of [-1, 1]) {
    const x = side * 0.075,
      y = 0.855;
    kit.part(body, "bead", shade(color, 0.6), x, y, -kit.onBody(COAT, x, y, 0.012), 0.012, 0.012, 0.007);
  }
}

function lapels(kit, body, color, shirt, profile = COAT) {
  kit.wear(body, kit.shapes.panel(profile, 1.035, 1.172, { half: 0.44, lift: 0.003, segments: 4 }), shirt);
  for (const side of [-1, 1]) {
    const y = 1.07,
      x = side * 0.066;
    kit.part(body, "slab", color, x, y, kit.onBody(profile, x, y, 0.012), 0.062, 0.175, 0.012, -0.28, side * 0.24, -side * 0.52);
    const cx = side * 0.05,
      cy = 1.158;
    kit.part(body, "prism", shirt, cx, cy, kit.onBody(profile, cx, cy, 0.02), 0.05, 0.012, 0.05, Math.PI / 2 - 0.5, 0, side * 0.55);
  }
}

function belt(kit, body, profile, leather = 0x4e3a2a, brass = 0xc9a65a) {
  kit.wear(body, kit.shapes.panel(profile, 0.84, 0.885, { lift: 0.009 }), leather);
  const z = kit.onBody(profile, 0, 0.862, 0.012);
  kit.part(body, "slab", brass, 0, 0.862, z, 0.052, 0.05, 0.008);
  kit.part(body, "slab", leather, 0, 0.862, z + 0.004, 0.028, 0.028, 0.006);
}

// A long buttoned coat, the commonest thing on the map.
function coat(kit, body, look) {
  const { shapes } = kit,
    color = look.coat;
  kit.wear(body, shapes.body(COAT), color);
  kit.wear(body, shapes.panel(COAT, 0.6, 0.632, { lift: 0.005 }), look.trim);
  kit.wear(body, shapes.panel(COAT, 0.6, look.collar === "stand" ? 1.17 : 1.0, { half: 0.11, lift: 0.004, segments: 2 }), look.placket ?? shade(color, 0.86));
  if (look.collar === "stand") {
    kit.part(body, "tube", color, 0, 1.19, 0.002, 0.098, 0.055, 0.092);
    kit.part(body, "tube", look.trim, 0, 1.214, 0.002, 0.1, 0.012, 0.094);
    kit.part(body, "bead", look.buttons, 0, 1.186, 0.094, 0.014, 0.014, 0.008);
  } else lapels(kit, body, shade(color, 1.1), look.shirt);
  buttonsDown(kit, body, COAT, look.buttons, look.collar === "stand" ? 1.09 : 0.97, look.collar === "stand" ? 0.092 : 0.1, look.collar === "stand" ? 5 : 4);
  pockets(kit, body, color, 0.68);
  if (look.chestPockets)
    for (const side of [-1, 1]) {
      const center = side * 0.62;
      kit.wear(body, shapes.panel(COAT, 0.97, 1.04, { center, half: 0.18, lift: 0.005, segments: 2 }), shade(color, 0.93));
      kit.wear(body, shapes.panel(COAT, 1.02, 1.055, { center, half: 0.21, lift: 0.009, segments: 2 }), shade(color, 0.8));
    }
  if (look.belt) belt(kit, body, COAT);
  backOfCoat(kit, body, color);
}

// A gardener's loose smock with a gathered yoke and a rope for a belt.
function smock(kit, body, look) {
  const { shapes } = kit,
    color = look.coat;
  kit.wear(body, shapes.body(COAT), color);
  kit.wear(body, shapes.panel(COAT, 0.6, 0.628, { lift: 0.004 }), look.trim);
  kit.wear(body, shapes.panel(COAT, 0.98, 1.135, { lift: 0.005 }), shade(color, 1.07));
  kit.wear(body, shapes.panel(COAT, 0.974, 0.992, { lift: 0.008 }), look.trim);
  kit.wear(body, shapes.panel(COAT, 1.0, 1.172, { half: 0.34, lift: 0.006, segments: 3 }), look.shirt);
  // The neck's laces.
  for (let i = 0; i < 3; i++) {
    const y = 1.03 + i * 0.038,
      z = kit.onBody(COAT, 0, y, 0.012);
    for (const side of [-1, 1])
      kit.part(body, "slab", shade(color, 0.6), 0, y, z, 0.07, 0.007, 0.005, 0, 0, side * 0.45);
  }
  // Gathers fall from the yoke.
  for (let i = -3; i <= 3; i++) {
    const center = i * 0.3;
    if (i === 0) continue;
    kit.wear(body, shapes.panel(COAT, 0.72, 0.97, { center, half: 0.012, lift: 0.002, segments: 1 }), shade(color, 0.76));
  }
  kit.part(body, shapes.roll(0.196, 0.011), mix(color, 0x7c6a48, 0.8), 0, 0.862, 0, 1, 1, 0.8);
  // The rope's knot and its two ends.
  const z = kit.onBody(COAT, 0.05, 0.86, 0.01);
  kit.part(body, "bead", 0x7c6a48, 0.05, 0.86, z, 0.024);
  kit.span(body, "peg", 0x7c6a48, [0.05, 0.85, z + 0.006], [0.04, 0.74, z + 0.012], 0.009);
  kit.span(body, "peg", 0x7c6a48, [0.06, 0.85, z + 0.006], [0.082, 0.77, z + 0.012], 0.009);
  pockets(kit, body, color, 0.67, 0.26);
  // A trowel's handle out of the pocket.
  const px = -0.13,
    py = 0.8;
  kit.part(body, "peg", 0x8a6a42, px, py, kit.onBody(COAT, px, py, 0.024), 0.014, 0.1, 0.014);
}

// A waistcoat over shirtsleeves.
function waistcoat(kit, body, look) {
  const { shapes } = kit,
    color = look.coat;
  kit.wear(body, shapes.body(COAT), color);
  kit.wear(body, shapes.panel(COAT, 0.6, 0.68, { lift: 0.002 }), look.trousers);
  kit.wear(body, shapes.panel(COAT, 0.675, 0.7, { lift: 0.005 }), shade(color, 0.72));
  kit.wear(body, shapes.panel(COAT, 0.7, 1.13, { center: Math.PI, half: 1.1, lift: 0.002, segments: 6 }), shade(color, 0.8));
  kit.wear(body, shapes.panel(COAT, 0.68, 1.0, { half: 0.1, lift: 0.004, segments: 2 }), shade(color, 0.88));
  lapels(kit, body, shade(color, 1.12), look.shirt);
  buttonsDown(kit, body, COAT, 0xd1c4a2, 0.97, 0.062, 5);
  pockets(kit, body, color, 0.72, 0.16);
  // A watch chain, from a buttonhole to the pocket.
  kit.part(body, "hoop", 0xd2b160, 0.07, 0.88, kit.onBody(COAT, 0.07, 0.88, 0.012), 0.065, 0.04, 0.04, 0, -0.3, Math.PI);
}

// A plain shirt, for someone with an apron over it.
function shirt(kit, body, look) {
  const { shapes } = kit,
    color = look.coat;
  kit.wear(body, shapes.body(COAT), color);
  kit.wear(body, shapes.panel(COAT, 0.98, 1.16, { half: 0.1, lift: 0.004, segments: 2 }), shade(color, 0.86));
  for (const side of [-1, 1]) {
    const cx = side * 0.052,
      cy = 1.16;
    kit.part(body, "prism", shade(color, 1.14), cx, cy, kit.onBody(COAT, cx, cy, 0.018), 0.058, 0.012, 0.058, Math.PI / 2 - 0.5, 0, side * 0.55);
  }
  buttonsDown(kit, body, COAT, 0xe6dcc0, 1.12, 0.045, 3);
}

// A fitted bodice and a pleated skirt, long or to the knee.
function dress(kit, body, look) {
  const { shapes } = kit,
    color = look.coat,
    skirt = look.short ? SKIRT_SHORT : SKIRT_LONG,
    hem = skirt[0][1];
  kit.wear(body, shapes.body(BODICE), color);
  kit.part(body, shapes.skirt(skirt), color, 0, 0, 0, 1, 1, 0.92);
  kit.part(body, shapes.skirtBand(skirt, hem + 0.005, hem + 0.05), look.trim, 0, 0, 0, 1, 1, 0.92);
  kit.part(body, shapes.skirtBand(skirt, hem + 0.07, hem + 0.082), look.trim, 0, 0, 0, 1, 1, 0.92);
  kit.part(body, shapes.panel(BODICE, 0.85, 0.905, { lift: 0.016 }), look.sash ?? shade(color, 0.74), 0, 0, 0, 1, 1, 0.92);
  // A chemise shows at the neck.
  kit.wear(body, shapes.panel(BODICE, 1.04, 1.172, { half: 0.64, lift: 0.004, segments: 5 }), look.shirt);
  if (look.laced) {
    // A darker stomacher, laced up the front.
    kit.wear(body, shapes.panel(BODICE, 0.9, 1.06, { half: 0.3, lift: 0.006, segments: 3 }), shade(color, 0.72));
    for (let i = 0; i < 4; i++) {
      const y = 0.925 + i * 0.038,
        z = kit.onBody(BODICE, 0, y, 0.014);
      for (const side of [-1, 1])
        kit.part(body, "slab", look.shirt, 0, y, z, 0.086, 0.007, 0.005, 0, 0, side * 0.42);
    }
  } else if (!look.apron || look.apron === "half" || look.apron === "stripes") {
    buttonsDown(kit, body, BODICE, look.buttons, 1.03, 0.04, 3);
  }
  if (look.collar === "round")
    for (const side of [-1, 1]) {
      const y = 1.145,
        x = side * 0.06;
      kit.part(body, "soft", look.collarColor ?? look.shirt, x, y, kit.onBody(BODICE, x, y, 0.012), 0.066, 0.012, 0.05, 0.6, side * 0.1, -side * 0.5);
    }
}

const GARMENTS = { coat, smock, waistcoat, shirt, dress };

// Aprons take one of the bodies' shapes, lifted clear of pleats and coats.
const OVER_COAT = [
  [0.268, 0.38],
  [0.246, 0.6],
  [0.21, 0.78],
  [0.194, 0.88],
];
function apron(kit, body, look) {
  const { shapes } = kit,
    cloth = look.apronColor ?? 0xeee2c4,
    kind = look.apron,
    hasSkirt = look.garment === "dress",
    bodice = hasSkirt ? BODICE : COAT;
  const skirtProfile = hasSkirt ? (look.short ? SKIRT_SHORT : SKIRT_LONG) : OVER_COAT;
  const hem = hasSkirt ? skirtProfile[0][1] + (look.short ? 0.03 : 0.11) : 0.38,
    top = 0.87;
  const waistOnly = kind === "half" || kind === "stripes",
    half = waistOnly ? 0.92 : 1.02,
    lift = hasSkirt ? 0.03 : 0.012;
  const across = hasSkirt ? 0.92 : 0.8;
  const hang = (y0, y1, color, opts = {}) =>
    kit.part(body, shapes.panel(skirtProfile, y0, y1, { half, lift, segments: 8, ...opts }), color, 0, 0, 0, 1, 1, across);
  hang(hem, top, cloth);
  hang(hem, hem + 0.022, shade(cloth, 0.84), { lift: lift + 0.003 });
  if (kind === "lace") {
    // A scalloped edge.
    for (let i = -5; i <= 5; i++) {
      const phi = (i / 5) * half,
        y = hem - 0.004,
        r = radiusAt(skirtProfile, y) + lift;
      kit.part(body, "bead", 0xf6eddc, Math.sin(phi) * r, y, Math.cos(phi) * r * across, 0.024, 0.017, 0.008, 0, phi, 0);
    }
  }
  if (kind === "stripes")
    for (const y of [0.5, 0.6, 0.7])
      hang(y, y + 0.018, shade(cloth, 0.7), { lift: lift + 0.002 });
  // A big front pocket.
  const pocketY = waistOnly || hasSkirt ? 0.56 : 0.6;
  hang(pocketY, pocketY + 0.11, shade(cloth, 0.92), { half: 0.46, lift: lift + 0.004, segments: 4 });
  hang(pocketY + 0.098, pocketY + 0.116, shade(cloth, 0.78), { half: 0.47, lift: lift + 0.007, segments: 4 });
  // Waistband and the bow behind.
  kit.part(body, shapes.panel(bodice, 0.862, 0.902, { lift: hasSkirt ? 0.02 : 0.014 }), shade(cloth, 0.86), 0, 0, 0, 1, 1, hasSkirt ? 0.92 : 0.8);
  const backZ = -kit.onBody(bodice, 0, 0.88, hasSkirt ? 0.05 : 0.026);
  for (const side of [-1, 1]) {
    kit.part(body, "soft", shade(cloth, 0.95), side * 0.052, 0.884, backZ, 0.055, 0.03, 0.016, 0, 0, side * 0.32);
    kit.span(body, "slab", shade(cloth, 0.9), [side * 0.012, 0.87, backZ], [side * 0.05, 0.72, backZ - 0.012], 0.03, 0.006);
  }
  kit.part(body, "bead", shade(cloth, 0.84), 0, 0.884, backZ - 0.004, 0.018, 0.022, 0.016);
  if (waistOnly) return;
  // The bib and the straps round the neck.
  kit.wear(body, shapes.panel(bodice, 0.895, 1.085, { half: 0.56, lift: hasSkirt ? 0.012 : 0.008, segments: 5 }), cloth);
  kit.wear(body, shapes.panel(bodice, 1.066, 1.09, { half: 0.57, lift: hasSkirt ? 0.015 : 0.011, segments: 5 }), shade(cloth, 0.84));
  for (const side of [-1, 1]) {
    const x = side * 0.08,
      y = 1.085,
      z = kit.onBody(bodice, x, y, 0.012);
    kit.span(body, "slab", shade(cloth, 0.92), [x, y, z], [side * 0.085, 1.185, 0.04], 0.024, 0.006);
  }
  // Flour, for whoever has been at the bench.
  if (look.flour) {
    const dusting = [
      [-0.06, 0.74, 0.05, 0.024],
      [0.08, 0.86, 0.035, 0.018],
      [0.02, 1.0, 0.04, 0.02],
    ];
    for (const [x, y, w, h] of dusting)
      kit.part(body, "bead", mix(cloth, 0xffffff, 0.45), x, y, kit.onBody(y > 0.88 ? bodice : OVER_COAT, x, y, y > 0.88 ? 0.006 : 0.008), w, h, 0.0035);
  }
}

// Worn over the shoulders.
const CAPE = [
  [0.372, 0.93],
  [0.36, 1.0],
  [0.335, 1.08],
  [0.296, 1.14],
  [0.205, 1.18],
  [0.1, 1.2],
];
function cape(kit, body, look) {
  const color = look.cape,
    { shapes } = kit;
  kit.part(body, shapes.panel(CAPE, 0.93, 1.19, { lift: 0 }), color, 0, 0, 0, 1, 1, 0.72);
  kit.part(body, shapes.panel(CAPE, 0.93, 0.955, { lift: 0.004 }), shade(color, 0.76), 0, 0, 0, 1, 1, 0.72);
  // The hood down at the back, and a clasp in front.
  kit.part(body, "soft", shade(color, 0.92), 0, 1.13, -0.165, 0.13, 0.085, 0.075);
  kit.part(body, "bead", look.clasp ?? 0xc9a65a, 0, 1.135, 0.14, 0.021, 0.021, 0.01);
}

// Worn round the neck: a knotted kerchief, or the traveler's long scarf.
function neckwear(kit, body, look) {
  if (look.neck === "kerchief") {
    const color = look.neckColor;
    kit.part(body, "tube", color, 0, 1.178, 0.004, 0.103, 0.045, 0.098);
    const y = 1.1,
      z = kit.onBody(COAT, 0, y, 0.014);
    kit.part(body, "prism", color, 0, y + 0.044, z, 0.062, 0.012, 0.062, Math.PI / 2 - 0.3, 0, 0);
    kit.part(body, "bead", shade(color, 0.82), 0.012, 1.158, 0.108, 0.021);
    return null;
  }
  if (look.neck !== "scarf") return null;
  const color = look.neckColor,
    band = look.neckBand ?? 0xd6b472;
  kit.part(body, kit.shapes.roll(0.092, 0.036), color, 0, 1.178, 0.004);
  kit.part(body, kit.shapes.roll(0.084, 0.028), shade(color, 0.85), 0, 1.222, 0.002);
  const tail = kit.group(body, -0.085, 1.158, 0.15);
  kit.part(tail, "bead", shade(color, 0.85), 0, 0.0, 0, 0.042, 0.032, 0.03);
  const length = 0.24;
  kit.part(tail, "slab", color, -0.016, -length / 2, 0.018, 0.078, length, 0.022, 0.06, 0, -0.13);
  for (const y of [0.15, 0.185])
    kit.part(tail, "slab", band, -0.016 - y * 0.13, -y, 0.018 + y * 0.06 + 0.012, 0.08, 0.014, 0.006, 0.06, 0, -0.13);
  // The fringe at its end.
  for (let i = -2; i <= 2; i++)
    kit.part(tail, "peg", band, -0.048 + i * 0.016, -length - 0.016, 0.032, 0.005, 0.032, 0.005, 0, 0, -0.13);
  return tail;
}

/** Everything on the torso. Returns the traveler's scarf tail, which swings. */
export function dressTorso(kit, body, look) {
  kit.part(body, "tube", look.skin, 0, 1.2, 0, 0.07, 0.12, 0.074);
  GARMENTS[look.garment](kit, body, look);
  if (look.apron) apron(kit, body, look);
  if (look.cape) cape(kit, body, look);
  return neckwear(kit, body, look);
}

/** A boot or shoe, in the frame of a shin whose ground is at `ground`. */
export function boot(kit, shin, look, ground) {
  const leather = look.boots,
    sole = look.soles,
    style = look.bootStyle ?? "laced";
  kit.part(shin, "tube", sole, 0, ground + 0.016, 0.035, 0.083, 0.032, 0.142);
  kit.part(shin, "tube", sole, 0, ground + 0.034, -0.058, 0.066, 0.05, 0.058);
  kit.part(shin, "ball", leather, 0, ground + 0.07, 0.034, 0.078, 0.06, 0.128);
  kit.part(shin, "soft", shade(leather, 0.82), 0, ground + 0.064, 0.118, 0.06, 0.043, 0.05);
  if (style === "shoe") {
    // A round-toed shoe, its strap and a sock above.
    kit.part(shin, "slab", shade(leather, 0.7), 0, ground + 0.103, 0.05, 0.106, 0.016, 0.03);
    kit.part(shin, "tube", look.socks ?? 0xf2ead8, 0, ground + 0.15, 0, 0.056, 0.13, 0.058);
    kit.part(shin, "tube", shade(look.socks ?? 0xf2ead8, 0.9), 0, ground + 0.208, 0, 0.06, 0.022, 0.062);
    return;
  }
  const height = style === "tall" ? 0.27 : style === "wellies" ? 0.26 : 0.13;
  kit.part(shin, "tube", leather, 0, ground + 0.1 + height / 2, 0, 0.073, height, 0.078);
  kit.part(shin, "tube", style === "wellies" ? shade(leather, 0.8) : shade(leather, 1.18), 0, ground + 0.1 + height, 0, 0.079, 0.03, 0.084);
  if (style === "tall") {
    // A strap and buckle round the calf.
    const y = ground + 0.27;
    kit.part(shin, "tube", shade(leather, 0.62), 0, y, 0, 0.076, 0.022, 0.081);
    kit.part(shin, "slab", 0xc9a65a, 0.04, y, 0.068, 0.026, 0.028, 0.006, 0, 0.5, 0);
  }
  if (style === "laced")
    for (let i = 0; i < 4; i++) {
      const y = ground + 0.098 + i * 0.028;
      kit.part(shin, "slab", look.laces ?? 0xd3bd92, 0, y, 0.077, 0.05, 0.007, 0.005, 0, 0, i % 2 ? 0.14 : -0.14);
    }
}
