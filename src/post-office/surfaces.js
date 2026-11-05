import * as T from "three";
import { POST_OFFICE_SIGNS as SIGNS } from "../content/post-office.js";
import { paintDistrictMap } from "./district-map.js";
import { MY_BOX, POST_OFFICE as P, boxNumber } from "./layout.js";

// Everything painted in the post office: the repeating surfaces, the colours,
// and one shared atlas holding every sign, notice, stamp, label and postcard,
// so a hundred pieces of lettering cost one material.

const TAU = Math.PI * 2;
const ATLAS = 2048;
const SERIF = "Georgia, 'Times New Roman', serif";

/**
 * One big sheet of small paintings. Pieces are collected first and painted
 * tallest first at the lowest free height, which leaves the fewest gaps; each
 * piece's place on the sheet is filled into its rect at that point.
 */
function createAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = ATLAS;
  const c = canvas.getContext("2d"),
    step = 4,
    skyline = new Int32Array(ATLAS / step),
    pieces = [];
  const add = (w, h, draw) => {
    const rect = { u0: 0, u1: 0, v0: 0, v1: 0, aspect: w / h };
    pieces.push({ w, h, draw, rect });
    return rect;
  };
  const paint = () => {
    c.fillStyle = "#8d7a60";
    c.fillRect(0, 0, ATLAS, ATLAS);
    pieces.sort((a, b) => b.h - a.h || b.w - a.w);
    for (const { w, h, draw, rect } of pieces) {
      const span = Math.ceil((w + 4) / step);
      let best = -1,
        bestY = Infinity;
      for (let i = 0; i + span <= skyline.length; i++) {
        let y = 0;
        for (let k = i; k < i + span; k++) y = Math.max(y, skyline[k]);
        if (y < bestY) {
          bestY = y;
          best = i;
        }
      }
      if (best < 0 || bestY + h > ATLAS) throw Error(`The atlas has no room for ${w} × ${h}.`);
      for (let k = best; k < best + span; k++) skyline[k] = bestY + h + 4;
      const x = best * step;
      c.save();
      c.beginPath();
      c.rect(x, bestY, w, h);
      c.clip();
      c.translate(x, bestY);
      draw(c, w, h);
      c.restore();
      rect.u0 = x / ATLAS;
      rect.u1 = (x + w) / ATLAS;
      rect.v0 = 1 - (bestY + h) / ATLAS;
      rect.v1 = 1 - bestY / ATLAS;
    }
  };
  return { canvas, add, paint };
}

