import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createRoomKit } from "../interior-kit.js";

// The pub's materials and the parts its builders share. Surfaces are painted
// to a known size in metres and walls carry UVs in metres, so a brick is the
// same size on every wall and every texture lines up across a join.

function rng(seed) {
  return () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
}

// A colour map and its bump map, drawn together, repeating every `metres`.
export function painted(size, metres, draw, { roughness = 0.9, bump = 0.02 } = {}) {
  const make = () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    return canvas;
  };
  const colour = make(),
    height = make(),
    c = colour.getContext("2d"),
    h = height.getContext("2d");
  draw(c, h, size);
  const map = new T.CanvasTexture(colour),
    bumpMap = new T.CanvasTexture(height);
  map.colorSpace = T.SRGBColorSpace;
  for (const t of [map, bumpMap]) {
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set(1 / metres, 1 / metres);
    t.anisotropy = 8;
  }
  return new T.MeshStandardMaterial({
    map,
    bumpMap,
    bumpScale: bump,
    roughness,
  });
}

const mix = (a, b, t) => a + (b - a) * t;

function speckle(c, size, random, count, dark = 0.06, light = 0.05) {
  for (let i = 0; i < count; i++) {
    c.fillStyle =
      random() > 0.5
        ? `rgba(255,240,214,${random() * light})`
        : `rgba(38,24,14,${random() * dark})`;
    c.fillRect(random() * size, random() * size, 1 + random() * 3, 1 + random() * 3);
  }
}

// English bond with the Tudor diaper: burnt headers on two sets of diagonals,
// a lozenge about a metre tall. A course is 89 mm; the texture repeats every
// 3.2 m, which the lattice's period of six headers and six rows divides exactly.
function brickMaterial(size = 2048) {
  const random = rng(4111),
    courses = 36,
    stretchers = 12,
    period = 6;
  const reds = ["#a8664c", "#b5735a", "#9a5b44", "#bd8062", "#ad6b52", "#945740"],
    burnt = ["#6a5650", "#735e57", "#63504b"];
  return painted(
    size,
    3.2,
    (c, h, size) => {
      const row = size / courses,
        mortar = size * 0.0036;
      c.fillStyle = "#b3a388";
      c.fillRect(0, 0, size, size);
      h.fillStyle = "#3a3a3a";
      h.fillRect(0, 0, size, size);
      for (let j = 0; j < courses; j++) {
        const header = j % 2 === 1,
          n = header ? stretchers * 2 : stretchers,
          w = size / n,
          r = (j - 1) / 2;
        for (let i = 0; i < n; i++) {
          const onLozenge =
            header && ((i + r) % period === 0 || (((i - r) % period) + period) % period === 0);
          const palette = onLozenge ? burnt : reds;
          c.fillStyle = palette[Math.floor(random() * palette.length)];
          const x = i * w + mortar / 2,
            y = j * row + mortar / 2,
            bw = w - mortar,
            bh = row - mortar;
          c.fillRect(x, y, bw, bh);
          // A soft face: lighter toward the arris, some clinker specks.
          c.fillStyle = `rgba(255,232,206,${0.03 + random() * 0.06})`;
          c.fillRect(x, y, bw, bh * 0.28);
          c.fillStyle = `rgba(40,20,14,${0.05 + random() * 0.08})`;
          c.fillRect(x, y + bh * 0.72, bw, bh * 0.28);
          const shade = 165 + Math.floor(random() * 90);
          h.fillStyle = `rgb(${shade},${shade},${shade})`;
          h.fillRect(x, y, bw, bh);
        }
      }
      speckle(c, size, random, (16000 * size * size) / 4194304, 0.08, 0.05);
    },
    { roughness: 0.92, bump: 0.035 },
  );
}

// Herringbone nogging between the upper storey's timbers.
function noggingMaterial(size = 1024) {
  const random = rng(2293),
    reds = ["#a9745a", "#b37e62", "#9d6a52", "#bb8a6c", "#96624c"];
  return painted(
    size,
    1.2,
    (c, h, size) => {
      c.fillStyle = "#b9ab90";
      c.fillRect(0, 0, size, size);
      h.fillStyle = "#333";
      h.fillRect(0, 0, size, size);
      // Bricks of 3u by u on the lattice (u, u) and (4u, -2u), which, turned
      // 45 degrees, repeats exactly over the canvas when u = size / (12 * sqrt 2).
      const u = size / (12 * Math.SQRT2);
      for (const layer of [c, h]) {
        layer.save();
        layer.translate(size / 2, size / 2);
        layer.rotate(Math.PI / 4);
      }
      const gap = u * 0.1;
      const brick = (x, y, w, d) => {
        c.fillStyle = reds[Math.floor(random() * reds.length)];
        c.fillRect(x + gap / 2, y + gap / 2, w - gap, d - gap);
        const shade = 170 + Math.floor(random() * 70);
        h.fillStyle = `rgb(${shade},${shade},${shade})`;
        h.fillRect(x + gap / 2, y + gap / 2, w - gap, d - gap);
      };
      for (let a = -40; a <= 40; a++)
        for (let b = -14; b <= 14; b++) {
          const x = (a + 4 * b) * u,
            y = (a - 2 * b) * u;
          brick(x, y, 3 * u, u);
          brick(x, y + u, u, 3 * u);
        }
      for (const layer of [c, h]) layer.restore();
      speckle(c, size, random, (9000 * size * size) / 1048576, 0.07, 0.05);
    },
    { roughness: 0.94, bump: 0.03 },
  );
}

