// @ts-check
// The study's measured plans, drawn from the same lists the model is built
// from, as an SVG string. No three.js and no DOM, so a test can read them.
import { GREAT_ROOM, GROUND_WALLS, LOFT, PUB, UPPER_WALLS, floorAreas, sleeps } from "./layout.js";

const SCALE = 22;
const pad = 1.2;
const minX = -PUB.halfW - 1.5;
const maxX = PUB.halfW + 0.6;
const minZ = PUB.kitchen.minZ - 0.5;
const maxZ = PUB.wing.roofFront + 0.4;
const width = (maxX - minX + pad * 2) * SCALE;
const height = (maxZ - minZ + pad * 2) * SCALE;

/** @param {number} x */
const sx = (x) => ((x - minX + pad) * SCALE).toFixed(1);
/** @param {number} z */
const sz = (z) => ((z - minZ + pad) * SCALE).toFixed(1);

/** @param {number} x0 @param {number} z0 @param {number} x1 @param {number} z1 @param {string} cls */
function rect(x0, z0, x1, z1, cls) {
  const x = Math.min(x0, x1),
    z = Math.min(z0, z1);
  return `<rect class="${cls}" x="${sx(x)}" y="${sz(z)}" width="${(Math.abs(x1 - x0) * SCALE).toFixed(1)}" height="${(Math.abs(z1 - z0) * SCALE).toFixed(1)}"/>`;
}

/** @param {number} x @param {number} z @param {string} text @param {string} [cls] */
function label(x, z, text, cls = "") {
  return `<text class="${cls}" x="${sx(x)}" y="${sz(z)}">${text}</text>`;
}

/** @param {import("./layout.js").Wall[]} walls */
function wallsSvg(walls) {
  return walls
    .map((w) => {
      const runs = [],
        ordered = [...(w.openings || [])].sort((p, q) => p.at - q.at);
      let start = w.from;
      for (const o of ordered) {
        runs.push([start, o.at - o.w / 2]);
        start = o.at + o.w / 2;
      }
      runs.push([start, w.to]);
      const solid = runs
        .map(([p, q]) =>
          w.axis === "x" ? rect(p, w.a, q, w.b, "wall") : rect(w.a, p, w.b, q, "wall"),
        )
        .join("");
      const lights = ordered
        .filter((o) => !o.door && !o.flue)
        .map((o) =>
          w.axis === "x"
            ? rect(o.at - o.w / 2, w.a, o.at + o.w / 2, w.b, "light")
            : rect(w.a, o.at - o.w / 2, w.b, o.at + o.w / 2, "light"),
        )
        .join("");
      return solid + lights;
    })
    .join("");
}

function stairSvg() {
  const b = PUB.stair,
    run = (b.bottomZ - b.topZ) / b.risers;
  let out = rect(b.minX, b.topZ, b.maxX, b.bottomZ, "furn");
  for (let i = 1; i < b.risers; i++) {
    const z = b.bottomZ - i * run;
    out += `<line class="tread" x1="${sx(b.minX)}" x2="${sx(b.maxX)}" y1="${sz(z)}" y2="${sz(z)}"/>`;
  }
  return out;
}