export function createSurfaces(parts) {
  const { random, range, mat, surface, mesh } = parts;

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
  /** The same drawing as a height map: bump maps are plain data, not colour. */
  function heights(w, h, draw) {
    const map = paint(w, h, draw);
    map.colorSpace = T.NoColorSpace;
    return map;
  }
  const speckle = (c, w, h, n, light = 0.05, dark = 0.06) => {
    for (let i = 0; i < n; i++) {
      c.fillStyle =
        random() > 0.5
          ? `rgba(255,244,220,${range(0.01, light)})`
          : `rgba(35,25,18,${range(0.01, dark)})`;
      c.fillRect(random() * w, random() * h, range(0.6, 2.2), range(0.6, 2.2));
    }
  };
  const shade = (hex, amount) => {
    const n = parseInt(hex.slice(1), 16),
      f = 1 + amount,
      ch = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
    return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
  };

  // ------------------------------------------------- the hall's geometric floor
  // Cream diamonds between terracotta and blue-black ones, each with a small
  // diamond of the other colour set in it: the Victorian hall floor.
  const FLOOR = { terracotta: "#a55a3a", black: "#2c2d30", cream: "#d9ccac" };
  const diamond = (c, x, y, r, fill, grout = "#54483a", width = 2.4) => {
    c.beginPath();
    c.moveTo(x, y - r);
    c.lineTo(x + r, y);
    c.lineTo(x, y + r);
    c.lineTo(x - r, y);
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    if (grout) {
      c.strokeStyle = grout;
      c.lineWidth = width;
      c.stroke();
    }
  };
  const floorPattern = (c, S, plain) => {
    const u = S / 4;
    c.fillStyle = plain ? "#555" : "#54483a";
    c.fillRect(0, 0, S, S);
    const tone = (hex) => (plain ? "#fff" : shade(hex, range(-0.09, 0.07)));
    for (let i = -1; i <= 4; i++)
      for (let j = -1; j <= 4; j++) diamond(c, (i + 0.5) * u, (j + 0.5) * u, u / 2, tone(FLOOR.cream), plain ? "#222" : undefined);
    for (let i = -1; i <= 4; i++)
      for (let j = -1; j <= 4; j++) {
        const dark = ((i + j) % 2 + 2) % 2 === 0;
        diamond(c, i * u, j * u, u / 2, tone(dark ? FLOOR.black : FLOOR.terracotta), plain ? "#222" : undefined);
        diamond(c, i * u, j * u, u / 5.2, tone(dark ? FLOOR.terracotta : FLOOR.black), plain ? "#222" : undefined, 1.6);
      }
  };
  const encausticMap = paint(1024, 1024, (c, S) => {
    floorPattern(c, S, false);
    speckle(c, S, S, 9000, 0.05, 0.07);
    // Long wear: paler scuffs across the middle of many tiles.
    for (let i = 0; i < 60; i++) {
      c.fillStyle = `rgba(240,226,196,${range(0.015, 0.05)})`;
      c.beginPath();
      c.ellipse(random() * S, random() * S, range(40, 150), range(14, 50), random() * 3, 0, TAU);
      c.fill();
    }
  });
  const encaustic = new T.MeshStandardMaterial({
    map: encausticMap,
    roughness: 0.34,
    bumpMap: heights(512, 512, (c, S) => floorPattern(c, S, true)),
    bumpScale: 0.45,
  });
  // The floor's border: a band of black with a dogtooth run in cream and red.
  const border = new T.MeshStandardMaterial({
    roughness: 0.36,
    map: paint(512, 128, (c, w, h) => {
      c.fillStyle = FLOOR.black;
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#54483a";
      c.fillRect(0, 6, w, 2);
      c.fillRect(0, h - 8, w, 2);
      c.fillStyle = FLOOR.cream;
      c.fillRect(0, 0, w, 6);
      c.fillRect(0, h - 6, w, 6);
      const n = 8,
        u = w / n;
      for (let i = 0; i < n; i++) {
        c.fillStyle = shade(i % 2 ? FLOOR.terracotta : FLOOR.cream, range(-0.08, 0.06));
        c.beginPath();
        c.moveTo(i * u, h - 18);
        c.lineTo((i + 0.5) * u, 18);
        c.lineTo((i + 1) * u, h - 18);
        c.closePath();
        c.fill();
      }
      speckle(c, w, h, 900, 0.05, 0.06);
    }),
  });

  // --------------------------------------------------------------- floorboards
  const plankPaint = (c, S) => {
    const tones = ["#7f5a38", "#744f30", "#8b6440", "#6d4a2d", "#7a5535"];
    const rows = 8,
      rh = S / rows;
    for (let row = 0; row < rows; row++) {
      let x = -range(0, 300);
      while (x < S) {
        const len = range(220, 460);
        c.fillStyle = tones[Math.floor(random() * tones.length)];
        c.fillRect(x, row * rh, len, rh);
        for (let i = 0; i < 12; i++) {
          c.strokeStyle = `rgba(35,20,10,${range(0.05, 0.15)})`;
          c.beginPath();
          const y = row * rh + range(5, rh - 5);
          c.moveTo(x, y);
          c.bezierCurveTo(x + len / 3, y + range(-4, 4), x + (2 * len) / 3, y + range(-4, 4), x + len, y);
          c.stroke();
        }
        c.fillStyle = "rgba(25,15,8,0.65)";
        c.fillRect(x, row * rh, 2.5, rh);
        // Two nail heads at each butt.
        c.fillStyle = "rgba(25,20,18,0.8)";
        c.fillRect(x + 7, row * rh + 11, 3, 3);
        c.fillRect(x + 7, row * rh + rh - 14, 3, 3);
        x += len;
      }
      c.fillStyle = "rgba(25,15,8,0.6)";
      c.fillRect(0, row * rh, S, 2.5);
    }
    speckle(c, S, S, 3000, 0.05, 0.08);
  };
  const plankMap = paint(512, 512, plankPaint);
  const planks = new T.MeshStandardMaterial({ map: plankMap, roughness: 0.62, bumpMap: plankMap, bumpScale: 0.25 });

  // --------------------------------------------------------- the glazed tile dado
  // Painted to the dado's height: a dark plinth, brick-bonded cream tiles, a
  // bottle-green band with a red line above it, and one more cream course.
  const COURSES = [
    { y: [0, 0.32], tile: "#2e4a3d", w: 0.4 },
    { y: [0.32, 0.53], tile: "#e6dcc0", w: 0.4 },
    { y: [0.53, 0.74], tile: "#e6dcc0", w: 0.4, offset: true },
    { y: [0.74, 0.95], tile: "#e6dcc0", w: 0.4 },
    { y: [0.95, 1.16], tile: "#e6dcc0", w: 0.4, offset: true },
    { y: [1.16, 1.26], tile: "#2e5a48", w: 0.2 },
    { y: [1.26, 1.31], tile: "#8f2c25", w: 0.2 },
    { y: [1.31, 1.45], tile: "#e6dcc0", w: 0.4, offset: true },
  ];
  const dadoPaint = (c, S, plain) => {
    const my = S / P.dado,
      mx = S / 1.6;
    c.fillStyle = plain ? "#333" : "#a79f8a";
    c.fillRect(0, 0, S, S);
    for (const { y, tile, w, offset } of COURSES) {
      const top = S - y[1] * my,
        h = (y[1] - y[0]) * my,
        tw = w * mx,
        start = offset ? -tw / 2 : 0;
      for (let x = start; x < S; x += tw) {
        if (plain) c.fillStyle = "#fff";
        else {
          const g = c.createLinearGradient(0, top, 0, top + h);
          g.addColorStop(0, shade(tile, range(0, 0.1)));
          g.addColorStop(1, shade(tile, range(-0.1, -0.02)));
          c.fillStyle = g;
        }
        c.fillRect(x + 1.5, top + 1.5, tw - 3, h - 3);
      }
    }
    if (!plain) speckle(c, S, S, 2600, 0.04, 0.05);
  };
  const dadoMap = paint(512, 512, (c, S) => dadoPaint(c, S, false));
  const dado = new T.MeshStandardMaterial({
    map: dadoMap,
    roughness: 0.2,
    bumpMap: heights(512, 512, (c, S) => dadoPaint(c, S, true)),
    bumpScale: 0.3,
  });

  // Matchboard for the back room's plainer dado, in the same green as the door.
  const matchboard = new T.MeshStandardMaterial({
    roughness: 0.55,
    map: paint(256, 256, (c, w, h) => {
      c.fillStyle = "#4b6a56";
      c.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 32) {
        c.fillStyle = "rgba(20,30,24,0.65)";
        c.fillRect(x, 0, 2.5, h);
        c.fillStyle = "rgba(240,250,240,0.1)";
        c.fillRect(x + 3, 0, 2, h);
      }
      speckle(c, w, h, 1500, 0.06, 0.07);
    }),
  });
  // Tongue-and-groove boards overhead, painted cream a long time ago.
  const ceilingBoards = new T.MeshStandardMaterial({
    roughness: 0.9,
    map: paint(512, 512, (c, S) => {
      c.fillStyle = "#e8dfc6";
      c.fillRect(0, 0, S, S);
      for (let i = 0; i < 8; i++) {
        c.fillStyle = shade("#e8dfc6", range(-0.05, 0.02));
        c.fillRect(0, i * 64, S, 64);
        c.fillStyle = "rgba(90,75,50,0.55)";
        c.fillRect(0, i * 64, S, 3);
        c.fillStyle = "rgba(255,250,235,0.5)";
        c.fillRect(0, i * 64 + 3, S, 2);
      }
      speckle(c, S, S, 2400, 0.05, 0.05);
    }),
  });
  // A stencilled frieze under the cornice: faded red lozenges and green sprigs.
  const frieze = new T.MeshStandardMaterial({
    roughness: 0.92,
    map: paint(512, 64, (c, w, h) => {
      c.fillStyle = "#e6dabc";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#8f3a2d";
      c.fillRect(0, 3, w, 3);
      c.fillRect(0, h - 6, w, 3);
      for (let i = 0; i < 4; i++) {
        const x = i * 128 + 64;
        c.globalAlpha = 0.85;
        diamond(c, x, h / 2, 17, "#8f3a2d", null);
        diamond(c, x, h / 2, 8, "#e6dabc", null);
        c.fillStyle = "#47664e";
        for (const side of [-1, 1]) {
          c.beginPath();
          c.ellipse(x + side * 42, h / 2 - 6, 15, 5, side * 0.5, 0, TAU);
          c.ellipse(x + side * 42, h / 2 + 6, 15, 5, -side * 0.5, 0, TAU);
          c.fill();
        }
        c.globalAlpha = 1;
      }
      speckle(c, w, h, 700, 0.05, 0.05);
    }),
  });
  const brick = new T.MeshStandardMaterial({
    roughness: 0.9,
    map: paint(256, 256, (c, S) => {
      c.fillStyle = "#6f675c";
      c.fillRect(0, 0, S, S);
      const tones = ["#8a5c4a", "#94664f", "#7d5240", "#9c6f58", "#724a3a"];
      const rows = 8,
        rh = S / rows;
      for (let r = 0; r < rows; r++)
        for (let x = r % 2 ? -32 : 0; x < S; x += 64) {
          c.fillStyle = tones[Math.floor(random() * 5)];
          c.fillRect(x + 1.5, r * rh + 1.5, 61, rh - 3);
        }
      speckle(c, S, S, 3200, 0.07, 0.11);
    }),
  });
  const wicker = new T.MeshStandardMaterial({
    roughness: 0.9,
    map: paint(256, 256, (c, S) => {
      c.fillStyle = "#6e5230";
      c.fillRect(0, 0, S, S);
      const n = 12,
        u = S / n;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          c.fillStyle = shade("#c09a5e", range(-0.16, 0.08));
          if ((i + j) % 2) c.fillRect(i * u + 1, j * u + 3, u - 2, u - 6);
          else c.fillRect(i * u + 3, j * u + 1, u - 6, u - 2);
        }
    }),
  });
  const cork = new T.MeshStandardMaterial({
    roughness: 0.98,
    map: paint(256, 256, (c, S) => {
      c.fillStyle = "#b08a5c";
      c.fillRect(0, 0, S, S);
      for (let i = 0; i < 2200; i++) {
        c.fillStyle = random() > 0.5 ? "rgba(90,60,30,0.34)" : "rgba(230,200,150,0.3)";
        c.fillRect(random() * S, random() * S, range(1, 4), range(1, 3));
      }
    }),
  });

  const twine = new T.MeshStandardMaterial({
    roughness: 0.96,
    map: paint(256, 256, (c, S) => {
      c.fillStyle = "#a8956c";
      c.fillRect(0, 0, S, S);
      for (const [turn, tone] of [[0.5, "#d9c79c"], [-0.65, "#cdb98c"], [1.25, "#e1d0a8"]]) {
        c.save();
        c.translate(S / 2, S / 2);
        c.rotate(turn);
        for (let y = -S; y < S; y += 7) {
          c.strokeStyle = tone;
          c.lineWidth = 3.5;
          c.beginPath();
          c.moveTo(-S, y);
          c.bezierCurveTo(-S / 3, y + range(-5, 5), S / 3, y + range(-5, 5), S, y);
          c.stroke();
        }
        c.restore();
      }
    }),
  });

  // -------------------------------------------------------------------- colours
  const glaze = (color, roughness = 0.2) => mat(color, roughness);
  const paperMap = surface("plaster", "#ffffff");
  const brown = (color, roughness = 0.92) =>
    new T.MeshStandardMaterial({ map: paperMap, color, roughness });
  const mahoganyMap = surface("wood", "#5c2b1d");
  const M = {
    encaustic,
    border,
    planks,
    dado,
    matchboard,
    ceilingBoards,
    frieze,
    brick,
    wicker,
    cork,
    plaster: new T.MeshStandardMaterial({
      map: surface("plaster", "#e7dabb"),
      roughness: 0.94,
    }),
    whitewash: new T.MeshStandardMaterial({
      map: surface("plaster", "#cfc6ad"),
      roughness: 0.95,
    }),
    mahogany: new T.MeshStandardMaterial({
      map: mahoganyMap,
      roughness: 0.44,
      bumpMap: mahoganyMap,
      bumpScale: 0.06,
    }),
    mahoganyDark: new T.MeshStandardMaterial({ map: mahoganyMap, color: "#8d7b72", roughness: 0.5 }),
    pine: new T.MeshStandardMaterial({ map: surface("wood", "#b78e5d"), roughness: 0.72 }),
    beam: new T.MeshStandardMaterial({ map: surface("wood", "#4b3322"), roughness: 0.8 }),
    trim: mat("#efe6cf", 0.55),
    doorGreen: mat("#4f6b56", 0.42),
    capTile: glaze("#2e4a3d", 0.22),
    brass: mat("#cda464", 0.3, 0.75),
    brassDull: mat("#a88a58", 0.45, 0.6),
    iron: mat("#2c2d2f", 0.55, 0.45),
    ironLight: mat("#54575a", 0.5, 0.5),
    post: mat("#b3392f", 0.36),
    oxblood: mat("#7a2620", 0.5),
    black: mat("#1d1c1b", 0.5),
    holeBack: mat("#2a2019", 0.9),
    paperWhite: mat("#f1ebd9", 0.9),
    paperBuff: mat("#d8c79f", 0.9),
    paperBlue: mat("#a9bfce", 0.9),
    paperRose: mat("#e4c5ba", 0.9),
    string: mat("#d7c59c", 0.95),
    twine,
    parcels: [brown("#b58f60"), brown("#a57f52"), brown("#c29d6f")],
    canvas: brown("#b8a67e", 0.97),
    canvasDark: brown("#8e7e5d", 0.97),
    leather: mat("#5d6a48", 0.62),
    leatherDark: mat("#46523a", 0.68),
    tweed: brown("#8c7a62", 0.96),
    wool: brown("#8e8f8d", 0.97),
    wax: mat("#a12e27", 0.34),
    geranium: mat("#d24b4a", 0.8),
    leaf: mat("#4f7a4a", 0.8),
    leafDark: mat("#38613f", 0.8),
    terracotta: mat("#ac694c", 0.82),
    soil: mat("#3f3427", 1),
    pewter: mat("#7c8084", 0.42, 0.62),
    china: mat("#e7ecdf", 0.2),
    tea: mat("#5e3a22", 0.25),
    jacket: brown("#46617a", 0.92),
    rubber: mat("#2a2a2a", 0.85),
    crust: mat("#c38136", 0.82),
    crumb: mat("#eedcb5", 0.95),
  };
  M.leaf.side = T.DoubleSide;
  M.leafDark.side = T.DoubleSide;

  // Things that glow, whose light changes with the hour.
  M.bulb = new T.MeshStandardMaterial({ color: "#fff2cf", emissive: "#ffcf86", emissiveIntensity: 0.5, roughness: 0.4 });
  M.shade = mat("#2f5a47", 0.3, 0.15);
  M.shadeUnder = new T.MeshStandardMaterial({ color: "#f6ecd2", emissive: "#ffcf86", emissiveIntensity: 0.12, roughness: 0.6, side: T.BackSide });
  M.fireGlow = new T.MeshStandardMaterial({ color: "#2a1508", emissive: "#ff7a26", emissiveIntensity: 1.8, roughness: 0.9 });
  M.dial = new T.MeshStandardMaterial({ color: "#d9b878", emissive: "#ffb65c", emissiveIntensity: 0.15, roughness: 0.5 });
  M.boardLamp = new T.MeshStandardMaterial({ color: "#7c3a26", emissive: "#ff9a4d", emissiveIntensity: 0.25, roughness: 0.4 });
  M.glass = new T.MeshPhysicalMaterial({ color: "#dfeeee", roughness: 0.06, transparent: true, opacity: 0.05, depthWrite: false });
  M.jarGlass = new T.MeshPhysicalMaterial({ color: "#eef5ee", roughness: 0.08, transparent: true, opacity: 0.22, depthWrite: false, side: T.DoubleSide });

  // --------------------------------------------------------------- the lettered
  const { canvas: atlasCanvas, add, paint: paintAtlas } = createAtlas();
  const textAt = (c, text, x, y, font, fill, align = "center") => {
    c.font = font;
    c.fillStyle = fill;
    c.textAlign = align;
    c.textBaseline = "middle";
    c.fillText(text, x, y);
  };
  const paperSheet = (c, w, h, colour) => {
    c.fillStyle = colour;
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < w * h * 0.004; i++) {
      c.fillStyle = random() > 0.5 ? "rgba(255,255,240,0.06)" : "rgba(70,50,30,0.05)";
      c.fillRect(random() * w, random() * h, range(0.5, 2.5), range(0.5, 2.5));
    }
  };
  const enamel = (w, h, draw, field = "#23457a", line = "#f4f0e4") =>
    add(w, h, (c) => {
      c.fillStyle = field;
      c.fillRect(0, 0, w, h);
      c.strokeStyle = line;
      c.lineWidth = Math.max(3, h * 0.03);
      c.strokeRect(h * 0.05, h * 0.05, w - h * 0.1, h - h * 0.1);
      draw(c, w, h);
      // A little chipping at the corners.
      c.fillStyle = "rgba(30,30,35,0.75)";
      for (const [x, y] of [[4, 4], [w - 12, 5], [6, h - 11], [w - 10, h - 9]]) c.fillRect(x, y, range(4, 8), range(3, 6));
    });

  const A = {};
  // One long strip of labels per row of the sorting frame.
  A.pigeonLabels = SIGNS.pigeonholes.map((row) =>
    add(1500, 36, (c, w, h) => {
      c.fillStyle = "#e9dfc3";
      c.fillRect(0, 0, w, h);
      const cell = w / row.length;
      row.forEach((word, i) => {
        c.fillStyle = "#5a4630";
        c.fillRect(i * cell - 1, 0, 2, h);
        textAt(c, word, (i + 0.5) * cell, h / 2 + 1, `17px ${SERIF}`, "#2d2219");
      });
    }),
  );
  // The map is too large to share: it has its own sheet.
  M.map = new T.MeshStandardMaterial({
    map: paint(
      1040,
      860,
      (c, w, h) => {
        const here = paintDistrictMap(c, w, h);
        A.mapHere = { u: here.x / w, v: here.z / h };
      },
      false,
    ),
    roughness: 0.78,
  });
  // The stamps: a framed sheet of the Willowmere series.
  const drawStamp = (c, s, x, y, w, h) => {
    c.fillStyle = "#f4efe0";
    c.fillRect(x, y, w, h);
    c.fillStyle = "#c8b98f";
    const teeth = 12;
    for (let i = 0; i <= teeth; i++) {
      for (const [px, py] of [[x + (i / teeth) * w, y], [x + (i / teeth) * w, y + h], [x, y + (i / teeth) * h], [x + w, y + (i / teeth) * h]]) {
        c.beginPath();
        c.arc(px, py, w * 0.018, 0, TAU);
        c.fill();
      }
    }
    const ix = x + w * 0.08,
      iy = y + h * 0.08,
      iw = w * 0.84,
      ih = h * 0.84;
    c.fillStyle = s.colour;
    c.fillRect(ix, iy, iw, ih);
    c.fillStyle = "#f4efe0";
    c.strokeStyle = "#f4efe0";
    c.lineWidth = w * 0.02;
    c.lineCap = "round";
    const cx = ix + iw / 2,
      cy = iy + ih * 0.46,
      r = iw * 0.28;
    c.beginPath();
    if (s.kind === "heron") {
      c.ellipse(cx - r * 0.1, cy + r * 0.2, r * 0.6, r * 0.28, -0.3, 0, TAU);
      c.fill();
      c.beginPath();
      c.moveTo(cx + r * 0.3, cy);
      c.bezierCurveTo(cx + r, cy - r * 0.2, cx + r * 0.2, cy - r * 0.5, cx + r * 0.5, cy - r * 0.9);
      c.lineTo(cx + r * 1.05, cy - r * 0.78);
      c.moveTo(cx - r * 0.1, cy + r * 0.4);
      c.lineTo(cx - r * 0.1, cy + r * 1.05);
      c.stroke();
    } else if (s.kind === "apple") {
      c.arc(cx, cy + r * 0.1, r * 0.7, 0, TAU);
      c.fill();
      c.beginPath();
      c.moveTo(cx, cy - r * 0.55);
      c.lineTo(cx + r * 0.2, cy - r * 1);
      c.stroke();
      c.beginPath();
      c.ellipse(cx + r * 0.45, cy - r * 0.8, r * 0.28, r * 0.12, -0.5, 0, TAU);
      c.fill();
    } else if (s.kind === "mill") {
      c.arc(cx, cy, r * 0.8, 0, TAU);
      c.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        c.moveTo(cx, cy);
        c.lineTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8);
      }
      c.stroke();
    } else if (s.kind === "loaf") {
      c.ellipse(cx, cy + r * 0.1, r, r * 0.55, 0, 0, TAU);
      c.fill();
      c.strokeStyle = s.colour;
      for (const dx of [-0.45, 0, 0.45]) {
        c.moveTo(cx + r * dx - r * 0.1, cy - r * 0.25);
        c.lineTo(cx + r * dx + r * 0.15, cy + r * 0.25);
      }
      c.stroke();
    } else if (s.kind === "bee") {
      c.ellipse(cx, cy + r * 0.1, r * 0.8, r * 0.5, 0, 0, TAU);
      c.fill();
      c.beginPath();
      c.strokeStyle = s.colour;
      c.lineWidth = w * 0.035;
      for (const dx of [-0.3, 0.05, 0.4]) {
        c.moveTo(cx + r * dx, cy - r * 0.3);
        c.lineTo(cx + r * dx, cy + r * 0.5);
      }
      c.stroke();
      c.beginPath();
      c.fillStyle = "#f4efe0";
      c.ellipse(cx - r * 0.2, cy - r * 0.55, r * 0.35, r * 0.2, -0.5, 0, TAU);
      c.ellipse(cx + r * 0.3, cy - r * 0.55, r * 0.35, r * 0.2, 0.5, 0, TAU);
      c.fill();
    } else {
      c.ellipse(cx - r * 0.1, cy + r * 0.2, r * 0.75, r * 0.45, -0.2, 0, TAU);
      c.fill();
      c.beginPath();
      c.arc(cx + r * 0.6, cy - r * 0.3, r * 0.28, 0, TAU);
      c.fill();
      c.beginPath();
      c.moveTo(cx + r * 0.85, cy - r * 0.3);
      c.lineTo(cx + r * 1.15, cy - r * 0.2);
      c.stroke();
    }
    textAt(c, "WILLOWMERE", cx, iy + ih * 0.08, `bold ${w * 0.075}px ${SERIF}`, "#f4efe0");
    textAt(c, s.name, ix + iw * 0.36, iy + ih * 0.91, `${w * 0.07}px ${SERIF}`, "#f4efe0");
    textAt(c, s.value, ix + iw * 0.84, iy + ih * 0.89, `bold ${w * 0.115}px ${SERIF}`, "#f4efe0");
  };
  A.stampSheet = add(520, 700, (c, w, h) => {
    paperSheet(c, w, h, "#eee5cd");
    textAt(c, "THE WILLOWMERE SERIES", w / 2, 46, `bold 32px ${SERIF}`, "#3b2b1e");
    textAt(c, "Engraved at the Post Office. Do mind the wet.", w / 2, 84, `italic 20px ${SERIF}`, "#6a5540");
    SIGNS.stamps.forEach((s, i) =>
      drawStamp(c, s, 42 + (i % 2) * 230, 118 + Math.floor(i / 2) * 192, 205, 172),
    );
  });
  // The strips of stamps in the counter's open drawer.
  A.stampStrip = add(420, 100, (c, w, h) => {
    paperSheet(c, w, h, "#e9e0c6");
    for (let i = 0; i < 6; i++) drawStamp(c, SIGNS.stamps[i], 8 + i * 69, 10, 62, 80);
  });
  // Notices for the board, each its own colour of paper.
  A.notices = SIGNS.notices.map((n) =>
    add(280, 330, (c, w, h) => {
      paperSheet(c, w, h, n.paper);
      textAt(c, n.heading, w / 2, 46, `bold 28px ${SERIF}`, "#2d2219");
      c.fillStyle = "#2d2219";
      c.fillRect(30, 72, w - 60, 2);
      n.body.forEach((line, i) => textAt(c, line, w / 2, 110 + i * 38, `25px ${SERIF}`, "#3c2e22"));
      if (n.pencil) {
        c.save();
        c.translate(w * 0.62, h - 42);
        c.rotate(-0.08);
        textAt(c, n.pencil, 0, 0, `italic 29px ${SERIF}`, "#5a5a68");
        c.restore();
      }
    }),
  );
  // The picture postcards, hand-tinted.
  const postcardScene = (c, card, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h * 0.7);
    g.addColorStop(0, shade(card.sky, -0.12));
    g.addColorStop(1, shade(card.sky, 0.14));
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.fillStyle = card.ground;
    if (card.kind === "pond") {
      c.fillStyle = "#6f8f7a";
      c.fillRect(0, h * 0.42, w, h * 0.16);
      c.fillStyle = card.ground;
      c.fillRect(0, h * 0.55, w, h);
      c.fillStyle = "#f4ecdf";
      for (let i = 0; i < 5; i++) {
        c.beginPath();
        c.ellipse(30 + i * 40, h * (0.66 + (i % 2) * 0.09), 11, 5, 0, 0, TAU);
        c.fill();
      }
    } else if (card.kind === "hill") {
      c.beginPath();
      c.ellipse(w * 0.5, h * 1.05, w * 0.75, h * 0.72, 0, 0, TAU);
      c.fill();
      for (let i = 0; i < 16; i++) {
        c.fillStyle = i % 2 ? "#f3d9de" : "#e8e3cd";
        c.beginPath();
        c.arc(range(10, w - 10), range(h * 0.48, h * 0.85), 7, 0, TAU);
        c.fill();
      }
      c.fillStyle = "#6b4a33";
      c.fillRect(w * 0.5, h * 0.2, 12, 26);
    } else if (card.kind === "wood") {
      c.fillRect(0, h * 0.62, w, h);
      for (let i = 0; i < 7; i++) {
        c.fillStyle = "#5b4633";
        c.fillRect(14 + i * 30, h * 0.1, 7 + (i % 3) * 3, h * 0.6);
        c.fillStyle = "#6f8f55";
        c.beginPath();
        c.arc(18 + i * 30, h * 0.14, 30, 0, TAU);
        c.fill();
      }
    } else if (card.kind === "market") {
      c.fillRect(0, h * 0.55, w, h);
      const awning = ["#6f9a5a", "#c46a4a", "#5f7fa3"];
      awning.forEach((col, i) => {
        for (let s = 0; s < 6; s++) {
          c.fillStyle = s % 2 ? "#f2ead5" : col;
          c.fillRect(16 + i * 66 + s * 9, h * 0.32, 9, 16);
        }
        c.fillStyle = "#7f6145";
        c.fillRect(18 + i * 66, h * 0.42, 50, 22);
      });
    } else if (card.kind === "mere") {
      c.fillRect(0, h * 0.5, w, h);
      c.fillStyle = "rgba(255,255,255,0.45)";
      c.fillRect(0, h * 0.4, w, h * 0.2);
      c.fillStyle = "#6a7a60";
      for (let i = 0; i < 40; i++) c.fillRect(random() * w, h * 0.75 + random() * h * 0.25, 2, -range(8, 22));
    } else {
      textAt(c, "Greetings", w / 2, h * 0.34, `italic bold 36px ${SERIF}`, "#a4322b");
      textAt(c, "from Willowmere", w / 2, h * 0.62, `italic 27px ${SERIF}`, "#3f6a4a");
      return;
    }
    textAt(c, card.caption, w / 2, h - 16, `italic 18px ${SERIF}`, "#fff8e8");
  };
  A.postcards = SIGNS.postcards.map((card) =>
    add(220, 150, (c, w, h) => {
      c.fillStyle = "#f6f0dd";
      c.fillRect(0, 0, w, h);
      c.save();
      c.beginPath();
      c.rect(6, 6, w - 12, h - 12);
      c.clip();
      c.translate(6, 6);
      postcardScene(c, card, w - 12, h - 12);
      c.restore();
    }),
  );
  // Enamel signs.
  A.telephoneSign = enamel(440, 300, (c, w, h) => {
    textAt(c, "YOU MAY", w / 2, h * 0.24, `bold 54px ${SERIF}`, "#f4f0e4");
    textAt(c, "TELEPHONE", w / 2, h * 0.5, `bold 60px ${SERIF}`, "#f4f0e4");
    textAt(c, "FROM HERE", w / 2, h * 0.76, `bold 54px ${SERIF}`, "#f4f0e4");
  });
  A.lettersSign = enamel(300, 100, (c, w, h) => textAt(c, "LETTERS", w / 2, h / 2 + 2, `bold 54px ${SERIF}`, "#f4f0e4"), "#b3392f");
  A.privateSign = enamel(300, 110, (c, w, h) => textAt(c, "PRIVATE", w / 2, h / 2 + 2, `bold 54px ${SERIF}`, "#26292e"), "#efe6cf", "#26292e");
  A.parcelsSign = enamel(460, 110, (c, w, h) => textAt(c, "PARCELS TO BE CALLED FOR", w / 2, h / 2 + 2, `bold 32px ${SERIF}`, "#f4f0e4"), "#3b5a48");
  A.savingsPoster = add(320, 450, (c, w, h) => {
    paperSheet(c, w, h, "#e9dcb8");
    c.fillStyle = "#b3392f";
    c.fillRect(0, 0, w, 96);
    textAt(c, "POST EARLY", w / 2, 50, `bold 40px ${SERIF}`, "#f4efe0");
    c.fillStyle = "#b3392f";
    c.beginPath();
    c.arc(w / 2, 180, 44, Math.PI, 0);
    c.lineTo(w / 2 + 44, 320);
    c.lineTo(w / 2 - 44, 320);
    c.fill();
    c.fillStyle = "#2a2019";
    c.fillRect(w / 2 - 28, 192, 56, 7);
    c.fillStyle = "#2a2019";
    c.fillRect(w / 2 - 50, 320, 100, 10);
    textAt(c, "and often.", w / 2, 368, `italic 34px ${SERIF}`, "#3b2b1e");
    textAt(c, "Someone is waiting to hear.", w / 2, 410, `20px ${SERIF}`, "#6a5540");
  });
  A.clockFace = add(256, 256, (c, S) => {
    c.fillStyle = "#f3ecd8";
    c.fillRect(0, 0, S, S);
    c.strokeStyle = "#2b2520";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(S / 2, S / 2, S * 0.47, 0, TAU);
    c.stroke();
    c.lineWidth = 1;
    c.beginPath();
    c.arc(S / 2, S / 2, S * 0.34, 0, TAU);
    c.stroke();
    const roman = ["XII", "I", "II", "III", "IIII", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
    roman.forEach((numeral, i) => {
      const a = (i / 12) * TAU;
      c.save();
      c.translate(S / 2 + Math.sin(a) * S * 0.405, S / 2 - Math.cos(a) * S * 0.405);
      c.rotate(a);
      textAt(c, numeral, 0, 0, `bold 24px ${SERIF}`, "#2b2520");
      c.restore();
    });
    textAt(c, "G. P. O.", S / 2, S * 0.66, `italic 16px ${SERIF}`, "#5a4a3a");
  });
  A.scaleDial = add(240, 240, (c, S) => {
    c.fillStyle = "#efe7d0";
    c.fillRect(0, 0, S, S);
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * TAU;
      c.strokeStyle = "#2b2520";
      c.lineWidth = i % 5 ? 1 : 3;
      c.beginPath();
      c.moveTo(S / 2 + Math.sin(a) * S * (i % 5 ? 0.42 : 0.39), S / 2 - Math.cos(a) * S * (i % 5 ? 0.42 : 0.39));
      c.lineTo(S / 2 + Math.sin(a) * S * 0.46, S / 2 - Math.cos(a) * S * 0.46);
      c.stroke();
    }
    textAt(c, "YOUR WEIGHT", S / 2, S * 0.36, `bold 19px ${SERIF}`, "#a4322b");
    textAt(c, "& FORTUNE", S / 2, S * 0.64, `bold 19px ${SERIF}`, "#a4322b");
  });
  A.scaleSign = enamel(300, 90, (c, w, h) => textAt(c, "ONE PETAL", w / 2, h / 2 + 2, `bold 44px ${SERIF}`, "#f4f0e4"), "#b3392f");
  A.bays = SIGNS.bays.map((text) =>
    add(760, 80, (c, w, h) => {
      c.fillStyle = "#22130d";
      c.fillRect(0, 0, w, h);
      c.strokeStyle = "#b08a4c";
      c.lineWidth = 2;
      c.strokeRect(6, 6, w - 12, h - 12);
      textAt(c, text, w / 2, h / 2 + 2, `bold 37px ${SERIF}`, "#d9b86c");
    }),
  );
  A.card = add(320, 210, (c, w, h) => {
    paperSheet(c, w, h, "#f3ecd7");
    c.strokeStyle = "#a4322b";
    c.lineWidth = 4;
    c.strokeRect(10, 10, w - 20, h - 20);
    const [a, b, by] = SIGNS.card;
    textAt(c, a, w / 2, 58, `bold 42px ${SERIF}`, "#2d2219");
    textAt(c, b, w / 2, 110, `bold 42px ${SERIF}`, "#2d2219");
    textAt(c, by, w * 0.68, 165, `italic 34px ${SERIF}`, "#34405e");
  });
  A.windowCard = add(260, 170, (c, w, h) => {
    paperSheet(c, w, h, "#f0e7cf");
    SIGNS.windowCard.forEach((line, i) => textAt(c, line, w / 2, 60 + i * 52, `italic 40px ${SERIF}`, "#2d2219"));
  });
  A.tariff = add(300, 400, (c, w, h) => {
    paperSheet(c, w, h, "#ede3c7");
    textAt(c, "INLAND TARIFF", w / 2, 40, `bold 28px ${SERIF}`, "#2d2219");
    const rows = [["Letters", "1d"], ["Postcards", "½d"], ["Parcels, 1 lb", "6d"], ["Parcels, 3 lb", "9d"], ["Telegrams, 9 w.", "6d"], ["A good story", "free"], ["Pressed flowers", "free"]];
    rows.forEach(([what, cost], i) => {
      textAt(c, what, 26, 92 + i * 42, `23px ${SERIF}`, "#3c2e22", "left");
      textAt(c, cost, w - 26, 92 + i * 42, `bold 23px ${SERIF}`, "#3c2e22", "right");
    });
  });
  A.ledger = add(360, 240, (c, w, h) => {
    paperSheet(c, w, h, "#eee6cf");
    c.fillStyle = "rgba(40,40,60,0.16)";
    for (let y = 18; y < h; y += 18) c.fillRect(8, y, w - 16, 1);
    c.fillStyle = "rgba(160,40,30,0.5)";
    c.fillRect(w * 0.22, 0, 1.5, h);
    c.fillRect(w * 0.78, 0, 1.5, h);
    c.fillStyle = "rgba(70,40,30,0.3)";
    c.fillRect(w / 2 - 2, 0, 4, h);
    for (let i = 0; i < 12; i++) textAt(c, ["Rosewood", "The Mill", "Hazel", "Tamsin", "Finn", "Mabel"][i % 6], w * 0.26, 16 + i * 18, `italic 15px ${SERIF}`, "#34405e", "left");
  });
  A.envelopes = [
    ["Mrs Hazel", "The Copper Kettle", "Market Lane"],
    ["Finn", "The Daily Loaf", "Cottage Lane"],
    ["Wren", "the reeds", "(try the hide)"],
    ["To the Occupier", "Rosewood", "Willowmere"],
  ].map((lines, k) =>
    add(190, 120, (c, w, h) => {
      paperSheet(c, w, h, ["#efe7d3", "#d8c79f", "#c5d2d9", "#e8cfc4"][k]);
      lines.forEach((line, i) => textAt(c, line, 18, 46 + i * 24, `italic 19px ${SERIF}`, "#2f3550", "left"));
      c.fillStyle = SIGNS.stamps[k].colour;
      c.fillRect(w - 42, 8, 32, 40);
    }),
  );
  A.parcelLabels = [
    ["Hazel", "Cake Tins (More)"],
    ["Basil", "Not Near Marrows"],
    ["Wren", "Binoculars, Quiet"],
    ["The Windmill", "To the Occupier"],
    ["Finn", "Moon Flour"],
    ["Mabel", "Bulbs. This Way Up"],
  ].map(([who, what]) =>
    add(170, 100, (c, w, h) => {
      paperSheet(c, w, h, "#eee3c2");
      c.strokeStyle = "#8a2d24";
      c.lineWidth = 2;
      c.strokeRect(5, 5, w - 10, h - 10);
      textAt(c, who, w / 2, 36, `bold 26px ${SERIF}`, "#2d2219");
      textAt(c, what, w / 2, 70, `italic 18px ${SERIF}`, "#3c2e22");
    }),
  );
  A.drawerLabels = ["Stamps", "Forms", "Nibs", "String", "Wax", "Twine", "Keys", "Seals"].map((word) =>
    add(90, 34, (c, w, h) => {
      paperSheet(c, w, h, "#eee3c2");
      textAt(c, word, w / 2, h / 2 + 1, `italic 19px ${SERIF}`, "#2d2219");
    }),
  );
  A.switchPanel = add(520, 360, (c, w, h) => {
    c.fillStyle = "#1f1c19";
    c.fillRect(0, 0, w, h);
    const lines = ["The Mill", "Bakery", "Rosewood", "Mabel", "The Kettle", "The Heron", "The Hide", "Shed", "Doctor"];
    lines.forEach((name, i) => {
      const x = 34 + (i % 3) * 165,
        y = 44 + Math.floor(i / 3) * 110;
      c.fillStyle = "#c9a35c";
      c.beginPath();
      c.arc(x + 20, y + 24, 15, 0, TAU);
      c.fill();
      c.fillStyle = "#0f0d0c";
      c.beginPath();
      c.arc(x + 20, y + 24, 7, 0, TAU);
      c.fill();
      c.fillStyle = "#e9dfc3";
      c.fillRect(x - 2, y - 26, 124, 26);
      textAt(c, `${i + 1}  ${name}`, x + 4, y - 12, `17px ${SERIF}`, "#2d2219", "left");
    });
  });
  M.sackStencils = ["WILLOWMERE", "COAST"].map(
    (word) =>
      new T.MeshStandardMaterial({
        transparent: true,
        depthWrite: false,
        roughness: 0.95,
        map: paint(
          320,
          150,
          (c, w) => {
            c.globalAlpha = 0.82;
            textAt(c, "G · P · O", w / 2, 42, `bold 36px ${SERIF}`, "#2f281f");
            textAt(c, word, w / 2, 102, `bold ${word.length > 6 ? 44 : 56}px ${SERIF}`, "#2f281f");
          },
          false,
        ),
      }),
  );
  A.doormat = add(420, 210, (c, w, h) => {
    c.fillStyle = "#8f7447";
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      c.fillStyle = random() > 0.5 ? "rgba(70,50,25,0.3)" : "rgba(210,180,120,0.25)";
      c.fillRect(random() * w, random() * h, 1, range(2, 5));
    }
    c.strokeStyle = "#3f2f1c";
    c.lineWidth = 9;
    c.strokeRect(7, 7, w - 14, h - 14);
    textAt(c, "WIPE YOUR FEET", w / 2, h / 2, `bold 40px ${SERIF}`, "#3f2f1c");
  });
  A.rug = add(520, 300, (c, w, h) => {
    const stripes = ["#8f3a2d", "#d8c79f", "#35607f", "#b98a4e", "#4f6b56", "#d8c79f"];
    for (let y = 0; y < h; y += 15) {
      c.fillStyle = shade(stripes[Math.floor(y / 15) % 6], range(-0.14, 0.08));
      c.fillRect(0, y, w, 15);
      for (let i = 0; i < 70; i++) {
        c.fillStyle = "rgba(25,18,12,0.2)";
        c.fillRect(random() * w, y + random() * 15, range(2, 8), 1.6);
      }
    }
  });
  A.photos = ["#a58b6c", "#8d7a66"].map((tone, k) =>
    add(100, 130, (c, w, h) => {
      c.fillStyle = "#e8dcbd";
      c.fillRect(0, 0, w, h);
      c.fillStyle = tone;
      c.fillRect(9, 9, w - 18, h - 18);
      c.fillStyle = "#4a3a2c";
      c.beginPath();
      c.arc(w / 2, h * 0.38, 15, 0, TAU);
      c.fill();
      c.beginPath();
      c.ellipse(w / 2, h * 0.78, k ? 21 : 26, 28, 0, 0, TAU);
      c.fill();
    }),
  );
  A.tin = ["TEA", "NIBS", "PINS", "WAX"].map((word, k) =>
    add(120, 70, (c, w, h) => {
      c.fillStyle = ["#4f6b56", "#8f3a2d", "#35607f", "#b98a4e"][k];
      c.fillRect(0, 0, w, h);
      c.strokeStyle = "#e9dfc3";
      c.lineWidth = 2;
      c.strokeRect(5, 5, w - 10, h - 10);
      textAt(c, word, w / 2, h / 2 + 2, `bold 30px ${SERIF}`, "#e9dfc3");
    }),
  );
  A.ledgerSpines = add(256, 64, (c, w, h) => {
    const colours = ["#6e3524", "#2d4a3a", "#2e3f5a", "#4b3322", "#74562a", "#54222a", "#2c2d2f", "#5a5a42"];
    let x = 0;
    while (x < w) {
      const bw = range(14, 28);
      c.fillStyle = colours[Math.floor(random() * colours.length)];
      c.fillRect(x, 0, bw, h);
      c.fillStyle = "rgba(220,190,120,0.75)";
      c.fillRect(x + 2, 11, bw - 4, 2);
      c.fillRect(x + 2, h - 14, bw - 4, 2);
      x += bw;
    }
  });
  A.jarLabels = ["Humbugs", "Pear Drops", "Sherbet Lemons", "Aniseed Balls", "Barley Sugar"].map((word) =>
    add(160, 70, (c, w, h) => {
      paperSheet(c, w, h, "#f0e7cc");
      c.strokeStyle = "#8a2d24";
      c.lineWidth = 2;
      c.strokeRect(4, 4, w - 8, h - 8);
      const parts = word.split(" ");
      parts.forEach((part, i) => textAt(c, part, w / 2, h / 2 + (i - (parts.length - 1) / 2) * 24, `italic 22px ${SERIF}`, "#2d2219"));
    }),
  );
  const boxFace = (c, x, y, cw, ch, number) => {
    c.fillStyle = "rgba(20,16,12,0.9)";
    c.fillRect(x + cw * 0.28, y + ch * 0.16, cw * 0.44, ch * 0.24);
    textAt(c, String(number), x + cw / 2, y + ch * 0.58, `bold ${ch * 0.2}px ${SERIF}`, "#2a1a0c");
    c.fillStyle = "#17120d";
    c.beginPath();
    c.arc(x + cw / 2, y + ch * 0.8, ch * 0.035, 0, TAU);
    c.fill();
    c.fillRect(x + cw / 2 - ch * 0.012, y + ch * 0.8, ch * 0.024, ch * 0.06);
  };

  M.brassFlat = mat("#c9a35c", 0.34, 0.7);
  A.myBox = add(128, 128, (c, w, h) => {
    c.fillStyle = "#c9a35c";
    c.fillRect(0, 0, w, h);
    boxFace(c, 0, 0, w, h, MY_BOX);
  });
  paintAtlas();
  const atlasMap = new T.CanvasTexture(atlasCanvas);
  atlasMap.colorSpace = T.SRGBColorSpace;
  atlasMap.anisotropy = 8;
  const atlas = new T.MeshStandardMaterial({ map: atlasMap, roughness: 0.74 });
  M.atlas = atlas;

  /** A piece of the atlas on a plane, facing +z until turned. */
  function decal(rect, x, y, z, w, h, turn = 0, p, tilt = 0, roll = 0) {
    const g = new T.PlaneGeometry(w, h),
      { uv } = g.attributes;
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, rect.u0 + uv.getX(i) * (rect.u1 - rect.u0), rect.v0 + uv.getY(i) * (rect.v1 - rect.v0));
    const o = mesh(g, atlas, x, y, z, p ?? parts.root);
    o.rotation.set(tilt, turn, roll, "YXZ");
    o.castShadow = false;
    return o;
  }

  /** A round piece of the atlas: a clock's or a dial's face. */
  function disc(rect, x, y, z, radius, p) {
    const g = new T.CircleGeometry(radius, 40),
      { uv } = g.attributes;
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, rect.u0 + uv.getX(i) * (rect.u1 - rect.u0), rect.v0 + uv.getY(i) * (rect.v1 - rect.v0));
    const o = mesh(g, atlas, x, y, z, p ?? parts.root);
    o.castShadow = false;
    return o;
  }

  // Lettering on glass and brass needs clear paper of its own.
  function clearDecal(pxW, pxH, draw, x, y, z, w, h, turn = 0, p) {
    const map = paint(pxW, pxH, draw, false),
      material = new T.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: 0.35, metalness: 0.3 });
    const o = mesh(new T.PlaneGeometry(w, h), material, x, y, z, p ?? parts.root);
    o.rotation.y = turn;
    o.castShadow = o.receiveShadow = false;
    return o;
  }
  // Gold leaf, mirrored because the room sees it from behind.
  const goldLeaf = (c, w, h, lines) => {
    c.save();
    c.translate(w, 0);
    c.scale(-1, 1);
    for (const [text, y, size] of lines) {
      c.font = `bold ${size}px ${SERIF}`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillStyle = "#3a2410";
      c.fillText(text, w / 2 + 3, y + 3);
      c.fillStyle = "#d9b45a";
      c.fillText(text, w / 2, y);
    }
    c.restore();
  };
  // The numbers, windows and keyholes of the wall of boxes, all but your own.
  const boxFaces = (c, w, h) => {
    const { cols, rows, mine } = P.boxes,
      cw = w / cols,
      ch = h / rows;
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++) {
        if (col === mine.col && row === mine.row) continue;
        boxFace(c, col * cw, row * ch, cw, ch, boxNumber(col, row));
      }
  };

  return { M, A, decal, disc, clearDecal, goldLeaf, boxFaces, paint, shade };
}
