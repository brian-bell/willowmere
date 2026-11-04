import * as T from "three";
import { createPlanters } from "../planters.js";
import { MARKET } from "../regions/market-layout.js";
import { HERON } from "../regions/heron-layout.js";
import { GROUND_WALLS, PUB, UPPER_WALLS, YARD, mainRoofY } from "./layout.js";
import { caskGeometry, paintHeron, paintedMaterial, tudorArch, twistedShaft } from "./parts.js";

// The building's shell, from the plinth to the ridge: English-bond brick below
// with a diaper of burnt headers, a jettied timber frame with herringbone
// nogging above, two gabled wings and the gallery between them, a clay-tiled
// roof, the great west stack with its twisted shafts, and the yard around it.

const { halfW, halfD, wing, gallery, kitchen } = PUB;
const U = PUB.loft;
const pitch = (PUB.ridge - PUB.eaves) / halfD;
const crossPitch = (wing.apexY - PUB.eaves) / (halfW - wing.inner) / 0.5;
const wingX = (halfW + wing.inner) / 2;
const valleyZ = (PUB.ridge - wing.apexY) / pitch;

// Which face of a wall meets the weather.
function outerOf(wall) {
  if (wall.id === "west-return") return wall.b;
  if (wall.id === "east-return") return wall.a;
  return Math.abs(wall.a) > Math.abs(wall.b) ? wall.a : wall.b;
}

function along(wall, u, v, across) {
  return wall.axis === "x" ? [u, v, across] : [across, v, u];
}

/** A stone-dressed window: mullions, a transom on tall lights, sill and hood. */
function stoneWindow(s, m, wall, o, outer, sign) {
  const { block, leaded } = s;
  const face = outer - sign * 0.1,
    { at, w, h, y0 } = o,
    lights = w > 2 ? 4 : w > 1 ? 2 : 1,
    transom = h > 1.45 ? y0 + h * 0.66 : null,
    frame = 0.1,
    box = (u0, v0, u1, v1, a0, a1) => {
      const [x0, y, z0] = along(wall, u0, v0, a0),
        [x1, yy, z1] = along(wall, u1, v1, a1);
      return block(m.stone, x0, y, z0, x1, yy, z1);
    };
  const inner = face - sign * 0.11,
    proud = outer + sign * 0.035;
  // Jambs, sill and lintel, reveals included.
  box(at - w / 2 - frame, y0 - 0.12, at - w / 2, y0 + h + 0.1, inner, proud);
  box(at + w / 2, y0 - 0.12, at + w / 2 + frame, y0 + h + 0.1, inner, proud);
  box(at - w / 2 - frame - 0.08, y0 - 0.17, at + w / 2 + frame + 0.08, y0, inner, outer + sign * 0.1);
  box(at - w / 2 - frame, y0 + h, at + w / 2 + frame, y0 + h + 0.14, inner, proud);
  // The hood-mould that throws the rain clear, with its returned ends.
  box(at - w / 2 - frame - 0.14, y0 + h + 0.14, at + w / 2 + frame + 0.14, y0 + h + 0.22, outer, outer + sign * 0.11);
  for (const side of [-1, 1]) {
    const c = at + side * (w / 2 + frame + 0.1);
    box(c - 0.04, y0 + h - 0.1, c + 0.04, y0 + h + 0.14, outer, outer + sign * 0.11);
  }
  const lightW = (w - (lights - 1) * 0.075) / lights;
  for (let i = 0; i < lights; i++) {
    const c = at - w / 2 + lightW / 2 + i * (lightW + 0.075);
    if (i < lights - 1)
      box(c + lightW / 2, y0, c + lightW / 2 + 0.075, y0 + h, inner, face + sign * 0.03);
    if (transom) {
      leaded(wall.axis, face - sign * 0.04, c, y0, lightW, transom - y0 - 0.04);
      leaded(wall.axis, face - sign * 0.04, c, transom + 0.04, lightW, y0 + h - transom - 0.04);
    } else leaded(wall.axis, face - sign * 0.04, c, y0, lightW, h);
  }
  if (transom) box(at - w / 2, transom - 0.04, at + w / 2, transom + 0.04, inner, face + sign * 0.03);
}

/** An arched stone door case and a plank door standing open. */
function archedDoor(s, m, wall, o, outer, sign, swing = 1.65) {
  const { at, w, h } = o,
    { sheet, group, box, cyl, torus } = s,
    surround = tudorArch(w + 0.36, h + 0.24, Math.min(w * 0.34, 0.5));
  surround.holes.push(tudorArch(w, h));
  const thick = 0.3;
  const base = along(wall, at, 0, outer - sign * thick + sign * 0.035);
  // The arch's outline in the wall's own plane, with its flat lintel block.
  const u = wall.axis === "x" ? [1, 0, 0] : [0, 0, 1];
  sheet(m.stone, surround, base, u, [0, 1, 0], thick);
  s.block(
    m.stone,
    ...along(wall, at - w / 2 - 0.42, h + 0.12, outer),
    ...along(wall, at + w / 2 + 0.42, h + 0.22, outer + sign * 0.09),
  );
  // Threshold.
  s.block(
    m.stone,
    ...along(wall, at - w / 2 - 0.1, 0, outer - sign * 0.36),
    ...along(wall, at + w / 2 + 0.1, 0.04, outer + sign * 0.28),
  );
  // With nothing built behind it, a shut door needs a dark hall at its back.
  if (m.outsideOnly)
    s.block(m.oakDark, ...along(wall, at - w / 2 - 0.02, 0, outer - sign * 0.33), ...along(wall, at + w / 2 + 0.02, h, outer - sign * 0.3));
  // The door: hinged at its left jamb, swung inward, boards and strap hinges.
  const hingeU = at - w / 2 + 0.02;
  const hinge = along(wall, hingeU, 0, outer - sign * 0.26);
  const rotation = wall.axis === "x" ? 0 : -Math.PI / 2;
  const leaf = group(hinge[0], 0, hinge[2], rotation + sign * -swing * (wall.axis === "x" ? -1 : 1));
  const shape = tudorArch(w - 0.04, h - 0.03);
  const door = new T.Mesh(
    new T.ExtrudeGeometry(shape, { depth: 0.055, bevelEnabled: false, curveSegments: 6 }),
    m.oakDark,
  );
  door.position.set((w - 0.04) / 2, 0.01, 0);
  door.castShadow = door.receiveShadow = true;
  leaf.add(door);
  const boards = 5;
  for (let i = 1; i < boards; i++)
    box(m.oak, ((w - 0.04) / boards) * i, (h - 0.2) / 2, 0.062, 0.014, h - 0.3, 0.012, 0, leaf);
  for (const y of [0.42, 1.45]) {
    box(m.iron, (w - 0.04) * 0.4, y, 0.066, (w - 0.04) * 0.78, 0.05, 0.012, 0.004, leaf);
    box(m.iron, (w - 0.04) * 0.4, y, -0.008, (w - 0.04) * 0.78, 0.05, 0.012, 0.004, leaf);
    cyl(m.iron, (w - 0.04) * 0.79, y, 0.066, 0.042, 0.012, 0.042, leaf, 10).rotation.x = Math.PI / 2;
  }
  const ring = torus(m.iron, (w - 0.04) * 0.82, 1.02, 0.078, 0.05, 0.009, leaf);
  ring.rotation.y = 0.2;
  cyl(m.iron, (w - 0.04) * 0.82, 1.06, 0.07, 0.022, 0.014, 0.022, leaf, 8).rotation.x = Math.PI / 2;
}

/** One wall of the ground storey: brick, stone dressings and doors, inside plaster. */
function brickWall(s, m, wall) {
  const { skin, block } = s;
  const y1 = U;
  {
    const outer = outerOf(wall),
      inner = outer === wall.a ? wall.b : wall.a,
      sign = Math.sign(outer - inner),
      middle = outer - sign * 0.22;
    skin(m.brick, wall.axis, wall.from, wall.to, outer, middle, 0, y1, wall.openings);
    if (m.plaster) skin(m.plaster, wall.axis, wall.from, wall.to, middle, inner, 0, PUB.ceiling, wall.openings);
    // The stone plinth, stopping at the doors.
    const doors = (wall.openings || []).filter((o) => o.door || o.flue).sort((a, b) => a.at - b.at);
    let start = wall.from;
    const runs = [];
    for (const d of doors) {
      runs.push([start, d.at - d.w / 2 - 0.18]);
      start = d.at + d.w / 2 + 0.18;
    }
    runs.push([start, wall.to]);
    for (const [p, q] of runs) {
      if (q <= p) continue;
      block(m.stoneDark, ...along(wall, p, 0, outer), ...along(wall, q, 0.46, outer + sign * 0.045));
      block(m.stone, ...along(wall, p, 0.46, outer), ...along(wall, q, 0.54, outer + sign * 0.02));
    }
    for (const o of wall.openings || []) {
      if (o.flue) continue;
      if (o.door) archedDoor(s, m, wall, o, outer, sign, m.outsideOnly ? 0.02 : wall.id === "front" ? 1.72 : 1.35);
      else stoneWindow(s, m, wall, o, outer, sign);
    }
    // A moulded brick string under the timber frame.
    block(m.stone, ...along(wall, wall.from, PUB.ceiling + 0.03, outer), ...along(wall, wall.to, PUB.ceiling + 0.11, outer + sign * 0.05));
  }
}

