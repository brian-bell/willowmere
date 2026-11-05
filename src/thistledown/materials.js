import * as T from "three";
import { createRoomKit } from "../interior-kit.js";

// Thistledown's wallpapers, floors, fabrics and woods, and the shared sheet that
// holds every small picture and label. Everything is painted in code. Wall and
// floor textures repeat by the metre (see `slab` in parts.js).

const paintTexture = (w, h, draw, repeat = true) => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext("2d"), w, h);
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  if (repeat) map.wrapS = map.wrapT = T.RepeatWrapping;
  map.anisotropy = 8;
  return map;
};

export function createMaterials() {
  const { random, range, mat, surface } = createRoomKit(new T.Group(), 7741);
  const std = (map, roughness = 0.9, extra = {}) => new T.MeshStandardMaterial({ map, roughness, ...extra });
  const speckle = (c, w, h, n, light = 0.05, dark = 0.05) => {
    for (let i = 0; i < n; i++) {
      c.fillStyle = random() > 0.5 ? `rgba(255,244,220,${range(0.01, light)})` : `rgba(45,30,20,${range(0.01, dark)})`;
      c.fillRect(random() * w, random() * h, range(0.5, 2), range(0.5, 2));
    }
  };

  // ------------------------------------------------------------ wallpapers
  // Each tile is one metre (or whatever `tile` says beside it in FINISHES).
  // The hall: cream, with a trellis of sage thistles.
  const hallPaper = std(
    paintTexture(512, 512, (c, w, h) => {
      c.fillStyle = "#efe6cf";
      c.fillRect(0, 0, w, h);
      c.strokeStyle = "rgba(122,140,108,0.22)";
      c.lineWidth = 2;
      for (let i = -1; i < 3; i++) {
        c.beginPath();
        c.moveTo(i * 256, 0);
        c.lineTo((i + 2) * 256, h);
        c.moveTo((i + 2) * 256, 0);
        c.lineTo(i * 256, h);
        c.stroke();
      }
      const thistle = (x, y, s) => {
        c.strokeStyle = "#6f8468";
        c.lineWidth = 3 * s;
        c.beginPath();
        c.moveTo(x, y + 44 * s);
        c.quadraticCurveTo(x + 5 * s, y + 20 * s, x, y + 2 * s);
        c.stroke();
        c.fillStyle = "#7f9574";
        for (const side of [-1, 1]) {
          c.beginPath();
          c.ellipse(x + side * 11 * s, y + 26 * s, 12 * s, 4 * s, side * 0.6, 0, Math.PI * 2);
          c.fill();
        }
        c.fillStyle = "#6f8468";
        c.beginPath();
        c.ellipse(x, y, 11 * s, 12 * s, 0, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = "#a07f9d";
        c.lineWidth = 2.2 * s;
        for (let k = -4; k <= 4; k++) {
          c.beginPath();
          c.moveTo(x + k * 1.5 * s, y - 8 * s);
          c.lineTo(x + k * 3.3 * s, y - 25 * s + Math.abs(k) * 1.6 * s);
          c.stroke();
        }
      };
      thistle(128, 100, 1);
      thistle(384, 356, 1);
      thistle(384, 100, 0.7);
      thistle(128, 356, 0.7);
      speckle(c, w, h, 1600);
    }),
    0.92,
  );
  // The breakfast room: butter yellow with white primroses.
  const breakfastPaper = std(
    paintTexture(512, 512, (c, w, h) => {
      c.fillStyle = "#f0dba0";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "rgba(255,247,224,0.32)";
      for (let x = 0; x < w; x += 128) c.fillRect(x, 0, 52, h);
      const primrose = (x, y) => {
        c.fillStyle = "#83a067";
        for (const a of [0.5, 2.4, 4.3]) {
          c.beginPath();
          c.ellipse(x + Math.cos(a) * 15, y + Math.sin(a) * 15, 11, 5, a, 0, Math.PI * 2);
          c.fill();
        }
        c.fillStyle = "#fdf8e6";
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          c.beginPath();
          c.arc(x + Math.cos(a) * 8, y + Math.sin(a) * 8, 7, 0, Math.PI * 2);
          c.fill();
        }
        c.fillStyle = "#e6a93c";
        c.beginPath();
        c.arc(x, y, 4, 0, Math.PI * 2);
        c.fill();
      };
      for (const [x, y] of [[90, 90], [346, 90], [218, 218], [474, 218], [90, 346], [346, 346], [218, 474], [474, 474]])
        primrose(x, y);
      speckle(c, w, h, 1400);
    }),
    0.92,
  );
  // The sitting room: a deep green with trailing willow leaves.
  const sittingPaper = std(
    paintTexture(512, 512, (c, w, h) => {
      c.fillStyle = "#65795f";
      c.fillRect(0, 0, w, h);
      const frond = (x, y, flip, tone) => {
        c.strokeStyle = tone;
        c.lineWidth = 2.5;
        c.beginPath();
        c.moveTo(x, y);
        c.bezierCurveTo(x + flip * 28, y + 56, x - flip * 26, y + 120, x + flip * 12, y + 190);
        c.stroke();
        c.fillStyle = tone;
        for (let i = 1; i < 12; i++) {
          const t = i / 12,
            px = x + flip * Math.sin(t * 3.2) * 19,
            py = y + t * 190;
          for (const s of [-1, 1]) {
            c.beginPath();
            c.ellipse(px + s * 13, py + 5, 15, 3.8, s * 0.62, 0, Math.PI * 2);
            c.fill();
          }
        }
      };
      for (const [x, y, f, t] of [
        [80, -40, 1, "#8fa582"], [80, 216, -1, "#a2b591"], [80, 472, 1, "#8fa582"],
        [208, 80, -1, "#7d9473"], [208, 336, 1, "#8fa582"],
        [336, -40, -1, "#a2b591"], [336, 216, 1, "#8fa582"], [336, 472, -1, "#a2b591"],
        [464, 80, 1, "#8fa582"], [464, 336, -1, "#7d9473"],
      ])
        frond(x, y, f, t);
      speckle(c, w, h, 1500, 0.04, 0.04);
    }),
    0.94,
  );
  // Goldfinch: wide ochre stripes, a finch on a seed-head between them.
  const goldfinchPaper = std(
    paintTexture(512, 512, (c, w, h) => {
      c.fillStyle = "#f3e6c2";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#e6c980";
      for (let x = 0; x < w; x += 256) c.fillRect(x, 0, 118, h);
      c.fillStyle = "rgba(180,140,70,0.32)";
      for (let x = 0; x < w; x += 256) {
        c.fillRect(x - 3, 0, 3, h);
        c.fillRect(x + 118, 0, 3, h);
      }
      const bird = (x, y) => {
        c.fillStyle = "#b49c6b";
        c.fillRect(x - 1, y + 10, 2, 42);
        c.fillStyle = "#c9b8cf";
        c.beginPath();
        c.arc(x, y + 52, 6, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#d4a93a";
        c.beginPath();
        c.ellipse(x, y, 16, 10, -0.25, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#3d352d";
        c.beginPath();
        c.ellipse(x - 15, y + 3, 12, 4, -0.3, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#b5402f";
        c.beginPath();
        c.arc(x + 13, y - 6, 6, 0, Math.PI * 2);
        c.fill();
      };
      bird(188, 118);
      bird(444, 374);
      speckle(c, w, h, 1300);
    }),
    0.92,
  );
  // Linnet: soft blue-grey sprays on powder blue.
  const linnetPaper = std(
    paintTexture(512, 512, (c, w, h) => {
      c.fillStyle = "#cfdadd";
      c.fillRect(0, 0, w, h);
      const spray = (x, y, r) => {
        c.save();
        c.translate(x, y);
        c.rotate(r);
        c.strokeStyle = "#7f97a3";
        c.lineWidth = 2.5;
        c.beginPath();
        c.moveTo(0, 40);
        c.quadraticCurveTo(6, 0, -2, -46);
        c.stroke();
        c.fillStyle = "#8ba2ad";
        for (let i = 0; i < 6; i++) {
          const yy = 30 - i * 14,
            s = i % 2 ? 1 : -1;
          c.beginPath();
          c.ellipse(s * 11, yy, 11, 4, s * -0.6, 0, Math.PI * 2);
          c.fill();
        }
        c.fillStyle = "#f4f2e6";
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          c.beginPath();
          c.arc(Math.cos(a) * 6 - 2, -50 + Math.sin(a) * 6, 4.5, 0, Math.PI * 2);
          c.fill();
        }
        c.restore();
      };
      spray(128, 118, 0.2);
      spray(384, 118, -0.3);
      spray(256, 310, 0.15);
      spray(0, 310, -0.2);
      spray(512, 310, -0.2);
      spray(128, 470, 0.1);
      speckle(c, w, h, 1300);
    }),
    0.92,
  );
  const plaster = (color) => std(surface("plaster", color), 0.94);
  const kitchenPaint = plaster("#f0e5c8"),
    bathPaint = plaster("#c7dcd6"),
    ceiling = plaster("#f4ecd9"),
    render = plaster("#e5dabb"),
    chimney = plaster("#ded2b7");

  // ----------------------------------------------------------------- floors
  const boardsTexture = (tones, rows = 8, seams = 0.5) =>
    paintTexture(512, 512, (c) => {
      const rowH = 512 / rows;
      for (let row = 0; row < rows; row++) {
        let x = -range(0, 300);
        while (x < 512) {
          const len = range(190, 360);
          c.fillStyle = tones[Math.floor(random() * tones.length)];
          c.fillRect(x, row * rowH, len, rowH);
          for (let i = 0; i < 11; i++) {
            c.strokeStyle = `rgba(55,32,16,${range(0.04, 0.14)})`;
            c.beginPath();
            const y = row * rowH + range(4, rowH - 4);
            c.moveTo(x, y);
            c.bezierCurveTo(x + len / 3, y + range(-3, 3), x + (2 * len) / 3, y + range(-3, 3), x + len, y);
            c.stroke();
          }
          c.fillStyle = `rgba(40,24,12,${seams})`;
          c.fillRect(x, row * rowH, 2, rowH);
          x += len;
        }
        c.fillStyle = `rgba(40,24,12,${seams})`;
        c.fillRect(0, row * rowH, 512, 2);
      }
      speckle(c, 512, 512, 2200, 0.05, 0.07);
    });
  const oakFloorMap = boardsTexture(["#9d7146", "#93683f", "#a77a4e", "#8b6239"]);
  const oakFloor = std(oakFloorMap, 0.58, { bumpMap: oakFloorMap, bumpScale: 0.012 });
  const paleBoardsMap = boardsTexture(["#c8a980", "#bea077", "#d0b28a", "#b6986f"], 7, 0.42);
  const paleBoards = std(paleBoardsMap, 0.72);
  // The hall: encaustic tiles in oxblood, cream, slate and ochre.
  const encaustic = std(
    paintTexture(512, 512, (c) => {
      const s = 128;
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++) {
          const x = i * s,
            y = j * s,
            even = (i + j) % 2 === 0;
          c.fillStyle = even ? "#e6dabd" : "#7c3729";
          c.fillRect(x, y, s, s);
          c.fillStyle = even ? "#7c3729" : "#e6dabd";
          c.beginPath();
          c.moveTo(x + s / 2, y + 8);
          c.lineTo(x + s - 8, y + s / 2);
          c.lineTo(x + s / 2, y + s - 8);
          c.lineTo(x + 8, y + s / 2);
          c.closePath();
          c.fill();
          c.fillStyle = "#39403f";
          c.beginPath();
          c.moveTo(x + s / 2, y + 34);
          c.lineTo(x + s - 34, y + s / 2);
          c.lineTo(x + s / 2, y + s - 34);
          c.lineTo(x + 34, y + s / 2);
          c.closePath();
          c.fill();
          c.fillStyle = "#c7963f";
          c.beginPath();
          c.arc(x + s / 2, y + s / 2, 11, 0, Math.PI * 2);
          c.fill();
          c.strokeStyle = "rgba(60,50,40,0.75)";
          c.lineWidth = 2.5;
          c.strokeRect(x + 1, y + 1, s - 2, s - 2);
        }
      speckle(c, 512, 512, 3000, 0.05, 0.08);
    }),
    0.34,
  );
  // The kitchen: worn terracotta quarry tiles.
  const quarry = std(
    paintTexture(512, 512, (c) => {
      c.fillStyle = "#7d6a58";
      c.fillRect(0, 0, 512, 512);
      const tones = ["#b6704d", "#a9663f", "#c07a55", "#a35f42", "#b87650"];
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++) {
          c.fillStyle = tones[Math.floor(random() * tones.length)];
          c.fillRect(i * 128 + 3, j * 128 + 3, 122, 122);
        }
      speckle(c, 512, 512, 5000, 0.07, 0.09);
    }),
    0.55,
  );
  // The bathroom: a black and white check, set diagonally by the UVs.
  const checker = std(
    paintTexture(256, 256, (c) => {
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) {
          c.fillStyle = (i + j) % 2 ? "#2f3232" : "#ecebe2";
          c.fillRect(i * 128, j * 128, 128, 128);
        }
      c.strokeStyle = "rgba(120,120,110,0.8)";
      c.lineWidth = 2;
      c.strokeRect(0, 0, 256, 256);
      c.beginPath();
      c.moveTo(128, 0);
      c.lineTo(128, 256);
      c.moveTo(0, 128);
      c.lineTo(256, 128);
      c.stroke();
      speckle(c, 256, 256, 500, 0.04, 0.05);
    }),
    0.22,
  );
  // White metro tile to the dado, for kitchen and bath.
  const metro = std(
    paintTexture(256, 256, (c) => {
      c.fillStyle = "#c7c5b8";
      c.fillRect(0, 0, 256, 256);
      for (let row = 0; row < 8; row++)
        for (let col = -1; col < 4; col++) {
          const shade = 238 + Math.floor(range(-6, 8));
          c.fillStyle = `rgb(${shade},${shade},${shade - 8})`;
          c.fillRect(col * 85.33 + (row % 2) * 42.66 + 1.5, row * 32 + 1.5, 82.3, 29);
        }
    }),
    0.24,
  );
  // Tongue-and-groove boards, painted sage, for the hall's dado.
  const boards = (color, shade) =>
    std(
      paintTexture(256, 256, (c) => {
        c.fillStyle = color;
        c.fillRect(0, 0, 256, 256);
        for (let x = 0; x < 256; x += 32) {
          c.fillStyle = shade;
          c.fillRect(x, 0, 3, 256);
          c.fillStyle = "rgba(255,255,240,0.12)";
          c.fillRect(x + 3, 0, 2, 256);
        }
        speckle(c, 256, 256, 500, 0.04, 0.04);
      }),
      0.5,
    );
  const sageBoards = boards("#8ea08c", "rgba(40,55,44,0.5)"),
    creamBoards = boards("#ece3cb", "rgba(90,80,60,0.34)"),
    blueBoards = boards("#9db4b8", "rgba(45,60,70,0.42)");

  // ---------------------------------------------------------------- fabrics
  const gingham = (color, repeat = 9) => {
    const map = paintTexture(128, 128, (c) => {
      c.fillStyle = "#faf6ea";
      c.fillRect(0, 0, 128, 128);
      c.fillStyle = color;
      c.globalAlpha = 0.5;
      c.fillRect(0, 0, 64, 128);
      c.fillRect(0, 0, 128, 64);
      c.globalAlpha = 1;
    });
    map.repeat.setScalar(repeat);
    return std(map, 0.92);
  };
  const ginghamBlue = gingham("#5a7da4"),
    ginghamRed = gingham("#b65a52");
  // Chintz: faded roses on cream, for the sitting room's chairs and curtains.
  const chintz = std(
    paintTexture(256, 256, (c) => {
      c.fillStyle = "#e9dcc0";
      c.fillRect(0, 0, 256, 256);
      const rose = (x, y) => {
        c.fillStyle = "#77906a";
        for (const a of [0.7, 2.6, 4.6]) {
          c.beginPath();
          c.ellipse(x + Math.cos(a) * 21, y + Math.sin(a) * 21, 15, 6, a, 0, Math.PI * 2);
          c.fill();
        }
        c.fillStyle = "#c27f76";
        c.beginPath();
        c.arc(x, y, 18, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#d9a093";
        c.beginPath();
        c.arc(x - 3, y - 3, 11, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#a95f5c";
        c.beginPath();
        c.arc(x + 1, y, 5, 0, Math.PI * 2);
        c.fill();
      };
      rose(64, 64);
      rose(192, 192);
      c.fillStyle = "#b9a9c6";
      for (const [x, y] of [[192, 60], [64, 190], [130, 128], [16, 126]]) {
        c.beginPath();
        c.arc(x, y, 7, 0, Math.PI * 2);
        c.fill();
      }
      speckle(c, 256, 256, 900, 0.05, 0.04);
    }),
    0.96,
  );
  const velvet = std(
    paintTexture(128, 128, (c) => {
      c.fillStyle = "#72392f";
      c.fillRect(0, 0, 128, 128);
      speckle(c, 128, 128, 1900, 0.06, 0.09);
    }),
    0.98,
  );
  const sageVelvet = std(
    paintTexture(128, 128, (c) => {
      c.fillStyle = "#6d8069";
      c.fillRect(0, 0, 128, 128);
      speckle(c, 128, 128, 1900, 0.06, 0.09);
    }),
    0.98,
  );
  // A patchwork for the double bed.
  const patchwork = std(
    paintTexture(512, 512, (c) => {
      const colours = ["#c9a144", "#e5d5a6", "#a65d4a", "#8e9c74", "#e9e1cb", "#7f96a4", "#d6b86d", "#b98258"];
      for (let i = 0; i < 8; i++)
        for (let j = 0; j < 8; j++) {
          const x = i * 64,
            y = j * 64;
          c.fillStyle = colours[Math.floor(random() * colours.length)];
          c.fillRect(x, y, 64, 64);
          if ((i + j) % 2) {
            c.fillStyle = colours[Math.floor(random() * colours.length)];
            c.beginPath();
            c.moveTo(x, y);
            c.lineTo(x + 64, y);
            c.lineTo(x + 64, y + 64);
            c.closePath();
            c.fill();
          }
          c.strokeStyle = "rgba(255,250,235,0.55)";
          c.setLineDash([4, 4]);
          c.lineWidth = 1.5;
          c.strokeRect(x + 3, y + 3, 58, 58);
          c.setLineDash([]);
        }
      speckle(c, 512, 512, 2600, 0.05, 0.05);
    }),
    0.98,
  );
  // Candlewick for the twin beds: white on white, in diamonds.
  const candlewick = std(
    paintTexture(256, 256, (c) => {
      c.fillStyle = "#e7e7dc";
      c.fillRect(0, 0, 256, 256);
      c.fillStyle = "#fbfaf2";
      for (let y = 8; y < 256; y += 16)
        for (let x = 8 + ((y >> 4) % 2) * 8; x < 256; x += 16) {
          const r = Math.abs(((x + y) % 128) - 64) < 8 || Math.abs(((x - y + 256) % 128) - 64) < 8 ? 4.6 : 2.2;
          c.beginPath();
          c.arc(x, y, r, 0, Math.PI * 2);
          c.fill();
        }
    }),
    1,
  );
  const blueWool = std(
    paintTexture(128, 128, (c) => {
      c.fillStyle = "#6c8ba0";
      c.fillRect(0, 0, 128, 128);
      c.strokeStyle = "rgba(240,235,215,0.42)";
      c.lineWidth = 2;
      for (let y = 8; y < 128; y += 32) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(128, y);
        c.stroke();
      }
      speckle(c, 128, 128, 1600, 0.06, 0.07);
    }),
    1,
  );
  const tartan = std(
    paintTexture(256, 256, (c) => {
      c.fillStyle = "#6f2f2a";
      c.fillRect(0, 0, 256, 256);
      c.globalAlpha = 0.5;
      c.fillStyle = "#2c4739";
      c.fillRect(32, 0, 64, 256);
      c.fillRect(0, 32, 256, 64);
      c.fillStyle = "#23323f";
      c.fillRect(160, 0, 40, 256);
      c.fillRect(0, 160, 256, 40);
      c.globalAlpha = 0.8;
      c.fillStyle = "#e0c56e";
      c.fillRect(126, 0, 4, 256);
      c.fillRect(0, 126, 256, 4);
      c.globalAlpha = 1;
      speckle(c, 256, 256, 1600, 0.05, 0.06);
    }),
    1,
  );
  // A Turkey rug and a stair runner, woven on one loom.
  const rugTexture = (ground, border, accent, runner = false) =>
    paintTexture(512, 512, (c) => {
      c.fillStyle = ground;
      c.fillRect(0, 0, 512, 512);
      c.fillStyle = border;
      if (runner) {
        c.fillRect(0, 0, 70, 512);
        c.fillRect(442, 0, 70, 512);
      } else {
        c.fillRect(0, 0, 512, 56);
        c.fillRect(0, 456, 512, 56);
        c.fillRect(0, 0, 56, 512);
        c.fillRect(456, 0, 56, 512);
      }
      c.fillStyle = accent;
      const motif = (x, y, s) => {
        c.beginPath();
        c.moveTo(x, y - s);
        c.lineTo(x + s, y);
        c.lineTo(x, y + s);
        c.lineTo(x - s, y);
        c.closePath();
        c.fill();
      };
      if (runner) {
        for (let y = 26; y < 512; y += 64) {
          motif(36, y, 20);
          motif(476, y, 20);
        }
        for (let y = 64; y < 512; y += 128) {
          motif(256, y, 56);
          c.fillStyle = ground;
          motif(256, y, 32);
          c.fillStyle = accent;
          motif(256, y, 14);
        }
      } else {
        for (let i = 28; i < 512; i += 64) {
          motif(i, 28, 16);
          motif(i, 484, 16);
          motif(28, i, 16);
          motif(484, i, 16);
        }
        for (const [x, y, s] of [[256, 256, 120], [128, 128, 48], [384, 128, 48], [128, 384, 48], [384, 384, 48]]) {
          motif(x, y, s);
          c.fillStyle = border;
          motif(x, y, s * 0.68);
          c.fillStyle = ground;
          motif(x, y, s * 0.38);
          c.fillStyle = accent;
        }
      }
      speckle(c, 512, 512, 7000, 0.06, 0.1);
    });
  const turkeyRug = std(rugTexture("#7c2f2a", "#23344a", "#d3ac63"), 1),
    runner = std(rugTexture("#6d2a2d", "#2a3b47", "#c9a765", true), 1),
    goldRug = std(rugTexture("#c9a65c", "#6f5b3a", "#ece0bd"), 1),
    blueRug = std(rugTexture("#7c95a3", "#3f5664", "#e6e0c8"), 1);
  // A rag rug, for the kitchen and beside the bath.
  const ragRug = std(
    paintTexture(256, 256, (c) => {
      const tones = ["#b86a4f", "#6f8aa0", "#d7c48d", "#7a8d68", "#a4807a", "#e3d8bd"];
      for (let y = 0; y < 256; y += 10) {
        c.fillStyle = tones[Math.floor(random() * tones.length)];
        c.fillRect(0, y, 256, 10);
        c.fillStyle = "rgba(50,35,25,0.2)";
        c.fillRect(0, y, 256, 1.5);
        for (let i = 0; i < 40; i++) {
          c.fillStyle = `rgba(255,250,235,${range(0.03, 0.14)})`;
          c.fillRect(random() * 256, y + range(1, 8), range(3, 12), 1.5);
        }
      }
    }),
    1,
  );
  // The net curtains: faint squares, in a material you can see through.
  const net = new T.MeshStandardMaterial({
    map: paintTexture(128, 128, (c) => {
      c.fillStyle = "#ffffff";
      c.fillRect(0, 0, 128, 128);
      c.strokeStyle = "rgba(180,180,170,0.55)";
      c.lineWidth = 2;
      for (let i = 0; i < 128; i += 16) {
        c.beginPath();
        c.moveTo(i, 0);
        c.lineTo(i, 128);
        c.moveTo(0, i);
        c.lineTo(128, i);
        c.stroke();
      }
    }),
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    side: T.DoubleSide,
    roughness: 1,
    emissive: "#fff4dc",
    emissiveIntensity: 0.18,
  });

  // ------------------------------------------------------------------ woods
  const oak = std(surface("wood", "#a2774a"), 0.6),
    darkOak = std(surface("wood", "#634229"), 0.56),
    pine = std(surface("wood", "#cdb186"), 0.68),
    walnut = std(surface("wood", "#5a3b29"), 0.42),
    mahogany = std(surface("wood", "#6e3a26"), 0.34),
    grass = std(
      paintTexture(256, 256, (c) => {
        c.fillStyle = "#7f9f58";
        c.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 2200; i++) {
          c.strokeStyle = random() > 0.5 ? "rgba(165,195,110,0.45)" : "rgba(70,105,50,0.42)";
          const x = random() * 256,
            y = random() * 256;
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + range(-2, 2), y - range(3, 7));
          c.stroke();
        }
      }),
      1,
    ),
    flags = std(
      paintTexture(256, 256, (c) => {
        c.fillStyle = "#8a826f";
        c.fillRect(0, 0, 256, 256);
        for (const [x, y, w, h] of [[2, 2, 124, 80], [130, 2, 124, 120], [2, 86, 124, 168], [130, 126, 124, 128]]) {
          c.fillStyle = `rgb(${170 + range(-14, 14)},${162 + range(-14, 14)},${142 + range(-12, 12)})`;
          c.fillRect(x, y, w, h);
        }
        speckle(c, 256, 256, 2400, 0.07, 0.08);
      }),
      0.9,
    );

  // ----------------------------------------------------------------- glowing
  // Rough enough that the lamps leave no pinprick on the pane.
  const glass = new T.MeshStandardMaterial({
    color: "#e7f0ec",
    roughness: 0.55,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    emissive: "#fff6df",
    emissiveIntensity: 0.05,
  });
  const frosted = new T.MeshStandardMaterial({
    color: "#f4f6ee",
    roughness: 0.9,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    emissive: "#fff3d4",
    emissiveIntensity: 0.4,
  });
  const shade = new T.MeshStandardMaterial({ color: "#f3dcae", emissive: "#ffc97a", emissiveIntensity: 0.2, roughness: 0.9, side: T.DoubleSide });
  const redShade = new T.MeshStandardMaterial({ color: "#c98f6c", emissive: "#ff9b57", emissiveIntensity: 0.15, roughness: 0.9, side: T.DoubleSide });
  const bulb = new T.MeshStandardMaterial({ color: "#fff4d8", emissive: "#ffd28e", emissiveIntensity: 0.3 });
  const flame = new T.MeshStandardMaterial({ color: "#4a1a06", emissive: "#ff5f14", emissiveIntensity: 1.1, roughness: 1 });
  const flameCore = new T.MeshStandardMaterial({ color: "#5a3010", emissive: "#ffb040", emissiveIntensity: 1.15, roughness: 1 });
  const ember = new T.MeshStandardMaterial({ color: "#3a1c10", emissive: "#d3461b", emissiveIntensity: 1, roughness: 1 });
  const steam = new T.MeshStandardMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false, roughness: 1 });
  const water = new T.MeshPhysicalMaterial({ color: "#b8d7da", transparent: true, opacity: 0.68, roughness: 0.08, depthWrite: false, transmission: 0 });

  const FINISHES = {
    hall: { paper: hallPaper, tile: 0.72, dado: sageBoards, dadoH: 0.95, rail: "#6e8370" },
    breakfast: { paper: breakfastPaper, tile: 0.8, dado: creamBoards, dadoH: 0.78, rail: "#f4eddb" },
    sitting: { paper: sittingPaper, tile: 0.92, rail: "#5a4a35", picture: true },
    kitchen: { paper: kitchenPaint, tile: 1.6 },
    kitchenLow: { paper: kitchenPaint, tile: 1.6, dado: metro, dadoH: 1.45, dadoTile: 0.6, rail: "#6d7d73" },
    landing: { paper: hallPaper, tile: 0.72, dado: creamBoards, dadoH: 0.86, rail: "#f4eddb" },
    well: { paper: hallPaper, tile: 0.72, bare: true },
    goldfinch: { paper: goldfinchPaper, tile: 0.92 },
    linnet: { paper: linnetPaper, tile: 0.8, dado: blueBoards, dadoH: 0.8, rail: "#eef0e6" },
    bath: { paper: bathPaint, tile: 1.6, dado: metro, dadoH: 1.4, dadoTile: 0.6, rail: "#3f6d70" },
    bathLow: { paper: bathPaint, tile: 1.6, dado: metro, dadoH: 1.4, dadoTile: 0.6, rail: "#3f6d70" },
    render: { paper: render, tile: 1.6 },
  };

  // The one material a moving figure's merged parts share.
  const figure = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.62 });

  return {
    mat,
    figure,
    paintTexture,
    std,
    FINISHES,
    hallPaper, ceiling, render, chimney,
    oakFloor, paleBoards, encaustic, quarry, checker, metro, sageBoards, creamBoards, blueBoards,
    ginghamBlue, ginghamRed, chintz, velvet, sageVelvet, patchwork, candlewick, blueWool, tartan,
    turkeyRug, runner, goldRug, blueRug, ragRug, net,
    oak, darkOak, pine, walnut, mahogany, grass, flags,
    glass, frosted, shade, redShade, bulb, flame, flameCore, ember, steam, water,
    // A flat-colour palette the parts draw on; paintFlat merges them.
    trim: mat("#f5efe0", 0.62),
    white: mat("#fbf8f0", 0.62),
    ivory: mat("#f1e7cf", 0.72),
    china: mat("#f6f4ec", 0.24),
    willow: mat("#5f82ad", 0.26),
    cream: mat("#efe2c4", 0.86),
    linen: mat("#f1ece0", 0.96),
    brass: mat("#c6a05a", 0.32, 0.8),
    copper: mat("#b56e48", 0.32, 0.8),
    iron: mat("#2d2b29", 0.62, 0.6),
    silver: mat("#d4d6d6", 0.24, 0.85),
    sage: mat("#7c9180", 0.72),
    soot: mat("#191512", 1),
    black: mat("#25211e", 0.5),
    apple: mat("#6d8f58", 0.78),
    butter: mat("#e7c675", 0.78),
    rust: mat("#a65d3f", 0.9),
    plum: mat("#7d5270", 0.92),
    navy: mat("#3a4a63", 0.92),
    leaf: Object.assign(mat("#557a4a", 0.82).clone(), { side: T.DoubleSide }),
    leafPale: Object.assign(mat("#7f9f5a", 0.82).clone(), { side: T.DoubleSide }),
  };
}

