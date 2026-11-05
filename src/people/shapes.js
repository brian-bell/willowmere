// The shapes every person is cut from. Each is built once and shared; a figure's
// parts are merged per joint afterwards (batchParts in src/life.js), so what a
// shape costs is its triangles, not a draw. Small parts take the fewest segments
// their size on screen earns: a button is 36 triangles, not 192.
//
// A shape may carry a `tone` attribute, a per-vertex multiplier on its part's
// colour. Merging bakes it into the vertex colours, so pleats, combed hair and
// plaited straw are painted for no extra draw and no texture.

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const bump = (x, y, cx, cy, rx, ry) =>
  Math.exp(-(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2));

// How wide a body of revolution is at a height; profiles run upward as [r, y].
export function radiusAt(profile, y) {
  if (y <= profile[0][1]) return profile[0][0];
  for (let i = 1; i < profile.length; i++)
    if (y <= profile[i][1]) {
      const [r0, y0] = profile[i - 1],
        [r1, y1] = profile[i];
      return lerp(r0, r1, (y - y0) / (y1 - y0));
    }
  return profile[profile.length - 1][0];
}

// A long coat from hem to neck, and a fitted bodice that a skirt hangs from.
// Bodies are squashed front to back by BODY_DEPTH so they are not barrels.
export const BODY_DEPTH = 0.8;
export const COAT = [
  [0.25, 0.6],
  [0.243, 0.635],
  [0.218, 0.74],
  [0.194, 0.85],
  [0.197, 0.94],
  [0.207, 1.02],
  [0.197, 1.09],
  [0.152, 1.145],
  [0.092, 1.18],
];
export const BODICE = [
  [0.172, 0.82],
  [0.168, 0.88],
  [0.178, 0.95],
  [0.194, 1.03],
  [0.188, 1.09],
  [0.148, 1.145],
  [0.092, 1.18],
];
const bell = (hemY, hemR, topY, topR) => {
  const rows = [];
  for (let i = 0; i <= 5; i++) {
    const t = i / 5;
    rows.push([lerp(hemR, topR, 1 - (1 - t) ** 1.6), lerp(hemY, topY, t)]);
  }
  return rows;
};
export const SKIRT_LONG = bell(0.12, 0.3, 0.88, 0.172);
export const SKIRT_SHORT = bell(0.5, 0.31, 0.86, 0.172);
export const HAT_CROWN = [
  [0.178, 0],
  [0.172, 0.05],
  [0.163, 0.12],
  [0.152, 0.165],
  [0.11, 0.186],
  [0.04, 0.184],
];

// Clothes laid all the way round a body share its segments, so their facets
// line up and a thin layer never dips under the surface it lies on.
const BODY_SEGMENTS = 14;

