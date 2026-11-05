import * as T from "three";
import { BREAKFAST_CHAIRS, GROUND, INN, JIGSAW_CHAIRS, KITCHEN_CHAIRS } from "./layout.js";
import { createParts } from "./parts.js";

// Downstairs at Thistledown, one builder per room: the hall, the breakfast room,
// the kitchen and the sitting room. Each returns its parts, to be baked, and the
// things that move, for src/thistledown/room.js to animate.

const { ceiling, partition } = INN;
const G = GROUND;

// A plain card, painted once onto the shared sheet.
const lettered = (sheet, w, h, background, ink, lines) =>
  sheet.cell(w, h, (c, cw, ch) => {
    c.fillStyle = background;
    c.fillRect(0, 0, cw, ch);
    c.fillStyle = ink;
    c.textAlign = "center";
    c.textBaseline = "middle";
    for (const [text, size, y, font = "Georgia"] of lines) {
      c.font = `${size}px ${font}`;
      c.fillText(text, cw / 2, ch * y, cw - 12);
    }
  });

function landscape(sky, hill, near, extra) {
  return (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h * 0.6);
    g.addColorStop(0, sky);
    g.addColorStop(1, "#f0e3c2");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.fillStyle = hill;
    c.beginPath();
    c.moveTo(0, h * 0.62);
    c.quadraticCurveTo(w * 0.3, h * 0.42, w * 0.55, h * 0.56);
    c.quadraticCurveTo(w * 0.8, h * 0.66, w, h * 0.48);
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.fill();
    c.fillStyle = near;
    c.beginPath();
    c.moveTo(0, h * 0.78);
    c.quadraticCurveTo(w * 0.5, h * 0.64, w, h * 0.84);
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.fill();
    extra?.(c, w, h);
  };
}

// ------------------------------------------------------------------- the hall
export function buildHall(M, sheet) {
  const P = createParts("hall", M, sheet);
  const { box, cyl, dot, orb, group, torus, mat, rug, lamp, pendant, picture, sheetPlane, potPlant, keep, beam } = P;

  rug(0, 2.95, 1.05, 2.3, M.runner, { fringe: true });
  rug(-0.46, -2.1, 0.8, 2.6, M.runner, { fringe: true });
  pendant(0, ceiling, 2.6, 0.32, 0.17);
  pendant(-0.5, ceiling, -3.1, 0.32, 0.15);

  // The reception desk, its kneehole toward the room.
  {
    const d = G.desk,
      g = group(d.x, 0, d.z, 0),
      top = 0.78,
      deep = d.w,
      long = d.d;
    box(M.mahogany, 0, top, 0, deep, 0.03, long, 0.008, g);
    box(mat("#3d5a4a", 0.82), 0.02, top + 0.016, 0, deep - 0.14, 0.004, long - 0.14, 0, g);
    for (const s of [-1, 1]) {
      box(M.mahogany, 0, top / 2 - 0.01, s * (long / 2 - 0.2), deep - 0.03, top - 0.03, 0.36, 0, g);
      for (let i = 0; i < 3; i++) {
        const y = 0.16 + i * 0.22;
        box(M.walnut, deep / 2 - 0.01, y, s * (long / 2 - 0.2), 0.012, 0.19, 0.3, 0, g);
        dot(M.brass, deep / 2 + 0.004, y, s * (long / 2 - 0.2), 0.012, 0.012, 0.012, g);
      }
    }
    box(M.mahogany, -deep / 2 + 0.02, top / 2, 0, 0.02, top - 0.04, long - 0.7, 0, g);
    box(M.walnut, deep / 2 - 0.01, top - 0.06, 0, 0.012, 0.07, long - 0.74, 0, g);
    // The guest book, open, with its pen on a ribbon.
    const book = group(0, top + 0.03, 0.27, 0.12, g);
    box(mat("#5a2f25", 0.75), 0, 0.006, 0, 0.3, 0.012, 0.42, 0, book);
    for (const s of [-1, 1]) box(M.ivory, 0, 0.018, s * 0.103, 0.27, 0.014, 0.195, 0, book);
    const page = sheet.cell(180, 256, (c, w, h) => {
      c.fillStyle = "#f4ecd6";
      c.fillRect(0, 0, w, h);
      c.strokeStyle = "rgba(60,70,110,0.75)";
      c.lineWidth = 1.5;
      for (let y = 16; y < h - 8; y += 16) {
        c.beginPath();
        c.moveTo(10, y);
        let x = 10;
        while (x < w - 12 - ((y * 7) % 60)) {
          x += 6;
          c.lineTo(x, y + Math.sin(x * 0.8 + y) * 3);
        }
        c.stroke();
      }
    });
    for (const s of [-1, 1]) {
      const p = sheetPlane(page, 0, 0.026, s * 0.103, 0.195, 0.27, 0, book);
      p.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    }
    beam(M.black, [0.03, 0.04, -0.08], [0.1, 0.02, -0.2], 0.006, book);
    // The bell, a card stand and the lamp with the green shade.
    const bell = group(0.04, top + 0.018, -0.37, 0, g);
    cyl(M.brass, 0, 0.008, 0, 0.05, 0.014, 0.055, bell, 12);
    orb(M.brass, 0, 0.038, 0, 0.042, 0.038, 0.042, bell);
    cyl(M.brass, 0, 0.082, 0, 0.005, 0.02, 0.005, bell, 6);
    dot(M.iron, 0, 0.094, 0, 0.008, 0.008, 0.008, bell);
    lamp(-0.1, top + 0.018, -0.1, { height: 0.26, r: 0.1, stem: M.brass, shadeMat: M.redShade, p: g });
    box(M.oak, 0.14, top + 0.04, 0.02, 0.03, 0.05, 0.12, 0, g);
    for (let i = 0; i < 5; i++) box(mat(i % 2 ? "#e5d6ae" : "#cfdcdf", 0.8), 0.14 + i * 0.002, top + 0.06, 0.02, 0.008, 0.08, 0.1, 0, g);
    box(M.brass, -0.14, top + 0.03, -0.42, 0.06, 0.03, 0.06, 0, g);
    for (const a of [0.2, -0.3]) beam(mat("#2e3a4e", 0.5), [-0.14, top + 0.04, -0.42], [-0.14 + a * 0.2, top + 0.17, -0.42 + a * 0.1], 0.006, g);
  }
  // Behind the desk: the key rack, breakfast notice and a framed map.
  {
    const wallX = -1.425,
      rack = group(wallX, 1.55, 1.05, Math.PI / 2);
    box(M.oak, 0, 0, 0, 0.42, 0.24, 0.02, 0.004, rack);
    const keysCell = lettered(sheet, 210, 42, "#a2774a", "#2f2010", [["KEYS", 28, 0.55, "Georgia"]]);
    sheetPlane(keysCell, 0, 0.09, 0.012, 0.3, 0.05, 0, rack);
    [-0.1, 0.1].forEach((x, i) => {
      torus(M.brass, x, 0.03, 0.02, 0.012, 0.003, rack);
      const fob = box(M.darkOak, x, -0.055, 0.02, 0.05, 0.1, 0.012, 0.004, rack);
      fob.rotation.z = (i ? 1 : -1) * 0.05;
      box(M.brass, x, 0.0, 0.024, 0.01, 0.04, 0.004, 0, rack);
    });
    const notice = lettered(sheet, 220, 300, "#f6efdc", "#3a3a32", [
      ["WELCOME", 30, 0.11],
      ["TO THISTLEDOWN", 18, 0.21],
      ["Breakfast 7.30 to 9", 19, 0.36],
      ["Hot water all day,", 19, 0.47],
      ["more or less", 18, 0.55],
      ["Boots off, please", 19, 0.67],
      ["Do not feed Thimble.", 18, 0.78],
      ["She has eaten.", 18, 0.86],
    ]);
    picture(notice, wallX, 1.6, 0.42, 0.24, 0.33, Math.PI / 2, M.oak);
    const map = sheet.cell(320, 240, paintVillageMap);
    picture(map, wallX, 1.6, -0.2, 0.52, 0.39, Math.PI / 2, M.darkOak);
  }
  // A card on the front door, with the wrong side showing.
  {
    const card = lettered(sheet, 200, 90, "#efe2c4", "#6e2f28", [["NO VACANCIES", 22, 0.5, "Georgia"]]);
    const g = group(0, 1.48, INN.front - 0.05, Math.PI);
    sheetPlane(card, 0, 0, 0.012, 0.3, 0.13, 0, g);
    beam(M.black, [-0.1, 0.07, 0.012], [0, 0.17, 0.012], 0.004, g);
    beam(M.black, [0.1, 0.07, 0.012], [0, 0.17, 0.012], 0.004, g);
  }
  // A longcase clock. Its pendulum and hands stay out of the bake.
  const clock = {};
  {
    const c = G.clock,
      g = group(c.x, 0, c.z, Math.PI / 2);
    box(M.mahogany, 0, 0.26, 0, 0.46, 0.5, 0.3, 0.006, g);
    box(M.mahogany, 0, 1.0, 0, 0.36, 1.0, 0.24, 0.006, g);
    box(M.walnut, 0, 1.02, 0.122, 0.26, 0.86, 0.012, 0, g);
    box(M.mahogany, 0, 1.76, 0, 0.46, 0.52, 0.32, 0.006, g);
    box(M.mahogany, 0, 2.05, 0, 0.5, 0.05, 0.34, 0.006, g);
    for (const s of [-1, 1]) dot(M.brass, s * 0.18, 2.1, 0.03, 0.024, 0.03, 0.024, g);
    dot(M.brass, 0, 2.1, 0.03, 0.03, 0.04, 0.03, g);
    const face = sheet.cell(180, 180, (cx, w, h) => {
      cx.fillStyle = "#efe7d0";
      cx.fillRect(0, 0, w, h);
      cx.strokeStyle = "#3a3127";
      cx.lineWidth = 2;
      cx.beginPath();
      cx.arc(w / 2, h / 2, 84, 0, Math.PI * 2);
      cx.stroke();
      cx.fillStyle = "#3a3127";
      cx.font = "18px Georgia";
      cx.textAlign = "center";
      cx.textBaseline = "middle";
      for (let i = 1; i <= 12; i++) {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        cx.fillText(["I", "II", "III", "IIII", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][i - 1], w / 2 + Math.cos(a) * 68, h / 2 + Math.sin(a) * 68);
      }
    });
    sheetPlane(face, 0, 1.76, 0.163, 0.34, 0.34, 0, g);
    torus(M.brass, 0, 1.76, 0.163, 0.17, 0.008, g);
    // The trunk's little glass door shows the pendulum go by.
    box(M.soot, 0, 1.05, 0.13, 0.13, 0.42, 0.004, 0, g);
    torus(M.brass, 0, 1.05, 0.134, 0.075, 0.003, g);
    const moving = group(0, 0, 0, 0, g);
    keep.add(moving);
    clock.pendulum = group(0, 1.28, 0.14, 0, moving);
    box(M.brass, 0, -0.18, 0, 0.01, 0.36, 0.004, 0, clock.pendulum);
    const bob = cyl(M.brass, 0, -0.36, 0, 0.05, 0.012, 0.05, clock.pendulum, 12);
    bob.rotation.x = Math.PI / 2;
    clock.minute = group(0, 1.76, 0.172, 0, moving);
    box(M.black, 0, 0.055, 0, 0.012, 0.13, 0.004, 0, clock.minute);
    clock.hour = group(0, 1.76, 0.176, 0, moving);
    box(M.black, 0, 0.035, 0, 0.018, 0.09, 0.004, 0, clock.hour);
    for (const part of [clock.pendulum, clock.minute, clock.hour]) P.fuse(part);
  }
  // The boot bench, its pegs and everything hanging from them.
  {
    const b = G.bench,
      g = group(b.x, 0, b.z, 0);
    for (let i = 0; i < 5; i++) box(M.pine, 0.03, 0.44, -0.4 + i * 0.2, b.w - 0.08, 0.03, 0.17, 0.004, g);
    for (const s of [-1, 1]) box(M.pine, 0.02, 0.21, s * (b.d / 2 - 0.05), b.w - 0.08, 0.42, 0.04, 0, g);
    box(M.pine, 0.02, 0.12, 0, b.w - 0.14, 0.018, b.d - 0.1, 0, g);
    // Newspaper and boots on the shelf below.
    const news = sheet.cell(180, 130, (c, w, h) => {
      c.fillStyle = "#ded8c2";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#3b3a33";
      c.font = "bold 18px Georgia";
      c.textAlign = "center";
      c.fillText("WILLOWMERE POST", w / 2, 22);
      c.font = "10px Georgia";
      for (let col = 0; col < 3; col++)
        for (let y = 38; y < h - 6; y += 8) c.fillRect(8 + col * 56, y, 48 - (y % 11), 2);
    });
    const paper = sheetPlane(news, 0.02, 0.131, 0, 0.32, 0.8, 0, g);
    paper.rotation.set(-Math.PI / 2, 0, 0);
    const boot = (x, z, turn, colour, tall = 0.16) => {
      const o = group(x, 0.13, z, turn, g),
        m = mat(colour, 0.7);
      box(m, 0, 0.04, 0.05, 0.085, 0.08, 0.2, 0.012, o);
      box(m, 0, tall / 2 + 0.04, -0.03, 0.08, tall, 0.1, 0.012, o);
      box(M.black, 0, 0.012, 0.05, 0.09, 0.024, 0.21, 0.004, o);
    };
    boot(0.0, -0.32, 1.57, "#5a3f2b");
    boot(0.0, -0.18, 1.5, "#5a3f2b");
    boot(0.02, 0.1, 1.6, "#3e4a39", 0.26);
    boot(0.02, 0.26, 1.54, "#3e4a39", 0.26);
    // The peg rail, a waxed coat, a tweed hat and a long scarf.
    const pegs = group(-0.2, 1.72, 0, Math.PI / 2, g);
    box(M.oak, 0, 0, 0, 1.05, 0.09, 0.018, 0.004, pegs);
    for (let i = 0; i < 4; i++) cyl(M.brass, -0.39 + i * 0.26, 0, 0.04, 0.009, 0.06, 0.012, pegs, 6).rotation.x = Math.PI / 2;
    const coat = group(-0.39, 0, 0.07, 0, pegs);
    box(mat("#4d5234", 0.78), 0, -0.42, 0, 0.3, 0.7, 0.08, 0.03, coat);
    box(mat("#4d5234", 0.78), -0.17, -0.42, 0.004, 0.08, 0.62, 0.06, 0.02, coat);
    box(mat("#4d5234", 0.78), 0.17, -0.42, 0.004, 0.08, 0.62, 0.06, 0.02, coat);
    box(mat("#7b4e2c", 0.8), 0, -0.1, 0.01, 0.14, 0.06, 0.08, 0.012, coat);
    const coat2 = group(-0.13, 0, 0.07, 0, pegs);
    box(mat("#3f5570", 0.9), 0, -0.36, 0, 0.26, 0.6, 0.07, 0.03, coat2);
    box(mat("#b65a52", 0.94), 0.26, -0.28, 0, 0.09, 0.56, 0.018, 0, coat2);
    box(mat("#b65a52", 0.94), 0.34, -0.14, 0.01, 0.09, 0.3, 0.018, 0, coat2);
    orb(mat("#7a6a4a", 0.95), 0.39, 0.07, 0.04, 0.11, 0.055, 0.1, pegs);
    cyl(mat("#7a6a4a", 0.95), 0.39, 0.03, 0.04, 0.13, 0.012, 0.13, pegs, 12);
  }
  // The console: a telephone, a dish of mints, a mirror and the leaflet rack.
  {
    const c = G.console,
      g = group(c.x, 0, c.z, 0);
    box(M.walnut, 0, 0.76, 0, c.w, 0.025, c.d, 0.006, g);
    box(M.walnut, 0, 0.7, 0, c.w - 0.04, 0.08, c.d - 0.06, 0, g);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(M.walnut, (a * c.w) / 2 - a * 0.03, 0.34, (b * c.d) / 2 - b * 0.03, 0.012, 0.68, 0.02, g, 7);
    box(M.walnut, 0, 0.2, 0, c.w - 0.08, 0.016, c.d - 0.08, 0, g);
    // A black telephone with its dial.
    const phone = group(0.02, 0.773, 0.18, -Math.PI / 2, g);
    box(M.black, 0, 0.03, 0, 0.13, 0.06, 0.16, 0.012, phone);
    orb(M.black, 0, 0.07, 0, 0.065, 0.03, 0.07, phone);
    const handset = group(0, 0.1, 0, 0, phone);
    box(M.black, 0, 0, 0, 0.19, 0.022, 0.03, 0.006, handset);
    for (const s of [-1, 1]) orb(M.black, s * 0.09, -0.012, 0, 0.026, 0.02, 0.026, handset);
    const dial = cyl(M.ivory, 0, 0.038, 0.085, 0.03, 0.006, 0.03, phone, 12);
    dial.rotation.x = 1.05;
    // The dish of peppermints.
    const dish = group(0, 0.773, -0.12, 0, g);
    cyl(mat("#a9c5c2", 0.2), 0, 0.016, 0, 0.05, 0.03, 0.07, dish, 14);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      dot(i % 3 ? M.white : mat("#b44", 0.3), Math.cos(a) * 0.03 * (i % 2 ? 1 : 0.5), 0.037 + (i % 3) * 0.006, Math.sin(a) * 0.03 * (i % 2 ? 1 : 0.5), 0.014, 0.01, 0.014, dish);
    }
    // The leaflet rack, one colour to a pocket, on the wall above.
    const wall = group(1.425, 1.42, c.z, -Math.PI / 2);
    box(M.pine, 0, 0, 0, 0.5, 0.42, 0.018, 0, wall);
    const colours = ["#6f9078", "#b98258", "#7f96a4", "#c9a144", "#a65d4a", "#8e7aa0"];
    const leaflet = (i) =>
      sheet.cell(70, 110, (cx, w, h) => {
        cx.fillStyle = colours[i];
        cx.fillRect(0, 0, w, h);
        cx.fillStyle = "#fff8e6";
        cx.fillRect(6, 32, w - 12, 54);
        cx.fillStyle = "#fff8e6";
        cx.font = "bold 13px Georgia";
        cx.textAlign = "center";
        cx.fillText(["WOOD", "POND", "MARSH", "MARKET", "HILL", "INN"][i], w / 2, 22);
        cx.fillStyle = colours[(i + 2) % 6];
        cx.beginPath();
        cx.arc(w / 2, 58, 16, 0, Math.PI * 2);
        cx.fill();
      });
    for (let i = 0; i < 6; i++) {
      const x = -0.16 + (i % 3) * 0.16,
        y = i < 3 ? 0.09 : -0.11;
      sheetPlane(leaflet(i), x, y, 0.016, 0.1, 0.16, 0, wall);
      box(mat("#c8ac7e", 0.8), x, y - 0.05, 0.025, 0.13, 0.06, 0.006, 0, wall);
    }
    // The mirror over it: a pool of brass and bright silver.
    const mirror = group(1.425, 1.98, c.z, -Math.PI / 2);
    box(M.brass, 0, 0, 0, 0.52, 0.36, 0.016, 0.004, mirror);
    P.mirrorGlass(0, 0, 0.0095, 0.46, 0.3, 0, mirror);
  }
  // The umbrella stand by the door.
  {
    const u = G.umbrellas,
      g = group(u.x, 0, u.z, 0);
    cyl(mat("#536c6c", 0.28), 0, 0.27, 0, 0.11, 0.54, 0.13, g, 14);
    torus(M.brass, 0, 0.545, 0, 0.113, 0.008, g).rotation.x = Math.PI / 2;
    beam(mat("#364a64", 0.9), [0.02, 0.1, 0], [0.09, 0.95, 0.03], 0.03, g);
    torus(M.oak, 0.11, 0.97, 0.04, 0.03, 0.007, g, Math.PI);
    beam(M.oak, [-0.04, 0.1, 0.02], [-0.1, 0.88, -0.03], 0.018, g);
    orb(M.brass, -0.1, 0.89, -0.03, 0.02, 0.02, 0.02, g);
  }
  // The barometer, and a pair of old pictures of the house.
  {
    const g = group(1.42, 1.55, 1.72, -Math.PI / 2);
    box(M.walnut, 0, 0.02, 0, 0.17, 0.62, 0.02, 0.006, g);
    const dial = cyl(M.walnut, 0, 0, 0.002, 0.13, 0.024, 0.13, g, 20);
    dial.rotation.x = Math.PI / 2;
    const face = sheet.cell(120, 120, (c, w, h) => {
      c.fillStyle = "#efe7d0";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#332";
      c.font = "11px Georgia";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("STORMY", 30, 80);
      c.fillText("RAIN", 28, 44);
      c.fillText("CHANGE", 60, 20);
      c.fillText("FAIR", 96, 44);
      c.fillText("SET FAIR", 90, 78);
      c.strokeStyle = "#332";
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(w / 2, h / 2, 52, 0, Math.PI * 2);
      c.stroke();
      c.lineWidth = 2.2;
      c.beginPath();
      c.moveTo(w / 2, h / 2);
      c.lineTo(w / 2 + 34, h / 2 + 22);
      c.stroke();
    });
    sheetPlane(face, 0, 0, 0.016, 0.21, 0.21, 0, g);
    torus(M.brass, 0, 0, 0.018, 0.108, 0.005, g);
  }
  picture(sheet.cell(180, 140, landscape("#b8d0d7", "#8ba074", "#6f8f58", houseOnHill)), 1.42, 1.62, 2.28, 0.38, 0.28, -Math.PI / 2);
  picture(sheet.cell(180, 140, landscape("#d7c9ad", "#a58f70", "#7f8f58")), -1.42, 1.62, 2.14, 0.38, 0.28, Math.PI / 2);
  // A fern on its stand and the back door's rack of wellingtons.
  {
    const f = G.fern,
      g = group(f.x, 0, f.z, 0);
    cyl(M.darkOak, 0, 0.4, 0, 0.022, 0.8, 0.028, g, 8);
    cyl(M.darkOak, 0, 0.82, 0, 0.17, 0.024, 0.17, g, 14);
    cyl(M.darkOak, 0, 0.03, 0, 0.14, 0.05, 0.05, g, 10);
    potPlant(0, 0.83, 0, 0.17, 12, g, mat("#536c6c", 0.28));
    const rack = G.bootRack,
      r = group(rack.x, 0, rack.z, 0);
    box(M.pine, 0, 0.09, 0, rack.w, 0.022, rack.d, 0, r);
    for (const s of [-1, 1]) box(M.pine, 0, 0.05, (s * rack.d) / 2, rack.w, 0.1, 0.02, 0, r);
    const colours = ["#3e4a39", "#3e4a39", "#a03f33", "#a03f33", "#25303b", "#25303b"];
    colours.forEach((c, i) => {
      const z = -0.28 + i * 0.11,
        m = mat(c, 0.35);
      box(m, 0.03, 0.14, z, 0.2, 0.08, 0.085, 0.015, r);
      cyl(m, -0.03, 0.31, z, 0.044, 0.34, 0.05, r, 10);
    });
    // A row of hats and a broom on its hook by the back door.
    const hook = group(-0.9, 0, -INN.front + 0.08, 0);
    beam(M.pine, [0.0, 0.08, 0.02], [-0.06, 1.42, 0.04], 0.022, hook);
    for (let i = -3; i <= 3; i++) beam(mat("#b79b57", 0.95), [-0.002, 0.1, 0.02], [i * 0.035, -0.08, 0.02], 0.012, hook);
    picture(sheet.cell(180, 140, landscape("#c8d7d0", "#7f9f7f", "#5f7f58")), -1.42, 1.62, -2.0, 0.38, 0.28, Math.PI / 2);
    picture(sheet.cell(140, 180, paintHenPortrait), 1.42, 1.62, -2.65, 0.26, 0.34, -Math.PI / 2, M.oak);
  }
  return { parts: P, clock };
}

