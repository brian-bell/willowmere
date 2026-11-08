import * as T from "three";

// Everything painted in the Copper Kettle: the repeating surfaces (oak boards,
// quarry tiles, the sprigged wallpaper and the sage matchboard under it, brick,
// gingham and chintz), the colours, and one shared sheet that holds every
// label, card, photograph and page, so their lettering costs one material.

const SERIF = "Georgia, 'Times New Roman', serif";
const HAND = "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive";

export function createSurfaces(parts) {
  const { random, range, mat, surface, mesh, root } = parts;

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
      c.fillStyle = random() > 0.5 ? `rgba(255,244,220,${range(0.01, light)})` : `rgba(35,25,18,${range(0.01, dark)})`;
      c.fillRect(random() * w, random() * h, range(0.6, 2.2), range(0.6, 2.2));
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

  // ------------------------------------------------------------- floors, walls
  // Honey oak boards, eight to a 1.6 m repeat, their ends staggered.
  const boards = paint(1024, 1024, (c, S) => {
    const rows = 8,
      rh = S / rows;
    for (let r = 0; r < rows; r++) {
      let x = -range(0, S * 0.6);
      while (x < S) {
        const len = range(S * 0.45, S * 0.9),
          tone = shade("#b07c4c", range(-0.14, 0.1));
        for (const dx of [0, -S, S]) {
          c.fillStyle = tone;
          c.fillRect(x + dx, r * rh, len, rh);
          grain(c, x + dx, r * rh, len, rh, 14);
          c.fillStyle = "rgba(40,22,10,0.55)";
          c.fillRect(x + dx + len - 2, r * rh, 2, rh);
        }
        x += len;
      }
      c.fillStyle = "rgba(40,22,10,0.6)";
      c.fillRect(0, r * rh, S, 2);
    }
    speckle(c, S, S, 6000, 0.05, 0.05);
    // A path worn paler from the door to the counter.
    const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.6);
    g.addColorStop(0, "rgba(255,236,200,0.08)");
    g.addColorStop(1, "rgba(255,236,200,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, S, S);
  });
  // Red and buff quarry tiles in the kitchen, four to a 1.2 m repeat.
  const quarry = paint(1024, 1024, (c, S) => {
    c.fillStyle = "#6b5a48";
    c.fillRect(0, 0, S, S);
    const n = 4,
      u = S / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const base = (i + j) % 2 ? "#a4553a" : "#b56a44";
        c.fillStyle = shade(base, range(-0.12, 0.08));
        c.fillRect(i * u + 5, j * u + 5, u - 10, u - 10);
        for (let k = 0; k < 40; k++) {
          c.fillStyle = `rgba(${random() > 0.5 ? "255,220,190" : "60,25,15"},${range(0.03, 0.09)})`;
          c.beginPath();
          c.arc(i * u + range(10, u - 10), j * u + range(10, u - 10), range(4, 22), 0, Math.PI * 2);
          c.fill();
        }
      }
    speckle(c, S, S, 8000, 0.05, 0.08);
  });
  // Cream paper with sage stripes and little rose sprigs between them.
  const wallpaper = paint(512, 512, (c, S) => {
    c.fillStyle = "#efe4c8";
    c.fillRect(0, 0, S, S);
    for (const x of [0, S / 2]) {
      c.fillStyle = "rgba(122,150,112,0.35)";
      c.fillRect(x + 6, 0, 10, S);
      c.fillStyle = "rgba(122,150,112,0.18)";
      c.fillRect(x + 22, 0, 3, S);
    }
    for (let row = 0; row < 4; row++)
      for (const x of [S / 4, (3 * S) / 4]) {
        const y = row * (S / 4) + (x > S / 2 ? S / 8 : 0) + 30;
        c.strokeStyle = "#7d9a72";
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(x - 18, y + 26);
        c.quadraticCurveTo(x - 4, y + 6, x + 4, y - 14);
        c.stroke();
        c.fillStyle = "#86a57a";
        for (const [lx, ly, a] of [[-10, 14, -0.6], [6, 4, 0.7], [-2, -4, -0.3]]) {
          c.beginPath();
          c.ellipse(x + lx, y + ly, 8, 3.5, a, 0, Math.PI * 2);
          c.fill();
        }
        c.fillStyle = "#d9909a";
        c.beginPath();
        c.arc(x + 5, y - 16, 8, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#c26f7b";
        c.beginPath();
        c.arc(x + 6, y - 15, 3.6, 0, Math.PI * 2);
        c.fill();
      }
    speckle(c, S, S, 1600, 0.04, 0.04);
  });
  // Sage matchboard under the dado rail: narrow boards with a bead between.
  const matchboard = paint(512, 512, (c, S) => {
    const n = 8,
      u = S / n;
    for (let i = 0; i < n; i++) {
      c.fillStyle = shade("#8fa58a", range(-0.05, 0.05));
      c.fillRect(i * u, 0, u, S);
      c.fillStyle = "rgba(40,55,38,0.45)";
      c.fillRect(i * u, 0, 3, S);
      c.fillStyle = "rgba(255,255,240,0.22)";
      c.fillRect(i * u + 4, 0, 2, S);
    }
    speckle(c, S, S, 2500, 0.05, 0.05);
  });
  const brick = paint(512, 512, (c, S) => {
    c.fillStyle = "#b8a78c";
    c.fillRect(0, 0, S, S);
    const rows = 8,
      rh = S / rows,
      bw = S / 4;
    for (let r = 0; r < rows; r++)
      for (let i = -1; i < 5; i++) {
        const x = i * bw + (r % 2 ? bw / 2 : 0);
        c.fillStyle = shade("#9a4f36", range(-0.2, 0.12));
        c.fillRect(x + 3, r * rh + 3, bw - 6, rh - 6);
      }
    speckle(c, S, S, 5000, 0.06, 0.1);
  });
  const gingham = paint(256, 256, (c, S) => {
    c.fillStyle = "#f6f0e2";
    c.fillRect(0, 0, S, S);
    const n = 8,
      u = S / n;
    c.fillStyle = "rgba(122,150,124,0.45)";
    for (let i = 0; i < n; i += 2) {
      c.fillRect(i * u, 0, u, S);
      c.fillRect(0, i * u, S, u);
    }
  });
  const chintz = paint(256, 256, (c, S) => {
    c.fillStyle = "#e9d6c2";
    c.fillRect(0, 0, S, S);
    for (let i = 0; i < 9; i++) {
      const x = (i % 3) * (S / 3) + S / 6 + ((Math.floor(i / 3) % 2) * S) / 6,
        y = Math.floor(i / 3) * (S / 3) + S / 6;
      c.fillStyle = "#86a079";
      c.beginPath();
      c.ellipse(x - 12, y + 8, 11, 5, -0.5, 0, Math.PI * 2);
      c.ellipse(x + 12, y + 10, 11, 5, 0.6, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#c0707e";
      c.beginPath();
      c.arc(x, y, 12, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#e3a0aa";
      c.beginPath();
      c.arc(x - 2, y - 2, 6, 0, Math.PI * 2);
      c.fill();
    }
  });
  // A round rag rug for the hearth: rings of plaited colour.
  const rug = paint(512, 512, (c, S) => {
    c.fillStyle = "rgba(0,0,0,0)";
    c.clearRect(0, 0, S, S);
    const colors = ["#7d5a4f", "#b39a72", "#6f8269", "#cdbfa4", "#8a6f7f", "#a8705a"];
    for (let r = S / 2 - 4, i = 0; r > 6; r -= 14, i++) {
      c.strokeStyle = colors[i % colors.length];
      c.lineWidth = 13;
      c.beginPath();
      c.arc(S / 2, S / 2, r - 6, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = "rgba(30,20,12,0.25)";
      c.lineWidth = 1.5;
      c.setLineDash([4, 5]);
      c.stroke();
      c.setLineDash([]);
    }
  }, false);

  // -------------------------------------------------------------------- colours
  const oakMap = surface("wood", "#7d5434");
  const M = {
    floor: new T.MeshStandardMaterial({ map: boards, roughness: 0.62 }),
    quarry: new T.MeshStandardMaterial({ map: quarry, roughness: 0.78 }),
    wallpaper: new T.MeshStandardMaterial({ map: wallpaper, roughness: 0.9 }),
    matchboard: new T.MeshStandardMaterial({ map: matchboard, roughness: 0.55 }),
    plaster: new T.MeshStandardMaterial({ map: surface("plaster", "#efe6d0"), roughness: 0.94 }),
    limewash: new T.MeshStandardMaterial({ map: surface("plaster", "#ece6d6"), roughness: 0.95 }),
    ceiling: new T.MeshStandardMaterial({ map: surface("plaster", "#f1e8d2"), roughness: 0.95 }),
    beam: new T.MeshStandardMaterial({ map: surface("wood", "#4f3624"), roughness: 0.82 }),
    brick: new T.MeshStandardMaterial({ map: brick, roughness: 0.9 }),
    oak: new T.MeshStandardMaterial({ map: oakMap, roughness: 0.5 }),
    oakDark: new T.MeshStandardMaterial({ map: oakMap, color: "#8a7a6e", roughness: 0.55 }),
    pine: new T.MeshStandardMaterial({ map: surface("wood", "#cfa978"), roughness: 0.78 }),
    gingham: new T.MeshStandardMaterial({ map: gingham, roughness: 0.92, side: T.DoubleSide }),
    chintz: new T.MeshStandardMaterial({ map: chintz, roughness: 0.95 }),
    rug: new T.MeshStandardMaterial({ map: rug, roughness: 1, alphaTest: 0.5 }),
    trim: mat("#efe6d0", 0.55),
    cream: mat("#f2ead6", 0.5),
    sage: mat("#7f9a7c", 0.5),
    sageDark: mat("#5e7a62", 0.55),
    door: mat("#6f8f86", 0.42),
    stone: mat("#9e978a", 0.85),
    hearth: mat("#6e665d", 0.8),
    soot: mat("#231d19", 0.95),
    iron: mat("#2c2b2a", 0.55, 0.45),
    ironLight: mat("#55524e", 0.5, 0.5),
    copper: mat("#c07a45", 0.3, 0.88),
    copperDark: mat("#94593a", 0.42, 0.8),
    brass: mat("#cda464", 0.3, 0.75),
    china: mat("#f3efe4", 0.18),
    chinaRose: mat("#e7b6bb", 0.2),
    chinaBlue: mat("#9fb8d0", 0.2),
    chinaGreen: mat("#a9c2a0", 0.2),
    chinaYellow: mat("#ead79a", 0.2),
    gold: mat("#d8b45a", 0.3, 0.7),
    tea: mat("#7a4523", 0.12),
    milk: mat("#f8f4ea", 0.3),
    whip: mat("#fbf6e6", 0.6),
    jam: mat("#a0212e", 0.28),
    sponge: mat("#e9c47e", 0.85),
    sugar: mat("#faf6ee", 0.9),
    scone: mat("#d6a159", 0.85),
    sconeTop: mat("#b97a3a", 0.8),
    dough: mat("#efe2c4", 0.9),
    flour: mat("#f6f1e6", 1),
    crust: mat("#b8772f", 0.82),
    crumb: mat("#eedcb5", 0.95),
    linen: mat("#f3eee2", 0.9),
    velvet: mat("#8e5258", 0.92),
    velvetDark: mat("#6e3c44", 0.95),
    cushion: mat("#c9a462", 0.95),
    ginger: mat("#d0843f", 0.95),
    gingerPale: mat("#efc89a", 0.95),
    leaf: mat("#55804a", 0.8),
    leafDark: mat("#3f6a3d", 0.8),
    lavender: mat("#a28bc4", 0.85),
    terracotta: mat("#ad6a4b", 0.82),
    soil: mat("#3f3427", 1),
    black: mat("#1e1c1a", 0.5),
    record: mat("#131313", 0.28),
    paper: mat("#f1ebd9", 0.9),
    ledger: mat("#6b2e2a", 0.7),
    sack: mat("#c6b08a", 1),
    wicker: mat("#b58c55", 0.9),
    enamel: mat("#efeadc", 0.25),
    enamelRim: mat("#2f4b58", 0.3),
    lace: mat("#f8f3e6", 0.95),
  };
  M.leaf.side = T.DoubleSide;
  M.leafDark.side = T.DoubleSide;
  // Things that glow, whose light changes with the hour.
  M.bulb = new T.MeshStandardMaterial({ color: "#fff2cf", emissive: "#ffcf86", emissiveIntensity: 0.5, roughness: 0.4 });
  M.shade = mat("#e8dcc0", 0.35, 0.1);
  M.shadeUnder = new T.MeshStandardMaterial({ color: "#f6ecd2", emissive: "#ffcf86", emissiveIntensity: 0.12, roughness: 0.6, side: T.BackSide });
  M.fireGlow = new T.MeshStandardMaterial({ color: "#2a1508", emissive: "#ff7a26", emissiveIntensity: 1.8, roughness: 0.9 });
  M.ovenGlow = new T.MeshStandardMaterial({ color: "#2a1508", emissive: "#ff8a3a", emissiveIntensity: 0.6, roughness: 0.9 });
  M.glass = new T.MeshPhysicalMaterial({ color: "#dfeeee", roughness: 0.06, transparent: true, opacity: 0.05, depthWrite: false });
  M.dome = new T.MeshPhysicalMaterial({ color: "#eef5f0", roughness: 0.05, transparent: true, opacity: 0.16, depthWrite: false, side: T.DoubleSide });
  M.cake = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });

  // ------------------------------------------------------------ the shared sheet
  const SIZE = 2048,
    sheetCanvas = document.createElement("canvas");
  sheetCanvas.width = sheetCanvas.height = SIZE;
  const sc = sheetCanvas.getContext("2d");
  sc.fillStyle = "#cdbfa0";
  sc.fillRect(0, 0, SIZE, SIZE);
  const sheetMap = new T.CanvasTexture(sheetCanvas);
  sheetMap.colorSpace = T.SRGBColorSpace;
  sheetMap.anisotropy = 8;
  M.sheet = new T.MeshStandardMaterial({ map: sheetMap, roughness: 0.72 });
  let cx = 0,
    cy = 0,
    rowH = 0;
  /** Reserves `w` × `h` pixels of the sheet and paints them; returns their UVs. */
  function cell(w, h, draw) {
    const pad = 4;
    if (cx + w + pad > SIZE) {
      cx = 0;
      cy += rowH + pad;
      rowH = 0;
    }
    if (cy + h > SIZE) throw Error("The Copper Kettle's sheet is full.");
    sc.save();
    sc.beginPath();
    sc.rect(cx, cy, w, h);
    sc.clip();
    sc.translate(cx, cy);
    draw(sc, w, h);
    sc.restore();
    const rect = { u0: cx / SIZE, u1: (cx + w) / SIZE, v0: 1 - (cy + h) / SIZE, v1: 1 - cy / SIZE };
    cx += w + pad;
    rowH = Math.max(rowH, h);
    sheetMap.needsUpdate = true;
    return rect;
  }
  /** A piece of the sheet on a plane, facing +z until turned. */
  function decal(rect, x, y, z, w, h, turn = 0, p = root, tilt = 0) {
    const g = new T.PlaneGeometry(w, h),
      { uv } = g.attributes;
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, rect.u0 + uv.getX(i) * (rect.u1 - rect.u0), rect.v0 + uv.getY(i) * (rect.v1 - rect.v0));
    const o = mesh(g, M.sheet, x, y, z, p);
    o.rotation.set(tilt, turn, 0, "YXZ");
    o.castShadow = false;
    return o;
  }
  /** A round piece of the sheet: a clock's face or a record's label. */
  function disc(rect, x, y, z, radius, p = root) {
    const g = new T.CircleGeometry(radius, 32),
      { uv } = g.attributes;
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, rect.u0 + uv.getX(i) * (rect.u1 - rect.u0), rect.v0 + uv.getY(i) * (rect.v1 - rect.v0));
    const o = mesh(g, M.sheet, x, y, z, p);
    o.castShadow = false;
    return o;
  }
  // Lettering on glass needs clear paper of its own.
  function clearDecal(pxW, pxH, draw, x, y, z, w, h, turn = 0) {
    const map = paint(pxW, pxH, draw, false),
      material = new T.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: 0.35, metalness: 0.3 });
    const o = mesh(new T.PlaneGeometry(w, h), material, x, y, z);
    o.rotation.y = turn;
    o.castShadow = o.receiveShadow = false;
    return o;
  }
  // Gold leaf, mirrored because the room sees it from behind.
  const goldLeaf = (c, w, h, lines) => {
    c.save();
    c.translate(w, 0);
    c.scale(-1, 1);
    for (const [text, y, size, style = "bold"] of lines) {
      c.font = `${style} ${size}px ${SERIF}`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillStyle = "#3a2410";
      c.fillText(text, w / 2 + 3, y + 3);
      c.fillStyle = "#d9b45a";
      c.fillText(text, w / 2, y);
    }
    c.restore();
  };
  /** Text, centred unless told otherwise, shrunk to fit `max`. */
  const text = (c, words, x, y, size, fill, { font = SERIF, weight = "", align = "center", max = Infinity } = {}) => {
    c.font = `${weight} ${size}px ${font}`;
    c.fillStyle = fill;
    c.textAlign = align;
    c.textBaseline = "middle";
    // fillText draws nothing at all when given an infinite width.
    if (Number.isFinite(max)) c.fillText(words, x, y, max);
    else c.fillText(words, x, y);
  };
  return { M, cell, decal, disc, clearDecal, goldLeaf, text, paint, shade, speckle, SERIF, HAND };
}