/** Quoins at the outer corners: alternate long and short stones. */
function quoins(s, m) {
  const { block } = s;
  const corners = [
    [-halfW, -halfD, 1, 1],
    [halfW, -halfD, -1, 1],
    [-halfW, wing.front, 1, -1],
    [halfW, wing.front, -1, -1],
    [-wing.inner, wing.front, -1, -1],
    [wing.inner, wing.front, 1, -1],
  ];
  for (const [x, z, sx, sz] of corners)
    for (let i = 0, y = 0.54; y < 3.05; i++) {
      const h = 0.24,
        a = i % 2 ? 0.46 : 0.26,
        b = i % 2 ? 0.26 : 0.46,
        out = 0.03;
      block(m.stone, x - sx * out, y, z - sz * out, x + sx * a, y + h, z + sz * 0.02);
      block(m.stone, x - sx * out, y, z - sz * out, x + sx * 0.02, y + h, z + sz * b);
      y += h + 0.018;
    }
}

/** A wooden casement in the frame: posts, cill and head, leaded lights. */
function timberWindow(s, m, wall, o, outer, sign) {
  const { timber, leaded } = s;
  const { at, w, h, y0 } = o,
    lights = w > 2 ? 4 : w > 1.05 ? 2 : 1,
    plane = outer - sign * 0.07,
    p = (u, v) => along(wall, u, v, plane);
  timber(m.oak, p(at - w / 2 - 0.2, y0 - 0.05), p(at + w / 2 + 0.2, y0 - 0.05), 0.11, 0.2);
  timber(m.oak, p(at - w / 2 - 0.2, y0 + h + 0.05), p(at + w / 2 + 0.2, y0 + h + 0.05), 0.11, 0.2);
  const lightW = (w - (lights - 1) * 0.06) / lights;
  for (let i = 0; i < lights; i++) {
    const c = at - w / 2 + lightW / 2 + i * (lightW + 0.06);
    if (i < lights - 1) timber(m.oak, p(c + lightW / 2 + 0.03, y0), p(c + lightW / 2 + 0.03, y0 + h), 0.06, 0.12);
    leaded(wall.axis, plane, c, y0, lightW, h);
  }
}

// The studs of one frame wall, split around its openings and cut to `top(u)`.
function studs(s, m, wall, outer, sign, y0, top, spacing, skipEnds = 0.25) {
  const plane = outer - sign * 0.1,
    openings = wall.openings || [],
    { timber } = s;
  const from = wall.from + skipEnds,
    to = wall.to - skipEnds,
    n = Math.max(1, Math.round((to - from) / spacing));
  for (let i = 0; i <= n; i++) {
    const u = from + ((to - from) * i) / n,
      head = top(u);
    if (head - y0 < 0.15) continue;
    const hit = openings.find((o) => Math.abs(u - o.at) < o.w / 2 + 0.11 && o.y0 < head);
    const runs = hit
      ? [
          [y0, hit.y0 - 0.1],
          [hit.y0 + hit.h + 0.1, head],
        ]
      : [[y0, head]];
    for (const [a, b] of runs)
      if (b - a > 0.12)
        timber(m.oak, along(wall, u, a, plane), along(wall, u, b, plane), 0.105, 0.24);
  }
}

/** One wall of the upper storey's jettied frame: herringbone out, plaster in. */
function frameWall(s, m, wall) {
  const { skin, timber } = s;
  const y0 = U,
    y1 = PUB.eaves;
  {
    const outer = outerOf(wall),
      inner = outer === wall.a ? wall.b : wall.a,
      sign = Math.sign(outer - inner),
      middle = outer - sign * 0.11;
    skin(m.nogging, wall.axis, wall.from, wall.to, outer - sign * 0.025, middle, y0, y1, wall.openings);
    if (m.plaster) skin(m.plaster, wall.axis, wall.from, wall.to, middle, inner + sign * 0.02, y0, y1, wall.openings);
    const plane = outer - sign * 0.1,
      at = (u, v) => along(wall, u, v, plane);
    // Sole plate, mid rail and wall plate; corner posts stand proud.
    timber(m.oak, at(wall.from, y0 + 0.08), at(wall.to, y0 + 0.08), 0.17, 0.24);
    timber(m.oak, at(wall.from, y1 - 0.08), at(wall.to, y1 - 0.08), 0.17, 0.26);
    for (const u of [wall.from + 0.09, wall.to - 0.09])
      timber(m.oak, at(u, y0), at(u, y1), 0.2, 0.26);
    studs(s, m, wall, outer, sign, y0 + 0.14, () => y1 - 0.14, 0.46);
    for (const o of wall.openings || []) {
      if (!o.door) timberWindow(s, m, wall, o, outer, sign);
      else {
        const p = (u, v) => along(wall, u, v, plane);
        timber(m.oak, p(o.at - o.w / 2 - 0.07, y0), p(o.at - o.w / 2 - 0.07, y0 + o.h + 0.1), 0.13, 0.24);
        timber(m.oak, p(o.at + o.w / 2 + 0.07, y0), p(o.at + o.w / 2 + 0.07, y0 + o.h + 0.1), 0.13, 0.24);
        timber(m.oak, p(o.at - o.w / 2 - 0.14, y0 + o.h + 0.06), p(o.at + o.w / 2 + 0.14, y0 + o.h + 0.06), 0.14, 0.24);
        // From outside, with no loft to open onto, the door stands closed.
        if (m.outsideOnly)
          s.block(m.oakDark, ...along(wall, o.at - o.w / 2, y0, outer - sign * 0.1), ...along(wall, o.at + o.w / 2, y0 + o.h, outer - sign * 0.04));
      }
    }
    // Long straight braces at the two ends of each long wall.
    if (wall.to - wall.from > 6) {
      for (const [u, dir] of [
        [wall.from + 0.12, 1],
        [wall.to - 0.12, -1],
      ])
        timber(m.oak, at(u, y0 + 0.14), at(u + dir * 0.82, y1 - 0.14), 0.1, 0.26);
    }
  }
}

/** The ground-floor ceiling carried as the jetties' bressummers and brackets. */
function jetties(s, m) {
  const { timber, sheet, block } = s;
  const bracket = new T.Shape();
  bracket.moveTo(0, 0);
  bracket.lineTo(0.42, 0);
  bracket.bezierCurveTo(0.4, -0.22, 0.2, -0.3, 0.14, -0.62);
  bracket.lineTo(0, -0.62);
  bracket.closePath();
  for (const side of [-1, 1]) {
    const inner = side * wing.inner,
      outer = side * halfW;
    // Bressummer, moulded, sailing past the wall on projecting joists.
    timber(m.oak, [outer + side * 0.05, U + 0.02, wing.jetty - 0.09], [inner - side * 0.02, U + 0.02, wing.jetty - 0.09], 0.28, 0.24);
    timber(m.oakDark, [outer + side * 0.04, U - 0.14, wing.jetty - 0.05], [inner - side * 0.01, U - 0.14, wing.jetty - 0.05], 0.1, 0.12);
    const count = 11;
    for (let i = 0; i <= count; i++) {
      const x = inner + ((outer - inner) * (i + 0.5)) / (count + 1);
      timber(m.oak, [x, U - 0.11, wing.front - 0.05], [x, U - 0.11, wing.jetty - 0.05], 0.11, 0.13);
    }
    block(m.sark, inner, U - 0.04, wing.front - 0.02, outer, U - 0.02, wing.jetty - 0.05);
    // A carved bracket under each end, and over the middle of the window.
    for (const x of [outer - side * 0.12, inner + side * 0.12])
      sheet(m.oak, bracket, [x - 0.07, U - 0.15, wing.front], [0, 0, 1], [0, 1, 0], 0.14);
    // The upper apex jetty's own little bressummer.
    timber(m.oak, [outer + side * 0.1, PUB.eaves + 0.02, wing.apexFront - 0.09], [inner - side * 0.04, PUB.eaves + 0.02, wing.apexFront - 0.09], 0.2, 0.22);
    const small = 9;
    for (let i = 0; i <= small; i++) {
      const x = inner + ((outer - inner) * (i + 0.5)) / (small + 1);
      timber(m.oak, [x, PUB.eaves - 0.07, wing.jetty - 0.04], [x, PUB.eaves - 0.07, wing.apexFront - 0.04], 0.08, 0.1);
    }
    block(m.sark, inner, PUB.eaves - 0.02, wing.jetty - 0.06, outer, PUB.eaves, wing.apexFront - 0.04);
  }
}

// A cusped bargeboard from a to b, hanging below that line in the plane of the
// gable it trims. `plane` is "x" for a street gable, "z" for an end gable.
function bargeboard(s, m, a, b) {
  const start = new T.Vector3(...a),
    end = new T.Vector3(...b),
    dir = end.clone().sub(start),
    length = dir.length();
  dir.normalize();
  const horizontal = new T.Vector3(dir.x, 0, dir.z).normalize();
  // Down the slope's perpendicular, inside the gable's plane.
  const down = new T.Vector3()
    .copy(horizontal)
    .multiplyScalar(dir.y)
    .add(new T.Vector3(0, -Math.hypot(dir.x, dir.z), 0));
  const shape = new T.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(length, 0);
  const depth = 0.3,
    cusps = Math.max(3, Math.round(length / 0.46)),
    step = length / cusps;
  shape.lineTo(length, depth * 0.72);
  for (let i = 0; i < cusps; i++) {
    const x1 = length - step * i,
      x2 = x1 - step;
    shape.quadraticCurveTo((x1 + x2) / 2, depth * 0.3, x2 + step * 0.06, depth * 0.72);
    shape.lineTo(x2, depth * 0.96);
    if (i < cusps - 1) shape.lineTo(x2 - step * 0.02, depth * 0.72);
  }
  shape.lineTo(0, 0);
  const normal = new T.Vector3().crossVectors(dir, down).normalize();
  const origin = start.clone().addScaledVector(normal, -0.035);
  return s.sheet(m.bargeOak, shape, origin.toArray(), dir.toArray(), down.toArray(), 0.07, 4);
}