// Limewash: soft clouds of warmth on cream, trowel marks in the bump.
function plasterMaterial() {
  const random = rng(907);
  return painted(
    1024,
    3,
    (c, h, size) => {
      c.fillStyle = "#e6d8b8";
      c.fillRect(0, 0, size, size);
      h.fillStyle = "#808080";
      h.fillRect(0, 0, size, size);
      for (let i = 0; i < 90; i++) {
        const x = random() * size,
          y = random() * size,
          r = 40 + random() * 180,
          g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, random() > 0.5 ? "rgba(246,235,207,.16)" : "rgba(186,160,120,.07)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = g;
        c.fillRect(x - r, y - r, r * 2, r * 2);
        const v = 118 + Math.floor(random() * 22);
        h.strokeStyle = `rgba(${v},${v},${v},.5)`;
        h.lineWidth = 4 + random() * 14;
        h.beginPath();
        h.arc(x, y, r, random() * 6, random() * 6);
        h.stroke();
      }
      speckle(c, size, random, 7000, 0.035, 0.03);
    },
    { roughness: 0.95, bump: 0.018 },
  );
}

// Long grain along u, for timbers (whose UVs run along their length), boards
// and furniture. `metres` is how far one repeat runs.
function grainMaterial(base, seed, { metres = 1.6, roughness = 0.74, bump = 0.012 } = {}) {
  const random = rng(seed);
  return painted(
    768,
    metres,
    (c, h, size) => {
      c.fillStyle = base;
      c.fillRect(0, 0, size, size);
      h.fillStyle = "#808080";
      h.fillRect(0, 0, size, size);
      for (let i = 0; i < 300; i++) {
        const y = random() * size,
          a = 0.012 + random() * 0.06,
          dark = random() > 0.42,
          wobble = 3 + random() * 12;
        c.strokeStyle = dark ? `rgba(30,17,9,${a})` : `rgba(255,226,180,${a * 0.65})`;
        c.lineWidth = 0.6 + random() * 2.4;
        h.strokeStyle = dark ? `rgba(40,40,40,${a * 2.4})` : `rgba(210,210,210,${a * 1.2})`;
        h.lineWidth = c.lineWidth;
        for (const layer of [c, h]) {
          layer.beginPath();
          layer.moveTo(0, y);
          layer.bezierCurveTo(
            size * 0.33,
            y + wobble * Math.sin(i),
            size * 0.66,
            y - wobble * Math.cos(i),
            size,
            y,
          );
          layer.stroke();
        }
      }
      // A few knots.
      for (let i = 0; i < 5; i++) {
        const x = random() * size,
          y = random() * size;
        for (let r = 12; r > 1; r -= 3) {
          c.strokeStyle = `rgba(25,14,8,${0.1 + (12 - r) * 0.012})`;
          c.lineWidth = 1.2;
          c.beginPath();
          c.ellipse(x, y, r * 2.2, r, 0, 0, Math.PI * 2);
          c.stroke();
        }
      }
    },
    { roughness, bump },
  );
}

// Flagstones in loose courses, worn pale in the middle of each stone.
function flagsMaterial() {
  const random = rng(3391),
    tones = ["#8d8678", "#978f80", "#827b6e", "#9c9383", "#888172", "#777165"];
  return painted(
    1536,
    3.6,
    (c, h, size) => {
      c.fillStyle = "#463f35";
      c.fillRect(0, 0, size, size);
      h.fillStyle = "#222";
      h.fillRect(0, 0, size, size);
      const rows = [0.72, 0.56, 0.82, 0.62, 0.88].map((v) => (v / 3.6) * size);
      let y = 0;
      rows.forEach((rowH) => {
        const stones = [],
          count = 4 + Math.floor(random() * 2);
        let left = size;
        for (let i = 0; i < count; i++) {
          const w = i === count - 1 ? left : Math.min(left, (size / count) * mix(0.72, 1.28, random()));
          stones.push(w);
          left -= w;
        }
        let x = 0;
        for (const w of stones) {
          const gap = size * 0.0045;
          c.fillStyle = tones[Math.floor(random() * tones.length)];
          c.fillRect(x + gap, y + gap, w - gap * 2, rowH - gap * 2);
          const g = c.createRadialGradient(
            x + w / 2, y + rowH / 2, 0, x + w / 2, y + rowH / 2, Math.max(w, rowH) * 0.62,
          );
          g.addColorStop(0, "rgba(232,222,198,.12)");
          g.addColorStop(1, "rgba(48,40,30,.2)");
          c.fillStyle = g;
          c.fillRect(x + gap, y + gap, w - gap * 2, rowH - gap * 2);
          const v = 170 + Math.floor(random() * 50);
          h.fillStyle = `rgb(${v},${v},${v})`;
          h.fillRect(x + gap, y + gap, w - gap * 2, rowH - gap * 2);
          x += w;
        }
        y += rowH;
      });
      speckle(c, size, random, 26000, 0.07, 0.05);
    },
    { roughness: 0.8, bump: 0.03 },
  );
}

