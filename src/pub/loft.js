import * as T from "three";
import { LOFT, PUB } from "./layout.js";
import { createProps } from "./props.js";

// Upstairs: one long room under the rafters. Railed round the well, so the
// hearth's warmth and the talk from below come up with the light. Cots line
// the walls, two curtained four-posters fill the wing gables for those who can
// pay, and the gallery's door opens out over the street.

const { halfW, halfD, well, stair, wing } = PUB;
const U = PUB.loft;
const inX = halfW - 0.2;
const rearIn = -(halfD - 0.2);

/** A rope-strung cot and straw tick, a quilt and a bolster; a sleeper in some. */
function cot(s, m, props, c, index, sleepers) {
  const { box, cyl, orb, bar, group } = s,
    { length, width } = LOFT.cot,
    g = group(c.x, U, c.z, c.head > 0 ? 0 : Math.PI),
    y = 0.36;
  // +x is the head of the bed, inside this group.
  for (const dz of [-1, 1]) box(m.oak, 0, y, (dz * width) / 2, length, 0.07, 0.06, 0.012, g);
  for (const dx of [-1, 1]) box(m.oak, (dx * length) / 2, y, 0, 0.06, 0.07, width, 0.012, g);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const tall = dx > 0 ? 0.74 : 0.5;
    box(m.oakDark, (dx * length) / 2, tall / 2, (dz * width) / 2, 0.08, tall, 0.08, 0.012, g);
    orb(m.oakWarm, (dx * length) / 2, tall + 0.03, (dz * width) / 2, 0.05, 0.05, 0.05, g);
  }
  box(m.oakWarm, length / 2, 0.6, 0, 0.04, 0.26, width - 0.04, 0.008, g);
  // The straw tick, slightly slumped.
  box(m.straw, 0, y + 0.08, 0, length - 0.1, 0.14, width - 0.06, 0.06, g);
  const quilt = m.quilts[index % m.quilts.length];
  const pillowX = length / 2 - 0.25;
  const bolster = cyl(m.linen, pillowX, y + 0.19, 0, 0.075, width - 0.2, 0.075, g, 10);
  bolster.rotation.x = Math.PI / 2;
  if (c.sleeper) {
    // Someone asleep: a slow-breathing hummock, a head on the bolster and a cap.
    const body = group(c.x, U, c.z, c.head > 0 ? 0 : Math.PI);
    s.apart(body);
    const hump = box(quilt, -0.12, y + 0.24, 0, 1.3, 0.2, 0.62, 0.09, body);
    hump.castShadow = false;
    const lie = box(quilt, -0.28, y + 0.15, 0, length - 0.55, 0.05, width - 0.02, 0.022, g);
    lie.castShadow = false;
    const head = group(pillowX - 0.02, y + 0.3, 0.02, 0, g);
    orb(s.mat("#d7ac88", 0.75), 0, 0, 0, 0.095, 0.092, 0.092, head);
    const cap = cyl(s.mat("#8a4f3f", 0.95), 0.06, 0.05, 0, 0.1, 0.2, 0.012, head, 10);
    cap.rotation.z = -1.3;
    orb(m.linen, 0.24, 0.04, 0, 0.022, 0.022, 0.022, head);
    sleepers.push(hump);
    // Their boots, set neat by the bed; a coat on the post.
    for (const dz of [-0.09, 0.09]) {
      box(m.oakDark, -length / 2 + 0.3, 0.08, width / 2 + 0.16 + dz, 0.24, 0.1, 0.09, 0.03, g);
      box(m.oakDark, -length / 2 + 0.23, 0.17, width / 2 + 0.16 + dz, 0.1, 0.17, 0.09, 0.025, g);
    }
  } else {
    // Made up and waiting, the quilt turned back at the head.
    box(quilt, -0.24, y + 0.17, 0, length - 0.52, 0.04, width - 0.02, 0.018, g);
    box(m.linen, 0.33, y + 0.18, 0, 0.26, 0.03, width - 0.05, 0.012, g);
    if (index % 3 === 0) {
      // A folded blanket and bedroll at the foot.
      box(m.quilts[(index + 1) % 3], -length / 2 + 0.32, y + 0.24, 0, 0.38, 0.09, width - 0.14, 0.03, g);
    }
  }
  // A stool at the bedside, with a candle, a mug, a book or a hat.
  const side = index % 2 ? 1 : -1;
  const stoolZ = (side * width) / 2 + side * 0.22;
  props.stool(length / 2 - 0.2, stoolZ, 0, 0.42, 0.13, g);
  if (index % 3 === 1) props.tankard(length / 2 - 0.2, 0.445, stoolZ, 2, m.pewter, g);
  else props.candle(length / 2 - 0.2, 0.445, stoolZ, g);
}

