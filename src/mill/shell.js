import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { MILL as K, middle } from "./layout.js";

export const VIEW_DAY = new T.Color(1.1, 1.1, 1.06),
  VIEW_NIGHT = new T.Color(0.16, 0.2, 0.36);

// The building's fabric: the flagged floor and the wheel pit sunk in it, thick
// limewashed walls with deep reveals for the windows, the loft's boards and
// joists overhead with the hoist's trapdoors, the front and back doors, every
// window, the painted views out of them, and, outside the west window, the
// wheel itself in its race. Returns what moves and what the hour changes.
export function buildShell(parts, surfaces, keep) {
  const { b, rb, tiled, cyl, orb, rod, mesh, group, range, random, mergeGroup, root } = parts;
  const { M, paint, shade } = surfaces;
  const H = K.ceiling,
    W = K.halfW,
    t = K.wall,
    P = K.pit;
  const panes = [];

  // ------------------------------------------------------------------ floors
  // Flags everywhere but the pit, which drops away by the west wall.
  const floor = (minX, maxX, minZ, maxZ) => {
    const f = tiled(M.floor, (minX + maxX) / 2, -0.05, (minZ + maxZ) / 2, maxX - minX, 0.1, maxZ - minZ, 2.4);
    f.castShadow = false;
  };
  floor(P.maxX, W, K.back, K.front);
  floor(-W, P.maxX, K.back, P.minZ);
  floor(-W, P.maxX, P.maxZ, K.front);
  // The pit: stone sides, and a dark puddle where the wheel drips.
  const pitY = -P.depth;
  tiled(M.stone, P.maxX - 0.06, pitY / 2, (P.minZ + P.maxZ) / 2, 0.12, P.depth, P.maxZ - P.minZ, 1.2).castShadow = false;
  for (const z of [P.minZ + 0.06, P.maxZ - 0.06]) tiled(M.stone, (P.minX + P.maxX) / 2, pitY / 2, z, P.maxX - P.minX, P.depth, 0.12, 1.2).castShadow = false;
  b(M.slate, (P.minX + P.maxX) / 2, pitY, (P.minZ + P.maxZ) / 2, P.maxX - P.minX, 0.04, P.maxZ - P.minZ).castShadow = false;
  const puddle = mesh(new T.CircleGeometry(0.7, 24), M.water, K.pitWheel.x, pitY + 0.03, K.axle.z);
  puddle.rotation.x = -Math.PI / 2;
  puddle.castShadow = puddle.receiveShadow = false;
  // A worn oak kerb round the pit's lip, and the rails along it.
  rb(M.oak, P.maxX - 0.06, 0.03, (P.minZ + P.maxZ) / 2, 0.16, 0.06, P.maxZ - P.minZ, 0.01);
  for (const z of [P.minZ + 0.06, P.maxZ - 0.06]) rb(M.oak, (P.minX + P.maxX) / 2, 0.03, z, P.maxX - P.minX, 0.06, 0.16, 0.01);
  const railX = P.maxX - 0.08,
    posts = [];
  for (let z = P.minZ + 0.08; z <= P.maxZ - 0.07; z += (P.maxZ - P.minZ - 0.16) / 4) posts.push([railX, z]);
  for (const z of [P.minZ + 0.08, P.maxZ - 0.08]) posts.push([-W + 0.15, z], [(P.minX + railX) / 2, z]);
  for (const [x, z] of posts) b(M.timber, x, 0.6, z, 0.1, 1.2, 0.1);
  for (const y of [0.62, 1.15]) {
    b(M.timber, railX, y, (P.minZ + P.maxZ) / 2, 0.07, 0.08, P.maxZ - P.minZ - 0.1);
    for (const z of [P.minZ + 0.08, P.maxZ - 0.08]) b(M.timber, (-W + railX) / 2, y, z, railX + W - 0.1, 0.08, 0.07);
  }

  // ------------------------------------------------------------------- walls
  // A run of wall along one axis, with its openings left open.
  function wall(axis, at, from, to, openings) {
    const piece = (a, c, bottom, top) => {
      if (c - a < 0.001 || top - bottom < 0.001) return;
      const mid = (a + c) / 2,
        cy = (bottom + top) / 2;
      if (axis === "x") tiled(M.limewash, mid, cy, at, c - a, top - bottom, t, 2.0);
      else tiled(M.limewash, at, cy, mid, t, top - bottom, c - a, 2.0);
    };
    let cursor = from;
    for (const { span, rise } of openings) {
      piece(cursor, span[0], 0, H);
      piece(span[0], span[1], 0, rise[0]);
      piece(span[0], span[1], rise[1], H);
      cursor = span[1];
    }
    piece(cursor, to, 0, H);
  }
  const front = K.front + t / 2,
    back = K.back - t / 2,
    side = W + t / 2;
  const [fw, fe] = K.frontWindows;
  wall("x", front, -W - t, W + t, [
    { span: fw.x, rise: fw.y },
    { span: K.door.x, rise: K.door.y },
    { span: fe.x, rise: fe.y },
  ]);
  wall("x", back, -W - t, W + t, [
    { span: K.backWindow.x, rise: K.backWindow.y },
    { span: K.backDoor.x, rise: K.backDoor.y },
  ]);
  wall("z", side, K.back, K.front, [{ span: K.eastWindow.z, rise: K.eastWindow.y }]);
  // The west wall runs down into the pit, with the axle's hole through it.
  wall("z", -side, K.back, K.front, [{ span: K.westWindow.z, rise: K.westWindow.y }]);
  tiled(M.stone, -side, pitY / 2, (P.minZ + P.maxZ) / 2, t, P.depth, P.maxZ - P.minZ, 1.2).castShadow = false;
  // A tarred skirting along the foot of the walls, against the damp.
  for (const [axis, at, from, to, dir] of [
    ["x", K.front, -W, W, -1],
    ["x", K.back, -W, W, 1],
    ["z", W, K.back, K.front, -1],
    ["z", -W, K.back, P.minZ, 1],
    ["z", -W, P.maxZ, K.front, 1],
  ]) {
    const mid = (from + to) / 2;
    if (axis === "x") b(M.timberDark, mid, 0.12, at + dir * 0.012, to - from, 0.24, 0.024);
    else b(M.timberDark, at + dir * 0.012, 0.12, mid, 0.024, 0.24, to - from);
  }
  // Oak lintels over every opening, deep as the wall.
  const lintel = (axis, at, span, top) => {
    const w = span[1] - span[0] + 0.5;
    if (axis === "x") rb(M.beam, middle(span), top + 0.12, at, w, 0.24, t + 0.02, 0.02);
    else rb(M.beam, at, top + 0.12, middle(span), t + 0.02, 0.24, w, 0.02);
  };
  for (const o of [fw, fe, K.door]) lintel("x", front, o.x, o.y[1]);
  for (const o of [K.backWindow, K.backDoor]) lintel("x", back, o.x, o.y[1]);
  lintel("z", side, K.eastWindow.z, K.eastWindow.y[1]);
  lintel("z", -side, K.westWindow.z, K.westWindow.y[1]);

  // ----------------------------------------------------------------- ceiling
  // The loft's boards, with the hoist's trap left open through them.
  const tr = K.trap;
  const loft = (minX, maxX, minZ, maxZ) => {
    if (maxX - minX < 0.001 || maxZ - minZ < 0.001) return;
    tiled(M.loft, (minX + maxX) / 2, H + 0.06, (minZ + maxZ) / 2, maxX - minX, 0.12, maxZ - minZ, 1.2).castShadow = false;
  };
  loft(-W - t, tr.minX, K.back - t, K.front + t);
  loft(tr.maxX, W + t, K.back - t, K.front + t);
  loft(tr.minX, tr.maxX, K.back - t, tr.minZ);
  loft(tr.minX, tr.maxX, tr.maxZ, K.front + t);
  // Above the trap, the dark of the loft and a sack or two up there.
  b(M.timberDark, (tr.minX + tr.maxX) / 2, H + 1.4, (tr.minZ + tr.maxZ) / 2, tr.maxX - tr.minX + 0.6, 0.1, tr.maxZ - tr.minZ + 0.6);
  for (const [x, z] of [[tr.minX - 0.15, tr.minZ - 0.3], [tr.maxX + 0.2, tr.minZ - 0.1]])
    rb(M.sackPlain, x, H + 0.45, z, 0.6, 0.75, 0.45, 0.12);
  // Two summer beams along the room, one carrying the shaft's head, and joists across.
  for (const x of [K.shaft.x, 1.4]) rb(M.beam, x, H - 0.2, 0, 0.4, 0.4, 2 * W, 0.03).castShadow = false;
  for (let z = K.back + 0.35; z < K.front - 0.2; z += 0.62) {
    if (z > tr.minZ - 0.1 && z < tr.maxZ + 0.1) {
      rb(M.beam, (tr.maxX + W) / 2, H - 0.1, z, W - tr.maxX, 0.2, 0.16, 0.015).castShadow = false;
      rb(M.beam, (tr.minX - W) / 2, H - 0.1, z, tr.minX + W, 0.2, 0.16, 0.015).castShadow = false;
    } else rb(M.beam, 0, H - 0.1, z, 2 * W, 0.2, 0.16, 0.015).castShadow = false;
  }
  // Wall plates along the tops of the side walls.
  for (const sx of [-1, 1]) b(M.beam, sx * (W - 0.1), H - 0.14, 0, 0.2, 0.28, 2 * W);
  // The hoist's trapdoors: two flaps hinged on the trap's long sides, which the
  // sack knocks open going up and which fall shut behind it.
  const flaps = [-1, 1].map((sx) => {
    const hinge = group(sx < 0 ? tr.minX : tr.maxX, H, (tr.minZ + tr.maxZ) / 2);
    const w = (tr.maxX - tr.minX) / 2;
    b(M.oak, -sx * (w / 2), 0.02, 0, w - 0.02, 0.06, tr.maxZ - tr.minZ - 0.04, hinge);
    for (const z of [-0.35, 0.35]) b(M.iron, -sx * (w / 2), -0.015, z, w - 0.1, 0.02, 0.05, hinge);
    keep.add(hinge);
    return hinge;
  });
  for (const f of flaps) mergeGroup(f);
  // The trap's frame.
  for (const z of [tr.minZ, tr.maxZ]) b(M.oak, (tr.minX + tr.maxX) / 2, H - 0.05, z, tr.maxX - tr.minX + 0.1, 0.1, 0.1);

  // ----------------------------------------------------------------- windows
  /** Frame and glazing bars for an opening at the wall's outer face: `turn` looks its local +z into the room. */
  function casement(cx, cy, cz, w, h, turn, bars) {
    const g = group(cx, cy, cz, turn),
      frameW = 0.08;
    for (const sx of [-1, 1]) b(M.timber, (sx * (w - frameW)) / 2, 0, 0, frameW, h, 0.1, g);
    for (const sy of [-1, 1]) b(M.timber, 0, (sy * (h - frameW)) / 2, 0, w, frameW, 0.1, g);
    for (const x of bars.x ?? []) b(M.timber, x, 0, 0.02, 0.04, h, 0.05, g);
    for (const y of bars.y ?? []) b(M.timber, 0, y, 0.02, w, 0.04, 0.05, g);
    // A deep sill across the reveal, dusted with flour.
    rb(M.oak, 0, -h / 2 - 0.03, t / 2 + 0.02, w + 0.1, 0.06, t + 0.08, 0.012, g);
    const pane = new T.PlaneGeometry(w, h);
    pane.applyMatrix4(new T.Matrix4().compose(new T.Vector3(cx, cy, cz), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), turn), new T.Vector3(1, 1, 1)));
    panes.push(pane);
    return g;
  }
  const outerFront = K.front + t * 0.8,
    outerBack = K.back - t * 0.8,
    outerSide = W + t * 0.8;
  for (const o of [fw, fe]) casement(middle(o.x), middle(o.y), outerFront, o.x[1] - o.x[0], o.y[1] - o.y[0], Math.PI, { x: [0], y: [0.3] });
  casement(middle(K.backWindow.x), middle(K.backWindow.y), outerBack, K.backWindow.x[1] - K.backWindow.x[0], K.backWindow.y[1] - K.backWindow.y[0], 0, { x: [0], y: [0.25] });
  casement(outerSide, middle(K.eastWindow.y), middle(K.eastWindow.z), K.eastWindow.z[1] - K.eastWindow.z[0], K.eastWindow.y[1] - K.eastWindow.y[0], -Math.PI / 2, { x: [0], y: [0.3] });
  casement(-outerSide, middle(K.westWindow.y), middle(K.westWindow.z), K.westWindow.z[1] - K.westWindow.z[0], K.westWindow.y[1] - K.westWindow.y[0], Math.PI / 2, { y: [0.2] });
  // A jam jar of cornflowers on the green's sill, and a cobweb in the back window.
  {
    const x = middle(fw.x) + 0.5,
      y = fw.y[0] + 0.02,
      z = K.front + t / 2;
    cyl(M.glass, x, y + 0.1, z, 0.06, 0.2, 0.065, root, 12);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2,
        top = [x + Math.cos(a) * 0.09, y + 0.36 + range(0, 0.08), z + Math.sin(a) * 0.07];
      rod(M.timber, [x, y + 0.12, z], top, 0.005, 4);
      orb(parts.mat("#4f72c4", 0.8), ...top, 0.035);
    }
  }

  // ---------------------------------------------------------- the front door
  // A ledged and braced plank door, as the outside's, seen from within.
  const dw = K.door.x[1] - K.door.x[0],
    dh = K.door.y[1];
  const doorLeaf = group(0, 0, K.front + t * 0.6, Math.PI);
  for (let i = 0; i < 6; i++) {
    const plank = b(M.oak, -dw / 2 + (i + 0.5) * (dw / 6), dh / 2, 0, dw / 6 - 0.01, dh - 0.04, 0.06, doorLeaf);
    plank.castShadow = true;
  }
  // Inside is the leaf's +z.
  for (const y of [0.45, dh / 2, dh - 0.45]) b(M.timber, 0, y, 0.06, dw - 0.12, 0.16, 0.05, doorLeaf);
  for (const [y0, y1] of [[0.45, dh / 2], [dh / 2, dh - 0.45]]) {
    const brace = b(M.timber, 0, (y0 + y1) / 2, 0.06, 0.14, Math.hypot(dw - 0.3, y1 - y0), 0.045, doorLeaf);
    brace.rotation.z = Math.atan2(dw - 0.3, y1 - y0);
  }
  b(M.iron, 0.62, 1.55, 0.1, 0.3, 0.04, 0.03, doorLeaf);
  b(M.iron, 0.75, 1.55, 0.11, 0.04, 0.12, 0.04, doorLeaf);
  for (const y of [0.45, dh - 0.45]) b(M.ironDark, -dw / 2 + 0.3, y, 0.09, 0.55, 0.05, 0.02, doorLeaf);
  // Amos's note, pinned at eye height.
  const note = paint(256, 320, (c, w, h) => {
    c.fillStyle = "#f2ead2";
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "rgba(60,50,40,0.75)";
    c.lineWidth = 3;
    for (let i = 0; i < 7; i++) {
      c.beginPath();
      const y = 50 + i * 36;
      c.moveTo(24, y);
      for (let x = 24; x < w - 30; x += 18) c.lineTo(x + 18, y + range(-3, 3));
      c.stroke();
    }
  }, false);
  const noteCard = mesh(new T.PlaneGeometry(0.28, 0.35), new T.MeshStandardMaterial({ map: note, roughness: 0.9 }), -0.2, 2.25, 0.095, doorLeaf);
  noteCard.rotation.z = 0.05;
  noteCard.castShadow = false;
  for (const x of K.door.x) rb(M.beam, x, dh / 2, K.front - 0.03, 0.16, dh, 0.08, 0.012);
  rb(M.stone, 0, 0.015, K.front + t / 2, dw + 0.1, 0.03, t, 0.006).castShadow = false;
  // A worn coir mat inside the door.
  rb(parts.mat("#8a6a44", 1), 0, 0.012, K.front - 0.6, 1.5, 0.024, 0.8, 0.01).castShadow = false;

  // ----------------------------------------------------------- the back door
  const bd = K.backDoor,
    bdw = bd.x[1] - bd.x[0],
    bdh = bd.y[1],
    bdx = middle(bd.x);
  for (let i = 0; i < 6; i++) b(M.pine, bd.x[0] + (i + 0.5) * (bdw / 6), bdh / 2, K.back - t * 0.6, bdw / 6 - 0.01, bdh - 0.04, 0.06);
  for (const y of [0.5, bdh - 0.5]) b(M.timber, bdx, y, K.back - t * 0.6 + 0.06, bdw - 0.12, 0.16, 0.05);
  // Its bar, dropped into iron keepers either side.
  rb(M.oak, bdx, 1.5, K.back + 0.1, bdw + 0.5, 0.14, 0.1, 0.012);
  for (const x of [bd.x[0] - 0.15, bd.x[1] + 0.15]) b(M.iron, x, 1.5, K.back + 0.06, 0.08, 0.24, 0.14);
  for (const x of bd.x) rb(M.beam, x, bdh / 2, K.back + 0.03, 0.16, bdh, 0.08, 0.012);
  // A sack across the sill for the draught.
  const draught = cyl(M.sackPlain, bdx, 0.1, K.back + 0.16, 0.1, bdw - 0.1, 0.1, root, 10);
  draught.rotation.z = Math.PI / 2;

  // ----------------------------------------------------- the view out of doors
  // A painted card outside each window: never lit, a little over-bright so the
  // openings bloom, and tinted as the hour changes.
  const sky = (c, w, horizon) => {
    const g = c.createLinearGradient(0, 0, 0, horizon);
    g.addColorStop(0, "#79abcd");
    g.addColorStop(1, "#ece2c6");
    c.fillStyle = g;
    c.fillRect(0, 0, w, horizon);
    for (let i = 0; i < 10; i++) {
      const x = random() * w,
        y = random() * horizon * 0.7;
      c.fillStyle = "rgba(255,250,238,0.42)";
      for (let k = 0; k < 6; k++) {
        c.beginPath();
        c.ellipse(x + k * range(14, 26), y + range(-5, 5), range(18, 42), range(7, 15), 0, 0, Math.PI * 2);
        c.fill();
      }
    }
  };
  const treeLine = (c, w, y, tall, colour) => {
    for (let x = -20; x < w + 20; x += range(20, 46)) {
      const r = range(tall * 0.6, tall),
        cy = y - range(0, tall * 0.35);
      c.fillStyle = shade(colour, range(-0.3, -0.18));
      c.beginPath();
      c.ellipse(x, cy, r * 1.05, r, 0, 0, Math.PI * 2);
      c.fill();
      for (let k = 0; k < 12; k++) {
        const a = random() * Math.PI * 2,
          dd = Math.sqrt(random()) * r * 0.85,
          lit = 1 - (Math.sin(a) * dd) / r;
        c.fillStyle = shade(colour, -0.2 + lit * 0.2 + range(-0.05, 0.05));
        c.beginPath();
        c.arc(x + Math.cos(a) * dd - r * 0.08, cy + Math.sin(a) * dd - r * 0.1, r * range(0.16, 0.34), 0, Math.PI * 2);
        c.fill();
      }
    }
  };
  const willows = (c, w, y, n) => {
    for (let i = 0; i < n; i++) {
      const x = w * ((i + range(0.2, 0.8)) / n),
        top = y - range(110, 160);
      c.fillStyle = "#5c4a38";
      c.fillRect(x - 5, top + 40, 10, y - top - 40);
      for (let k = 0; k < 40; k++) {
        const fx = x + range(-70, 70);
        c.strokeStyle = shade("#8fae5f", range(-0.25, 0.1));
        c.lineWidth = range(3, 7);
        c.beginPath();
        c.moveTo(fx * 0.6 + x * 0.4, top + range(0, 30));
        c.quadraticCurveTo(fx, top + 40, fx + range(-6, 6), y - range(0, 40));
        c.stroke();
      }
    }
  };
  // South: the green, the fountain, and the bakery's roof beyond.
  const green = paint(1536, 768, (c, w, h) => {
    const horizon = h * 0.5;
    sky(c, w, horizon);
    treeLine(c, w, horizon + 4, 42, "#6b8f55");
    c.fillStyle = "#9a6b52";
    c.beginPath();
    c.moveTo(w * 0.15, horizon + 4);
    c.lineTo(w * 0.24, horizon - 70);
    c.lineTo(w * 0.33, horizon + 4);
    c.fill();
    c.fillStyle = "#e9e1cc";
    c.fillRect(w * 0.16, horizon, w * 0.16, 60);
    c.fillStyle = "#8fb35f";
    c.fillRect(0, horizon + 30, w, h);
    for (let i = 0; i < 2000; i++) {
      c.fillStyle = random() > 0.5 ? "rgba(255,250,210,0.12)" : "rgba(50,80,30,0.12)";
      c.fillRect(random() * w, horizon + 30 + random() * (h - horizon), range(2, 6), range(1, 3));
    }
    // The fountain, with its splash.
    const fx = w * 0.62,
      fy = horizon + 120;
    c.fillStyle = "#b9b2a2";
    c.beginPath();
    c.ellipse(fx, fy, 120, 26, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#6fa3b8";
    c.beginPath();
    c.ellipse(fx, fy - 4, 100, 18, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#c8c1b0";
    c.fillRect(fx - 10, fy - 70, 20, 66);
    c.fillStyle = "rgba(230,245,255,0.8)";
    for (let i = 0; i < 18; i++) {
      c.beginPath();
      c.arc(fx + range(-40, 40), fy - range(60, 100), range(4, 9), 0, Math.PI * 2);
      c.fill();
    }
    // A path across the grass toward the door.
    c.fillStyle = "#cdbb92";
    c.beginPath();
    c.moveTo(w * 0.42, h);
    c.lineTo(w * 0.5, horizon + 40);
    c.lineTo(w * 0.53, horizon + 40);
    c.lineTo(w * 0.62, h);
    c.fill();
  }, false);
  // East: the brook, the mill bridge, and the lane running off to the market.
  const bridge = paint(1024, 512, (c, w, h) => {
    const horizon = h * 0.52;
    sky(c, w, horizon);
    treeLine(c, w, horizon + 6, 36, "#5f8549");
    c.fillStyle = "#86a85c";
    c.fillRect(0, horizon + 10, w, h);
    c.fillStyle = "#6c9aa3";
    c.beginPath();
    c.moveTo(0, h * 0.7);
    c.quadraticCurveTo(w * 0.5, h * 0.62, w, h * 0.74);
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.fill();
    c.fillStyle = "#a59a86";
    c.beginPath();
    c.moveTo(w * 0.25, h * 0.66);
    c.quadraticCurveTo(w * 0.45, h * 0.52, w * 0.65, h * 0.66);
    c.lineTo(w * 0.65, h * 0.7);
    c.quadraticCurveTo(w * 0.45, h * 0.58, w * 0.25, h * 0.7);
    c.fill();
    c.fillStyle = "#cdbb92";
    c.fillRect(w * 0.6, h * 0.62, w * 0.4, 18);
  }, false);
  // West: the race below, and willows along the far bank.
  const brook = paint(1024, 512, (c, w, h) => {
    const horizon = h * 0.5;
    sky(c, w, horizon);
    treeLine(c, w, horizon + 6, 34, "#5f8549");
    c.fillStyle = "#86a85c";
    c.fillRect(0, horizon + 10, w, h);
    willows(c, w, h * 0.72, 4);
    c.fillStyle = "#5f8f96";
    c.fillRect(0, h * 0.74, w, h);
    for (let i = 0; i < 300; i++) {
      c.fillStyle = `rgba(255,255,255,${range(0.08, 0.3)})`;
      c.fillRect(random() * w, h * 0.74 + random() * h * 0.26, range(6, 30), 2);
    }
  }, false);
  // North: the meadow and the hills.
  const meadow = paint(1024, 512, (c, w, h) => {
    const horizon = h * 0.55;
    sky(c, w, horizon);
    c.fillStyle = "#9ab46a";
    c.beginPath();
    c.moveTo(0, horizon);
    c.bezierCurveTo(w * 0.3, horizon - 80, w * 0.6, horizon - 10, w, horizon - 60);
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.fill();
    treeLine(c, w, horizon + 20, 30, "#5f8549");
    c.fillStyle = "#b8b45e";
    c.fillRect(0, horizon + 40, w, h);
    for (let i = 0; i < 1500; i++) {
      c.fillStyle = random() > 0.5 ? "rgba(255,240,180,0.18)" : "rgba(80,90,30,0.14)";
      c.fillRect(random() * w, horizon + 40 + random() * h, range(1, 3), range(3, 9));
    }
  }, false);
  const views = [
    { map: green, x: 0, z: K.front + 9, turn: Math.PI, w: 30, h: 15, y: 2.4 },
    { map: bridge, x: W + 8, z: 0, turn: -Math.PI / 2, w: 20, h: 10, y: 2.6 },
    { map: brook, x: -W - 11, z: -2, turn: Math.PI / 2, w: 26, h: 13, y: 1.6 },
    { map: meadow, x: -0.5, z: K.back - 8, turn: 0, w: 22, h: 11, y: 2.4 },
  ];
  const viewMaterials = new Map();
  for (const view of views) {
    if (!viewMaterials.has(view.map))
      viewMaterials.set(view.map, new T.MeshBasicMaterial({ map: view.map, color: VIEW_DAY.clone() }));
    const card = mesh(new T.PlaneGeometry(view.w, view.h), viewMaterials.get(view.map), view.x, view.y, view.z);
    card.rotation.y = view.turn;
    card.castShadow = card.receiveShadow = false;
  }

  // ---------------------------------------- outside the west window: the wheel
  // The race runs along the wall below the window, and the wheel turns in it on
  // the same axle as the pit wheel indoors.
  const race = mesh(new T.PlaneGeometry(7, 22), M.water, -W - t - 3.5, -1.15, 0);
  race.rotation.x = -Math.PI / 2;
  race.castShadow = race.receiveShadow = false;
  tiled(M.stone, -W - t - 0.2, -0.6, 0, 0.4, 1.2, 22, 1.2).castShadow = false;
  const wheelX = -W - t - 1.25,
    wheelR = 3.0;
  const waterWheel = group(wheelX, K.axle.y, K.axle.z);
  const spin = group(0, 0, 0, 0, waterWheel);
  for (const x of [-0.42, 0.42]) {
    const ring = mesh(new T.TorusGeometry(wheelR - 0.05, 0.1, 6, 40), M.timberDark, x, 0, 0, spin);
    ring.rotation.y = Math.PI / 2;
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2,
      c = Math.cos(a),
      s = Math.sin(a);
    const paddle = b(M.timber, 0, s * wheelR, c * wheelR, 0.98, 0.45, 0.07, spin);
    paddle.rotation.x = Math.PI / 2 - a;
    if (i % 2 === 0) {
      for (const x of [-0.42, 0.42]) {
        const spoke = b(M.timberDark, x, (s * wheelR) / 2, (c * wheelR) / 2, 0.1, wheelR, 0.1, spin);
        spoke.rotation.x = Math.PI / 2 - a;
      }
    }
  }
  const hub = cyl(M.ironDark, 0, 0, 0, 0.3, 1.0, 0.3, spin, 16);
  hub.rotation.z = Math.PI / 2;
  // The axle, running in through the wall to the pit wheel.
  const axle = cyl(M.timberDark, (wheelX + K.pitWheel.x) / 2 - wheelX, 0, 0, 0.22, K.pitWheel.x - wheelX, 0.22, waterWheel, 10);
  axle.rotation.z = Math.PI / 2;
  keep.add(waterWheel);
  mergeGroup(spin);
  // Spray where the paddles meet the race.
  const spray = Array.from({ length: 14 }, () => ({ z: range(-1.6, 1.6), phase: random() }));

  // All the room's window glass, as one sheet that casts nothing.
  const glass = mesh(mergeGeometries(panes), M.glass);
  glass.castShadow = glass.receiveShadow = false;
  panes.forEach((g) => g.dispose());

  return { viewMaterials: [...viewMaterials.values()], flaps, wheel: spin, spray, wheelAt: { x: wheelX, y: K.axle.y, z: K.axle.z, r: wheelR } };
}
