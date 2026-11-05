import { curve } from "../regions/lines.js";
import { LANE, MARKET, PATHS as MARKET_PATHS } from "../regions/market-layout.js";
import { MILLPOND } from "../regions/millpond-layout.js";
import { ORCHARD, FRUIT_TREES, PATH as ORCHARD_PATH } from "../regions/orchard-layout.js";
import { HERON } from "../regions/heron-layout.js";
import { MARSH, TRAILS as MARSH_TRAILS } from "../regions/marsh-layout.js";
import { WOOD, TREES, TRAILS as WOOD_TRAILS } from "../regions/wood-layout.js";
import { ALLOTMENTS } from "../regions/allotments-layout.js";
import { regionWater } from "../regions/index.js";
import { WORLD, regionAt, terrainHeight } from "../world-layout.js";

// The framed map on the hall's west wall: the real map, drawn from the layouts
// the world is built from, so a region added to the registry or a lane that
// moves shows up here too. North is up, which is -z.

// The village's roads, as src/village/paths.js lays them: [x, z] down the middle.
const VILLAGE_ROADS = [
  [[-17, 3], [11, 3]],
  [[-2, -8], [-2, 4.5]],
  [[-7, -5], [-7, 2]],
  [[2, -7.5], [2, -1.5]],
  [[16, -5.2], [16, 3.8]],
  [[-12, 2.5], [-12, 15.5]],
];
const VILLAGE_BUILDINGS = [
  [-7, -6, 2.8, 2.2],
  [1.2, -8.4, 2.4, 2.1],
  [17, -7, 2.2, 2.2],
];

const LAND = {
  brook: "#cfd195",
  lane: "#d6d197",
  meadow: "#cfd98a",
  gardens: "#d2cf8c",
  green: "#c9d788",
  market: "#e0ce92",
  heron: "#e0ce92",
  orchard: "#bccd7f",
  millpond: "#c7d294",
  marsh: "#a9cb99",
  wood: "#9fb975",
  allotments: "#d9c98a",
  fields: "#e0d5a0",
};