function groundPlan() {
  const g = GREAT_ROOM,
    h = PUB.hearth,
    b = g.bar,
    k = PUB.kitchen;
  let out = rect(k.minX - 0.24, k.minZ - 0.24, k.maxX + 0.24, -PUB.halfD, "wall");
  out += rect(k.minX, k.minZ, k.maxX, -PUB.halfD, "floor");
  out += rect(-PUB.halfW + 0.35, -PUB.halfD + 0.35, PUB.halfW - 0.35, PUB.halfD - 0.35, "floor");
  out += rect(-PUB.halfW + 0.35, PUB.halfD - 0.35, -PUB.wing.inner - 0.35, PUB.wing.front - 0.35, "floor");
  out += rect(PUB.wing.inner + 0.35, PUB.halfD - 0.35, PUB.halfW - 0.35, PUB.wing.front - 0.35, "floor");
  out += wallsSvg(GROUND_WALLS);
  // The hearth and the stack behind it.
  out += rect(h.backX - 0.32, -1.95, -PUB.halfW, 1.95, "wall");
  out += rect(h.breastX, -h.halfZ, -PUB.halfW + 0.35, h.halfZ, "wall");
  out += rect(h.backX, -h.openHalfZ, h.breastX, h.openHalfZ, "fire");
  out += rect(h.breastX, -h.openHalfZ - 0.15, h.stoneX, h.openHalfZ + 0.15, "furn soft");
  // The bar.
  out += rect(b.minX, b.minZ, b.maxX, b.maxZ, "furn");
  out += rect(b.returnMinX, b.returnMinZ, b.minX, b.maxZ, "furn");
  for (const [from, to] of g.backBar.runs) out += rect(from, g.backBar.minZ, to, g.backBar.maxZ, "furn soft");
  out += `<circle class="furn" cx="${sx(g.casks.x - 0.66)}" cy="${sz(g.casks.z)}" r="${0.31 * SCALE}"/><circle class="furn" cx="${sx(g.casks.x)}" cy="${sz(g.casks.z)}" r="${0.31 * SCALE}"/><circle class="furn" cx="${sx(g.casks.x + 0.66)}" cy="${sz(g.casks.z)}" r="${0.31 * SCALE}"/>`;
  for (const s of g.stools)
    out += `<circle class="furn soft" cx="${sx(s.x)}" cy="${sz(s.z)}" r="${0.15 * SCALE}"/>`;
  // Tables and their seats.
  const t = g.longTable;
  out += rect(t.x - t.length / 2, t.z - t.width / 2, t.x + t.length / 2, t.z + t.width / 2, "furn");
  for (const side of [-1, 1])
    out += rect(t.x - t.length / 2 + 0.08, t.z + side * 0.69, t.x + t.length / 2 - 0.08, t.z + side * 0.99, "furn soft");
  for (const r of g.roundTables) out += `<circle class="furn" cx="${sx(r.x)}" cy="${sz(r.z)}" r="${r.r * SCALE}"/>`;
  const q = g.squareTable;
  out += rect(q.x - q.size / 2, q.z - q.size / 2, q.x + q.size / 2, q.z + q.size / 2, "furn");
  for (const o of g.booths) {
    out += rect(o.x - o.length / 2, o.z - 0.38, o.x + o.length / 2, o.z + 0.36, "furn");
    out += rect(o.x - o.length / 2, o.z + 0.44, o.x + o.length / 2, o.z + 0.9, "furn soft");
    out += rect(o.x - o.length / 2, o.z - 0.8, o.x + o.length / 2, o.z - 0.5, "furn soft");
  }
  for (const s of g.settles) out += rect(s.x - s.length / 2, s.z - 0.27, s.x + s.length / 2, s.z + 0.27, "furn soft");
  out += rect(g.dresser.x - g.dresser.w / 2, g.dresser.z - g.dresser.d / 2, g.dresser.x + g.dresser.w / 2, g.dresser.z + g.dresser.d / 2, "furn");
  for (const [x, z] of g.posts) out += `<circle class="post" cx="${sx(x)}" cy="${sz(z)}" r="${0.15 * SCALE}"/>`;
  out += stairSvg();
  // The well above, dashed.
  const w = PUB.well;
  out += rect(w.minX, w.minZ, w.maxX, w.maxZ, "above");
  out += label(-1.4, 0.05, "long table");
  out += label(-5.5, 0.05, "hearth", "light-text");
  out += label(1.9, -1.8, "the bar");
  out += label(3.9, -5.05, "kitchen");
  out += label(0, 3.55, "door");
  out += label(-5, 4.1, "booth");
  out += label(4.9, 4.1, "booth");
  out += label(6.1, 0.6, "up", "small");
  out += label(-5.1, -3.0, "snug", "small");
  return out;
}