/** A curtained four-poster under each wing's gable. */
function fourPoster(s, m, b, index) {
  const { box, group, timber } = s,
    { length, width } = LOFT.bed,
    top = 2.05,
    colour = index ? "#4f6e73" : "#7d4a3e";
  const g = group(b.x, U, b.z);
  // A turned bedpost: square-feeling foot, vase, ring, long shaft, ring.
  const turned = new T.LatheGeometry(
    [
      [0.001, 0], [0.06, 0], [0.058, 0.38], [0.034, 0.42], [0.078, 0.56], [0.03, 0.72], [0.056, 0.76], [0.03, 0.8],
      [0.036, 1.55], [0.052, 1.6], [0.032, 1.65], [0.04, top], [0.001, top],
    ].map(([a, c]) => new T.Vector2(a, c)),
    12,
  );
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = (dx * length) / 2,
      z = (dz * width) / 2;
    s.mesh(turned, m.oakDark, x, 0, z, g);
  }
  for (const dz of [-1, 1]) timber(m.oakDark, [-length / 2, top, (dz * width) / 2], [length / 2, top, (dz * width) / 2], 0.08, 0.1, g);
  for (const dx of [-1, 1]) timber(m.oakDark, [(dx * length) / 2, top, -width / 2], [(dx * length) / 2, top, width / 2], 0.08, 0.1, g);
  // Headboard on the street side's window wall, panelled.
  box(m.oakDark, -length / 2 + 0.01, 0.72, 0, 0.05, 0.86, width - 0.08, 0.01, g);
  for (let i = 0; i < 3; i++)
    box(m.oakWarm, -length / 2 + 0.04, 0.78, -width / 3 + (i * width) / 3, 0.015, 0.56, width / 3 - 0.1, 0.004, g);
  box(m.oak, 0, 0.3, width / 2, length, 0.08, 0.07, 0.01, g);
  box(m.oak, 0, 0.3, -width / 2, length, 0.08, 0.07, 0.01, g);
  box(m.oak, length / 2, 0.3, 0, 0.07, 0.08, width, 0.01, g);
  box(m.straw, 0, 0.42, 0, length - 0.08, 0.17, width - 0.06, 0.07, g);
  const quilt = m.quilts[(index * 2) % 3];
  box(quilt, 0.24, 0.55, 0, length - 0.56, 0.05, width + 0.02, 0.02, g);
  for (const dz of [-0.32, 0.32]) {
    const pillow = box(m.linen, -length / 2 + 0.26, 0.56, dz, 0.28, 0.1, 0.5, 0.045, g);
    pillow.rotation.z = 0.12;
  }
  // The tester above and the gathered curtains, tied back at each post.
  const cloth = s.mat(colour, 0.97);
  cloth.side = T.DoubleSide;
  const ruffled = (w, h, folds) => {
    const geo = new T.PlaneGeometry(w, h, folds * 6, 6);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i);
      p.setZ(i, Math.sin((x / w) * folds * Math.PI * 2) * 0.024 * (0.65 + (y / h + 0.5) * 0.35));
    }
    geo.computeVertexNormals();
    return geo;
  };
  const tester = box(s.mat("#d9c9a5", 0.97), 0, top + 0.06, 0, length + 0.06, 0.03, width + 0.06, 0.008, g);
  tester.castShadow = true;
  for (const dz of [-1, 1]) {
    const valance = new T.Mesh(ruffled(length + 0.1, 0.26, 14), cloth);
    valance.position.set(0, top - 0.11, (dz * (width + 0.1)) / 2);
    g.add(valance);
    for (const dx of [-1, 1]) {
      const curtain = new T.Mesh(ruffled(0.42, top - 0.4, 3), cloth);
      curtain.position.set((dx * length) / 2 - dx * 0.2, (top - 0.4) / 2 + 0.22, (dz * (width + 0.06)) / 2);
      curtain.castShadow = curtain.receiveShadow = true;
      g.add(curtain);
    }
  }
  for (const dx of [-1, 1]) {
    const valance = new T.Mesh(ruffled(width + 0.1, 0.26, 10), cloth);
    valance.rotation.y = Math.PI / 2;
    valance.position.set((dx * (length + 0.1)) / 2, top - 0.11, 0);
    g.add(valance);
  }
  return g;
}