// Wide elm boards running along u, pegged at the joists.
function boardsMaterial(base = "#7d5a3b", seed = 7711) {
  const random = rng(seed);
  return painted(
    1024,
    2.4,
    (c, h, size) => {
      const boards = 11,
        b = size / boards;
      for (let j = 0; j < boards; j++) {
        c.fillStyle = base;
        c.fillRect(0, j * b, size, b);
        c.fillStyle = `rgba(${random() > 0.5 ? "255,226,180" : "28,16,8"},${0.03 + random() * 0.1})`;
        c.fillRect(0, j * b, size, b);
        for (let i = 0; i < 46; i++) {
          const y = j * b + random() * b;
          c.strokeStyle = `rgba(32,18,10,${0.04 + random() * 0.1})`;
          c.lineWidth = 0.7 + random() * 1.6;
          c.beginPath();
          c.moveTo(0, y);
          c.bezierCurveTo(size * 0.3, y + random() * 6 - 3, size * 0.7, y + random() * 6 - 3, size, y);
          c.stroke();
        }
        c.fillStyle = "#1f150d";
        c.fillRect(0, j * b, size, 2.5);
        h.fillStyle = "#909090";
        h.fillRect(0, j * b, size, b);
        h.fillStyle = "#101010";
        h.fillRect(0, j * b, size, 3.5);
      }
      for (let i = 0; i < 30; i++) {
        c.fillStyle = "rgba(24,14,8,.55)";
        c.beginPath();
        c.arc(random() * size, (Math.floor(random() * boards) + 0.5) * b, 2.6, 0, 7);
        c.fill();
      }
    },
    { roughness: 0.72, bump: 0.012 },
  );
}

function grassMaterial() {
  const random = rng(6161);
  return painted(
    1024,
    6,
    (c, h, size) => {
      c.fillStyle = "#88a463";
      c.fillRect(0, 0, size, size);
      h.fillStyle = "#808080";
      h.fillRect(0, 0, size, size);
      for (let i = 0; i < 60; i++) {
        const x = random() * size,
          y = random() * size,
          r = 40 + random() * 170,
          g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, random() > 0.5 ? "rgba(62,92,38,.16)" : "rgba(236,214,128,.13)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = g;
        c.fillRect(x - r, y - r, r * 2, r * 2);
      }
      for (let i = 0; i < 26000; i++) {
        const v = random();
        c.strokeStyle =
          v > 0.55
            ? `rgba(60,92,38,${0.08 + random() * 0.2})`
            : `rgba(214,222,132,${0.06 + random() * 0.16})`;
        const x = random() * size,
          y = random() * size;
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + random() * 4 - 2, y - 2 - random() * 5);
        c.stroke();
      }
    },
    { roughness: 1, bump: 0.01 },
  );
}

function cobbleMaterial() {
  const random = rng(5503),
    tones = ["#c9b28c", "#bca680", "#d3bd98", "#b09a78", "#c2ad8a", "#a89378"];
  return painted(
    1024,
    2.4,
    (c, h, size) => {
      c.fillStyle = "#8d7a5c";
      c.fillRect(0, 0, size, size);
      h.fillStyle = "#1c1c1c";
      h.fillRect(0, 0, size, size);
      const n = 20,
        step = size / n;
      for (let j = 0; j < n; j++)
        for (let i = 0; i < n; i++) {
          const x = (i + (j % 2) * 0.5 + (random() - 0.5) * 0.2) * step,
            y = (j + (random() - 0.5) * 0.2) * step,
            rx = step * (0.38 + random() * 0.1),
            ry = step * (0.36 + random() * 0.1);
          // Stones near an edge wrap, so the repeat has no seam.
          for (const [ox, oy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
            c.fillStyle = tones[Math.floor(i * 7 + j * 13) % tones.length];
            c.beginPath();
            c.ellipse(x + ox, y + oy, rx, ry, 0, 0, 7);
            c.fill();
            const g = h.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, Math.max(rx, ry));
            g.addColorStop(0, "#d8d8d8");
            g.addColorStop(1, "#505050");
            h.fillStyle = g;
            h.beginPath();
            h.ellipse(x + ox, y + oy, rx, ry, 0, 0, 7);
            h.fill();
          }
        }
      speckle(c, size, random, 14000, 0.08, 0.06);
    },
    { roughness: 0.92, bump: 0.05 },
  );
}