function loftPlan() {
  const w = PUB.well,
    l = LOFT;
  let out = rect(-PUB.halfW + 0.2, -PUB.halfD + 0.2, PUB.halfW - 0.2, PUB.halfD - 0.2, "floor");
  out += rect(-PUB.halfW + 0.2, PUB.halfD - 0.2, -PUB.wing.inner - 0.2, PUB.wing.jetty - 0.2, "floor");
  out += rect(PUB.wing.inner + 0.2, PUB.halfD - 0.2, PUB.halfW - 0.2, PUB.wing.jetty - 0.2, "floor");
  out += rect(-PUB.gallery.halfW, PUB.halfD, PUB.gallery.halfW, PUB.gallery.front, "floor gallery");
  out += wallsSvg(UPPER_WALLS);
  out += rect(w.minX, w.minZ, w.maxX, w.maxZ, "void");
  out += stairSvg();
  for (const c of l.cots)
    out += rect(c.x - l.cot.length / 2, c.z - l.cot.width / 2, c.x + l.cot.length / 2, c.z + l.cot.width / 2, c.sleeper ? "furn sleeper" : "furn");
  for (const b of l.beds)
    out += rect(b.x - l.bed.length / 2, b.z - l.bed.width / 2, b.x + l.bed.length / 2, b.z + l.bed.width / 2, "furn bed");
  for (const c of l.chests) out += rect(c.x - 0.42, c.z - 0.24, c.x + 0.42, c.z + 0.24, "furn soft");
  out += rect(l.washstand.x - 0.45, l.washstand.z - 0.24, l.washstand.x + 0.45, l.washstand.z + 0.24, "furn soft");
  out += rect(l.dryingRack.x - 0.2, l.dryingRack.z - 0.72, l.dryingRack.x + 0.2, l.dryingRack.z + 0.72, "furn soft");
  out += `<circle class="furn" cx="${sx(l.galleryTable.x)}" cy="${sz(l.galleryTable.z)}" r="${0.36 * SCALE}"/>`;
  out += label(-1.3, 0.05, "the well");
  out += label(0, 4.82, "gallery");
  out += label(-5, 5.05, "four-poster", "small");
  out += label(5, 5.05, "four-poster", "small");
  out += label(6.1, 0.6, "down", "small");
  return out;
}

/**
 * One storey's plan as an SVG document.
 * @param {"ground" | "loft"} level
 */
export function planSvg(level) {
  const body = level === "ground" ? groundPlan() : loftPlan();
  return `<svg viewBox="0 0 ${width.toFixed(0)} ${height.toFixed(0)}" role="img" aria-label="${level === "ground" ? "Ground floor plan" : "Loft plan"}">
    ${body}
    <g class="scale"><rect x="${SCALE}" y="${(height - 15).toFixed(0)}" width="${SCALE * 5}" height="3"/><text x="${SCALE * 3.5}" y="${(height - 19).toFixed(0)}">5 m</text></g>
    <circle class="you" data-you r="5" cx="-20" cy="-20"/>
  </svg>`;
}

/**
 * Where the walker's dot goes on the plan.
 * @param {number} x
 * @param {number} z
 */
export function planPoint(x, z) {
  return { cx: sx(x), cy: sz(z) };
}

/** The study's measured summary, drawn from the layout. */
export function planFacts() {
  const areas = floorAreas();
  return [
    ["Great room", `${areas.ground} m²`],
    ["Loft", `${areas.loft} m²`],
    ["Gallery", `${areas.gallery} m²`],
    ["Sleeps", String(sleeps())],
    ["To the ridge", `${PUB.ridge} m`],
    ["Hearth opening", `${(PUB.hearth.openHalfZ * 2).toFixed(1)} m`],
  ];
}