/** Railing round the well and the stair, in the same turned oak as the gallery. */
function rails(s, m) {
  const { timber, cyl, orb } = s,
    w = well,
    railY = U + 1.0,
    run = (a, b) => {
      const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.18));
      timber(m.oakWarm, [a[0], railY, a[1]], [b[0], railY, b[1]], 0.1, 0.08);
      timber(m.oak, [a[0], U + 0.08, a[1]], [b[0], U + 0.08, b[1]], 0.08, 0.1);
      for (let i = 1; i < n; i++) {
        const x = a[0] + ((b[0] - a[0]) * i) / n,
          z = a[1] + ((b[1] - a[1]) * i) / n;
        cyl(m.oakWarm, x, U + 0.56, z, 0.024, 0.86, 0.024, undefined, 6);
        orb(m.oakWarm, x, U + 0.54, z, 0.04, 0.09, 0.04);
      }
    };
  run([w.minX, w.minZ], [w.maxX, w.minZ]);
  run([w.minX, w.maxZ], [w.maxX, w.maxZ]);
  run([w.minX, w.minZ], [w.minX, w.maxZ]);
  run([w.maxX, w.minZ], [w.maxX, w.maxZ]);
  for (const [x, z] of [[w.minX, w.minZ], [w.minX, w.maxZ], [w.maxX, w.minZ], [w.maxX, w.maxZ], [-1.3, w.minZ], [-1.3, w.maxZ]]) {
    timber(m.oakDark, [x, U, z], [x, railY + 0.12, z], 0.14, 0.14);
    orb(m.oakWarm, x, railY + 0.17, z, 0.08, 0.095, 0.08);
  }
  // Round the stairwell.
  const b = stair;
  run([b.minX - 0.03, b.bottomZ], [b.minX - 0.03, b.topZ]);
  run([b.minX - 0.03, b.bottomZ + 0.03], [b.maxX, b.bottomZ + 0.03]);
  timber(m.oakDark, [b.minX - 0.03, U, b.bottomZ + 0.03], [b.minX - 0.03, railY + 0.12, b.bottomZ + 0.03], 0.14, 0.14);
  timber(m.oakDark, [b.minX - 0.03, U, b.topZ], [b.minX - 0.03, railY + 0.12, b.topZ], 0.14, 0.14);
}