// A single texture holding every little picture and label in the house, so that
// a hundred of them cost one material. `cell(w, h, draw)` reserves a rectangle
// and paints it; `uv(cell)` gives its corners for a plane's UVs.
export function createSheet(size = 2048) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const c = canvas.getContext("2d");
  c.fillStyle = "#cdbfa0";
  c.fillRect(0, 0, size, size);
  let x = 0,
    y = 0,
    rowH = 0;
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  map.anisotropy = 8;
  map.generateMipmaps = true;
  const material = new T.MeshStandardMaterial({ map, roughness: 0.62 });
  return {
    material,
    /** Reserves `w` × `h` pixels and paints them; the drawing's origin is the cell's corner. */
    cell(w, h, draw) {
      const pad = 4;
      if (x + w + pad > size) {
        x = 0;
        y += rowH + pad;
        rowH = 0;
      }
      if (y + h > size) throw Error("Thistledown's picture sheet is full.");
      c.save();
      c.beginPath();
      c.rect(x, y, w, h);
      c.clip();
      c.translate(x, y);
      draw(c, w, h);
      c.restore();
      const cell = { u0: x / size, u1: (x + w) / size, v0: 1 - (y + h) / size, v1: 1 - y / size };
      x += w + pad;
      rowH = Math.max(rowH, h);
      map.needsUpdate = true;
      return cell;
    },
  };
}