function quatrefoil(s, m, wall, u, v, r, plane) {
  const shape = new T.Shape();
  shape.moveTo(-r, -r);
  shape.lineTo(r, -r);
  shape.lineTo(r, r);
  shape.lineTo(-r, r);
  shape.closePath();
  const hole = new T.Path();
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2,
      c = r * 0.42;
    hole.absarc(Math.cos(a) * c, Math.sin(a) * c, r * 0.34, a - Math.PI * 0.62, a + Math.PI * 0.62, false);
  }
  hole.closePath();
  shape.holes.push(hole);
  const axis = wall === "x" ? [1, 0, 0] : [0, 0, 1];
  s.sheet(m.oak, shape, wall === "x" ? [u, v, plane] : [plane, v, u], axis, [0, 1, 0], 0.05, 6);
}

/** A wing's street gable above the wall plate. */
function streetGable(s, m, side) {
  const { skin, timber, bar } = s;
  const y0 = PUB.eaves;
  {
    const left = side < 0 ? -halfW : wing.inner,
      right = side < 0 ? -wing.inner : halfW,
      mid = (left + right) / 2,
      apex = wing.apexY,
      z = wing.apexFront,
      outline = [[left, y0 + 0.13], [right, y0 + 0.13], [mid, apex]];
    skin(m.nogging, "x", left, right, z - 0.1, z - 0.025, y0, apex, [], outline);
    const height = (u) => y0 + 0.13 + (1 - Math.abs(u - mid) / ((right - left) / 2)) * (apex - y0 - 0.13);
    const plane = z - 0.06;
    // King post, close studding either side, and a pair of quatrefoils.
    timber(m.oak, [mid, y0 + 0.13, plane], [mid, apex - 0.06, plane], 0.17, 0.14);
    timber(m.oak, [left + 0.1, y0 + 0.13, plane], [mid - 0.06, apex - 0.1, plane], 0.17, 0.14);
    timber(m.oak, [right - 0.1, y0 + 0.13, plane], [mid + 0.06, apex - 0.1, plane], 0.17, 0.14);
    const count = 11;
    for (let i = 1; i < count; i++) {
      const u = left + ((right - left) * i) / count;
      if (Math.abs(u - mid) < 0.1) continue;
      const head = height(u) - 0.1;
      if (Math.abs(u - mid) < 0.72 && head > y0 + 1.15) {
        timber(m.oak, [u, y0 + 0.13, plane], [u, y0 + 0.5, plane], 0.09, 0.12);
        timber(m.oak, [u, y0 + 1.08, plane], [u, head, plane], 0.09, 0.12);
      } else if (head - y0 > 0.3) timber(m.oak, [u, y0 + 0.13, plane], [u, head, plane], 0.09, 0.12);
    }
    timber(m.oak, [left + 0.2, y0 + 0.5, plane], [right - 0.2, y0 + 0.5, plane], 0.1, 0.13);
    // The louvred light at the apex, between its head and sill.
    timber(m.oak, [mid - 0.56, y0 + 1.08, plane], [mid + 0.56, y0 + 1.08, plane], 0.1, 0.13);
    for (let i = 0; i < 5; i++)
      bar(m.oakDark, [mid - 0.46, y0 + 0.62 + i * 0.09, plane + 0.03], [mid + 0.46, y0 + 0.62 + i * 0.09, plane + 0.03], 0.04, 0.055);
    s.block(m.soot, mid - 0.5, y0 + 0.5, plane - 0.04, mid + 0.5, y0 + 1.04, plane - 0.01);
    for (const off of [-1, 1])
      quatrefoil(s, m, "x", mid + off * 1.2, y0 + 0.3, 0.13, z - 0.04);
    // Bargeboards and a finial with a little carved pendant.
    const front = wing.roofFront - 0.02;
    const over = PUB.gableOver;
    const eaveY = y0 - over * crossPitch;
    bargeboard(s, m, [left - over, eaveY, front], [mid, apex + 0.03, front]);
    bargeboard(s, m, [right + over, eaveY, front], [mid, apex + 0.03, front]);
    const { cyl, orb } = s;
    cyl(m.bargeOak, mid, apex + 0.28, front - 0.02, 0.06, 0.66, 0.05, undefined, 8);
    orb(m.bargeOak, mid, apex + 0.66, front - 0.02, 0.09, 0.15, 0.09);
    cyl(m.bargeOak, mid, apex - 0.28, front - 0.02, 0.03, 0.34, 0.055, undefined, 8);
  }
}

/** One end gable, on the range's own roof. */
function endGable(s, m, side) {
  const { skin, timber } = s;
  const y0 = PUB.eaves;
  {
    const x = side * halfW,
      a = side * (halfW - 0.2),
      outline = [[-halfD, y0], [halfD, y0], [0, PUB.ridge]];
    skin(m.nogging, "z", -halfD, halfD, x - side * 0.025, x - side * 0.11, y0, PUB.ridge, [], outline);
    if (m.plaster) skin(m.plaster, "z", -halfD, halfD, x - side * 0.11, a, y0, PUB.ridge, [], outline);
    const plane = x - side * 0.09,
      roofAt = (z) => mainRoofY(z);
    timber(m.oak, [plane, y0 + 0.02, -halfD], [plane, y0 + 0.02, halfD], 0.2, 0.2);
    timber(m.oak, [plane, y0 - 0.16, -halfD + 0.1], [plane, PUB.ridge - 0.34, -0.04], 0.16, 0.22);
    timber(m.oak, [plane, y0 - 0.16, halfD - 0.1], [plane, PUB.ridge - 0.34, 0.04], 0.16, 0.22);
    timber(m.oak, [plane, y0 + 0.1, 0], [plane, PUB.ridge - 0.3, 0], 0.18, 0.22);
    timber(m.oak, [plane, y0 + 1.5, -2.5], [plane, y0 + 1.5, 2.5], 0.12, 0.2);
    const n = 16;
    for (let i = 1; i < n; i++) {
      const z = -halfD + (2 * halfD * i) / n;
      if (Math.abs(z) < 0.2) continue;
      // The east gable keeps a window in its middle; the stack hides the west's.
      const head = roofAt(z) - 0.3;
      if (head - y0 < 0.3) continue;
      if (side > 0 && Math.abs(z) < 0.55 && head > y0 + 2) {
        timber(m.oak, [plane, y0 + 0.1, z], [plane, y0 + 1.55, z], 0.08, 0.2);
        timber(m.oak, [plane, y0 + 2.55, z], [plane, head, z], 0.08, 0.2);
      } else timber(m.oak, [plane, y0 + 0.1, z], [plane, head, z], 0.08, 0.2);
    }
    for (const [from, to] of [[-1, 1], [1, -1]]) {
      const z0 = from * 2.8,
        z1 = to * 0.08;
      if (side > 0 || Math.abs(z0) > 0)
        timber(m.oak, [plane, y0 + 0.14, z0], [plane, y0 + 1.46, z0 * 0.42 + z1], 0.09, 0.2);
    }
    if (side > 0) {
      // A little window lights the east gable's rafters from inside.
      s.block(m.soot, plane - 0.04, y0 + 1.55, -0.45, plane + 0.03, y0 + 2.5, 0.45);
      timber(m.oak, [plane + 0.02, y0 + 1.55, -0.52], [plane + 0.02, y0 + 1.55, 0.52], 0.09, 0.14);
      timber(m.oak, [plane + 0.02, y0 + 2.52, -0.52], [plane + 0.02, y0 + 2.52, 0.52], 0.09, 0.14);
      timber(m.oak, [plane + 0.02, y0 + 1.55, 0], [plane + 0.02, y0 + 2.52, 0], 0.06, 0.12);
      for (const z of [-0.26, 0.26]) s.leaded("z", plane + 0.04, z, y0 + 1.58, 0.48, 0.92);
    }
    // Verge boards on the rake.
    const rakeX = x + side * PUB.gableOver;
    bargeboard(s, m, [rakeX, PUB.eaves - PUB.roofOver * pitch, -halfD - PUB.roofOver], [rakeX, PUB.ridge + 0.03, 0]);
    bargeboard(s, m, [rakeX, PUB.eaves, halfD], [rakeX, PUB.ridge + 0.03, 0]);
  }
}

// A planar slab from corner points on the roof's top surface. Its underside
// shows inside as boards.
function pane(s, m, points, thick = 0.1, material = m.sark) {
  const p = points.map((v) => new T.Vector3(...v)),
    u = p[1].clone().sub(p[0]).normalize(),
    other = p[2].clone().sub(p[0]);
  const n = new T.Vector3().crossVectors(u, other).normalize();
  if (n.y < 0) n.negate();
  const v = new T.Vector3().crossVectors(n, u);
  const shape = new T.Shape(
    p.map((q) => {
      const d = q.clone().sub(p[0]);
      return new T.Vector2(d.dot(u), d.dot(v));
    }),
  );
  const origin = p[0].clone().addScaledVector(n, -thick);
  return s.sheet(material, shape, origin.toArray(), u.toArray(), v.toArray(), thick);
}

