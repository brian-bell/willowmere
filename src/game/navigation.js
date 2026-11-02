// Walking rules: the player's collision test, and a route grid searched with
// A* for point-and-click movement. No three.js, so tests run it in Node.

/**
 * Whether a circle of radius `r` at (x, z) overlaps any collider: circles
 * ({ x, z, r }), boxes ({ x, z, w, d }), or shaped colliders that test
 * themselves within their bounds ({ minX, maxX, minZ, maxZ, blocks }), such
 * as the millpond.
 */
export function collides(colliders, x, z, r = 0.27) {
  for (const c of colliders) {
    if (c.r !== undefined) {
      if (Math.hypot(x - c.x, z - c.z) < r + c.r) return true;
    } else if (c.w !== undefined) {
      const dx = Math.max(Math.abs(x - c.x) - c.w / 2, 0),
        dz = Math.max(Math.abs(z - c.z) - c.d / 2, 0);
      if (dx * dx + dz * dz < r * r) return true;
    } else if (
      c.blocks &&
      x > c.minX - r &&
      x < c.maxX + r &&
      z > c.minZ - r &&
      z < c.maxZ + r &&
      c.blocks(x, z, r)
    )
      return true;
  }
  return false;
}

const MOVES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * `walk` is the box the player stays inside; `colliders` is the world's list,
 * read live. Colliders never move, so each route cell's walkability is
 * sampled once: in streamed rows (`sampleRows`), or all at once by the first
 * `findPath`.
 */
export function createNavigation({ walk, colliders, step = 0.65 }) {
  function blocked(x, z, r = 0.27) {
    if (x < walk.minX + r || x > walk.maxX - r || z < walk.minZ + r || z > walk.maxZ - r)
      return true;
    return collides(colliders, x, z, r);
  }
  const route = {
    step,
    minX: walk.minX,
    minZ: walk.minZ,
    cols: Math.floor((walk.maxX - walk.minX) / step + 1e-6) + 1,
    rows: Math.floor((walk.maxZ - walk.minZ) / step + 1e-6) + 1,
    radius: 0.34,
  };
  const walkable = new Uint8Array(route.cols * route.rows);
  let sampledRows = 0;
  /** Samples rows until the deadline (a performance.now() time), or all of them; true once the grid is done. */
  function sampleRows(deadline = Infinity) {
    const { step, minX, minZ, cols, rows, radius } = route;
    while (sampledRows < rows) {
      const z = sampledRows++;
      for (let x = 0; x < cols; x++)
        if (!blocked(minX + x * step, minZ + z * step, radius)) walkable[z * cols + x] = 1;
      if (performance.now() > deadline) break;
    }
    return sampledRows === rows;
  }
  /** A route of ground points from `start` ending exactly at `end`, or [] when there is none. */
  function findPath(start, end) {
    if (blocked(end.x, end.z, 0.3)) return [];
    sampleRows();
    const { step, minX, minZ, cols, rows } = route,
      toCell = (v, min, count) => clamp(Math.round((v - min) / step), 0, count - 1),
      toWorld = (i) => ({
        x: minX + (i % cols) * step,
        z: minZ + Math.floor(i / cols) * step,
      }),
      sx = toCell(start.x, minX, cols),
      sz = toCell(start.z, minZ, rows),
      ex = toCell(end.x, minX, cols),
      ez = toCell(end.z, minZ, rows),
      startCell = sz * cols + sx,
      cost = new Float32Array(cols * rows).fill(Infinity),
      came = new Int32Array(cols * rows).fill(-1),
      closed = new Uint8Array(cols * rows),
      // Binary min-heap of cells keyed by estimated total cost; stale entries are skipped.
      heapCell = [],
      heapF = [];
    const push = (cell, f) => {
      let i = heapCell.length;
      heapCell.push(cell);
      heapF.push(f);
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (heapF[parent] <= f) break;
        heapCell[i] = heapCell[parent];
        heapF[i] = heapF[parent];
        i = parent;
      }
      heapCell[i] = cell;
      heapF[i] = f;
    };
    const pop = () => {
      const top = heapCell[0],
        lastCell = heapCell.pop(),
        lastF = heapF.pop(),
        n = heapCell.length;
      if (n) {
        let i = 0;
        for (;;) {
          let child = 2 * i + 1;
          if (child >= n) break;
          if (child + 1 < n && heapF[child + 1] < heapF[child]) child++;
          if (heapF[child] >= lastF) break;
          heapCell[i] = heapCell[child];
          heapF[i] = heapF[child];
          i = child;
        }
        heapCell[i] = lastCell;
        heapF[i] = lastF;
      }
      return top;
    };
    cost[startCell] = 0;
    push(startCell, 0);
    let found = -1;
    while (heapCell.length) {
      const cell = pop();
      if (closed[cell]) continue;
      const cx = cell % cols,
        cz = (cell - cx) / cols;
      if (Math.abs(cx - ex) + Math.abs(cz - ez) <= 1) {
        found = cell;
        break;
      }
      closed[cell] = 1;
      for (const [dx, dz] of MOVES) {
        const nx = cx + dx,
          nz = cz + dz,
          next = nz * cols + nx;
        if (nx < 0 || nx >= cols || nz < 0 || nz >= rows || closed[next]) continue;
        if (!walkable[next]) continue;
        if (dx && dz && !(walkable[cz * cols + nx] && walkable[nz * cols + cx])) continue;
        const g = cost[cell] + Math.hypot(dx, dz);
        if (g < cost[next]) {
          cost[next] = g;
          came[next] = cell;
          push(next, g + Math.hypot(nx - ex, nz - ez));
        }
      }
    }
    if (found < 0) return [];
    const result = [end];
    for (let cell = found; cell !== startCell && cell >= 0; cell = came[cell])
      result.push(toWorld(cell));
    return result.reverse();
  }
  return { blocked, findPath, sampleRows, route };
}
