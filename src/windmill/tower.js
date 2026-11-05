import * as T from "three";
import {
  FLOORS,
  FURNITURE as F,
  HURST,
  LADDERS,
  LADDER_HALF_WIDTH as HW,
  TOWER,
  WINDOWS,
  polar,
  wallRadius,
} from "./layout.js";
import { createBatch, quadsGeometry } from "./parts.js";

// Everything in the windmill that stays still: the stone shell and its openings,
// the cap's boards, the platforms with their rails and props, and the ladders.
// All set out from layout.js, and merged to one mesh per material.

const TAU = Math.PI * 2;

const OAK = "#927250",
  DARK = "#5f4834",
  PALE = "#b39570",
  BOARD = "#a4865f",
  ELM = "#7b6046",
  TAR = "#4b3c31",
  ROPE = "#b6a07a",
  FLAGS = "#b5ab97",
  IRON = "#46433e",
  SACKING = "#e0d3b7";

const { curb, wall } = TOWER;

/** A quad whose corners are reversed if its face points away from `n`. */
function facing(n, a, b, c, d) {
  const ux = b[0] - a[0],
    uy = b[1] - a[1],
    uz = b[2] - a[2],
    vx = d[0] - a[0],
    vy = d[1] - a[1],
    vz = d[2] - a[2],
    nx = uy * vz - uz * vy,
    ny = uz * vx - ux * vz,
    nz = ux * vy - uy * vx;
  return nx * n[0] + ny * n[1] + nz * n[2] >= 0 ? [a, b, c, d] : [d, c, b, a];
}

const insideNormals = (geometry) => {
  const p = geometry.attributes.position,
    n = geometry.attributes.normal,
    v = new T.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(-p.getX(i), Math.hypot(p.getX(i), p.getZ(i)) * 0.09, -p.getZ(i)).normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
  return geometry;
};

// The wall's inner face: a grid whose lines fall on the edges of the door and
// windows, leaving those cells out, so every opening has a clean edge.
function openings() {
  const list = WINDOWS.map((w) => {
    const half = w.w / 2 / wallRadius(w.y);
    return { ...w, a0: w.theta - half, a1: w.theta + half, y0: w.y - w.h / 2, y1: w.y + w.h / 2 };
  });
  const half = TOWER.door.width / 2 / wallRadius(0);
  list.push({ id: "door", theta: 0, a0: -half, a1: half, y0: 0, y1: TOWER.door.height });
  return list;
}
const wrapped = (a) => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;

function shell(stone) {
  const holes = openings().map((o) => ({ ...o, a0: wrapped(o.a0), a1: wrapped(o.a1) })),
    thetas = [],
    heights = [],
    quads = [];
  for (let i = 0; i <= 96; i++) thetas.push(-Math.PI + (i / 96) * TAU);
  for (let y = 0; y < curb; y += 0.6) heights.push(y);
  heights.push(curb);
  for (const h of holes) {
    thetas.push(h.a0, h.a1);
    heights.push(h.y0, h.y1);
  }
  thetas.sort((a, b) => a - b);
  heights.sort((a, b) => a - b);
  const U = 3.4;
  for (let i = 0; i < thetas.length - 1; i++) {
    const a = thetas[i],
      b = thetas[i + 1];
    if (b - a < 1e-5) continue;
    for (let j = 0; j < heights.length - 1; j++) {
      const y0 = heights[j],
        y1 = heights[j + 1];
      if (y1 - y0 < 1e-5) continue;
      const midA = (a + b) / 2,
        midY = (y0 + y1) / 2;
      if (holes.some((h) => midA > h.a0 && midA < h.a1 && midY > h.y0 && midY < h.y1)) continue;
      const corner = (t, y) => {
        const { x, z } = polar(wallRadius(y), t);
        return [x, y, z, t * U, y];
      };
      quads.push(
        facing([-Math.sin(midA), 0, -Math.cos(midA)], corner(a, y0), corner(b, y0), corner(b, y1), corner(a, y1)),
      );
    }
  }
  // Damp low down, paler up the well where the flour has settled in the courses.
  const shade = (x, y, z) => {
    const a = Math.atan2(x, z);
    return (
      0.83 +
      0.12 * Math.min(1, y / 5) +
      0.05 * Math.sin(a * 7 + y * 0.9) * Math.sin(a * 3 - y * 1.7) -
      0.05 * Math.exp(-y * 3)
    );
  };
  stone.piece(insideNormals(quadsGeometry(quads, "#ece4d2", shade)));

  // Each opening's reveal through the wall's thickness, splayed a little.
  for (const h of openings()) {
    const out = (t, y) => polar(wallRadius(y) + wall, t),
      inn = (t, y) => polar(wallRadius(y), t),
      p = (o, t, y, u, v) => [o(t, y).x, y, o(t, y).z, u, v],
      depth = wall,
      span = h.y1 - h.y0,
      across = (h.a1 - h.a0) * wallRadius(h.y0),
      tangent = (t) => [Math.cos(t), 0, -Math.sin(t)],
      n0 = tangent(h.a0),
      n1 = tangent(h.a1).map((v) => -v),
      rd = [];
    rd.push(
      facing(n0, p(inn, h.a0, h.y0, 0, 0), p(out, h.a0, h.y0, depth, 0), p(out, h.a0, h.y1, depth, span), p(inn, h.a0, h.y1, 0, span)),
      facing(n1, p(inn, h.a1, h.y0, 0, 0), p(out, h.a1, h.y0, depth, 0), p(out, h.a1, h.y1, depth, span), p(inn, h.a1, h.y1, 0, span)),
      facing([0, -1, 0], p(inn, h.a0, h.y1, 0, 0), p(inn, h.a1, h.y1, across, 0), p(out, h.a1, h.y1, across, depth), p(out, h.a0, h.y1, 0, depth)),
    );
    if (h.y0 > 0)
      rd.push(
        facing([0, 1, 0], p(inn, h.a0, h.y0, 0, 0), p(inn, h.a1, h.y0, across, 0), p(out, h.a1, h.y0, across, depth), p(out, h.a0, h.y0, 0, depth)),
      );
    stone.piece(quadsGeometry(rd, "#d9d1be"));
  }

  // The ground floor's flags, and a drift of flour under each spout.
  {
    const rings = 7,
      segments = 56,
      flagQuads = [],
      R = wallRadius(0) + 0.05,
      spouts = HURST.stones.map(({ theta }) => polar(1.55, theta));
    const point = (r, a) => {
      const { x, z } = polar(r, a);
      return [x, 0, z, x * 0.78, z * 0.78];
    };
    for (let i = 0; i < rings; i++)
      for (let j = 0; j < segments; j++) {
        const r0 = (i / rings) * R,
          r1 = ((i + 1) / rings) * R,
          a0 = (j / segments) * TAU,
          a1 = ((j + 1) / segments) * TAU;
        flagQuads.push(facing([0, 1, 0], point(r0, a0), point(r1, a0), point(r1, a1), point(r0, a1)));
      }
    const flour = (x, _y, z) => {
      let v = 0;
      for (const s of spouts) v = Math.max(v, Math.exp(-((x - s.x) ** 2 + (z - s.z) ** 2) * 1.5));
      const r = Math.hypot(x, z);
      return 0.92 + v * 0.42 - Math.max(0, r - 3.2) * 0.28;
    };
    stone.piece(quadsGeometry(flagQuads, FLAGS, flour));
  }
}

