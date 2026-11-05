import * as T from "three";
import { INN, UPPER } from "./layout.js";
import { createParts } from "./parts.js";

// Under the eaves at Thistledown: the landing, Goldfinch (the double at the
// front), Linnet (the twin at the back) and the bathroom. Coordinates are in
// floor space: each room's parts stand on a group at the upper floor's boards.

const { loft, upperCeiling } = INN;
const U = UPPER;

function botanical(bloom) {
  return (c, w, h) => {
    c.fillStyle = "#f2ead6";
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "#62744e";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(w / 2, h - 10);
    c.quadraticCurveTo(w / 2 + 8, h / 2, w / 2, h * 0.3);
    c.stroke();
    c.fillStyle = "#7c8f5f";
    for (const s of [-1, 1]) {
      c.beginPath();
      c.ellipse(w / 2 + s * 22, h * 0.62, 26, 10, s * 0.5, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = bloom;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      c.beginPath();
      c.ellipse(w / 2 + Math.cos(a) * 14, h * 0.26 + Math.sin(a) * 14, 12, 8, a, 0, Math.PI * 2);
      c.fill();
    }
  };
}
function riverView(c, w, h) {
  const sky = c.createLinearGradient(0, 0, 0, h * 0.55);
  sky.addColorStop(0, "#bcd6da");
  sky.addColorStop(1, "#f0e5c6");
  c.fillStyle = sky;
  c.fillRect(0, 0, w, h);
  c.fillStyle = "#88a077";
  c.fillRect(0, h * 0.5, w, h * 0.5);
  c.fillStyle = "#a7c8d0";
  c.beginPath();
  c.moveTo(w * 0.4, h * 0.5);
  c.quadraticCurveTo(w * 0.2, h * 0.76, w * 0.58, h);
  c.lineTo(w * 0.9, h);
  c.quadraticCurveTo(w * 0.5, h * 0.76, w * 0.52, h * 0.5);
  c.fill();
  c.fillStyle = "#5e7c52";
  for (const [x, y, r] of [[w * 0.14, h * 0.48, 18], [w * 0.76, h * 0.44, 22], [w * 0.86, h * 0.5, 14]]) {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  }
}

// ---------------------------------------------------------------- the landing
export function buildLanding(M, sheet) {
  const P = createParts("landing", M, sheet, loft);
  const { box, cyl, dot, group, mat, rug, picture, pendant, vase, potPlant } = P;

  pendant(-0.4, upperCeiling, -1.0, 0.28, 0.16);
  pendant(0.2, upperCeiling, -3.5, 0.28, 0.16);
  rug(-0.48, -0.55, 0.78, 3.3, M.runner, { fringe: false });
  rug(0, -3.7, 1.3, 1.3, M.blueRug);

  // The window seat in the back gable.
  {
    const s = U.landingSeat,
      g = group(s.x, 0, s.z, 0);
    box(M.creamBoards, 0, 0.24, -0.01, s.w, 0.46, s.d - 0.02, 0, g);
    box(M.tartan, 0, 0.5, 0, s.w, 0.08, s.d, 0.03, g);
    for (const [x, m] of [[-0.54, M.sageVelvet], [0.56, M.chintz]]) {
      const c = box(m, x, 0.68, -0.14, 0.34, 0.32, 0.1, 0.04, g);
      c.rotation.x = -0.3;
    }
    // Binoculars and a tin of toffees.
    const bins = group(0.1, 0.55, 0.06, 0.4, g);
    for (const a of [-1, 1]) {
      const t = cyl(M.black, a * 0.035, 0.03, 0, 0.024, 0.11, 0.024, bins, 9);
      t.rotation.x = Math.PI / 2;
    }
    box(M.black, 0, 0.03, 0, 0.04, 0.018, 0.04, 0, bins);
    cyl(mat("#a03f33", 0.4, 0.5), -0.2, 0.57, 0.1, 0.07, 0.04, 0.07, g, 14);
  }
  // A narrow table with a bowl of potpourri, towels and a lamp.
  {
    const t = U.landingTable,
      g = group(t.x, 0, t.z, 0);
    box(M.oak, 0, 0.76, 0, t.w, 0.024, t.d, 0.006, g);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(M.oak, (a * (t.w - 0.04)) / 2, 0.38, (b * (t.d - 0.04)) / 2, 0.03, 0.75, 0.03, 0, g);
    box(M.oak, 0, 0.2, 0, t.w - 0.04, 0.016, t.d - 0.04, 0, g);
    P.lamp(0.0, 0.772, -0.28, { height: 0.24, r: 0.1, p: g });
    vase(0.03, 0.772, 0.26, ["#a49bbe", "#f1ead0", "#d6a0c0"], g);
    P.linenStack(0, 0.208, 0, 0.24, 0.5, ["#f4efe2", "#e6d9b8", "#f4efe2"], 0.05, g);
    cyl(M.willow, 0, 0.8, 0.02, 0.05, 0.05, 0.09, g, 14);
    for (let i = 0; i < 6; i++) dot(mat(["#8f79ae", "#d6a0c0", "#c98f6c"][i % 3], 0.95), Math.cos(i * 1.2) * 0.05, 0.828, 0.02 + Math.sin(i * 1.2) * 0.05, 0.016, 0.01, 0.016, g);
  }
  // Pictures along the passage, and a fern on a stool by the bathroom door.
  picture(sheet.cell(180, 140, riverView), -1.42, 1.56, -2.7, 0.42, 0.32, Math.PI / 2, M.oak);
  picture(sheet.cell(140, 180, botanical("#c9a144")), -1.42, 1.56, -0.92, 0.28, 0.36, Math.PI / 2, M.oak);
  picture(sheet.cell(140, 180, botanical("#b98ec2")), -1.42, 1.56, 0.86, 0.28, 0.36, Math.PI / 2, M.oak);
  {
    const stool = group(1.26, 0, -2.74);
    cyl(M.oak, 0, 0.44, 0, 0.16, 0.024, 0.16, stool, 14);
    for (const a of [0.8, 2.9, 5]) P.beam(M.oak, [Math.cos(a) * 0.1, 0.43, Math.sin(a) * 0.1], [Math.cos(a) * 0.16, 0, Math.sin(a) * 0.16], 0.022, stool);
    potPlant(0, 0.452, 0, 0.13, 10, stool, M.rust);
  }
  // A fire bucket and a framed notice on the east wall.
  {
    const notice = sheet.cell(180, 180, (c, w, h) => {
      c.fillStyle = "#f4efdf";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#3a3a32";
      c.textAlign = "center";
      c.font = "bold 18px Georgia";
      c.fillText("IN CASE OF FIRE", w / 2, 30);
      c.font = "15px Georgia";
      ["Walk, do not run.", "Bring the cat.", "Dot will bring", "the marmalade."].forEach((line, i) => c.fillText(line, w / 2, 66 + i * 26));
    });
    picture(notice, 1.42, 1.56, -4.3, 0.28, 0.28, -Math.PI / 2, M.darkOak);
    const bucket = group(1.22, 0, -4.48);
    cyl(mat("#a03f33", 0.36, 0.3), 0, 0.14, 0, 0.1, 0.26, 0.13, bucket, 13);
    cyl(mat("#d5c8a8", 0.95), 0, 0.27, 0, 0.12, 0.004, 0.12, bucket, 13);
    P.torus(M.iron, 0, 0.28, 0, 0.125, 0.005, bucket, Math.PI);
  }
  return { parts: P };
}

// ---------------------------------------------------------------- Goldfinch
export function buildGoldfinch(M, sheet) {
  const P = createParts("goldfinch", M, sheet, loft);
  const { box, cyl, dot, group, mat, rug, picture, pendant, bed, bedside, chest, chair, armchair, sheetPlane, potPlant, vase, cup, logs, beam } = P;

  rug(-0.1, 2.95, 2.3, 1.9, M.goldRug);
  rug(3.05, -0.4, 1.9, 1.5, M.turkeyRug, { fringe: false });
  pendant(0.2, upperCeiling, 2.9, 0.32, 0.2);

  // The brass bed, its headboard to the landing wall, the window ahead.
  bed(U.goldfinchBed, { quilt: M.patchwork, foot: M.velvet, headboard: "brass" });
  bedside(U.bedsideWest);
  bedside(U.bedsideEast);
  // A little glass of water, a Gideon of sorts, and slippers nobody has claimed.
  {
    const e = U.bedsideEast,
      g = group(e.x, 0, e.z);
    cyl(mat("#c9dcdc", 0.1), -0.1, 0.65, -0.1, 0.03, 0.09, 0.03, g, 9);
    for (const s of [-1, 1]) {
      const slip = group(0.2 + s * 0.08, 0, 0.46, 0.14 * s, g);
      box(M.velvet, 0, 0.035, 0, 0.09, 0.06, 0.24, 0.018, slip);
    }
  }
  // The blanket box at the bed's foot, with an eiderdown folded on top.
  {
    const b = U.blanketBox,
      g = group(b.x, 0, b.z);
    box(M.oak, 0, 0.21, 0, b.w, 0.38, b.d, 0.008, g);
    box(M.darkOak, 0, 0.41, 0, b.w + 0.03, 0.03, b.d + 0.02, 0.006, g);
    for (const s of [-1, 1]) box(M.iron, s * 0.42, 0.26, b.d / 2 + 0.003, 0.04, 0.26, 0.006, 0, g);
    box(M.candlewick, 0, 0.47, 0, 0.8, 0.08, 0.34, 0.03, g);
    box(M.linen, 0, 0.53, 0, 0.72, 0.04, 0.3, 0.018, g);
  }
  // The washstand against the gable: jug, basin and a mirror on a swivel.
  {
    const w = U.washstand,
      g = group(w.x, 0, w.z, Math.PI);
    box(M.oak, 0, 0.42, 0, w.w, 0.04, w.d, 0.004, g);
    box(mat("#ecead9", 0.34), 0, 0.46, -0.01, w.w - 0.02, 0.05, w.d - 0.02, 0.004, g);
    box(M.oak, 0, 0.76, -w.d / 2 + 0.02, w.w, 0.5, 0.03, 0.004, g);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(M.darkOak, (a * (w.w - 0.06)) / 2, 0.21, (b * (w.d - 0.06)) / 2, 0.018, 0.42, 0.024, g, 7);
    box(M.oak, 0, 0.14, 0, w.w - 0.06, 0.016, w.d - 0.06, 0, g);
    // Jug and basin, painted with finches.
    const basinAt = group(-0.2, 0.484, 0.02, 0, g);
    cyl(M.china, 0, 0.05, 0, 0.14, 0.1, 0.08, basinAt, 18);
    P.torus(mat("#d4a93a", 0.3), 0, 0.09, 0, 0.125, 0.006, basinAt).rotation.x = Math.PI / 2;
    cyl(mat("#c9dcdc", 0.12), 0, 0.094, 0, 0.12, 0.002, 0.12, basinAt, 18);
    const jugAt = group(0.22, 0.484, 0, 0.4, g);
    cyl(M.china, 0, 0.13, 0, 0.09, 0.26, 0.075, jugAt, 14);
    cyl(M.china, 0, 0.28, 0, 0.05, 0.05, 0.08, jugAt, 14);
    P.torus(M.china, -0.095, 0.16, 0, 0.05, 0.012, jugAt, Math.PI).rotation.z = Math.PI / 2;
    P.torus(mat("#d4a93a", 0.3), 0, 0.13, 0, 0.09, 0.006, jugAt).rotation.x = Math.PI / 2;
    dot(mat("#b5402f", 0.4), 0.08, 0.15, 0.04, 0.014, 0.014, 0.014, jugAt);
    box(M.apple, 0.0, 0.5, 0.14, 0.08, 0.016, 0.05, 0.004, g);
    box(M.white, -0.38, 0.5, 0.05, 0.15, 0.024, 0.28, 0.008, g);
    // A swivel mirror on the backboard.
    const mirror = group(0, 1.26, -w.d / 2 + 0.05, 0, g);
    for (const s of [-1, 1]) box(M.darkOak, s * 0.24, -0.22, 0, 0.02, 0.5, 0.02, 0, mirror);
    box(M.darkOak, 0, 0.04, 0.006, 0.44, 0.52, 0.018, 0.006, mirror);
    P.mirrorGlass(0, 0.04, 0.0155, 0.38, 0.46, 0, mirror);
  }
  // The writing desk under the gable window.
  {
    const d = U.writingDesk,
      g = group(d.x, 0, d.z, Math.PI);
    box(M.walnut, 0, 0.74, 0, d.w, 0.03, d.d, 0.008, g);
    for (const s of [-1, 1]) {
      box(M.walnut, s * (d.w / 2 - 0.13), 0.37, 0, 0.26, 0.72, d.d - 0.06, 0, g);
      for (let i = 0; i < 3; i++) {
        box(M.oak, s * (d.w / 2 - 0.13), 0.14 + i * 0.22, (d.d - 0.06) / 2 + 0.006, 0.22, 0.18, 0.01, 0, g);
        dot(M.brass, s * (d.w / 2 - 0.13), 0.14 + i * 0.22, (d.d - 0.06) / 2 + 0.018, 0.012, 0.012, 0.012, g);
      }
    }
    box(M.darkOak, 0, 0.752, 0.02, d.w - 0.18, 0.004, d.d - 0.14, 0, g);
    // A rack of postcards, a pen, a card half written.
    const rack = group(-0.34, 0.755, -0.12, 0, g);
    box(M.oak, 0, 0.045, 0, 0.26, 0.09, 0.015, 0, rack);
    const postcard = (hue, i) =>
      sheet.cell(120, 84, (c, w, h) => {
        c.fillStyle = hue;
        c.fillRect(0, 0, w, h);
        c.fillStyle = "#e5dabb";
        c.fillRect(36, 34, 46, 34);
        c.fillStyle = "#a66b52";
        c.beginPath();
        c.moveTo(28, 34);
        c.lineTo(60, 12);
        c.lineTo(90, 34);
        c.fill();
        c.fillStyle = "#3a3a32";
        c.font = "italic 10px Georgia";
        c.fillText("Willowmere", 8, 78);
        if (i) {
          c.strokeStyle = "#4e3a28";
          c.lineWidth = 2;
          c.beginPath();
          c.arc(22, 50, 14, 0, Math.PI * 2);
          c.stroke();
        }
      });
    [postcard("#bcd6da", 0), postcard("#d3c9a0", 1), postcard("#a9c29f", 2)].forEach((cell, i) => {
      const card = sheetPlane(cell, -0.09 + i * 0.09, 0.1, 0.014 + i * 0.002, 0.11, 0.08, 0, rack);
      card.rotation.x = -0.08;
    });
    const letter = group(0.08, 0.758, 0.02, 0.25, g);
    box(M.ivory, 0, 0, 0, 0.16, 0.002, 0.11, 0, letter);
    for (let i = 0; i < 4; i++) box(mat("#3a4a63", 0.6), -0.012 + i * 0.002, 0.0015, -0.032 + i * 0.016, 0.1 - i * 0.012, 0.001, 0.004, 0, letter);
    beam(M.black, [0.1, 0.012, 0.01], [0.22, 0.02, 0.09], 0.009, letter);
    P.lamp(0.42, 0.755, -0.1, { height: 0.24, r: 0.1, p: g });
    vase(0.22, 0.755, -0.16, ["#e9c54f", "#f1ead0", "#c9a144"], g, M.china);
    chair(U.deskChair.x, U.deskChair.z, 0, { wood: M.walnut, seat: M.velvet });
  }
  // The wardrobe, tall, on the gable wall.
  {
    const w = U.wardrobe,
      g = group(w.x, 0, w.z, Math.PI),
      h = 1.96;
    box(M.oak, 0, h / 2 + 0.05, 0, w.w, h - 0.08, w.d, 0, g);
    box(M.darkOak, 0, h + 0.04, 0.01, w.w + 0.05, 0.06, w.d + 0.05, 0.008, g);
    box(M.darkOak, 0, 0.05, 0.012, w.w + 0.03, 0.1, w.d + 0.03, 0, g);
    for (const s of [-1, 1]) {
      box(M.darkOak, (s * w.w) / 4, 1.05, w.d / 2 + 0.003, w.w / 2 - 0.03, h - 0.24, 0.012, 0, g);
      if (s > 0) P.mirrorGlass((s * w.w) / 4, 1.05, w.d / 2 + 0.0095, w.w / 2 - 0.13, h - 0.42, 0, g);
      else box(M.oak, (s * w.w) / 4, 1.05, w.d / 2 + 0.011, w.w / 2 - 0.13, h - 0.42, 0.006, 0, g);
      dot(M.brass, s * 0.06, 1.02, w.d / 2 + 0.018, 0.016, 0.016, 0.016, g);
    }
    box(mat("#7a5a44", 0.7), -0.26, h + 0.16, 0.0, 0.5, 0.16, 0.34, 0.012, g);
    box(M.brass, -0.26, h + 0.16, 0.172, 0.04, 0.05, 0.005, 0, g);
    box(mat("#2f3d36", 0.8), 0.28, h + 0.13, 0.04, 0.34, 0.11, 0.28, 0.012, g);
  }
  // The chest with the tea tray, and a mirror above it.
  const tray = {};
  {
    const c = U.teaChest,
      g = chest(c.x, c.z, c.w, c.d, 0.82, 0, 3, M.oak),
      top = 0.835;
    const t = group(0, top, 0, 0, g);
    box(M.darkOak, 0, 0.008, 0, 0.56, 0.014, 0.34, 0.004, t);
    for (const s of [-1, 1]) box(M.brass, 0, 0.022, s * 0.17, 0.5, 0.008, 0.008, 0, t);
    cup(-0.17, 0.016, -0.06, 0.4, t);
    cup(-0.02, 0.016, 0.07, -0.4, t);
    // The electric kettle, a tin of shortbread and a rack of sachets.
    const kettle = group(0.17, 0.016, -0.03, 0.2, t);
    cyl(M.silver, 0, 0.09, 0, 0.075, 0.17, 0.085, kettle, 14);
    cyl(M.black, 0, 0.183, 0, 0.042, 0.012, 0.042, kettle, 10);
    P.torus(M.black, -0.086, 0.11, 0, 0.05, 0.01, kettle, Math.PI).rotation.z = Math.PI / 2;
    beam(M.silver, [0.07, 0.15, 0], [0.12, 0.19, 0], 0.016, kettle);
    tray.kettleAt = [c.x + 0.17, loft + top + 0.21, c.z - 0.03];
    cyl(mat("#3f5a70", 0.36, 0.5), -0.34, 0.03, 0.02, 0.07, 0.05, 0.07, t, 14);
    box(M.ivory, 0.34, 0.03, 0.04, 0.09, 0.05, 0.13, 0, t);
    const card = sheet.cell(160, 110, (cx, w, h) => {
      cx.fillStyle = "#f6efdc";
      cx.fillRect(0, 0, w, h);
      cx.fillStyle = "#3a3a32";
      cx.font = "italic 18px Georgia";
      cx.textAlign = "center";
      cx.fillText("If you need", w / 2, 36);
      cx.fillText("more milk,", w / 2, 60);
      cx.fillText("shout.", w / 2, 84);
    });
    const stand = group(-0.34, 0.08, -0.16, 0.2, t);
    P.sheetPlane(card, 0, 0, 0, 0.12, 0.08, 0, stand);
    // A mirror on its stand.
    const m = group(-0.08, 0, -c.d / 2 + 0.03, 0, g);
    box(M.oak, 0, 1.3, 0, 0.5, 0.62, 0.018, 0.006, m);
    P.mirrorGlass(0, 1.3, 0.0095, 0.44, 0.56, 0, m);
    vase(0.38, top, 0.1, ["#c9a144", "#efe7d6"], g);
  }
  // The alcove: a cast-iron grate, a low chair and a reading lamp.
  {
    const b = U.upperBreast,
      face = b.z + b.d / 2,
      g = group(b.x, 0, face);
    const tile = sheet.cell(96, 96, (c, w, h) => {
      c.fillStyle = "#ece0be";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#b5402f";
      c.beginPath();
      c.arc(w / 2, 34, 15, 0, Math.PI);
      c.lineTo(w / 2 - 15, 14);
      c.lineTo(w / 2 - 6, 22);
      c.lineTo(w / 2, 12);
      c.lineTo(w / 2 + 6, 22);
      c.lineTo(w / 2 + 15, 14);
      c.closePath();
      c.fill();
      c.strokeStyle = "#688a56";
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(w / 2, 50);
      c.lineTo(w / 2, 90);
      c.stroke();
    });
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) sheetPlane(tile, s * 0.38, 0.07 + i * 0.13, 0.012, 0.125, 0.125, 0, g);
    box(M.iron, 0, 0.74, 0.012, 0.92, 0.1, 0.02, 0, g);
    for (const s of [-1, 1]) box(M.iron, s * 0.47, 0.37, 0.012, 0.05, 0.74, 0.02, 0, g);
    box(M.white, 0, 0.86, 0.06, 1.14, 0.03, 0.14, 0.006, g);
    for (const s of [-1, 1]) box(M.white, s * 0.53, 0.44, 0.024, 0.06, 0.82, 0.03, 0, g);
    const hearth = box(mat("#7e7566", 0.82), 0, 0.012, 0.18, 1.1, 0.024, 0.36, 0.004, g);
    hearth.castShadow = false;
    // A little basket with an ember left in it.
    const grate = group(0, 0, -0.2, 0, g);
    for (let i = 0; i < 5; i++) box(M.iron, -0.16 + i * 0.08, 0.11, 0.1, 0.012, 0.16, 0.012, 0, grate);
    box(M.iron, 0, 0.09, 0, 0.36, 0.012, 0.2, 0, grate);
    logs(0, 0.1, 0, 3, grate);
    for (let i = 0; i < 6; i++) dot(M.ember, -0.1 + i * 0.04, 0.115, 0.02 + (i % 2) * 0.04, 0.03, 0.02, 0.02, grate);
    // On the mantel, a small clock and a photograph of the sea.
    box(M.walnut, 0, 0.94, 0.05, 0.14, 0.13, 0.06, 0.008, g);
    box(M.ivory, 0, 0.94, 0.082, 0.1, 0.09, 0.002, 0, g);
    potPlant(-0.44, 0.875, 0.05, 0.07, 7, g, M.china);
    const photo = sheet.cell(130, 100, (c, w, h) => {
      const sea = c.createLinearGradient(0, 0, 0, h);
      sea.addColorStop(0, "#d2dbd5");
      sea.addColorStop(0.5, "#b4c6c7");
      sea.addColorStop(0.52, "#6c8aa0");
      sea.addColorStop(1, "#e0d0a8");
      c.fillStyle = sea;
      c.fillRect(0, 0, w, h);
    });
    const stand = group(0.36, 0.95, 0.05, -0.3, g);
    box(M.brass, 0, 0, -0.004, 0.16, 0.13, 0.006, 0, stand);
    sheetPlane(photo, 0, 0, 0.001, 0.14, 0.11, 0, stand);
    picture(sheet.cell(180, 230, botanical("#d4a93a")), 0, 1.5, 0.02, 0.32, 0.42, 0, M.darkOak, g);
    // The chair, drawn up, with a blanket and a book on its arm.
    const f = U.fireside;
    armchair(f.x, f.z, 2.6, M.sageVelvet, M.chintz);
    const side = group(4.3, 0, -0.65);
    cyl(M.oak, 0, 0.3, 0, 0.018, 0.58, 0.02, side, 8);
    cyl(M.oak, 0, 0.6, 0, 0.21, 0.02, 0.21, side, 18);
    cyl(M.oak, 0, 0.02, 0, 0.14, 0.03, 0.09, side, 12);
    P.lamp(0, 0.61, 0, { height: 0.3, r: 0.13, p: side });
    box(mat("#55704f", 0.8), 0.04, 0.625, 0.1, 0.16, 0.03, 0.12, 0.003, side);
  }
  // Pictures, and a jug on the gable sill.
  picture(sheet.cell(180, 140, riverView), -1.0, 1.5, 4.78, 0.44, 0.33, Math.PI, M.oak);
  picture(sheet.cell(140, 180, botanical("#c97070")), 1.52, 1.6, 1.42 + 0.02, 0.3, 0.38, 0, M.oak);
  picture(sheet.cell(180, 140, riverView), 1.57, 1.5, -0.5, 0.44, 0.33, Math.PI / 2, M.darkOak);
  potPlant(-0.55, 0.72, 4.82, 0.09, 8, P.base, M.rust);
  vase(0.55, 0.72, 4.82, ["#c9a144", "#efe7d6", "#c56b6b"], P.base, M.china);
  return { parts: P, tray };
}