// Whether (px, pz) falls inside a plan polygon.
function inside(polygon, px, pz) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i],
      [xj, zj] = polygon[j];
    if (zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

// A tile as only what shows from above: its face and its lower edge, four triangles.
function leanTile(w, l, t) {
  const a = w / 2,
    b = l / 2,
    c = t / 2;
  const g = new T.BufferGeometry();
  g.setAttribute(
    "position",
    new T.Float32BufferAttribute([-a, -b, c, a, -b, c, a, b, c, -a, b, c, -a, -b, -c, a, -b, -c, a, -b, c, -a, -b, c], 3),
  );
  g.setAttribute("normal", new T.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  return g;
}

const TILE_REDS = ["#a8624a", "#ae6a4f", "#a05c46", "#b47355", "#a7654b", "#9b5a44", "#ad6e52"];

/** Every roof pane's clay tiles, as one instanced mesh: one draw for the lot. */
function tiles(root, panes, random, { width = 0.25, exposure = 0.17, lean = false } = {}) {
  const placed = [];
  const u = new T.Vector3(),
    v = new T.Vector3(),
    n = new T.Vector3();
  for (const { polygon, y, downhill, moss = 0 } of panes) {
    // Courses run across the fall; `downhill` is the fall's plan direction.
    const across = [-downhill[1], downhill[0]];
    let minAlong = Infinity,
      maxAlong = -Infinity,
      minAcross = Infinity,
      maxAcross = -Infinity;
    for (const [x, z] of polygon) {
      const d = x * downhill[0] + z * downhill[1],
        c = x * across[0] + z * across[1];
      minAlong = Math.min(minAlong, d);
      maxAlong = Math.max(maxAlong, d);
      minAcross = Math.min(minAcross, c);
      maxAcross = Math.max(maxAcross, c);
    }
    const slope = Math.abs(y(polygon[0][0] + downhill[0], polygon[0][1] + downhill[1]) - y(polygon[0][0], polygon[0][1]));
    const planStep = exposure / Math.hypot(1, slope),
      tileW = width;
    let row = 0;
    for (let d = maxAlong - planStep * 0.3; d > minAlong; d -= planStep, row++) {
      for (let c = minAcross + (row % 2 ? tileW / 2 : 0); c < maxAcross; c += tileW) {
        const x = downhill[0] * d + across[0] * c,
          z = downhill[1] * d + across[1] * c;
        if (!inside(polygon, x, z)) continue;
        placed.push({ x, z, y: y(x, z), downhill, across, slope, moss, row });
      }
    }
  }
  const geometry = lean
    ? leanTile(width * 0.98, exposure * 1.76, 0.022)
    : new T.BoxGeometry(width * 0.98, exposure * 1.76, 0.022);
  const mesh = new T.InstancedMesh(
    geometry,
    new T.MeshStandardMaterial({ color: "#ffffff", roughness: 0.88 }),
    placed.length,
  );
  const matrix = new T.Matrix4(),
    color = new T.Color(),
    moss = new T.Color("#7c8558"),
    tilt = new T.Quaternion(),
    base = new T.Quaternion(),
    pos = new T.Vector3(),
    one = new T.Vector3(1, 1, 1);
  placed.forEach((t, i) => {
    u.set(t.across[0], 0, t.across[1]).normalize();
    v.set(-t.downhill[0], t.slope, -t.downhill[1]).normalize();
    n.crossVectors(u, v);
    if (n.y < 0) {
      u.negate();
      n.negate();
    }
    matrix.makeBasis(u, v, n);
    base.setFromRotationMatrix(matrix);
    tilt.setFromAxisAngle(new T.Vector3(1, 0, 0), 0.05 + random() * 0.05);
    base.multiply(tilt);
    pos
      .set(t.x, t.y, t.z)
      .addScaledVector(n, 0.02 + random() * 0.006)
      .addScaledVector(v, -0.02);
    matrix.compose(pos, base, one);
    mesh.setMatrixAt(i, matrix);
    color.set(TILE_REDS[Math.floor(random() * TILE_REDS.length)]);
    color.offsetHSL(0, (random() - 0.5) * 0.02, (random() - 0.5) * 0.022);
    // Lichen gathers low on the slope and on the shaded rear.
    const low = 1 - Math.min(1, (t.y - PUB.eaves + 0.5) / 4);
    if (random() < t.moss * (0.2 + low * 0.5)) color.lerp(moss, 0.18 + random() * 0.32);
    mesh.setColorAt(i, color);
  });
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.name = "pub-tiles";
  mesh.matrixAutoUpdate = false;
  root.add(mesh);
  geometry.computeBoundingSphere();
  mesh.computeBoundingSphere();
  return mesh;
}

/** The roof: slabs, tiles, ridges and lead-lined valleys, and the pentice. */
function roofs(s, m) {
  const { timber, bar, cyl } = s,
    W = halfW + PUB.gableOver,
    r = PUB.ridge,
    e = PUB.eaves,
    over = PUB.roofOver,
    eave = e - over * pitch;
  // The range's two slopes, whole: the wings' roofs run through them, so the
  // line where they meet is the valley itself.
  pane(s, m, [[-W, r, 0], [W, r, 0], [W, eave, -halfD - over], [-W, eave, -halfD - over]]);
  pane(s, m, [[-W, r, 0], [W, r, 0], [W, e, halfD], [-W, e, halfD]]);
  const mainY = (x, z) => mainRoofY(z);
  // The wings' two slopes each, from the ridge to their eaves.
  const crossY = (side) => (x) => wing.apexY - Math.abs(x - side * wingX) * crossPitch;
  const roofFront = wing.roofFront,
    outerOver = PUB.gableOver,
    valleyStep = (halfD - valleyZ) / (wingX - wing.inner);
  const tilePanes = [
    {
      polygon: [[-W, 0], [W, 0], [W, -halfD - over], [-W, -halfD - over]],
      y: mainY,
      downhill: [0, -1],
      moss: 0.24,
    },
    {
      polygon: [
        [-W, 0],
        [W, 0],
        [W, halfD],
        [halfW, halfD],
        [wingX, valleyZ],
        [wingX - 1.0625, 3],
        [-wingX + 1.0625, 3],
        [-wingX, valleyZ],
        [-halfW, halfD],
        [-W, halfD],
      ],
      y: mainY,
      downhill: [0, 1],
      moss: 0.12,
    },
  ];
  for (const side of [-1, 1]) {
    const ridgeX = side * wingX,
      y = crossY(side);
    const outerX = side * (halfW + outerOver),
      outerZ = halfD + outerOver * valleyStep;
    const innerX = side * wing.inner;
    // The outward slope, cut at its valley, running on to its overhang.
    const outward = [
      [ridgeX, wing.apexY, valleyZ],
      [ridgeX, wing.apexY, roofFront],
      [outerX, y(outerX), roofFront],
      [outerX, y(outerX), outerZ],
    ];
    const inward = [
      [ridgeX, wing.apexY, valleyZ],
      [ridgeX, wing.apexY, roofFront],
      [innerX, e, roofFront],
      [innerX, e, halfD],
    ];
    pane(s, m, outward);
    pane(s, m, inward);
    tilePanes.push(
      {
        polygon: outward.map(([x, , z]) => [x, z]),
        y: (px) => y(px),
        downhill: [side, 0],
        moss: 0.16,
      },
      {
        polygon: inward.map(([x, , z]) => [x, z]),
        y: (px) => y(px),
        downhill: [-side, 0],
        moss: 0.16,
      },
    );
    // Lead in the valleys, from each wing's ridge down to the eaves.
    for (const end of [
      [side * halfW, e, halfD],
      [innerX, e, halfD],
    ])
      bar(m.lead, [ridgeX, wing.apexY + 0.03, valleyZ], [end[0], end[1] + 0.03, end[2]], 0.17, 0.02);
    // Ridge rolls on the wing.
    for (let z = valleyZ; z < roofFront; z += 0.36) {
      const roll = cyl(ridgeMat(s), ridgeX, wing.apexY + 0.05, z + 0.18, 0.082, 0.38, 0.082, undefined, 8);
      roll.rotation.x = Math.PI / 2;
    }
    // Rafter feet under the outward overhang, seen from the yard.
    for (let z = halfD + 0.2; z < roofFront - 0.05; z += 0.48) {
      const px = side * (halfW + outerOver * 0.92);
      timber(m.oak, [side * (halfW - 0.08), e - 0.06, z], [px, y(px) - 0.09, z], 0.075, 0.11);
    }
    // Soffit for the wings' front overhang.
    pane(s, m, [
      [side * (halfW + outerOver), e - 0.42, roofFront - 0.015],
      [innerX, e - 0.02, roofFront - 0.015],
      [innerX, e - 0.02, roofFront - 0.28],
    ], 0.01, m.sark);
  }
  // The pentice over the gallery, starting on the main slope.
  const pY = (z) => 6.625 - (z - 3) * 0.5,
    pFront = gallery.front + 0.32,
    edge = (z) => wing.inner + (pY(z) - e) / crossPitch,
    pPolygon = [
      [-edge(3), 3],
      [edge(3), 3],
      [wing.inner, 5.25],
      [wing.inner, pFront],
      [-wing.inner, pFront],
      [-wing.inner, 5.25],
    ];
  pane(s, m, pPolygon.map(([x, z]) => [x, pY(z), z]));
  tilePanes.push({ polygon: pPolygon, y: (x, z) => pY(z), downhill: [0, 1], moss: 0.1 });
  // Exposed rafters under the pentice, seen from the gallery.
  for (let x = -2.75; x <= 2.76; x += 0.5)
    timber(m.oak, [x, pY(halfD) - 0.09, halfD], [x, pY(pFront) - 0.09, pFront - 0.03], 0.075, 0.11);
  timber(m.oak, [-wing.inner, gallery.eave - 0.03, gallery.front - 0.05], [wing.inner, gallery.eave - 0.03, gallery.front - 0.05], 0.16, 0.2);
  // Main ridge rolls.
  for (let x = -W; x < W; x += 0.36) {
    const roll = cyl(ridgeMat(s), x + 0.18, r + 0.05, 0, 0.09, 0.38, 0.09, undefined, 8);
    roll.rotation.z = Math.PI / 2;
  }
  // Eaves fascia and gutter board at the rear; a stone bird on the ridge.
  timber(m.oak, [-W, eave - 0.05, -halfD - over], [W, eave - 0.05, -halfD - over], 0.09, 0.14);
  for (let x = -6.9; x <= 6.9; x += 0.48)
    timber(m.oak, [x, e - 0.07, -halfD + 0.05], [x, eave - 0.09, -halfD - over + 0.03], 0.075, 0.11);
  ridgeHeron(s, m);
  return tilePanes;
}

function ridgeMat(s) {
  return s.mat("#a4644b", 0.86);
}

// A little iron heron on the ridge: the sign's bird, in silhouette.
function ridgeHeron(s, m) {
  const shape = new T.Shape();
  const pts = [
    [-0.06, 0], [0.02, 0], [0.02, 0.28], [0.18, 0.34], [0.3, 0.56], [0.12, 0.52], [0.06, 0.74],
    [0.1, 0.9], [-0.02, 0.98], [-0.32, 0.86], [-0.04, 0.82], [-0.06, 0.6], [-0.14, 0.42], [-0.06, 0.28],
  ];
  pts.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  return s.sheet(m.iron, shape, [3.5, PUB.ridge + 0.12, -0.015], [1, 0, 0], [0, 1, 0], 0.03);
}

/** The gallery: posts and arcade below, floor, balustrade and fascia above. */
function galleryFront(ground, upper, m, planters) {
  const { timber: gt, sheet: gs, block: gb } = ground,
    { timber: ut, block: ub, cyl } = upper,
    posts = [-2.85, -1.2, 1.2, 2.85],
    f = gallery.front - 0.1;
  // Stone pads and the porch's flags.
  for (const x of posts) {
    gb(m.stone, x - 0.2, 0, f - 0.2, x + 0.2, 0.12, f + 0.2);
    gt(m.oak, [x, 0.12, f], [x, U - 0.2, f], 0.26, 0.26);
    // Moulded capital where the post meets the bressummer.
    gt(m.oakDark, [x, U - 0.42, f], [x, U - 0.3, f], 0.34, 0.34);
  }
  // Four-centred arch braces between the posts, the door's echo.
  const arch = (u0, u1) => {
    const width = u1 - u0 - 0.26,
      shape = new T.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(width, 0);
    shape.lineTo(width, -0.6);
    shape.bezierCurveTo(width * 0.92, -0.26, width * 0.7, -0.18, width / 2, -0.14);
    shape.bezierCurveTo(width * 0.3, -0.18, width * 0.08, -0.26, 0, -0.6);
    shape.closePath();
    gs(m.oak, shape, [u0 + 0.13, U - 0.26, f - 0.06], [1, 0, 0], [0, 1, 0], 0.12, 10);
  };
  arch(-2.85, -1.2);
  arch(-1.2, 1.2);
  arch(1.2, 2.85);
  gt(m.oak, [-3, U - 0.13, f], [3, U - 0.13, f], 0.26, 0.26);
  // The joists and boards of the porch's ceiling, with their ends showing.
  for (let x = -2.75; x <= 2.76; x += 0.42)
    gt(m.oak, [x, U - 0.11, halfD - 0.02], [x, U - 0.11, gallery.front + 0.03], 0.11, 0.13);
  gb(m.sark, -3, U - 0.05, halfD, 3, U - 0.02, gallery.front + 0.06);
  // Porch benches and the door's boot scraper.
  const bench = (x) => {
    gb(m.oakWarm, x - 0.5, 0.42, halfD + 0.06, x + 0.5, 0.48, halfD + 0.42);
    for (const dx of [-0.42, 0.42]) gb(m.oakDark, x + dx - 0.03, 0, halfD + 0.1, x + dx + 0.03, 0.42, halfD + 0.38);
  };
  bench(-2.05);
  bench(2.05);
  // The floor's boards run along the gallery, with a dark edge to the street.
  ub(m.boards, -wing.inner, U - 0.02, halfD, wing.inner, U + 0.03, gallery.front + 0.1);
  ut(m.oakDark, [-3, U + 0.05, gallery.front + 0.02], [3, U + 0.05, gallery.front + 0.02], 0.1, 0.12);
  // Upper posts carry the pentice; turned balusters and a broad top rail.
  const rail = U + gallery.railY;
  for (const x of posts) {
    ut(m.oak, [x, U, f], [x, gallery.eave, f], 0.18, 0.18);
    ut(m.oak, [x, gallery.eave - 0.56, f + 0.08], [x + (x < 0 ? 0.42 : -0.42), gallery.eave - 0.08, f + 0.08], 0.07, 0.09);
    ut(m.oak, [x, gallery.eave - 0.56, f + 0.08], [x + (x < 0 ? -0.15 : 0.15), gallery.eave - 0.3, f + 0.08], 0.07, 0.09);
  }
  ut(m.oakWarm, [-3, rail, f], [3, rail, f], 0.09, 0.16);
  ut(m.oak, [-3, U + 0.14, f], [3, U + 0.14, f], 0.08, 0.12);
  for (const [a, b] of [[-2.85, -1.2], [-1.2, 1.2], [1.2, 2.85]]) {
    const n = Math.round((b - a) / 0.16);
    for (let i = 1; i < n; i++) {
      const x = a + ((b - a) * i) / n;
      cyl(m.oakWarm, x, U + 0.58, f, 0.026, gallery.railY - 0.2, 0.026, undefined, 6);
      upper.orb(m.oakWarm, x, U + 0.55, f, 0.044, 0.1, 0.044);
    }
  }
  // Flower boxes on the rail's street side.
  for (const [x, w] of [[-2.02, 1.3], [2.02, 1.3]]) {
    ub(m.oak, x - w / 2, rail + 0.04, f + 0.03, x + w / 2, rail + 0.2, f + 0.28);
    const n = Math.round(w / (m.outsideOnly ? 0.36 : 0.2));
    for (let i = 0; i < n; i++) {
      const px = x - w / 2 + (w * (i + 0.5)) / n;
      planters.recipes[i % 2 ? "daisies" : "geranium"](
        px,
        rail + 0.19,
        f + 0.16,
        0.12,
        i % 2 ? planters.blooms.white : planters.blooms.scarlet,
      );
      planters.trail(px, rail + 0.2, f + 0.28, planters.range(0.26, 0.55), planters.foliage.ivy);
    }
  }
  planters.flush(upper.root);
  // The quilt aired over the rail in the centre bay.
  const quilt = ub(m.quilts[1], -0.5, rail - 0.62, f + 0.07, 0.5, rail + 0.05, f + 0.09);
  quilt.castShadow = true;
  ub(m.quilts[1], -0.5, rail + 0.04, f - 0.09, 0.5, rail + 0.07, f + 0.09);
  ub(m.quilts[1], -0.5, rail - 0.34, f - 0.09, 0.5, rail + 0.05, f - 0.07);
  // A fascia board carries the house's name along the gallery's eave.
  const sign = paintedMaterial(1536, 150, (c, w, h) => {
    c.fillStyle = "#2f4a42";
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "#d8bf85";
    c.lineWidth = 3;
    c.strokeRect(8, 8, w - 16, h - 16);
    c.fillStyle = "#ead7a8";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = "86px Georgia";
    c.fillText("THE DROWSY HERON", w / 2, h * 0.42);
    c.font = "italic 34px Georgia";
    c.fillText("good ale  ·  a warm hearth  ·  beds under the rafters", w / 2, h * 0.8);
  });
  gb(m.oakDark, -2.38, U - 0.66, f + 0.17, 2.38, U - 0.14, f + 0.21);
  const fascia = new T.Mesh(new T.PlaneGeometry(4.6, 0.45), sign);
  fascia.position.set(0, U - 0.4, f + 0.215);
  fascia.castShadow = false;
  ground.root.add(fascia);
}

/** The west stack, with its twisted shafts, and the kitchen's smaller one. */
function chimneys(s, m) {
  const { block, mesh } = s,
    stone = m.stone,
    h = PUB.hearth;
  const backX = h.backX - 0.32;
  // The hearth's great stack steps in twice, each step a sloped stone weathering.
  const steps = [
    { y0: 0, y1: 2.5, x: backX, half: 1.95 },
    { y0: 2.75, y1: 6.35, x: backX + 0.28, half: 1.28 },
    { y0: 6.6, y1: 10.5, x: backX + 0.52, half: 0.86 },
  ];
  const right = -halfW;
  steps.forEach((step, i) => {
    if (i === 0) {
      // Hollow: back, two cheeks and a head around the fire.
      block(m.brick, step.x, 0, -step.half, h.backX, step.y1, step.half);
      block(m.brick, h.backX, 0, -step.half, right, step.y1, -h.openHalfZ);
      block(m.brick, h.backX, 0, h.openHalfZ, right, step.y1, step.half);
      block(m.brick, h.backX, 2.02, -h.openHalfZ, right, step.y1, h.openHalfZ);
    } else block(m.brick, step.x, step.y0, -step.half, right, step.y1, step.half);
    if (i < steps.length - 1) {
      const next = steps[i + 1];
      // Weathering: a sloped lid from this step in to the next.
      const lid = new T.Shape([
        new T.Vector2(step.x - 0.04, step.y1),
        new T.Vector2(next.x, next.y0),
        new T.Vector2(right, next.y0),
        new T.Vector2(right, step.y1),
      ]);
      const g = new T.ExtrudeGeometry(lid, { depth: step.half * 2 + 0.08, bevelEnabled: false });
      mesh(g, stone, 0, 0, -step.half - 0.04);
    }
  });
  // Plinth and string courses.
  block(m.stoneDark, backX - 0.05, 0, -2, h.backX, 0.46, 2);
  for (const side of [-1, 1])
    block(m.stoneDark, backX - 0.05, 0, side * 1.95, right, 0.46, side * 2);
  block(m.stone, steps[2].x - 0.06, 10.45, -0.92, right + 0.06, 10.58, 0.92);
  block(m.brick, steps[2].x - 0.02, 10.58, -0.84, right + 0.02, 10.78, 0.84);
  block(m.stone, steps[2].x - 0.09, 10.78, -0.96, right + 0.09, 10.88, 0.96);
  // Three twisted shafts, each on a square base, each with a terracotta cap.
  const shaftX = (steps[2].x + right) / 2;
  for (const [i, z] of [-0.56, 0, 0.56].entries()) {
    block(m.brick, shaftX - 0.2, 10.88, z - 0.2, shaftX + 0.2, 11.1, z + 0.2);
    const g = twistedShaft(0.21, 1.25, 6, i === 1 ? -0.75 : 0.75, ...(m.outsideOnly ? [12, 18] : []));
    mesh(g, m.brick, shaftX, 11.1, z);
    s.cyl(m.stone, shaftX, 12.4, z, 0.22, 0.1, 0.26, undefined, 14);
    s.cyl(s.mat("#ad6b4c", 0.82), shaftX, 12.55, z, 0.17, 0.26, 0.13, undefined, 14);
    s.cyl(m.soot, shaftX, 12.69, z, 0.11, 0.01, 0.11, undefined, 12);
  }
  return { stacks: [[shaftX, 12.72, -0.56], [shaftX, 12.72, 0], [shaftX, 12.72, 0.56]] };
}

/** The kitchen's lean-to at the rear, with its own small stack. */
function kitchenWing(s, m) {
  const { block, skin, timber, sheet } = s,
    k = kitchen,
    z0 = k.minZ,
    z1 = -halfD;
  const fall = (k.wallY - k.lowY) / (z1 - z0);
  const heightAt = (z) => k.lowY + (z - z0) * fall;
  const windowOpening = { at: 3.2, w: 1.2, y0: 0.95, h: 0.95 };
  // Walls: brick out, plaster in.
  skin(m.brick, "x", k.minX, k.maxX, z0 - 0.24, z0 - 0.1, 0, k.lowY + 0.03, [windowOpening]);
  if (m.plaster) skin(m.plaster, "x", k.minX, k.maxX, z0 - 0.1, z0, 0, k.lowY + 0.03, [windowOpening]);
  for (const [x0, x1] of [[k.minX - 0.24, k.minX - 0.1], [k.maxX + 0.1, k.maxX + 0.24]]) {
    const outline = [[z0 - 0.24, 0], [z1, 0], [z1, k.wallY], [z0 - 0.24, heightAt(z0 - 0.24)]];
    const shape = new T.Shape(outline.map(([u, v]) => new T.Vector2(u, v)));
    sheet(m.brick, shape, [x1, 0, 0], [0, 0, 1], [0, 1, 0], x1 - x0);
  }
  if (m.plaster) for (const x of [k.minX, k.maxX]) block(m.plaster, x - 0.08, 0, z0, x + 0.08, k.lowY, z1);
  // Stone window dressing, a leaded casement and a shelf inside it.
  block(m.stone, windowOpening.at - 0.72, 0.84, z0 - 0.3, windowOpening.at + 0.72, 0.95, z0 + 0.1);
  block(m.stone, windowOpening.at - 0.68, 1.9, z0 - 0.28, windowOpening.at + 0.68, 2.0, z0 - 0.04);
  block(m.stone, windowOpening.at - 0.04, 0.95, z0 - 0.17, windowOpening.at + 0.04, 1.9, z0 - 0.06);
  s.leaded("x", z0 - 0.1, windowOpening.at - 0.3, 0.95, 0.56, 0.95);
  s.leaded("x", z0 - 0.1, windowOpening.at + 0.3, 0.95, 0.56, 0.95);
  // Plinth.
  block(m.stoneDark, k.minX - 0.28, 0, z0 - 0.28, k.maxX + 0.28, 0.36, z0 - 0.23);
  // Catslide roof, tiled in rows of its own.
  const over = 0.36,
    lowZ = z0 - 0.24 - over,
    low = heightAt(lowZ),
    lift = 0.12,
    slopeY = (x, z) => heightAt(z) + lift;
  pane(s, m, [
    [k.minX - 0.5, slopeY(0, z1), z1],
    [k.maxX + 0.5, slopeY(0, z1), z1],
    [k.maxX + 0.5, slopeY(0, lowZ), lowZ],
    [k.minX - 0.5, slopeY(0, lowZ), lowZ],
  ]);
  for (let x = k.minX - 0.3; x <= k.maxX + 0.3; x += 0.55)
    timber(m.oak, [x, heightAt(z0) - 0.06, z0 + 0.3], [x, low - 0.04, lowZ + 0.02], 0.07, 0.1);
  timber(m.oak, [k.minX - 0.5, low + 0.02, lowZ], [k.maxX + 0.5, low + 0.02, lowZ], 0.09, 0.13);
  // The bread oven's stack at the east corner, rising past the main eaves.
  const sx = k.maxX - 0.6,
    sz = z0 + 0.4;
  block(m.brick, sx - 0.52, 0, sz - 0.42, sx + 0.52, 3, sz + 0.42);
  block(m.brick, sx - 0.42, 3, sz - 0.34, sx + 0.42, 6.15, sz + 0.34);
  block(m.stone, sx - 0.5, 6.15, sz - 0.42, sx + 0.5, 6.25, sz + 0.42);
  const shafts = [];
  for (const dx of [-0.21, 0.21]) {
    s.mesh(twistedShaft(0.17, 0.9, 6, dx < 0 ? 0.6 : -0.6, ...(m.outsideOnly ? [10, 18] : [20, 30])), m.brick, sx + dx, 6.25, sz);
    s.cyl(m.stone, sx + dx, 7.18, sz, 0.17, 0.08, 0.2, undefined, 12);
    s.cyl(s.mat("#ad6b4c", 0.82), sx + dx, 7.3, sz, 0.13, 0.2, 0.1, undefined, 12);
    shafts.push([sx + dx, 7.42, sz]);
  }
  if (!m.outsideOnly) {
    // Inside: a range, a work table, hanging pots and a shelf of crocks.
    block(m.flags, k.minX, 0, z0, k.maxX, 0.02, z1);
    block(m.oak, k.minX, k.lowY - 0.04, z0, k.maxX, k.lowY, z1 + 0.02);
    block(m.oakWarm, 2.7, 0.8, -5.62, 4.1, 0.87, -4.98);
    for (const [x, z] of [[2.8, -5.55], [4.0, -5.55], [2.8, -5.05], [4.0, -5.05]])
      block(m.oakDark, x - 0.03, 0, z - 0.03, x + 0.03, 0.8, z + 0.03);
    block(m.stoneDark, sx - 0.5, 0, sz + 0.42, sx + 0.5, 0.9, sz + 0.9);
    block(m.iron, sx - 0.42, 0.9, sz + 0.44, sx + 0.42, 0.93, sz + 0.86);
  }
  return {
    shafts,
    tilePane: {
      polygon: [[k.minX - 0.5, z1], [k.maxX + 0.5, z1], [k.maxX + 0.5, lowZ], [k.minX - 0.5, lowZ]],
      y: slopeY,
      downhill: [0, -1],
      moss: 0.22,
    },
  };
}

// The market as the balcony sees it: simple solids where the map's stalls and
// neighbours really stand, drawn into the pub's own full-size coordinates.
function marketBeyond(s, m) {
  const { block, cyl, orb } = s,
    fromMap = (x, z) => [(x - HERON.x) / HERON.scale, (z - HERON.z) / HERON.scale],
    size = (v) => v / HERON.scale;
  const house = ({ x, z, w, d, h }, walls, roof) => {
    const [cx, cz] = fromMap(x, z),
      a = size(w) / 2,
      c = size(d) / 2,
      top = size(h);
    block(s.mat(walls, 0.95), cx - a, 0, cz - c, cx + a, top, cz + c);
    const ridge = new T.Shape([new T.Vector2(-c - 0.2, 0), new T.Vector2(c + 0.2, 0), new T.Vector2(0, size(1.7))]);
    s.sheet(s.mat(roof, 0.9), ridge, [cx - a - 0.2, top, cz], [0, 0, -1], [0, 1, 0], a * 2 + 0.4);
    for (const dx of [-0.45, 0.45])
      block(s.mat("#e9c97d", 0.5), cx + dx * a * 1.3 - 0.45, 0.9, cz + c, cx + dx * a * 1.3 + 0.45, 2.1, cz + c + 0.04);
  };
  house(MARKET.teaRoom, "#e4d9bc", "#7f9f76");
  house(MARKET.postOffice, "#b0694b", "#6d7f86");
  const stripes = { seeds: "#7fa763", lanterns: "#d9734a", hats: "#5f85a8", produce: "#e0b64e" };
  for (const stall of MARKET.stalls) {
    const [cx, cz] = fromMap(stall.x, stall.z),
      w = size(MARKET.stallSize.w) / 2,
      d = size(MARKET.stallSize.d) / 2;
    block(m.oakDark, cx - w, 0, cz - d, cx + w, 1, cz + d);
    const n = 6;
    for (let i = 0; i < n; i++) {
      const x = cx - w + (2 * w * i) / n;
      block(s.mat(i % 2 ? "#ece4cd" : stripes[stall.id], 0.9), x, 2.45, cz - d - 0.2, x + (2 * w) / n, 2.55, cz + d + 0.2);
    }
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
      block(m.oakDark, cx + dx * w - 0.04, 1, cz + dz * d - 0.04, cx + dx * w + 0.04, 2.45, cz + dz * d + 0.04);
  }
  for (const p of MARKET.lamps) {
    const [cx, cz] = fromMap(p.x, p.z);
    cyl(m.oakDark, cx, 1.5, cz, 0.08, 3, 0.07, undefined, 8);
    orb(s.mat("#e9c97d", 0.5), cx, 3.1, cz, 0.16, 0.16, 0.16);
  }
  // The square's gravel and the lane running through it.
  const [sx, sz] = fromMap(MARKET.square.x, MARKET.square.z);
  const square = new T.Mesh(new T.CircleGeometry(1, 40), s.mat("#c7b48c", 1));
  square.rotation.x = -Math.PI / 2;
  square.position.set(sx, 0.004, sz);
  square.scale.set(size(MARKET.square.rx), size(MARKET.square.rz), 1);
  square.receiveShadow = true;
  s.root.add(square);
  const lane = new T.Mesh(new T.PlaneGeometry(150, size(MARKET.laneHalfWidth * 2)), s.mat("#c7b48c", 1));
  lane.rotation.x = -Math.PI / 2;
  lane.position.set(0, 0, sz - 0.2);
  lane.receiveShadow = true;
  s.root.add(lane);
}

/** The study's own setting: lawn, cobbles, gravel, downs, trees, fence and lane. */
function landscape(s, m) {
  const { block, timber, sheet, cyl, orb } = s;
  const ground = new T.Mesh(new T.PlaneGeometry(140, 140), m.grass);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.012;
  ground.receiveShadow = true;
  s.root.add(ground);
  // The cobbled forecourt, with a path out to the street.
  const shape = new T.Shape();
  [[-7.6, 5.0], [7.6, 5.0], [8.4, 11.4], [-0.1, 12.0], [-0.5, 20], [-2.9, 20], [-3.3, 12.0], [-8.4, 11.4]].forEach(
    ([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)),
  );
  shape.closePath();
  const court = sheet(m.cobble, shape, [0, 0, 0], [1, 0, 0], [0, 0, -1], 0.02);
  court.castShadow = false;
  // Stone flags across the porch, and a low kerb where cobbles meet the lawn.
  const porch = block(m.flags, -3, 0, halfD, 3, 0.03, gallery.front + 0.32);
  porch.castShadow = false;
  // Gravel round the rear yard.
  const rear = new T.Mesh(new T.CircleGeometry(8.2, 40), s.mat("#b8a585", 1));
  rear.rotation.x = -Math.PI / 2;
  rear.position.set(1.5, -0.002, -7.2);
  rear.scale.y = 0.54;
  rear.receiveShadow = true;
  s.root.add(rear);
  // Beyond the yard: a low rim of downs and scattered trees to end the view,
  // all of it fading into the fog, none of it casting a shadow.
  const hillMat = s.mat("#8ba166", 1);
  for (const [x, z, sx, sy, sz] of [
    [-62, -46, 46, 8, 28], [14, -74, 66, 11, 30], [76, -28, 34, 9, 44], [-82, 26, 30, 7, 46],
    [70, 48, 40, 6, 30], [-30, 86, 56, 8, 26], [36, 94, 60, 6, 24],
  ]) {
    const hill = orb(hillMat, x, -1.5, z, sx, sy, sz);
    hill.castShadow = false;
  }
  const crowns = ["#6f8f55", "#7d9a5a", "#5f8150", "#8ca35e"].map((c) => s.mat(c, 0.95));
  const lumpShape = new T.IcosahedronGeometry(1, 2);
  let seed = 90127;
  const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 46; i++) {
    const a = next() * Math.PI * 2,
      d = 38 + next() * 50,
      x = Math.cos(a) * d * 1.1,
      z = Math.sin(a) * d;
    if (Math.abs(x) < 12 && z > 8) continue;
    const r = 1.5 + next() * 1.5,
      material = crowns[i % 4];
    const lumps = 6;
    for (let j = 0; j < lumps; j++) {
      const t = (j / lumps) * Math.PI * 2 + next(),
        spread = j ? r * 0.72 : 0,
        lump = s.mesh(lumpShape, material, x + Math.cos(t) * spread, r * (1.9 + next() * 0.7), z + Math.sin(t) * spread);
      lump.scale.set(r * (0.72 + next() * 0.3), r * (0.62 + next() * 0.25), r * (0.72 + next() * 0.3));
      lump.castShadow = false;
    }
    const trunk = cyl(m.oak, x, r * 0.8, z, r * 0.12, r * 1.6, r * 0.08, undefined, 6);
    trunk.castShadow = false;
  }
  // A post-and-rail fence closes the forecourt's sides, a lane runs past its foot.
  for (const side of [-1, 1]) {
    for (let i = 0; i <= 5; i++) {
      const t = i / 5,
        x = side * (8.9 + t * 0.7),
        z = 6.5 + t * 5.3;
      timber(m.bargeOak, [x, 0, z], [x, 1.02, z], 0.1, 0.1);
      if (i < 5) {
        const nx = side * (8.9 + ((i + 1) / 5) * 0.7),
          nz = 6.5 + ((i + 1) / 5) * 5.3;
        for (const y of [0.52, 0.9]) timber(m.bargeOak, [x, y, z], [nx, y, nz], 0.05, 0.08);
      }
    }
  }
  marketBeyond(s, m);
}

/** What stands in the yard wherever the pub is: sign, tables, trough, casks. */
function yardFurniture(s, m, planters, { sway }) {
  const { block, timber, bar, cyl, group, orb, box, torus } = s;
  // Hanging sign on a post in the yard.
  const { x: sx, z: sz } = YARD.signPost;
  block(m.stone, sx - 0.3, 0, sz - 0.3, sx + 0.3, 0.26, sz + 0.3);
  timber(m.oak, [sx, 0.26, sz], [sx, 3.5, sz], 0.2, 0.2);
  timber(m.oak, [sx - 0.05, 3.08, sz], [sx + 1.45, 3.08, sz], 0.12, 0.14);
  timber(m.oak, [sx, 2.5, sz], [sx + 0.6, 3.04, sz], 0.08, 0.1);
  orb(m.bargeOak, sx, 3.56, sz, 0.11, 0.14, 0.11);
  const signArt = paintedMaterial(768, 640, (c, w, h) => {
    paintHeron(c, w, h * 0.82);
    c.fillStyle = "#2f4a42";
    c.fillRect(0, h * 0.8, w, h * 0.2);
    c.fillStyle = "#ead7a8";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = "bold 58px Georgia";
    c.fillText("The Drowsy Heron", w / 2, h * 0.9, w * 0.94);
    c.strokeStyle = "#d8bf85";
    c.lineWidth = 12;
    c.strokeRect(6, 6, w - 12, h - 12);
  });
  // In the study the board swings as its own piece; in the world it hangs still.
  const sign = group(sx + 0.86, 3.0, sz);
  if (sway) s.apart(sign);
  for (const dx of [-0.42, 0.42])
    bar(m.iron, [dx, 0, 0], [dx, -0.2, 0], 0.012, 0.012, sign);
  box(m.oakDark, 0, -0.75, 0, 1.12, 1.02, 0.05, 0.01, sign);
  for (const z of [-0.027, 0.027]) {
    const art = new T.Mesh(new T.PlaneGeometry(1.02, 0.86), signArt);
    art.position.set(0, -0.76, z);
    if (z < 0) art.rotation.y = Math.PI;
    art.castShadow = false;
    sign.add(art);
  }
  // Benches and trestle tables out front.
  for (const b of YARD.benches) {
    const g = group(b.x, 0, b.z, b.rotation);
    box(m.oakWarm, 0, 0.74, 0, 1.8, 0.06, 0.74, 0.012, g);
    for (const dx of [-0.72, 0.72]) {
      s.bar(m.oakDark, [dx, 0, -0.28], [dx, 0.72, 0.28], 0.06, 0.06, g);
      s.bar(m.oakDark, [dx, 0, 0.28], [dx, 0.72, -0.28], 0.06, 0.06, g);
    }
    for (const dz of [-0.62, 0.62]) {
      box(m.oakWarm, 0, 0.44, dz, 1.72, 0.05, 0.25, 0.012, g);
      for (const dx of [-0.66, 0.66]) box(m.oakDark, dx, 0.21, dz, 0.06, 0.42, 0.2, 0.01, g);
    }
    for (const [dx, dz] of [[-0.45, 0.14], [0.35, -0.2]]) {
      cyl(m.pewter, dx, 0.84, dz, 0.042, 0.14, 0.046, g, 12);
      s.torus(m.pewter, dx + 0.05, 0.84, dz, 0.032, 0.007, g).rotation.y = 0;
    }
  }
  // A water trough and hitching rail along the east wall.
  const { x: tx, z: tz } = YARD.trough;
  block(m.stoneDark, tx - 0.34, 0, tz - 0.9, tx + 0.34, 0.56, tz + 0.9);
  const water = block(s.mat("#6f8c8a", 0.12, 0.25), tx - 0.26, 0.56, tz - 0.82, tx + 0.26, 0.565, tz + 0.82);
  water.castShadow = false;
  const { x: rx, z: rz } = YARD.hitchingRail;
  for (const dz of [-1.15, 1.15]) timber(m.oak, [rx, 0, rz + dz], [rx, 1.1, rz + dz], 0.13, 0.13);
  timber(m.oak, [rx, 1.04, rz - 1.25], [rx, 1.04, rz + 1.25], 0.09, 0.09);
  // Lavender along the wings' feet and pots by the door.
  for (const side of [-1, 1]) {
    planters.bed(side * 5, wing.front + 0.34, 3.5, 0.46);
    const fronts = m.outsideOnly ? 4 : 8;
    for (let i = 0; i < fronts; i++)
      planters.recipes.lavender(side * 5 - 1.6 + (3.2 * (i + 0.5)) / fronts, 0.12, wing.front + 0.34, 0.2, planters.blooms.lavender);
    const soil = planters.pot(side * 1.15, 0.02, gallery.front + 0.75, 0.42, "#a9765c");
    planters.recipes.topiary(side * 1.15, soil - 0.02, gallery.front + 0.75, 0.2);
    // Window box under each wing's great window.
    block(m.oak, side * 5 - 1.45, 0.52, wing.front + 0.05, side * 5 + 1.45, 0.7, wing.front + 0.3);
    const n = m.outsideOnly ? 6 : 13;
    for (let i = 0; i < n; i++) {
      const x = side * 5 - 1.35 + (2.7 * (i + 0.5)) / n;
      planters.recipes[i % 3 === 1 ? "daisies" : "geranium"](x, 0.69, wing.front + 0.18, 0.13, i % 3 === 1 ? planters.blooms.butter : planters.blooms.coral);
      planters.trail(x, 0.7, wing.front + 0.29, planters.range(0.14, 0.3), planters.foliage.ivy);
    }
  }
  planters.flush(s.root);
  // Rear yard: stacked casks, cellar flap and the wood store.
  block(m.stone, -1.92, 0, -5.42, -0.2, 0.12, -4);
  for (const [x0, x1] of [[-1.86, -1.08], [-1.02, -0.26]]) {
    const boards = 4;
    for (let i = 0; i < boards; i++) {
      const a = x0 + ((x1 - x0) * (i + 0.5)) / boards;
      timber(m.oakDark, [a, 0.78, -4.03], [a, 0.14, -5.36], (x1 - x0) / boards - 0.012, 0.045);
    }
    timber(m.iron, [x0 + 0.02, 0.62, -4.38], [x1 - 0.02, 0.62, -4.38], 0.05, 0.012);
    timber(m.iron, [x0 + 0.02, 0.27, -5.08], [x1 - 0.02, 0.27, -5.08], 0.05, 0.012);
  }
  // Casks waiting for the dray, and the wood store under its own small pent.
  const lie = new T.Mesh(caskGeometry(0.27, 0.74), m.oakWarm);
  lie.position.set(-3.2, 0.28, -5.2);
  lie.rotation.set(0, 0.3, Math.PI / 2);
  lie.castShadow = lie.receiveShadow = true;
  s.root.add(lie);
  const up = new T.Mesh(caskGeometry(0.27, 0.74), m.oakWarm);
  up.position.set(-2.55, 0.37, -4.55);
  up.castShadow = up.receiveShadow = true;
  s.root.add(up);
  for (const y of [0.2, 0.54]) torus(m.iron, -2.55, y, -4.55, 0.26, 0.008).rotation.x = Math.PI / 2;
  for (let i = 0; i < 24; i++) {
    const row = i % 8,
      layer = Math.floor(i / 8);
    const o = cyl(m.oakWarm, -6.4 + row * 0.24 + (layer % 2) * 0.12, 0.13 + layer * 0.21, -4.72, 0.11, 0.9, 0.11, undefined, 8);
    o.rotation.x = Math.PI / 2;
  }
  block(m.oakDark, -6.6, 0.82, -5.28, -4.4, 0.87, -4.04);
  for (const x of [-6.55, -4.45]) timber(m.oak, [x, 0, -5.2], [x, 0.84, -5.2], 0.08, 0.08);
  return { sign };
}

/** Lamps and lanterns outdoors; each `lanterns` entry takes a light. */
function lanterns(s, m) {
  const { box, cyl, bar, mat } = s;
  const lamp = (x, y, z, hang = 0.3) => {
    bar(m.iron, [x, y + hang, z], [x, y + 0.2, z], 0.018, 0.018);
    cyl(m.iron, x, y + 0.2, z, 0.1, 0.05, 0.05, undefined, 6);
    for (const [dx, dz] of [[-0.07, -0.07], [0.07, -0.07], [-0.07, 0.07], [0.07, 0.07]])
      box(m.iron, x + dx, y + 0.05, z + dz, 0.012, 0.3, 0.012, 0.003);
    cyl(m.iron, x, y - 0.11, z, 0.08, 0.025, 0.09, undefined, 6);
    cyl(mat("#fff2c8", 0.3), x, y + 0.03, z, 0.035, 0.18, 0.025, undefined, 8);
    const shade = new T.Mesh(new T.BoxGeometry(0.15, 0.27, 0.15), m.glass);
    shade.position.set(x, y + 0.05, z);
    s.root.add(shade);
  };
  lamp(0, 2.65, gallery.front - 0.45, 0.35);
  lamp(-2.85, 2.2, gallery.front + 0.2, 0.32);
  lamp(2.85, 2.2, gallery.front + 0.2, 0.32);
  // Brackets for the two post lanterns.
  for (const x of [-2.85, 2.85]) bar(m.iron, [x, 2.55, gallery.front - 0.1], [x, 2.55, gallery.front + 0.22], 0.025, 0.025);
}

/**
 * The shell as an ordered list of sections, each a small piece of work: `part`
 * is the storey it belongs to and `build(s)` adds its parts through a storey's
 * kit. The study and the room run them all at once; the world streams them.
 * Returns the sections and the tile panes they gather, by part.
 */
export function exteriorSections(m, planters, { sway = true } = {}) {
  const tilePanes = { ground: [], roof: [] },
    out = { smoke: [], sign: null },
    sections = [];
  const add = (part, build) => sections.push({ part, build });
  for (const wall of GROUND_WALLS) add("ground", (s) => brickWall(s, m, wall));
  add("ground", (s) => quoins(s, m));
  for (const wall of UPPER_WALLS) add("upper", (s) => frameWall(s, m, wall));
  add("upper", (s) => jetties(s, m));
  for (const side of [-1, 1]) {
    add("roof", (s) => streetGable(s, m, side));
    add("roof", (s) => endGable(s, m, side));
  }
  add("roof", (s) => tilePanes.roof.push(...roofs(s, m)));
  add("ground", (s) => out.smoke.push(...chimneys(s, m).stacks));
  add("ground", (s) => {
    const kitchen = kitchenWing(s, m);
    out.smoke.push(...kitchen.shafts);
    tilePanes.ground.push(kitchen.tilePane);
  });
  return {
    sections,
    tilePanes,
    out,
    /** The gallery spans two storeys, so it takes both of their kits. */
    gallery: (ground, upper) => galleryFront(ground, upper, m, planters),
    yard: (s) => {
      out.sign = yardFurniture(s, m, planters, { sway }).sign;
    },
    lanterns: (s) => lanterns(s, m),
    landscape: (s) => landscape(s, m),
  };
}

/** Builds the whole shell and its setting at once; returns what moves. */
export function buildExterior(storeys, m) {
  const planters = createPlanters(8821),
    shell = exteriorSections(m, planters);
  for (const { part, build } of shell.sections) build(storeys[part]);
  shell.gallery(storeys.ground, storeys.upper);
  shell.yard(storeys.ground);
  shell.lanterns(storeys.ground);
  shell.landscape(storeys.ground);
  for (const [part, panes] of Object.entries(shell.tilePanes)) {
    const s = storeys[part];
    s.keep.add(tiles(s.root, panes, s.random));
  }
  return shell.out;
}

export { tiles };