// The cap from below: a dome of tarred boards on curved ribs, sitting on a curb
// of oak with iron rollers.
function cap(wood, iron) {
  const R = wallRadius(curb) + 0.32,
    H = TOWER.cap,
    profile = (t) => [R * Math.cos((t * Math.PI) / 2) ** 0.8, curb + t * H],
    quads = [],
    rings = 9,
    segments = 32;
  const corner = (t, a) => {
    const [r, y] = profile(t),
      { x, z } = polar(r, a);
    return [x, y, z, y * 1.4, a * R * 0.9];
  };
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < segments; j++) {
      const t0 = i / rings,
        t1 = (i + 1) / rings,
        a0 = (j / segments) * TAU,
        a1 = ((j + 1) / segments) * TAU,
        mid = (a0 + a1) / 2;
      quads.push(
        facing([-Math.sin(mid), -0.3, -Math.cos(mid)], corner(t0, a0), corner(t0, a1), corner(t1, a1), corner(t1, a0)),
      );
    }
  wood.piece(quadsGeometry(quads, "#856a4c", (x, y, z) => 0.88 + 0.16 * Math.sin(Math.atan2(x, z) * 32)));
  // Ribs follow the dome inward from the curb.
  const ribs = 12;
  for (let n = 0; n < ribs; n++) {
    const a = (n / ribs) * TAU + 0.1;
    for (let i = 0; i < 8; i++) {
      const [r0, y0] = profile(i / 8),
        [r1, y1] = profile((i + 1) / 8),
        p0 = polar(r0 - 0.06, a),
        p1 = polar(r1 - 0.06, a);
      wood.beam(DARK, [p0.x, y0, p0.z], [p1.x, y1, p1.z], 0.09, 0.09, { roll: -a });
    }
  }
  // The curb ring, a string of rollers, and a sprattle beam for the shaft's neck.
  const ring = (radius, y, hex, w, h) => {
    const count = 28;
    for (let n = 0; n < count; n++) {
      const a = (n / count) * TAU,
        p = polar(radius, a + TAU / count / 2);
      wood.box(hex, p.x, y, p.z, (TAU / count) * radius + 0.05, h, w, { ry: a + TAU / count / 2 });
    }
  };
  ring(wallRadius(curb) + 0.06, curb - 0.02, OAK, 0.34, 0.2);
  ring(wallRadius(curb) + 0.1, curb + 0.2, DARK, 0.26, 0.15);
  for (let n = 0; n < 16; n++) {
    const a = (n / 16) * TAU,
      p = polar(wallRadius(curb) - 0.02, a);
    iron.drum(IRON, p.x, curb + 0.1, p.z, 0.05, 0.14, { segments: 8 });
  }
  const across = TOWER.shaftTheta + Math.PI / 2,
    a = polar(wallRadius(curb) + 0.3, across),
    b = polar(wallRadius(curb) + 0.3, across + Math.PI);
  wood.beam(DARK, [a.x, curb + 0.42, a.z], [b.x, curb + 0.42, b.z], 0.18, 0.24, { roll: -across });
  iron.drum(IRON, 0, curb + 0.42, 0, 0.21, 0.34, { segments: 12 });
}

function door(wood, iron) {
  const { width, height } = TOWER.door,
    r = wallRadius(0) + wall - 0.1;
  wood.placed(0, 0, r, 0, () => {
    const planks = 5,
      w = width / planks;
    for (let i = 0; i < planks; i++)
      wood.box(i % 2 ? "#6d5540" : "#775d45", -width / 2 + w * (i + 0.5), height / 2, 0, w - 0.008, height, 0.07);
    for (const y of [0.4, height - 0.42]) wood.box(DARK, 0, y, -0.05, width - 0.06, 0.13, 0.04);
    wood.beam(DARK, [-width / 2 + 0.1, 0.46, -0.052], [width / 2 - 0.12, height - 0.48, -0.052], 0.1, 0.035);
  });
  iron.placed(0, 0, r, 0, () => {
    for (const y of [0.4, height - 0.42]) {
      iron.box(IRON, width / 2 - 0.28, y, -0.08, 0.5, 0.05, 0.012);
      iron.ball(IRON, width / 2 - 0.02, y, -0.075, 0.03, 0.03, 0.02, { detail: 6 });
    }
    iron.drum(IRON, -width / 2 + 0.16, 1.08, -0.11, 0.055, 0.015, { rx: Math.PI / 2, segments: 12 });
    iron.ball(IRON, -width / 2 + 0.16, 1.02, -0.1, 0.04, 0.04, 0.012, { detail: 8 });
  });
  // A lintel and door jambs in the wall's face.
  const inner = wallRadius(TOWER.door.height);
  wood.placed(0, 0, inner, 0, () => {
    wood.box(DARK, 0, height + 0.11, 0.04, width + 0.5, 0.22, 0.2, {});
    for (const s of [-1, 1]) wood.box(DARK, s * (width / 2 + 0.08), height / 2, 0.02, 0.15, height, 0.16);
  });
}