/** The roof's inside: arch-braced trusses, purlins, common rafters, ceilings. */
function roofFrame(s, m) {
  const { timber, block, cyl } = s,
    e = PUB.eaves,
    R = PUB.ridge,
    slope = (R - e) / halfD;
  const roofY = (z) => R - Math.abs(z) * slope;
  const collar = e + 2.05,
    collarZ = (R - collar) / slope;
  const purlinY = e + 1.0,
    purlinZ = (R - purlinY) / slope;
  // A truss at each third of the room, framed around the well.
  for (const x of [-3, 0, 3]) {
    const tieY = e - 0.02;
    timber(m.oakDark, [x, tieY, -halfD + 0.02], [x, tieY, halfD - 0.02], 0.26, 0.28);
    for (const side of [-1, 1]) {
      // Principal rafter, the collar, the queen strut and curved feet.
      timber(m.oakDark, [x, roofY(halfD - 0.1) - 0.22, side * (halfD - 0.1)], [x, R - 0.3, side * 0.05], 0.22, 0.2);
      const braceA = [x, tieY + 0.1, side * (purlinZ + 0.4)],
        braceB = [x, collar - 0.04, side * collarZ * 0.55];
      timber(m.oak, braceA, braceB, 0.14, 0.12);
      timber(m.oak, [x, tieY + 0.1, side * (halfD - 0.65)], [x, e + 0.72, side * (purlinZ + 0.05)], 0.12, 0.12);
    }
    timber(m.oakDark, [x, collar, -collarZ], [x, collar, collarZ], 0.2, 0.16);
    timber(m.oak, [x, tieY + 0.1, 0], [x, collar - 0.06, 0], 0.17, 0.14);
    // The king strut above the collar to the ridge.
    timber(m.oak, [x, collar + 0.06, 0], [x, R - 0.3, 0], 0.13, 0.12);
    // Peg heads on the collar.
    for (const z of [-0.14, 0.14]) {
      const peg = cyl(m.oakWarm, x + 0.09, collar, z, 0.018, 0.012, 0.018, undefined, 8);
      peg.rotation.z = Math.PI / 2;
    }
  }
  // Ridge piece and purlins running the room's length.
  timber(m.oakDark, [-halfW + 0.2, R - 0.26, 0], [halfW - 0.2, R - 0.26, 0], 0.16, 0.2);
  for (const side of [-1, 1]) {
    timber(m.oakDark, [-halfW + 0.2, purlinY - 0.24, side * purlinZ], [halfW - 0.2, purlinY - 0.24, side * purlinZ], 0.17, 0.2);
    timber(m.oakDark, [-halfW + 0.2, e - 0.02, side * (halfD - 0.22)], [halfW - 0.2, e - 0.02, side * (halfD - 0.22)], 0.2, 0.2);
    // Windbraces sweeping up into the purlins, either side of each truss.
    for (const x of [-3, 0, 3])
      for (const dir of [-1, 1]) {
        const lean = 0.96;
        timber(m.oak, [x + dir * 0.1, e + 0.1, side * (halfD - 0.18)], [x + dir * lean, purlinY - 0.3, side * (purlinZ + 0.04)], 0.08, 0.06);
      }
  }
  // Common rafters, closely set, with their boards above them.
  for (let x = -6.7; x < 6.75; x += 0.48) {
    if ([-3, 0, 3].some((t) => Math.abs(x - t) < 0.14)) continue;
    for (const side of [-1, 1])
      timber(m.oak, [x, roofY(halfD - 0.08) - 0.17, side * (halfD - 0.08)], [x, R - 0.22, side * 0.03], 0.075, 0.1);
  }
  // The wings' flat, boarded ceilings under their gables, with joists.
  for (const side of [-1, 1]) {
    const from = side * (wing.inner + 0.2),
      to = side * inX;
    block(m.sark, Math.min(from, to), e - 0.03, halfD - 0.25, Math.max(from, to), e + 0.01, wing.jetty - 0.02);
    for (let i = 0; i < 7; i++) {
      const x = from + ((to - from) * (i + 0.5)) / 7;
      timber(m.oak, [x, e - 0.08, halfD - 0.1], [x, e - 0.08, wing.jetty - 0.18], 0.09, 0.1);
    }
    timber(m.oakDark, [from, e - 0.14, halfD - 0.06], [to, e - 0.14, halfD - 0.06], 0.2, 0.22);
  }
}