function houseOnHill(c, w, h) {
  c.fillStyle = "#e5dabb";
  c.fillRect(w * 0.42, h * 0.46, w * 0.18, h * 0.2);
  c.fillStyle = "#a66b52";
  c.beginPath();
  c.moveTo(w * 0.4, h * 0.46);
  c.lineTo(w * 0.51, h * 0.3);
  c.lineTo(w * 0.62, h * 0.46);
  c.fill();
}
function paintHenPortrait(c, w, h) {
  c.fillStyle = "#d9cfa9";
  c.fillRect(0, 0, w, h);
  c.fillStyle = "#83563a";
  c.beginPath();
  c.ellipse(w * 0.46, h * 0.56, 42, 34, -0.2, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.arc(w * 0.72, h * 0.4, 18, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#b5402f";
  c.beginPath();
  c.arc(w * 0.72, h * 0.3, 6, 0, Math.PI * 2);
  c.arc(w * 0.66, h * 0.32, 5, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#e0a93a";
  c.beginPath();
  c.moveTo(w * 0.82, h * 0.4);
  c.lineTo(w * 0.92, h * 0.43);
  c.lineTo(w * 0.82, h * 0.46);
  c.fill();
  c.fillStyle = "#2c241c";
  c.font = "italic 13px Georgia";
  c.textAlign = "center";
  c.fillText("Edna", w / 2, h - 12);
}
function paintVillageMap(c, w, h) {
  c.fillStyle = "#e9dfc2";
  c.fillRect(0, 0, w, h);
  c.strokeStyle = "#7ca3b4";
  c.lineWidth = 7;
  c.beginPath();
  c.moveTo(w * 0.62, 0);
  c.bezierCurveTo(w * 0.5, h * 0.3, w * 0.7, h * 0.6, w * 0.44, h);
  c.stroke();
  c.fillStyle = "#a7c3cc";
  c.beginPath();
  c.ellipse(w * 0.58, h * 0.14, 34, 18, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "#a78a5d";
  c.lineWidth = 3;
  c.setLineDash([7, 5]);
  c.beginPath();
  c.moveTo(0, h * 0.55);
  c.lineTo(w, h * 0.5);
  c.moveTo(w * 0.3, 0);
  c.lineTo(w * 0.32, h);
  c.stroke();
  c.setLineDash([]);
  c.fillStyle = "#83a067";
  for (const [x, y] of [[50, 50], [78, 40], [62, 72], [260, 190], [282, 170], [240, 204]]) {
    c.beginPath();
    c.arc(x, y, 12, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = "#a5452f";
  for (const [x, y] of [[150, 118], [120, 130], [175, 140], [200, 110]]) c.fillRect(x, y, 13, 11);
  c.fillStyle = "#3b3a33";
  c.font = "bold 18px Georgia";
  c.textAlign = "center";
  c.fillText("WILLOWMERE", w * 0.5, h - 16);
  c.font = "italic 12px Georgia";
  c.fillText("you are here, and so is the kettle", w * 0.46, h * 0.62);
  c.strokeStyle = "#a5452f";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(106, 122);
  c.lineTo(122, 138);
  c.moveTo(122, 122);
  c.lineTo(106, 138);
  c.stroke();
}

// ---------------------------------------------------------- the breakfast room
export function buildBreakfast(M, sheet) {
  const P = createParts("breakfast", M, sheet);
  const { box, cyl, dot, orb, group, torus, mat, chair, table, clothOver, roundClothTable, place, toastRack, jamJar, cruet, milkJug, teapot, tableCard, picture, pendant, sheetPlane, potPlant, vase, cup, plate, rug, keep, range, beam } = P;

  for (const c of BREAKFAST_CHAIRS) chair(c.x, c.z, c.faces, { wood: M.oak, seat: M.ginghamBlue });
  rug(-3, 1.62, 2.1, 2.1, M.goldRug);

  // The window table, laid for Goldfinch: breakfast will arrive on its west side.
  const tw = G.tableWindow,
    h = 0.74;
  {
    const g = table(tw.x, tw.z, tw.w, tw.d, h, M.pine);
    const top = clothOver(g, tw.w, tw.d, h, M.ginghamBlue);
    place(0.2, top, 0, Math.PI / 2, M.ginghamRed, g);
    tableCard("Goldfinch", 0.02, top, 0.3, 0, g);
    vase(-0.02, top, -0.16, ["#f1ead0", "#e9c54f", "#d6a0c0"], g);
    cruet(0.24, top, 0.32, g);
    jamJar(0.32, top, -0.3, "#a34a2a", true, g);
  }
  // The breakfast itself, waiting to be cooked.
  const served = group(tw.x - 0.2, h + 0.011, tw.z);
  served.visible = false;
  keep.add(served);
  {
    plate(0, 0, 0, 0.13, M.china, served);
    const y = 0.015;
    // Bacon, a sausage, two eggs, a tomato, a fried slice and mushrooms.
    for (const s of [0, 1]) {
      const r = box(mat("#a45441", 0.6), 0.05 + s * 0.028, y + 0.006, -0.03, 0.022, 0.009, 0.12, 0, served);
      r.rotation.y = 0.1;
    }
    orb(mat("#8a5a30", 0.5), -0.055, y + 0.016, -0.045, 0.02, 0.018, 0.058, served);
    for (const [ex, ez] of [[-0.05, 0.05], [0.015, 0.06]]) {
      cyl(M.white, ex, y + 0.004, ez, 0.042, 0.006, 0.042, served, 12);
      dot(mat("#e8a428", 0.25), ex, y + 0.01, ez, 0.018, 0.012, 0.018, served);
    }
    dot(mat("#b9402a", 0.3), 0.085, y + 0.018, 0.045, 0.026, 0.018, 0.026, served);
    box(mat("#c99a5b", 0.9), -0.005, y + 0.008, -0.08, 0.06, 0.012, 0.06, 0, served);
    for (let i = 0; i < 3; i++) dot(mat("#6a4f39", 0.8), -0.09 + i * 0.016, y + 0.012, 0.0 + i * 0.01, 0.014, 0.01, 0.014, served);
    P.cutlery(0, 0.013, 0, -Math.PI / 2, served);
    toastRack(0.02, 0, -0.28, 0, 4, served);
    cup(-0.12, 0, 0.2, 0.6, served);
    teapot(0.06, 0, 0.3, M.willow, 0.5, served);
  }
  const eaten = group(tw.x - 0.2, h + 0.011, tw.z);
  eaten.visible = false;
  keep.add(eaten);
  {
    plate(0, 0, 0, 0.13, M.china, eaten);
    for (let i = 0; i < 7; i++) dot(mat("#c99a5b", 0.9), range(-0.07, 0.07), 0.017, range(-0.07, 0.07), 0.006, 0.003, 0.006, eaten);
    const fork = group(0.02, 0.018, 0.02, 0.7, eaten);
    box(M.silver, -0.02, 0.002, 0, 0.012, 0.004, 0.17, 0, fork);
    box(M.silver, 0.02, 0.002, 0, 0.012, 0.004, 0.18, 0, fork);
    box(mat("#e8a428", 0.3), 0.04, 0.002, 0.05, 0.03, 0.002, 0.01, 0, eaten);
    cup(-0.12, 0, 0.2, 0.6, eaten);
    toastRack(0.02, 0, -0.28, 0, 0, eaten);
  }

  P.fuse(served);
  P.fuse(eaten);

  // The side table, laid for Linnet.
  {
    const t = G.tableSide,
      g = table(t.x, t.z, t.w, t.d, h, M.pine),
      top = clothOver(g, t.w, t.d, h, M.ginghamBlue);
    place(0, top, 0.2, 0, M.ginghamRed, g);
    place(0, top, -0.2, Math.PI, M.ginghamRed, g);
    tableCard("Linnet", 0.26, top, 0, -Math.PI / 2, g);
    vase(-0.28, top, 0, ["#e9c54f", "#ece7d8"], g);
    cruet(0.26, top, 0.26, g);
    jamJar(-0.26, top, 0.26, "#7a2f3d", true, g);
    P.eggCup(0.1, top, -0.34, g);
    P.eggCup(0.17, top, -0.34, g);
  }
  // The round table, with a teapot in a knitted hen and everything else.
  const tr = G.tableRound,
    tea = {};
  {
    const g = roundClothTable(tr.x, tr.z, tr.r, h, M.white);
    const top = h + 0.008;
    for (const turn of [0.25, 0.75, 1.25, 1.75]) {
      const a = turn * Math.PI;
      place(Math.cos(a) * 0.3, top, -Math.sin(a) * 0.3, a + Math.PI / 2, M.ginghamBlue, g);
    }
    teapot(0, top, 0, M.willow, 0.4, g);
    // The hen cosy: the pot's brown spout is the only thing showing.
    const cosy = group(0, top, 0, 0.4, g);
    orb(mat("#b47a4c", 1), -0.012, 0.095, 0, 0.115, 0.095, 0.1, cosy);
    orb(mat("#c98e5a", 1), 0.09, 0.16, 0, 0.04, 0.045, 0.04, cosy);
    orb(mat("#b5402f", 1), 0.095, 0.21, 0, 0.012, 0.022, 0.018, cosy);
    box(mat("#e0a93a", 0.9), 0.135, 0.16, 0, 0.022, 0.012, 0.012, 0, cosy);
    box(mat("#6f4a2c", 1), -0.115, 0.14, 0, 0.05, 0.08, 0.05, 0.012, cosy);
    tea.spoutAt = [tr.x, top + 0.22, tr.z];
    toastRack(0.16, top, 0.1, 0.8, 3, g);
    jamJar(-0.13, top, 0.14, "#d38a25", true, g);
    jamJar(-0.02, top, 0.2, "#7a2f3d", true, g);
    cruet(0.05, top, -0.18, g);
    milkJug(-0.17, top, -0.08, M.china, g);
    box(M.ivory, 0.2, top + 0.015, -0.08, 0.1, 0.03, 0.06, 0.008, g);
    box(M.butter, 0.2, top + 0.038, -0.08, 0.07, 0.018, 0.04, 0.004, g);
  }
  pendant(tr.x, ceiling, tr.z, 0.44, 0.24);

  // The sideboard: cereals, bowls and a jug under its beaded cover.
  {
    const s = G.sideboard,
      g = group(s.x, 0, s.z, 0),
      top = 0.86;
    box(M.oak, 0, top, 0.005, s.w + 0.02, 0.03, s.d + 0.02, 0.006, g);
    box(M.oak, 0, top / 2 + 0.03, 0, s.w - 0.04, top - 0.1, s.d - 0.03, 0, g);
    for (let i = 0; i < 3; i++) {
      const x = -s.w / 3 + (i * s.w) / 3;
      box(M.darkOak, x, 0.44, s.d / 2 - 0.008, s.w / 3 - 0.05, 0.62, 0.014, 0, g);
      box(M.oak, x, 0.44, s.d / 2 + 0.002, s.w / 3 - 0.14, 0.5, 0.008, 0, g);
      dot(M.brass, x + s.w / 6 - 0.06, 0.48, s.d / 2 + 0.012, 0.012, 0.012, 0.012, g);
    }
    for (const a of [-1, 1]) for (const b of [-1, 1]) box(M.oak, (a * (s.w - 0.1)) / 2, 0.05, (b * (s.d - 0.1)) / 2, 0.05, 0.1, 0.05, 0, g);
    // Glass jars of cereal, with a scoop.
    const jar = (x, z, tone) => {
      cyl(mat(tone, 0.68), x, top + 0.13, z, 0.062, 0.24, 0.062, g, 12);
      cyl(M.iron, x, top + 0.262, z, 0.066, 0.024, 0.066, g, 12);
      box(M.ivory, x, top + 0.12, z + 0.06, 0.07, 0.04, 0.002, 0, g);
    };
    jar(-0.48, -0.08, "#d9b264");
    jar(-0.32, -0.1, "#c8a57b");
    jar(-0.16, -0.08, "#8d6340");
    // Stacked bowls, a basket of napkins, an orange-juice jug and the prunes.
    for (let i = 0; i < 5; i++) cyl(M.china, 0.04, top + 0.03 + i * 0.022, -0.04, 0.042, 0.03, 0.075, g, 14);
    const jug = group(0.28, top + 0.016, -0.06, 0.3, g);
    cyl(mat("#ec9b27", 0.25), 0, 0.09, 0, 0.055, 0.17, 0.05, jug, 12);
    cyl(M.linen, 0, 0.19, 0, 0.074, 0.03, 0.074, jug, 12);
    for (let i = 0; i < 12; i++) dot(M.butter, Math.cos(i * 0.52) * 0.076, 0.165, Math.sin(i * 0.52) * 0.076, 0.008, 0.008, 0.008, jug);
    cyl(M.willow, 0.46, top + 0.036, 0.04, 0.05, 0.05, 0.09, g, 14);
    for (let i = 0; i < 5; i++) dot(mat("#3b2a2d", 0.5), 0.46 + Math.cos(i * 1.3) * 0.04, top + 0.064, 0.04 + Math.sin(i * 1.3) * 0.04, 0.018, 0.014, 0.018, g);
    // The fruit bowl.
    const bowl = group(-0.08, top + 0.016, 0.12, 0, g);
    cyl(M.china, 0, 0.03, 0, 0.06, 0.06, 0.12, bowl, 14);
    orb(mat("#b6432f", 0.45), -0.04, 0.09, 0, 0.042, 0.042, 0.042, bowl);
    orb(mat("#d98a2a", 0.55), 0.045, 0.09, 0.03, 0.044, 0.044, 0.044, bowl);
    orb(mat("#7da042", 0.45), 0.01, 0.09, -0.05, 0.04, 0.042, 0.04, bowl);
    orb(mat("#b6432f", 0.45), 0.005, 0.135, 0.01, 0.038, 0.04, 0.038, bowl);
    // A little framed card, and a botanical print over all of it.
    tableCard("Help yourself", 0.28, top + 0.016, 0.14, 0, g);
    const finch = sheet.cell(180, 230, botanical("#d4a93a", "#b4a2bf"));
    picture(finch, -0.15, 1.72, -s.d / 2 + 0.03, 0.42, 0.54, 0, M.darkOak, g);
  }
  // The hatch: a counter on this side, a bell and the kitchen's light beyond.
  {
    const bellGroup = group(-3.2, 0.987, partition + 0.2);
    cyl(M.iron, 0, 0.02, 0, 0.05, 0.016, 0.05, bellGroup, 12);
    orb(M.brass, 0, 0.055, 0, 0.042, 0.038, 0.042, bellGroup);
    dot(M.brass, 0, 0.1, 0, 0.012, 0.016, 0.012, bellGroup);
    const sign = lettered(sheet, 220, 70, "#efe2c4", "#3a3a32", [["Please ring for Dot", 20, 0.5]]);
    sheetPlane(sign, -3.55, 1.76, partition + 0.076, 0.42, 0.13);
    // A tray of clean cups waiting on the counter.
    const tray = group(-3.82, 0.987, partition + 0.16);
    box(M.oak, 0, 0.008, 0, 0.26, 0.014, 0.2, 0, tray);
    for (const [x, z] of [[-0.07, -0.05], [0.07, -0.05], [-0.07, 0.05], [0.07, 0.05]]) cup(x, 0.014, z, x, tray);
  }
  // The Welsh dresser, faced into the room from the hall wall.
  {
    const d = G.dresser,
      g = group(d.x, 0, d.z, -Math.PI / 2),
      w = d.d,
      deep = d.w,
      top = 0.84,
      wood = M.oak;
    box(wood, 0, top / 2, 0, w, top - 0.04, deep - 0.02, 0, g);
    box(wood, 0, top, 0, w + 0.03, 0.03, deep + 0.02, 0.006, g);
    for (const s of [-1, 1]) {
      box(M.darkOak, s * 0.3, 0.32, deep / 2 - 0.006, 0.5, 0.52, 0.014, 0, g);
      dot(M.brass, s * 0.08, 0.34, deep / 2 + 0.01, 0.014, 0.014, 0.014, g);
      box(M.darkOak, s * 0.3, 0.71, deep / 2 - 0.006, 0.5, 0.16, 0.014, 0, g);
      dot(M.brass, s * 0.3, 0.71, deep / 2 + 0.01, 0.014, 0.014, 0.014, g);
    }
    // The rack above, shallow, with its plates on edge and cups on hooks.
    const rackDeep = 0.22,
      rackZ = -deep / 2 + rackDeep / 2,
      rackH = 1.2;
    for (const s of [-1, 1]) box(wood, (s * (w - 0.03)) / 2, top + rackH / 2, rackZ, 0.03, rackH, rackDeep, 0, g);
    box(wood, 0, top + rackH / 2, -deep / 2 + 0.008, w, rackH, 0.014, 0, g);
    box(wood, 0, top + rackH + 0.02, rackZ + 0.02, w + 0.1, 0.05, rackDeep + 0.08, 0.008, g);
    const shelves = [top + 0.06, top + 0.42, top + 0.8];
    const colours = [M.willow, mat("#7e93b8", 0.26), M.china, mat("#5a78a0", 0.26), mat("#b6665c", 0.28), M.china];
    for (const [i, y] of shelves.entries()) {
      box(wood, 0, y - 0.012, rackZ, w - 0.04, 0.024, rackDeep - 0.01, 0, g);
      box(M.brass, 0, y + 0.03, rackZ + rackDeep / 2 - 0.018, w - 0.06, 0.008, 0.008, 0, g);
      for (let k = 0; k < 6; k++) {
        const x = -0.47 + k * 0.188,
          plateMesh = cyl(colours[(i * 2 + k) % colours.length], x, y + 0.1, rackZ - 0.02, 0.078, 0.012, 0.078, g, 14);
        plateMesh.rotation.x = Math.PI / 2 - 0.16;
        if (k % 2 === 0) {
          const rim = torus(M.china, x, y + 0.1, rackZ - 0.012, 0.062, 0.004, g);
          rim.rotation.x = -0.16;
        }
      }
    }
    // Cups on hooks and jugs on the top.
    for (let k = 0; k < 6; k++) {
      const x = -0.46 + k * 0.184;
      cyl(k % 2 ? M.willow : M.china, x, top + 1.08 - 0.3, rackZ + 0.08, 0.024, 0.05, 0.03, g, 9);
    }
    milkJug(-0.3, top + rackH + 0.045, rackZ, M.willow, g);
    milkJug(0.34, top + rackH + 0.045, rackZ, M.china, g);
    cyl(M.apple, 0.03, top + rackH + 0.13, rackZ, 0.07, 0.17, 0.05, g, 12);
    // Things on its surface: a big ashet, a toast-rack and the butter crock.
    const dish = cyl(M.willow, 0, top + 0.13, -deep / 2 + 0.28, 0.135, 0.015, 0.135, g, 18);
    dish.rotation.x = Math.PI / 2 - 0.3;
    cyl(M.cream, -0.38, top + 0.06, 0.05, 0.05, 0.09, 0.06, g, 12);
    jamJar(0.3, top + 0.016, 0.02, "#a34a2a", true, g);
    jamJar(0.4, top + 0.016, 0.06, "#7a2f3d", true, g);
    vase(0.16, top + 0.016, 0.03, ["#f1ead0", "#d6a0c0", "#c9a144"], g, M.china);
  }
  // Caruso's stand, cage and perch, and the bird himself.
  const caruso = {};
  {
    const c = G.canary,
      g = group(c.x, 0, c.z, 0);
    cyl(M.iron, 0, 0.02, 0, 0.17, 0.03, 0.19, g, 14);
    cyl(M.iron, 0, 0.6, 0, 0.014, 1.15, 0.018, g, 7);
    const base = cyl(M.brass, 0, 1.18, 0, 0.14, 0.03, 0.15, g, 16);
    base.castShadow = true;
    for (const y of [1.2, 1.42, 1.62]) torus(M.brass, 0, y, 0, y > 1.5 ? 0.11 : 0.14, 0.003, g).rotation.x = Math.PI / 2;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2,
        cs = Math.cos(a),
        sn = Math.sin(a);
      beam(M.brass, [cs * 0.14, 1.19, sn * 0.14], [cs * 0.14, 1.42, sn * 0.14], 0.0045, g);
      beam(M.brass, [cs * 0.14, 1.42, sn * 0.14], [cs * 0.11, 1.62, sn * 0.11], 0.0045, g);
      beam(M.brass, [cs * 0.11, 1.62, sn * 0.11], [0, 1.72, 0], 0.0045, g);
    }
    torus(M.brass, 0, 1.75, 0, 0.022, 0.004, g);
    box(M.oak, 0, 1.33, 0, 0.24, 0.01, 0.01, 0, g);
    cyl(M.china, 0.08, 1.235, 0.04, 0.022, 0.03, 0.022, g, 8);
    box(M.ivory, -0.08, 1.27, 0, 0.012, 0.05, 0.03, 0, g);
    const bird = group(0, 1.34, 0, 0, g);
    keep.add(bird);
    orb(mat("#f0cb47", 0.8), 0, 0.025, 0, 0.022, 0.024, 0.032, bird);
    orb(mat("#f6d756", 0.8), 0, 0.055, 0.022, 0.018, 0.018, 0.018, bird);
    box(mat("#e0872a", 0.5), 0, 0.054, 0.042, 0.006, 0.006, 0.014, 0, bird);
    box(mat("#d6b23b", 0.8), 0, 0.02, -0.04, 0.012, 0.006, 0.04, 0, bird);
    for (const s of [-1, 1]) dot(M.black, s * 0.012, 0.062, 0.033, 0.003, 0.003, 0.003, bird);
    caruso.bird = P.fuse(bird);
  }
  // The chalkboard, the window sills and a few pictures.
  {
    const board = sheet.cell(360, 300, (c, w, h) => {
      c.fillStyle = "#2c3431";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "rgba(238,232,214,0.92)";
      c.textAlign = "center";
      c.font = "italic 34px Georgia";
      c.fillText("This morning", w / 2, 44);
      c.font = "23px Georgia";
      ["Bacon & Marigold’s eggs", "Basil’s tomatoes", "Rowan’s safe mushrooms", "Toast until you say stop", "Marmalade, illegal"].forEach((line, i) => c.fillText(line, w / 2, 94 + i * 37));
      c.font = "italic 18px Georgia";
      c.fillText("until nine, or until Dot sits down", w / 2, h - 18);
    });
    const g = group(-1.565, 1.5, 1.2, -Math.PI / 2);
    box(M.oak, 0, 0, -0.012, 0.74, 0.62, 0.024, 0.004, g);
    sheetPlane(board, 0, 0, 0.002, 0.68, 0.56, 0, g);
    box(M.oak, 0, -0.31, 0.02, 0.5, 0.012, 0.04, 0, g);
    for (let i = 0; i < 3; i++) box(M.white, -0.15 + i * 0.09, -0.3, 0.02, 0.05, 0.012, 0.012, 0, g);
    // Geraniums on the front sill, a cat ornament on the side one.
    potPlant(-3.95, 0.84, 4.86, 0.1, 8);
    potPlant(-3.05, 0.84, 4.86, 0.1, 8, P.base, mat("#536c6c", 0.28));
    for (const [x, z] of [[-3.95, 4.86], [-3.05, 4.86]]) {
      for (let i = 0; i < 5; i++) dot(mat("#c8413a", 0.82), x + Math.cos(i * 1.3) * 0.07, 1.04 + i * 0.012, z + Math.sin(i * 1.3) * 0.05, 0.024, 0.022, 0.024);
    }
    potPlant(-5.5 + 0.02, 0.84, 2.1, 0.09, 7, P.base, mat("#b98258", 0.5));
    picture(sheet.cell(180, 140, landscape("#c4d9d6", "#a9b17c", "#7f9f58")), -5.48, 1.72, 1.1, 0.4, 0.3, Math.PI / 2, M.oak);
    picture(sheet.cell(160, 210, botanical("#d76f6f", "#e5c9ae")), -5.48, 1.72, 3.95, 0.3, 0.38, Math.PI / 2, M.oak);
    picture(sheet.cell(160, 210, botanical("#6f9fd7", "#cfdcdf")), -5.05, 1.72, 4.78, 0.3, 0.38, Math.PI, M.oak);
  }
  return { parts: P, served, eaten, caruso, tea };
}

function botanical(bloom, leaf) {
  return (c, w, h) => {
    c.fillStyle = "#f2ead6";
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "#62744e";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(w / 2, h - 16);
    c.quadraticCurveTo(w / 2 - 10, h * 0.5, w / 2, h * 0.28);
    c.stroke();
    c.fillStyle = "#7c8f5f";
    for (const s of [-1, 1]) {
      c.beginPath();
      c.ellipse(w / 2 + s * 26, h * 0.62, 30, 11, s * 0.55, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = leaf;
    c.beginPath();
    c.ellipse(w / 2, h * 0.28 + 18, 20, 14, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = bloom;
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      c.beginPath();
      c.ellipse(w / 2 + Math.cos(a) * 18, h * 0.24 + Math.sin(a) * 18, 15, 10, a, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = "#3b3a33";
    c.font = "italic 11px Georgia";
    c.textAlign = "center";
    c.fillText("Cirsium vulgare", w / 2, h - 5);
  };
}

// -------------------------------------------------------------------- the kitchen
export function buildKitchen(M, sheet) {
  const P = createParts("kitchen", M, sheet);
  const { box, cyl, dot, orb, group, torus, mat, chair, table, picture, sheetPlane, pendant, potPlant, jamJar, plate, cup, rug, slab, range, random, beam } = P;

  pendant(-3.55, ceiling, -1.0, 0.4, 0.22);
  rug(-4.1, -0.7, 0.8, 1.3, M.ragRug, { fringe: false });
  // A tiled splash-back along the range's wall.
  slab(M.metro, -5.5, -5.48, 0, 1.6, -1.55, 0.13, 0.6, { shadow: false });

  // The range: cream enamel, two ovens and a pair of lids.
  const pan = {};
  {
    const r = G.range,
      g = group(r.x, 0, r.z, Math.PI / 2),
      enamel = mat("#efe5c6", 0.3),
      w = r.d,
      deep = r.w;
    box(enamel, 0, 0.45, 0, w, 0.82, deep, 0.012, g);
    box(M.black, 0, 0.02, 0.02, w - 0.08, 0.04, deep - 0.08, 0, g);
    box(enamel, 0, 0.87, -0.02, w + 0.03, 0.03, deep + 0.03, 0.008, g);
    box(M.iron, 0, 0.888, 0, w - 0.08, 0.006, deep - 0.12, 0, g);
    for (const [x, y, h] of [[-0.26, 0.3, 0.42], [0.26, 0.3, 0.42], [-0.26, 0.66, 0.2], [0.26, 0.66, 0.2]]) {
      box(mat("#e7dcbd", 0.28), x, y, deep / 2 + 0.008, 0.46, h, 0.018, 0.006, g);
      box(M.silver, x, y + h / 2 - 0.04, deep / 2 + 0.042, 0.28, 0.016, 0.016, 0, g);
      for (const s of [-1, 1]) box(M.silver, x + s * 0.13, y + h / 2 - 0.04, deep / 2 + 0.024, 0.012, 0.012, 0.03, 0, g);
    }
    // The towel bar, with a tea towel over it.
    box(M.silver, 0, 0.78, deep / 2 + 0.05, w - 0.08, 0.012, 0.012, 0, g);
    box(M.ginghamRed, -0.28, 0.66, deep / 2 + 0.056, 0.26, 0.24, 0.006, 0, g);
    // The lids and a kettle on one; the frying pan, big as a cartwheel, on the other.
    const lidTop = 0.894;
    cyl(M.silver, 0.32, lidTop + 0.02, 0, 0.17, 0.04, 0.19, g, 18);
    const kettle = group(0.32, lidTop + 0.04, 0, 0.6, g);
    orb(M.silver, 0, 0.085, 0, 0.1, 0.09, 0.1, kettle);
    cyl(M.silver, 0, 0.17, 0, 0.045, 0.02, 0.05, kettle, 10);
    beam(M.silver, [0.08, 0.1, 0], [0.16, 0.15, 0], 0.018, kettle);
    torus(M.black, 0, 0.18, 0, 0.075, 0.008, kettle, Math.PI);
    const panGroup = group(-0.26, lidTop, 0.02, 0, g);
    cyl(M.iron, 0, 0.022, 0, 0.21, 0.044, 0.195, panGroup, 22);
    cyl(mat("#4a3a2a", 0.3), 0, 0.045, 0, 0.18, 0.002, 0.18, panGroup, 22);
    box(M.iron, 0.3, 0.05, 0.02, 0.26, 0.018, 0.036, 0, panGroup).rotation.y = 0.16;
    const sizzle = group(0, 0, 0, 0, panGroup);
    for (const [x, z] of [[-0.06, -0.05], [0.07, 0.05]]) {
      cyl(M.white, x, 0.05, z, 0.05, 0.005, 0.05, sizzle, 12);
      dot(mat("#e8a428", 0.25), x, 0.056, z, 0.022, 0.012, 0.022, sizzle);
    }
    box(mat("#a45441", 0.6), -0.02, 0.052, 0.07, 0.12, 0.01, 0.024, 0, sizzle);
    box(mat("#a45441", 0.6), 0.02, 0.052, -0.09, 0.12, 0.01, 0.024, 0, sizzle);
    sizzle.visible = false;
    pan.sizzle = P.fuse(sizzle);
    pan.at = [r.x, lidTop + 0.1, r.z + 0.26];
    // The flue into the wall, and the shelf above the range.
    cyl(M.black, 0, 1.72, -deep / 2 + 0.16, 0.085, 1.68, 0.085, g, 12);
    cyl(M.iron, 0, 1.2, -deep / 2 + 0.16, 0.1, 0.03, 0.1, g, 12);
    const shelf = group(0, 1.62, -deep / 2 + 0.03, 0, g);
    box(M.pine, 0, 0, 0, w + 0.16, 0.03, 0.2, 0, shelf);
    for (const s of [-1, 1]) box(M.iron, s * (w / 2 - 0.1), -0.08, -0.04, 0.02, 0.15, 0.16, 0, shelf);
    for (const [i, c] of [M.copper, M.copper, M.iron].entries()) {
      const px = -0.42 + i * 0.3;
      cyl(c, px, 0.09, 0, 0.09 - i * 0.012, 0.15 - i * 0.02, 0.1 - i * 0.012, shelf, 14);
    }
    for (const [x, tone] of [[0.32, "#c9a14f"], [0.44, "#7a4a2a"], [0.56, "#d5cfb9"]]) {
      cyl(mat(tone, 0.26), x, 0.075, 0, 0.042, 0.12, 0.042, shelf, 10);
      cyl(M.oak, x, 0.14, 0, 0.044, 0.014, 0.044, shelf, 10);
    }
  }
  // The sink under the back window, the drainer and the herbs on the sill.
  {
    const s = G.sink,
      g = group(s.x, 0, s.z, 0),
      top = 0.86;
    box(M.oak, 0, top + 0.012, 0, s.w, 0.04, s.d, 0.006, g);
    box(M.creamBoards, 0, top / 2, -0.01, s.w - 0.02, top - 0.02, s.d - 0.04, 0, g);
    box(M.ginghamRed, 0.45, top / 2 - 0.02, s.d / 2 - 0.018, 0.7, top - 0.1, 0.008, 0, g);
    for (let i = 0; i < 3; i++) box(M.black, 0.15 + i * 0.3, top / 2 - 0.02, s.d / 2 - 0.012, 0.006, top - 0.1, 0.004, 0, g);
    box(M.oak, -0.5, top / 2 - 0.02, s.d / 2 - 0.018, 0.55, top - 0.1, 0.014, 0, g);
    dot(M.brass, -0.3, 0.5, s.d / 2 - 0.004, 0.014, 0.014, 0.014, g);
    // The stone sink itself, sunk in the top.
    const china = M.white;
    box(china, -0.16, top + 0.04, 0.02, 0.64, 0.14, 0.05, 0, g);
    box(china, -0.16, top + 0.04, -0.2, 0.64, 0.14, 0.05, 0, g);
    box(china, -0.46, top + 0.04, -0.09, 0.05, 0.14, 0.25, 0, g);
    box(china, 0.14, top + 0.04, -0.09, 0.05, 0.14, 0.25, 0, g);
    box(mat("#b8b5a8", 0.5), -0.16, top + 0.04, -0.09, 0.58, 0.012, 0.22, 0, g);
    for (const x of [-0.26, -0.06]) {
      cyl(M.brass, x, top + 0.2, -0.26, 0.012, 0.22, 0.012, g, 7);
      box(M.brass, x, top + 0.31, -0.2, 0.018, 0.018, 0.13, 0, g);
      box(M.brass, x, top + 0.335, -0.26, 0.05, 0.012, 0.012, 0, g);
    }
    // The wooden drainer and things draining.
    box(M.pine, 0.48, top + 0.045, -0.04, 0.42, 0.02, 0.48, 0, g);
    for (let i = 0; i < 6; i++) box(M.oak, 0.31 + i * 0.07, top + 0.058, -0.04, 0.015, 0.005, 0.44, 0, g);
    for (let k = 0; k < 4; k++) {
      const m = cyl(k % 2 ? M.willow : M.china, 0.38 + k * 0.07, top + 0.13, -0.04, 0.08, 0.012, 0.08, g, 14);
      m.rotation.z = Math.PI / 2 - 0.2;
    }
    cup(0.56, top + 0.056, 0.16, 0.5, g);
    // Soap, and a scrubbing brush.
    box(M.apple, -0.34, top + 0.04, 0.2, 0.08, 0.018, 0.05, 0.004, g);
    box(M.oak, 0.14, top + 0.042, 0.18, 0.12, 0.018, 0.05, 0.004, g);
    // Herbs in cracked teacups along the sill.
    for (const [i, x] of [-0.58, 0.2, 0.44].entries()) {
      const cupAt = group(x, 1.075, -0.24, 0, g);
      cup(0, 0, 0, i, cupAt);
      potPlant(0, -0.06, 0, 0.055, 6, cupAt, M.china);
    }
  }
  // Under the hatch: plates, a toaster and the spike with the morning's orders.
  {
    const s = G.worktop,
      g = group(s.x, 0, s.z, Math.PI),
      top = 0.86;
    box(M.oak, 0, top + 0.012, 0, s.w, 0.04, s.d, 0.006, g);
    box(M.creamBoards, 0, top / 2, 0, s.w - 0.02, top - 0.02, s.d - 0.04, 0, g);
    for (let i = 0; i < 3; i++) {
      const x = -0.52 + i * 0.52;
      box(M.oak, x, 0.46, s.d / 2 - 0.016, 0.48, top - 0.16, 0.014, 0, g);
      dot(M.brass, x + 0.18, 0.52, s.d / 2, 0.012, 0.012, 0.012, g);
    }
    // In local space +z is the room, and the wall (and hatch) lies behind.
    const t = top + 0.032;
    for (let i = 0; i < 8; i++) plate(-0.6, t + i * 0.012, 0.02, 0.1, M.china, g, i % 2 ? M.willow : null);
    // A chrome toaster, popped.
    const toaster = group(-0.28, t, 0.05, 0, g);
    box(M.silver, 0, 0.075, 0, 0.26, 0.13, 0.14, 0.018, toaster);
    for (const s2 of [-1, 1]) box(M.black, 0, 0.142, s2 * 0.035, 0.2, 0.006, 0.02, 0, toaster);
    box(mat("#c99a5b", 0.95), 0.03, 0.15, 0.035, 0.11, 0.06, 0.012, 0, toaster);
    box(mat("#c99a5b", 0.95), -0.03, 0.15, -0.035, 0.11, 0.06, 0.012, 0, toaster);
    box(M.black, 0.135, 0.09, 0, 0.012, 0.03, 0.04, 0, toaster);
    // The bread bin and board.
    const bin = group(0.5, t, 0, 0, g);
    box(mat("#7e93a6", 0.32, 0.5), 0, 0.09, 0, 0.32, 0.17, 0.24, 0.018, bin);
    const breadLabel = lettered(sheet, 150, 48, "#7e93a6", "#f3efe2", [["BREAD", 28, 0.55, "Georgia"]]);
    sheetPlane(breadLabel, 0, 0.11, 0.122, 0.2, 0.065, 0, bin);
    // The order spike and a bottle of brown sauce.
    const spike = group(0.14, t, 0.2, 0, g);
    cyl(M.iron, 0, 0.008, 0, 0.038, 0.012, 0.04, spike, 10);
    cyl(M.iron, 0, 0.09, 0, 0.002, 0.16, 0.002, spike, 5);
    for (let i = 0; i < 4; i++) {
      const slip = box(M.ivory, range(-0.008, 0.008), 0.05 + i * 0.015, range(-0.006, 0.006), 0.07, 0.002, 0.09, 0, spike);
      slip.rotation.y = i * 0.35;
    }
    cyl(mat("#5a3320", 0.25), 0.28, t + 0.07, 0.2, 0.024, 0.14, 0.018, g, 9);
    // A row of eggs in their stacked trays.
    box(mat("#c6b890", 0.95), -0.02, t + 0.016, -0.14, 0.26, 0.03, 0.2, 0, g);
    for (let i = 0; i < 6; i++) dot(i % 3 ? mat("#caa281", 0.72) : mat("#efe7d6", 0.72), -0.1 + (i % 3) * 0.08, t + 0.05, -0.2 + Math.floor(i / 3) * 0.12, 0.024, 0.031, 0.024, g);
  }
  // The scrubbed table: eggs, flour, bread and a jug of whatever's out.
  {
    const t = G.kitchenTable,
      h = 0.76,
      g = table(t.x, t.z, t.w, t.d, h, M.pine);
    // The basket.
    const basket = group(0, h, -0.22, 0.2, g);
    cyl(mat("#a5804c", 0.95), 0, 0.05, 0, 0.13, 0.1, 0.1, basket, 14);
    for (let i = 0; i < 10; i++) {
      const a = i * 2.39,
        rr = i < 7 ? 0.09 : 0.03,
        blue = i === 3;
      dot(blue ? mat("#a6c8cf", 0.6) : mat(i % 2 ? "#c29a76" : "#d8bd9b", 0.7), Math.cos(a) * rr, 0.105 + (i < 7 ? 0 : 0.04), Math.sin(a) * rr, 0.028, 0.036, 0.028, basket);
    }
    const arc = torus(mat("#8d6a3c", 0.95), 0, 0.1, 0, 0.13, 0.007, basket, Math.PI);
    arc.rotation.y = 0.5;
    // Mixing bowl, flour, wooden spoon, rolling pin.
    const bowl = group(-0.16, h, 0.22, 0, g);
    cyl(M.cream, 0, 0.055, 0, 0.09, 0.11, 0.17, bowl, 16);
    cyl(mat("#e8dcc2", 0.95), 0, 0.09, 0, 0.145, 0.006, 0.145, bowl, 16);
    beam(M.pine, [0.02, 0.1, 0.02], [0.19, 0.2, 0.09], 0.018, bowl);
    const pin = cyl(M.pine, 0.2, h + 0.03, 0.34, 0.03, 0.36, 0.03, g, 10);
    pin.rotation.z = Math.PI / 2;
    box(M.linen, 0.17, h + 0.002, 0.3, 0.42, 0.003, 0.3, 0, g);
    box(M.linen, -0.25, h + 0.1, 0.56, 0.17, 0.2, 0.12, 0.018, g);
    // A loaf on its board with the knife left in it.
    const board = group(0.17, h, -0.42, 0.3, g);
    box(M.oak, 0, 0.012, 0, 0.26, 0.022, 0.36, 0.006, board);
    orb(mat("#b67e3f", 0.75), 0, 0.075, -0.03, 0.09, 0.062, 0.13, board);
    box(M.silver, 0.03, 0.09, 0.15, 0.012, 0.006, 0.12, 0, board);
    box(M.black, 0.03, 0.09, 0.07, 0.016, 0.014, 0.05, 0, board);
    // Sweet peas in a jug, by the end nearest the window.
    P.vase(-0.2, h, -0.52, ["#d6a0c0", "#efe7d6", "#8e7aa0"], g, M.willow);
  }
  for (const c of KITCHEN_CHAIRS) chair(c.x, c.z, c.faces, { wood: M.pine, seat: M.ginghamRed });
  // Copper pans on a rail over the table.
  {
    const rack = group(G.kitchenTable.x, 2.05, G.kitchenTable.z, 0);
    box(M.iron, 0, 0, 0, 0.04, 0.03, 1.3, 0, rack);
    for (const s of [-0.6, 0.6]) box(M.iron, 0, ceiling - 2.05, s, 0.018, ceiling - 2.05 + 0.04, 0.018, 0, rack);
    [0.11, 0.1, 0.09, 0.075, 0.06].forEach((r, i) => {
      const z = -0.48 + i * 0.24,
        pan2 = group(0, -0.02, z, 0, rack);
      box(M.iron, 0, -0.03, 0, 0.006, 0.05, 0.006, 0, pan2);
      box(M.copper, 0, -0.14, 0, 0.018, 0.2, 0.006, 0, pan2);
      const body = cyl(M.copper, 0, -0.26 - r / 2, 0, r, 0.06, r * 0.96, pan2, 16);
      body.rotation.z = Math.PI / 2;
    });
    // A bunch of herbs drying from the end of it.
    for (const zz of [-0.62, 0.62]) {
      for (let i = 0; i < 5; i++) beam(mat("#6f8a56", 0.95), [0, -0.02, zz], [(i - 2) * 0.03, -0.3, zz + (i % 2 ? 0.02 : -0.02)], 0.012, rack);
    }
  }
  // Dot's jam shelves, on the hall wall.
  {
    const s = G.jamShelves,
      g = group(s.x, 0, s.z, -Math.PI / 2),
      w = s.d,
      wood = M.pine,
      fruits = ["#7a2f3d", "#a34a2a", "#d38a25", "#4f2230", "#b5642f", "#6d7f3f", "#c7a33a", "#8a1f2a", "#d9b55a"];
    box(M.creamBoards, 0, 1.0, -s.w / 2 + 0.008, w, 2.0, 0.016, 0, g);
    for (const y of [0.05, 0.42, 0.78, 1.14, 1.5, 1.9]) {
      box(wood, 0, y, 0, w, 0.028, s.w, 0, g);
      if (y === 1.9 || y === 0.05) continue;
      let x = -w / 2 + 0.07;
      while (x < w / 2 - 0.05) {
        jamJar(x, y + 0.014, range(-0.06, 0.1), fruits[Math.floor(random() * fruits.length)], true, g);
        x += range(0.09, 0.115);
      }
    }
    for (const sx of [-1, 1]) box(wood, (sx * (w - 0.02)) / 2, 1.0, 0, 0.024, 2, s.w, 0, g);
    // The bottom shelf: crocks; a jug on top of the whole lot.
    for (const [x, tone, r] of [[-0.45, "#8a6b44", 0.11], [-0.12, "#d6cdb2", 0.13], [0.2, "#6a5b4b", 0.1], [0.5, "#c7b48a", 0.09]]) {
      cyl(mat(tone, 0.4), x, 0.17, 0, r, 0.2, r * 1.05, g, 14);
      cyl(mat(tone, 0.4), x, 0.283, 0, r * 0.9, 0.022, r * 0.9, g, 14);
    }
    cyl(mat("#b69a6e", 0.4), -0.2, 2.03, 0, 0.09, 0.2, 0.11, g, 14);
    cyl(M.china, 0.3, 1.98, 0, 0.11, 0.1, 0.09, g, 14);
  }
  // The larder, a calendar, the wall clock and a broom in the corner.
  {
    const l = G.larder,
      g = group(l.x, 0, l.z, Math.PI / 2);
    box(M.creamBoards, 0, 1.0, 0, l.d, 2, l.w, 0, g);
    box(M.oak, 0, 2.02, 0, l.d + 0.04, 0.04, l.w + 0.04, 0.006, g);
    for (const s of [-1, 1]) {
      box(mat("#e7dcbd", 0.5), (s * l.d) / 4, 1, l.w / 2 + 0.008, l.d / 2 - 0.02, 1.86, 0.014, 0, g);
      dot(M.brass, s * 0.04, 1.02, l.w / 2 + 0.024, 0.016, 0.016, 0.016, g);
      for (let k = 0; k < 6; k++) box(M.black, (s * l.d) / 4, 1.72 + k * 0.03, l.w / 2 + 0.018, l.d / 2 - 0.12, 0.012, 0.006, 0, g);
    }
    cyl(mat("#a5804c", 0.9), -0.15, 2.17, -0.02, 0.1, 0.22, 0.13, g, 12);
    cyl(M.apple, 0.18, 2.14, 0.0, 0.08, 0.2, 0.09, g, 12);
    const calendar = sheet.cell(180, 240, (c, w, h) => {
      c.fillStyle = "#f4efdf";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#7c8f5f";
      c.fillRect(0, 0, w, 100);
      c.fillStyle = "#e9c54f";
      c.beginPath();
      c.arc(w * 0.7, 40, 18, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#3b3a33";
      c.font = "bold 20px Georgia";
      c.textAlign = "center";
      c.fillText("HAY MONTH", w / 2, 126);
      c.font = "13px Georgia";
      for (let row = 0; row < 5; row++)
        for (let col = 0; col < 7; col++) {
          const n = row * 7 + col + 1;
          if (n <= 30) c.fillText(String(n), 18 + col * 24, 150 + row * 19);
        }
    });
    picture(calendar, -5.48, 1.55, -3.8, 0.26, 0.34, Math.PI / 2, M.oak);
    const wallClock = group(-1.565, 2.05, -2.6, -Math.PI / 2);
    const rim = cyl(M.black, 0, 0, -0.012, 0.14, 0.024, 0.14, wallClock, 18);
    rim.rotation.x = Math.PI / 2;
    const face = sheet.cell(120, 120, (c, w, h) => {
      c.fillStyle = "#f4efdf";
      c.fillRect(0, 0, w, h);
      c.strokeStyle = "#332";
      c.lineWidth = 3;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        c.beginPath();
        c.moveTo(60 + Math.cos(a) * 50, 60 + Math.sin(a) * 50);
        c.lineTo(60 + Math.cos(a) * 56, 60 + Math.sin(a) * 56);
        c.stroke();
      }
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(60, 60);
      c.lineTo(60, 24);
      c.moveTo(60, 60);
      c.lineTo(84, 74);
      c.stroke();
    });
    sheetPlane(face, 0, 0, 0.002, 0.24, 0.24, 0, wallClock);
    // The broom, a hen-shaped egg-timer and Thimble's dish.
    const corner = group(-1.72, 0, -4.62, 0);
    beam(M.pine, [0, 0.12, 0], [0.03, 1.42, 0.04], 0.022, corner);
    for (let i = -3; i <= 3; i++) beam(mat("#b79b57", 0.95), [0, 0.14, 0], [i * 0.035, 0, -0.01], 0.012, corner);
    const dish = group(-2.0, 0, -0.32, 0);
    cyl(M.willow, 0, 0.02, 0, 0.09, 0.035, 0.1, dish, 12);
    cyl(mat("#c2a06c", 0.7), 0, 0.04, 0, 0.08, 0.003, 0.08, dish, 12);
    const nameplate = lettered(sheet, 110, 30, "#5f82ad", "#f6f4ec", [["THIMBLE", 20, 0.56]]);
    const namePlane = sheetPlane(nameplate, 0, 0.022, 0.1, 0.1, 0.03, 0, dish);
    namePlane.rotation.x = -0.3;
  }
  return { parts: P, pan };
}

// -------------------------------------------------------------------- the sitting room
export function buildSitting(M, sheet) {
  const P = createParts("sitting", M, sheet);
  const { box, cyl, dot, orb, group, torus, mat, chair, armchair, bookcase, bookRow, picture, sheetPlane, potPlant, rug, logs, cup, keep, range, random, beam, kit } = P;

  rug(3.5, -0.05, 2.5, 2.1, M.turkeyRug);
  rug(3.55, 3.75, 1.9, 1.5, M.blueRug);

  // The fireplace: oak mantel, green slips and a blackened basket.
  const fire = { flames: [] };
  {
    const face = G.breast.z + G.breast.d / 2,
      cx = G.breast.x,
      g = group(cx, 0, face, 0);
    // Tile slips and a timber surround.
    const tile = sheet.cell(96, 96, (c, w, h) => {
      c.fillStyle = "#4f7363";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#6c8f7d";
      c.beginPath();
      c.moveTo(w / 2, 8);
      c.quadraticCurveTo(w - 10, h / 2, w / 2, h - 8);
      c.quadraticCurveTo(10, h / 2, w / 2, 8);
      c.fill();
      c.strokeStyle = "rgba(25,40,35,0.8)";
      c.strokeRect(1, 1, w - 2, h - 2);
    });
    for (let i = 0; i < 7; i++)
      for (const s of [-1, 1]) sheetPlane(tile, s * 0.56, 0.06 + i * 0.13, 0.008, 0.125, 0.125, 0, g);
    for (let i = 0; i < 9; i++) sheetPlane(tile, -0.5 + i * 0.125, 0.98, 0.008, 0.125, 0.125, 0, g);
    for (const s of [-1, 1]) {
      box(M.oak, s * 0.74, 0.54, 0.03, 0.2, 1.08, 0.06, 0.006, g);
      box(M.darkOak, s * 0.74, 1.1, 0.05, 0.23, 0.06, 0.1, 0.006, g);
    }
    box(M.oak, 0, 1.1, 0.03, 1.28, 0.1, 0.06, 0.006, g);
    box(M.darkOak, 0, 1.19, 0.08, 1.92, 0.05, 0.3, 0.008, g);
    box(M.oak, 0, 1.155, 0.04, 1.72, 0.03, 0.14, 0, g);
    // The hearth stone before it.
    const hearth = box(mat("#7e7566", 0.82), 0, 0.012, 0.3, 1.66, 0.024, 0.6, 0.004, g);
    hearth.castShadow = false;
    // Fender, fire irons and the log basket.
    box(M.brass, 0, 0.09, 0.56, 1.4, 0.03, 0.02, 0, g);
    box(M.brass, 0, 0.02, 0.56, 1.4, 0.03, 0.03, 0, g);
    for (const s of [-1, 1]) {
      box(M.brass, s * 0.7, 0.05, 0.3, 0.03, 0.09, 0.52, 0, g);
      dot(M.brass, s * 0.7, 0.13, 0.56, 0.028, 0.028, 0.028, g);
    }
    const irons = group(-0.86, 0, 0.32, 0, g);
    cyl(M.brass, 0, 0.012, 0, 0.09, 0.02, 0.09, irons, 12);
    cyl(M.brass, 0, 0.4, 0, 0.008, 0.76, 0.008, irons, 6);
    for (const [a, b] of [[-0.05, 0.03], [0.05, 0.03], [0, -0.05]]) {
      cyl(M.iron, a, 0.32, b, 0.006, 0.6, 0.006, irons, 6);
      dot(M.brass, a, 0.64, b, 0.016, 0.016, 0.016, irons);
    }
    box(M.iron, -0.05, 0.05, 0.03, 0.06, 0.08, 0.01, 0, irons);
    const basket = group(0.95, 0, 0.26, 0, g);
    box(mat("#8d6a3c", 0.95), 0, 0.14, 0, 0.42, 0.28, 0.3, 0.018, basket);
    logs(0, 0.26, 0, 3, basket);
    // Coals and logs in the grate; the flames stay out of the bake.
    const inside = group(cx, 0, face - 0.28, 0);
    box(M.iron, 0, 0.18, 0, 0.56, 0.018, 0.22, 0, inside);
    for (let i = 0; i < 6; i++) box(M.iron, -0.25 + i * 0.1, 0.18, 0.1, 0.012, 0.18, 0.012, 0, inside);
    for (const s of [-1, 1]) box(M.iron, s * 0.26, 0.09, 0.1, 0.02, 0.18, 0.02, 0, inside);
    for (let i = 0; i < 14; i++) dot(M.ember, range(-0.22, 0.22), 0.21 + random() * 0.03, range(-0.08, 0.08), range(0.03, 0.05), range(0.018, 0.03), range(0.025, 0.04), inside);
    logs(0, 0.2, 0, 3, inside);
    const flames = group(cx, 0.24, face - 0.26, 0);
    keep.add(flames);
    // A teardrop turned on a lathe, its foot at the group's height.
    const lick = new T.LatheGeometry(
      [[0, 0], [0.5, 0.1], [0.72, 0.26], [0.6, 0.48], [0.34, 0.72], [0.1, 0.92], [0, 1]].map(([r, y]) => new T.Vector2(r, y)),
      7,
    );
    for (let i = 0; i < 8; i++) {
      const x = -0.19 + (i / 7) * 0.38,
        core = i % 2 === 1,
        tall = core ? 0.16 : 0.2 + (i % 3) * 0.05;
      const f = kit.mesh(lick, core ? M.flameCore : M.flame, x, 0, core ? 0.05 : -0.02, flames);
      f.scale.set(core ? 0.05 : 0.08, tall, core ? 0.05 : 0.07);
      f.castShadow = f.receiveShadow = false;
      fire.flames.push({ mesh: f, x, phase: i * 1.7, wide: core ? 0.05 : 0.08, tall });
    }
    // On the mantel: a carriage clock, china dogs, candlesticks and the invitations.
    const top = 1.215;
    const carriage = group(0, top, 0.09, 0, g);
    box(M.brass, 0, 0.08, 0, 0.12, 0.16, 0.07, 0.004, carriage);
    box(M.ivory, 0, 0.085, 0.037, 0.09, 0.1, 0.002, 0, carriage);
    box(M.brass, 0, 0.18, 0, 0.04, 0.03, 0.02, 0, carriage);
    const dog = (x, turn) => {
      const d = group(x, top, 0.08, turn, g);
      box(mat("#b4542e", 0.3), 0, 0.012, 0, 0.1, 0.02, 0.06, 0, d);
      orb(M.china, 0, 0.08, 0, 0.036, 0.058, 0.03, d);
      orb(M.china, 0, 0.15, 0.005, 0.03, 0.03, 0.028, d);
      orb(mat("#b4542e", 0.3), s_(x) * 0.024, 0.14, 0.008, 0.012, 0.024, 0.01, d);
      orb(mat("#b4542e", 0.3), -s_(x) * 0.024, 0.14, 0.008, 0.012, 0.024, 0.01, d);
      torus(M.brass, 0, 0.115, 0.002, 0.018, 0.0035, d).rotation.x = Math.PI / 2;
    };
    const s_ = (x) => Math.sign(x) || 1;
    dog(-0.66, 0.35);
    dog(0.66, -0.35);
    for (const x of [-0.36, 0.36]) {
      cyl(M.brass, x, top + 0.012, 0.09, 0.05, 0.02, 0.05, g, 12);
      cyl(M.brass, x, top + 0.09, 0.09, 0.012, 0.16, 0.012, g, 7);
      cyl(M.ivory, x, top + 0.23, 0.09, 0.013, 0.14, 0.013, g, 7);
    }
    for (const [x, tone] of [[0.16, "#e5d6ae"], [0.22, "#cfdcdf"], [0.27, "#e6c9c0"]]) {
      const card = box(mat(tone, 0.7), x, top + 0.05, 0.1 - (x - 0.2), 0.085, 0.1, 0.002, 0, g);
      card.rotation.x = -0.1;
    }
    // A gilt mirror over all of it.
    const mirror = group(0, 1.76, 0.015, 0, g);
    box(mat("#b8913f", 0.38, 0.7), 0, 0, 0, 1.3, 0.74, 0.04, 0.012, mirror);
    P.mirrorGlass(0, 0, 0.0215, 1.16, 0.6, 0, mirror);
    for (const a of [-1, 1]) for (const b of [-1, 1]) dot(mat("#b8913f", 0.38, 0.7), (a * 1.3) / 2, (b * 0.74) / 2, 0.022, 0.03, 0.03, 0.015, mirror);
  }
  fire.at = [G.breast.x, 0.5, G.breast.z + G.breast.d / 2 - 0.2];

  // Wing chairs drawn up to the fire, a throw and a footstool.
  const facingFire = 2.33;
  armchair(G.chairWest.x, G.chairWest.z, facingFire, M.chintz, M.sageVelvet);
  armchair(G.chairEast.x, G.chairEast.z, -facingFire, M.chintz, M.sageVelvet);
  {
    const stool = group(4.2, 0, -0.74, 0.8);
    box(M.sageVelvet, 0, 0.26, 0, 0.42, 0.14, 0.3, 0.04, stool);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(M.darkOak, a * 0.17, 0.1, b * 0.11, 0.015, 0.2, 0.02, stool, 7);
    // A cushion and throw on the west chair.
    const throwOver = group(G.chairWest.x, 0, G.chairWest.z, facingFire);
    box(M.tartan, 0, 0.56, 0.12, 0.5, 0.012, 0.42, 0.004, throwOver);
    box(M.tartan, 0, 0.42, 0.33, 0.5, 0.32, 0.012, 0, throwOver);
    const cushion = box(M.velvet, 0, 0.62, -0.13, 0.36, 0.3, 0.1, 0.04, group(G.chairEast.x, 0, G.chairEast.z, -facingFire));
    cushion.rotation.x = -0.2;
  }
  // The sofa, with its back to the room and cushions to spare.
  {
    const s = G.sofa,
      g = group(s.x, 0, s.z, Math.PI),
      cover = M.velvet;
    box(cover, 0, 0.26, 0, s.w, 0.3, s.d, 0.04, g);
    box(cover, 0, 0.6, -s.d / 2 + 0.1, s.w, 0.56, 0.2, 0.05, g);
    for (const a of [-1, 1]) {
      box(cover, (a * (s.w - 0.14)) / 2, 0.44, 0.02, 0.17, 0.26, s.d - 0.02, 0.05, g);
      orb(cover, (a * (s.w - 0.14)) / 2, 0.58, s.d / 2 - 0.07, 0.09, 0.06, 0.06, g);
    }
    for (const a of [-1, 1]) box(cover, a * 0.3, 0.47, 0.08, 0.56, 0.11, 0.58, 0.05, g);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(M.darkOak, (a * (s.w - 0.1)) / 2, 0.055, (b * (s.d - 0.1)) / 2, 0.022, 0.11, 0.03, g, 7);
    for (const [x, m, turn] of [[-0.58, M.chintz, 0.12], [-0.2, M.sageVelvet, -0.05], [0.56, M.chintz, -0.12]]) {
      const c = box(m, x, 0.68, -0.14, 0.36, 0.34, 0.11, 0.04, g);
      c.rotation.x = -0.28;
      c.rotation.z = turn;
    }
    box(M.tartan, 0.42, 0.91, -0.35, 0.72, 0.016, 0.26, 0.004, g);
    box(M.tartan, 0.42, 0.72, -0.2, 0.72, 0.38, 0.012, 0, g);
  }
  // The low table: magazines, a mug gone cold and a pair of glasses.
  {
    const t = G.lowTable,
      g = group(t.x, 0, t.z, 0);
    box(M.walnut, 0, 0.4, 0, t.w, 0.024, t.d, 0.006, g);
    box(M.walnut, 0, 0.16, 0, t.w - 0.08, 0.016, t.d - 0.08, 0, g);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(M.walnut, (a * (t.w - 0.06)) / 2, 0.2, (b * (t.d - 0.06)) / 2, 0.014, 0.39, 0.016, g, 7);
    const magazines = ["#a65d4a", "#7f96a4", "#c9a144"];
    magazines.forEach((tone, i) => box(mat(tone, 0.5), -0.18 + i * 0.015, 0.416 + i * 0.006, i * 0.012, 0.21, 0.005, 0.28, 0, g));
    for (let i = 0; i < 4; i++) box(mat(i % 2 ? "#e6dcc0" : "#7a5a44", 0.72), 0.02 + i * 0.012, 0.19 + i * 0.012, 0.02, 0.26 - i * 0.02, 0.012, 0.2, 0, g);
    cup(0.22, 0.412, -0.04, 0.4, g);
    const specs = group(0.05, 0.415, 0.09, 0.3, g);
    for (const s of [-1, 1]) torus(M.black, s * 0.028, 0.005, 0, 0.022, 0.0025, specs).rotation.x = Math.PI / 2;
    box(M.black, 0, 0.005, 0, 0.012, 0.003, 0.003, 0, specs);
  }
  // Thimble: a tabby loaf of ginger cat with a white bib, asleep, breathing slowly.
  const thimble = {};
  {
    const t = G.thimble,
      g = group(t.x, 0.02, t.z, 0.5),
      ginger = mat("#cc8a48", 0.96),
      stripe = mat("#94602f", 0.96),
      white = mat("#f4efe2", 0.96),
      pink = mat("#d39a94", 0.7);
    keep.add(g);
    const body = group(0, 0, 0, 0, g);
    orb(ginger, 0, 0.095, 0, 0.15, 0.105, 0.21, body);
    // Her haunches, her bib, and two front paws tucked under her chin.
    for (const s of [-1, 1]) {
      orb(ginger, s * 0.095, 0.085, -0.1, 0.08, 0.085, 0.105, body);
      orb(white, s * 0.052, 0.03, 0.21, 0.036, 0.026, 0.062, body);
    }
    orb(white, 0, 0.075, 0.15, 0.09, 0.06, 0.07, body);
    // The tabby stripes across her back, and down each flank.
    for (let i = -3; i <= 3; i++) {
      const across = 0.092 - Math.abs(i) * 0.008;
      orb(stripe, 0, 0.192 - Math.abs(i) * 0.009, i * 0.052 - 0.02, across, 0.012, 0.015, body);
      if (i % 2 === 0)
        for (const s of [-1, 1]) {
          const flank = orb(stripe, s * 0.128, 0.11, i * 0.052 - 0.02, 0.022, 0.05, 0.012, body);
          flank.rotation.z = -s * 0.4;
        }
    }
    thimble.body = P.fuse(body);
    const head = group(0, 0.105, 0.225, 0.3, g);
    head.rotation.x = 0.22;
    orb(ginger, 0, 0, 0, 0.086, 0.072, 0.074, head);
    for (const s of [-1, 1]) {
      orb(white, s * 0.022, -0.028, 0.055, 0.028, 0.022, 0.024, head);
      const ear = kit.mesh(new T.ConeGeometry(0.036, 0.066, 5), ginger, s * 0.054, 0.072, -0.012, head);
      ear.rotation.z = -s * 0.24;
      const inner = kit.mesh(new T.ConeGeometry(0.018, 0.04, 5), pink, s * 0.054, 0.068, 0.004, head);
      inner.rotation.z = -s * 0.24;
      // Eyes shut, in a contented line.
      const eye = box(M.black, s * 0.034, 0.01, 0.067, 0.03, 0.004, 0.002, 0, head);
      eye.rotation.z = s * 0.16;
    }
    dot(pink, 0, -0.012, 0.078, 0.008, 0.006, 0.004, head);
    for (const x of [-0.016, 0, 0.016]) orb(stripe, x, 0.056, 0.03, 0.005, 0.016, 0.026, head);
    thimble.head = P.fuse(head);
    // The tail wraps round her, its tip white.
    const tail = group(0.09, 0.04, -0.2, 0, g);
    beam(ginger, [0, 0, 0], [0.1, 0, 0.06], 0.036, tail);
    beam(ginger, [0.1, 0, 0.06], [0.15, 0, 0.17], 0.032, tail);
    beam(stripe, [0.15, 0, 0.17], [0.16, 0, 0.24], 0.03, tail);
    beam(white, [0.16, 0, 0.24], [0.15, 0, 0.3], 0.028, tail);
    thimble.tail = P.fuse(tail);
  }
  // The upright piano, against the hall wall.
  {
    const p = G.piano,
      g = group(p.x, 0, p.z, Math.PI / 2),
      w = p.d,
      deep = p.w,
      wood = M.walnut;
    box(wood, 0, 0.66, -0.04, w, 1.26, deep - 0.08, 0.008, g);
    box(wood, 0, 1.31, -0.05, w + 0.06, 0.04, deep - 0.02, 0.008, g);
    box(wood, 0, 0.36, 0.03, w - 0.05, 0.62, deep - 0.08, 0, g);
    box(wood, 0, 0.72, 0.13, w, 0.05, 0.3, 0.008, g);
    // The keys, set in a slight recess.
    box(M.white, 0, 0.752, 0.17, w - 0.14, 0.014, 0.17, 0, g);
    const n = 52;
    for (let i = 0; i < n; i++) {
      const x = (-0.5 + i / n) * (w - 0.14);
      box(mat("#b9b6a8", 0.6), x, 0.76, 0.18, 0.0015, 0.002, 0.14, 0, g);
      if (i % 7 !== 2 && i % 7 !== 6) box(M.black, x + (w - 0.14) / n / 2, 0.767, 0.135, 0.012, 0.014, 0.1, 0, g);
    }
    box(wood, 0, 0.81, 0.08, w, 0.09, 0.02, 0, g);
    // Panel, candle sconces and the music desk.
    box(M.mahogany, 0, 1.0, 0.075, w - 0.18, 0.5, 0.012, 0, g);
    for (const s of [-1, 1]) {
      box(M.brass, s * (w / 2 - 0.1), 1.08, 0.12, 0.012, 0.012, 0.12, 0, g);
      cyl(M.brass, s * (w / 2 - 0.1), 1.09, 0.16, 0.035, 0.012, 0.035, g, 9);
      cyl(M.ivory, s * (w / 2 - 0.1), 1.17, 0.16, 0.012, 0.14, 0.012, g, 7);
      box(wood, s * (w / 2 - 0.04), 0.5, 0.15, 0.08, 0.5, 0.05, 0, g);
    }
    const music = sheet.cell(260, 180, (c, cw, ch) => {
      c.fillStyle = "#f2ead6";
      c.fillRect(0, 0, cw, ch);
      c.fillStyle = "#332";
      c.font = "italic 15px Georgia";
      c.textAlign = "center";
      c.fillText("Hymn 212", cw / 2, 18);
      c.strokeStyle = "#332";
      for (let s = 0; s < 3; s++)
        for (let l = 0; l < 5; l++) {
          c.beginPath();
          c.moveTo(12, 34 + s * 46 + l * 5);
          c.lineTo(cw - 12, 34 + s * 46 + l * 5);
          c.stroke();
        }
      for (let i = 0; i < 30; i++) {
        c.beginPath();
        c.arc(18 + i * 8, 40 + (i % 3) * 46 + Math.sin(i) * 7, 2.2, 0, Math.PI * 2);
        c.fill();
      }
    });
    const sheetMusic = sheetPlane(music, 0, 0.96, 0.095, 0.34, 0.24, 0, g);
    sheetMusic.rotation.x = -0.14;
    // On top: a metronome, a framed photograph and a fern.
    const metronome = kit.mesh(new T.ConeGeometry(0.05, 0.2, 4), M.mahogany, -0.46, 1.43, -0.05, g);
    metronome.rotation.y = Math.PI / 4;
    const photo = sheet.cell(100, 130, (c, cw, ch) => {
      c.fillStyle = "#d3c7a5";
      c.fillRect(0, 0, cw, ch);
      c.fillStyle = "#70604a";
      c.beginPath();
      c.arc(cw / 2, 56, 18, 0, Math.PI * 2);
      c.fill();
      c.fillRect(cw / 2 - 26, 76, 52, 54);
    });
    const frameGroup = group(0.16, 1.45, -0.04, -0.2, g);
    box(M.silver, 0, 0, -0.006, 0.14, 0.18, 0.012, 0, frameGroup);
    sheetPlane(photo, 0, 0, 0.002, 0.11, 0.15, 0, frameGroup);
    potPlant(0.5, 1.33, -0.06, 0.09, 9, g, M.china);
    // A round stool, with a sagging velvet top.
    const st = G.stool;
    const stool = group(st.x, 0, st.z);
    cyl(M.walnut, 0, 0.22, 0, 0.03, 0.42, 0.03, stool, 8);
    cyl(M.walnut, 0, 0.03, 0, 0.17, 0.05, 0.12, stool, 12);
    cyl(M.sageVelvet, 0, 0.45, 0, 0.16, 0.06, 0.17, stool, 16);
  }
  // Shelves in the alcoves each side of the chimney. West: books. East: games
  // and the wireless.
  {
    const west = G.shelvesWest,
      e = G.shelvesEast;
    bookcase(west.x, west.z, 0, west.w, ceiling - 0.2, west.d, 6, M.walnut);
    const { g, levels } = bookcase(e.x, e.z, 0, e.w, ceiling - 0.2, e.d, 6, M.walnut, P.base, false);
    bookRow(0, levels[0], 0.01, e.w - 0.12, 0.26, 0, g);
    bookRow(0, levels[1], 0.01, e.w - 0.14, 0.24, 0, g);
    // Board games, stacked.
    const games = ["#b65a52", "#3f5570", "#c9a144", "#4e6a4f", "#e5d5a6"];
    let y = levels[2];
    games.forEach((tone, i) => {
      box(mat(tone, 0.7), range(-0.04, 0.04), y + 0.02, 0.02, 0.56 - (i % 2) * 0.08, 0.04, 0.26, 0, g);
      y += 0.041;
    });
    // The wireless: a walnut arch with a cloth grille and a lit dial.
    const w = group(0, levels[3], 0.04, 0, g);
    box(M.walnut, 0, 0.14, 0, 0.42, 0.28, 0.22, 0.02, w);
    box(mat("#a8926b", 0.98), -0.06, 0.15, 0.112, 0.24, 0.2, 0.004, 0, w);
    for (let i = 0; i < 4; i++) box(M.walnut, -0.06, 0.08 + i * 0.05, 0.116, 0.24, 0.008, 0.004, 0, w);
    const dial = cyl(M.bulb, 0.14, 0.17, 0.112, 0.04, 0.008, 0.04, w, 14);
    dial.rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) {
      const knob = cyl(M.black, 0.14 + s * 0.04, 0.06, 0.116, 0.016, 0.018, 0.016, w, 9);
      knob.rotation.x = Math.PI / 2;
    }
    bookRow(0, levels[4], 0.01, e.w - 0.14, 0.24, 0, g);
    box(M.ivory, 0.2, levels[5] + 0.08, 0, 0.14, 0.15, 0.08, 0, g);
    cyl(M.willow, -0.12, levels[5] + 0.08, 0, 0.05, 0.15, 0.06, g, 10);
  }
  // A window seat in the east window, with a bolster and a pile of cushions.
  {
    const s = G.windowSeat,
      g = group(s.x, 0, s.z, -Math.PI / 2);
    box(M.creamBoards, 0, 0.21, 0.02, s.d, 0.42, s.w - 0.02, 0, g);
    box(M.chintz, 0, 0.46, 0.02, s.d, 0.09, s.w, 0.03, g);
    for (const a of [-1, 1]) {
      const b = cyl(M.sageVelvet, (a * (s.d - 0.2)) / 2, 0.56, -0.04, 0.09, 0.3, 0.09, g, 12);
      b.rotation.x = Math.PI / 2;
    }
    for (const [x, m, t] of [[-0.3, M.velvet, 0.2], [0.34, M.tartan, -0.14]]) {
      const c = box(m, x, 0.66, -0.12, 0.3, 0.3, 0.1, 0.035, g);
      c.rotation.x = -0.32;
      c.rotation.z = t;
    }
    const open = group(0.05, 0.51, 0.08, 0.2, g);
    box(mat("#3f5a70", 0.7), 0, 0.006, 0, 0.26, 0.01, 0.18, 0, open);
    box(M.ivory, 0, 0.016, 0, 0.24, 0.012, 0.16, 0, open);
  }
  // A standard lamp, and the tall bookcase on the east wall.
  {
    const l = G.lamp;
    const g = group(l.x, 0, l.z);
    cyl(M.brass, 0, 0.02, 0, 0.15, 0.03, 0.17, g, 14);
    cyl(M.brass, 0, 0.74, 0, 0.014, 1.44, 0.018, g, 8);
    dot(M.brass, 0, 0.42, 0, 0.03, 0.03, 0.03, g);
    const shadeMesh = kit.mesh(new T.CylinderGeometry(0.15, 0.27, 0.3, 18, 1, true), M.redShade, 0, 1.58, 0, g);
    shadeMesh.castShadow = false;
    for (let i = 0; i < 16; i++) dot(M.butter, Math.cos(i * 0.39) * 0.272, 1.42, Math.sin(i * 0.39) * 0.272, 0.009, 0.015, 0.009, g);
    const b = G.bookcase;
    const { g: cg, levels } = bookcase(b.x, b.z, -Math.PI / 2, b.d, 2.0, b.w, 5, M.darkOak);
    box(mat("#b65a52", 0.6), -0.55, levels[1] + 0.09, 0.03, 0.2, 0.16, 0.14, 0, cg);
    cyl(M.willow, -0.3, levels[3] + 0.1, 0, 0.05, 0.18, 0.05, cg, 11);
    potPlant(0.56, 2.04, 0.02, 0.1, 10, cg, M.rust);
  }
  // The jigsaw table in the front window, with its seats and a Swiss lake.
  {
    const j = G.jigsaw,
      h = 0.72,
      g = group(j.x, 0, j.z);
    cyl(M.walnut, 0, h / 2, 0, 0.038, h, 0.05, g, 10);
    cyl(M.walnut, 0, 0.03, 0, 0.26, 0.05, 0.12, g, 14);
    for (const a of [0.8, 2.9, 5]) box(M.walnut, Math.cos(a) * 0.15, 0.06, Math.sin(a) * 0.15, 0.3, 0.05, 0.06, 0, g).rotation.y = -a;
    cyl(M.walnut, 0, h - 0.012, 0, j.r, 0.024, j.r, g, 28);
    const lake = sheet.cell(380, 280, (c, w, hh) => {
      const sky = c.createLinearGradient(0, 0, 0, hh * 0.5);
      sky.addColorStop(0, "#a9cce2");
      sky.addColorStop(1, "#eef4f4");
      c.fillStyle = sky;
      c.fillRect(0, 0, w, hh);
      c.fillStyle = "#7d8fa3";
      c.beginPath();
      c.moveTo(0, 130);
      for (let i = 0; i < 8; i++) c.lineTo(i * 55 + 26, 50 + (i * 73) % 60), c.lineTo(i * 55 + 54, 120);
      c.lineTo(w, 150);
      c.lineTo(0, 150);
      c.fill();
      c.fillStyle = "#f4f4f0";
      for (let i = 0; i < 8; i++) {
        c.beginPath();
        c.moveTo(i * 55 + 12, 96);
        c.lineTo(i * 55 + 26, 50 + (i * 73) % 60);
        c.lineTo(i * 55 + 40, 96);
        c.fill();
      }
      c.fillStyle = "#5e8f6a";
      c.fillRect(0, 150, w, 30);
      c.fillStyle = "#6fa6c5";
      c.fillRect(0, 180, w, hh - 180);
      // The part nobody has done yet: bare board where the pieces are missing.
      c.fillStyle = "#6e3e29";
      c.fillRect(250, 0, 130, hh);
      c.fillRect(150, 0, 110, 70);
      c.fillRect(190, 200, 60, 80);
      c.strokeStyle = "rgba(35,25,20,0.3)";
      c.lineWidth = 1;
      for (let x = 0; x < 250; x += 20)
        for (let y = 0; y < hh; y += 20) {
          c.strokeRect(x, y, 20, 20);
        }
    });
    const puzzle = sheetPlane(lake, 0.02, h + 0.002, 0, 0.74, 0.54, 0, g);
    puzzle.rotation.x = -Math.PI / 2;
    // A drift of loose pieces and the box lid.
    const tones = ["#6fa6c5", "#5e8f6a", "#7d8fa3", "#f4f4f0", "#a9cce2"];
    for (let i = 0; i < 28; i++) {
      const a = random() * Math.PI * 2,
        rr = 0.14 + random() * 0.26;
      const piece = box(mat(tones[i % tones.length], 0.7), 0.14 + Math.cos(a) * rr * 0.55, h + 0.004, Math.sin(a) * rr, 0.024, 0.004, 0.024, 0, g);
      piece.rotation.y = random() * 3;
    }
    box(mat("#3f5a70", 0.7), -0.26, h + 0.016, 0.33, 0.22, 0.03, 0.16, 0, g).rotation.y = 0.5;
    for (const c of JIGSAW_CHAIRS) chair(c.x, c.z, c.faces, { wood: M.walnut, seat: M.sageVelvet });
  }
  // Pictures, a drinks tray and a pot of ferns round the room.
  {
    picture(sheet.cell(220, 150, landscape("#c9d9d8", "#8b9f76", "#6c8a5a", houseOnHill)), 1.98, 1.66, 4.78, 0.5, 0.34, Math.PI, M.oak);
    picture(sheet.cell(180, 230, botanical("#b98ec2", "#e8dfc2")), 1.565, 1.7, -0.92, 0.32, 0.42, Math.PI / 2, M.oak);
    picture(sheet.cell(180, 140, landscape("#d9c9ad", "#a98f6e", "#7f8f58")), 5.48, 1.72, -0.35, 0.44, 0.32, -Math.PI / 2, M.darkOak);
    // A butler's tray by the east chair: sherry, three little glasses and a bell.
    const t = group(5.2, 0, -0.6);
    box(M.mahogany, 0, 0.62, 0, 0.42, 0.018, 0.34, 0.004, t);
    for (const a of [-1, 1]) for (const b of [-1, 1]) beam(M.mahogany, [a * 0.18, 0.61, b * 0.14], [a * 0.15, 0, -b * 0.12], 0.016, t);
    cyl(mat("#7a3a18", 0.14), -0.06, 0.74, 0.02, 0.05, 0.2, 0.024, t, 10);
    dot(mat("#d9c9a0", 0.15), -0.06, 0.87, 0.02, 0.02, 0.022, 0.02, t);
    for (const [x, z] of [[0.08, -0.08], [0.12, 0.04], [0.02, 0.1]]) {
      cyl(mat("#c0d2cf", 0.14), x, 0.645, z, 0.018, 0.012, 0.02, t, 7);
      cyl(mat("#c0d2cf", 0.14), x, 0.675, z, 0.016, 0.04, 0.02, t, 7);
    }
    potPlant(1.8, 0, 3.9, 0.22, 11, P.base, mat("#536c6c", 0.28));
  }
  return { parts: P, fire, thimble };
}
