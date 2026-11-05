import * as T from "three";
import { GROUND_WALLS, INN, UPPER_WALLS } from "./layout.js";
import { createParts } from "./parts.js";

// The house itself, which draws in every room: floors, ceilings and the roof's
// slopes, every wall with its finishes, door and window, and the stair. Rooms
// add furniture on top of this. Walls and floors cast the sun's shadow, so the
// only light that reaches in from outside comes through the glass.

const { halfW, front, back, hall, partition, sittingBack, ceiling, loft, outer, knee, slopeX, upperCeiling, stair } = INN;

export function buildShell(M, sheet) {
  // Each floor's walls draw only while that floor can be seen; the slab between
  // them, the ground floor's floors and the stair always do.
  const ground = createParts("shell", M, sheet, 0),
    upper = createParts("shell-upper", M, sheet, loft),
    middle = createParts("shell-middle", M, sheet, 0);
  const { box, cyl, group, slab, mat } = middle;

  // ---------------------------------------------------------------- the walls
  function buildWall(wall, parts, height) {
    const { axis, at, thick, from, to, faces, openings = [] } = wall,
      h = wall.height ?? height,
      sorted = [...openings].sort((a, b) => a.from - b.from),
      pieces = [];
    let s = from;
    for (const o of sorted) {
      if (o.from > s) pieces.push([s, o.from, 0, h]);
      if ((o.bottom ?? 0) > 0) pieces.push([o.from, o.to, 0, o.bottom]);
      if (o.top < h) pieces.push([o.from, o.to, o.top, h]);
      s = o.to;
    }
    if (s < to) pieces.push([s, to, 0, h]);
    faces.forEach((name, i) => {
      if (!name) return;
      const side = i ? 1 : -1,
        finish = M.FINISHES[name],
        far = at + (side * thick) / 2,
        near = at;
      for (const [a, b, y0, y1] of pieces) {
        const m = finish.paper,
          t = finish.tile;
        if (axis === "x") parts.slab(m, a, b, y0, y1, Math.min(near, far), Math.max(near, far), t);
        else parts.slab(m, Math.min(near, far), Math.max(near, far), y0, y1, a, b, t);
        if (y0 !== 0) continue;
        // Dado panelling, its rail and the skirting along the foot of each face.
        const reach = Math.min(y1, finish.dado ? finish.dadoH : 0);
        if (finish.dado && reach > 0) {
          const inset = far + side * 0.012,
            dt = finish.dadoTile ?? 0.64;
          if (axis === "x") parts.slab(finish.dado, a, b, 0, reach, Math.min(far, inset), Math.max(far, inset), dt, { shadow: false });
          else parts.slab(finish.dado, Math.min(far, inset), Math.max(far, inset), 0, reach, a, b, dt, { shadow: false });
        }
        if (name !== "render" && !finish.bare) {
          const skirt = far + side * 0.016,
            colour = mat(finish.dado === M.metro ? "#3b3f3c" : "#f3ecdb", 0.55);
          (axis === "x"
            ? parts.box(colour, (a + b) / 2, 0.08, skirt, b - a, 0.16, 0.032)
            : parts.box(colour, skirt, 0.08, (a + b) / 2, 0.032, 0.16, b - a)
          ).castShadow = false;
          if (finish.rail && finish.dado && y1 >= finish.dadoH) {
            const rail = far + side * 0.018,
              colourR = mat(finish.rail, 0.5);
            (axis === "x"
              ? parts.box(colourR, (a + b) / 2, finish.dadoH + 0.012, rail, b - a, 0.034, 0.036)
              : parts.box(colourR, rail, finish.dadoH + 0.012, (a + b) / 2, 0.036, 0.034, b - a)
            ).castShadow = false;
          }
        }
        if (finish.picture && y1 > 2.2) {
          const rail = far + side * 0.01;
          (axis === "x"
            ? parts.box(mat(finish.rail, 0.5), (a + b) / 2, 2.15, rail, b - a, 0.03, 0.02)
            : parts.box(mat(finish.rail, 0.5), rail, 2.15, (a + b) / 2, 0.02, 0.03, b - a)
          ).castShadow = false;
        }
      }
    });
    for (const o of sorted) {
      if (o.door || o.kind === "airing") doorway(wall, o, parts);
      else if (o.kind === "hatch") hatch(wall, o, parts);
      else windowUnit(wall, o, parts);
    }
  }

  // Lays out a thing at a place on a wall, facing local +z toward `side`.
  function onWall(wall, along, y, side, parts) {
    return wall.axis === "x"
      ? parts.group(along, y, wall.at, side > 0 ? 0 : Math.PI)
      : parts.group(wall.at, y, along, side > 0 ? Math.PI / 2 : -Math.PI / 2);
  }

  // ---------------------------------------------------------------- doorways
  const doorColour = {
    front: "#638a80", back: "#7f9c8c", private: "#93a494", goldfinch: "#8fab9b",
    linnet: "#8fab9b", bath: "#8fab9b", interior: "#e7dfc9",
  };
  function doorway(wall, o, parts) {
    const { thick } = wall,
      w = o.to - o.from,
      top = o.top,
      trim = M.trim;
    const facesWith = wall.faces.map((f, i) => (f ? (i ? 1 : -1) : 0)).filter(Boolean);
    for (const side of facesWith) {
      const g = onWall(wall, (o.from + o.to) / 2, 0, side, parts);
      for (const s of [-1, 1]) parts.box(trim, (s * (w + 0.1)) / 2, top / 2, thick / 2 + 0.012, 0.09, top, 0.024, 0, g);
      parts.box(trim, 0, top + 0.05, thick / 2 + 0.014, w + 0.2, 0.1, 0.028, 0, g);
      parts.box(trim, 0, top + 0.1, thick / 2 + 0.03, w + 0.26, 0.022, 0.05, 0, g);
    }
    // The lining of the opening.
    const lining = onWall(wall, (o.from + o.to) / 2, 0, 1, parts);
    for (const s of [-1, 1]) parts.box(trim, (s * (w - 0.015)) / 2, top / 2, 0, 0.018, top, thick + 0.012, 0, lining);
    parts.box(trim, 0, top - 0.008, 0, w, 0.018, thick + 0.012, 0, lining);
    if (o.kind === "airing") {
      airingCupboard(wall, o, parts);
      return;
    }
    if (o.kind === "front") {
      frontDoor(wall, o, parts);
      return;
    }
    leaf(wall, o, parts);
  }
  function leaf(wall, o, parts) {
    const w = o.to - o.from - 0.03,
      h = Math.min(o.top, 2.05) - 0.03,
      kind = o.kind,
      paint = mat(doorColour[kind] ?? doorColour.interior, 0.52);
    const hingeAt = o.hinge === "to" ? o.to - 0.012 : o.from + 0.012,
      closed = o.hinge === "to" ? -1 : 1,
      across = o.swing ?? 1;
    const dir = o.shut ? 0 : o.open ?? 2.85,
      c = Math.cos(dir),
      sn = Math.sin(dir);
    // Which way the leaf's length runs.
    const alongX = closed * c,
      alongS = across * sn;
    const g =
      wall.axis === "x"
        ? parts.group(hingeAt, 0, wall.at + (o.shut ? 0 : (across * wall.thick) / 2), Math.atan2(-alongS, alongX))
        : parts.group(wall.at + (o.shut ? 0 : (across * wall.thick) / 2), 0, hingeAt, Math.atan2(-closed * c, across * sn));
    parts.box(paint, w / 2, h / 2 + 0.012, 0, w, h, 0.036, 0, g);
    // Plank joints and ledges on both faces, a latch on each.
    for (const s of [-1, 1]) {
      for (let i = 1; i < 5; i++) parts.box(mat("#2c2a26", 0.8), (i * w) / 5, h / 2 + 0.012, s * 0.019, 0.006, h - 0.02, 0.003, 0, g);
      for (const y of [0.32, 1.02, 1.72]) parts.box(paint, w / 2, y, s * 0.024, w - 0.04, 0.11, 0.013, 0, g);
      parts.box(M.iron, w - 0.08, 1.02, s * 0.03, 0.12, 0.03, 0.012, 0, g);
      parts.dot(M.iron, w - 0.08, 1.02, s * 0.042, 0.018, 0.018, 0.018, g);
    }
    for (const y of [0.32, 1.72]) parts.box(M.iron, 0.14, y, 0, 0.26, 0.022, 0.05, 0, g);
    if (kind === "back") {
      backDoorGlass(g, w, h, parts);
      // The stone step inside it.
      parts.box(mat("#8d8574", 0.8), (o.from + o.to) / 2, 0.008, wall.at + 0.12, o.to - o.from + 0.1, 0.016, wall.thick + 0.2).castShadow = false;
    }
    if (kind === "goldfinch" || kind === "linnet" || kind === "bath" || kind === "private") doorPlate(g, kind, w, parts);
    return g;
  }
  const PLATE_TEXT = { goldfinch: "Goldfinch", linnet: "Linnet", bath: "Bathroom", private: "Private" };
  function doorPlate(g, kind, w, parts) {
    const cell = sheet.cell(180, 70, (c, cw, ch) => {
      c.fillStyle = "#c6a05a";
      c.fillRect(0, 0, cw, ch);
      c.strokeStyle = "#7a5e2c";
      c.lineWidth = 3;
      c.strokeRect(5, 5, cw - 10, ch - 10);
      c.fillStyle = "#3a2d17";
      c.font = "italic 34px Georgia";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(PLATE_TEXT[kind], cw / 2, ch / 2 + 2);
    });
    for (const s of [-1, 1]) {
      const p = parts.sheetPlane(cell, w / 2, 1.42, s * 0.033, 0.24, 0.095, s > 0 ? 0 : Math.PI, g);
      p.castShadow = false;
    }
  }
  function backDoorGlass(g, w, h, parts) {
    // The top half is a window on the garden: a hole's worth of glass and bars.
    parts.box(mat("#6d8878", 0.52), w / 2, 1.55, 0.006, w, 0.01, 0.01, 0, g);
    parts.box(M.glass, w / 2, 1.58, 0.042, w - 0.2, 0.64, 0.006, 0, g);
    parts.sheetPlane(sky.garden, w / 2, 1.58, 0.038, w - 0.2, 0.64, 0, g);
    for (const a of [-1, 1]) parts.box(mat("#55705f", 0.52), w / 2 + (a * (w - 0.2)) / 6, 1.58, 0.044, 0.018, 0.64, 0.012, 0, g);
    parts.box(mat("#55705f", 0.52), w / 2, 1.58, 0.044, w - 0.2, 0.018, 0.012, 0, g);
  }
  // A view of the garden, small enough to stand in the back door's glass.
  const sky = {
    garden: sheet.cell(180, 180, (c, w, h) => {
      const grad = c.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "#a7c9d9");
      grad.addColorStop(0.55, "#f1e6c4");
      grad.addColorStop(0.56, "#7f9f58");
      grad.addColorStop(1, "#6f8f4a");
      c.fillStyle = grad;
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#5e7c44";
      c.beginPath();
      c.ellipse(55, 100, 62, 18, 0, 0, Math.PI * 2);
      c.ellipse(150, 98, 50, 15, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#776a58";
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(0, 72);
      c.lineTo(180, 78);
      c.stroke();
      c.fillStyle = "#fbf8f0";
      c.fillRect(28, 73, 34, 26);
      c.fillRect(70, 74, 40, 30);
      c.fillRect(118, 76, 26, 24);
    }),
  };

  function frontDoor(wall, o, parts) {
    const w = o.to - o.from - 0.03,
      paint = mat(doorColour.front, 0.42),
      g = parts.group((o.from + o.to) / 2, 0, wall.at - 0.04, Math.PI);
    parts.box(paint, 0, 1.03, 0, w, 2.04, 0.05, 0, g);
    // Six raised panels, and the brass everyone polishes.
    for (const yy of [0.42, 1.06]) for (const s of [-1, 1]) parts.box(mat("#71998e", 0.42), s * 0.22, yy, 0.03, 0.34, yy > 1 ? 0.56 : 0.56, 0.018, 0, g);
    parts.box(M.brass, 0, 1.26, 0.04, 0.26, 0.05, 0.012, 0, g);
    parts.dot(M.brass, 0.4, 1.05, 0.05, 0.03, 0.03, 0.03, g);
    parts.box(M.brass, 0, 1.64, 0.035, 0.1, 0.12, 0.012, 0, g);
    parts.dot(M.brass, 0, 1.62, 0.05, 0.022, 0.03, 0.018, g);
    // The glazed fanlight over it, for the sun on the hall tiles.
    parts.box(M.glass, 0, 2.23, 0, w, 0.3, 0.006, 0, g);
    parts.box(M.trim, 0, 2.07, 0, w + 0.03, 0.05, 0.08, 0, g);
    for (let i = -2; i <= 2; i++) parts.box(M.trim, i * 0.17, 2.23, 0.006, 0.018, 0.3, 0.02, 0, g);
  }
  function airingCupboard(wall, o, parts) {
    // A recess behind the landing wall with slatted shelves and a warm tank.
    const depth = 0.72,
      x0 = wall.at - wall.thick / 2 - depth,
      x1 = wall.at - wall.thick / 2;
    parts.box(mat("#b89a70", 0.8), (x0 + x1) / 2, 1.03, o.from - 0.01, depth, 2.06, 0.02);
    parts.box(mat("#b89a70", 0.8), (x0 + x1) / 2, 1.03, o.to + 0.01, depth, 2.06, 0.02);
    parts.box(mat("#b89a70", 0.8), x0 - 0.01, 1.03, (o.from + o.to) / 2, 0.02, 2.06, o.to - o.from + 0.04);
    parts.box(mat("#c5a982", 0.8), (x0 + x1) / 2, 2.06, (o.from + o.to) / 2, depth, 0.02, o.to - o.from + 0.04);
    parts.box(mat("#a88a64", 0.8), (x0 + x1) / 2, 0.005, (o.from + o.to) / 2, depth, 0.01, o.to - o.from + 0.04);
    // The copper tank, and slats above and below it.
    parts.cyl(M.copper, x0 + 0.3, 0.55, (o.from + o.to) / 2, 0.24, 1, 0.24, parts.base, 18);
    const c = (o.from + o.to) / 2;
    const towels = [["#f4efe2", "#e6d9b8", "#f4efe2", "#b5c7c8", "#f4efe2"], ["#e9c8b4", "#f4efe2", "#f4efe2", "#b7c49e"], ["#f4efe2", "#d8cbe0", "#f4efe2", "#f4efe2", "#e6d9b8"]];
    [1.2, 1.56, 1.9].forEach((y, i) => {
      for (let k = 0; k < 6; k++) parts.box(M.pine, (x0 + x1) / 2, y - 0.012, c - 0.36 + k * 0.144, depth - 0.02, 0.018, 0.1);
      if (i < 2) {
        parts.linenStack(x0 + 0.34, y, c - 0.2, 0.42, 0.3, towels[i], 0.06);
        parts.linenStack(x0 + 0.34, y, c + 0.2, 0.42, 0.3, towels[i + 1], 0.06);
      } else {
        parts.linenStack(x0 + 0.34, y, c, 0.46, 0.5, ["#f4efe2", "#f4efe2", "#b5c7c8"], 0.05);
      }
    });
    // Lavender bags on hooks and the door folded open against the wall.
    parts.dot(mat("#8f79ae", 0.96), x1 - 0.06, 1.38, o.to - 0.05, 0.04, 0.06, 0.04);
    const g = parts.group(wall.at + wall.thick / 2 + 0.006, 0, o.from + 0.01, Math.atan2(0.99, 0.12));
    parts.box(mat(doorColour.interior, 0.52), (o.to - o.from - 0.02) / 2, 1.04, 0, o.to - o.from - 0.02, 2.02, 0.03, 0, g);
    parts.dot(M.brass, o.to - o.from - 0.1, 1.04, 0.03, 0.02, 0.02, 0.02, g);
  }
  function hatch(wall, o, parts) {
    const w = o.to - o.from,
      h = o.top - o.bottom,
      cx = (o.from + o.to) / 2,
      cy = (o.top + o.bottom) / 2;
    // A counter through the wall and a sliding shutter pushed back above.
    parts.box(M.oak, cx, o.bottom + 0.012, wall.at, w + 0.16, 0.03, wall.thick + 0.36);
    for (const s of [-1, 1]) parts.box(M.trim, cx + s * (w / 2 + 0.03), cy, wall.at, 0.06, h + 0.08, wall.thick + 0.04);
    parts.box(M.trim, cx, o.top + 0.03, wall.at, w + 0.12, 0.06, wall.thick + 0.04);
  }

  // ----------------------------------------------------------------- windows
  const curtainGeometry = new Map();
  function curtainGeo(w, h, tile) {
    const key = `${w}/${h}/${tile}`;
    if (!curtainGeometry.has(key)) {
      const g = new T.PlaneGeometry(w, h, 22, 1),
        pos = g.attributes.position,
        uv = g.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        pos.setZ(i, Math.sin((x / w) * Math.PI * 11) * 0.02 + Math.sin((x / w) * Math.PI * 5) * 0.01);
        uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * h) / tile);
      }
      g.computeVertexNormals();
      curtainGeometry.set(key, g);
    }
    return curtainGeometry.get(key);
  }
  const CURTAINS = {
    "breakfast-front": { fabric: "ginghamBlue", net: true, tile: 0.9 },
    "breakfast-west": { fabric: "ginghamBlue", net: true, tile: 0.9 },
    "sitting-front": { fabric: "chintz", tile: 0.8, net: true },
    "sitting-east": { fabric: "chintz", tile: 0.8 },
    "kitchen-back": { fabric: "ginghamRed", tile: 0.8, cafe: true },
    "kitchen-west": { fabric: "ginghamRed", tile: 0.8, cafe: true },
    "goldfinch-gable": { fabric: "velvet", tile: 0.8, net: true },
    "linnet-gable": { fabric: "blueWool", tile: 0.6, net: true },
    "landing-gable": { fabric: "tartan", tile: 0.5 },
    "bath-gable": null,
  };
  function windowUnit(wall, o, parts) {
    const side = o.inside,
      w = o.to - o.from,
      h = o.top - o.bottom,
      g = onWall(wall, (o.from + o.to) / 2, (o.top + o.bottom) / 2, side, parts),
      depth = wall.thick,
      inner_ = depth / 2,
      paint = M.trim;
    // Lining and casing.
    for (const s of [-1, 1]) {
      parts.box(paint, (s * (w - 0.01)) / 2, 0, 0, 0.018, h, depth + 0.01, 0, g);
      parts.box(paint, s * (w / 2 + 0.05), 0, inner_ + 0.012, 0.09, h + 0.18, 0.024, 0, g);
    }
    parts.box(paint, 0, h / 2 - 0.008, 0, w, 0.018, depth + 0.01, 0, g);
    parts.box(paint, 0, h / 2 + 0.05, inner_ + 0.012, w + 0.19, 0.09, 0.024, 0, g);
    // The sill and the apron under it.
    parts.box(paint, 0, -h / 2 - 0.012, inner_ - depth / 2 + 0.05, w + 0.2, 0.03, depth + 0.13, 0.006, g);
    parts.box(paint, 0, -h / 2 - 0.08, inner_ + 0.012, w + 0.1, 0.1, 0.022, 0, g);
    // Sash frames, the meeting rail and six-over-six glazing bars.
    const z = -depth * 0.22,
      bars = wall.id.includes("bath") ? 1 : 2;
    for (const s of [-1, 1]) parts.box(paint, (s * (w - 0.08)) / 2, 0, z, 0.05, h - 0.02, 0.04, 0, g);
    parts.box(paint, 0, h / 2 - 0.03, z, w - 0.02, 0.05, 0.04, 0, g);
    parts.box(paint, 0, -h / 2 + 0.035, z, w - 0.02, 0.06, 0.04, 0, g);
    parts.box(paint, 0, 0, z + 0.006, w - 0.06, 0.04, 0.05, 0, g);
    for (let i = 1; i <= bars; i++) parts.box(paint, (i / (bars + 1) - 0.5) * (w - 0.1), 0, z, 0.018, h - 0.08, 0.018, 0, g);
    for (const yy of [-h / 4, h / 4]) parts.box(paint, 0, yy, z, w - 0.1, 0.018, 0.018, 0, g);
    parts.box(o.kind === "frosted" ? M.frosted : M.glass, 0, 0, z - 0.012, w - 0.08, h - 0.08, 0.006, 0, g);
    const dress = CURTAINS[o.id];
    if (!dress) return;
    const fabric = M[dress.fabric],
      inFront = inner_ + 0.06;
    if (dress.cafe) {
      // A little café curtain on a brass rod across the lower sash.
      const rod = parts.cyl(M.brass, 0, 0, inner_ - 0.05, 0.007, w - 0.04, 0.007, g, 6);
      rod.rotation.z = Math.PI / 2;
      for (const s of [-1, 1]) {
        const c = parts.kit.mesh(curtainGeo(w / 2 - 0.02, h / 2 - 0.03, dress.tile), fabric, (s * (w / 2 - 0.02)) / 2, -h / 4 - 0.01, inner_ - 0.05, g);
        c.material = fabricDouble(fabric);
      }
      return;
    }
    // A pole, its rings and finials, and full curtains drawn back to each side.
    const pole = parts.cyl(M.darkOak, 0, h / 2 + 0.14, inFront, 0.014, w + 0.74, 0.014, g, 7);
    pole.rotation.z = Math.PI / 2;
    for (const s of [-1, 1]) {
      parts.dot(M.darkOak, s * (w / 2 + 0.38), h / 2 + 0.14, inFront, 0.032, 0.032, 0.032, g);
      parts.box(M.brass, s * (w / 2 + 0.2), h / 2 + 0.14, inFront - 0.03, 0.02, 0.03, 0.06, 0, g);
      const curtainW = 0.34,
        curtainH = h + 0.42,
        x = s * (w / 2 + 0.1);
      const c = parts.kit.mesh(curtainGeo(curtainW, curtainH, dress.tile), fabric, x, h / 2 + 0.13 - curtainH / 2, inFront - 0.005, g);
      c.material = fabricDouble(fabric);
      for (let i = 0; i < 6; i++) parts.torus(M.brass, x - curtainW / 2 + (i / 5) * curtainW, h / 2 + 0.14, inFront, 0.018, 0.003, g);
      // The tie-back.
      const tie = parts.box(M.butter, x, -h / 2 + 0.3, inFront + 0.02, curtainW + 0.02, 0.03, 0.03, 0, g);
      tie.castShadow = false;
    }
    if (dress.net) {
      const n = parts.kit.mesh(curtainGeo(w - 0.08, h * 0.56, 0.16), M.net, 0, -h / 2 + (h * 0.56) / 2 + 0.03, z + 0.05, g);
      n.castShadow = false;
    }
  }
  const doubled = new Map();
  function fabricDouble(m) {
    if (!doubled.has(m)) {
      const c = m.clone();
      c.side = T.DoubleSide;
      doubled.set(m, c);
    }
    return doubled.get(m);
  }

  for (const wall of GROUND_WALLS) buildWall(wall, ground, loft);
  for (const wall of UPPER_WALLS) buildWall(wall, upper, upperCeiling + 0.3);

  // --------------------------------------------------------------- the floors
  const wide = halfW + outer + 0.5;
  // Downstairs, each room's floor. A step of a hair apart keeps them clean.
  slab(M.encaustic, -hall, hall, -0.2, 0, back - outer, front + outer, 1.06);
  slab(M.oakFloor, -wide, -hall, -0.2, 0, partition, front + outer, 1.3);
  slab(M.quarry, -wide, -hall, -0.2, 0, back - outer, partition, 0.92);
  slab(M.oakFloor, hall, wide, -0.2, 0, sittingBack, front + outer, 1.3, { alongZ: true });
  // The slab between the floors, with a hole for the stairwell. Its underside
  // is the ground floor's ceiling and its top the boards upstairs.
  const under = ceiling,
    top = loft,
    pieces = [
      [-wide, wide, stair.bottomZ, front + outer],
      [-wide, wide, back - outer, stair.topZ],
      [-wide, stair.minX, stair.topZ, stair.bottomZ],
      [stair.maxX, wide, stair.topZ, stair.bottomZ],
    ];
  for (const [x0, x1, z0, z1] of pieces) {
    slab(M.ceiling, x0, x1, under, top - 0.02, z0, z1, 1.6);
    slab(M.paleBoards, x0, x1, top - 0.02, top, z0, z1, 1.45, { alongZ: true });
  }
  // A timber trim round the well's edge.
  box(M.oak, stair.minX + 0.012, (under + top) / 2, (stair.topZ + stair.bottomZ) / 2, 0.024, top - under + 0.02, stair.bottomZ - stair.topZ);
  box(M.oak, (stair.minX + stair.maxX) / 2, (under + top) / 2, stair.bottomZ - 0.012, stair.maxX - stair.minX, top - under + 0.02, 0.024);
  // Oak beams across the ground floor's plaster.
  for (const z of [2.9, 1.3, -0.9, -2.6]) box(M.darkOak, -(halfW + hall) / 2, ceiling - 0.075, z, halfW - hall, 0.15, 0.17, 0.006);
  for (const z of [3.3, 1.1, -0.8]) box(M.darkOak, (halfW + hall) / 2, ceiling - 0.075, z, halfW - hall, 0.15, 0.17, 0.006);
  for (const z of [3.7, 2.1, -3.4]) box(M.darkOak, 0, ceiling - 0.06, z, hall * 2, 0.12, 0.13, 0.006);

  // ------------------------------------------------- the roof over the bedrooms
  const roofShell = upper;
  roofShell.slab(M.ceiling, -slopeX, slopeX, upperCeiling, upperCeiling + 0.1, back - outer, front + outer, 1.6);
  const rise = upperCeiling - knee.y,
    run = knee.x - slopeX,
    length = Math.hypot(rise, run),
    tilt = Math.atan2(rise, run),
    midX = (knee.x + slopeX) / 2,
    midY = (knee.y + upperCeiling) / 2;
  const slopeGeo = (zLength) => {
    const g = new T.BoxGeometry(length + 0.28, 0.06, zLength),
      uv = g.attributes.uv,
      pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 1.6, pos.getZ(i) / 1.6);
    return g;
  };
  for (const s of [-1, 1]) {
    const panel = roofShell.kit.mesh(slopeGeo(front - back + outer * 2), M.ceiling, s * midX, midY + 0.03, 0, roofShell.base);
    panel.rotation.z = -s * tilt;
    // Purlins and the rafters they carry, exposed in the old way.
    roofShell.box(M.darkOak, s * slopeX, upperCeiling - 0.05, 0, 0.14, 0.13, front - back);
    for (let z = back + 0.6; z < front; z += 1.15) {
      const r = roofShell.box(M.oak, s * midX, midY - 0.015, z, length + 0.08, 0.075, 0.08);
      r.rotation.z = -s * tilt;
    }
  }
  for (const z of [3.1, 0, -3.5]) roofShell.box(M.darkOak, 0, upperCeiling - 0.055, z, slopeX * 2, 0.11, 0.13);

  // ----------------------------------------------------------------- the stair
  const going = (stair.bottomZ - stair.topZ) / stair.risers,
    risePer = loft / stair.risers,
    sw = stair.maxX - stair.minX,
    cx = (stair.minX + stair.maxX) / 2;
  for (let i = 0; i < stair.risers; i++) {
    const y = (i + 1) * risePer,
      z0 = stair.bottomZ - i * going,
      z1 = z0 - going;
    box(M.oak, cx, y - 0.015, (z0 + z1) / 2 - 0.012, sw, 0.03, going + 0.024, 0.004);
    box(M.creamBoards, cx, y - risePer / 2, z0 + 0.002, sw, risePer, 0.016).castShadow = false;
    // The runner over tread and riser, and a brass rod in each angle.
    const run1 = box(M.runner, cx - 0.0, y + 0.002, (z0 + z1) / 2, sw * 0.66, 0.006, going, 0);
    run1.castShadow = false;
    const run2 = box(M.runner, cx, y - risePer / 2, z0 + 0.012, sw * 0.66, risePer, 0.006, 0);
    run2.castShadow = false;
    const rod = cyl(M.brass, cx, y - risePer + 0.012, z0 + 0.02, 0.005, sw * 0.72, 0.005, middle.base, 5);
    rod.rotation.z = Math.PI / 2;
  }
  // The panelled side of the flight, up the passage. Up to the string line.
  const panel = new T.Shape();
  panel.moveTo(stair.bottomZ + 0.02, 0);
  panel.lineTo(stair.bottomZ + 0.02, 0.17);
  panel.lineTo(stair.topZ, loft + 0.16);
  panel.lineTo(stair.topZ, 0);
  panel.closePath();
  const panelGeo = new T.ExtrudeGeometry(panel, { depth: 0.08, bevelEnabled: false });
  {
    const uv = panelGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 0.64, uv.getY(i) / 0.64);
  }
  const panelMesh = middle.kit.mesh(panelGeo, M.sageBoards, stair.minX, 0, 0, middle.base);
  panelMesh.rotation.y = -Math.PI / 2;
  // The string along its top, and the cupboard door under the stairs.
  const stringFrom = [stair.minX - 0.04, 0.2, stair.bottomZ + 0.02],
    stringTo = [stair.minX - 0.04, loft + 0.19, stair.topZ];
  middle.kit.beam(mat("#6e8370", 0.5), stringFrom, stringTo, 0.09, middle.base);
  {
    const door = group(stair.minX - 0.085, 0, -0.85, -Math.PI / 2);
    box(mat("#7f917f", 0.5), 0, 0.72, 0, 0.72, 1.42, 0.022, 0, door);
    for (const yy of [0.4, 1.05]) box(mat("#6e8370", 0.5), 0, yy, 0.014, 0.6, 0.48, 0.008, 0, door);
    middle.dot(M.iron, 0.29, 0.75, 0.024, 0.016, 0.016, 0.016, door);
  }
  // Newel, handrail and balusters up from the foot, dying into the ceiling.
  const railX = stair.minX - 0.04,
    railRise = 0.92,
    climb = (z) => ((stair.bottomZ - z) / (stair.bottomZ - stair.topZ)) * loft;
  const railEnd = stair.bottomZ - ((under - railRise - 0.02) / loft) * (stair.bottomZ - stair.topZ);
  middle.box(M.darkOak, railX, 0.6, stair.bottomZ + 0.03, 0.1, 1.2, 0.1, 0.008);
  middle.dot(M.darkOak, railX, 1.25, stair.bottomZ + 0.03, 0.065, 0.065, 0.065);
  middle.kit.beam(M.darkOak, [railX, railRise + climb(stair.bottomZ), stair.bottomZ], [railX, under - 0.02, railEnd], 0.058, middle.base);
  for (let z = stair.bottomZ - 0.1; z > stair.topZ + 0.02; z -= 0.14) {
    const y0 = climb(z) + 0.2,
      y1 = Math.min(climb(z) + railRise, under);
    if (y1 <= y0) continue;
    middle.cyl(M.darkOak, railX, (y0 + y1) / 2, z, 0.012, y1 - y0, 0.012, middle.base, 6);
  }
  // A second rail along the wall, on brass brackets, and a row of pictures rising.
  const wallRailX = stair.maxX - 0.075;
  middle.kit.beam(M.oak, [wallRailX, 0.92 + climb(stair.bottomZ - 0.1), stair.bottomZ - 0.1], [wallRailX, 0.92 + loft - 0.03, stair.topZ + 0.1], 0.036, middle.base);
  for (let i = 1; i < 4; i++) {
    const z = stair.bottomZ - (i / 4) * (stair.bottomZ - stair.topZ);
    middle.box(M.brass, stair.maxX - 0.04, 0.88 + climb(z), z, 0.07, 0.016, 0.016);
  }
  const stairPictures = [
    sheet.cell(150, 190, paintFinch), sheet.cell(150, 190, paintMill), sheet.cell(150, 190, paintThistle),
  ];
  stairPictures.forEach((cell, i) => {
    const z = 0.55 - i * 1.15;
    middle.picture(cell, stair.maxX - 0.08, climb(z) + 1.65, z, 0.34, 0.43, -Math.PI / 2);
  });
  // Upstairs: the rail round the well, with a square newel at each end.
  const upRail = stair.minX - 0.04;
  for (const z of [stair.topZ - 0.02, stair.bottomZ - 0.04]) {
    upper.box(M.darkOak, upRail, 0.54, z, 0.09, 1.08, 0.09, 0.006);
    upper.dot(M.darkOak, upRail, 1.12, z, 0.055, 0.055, 0.055);
  }
  upper.box(M.darkOak, upRail, 0.96, (stair.topZ + stair.bottomZ) / 2, 0.06, 0.05, stair.bottomZ - stair.topZ, 0.006);
  upper.box(M.darkOak, upRail, 0.06, (stair.topZ + stair.bottomZ) / 2, 0.06, 0.04, stair.bottomZ - stair.topZ);
  for (let z = stair.topZ + 0.14; z < stair.bottomZ - 0.08; z += 0.14) upper.cyl(M.darkOak, upRail, 0.5, z, 0.012, 0.88, 0.012, upper.base, 6);

  // -------------------------------------------------------------- the chimney
  // The breast runs through both floors; rooms dress its face.
  function breast(parts, x0, x1, fireX0, fireX1, fireTop, top, face) {
    const back = sittingBack + 0.07,
      sootBack = back + 0.06;
    parts.slab(M.chimney, x0, fireX0, 0, top, sittingBack, face, 1.6);
    parts.slab(M.chimney, fireX1, x1, 0, top, sittingBack, face, 1.6);
    parts.slab(M.chimney, fireX0, fireX1, fireTop, top, sittingBack, face, 1.6);
    // The firebox: sooted back and sides, and a floor of hearth brick.
    const soot = M.soot,
      brick = mat("#6a4a3b", 0.95);
    parts.box(soot, (fireX0 + fireX1) / 2, fireTop / 2, sootBack, fireX1 - fireX0, fireTop, 0.02);
    for (const x of [fireX0 + 0.012, fireX1 - 0.012]) parts.box(brick, x, fireTop / 2, (sootBack + face) / 2, 0.024, fireTop, face - sootBack);
    parts.box(soot, (fireX0 + fireX1) / 2, fireTop - 0.012, (sootBack + face) / 2, fireX1 - fireX0, 0.024, face - sootBack);
    parts.box(brick, (fireX0 + fireX1) / 2, 0.006, (sootBack + face) / 2, fireX1 - fireX0, 0.012, face - sootBack);
  }
  breast(ground, 2.5, 4.5, 3.0, 4.0, 0.92, ceiling, -1.35);
  breast(upper, 2.65, 4.35, 3.18, 3.82, 0.68, upperCeiling + 0.2, -1.4);

  return { ground, upper, middle };
}