// A patchwork quilt, in the village's soft colours.
function quiltMaterial(colours, seed) {
  const random = rng(seed);
  return painted(
    512,
    0.8,
    (c, h, size) => {
      const n = 4,
        s = size / n;
      for (let j = 0; j < n; j++)
        for (let i = 0; i < n; i++) {
          c.fillStyle = colours[Math.floor(random() * colours.length)];
          c.fillRect(i * s, j * s, s, s);
          if (random() > 0.5) {
            c.fillStyle = colours[Math.floor(random() * colours.length)];
            c.beginPath();
            c.moveTo(i * s, j * s);
            c.lineTo(i * s + s, j * s);
            c.lineTo(i * s, j * s + s);
            c.fill();
          }
          h.fillStyle = "#a8a8a8";
          h.fillRect(i * s + 3, j * s + 3, s - 6, s - 6);
        }
      c.strokeStyle = "rgba(60,44,30,.34)";
      c.setLineDash([5, 5]);
      c.lineWidth = 1.4;
      for (let i = 0; i <= n; i++) {
        c.beginPath();
        c.moveTo(0, i * s);
        c.lineTo(size, i * s);
        c.moveTo(i * s, 0);
        c.lineTo(i * s, size);
        c.stroke();
      }
    },
    { roughness: 0.98, bump: 0.003 },
  );
}

/**
 * The set the world's exterior builds with: flat colours, which merge to one
 * vertex-coloured mesh, and only the brick and herringbone painted, smaller.
 * There is no plaster, because nothing inside is built; `glass` is the village's.
 */
export function createPubOutsideMaterials(glass) {
  const plain = (color) => new T.MeshStandardMaterial({ color, roughness: 0.86 });
  const quilt = plain("#7d8f9b");
  return {
    outsideOnly: true,
    plaster: null,
    glass,
    oak: plain("#5e4834"),
    oakWarm: plain("#8b6239"),
    oakDark: plain("#4b3524"),
    bargeOak: plain("#6f543b"),
    boards: plain("#7d5a3b"),
    stone: plain("#bcb29b"),
    stoneDark: plain("#918979"),
    // Seen only as porch soffits and, zoomed far out, the bare roof slabs.
    sark: plain("#a8654a"),
    iron: plain("#2e2c2b"),
    lead: plain("#3e4244"),
    soot: plain("#26211e"),
    pewter: plain("#a7a89f"),
    quilts: [quilt, quilt, quilt],
  };
}

/** The two painted materials the world's exterior keeps; each paints in one go. */
export const paintOutsideBrick = () => brickMaterial(1024);
export const paintOutsideNogging = () => noggingMaterial(512);

/** The pub's one set of materials, shared by every storey. */
export function createPubMaterials() {
  const m = {
    brick: brickMaterial(),
    nogging: noggingMaterial(),
    fireback: noggingMaterial(),
    plaster: plasterMaterial(),
    flags: flagsMaterial(),
    boards: boardsMaterial(),
    sark: boardsMaterial("#6d4e33", 2020),
    grass: grassMaterial(),
    cobble: cobbleMaterial(),
    oak: grainMaterial("#5e4834", 4021, { roughness: 0.82 }),
    oakWarm: grainMaterial("#8b6239", 4177, { roughness: 0.62 }),
    oakDark: grainMaterial("#4b3524", 4333, { roughness: 0.68 }),
    tabletop: grainMaterial("#9a6e41", 4411, { metres: 1.1, roughness: 0.48, bump: 0.008 }),
    bargeOak: grainMaterial("#6f543b", 4561, { roughness: 0.8 }),
    quilts: [
      quiltMaterial(["#a9745c", "#d9c6a0", "#7d8f6c", "#c9a069", "#8c5a4a"], 31),
      quiltMaterial(["#6f8a97", "#d7ccae", "#a59ec0", "#c28b7a", "#596f7c"], 37),
      quiltMaterial(["#7d8f6c", "#e0cfa8", "#b5805e", "#54705b", "#c7b37f"], 41),
    ],
    stone: new T.MeshStandardMaterial({ color: "#c7bda6", roughness: 0.9 }),
    stoneDark: new T.MeshStandardMaterial({ color: "#9b9383", roughness: 0.92 }),
    iron: new T.MeshStandardMaterial({ color: "#2e2c2b", roughness: 0.62, metalness: 0.5 }),
    lead: new T.MeshStandardMaterial({ color: "#3e4244", roughness: 0.55, metalness: 0.3 }),
    brass: new T.MeshStandardMaterial({ color: "#cda464", roughness: 0.3, metalness: 0.75 }),
    copper: new T.MeshStandardMaterial({ color: "#b66b40", roughness: 0.34, metalness: 0.72 }),
    pewter: new T.MeshStandardMaterial({ color: "#a7a89f", roughness: 0.38, metalness: 0.6 }),
    wax: new T.MeshStandardMaterial({ color: "#efe3c6", roughness: 0.6 }),
    linen: new T.MeshStandardMaterial({ color: "#e4d9bf", roughness: 0.97 }),
    straw: new T.MeshStandardMaterial({ color: "#c8ad77", roughness: 1 }),
    soot: new T.MeshStandardMaterial({ color: "#26211e", roughness: 0.98 }),
    glass: new T.MeshStandardMaterial({
      color: "#cfd8c0",
      roughness: 0.14,
      metalness: 0.2,
      transparent: true,
      opacity: 0.26,
      emissive: "#ffb65a",
      emissiveIntensity: 0,
      depthWrite: false,
    }),
    bottleGreen: new T.MeshStandardMaterial({ color: "#39513c", roughness: 0.18, metalness: 0.15 }),
    bottleBrown: new T.MeshStandardMaterial({ color: "#5c3a1f", roughness: 0.2, metalness: 0.12 }),
    ember: new T.MeshStandardMaterial({
      color: "#2a1a12",
      roughness: 1,
      emissive: "#ff6a22",
      emissiveIntensity: 1.1,
    }),
    candleGlow: new T.MeshBasicMaterial({
      color: new T.Color(3.2, 2.1, 0.95),
      transparent: true,
      opacity: 0.95,
      blending: T.AdditiveBlending,
      depthWrite: false,
    }),
  };
  // The fireback is the same herringbone, a lifetime blacker.
  m.fireback.color.set("#3b2f2a");
  for (const key of ["stone", "stoneDark"]) {
    const random = rng(key.length * 917);
    const stone = painted(
      512,
      1.1,
      (c, h, size) => {
        c.fillStyle = key === "stone" ? "#bcb29b" : "#918979";
        c.fillRect(0, 0, size, size);
        h.fillStyle = "#808080";
        h.fillRect(0, 0, size, size);
        speckle(c, size, random, 16000, 0.1, 0.09);
        speckle(h, size, random, 9000, 0.3, 0.3);
      },
      { roughness: 0.92, bump: 0.02 },
    );
    m[key].map = stone.map;
    m[key].bumpMap = stone.bumpMap;
    m[key].bumpScale = stone.bumpScale;
    m[key].color.set("#ffffff");
  }
  return m;
}

