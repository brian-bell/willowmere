import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createRoomKit } from "./interior-kit.js";
import {
  BALL_INDOORS,
  BALL_PICKUP,
  BARK_FETCHES,
  BARK_GREETINGS,
  BARK_PETS,
  BARK_TITLE,
  BARK_TREATS,
  BONE_LINE,
  DIG_BUSY,
  FISH_FEEDS,
  FISH_TITLE,
  NOTES,
  PUZZLE_LINES,
  ROSEWOOD_ROOM,
  TREASURE_LINES,
} from "./content/rosewood.js";
import {
  PUZZLE_PIECES,
  TREASURES,
  createTrail,
  dig,
  placePiece,
} from "./game/rosewood.js";

// Rosewood, your cottage, as a walkable room set. Room coordinates: +z is the
// front door, -z the back garden, +x the bedroom side; the eye is 2.45 above
// the floor, as in the bakery, so everything is a little larger than life.
//
//        z = 6   ┌──────── front door ────────┐
//                │ living    │ hall │ bedroom │
//                │ (aquarium,│      │ (bed,   │
//                │ fire)   ←─┤      ├─→ star  │
//        z = -0.6├───────────┘      └─────────┤
//                │ kitchen (range, table)     │
//        z = -5.4├──────────────── back door ─┤
//                │ garden (kennel, dig spot)  │
//        z = -10.6└───────────────────────────┘
//            x = -6.6                     x = 6.6
export const ROSEWOOD_PLAN = {
  halfWidth: 6.6,
  front: 6,
  partition: -0.6,
  back: -5.4,
  garden: -10.6,
  hall: 1.2,
  ceiling: 4.4,
  // Openings along the walls: [from, to].
  livingDoor: [3, 4.8],
  bedroomDoor: [0.2, 2],
  backDoor: [3, 4.6],
};

const pick = (list, n) => list[n % list.length];
// How far behind the visitor Bark keeps when following.
const BARK_GAP = 2.1;