export function paintDistrictMap(c, w, h) {
  const ground = WORLD.ground,
    margin = 30,
    scale = Math.min((w - 2 * margin) / (ground.maxX - ground.minX), (h - 2 * margin) / (ground.maxZ - ground.minZ)),
    left = (w - (ground.maxX - ground.minX) * scale) / 2,
    top = (h - (ground.maxZ - ground.minZ) * scale) / 2,
    px = (x) => left + (x - ground.minX) * scale,
    pz = (z) => top + (z - ground.minZ) * scale;
  // Paper, foxed at the edges.
  c.fillStyle = "#e9dfc0";
  c.fillRect(0, 0, w, h);
  // The land, a cell at a time, with the hill and the wood's rolling floor in
  // hachures where a contour passes.
  const cell = 5;
  let last = [];
  for (let j = 0; j * cell < h; j++) {
    const row = [];
    for (let i = 0; i * cell < w; i++) {
      const x = ground.minX + (i * cell + cell / 2 - left) / scale,
        z = ground.minZ + (j * cell + cell / 2 - top) / scale;
      if (x < ground.minX || x > ground.maxX || z < ground.minZ || z > ground.maxZ) {
        row.push(0);
        continue;
      }
      const water = regionWater(x, z),
        band = Math.floor(terrainHeight(x, z) / 0.45);
      c.fillStyle = water != null ? "#8fbbc6" : LAND[regionAt(x, z)?.id] ?? LAND.fields;
      c.fillRect(i * cell, j * cell, cell + 0.5, cell + 0.5);
      row.push(band);
      if (water == null && ((i && row[i - 1] !== band) || (j && last[i] !== band))) {
        c.fillStyle = "rgba(118,84,50,0.55)";
        c.fillRect(i * cell + 1, j * cell + 1, 3, 3);
      }
    }
    last = row;
  }
  // The brook down the middle, from the weir to the mere.
  const line = (points, style, width, dash = []) => {
    c.save();
    c.strokeStyle = style;
    c.lineWidth = width;
    c.lineCap = c.lineJoin = "round";
    c.setLineDash(dash);
    c.beginPath();
    points.forEach(([x, z], i) => (i ? c.lineTo(px(x), pz(z)) : c.moveTo(px(x), pz(z))));
    c.stroke();
    c.restore();
  };
  line([[MILLPOND.brookX, MILLPOND.weir.crest], [MILLPOND.brookX, MARSH.mouth]], "#54808e", 3.3 * scale);
  line([[MILLPOND.brookX, MILLPOND.weir.crest], [MILLPOND.brookX, MARSH.mouth]], "#8fbbc6", 2.4 * scale);
  // Roads and lanes in double-lined buff, footpaths dashed.
  for (const road of [...VILLAGE_ROADS, LANE, ...MARKET_PATHS]) {
    line(road, "#7c6444", 1.1 * scale);
    line(road, "#f3e9c6", 0.75 * scale);
  }
  const trail = (t) => line(t, "#7c6444", 2, [7, 5]);
  trail(ORCHARD_PATH);
  for (const t of [...MARSH_TRAILS, ...WOOD_TRAILS]) trail(t);
  trail(curve([[ALLOTMENTS.path.x, ALLOTMENTS.path.fromZ], [ALLOTMENTS.path.x, ALLOTMENTS.path.toZ]]));
  trail([[ALLOTMENTS.crossPath.fromX, ALLOTMENTS.crossPath.z], [ALLOTMENTS.crossPath.toX, ALLOTMENTS.crossPath.z]]);
  // Trees: a little loop each, oak-brown in the wood and green in the orchard.
  const tree = (x, z, r, fill) => {
    c.fillStyle = fill;
    c.strokeStyle = "rgba(60,60,30,0.7)";
    c.lineWidth = 1;
    c.beginPath();
    c.arc(px(x), pz(z), r, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  };
  for (const t of TREES) tree(t.x, t.z, 5.5, "#8fa766");
  tree(WOOD.oak.x, WOOD.oak.z, 11, "#6f8f52");
  for (const t of FRUIT_TREES) tree(t.x, t.z, 4.5, "#a7c07a");
  // The allotments' plots, and every building as a block of ink.
  c.strokeStyle = "#7c6444";
  c.lineWidth = 1.5;
  for (const plot of [...ALLOTMENTS.plots, ...ALLOTMENTS.neighbours])
    c.strokeRect(px(plot.x - plot.w / 2), pz(plot.z - plot.d / 2), plot.w * scale, plot.d * scale);
  const block = (x, z, bw, bd) => {
    c.fillStyle = "#6b3a2c";
    c.fillRect(px(x - bw / 2), pz(z - bd / 2), bw * scale, bd * scale);
  };
  for (const [x, z, bw, bd] of VILLAGE_BUILDINGS) block(x, z, bw * 1.6, bd * 1.6);
  block(MARKET.teaRoom.x, MARKET.teaRoom.z, MARKET.teaRoom.w, MARKET.teaRoom.d);
  block(MARKET.postOffice.x, MARKET.postOffice.z, MARKET.postOffice.w, MARKET.postOffice.d);
  block(HERON.x, HERON.z, 11, 8);
  block(MARSH.hide.x, MARSH.hide.z, MARSH.hide.w, MARSH.hide.d);
  block(ALLOTMENTS.shed.x, ALLOTMENTS.shed.z, ALLOTMENTS.shed.w, ALLOTMENTS.shed.d);
  c.fillStyle = "#6b3a2c";
  c.beginPath();
  c.arc(px(ORCHARD.windmill.x), pz(ORCHARD.windmill.z), 7, 0, Math.PI * 2);
  c.fill();
  // Names, in a surveyor's italic.
  const name = (text, x, z, size = 25, tilt = 0, colour = "#3f2f22") => {
    c.save();
    c.translate(px(x), pz(z));
    c.rotate(tilt);
    c.fillStyle = colour;
    c.font = `italic ${size}px Georgia`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.shadowColor = "rgba(240,232,200,0.9)";
    c.shadowBlur = 5;
    c.fillText(text, 0, 0);
    c.restore();
  };
  name("Willowmere", -2, -13.5, 37);
  name("The Green", -6, 9.2, 21);
  name("Orchard Hill", ORCHARD.summit.x + 1, ORCHARD.summit.z + 4.5, 28);
  name("Millpond", MILLPOND.centre.x, MILLPOND.centre.z, 25, 0, "#2f5560");
  name("The Old Wood", -35.5, -3.2, 29);
  name("Market Square", MARKET.square.x, MARKET.square.z + 7.8, 23);
  name("The Drowsy Heron", HERON.x + 1, HERON.z - 7.2, 20);
  name("Willow Marsh", MARSH.centre.x, MARSH.centre.z + 1.5, 25, 0, "#2f5560");
  name("Allotments", -12, 19.6, 23);
  name("The Brook", 15.2, 13.5, 21, 1.57, "#2f5560");
  name("Open Fields", 34, 28, 25, 0, "#6d5a3a");
  name("Open Fields", -30, 33, 25, 0, "#6d5a3a");
  name("to the Coast, 9 miles", 39.5, 0.2, 18, -0.03, "#5b4630");
  // The cartouche, a compass and a scale.
  const bw = 370,
    bh = 118,
    bx = w - bw - 40,
    by = 40;
  c.fillStyle = "#f1e8cc";
  c.fillRect(bx, by, bw, bh);
  c.strokeStyle = "#5b4630";
  c.lineWidth = 3;
  c.strokeRect(bx, by, bw, bh);
  c.lineWidth = 1;
  c.strokeRect(bx + 6, by + 6, bw - 12, bh - 12);
  c.fillStyle = "#3f2f22";
  c.textAlign = "center";
  c.font = "bold 35px Georgia";
  c.fillText("WILLOWMERE", bx + bw / 2, by + 47);
  c.font = "italic 23px Georgia";
  c.fillText("and District · by the Postmaster", bx + bw / 2, by + 85);
  const cx = px(-41),
    cy = pz(34);
  c.fillStyle = "#3f2f22";
  c.beginPath();
  c.moveTo(cx, cy - 42);
  c.lineTo(cx + 11, cy);
  c.lineTo(cx, cy - 8);
  c.lineTo(cx - 11, cy);
  c.closePath();
  c.fill();
  c.font = "bold 24px Georgia";
  c.fillText("N", cx, cy - 50);
  c.strokeStyle = "#3f2f22";
  c.lineWidth = 3;
  const sx = px(26),
    sy = pz(38);
  c.beginPath();
  c.moveTo(sx, sy);
  c.lineTo(sx + 20 * scale, sy);
  c.moveTo(sx, sy - 6);
  c.lineTo(sx, sy + 6);
  c.moveTo(sx + 20 * scale, sy - 6);
  c.lineTo(sx + 20 * scale, sy + 6);
  c.stroke();
  c.font = "italic 19px Georgia";
  c.fillText("a pleasant ten minutes’ walk", sx + 10 * scale, sy - 15);
  // YOU ARE HERE: a red-headed pin, with its shadow on the paper.
  const hereX = px(MARKET.postOffice.x),
    hereZ = pz(MARKET.postOffice.z + MARKET.postOffice.d / 2);
  c.strokeStyle = "rgba(60,40,20,0.35)";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(hereX, hereZ);
  c.lineTo(hereX + 18, hereZ + 10);
  c.stroke();
  c.fillStyle = "#b3392f";
  c.font = "bold 22px Georgia";
  c.textAlign = "right";
  c.fillText("YOU ARE HERE", hereX - 18, hereZ + 28);
  // The border.
  c.strokeStyle = "#5b4630";
  c.lineWidth = 5;
  c.strokeRect(10, 10, w - 20, h - 20);
  c.lineWidth = 1.2;
  c.strokeRect(18, 18, w - 36, h - 36);
  return { x: hereX, z: hereZ };
}