/** The gallery's door, standing open to the street. */
function galleryDoor(s, m) {
  const { group, box, cyl, torus } = s,
    w = 0.96,
    h = 2.02;
  const g = group(-0.5, U, halfD - 0.17, Math.PI * 0.46);
  box(m.oakDark, w / 2, h / 2, 0, w, h, 0.05, 0.006, g);
  for (let i = 1; i < 5; i++) box(m.oak, (w / 5) * i, h / 2, 0.028, 0.012, h - 0.05, 0.008, 0.002, g);
  for (const y of [0.34, 1.68]) box(m.iron, w * 0.42, y, 0.03, w * 0.76, 0.04, 0.01, 0.003, g);
  torus(m.iron, w * 0.86, 1.04, 0.04, 0.04, 0.007, g);
  cyl(m.iron, w * 0.86, 1.08, 0.03, 0.018, 0.012, 0.018, g, 8).rotation.x = Math.PI / 2;
  const sill = s.block(m.stoneDark, -0.5, U, halfD - 0.21, 0.5, U + 0.02, halfD + 0.01);
  sill.castShadow = false;
}

/** Everything else in the room: washstand, chests, rugs, drying rack, lamps. */
function dressing(s, m, props) {
  const { block, box, cyl, bar } = s;
  // The washstand by the stairhead: bowl, ewer, towel and a small glass.
  const w = LOFT.washstand;
  block(m.oak, w.x - 0.45, U + 0.76, w.z - 0.24, w.x + 0.45, U + 0.81, w.z + 0.24);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
    block(m.oakDark, w.x + dx * 0.4 - 0.025, U, w.z + dz * 0.2 - 0.025, w.x + dx * 0.4 + 0.025, U + 0.76, w.z + dz * 0.2 + 0.025);
  block(m.oakWarm, w.x - 0.4, U + 0.26, w.z - 0.2, w.x + 0.4, U + 0.29, w.z + 0.2);
  cyl(s.mat("#d9d6c5", 0.3), w.x - 0.1, U + 0.85, w.z, 0.11, 0.08, 0.19, undefined, 20);
  props.jug(w.x + 0.25, U + 0.81, w.z - 0.03, "#d9d6c5");
  box(m.linen, w.x + 0.45, U + 0.56, w.z, 0.02, 0.46, 0.24, 0.006);
  // The drying rack by the warm flue, with socks and a shirt.
  const r = LOFT.dryingRack;
  for (const dz of [-0.72, 0.72]) {
    block(m.oakDark, r.x - 0.2, U, r.z + dz - 0.02, r.x + 0.2, U + 0.05, r.z + dz + 0.02);
    block(m.oakDark, r.x - 0.025, U, r.z + dz - 0.025, r.x + 0.025, U + 1.5, r.z + dz + 0.025);
  }
  for (const y of [0.8, 1.1, 1.42]) bar(m.oakWarm, [r.x, U + y, r.z - 0.72], [r.x, U + y, r.z + 0.72], 0.03, 0.03);
  box(m.linen, r.x, U + 1.1, r.z - 0.32, 0.02, 0.62, 0.5, 0.005);
  for (const z of [0.12, 0.32, 0.5]) box(s.mat(z > 0.3 ? "#8a4f3f" : "#6f8a97", 0.97), r.x, U + 1.28, r.z + z, 0.02, 0.26, 0.1, 0.005);
  // Warm brick of the flue through the west gable's plaster, and a bench.
  block(m.brick, -inX - 0.02, U, -1.25, -inX + 0.13, PUB.eaves - 0.08, 1.25);
  // Sea chests, iron-bound.
  for (const c of LOFT.chests) {
    block(m.oakWarm, c.x - 0.42, U, c.z - 0.24, c.x + 0.42, U + 0.4, c.z + 0.24);
    const lid = cyl(m.oak, c.x, U + 0.4, c.z, 0.24, 0.84, 0.24, undefined, 12);
    lid.rotation.z = Math.PI / 2;
    lid.scale.z = 0.98;
    for (const dx of [-0.26, 0.26]) block(m.iron, c.x + dx - 0.02, U + 0.01, c.z - 0.25, c.x + dx + 0.02, U + 0.42, c.z + 0.25);
    box(m.iron, c.x, U + 0.3, c.z + 0.25, 0.08, 0.1, 0.012, 0.003);
  }
  // Woven runners along the two walkways.
  for (const [x, z, a, b, colour] of [
    [-1.3, 2.35, 6.6, 0.7, "#7d4a3e"],
    [-1.3, -2.3, 6.6, 0.7, "#4f6e73"],
    [3, 0, 0.9, 2.8, "#7a7a55"],
  ]) {
    const rug = box(s.mat(colour, 1), x, U + 0.012, z, a, 0.014, b, 0.004);
    rug.castShadow = false;
    block(m.linen, x - a / 2, U + 0.012, z - b / 2 + 0.05, x + a / 2, U + 0.021, z - b / 2 + 0.09).castShadow = false;
    block(m.linen, x - a / 2, U + 0.012, z + b / 2 - 0.09, x + a / 2, U + 0.021, z + b / 2 - 0.05).castShadow = false;
  }
  // Pegs along the rear wall, with coats and a lantern at the stairhead.
  for (let x = -6; x < 5; x += 2.2) {
    const pegZ = rearIn + 0.03;
    for (const dx of [-0.2, 0.2]) bar(m.oakDark, [x + dx, U + 1.8, pegZ - 0.02], [x + dx, U + 1.8, pegZ + 0.1], 0.024, 0.024);
  }
  box(s.mat("#40584f", 0.97), -3.8, U + 1.3, rearIn + 0.08, 0.34, 1.0, 0.06, 0.03);
  box(s.mat("#6b4a3a", 0.97), 0.6, U + 1.42, rearIn + 0.08, 0.34, 0.78, 0.06, 0.03);
  // A pair of hanging lanterns to read a bed by: flames for the study to flicker.
  const flames = [];
  for (const [x, z] of [[4.5, -1.75], [-3, 2.55], [-1.05, -2.15]]) {
    bar(m.iron, [x, PUB.eaves - 0.15, z], [x, U + 2.05, z], 0.012, 0.012);
    cyl(m.iron, x, U + 2.02, z, 0.1, 0.05, 0.04, undefined, 6);
    cyl(m.iron, x, U + 1.74, z, 0.08, 0.025, 0.08, undefined, 6);
    for (const [dx, dz] of [[-0.07, -0.07], [0.07, -0.07], [-0.07, 0.07], [0.07, 0.07]])
      box(m.iron, x + dx, U + 1.88, z + dz, 0.012, 0.26, 0.012, 0.003);
    flames.push(props.candle(x, U + 1.75, z));
    const shade = new T.Mesh(new T.BoxGeometry(0.15, 0.25, 0.15), m.glass);
    shade.position.set(x, U + 1.88, z);
    s.root.add(shade);
  }
  // The gallery's own small table and two chairs, for the morning's first ale.
  const t = LOFT.galleryTable;
  props.roundTable(t.x, t.z, 0.36, U);
  props.chair(t.x - 0.56, t.z + 0.06, Math.PI / 2 + 0.3, U);
  props.chair(t.x + 0.56, t.z - 0.1, -Math.PI / 2 - 0.2, U);
  props.tankard(t.x + 0.05, U + 0.765, t.z - 0.08, 2);
  props.jug(t.x - 0.16, U + 0.765, t.z + 0.1, "#b4725a");
  return flames;
}

/** Builds the loft and its roof frame; returns what breathes and flickers. */
export function buildLoft({ upper, roof }, m) {
  const props = createProps(upper, m),
    sleepers = [];
  LOFT.cots.forEach((c, i) => cot(upper, m, props, c, i, sleepers));
  LOFT.beds.forEach((b, i) => fourPoster(upper, m, b, i));
  rails(upper, m);
  galleryDoor(upper, m);
  const flames = dressing(upper, m, props);
  roofFrame(roof, m);
  return { sleepers, flames };
}