function windows(wood, stone, glass) {
  for (const w of WINDOWS) {
    const r = wallRadius(w.y) + wall - 0.12,
      inner = wallRadius(w.y - w.h / 2);
    const at = polar(r, w.theta);
    wood.placed(at.x, w.y, at.z, w.theta, () => {
      const hw = w.w / 2,
        hh = w.h / 2,
        f = 0.05;
      wood.box(DARK, 0, hh - f / 2, 0, w.w, f, 0.07);
      wood.box(DARK, 0, -hh + f / 2, 0, w.w, f, 0.07);
      wood.box(DARK, -hw + f / 2, 0, 0, f, w.h, 0.07);
      wood.box(DARK, hw - f / 2, 0, 0, f, w.h, 0.07);
      wood.box(DARK, 0, 0, 0, 0.03, w.h, 0.04);
      wood.box(DARK, 0, hh * 0.32, 0, w.w, 0.022, 0.03);
      wood.box(DARK, 0, -hh * 0.34, 0, w.w, 0.022, 0.03);
    });
    glass.placed(at.x, w.y, at.z, w.theta, () => {
      glass.box("#ffffff", 0, 0, 0.012, w.w - 0.06, w.h - 0.06, 0.008, { r: 0 });
    });
    // A deep stone sill and an oak lintel on the room's side of the wall.
    const sill = polar(inner + 0.03, w.theta);
    stone.placed(sill.x, w.y - w.h / 2 - 0.05, sill.z, w.theta, () => {
      stone.box("#c4bba7", 0, 0.012, 0.1, w.w + 0.28, 0.1, 0.42);
    });
    const lintel = polar(wallRadius(w.y + w.h / 2) + 0.02, w.theta);
    wood.placed(lintel.x, w.y + w.h / 2 + 0.092, lintel.z, w.theta, () => {
      wood.box(DARK, 0, 0, 0.04, w.w + 0.42, 0.16, 0.2);
    });
  }
}

// One board of a curved deck, running from the rail out to the wall.
function deckBoard(wood, hex, a0, a1, r0, r1, y, thick) {
  const s = wood.random() * 3;
  const c = (r, a, h, u, v) => {
    const p = polar(r, a);
    return [p.x, h, p.z, u + s, v + s];
  };
  const top = y,
    low = y - thick,
    w0 = a0 * r1,
    w1 = a1 * r1,
    mid = (a0 + a1) / 2;
  const quads = [
    facing([0, 1, 0], c(r0, a0, top, r0, w0), c(r1, a0, top, r1, w0), c(r1, a1, top, r1, w1), c(r0, a1, top, r0, w1)),
    facing([0, -1, 0], c(r0, a0, low, r0, w0), c(r1, a0, low, r1, w0), c(r1, a1, low, r1, w1), c(r0, a1, low, r0, w1)),
    facing([-Math.sin(mid), 0, -Math.cos(mid)], c(r0, a0, low, 0, w0), c(r0, a1, low, 0, w1), c(r0, a1, top, thick, w1), c(r0, a0, top, thick, w0)),
    facing([-Math.cos(a0), 0, Math.sin(a0)], c(r0, a0, low, r0, 0), c(r1, a0, low, r1, 0), c(r1, a0, top, r1, thick), c(r0, a0, top, r0, thick)),
    facing([Math.cos(a1), 0, -Math.sin(a1)], c(r0, a1, low, r0, 0), c(r1, a1, low, r1, 0), c(r1, a1, top, r1, thick), c(r0, a1, top, r0, thick)),
  ];
  wood.piece(quadsGeometry(quads, hex), null);
}

function railRun(wood, points, y, { top = 1.02, posts = true, lastPost = true } = {}) {
  points.forEach(([x, z], i) => {
    if (posts && (lastPost || i < points.length - 1)) wood.box(OAK, x, y + top / 2, z, 0.075, top + 0.04, 0.075);
    if (i === points.length - 1) return;
    const [x1, z1] = points[i + 1];
    wood.beam(PALE, [x, y + top, z], [x1, y + top, z1], 0.07, 0.05);
    wood.beam(OAK, [x, y + top * 0.56, z], [x1, y + top * 0.56, z1], 0.05, 0.04);
  });
}

const arcPoints = (r, a0, a1, step = 0.8) => {
  const n = Math.max(1, Math.ceil((Math.abs(a1 - a0) * r) / step)),
    points = [];
  for (let i = 0; i <= n; i++) {
    const p = polar(r, a0 + ((a1 - a0) * i) / n);
    points.push([p.x, p.z]);
  }
  return points;
};

function crescent(wood, f, ladderBelow) {
  const R = wallRadius(f.y) + 0.06,
    width = 0.27,
    span = f.end - f.start,
    mid = (R + f.inner) / 2,
    count = Math.max(4, Math.round((span * mid) / width));
  for (let i = 0; i < count; i++) {
    const a0 = f.start + (i / count) * span,
      a1 = a0 + span / count - 0.006,
      hex = [BOARD, "#9b7e58", "#ab8c64", "#96795a"][Math.floor(wood.random() * 4)];
    deckBoard(wood, hex, a0, a1, f.inner, R, f.y, 0.07);
  }
  // Joists under the boards, into the wall; every other one on a knee brace.
  const joists = Math.max(3, Math.round((span * mid) / 0.8));
  for (let i = 0; i <= joists; i++) {
    const a = f.start + 0.03 + (i / joists) * (span - 0.06),
      p0 = polar(f.inner + 0.03, a),
      p1 = polar(R + 0.04, a);
    wood.beam(ELM, [p0.x, f.y - 0.15, p0.z], [p1.x, f.y - 0.15, p1.z], 0.09, 0.15, { roll: -a });
    if (i % 2 === 0) {
      const w0 = polar(wallRadius(f.y - 1.05) + 0.02, a),
        w1 = polar(mid + 0.1, a);
      wood.beam(DARK, [w0.x, f.y - 1.05, w0.z], [w1.x, f.y - 0.22, w1.z], 0.085, 0.085, { roll: -a });
    }
  }
  // The rim beam the rail stands on.
  const rim = arcPoints(f.inner + 0.03, f.start, f.end, 0.5);
  for (let i = 0; i < rim.length - 1; i++)
    wood.beam(DARK, [rim[i][0], f.y - 0.1, rim[i][1]], [rim[i + 1][0], f.y - 0.1, rim[i + 1][1]], 0.08, 0.13);
  // Rails along the well, leaving the gangway's mouth open, and across each end.
  const edge = f.inner + 0.035;
  if (f.gangway) {
    const open = f.gangway.halfWidth / edge;
    railRun(wood, arcPoints(edge, f.start, f.gangway.theta - open), f.y);
    railRun(wood, arcPoints(edge, f.gangway.theta + open, f.end), f.y);
  } else railRun(wood, arcPoints(edge, f.start, f.end), f.y);
  const end = (r0, r1, a) => {
    const p0 = polar(r0, a),
      p1 = polar(r1, a);
    railRun(wood, [[p0.x, p0.z], [p1.x, p1.z]], f.y);
  };
  end(edge, R - 0.08, f.end);
  const head = Math.hypot(ladderBelow.head.x, ladderBelow.head.z);
  end(edge, head - HW - 0.04, f.start);
  end(head + HW + 0.04, R - 0.08, f.start);
}

