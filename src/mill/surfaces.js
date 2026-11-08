import * as T from "three";
import { MILL_SIGNS } from "../content/mill.js";

// Everything painted in Willow Mill: the worn flagstones, the limewashed rubble
// walls, the loft's boards overhead, hessian for the sacks, the chalkboard and
// the bins' stencils, and the colours of the rest. A canvas is drawn once, in
// build order, from the room's seeded random stream.

const SERIF = "Georgia, 'Times New Roman', serif";
const HAND = "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive";
const STENCIL = "'Arial Black', 'Helvetica Neue', Arial, sans-serif";

export function createSurfaces(parts) {
  const { random, range, mat, surface } = parts;

  function paint(w, h, draw, repeat = true) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    draw(canvas.getContext("2d"), w, h);
    const map = new T.CanvasTexture(canvas);
    map.colorSpace = T.SRGBColorSpace;
    if (repeat) map.wrapS = map.wrapT = T.RepeatWrapping;
    map.anisotropy = 8;
    return map;
  }
  const shade = (hex, amount) => {
    const n = parseInt(hex.slice(1), 16),
      f = 1 + amount,
      ch = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
    return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
  };
  const speckle = (c, w, h, n, light = 0.05, dark = 0.06) => {
    for (let i = 0; i < n; i++) {
      c.fillStyle = random() > 0.5 ? `rgba(255,248,230,${range(0.01, light)})` : `rgba(35,28,20,${range(0.01, dark)})`;
      c.fillRect(random() * w, random() * h, range(0.6, 2.4), range(0.6, 2.4));
    }
  };
  const grain = (c, x, y, w, h, n, tone = "42,24,12") => {
    for (let i = 0; i < n; i++) {
      c.strokeStyle = `rgba(${tone},${range(0.04, 0.14)})`;
      c.lineWidth = range(0.6, 1.8);
      c.beginPath();
      const gy = y + range(0, h);
      c.moveTo(x, gy);
      c.bezierCurveTo(x + w * 0.3, gy + range(-3, 3), x + w * 0.7, gy + range(-4, 4), x + w, gy + range(-3, 3));
      c.stroke();
    }
  };
  const text = (c, words, x, y, size, colour, font = SERIF, weight = "") => {
    c.font = `${weight} ${size}px ${font}`.trim();
    c.fillStyle = colour;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(words, x, y);
  };

  // Big irregular flags in courses, worn paler where the feet go, and floury.
  const flags = paint(1024, 1024, (c, S) => {
    c.fillStyle = "#6f675c";
    c.fillRect(0, 0, S, S);
    const rows = 4,
      rh = S / rows;
    for (let r = 0; r < rows; r++) {
      let x = -range(0, S * 0.3);
      while (x < S) {
        const len = range(S * 0.2, S * 0.38),
          tone = shade(random() > 0.5 ? "#a49a88" : "#958c7d", range(-0.1, 0.08));
        for (const dx of [0, S, -S]) {
          c.fillStyle = tone;
          c.beginPath();
          c.roundRect(x + dx + 4, r * rh + 4, len - 8, rh - 8, 10);
          c.fill();
          for (let k = 0; k < 30; k++) {
            c.fillStyle = `rgba(${random() > 0.5 ? "255,250,235" : "50,40,30"},${range(0.02, 0.07)})`;
            c.beginPath();
            c.arc(x + dx + range(10, len - 10), r * rh + range(10, rh - 10), range(4, 26), 0, Math.PI * 2);
            c.fill();
          }
        }
        x += len;
      }
    }
    speckle(c, S, S, 9000, 0.06, 0.07);
    // Flour settled in the joints and corners.
    for (let i = 0; i < 1600; i++) {
      c.fillStyle = `rgba(245,240,226,${range(0.04, 0.16)})`;
      c.fillRect(random() * S, random() * S, range(1, 5), range(1, 3));
    }
  });
  // Limewash over coursed rubble: the stones just show through.
  const limewash = paint(1024, 1024, (c, S) => {
    c.fillStyle = "#e8e1d0";
    c.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += range(60, 90)) {
      for (let x = -range(0, 80); x < S; x += range(90, 170)) {
        c.strokeStyle = `rgba(110,95,75,${range(0.02, 0.05)})`;
        c.lineWidth = range(6, 12);
        c.beginPath();
        c.ellipse(x + 60, y + 35, range(42, 70), range(22, 34), range(-0.15, 0.15), 0, Math.PI * 2);
        c.stroke();
        c.fillStyle = `rgba(${random() > 0.5 ? "255,252,240" : "180,165,140"},${range(0.04, 0.1)})`;
        c.beginPath();
        c.ellipse(x + 60, y + 35, range(30, 60), range(16, 28), 0, 0, Math.PI * 2);
        c.fill();
      }
    }
    speckle(c, S, S, 7000, 0.07, 0.05);
  });
  // The underside of the loft's boards, between the joists.
  const loftBoards = paint(512, 512, (c, S) => {
    const n = 4,
      u = S / n;
    for (let i = 0; i < n; i++) {
      c.fillStyle = shade("#8c6a48", range(-0.15, 0.08));
      c.fillRect(0, i * u, S, u);
      grain(c, 0, i * u, S, u, 18);
      c.fillStyle = "rgba(30,18,10,0.6)";
      c.fillRect(0, i * u, S, 3);
    }
    speckle(c, S, S, 3000, 0.08, 0.05);
  });
  // Hessian: a coarse weave, with the mill's name stencilled across it.
  const hessian = (stencil) =>
    paint(512, 512, (c, S) => {
      c.fillStyle = "#c8b48a";
      c.fillRect(0, 0, S, S);
      for (let i = 0; i < S; i += 4) {
        c.fillStyle = `rgba(90,70,40,${range(0.06, 0.16)})`;
        c.fillRect(0, i, S, 1.5);
        c.fillRect(i, 0, 1.5, S);
      }
      speckle(c, S, S, 4000, 0.1, 0.08);
      if (stencil) {
        c.globalAlpha = 0.72;
        text(c, stencil, S / 2, S * 0.42, 70, "#3d4f6b", STENCIL);
        text(c, "★", S / 2, S * 0.62, 70, "#8b3a32", STENCIL);
        c.globalAlpha = 1;
      }
    });
  // A chalkboard in a pine frame.
  const chalk = paint(
    512,
    768,
    (c, w, h) => {
      c.fillStyle = "#2e3532";
      c.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) {
        c.fillStyle = `rgba(230,230,220,${range(0.02, 0.05)})`;
        c.beginPath();
        c.ellipse(random() * w, random() * h, range(20, 90), range(10, 40), random() * 3, 0, Math.PI * 2);
        c.fill();
      }
      MILL_SIGNS.board.forEach(([words, size], i) => {
        text(c, words, w / 2, 90 + i * 118 - (i ? 0 : 10), size, i ? "#ecebe2" : "#f2d27a", HAND);
      });
      c.strokeStyle = "#ecebe2";
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(w * 0.2, 150);
      c.lineTo(w * 0.8, 150);
      c.stroke();
    },
    false,
  );
  // The bins' names, stencilled on their fronts.
  const binLabel = (name) =>
    paint(
      512,
      160,
      (c, w, h) => {
        c.clearRect(0, 0, w, h);
        text(c, name, w / 2, h / 2, 96, "rgba(60,48,34,0.85)", STENCIL);
      },
      false,
    );

  const flat = (color, roughness = 0.75, metalness = 0) => mat(color, roughness, metalness);
  const textured = (map, roughness = 0.85, color = "#ffffff") => new T.MeshStandardMaterial({ map, roughness, color });
  const glow = (color, emissive, intensity, roughness = 0.5) =>
    new T.MeshStandardMaterial({ color, emissive, emissiveIntensity: intensity, roughness });

  const M = {
    floor: textured(flags, 0.92),
    limewash: textured(limewash, 0.95),
    loft: textured(loftBoards, 0.8),
    beam: textured(surface("wood", "#5f4630"), 0.75),
    oak: textured(surface("wood", "#8a6440"), 0.7),
    pine: textured(surface("wood", "#b48a5c"), 0.72),
    cog: flat("#b99a6c", 0.7),
    timber: flat("#6e5238", 0.75),
    timberDark: flat("#4a3826", 0.8),
    iron: flat("#3d3a36", 0.5, 0.7),
    ironDark: flat("#2a2826", 0.45, 0.75),
    brass: flat("#b8914a", 0.35, 0.8),
    stone: flat("#9b968b", 0.9),
    burr: flat("#b3ab99", 0.95),
    slate: flat("#4e5457", 0.8),
    sack: textured(hessian(MILL_SIGNS.sack), 0.95),
    sackPlain: textured(hessian(null), 0.95),
    sackTie: flat("#8a7550", 0.9),
    wheat: flat("#d6b35f", 0.85),
    barley: flat("#d9c27c", 0.85),
    oats: flat("#cdb98d", 0.9),
    meal: flat("#efe5cf", 0.95),
    flour: flat("#f2ede1", 0.95),
    canvas: flat("#b7a888", 0.95),
    leather: flat("#6a4a30", 0.7),
    rug: flat("#8a4b3c", 0.95),
    rugBand: flat("#d2b067", 0.95),
    cushion: flat("#5f7f77", 0.9),
    rope: flat("#a68d60", 0.95),
    mouse: flat("#8c7a68", 0.9),
    mouseEar: flat("#c99a8c", 0.8),
    eye: flat("#111111", 0.2),
    chalk: textured(chalk, 0.9),
    glass: new T.MeshPhysicalMaterial({ color: "#dfe9ea", roughness: 0.05, transmission: 0.0, transparent: true, opacity: 0.16, depthWrite: false }),
    water: new T.MeshStandardMaterial({ color: "#5d8a86", roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.88 }),
    lantern: glow("#ffe0a0", "#ffb55c", 0.6, 0.3),
    fireGlow: glow("#ff8a3a", "#ff6a1a", 1.6, 0.6),
    binLabels: MILL_SIGNS.bins.map((name) => new T.MeshStandardMaterial({ map: binLabel(name), transparent: true, roughness: 0.9, depthWrite: false })),
  };
  return { M, paint, shade, text, SERIF, HAND };
}
