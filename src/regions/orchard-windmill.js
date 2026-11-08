// The old windmill on the orchard's summit, from outside: a tower mill of
// limewashed rubble stone on a battered plinth, its door and windows in
// dressed stone, under a boarded ogee cap with a petticoat, a hood over the
// windshaft's neck, a ball finial and a fantail on its staging at the back.
// Four common sails on two stocks through an iron poll end, each a whip and
// its bars with hemlaths and a leading board, the cloth spread on the driving
// side and twisted along its length, as a real sail's weather is.
//
// Three meshes, as the weir and the tea room are built: `k`, the orchard's
// structures kit, takes the tower's shape (a plain shell, the openings and
// their dressings, the cap, the fantail) and its glass; `fine` takes the
// small things the overview hides zoomed far out (the coursed stones over
// the shell, glazing bars, ironwork, rails); the sails go to `sailLayer`,
// which turns. Everything here draws from its own seeded stream, never the
// orchard's shared one, so the hill's hives and bench keep their places.
import { outsideWindows } from "../windmill/layout.js";
import { ORCHARD as O, orchardGround } from "./orchard-layout.js";

const TAU = Math.PI * 2;

const C = {
  lime: "#efe9da",
  limeWarm: "#e4dac4",
  stone: "#b0a691",
  damp: "#9a9886",
  lichen: "#c8b46c",
  plinth: "#a19b89",
  plinthDark: "#8d8877",
  dressed: ["#d3cab3", "#cbc1a8", "#d8cfb9", "#c6bca2"],
  tar: ["#4c3f35", "#54463a", "#5b4c3f", "#473b32", "#504236"],
  tarEdge: "#3a3029",
  oak: "#7d6247",
  oakDark: "#5d4a39",
  door: ["#5d4a3a", "#665240", "#594736"],
  frame: "#4f4033",
  iron: "#37352f",
  stock: "#6e5a47",
  whip: "#7a6450",
  lath: "#857059",
  cloth: "#ebe2cb",
  vane: "#ece7da",
  copper: "#6f8a74",
  sack: "#d9cbaa",
};

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;
// The signed difference of two bearings, from -PI to PI.
const turnBetween = (a, b) => ((((b - a) % TAU) + TAU * 1.5) % TAU) - Math.PI;

function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Non-indexed triangles with their own normals and colours, for the shapes
// the kit's unit parts can't make: coursed stones, boards, cloth.
function mesher(T) {
  const position = [],
    normal = [],
    color = [],
    e1 = new T.Vector3(),
    e2 = new T.Vector3(),
    face = new T.Vector3();
  return {
    /** A quad from four corners, normals and colours (one colour, or four); turned to face its normals. */
    quad(p, n, c) {
      e1.set(p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]);
      e2.set(p[3][0] - p[0][0], p[3][1] - p[0][1], p[3][2] - p[0][2]);
      face.crossVectors(e1, e2);
      const out = face.x * (n[0][0] + n[2][0]) + face.y * (n[0][1] + n[2][1]) + face.z * (n[0][2] + n[2][2]);
      for (const i of out >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]) {
        position.push(...p[i]);
        normal.push(...n[i]);
        const ci = Array.isArray(c) ? c[i] : c;
        color.push(ci.r, ci.g, ci.b);
      }
    },
    get empty() {
      return position.length === 0;
    },
    geometry() {
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(position, 3));
      g.setAttribute("normal", new T.Float32BufferAttribute(normal, 3));
      g.setAttribute("color", new T.Float32BufferAttribute(color, 3));
      return g;
    },
  };
}

/**
 * Builds the windmill into the orchard's kits. Returns where the sails' hub
 * stands and the windshaft's direction, for the turning sails.
 */