// The round deck in the well that holds the stones, and its gangway.
function stoneDeck(wood, iron, f) {
  const { deck, gangway } = f,
    t = gangway.theta,
    y = f.y;
  // Boards fanned out from the shaft, as on the crescents, with a rim to hide
  // their ends from below.
  const boards = 26;
  for (let i = 0; i < boards; i++) {
    const a0 = (i / boards) * TAU,
      a1 = a0 + TAU / boards - 0.006;
    deckBoard(wood, ["#a98a62", BOARD, "#9c7f59"][Math.floor(wood.random() * 3)], a0, a1, 0.1, deck.r, y, 0.07);
  }
  const rim = arcPoints(deck.r - 0.03, 0, TAU, 0.42);
  for (let i = 0; i < rim.length - 1; i++)
    wood.beam(DARK, [rim[i][0], y - 0.11, rim[i][1]], [rim[i + 1][0], y - 0.11, rim[i + 1][1]], 0.08, 0.15);
  wood.placed(0, y, 0, t, () => {
    // The gangway's boards run across it, out to the crescent.
    for (let z = deck.r - 0.14; z < f.inner + 0.12; z += 0.26)
      wood.box(BOARD, 0, -0.035, z, gangway.halfWidth * 2, 0.07, 0.25, { r: 0.006 });
    for (const s of [-1, 1]) wood.box(ELM, s * (gangway.halfWidth - 0.05), -0.13, (deck.r + f.inner) / 2, 0.1, 0.14, f.inner - deck.r + 0.5);
    // Joists under the round deck.
    for (const x of [-1.05, -0.55, 0, 0.55, 1.05])
      wood.box(ELM, x, -0.17, 0, 0.11, 0.17, 2 * Math.sqrt(deck.r * deck.r - x * x) - 0.14);
  });
  // A rail round the deck, from one side of the gangway all the way to the other.
  const open = (gangway.halfWidth + 0.02) / (deck.r - 0.04);
  railRun(wood, arcPoints(deck.r - 0.035, t + open, t + TAU - open, 0.7), y);
  // And along the gangway's sides.
  for (const s of [-1, 1]) {
    const p = (r) => {
      const c = polar(r, t),
        off = s * gangway.halfWidth;
      return [c.x + Math.cos(t) * off, c.z - Math.sin(t) * off];
    };
    railRun(wood, [p(deck.r - 0.04), p(f.inner + 0.03)], y);
  }
  // The four great posts of the hurst from the flags to the deck, and bracing.
  const top = y - 0.24,
    legs = HURST.legs.map(({ r, theta }) => polar(r, theta));
  legs.forEach((leg, i) => {
    wood.box(DARK, leg.x, top / 2, leg.z, 0.2, top, 0.2);
    wood.box("#a59a84", leg.x, 0.06, leg.z, 0.3, 0.12, 0.3, { r: 0.02 });
    const next = legs[(i + 1) % legs.length];
    wood.beam(DARK, [leg.x, top, leg.z], [next.x, top, next.z], 0.17, 0.2);
    const toward = polar(1.2 * 0.68, HURST.legs[i].theta + 0.55);
    wood.beam(ELM, [leg.x, top - 0.72, leg.z], [toward.x, top - 0.02, toward.z], 0.08);
    const away = polar(1.2 * 0.68, HURST.legs[i].theta - 0.55);
    wood.beam(ELM, [leg.x, top - 0.72, leg.z], [away.x, top - 0.02, away.z], 0.08);
  });
  iron.drum(IRON, 0, y + 0.02, 0, 0.24, 0.05, { segments: 14 });
  wood.box("#857257", 0, 0.1, 0, 0.62, 0.2, 0.62, { r: 0.03 });
  iron.drum(IRON, 0, 0.21, 0, 0.2, 0.06, { segments: 14 });
}

function ladder(wood, iron, l) {
  const y0 = FLOORS[l.from].y,
    at = (t, s) => [
      l.foot.x + (l.head.x - l.foot.x) * t + l.side.x * s,
      y0 + l.rise * t,
      l.foot.z + (l.head.z - l.foot.z) * t + l.side.z * s,
    ],
    over = 1 + 0.95 / l.rise,
    yaw = Math.atan2(l.axis.x, l.axis.z);
  for (const s of [-HW, HW]) {
    wood.beam(OAK, at(0, s), at(over, s), 0.055, 0.12, { roll: -yaw });
    // Worn pale where hands take them, over the deck.
    wood.beam(PALE, at(1 + 0.45 / l.rise, s), at(over, s), 0.06, 0.125, { roll: -yaw });
    const foot = at(0, s);
    wood.box(DARK, foot[0], foot[1] + 0.03, foot[2], 0.1, 0.06, 0.2, { ry: yaw });
  }
  for (let i = 1; i < l.rungs + 1; i++) {
    const t = (i - 0.05) / l.rungs,
      a = at(t, -HW - 0.01),
      b = at(t, HW + 0.01);
    wood.beam(i % 3 ? PALE : "#a68a64", a, b, 0.048, 0.048, { r: 0.022, vary: 0.1 });
  }
}

