// Lines across the ground: smooth curves through a few points, and the
// distance from a point to one. Paths, lanes and trails are made of them.

/** Points along a Catmull-Rom curve through `points`, a few centimetres apart. */
export function curve(points, samples = 10) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)],
      p1 = points[i],
      p2 = points[i + 1],
      p3 = points[Math.min(i + 2, points.length - 1)];
    for (let s = 0; s < samples; s++) {
      const t = s / samples,
        t2 = t * t,
        t3 = t2 * t,
        at = (k) =>
          0.5 *
          (2 * p1[k] +
            (-p0[k] + p2[k]) * t +
            (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
            (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      out.push([at(0), at(1)]);
    }
  }
  out.push(points.at(-1));
  return out;
}

/** Distance from (x, z) to a polyline, in metres: Infinity beyond `reach` of its bounds. */
export function lineDistance(line, x, z, reach = Infinity) {
  const b = (line.bounds ??= {
    minX: Math.min(...line.map((p) => p[0])),
    maxX: Math.max(...line.map((p) => p[0])),
    minZ: Math.min(...line.map((p) => p[1])),
    maxZ: Math.max(...line.map((p) => p[1])),
  });
  if (x < b.minX - reach || x > b.maxX + reach || z < b.minZ - reach || z > b.maxZ + reach)
    return Infinity;
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i],
      [bx, bz] = line[i + 1],
      ex = bx - ax,
      ez = bz - az,
      t = Math.min(1, Math.max(0, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez))),
      d = (x - ax - ex * t) ** 2 + (z - az - ez * t) ** 2;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}