// ---------------------------------------------------------------- Linnet
export function buildLinnet(M, sheet) {
  const P = createParts("linnet", M, sheet, loft);
  const { box, cyl, group, mat, rug, picture, pendant, bed, chest, chair, vase, cup, beam } = P;

  pendant(-3.0, upperCeiling, -3.0, 0.32, 0.2);
  rug(-3.06, -3.5, 2.0, 1.7, M.blueRug);
  // Two single beds and the table between them, each with its own folded towel.
  bed(U.linnetBedWest, { quilt: M.candlewick, foot: M.blueWool, pillows: 1, turn: Math.PI });
  bed(U.linnetBedEast, { quilt: M.candlewick, foot: M.blueWool, pillows: 1, turn: Math.PI });
  P.bedside(U.linnetBedside, { book: true });
  // The chest under the gable, a jug of sweet peas and the bird book on it.
  {
    const c = U.linnetChest,
      g = chest(c.x, c.z, c.w, c.d, 0.8, Math.PI, 3, M.pine),
      top = 0.815;
    vase(-0.3, top, 0.02, ["#d6a0c0", "#efe7d6", "#8e7aa0"], g);
    const book = group(0.08, top + 0.01, 0.05, 0.2, g);
    box(mat("#55704f", 0.8), 0, 0, 0, 0.32, 0.016, 0.22, 0, book);
    box(M.ivory, 0, 0.012, 0, 0.3, 0.014, 0.2, 0, book);
    const page = sheet.cell(180, 120, (cx, w, h) => {
      cx.fillStyle = "#f4ecd6";
      cx.fillRect(0, 0, w, h);
      cx.fillStyle = "#8d6743";
      cx.beginPath();
      cx.ellipse(50, 56, 24, 15, -0.2, 0, Math.PI * 2);
      cx.fill();
      cx.fillStyle = "#b5402f";
      cx.beginPath();
      cx.arc(71, 44, 8, 0, Math.PI * 2);
      cx.fill();
      cx.fillStyle = "#3a3a32";
      cx.font = "italic 11px Georgia";
      cx.textAlign = "center";
      cx.fillText("The Linnet", w * 0.72, 40);
      for (let i = 0; i < 4; i++) cx.fillRect(100, 52 + i * 12, 68 - i * 8, 1.5);
    });
    const p = P.sheetPlane(page, 0, 0.021, 0, 0.3, 0.2, 0, book);
    p.rotation.x = -Math.PI / 2;
    cup(0.34, top + 0.002, -0.08, 0.5, g);
    P.milkJug(0.42, top + 0.002, 0.08, M.china, g);
    box(M.darkOak, 0.4, top + 0.008, -0.02, 0.32, 0.012, 0.26, 0.004, g);
  }
  // The luggage stand and A. Whitlock's suitcase, with its stickers.
  {
    const l = U.luggage,
      g = group(l.x, 0, l.z, 0);
    for (const s of [-1, 1]) {
      beam(M.oak, [s * 0.2, 0.46, -0.36], [s * 0.2, 0, 0.36], 0.028, g);
      beam(M.oak, [s * 0.2, 0.46, 0.36], [s * 0.2, 0, -0.36], 0.028, g);
      box(M.oak, s * 0.2, 0.46, 0, 0.03, 0.03, 0.76, 0, g);
    }
    for (let i = 0; i < 3; i++) box(mat("#7a3e3a", 0.95), 0, 0.47, -0.24 + i * 0.24, 0.42, 0.006, 0.06, 0, g);
    const suit = group(0, 0.475, 0, 0, g);
    box(mat("#8d6a3c", 0.56), 0, 0.09, 0, 0.42, 0.18, 0.7, 0.018, suit);
    box(mat("#5a3f2b", 0.5), 0, 0.09, 0, 0.43, 0.02, 0.71, 0, suit);
    for (const s of [-1, 1]) {
      box(M.brass, 0.216, 0.12, s * 0.2, 0.006, 0.04, 0.04, 0, suit);
      box(mat("#5a3f2b", 0.5), 0, 0.09, s * 0.22, 0.44, 0.19, 0.04, 0, suit);
    }
    const stickers = [
      ["LISBON", "#b65a52"],
      ["BOURNEMOUTH", "#3f5570"],
      ["PRESTATYN", "#c9a144"],
    ].map(([text, tone]) =>
      sheet.cell(120, 70, (c, w, h) => {
        c.fillStyle = tone;
        c.beginPath();
        c.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#fff6e0";
        c.font = "bold 13px Georgia";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText(text, w / 2, h / 2, w - 18);
      }),
    );
    stickers.forEach((cell, i) => {
      const sticker = P.sheetPlane(cell, 0.04 - i * 0.09, 0.181, -0.18 + i * 0.18, 0.12, 0.07, 0, suit);
      sticker.rotation.x = -Math.PI / 2;
      sticker.rotation.z = (i - 1) * 0.3;
    });
  }
  chair(U.linnetChair.x, U.linnetChair.z, -2.2, { wood: M.pine, seat: M.blueWool });
  // A coat stand with a mackintosh, and the bird prints.
  {
    const stand = group(-4.32, 0, -4.32);
    cyl(M.darkOak, 0, 0.82, 0, 0.018, 1.62, 0.02, stand, 8);
    for (const a of [0.4, 2.5, 4.6]) beam(M.darkOak, [0, 0.06, 0], [Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2], 0.024, stand);
    for (const a of [0, 2.1, 4.2]) beam(M.darkOak, [0, 1.56, 0], [Math.cos(a) * 0.1, 1.64, Math.sin(a) * 0.1], 0.014, stand);
    box(mat("#bda77a", 0.9), 0.1, 1.15, 0, 0.1, 0.8, 0.28, 0.018, stand);
  }
  const prints = [["#8d6743", "#b5402f"], ["#6f7a58", "#d3a93a"], ["#5a6a7a", "#d0d0c0"]].map(([body, breast]) =>
    sheet.cell(120, 150, (c, w, h) => {
      c.fillStyle = "#efe7d0";
      c.fillRect(0, 0, w, h);
      c.fillStyle = body;
      c.beginPath();
      c.ellipse(55, 74, 28, 18, -0.2, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = breast;
      c.beginPath();
      c.arc(80, 60, 11, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#6a5a42";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(20, 104);
      c.lineTo(100, 96);
      c.stroke();
    }),
  );
  prints.forEach((cell, i) => picture(cell, -1.565, 1.5, -2.65 + i * 0.5, 0.26, 0.32, -Math.PI / 2, M.oak));
  picture(sheet.cell(180, 140, riverView), -4.2, 1.45, -0.776, 0.46, 0.34, Math.PI, M.oak);
  return { parts: P };
}

// ---------------------------------------------------------------- the bathroom
export function buildBath(M, sheet) {
  const P = createParts("bath", M, sheet, loft);
  const { box, cyl, dot, orb, group, mat, rug, slab, pendant, keep, beam, kit, sheetPlane, potPlant } = P;

  // The check floor over the upper boards, turned on the diagonal by its tile.
  const floor = slab(M.checker, 1.57, 4.7, 0.003, 0.009, -4.8, -2.07, 0.5, { shadow: false });
  floor.castShadow = false;
  pendant(3.1, upperCeiling, -3.45, 0.26, 0.17);
  rug(3.4, -3.25, 1.1, 0.6, M.ragRug, { fringe: false });

  // The roll-top bath on its claw feet, with brass taps at the wall end.
  const tub = {};
  {
    const t = U.tub,
      g = group(t.x, 0, t.z, 0),
      enamel = mat("#f6f3e9", 0.2),
      shellMat = mat("#c9dcd4", 0.3);
    const profile = new T.Shape();
    const hw = t.w / 2 - 0.02,
      hd = t.d / 2 - 0.02;
    profile.moveTo(-hw + hd, -hd);
    profile.lineTo(hw - hd, -hd);
    profile.absarc(hw - hd, 0, hd, -Math.PI / 2, Math.PI / 2, false);
    profile.lineTo(-hw + hd, hd);
    profile.absarc(-hw + hd, 0, hd, Math.PI / 2, (3 * Math.PI) / 2, false);
    const hole = new T.Path();
    const ihw = hw - 0.06,
      ihd = hd - 0.06;
    hole.moveTo(-ihw + ihd, -ihd);
    hole.lineTo(ihw - ihd, -ihd);
    hole.absarc(ihw - ihd, 0, ihd, -Math.PI / 2, Math.PI / 2, false);
    hole.lineTo(-ihw + ihd, ihd);
    hole.absarc(-ihw + ihd, 0, ihd, Math.PI / 2, (3 * Math.PI) / 2, false);
    profile.holes.push(hole);
    const wall = new T.ExtrudeGeometry(profile, { depth: 0.48, bevelEnabled: false, curveSegments: 12 });
    const body = kit.mesh(wall, enamel, 0, 0.16, 0, g);
    body.rotation.x = -Math.PI / 2;
    body.position.y = 0.16;
    // The roll of the rim, and a painted outside band.
    const rim = new T.Shape(profile.getPoints(12));
    rim.holes.push(new T.Path(hole.getPoints(12)));
    const rimMesh = kit.mesh(new T.ExtrudeGeometry(rim, { depth: 0.028, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.014, bevelSegments: 2, curveSegments: 12 }), enamel, 0, 0.64, 0, g);
    rimMesh.rotation.x = -Math.PI / 2;
    const bandShape = new T.Shape(profile.getPoints(12));
    bandShape.holes.push(new T.Path(hole.getPoints(12)));
    const band = kit.mesh(new T.ExtrudeGeometry(bandShape, { depth: 0.34, bevelEnabled: false, curveSegments: 12 }), shellMat, 0, 0.3, 0, g);
    band.rotation.x = -Math.PI / 2;
    band.scale.set(1.004, 1.004, 1);
    // The floor of the tub.
    const inner = new T.Shape(hole.getPoints(12));
    const bottom = kit.mesh(new T.ShapeGeometry(inner), enamel, 0, 0.19, 0, g);
    bottom.rotation.x = -Math.PI / 2;
    // Four claw feet.
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const foot = group((a * (t.w - 0.36)) / 2, 0, (b * (t.d - 0.22)) / 2, 0, g);
      orb(M.brass, 0, 0.06, 0, 0.05, 0.065, 0.05, foot);
      for (const k of [-1, 0, 1]) dot(M.brass, k * 0.03, 0.02, 0.034 * b, 0.016, 0.02, 0.024, foot);
      beam(M.brass, [0, 0.1, 0], [-a * 0.03, 0.2, -b * 0.03], 0.05, foot);
    }
    // Taps standing at the wall end, with a hand shower on its cradle.
    for (const s of [-1, 1]) {
      const riser = group(t.w / 2 - 0.12, 0.72, s * 0.1, 0, g);
      cyl(M.brass, 0, 0.05, 0, 0.012, 0.1, 0.012, riser, 8);
      for (let i = 0; i < 4; i++) box(M.brass, 0, 0.11, 0, 0.09, 0.012, 0.012, 0, riser).rotation.y = (i * Math.PI) / 4;
      box(M.brass, -0.04, 0.06, 0, 0.08, 0.016, 0.016, 0, riser);
    }
    box(M.brass, t.w / 2 - 0.05, 0.86, 0, 0.012, 0.012, 0.22, 0, g);
    beam(M.black, [t.w / 2 - 0.05, 0.86, 0], [t.w / 2 + 0.0, 0.72, -0.28], 0.012, g);
    // The water, which rises as the bath runs, and a duck on the rim.
    const waterShape = new T.Shape(hole.getPoints(12));
    const waterMesh = kit.mesh(new T.ShapeGeometry(waterShape), M.water, 0, 0.21, 0, g);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.castShadow = false;
    waterMesh.visible = false;
    keep.add(waterMesh);
    tub.water = waterMesh;
    tub.steamAt = [t.x, loft + 0.72, t.z];
    const duck = group(-t.w / 2 + 0.16, 0.7, t.d / 2 - 0.05, 0.6, g);
    orb(mat("#efc640", 0.5), 0, 0.03, 0, 0.038, 0.032, 0.05, duck);
    orb(mat("#efc640", 0.5), 0, 0.075, 0.03, 0.027, 0.027, 0.027, duck);
    box(mat("#de7a26", 0.5), 0, 0.074, 0.06, 0.018, 0.008, 0.02, 0, duck);
    for (const s of [-1, 1]) dot(M.black, s * 0.016, 0.084, 0.05, 0.004, 0.004, 0.004, duck);
    // A wooden bath rack across the rim, with a sponge and a brush.
    const rack = group(0.12, 0.69, 0, 0, g);
    box(M.pine, 0, 0, 0, 0.1, 0.012, t.d - 0.02, 0, rack);
    box(M.pine, 0.09, 0, 0, 0.06, 0.012, t.d - 0.02, 0, rack);
    orb(mat("#d6b679", 0.98), 0.02, 0.03, 0.1, 0.05, 0.03, 0.04, rack);
    box(M.apple, 0.08, 0.018, -0.16, 0.08, 0.018, 0.05, 0.006, rack);
  }
  // The pedestal basin, mirror and shelf.
  const basinAt = U.basin;
  {
    const g = group(basinAt.x, 0, basinAt.z, 0);
    const pedestal = cyl(M.white, 0, 0.36, -0.05, 0.11, 0.7, 0.07, g, 14);
    pedestal.castShadow = true;
    box(M.white, 0, 0.74, 0, basinAt.w, 0.1, basinAt.d, 0.03, g);
    cyl(mat("#d8dcd8", 0.16), 0, 0.792, 0.02, 0.2, 0.012, 0.2, g, 18);
    for (const s of [-1, 1]) {
      cyl(M.brass, s * 0.11, 0.84, -0.17, 0.012, 0.08, 0.012, g, 8);
      for (let i = 0; i < 4; i++) box(M.brass, s * 0.11, 0.885, -0.17, 0.05, 0.008, 0.008, 0, g).rotation.y = (i * Math.PI) / 4;
      box(M.brass, s * 0.11, 0.86, -0.13, 0.012, 0.012, 0.08, 0, g);
    }
    box(M.darkOak, 0, 1.45, -0.212, 0.56, 0.78, 0.01, 0, g);
    P.mirrorGlass(0, 1.45, -0.206, 0.5, 0.72, 0, g);
    box(M.white, 0, 1.03, -0.19, 0.5, 0.012, 0.06, 0.003, g);
    // A shell of soap, a swan of flannel, a tooth-glass.
    box(mat("#e8b6a5", 0.36), 0.2, 0.8, 0.12, 0.06, 0.016, 0.044, 0.006, g);
    orb(M.sage, -0.2, 0.82, 0.14, 0.05, 0.03, 0.03, g);
    orb(M.sage, -0.16, 0.86, 0.14, 0.012, 0.03, 0.012, g);
    cyl(mat("#c0d2cf", 0.14), -0.14, 1.08, -0.19, 0.022, 0.09, 0.024, g, 8);
    beam(mat("#b65a52", 0.5), [-0.14, 1.04, -0.19], [-0.12, 1.15, -0.18], 0.008, g);
    cyl(M.brass, 0.14, 1.07, -0.19, 0.022, 0.07, 0.016, g, 7);
  }
  // The WC, its high cistern and the long chain.
  {
    const w = U.wc,
      g = group(w.x, 0, w.z, 0),
      ped = M.white;
    cyl(ped, 0, 0.17, 0.06, 0.09, 0.34, 0.14, g, 14);
    const seat = cyl(M.darkOak, 0, 0.385, 0.1, 0.19, 0.03, 0.19, g, 18);
    seat.scale.set(1, 1, 1.15);
    box(M.darkOak, 0, 0.53, -0.1, 0.34, 0.28, 0.024, 0.012, g);
    box(M.white, 0, 0.3, -0.24, 0.2, 0.32, 0.22, 0, g);
    // The pipe and the cistern on its iron brackets, up near the ceiling.
    cyl(M.brass, 0, 1.24, -0.2, 0.024, 1.5, 0.024, g, 8);
    box(mat("#2d2b29", 0.5), 0, 2.0, -0.2, 0.5, 0.25, 0.24, 0.01, g);
    for (const s of [-1, 1]) box(M.iron, s * 0.2, 1.87, -0.22, 0.02, 0.06, 0.24, 0, g);
    box(M.iron, 0.2, 2.0, -0.07, 0.08, 0.012, 0.03, 0, g);
    for (let i = 0; i < 28; i++) dot(M.brass, 0.24 + Math.sin(i) * 0.002, 1.96 - i * 0.03, -0.06, 0.005, 0.009, 0.005, g);
    orb(M.china, 0.24, 1.08, -0.06, 0.022, 0.05, 0.022, g);
    // The roll on its bracket, and the spare one on the sill.
    const roll = cyl(M.white, -0.36, 0.72, -0.26, 0.055, 0.11, 0.055, g, 11);
    roll.rotation.z = Math.PI / 2;
    box(M.brass, -0.36, 0.72, -0.27, 0.15, 0.012, 0.012, 0, g);
  }
  // The heated rail on the landing wall, thick with towels, and a laundry basket.
  {
    const rail = group(1.6, 0, -2.45, Math.PI / 2);
    for (const s of [-1, 1]) cyl(M.brass, s * 0.3, 0.56, 0.05, 0.016, 1.1, 0.016, rail, 8);
    for (const y of [0.4, 0.68, 0.96]) {
      const bar = cyl(M.brass, 0, y, 0.05, 0.013, 0.6, 0.013, rail, 7);
      bar.rotation.z = Math.PI / 2;
    }
    box(M.white, 0, 0.62, 0.075, 0.48, 0.62, 0.05, 0.012, rail);
    box(mat("#9db8b6", 0.96), -0.05, 0.72, 0.1, 0.34, 0.4, 0.03, 0.008, rail);
    const h = U.hamper,
      basket = group(h.x, 0, h.z);
    cyl(mat("#b5956a", 0.95), 0, 0.26, 0, h.r, 0.52, h.r - 0.03, basket, 14);
    cyl(mat("#a5804c", 0.95), 0, 0.53, 0, h.r + 0.01, 0.03, h.r + 0.01, basket, 14);
    dot(mat("#8d6a3c", 0.95), 0, 0.565, 0, 0.022, 0.016, 0.022, basket);
    // A stool, its towel, and a shelf of bath things over the bath's foot.
    const stool = group(2.2, 0, -3.0);
    cyl(M.white, 0, 0.42, 0, 0.14, 0.04, 0.14, stool, 14);
    for (const a of [0.6, 2.7, 4.8]) beam(M.white, [Math.cos(a) * 0.09, 0.42, Math.sin(a) * 0.09], [Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15], 0.02, stool);
    box(mat("#e8cbb4", 0.96), 0, 0.46, 0, 0.26, 0.06, 0.2, 0.012, stool);
    const shelf = group(2.3, 1.46, -2.14, 0);
    box(M.white, 0, 0, -0.01, 0.55, 0.022, 0.12, 0.003, shelf);
    for (const [x, tone, h2] of [[-0.18, "#8fb6b0", 0.16], [-0.05, "#d6a0c0", 0.11], [0.09, "#efe7d6", 0.13], [0.2, "#c9a144", 0.09]]) cyl(mat(tone, 0.2), x, 0.01 + h2 / 2, -0.01, 0.028, h2, 0.026, shelf, 9);
    potPlant(2.94, 1.14, -4.74, 0.07, 9, P.base, M.china);
    const sign = sheet.cell(240, 90, (c, w, hh) => {
      c.fillStyle = "#f6efdc";
      c.fillRect(0, 0, w, hh);
      c.fillStyle = "#3f6d70";
      c.textAlign = "center";
      c.font = "italic 21px Georgia";
      c.fillText("Please leave this room", w / 2, 36);
      c.fillText("as you would wish to find it.", w / 2, 64);
    });
    sheetPlane(sign, 3.16, 2.14, -4.648, 0.3, 0.11).castShadow = false;
  }
  return { parts: P, tub };
}