function sack(cloth, x, y, z, { ry = 0, rx = 0, rz = 0, hex = SACKING, lying = false } = {}) {
  const geometry = new T.SphereGeometry(1, 18, 12),
    p = geometry.attributes.position,
    uv = geometry.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const py = p.getY(i),
      bulge = 1 - 0.32 * py * py * py * py,
      sx = p.getX(i) * bulge * 0.25,
      sz = p.getZ(i) * bulge * 0.19,
      lump = 1 + 0.035 * Math.sin(py * 5 + Math.atan2(p.getX(i), p.getZ(i)) * 3);
    p.setXYZ(i, sx * lump, py * 0.36, sz * lump);
    uv.setXY(i, uv.getX(i) * 1.6, uv.getY(i) * 0.85);
  }
  geometry.computeVertexNormals();
  const m = new T.Matrix4().compose(
    new T.Vector3(x, y, z),
    new T.Quaternion().setFromEuler(new T.Euler(lying ? Math.PI / 2 + rx : rx, ry, rz, "YXZ")),
    new T.Vector3(1, 1, 1),
  );
  geometry.applyMatrix4(m);
  cloth.piece(geometry, hex);
  // The tied neck.
  const neck = new T.Vector3(0, 0.37, 0).applyMatrix4(m);
  const tuft = new T.Vector3(0, 0.43, 0).applyMatrix4(m);
  cloth.ball(ROPE, neck.x, neck.y, neck.z, 0.045, 0.025, 0.045, { detail: 8 });
  cloth.ball(hex, tuft.x, tuft.y, tuft.z, 0.065, 0.05, 0.055, { detail: 8 });
}

function mealFloor(wood, iron, cloth) {
  // The stack of finished flour left of the door.
  {
    const { x, z } = polar(F.sacks.r, F.sacks.theta);
    wood.placed(x, 0, z, F.sacks.theta, () => {
      wood.box(ELM, 0, 0.05, 0, 1.15, 0.1, 0.95);
    });
    const a = F.sacks.theta,
      cos = Math.cos(a),
      sin = Math.sin(a),
      lay = (u, y, v, ry) => sack(cloth, x + u * cos + v * sin, y, z - u * sin + v * cos, { ry: a + ry, lying: true });
    lay(-0.27, 0.28, -0.2, 0.08);
    lay(0.27, 0.28, -0.2, -0.05);
    lay(-0.27, 0.28, 0.22, -0.06);
    lay(0.27, 0.28, 0.22, 0.1);
    lay(-0.04, 0.61, -0.1, Math.PI / 2 + 0.1);
    lay(-0.02, 0.61, 0.2, Math.PI / 2 - 0.08);
    sack(cloth, x + 0.05, 1.12, z - 0.02, { ry: 1.1, rz: 0.08 });
  }
  // The miller's desk under the window, slanted top, ledger open.
  {
    const { x, z } = polar(F.desk.r, F.desk.theta);
    wood.placed(x, 0, z, F.desk.theta + Math.PI, () => {
      for (const sx of [-0.5, 0.5]) for (const sz of [-0.23, 0.23]) wood.box(DARK, sx, 0.42, sz, 0.07, 0.84, 0.07);
      wood.box(OAK, 0, 0.87, 0, 1.15, 0.05, 0.56, { rx: 0.14 });
      wood.box(DARK, 0, 0.3, -0.2, 1.04, 0.06, 0.06);
      // A stool.
      wood.drum(OAK, 0.05, 0.56, -0.62, 0.17, 0.05, { segments: 14 });
      for (let n = 0; n < 3; n++) {
        const a = (n / 3) * TAU + 0.4;
        wood.beam(DARK, [0.05 + Math.sin(a) * 0.1, 0.54, -0.62 + Math.cos(a) * 0.1], [0.05 + Math.sin(a) * 0.2, 0, -0.62 + Math.cos(a) * 0.2], 0.035);
      }
    });
    cloth.placed(x, 0, z, F.desk.theta + Math.PI, () => {
      cloth.box("#efe5c9", -0.2, 0.925, 0.01, 0.28, 0.025, 0.36, { rx: 0.14, r: 0.004, vary: 0.02 });
      cloth.box("#ece0c2", 0.09, 0.925, 0.01, 0.28, 0.025, 0.36, { rx: 0.14, r: 0.004, vary: 0.02 });
      cloth.box("#7d5d38", -0.05, 0.905, 0.01, 0.6, 0.012, 0.39, { rx: 0.14, r: 0.003, vary: 0.02 });
    });
    iron.placed(x, 0, z, F.desk.theta + Math.PI, () => {
      iron.drum("#2a2a30", 0.42, 0.93, -0.11, 0.035, 0.05, { rt: 0.025, segments: 10 });
    });
  }
  // A sack barrow with one sack on it.
  {
    const { x, z } = polar(F.barrow.r, F.barrow.theta);
    wood.placed(x, 0, z, F.barrow.theta + 0.5, () => {
      for (const s of [-0.17, 0.17]) {
        wood.beam(ELM, [s, 0.14, 0.1], [s, 1.2, -0.28], 0.05);
        wood.drum(DARK, s * 1.3, 0.14, 0.12, 0.14, 0.05, { rz: Math.PI / 2, segments: 16 });
      }
      for (const t of [0.3, 0.7]) wood.box(ELM, 0, 0.14 + t * 1.06, 0.1 - t * 0.38, 0.36, 0.04, 0.05);
      wood.box(DARK, 0, 0.08, 0.2, 0.4, 0.035, 0.3);
    });
    const lean = polar(F.barrow.r, F.barrow.theta);
    sack(cloth, lean.x + 0.1 * Math.sin(F.barrow.theta + 0.5), 0.6, lean.z + 0.1 * Math.cos(F.barrow.theta + 0.5), { ry: F.barrow.theta + 0.5, rx: -0.3 });
  }
  // The sack scale: a post, an iron arm and a plate.
  {
    const { x, z } = polar(F.scale.r, F.scale.theta);
    wood.placed(x, 0, z, F.scale.theta + Math.PI, () => {
      wood.box(DARK, 0, 0.82, -0.22, 0.13, 1.64, 0.13);
      wood.box(ELM, 0, 0.09, 0.07, 0.72, 0.09, 0.72);
      wood.box(PALE, 0, 0.16, 0.07, 0.62, 0.04, 0.62);
    });
    iron.placed(x, 0, z, F.scale.theta + Math.PI, () => {
      iron.box(IRON, 0, 1.5, 0.05, 0.03, 0.05, 0.72, { rx: -0.05 });
      iron.drum(IRON, 0, 1.0, 0.4, 0.008, 1.0, { segments: 6 });
      iron.ball("#6d675c", 0, 0.42, 0.4, 0.065, 0.09, 0.065, { detail: 10 });
    });
  }
  // Crates of samples and a scoop against the back wall.
  {
    const { x, z } = polar(F.crates.r, F.crates.theta);
    wood.placed(x, 0, z, F.crates.theta + Math.PI, () => {
      const crate = (cx, cy, cz, s, ry) => {
        for (let i = 0; i < 4; i++) {
          wood.box(PALE, cx, cy + s * (0.14 + i * 0.25) * 0.82, cz + s / 2, s, s * 0.17, 0.02, { ry });
          wood.box(PALE, cx, cy + s * (0.14 + i * 0.25) * 0.82, cz - s / 2, s, s * 0.17, 0.02, { ry });
        }
        wood.box(OAK, cx - s / 2, cy + s * 0.42, cz, 0.04, s * 0.84, s, { ry });
        wood.box(OAK, cx + s / 2, cy + s * 0.42, cz, 0.04, s * 0.84, s, { ry });
        wood.box("#9c7e58", cx, cy + s * 0.04, cz, s, 0.03, s, { ry });
      };
      crate(-0.26, 0, 0, 0.58, 0);
      crate(0.32, 0, 0.04, 0.46, 0);
      crate(-0.24, 0.5, 0.02, 0.4, 0);
      wood.box("#d8bd86", 0.32, 0.34, 0.04, 0.42, 0.02, 0.42, { vary: 0.03 });
    });
  }
  // Meal spouts from the stones to two sacks on the flags.
  for (const { theta } of HURST.stones) {
    const under = polar(1.0, theta),
      over = polar(HURST.spout, theta);
    wood.beam(ELM, [under.x, 2.62, under.z], [over.x, 0.98, over.z], 0.12, 0.12, { roll: -theta });
    wood.box(DARK, over.x, 0.96, over.z, 0.16, 0.08, 0.16, { ry: theta });
    iron.drum(IRON, over.x, 0.91, over.z, 0.1, 0.025, { segments: 12 });
    wood.placed(over.x, 0, over.z, theta, () => {
      wood.box(ELM, 0, 0.07, 0, 0.46, 0.14, 0.46);
    });
    sack(cloth, over.x, 0.5, over.z, { ry: theta + 0.4 });
  }
}

