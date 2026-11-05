// @ts-check
// Which parts of the screen water's refraction has to resolve. Pure, so the
// logic tests can run it.

// Below this a corner counts as behind the eye.
const NEAR_W = 0.001,
  // A corner's index has a bit set per axis, so an edge flips one of these.
  AXES = [1, 2, 4];

/**
 * @typedef {{ minX: number, minY: number, maxX: number, maxY: number }} Bounds
 * @typedef {{ x0: number, y0: number, x1: number, y1: number }} Rect
 */

/**
 * @param {Bounds} out
 * @param {number} x
 * @param {number} y
 * @param {number} w
 */
function addPoint(out, x, y, w) {
  const u = x / w,
    v = y / w;
  if (u < out.minX) out.minX = u;
  if (u > out.maxX) out.maxX = u;
  if (v < out.minY) out.minY = v;
  if (v > out.maxY) out.maxY = v;
}

/**
 * The bounds in normalized device coordinates of a box, from its eight corners
 * in clip space. Edges that pass behind the eye are cut where they cross it, so
 * a long box beside the camera still gets finite bounds, which may reach far
 * outside the screen.
 * @param {ArrayLike<number>} corners x, y, w per corner, ordered so that an
 *   index's three bits say which end of each axis the corner is at.
 * @param {Bounds} out
 * @returns {boolean} false when the whole box is behind the eye.
 */
export function clipBoxBounds(corners, out) {
  out.minX = out.minY = Infinity;
  out.maxX = out.maxY = -Infinity;
  let inFront = false;
  for (let i = 0; i < 8; i++) {
    const x = corners[i * 3],
      y = corners[i * 3 + 1],
      w = corners[i * 3 + 2];
    if (w > NEAR_W) {
      inFront = true;
      addPoint(out, x, y, w);
    }
    for (const bit of AXES) {
      if (i & bit) continue;
      const j = i | bit,
        wj = corners[j * 3 + 2];
      if (w > NEAR_W === wj > NEAR_W) continue;
      const t = (NEAR_W - w) / (wj - w);
      addPoint(out, x + t * (corners[j * 3] - x), y + t * (corners[j * 3 + 1] - y), NEAR_W);
    }
  }
  return inFront;
}

/**
 * Whole pixels covering bounds grown by `reach`, clipped to the screen.
 * @param {Bounds} bounds in normalized device coordinates
 * @param {number} reach in normalized device coordinates
 * @param {number} width
 * @param {number} height
 * @param {Rect} out
 * @returns {boolean} false when none of it is on screen.
 */
export function boundsToPixels(bounds, reach, width, height, out) {
  out.x0 = Math.floor(Math.max(0, ((bounds.minX - reach + 1) / 2) * width));
  out.y0 = Math.floor(Math.max(0, ((bounds.minY - reach + 1) / 2) * height));
  out.x1 = Math.ceil(Math.min(width, ((bounds.maxX + reach + 1) / 2) * width));
  out.y1 = Math.ceil(Math.min(height, ((bounds.maxY + reach + 1) / 2) * height));
  return out.x1 > out.x0 && out.y1 > out.y0;
}

/** @param {Rect} r */
const area = (r) => (r.x1 - r.x0) * (r.y1 - r.y0);

/**
 * Joins rectangles, in place, wherever one covering both is no larger than the
 * two apart. The ones kept move to the front, and none of `rects` is lost.
 * @param {Rect[]} rects
 * @param {number} count how many of `rects` are in use
 * @returns {number} how many are in use now
 */
export function mergeRects(rects, count) {
  for (let i = 0; i < count; i++)
    for (let j = i + 1; j < count; j++) {
      const a = rects[i],
        b = rects[j],
        x0 = Math.min(a.x0, b.x0),
        y0 = Math.min(a.y0, b.y0),
        x1 = Math.max(a.x1, b.x1),
        y1 = Math.max(a.y1, b.y1);
      if ((x1 - x0) * (y1 - y0) > area(a) + area(b)) continue;
      a.x0 = x0;
      a.y0 = y0;
      a.x1 = x1;
      a.y1 = y1;
      rects[j] = rects[--count];
      rects[count] = b;
      // The larger rectangle may now reach ones already passed.
      i = -1;
      break;
    }
  return count;
}