const up = new T.Vector3(0, 1, 0);
const unitBox = new T.BoxGeometry(1, 1, 1);

// A hewn timber along +Y, centred, with chamfered arrises and a little
// wander, and UVs in metres along its length.
function timberGeometry(length, w, h, random, wander = 0.006, most = 4) {
  const chamfer = Math.min(w, h) * 0.13,
    a = w / 2,
    b = h / 2,
    ring = [
      [a - chamfer, -b],
      [a, -b + chamfer],
      [a, b - chamfer],
      [a - chamfer, b],
      [-a + chamfer, b],
      [-a, b - chamfer],
      [-a, -b + chamfer],
      [-a + chamfer, -b],
    ],
    segs = Math.max(1, Math.min(most, Math.round(length / 0.9))),
    offset = random() * 3,
    across = random() * 3,
    pos = [],
    uv = [];
  const off = [];
  for (let i = 0; i <= segs; i++)
    off.push([(random() - 0.5) * wander * 2, (random() - 0.5) * wander * 2]);
  const point = (i, k) => {
    const y = -length / 2 + (i / segs) * length,
      p = ring[k % 8];
    return [p[0] + off[i][0], y, p[1] + off[i][1]];
  };
  const perimeter = (k) => (k / 8) * (w + h) * 2;
  for (let i = 0; i < segs; i++)
    for (let k = 0; k < 8; k++) {
      const quad = [
          [i, k],
          [i + 1, k],
          [i + 1, k + 1],
          [i, k],
          [i + 1, k + 1],
          [i, k + 1],
        ];
      for (const [p, q] of quad) {
        pos.push(...point(p, q));
        uv.push(offset + (p / segs) * length, across + perimeter(q));
      }
    }
  // A lean timber's ends meet other timbers or the wall; they never show.
  for (const end of most > 1 ? [0, segs] : [])
    for (let k = 1; k < 7; k++) {
      const tri = end ? [0, k, k + 1] : [0, k + 1, k];
      for (const q of tri) {
        pos.push(...point(end, q));
        uv.push(offset + point(end, q)[0], across + point(end, q)[2]);
      }
    }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/**
 * The builder for one storey. Its parts are parented to `root`, and `finish()`
 * merges them by material, so a storey costs one draw per material.
 */
export function createStorey(root, seed, materials, { lean = false } = {}) {
  const kit = createRoomKit(root, seed),
    { random, mesh } = kit,
    keep = new Set(),
    panes = [];
  const m4 = new T.Matrix4(),
    q = new T.Quaternion(),
    x = new T.Vector3(),
    y = new T.Vector3(),
    z = new T.Vector3();

  /** A hewn timber from a to b; `w` across, `h` deep. Its width stays level. */
  function timber(material, a, b, w = 0.18, h = w, p = root) {
    const from = new T.Vector3(...a),
      to = new T.Vector3(...b),
      length = from.distanceTo(to);
    y.copy(to).sub(from).normalize();
    x.crossVectors(y, up);
    if (x.lengthSq() < 1e-4) x.set(1, 0, 0);
    x.normalize();
    z.crossVectors(x, y);
    m4.makeBasis(x, y, z);
    q.setFromRotationMatrix(m4);
    const o = mesh(timberGeometry(length, w, h, random, 0.006, lean ? 1 : 4), material, 0, 0, 0, p);
    o.position.copy(from).add(to).multiplyScalar(0.5);
    o.quaternion.copy(q);
    return o;
  }

  /** A plain thin bar from a to b: lead cames, chains and rails. */
  function bar(material, a, b, w = 0.02, h = w, p = root) {
    const from = new T.Vector3(...a),
      to = new T.Vector3(...b);
    const o = mesh(unitBox, material, 0, 0, 0, p);
    o.position.copy(from).add(to).multiplyScalar(0.5);
    o.scale.set(w, from.distanceTo(to), h);
    o.quaternion.setFromUnitVectors(up, to.sub(from).normalize());
    return o;
  }

  /** A flat block between two corners, with its UVs in metres. */
  function block(material, x0, y0, z0, x1, y1, z1) {
    const w = Math.abs(x1 - x0),
      h = Math.abs(y1 - y0),
      d = Math.abs(z1 - z0),
      g = new T.BoxGeometry(w, h, d),
      uv = g.attributes.uv,
      normal = g.attributes.normal;
    for (let i = 0; i < uv.count; i++) {
      const nx = Math.abs(normal.getX(i)),
        ny = Math.abs(normal.getY(i));
      const [su, sv] = nx > 0.5 ? [d, h] : ny > 0.5 ? [w, d] : [w, h];
      uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    }
    return mesh(g, material, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  }

  /**
   * A flat outline (in metres, as a THREE.Shape) given thickness and set in
   * the world: local u along `uAxis`, v along `vAxis`, thickness along their
   * cross. UVs stay in metres, so masonry keeps its scale at any angle.
   */
  function sheet(material, shape, origin, uAxis, vAxis, thickness = 0.1, curve = 8) {
    const g = new T.ExtrudeGeometry(shape, {
        depth: thickness,
        bevelEnabled: false,
        curveSegments: curve,
      }),
      u = new T.Vector3(...uAxis).normalize(),
      v = new T.Vector3(...vAxis).normalize(),
      n = new T.Vector3().crossVectors(u, v);
    g.applyMatrix4(new T.Matrix4().makeBasis(u, v, n));
    return mesh(g, material, ...origin);
  }

  // The outline of an opening: square-headed, or the Tudor four-centred arch.
  function addOpening(path, left, right, bottom, top, arch) {
    const hole = new T.Path();
    hole.moveTo(left, bottom);
    if (arch) {
      const w = right - left,
        rise = Math.min(w * 0.3, 0.42),
        spring = top - rise;
      hole.lineTo(left, spring);
      hole.bezierCurveTo(left, spring + rise * 0.72, left + w * 0.14, spring + rise * 0.92, left + w * 0.34, spring + rise * 0.96);
      hole.lineTo(left + w * 0.5, top);
      hole.lineTo(right - w * 0.34, spring + rise * 0.96);
      hole.bezierCurveTo(right - w * 0.14, spring + rise * 0.92, right, spring + rise * 0.72, right, spring);
    } else {
      hole.lineTo(left, top);
      hole.lineTo(right, top);
    }
    hole.lineTo(right, bottom);
    hole.closePath();
    path.holes.push(hole);
  }

  /**
   * A skin of wall along `axis`, y0 to y1, between `a` and `b` on the other
   * axis, pierced by `openings`. `top(u)` can slope its head for a gable.
   */
  function skin(material, axis, from, to, a, b, y0, y1, openings = [], outline = null) {
    const shape = new T.Shape();
    if (outline) {
      outline.forEach(([u, v], i) => (i ? shape.lineTo(u, v) : shape.moveTo(u, v)));
    } else {
      shape.moveTo(from, y0);
      shape.lineTo(to, y0);
      shape.lineTo(to, y1);
      shape.lineTo(from, y1);
    }
    shape.closePath();
    const thick = Math.abs(b - a);
    // An opening at the wall's foot stops just above it: holes may not touch
    // the outline, and the threshold stone covers the sliver.
    for (const o of openings)
      addOpening(shape, o.at - o.w / 2, o.at + o.w / 2, Math.max(o.y0, y0 + 0.002), o.y0 + o.h, o.arch);
    const g = new T.ExtrudeGeometry(shape, {
      depth: thick,
      bevelEnabled: false,
      curveSegments: 8,
    });
    if (axis === "z") {
      g.rotateY(-Math.PI / 2);
      return mesh(g, material, Math.max(a, b), 0, 0);
    }
    return mesh(g, material, 0, 0, Math.min(a, b));
  }

  /** A sheet of glass, merged with the storey's other panes in `finish`. */
  function pane(cx, cy, cz, w, h, axis) {
    const g = new T.PlaneGeometry(w, h);
    if (axis === "z") g.rotateY(Math.PI / 2);
    g.translate(cx, cy, cz);
    panes.push(g);
  }

  /**
   * A leaded light: a lattice of lozenge cames clipped to the rectangle, a
   * pane of glass behind it, in the plane at `at` across `axis`.
   */
  function leaded(axis, at, center, y0, w, h, came = materials.lead) {
    pane(
      axis === "x" ? center : at,
      y0 + h / 2,
      axis === "x" ? at : center,
      w,
      h,
      axis,
    );
    const place = (u, v, off = 0) =>
      axis === "x" ? [center + u, y0 + v, at + off] : [at + off, y0 + v, center + u];
    const spacing = lean ? 0.32 : 0.15,
      slope = 1.45,
      halfW = w / 2,
      lines = [];
    // Each family of parallel diagonals, clipped to the light.
    for (const sign of [-1, 1]) {
      const reach = h / slope + w;
      for (let c = -reach; c <= reach; c += spacing) {
        // v = sign * slope * (u - c)
        const ends = [];
        for (const u of [-halfW, halfW]) {
          const v = sign * slope * (u - c);
          if (v >= 0 && v <= h) ends.push([u, v]);
        }
        for (const v of [0, h]) {
          const u = v / (sign * slope) + c;
          if (u > -halfW && u < halfW) ends.push([u, v]);
        }
        if (ends.length >= 2) lines.push([ends[0], ends[1]]);
      }
    }
    for (const [p, q2] of lines) {
      const o = bar(came, place(p[0], p[1]), place(q2[0], q2[1]), 0.011, 0.016);
      o.receiveShadow = false;
    }
  }

  /** Keeps a mesh out of the merge: it moves, or is drawn on its own. */
  function apart(object) {
    keep.add(object);
    return object;
  }

  function finish() {
    kit.bake(keep);
    if (panes.length) {
      const glass = new T.Mesh(mergeGeometries(panes), materials.glass);
      panes.forEach((g) => g.dispose());
      glass.renderOrder = 2;
      root.add(glass);
    }
  }

  /** Hands over the panes gathered so far, for a builder that merges its own. */
  function takePanes() {
    return panes.splice(0);
  }

  const parts = { ...kit, root, keep, timber, bar, block, sheet, skin, pane, leaded, apart, finish, takePanes };
  // A lean storey, for the world's exterior: the same calls, far fewer triangles.
  if (lean) {
    const ball = new T.IcosahedronGeometry(1, 1);
    parts.orb = (m, x, y, z, a, b = a, c = a, p = root) => {
      const o = mesh(ball, m, x, y, z, p);
      o.scale.set(a, b, c);
      return o;
    };
    parts.box = (m, x, y, z, w, h, d, r, p = root) => kit.box(m, x, y, z, w, h, d, 0, p);
    parts.cyl = (m, x, y, z, r, h, rt = r, p = root, segments = 32) =>
      kit.cyl(m, x, y, z, r, h, rt, p, Math.min(segments, 7));
    parts.torus = (m, x, y, z, r, t = 0.025, p = root, arc = Math.PI * 2) =>
      mesh(new T.TorusGeometry(r, t, 4, 10, arc), m, x, y, z, p);
  }
  return parts;
}

/** A Tudor four-centred arch as a closed shape: opening `w` wide, `h` tall. */
export function tudorArch(w, h, rise = Math.min(w * 0.3, 0.42)) {
  const s = new T.Shape(),
    spring = h - rise,
    l = -w / 2,
    r = w / 2;
  s.moveTo(l, 0);
  s.lineTo(l, spring);
  s.bezierCurveTo(l, spring + rise * 0.72, l + w * 0.14, spring + rise * 0.92, l + w * 0.34, spring + rise * 0.96);
  s.lineTo(0, h);
  s.lineTo(r - w * 0.34, spring + rise * 0.96);
  s.bezierCurveTo(r - w * 0.14, spring + rise * 0.92, r, spring + rise * 0.72, r, spring);
  s.lineTo(r, 0);
  s.closePath();
  return s;
}

/**
 * Lifts `shape` through a twist: a brick chimney shaft, its star section
 * turning as it rises. A Tudor signature, and the stack's whole silhouette.
 */
export function twistedShaft(radius, height, lobes = 6, turns = 0.75, rings = 28, radial = 36) {
  const pos = [],
    uv = [],
    idx = [];
  for (let j = 0; j <= rings; j++) {
    const t = j / rings,
      y = t * height,
      twist = t * turns * Math.PI * 2;
    for (let k = 0; k <= radial; k++) {
      const a = (k / radial) * Math.PI * 2,
        r = radius * (0.8 + 0.2 * Math.cos(lobes * (a + twist)));
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
      uv.push((k / radial) * radius * Math.PI * 2, y);
      if (j < rings && k < radial) {
        const p = j * (radial + 1) + k,
          n = p + radial + 1;
        idx.push(p, n, p + 1, p + 1, n, n + 1);
      }
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A cask: a bulged lathe along +Y, of length `h` and belly radius `r`. */
export function caskGeometry(r, h) {
  const points = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14,
      bulge = Math.sin(t * Math.PI);
    points.push(new T.Vector2(r * (0.78 + 0.22 * bulge), (t - 0.5) * h));
  }
  points.unshift(new T.Vector2(0.001, -h / 2));
  points.push(new T.Vector2(0.001, h / 2));
  return new T.LatheGeometry(points, 20);
}

/**
 * Hand-painted canvas art as an unlit-ish material, for the inn's sign and
 * the portrait over the hearth.
 */
export function paintedMaterial(w, h, draw, roughness = 0.72) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext("2d"), w, h);
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  map.anisotropy = 8;
  return new T.MeshStandardMaterial({ map, roughness });
}

/** The inn's heron, asleep on one leg, painted onto any canvas. */
export function paintHeron(c, w, h, { sky = "#d9cf9f", ground = "#6f8a6a", ink = "#2f3a3a" } = {}) {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, sky);
  g.addColorStop(1, "#e9dfb9");
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  // A low moon, reeds and the water line.
  c.fillStyle = "#f6eecb";
  c.beginPath();
  c.arc(w * 0.73, h * 0.28, w * 0.12, 0, 7);
  c.fill();
  c.fillStyle = ground;
  c.fillRect(0, h * 0.78, w, h * 0.22);
  c.strokeStyle = "rgba(240,236,205,.6)";
  c.lineWidth = w * 0.006;
  for (let i = 0; i < 5; i++) {
    c.beginPath();
    c.moveTo(w * (0.12 + i * 0.17), h * (0.84 + (i % 3) * 0.04));
    c.lineTo(w * (0.24 + i * 0.17), h * (0.84 + (i % 3) * 0.04));
    c.stroke();
  }
  c.strokeStyle = "#5c7255";
  c.lineWidth = w * 0.008;
  for (const [x, top] of [[0.08, 0.5], [0.13, 0.42], [0.18, 0.55], [0.86, 0.46], [0.92, 0.54]]) {
    c.beginPath();
    c.moveTo(w * x, h * 0.82);
    c.quadraticCurveTo(w * (x + 0.02), h * 0.65, w * (x + 0.01), h * top);
    c.stroke();
    c.fillStyle = "#7a5a3c";
    c.beginPath();
    c.ellipse(w * (x + 0.01), h * top, w * 0.011, h * 0.035, 0, 0, 7);
    c.fill();
  }
  const px = (x) => w * x,
    py = (y) => h * y;
  // The one leg, the other tucked away.
  c.strokeStyle = "#8a6a44";
  c.lineWidth = w * 0.012;
  c.beginPath();
  c.moveTo(px(0.47), py(0.6));
  c.lineTo(px(0.475), py(0.84));
  c.lineTo(px(0.53), py(0.86));
  c.stroke();
  // The body, hunched, with the neck folded down and the head on its breast.
  c.fillStyle = "#8ea2a8";
  c.beginPath();
  c.moveTo(px(0.36), py(0.35));
  c.bezierCurveTo(px(0.42), py(0.22), px(0.6), py(0.26), px(0.64), py(0.42));
  c.bezierCurveTo(px(0.66), py(0.52), px(0.7), py(0.62), px(0.74), py(0.68));
  c.bezierCurveTo(px(0.62), py(0.66), px(0.46), py(0.66), px(0.4), py(0.56));
  c.bezierCurveTo(px(0.36), py(0.5), px(0.34), py(0.42), px(0.36), py(0.35));
  c.fill();
  c.fillStyle = "#62767e";
  c.beginPath();
  c.moveTo(px(0.47), py(0.36));
  c.bezierCurveTo(px(0.58), py(0.36), px(0.66), py(0.56), px(0.72), py(0.66));
  c.bezierCurveTo(px(0.6), py(0.62), px(0.5), py(0.56), px(0.47), py(0.36));
  c.fill();
  c.fillStyle = "#d7dcd2";
  c.beginPath();
  c.ellipse(px(0.385), py(0.31), w * 0.062, h * 0.062, -0.3, 0, 7);
  c.fill();
  c.strokeStyle = ink;
  c.lineWidth = w * 0.012;
  c.lineCap = "round";
  // The crest, trailing back.
  c.beginPath();
  c.moveTo(px(0.37), py(0.27));
  c.quadraticCurveTo(px(0.45), py(0.26), px(0.5), py(0.31));
  c.stroke();
  // A shut eye, and the dagger bill resting on the breast.
  c.lineWidth = w * 0.006;
  c.beginPath();
  c.arc(px(0.375), py(0.305), w * 0.012, 0.3, Math.PI - 0.3);
  c.stroke();
  c.fillStyle = "#c9933f";
  c.beginPath();
  c.moveTo(px(0.35), py(0.325));
  c.lineTo(px(0.255), py(0.42));
  c.lineTo(px(0.375), py(0.355));
  c.fill();
  // Zs, for anyone reading the sign from the road.
  c.fillStyle = ink;
  c.font = `italic ${Math.round(w * 0.05)}px Georgia`;
  c.textAlign = "center";
  c.fillText("z", px(0.28), py(0.23));
  c.font = `italic ${Math.round(w * 0.07)}px Georgia`;
  c.fillText("z", px(0.21), py(0.16));
}