function stoneFloor(wood, iron, cloth, stone, faceMaterial, group) {
  // The two pairs of stones, in their round tuns on the deck.
  const y = FLOORS[1].y;
  HURST.stones.forEach(({ r, theta }, n) => {
    const { x, z } = polar(r, theta);
    const open = n === 1;
    // Staves and iron hoops.
    const staves = 22;
    for (let i = 0; i < staves; i++) {
      const a = (i / staves) * TAU,
        px = x + Math.sin(a) * HURST.tun,
        pz = z + Math.cos(a) * HURST.tun;
      wood.box(i % 2 ? OAK : "#876a4a", px, y + 0.2, pz, 0.122, 0.4, 0.035, { ry: a });
    }
    for (const h of [0.08, 0.33]) iron.drum(IRON, x, y + h, z, HURST.tun + 0.025, 0.035, { segments: 24, open: true });
    // The bedstone sits still inside. The runner above it is in machinery.js.
    stone.drum("#a5a091", x, y + 0.1, z, HURST.tun - 0.02, 0.2, { segments: 24 });
    if (open) {
      // The cover stands propped against the tun.
      const lid = polar(r + 0.0, theta + 0.72);
      wood.drum(OAK, lid.x, y + 0.34, lid.z, 0.38, 0.05, { rx: 1.12, ry: theta + 0.72, segments: 18 });
    } else {
      wood.drum(OAK, x, y + 0.41, z, HURST.tun + 0.03, 0.05, { segments: 24 });
      // The horse, the hopper and its shoe.
      const ry = theta;
      wood.placed(x, y + 0.43, z, ry, () => {
        for (const sx of [-0.24, 0.24])
          for (const sz of [-0.24, 0.24]) wood.beam(DARK, [sx, 0, sz], [sx * 0.72, 0.56, sz * 0.72], 0.05);
        const hopper = 4;
        wood.drum("#a4835c", 0, 0.8, 0, 0.1, 0.46, { rt: 0.36, segments: hopper, ry: Math.PI / 4 });
        wood.box(ELM, 0, 0.55, 0, 0.44, 0.04, 0.44);
        wood.box(PALE, 0.02, 0.22, 0.08, 0.13, 0.04, 0.42, { rx: 0.22 });
      });
      wood.placed(x, y + 0.43, z, ry, () => {
        wood.drum("#d8bd86", 0, 1.03, 0, 0.36 * 0.96, 0.012, { segments: 4, ry: Math.PI / 4, vary: 0.02 });
      });
    }
  });
  // The furrowed face of the spare stone, leaning at the wall.
  {
    const { x, z } = polar(F.spareStone.r, F.spareStone.theta);
    stone.drum("#b0aa9b", x, y + 0.5, z, 0.48, 0.16, { rx: Math.PI / 2 - 0.24, ry: F.spareStone.theta + Math.PI, segments: 26 });
    const face = new T.Mesh(new T.CircleGeometry(0.47, 28), faceMaterial),
      out = polar(0.09, F.spareStone.theta + Math.PI);
    face.position.set(x + out.x, y + 0.52, z + out.z);
    face.rotation.order = "YXZ";
    face.rotation.set(-0.24, F.spareStone.theta + Math.PI, 0);
    face.castShadow = false;
    face.receiveShadow = true;
    group.add(face);
    iron.drum(IRON, x, y + 0.5, z, 0.49, 0.05, { rx: Math.PI / 2 - 0.24, ry: F.spareStone.theta + Math.PI, segments: 26, open: true });
  }
  // The stone crane, and the mill bills hung beside it.
  {
    const { x, z } = polar(F.crane.r, F.crane.theta);
    wood.drum(DARK, x, y + 1.15, z, 0.1, 2.3, { segments: 10 });
    const inward = polar(F.crane.r - 1.0, F.crane.theta);
    wood.beam(OAK, [x, y + 1.9, z], [inward.x, y + 2.05, inward.z], 0.1, 0.12);
    wood.beam(ELM, [x, y + 1.1, z], [(x + inward.x) / 2, y + 1.98, (z + inward.z) / 2], 0.07);
    iron.drum(IRON, inward.x, y + 1.7, inward.z, 0.018, 0.68, { segments: 8 });
    iron.drum(IRON, inward.x, y + 1.35, inward.z, 0.06, 0.05, { segments: 10, rx: Math.PI / 2 });
    const rack = polar(wallRadius(y + 1.4) - 0.03, F.crane.theta + 0.32);
    wood.placed(rack.x, y + 1.42, rack.z, F.crane.theta + 0.32, () => {
      wood.box(OAK, 0, 0, 0.015, 0.7, 0.07, 0.03);
    });
    iron.placed(rack.x, y + 1.42, rack.z, F.crane.theta + 0.32, () => {
      for (const s of [-0.22, 0, 0.22]) {
        iron.box(IRON, s, -0.24, -0.015, 0.03, 0.42, 0.02);
        iron.box("#6c6a64", s, -0.46, -0.015, 0.16, 0.035, 0.03);
      }
    });
  }
}