export function createShapes(THREE) {
  const cache = new Map();
  const once = (key, build) => {
    if (!cache.has(key)) cache.set(key, build());
    return cache.get(key);
  };
  // phi 0 faces the figure's front (+z).
  const lathe = (points, segments = 14, center = 0, half = Math.PI) =>
    new THREE.LatheGeometry(
      points.map(([r, y]) => new THREE.Vector2(r, y)),
      segments,
      center - half,
      half * 2,
    );
  // Moves vertices, then re-smooths across the seams a sphere or lathe has.
  const sculpt = (geometry, move) => {
    const position = geometry.attributes.position,
      v = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i);
      move(v);
      position.setXYZ(i, v.x, v.y, v.z);
    }
    geometry.computeVertexNormals();
    const normal = geometry.attributes.normal,
      same = new Map();
    for (let i = 0; i < position.count; i++) {
      const key = [position.getX(i), position.getY(i), position.getZ(i)]
        .map((c) => Math.round(c * 2e3))
        .join();
      if (!same.has(key)) same.set(key, []);
      same.get(key).push(i);
    }
    for (const indices of same.values()) {
      if (indices.length < 2) continue;
      v.set(0, 0, 0);
      for (const i of indices) {
        v.x += normal.getX(i);
        v.y += normal.getY(i);
        v.z += normal.getZ(i);
      }
      v.normalize();
      for (const i of indices) normal.setXYZ(i, v.x, v.y, v.z);
    }
    return geometry;
  };
  const paint = (geometry, tone) => {
    const position = geometry.attributes.position,
      values = new Float32Array(position.count);
    for (let i = 0; i < position.count; i++)
      values[i] = tone(position.getX(i), position.getY(i), position.getZ(i));
    geometry.setAttribute("tone", new THREE.BufferAttribute(values, 1));
    return geometry;
  };

  const shapes = {
    ball: new THREE.SphereGeometry(1, 12, 8),
    soft: new THREE.SphereGeometry(1, 8, 6),
    bead: new THREE.SphereGeometry(1, 6, 4),
    tube: new THREE.CylinderGeometry(1, 1, 1, 12),
    peg: new THREE.CylinderGeometry(1, 1, 1, 6),
    slab: new THREE.BoxGeometry(1, 1, 1),
    // A triangular plate, for collar points and pennant ends: its axis is y.
    prism: new THREE.CylinderGeometry(1, 1, 1, 3),
    ring: new THREE.TorusGeometry(1, 0.13, 4, 12),
    hoop: new THREE.TorusGeometry(1, 0.1, 4, 10, Math.PI),
    smile: new THREE.TorusGeometry(0.026, 0.005, 4, 8, Math.PI),
    // A sleeve or trouser leg: rounded at both ends and narrowing downward,
    // from y 0 to y -1.
    limb: lathe(
      [
        [0, -1.02],
        [0.72, -1],
        [0.82, -0.9],
        [0.9, -0.5],
        [1, -0.1],
        [0.97, 0.02],
        [0.76, 0.1],
        [0.4, 0.15],
        [0, 0.16],
      ],
      10,
    ),
    // The upper arm from a round shoulder, in its own proportions.
    shoulder: lathe(
      [
        [0, -0.17],
        [0.062, -0.17],
        [0.066, -0.155],
        [0.074, -0.09],
        [0.083, -0.03],
        [0.084, 0.0],
        [0.076, 0.042],
        [0.05, 0.072],
        [0, 0.082],
      ],
      10,
    ),
    // A cone of paper: wide end up.
    flare: new THREE.CylinderGeometry(1, 0.42, 1, 10),
    // A lock of hair: fat at the root, tapering to a tip at y -1 and curling
    // forward, combed by its tone.
    lock: paint(
      sculpt(new THREE.SphereGeometry(1, 8, 6), (v) => {
        const taper = 0.42 + 0.58 * smooth(-1, 0.3, v.y);
        v.x *= taper;
        v.z = v.z * taper + 0.14 * Math.min(0, v.y) ** 2;
      }),
      (x, y) => 0.92 + 0.14 * smooth(-1, 0.7, y) + 0.06 * Math.cos(x * 16),
    ),
    // The head: narrower at the jaw, with full cheeks, a brow and a soft chin.
    head: sculpt(new THREE.SphereGeometry(1, 18, 12), (v) => {
      const front = smooth(-0.2, 0.8, v.z),
        low = smooth(-0.1, -0.95, v.y),
        side = Math.abs(v.x);
      const jaw = 1 - 0.2 * low * (1 - 0.4 * front);
      v.x *= jaw;
      v.z *= 1 - 0.1 * low;
      const cheek = bump(side, v.y, 0.62, -0.22, 0.3, 0.3) * front;
      v.x += Math.sign(v.x) * 0.05 * cheek;
      v.z += 0.05 * cheek;
      v.z -= 0.035 * bump(side, v.y, 0.36, 0.04, 0.2, 0.14) * front;
      v.z += 0.025 * bump(side, v.y, 0.34, 0.27, 0.4, 0.1) * front;
      v.z += 0.04 * bump(v.x, v.y, 0, -0.82, 0.25, 0.18) * front;
    }),
    // A cap of hair with a little lump to it, its streaks combed from the crown.
    hairCap: paint(
      sculpt(new THREE.SphereGeometry(1, 16, 9), (v) => {
        const phi = Math.atan2(v.x, v.z),
          k = 1 + 0.028 * Math.sin(phi * 5 + 0.6) * Math.sin(v.y * 4 + 0.8);
        v.multiplyScalar(k);
      }),
      (x, y, z) => {
        const phi = Math.atan2(x, z);
        return 0.93 + 0.1 * Math.sin(phi * 9 + y * 2) + 0.06 * y;
      },
    ),
    // The jaw's shell for a beard. Its edge climbs to the ears and dips under
    // the mouth, so a beard follows the jawline instead of cutting across it.
    jaw: paint(
      sculpt(
        new THREE.SphereGeometry(1, 14, 5, 0, TAU, Math.PI * 0.6, Math.PI * 0.4),
        (v) => {
          const low = smooth(-0.1, -0.95, v.y),
            front = smooth(0.1, 0.85, v.z),
            edge = smooth(-0.85, -0.31, v.y);
          v.x *= 1 - 0.14 * low * (1 - 0.4 * front);
          v.z *= 1 - 0.04 * low;
          v.y += edge * (0.26 * (1 - front) - 0.17 * front) - 0.12 * low;
        },
      ),
      (x, y, z) => 0.94 + 0.1 * Math.sin(Math.atan2(x, z) * 8),
    ),
    // A plait: lobes that swap sides down its length, narrowing to the tie.
    plait: paint(
      sculpt(new THREE.CylinderGeometry(1, 1, 1, 8, 15), (v) => {
        const t = 0.5 - v.y,
          lobe = Math.sin(5 * Math.PI * t),
          r = (1 - 0.34 * t) * (0.8 + 0.2 * Math.abs(lobe));
        v.x = v.x * r + 0.2 * lobe * (1 - 0.3 * t);
        v.z *= r;
      }),
      (x, y) => 0.8 + 0.24 * Math.abs(Math.sin(5 * Math.PI * (0.5 - y))),
    ),
    // A woven straw or felt brim, its edge rolled and a little floppy. Tone
    // rings read as plaited straw, and felt simply takes them more quietly.
    brim: paint(
      sculpt(
        lathe(
          [
            [0.5, -0.012],
            [0.97, -0.02],
            [1.02, -0.01],
            [1, 0.004],
            [0.88, 0.006],
            [0.76, 0.008],
            [0.64, 0.01],
            [0.5, 0.014],
          ],
          20,
        ),
        (v) => {
          const phi = Math.atan2(v.x, v.z);
          v.y += 0.02 * Math.sin(phi * 2 + 1.1) * smooth(0.6, 1, Math.hypot(v.x, v.z));
        },
      ),
      (x, y, z) => {
        const r = Math.hypot(x, z);
        return 0.94 + 0.08 * Math.sin(r * 56);
      },
    ),
    // A soft brim that slopes down, for a bucket hat.
    brimDown: paint(
      lathe(
        [
          [0.66, 0.02],
          [1.0, -0.09],
          [1.02, -0.105],
          [1.0, -0.1],
          [0.66, 0.05],
        ],
        18,
      ),
      (x, y, z) => 0.95 + 0.07 * Math.sin(Math.hypot(x, z) * 40),
    ),
    // A puffed cloth cap: its pleats run up to a gathered crown.
    puff: paint(
      sculpt(new THREE.SphereGeometry(1, 24, 8), (v) => {
        const phi = Math.atan2(v.x, v.z),
          k = 1 + 0.035 * Math.cos(phi * 12) * smooth(1, 0.1, Math.abs(v.y));
        v.x *= k;
        v.z *= k;
      }),
      (x, y, z) =>
        0.92 + 0.1 * Math.cos(Math.atan2(x, z) * 12) * smooth(1, 0.2, Math.abs(y)),
    ),
    // A frill: a flat ring whose edge waves up and down.
    frill: sculpt(
      lathe(
        [
          [0.72, 0.0],
          [1, -0.01],
          [0.72, 0.02],
        ],
        24,
      ),
      (v) => {
        const r = Math.hypot(v.x, v.z);
        v.y += 0.09 * Math.sin(Math.atan2(v.x, v.z) * 12) * smooth(0.72, 1, r);
      },
    ),
    wicker: paint(
      lathe(
        [
          [0, 0],
          [0.72, 0],
          [0.92, 0.26],
          [1, 0.6],
          [1.03, 0.92],
          [1.08, 1],
          [0.98, 1.03],
          [0.9, 0.9],
          [0, 0.8],
        ],
        14,
      ),
      (x, y, z) => 0.86 + 0.16 * Math.sin(y * 34) * Math.cos(Math.atan2(x, z) * 7),
    ),
    kettle: lathe(
      [
        [0, 0],
        [0.82, 0],
        [1, 0.28],
        [0.96, 0.58],
        [0.62, 0.84],
        [0.42, 0.9],
        [0.46, 0.94],
        [0, 1],
      ],
      14,
    ),
  };

  /** The pleated body of a skirt, its pleats deepest at the hem. */
  function pleat(profile, pleats, lift = 0, y0 = profile[0][1], y1 = profile[profile.length - 1][1], rows = 5) {
    const hem = profile[0][1],
      top = profile[profile.length - 1][1];
    const points = [];
    if (y0 === hem) points.push([0, hem]);
    for (let i = 0; i <= rows; i++) {
      const y = lerp(y0, y1, i / rows);
      points.push([radiusAt(profile, y) + lift, y]);
    }
    return paint(
      sculpt(lathe(points, pleats * 4), (v) => {
        const t = 1 - (v.y - hem) / (top - hem),
          k = 1 + 0.06 * t * Math.cos(pleats * Math.atan2(v.x, v.z));
        v.x *= k;
        v.z *= k;
      }),
      (x, y, z) => {
        const t = 1 - (y - hem) / (top - hem);
        return 1 - 0.22 * t * (0.5 - 0.5 * Math.cos(pleats * Math.atan2(x, z)));
      },
    );
  }

  return {
    ...shapes,
    /** A closed body of revolution over a profile, hem to neck. */
    body: (profile) =>
      once(`body:${profile[0]}`, () =>
        lathe(
          [
            [0, profile[0][1]],
            ...profile,
            [0, profile[profile.length - 1][1] + 0.002],
          ],
          BODY_SEGMENTS,
        ),
      ),
    skirt: (profile, pleats = 9) =>
      once(`skirt:${profile[0]}:${pleats}`, () => pleat(profile, pleats)),
    /** A band of trim that follows a skirt's pleats. */
    skirtBand: (profile, y0, y1, pleats = 9) =>
      once(`band:${profile[0]}:${y0}:${y1}:${pleats}`, () =>
        pleat(profile, pleats, 0.004, y0, y1, 1),
      ),
    /**
     * A piece of cloth laid over a profile between two heights: a band all the
     * way round, or an arc of it (center and half in radians, 0 at the front).
     * Its edges tuck back to the surface, so it catches the light like a layer.
     * It keeps every row of the profile it crosses: a straight run across a
     * chest's curve would sink into the chest.
     */
    panel(profile, y0, y1, { center = 0, half = Math.PI, lift = 0.006, segments } = {}) {
      const count = segments ?? (half === Math.PI ? BODY_SEGMENTS : Math.max(2, Math.ceil((half / Math.PI) * 14)));
      const key = `panel:${profile[0]}:${profile.length}:${y0}:${y1}:${center}:${half}:${lift}:${count}`;
      return once(key, () => {
        const low = y0 + 0.003,
          high = y1 - 0.003,
          heights = [low, ...profile.map(([, y]) => y).filter((y) => y > low && y < high), high];
        const points = [
          [radiusAt(profile, y0) - 0.002, y0],
          ...heights.map((y) => [radiusAt(profile, y) + lift, y]),
          [radiusAt(profile, y1) - 0.002, y1],
        ];
        return lathe(points, count, center, half);
      });
    },
    /** A ring of rope or braid: a closed lump of revolution. */
    roll: (radius, thick) =>
      once(`roll:${radius}:${thick}`, () =>
        lathe(
          [
            [radius - thick * 0.5, -thick],
            [radius + thick * 0.6, -thick * 0.6],
            [radius + thick, 0],
            [radius + thick * 0.6, thick * 0.6],
            [radius - thick * 0.5, thick],
          ],
          14,
        ),
      ),
  };
}