function paintFinch(c, w, h) {
  c.fillStyle = "#efe6cf";
  c.fillRect(0, 0, w, h);
  c.strokeStyle = "#8c8359";
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(70, h - 10);
  c.quadraticCurveTo(62, 110, 86, 70);
  c.stroke();
  c.fillStyle = "#b4a2bf";
  c.beginPath();
  c.arc(88, 62, 13, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#d3aa3f";
  c.beginPath();
  c.ellipse(70, 105, 26, 16, 0.3, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#3a332b";
  c.beginPath();
  c.ellipse(46, 96, 20, 6, 0.3, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#b5402f";
  c.beginPath();
  c.arc(92, 96, 9, 0, Math.PI * 2);
  c.fill();
}
function paintMill(c, w, h) {
  const sky = c.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#c5d9dd");
  sky.addColorStop(0.7, "#efe2bd");
  sky.addColorStop(0.71, "#7f9f6f");
  sky.addColorStop(1, "#5e7d5b");
  c.fillStyle = sky;
  c.fillRect(0, 0, w, h);
  c.fillStyle = "#dacaa0";
  c.fillRect(44, 74, 62, 62);
  c.fillStyle = "#6e4c3a";
  c.beginPath();
  c.moveTo(36, 76);
  c.lineTo(75, 42);
  c.lineTo(114, 76);
  c.fill();
  c.strokeStyle = "#4e3a28";
  c.lineWidth = 3;
  c.beginPath();
  c.arc(40, 118, 20, 0, Math.PI * 2);
  c.stroke();
  c.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 4;
    c.moveTo(40 - Math.cos(a) * 20, 118 - Math.sin(a) * 20);
    c.lineTo(40 + Math.cos(a) * 20, 118 + Math.sin(a) * 20);
  }
  c.stroke();
}
function paintThistle(c, w, h) {
  c.fillStyle = "#3f5a55";
  c.fillRect(0, 0, w, h);
  c.strokeStyle = "#a9c09b";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(75, h - 12);
  c.lineTo(75, 80);
  c.stroke();
  c.fillStyle = "#a9c09b";
  for (const s of [-1, 1]) {
    c.beginPath();
    c.ellipse(75 + s * 22, 130, 25, 8, s * 0.7, 0, Math.PI * 2);
    c.fill();
  }
  c.beginPath();
  c.arc(75, 74, 15, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "#cfa8ce";
  c.lineWidth = 2.6;
  for (let k = -6; k <= 6; k++) {
    c.beginPath();
    c.moveTo(75 + k * 2, 64);
    c.lineTo(75 + k * 5, 34 + Math.abs(k) * 2.2);
    c.stroke();
  }
}