function binFloor(wood, cloth, iron) {
  const y = FLOORS[2].y;
  for (const b of F.bins) {
    const { x, z } = polar(b.r, b.theta);
    wood.placed(x, y, z, b.theta, () => {
      const w = b.w,
        d = b.d,
        h = 1.18;
      for (let i = 0; i < 6; i++) {
        const py = 0.1 + i * 0.2;
        wood.box(i % 2 ? OAK : "#876a4a", 0, py, -d / 2, w, 0.19, 0.03);
        wood.box("#7e6246", -w / 2, py, 0, 0.03, 0.19, d);
        wood.box("#7e6246", w / 2, py, 0, 0.03, 0.19, d);
      }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) wood.box(DARK, (sx * w) / 2, h / 2, (sz * d) / 2, 0.06, h + 0.02, 0.06);
      wood.box(DARK, 0, h + 0.01, -d / 2, w + 0.04, 0.04, 0.06);
    });
    cloth.placed(x, y, z, b.theta, () => {
      // The grain, heaped a little in the middle.
      cloth.ball("#d9b978", 0, 1.03, 0, b.w * 0.49, 0.12, b.d * 0.47, { detail: 18, vary: 0.02 });
    });
  }
  // A scoop left on the first bin's edge, a grain sack waiting beside the rail.
  const scoop = polar(F.bins[0].r - 0.28, F.bins[0].theta + 0.08);
  iron.drum("#8d8879", scoop.x, y + 1.19, scoop.z, 0.05, 0.14, { rz: Math.PI / 2 - 0.25, ry: F.bins[0].theta, segments: 10 });
  const waiting = polar(F.bins[1].r - 0.0, F.bins[1].theta + 0.42);
  sack(cloth, waiting.x, y + 0.42, waiting.z, { ry: 0.7, hex: "#cdbf9c" });
}

function seatLanding(wood, cloth) {
  const y = FLOORS[3].y,
    { x, z } = polar(F.seat.r, F.seat.theta);
  wood.placed(x, y, z, F.seat.theta, () => {
    wood.box(OAK, 0, 0.42, 0, F.seat.w, 0.06, F.seat.d);
    wood.box(DARK, 0, 0.2, 0.15, F.seat.w - 0.04, 0.4, 0.08);
    for (const s of [-1, 1]) wood.box(DARK, (s * (F.seat.w - 0.08)) / 2, 0.2, -0.05, 0.08, 0.4, F.seat.d - 0.08);
  });
  cloth.placed(x, y, z, F.seat.theta, () => {
    cloth.box("#a35a44", -0.12, 0.5, -0.01, 0.82, 0.09, 0.36, { r: 0.04, vary: 0.02 });
    cloth.box("#c9a95e", 0.46, 0.57, 0.06, 0.28, 0.2, 0.14, { r: 0.07, ry: 0.4, rx: -0.3, vary: 0.02 });
  });
  // The owl's beam, across the wall above the landing's far end.
  const a = polar(wallRadius(y + 1.72) + 0.08, 2.2),
    b = polar(2.35, 2.2);
  wood.beam(DARK, [a.x, y + 1.72, a.z], [b.x, y + 1.72, b.z], 0.11, 0.12, { roll: -2.2 });
  const brace = polar(wallRadius(y + 1.1) + 0.03, 2.2);
  wood.beam(ELM, [brace.x, y + 1.08, brace.z], [(a.x + b.x) / 2, y + 1.68, (a.z + b.z) / 2], 0.07);
  // A little heap of pellets under it, and a straw of nest.
  const heap = polar(2.75, 2.2);
  for (let i = 0; i < 7; i++)
    cloth.ball("#6e6152", heap.x + cloth.range(-0.12, 0.12), y + 0.03, heap.z + cloth.range(-0.1, 0.1), 0.035, 0.025, 0.05, { detail: 6, ry: i });
}

// The owl's body stays; its head is a moving part, in room.js.
function owl(cloth) {
  const y = FLOORS[3].y + 1.78,
    { x, z } = polar(2.72, 2.2);
  cloth.ball("#a98c66", x, y + 0.14, z, 0.115, 0.18, 0.105, { detail: 14, vary: 0 });
  cloth.ball("#eadfc8", x + 0.055 * Math.sin(2.2 + Math.PI), y + 0.11, z + 0.055 * Math.cos(2.2 + Math.PI), 0.078, 0.12, 0.06, { detail: 12, vary: 0 });
  for (const s of [-1, 1]) {
    const px = x + Math.cos(2.2) * s * 0.1,
      pz = z - Math.sin(2.2) * s * 0.1;
    cloth.ball("#8a6e4e", px, y + 0.13, pz, 0.028, 0.125, 0.058, { detail: 10, ry: 2.2, vary: 0 });
    cloth.ball("#c9a65c", x + Math.cos(2.2) * s * 0.04, y + 0.005, z - Math.sin(2.2) * s * 0.04, 0.03, 0.012, 0.045, { detail: 6, ry: 2.2 + Math.PI, vary: 0 });
  }
  return { x, y: y + 0.32, z };
}