export function createRosewood({ state, save }) {
  const P = ROSEWOOD_PLAN;
  const W = P.halfWidth,
    H = P.ceiling,
    WT = 0.24,
    DOOR = 3.3;
  const scene = new T.Scene();
  scene.background = new T.Color("#a9cbd6");
  const root = new T.Group();
  scene.add(root);
  const {
    random,
    range,
    mat,
    surface,
    mesh,
    box,
    orb,
    cyl,
    torus,
    tube,
    beam,
    group,
    leaf,
    arch,
    plaque,
    bake,
  } = createRoomKit(root, 5150);
  const colliders = [];
  // Moving things stay out of the bake.
  const keep = new Set();

  // ---------------------------------------------------------------- textures
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
  const speckle = (c, w, h, n, light, darkness) => {
    for (let i = 0; i < n; i++) {
      c.fillStyle =
        random() > 0.5
          ? `rgba(255,240,210,${range(0.02, light)})`
          : `rgba(40,25,15,${range(0.02, darkness)})`;
      c.fillRect(random() * w, random() * h, range(0.6, 2.4), range(0.6, 2.4));
    }
  };
  const textured = (map, roughness = 0.85, extra = {}) =>
    new T.MeshStandardMaterial({ map, roughness, ...extra });
  // Wide oak floorboards with staggered butt joints.
  const plankTexture = paint(512, 512, (c) => {
    const tones = ["#b0804f", "#a37446", "#b98a59", "#9c6c40", "#ac7b4c"];
    for (let row = 0; row < 8; row++) {
      let x = -range(0, 300);
      while (x < 512) {
        const len = range(180, 340);
        c.fillStyle = tones[Math.floor(random() * tones.length)];
        c.fillRect(x, row * 64, len, 64);
        for (let i = 0; i < 14; i++) {
          c.strokeStyle = `rgba(60,35,18,${range(0.05, 0.16)})`;
          c.beginPath();
          const y = row * 64 + range(6, 58);
          c.moveTo(x, y);
          c.bezierCurveTo(x + len / 3, y + range(-4, 4), x + (2 * len) / 3, y + range(-4, 4), x + len, y);
          c.stroke();
        }
        c.fillStyle = "rgba(50,30,15,0.55)";
        c.fillRect(x, row * 64, 2, 64);
        x += len;
      }
      c.fillStyle = "rgba(50,30,15,0.5)";
      c.fillRect(0, row * 64, 512, 2);
    }
    speckle(c, 512, 512, 3000, 0.06, 0.08);
  });
  const planks = textured(plankTexture, 0.72, {
    bumpMap: plankTexture,
    bumpScale: 0.02,
  });
  // Terracotta and cream quarry tiles for the kitchen.
  const quarryTexture = paint(256, 256, (c) => {
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        c.fillStyle = (i + j) % 2 ? "#c07a55" : "#e9d9bb";
        c.fillRect(i * 64, j * 64, 64, 64);
      }
    c.strokeStyle = "#8d7a66";
    c.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      c.beginPath();
      c.moveTo(i * 64, 0);
      c.lineTo(i * 64, 256);
      c.moveTo(0, i * 64);
      c.lineTo(256, i * 64);
      c.stroke();
    }
    speckle(c, 256, 256, 2500, 0.08, 0.08);
  });
  const quarry = textured(quarryTexture, 0.6);
  // Rose-striped wallpaper with sprigs, for the living room.
  const rosePaper = textured(
    paint(256, 256, (c) => {
      c.fillStyle = "#ecd2c6";
      c.fillRect(0, 0, 256, 256);
      c.fillStyle = "#e3bfb2";
      for (let x = 0; x < 256; x += 64) c.fillRect(x, 0, 22, 256);
      for (let i = 0; i < 8; i++) {
        const x = (i % 4) * 64 + 43,
          y = Math.floor(i / 4) * 128 + (i % 2) * 64 + 32;
        c.fillStyle = "#7f9c72";
        c.beginPath();
        c.ellipse(x - 6, y + 6, 6, 3, 0.6, 0, Math.PI * 2);
        c.ellipse(x + 6, y + 6, 6, 3, -0.6, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#c46f72";
        c.beginPath();
        c.arc(x, y, 6, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#e89a98";
        c.beginPath();
        c.arc(x - 1.5, y - 1.5, 3, 0, Math.PI * 2);
        c.fill();
      }
      speckle(c, 256, 256, 1200, 0.05, 0.04);
    }),
    0.92,
  );
  // Soft blue paper with tiny white stars, for the bedroom.
  const bluePaper = textured(
    paint(256, 256, (c) => {
      c.fillStyle = "#c3d3dc";
      c.fillRect(0, 0, 256, 256);
      c.fillStyle = "#f3f1e6";
      for (let i = 0; i < 16; i++) {
        const x = (i % 4) * 64 + (Math.floor(i / 4) % 2) * 32 + 16,
          y = Math.floor(i / 4) * 64 + 32;
        c.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = (k * Math.PI) / 5 - Math.PI / 2,
            r = k % 2 ? 2.5 : 6;
          c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        c.fill();
      }
      speckle(c, 256, 256, 1200, 0.05, 0.04);
    }),
    0.92,
  );
  // Butter-yellow kitchen wall and white tiles below it.
  const butterPaper = textured(surface("plaster", "#ecd69c"), 0.92);
  const tileTexture = paint(128, 128, (c) => {
    c.fillStyle = "#c9cbc2";
    c.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        c.fillStyle = (i * 3 + j * 5) % 7 === 0 ? "#a9c4c9" : "#f2f1ea";
        c.fillRect(i * 32 + 1.5, j * 32 + 1.5, 29, 29);
      }
  });
  const tiles = textured(tileTexture, 0.3);
  const hallPlaster = textured(surface("plaster", "#efe3c8"), 0.92);
  const ceilingPlaster = textured(surface("plaster", "#f2e8d3"), 0.95);
  const exteriorPlaster = textured(surface("plaster", "#e6d8b7"), 0.95);
  const oakTexture = surface("wood", "#a87449");
  const oak = textured(oakTexture, 0.66);
  const walnut = textured(surface("wood", "#6b4630"), 0.62);
  const paleWood = textured(surface("wood", "#d1b289"), 0.7);
  const grassTexture = paint(256, 256, (c) => {
    c.fillStyle = "#7ea456";
    c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      c.strokeStyle = random() > 0.5 ? "rgba(160,200,105,0.5)" : "rgba(60,100,45,0.45)";
      const x = random() * 256,
        y = random() * 256;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + range(-2, 2), y - range(3, 7));
      c.stroke();
    }
  });
  const lawn = textured(grassTexture, 0.95);
  const stone = textured(surface("plaster", "#b9ad97"), 0.9);
  const trim = mat("#f3ecdc", 0.6),
    sage = mat("#7d9a80", 0.7),
    sageDark = mat("#5e7d66", 0.7),
    sageLight = mat("#a3b89c", 0.7),
    brass = mat("#c9a15e", 0.32, 0.7),
    copper = mat("#b9704a", 0.34, 0.7),
    silver = mat("#d4d6d6", 0.25, 0.8),
    porcelain = mat("#eef0ea", 0.25),
    willow = mat("#6f8fb8", 0.3),
    dark = mat("#2b2724", 0.8),
    soot = mat("#1c1715", 1),
    cream = mat("#f1e6cc", 0.9),
    linen = mat("#efe9dc", 0.95),
    rose = mat("#c9787a", 0.95),
    roseLight = mat("#e3a7a2", 0.95),
    mustard = mat("#d8a440", 0.95),
    teal = mat("#4f8a86", 0.9),
    plum = mat("#8a5a78", 0.95),
    moss = mat("#6f8d4f", 0.95),
    brickRed = mat("#a8614a", 0.9),
    brickWarm = mat("#bf7b5a", 0.9),
    terracotta = mat("#b86f4f", 0.85),
    roofBlue = mat("#6f8d96", 0.8),
    white = mat("#fbf8f0", 0.7),
    leafMats = ["#4e7a48", "#68904f", "#86a356", "#3c6644"].map((c) => {
      const m = mat(c, 0.8);
      m.side = T.DoubleSide;
      return m;
    }),
    bloomMats = ["#e5a0a8", "#f2d27a", "#c7b4e0", "#f4f0e6", "#e07a6b"].map((c) => mat(c, 0.8));
  const windowMat = new T.MeshStandardMaterial({
    color: "#e9f1d4",
    emissive: "#fff3cf",
    emissiveIntensity: 0.55,
    roughness: 0.2,
  });
  const glass = new T.MeshPhysicalMaterial({
    color: "#dfeeee",
    roughness: 0.05,
    transmission: 0,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });
  // One vertex-coloured material for the figures that move (Bark, fish,
  // the robin), so each moving part is a single draw.
  const painted = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });

  // A box whose texture repeats every `tile` metres instead of stretching.
  function tiled(m, x, y, z, w, h, d, tile = 1.2, p = root) {
    const g = new T.BoxGeometry(w, h, d),
      uv = g.attributes.uv,
      sizes = [
        [d, h],
        [d, h],
        [w, d],
        [w, d],
        [w, h],
        [w, h],
      ];
    for (let f = 0; f < 6; f++)
      for (let i = 0; i < 4; i++) {
        const k = f * 4 + i;
        uv.setXY(k, (uv.getX(k) * sizes[f][0]) / tile, (uv.getY(k) * sizes[f][1]) / tile);
      }
    return mesh(g, m, x, y, z, p);
  }
  // Merges shapes into one vertex-coloured mesh: [geometry, colour, position,
  // scale?, rotation?] each.
  const unitSphere = new T.SphereGeometry(1, 16, 12),
    unitCylinder = new T.CylinderGeometry(1, 1, 1, 14),
    unitCone = new T.ConeGeometry(1, 1, 12),
    unitBox = new T.BoxGeometry(1, 1, 1);
  const transform = new T.Matrix4(),
    euler = new T.Euler(),
    quat = new T.Quaternion();
  function figure(parts, parent, x = 0, y = 0, z = 0) {
    const pieces = parts.map(([geo, color, pos, scale = [1, 1, 1], rot = [0, 0, 0]]) => {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      transform.compose(
        new T.Vector3(...pos),
        quat.setFromEuler(euler.set(...rot)),
        new T.Vector3(...scale),
      );
      g.applyMatrix4(transform);
      const c = new T.Color(color),
        count = g.attributes.position.count,
        colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) colors.set([c.r, c.g, c.b], i * 3);
      g.setAttribute("color", new T.BufferAttribute(colors, 3));
      return g;
    });
    const merged = mergeGeometries(pieces);
    pieces.forEach((g) => g.dispose());
    const m = new T.Mesh(merged, painted);
    m.position.set(x, y, z);
    m.castShadow = false;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  const S = unitSphere,
    C = unitCylinder,
    K = unitCone,
    B = unitBox;

  // ------------------------------------------------------------------ walls
  // A wall along x at z = `at` ("x"), or along z at x = `at` ("z"), from
  // `from` to `to`, with a finish on each face ([toward -, toward +]; null
  // for none) and openings that run to `top` (a door's height by default).
  function wallRun(axis, at, from, to, [minus, plus], openings = [], collide = true) {
    let s = from;
    const spans = [];
    for (const o of [...openings].sort((a, b) => a.from - b.from)) {
      if (o.from > s) spans.push([s, o.from, 0]);
      spans.push([o.from, o.to, o.top ?? DOOR]);
      s = o.to;
    }
    if (s < to) spans.push([s, to, 0]);
    for (const [a, b, y0] of spans) {
      const length = b - a,
        mid = (a + b) / 2,
        height = H - y0,
        y = y0 + height / 2;
      for (const [side, m] of [
        [-1, minus],
        [1, plus],
      ]) {
        if (!m) continue;
        const offset = (side * WT) / 4,
          piece =
            axis === "x"
              ? tiled(m, mid, y, at + offset, length, height, WT / 2)
              : tiled(m, at + offset, y, mid, WT / 2, height, length);
        piece.castShadow = false;
        // Skirting boards along the foot of each solid face.
        if (y0 === 0) {
          const skirt =
            axis === "x"
              ? box(trim, mid, 0.13, at + side * (WT / 2 + 0.02), length, 0.26, 0.05, 0.01)
              : box(trim, at + side * (WT / 2 + 0.02), 0.13, mid, 0.05, 0.26, length, 0.01);
          skirt.castShadow = false;
        }
      }
      if (collide && y0 === 0)
        colliders.push(
          axis === "x"
            ? { x: mid, z: at, w: length, d: WT }
            : { x: at, z: mid, w: WT, d: length },
        );
    }
    // Painted casings round each doorway, on both faces.
    for (const o of openings) {
      if (o.casing === false) continue;
      const top = o.top ?? DOOR;
      for (const side of [-1, 1]) {
        const face = at + side * (WT / 2 + 0.03);
        for (const edge of [o.from, o.to]) {
          const jamb =
            axis === "x"
              ? box(trim, edge, top / 2, face, 0.16, top, 0.06, 0.012)
              : box(trim, face, top / 2, edge, 0.06, top, 0.16, 0.012);
          jamb.castShadow = false;
        }
        const head =
          axis === "x"
            ? box(trim, (o.from + o.to) / 2, top + 0.08, face, o.to - o.from + 0.36, 0.16, 0.07, 0.012)
            : box(trim, face, top + 0.08, (o.from + o.to) / 2, 0.07, 0.16, o.to - o.from + 0.36, 0.012);
        head.castShadow = false;
      }
    }
  }
  const { livingDoor, bedroomDoor, backDoor } = P;
  const hallX = P.hall;
  // Outer walls: the walker's bounds keep the visitor off them.
  wallRun("x", P.front + WT / 2, -W, -hallX, [rosePaper, null], [], false);
  wallRun("x", P.front + WT / 2, -hallX, hallX, [hallPlaster, null], [], false);
  wallRun("x", P.front + WT / 2, hallX, W, [bluePaper, null], [], false);
  wallRun("z", -W - WT / 2, P.partition, P.front, [null, rosePaper], [], false);
  wallRun("z", -W - WT / 2, P.back, P.partition, [null, butterPaper], [], false);
  wallRun("z", W + WT / 2, P.partition, P.front, [bluePaper, null], [], false);
  wallRun("z", W + WT / 2, P.back, P.partition, [butterPaper, null], [], false);
  // The kitchen's back wall, cottage plaster on the garden side.
  wallRun("x", P.back - WT / 2, -W, W, [exteriorPlaster, butterPaper], [
    { from: backDoor[0], to: backDoor[1] },
  ]);
  // Between the front rooms and the kitchen; the hall runs on under an arch.
  wallRun("x", P.partition, -W, -hallX, [butterPaper, rosePaper]);
  wallRun("x", P.partition, hallX, W, [butterPaper, bluePaper]);
  wallRun("x", P.partition, -hallX, hallX, [butterPaper, hallPlaster], [
    { from: -hallX, to: hallX, top: 3.6, casing: false },
  ]);
  // The hall's walls, with the living room's doorway near the front and the
  // bedroom's near the back.
  wallRun("z", -hallX, P.partition, P.front, [rosePaper, hallPlaster], [
    { from: livingDoor[0], to: livingDoor[1] },
  ]);
  wallRun("z", hallX, P.partition, P.front, [hallPlaster, bluePaper], [
    { from: bedroomDoor[0], to: bedroomDoor[1] },
  ]);
  // The arch's curved soffit.
  for (const side of [-1, 1]) {
    const a = group(0, 0, P.partition + side * (WT / 2 + 0.02), side > 0 ? 0 : Math.PI);
    for (const x of [-1, 1]) box(walnut, x * 1.12, 1.8, 0.02, 0.16, 3.6, 0.08, 0.02, a).castShadow = false;
    box(walnut, 0, 3.62, 0.02, 2.4, 0.16, 0.08, 0.02, a).castShadow = false;
  }
  // Hall wainscoting: sage panels below a rail. Kitchen tiles to the same height.
  function dado(axis, at, side, from, to, m, gaps = [], panels = true) {
    let s = from;
    const runs = [];
    for (const [a, b] of gaps) {
      if (a > s) runs.push([s, a]);
      s = b;
    }
    if (s < to) runs.push([s, to]);
    for (const [a, b] of runs) {
      const length = b - a,
        mid = (a + b) / 2,
        face = at + side * (WT / 2 + 0.03);
      const place = (mm, y, h, depth, off, len = length, c = mid) =>
        axis === "x"
          ? tiled(mm, c, y, face + side * off, len, h, depth, 0.5)
          : tiled(mm, face + side * off, y, c, depth, h, len, 0.5);
      place(m, 0.8, 1.6, 0.04, 0).castShadow = false;
      place(trim, 1.62, 0.09, 0.08, 0.03).castShadow = false;
      if (panels)
        for (let i = 0; i < Math.floor(length / 0.75); i++) {
          const n = Math.floor(length / 0.75),
            c = a + ((i + 0.5) * length) / n;
          place(sageLight, 0.85, 1.05, 0.03, 0.03, length / n - 0.18, c).castShadow = false;
        }
    }
  }
  dado("z", -hallX, 1, P.partition, P.front, sage, [livingDoor]);
  dado("z", hallX, -1, P.partition, P.front, sage, [bedroomDoor]);
  dado("x", P.front + WT / 2, -1, -hallX, hallX, sage, [[-0.85, 0.85]]);
  dado("x", P.back - WT / 2, 1, -W, W, tiles, [backDoor], false);
  dado("z", -W - WT / 2, 1, P.back, P.partition, tiles, [], false);
  dado("z", W + WT / 2, -1, P.back, P.partition, tiles, [], false);
  dado("x", P.partition, -1, -W, W, tiles, [[-hallX, hallX]], false);

  // -------------------------------------------------- floors and ceilings
  const floor = (m, x0, x1, z0, z1, tile) =>
    (tiled(m, (x0 + x1) / 2, -0.06, (z0 + z1) / 2, x1 - x0, 0.12, z1 - z0, tile).castShadow = false);
  floor(planks, -W - WT, W + WT, P.partition, P.front + WT, 3.2);
  floor(quarry, -W - WT, W + WT, P.back - WT, P.partition, 1.6);
  // Brass threshold strips where the boards meet the tiles.
  box(brass, 0, 0.005, P.partition, 2.3, 0.02, 0.1, 0.005).castShadow = false;
  const ceiling = tiled(ceilingPlaster, 0, H + 0.08, (P.back - WT + P.front + WT) / 2, 2 * W + 2 * WT, 0.16, P.front - P.back + 2 * WT, 2);
  ceiling.castShadow = false;
  // Exposed beams across the front rooms and kitchen.
  for (const z of [5, 2.6, 0.2, -2, -4.2])
    box(walnut, 0, H - 0.12, z, 2 * W, 0.24, 0.26, 0.03).castShadow = false;

  // ------------------------------------------------------------- windows
  // A window on a wall face; `rotation` turns its local +z into the room.
  function windowAt(x, y, z, rotation, w = 1.5, h = 1.7, curtain = rose, sill = true) {
    const g = group(x, y, z, rotation);
    const pane = box(windowMat, 0, 0, 0.01, w, h, 0.02, 0, g);
    pane.castShadow = false;
    for (const sx of [-1, 1]) box(trim, (sx * (w + 0.1)) / 2, 0, 0.05, 0.1, h + 0.2, 0.1, 0.012, g);
    for (const sy of [-1, 1]) box(trim, 0, (sy * (h + 0.1)) / 2, 0.05, w + 0.2, 0.1, 0.1, 0.012, g);
    box(trim, 0, 0, 0.05, 0.05, h, 0.05, 0.006, g);
    box(trim, 0, h * 0.18, 0.05, w, 0.05, 0.05, 0.006, g);
    if (sill) box(trim, 0, -h / 2 - 0.09, 0.14, w + 0.4, 0.07, 0.26, 0.015, g);
    if (curtain) {
      cyl(brass, 0, h / 2 + 0.3, 0.2, 0.025, w + 1.2, 0.025, g, 10).rotation.z = Math.PI / 2;
      for (const side of [-1, 1])
        for (let i = 0; i < 4; i++) {
          const fold = cyl(
            curtain,
            side * (w / 2 + 0.12 + i * 0.1),
            0.12,
            0.2 + (i % 2) * 0.04,
            0.07,
            h + 0.6,
            0.07,
            g,
            10,
          );
          fold.castShadow = false;
        }
      // A ruffled pelmet.
      box(curtain, 0, h / 2 + 0.36, 0.24, w + 0.9, 0.22, 0.06, 0.03, g).castShadow = false;
    }
    return g;
  }
  windowAt(-4.4, 2.3, P.front - 0.01, Math.PI, 1.6, 1.8, rose);
  windowAt(3.9, 2.3, P.front - 0.01, Math.PI, 1.6, 1.8, teal);
  windowAt(W - 0.01, 2.4, 0.4, -Math.PI / 2, 1.2, 1.6, teal);
  windowAt(-2.2, 2.75, P.back + 0.01, 0, 1.6, 1.3, mustard, false);
  // The same window seen from the garden, and the garden side's door frame.
  windowAt(-2.2, 2.75, P.back - WT - 0.01, Math.PI, 1.6, 1.3, null);

  // ------------------------------------------------------------ the hall
  // Front door, seen from inside: planked, with a little window and a knocker.
  const frontDoor = group(0, 0, P.front - 0.02, Math.PI);
  box(trim, 0, 1.68, 0.02, 1.84, 3.4, 0.06, 0.02, frontDoor).castShadow = false;
  box(sageDark, 0, 1.6, 0.06, 1.5, 3.15, 0.08, 0.03, frontDoor).castShadow = false;
  for (let i = -2; i <= 2; i++)
    box(sage, i * 0.28, 1.45, 0.11, 0.24, 2.7, 0.03, 0.01, frontDoor).castShadow = false;
  box(windowMat, 0, 2.75, 0.11, 0.6, 0.48, 0.03, 0.01, frontDoor).castShadow = false;
  box(trim, 0, 2.75, 0.12, 0.66, 0.06, 0.03, 0.005, frontDoor).castShadow = false;
  orb(brass, 0.55, 1.5, 0.18, 0.07, 0.07, 0.06, frontDoor);
  box(brass, 0, 0.9, 0.13, 0.5, 0.1, 0.02, 0.01, frontDoor);
  // A doormat that says hello.
  const matSign = plaque([["HELLO, FRIEND", 120, 0.52, "Georgia"]], 1.6, 0.6, "#9b7a4d", "#efe0bc");
  matSign.roughness = 1;
  box(matSign, 0, 0.012, P.front - 0.55, 1.6, 0.024, 0.65, 0.01).castShadow = false;
  // A striped runner the length of the hall.
  const runnerMat = textured(
    paint(64, 256, (c) => {
      c.fillStyle = "#8f4b46";
      c.fillRect(0, 0, 64, 256);
      for (const [x, w, col] of [
        [4, 6, "#e3c07b"],
        [54, 6, "#e3c07b"],
        [14, 4, "#304f4c"],
        [46, 4, "#304f4c"],
      ]) {
        c.fillStyle = col;
        c.fillRect(x, 0, w, 256);
      }
      for (let y = 0; y < 256; y += 32) {
        c.fillStyle = "#c98a5e";
        c.beginPath();
        c.moveTo(32, y + 4);
        c.lineTo(42, y + 16);
        c.lineTo(32, y + 28);
        c.lineTo(22, y + 16);
        c.fill();
      }
    }),
    1,
  );
  runnerMat.map.repeat.set(1, 3);
  box(runnerMat, 0, 0.012, 2.4, 1.3, 0.022, 5.2, 0.008).castShadow = false;
  // Coat hooks by the door: a peg rail, two coats, a scarf, a hat and Bark's lead.
  const pegs = group(hallX - 0.01, 0, 5.1, -Math.PI / 2);
  box(oak, 0, 3.0, 0.04, 1.4, 0.16, 0.05, 0.01, pegs);
  for (const x of [-0.5, 0, 0.5]) cyl(oak, x, 3.0, 0.12, 0.025, 0.16, 0.03, pegs, 8).rotation.x = Math.PI / 2;
  orb(mustard, -0.5, 2.45, 0.18, 0.24, 0.6, 0.1, pegs);
  orb(mustard, -0.5, 2.9, 0.16, 0.16, 0.12, 0.08, pegs);
  orb(teal, 0.02, 2.4, 0.2, 0.26, 0.68, 0.11, pegs);
  box(rose, 0.0, 2.6, 0.26, 0.12, 0.8, 0.03, 0.01, pegs);
  cyl(plum, 0.5, 3.1, 0.18, 0.2, 0.12, 0.17, pegs, 16);
  cyl(plum, 0.5, 3.04, 0.18, 0.3, 0.02, 0.3, pegs, 16);
  tube(mat("#b8423a", 0.7), [
    [0.5, 2.98, 0.12],
    [0.54, 2.5, 0.15],
    [0.46, 2.2, 0.14],
    [0.52, 2.55, 0.13],
  ], 0.02, pegs);
  // Wellies and an umbrella stand under the pegs.
  for (const [x, c] of [
    [-0.25, "#3f6b4a"],
    [-0.05, "#3f6b4a"],
  ]) {
    cyl(mat(c, 0.5), hallX - 0.25, 0.32, 4.6 + x, 0.09, 0.62, 0.09, root, 12);
    orb(mat(c, 0.5), hallX - 0.32, 0.06, 4.6 + x, 0.1, 0.06, 0.16);
  }
  cyl(copper, hallX - 0.3, 0.42, 5.75, 0.16, 0.84, 0.18, root, 16);
  beam(dark, [hallX - 0.3, 0.5, 5.75], [hallX - 0.35, 1.6, 5.7], 0.03);
  orb(dark, hallX - 0.35, 1.62, 5.7, 0.05, 0.08, 0.05);
  colliders.push({ x: hallX - 0.3, z: 5.75, r: 0.2 });
  // A slim console with a bowl for keys, a lamp and a mirror on the left wall.
  const consoleT = group(-hallX + 0.2, 0, 5.4, Math.PI / 2);
  box(oak, 0, 1.3, 0, 0.95, 0.06, 0.34, 0.015, consoleT);
  for (const x of [-0.42, 0.42]) box(oak, x, 0.65, 0, 0.05, 1.3, 0.3, 0.01, consoleT);
  box(oak, 0, 0.35, 0, 0.9, 0.04, 0.3, 0.01, consoleT);
  cyl(willow, -0.2, 1.38, 0, 0.14, 0.08, 0.1, consoleT, 16);
  box(brass, -0.2, 1.43, 0.02, 0.08, 0.01, 0.03, 0.003, consoleT);
  cyl(cream, 0.25, 1.45, 0, 0.08, 0.24, 0.06, consoleT, 16);
  orb(bloomMats[1], 0.25, 1.63, 0, 0.09, 0.09, 0.09, consoleT);
  orb(bloomMats[0], 0.18, 1.6, 0.05, 0.07, 0.07, 0.07, consoleT);
  torus(brass, 0, 2.35, -0.14, 0.42, 0.04, consoleT).castShadow = false;
  const mirror = cyl(mat("#c9d8dc", 0.05, 0.9), 0, 2.35, -0.15, 0.39, 0.02, 0.39, consoleT, 32);
  mirror.rotation.x = Math.PI / 2;
  mirror.castShadow = false;
  colliders.push({ x: -hallX + 0.2, z: 5.4, w: 0.36, d: 0.95 });
  // A stitched sampler.
  const sampler = plaque(
    [
      ["HOME IS WHERE", 86, 0.38, "Georgia"],
      ["THE DOG IS", 86, 0.62, "Georgia"],
    ],
    0.9,
    0.6,
    "#f0e6cf",
    "#9a4e4e",
  );
  const samplerFrame = group(-hallX + 0.15, 2.65, 0.5, Math.PI / 2);
  box(walnut, 0, 0, 0, 0.98, 0.68, 0.04, 0.01, samplerFrame);
  box(sampler, 0, 0, 0.025, 0.88, 0.58, 0.01, 0, samplerFrame).castShadow = false;
  // A ceiling lantern.
  beam(dark, [0, H, 3.2], [0, 4.05, 3.2], 0.02);
  cyl(brass, 0, 4.01, 3.2, 0.2, 0.06, 0.12, root, 16);
  const hallGlow = new T.MeshStandardMaterial({
    color: "#fff1c4",
    emissive: "#ffd78e",
    emissiveIntensity: 0.8,
  });
  cyl(hallGlow, 0, 3.8, 3.2, 0.16, 0.36, 0.16, root, 16).castShadow = false;
  cyl(brass, 0, 3.59, 3.2, 0.12, 0.06, 0.2, root, 16);

  // The cuckoo clock: a carved little house on the hall's left wall, with a
  // swinging pendulum and pine-cone weights.
  const clock = group(-hallX + 0.15, 2.95, 1.55, Math.PI / 2);
  box(walnut, 0, 0, 0, 0.62, 0.7, 0.26, 0.03, clock);
  for (const side of [-1, 1]) {
    const r = box(walnut, side * 0.2, 0.46, 0.02, 0.48, 0.07, 0.34, 0.015, clock);
    r.rotation.z = -side * 0.62;
  }
  for (let i = 0; i < 5; i++) leaf(leafMats[i % 4], -0.24 + i * 0.12, -0.34, 0.15, 0.04, 0.12, clock).rotation.z = Math.PI + (i - 2) * 0.2;
  const dial = cyl(cream, 0, -0.06, 0.135, 0.18, 0.02, 0.18, clock, 24);
  dial.rotation.x = Math.PI / 2;
  torus(brass, 0, -0.06, 0.145, 0.185, 0.012, clock);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    box(dark, Math.cos(a) * 0.14, -0.06 + Math.sin(a) * 0.14, 0.15, 0.02, 0.02, 0.01, 0, clock);
  }
  box(dark, 0, 0.21, 0.135, 0.16, 0.16, 0.01, 0, clock);
  const clockParts = group(0, 0, 0, 0, clock);
  keep.add(clockParts);
  const hourHand = box(dark, 0, -0.06, 0.16, 0.018, 0.1, 0.008, 0, clockParts);
  const minuteHand = box(dark, 0, -0.06, 0.165, 0.012, 0.15, 0.008, 0, clockParts);
  hourHand.geometry = hourHand.geometry.clone().translate(0, 0.05, 0);
  minuteHand.geometry = minuteHand.geometry.clone().translate(0, 0.07, 0);
  hourHand.position.y = minuteHand.position.y = -0.06;
  const doors = [-1, 1].map((side) => {
    const hinge = group(side * 0.08, 0.21, 0.14, 0, clockParts);
    box(walnut, -side * 0.04, 0, 0, 0.08, 0.16, 0.012, 0.004, hinge);
    return hinge;
  });
  const bird = figure(
    [
      [S, "#8a5a3a", [0, 0, 0], [0.06, 0.05, 0.08]],
      [S, "#8a5a3a", [0, 0.05, 0.05], [0.04, 0.04, 0.04]],
      [K, "#e0a63a", [0, 0.05, 0.1], [0.012, 0.04, 0.012], [Math.PI / 2, 0, 0]],
      [S, "#1c1715", [0.025, 0.065, 0.075], [0.008, 0.008, 0.008]],
      [S, "#1c1715", [-0.025, 0.065, 0.075], [0.008, 0.008, 0.008]],
      [S, "#6b4329", [0, 0.01, -0.07], [0.03, 0.02, 0.06]],
    ],
    clockParts,
    0,
    0.2,
    0.05,
  );
  const pendulum = group(0, -0.32, 0.06, 0, clockParts);
  box(brass, 0, -0.35, 0, 0.015, 0.7, 0.01, 0, pendulum);
  const bob = cyl(brass, 0, -0.72, 0.01, 0.07, 0.015, 0.07, pendulum, 16);
  bob.rotation.x = Math.PI / 2;
  for (const x of [-0.14, 0.14]) {
    beam(brass, [x, -0.34, 0.04], [x, -1.0 - (x > 0 ? 0.15 : 0), 0.04], 0.008, clock);
    orb(mat("#5a3a25", 0.9), x, -1.12 - (x > 0 ? 0.15 : 0), 0.04, 0.045, 0.1, 0.045, clock);
  }

  // Bark's treasure shelf, on the hall's right wall. Each find appears here.
  const shelf = group(hallX - 0.12, 0, 3.4, -Math.PI / 2);
  box(oak, 0, 2.2, 0, 1.9, 0.06, 0.24, 0.012, shelf);
  box(oak, 0, 2.95, 0, 1.9, 0.06, 0.24, 0.012, shelf);
  for (const x of [-0.95, 0.95]) box(oak, x, 2.58, 0, 0.06, 0.82, 0.24, 0.012, shelf);
  const shelfSign = plaque([["BARK'S TREASURES", 96, 0.5, "Georgia"]], 1.2, 0.2, "#f0dfb8", "#7a4b2e");
  box(shelfSign, 0, 3.15, 0.04, 1.2, 0.2, 0.02, 0, shelf).castShadow = false;
  const trinketShapes = {
    button: [
      [C, "#c9a15e", [0, 0.04, 0], [0.09, 0.03, 0.09], [Math.PI / 2, 0, 0]],
      [S, "#8a6a35", [0.03, 0.04, 0.02], [0.012, 0.012, 0.012]],
      [S, "#8a6a35", [-0.03, 0.04, 0.02], [0.012, 0.012, 0.012]],
    ],
    marble: [[S, "#4d7fc4", [0, 0.07, 0], [0.07, 0.07, 0.07]]],
    key: [
      [C, "#b89048", [0, 0.025, 0], [0.012, 0.22, 0.012], [0, 0, Math.PI / 2]],
      [C, "#b89048", [-0.13, 0.025, 0], [0.05, 0.015, 0.05], [Math.PI / 2, 0, 0]],
      [B, "#b89048", [0.1, 0.0, 0], [0.025, 0.05, 0.015]],
    ],
    shell: [
      [K, "#f0c4b4", [0, 0.07, 0], [0.08, 0.14, 0.05], [0, 0, -1.2]],
      [S, "#e8a898", [0.04, 0.05, 0], [0.05, 0.05, 0.04]],
    ],
    spoon: [
      [C, "#d4d6d6", [0, 0.015, 0.02], [0.012, 0.2, 0.008], [Math.PI / 2, 0, 0.3]],
      [S, "#d4d6d6", [0.03, 0.02, -0.09], [0.04, 0.012, 0.055]],
    ],
    soldier: [
      [C, "#2f4c7a", [0, 0.06, 0], [0.035, 0.12, 0.035]],
      [C, "#b8423a", [0, 0.16, 0], [0.04, 0.09, 0.04]],
      [S, "#e8c8a0", [0, 0.23, 0], [0.03, 0.03, 0.03]],
      [C, "#1c1715", [0, 0.28, 0], [0.028, 0.06, 0.028]],
    ],
  };
  const trinkets = new Map();
  TREASURES.forEach((t, i) => {
    const row = Math.floor(i / 3),
      x = -0.6 + (i % 3) * 0.6;
    const g = group(x, row ? 2.98 : 2.23, 0.02, 0, shelf);
    figure(trinketShapes[t.id], g);
    keep.add(g);
    trinkets.set(t.id, g);
  });
  const updateShelf = () => {
    for (const [id, g] of trinkets) g.visible = state.rosewood.treasures.includes(id);
  };
  updateShelf();
  // A row of framed photos of Bark's best days.
  const portrait = (draw) =>
    textured(
      paint(128, 160, (c) => {
        c.fillStyle = "#d9e4d1";
        c.fillRect(0, 0, 128, 160);
        draw(c);
      }, false),
      0.8,
    );
  const barkFace = (c, x, y, s) => {
    c.fillStyle = "#7a4f31";
    c.beginPath();
    c.ellipse(x - 22 * s, y + 4 * s, 10 * s, 20 * s, 0.3, 0, Math.PI * 2);
    c.ellipse(x + 22 * s, y + 4 * s, 10 * s, 20 * s, -0.3, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#c99559";
    c.beginPath();
    c.arc(x, y, 22 * s, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#f1dfbd";
    c.beginPath();
    c.ellipse(x, y + 10 * s, 12 * s, 9 * s, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#2a201c";
    for (const ex of [-8, 8]) {
      c.beginPath();
      c.arc(x + ex * s, y - 4 * s, 3 * s, 0, Math.PI * 2);
      c.fill();
    }
    c.beginPath();
    c.ellipse(x, y + 5 * s, 5 * s, 3.5 * s, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#e07a7a";
    c.beginPath();
    c.ellipse(x, y + 17 * s, 4 * s, 5 * s, 0, 0, Math.PI * 2);
    c.fill();
  };
  const photos = [
    portrait((c) => {
      c.fillStyle = "#a9cbd6";
      c.fillRect(0, 0, 128, 90);
      barkFace(c, 64, 92, 1.6);
    }),
    portrait((c) => {
      c.fillStyle = "#7ea456";
      c.fillRect(0, 100, 128, 60);
      barkFace(c, 54, 80, 1.1);
      c.fillStyle = "#d8453a";
      c.beginPath();
      c.arc(96, 118, 10, 0, Math.PI * 2);
      c.fill();
    }),
    portrait((c) => {
      c.fillStyle = "#f0e1bd";
      c.fillRect(0, 0, 128, 160);
      barkFace(c, 64, 80, 1.3);
      c.fillStyle = "#c9a15e";
      c.font = "bold 18px Georgia";
      c.textAlign = "center";
      c.fillText("GOOD BOY", 64, 146);
    }),
  ];
  photos.forEach((m, i) => {
    // Two in the hall by the living-room door, one by the kitchen's back door.
    const f =
      i < 2
        ? group(-hallX + 0.15, 2.45 + i * 0.62, 2.45, Math.PI / 2)
        : group(W - 0.02, 2.6, -4.6, -Math.PI / 2);
    box(walnut, 0, 0, 0, 0.34, 0.42, 0.03, 0.008, f);
    box(m, 0, 0, 0.018, 0.28, 0.36, 0.006, 0, f).castShadow = false;
  });

  // --------------------------------------------------------- living room
  // The fireplace on the left wall: a brick breast, a deep firebox and a
  // mantel crowded with small things.
  const fire = group(-W, 0, 2.6, Math.PI / 2);
  box(mat("#d9c7a6", 0.9), 0, H / 2, 0.36, 2.5, H, 0.72, 0.04, fire).castShadow = false;
  for (let row = 0; row < 9; row++)
    for (let i = 0; i < 6; i++) {
      const x = -1.05 + i * 0.42 + (row % 2) * 0.21;
      if (Math.abs(x) < 0.75 && row < 6) continue;
      if (x > 1.12) continue;
      box(row % 3 ? brickRed : brickWarm, x, 0.12 + row * 0.24, 0.73, 0.38, 0.2, 0.04, 0.01, fire).castShadow = false;
    }
  box(soot, 0, 0.75, 0.6, 1.4, 1.5, 0.3, 0.02, fire).castShadow = false;
  box(stone, 0, 0.05, 1.0, 2.8, 0.1, 0.9, 0.02, fire).castShadow = false;
  box(oak, 0, 2.2, 0.82, 2.8, 0.14, 0.42, 0.025, fire);
  for (const x of [-1.2, 1.2]) box(oak, x, 2.07, 0.86, 0.14, 0.14, 0.3, 0.02, fire);
  // Logs and a flickering fire.
  for (let i = 0; i < 3; i++) {
    const log = cyl(mat("#4a2e1d", 0.95), -0.25 + i * 0.25, 0.22 + (i === 1 ? 0.12 : 0), 0.65, 0.09, 0.9, 0.09, fire, 12);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i - 1) * 0.3;
  }
  for (const x of [-0.45, 0.45]) {
    beam(dark, [x, 0.12, 0.85], [x, 0.4, 0.85], 0.04, fire);
    orb(brass, x, 0.44, 0.85, 0.05, 0.05, 0.05, fire);
  }
  const flameMat = new T.MeshBasicMaterial({
    color: "#ff7c32",
    transparent: true,
    opacity: 0.75,
    blending: T.AdditiveBlending,
    depthWrite: false,
  });
  const flames = [];
  for (let i = 0; i < 5; i++) {
    const f = mesh(new T.ConeGeometry(0.15 - (i % 2) * 0.04, 0.85 - (i % 2) * 0.25, 10), flameMat, -0.32 + i * 0.16, 0.7, 0.66, fire);
    f.castShadow = f.receiveShadow = false;
    flames.push(f);
  }
  const fireLight = new T.PointLight("#ff9a45", 6, 7, 2);
  fireLight.position.set(-W + 1.2, 0.9, 2.6);
  scene.add(fireLight);
  // On the mantel: a carriage clock, candlesticks, a photo and a little vase.
  box(walnut, 0, 2.45, 0.8, 0.3, 0.36, 0.16, 0.03, fire);
  const carriage = cyl(cream, 0, 2.47, 0.89, 0.1, 0.02, 0.1, fire, 20);
  carriage.rotation.x = Math.PI / 2;
  for (const x of [-1.0, 1.0]) {
    cyl(brass, x, 2.33, 0.8, 0.07, 0.06, 0.05, fire, 12);
    cyl(brass, x, 2.45, 0.8, 0.02, 0.2, 0.02, fire, 8);
    cyl(cream, x, 2.68, 0.8, 0.03, 0.28, 0.03, fire, 10);
  }
  const mantelPhoto = group(0.55, 2.5, 0.78, -0.2, fire);
  box(brass, 0, 0, 0, 0.26, 0.32, 0.02, 0.006, mantelPhoto);
  box(photos[0], 0, 0, 0.012, 0.2, 0.26, 0.004, 0, mantelPhoto).castShadow = false;
  cyl(willow, -0.55, 2.38, 0.8, 0.06, 0.2, 0.08, fire, 12);
  for (let i = 0; i < 3; i++) orb(bloomMats[i], -0.55 + (i - 1) * 0.05, 2.52 + i * 0.03, 0.8, 0.05, 0.05, 0.05, fire);
  // A painting of the millpond above the mantel.
  const painting = textured(
    paint(320, 200, (c) => {
      const sky = c.createLinearGradient(0, 0, 0, 120);
      sky.addColorStop(0, "#9cc3d6");
      sky.addColorStop(1, "#f1e3c0");
      c.fillStyle = sky;
      c.fillRect(0, 0, 320, 200);
      c.fillStyle = "#7c9c5c";
      c.beginPath();
      c.moveTo(0, 120);
      c.bezierCurveTo(80, 80, 200, 95, 320, 110);
      c.lineTo(320, 200);
      c.lineTo(0, 200);
      c.fill();
      c.fillStyle = "#6d9bb0";
      c.beginPath();
      c.ellipse(170, 160, 120, 26, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#e8dcc0";
      c.fillRect(60, 88, 40, 30);
      c.fillStyle = "#b77e61";
      c.beginPath();
      c.moveTo(54, 90);
      c.lineTo(80, 70);
      c.lineTo(106, 90);
      c.fill();
      c.fillStyle = "#4e7a48";
      for (const [x, y, r] of [
        [240, 92, 22],
        [268, 100, 16],
        [30, 104, 14],
      ]) {
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fill();
      }
    }, false),
    0.85,
  );
  box(walnut, 0, 3.25, 0.75, 1.7, 1.1, 0.05, 0.02, fire);
  box(painting, 0, 3.25, 0.78, 1.5, 0.9, 0.01, 0, fire).castShadow = false;
  colliders.push({ x: -W + 0.5, z: 2.6, w: 1.0, d: 2.9 });

  // Bark's basket by the fire, with a squashed cushion and a toy duck.
  const basket = group(-5.55, 0, 0.45);
  const wicker = textured(
    paint(64, 64, (c) => {
      c.fillStyle = "#b98d55";
      c.fillRect(0, 0, 64, 64);
      for (let y = 0; y < 64; y += 8)
        for (let x = 0; x < 64; x += 8) {
          c.fillStyle = (x + y) % 16 ? "#9c7140" : "#d2a86b";
          c.fillRect(x + 1, y + 1, 6, 6);
        }
    }),
    0.95,
  );
  cyl(wicker, 0, 0.22, 0, 0.62, 0.44, 0.55, basket, 24);
  torus(wicker, 0, 0.44, 0, 0.62, 0.07, basket).rotation.x = Math.PI / 2;
  cyl(mat("#7d9ac2", 0.95), 0, 0.42, 0, 0.55, 0.12, 0.55, basket, 24);
  orb(mustard, 0.25, 0.53, 0.18, 0.1, 0.08, 0.09, basket);
  orb(mustard, 0.25, 0.62, 0.24, 0.06, 0.06, 0.06, basket);
  colliders.push({ x: -5.55, z: 0.45, r: 0.62 });

  // A record player on a little cabinet in the corner.
  const record = group(-5.95, 0, 5.4, Math.PI * 0.85);
  box(walnut, 0, 0.6, 0, 1.05, 1.2, 0.7, 0.03, record);
  for (const x of [-0.25, 0.25]) box(oak, x, 0.6, 0.36, 0.44, 0.95, 0.03, 0.012, record);
  for (const x of [-0.08, 0.08]) orb(brass, x, 0.72, 0.39, 0.03, 0.03, 0.02, record);
  box(oak, 0, 1.24, 0, 1.0, 0.08, 0.66, 0.015, record);
  cyl(dark, 0, 1.3, 0, 0.3, 0.04, 0.3, record, 32);
  const disc = group(0, 1.33, 0, 0, record);
  keep.add(disc);
  cyl(mat("#1b1918", 0.35), 0, 0, 0, 0.27, 0.01, 0.27, disc, 32);
  cyl(mat("#c9473e", 0.6), 0, 0.006, 0, 0.08, 0.01, 0.08, disc, 20);
  box(cream, 0.04, 0.012, 0, 0.04, 0.004, 0.02, 0, disc);
  const tonearm = group(0.36, 1.36, -0.2, 0, record);
  keep.add(tonearm);
  cyl(silver, 0, 0, 0, 0.04, 0.06, 0.04, tonearm, 12);
  box(silver, -0.12, 0.03, 0.14, 0.02, 0.02, 0.36, 0.005, tonearm).rotation.y = 0.6;
  // The horn.
  const horn = mesh(new T.CylinderGeometry(0.34, 0.04, 0.7, 24, 1, true), brass, -0.3, 1.75, -0.18, record);
  horn.material = brass.clone();
  horn.material.side = T.DoubleSide;
  horn.rotation.z = 0.9;
  horn.rotation.y = 0.4;
  beam(brass, [-0.1, 1.3, -0.15], [-0.08, 1.52, -0.18], 0.05, record);
  colliders.push({ x: -5.95, z: 5.4, r: 0.65 });

  // The aquarium on its stand against the front wall.
  const tank = group(-2.45, 0, 5.55, Math.PI);
  box(oak, 0, 0.5, 0, 1.85, 1.0, 0.75, 0.03, tank);
  for (const x of [-0.45, 0.45]) box(walnut, x, 0.5, 0.38, 0.8, 0.8, 0.02, 0.01, tank);
  box(oak, 0, 1.02, 0, 1.9, 0.06, 0.8, 0.015, tank);
  // Inside the glass: sand, pebbles, weed, a little castle and a chest.
  const TANK = { w: 1.7, h: 1.05, d: 0.62, y: 1.05 };
  box(mat("#e9d6a6", 1), 0, TANK.y + 0.05, 0, TANK.w - 0.04, 0.1, TANK.d - 0.04, 0.02, tank).castShadow = false;
  for (let i = 0; i < 26; i++)
    orb(
      mat(["#9aa3a6", "#c9b48a", "#7d8a8e", "#d7c7b4"][i % 4], 0.6),
      range(-0.8, 0.8),
      TANK.y + 0.11,
      range(-0.26, 0.26),
      range(0.025, 0.05),
      0.02,
      range(0.025, 0.05),
      tank,
    ).castShadow = false;
  for (let i = 0; i < 9; i++) {
    const x = -0.75 + random() * 0.4 + (i > 4 ? 1.05 : 0),
      zz = range(-0.2, 0.15);
    for (let j = 0; j < 4; j++) {
      const blade = leaf(leafMats[(i + j) % 4], x + j * 0.02, TANK.y + 0.1, zz, 0.035, range(0.35, 0.7), tank);
      blade.rotation.set(range(-0.15, 0.15), j * 1.4, range(-0.2, 0.2));
      blade.castShadow = false;
    }
  }
  const castle = group(0.42, TANK.y + 0.1, -0.08, 0, tank);
  box(mat("#d7c7b4", 0.8), 0, 0.14, 0, 0.26, 0.28, 0.18, 0.01, castle);
  for (const x of [-0.13, 0.13]) {
    cyl(mat("#d7c7b4", 0.8), x, 0.22, 0, 0.06, 0.44, 0.06, castle, 12);
    mesh(new T.ConeGeometry(0.075, 0.14, 12), terracotta, x, 0.51, 0, castle);
  }
  box(soot, 0, 0.07, 0.092, 0.08, 0.13, 0.01, 0, castle);
  const chest = group(-0.15, TANK.y + 0.1, 0.1, 0.3, tank);
  box(walnut, 0, 0.05, 0, 0.18, 0.1, 0.12, 0.01, chest);
  box(brass, 0, 0.06, 0.062, 0.03, 0.04, 0.005, 0, chest);
  const lid = group(0, 0.1, -0.06, 0, chest);
  keep.add(lid);
  box(walnut, 0, 0.02, 0.06, 0.18, 0.04, 0.12, 0.01, lid);
  orb(mat("#f3d36a", 0.3, 0.6), 0.03, 0.1, 0.0, 0.03, 0.025, 0.03, chest);
  orb(mat("#f3d36a", 0.3, 0.6), -0.03, 0.105, 0.01, 0.025, 0.02, 0.025, chest);
  // Water, the glass and the hood with its strip light.
  const water = new T.MeshStandardMaterial({
    color: "#7fc0cf",
    transparent: true,
    opacity: 0.22,
    roughness: 0.1,
    depthWrite: false,
  });
  box(water, 0, TANK.y + TANK.h * 0.46, 0, TANK.w - 0.03, TANK.h * 0.88, TANK.d - 0.03, 0, tank).castShadow = false;
  box(glass, 0, TANK.y + TANK.h / 2, 0, TANK.w, TANK.h, TANK.d, 0.01, tank).castShadow = false;
  for (const x of [-1, 1])
    for (const zz of [-1, 1])
      box(dark, (x * TANK.w) / 2, TANK.y + TANK.h / 2, (zz * TANK.d) / 2, 0.03, TANK.h, 0.03, 0.005, tank);
  box(sageDark, 0, TANK.y + TANK.h + 0.05, 0, TANK.w + 0.06, 0.1, TANK.d + 0.06, 0.02, tank);
  const tankLight = new T.MeshStandardMaterial({ color: "#d8f4ff", emissive: "#b8ecff", emissiveIntensity: 1.2 });
  box(tankLight, 0, TANK.y + TANK.h - 0.005, 0, TANK.w - 0.2, 0.02, 0.06, 0, tank).castShadow = false;
  colliders.push({ x: -2.45, z: 5.55, w: 1.95, d: 0.85 });
  // Five fish, each a body and a wagging tail.
  const fishSpecs = [
    ["#f08a3c", "#f6b36a", 1.0],
    ["#4a8fd4", "#9cc8ee", 0.85],
    ["#f2c84b", "#f7e08c", 0.9],
    ["#e88aa8", "#f4bccb", 1.1],
    ["#f5f2ea", "#f08a3c", 0.7],
  ];
  const fish = fishSpecs.map(([body, fin, size], i) => {
    const g = group(0, TANK.y + 0.5, 0, 0, tank);
    keep.add(g);
    figure(
      [
        [S, body, [0, 0, 0], [0.035, 0.055, 0.1]],
        [S, fin, [0, 0.055, -0.01], [0.006, 0.035, 0.045], [-0.4, 0, 0]],
        [S, fin, [0.03, -0.01, 0.02], [0.004, 0.02, 0.03], [0, 0, 0.6]],
        [S, fin, [-0.03, -0.01, 0.02], [0.004, 0.02, 0.03], [0, 0, -0.6]],
        [S, "#1c1715", [0.026, 0.015, 0.06], [0.012, 0.012, 0.012]],
        [S, "#1c1715", [-0.026, 0.015, 0.06], [0.012, 0.012, 0.012]],
        ...(i === 4
          ? [[S, "#f08a3c", [0, 0, 0.01], [0.037, 0.035, 0.025]]]
          : []),
      ],
      g,
    );
    const tail = group(0, 0, -0.09, 0, g);
    figure([[S, fin, [0, 0, -0.05], [0.006, 0.05, 0.055], [0.0, 0, 0]]], tail);
    g.scale.setScalar(size);
    return {
      group: g,
      tail,
      phase: i * 1.7,
      speed: 0.25 + i * 0.04,
      lane: -0.16 + i * 0.08,
      height: 0.28 + ((i * 37) % 5) * 0.11,
      heading: 0,
    };
  });
  // Bubbles from the chest, and the flakes the fish are fed.
  const bubbleMat = new T.MeshStandardMaterial({
    color: "#eaf8ff",
    transparent: true,
    opacity: 0.45,
    roughness: 0.05,
    depthWrite: false,
  });
  const bubbles = new T.InstancedMesh(new T.SphereGeometry(1, 8, 6), bubbleMat, 12);
  bubbles.castShadow = bubbles.receiveShadow = false;
  bubbles.frustumCulled = false;
  tank.add(bubbles);
  const flakes = new T.InstancedMesh(new T.BoxGeometry(0.03, 0.006, 0.025), mat("#d9a25b", 0.9), 18);
  flakes.castShadow = flakes.receiveShadow = false;
  flakes.frustumCulled = false;
  flakes.visible = false;
  tank.add(flakes);
  const flakeSeeds = Array.from({ length: 18 }, () => [range(-0.35, 0.35), range(-0.2, 0.2), range(0, 1)]);

  // The jigsaw on the coffee table: a picture of the village green, filled
  // in as pieces are fitted.
  const coffee = group(-3.95, 0, 1.45, Math.PI / 2);
  box(oak, 0, 0.78, 0, 1.75, 0.08, 1.05, 0.03, coffee);
  for (const x of [-0.75, 0.75]) for (const zz of [-0.42, 0.42]) cyl(oak, x, 0.38, zz, 0.05, 0.76, 0.04, coffee, 12);
  box(oak, 0, 0.22, 0, 1.5, 0.04, 0.85, 0.012, coffee);
  for (let i = 0; i < 3; i++) box([rose, teal, mustard][i], -0.3 + i * 0.05, 0.27 + i * 0.05, 0.1, 0.5, 0.05, 0.36, 0.01, coffee);
  const picture = document.createElement("canvas");
  picture.width = 512;
  picture.height = 384;
  {
    const c = picture.getContext("2d");
    const sky = c.createLinearGradient(0, 0, 0, 200);
    sky.addColorStop(0, "#8fbcd4");
    sky.addColorStop(1, "#f2e6c4");
    c.fillStyle = sky;
    c.fillRect(0, 0, 512, 384);
    c.fillStyle = "#86a85c";
    c.fillRect(0, 210, 512, 174);
    c.fillStyle = "#e3d3a8";
    c.beginPath();
    c.ellipse(256, 300, 150, 60, 0, 0, Math.PI * 2);
    c.fill();
    for (const [x, w, roof] of [
      [40, 110, "#6f8d96"],
      [190, 120, "#b77e61"],
      [360, 110, "#6f8d96"],
    ]) {
      c.fillStyle = "#efe3c4";
      c.fillRect(x, 140, w, 80);
      c.fillStyle = roof;
      c.beginPath();
      c.moveTo(x - 10, 142);
      c.lineTo(x + w / 2, 90);
      c.lineTo(x + w + 10, 142);
      c.fill();
      c.fillStyle = "#f2d27a";
      c.fillRect(x + 15, 160, 22, 22);
      c.fillRect(x + w - 37, 160, 22, 22);
      c.fillStyle = "#6b4630";
      c.fillRect(x + w / 2 - 12, 180, 24, 40);
    }
    c.fillStyle = "#b9ad97";
    c.beginPath();
    c.ellipse(256, 290, 46, 16, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#8fc6d8";
    c.beginPath();
    c.ellipse(256, 286, 36, 10, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#4e7a48";
    for (const [x, y, r] of [
      [20, 170, 34],
      [490, 160, 40],
      [470, 250, 20],
    ]) {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
    barkFace(c, 380, 320, 0.9);
  }
  const puzzleCanvas = document.createElement("canvas");
  puzzleCanvas.width = 512;
  puzzleCanvas.height = 384;
  const puzzleTexture = new T.CanvasTexture(puzzleCanvas);
  puzzleTexture.colorSpace = T.SRGBColorSpace;
  puzzleTexture.anisotropy = 8;
  // Pieces go in, in this order, a 4 × 3 grid.
  const pieceOrder = [0, 3, 8, 11, 1, 2, 4, 7, 9, 10, 5, 6];
  function drawPuzzle() {
    const c = puzzleCanvas.getContext("2d");
    c.fillStyle = "#3d5a4c";
    c.fillRect(0, 0, 512, 384);
    c.strokeStyle = "rgba(255,255,255,0.12)";
    for (let i = 0; i < PUZZLE_PIECES; i++) {
      const x = (i % 4) * 128,
        y = Math.floor(i / 4) * 128;
      c.strokeRect(x + 4, y + 4, 120, 120);
    }
    for (let k = 0; k < state.rosewood.puzzle; k++) {
      const i = pieceOrder[k],
        x = (i % 4) * 128,
        y = Math.floor(i / 4) * 128;
      c.drawImage(picture, x, y, 128, 128, x, y, 128, 128);
      c.strokeStyle = "rgba(60,40,25,0.35)";
      c.lineWidth = 2;
      c.strokeRect(x + 1, y + 1, 126, 126);
    }
    puzzleTexture.needsUpdate = true;
  }
  drawPuzzle();
  const puzzleMat = new T.MeshStandardMaterial({ map: puzzleTexture, roughness: 0.85 });
  const board = box(puzzleMat, 0.05, 0.83, 0, 1.1, 0.012, 0.82, 0, coffee);
  board.castShadow = false;
  board.rotation.y = Math.PI / 2;
  // The box lid and a scatter of loose pieces.
  const lidTexture = textured(
    paint(256, 192, (c) => {
      c.drawImage(picture, 0, 0, 256, 192);
      c.fillStyle = "rgba(240,225,190,0.9)";
      c.fillRect(0, 150, 256, 42);
      c.fillStyle = "#6b4630";
      c.font = "bold 22px Georgia";
      c.textAlign = "center";
      c.fillText("WILLOWMERE · 12 PIECES", 128, 178);
    }, false),
    0.8,
  );
  const lidBox = box(lidTexture, -0.58, 0.85, 0.32, 0.42, 0.04, 0.32, 0.01, coffee);
  lidBox.rotation.y = 0.4;
  const loose = [];
  for (let i = 0; i < 6; i++) {
    const piece = box(mat(["#8fbcd4", "#86a85c", "#efe3c4", "#b77e61"][i % 4], 0.85), -0.62 + range(-0.12, 0.12), 0.83, -0.25 + range(-0.12, 0.12), 0.09, 0.012, 0.09, 0, coffee);
    piece.rotation.y = range(0, 3);
    piece.castShadow = false;
    loose.push(piece);
  }
  colliders.push({ x: -3.95, z: 1.45, w: 1.15, d: 1.85 });
  // A braided oval rug under it all.
  for (let i = 0; i < 7; i++) {
    const r = cyl([rose, mustard, teal, roseLight, sage, mustard, rose][i], -3.95, 0.006 + i * 0.002, 1.75, 2.1 - i * 0.28, 0.012, 2.1 - i * 0.28, root, 40);
    r.scale.z = 0.72;
    r.castShadow = false;
  }

  // The sofa, its back to the hall wall, facing the fire.
  function sofa(x, z, rotation, length, fabric, cushions) {
    const g = group(x, 0, z, rotation);
    box(fabric, 0, 0.45, 0, length, 0.5, 1.05, 0.08, g);
    box(fabric, 0, 1.05, -0.42, length, 1.0, 0.26, 0.1, g);
    for (const side of [-1, 1]) box(fabric, (side * (length - 0.16)) / 2, 0.82, 0.02, 0.26, 0.72, 1.06, 0.1, g);
    const seats = Math.round(length / 0.9);
    for (let i = 0; i < seats; i++) {
      const xx = -length / 2 + 0.2 + ((i + 0.5) * (length - 0.4)) / seats;
      box(fabric, xx, 0.78, 0.08, (length - 0.4) / seats - 0.04, 0.18, 0.82, 0.08, g);
      box(fabric, xx, 1.18, -0.24, (length - 0.4) / seats - 0.06, 0.6, 0.18, 0.08, g);
    }
    cushions.forEach((m, i) => {
      const c = box(m, -length / 2 + 0.45 + i * (length - 0.9), 1.08, -0.08, 0.46, 0.44, 0.14, 0.07, g);
      c.rotation.z = (i ? -1 : 1) * 0.25;
      c.rotation.x = -0.2;
    });
    for (const xx of [-1, 1]) for (const zz of [-1, 1]) cyl(walnut, (xx * (length - 0.3)) / 2, 0.1, zz * 0.4, 0.05, 0.2, 0.04, g, 10);
    return g;
  }
  const settee = sofa(-2.2, 1.3, -Math.PI / 2, 2.6, mat("#6f8f8a", 0.95), [rose, mustard]);
  // A knitted throw over one arm.
  box(mat("#e7d2a8", 1), 1.2, 1.12, 0.05, 0.4, 0.06, 0.9, 0.03, settee).rotation.z = 0.2;
  colliders.push({ x: -2.2, z: 1.3, w: 1.1, d: 2.65 });
  // The armchair, angled to the fire.
  const chair = group(-4.75, 0, 4.15, -Math.PI / 2 - 0.55);
  const chairFabric = mat("#b0646a", 0.95);
  box(chairFabric, 0, 0.45, 0, 1.0, 0.5, 0.95, 0.08, chair);
  box(chairFabric, 0, 1.15, -0.38, 1.0, 1.15, 0.24, 0.12, chair);
  for (const side of [-1, 1]) box(chairFabric, side * 0.45, 0.85, 0.0, 0.2, 0.62, 0.95, 0.1, chair);
  box(chairFabric, 0, 0.78, 0.07, 0.72, 0.16, 0.76, 0.07, chair);
  box(cream, 0, 1.15, -0.22, 0.4, 0.34, 0.12, 0.06, chair).rotation.x = -0.15;
  for (const xx of [-0.4, 0.4]) for (const zz of [-0.38, 0.38]) cyl(walnut, xx, 0.1, zz, 0.05, 0.2, 0.04, chair, 10);
  // A ball of wool with knitting needles beside it.
  orb(plum, 0.75, 0.15, 0.4, 0.15, 0.14, 0.15, chair);
  beam(brass, [0.65, 0.12, 0.45], [0.95, 0.42, 0.3], 0.015, chair);
  beam(brass, [0.7, 0.12, 0.35], [0.98, 0.38, 0.42], 0.015, chair);
  colliders.push({ x: -4.75, z: 4.15, r: 0.72 });
  // A floor lamp behind the sofa's far end.
  cyl(brass, -1.7, 0.03, -0.15, 0.2, 0.05, 0.2, root, 16);
  cyl(brass, -1.7, 1.3, -0.15, 0.025, 2.5, 0.025, root, 8);
  const shadeMat = new T.MeshStandardMaterial({
    color: "#f2d9a8",
    emissive: "#ffcf86",
    emissiveIntensity: 0.25,
    side: T.DoubleSide,
    roughness: 0.9,
  });
  mesh(new T.CylinderGeometry(0.22, 0.36, 0.42, 24, 1, true), shadeMat, -1.7, 2.6, -0.15).castShadow = false;
  colliders.push({ x: -1.7, z: -0.15, r: 0.22 });
  // A low bookcase on the kitchen partition.
  const books = group(-4.1, 0, P.partition + WT / 2 + 0.22, 0);
  box(oak, 0, 0.75, 0, 1.7, 1.5, 0.4, 0.02, books);
  for (const y of [0.3, 0.8]) {
    let x = -0.75;
    while (x < 0.72) {
      const w = range(0.06, 0.12),
        h = range(0.32, 0.42);
      box(
        [rose, teal, mustard, plum, sage, cream, brickRed][Math.floor(random() * 7)],
        x + w / 2,
        y + h / 2 + 0.02,
        0.03,
        w - 0.01,
        h,
        0.3,
        0.008,
        books,
      );
      x += w;
    }
  }
  for (let i = 0; i < 6; i++) leaf(leafMats[i % 4], 0.5 + (i % 3) * 0.08, 1.55, -0.05, 0.05, range(0.25, 0.45), books).rotation.set(range(-0.6, 0.6), i, range(-0.5, 0.5));
  cyl(terracotta, 0.55, 1.6, 0, 0.12, 0.18, 0.15, books, 16);
  colliders.push({ x: -4.1, z: P.partition + WT / 2 + 0.22, w: 1.75, d: 0.44 });
  // A trailing plant in the window and a tall one by the record player.
  function plant(x, y, z, size, p = root) {
    cyl(terracotta, x, y + size * 0.3, z, size * 0.42, size * 0.6, size * 0.5, p, 16);
    for (let i = 0; i < 11; i++) {
      const a = i * 2.4,
        l = leaf(leafMats[i % 4], x + Math.cos(a) * size * 0.15, y + size * 0.55, z + Math.sin(a) * size * 0.15, size * 0.16, size * range(0.7, 1.2), p);
      l.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(Math.cos(a), 0.9, Math.sin(a)).normalize());
    }
  }
  plant(-4.4, 1.38, P.front - 0.2, 0.35);
  plant(-5.0, 0, 4.9, 0.75);
  colliders.push({ x: -5.0, z: 4.9, r: 0.38 });

  // ------------------------------------------------------------- bedroom
  // A big bed, its headboard on the right wall, under a patchwork quilt.
  const quiltTexture = paint(256, 256, (c) => {
    const colours = ["#d98b86", "#f1dcb0", "#8fb3b0", "#e8b65c", "#b9a4c9", "#f4efe4", "#a8c48c"];
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 8; j++) {
        c.fillStyle = colours[(i * 3 + j * 5 + ((i * j) % 3)) % colours.length];
        c.fillRect(i * 32, j * 32, 32, 32);
        if ((i + j) % 3 === 0) {
          c.fillStyle = "rgba(255,255,255,0.5)";
          c.beginPath();
          c.arc(i * 32 + 16, j * 32 + 16, 7, 0, Math.PI * 2);
          c.fill();
        }
      }
    c.strokeStyle = "rgba(255,250,235,0.8)";
    c.setLineDash([4, 3]);
    for (let i = 0; i <= 8; i++) {
      c.beginPath();
      c.moveTo(i * 32, 0);
      c.lineTo(i * 32, 256);
      c.moveTo(0, i * 32);
      c.lineTo(256, i * 32);
      c.stroke();
    }
  });
  const quilt = textured(quiltTexture, 0.95);
  const bed = group(W - 1.25, 0, 3.4, -Math.PI / 2);
  box(oak, 0, 0.35, 0, 2.2, 0.3, 2.5, 0.04, bed);
  box(linen, 0, 0.72, 0, 2.05, 0.4, 2.4, 0.12, bed);
  tiled(quilt, 0, 0.84, 0.3, 2.25, 0.22, 1.95, 1.1, bed);
  for (const side of [-1, 1]) box(quilt, side * 1.12, 0.6, 0.3, 0.04, 0.4, 1.95, 0.02, bed);
  box(quilt, 0, 0.6, 1.27, 2.25, 0.4, 0.04, 0.02, bed);
  for (const x of [-0.5, 0.5]) {
    const pillow = box(white, x, 1.05, -0.92, 0.85, 0.24, 0.48, 0.12, bed);
    pillow.rotation.x = -0.25;
  }
  box(rose, 0, 0.98, 0.95, 2.1, 0.14, 0.45, 0.06, bed);
  // A headboard with a carved heart.
  box(oak, 0, 1.4, -1.25, 2.3, 1.6, 0.12, 0.05, bed);
  for (const x of [-1.15, 1.15]) {
    cyl(oak, x, 1.1, -1.25, 0.08, 2.2, 0.08, bed, 12);
    orb(oak, x, 2.25, -1.25, 0.11, 0.11, 0.11, bed);
  }
  const heart = new T.Shape();
  heart.moveTo(0, -0.15);
  heart.bezierCurveTo(-0.3, 0.05, -0.15, 0.25, 0, 0.1);
  heart.bezierCurveTo(0.15, 0.25, 0.3, 0.05, 0, -0.15);
  mesh(new T.ExtrudeGeometry(heart, { depth: 0.03, bevelEnabled: false }), rose, 0, 1.75, -1.19, bed);
  // A little dog bed at the foot, for Bark's nights.
  cyl(mat("#7d9ac2", 0.95), 0, 0.2, 1.75, 0.45, 0.25, 0.45, bed, 20).scale.z = 0.7;
  torus(mat("#5f7ca6", 0.95), 0, 0.33, 1.75, 0.42, 0.08, bed).rotation.x = Math.PI / 2;
  colliders.push({ x: W - 1.25, z: 3.4, w: 2.55, d: 2.35 });
  colliders.push({ x: W - 2.95, z: 3.4, r: 0.45 });
  // Nightstands: an alarm clock and a book on one, the star lamp on the other.
  for (const z of [1.75, 5.05]) {
    box(oak, W - 0.42, 0.55, z, 0.7, 1.1, 0.7, 0.03, root);
    box(walnut, W - 0.08, 0.7, z, 0.02, 0.25, 0.5, 0.01, root);
    orb(brass, W - 0.06, 0.7, z, 0.03, 0.03, 0.03, root);
    colliders.push({ x: W - 0.42, z, w: 0.72, d: 0.72 });
  }
  cyl(mat("#c9473e", 0.5), W - 0.4, 1.25, 5.15, 0.11, 0.08, 0.11, root, 20).rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) orb(brass, W - 0.4, 1.38, 5.15 + s * 0.08, 0.04);
  box(teal, W - 0.45, 1.13, 4.85, 0.32, 0.06, 0.24, 0.01, root);
  // The star lamp: a pierced brass drum that throws stars on the ceiling.
  const starGlow = new T.MeshStandardMaterial({
    color: "#fff3c8",
    emissive: "#ffd98a",
    emissiveIntensity: 0.15,
  });
  const starLamp = group(W - 0.42, 1.1, 1.75);
  cyl(brass, 0, 0.03, 0, 0.16, 0.06, 0.18, starLamp, 20);
  const drum = group(0, 0.28, 0, 0, starLamp);
  keep.add(drum);
  mesh(new T.CylinderGeometry(0.17, 0.17, 0.4, 20, 1, true), starGlow, 0, 0, 0, drum).castShadow = false;
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5;
    orb(mat("#7a5a2a", 0.4, 0.6), Math.cos(a) * 0.172, ((i % 3) - 1) * 0.1, Math.sin(a) * 0.172, 0.025, 0.025, 0.01, drum).lookAt(0, 0, 0);
  }
  cyl(brass, 0, 0.22, 0, 0.19, 0.04, 0.19, drum, 20);
  const starsTexture = paint(512, 512, (c) => {
    c.clearRect(0, 0, 512, 512);
    for (let i = 0; i < 70; i++) {
      const x = random() * 512,
        y = random() * 512,
        r = range(3, 9);
      const g = c.createRadialGradient(x, y, 0, x, y, r * 2);
      g.addColorStop(0, "rgba(255,240,190,1)");
      g.addColorStop(1, "rgba(255,240,190,0)");
      c.fillStyle = g;
      c.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = (k * Math.PI) / 5 - Math.PI / 2,
          rr = k % 2 ? r * 0.45 : r;
        c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      c.fill();
    }
  }, false);
  const starsMat = new T.MeshBasicMaterial({
    map: starsTexture,
    transparent: true,
    opacity: 0,
    blending: T.AdditiveBlending,
    depthWrite: false,
  });
  const starSky = mesh(new T.CircleGeometry(4.2, 48), starsMat, 3.9, H - 0.02, 2.7);
  starSky.rotation.x = Math.PI / 2;
  starSky.castShadow = starSky.receiveShadow = false;
  starSky.visible = false;
  // The window seat at the front window, piled with cushions and books.
  const seat = group(3.9, 0, P.front - 0.45, Math.PI);
  box(paleWood, 0, 0.5, 0, 2.2, 1.0, 0.85, 0.03, seat);
  for (const x of [-0.75, 0, 0.75]) box(walnut, x, 0.5, 0.43, 0.6, 0.7, 0.02, 0.012, seat);
  box(mat("#8fb3b0", 0.95), 0, 1.08, 0, 2.15, 0.16, 0.8, 0.07, seat);
  for (const [x, m, r] of [
    [-0.75, rose, 0.2],
    [0.0, mustard, -0.1],
    [0.7, cream, 0.3],
  ]) {
    const c = box(m, x, 1.38, -0.25, 0.5, 0.46, 0.15, 0.07, seat);
    c.rotation.z = r;
    c.rotation.x = -0.25;
  }
  for (let i = 0; i < 3; i++) box([teal, plum, brickRed][i], 0.65, 1.2 + i * 0.06, 0.15, 0.36, 0.055, 0.26, 0.008, seat).rotation.y = i * 0.3;
  colliders.push({ x: 3.9, z: P.front - 0.45, w: 2.2, d: 0.9 });
  // A tall wardrobe and a dresser with a mirror on the kitchen partition.
  const wardrobe = group(2.15, 0, P.partition + WT / 2 + 0.38, 0);
  box(paleWood, 0, 1.55, 0, 1.45, 3.1, 0.72, 0.03, wardrobe);
  for (const x of [-0.35, 0.35]) {
    box(sageLight, x, 1.6, 0.37, 0.66, 2.7, 0.03, 0.015, wardrobe);
    box(white, x, 1.6, 0.39, 0.5, 2.4, 0.02, 0.012, wardrobe);
    orb(brass, x * 0.2, 1.6, 0.42, 0.035, 0.035, 0.03, wardrobe);
  }
  box(paleWood, 0, 3.15, 0, 1.6, 0.1, 0.8, 0.02, wardrobe);
  cyl(mat("#b89a6a", 0.9), -0.3, 3.38, 0, 0.18, 0.36, 0.2, wardrobe, 16);
  box(rose, 0.35, 3.3, 0, 0.5, 0.25, 0.4, 0.04, wardrobe);
  colliders.push({ x: 2.15, z: P.partition + WT / 2 + 0.38, w: 1.5, d: 0.76 });
  const dresser = group(4.75, 0, P.partition + WT / 2 + 0.3, 0);
  box(paleWood, 0, 0.6, 0, 1.8, 1.2, 0.58, 0.03, dresser);
  for (const y of [0.3, 0.68, 1.02])
    for (const x of [-0.43, 0.43]) {
      box(sageLight, x, y, 0.3, 0.8, 0.28, 0.03, 0.012, dresser);
      orb(brass, x, y, 0.33, 0.03, 0.03, 0.025, dresser);
    }
  box(paleWood, 0, 1.24, 0, 1.9, 0.06, 0.64, 0.02, dresser);
  torus(paleWood, 0, 2.05, -0.2, 0.5, 0.05, dresser);
  const glassMirror = cyl(mat("#c9d8dc", 0.05, 0.9), 0, 2.05, -0.21, 0.47, 0.02, 0.47, dresser, 32);
  glassMirror.rotation.x = Math.PI / 2;
  glassMirror.castShadow = false;
  cyl(rose, -0.6, 1.33, 0, 0.1, 0.12, 0.12, dresser, 16);
  cyl(willow, 0.6, 1.4, 0, 0.06, 0.28, 0.08, dresser, 12);
  for (let i = 0; i < 4; i++) orb(bloomMats[(i + 2) % 5], 0.6 + (i - 1.5) * 0.04, 1.6 + (i % 2) * 0.04, 0, 0.045, 0.045, 0.045, dresser);
  colliders.push({ x: 4.75, z: P.partition + WT / 2 + 0.3, w: 1.85, d: 0.62 });
  // A round rag rug and fluffy slippers.
  for (let i = 0; i < 5; i++) cyl([teal, cream, roseLight, cream, teal][i], 3.6, 0.006 + i * 0.002, 2.6, 1.4 - i * 0.24, 0.012, 1.4 - i * 0.24, root, 40).castShadow = false;
  for (const z of [1.85, 2.15]) orb(mat("#f0c9c4", 1), 3.85, 0.06, z, 0.18, 0.07, 0.09);
  // A shelf of books and a framed star chart by the window seat.
  const bedShelf = group(1.85, 0, P.front - 0.25, Math.PI);
  box(oak, 0, 1.1, 0, 1.0, 2.2, 0.36, 0.02, bedShelf);
  for (const y of [0.15, 0.85, 1.55]) {
    let x = -0.42;
    while (x < 0.38) {
      const w = range(0.06, 0.11);
      box([rose, teal, mustard, plum, sage][Math.floor(random() * 5)], x + w / 2, y + 0.2, 0.02, w - 0.01, range(0.3, 0.4), 0.28, 0.008, bedShelf);
      x += w;
    }
  }
  colliders.push({ x: 1.85, z: P.front - 0.25, w: 1.05, d: 0.42 });

  // ------------------------------------------------------------- kitchen
  // The cream range cooker in a tiled chimney breast, with a copper hood.
  const range_ = group(-W, 0, -3.0, Math.PI / 2);
  box(tiles, 0, H / 2, 0.15, 2.2, H, 0.3, 0.02, range_).castShadow = false;
  box(mat("#efe5cc", 0.35), 0, 0.6, 0.62, 1.6, 1.2, 0.85, 0.05, range_);
  for (const x of [-0.4, 0.4]) {
    box(mat("#d9cdb1", 0.35), x, 0.55, 1.06, 0.62, 0.62, 0.04, 0.03, range_);
    box(silver, x, 0.9, 1.1, 0.4, 0.04, 0.04, 0.01, range_);
  }
  box(silver, 0, 1.22, 0.62, 1.6, 0.04, 0.85, 0.01, range_);
  for (const x of [-0.4, 0.4]) cyl(dark, x, 1.25, 0.65, 0.2, 0.03, 0.2, range_, 24);
  for (let i = 0; i < 4; i++) orb(dark, -0.45 + i * 0.3, 1.05, 1.06, 0.035, 0.035, 0.03, range_);
  mesh(new T.CylinderGeometry(0.3, 0.75, 0.7, 4, 1), copper, 0, 3.0, 0.62, range_).rotation.y = Math.PI / 4;
  box(copper, 0, 3.75, 0.45, 0.45, 1.3, 0.4, 0.02, range_);
  // A rail of copper pans.
  beam(brass, [-0.9, 2.45, 0.35], [0.9, 2.45, 0.35], 0.03, range_);
  for (const [x, r] of [
    [-0.6, 0.16],
    [-0.15, 0.2],
    [0.35, 0.14],
    [0.75, 0.12],
  ]) {
    beam(brass, [x, 2.45, 0.35], [x, 2.25, 0.36], 0.012, range_);
    const pan = cyl(copper, x, 2.25 - r, 0.38, r, 0.05, r, range_, 20);
    pan.rotation.x = Math.PI / 2;
  }
  // The kettle, which whistles.
  const kettle = group(-0.4, 1.28, 0.62, 0, range_);
  orb(mat("#c9473e", 0.3), 0, 0.16, 0, 0.2, 0.17, 0.2, kettle);
  cyl(mat("#c9473e", 0.3), 0, 0.05, 0, 0.18, 0.1, 0.2, kettle, 20);
  beam(mat("#c9473e", 0.3), [0.15, 0.12, 0], [0.3, 0.28, 0], 0.04, kettle);
  torus(dark, 0, 0.36, 0, 0.12, 0.018, kettle, Math.PI).rotation.y = Math.PI / 2;
  const kettleLid = group(0, 0.32, 0, 0, kettle);
  keep.add(kettleLid);
  cyl(mat("#c9473e", 0.3), 0, 0, 0, 0.09, 0.03, 0.09, kettleLid, 16);
  orb(dark, 0, 0.03, 0, 0.03, 0.03, 0.03, kettleLid);
  const steamMat = new T.MeshStandardMaterial({
    color: "#ffffff",
    transparent: true,
    opacity: 0,
    depthWrite: false,
    roughness: 1,
  });
  const steam = [];
  for (let i = 0; i < 5; i++) {
    const puff = orb(steamMat, 0.3, 0.3, 0, 0.08, 0.08, 0.08, kettle);
    puff.castShadow = puff.receiveShadow = false;
    steam.push(puff);
  }
  colliders.push({ x: -W + 0.45, z: -3.0, w: 0.95, d: 2.2 });
  // The counter along the back wall: sage cupboards, a butcher's block top,
  // a deep sink under the window, herbs on the sill.
  const counter = group(-1.5, 0, P.back + 0.45, 0);
  const counterLength = 7.6;
  box(sage, 0, 0.6, 0, counterLength, 1.2, 0.85, 0.02, counter);
  const doorsCount = 9;
  for (let i = 0; i < doorsCount; i++) {
    const x = -counterLength / 2 + ((i + 0.5) * counterLength) / doorsCount;
    if (Math.abs(x - (-0.7)) < 0.5) continue;
    box(sageLight, x, 0.62, 0.43, counterLength / doorsCount - 0.08, 0.95, 0.03, 0.015, counter);
    orb(brass, x + 0.25, 0.95, 0.46, 0.03, 0.03, 0.025, counter);
  }
  box(oak, 0, 1.24, 0.02, counterLength + 0.1, 0.08, 0.92, 0.015, counter);
  // The Belfast sink, a brass tap and a draining rack.
  box(porcelain, -0.7, 1.08, 0.12, 1.0, 0.45, 0.72, 0.05, counter);
  box(mat("#c9cfcf", 0.2), -0.7, 1.29, 0.12, 0.84, 0.01, 0.56, 0, counter);
  beam(brass, [-0.7, 1.28, -0.3], [-0.7, 1.62, -0.3], 0.04, counter);
  beam(brass, [-0.7, 1.62, -0.3], [-0.7, 1.58, -0.05], 0.035, counter);
  for (const x of [-0.82, -0.58]) orb(porcelain, x, 1.45, -0.32, 0.04, 0.03, 0.04, counter);
  for (let i = 0; i < 5; i++) {
    const p = cyl(willow, 0.4 + i * 0.07, 1.5, -0.1, 0.22, 0.02, 0.22, counter, 24);
    p.rotation.x = Math.PI / 2 - 0.2;
  }
  box(silver, 0.55, 1.3, -0.05, 0.5, 0.04, 0.3, 0.005, counter);
  // Herbs in pots along the sill.
  for (let i = 0; i < 4; i++) {
    const x = -1.4 + i * 0.45;
    cyl(terracotta, x, 2.07, -0.33, 0.09, 0.16, 0.11, counter, 14);
    for (let j = 0; j < 6; j++) {
      const l = leaf(leafMats[(i + j) % 4], x + range(-0.04, 0.04), 2.13, -0.33 + range(-0.04, 0.04), 0.035, range(0.12, 0.22), counter);
      l.rotation.set(range(-0.6, 0.6), j, range(-0.6, 0.6));
    }
  }
  // A bread bin, jars and the biscuit jar.
  box(mat("#c9473e", 0.5), -3.0, 1.5, -0.1, 0.65, 0.44, 0.45, 0.06, counter);
  box(cream, -3.0, 1.52, 0.13, 0.4, 0.1, 0.01, 0.004, counter);
  for (let i = 0; i < 3; i++) {
    cyl(glass, -2.3 + i * 0.26, 1.42 + i * 0.03, -0.2, 0.09, 0.3 + i * 0.06, 0.09, counter, 16);
    cyl(["#d9a441", "#e8d9b8", "#8a5a3a"].map((c) => mat(c, 0.9))[i], -2.3 + i * 0.26, 1.38, -0.2, 0.08, 0.2 + i * 0.05, 0.08, counter, 16);
    cyl(oak, -2.3 + i * 0.26, 1.6 + i * 0.06, -0.2, 0.095, 0.04, 0.095, counter, 16);
  }
  const jarAt = { x: -1.5 + 2.4, z: P.back + 0.45 };
  const biscuitJar = group(2.4, 1.28, 0.05, 0, counter);
  cyl(mat("#f0e3c3", 0.35), 0, 0.22, 0, 0.2, 0.44, 0.18, biscuitJar, 24);
  box(plaque([["BISCUITS", 150, 0.55]], 0.32, 0.12, "#f0e3c3", "#8a4b3a"), 0, 0.25, 0.19, 0.3, 0.11, 0.01, 0, biscuitJar);
  const jarLid = group(0, 0.46, 0, 0, biscuitJar);
  keep.add(jarLid);
  cyl(mat("#c99559", 0.6), 0, 0.02, 0, 0.21, 0.05, 0.21, jarLid, 24);
  // A dog-head knob on the lid.
  orb(mat("#c99559", 0.6), 0, 0.12, 0, 0.09, 0.08, 0.08, jarLid);
  for (const s of [-1, 1]) orb(mat("#7a4f31", 0.7), s * 0.08, 0.11, 0, 0.03, 0.06, 0.02, jarLid);
  colliders.push({ x: -1.5, z: P.back + 0.45, w: counterLength + 0.1, d: 0.92 });
  // The dresser on the right wall, with willow-pattern plates and mugs.
  const hutch = group(W - 0.35, 0, -2.7, -Math.PI / 2);
  box(paleWood, 0, 0.55, 0, 2.2, 1.1, 0.68, 0.03, hutch);
  for (const x of [-0.55, 0.55]) box(sageLight, x, 0.55, 0.35, 0.95, 0.85, 0.03, 0.015, hutch);
  box(paleWood, 0, 1.13, 0, 2.3, 0.06, 0.74, 0.02, hutch);
  box(paleWood, 0, 2.35, -0.22, 2.2, 2.4, 0.22, 0.02, hutch);
  for (const y of [1.65, 2.25, 2.85]) box(paleWood, 0, y, -0.12, 2.1, 0.05, 0.3, 0.01, hutch);
  for (let i = 0; i < 4; i++)
    for (const y of [1.68, 2.28]) {
      const plateDisc = cyl(i % 2 ? willow : porcelain, -0.75 + i * 0.5, y + 0.22, -0.18, 0.21, 0.02, 0.21, hutch, 24);
      plateDisc.rotation.x = Math.PI / 2 - 0.15;
      cyl(i % 2 ? porcelain : willow, -0.75 + i * 0.5, y + 0.22, -0.165, 0.12, 0.02, 0.12, hutch, 20).rotation.x = Math.PI / 2 - 0.15;
    }
  for (let i = 0; i < 6; i++) {
    const x = -0.85 + i * 0.34;
    cyl([rose, teal, mustard, plum, sage, cream][i], x, 2.75, -0.05, 0.07, 0.14, 0.07, hutch, 14);
    torus([rose, teal, mustard, plum, sage, cream][i], x + 0.08, 2.75, -0.05, 0.04, 0.012, hutch);
  }
  // A calendar with walkies on every day.
  const calendar = plaque(
    [
      ["SPRING", 70, 0.15],
      ["WALKIES! WALKIES! WALKIES!", 44, 0.38],
      ["WALKIES! WALKIES! WALKIES!", 44, 0.55],
      ["WALKIES! WALKIES! WALKIES!", 44, 0.72],
    ],
    0.5,
    0.6,
    "#f4efe4",
    "#8a4b3a",
  );
  box(calendar, W - 0.02, 2.6, -1.15, 0.01, 0.6, 0.5, 0, root).castShadow = false;
  colliders.push({ x: W - 0.35, z: -2.7, w: 0.75, d: 2.3 });
  // The kitchen table, three chairs, a fruit bowl and a jug of flowers.
  const table = group(-2.6, 0, -2.55, 0);
  box(paleWood, 0, 1.0, 0, 2.3, 0.1, 1.35, 0.03, table);
  for (const x of [-1.0, 1.0]) for (const z of [-0.55, 0.55]) cyl(paleWood, x, 0.5, z, 0.06, 1.0, 0.05, table, 12);
  const check = textured(
    paint(64, 64, (c) => {
      for (let i = 0; i < 8; i++)
        for (let j = 0; j < 8; j++) {
          c.fillStyle = (i + j) % 2 ? "#f4efe4" : "#c9625e";
          c.fillRect(i * 8, j * 8, 8, 8);
        }
    }),
    0.95,
  );
  tiled(check, 0, 1.065, 0, 1.0, 0.01, 1.0, 0.25, table).rotation.y = 0.2;
  cyl(willow, 0.55, 1.12, 0.15, 0.18, 0.1, 0.25, table, 24);
  for (const [x, z, c] of [
    [0.5, 0.1, "#c9473e"],
    [0.6, 0.22, "#a8c45c"],
    [0.6, 0.06, "#e8b65c"],
  ])
    orb(mat(c, 0.5), x, 1.25, z, 0.08, 0.08, 0.08, table);
  cyl(cream, -0.55, 1.2, -0.1, 0.1, 0.3, 0.12, table, 16);
  for (let i = 0; i < 5; i++) orb(bloomMats[i], -0.55 + Math.cos(i * 1.3) * 0.08, 1.42 + (i % 2) * 0.05, -0.1 + Math.sin(i * 1.3) * 0.08, 0.06, 0.06, 0.06, table);
  cyl(porcelain, 0.1, 1.11, -0.35, 0.1, 0.12, 0.08, table, 16);
  function kitchenChair(x, z, rotation) {
    const g = group(x, 0, z, rotation, table);
    box(paleWood, 0, 0.6, 0, 0.6, 0.07, 0.6, 0.02, g);
    box(mat("#c9625e", 0.95), 0, 0.66, 0.02, 0.5, 0.06, 0.5, 0.03, g);
    for (const xx of [-0.25, 0.25]) for (const zz of [-0.25, 0.25]) cyl(paleWood, xx, 0.3, zz, 0.03, 0.6, 0.03, g, 8);
    for (const xx of [-0.25, 0.25]) cyl(paleWood, xx, 1.05, -0.27, 0.03, 0.9, 0.03, g, 8);
    for (const y of [0.95, 1.2, 1.45]) box(paleWood, 0, y, -0.27, 0.5, 0.06, 0.04, 0.01, g);
  }
  kitchenChair(-1.55, 0, Math.PI / 2);
  kitchenChair(1.55, 0.1, -Math.PI / 2 + 0.2);
  kitchenChair(0.2, -0.95, 0);
  colliders.push({ x: -2.6, z: -2.55, w: 2.35, d: 1.4 });
  colliders.push({ x: -4.15, z: -2.55, r: 0.38 }, { x: -1.05, z: -2.45, r: 0.38 }, { x: -2.4, z: -3.5, r: 0.38 });
  // A pendant over the table.
  beam(dark, [-2.6, H, -2.55], [-2.6, 3.2, -2.55], 0.02);
  const pendantShade = mesh(new T.CylinderGeometry(0.12, 0.45, 0.32, 32, 1, true), mat("#5e7d66", 0.5), -2.6, 3.08, -2.55);
  pendantShade.material = pendantShade.material.clone();
  pendantShade.material.side = T.DoubleSide;
  const bulbMat = new T.MeshStandardMaterial({ color: "#fff4d6", emissive: "#ffd890", emissiveIntensity: 1.4 });
  orb(bulbMat, -2.6, 2.95, -2.55, 0.09).castShadow = false;
  const kitchenLight = new T.PointLight("#ffd9a0", 5, 7, 2);
  kitchenLight.position.set(-2.6, 2.8, -2.55);
  scene.add(kitchenLight);
  // Bark's bowls by the back door, and his lead on a hook.
  const bowls = group(5.6, 0, P.back + 0.55, 0);
  for (const [x, c, fill] of [
    [-0.3, "#c9473e", "#9a6a3e"],
    [0.3, "#4f8a86", "#8fc6d8"],
  ]) {
    cyl(mat(c, 0.4), x, 0.08, 0, 0.2, 0.16, 0.25, bowls, 24);
    cyl(mat(fill, 0.6), x, 0.15, 0, 0.19, 0.02, 0.19, bowls, 24);
  }
  box(plaque([["BARK", 160, 0.55]], 0.4, 0.12, "#f4efe4", "#8a4b3a"), -0.3, 0.09, 0.235, 0.22, 0.07, 0.005, 0, bowls).rotation.x = -0.25;
  const pawMat = textured(
    paint(128, 128, (c) => {
      c.fillStyle = "#a9775a";
      c.fillRect(0, 0, 128, 128);
      c.fillStyle = "#7a4f3a";
      for (const [x, y] of [
        [40, 44],
        [88, 84],
      ]) {
        c.beginPath();
        c.ellipse(x, y, 12, 10, 0, 0, Math.PI * 2);
        c.fill();
        for (let k = 0; k < 4; k++) {
          c.beginPath();
          c.arc(x - 12 + k * 8, y - 14 - (k % 3 ? 3 : 0), 4, 0, Math.PI * 2);
          c.fill();
        }
      }
    }),
    1,
  );
  box(pawMat, 3.8, 0.012, P.back + 0.6, 1.4, 0.024, 0.8, 0.01).castShadow = false;
  colliders.push({ x: 5.6, z: P.back + 0.55, w: 1.0, d: 0.5 });

  // The back door, a stable door swung open against the kitchen wall.
  const backHinge = group(backDoor[1], 0, P.back, 0);
  const backLeaf = group(0, 0, 0, -1.75, backHinge);
  for (const [y, h] of [
    [0.8, 1.55],
    [2.45, 1.6],
  ]) {
    box(sageDark, -0.8, y, 0.06, 1.55, h - 0.04, 0.08, 0.02, backLeaf);
    for (let i = -2; i <= 2; i++) box(sage, -0.8 + i * 0.29, y, 0.11, 0.25, h - 0.2, 0.02, 0.006, backLeaf);
  }
  orb(brass, -1.4, 1.5, 0.16, 0.05, 0.05, 0.05, backLeaf);
  colliders.push({ x: backDoor[1] + 0.25, z: P.back + 0.8, w: 0.3, d: 1.5 });

  // ------------------------------------------------------------- garden
  // Lawn, a flagstone path, a picket fence, hedges, and the sky.
  tiled(lawn, 0, -0.08, (P.back + P.garden) / 2 - 2, 2 * W + 8, 0.12, P.back - P.garden + 8, 2.4).castShadow = false;
  for (let i = 0; i < 9; i++) {
    const x = 3.8 + (i % 2 ? 0.35 : -0.35) - i * 0.18,
      z = P.back - WT - 0.6 - i * 0.55;
    const flag = cyl(stone, x, 0.005, z, range(0.32, 0.42), 0.04, range(0.32, 0.42), root, 9);
    flag.rotation.y = range(0, 3);
    flag.scale.z = 0.8;
    flag.castShadow = false;
  }
  tiled(stone, 3.8, 0.0, P.back - WT - 0.4, 2.6, 0.06, 0.8, 0.8).castShadow = false;
  // The picket fence on three sides, a little inside the bounds.
  function picket(x0, z0, x1, z1) {
    const length = Math.hypot(x1 - x0, z1 - z0),
      n = Math.floor(length / 0.32),
      angle = Math.atan2(z1 - z0, x1 - x0);
    for (const y of [0.45, 1.05]) {
      const rail = box(white, (x0 + x1) / 2, y, (z0 + z1) / 2, length, 0.08, 0.05, 0.01);
      rail.rotation.y = -angle;
    }
    for (let i = 0; i <= n; i++) {
      const t = i / n,
        x = x0 + (x1 - x0) * t,
        z = z0 + (z1 - z0) * t;
      box(white, x, 0.65, z, 0.12, 1.3, 0.04, 0.01).rotation.y = -angle;
      mesh(new T.ConeGeometry(0.085, 0.14, 4), white, x, 1.37, z).rotation.y = Math.PI / 4 - angle;
    }
  }
  const fenceZ = P.garden + 0.15;
  picket(-W + 0.1, fenceZ, W - 0.1, fenceZ);
  picket(-W + 0.1, fenceZ, -W + 0.1, P.back - WT);
  picket(W - 0.1, fenceZ, W - 0.1, P.back - WT);
  // Fairy lights strung along the back fence, lit in the evening.
  const fairyMat = new T.MeshStandardMaterial({ color: "#fff2c4", emissive: "#ffd27a", emissiveIntensity: 0.1 });
  for (let i = 0; i <= 26; i++) {
    const x = -W + 0.2 + (i / 26) * (2 * W - 0.4);
    const sag = Math.sin(((i % 6) / 6) * Math.PI) * 0.12;
    orb(fairyMat, x, 1.32 - sag, fenceZ + 0.06, 0.035, 0.045, 0.035).castShadow = false;
  }
  // Hedges beyond the fence, and a couple of tree crowns behind them.
  const hedgeMats = [mat("#4f7b44", 0.95), mat("#5f8a4a", 0.95), mat("#446d3e", 0.95)];
  function hedge(x0, z0, x1, z1) {
    const length = Math.hypot(x1 - x0, z1 - z0),
      n = Math.ceil(length / 0.7);
    for (let i = 0; i <= n; i++) {
      const t = i / n,
        x = x0 + (x1 - x0) * t,
        z = z0 + (z1 - z0) * t;
      orb(hedgeMats[i % 3], x, 1.2 + range(-0.1, 0.15), z, 0.75, 1.25, 0.75).castShadow = false;
      orb(hedgeMats[(i + 1) % 3], x + range(-0.2, 0.2), 2.1 + range(-0.1, 0.2), z, 0.55, 0.55, 0.55).castShadow = false;
    }
  }
  hedge(-W - 0.8, P.garden - 0.7, W + 0.8, P.garden - 0.7);
  hedge(-W - 0.9, P.garden - 0.7, -W - 0.9, P.back - 0.2);
  hedge(W + 0.9, P.garden - 0.7, W + 0.9, P.back - 0.2);
  for (const [x, z, s] of [
    [-4.5, P.garden - 3.2, 1.9],
    [2.5, P.garden - 4.5, 2.4],
    [8.5, P.garden - 2, 1.6],
  ]) {
    cyl(walnut, x, 2, z, 0.25, 4, 0.18, root, 10).castShadow = false;
    for (let i = 0; i < 4; i++)
      orb(hedgeMats[i % 3], x + range(-1, 1) * s * 0.5, 4.2 + range(0, 1) * s * 0.6, z + range(-0.5, 0.5), s, s * 0.85, s).castShadow = false;
  }
  // The cottage seen from the garden: an eave over the back wall, the gable
  // and chimney of the main house rising beyond it.
  const eave = box(roofBlue, 0, H + 0.55, P.back - WT - 0.3, 2 * W + 0.8, 0.12, 1.4, 0.02);
  eave.rotation.x = -0.35;
  eave.castShadow = false;
  box(walnut, 0, H + 0.12, P.back - WT - 0.05, 2 * W + 0.4, 0.2, 0.12, 0.02).castShadow = false;
  const gable = new T.Shape();
  gable.moveTo(-W - 0.2, 0);
  gable.lineTo(W + 0.2, 0);
  gable.lineTo(0, 4.4);
  gable.closePath();
  const gableMesh = mesh(new T.ShapeGeometry(gable), exteriorPlaster, 0, H + 0.6, P.partition - 1.2);
  gableMesh.castShadow = false;
  for (const side of [-1, 1]) {
    const slope = box(roofBlue, (side * (W + 0.2)) / 2, H + 0.6 + 2.2, P.partition + 0.5, Math.hypot(W + 0.4, 4.4) + 0.4, 0.14, 3.6, 0.02);
    slope.rotation.z = -side * Math.atan2(4.4, W + 0.2);
    slope.castShadow = false;
  }
  box(mat("#9d8973", 0.9), -2.6, H + 4.0, P.partition + 0.6, 0.9, 2.6, 0.9, 0.02).castShadow = false;
  // Climbing roses on a trellis round the kitchen window, the cottage's
  // namesake, and a lantern by the back door.
  const wallFace = P.back - WT - 0.03;
  for (let i = 0; i < 6; i++) {
    const x = -4.0 + i * 0.72;
    beam(paleWood, [x, 0.2, wallFace - 0.04], [x, 4.1, wallFace - 0.04], 0.04);
  }
  for (const y of [1.0, 2.0, 3.6]) beam(paleWood, [-4.1, y, wallFace - 0.06], [-0.3, y, wallFace - 0.06], 0.04);
  for (let i = 0; i < 70; i++) {
    const x = range(-4.2, -0.2),
      y = range(0.3, 4.0);
    // Leave the window itself clear.
    if (Math.abs(x + 2.2) < 0.95 && Math.abs(y - 2.75) < 0.8) continue;
    const blade = leaf(leafMats[i % 4], x, y, wallFace - 0.08, 0.06, range(0.14, 0.22));
    blade.rotation.set(range(-0.4, 0.4) + Math.PI, 0, range(-1.5, 1.5));
    blade.castShadow = false;
    if (i % 3 === 0) orb(i % 2 ? rose : roseLight, x + 0.03, y + 0.05, wallFace - 0.12, 0.07, 0.07, 0.05).castShadow = false;
  }
  const lantern = group(2.55, 2.9, wallFace - 0.15);
  box(dark, 0, 0.34, 0.1, 0.05, 0.05, 0.3, 0.01, lantern);
  box(dark, 0, 0.0, 0, 0.26, 0.04, 0.26, 0.01, lantern);
  box(dark, 0, 0.36, 0, 0.3, 0.06, 0.3, 0.01, lantern);
  box(hallGlow, 0, 0.18, 0, 0.2, 0.3, 0.2, 0.01, lantern).castShadow = false;
  // A sky dome, warm at the horizon.
  const skyMat = new T.ShaderMaterial({
    side: T.BackSide,
    depthWrite: false,
    uniforms: { top: { value: new T.Color("#8fbcd6") }, horizon: { value: new T.Color("#f4e6c6") } },
    vertexShader: `varying float vY;void main(){vY=normalize(position).y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform vec3 top;uniform vec3 horizon;varying float vY;void main(){gl_FragColor=vec4(mix(horizon,top,smoothstep(0.,.45,vY)),1.);
      #include <colorspace_fragment>
    }`,
  });
  const sky = new T.Mesh(new T.SphereGeometry(45, 24, 12), skyMat);
  sky.position.set(0, -2, -6);
  scene.add(sky);
  // Bark's kennel, with his name over the door.
  const kennel = group(-4.5, 0, -9.3, 0.25);
  box(paleWood, 0, 0.65, 0, 1.4, 1.3, 1.3, 0.03, kennel);
  for (const side of [-1, 1]) {
    const r = box(mat("#b86f4f", 0.85), side * 0.42, 1.55, 0, 0.98, 0.1, 1.45, 0.02, kennel);
    r.rotation.z = -side * 0.72;
  }
  arch(soot, 0, 0.05, 0.62, 0.7, 0.85, 0.04, kennel);
  box(plaque([["BARK", 150, 0.55]], 0.6, 0.18, "#f4efe4", "#8a4b3a"), 0, 1.22, 0.67, 0.6, 0.18, 0.02, 0, kennel);
  box(mat("#7d9ac2", 0.95), 0, 0.08, 0.2, 1.0, 0.06, 0.8, 0.02, kennel);
  colliders.push({ x: -4.5, z: -9.3, w: 1.5, d: 1.45, rotation: -0.25 });
  // The dig spot: a patch of turned earth Bark keeps coming back to.
  const soil = mat("#6d523a", 1);
  const digAt = { x: -1.4, z: -9.4 };
  cyl(soil, digAt.x, 0.01, digAt.z, 0.75, 0.03, 0.7, root, 20).castShadow = false;
  for (let i = 0; i < 9; i++) orb(soil, digAt.x + range(-0.5, 0.5), 0.03, digAt.z + range(-0.45, 0.45), range(0.06, 0.12), 0.05, range(0.06, 0.12)).castShadow = false;
  const flag = group(digAt.x + 0.6, 0, digAt.z - 0.3);
  beam(paleWood, [0, 0, 0], [0, 0.9, 0], 0.03, flag);
  box(plaque([["X", 160, 0.55]], 0.25, 0.18, "#c9473e", "#f4efe4"), 0.13, 0.8, 0, 0.25, 0.18, 0.01, 0, flag);
  // A bird bath with a robin, and a bench in the corner.
  const bath = group(1.1, 0, -8.4);
  cyl(stone, 0, 0.5, 0, 0.13, 1.0, 0.1, bath, 16);
  cyl(stone, 0, 0.05, 0, 0.3, 0.1, 0.3, bath, 16);
  cyl(stone, 0, 1.05, 0, 0.32, 0.12, 0.5, bath, 24);
  const bathWater = cyl(mat("#8fc6d8", 0.1), 0, 1.12, 0, 0.42, 0.02, 0.42, bath, 24);
  bathWater.castShadow = false;
  const robin = group(0.38, 1.13, 0.1, -0.6, bath);
  keep.add(robin);
  figure(
    [
      [S, "#7a5a3a", [0, 0.08, 0], [0.06, 0.06, 0.08]],
      [S, "#d9603a", [0, 0.07, 0.04], [0.05, 0.05, 0.05]],
      [S, "#7a5a3a", [0, 0.15, 0.04], [0.04, 0.04, 0.04]],
      [K, "#3a2a1a", [0, 0.15, 0.085], [0.012, 0.035, 0.012], [Math.PI / 2, 0, 0]],
      [S, "#1c1715", [0.025, 0.165, 0.065], [0.008, 0.008, 0.008]],
      [S, "#1c1715", [-0.025, 0.165, 0.065], [0.008, 0.008, 0.008]],
      [S, "#5a3f2a", [0, 0.1, -0.08], [0.025, 0.02, 0.06], [0.4, 0, 0]],
      [C, "#3a2a1a", [0.02, 0.01, 0], [0.006, 0.04, 0.006]],
      [C, "#3a2a1a", [-0.02, 0.01, 0], [0.006, 0.04, 0.006]],
    ],
    robin,
  );
  colliders.push({ x: 1.1, z: -8.4, r: 0.45 });
  const bench = group(4.8, 0, P.garden + 0.65, 0);
  box(paleWood, 0, 0.62, 0, 1.9, 0.08, 0.6, 0.02, bench);
  for (const y of [1.0, 1.25]) box(paleWood, 0, y, -0.27, 1.9, 0.12, 0.05, 0.02, bench);
  for (const x of [-0.85, 0.85]) {
    box(walnut, x, 0.3, 0.2, 0.08, 0.6, 0.08, 0.01, bench);
    box(walnut, x, 0.65, -0.27, 0.08, 1.3, 0.08, 0.01, bench);
  }
  box(mustard, -0.4, 0.72, 0.05, 0.5, 0.12, 0.45, 0.05, bench);
  cyl(mat("#8fa3a6", 0.4, 0.5), 0.8, 0.15, 0.55, 0.15, 0.3, 0.12, bench, 16);
  beam(mat("#8fa3a6", 0.4, 0.5), [0.9, 0.2, 0.55], [1.15, 0.38, 0.55], 0.03, bench);
  colliders.push({ x: 4.8, z: P.garden + 0.65, w: 2.0, d: 0.75 });
  // Flower beds along the back fence.
  for (let i = 0; i < 14; i++) {
    const x = -W + 0.7 + (i / 13) * (2 * W - 1.4);
    if (Math.abs(x - 4.8) < 1.2) continue;
    for (let j = 0; j < 3; j++) {
      const stem = beam(leafMats[1], [x + j * 0.15 - 0.15, 0, fenceZ + 0.35], [x + j * 0.15 - 0.15, range(0.4, 0.75), fenceZ + 0.35 + range(-0.05, 0.05)], 0.02);
      stem.castShadow = false;
      orb(bloomMats[(i + j) % 5], x + j * 0.15 - 0.15, stem.position.y * 2 + 0.03, fenceZ + 0.35, 0.08).castShadow = false;
    }
  }
  colliders.push({ x: 0, z: fenceZ + 0.35, w: 2 * W, d: 0.5 });
  // The washing line along the left fence, a little dog jumper among the sheets.
  for (const z of [P.back - 1.0, P.back - 3.6]) {
    beam(walnut, [-W + 0.5, 0, z], [-W + 0.5, 3.3, z], 0.07);
    colliders.push({ x: -W + 0.5, z, r: 0.12 });
  }
  beam(mat("#e8e0cc", 0.9), [-W + 0.5, 3.2, P.back - 1.0], [-W + 0.5, 3.2, P.back - 3.6], 0.012);
  const laundry = group(-W + 0.5, 3.2, 0);
  keep.add(laundry);
  figure(
    [
      [B, "#f4efe4", [0, -0.5, P.back - 1.6], [0.02, 1.0, 0.8]],
      [B, "#d98b86", [0, -0.35, P.back - 2.3], [0.02, 0.7, 0.45]],
      [B, "#8fb3b0", [0, -0.3, P.back - 2.85], [0.02, 0.6, 0.5]],
      // Bark's jumper, with its little sleeves.
      [B, "#c9473e", [0, -0.18, P.back - 3.25], [0.02, 0.3, 0.32]],
      [B, "#c9473e", [0, -0.32, P.back - 3.16], [0.02, 0.12, 0.08]],
      [B, "#c9473e", [0, -0.32, P.back - 3.34], [0.02, 0.12, 0.08]],
      [B, "#f4efe4", [0, -0.16, P.back - 3.25], [0.025, 0.06, 0.2]],
    ],
    laundry,
  );
  for (let i = 0; i < 9; i++) box(paleWood, -W + 0.5, 3.2, P.back - 1.25 - i * 0.27, 0.03, 0.08, 0.02, 0.004);
  // Bark's ball, waiting on the lawn.
  const ballRest = { x: -3.2, z: -8.6 };
  const ball = orb(mat("#d8453a", 0.5), ballRest.x, 0.13, ballRest.z, 0.13);
  ball.castShadow = false;
  keep.add(ball);
  // A small apple tree by the patio.
  const tree = group(5.4, 0, -7.6);
  tube(walnut, [
    [0, 0, 0],
    [0.05, 1.2, 0.05],
    [-0.1, 2.2, 0],
    [0.1, 2.8, -0.1],
  ], 0.14, tree);
  for (let i = 0; i < 7; i++)
    orb(leafMats[i % 4].clone(), range(-0.9, 0.9), range(2.6, 3.6), range(-0.8, 0.8), range(0.55, 0.85)).position.add(tree.position);
  for (let i = 0; i < 8; i++) orb(mat("#c9473e", 0.5), 5.4 + range(-0.9, 0.9), range(2.4, 3.3), -7.6 + range(-0.8, 0.8), 0.08);
  colliders.push({ x: 5.4, z: -7.6, r: 0.25 });

  // ------------------------------------------------------------- Bark
  // A scruffy golden terrier with a red collar, built as a few vertex-coloured
  // parts that move: his body, head, ears, legs and tail.
  const GOLD = "#c99559",
    CREAM = "#f1dfbd",
    BROWN = "#7a4f31",
    NOSE = "#2a201c";
  const bark = group(0, 0, 3.3);
  // He is drawn a little larger than life, like the rooms, so he reads at the
  // visitor's eye height.
  bark.scale.setScalar(1.25);
  bark.name = "Bark";
  keep.add(bark);
  const torso = group(0, 0, 0, 0, bark);
  figure(
    [
      [S, GOLD, [0, 0.66, 0], [0.3, 0.28, 0.5]],
      [S, BROWN, [0, 0.82, -0.05], [0.24, 0.12, 0.34]],
      [S, CREAM, [0, 0.6, 0.32], [0.22, 0.24, 0.2]],
      [S, CREAM, [0, 0.52, 0.05], [0.22, 0.14, 0.34]],
      [S, GOLD, [0, 0.82, 0.32], [0.17, 0.2, 0.17]],
      [C, "#b8423a", [0, 0.88, 0.34], [0.18, 0.06, 0.18], [0.5, 0, 0]],
      [C, "#d9b45a", [0, 0.76, 0.47], [0.05, 0.015, 0.05], [Math.PI / 2 + 0.5, 0, 0]],
    ],
    torso,
  );
  const head = group(0, 1.0, 0.44, 0, torso);
  figure(
    [
      [S, GOLD, [0, 0, 0], [0.24, 0.23, 0.23]],
      [S, GOLD, [0, 0.16, -0.02], [0.12, 0.08, 0.12]],
      [S, CREAM, [0, -0.07, 0.17], [0.15, 0.12, 0.15]],
      [S, NOSE, [0, -0.02, 0.32], [0.055, 0.04, 0.04]],
      [S, NOSE, [0.09, 0.06, 0.18], [0.035, 0.04, 0.03]],
      [S, NOSE, [-0.09, 0.06, 0.18], [0.035, 0.04, 0.03]],
      [S, "#ffffff", [0.1, 0.075, 0.205], [0.01, 0.01, 0.01]],
      [S, "#ffffff", [-0.08, 0.075, 0.205], [0.01, 0.01, 0.01]],
      [S, CREAM, [0.09, 0.12, 0.17], [0.05, 0.025, 0.03], [0, 0, -0.3]],
      [S, CREAM, [-0.09, 0.12, 0.17], [0.05, 0.025, 0.03], [0, 0, 0.3]],
      [S, "#e07a7a", [0, -0.15, 0.24], [0.045, 0.015, 0.07], [0.3, 0, 0]],
      [S, CREAM, [0, -0.13, 0.12], [0.1, 0.06, 0.1]],
    ],
    head,
  );
  const ears = [-1, 1].map((side) => {
    const e = group(side * 0.16, 0.1, -0.02, 0, head);
    figure([[S, BROWN, [side * 0.05, -0.12, 0], [0.07, 0.17, 0.05], [0, 0, side * 0.35]]], e);
    return e;
  });
  const legs = [
    [0.15, 0.27],
    [-0.15, 0.27],
    [0.15, -0.3],
    [-0.15, -0.3],
  ].map(([x, z]) => {
    const l = group(x, 0.55, z, 0, torso);
    figure(
      [
        [C, GOLD, [0, -0.24, 0], [0.075, 0.48, 0.075]],
        [S, CREAM, [0, -0.5, 0.04], [0.085, 0.06, 0.11]],
      ],
      l,
    );
    return l;
  });
  const tail = group(0, 0.78, -0.45, 0, torso);
  figure(
    [
      [S, GOLD, [0, 0.12, -0.06], [0.06, 0.16, 0.06], [-0.5, 0, 0]],
      [S, CREAM, [0, 0.26, -0.12], [0.055, 0.07, 0.055]],
    ],
    tail,
  );
  // A soft contact shadow under him instead of a moving shadow caster.
  const blobMat = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 vUv;void main(){float r=length(vUv-.5)*2.;gl_FragColor=vec4(.08,.06,.04,.42*(1.-smoothstep(.2,1.,r)));}`,
  });
  const blob = new T.Mesh(new T.PlaneGeometry(1.1, 1.5), blobMat);
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.012;
  bark.add(blob);
  // A heart that floats up when he is petted.
  const heartTexture = paint(64, 64, (c) => {
    c.fillStyle = "#e5637a";
    c.beginPath();
    c.moveTo(32, 54);
    c.bezierCurveTo(4, 34, 10, 8, 32, 22);
    c.bezierCurveTo(54, 8, 60, 34, 32, 54);
    c.fill();
  }, false);
  const heartSprite = new T.Sprite(new T.SpriteMaterial({ map: heartTexture, transparent: true, depthWrite: false }));
  heartSprite.scale.setScalar(0.35);
  heartSprite.visible = false;
  scene.add(heartSprite);
  // Music notes for the gramophone, and dirt for the dig.
  const noteTexture = paint(64, 64, (c) => {
    c.fillStyle = "#6b4630";
    c.font = "bold 52px Georgia";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("♪", 32, 34);
  }, false);
  const notes = Array.from({ length: 3 }, () => {
    const s = new T.Sprite(new T.SpriteMaterial({ map: noteTexture, transparent: true, depthWrite: false, opacity: 0 }));
    s.scale.setScalar(0.3);
    scene.add(s);
    return s;
  });
  const dirt = new T.InstancedMesh(new T.SphereGeometry(1, 6, 4), soil, 14);
  dirt.castShadow = dirt.receiveShadow = false;
  dirt.frustumCulled = false;
  dirt.visible = false;
  scene.add(dirt);
  const dirtSeeds = Array.from({ length: 14 }, () => [range(-0.6, 0.6), range(0.8, 1.6), range(0, 1)]);
  // A trinket that pops up from the soil when Bark finds it.
  const found = group(digAt.x, 0, digAt.z, 0, scene);
  found.visible = false;

  // -------------------------------------------------------------- lights
  const ambient = new T.HemisphereLight("#fff1dc", "#6b5a48", 1.15);
  scene.add(ambient);
  const sun = new T.DirectionalLight("#ffe7bf", 2.3);
  sun.position.set(-7, 14, -7);
  sun.target.position.set(0, 0, -2);
  scene.add(sun, sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 40 });
  sun.shadow.normalBias = 0.03;
  sun.shadow.bias = -0.0002;
  sun.shadow.radius = 3;
  // Afternoon sun through the living-room window, with the window's bars.
  const windowLight = new T.SpotLight("#fff0c0", 70, 14, 0.55, 0.5, 1.6);
  windowLight.position.set(-4.4, 4.8, P.front + 2.2);
  windowLight.target.position.set(-4.0, 0, 1.6);
  scene.add(windowLight, windowLight.target);
  const goboCanvas = document.createElement("canvas");
  goboCanvas.width = goboCanvas.height = 256;
  {
    const gc = goboCanvas.getContext("2d");
    gc.fillStyle = "#fff";
    gc.fillRect(0, 0, 256, 256);
    gc.fillStyle = "#111";
    gc.fillRect(124, 0, 8, 256);
    gc.fillRect(0, 100, 256, 8);
  }
  windowLight.map = new T.CanvasTexture(goboCanvas);
  windowLight.castShadow = true;
  windowLight.shadow.mapSize.set(1024, 1024);
  windowLight.shadow.bias = -0.0002;
  const bedLight = new T.PointLight("#ffd6a0", 2.5, 6, 2);
  bedLight.position.set(W - 0.42, 2.2, 1.75);
  scene.add(bedLight);

  // Glass, water and the moving figures never shadow the baked room; the
  // room's shadows are captured once and kept (staticShadows below).
  root.traverse((o) => {
    if (o.isMesh && o.material.transparent) o.castShadow = o.receiveShadow = false;
  });
  for (const g of keep) g.traverse((o) => (o.castShadow = false));
  bake(keep);

  // ----------------------------------------------------------- behaviour
  const trail = createTrail();
  const dog = {
    x: 0,
    z: 3.3,
    heading: 0,
    mode: "follow",
    timer: 0,
    gait: 0,
    wag: 1,
    pose: 0,
    target: null,
  };
  let night = false,
    music = false,
    stars = false,
    holding = false,
    cuckooTimer = 0,
    kettleTimer = 0,
    feedTimer = 0,
    heartTimer = 0,
    chestTimer = 0,
    foundTimer = 0,
    pets = 0,
    treats = 0,
    fetchLine = 0,
    feeds = 0,
    greetings = 0,
    lastDig = null;
  const ballState = { phase: "rest", x: ballRest.x, z: ballRest.z, y: 0.13, from: null, to: null, t: 0 };
  const inGarden = (z) => z < P.back - WT;
  let player = { x: 0, z: 5, yaw: 0 };
  const busy = () => dog.mode !== "follow";

  function lineFrom(list, counter) {
    return pick(list, counter);
  }
  // Where a thrown ball lands: as far as 5 m ahead along the visitor's view,
  // short of anything in the way.
  function landing(walker) {
    const dx = -Math.sin(walker.yaw),
      dz = -Math.cos(walker.yaw);
    let best = null;
    for (let d = 0.6; d <= 5; d += 0.2) {
      const x = walker.position.x + dx * d,
        z = walker.position.z + dz * d;
      if (walker.blocked(x, z, 0.32) || !inGarden(z)) break;
      best = { x, z };
    }
    return best && Math.hypot(best.x - walker.position.x, best.z - walker.position.z) > 1.4 ? best : null;
  }
  let walkerRef = null;

  const points = [
    { id: "door", x: 0, z: P.front - 0.05, y: 2, range: 1.85, label: "Step out into Willowmere" },
    {
      id: "bark",
      get x() {
        return dog.x;
      },
      get z() {
        return dog.z;
      },
      y: 1.3,
      range: 2.2,
      get label() {
        return holding && inGarden(player.z) ? "Throw the ball for Bark" : "Pet Bark";
      },
    },
    {
      id: "throw",
      get x() {
        return player.x - Math.sin(player.yaw) * 0.6;
      },
      get z() {
        return player.z - Math.cos(player.yaw) * 0.6;
      },
      y: 2.2,
      range: 1.5,
      label: "Throw the ball for Bark",
      available: () => holding && inGarden(player.z) && !busy(),
    },
    {
      id: "ball",
      get x() {
        return ballState.x;
      },
      get z() {
        return ballState.z;
      },
      y: 1.0,
      range: 1.9,
      label: "Pick up Bark's ball",
      available: () => !holding && ballState.phase === "rest",
    },
    { id: "dig", x: digAt.x, z: digAt.z, y: 0.9, range: 2.2, label: "Ask Bark to dig" },
    { id: "aquarium", x: -2.45, z: 5.1, y: 1.6, range: 2.1, label: "Feed the fish" },
    {
      id: "record",
      x: -5.95,
      z: 5.4,
      y: 1.6,
      range: 2.0,
      get label() {
        return music ? "Lift the needle" : "Play a record";
      },
    },
    { id: "puzzle", x: -3.95, z: 1.45, y: 1.0, range: 2.1, label: "Fit a jigsaw piece" },
    { id: "fire", x: -W + 0.9, z: 2.6, y: 1.4, range: 2.0, label: "Warm your toes by the fire" },
    { id: "cuckoo", x: -hallX, z: 1.55, y: 2.95, range: 2.0, label: "Wind the cuckoo clock" },
    {
      id: "shelf",
      x: hallX,
      z: 3.4,
      y: 2.6,
      range: 2.0,
      label: "Look at Bark's treasures",
    },
    { id: "kettle", x: -W + 0.6, z: -3.4, y: 1.7, range: 2.0, label: "Put the kettle on" },
    { id: "biscuit", x: jarAt.x, z: jarAt.z, y: 1.6, range: 2.0, label: "Share a biscuit with Bark" },
    { id: "bowls", x: 5.6, z: P.back + 0.55, y: 0.6, range: 1.8, label: "Top up Bark's water" },
    { id: "dresser", x: W - 0.35, z: -2.7, y: 1.8, range: 2.0, label: "Look at the dresser" },
    {
      id: "nap",
      x: W - 1.9,
      z: 3.4,
      y: 1.2,
      range: 2.1,
      get label() {
        return night ? "Doze until afternoon" : "Have a little nap";
      },
    },
    {
      id: "star",
      x: W - 0.42,
      z: 1.75,
      y: 1.6,
      range: 2.0,
      get label() {
        return stars ? "Switch off the star lamp" : "Switch on the star lamp";
      },
    },
    { id: "wardrobe", x: 2.15, z: P.partition + 0.6, y: 1.8, range: 2.0, label: "Peek in the wardrobe" },
    { id: "window", x: 3.9, z: P.front - 0.45, y: 1.3, range: 2.0, label: "Curl up on the window seat" },
    { id: "kennel", x: -4.5, z: -8.6, y: 1.0, range: 2.0, label: "Look at Bark's kennel" },
    { id: "birdbath", x: 1.1, z: -8.4, y: 1.2, range: 2.0, label: "Watch the robin" },
  ];

  // The space a point stands in: E answers only within the visitor's own, so
  // nothing is reached through a wall.
  const zoneOf = (x, z) =>
    z < P.back - WT / 2 ? "garden" : z < P.partition ? "kitchen" : x < -hallX ? "living" : x > hallX ? "bedroom" : "hall";
  for (const point of points) {
    if (point.id === "door" || point.id === "throw") continue;
    const zone = zoneOf(point.x, point.z),
      dynamic = point.id === "bark" || point.id === "ball",
      own = point.available;
    point.available = () =>
      (own?.() ?? true) && zoneOf(player.x, player.z) === (dynamic ? zoneOf(point.x, point.z) : zone);
  }

  function interact(point) {
    const id = point.id;
    if (id === "bark") {
      if (holding && inGarden(player.z)) return interact({ id: "throw" });
      heartTimer = 1.6;
      dog.wag = 3;
      return { title: BARK_TITLE, text: lineFrom(BARK_PETS, pets++), sound: pets % 2 ? "woof" : "chime" };
    }
    if (id === "ball") {
      holding = true;
      ball.visible = false;
      ballState.phase = "held";
      dog.wag = 3;
      return { title: "BARK’S BALL", text: BALL_PICKUP, sound: "woof" };
    }
    if (id === "throw") {
      if (!inGarden(player.z)) return { title: "BARK’S BALL", text: BALL_INDOORS };
      const to = walkerRef && landing(walkerRef);
      if (!to) return { title: "BARK’S BALL", text: "Turn toward the open lawn to give it a good throw." };
      holding = false;
      ball.visible = true;
      Object.assign(ballState, {
        phase: "flying",
        from: { x: player.x, z: player.z },
        to,
        t: 0,
      });
      dog.mode = "chase";
      dog.target = to;
      return { sound: "woof" };
    }
    if (id === "dig") {
      if (busy()) return { title: "BARK", text: DIG_BUSY };
      dog.mode = "dig-go";
      dog.target = { x: digAt.x + 0.15, z: digAt.z + 0.75 };
      return { title: "THE DIG SPOT", text: "Bark’s ears go up. He knows exactly what this patch is for." , sound: "woof" };
    }
    if (id === "aquarium") {
      feedTimer = 7;
      return { title: FISH_TITLE, text: lineFrom(FISH_FEEDS, feeds++), sound: "bubbles" };
    }
    if (id === "record") {
      music = !music;
      return { title: NOTES.record.title, text: music ? NOTES.record.on : NOTES.record.off, sound: music ? "music:on" : "music:off" };
    }
    if (id === "puzzle") {
      const result = placePiece(state);
      save();
      drawPuzzle();
      return {
        title: "THE JIGSAW",
        text: result.kind === "placed" ? PUZZLE_LINES.placed(result.left) : PUZZLE_LINES[result.kind],
      };
    }
    if (id === "cuckoo") {
      cuckooTimer = 2.4;
      return { ...NOTES.cuckoo, sound: "cuckoo" };
    }
    if (id === "kettle") {
      kettleTimer = 4;
      return { ...NOTES.kettle, sound: "kettle" };
    }
    if (id === "biscuit") {
      if (!busy()) {
        dog.mode = "beg";
        dog.timer = 2.2;
      }
      return { title: BARK_TITLE, text: lineFrom(BARK_TREATS, treats++), sound: "chime" };
    }
    if (id === "shelf") {
      const count = state.rosewood.treasures.length;
      return {
        title: NOTES.shelf.title,
        text: !count ? NOTES.shelf.empty : count >= TREASURES.length ? NOTES.shelf.full : NOTES.shelf.some(count, TREASURES.length),
      };
    }
    if (id === "nap") {
      const text = night ? NOTES.nap.morning : NOTES.nap.evening;
      return { title: NOTES.nap.title, text, night: !night };
    }
    if (id === "star") {
      stars = !stars;
      return { title: NOTES.star.title, text: stars ? NOTES.star.on : NOTES.star.off };
    }
    const note = NOTES[id];
    return note ? { title: note.title, text: note.text } : null;
  }

  // Bark's pose blends toward a target each frame: 0 stands, 1 sits, 2 begs,
  // -1 digs (nose down).
  function poseBark(dt, t, moving, speed) {
    const target = dog.mode === "beg" ? 2 : dog.mode === "dig" ? -1 : moving ? 0 : 1;
    dog.pose += (target - dog.pose) * (1 - Math.exp(-dt * 6));
    const sit = Math.max(0, Math.min(1, dog.pose)),
      beg = Math.max(0, dog.pose - 1),
      down = Math.max(0, -dog.pose);
    torso.rotation.x = -sit * 0.38 - beg * 0.7 + down * 0.25;
    torso.position.y = -sit * 0.12 + beg * 0.08 - down * 0.05;
    torso.position.z = -sit * 0.12;
    dog.gait += dt * (moving ? 4 + speed * 3.2 : 0);
    const swing = moving ? Math.sin(dog.gait) * 0.6 : 0;
    legs[0].rotation.x = swing - beg * 1.2 + sit * 0.38 + (down ? Math.sin(t * 22) * 0.9 * down : 0);
    legs[3].rotation.x = swing + sit * 1.2;
    legs[1].rotation.x = -swing - beg * 1.2 + sit * 0.38 + (down ? Math.sin(t * 22 + 1.6) * 0.9 * down : 0);
    legs[2].rotation.x = -swing + sit * 1.2;
    torso.position.y += moving ? Math.abs(Math.sin(dog.gait)) * 0.04 : 0;
    dog.wag += (1 - dog.wag) * (1 - Math.exp(-dt * 0.8));
    tail.rotation.z = Math.sin(t * (7 + dog.wag * 5)) * (0.35 + dog.wag * 0.15);
    tail.rotation.x = -0.3 - sit * 0.4;
    ears.forEach((e, i) => {
      e.rotation.z = (i ? -1 : 1) * (moving ? 0.25 + Math.sin(dog.gait * 2) * 0.1 : 0.1);
      e.rotation.x = moving ? -0.3 : 0;
    });
    // Look at the visitor while sitting; head down while digging.
    const toPlayer = Math.atan2(player.x - dog.x, player.z - dog.z),
      turn = Math.atan2(Math.sin(toPlayer - dog.heading), Math.cos(toPlayer - dog.heading));
    head.rotation.y = moving || down ? 0 : Math.max(-0.7, Math.min(0.7, turn));
    head.rotation.x = -0.15 + down * 0.5 - beg * 0.2 + (moving ? 0 : Math.sin(t * 1.3) * 0.04);
    head.rotation.z = moving ? 0 : Math.sin(t * 0.7) * 0.12;
  }
  // Heads toward a point; returns true on arrival.
  function trot(to, dt, speed, stopAt = 0.05) {
    const dx = to.x - dog.x,
      dz = to.z - dog.z,
      d = Math.hypot(dx, dz);
    if (d <= stopAt) return true;
    const step = Math.min(d - stopAt, speed * dt);
    dog.x += (dx / d) * step;
    dog.z += (dz / d) * step;
    face(Math.atan2(dx, dz), dt);
    return d - step <= stopAt + 1e-3;
  }
  function face(heading, dt, rate = 10) {
    const turn = Math.atan2(Math.sin(heading - dog.heading), Math.cos(heading - dog.heading));
    dog.heading += turn * (1 - Math.exp(-dt * rate));
  }
  function updateBark(dt, t, walker) {
    let moving = false,
      speed = 0;
    if (dog.mode === "follow" || dog.mode === "beg") {
      trail.record(walker.position.x, walker.position.z);
      if (dog.mode === "beg") {
        dog.timer -= dt;
        if (dog.timer <= 0) dog.mode = "follow";
      }
      const remaining = trail.remaining(dog);
      speed = remaining > 3 ? 4.2 : 2.8;
      const before = { x: dog.x, z: dog.z };
      const moved = dog.mode === "beg" ? 0 : trail.follow(dog, speed * dt, BARK_GAP);
      moving = moved > 0.002;
      if (moving) face(Math.atan2(dog.x - before.x, dog.z - before.z), dt);
      else face(Math.atan2(player.x - dog.x, player.z - dog.z), dt, 3);
    } else if (dog.mode === "chase") {
      // Wait for the ball to land, then fetch it.
      speed = 4.5;
      moving = !trot(dog.target, dt, speed, 0.8);
      if (!moving && ballState.phase === "rest") {
        ballState.phase = "carried";
        dog.mode = "return";
      }
    } else if (dog.mode === "return") {
      speed = 3.6;
      moving = !trot({ x: player.x, z: player.z }, dt, speed, 1.7);
      if (!moving) {
        dog.mode = "follow";
        dog.wag = 3;
        trail.reset({ x: dog.x, z: dog.z }, { x: player.x, z: player.z });
        ballState.phase = "held";
        ball.visible = false;
        holding = true;
        state.rosewood.fetches++;
        save();
        pendingNote = { title: BARK_TITLE, text: lineFrom(BARK_FETCHES, fetchLine++), sound: "woof" };
      }
    } else if (dog.mode === "dig-go") {
      speed = 3.6;
      moving = !trot(dog.target, dt, speed, 0.05);
      if (!moving) {
        face(Math.atan2(digAt.x - dog.x, digAt.z - dog.z), 1, 30);
        dog.mode = "dig";
        dog.timer = 2.2;
        pendingNote = { sound: "dig" };
      }
    } else if (dog.mode === "dig") {
      dog.timer -= dt;
      face(Math.atan2(digAt.x - dog.x, digAt.z - dog.z), dt);
      if (dog.timer <= 0) {
        lastDig = dig(state);
        save();
        updateShelf();
        showFound(lastDig);
        dog.mode = "follow";
        dog.wag = 3;
        trail.reset({ x: dog.x, z: dog.z }, { x: player.x, z: player.z });
        pendingNote =
          lastDig.kind === "found"
            ? {
                title: "BARK’S TREASURE",
                text: `${TREASURE_LINES[lastDig.treasure.id]} +${lastDig.petals} petals`,
                sound: "chime",
              }
            : { title: "BARK’S TREASURE", text: BONE_LINE, sound: "woof" };
      }
    }
    bark.position.set(dog.x, 0, dog.z);
    bark.rotation.y = dog.heading;
    poseBark(dt, t, moving, speed);
    // The digging spray.
    dirt.visible = dog.mode === "dig";
    if (dirt.visible) {
      for (let i = 0; i < dirtSeeds.length; i++) {
        const [sx, up, phase] = dirtSeeds[i],
          f = (t * 1.6 + phase) % 1,
          back = -Math.sin(dog.heading),
          backZ = -Math.cos(dog.heading);
        dummy.position.set(dog.x + back * (0.4 + f * 1.1) + Math.cos(dog.heading) * sx * f, 0.15 + up * f * (1 - f) * 2, dog.z + backZ * (0.4 + f * 1.1) - Math.sin(dog.heading) * sx * f);
        dummy.scale.setScalar(0.05 * (1 - f * 0.5));
        dummy.updateMatrix();
        dirt.setMatrixAt(i, dummy.matrix);
      }
      dirt.instanceMatrix.needsUpdate = true;
    }
  }
  const dummy = new T.Object3D();
  let pendingNote = null;
  function showFound(result) {
    found.clear();
    if (result.kind === "found") figure(trinketShapes[result.treasure.id], found);
    else
      figure(
        [
          [C, "#f1e6cc", [0, 0.05, 0], [0.04, 0.3, 0.04], [0, 0, Math.PI / 2]],
          [S, "#f1e6cc", [0.16, 0.08, 0], [0.05, 0.05, 0.05]],
          [S, "#f1e6cc", [0.16, 0.02, 0], [0.05, 0.05, 0.05]],
          [S, "#f1e6cc", [-0.16, 0.08, 0], [0.05, 0.05, 0.05]],
          [S, "#f1e6cc", [-0.16, 0.02, 0], [0.05, 0.05, 0.05]],
        ],
        found,
      );
    found.scale.setScalar(2.2);
    found.visible = true;
    foundTimer = 2.5;
  }
  function updateBall(dt) {
    if (ballState.phase === "flying") {
      ballState.t = Math.min(1, ballState.t + dt / 0.85);
      const { from, to, t } = ballState;
      ballState.x = from.x + (to.x - from.x) * t;
      ballState.z = from.z + (to.z - from.z) * t;
      ballState.y = 2.0 * (1 - t) + 0.13 * t + Math.sin(t * Math.PI) * 1.4;
      if (t >= 1) {
        ballState.phase = "rest";
        ballState.y = 0.13;
      }
    }
    if (ballState.phase === "carried") {
      // In Bark's mouth.
      ballState.x = dog.x + Math.sin(dog.heading) * 0.85;
      ballState.z = dog.z + Math.cos(dog.heading) * 0.85;
      ballState.y = 1.05;
    }
    ball.position.set(ballState.x, ballState.y, ballState.z);
  }

  function updateFish(t, dt) {
    const feeding = feedTimer > 0;
    fish.forEach((f, i) => {
      const u = t * f.speed + f.phase;
      let x = Math.sin(u) * 0.62,
        y = TANK.y + f.height + Math.sin(u * 1.7 + i) * 0.06,
        z = f.lane + Math.sin(u * 0.8 + i) * 0.06;
      if (feeding) {
        const pull = Math.min(1, (7 - feedTimer) * 0.8) * Math.min(1, feedTimer);
        x = x * (1 - pull) + (Math.sin(t * 2 + i) * 0.18) * pull;
        y = y * (1 - pull) + (TANK.y + TANK.h * 0.8 - (i % 3) * 0.05) * pull;
        z = z * (1 - pull) + (Math.cos(t * 1.5 + i) * 0.1) * pull;
      }
      const dx = x - f.group.position.x;
      if (Math.abs(dx) > 1e-4) f.heading += ((dx > 0 ? Math.PI / 2 : -Math.PI / 2) - f.heading) * (1 - Math.exp(-dt * 4));
      f.group.position.set(x, y, z);
      f.group.rotation.y = f.heading;
      f.tail.rotation.y = Math.sin(t * (feeding ? 16 : 9) + i) * 0.5;
    });
    flakes.visible = feeding;
    if (feeding)
      flakeSeeds.forEach(([x, z, p], i) => {
        const sink = Math.min(1, (7 - feedTimer) / 6 + p * 0.2);
        dummy.position.set(x + Math.sin(t + i) * 0.03, TANK.y + TANK.h * 0.9 - sink * 0.5, z);
        dummy.rotation.set(t + i, i, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        flakes.setMatrixAt(i, dummy.matrix);
      });
    flakes.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 12; i++) {
      const f = (t * 0.35 + i / 12) % 1;
      dummy.position.set(i < 6 ? -0.15 + Math.sin(f * 9 + i) * 0.02 : 0.42, TANK.y + 0.2 + f * (TANK.h * 0.7), i < 6 ? 0.1 : -0.08);
      dummy.scale.setScalar(0.012 + (i % 3) * 0.006);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      bubbles.setMatrixAt(i, dummy.matrix);
    }
    bubbles.instanceMatrix.needsUpdate = true;
  }

  return {
    ...ROSEWOOD_ROOM,
    scene,
    sun,
    windowLight,
    shadowLights: [sun, windowLight],
    // Nothing that moves casts a shadow, so the maps never need refreshing.
    staticShadows: true,
    exposure: 1.0,
    points,
    layout: {
      bounds: { minX: -W, maxX: W, minZ: P.garden, maxZ: P.front },
      spawn: { x: 0, z: P.front - 0.9, yaw: 0 },
      colliders,
    },
    interact(point) {
      return interact(point);
    },
    enter() {
      // Bark bounds up the hall to meet you.
      Object.assign(dog, { x: 0, z: P.front - 0.9 - 2.6, heading: 0, mode: "follow", wag: 3, pose: 0 });
      trail.reset({ x: dog.x, z: dog.z }, { x: 0, z: P.front - 0.9 });
      holding = false;
      Object.assign(ballState, { phase: "rest", x: ballRest.x, z: ballRest.z, y: 0.13 });
      ball.visible = true;
      found.visible = false;
      pendingNote = { title: BARK_TITLE, text: lineFrom(BARK_GREETINGS, greetings++), sound: "woof", greet: true };
    },
    leave() {
      music = false;
    },
    setNight(value) {
      night = value;
    },
    // A note for the visitor that came from Bark rather than a key press.
    takeNote() {
      const note = pendingNote;
      pendingNote = null;
      return note;
    },
    update(time, motion = true, { dt = 0, walker } = {}) {
      const t = motion ? time : 0;
      walkerRef = walker;
      if (walker) {
        player = { x: walker.position.x, z: walker.position.z, yaw: walker.yaw };
      }
      if (walker) updateBark(dt, t, walker);
      updateBall(dt);
      updateFish(t, dt);
      feedTimer = Math.max(0, feedTimer - dt);
      // Fire.
      flames.forEach((f, i) => {
        f.scale.set(1 + Math.sin(t * 9 + i) * 0.12, 1 + Math.sin(t * 7 + i * 2) * 0.25, 1);
      });
      fireLight.intensity = (night ? 9 : 5) + Math.sin(t * 8) * 0.8 + Math.sin(t * 13) * 0.5;
      // The cuckoo clock's pendulum, hands and bird.
      pendulum.rotation.z = Math.sin(t * 2.6) * 0.32;
      minuteHand.rotation.z = -t * 0.05;
      hourHand.rotation.z = -t * 0.05 / 12 - 1.2;
      cuckooTimer = Math.max(0, cuckooTimer - dt);
      const out = cuckooTimer > 0 ? Math.min(1, Math.abs(Math.sin(((2.4 - cuckooTimer) / 2.4) * Math.PI * 3)) * 1.4) : 0;
      doors[0].rotation.y = -out * 1.6;
      doors[1].rotation.y = out * 1.6;
      bird.position.z = 0.05 + out * 0.16;
      // The kettle and its steam.
      kettleTimer = Math.max(0, kettleTimer - dt);
      const boil = kettleTimer > 0 ? Math.min(1, (4 - kettleTimer) / 1.2) * Math.min(1, kettleTimer) : 0;
      kettleLid.position.y = 0.32 + (boil > 0.5 ? Math.abs(Math.sin(t * 30)) * 0.02 : 0);
      steamMat.opacity = boil * 0.35;
      steam.forEach((s, i) => {
        const f = (t * 0.8 + i / 5) % 1;
        s.position.set(0.3 + f * 0.25, 0.3 + f * 0.9, Math.sin(f * 6 + i) * 0.05);
        s.scale.setScalar(0.06 + f * 0.16);
      });
      // The gramophone and its notes.
      if (music) disc.rotation.y -= dt * 3.5;
      tonearm.rotation.y += ((music ? -0.45 : 0) - tonearm.rotation.y) * (1 - Math.exp(-dt * 4));
      notes.forEach((n, i) => {
        const f = (t * 0.35 + i / 3) % 1;
        n.position.set(-5.95 + Math.sin(f * 5 + i) * 0.25 - 0.2, 2.1 + f * 1.4, 5.2 - f * 0.4);
        n.material.opacity = music ? Math.sin(f * Math.PI) * 0.9 : 0;
        n.visible = music;
      });
      // The aquarium's treasure chest burps a bubble now and then.
      chestTimer = (chestTimer + dt) % 6;
      lid.rotation.x = chestTimer > 5 ? -Math.sin(((chestTimer - 5) / 1) * Math.PI) * 0.6 : 0;
      // The star lamp.
      drum.rotation.y += stars ? dt * 0.3 : 0;
      starsMat.opacity += ((stars ? (night ? 0.9 : 0.45) : 0) - starsMat.opacity) * (1 - Math.exp(-dt * 3));
      starSky.visible = starsMat.opacity > 0.01;
      starSky.rotation.z = drum.rotation.y;
      starGlow.emissiveIntensity = stars ? 1.6 : 0.15;
      // The robin bobs and the laundry sways.
      robin.position.y = 1.13 + Math.max(0, Math.sin(t * 2.3)) * 0.05;
      robin.rotation.y = -0.6 + Math.sin(t * 0.9) * 0.4;
      laundry.rotation.x = 0;
      laundry.rotation.z = Math.sin(t * 1.1) * 0.06;
      // Petting heart.
      heartTimer = Math.max(0, heartTimer - dt);
      heartSprite.visible = heartTimer > 0;
      if (heartSprite.visible) {
        heartSprite.position.set(dog.x, 1.6 + (1.6 - heartTimer) * 0.5, dog.z);
        heartSprite.material.opacity = Math.min(1, heartTimer * 1.5);
      }
      // A found treasure rises from the soil, then goes to the shelf.
      foundTimer = Math.max(0, foundTimer - dt);
      found.visible = foundTimer > 0;
      found.position.y = 0.2 + Math.min(1, (2.5 - foundTimer) * 2) * 0.9;
      found.rotation.y = t * 2;
      // Evening: lamps up, sun down, windows blue, fairy lights on.
      const k = 1 - Math.exp(-dt * 3);
      sun.intensity += ((night ? 0.35 : 2.3) - sun.intensity) * k;
      sun.color.lerp(new T.Color(night ? "#9fb3e0" : "#ffe7bf"), k);
      ambient.intensity += ((night ? 0.55 : 1.15) - ambient.intensity) * k;
      windowLight.intensity += ((night ? 0 : 70) - windowLight.intensity) * k;
      kitchenLight.intensity += ((night ? 14 : 5) - kitchenLight.intensity) * k;
      bedLight.intensity += ((night ? 8 : 2.5) - bedLight.intensity) * k;
      windowMat.emissiveIntensity = night ? 0.08 : 0.55;
      windowMat.color.set(night ? "#5d7898" : "#e9f1d4");
      fairyMat.emissiveIntensity = night ? 2.2 : 0.1;
      shadeMat.emissiveIntensity = night ? 1.4 : 0.25;
      hallGlow.emissiveIntensity = night ? 1.6 : 0.8;
      skyMat.uniforms.top.value.lerp(new T.Color(night ? "#1d2c4a" : "#8fbcd6"), k);
      skyMat.uniforms.horizon.value.lerp(new T.Color(night ? "#5b5a7a" : "#f4e6c6"), k);
      scene.background.lerp(new T.Color(night ? "#1d2c4a" : "#a9cbd6"), k);
    },
    diagnostics: () => ({
      bark: { x: dog.x, z: dog.z, mode: dog.mode },
      holding,
      ball: ballState.phase,
      music,
      stars,
      feeding: feedTimer > 0,
    }),
  };
}