export function buildWindmill(T, k, fine, sailLayer) {
  const w = O.windmill,
    rand = seeded(5407),
    pick = (list) => list[Math.floor(rand() * list.length)];
  let floor = Infinity;
  for (let a = 0; a < TAU; a += TAU / 12)
    floor = Math.min(floor, orchardGround(w.x + Math.cos(a) * w.radius, w.z + Math.sin(a) * w.radius));
  const H = w.height,
    rAt = (y) => w.radius - w.taper * (y / H),
    rTop = rAt(H),
    // The cap's boards stand this far out from the tower's head.
    R0 = rTop + 0.16,
    lean = Math.atan2(w.taper, H),
    cosLean = Math.cos(lean),
    sinLean = Math.sin(lean),
    doorAngle = w.doorBearing,
    shaftAngle = w.shaftBearing,
    backAngle = shaftAngle + Math.PI,
    // The prevailing wind's side, south-west, where the limewash wears.
    weatherAngle = -Math.PI / 4;
  const at = (a, r, y) => [w.x + Math.sin(a) * r, floor + y, w.z + Math.cos(a) * r];
  const outward = (a, bendA = 0, bendY = 0) => {
    const nx = Math.sin(a) * cosLean + Math.cos(a) * bendA,
      ny = sinLean + bendY,
      nz = Math.cos(a) * cosLean - Math.sin(a) * bendA,
      l = Math.hypot(nx, ny, nz);
    return [nx / l, ny / l, nz / l];
  };
  const color = new T.Color(),
    tmp = new T.Color(),
    matrix = new T.Matrix4();
  const colorOf = (hex) => new T.Color(hex);
  const P = {
    lime: colorOf(C.lime),
    limeWarm: colorOf(C.limeWarm),
    stone: colorOf(C.stone),
    damp: colorOf(C.damp),
    lichen: colorOf(C.lichen),
    plinth: colorOf(C.plinth),
    plinthDark: colorOf(C.plinthDark),
  };

  // Openings in the wall, as bearings and heights in the tower's own metres.
  const DOOR = { half: 0.43, height: 1.68 },
    WIN = { half: 0.2, height: 0.5 },
    windows = outsideWindows().map(([theta, y]) => ({ a: doorAngle + theta, y })),
    openings = [
      { a: doorAngle, y0: -1, y1: DOOR.height + 0.26, half: DOOR.half + 0.14 },
      ...windows.map(({ a, y }) => ({ a, y0: y - WIN.height / 2 - 0.05, y1: y + WIN.height / 2 + 0.12, half: WIN.half + 0.1 })),
    ];

  // The limewash: patchy where the weather has worn it to the stone, damp
  // at the foot, streaked under the sills and the cap's drip. `tint` varies
  // from stone to stone.
  function wallColor(out, a, y, tint, lichen = 0) {
    out.copy(P.lime).lerp(P.limeWarm, tint * 0.75);
    const weather = Math.max(0, Math.cos(a - weatherAngle)),
      n =
        Math.sin(a * 3.1 + y * 1.7) * Math.sin(a * 5.3 - y * 2.9 + 1.3) +
        0.45 * Math.sin(a * 11.3 + y * 7.1 + 0.6) +
        0.25 * Math.sin(a * 23.0 - y * 13.0);
    const worn = smooth(0.62, 0.95, n * 0.5 + 0.35 + 0.3 * weather * (1 - y / H) + 0.2 * (1 - smooth(0, 1.5, y)));
    out.lerp(P.stone, worn * (0.55 + 0.35 * tint));
    out.lerp(P.damp, 0.45 * (1 - smooth(0.2, 1.1, y)));
    for (const win of windows) {
      const across = Math.abs(turnBetween(win.a, a)) * rAt(y);
      if (across < 0.26 && y < win.y - 0.3 && y > win.y - 1.6) {
        const s = (1 - across / 0.26) * smooth(win.y - 1.6, win.y - 0.4, y);
        out.multiplyScalar(1 - 0.13 * s * (0.55 + 0.45 * Math.sin(across * 47 + win.y)));
      }
    }
    const drip = smooth(H - 1.0, H - 0.05, y) * Math.max(0, Math.sin(a * 23 + 1.7)) ** 3;
    out.multiplyScalar(1 - 0.11 * drip);
    if (lichen > 0) out.lerp(P.lichen, lichen * (0.25 + 0.4 * weather));
    return out;
  }

  // ---- The plain shell: the tower's shape, which the stones cover close to.
  // Zoomed far out, with the stones hidden, it is the tower.
  const plinthTop = 0.42,
    plinthR = (y) => rAt(y) + 0.1 + (plinthTop - y) * 0.05;
  {
    const m = mesher(T),
      segments = 36,
      rows = [-0.7];
    for (let y = plinthTop + 0.1; y < H; y += 0.27) rows.push(y);
    rows.push(H);
    const point = (a, y) => {
      const r = y < plinthTop + 0.1 ? plinthR(Math.min(y, plinthTop)) - 0.022 : rAt(y) - 0.025;
      return at(a, r, y);
    };
    const shade = (a, y) => wallColor(new T.Color(), a, y, 0.45).multiplyScalar(0.9);
    for (let i = 1; i < rows.length - 1; i++)
      for (let j = 0; j < segments; j++) {
        const a0 = (j / segments) * TAU,
          a1 = ((j + 1) / segments) * TAU,
          y0 = rows[i],
          y1 = rows[i + 1];
        m.quad(
          [point(a0, y0), point(a1, y0), point(a1, y1), point(a0, y1)],
          [outward(a0), outward(a1), outward(a1), outward(a0)],
          [shade(a0, y0), shade(a1, y0), shade(a1, y1), shade(a0, y1)],
        );
      }
    // The plinth's stand-in, cut for the door, and its weathered top.
    const cut = (DOOR.half + 0.05) / plinthR(0),
      from = doorAngle + cut,
      span = TAU - 2 * cut,
      steps = 40;
    const plinthShade = (a, y) =>
      tmp.copy(P.plinth).lerp(P.damp, 0.35 * (1 - smooth(-0.3, 0.4, y))).multiplyScalar(0.92).clone();
    for (let j = 0; j < steps; j++) {
      const a0 = from + (j / steps) * span,
        a1 = from + ((j + 1) / steps) * span;
      for (const [y0, y1] of [
        [-0.7, 0.06],
        [0.06, plinthTop],
      ])
        m.quad(
          [at(a0, plinthR(y0) - 0.022, y0), at(a1, plinthR(y0) - 0.022, y0), at(a1, plinthR(y1) - 0.022, y1), at(a0, plinthR(y1) - 0.022, y1)],
          [outward(a0), outward(a1), outward(a1), outward(a0)],
          [plinthShade(a0, y0), plinthShade(a1, y0), plinthShade(a1, y1), plinthShade(a0, y1)],
        );
      // The weathering: a dressed chamfer from the plinth back to the wall.
      const top = plinthTop + 0.1;
      m.quad(
        [at(a0, plinthR(plinthTop), plinthTop), at(a1, plinthR(plinthTop), plinthTop), at(a1, rAt(top) - 0.02, top), at(a0, rAt(top) - 0.02, top)],
        [outward(a0, 0, 0.9), outward(a1, 0, 0.9), outward(a1, 0, 0.9), outward(a0, 0, 0.9)],
        colorOf(C.dressed[0]).multiplyScalar(0.95),
      );
    }
    // The cut plinth's ends, in the door's reveal.
    for (const a of [from, from + span]) {
      const inner = rAt(0) - 0.03,
        side = [Math.cos(a) * (a === from ? -1 : 1), 0, -Math.sin(a) * (a === from ? -1 : 1)];
      m.quad(
        [at(a, inner, -0.7), at(a, plinthR(-0.7), -0.7), at(a, plinthR(plinthTop), plinthTop), at(a, inner, plinthTop)],
        [side, side, side, side],
        colorOf(C.plinth),
      );
    }
    k.piece(m.geometry());
  }

  // ---- The coursed stones over the shell, each a little proud and pillowed,
  // the shell showing between them as the joints.
  function coursed(m, { y0, y1, course, block, gap, radius, shadeOf }) {
    let y = y0;
    while (y < y1 - 0.02) {
      let h = lerp(course[0], course[1], rand());
      if (y1 - (y + h) < course[0] * 0.7) h = y1 - y;
      const r = radius(y + h / 2);
      let b = rand() * TAU;
      const end = b + TAU;
      while (b < end - 1e-6) {
        let len = lerp(block[0], block[1], rand()) / r;
        if (end - (b + len) < (block[0] * 0.7) / r) len = end - b;
        const a0 = b + gap / 2 / r,
          a1 = b + len - gap / 2 / r,
          mid = (a0 + a1) / 2,
          ya = y + gap / 2,
          yb = y + h - gap / 2,
          tint = rand(),
          lichen = rand() < 0.07 ? rand() : 0;
        b += len;
        const blocked = openings.some(
          (o) => Math.abs(turnBetween(o.a, mid)) * r < o.half + ((a1 - a0) / 2) * r && y < o.y1 && y + h > o.y0,
        );
        if (blocked) continue;
        const cols = Math.max(2, Math.ceil(((a1 - a0) * r) / 0.22));
        for (let c = 0; c < cols; c++) {
          const u0 = c / cols,
            u1 = (c + 1) / cols,
            corner = (u, yy) => {
              const a = lerp(a0, a1, u),
                bend = (u - 0.5) * 0.7,
                lift = (yy === ya ? -1 : 1) * 0.3;
              return {
                p: at(a, radius(yy), yy),
                n: outward(a, bend, lift),
                c: shadeOf(color, a, yy, tint, lichen).clone(),
              };
            };
          const q = [corner(u0, ya), corner(u1, ya), corner(u1, yb), corner(u0, yb)];
          m.quad(
            q.map((x) => x.p),
            q.map((x) => x.n),
            q.map((x) => x.c),
          );
        }
      }
      y += h;
    }
  }
  {
    const m = mesher(T);
    coursed(m, {
      y0: -0.3,
      y1: plinthTop,
      course: [0.34, 0.38],
      block: [0.55, 0.85],
      gap: 0.03,
      radius: (y) => plinthR(Math.min(y, plinthTop)),
      shadeOf: (out, a, y, tint) =>
        out.copy(P.plinth).lerp(P.plinthDark, tint * 0.8).lerp(P.damp, 0.4 * (1 - smooth(-0.3, 0.45, y))),
    });
    coursed(m, {
      y0: plinthTop + 0.1,
      y1: H - 0.02,
      course: [0.19, 0.3],
      block: [0.3, 0.68],
      gap: 0.026,
      radius: rAt,
      shadeOf: wallColor,
    });
    fine.piece(m.geometry());
  }

  // ---- Openings: built flat on the wall, leaning with its batter.
  const wallFrame = (a, y) =>
    new T.Matrix4()
      .makeTranslation(...at(a, rAt(y), y))
      .multiply(new T.Matrix4().makeRotationY(a))
      .multiply(new T.Matrix4().makeRotationX(-lean));
  const onWall = (a, y, build) => {
    const frame = wallFrame(a, y);
    k.transformed(frame, () => fine.transformed(frame, build));
  };
  // How far the curved wall falls behind a flat face `x` from its middle.
  const sag = (r, x) => r - Math.sqrt(r * r - x * x);
  // A dressed stone `proud` of the wall, from x0 to x1 and y0 to y1 in the opening's frame.
  const dressedStone = (kit, r, x0, x1, y0, y1, proud, { hex = pick(C.dressed), rz = 0 } = {}) => {
    const near = x0 < 0 && x1 > 0 ? 0 : Math.min(Math.abs(x0), Math.abs(x1)),
      far = Math.max(Math.abs(x0), Math.abs(x1)),
      front = proud - sag(r, near),
      depth = front + sag(r, far) + 0.06;
    kit.box(hex, (x0 + x1) / 2, (y0 + y1) / 2, front - depth / 2, x1 - x0, y1 - y0, depth, 0, 0, rz);
  };

  // The door: ledged oak planks under a flat arch of voussoirs, quoined
  // jambs, a stone step, a datestone above, a lantern on a bracket.
  onWall(doorAngle, 0, () => {
    const r = rAt(0.8),
      { half, height } = DOOR,
      planks = 6;
    for (let i = 0; i < planks; i++) {
      const x0 = -half + (i / planks) * 2 * half,
        x1 = -half + ((i + 1) / planks) * 2 * half;
      k.box(C.door[i % 3], (x0 + x1) / 2, height / 2, -0.03, x1 - x0 - 0.008, height, 0.05);
    }
    // Quoins, long and short, up each jamb.
    let y = 0;
    const heights = [0.34, 0.3, 0.36, 0.32, 0.36];
    heights.forEach((h, i) => {
      const long = i % 2 === 0 ? 0.24 : 0.15;
      for (const s of [-1, 1]) {
        const x0 = s * half,
          x1 = s * (half + long);
        dressedStone(k, r, Math.min(x0, x1), Math.max(x0, x1), y + 0.006, y + h - 0.006, 0.055);
      }
      y += h;
    });
    // The flat arch: voussoirs fanned from below, the keystone proud.
    const count = 7,
      span = 2 * half + 0.3,
      top = height + 0.24;
    for (let i = 0; i < count; i++) {
      const x0 = -span / 2 + (i / count) * span,
        x1 = -span / 2 + ((i + 1) / count) * span,
        x = (x0 + x1) / 2,
        key = i === (count - 1) / 2,
        fan = Math.atan2(x, 2.4);
      dressedStone(k, r, x0 + 0.006, x1 - 0.006, height, key ? height + 0.27 : top, key ? 0.075 : 0.055, { rz: -fan });
    }
    // The step, worn in the middle.
    k.box("#a59f8c", 0, 0.06, 0.2, 2 * half + 0.34, 0.12, 0.42);
    k.box("#9a9482", 0, 0.12, 0.2, 2 * half - 0.2, 0.012, 0.3);
    // Strap hinges, the latch and ring, the keyhole.
    for (const hy of [0.32, height - 0.36]) {
      fine.box(C.iron, -half + 0.3, hy, 0.0, 0.56, 0.045, 0.012);
      fine.box(C.iron, -half + 0.58, hy, 0.0, 0.05, 0.07, 0.014);
      for (const bx of [-half + 0.1, -half + 0.26, -half + 0.42]) fine.ball(C.iron, bx, hy, 0.008, 0.012, 0.012, 0.008);
    }
    fine.box(C.iron, half - 0.12, 0.98, 0.0, 0.07, 0.14, 0.012);
    fine.cyl(C.iron, half - 0.12, 0.93, 0.02, 0.035, 0.012, Math.PI / 2);
    fine.box("#1c1915", half - 0.12, 1.02, 0.008, 0.012, 0.03, 0.006);
    // The ledges and brace show as the planks' battens on the outside face.
    for (const by of [0.6, 1.1]) fine.box(C.oakDark, 0, by, -0.002, 2 * half - 0.04, 0.012, 0.012);
    // The datestone over the arch, its figures cut in a sunk panel.
    const plaque = 0.045;
    k.box("#dcd4bf", 0, top + 0.2, plaque - 0.05, 0.34, 0.2, 0.1);
    fine.box("#bcb39d", 0, top + 0.2, plaque + 0.001, 0.27, 0.13, 0.004);
    for (const dx of [-0.075, -0.025, 0.025, 0.075]) fine.box("#8f8774", dx, top + 0.2, plaque + 0.003, 0.022, 0.065, 0.004);
    // The lantern, on its bracket right of the door.
    const lx = half + 0.38,
      ly = 1.62,
      lz = 0.24 - sag(r, lx);
    fine.box(C.iron, lx, ly + 0.17, lz / 2 - 0.02, 0.02, 0.02, lz + 0.04);
    fine.beam(C.iron, [lx, ly + 0.02, -sag(r, lx)], [lx, ly + 0.16, lz - 0.05], 0.014);
    fine.box(C.iron, lx, ly + 0.12, lz, 0.03, 0.04, 0.03);
    k.glazed(() => k.box("#ffcf73", lx, ly, lz, 0.1, 0.15, 0.1));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) fine.box(C.iron, lx + sx * 0.052, ly, lz + sz * 0.052, 0.012, 0.16, 0.012);
    fine.box(C.iron, lx, ly - 0.085, lz, 0.12, 0.02, 0.12);
    fine.pyramid(C.iron, lx, ly + 0.12, lz, 0.1, 0.08);
    fine.ball(C.iron, lx, ly + 0.17, lz, 0.015);
  });

  // The windows: a four-pane sash in a dark frame, glazed with the village's
  // glass (it glows at blue hour), between dressed jambs under a lintel, on
  // a sill that throws the rain off.
  for (const { a, y } of windows)
    onWall(a, y - WIN.height / 2, () => {
      const r = rAt(y),
        { half, height } = WIN;
      k.glazed(() => k.box("#ffcf73", 0, height / 2, -0.012, 2 * half, height, 0.02));
      for (const s of [-1, 1]) k.box(C.frame, s * (half - 0.02), height / 2, 0.0, 0.045, height, 0.05);
      k.box(C.frame, 0, height - 0.02, 0.0, 2 * half, 0.045, 0.05);
      k.box(C.frame, 0, 0.025, 0.0, 2 * half, 0.05, 0.05);
      fine.box(C.frame, 0, height / 2, 0.004, 0.022, height - 0.06, 0.024);
      fine.box(C.frame, 0, height * 0.5, 0.004, 2 * half - 0.06, 0.022, 0.024);
      // Jambs: two stones a side, long over short.
      for (const s of [-1, 1])
        [
          [0, height * 0.48, 0.15],
          [height * 0.48, height, 0.1],
        ].forEach(([y0, y1, long]) => {
          const x0 = s * half,
            x1 = s * (half + long);
          dressedStone(k, r, Math.min(x0, x1), Math.max(x0, x1), y0 + 0.005, y1 - 0.005, 0.05);
        });
      // The lintel, and its keystone.
      dressedStone(k, r, -half - 0.16, -0.06, height + 0.004, height + 0.15, 0.05);
      dressedStone(k, r, 0.06, half + 0.16, height + 0.004, height + 0.15, 0.05);
      dressedStone(k, r, -0.055, 0.055, height, height + 0.17, 0.068);
      // The sill, proud, with its drip groove.
      k.box(pick(C.dressed), 0, -0.035, 0.07 - sag(r, half), 2 * half + 0.24, 0.07, 0.18 + sag(r, half + 0.12));
      fine.box("#a79f89", 0, -0.068, 0.15 - sag(r, half), 2 * half + 0.2, 0.008, 0.012);
    });

  // ---- The head of the tower: a petticoat of boards hiding the curb, the
  // ogee cap above it in tarred boards, and the finial.
  const boards = 44;
  // A boarded surface of revolution, each board its own shade.
  function boarded(m, profile, shades) {
    for (let j = 0; j < boards; j++) {
      const b0 = (j / boards) * TAU,
        b1 = ((j + 1) / boards) * TAU,
        tone = new T.Color(pick(shades)).multiplyScalar(0.9 + rand() * 0.16);
      {
        for (let i = 0; i < profile.length - 1; i++) {
          const [r0, y0] = profile[i],
            [r1, y1] = profile[i + 1],
            dr = r1 - r0,
            dy = y1 - y0,
            l = Math.hypot(dr, dy),
            nr = dy / l,
            ny = -dr / l,
            normalAt = (b) => [Math.sin(b) * nr, ny, Math.cos(b) * nr];
          m.quad(
            [at(b0, r0, y0), at(b1, r0, y0), at(b1, r1, y1), at(b0, r1, y1)],
            [normalAt(b0), normalAt(b1), normalAt(b1), normalAt(b0)],
            tone,
          );
        }
      }
    }
  }
  // Taller than the cap seen from inside, so its ogee reads from the ground.
  const capFoot = H + 0.24,
    capTop = H + w.capHeight + 0.4;
  {
    const m = mesher(T);
    // The petticoat, flared a touch at its foot.
    boarded(m, [
      [R0 + 0.03, H - 0.1],
      [R0, H + 0.05],
      [R0, capFoot + 0.02],
    ], C.tar);
    // The ogee: swelling out over the petticoat, then in to a concave neck.
    const curve = new T.SplineCurve(
      [
        [1.02, 0],
        [1.045, 0.07],
        [1.03, 0.17],
        [0.95, 0.29],
        [0.8, 0.41],
        [0.6, 0.52],
        [0.4, 0.61],
        [0.25, 0.7],
        [0.15, 0.79],
        [0.09, 0.88],
        [0.06, 0.95],
        [0.045, 1],
      ].map(([r, t]) => new T.Vector2(r * R0, capFoot + t * (capTop - capFoot))),
    );
    const capProfile = curve.getPoints(13).map((p) => [p.x, p.y]);
    capProfile.unshift([R0 - 0.02, capFoot]);
    boarded(m, capProfile, C.tar);
    k.piece(m.geometry());
    // The petticoat's drip rail, and a ring of boards at the cap's eaves.
    k.add(k.unit.cylinder, C.tarEdge, w.x, floor + H - 0.07, w.z, R0 + 0.05, 0.06, R0 + 0.05);
    k.add(k.unit.cylinder, C.tarEdge, w.x, floor + capFoot + 0.025, w.z, R0 * 1.05, 0.045, R0 * 1.05);
  }
  // The finial: a turned post, a ball, and a spike.
  {
    const x = w.x,
      z = w.z,
      y = floor + capTop;
    k.add(k.unit.cylinder, C.oakDark, x, y + 0.13, z, 0.04, 0.26, 0.04);
    k.ball(C.oakDark, x, y + 0.3, z, 0.095);
    fine.add(fine.unit.cylinder, C.oakDark, x, y + 0.02, z, 0.08, 0.05, 0.08);
    fine.add(fine.unit.cylinder, C.oakDark, x, y + 0.18, z, 0.055, 0.035, 0.055);
    fine.ball(C.oakDark, x, y + 0.42, z, 0.035);
    fine.add(fine.unit.cylinder, C.iron, x, y + 0.52, z, 0.008, 0.18, 0.008);
  }

  // The hood over the windshaft's neck, boarded like the cap, and the shaft.
  const shaft = new T.Vector3(Math.sin(shaftAngle), 0, Math.cos(shaftAngle)),
    shaftY = floor + H + w.shaftRise,
    hub = new T.Vector3(w.x, shaftY, w.z).addScaledVector(shaft, rTop + 0.55);
  {
    const frame = new T.Matrix4()
      .makeTranslation(w.x, shaftY, w.z)
      .multiply(new T.Matrix4().makeRotationY(shaftAngle));
    k.transformed(frame, () => {
      // In the hood's frame the shaft runs along +z.
      k.box(C.tar[2], 0, -0.02, R0 + 0.06, 0.5, 0.44, 0.48);
      k.box(C.tarEdge, 0, 0.24, R0 + 0.1, 0.58, 0.04, 0.5, 0, 0.3);
      k.box(C.tarEdge, 0, -0.02, R0 + 0.3, 0.54, 0.48, 0.02);
      k.add(k.unit.cylinder, C.iron, 0, 0, R0 + 0.32, 0.1, 0.18, 0.1, Math.PI / 2);
      k.add(k.unit.cylinder, C.oakDark, 0, 0, R0 + 0.315, 0.15, 0.03, 0.15, Math.PI / 2);
    });
    fine.transformed(frame, () => {
      for (let i = 0; i < 5; i++) fine.box(C.tarEdge, -0.2 + i * 0.1, -0.02, R0 + 0.312, 0.012, 0.44, 0.008);
      for (const s of [-1, 1]) fine.ball(C.iron, s * 0.11, s * 0.11, R0 + 0.33, 0.02, 0.02, 0.012);
    });
  }

  // The fantail at the back of the cap, on two pairs of raking posts, its
  // stage and rail beneath it; eight white vanes on a hub, turned across the
  // sails, so it would wind the cap round to face the wind.
  {
    const back = new T.Vector3(Math.sin(backAngle), 0, Math.cos(backAngle)),
      across = new T.Vector3(Math.cos(shaftAngle), 0, -Math.sin(shaftAngle)),
      up = new T.Vector3(0, 1, 0),
      base = new T.Vector3(w.x, floor + H - 0.04, w.z),
      fan = base.clone().addScaledVector(back, R0 + 0.95).addScaledVector(up, 0.92),
      fanRadius = 0.56,
      point = (alongBack, side, rise) =>
        base.clone().addScaledVector(back, alongBack).addScaledVector(across, side).addScaledVector(up, rise),
      arr = (p) => [p.x, p.y, p.z];
    // Raking posts, from the curb to the fan's bearings either side.
    for (const s of [-1, 1]) {
      const bearing = fan.clone().addScaledVector(across, s * 0.17);
      k.beam(C.oakDark, arr(point(R0 - 0.08, s * 0.42, 0.02)), arr(bearing), 0.07);
      k.beam(C.oakDark, arr(point(R0 * 0.82, s * 0.24, 0.72)), arr(bearing), 0.06);
      k.beam(C.oakDark, arr(point(R0 - 0.06, s * 0.42, -0.02)), arr(point(R0 + 1.02, s * 0.3, -0.02)), 0.06);
      // The stage's rail.
      fine.beam(C.oakDark, arr(point(R0 + 0.98, s * 0.3, 0)), arr(point(R0 + 0.98, s * 0.3, 0.5)), 0.035);
      fine.beam(C.oakDark, arr(point(R0 + 0.1, s * 0.36, 0.48)), arr(point(R0 + 0.98, s * 0.3, 0.48)), 0.03);
      fine.beam(C.oakDark, arr(point(R0 + 0.45, s * 0.33, 0)), arr(point(R0 + 0.45, s * 0.33, 0.48)), 0.03);
    }
    // The stage: boards across the posts.
    for (let i = 0; i < 6; i++) {
      const along = R0 + 0.12 + i * 0.16,
        c = point(along, 0, 0.03);
      const g = k.box(pick([C.oak, "#866a4d", "#77604a"]), 0, 0, 0, 0.68, 0.03, 0.14);
      g.applyMatrix4(matrix.makeRotationY(backAngle));
      g.translate(c.x, c.y, c.z);
    }
    fine.beam(C.oakDark, arr(point(R0 + 0.98, 0, 0.48)), arr(point(R0 + 0.98, 0.3, 0.48)), 0.03);
    fine.beam(C.oakDark, arr(point(R0 + 0.98, -0.3, 0.48)), arr(point(R0 + 0.98, 0, 0.48)), 0.03);
    // The fan's spindle down to the curb's rack, and its bearings.
    fine.beam(C.iron, arr(fan), arr(point(R0 - 0.02, 0, 0.1)), 0.03);
    // The axle across, the hub, and the vanes on their arms.
    {
      const axle = k.unit.cylinder.clone();
      const q = new T.Quaternion().setFromUnitVectors(up, across);
      axle.applyMatrix4(new T.Matrix4().compose(fan, q, new T.Vector3(0.025, 0.42, 0.025)));
      k.piece(axle, C.iron);
      const hubDisc = k.unit.cylinder.clone();
      hubDisc.applyMatrix4(new T.Matrix4().compose(fan, q, new T.Vector3(0.09, 0.08, 0.09)));
      k.piece(hubDisc, C.oakDark);
    }
    const vanes = 8;
    for (let i = 0; i < vanes; i++) {
      const phi = (i / vanes) * TAU + 0.2,
        radial = back.clone().multiplyScalar(Math.cos(phi)).addScaledVector(up, Math.sin(phi)),
        widthDir = new T.Vector3().crossVectors(across, radial).normalize(),
        pitch = 0.55,
        ex = widthDir.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(across, Math.sin(pitch)),
        ez = new T.Vector3().crossVectors(ex, radial);
      // The arm, then the vane on its outer part.
      k.beam(C.oakDark, arr(fan.clone().addScaledVector(radial, 0.06)), arr(fan.clone().addScaledVector(radial, fanRadius + 0.02)), 0.022);
      const vane = k.unit.box.clone();
      vane.applyMatrix4(
        new T.Matrix4()
          .makeBasis(ex, radial, ez)
          .scale(new T.Vector3(0.15, fanRadius - 0.16, 0.012))
          .setPosition(fan.clone().addScaledVector(radial, (fanRadius + 0.16) / 2 + 0.02)),
      );
      k.piece(vane, C.vane);
    }
  }

  // ---- At the tower's foot: an old millstone leant by the door, a pair of
  // sacks on the other side, and the lightning conductor down the weather side.
  {
    const a = doorAngle - 0.62,
      r = plinthR(0.2) + 0.12,
      [mx, , mz] = at(a, r, 0),
      ground = orchardGround(mx, mz);
    const stone = k.unit.cylinder.clone(),
      frame = new T.Matrix4()
        .makeTranslation(mx, ground + 0.4, mz)
        .multiply(new T.Matrix4().makeRotationY(a))
        .multiply(new T.Matrix4().makeRotationX(-0.22 + Math.PI / 2));
    stone.applyMatrix4(new T.Matrix4().makeScale(0.43, 0.13, 0.43));
    stone.applyMatrix4(frame);
    k.piece(stone, "#9c968a");
    // The eye, and the dressing's furrows on its face.
    fine.transformed(frame, () => {
      fine.cyl("#3f3a33", 0, 0.067, 0, 0.07, 0.005);
      for (let i = 0; i < 10; i++) {
        const t = (i / 10) * TAU;
        fine.box("#857f73", Math.cos(t) * 0.24, 0.066, Math.sin(t) * 0.24, 0.3, 0.004, 0.022, -t + 0.4);
      }
    });
    // Two sacks of meal leant on the wall right of the lantern.
    for (const [da, lean2, s] of [
      [0.5, 0.12, 1],
      [0.62, -0.08, 0.92],
    ]) {
      const sa = doorAngle + da,
        sr = plinthR(0.1) + 0.12,
        [sx, , sz] = at(sa, sr, 0),
        sg = orchardGround(sx, sz);
      fine.placed(sx, sg, sz, sa, () => {
        fine.add(fine.unit.sphere, C.sack, 0, 0.22 * s, 0, 0.17 * s, 0.24 * s, 0.13 * s, lean2, 0, 0);
        fine.add(fine.unit.cylinder, "#cdbd9a", 0, 0.47 * s, -0.02, 0.045, 0.08, 0.04, lean2, 0, 0);
        fine.add(fine.unit.sphere, "#cdbd9a", 0, 0.52 * s, -0.025, 0.06, 0.04, 0.05);
      });
    }
    // The lightning conductor: a copper tape from the finial down the cap
    // and the tower to the ground, gone green.
    const la = doorAngle + 2.15,
      tape = [];
    const capCurve = [
      [0.045, 1],
      [0.09, 0.88],
      [0.25, 0.7],
      [0.6, 0.52],
      [0.95, 0.29],
      [1.045, 0.07],
    ];
    for (const [rr, t] of capCurve) tape.push(at(la, rr * R0 + 0.012, capFoot + t * (capTop - capFoot)));
    tape.push(at(la, R0 + 0.045, H + 0.04), at(la, R0 + 0.045, H - 0.1));
    for (let y = H - 0.15; y > plinthTop + 0.1; y -= 0.8) tape.push(at(la, rAt(y) + 0.012, y));
    tape.push(at(la, rAt(plinthTop + 0.1) + 0.012, plinthTop + 0.1), at(la, plinthR(plinthTop) + 0.012, plinthTop));
    tape.push(at(la, plinthR(-0.1) + 0.012, -0.1));
    for (let i = 0; i < tape.length - 1; i++) fine.beam(C.copper, tape[i], tape[i + 1], 0.016);
  }

  // ---- The sails, in the hub's frame (the windshaft along +z), turning
  // clockwise seen from the village: two stocks through the poll end, one
  // behind the other, and on each stock's arm a whip carrying the sail bars.
  // The cloth is on the trailing, driving side; the leading side has its
  // board. Each sail twists from steep at the heel to flat at the tip.
  k.into(sailLayer, () => {
    const length = 3.7,
      heel = 0.86,
      lead = 0.2,
      drive = 0.66,
      bars = 15,
      weather = (y) => ((22 - 15 * smooth(heel, length, y)) * Math.PI) / 180,
      // The poll end: an iron canister on the shaft's end.
      canister = 0.24;
    k.box(C.iron, 0, 0, canister, 0.34, 0.34, 0.6);
    k.add(k.unit.cylinder, C.iron, 0, 0, canister + 0.32, 0.12, 0.06, 0.12, Math.PI / 2);
    k.add(k.unit.cylinder, "#2f2d29", 0, 0, canister + 0.36, 0.05, 0.04, 0.05, Math.PI / 2);
    const clothColor = new T.Color(C.cloth);
    for (let n = 0; n < 4; n++)
      k.transformed(new T.Matrix4().makeRotationZ((n * Math.PI) / 2), () => {
        const stockZ = n % 2 ? 0.13 : 0.36,
          whipZ = stockZ + 0.1 + 0.045;
        // The stock, tapering to its tip.
        const stock = new T.CylinderGeometry(0.075, 0.14, length + 0.1, 4, 1);
        stock.rotateY(Math.PI / 4);
        // Sheared so its face stays flat under the whip as it tapers.
        {
          const p = stock.attributes.position;
          for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + 0.047 * (p.getY(i) / (length + 0.1) + 0.5));
        }
        stock.translate(0, (length + 0.1) / 2, stockZ);
        k.piece(stock, C.stock);
        // The whip on its face, and iron clamps holding them together.
        k.box(C.whip, 0, (heel - 0.18 + length + 0.12) / 2, whipZ, 0.08, length + 0.12 - (heel - 0.18), 0.09);
        for (const cy of [heel, heel + 1.1, heel + 2.2]) k.box(C.iron, 0, cy, (stockZ + whipZ) / 2 + 0.01, 0.17, 0.035, 0.3);
        // Where a point of the sail sits: `x` across (leading +), `dz` off the bars' face.
        const sailPoint = (x, y, dz = 0) => {
          const a = weather(y);
          return [x * Math.cos(a) - dz * Math.sin(a), y, whipZ + x * Math.sin(a) + dz * Math.cos(a)];
        };
        const barYs = [];
        for (let i = 0; i < bars; i++) barYs.push(heel + (i / (bars - 1)) * (length - heel - 0.04));
        // The bars, each turned to the sail's weather where it crosses the whip.
        for (const y of barYs) {
          const a = weather(y),
            c = sailPoint((lead - drive) / 2, y),
            bar = k.unit.box.clone();
          bar.applyMatrix4(
            new T.Matrix4()
              .makeBasis(new T.Vector3(Math.cos(a), 0, Math.sin(a)), new T.Vector3(0, 1, 0), new T.Vector3(-Math.sin(a), 0, Math.cos(a)))
              .scale(new T.Vector3(lead + drive, 0.034, 0.03))
              .setPosition(new T.Vector3(...c)),
          );
          k.piece(bar, C.lath);
        }
        // Hemlaths down both edges and an uplong across the cloth.
        const runs = [0, 5, 10, bars - 1];
        for (const x of [lead, -drive, -drive * 0.5])
          for (let i = 0; i < runs.length - 1; i++) {
            // The uplong runs behind the cloth.
            const dz = x === -drive * 0.5 ? -0.016 : 0.004;
            k.beam(C.lath, sailPoint(x, barYs[runs[i]], dz), sailPoint(x, barYs[runs[i + 1]], dz), x === -drive * 0.5 ? 0.022 : 0.032);
          }
        // The leading board, and the cloth, bellied back a little between the bars.
        const surface = (x0, x1, dz, cols, belly, shadeAt) => {
          const m = mesher(T),
            rows = (bars - 1) * 2,
            y0 = barYs[0],
            y1 = barYs[bars - 1];
          for (let i = 0; i < rows; i++)
            for (let j = 0; j < cols; j++) {
              const corner = (ii, jj) => {
                const y = lerp(y0, y1, ii / rows),
                  x = lerp(x0, x1, jj / cols),
                  sink = belly * Math.sin((ii % 2) * Math.PI * 0.5) * Math.sin((jj / cols) * Math.PI),
                  a = weather(y);
                return {
                  p: sailPoint(x, y, dz - sink),
                  n: [-Math.sin(a), 0, Math.cos(a)],
                  c: shadeAt(x, y),
                };
              };
              const q = [corner(i, j), corner(i, j + 1), corner(i + 1, j + 1), corner(i + 1, j)];
              m.quad(q.map((x) => x.p), q.map((x) => x.n), q.map((x) => x.c));
              // And its back, a hair behind.
              m.quad(
                q.map((x) => [x.p[0] + x.n[0] * -0.006, x.p[1], x.p[2] + x.n[2] * -0.006]),
                q.map((x) => [-x.n[0], 0, -x.n[2]]),
                q.map((x) => x.c.clone().multiplyScalar(0.9)),
              );
            }
          return m.geometry();
        };
        const tone = 0.94 + 0.08 * ((n * 0.37) % 1);
        k.piece(
          surface(-0.035, -drive + 0.02, 0.022, 4, 0.02, (x, y) =>
            clothColor
              .clone()
              .multiplyScalar(tone * (0.9 + 0.1 * smooth(heel, heel + 0.8, y)) * (1 - 0.06 * smooth(-0.45, -0.64, x))),
          ),
        );
        k.piece(surface(lead - 0.005, 0.045, 0.02, 1, 0, () => new T.Color("#7a6551")));
      });
  });

  return { hub, shaft };
}