function dustFloor(wood, iron, cloth) {
  const y = FLOORS[4].y;
  // The brake lever: a long ash pole from the wall, a rope to the band above.
  {
    const { x, z } = polar(F.lever.r, F.lever.theta),
      pivot = polar(wallRadius(y + 0.9) + 0.02, F.lever.theta),
      tip = polar(1.72, F.lever.theta + 0.1);
    wood.beam(PALE, [pivot.x, y + 0.96, pivot.z], [tip.x, y + 1.32, tip.z], 0.07, 0.09);
    wood.box(DARK, x, y + 0.52, z, 0.14, 1.04, 0.14);
    iron.drum(IRON, x, y + 1.05, z, 0.05, 0.16, { segments: 10, rx: Math.PI / 2, ry: F.lever.theta });
    const top = polar(1.3, TOWER.shaftTheta + 0.72);
    iron.beam("#a58e68", [tip.x, y + 1.33, tip.z], [top.x, curb + 0.1, top.z], 0.016);
  }
  // A roll of spare sailcloth with a rope about it.
  {
    const { x, z } = polar(F.bundle.r, F.bundle.theta),
      a = F.bundle.theta + 0.7;
    cloth.drum("#ddd2b6", x, y + 0.2, z, 0.2, 1.05, { rz: Math.PI / 2, ry: a, segments: 16 });
    for (const s of [-0.28, 0.28])
      cloth.drum(ROPE, x + Math.cos(a) * s, y + 0.2, z - Math.sin(a) * s, 0.21, 0.04, { rz: Math.PI / 2, ry: a, segments: 16, open: true });
  }
  // The sack hoist: a roller out over the well and its chain, down to a sack
  // caught on its way up, above the stone deck.
  const theta = 3.9,
    over = polar(1.42, theta),
    back = polar(wallRadius(curb - 0.08) + 0.1, theta);
  wood.beam(DARK, [back.x, curb - 0.08, back.z], [over.x, curb - 0.08, over.z], 0.13, 0.15);
  iron.drum(IRON, over.x, curb - 0.2, over.z, 0.045, 0.1, { rx: Math.PI / 2, ry: theta, segments: 10 });
  const bottom = FLOORS[1].y + 1.92;
  for (let h = curb - 0.26, i = 0; h > bottom; h -= 0.075, i++) {
    iron.box(IRON, over.x, h, over.z, 0.022, 0.075, 0.01, { ry: theta + (i % 2 ? Math.PI / 2 : 0), r: 0.005, vary: 0.02 });
  }
  iron.box(IRON, over.x, bottom - 0.06, over.z, 0.04, 0.08, 0.04, { r: 0.01 });
  sack(cloth, over.x, bottom - 0.6, over.z, { ry: 0.9 });
}

/** Where each floor's lantern hangs, on an iron bracket from the wall. */
export const LANTERNS = [
  { theta: 0.42, y: 2.12 },
  { theta: 1.95, y: FLOORS[1].y + 2.02 },
  { theta: 4.95, y: FLOORS[2].y + 1.94 },
  { theta: 1.75, y: FLOORS[3].y + 1.92 },
  { theta: 5.2, y: FLOORS[4].y + 1.9 },
  // Hung in the cap, over the top platform, for the great wheel.
  { theta: 2.2, y: TOWER.curb + 0.75, r: 1.7 },
].map((l) => {
  const hang = l.r ?? wallRadius(l.y) - 0.3;
  return { ...l, ...polar(hang, l.theta) };
});

function lanterns(iron, glow) {
  for (const l of LANTERNS) {
    const wallAt = l.r ? { x: l.x, z: l.z } : polar(wallRadius(l.y + 0.34) + 0.03, l.theta),
      hook = l.r ? TOWER.curb + TOWER.cap * 0.62 : l.y + 0.34;
    iron.beam(IRON, [wallAt.x, hook, wallAt.z], [l.x, l.y + 0.34, l.z], 0.018);
    iron.beam(IRON, [l.x, l.y + 0.34, l.z], [l.x, l.y + 0.19, l.z], 0.015);
    iron.drum(IRON, l.x, l.y + 0.15, l.z, 0.095, 0.075, { rt: 0.03, segments: 6 });
    iron.drum(IRON, l.x, l.y - 0.13, l.z, 0.095, 0.035, { segments: 6 });
    for (let n = 0; n < 6; n++) {
      const a = (n / 6) * TAU;
      iron.beam(IRON, [l.x + Math.sin(a) * 0.09, l.y - 0.12, l.z + Math.cos(a) * 0.09], [l.x + Math.sin(a) * 0.09, l.y + 0.12, l.z + Math.cos(a) * 0.09], 0.011);
    }
    glow.drum("#ffffff", l.x, l.y, l.z, 0.08, 0.25, { segments: 6 });
  }
}

export function buildTower(materials) {
  const group = new T.Group();
  const wood = createBatch(1411),
    stone = createBatch(2237),
    iron = createBatch(3163),
    cloth = createBatch(4057),
    glass = createBatch(5167),
    glow = createBatch(6053);

  shell(stone);
  cap(wood, iron);
  door(wood, iron);
  windows(wood, stone, glass);
  LADDERS.forEach((l) => ladder(wood, iron, l));
  FLOORS.forEach((f, i) => {
    if (i) crescent(wood, f, LADDERS[i - 1]);
  });
  stoneDeck(wood, iron, FLOORS[1]);
  mealFloor(wood, iron, cloth);
  stoneFloor(wood, iron, cloth, stone, materials.face, group);
  binFloor(wood, cloth, iron);
  seatLanding(wood, cloth);
  const owlHead = owl(cloth);
  dustFloor(wood, iron, cloth);
  lanterns(iron, glow);

  // The tally by the door, on its own little slate.
  {
    const point = polar(wallRadius(1.6) - 0.02, -0.34),
      slate = new T.Mesh(new T.PlaneGeometry(0.72, 0.46), materials.slate);
    slate.position.set(point.x, 1.6, point.z);
    slate.rotation.y = -0.34 + Math.PI;
    slate.receiveShadow = true;
    group.add(slate);
    wood.placed(point.x, 1.6, point.z, -0.34, () => {
      wood.box(DARK, 0, 0.25, 0, 0.8, 0.04, 0.03);
      wood.box(DARK, 0, -0.25, 0, 0.8, 0.04, 0.03);
      wood.box(DARK, -0.38, 0, 0, 0.04, 0.54, 0.03);
      wood.box(DARK, 0.38, 0, 0, 0.04, 0.54, 0.03);
    });
  }

  group.add(
    stone.mesh("Windmill stone", materials.stone),
    wood.mesh("Windmill timber", materials.timber),
    iron.mesh("Windmill iron", materials.iron),
    cloth.mesh("Windmill sacking", materials.cloth),
    glass.mesh("Windmill glass", materials.glass, { cast: false, receive: false }),
    glow.mesh("Windmill lantern glass", materials.glow, { cast: false, receive: false }),
  );
  return { group, owlHead };
}
