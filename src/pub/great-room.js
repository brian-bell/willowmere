import * as T from "three";
import { GREAT_ROOM, PUB } from "./layout.js";
import { paintHeron, paintedMaterial } from "./parts.js";
import { createProps } from "./props.js";

// The ground floor: flagged floor, oak-framed ceiling with the well open above
// the long table, the great inglenook on the west wall, and the bar along the
// back under the loft's low beams.

const { halfW, halfD, wall, well, stair, hearth } = PUB;
const inX = halfW - wall;
const rearIn = -(halfD - wall);
const frontIn = halfD - wall;
const ceil = PUB.ceiling;

// The flame: three crossed sheets, each a noise-torn teardrop that rises.
function flameMaterial(uniforms) {
  return new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
    blending: T.AdditiveBlending,
    uniforms: { time: uniforms.time, seed: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float time;
      uniform float seed;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                   mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      float fbm(vec2 p) {
        return 0.55 * noise(p) + 0.3 * noise(p * 2.1) + 0.15 * noise(p * 4.3);
      }
      void main() {
        vec2 uv = vUv;
        float t = time * 1.5 + seed * 7.0;
        float torn = fbm(vec2(uv.x * 4.0 + seed * 3.0, uv.y * 2.8 - t * 1.6));
        float sway = (fbm(vec2(uv.y * 1.6 - t * 0.7, seed)) - 0.5) * uv.y * 0.55;
        float x = abs(uv.x - 0.5 + sway) * 2.0;
        float width = (1.0 - pow(uv.y, 1.35)) * (0.72 + torn * 0.5);
        float body = smoothstep(width, width - 0.34, x);
        float fade = smoothstep(0.0, 0.05, uv.y);
        float cut = smoothstep(0.1, 0.5, torn + (1.0 - uv.y) * 0.62);
        float a = body * fade * cut;
        vec3 outer = vec3(0.85, 0.22, 0.03);
        vec3 inner = vec3(1.7, 0.95, 0.28);
        vec3 c = mix(outer, inner, smoothstep(0.34, 0.95, body * (1.0 - uv.y * 0.65)));
        gl_FragColor = vec4(c * a, a);
      }`,
  });
}

/** Floors, plaster details, the ceiling frame and the great posts. */
function floorAndFrame(s, m) {
  const { block, timber, sheet } = s;
  // The flags run under everything, the wings too.
  const shape = new T.Shape();
  [[-inX, rearIn], [inX, rearIn], [inX, 4.86], [3.33, 4.86], [3.33, frontIn], [-3.33, frontIn], [-3.33, 4.86], [-inX, 4.86]].forEach(
    ([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)),
  );
  shape.closePath();
  const floor = sheet(m.flags, shape, [0, -0.02, 0], [1, 0, 0], [0, 0, -1], 0.03);
  floor.castShadow = false;
  // Rear door's threshold, and the front door's flags reach in to the mat.
  const mat = block(s.mat("#7b6a48", 1), -0.65, 0.01, frontIn - 0.92, 0.65, 0.022, frontIn - 0.08);
  mat.castShadow = false;
  // The upright frame of the room: wall posts with arch braces to the beams.
  const wallPosts = [
    [-2.3, rearIn + 0.08, -1],
    [0.9, rearIn + 0.08, -1],
    [-1.3, frontIn - 0.08, 1],
    [1.3, frontIn - 0.08, 1],
  ];
  for (const [x, z] of wallPosts) timber(m.oakDark, [x, 0.02, z], [x, ceil, z], 0.2, 0.15);
  // Great posts under the well's corners, each with four arch braces.
  for (const [x, z] of GREAT_ROOM.posts) {
    timber(m.oakDark, [x, 0, z], [x, ceil + 0.02, z], 0.3, 0.3);
    block(m.stone, x - 0.22, 0, z - 0.22, x + 0.22, 0.09, z + 0.22);
    for (const dx of [-1, 1]) {
      if (x + dx * 0.9 < well.minX - 0.2 || x + dx * 0.9 > well.maxX + 0.2) continue;
      timber(m.oakDark, [x + dx * 0.1, ceil - 0.92, z], [x + dx * 0.88, ceil - 0.1, z], 0.13, 0.14);
    }
  }
}

/** The bearers, joists and boards of the upper floor, the well left open. */
function ceiling(s, m) {
  const { timber, sheet, block } = s,
    w = well,
    b = stair;
  // The floor plate itself: boards on top, boards seen from below.
  const outer = new T.Shape();
  [[-6.9, -3.88], [6.9, -3.88], [6.9, 5.45], [3.1, 5.45], [3.1, 3.92], [-3.1, 3.92], [-3.1, 5.45], [-6.9, 5.45]].forEach(
    ([x, z], i) => (i ? outer.lineTo(x, -z) : outer.moveTo(x, -z)),
  );
  outer.closePath();
  const hole = new T.Path();
  hole.moveTo(w.minX, -w.minZ);
  hole.lineTo(w.minX, -w.maxZ);
  hole.lineTo(w.maxX, -w.maxZ);
  hole.lineTo(w.maxX, -w.minZ);
  hole.closePath();
  const stairs = new T.Path();
  stairs.moveTo(b.minX, -b.topZ);
  stairs.lineTo(b.minX, -b.bottomZ);
  stairs.lineTo(6.65, -b.bottomZ);
  stairs.lineTo(6.65, -b.topZ);
  stairs.closePath();
  outer.holes.push(hole, stairs);
  sheet(m.sark, outer, [0, ceil + 0.14, 0], [1, 0, 0], [0, 0, -1], 0.07);
  sheet(m.boards, outer, [0, PUB.loft - 0.03, 0], [1, 0, 0], [0, 0, -1], 0.03);
  // The trimmers round the well, chunky enough to read as the frame's heart.
  const y = ceil + 0.03;
  timber(m.oakDark, [w.minX - 0.15, y, w.minZ], [w.maxX + 0.15, y, w.minZ], 0.3, 0.34);
  timber(m.oakDark, [w.minX - 0.15, y, w.maxZ], [w.maxX + 0.15, y, w.maxZ], 0.3, 0.34);
  timber(m.oakDark, [w.minX, y, w.minZ], [w.minX, y, w.maxZ], 0.3, 0.34);
  timber(m.oakDark, [w.maxX, y, w.minZ], [w.maxX, y, w.maxZ], 0.3, 0.34);
  // Beams from the well to the outer walls, and the joists they carry.
  for (const x of [-4.6, -1.3, 2]) {
    timber(m.oakDark, [x, y, rearIn], [x, y, w.minZ], 0.26, 0.3);
    timber(m.oakDark, [x, y, w.maxZ], [x, y, frontIn], 0.26, 0.3);
  }
  for (const x of [5.5]) timber(m.oakDark, [x, y, rearIn], [x, y, 2.6], 0.24, 0.3);
  timber(m.oakDark, [2, y, 0], [5.45, y, 0], 0.24, 0.28);
  timber(m.oakDark, [-6.65, y, 0], [-4.6, y, 0], 0.24, 0.28);
  // Joists, running along z, with the stair's trimmer left clear.
  const joist = (x, a, c) => timber(m.oak, [x, ceil + 0.08, a], [x, ceil + 0.08, c], 0.1, 0.13);
  for (let x = -6.45; x < 6.6; x += 0.42) {
    if (Math.abs(x + 4.6) < 0.2 || Math.abs(x + 1.3) < 0.2 || Math.abs(x - 2) < 0.2 || Math.abs(x - 5.5) < 0.15) continue;
    if (x > b.minX) {
      joist(x, rearIn, b.topZ);
      joist(x, b.bottomZ, frontIn);
      continue;
    }
    joist(x, rearIn, w.minZ);
    joist(x, w.maxZ, frontIn);
    if (x < w.minX || x > w.maxX) joist(x, w.minZ, w.maxZ);
  }
  // The wings' ceilings, joisted the same way.
  for (const side of [-1, 1]) {
    const from = side * 3.45,
      to = side * inX;
    timber(m.oakDark, [from, y, frontIn + 0.02], [to, y, frontIn + 0.02], 0.26, 0.28);
    for (let i = 0; i < 8; i++) {
      const x = from + ((to - from) * (i + 0.5)) / 8;
      joist(x, frontIn, 4.86);
    }
  }
  // A plate closes the top of the brick walls under the flooring, inside.
  block(m.oak, -inX, ceil - 0.03, rearIn - 0.02, inX, ceil + 0.14, rearIn + 0.08);
}

/** The inglenook: brick breast, oak bressummer, crane and pot, a real fire. */
function inglenook(s, m, uniforms, props) {
  const { block, timber, bar, cyl, box, torus, orb, mesh, group, range } = s,
    h = hearth,
    open = h.openHalfZ,
    openH = h.openH,
    front = h.breastX;
  // The breast's brick either side of the opening and above the bressummer.
  block(m.brick, front, 0, -h.halfZ, -inX, ceil, -open);
  block(m.brick, front, 0, open, -inX, ceil, h.halfZ);
  block(m.brick, front, openH + 0.3, -open, -inX, ceil, open);
  // Inside the fireplace: fireback in herringbone, cheeks and floor of soot.
  block(m.fireback, h.backX, 0, -open, h.backX + 0.04, openH + 0.5, open);
  block(m.brick, h.backX, 0, -open - 0.3, -inX, openH + 0.7, -open);
  block(m.brick, h.backX, 0, open, -inX, openH + 0.7, open + 0.3);
  block(m.soot, h.backX, openH + 0.28, -open, -inX, openH + 0.7, open);
  const floor = block(m.soot, h.backX, 0, -open, front, 0.02, open);
  floor.castShadow = false;
  // The bressummer: one great baulk of oak, with a sprig of carving.
  const y = openH + 0.15;
  timber(m.oakDark, [front + 0.03, y, -h.halfZ - 0.1], [front + 0.03, y, h.halfZ + 0.1], 0.3, 0.36);
  // Mantel shelf.
  timber(m.oakWarm, [front + 0.14, y + 0.25, -h.halfZ - 0.12], [front + 0.14, y + 0.25, h.halfZ + 0.12], 0.26, 0.09);
  // Wide hearthstone, proud of the flags.
  const stone = block(m.stoneDark, front, 0.0, -open - 0.15, h.stoneX, 0.045, open + 0.15);
  stone.castShadow = false;
  // Firedogs, logs and the embers.
  for (const z of [-0.7, 0.7]) {
    bar(m.iron, [-6.5, 0.02, z], [-6.5, 0.48, z], 0.05, 0.05);
    orb(m.iron, -6.5, 0.5, z, 0.05, 0.05, 0.05);
    bar(m.iron, [-7.4, 0.14, z], [-6.5, 0.14, z], 0.04, 0.04);
    bar(m.iron, [-6.6, 0.02, z - 0.13], [-6.6, 0.14, z], 0.03, 0.03);
    bar(m.iron, [-6.6, 0.02, z + 0.13], [-6.6, 0.14, z], 0.03, 0.03);
  }
  const bark = m.oakDark;
  const log = (a, b, r, material = bark) => {
    const from = new T.Vector3(...a),
      to = new T.Vector3(...b);
    const o = mesh(new T.CylinderGeometry(r, r * 1.05, from.distanceTo(to), 9), material);
    o.position.copy(from).add(to).multiplyScalar(0.5);
    o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), to.sub(from).normalize());
    return o;
  };
  log([-7.15, 0.26, -0.95], [-7.05, 0.26, 0.95], 0.13);
  log([-6.8, 0.25, -0.9], [-6.76, 0.25, 0.9], 0.12);
  log([-7.0, 0.46, -0.72], [-6.9, 0.46, 0.72], 0.11);
  for (let i = 0; i < 26; i++) {
    const o = mesh(new T.IcosahedronGeometry(range(0.025, 0.055), 0), m.ember, range(-7.3, -6.55), range(0.03, 0.08), range(-0.9, 0.9));
    o.castShadow = false;
  }
  log([-6.95, 0.17, -0.5], [-6.9, 0.17, 0.5], 0.085, m.ember);
  // The fire.
  const fire = new T.Group();
  fire.position.set(-6.95, 0.14, 0);
  s.root.add(fire);
  s.apart(fire);
  const flames = [];
  const tongues = [
    [0, 0, 1.25, 1.32],
    [-0.55, 0.02, 0.95, 1.0],
    [0.52, -0.02, 1.0, 1.05],
    [-0.28, 0.12, 0.8, 0.82],
    [0.3, -0.1, 0.75, 0.9],
  ];
  tongues.forEach(([z, x, w, tall], i) => {
    for (const turn of [Math.PI / 2, Math.PI / 2 + 0.8, Math.PI / 2 - 0.8]) {
      const material = flameMaterial(uniforms);
      material.uniforms.seed.value = i + turn;
      const sheet = new T.Mesh(new T.PlaneGeometry(w, tall), material);
      sheet.position.set(x, tall / 2, z);
      sheet.rotation.y = turn;
      sheet.renderOrder = 3;
      sheet.castShadow = sheet.receiveShadow = false;
      fire.add(sheet);
      flames.push(sheet);
    }
  });
  // The iron crane, swung out, and the stew pot.
  bar(m.iron, [-7.45, 0.1, -1.1], [-7.45, 1.45, -1.1], 0.045, 0.045);
  bar(m.iron, [-7.45, 1.3, -1.1], [-7.05, 1.3, -0.2], 0.035, 0.035);
  bar(m.iron, [-7.45, 0.95, -1.1], [-7.2, 1.28, -0.55], 0.024, 0.024);
  bar(m.iron, [-7.05, 1.3, -0.2], [-7.05, 0.86, -0.2], 0.012, 0.012);
  const pot = new T.LatheGeometry(
    [[0.001, 0], [0.11, 0.01], [0.2, 0.09], [0.215, 0.18], [0.18, 0.28], [0.17, 0.31]].map(([a, b]) => new T.Vector2(a, b)),
    20,
  );
  mesh(pot, m.iron, -7.05, 0.56, -0.2);
  cyl(s.mat("#5a3a24", 0.55), -7.05, 0.85, -0.2, 0.168, 0.01, 0.168, undefined, 18);
  const potHandle = torus(m.iron, -7.05, 0.86, -0.2, 0.17, 0.008);
  potHandle.rotation.y = Math.PI / 2;
  // The bread oven's iron door in the left cheek and a brass-bound bellows.
  block(m.iron, -7.3, 0.72, open - 0.012, -6.7, 1.22, open + 0.002);
  for (const x of [-7.25, -6.75]) block(m.brass, x - 0.016, 1.15, open - 0.018, x + 0.016, 1.19, open);
  // The tools by the hearth.
  const stand = group(-5.45, 0.04, 1.58, 0.3);
  cyl(m.iron, 0, 0.02, 0, 0.09, 0.03, 0.1, stand, 12);
  bar(m.iron, [0, 0, 0], [0, 0.82, 0], 0.018, 0.018, stand);
  orb(m.brass, 0, 0.84, 0, 0.028, 0.028, 0.028, stand);
  for (const [dx, dz] of [[0.09, 0], [-0.05, 0.08], [-0.05, -0.08]]) {
    bar(m.iron, [dx, 0.75, dz], [dx * 1.2, 0.06, dz * 1.2], 0.012, 0.012, stand);
    box(m.iron, dx * 1.2, 0.05, dz * 1.2, 0.05, 0.1, 0.012, 0.004, stand);
  }
  // A basket of logs, a stack in the recess.
  const basketAt = [-5.4, -1.5];
  cyl(m.oakWarm, basketAt[0], 0.22, basketAt[1], 0.3, 0.42, 0.34, undefined, 16);
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9;
    log(
      [basketAt[0] + Math.cos(a) * 0.14, 0.55 + (i % 3) * 0.06, basketAt[1] + Math.sin(a) * 0.14 - 0.24],
      [basketAt[0] + Math.cos(a) * 0.14 + 0.05, 0.57 + (i % 3) * 0.06, basketAt[1] + Math.sin(a) * 0.14 + 0.24],
      0.042,
      m.oakWarm,
    );
  }
  // On the mantel: pewter, candlesticks, jugs; the heron above; pans either side.
  const mantelY = y + 0.3;
  for (const [i, z] of [-1.72, -1.34, -0.95, 0.95, 1.34, 1.72].entries()) {
    if (i === 0 || i === 5) props.candlestick(front + 0.14, mantelY, z);
    else if (i % 2) props.jug(front + 0.14, mantelY, z, ["#c9b892", "#7f9a8f"][i % 2]);
    else props.tankard(front + 0.14, mantelY, z, 1.2);
  }
  // The house's portrait.
  const portrait = paintedMaterial(768, 512, (c, w, ph) => paintHeron(c, w, ph));
  box(m.oakDark, front + 0.035, 2.62, 0, 0.07, 0.58, 0.84, 0.01);
  const art = new T.Mesh(new T.PlaneGeometry(0.74, 0.49), portrait);
  art.rotation.y = Math.PI / 2;
  art.position.set(front + 0.075, 2.62, 0);
  art.castShadow = false;
  s.root.add(art);
  // Copper pans and a warming pan on the brick either side.
  for (const [z, r] of [[-1.72, 0.14], [-1.42, 0.11], [1.42, 0.12], [1.72, 0.15]]) {
    bar(m.iron, [front + 0.02, 2.5, z], [front + 0.02, 2.75, z], 0.012, 0.012);
    const pan = cyl(m.copper, front + 0.04, 2.5 - r * 0.7, z, r, 0.03, r, undefined, 20);
    pan.rotation.z = Math.PI / 2;
  }
  // Dried hops along the bressummer's under-edge.
  props.hops([
    [front + 0.2, y + 0.1, -2.2],
    [front + 0.25, y - 0.04, -1.2],
    [front + 0.25, y + 0.02, 0],
    [front + 0.25, y - 0.04, 1.2],
    [front + 0.2, y + 0.1, 2.2],
  ]);
  return flames;
}

/** The bar: panelled counter, back bar, hand pulls, casks and tankard rail. */
function theBar(s, m, props) {
  const { block, timber, bar, box, cyl, orb, plaque, group } = s,
    b = GREAT_ROOM.bar;
  const counterTop = 1.06;
  // The carcase and top.
  block(m.oakDark, b.minX, 0, b.minZ + 0.1, b.maxX, counterTop - 0.05, b.maxZ - 0.03);
  block(m.oakDark, b.returnMinX, 0, b.returnMinZ, b.minX, counterTop - 0.05, b.maxZ - 0.03);
  block(m.tabletop, b.minX - 0.04, counterTop - 0.05, b.minZ, b.maxX, counterTop, b.maxZ + 0.04);
  block(m.tabletop, b.returnMinX - 0.04, counterTop - 0.05, b.returnMinZ - 0.04, b.minX, counterTop, b.maxZ + 0.04);
  // Linenfold panels across the front.
  const front = b.maxZ - 0.01,
    panelW = 0.58;
  for (let x = b.returnMinX + 0.1; x < b.maxX - 0.4; x += panelW + 0.1) {
    box(m.oak, x + panelW / 2, 0.55, front, panelW, 0.8, 0.018, 0.004);
    for (let i = 0; i < 5; i++) {
      box(m.oak, x + panelW * (0.14 + i * 0.18), 0.55, front + 0.016, 0.05, 0.68, 0.012, 0.005);
    }
    box(m.oakDark, x + panelW + 0.05, 0.55, front + 0.008, 0.1, 0.98, 0.03, 0.006);
  }
  // Skirting, a brass foot rail on iron brackets.
  block(m.oakDark, b.returnMinX, 0, front - 0.02, b.maxX, 0.09, front + 0.03);
  const railY = 0.2,
    railZ = b.maxZ + 0.16;
  s.bar(m.brass, [b.returnMinX - 0.1, railY, railZ], [b.maxX - 0.1, railY, railZ], 0.04, 0.04);
  for (let x = b.returnMinX + 0.3; x < b.maxX; x += 1.2) bar(m.iron, [x, railY, railZ], [x, railY, front], 0.018, 0.018);
  // Under-counter shelf on the service side, with bottles, crocks and a jug.
  block(m.oakWarm, b.minX + 0.04, 0.45, b.minZ - 0.17, b.maxX - 0.3, 0.48, b.minZ + 0.1);
  // Three hand pulls and their drip tray.
  const pumps = [1.35, 1.95, 2.55];
  block(m.brass, pumps[0] - 0.22, counterTop, b.maxZ - 0.3, pumps[2] + 0.22, counterTop + 0.016, b.maxZ - 0.12);
  for (const x of pumps) {
    const z = b.maxZ - 0.22;
    cyl(m.brass, x, counterTop + 0.09, z, 0.03, 0.15, 0.026, undefined, 12);
    orb(m.brass, x, counterTop + 0.17, z, 0.032, 0.022, 0.032);
    const lever = group(x, counterTop + 0.19, z);
    lever.rotation.x = 0.28;
    cyl(m.wax, 0, 0.13, 0, 0.022, 0.27, 0.019, lever, 10);
    orb(m.wax, 0, 0.27, 0, 0.027, 0.04, 0.027, lever);
    box(m.brass, 0, -0.02, 0, 0.016, 0.06, 0.012, 0.004, lever);
    const spout = bar(m.brass, [x, counterTop + 0.1, z + 0.02], [x, counterTop + 0.07, z + 0.1], 0.014, 0.014);
    spout.castShadow = false;
  }
  // On the counter: the ledger and quill, keys on a board, bread, tankards.
  const ledger = group(3.75, counterTop, b.maxZ - 0.24, 0.16);
  box(m.oakDark, 0, 0.015, 0, 0.44, 0.03, 0.3, 0.006, ledger);
  box(m.linen, 0, 0.034, 0, 0.42, 0.012, 0.28, 0.004, ledger);
  bar(s.mat("#3b3226", 0.9), [0, 0.042, -0.14], [0, 0.042, 0.14], 0.003, 0.006, ledger);
  bar(s.mat("#f0ece2", 0.9), [0.14, 0.05, 0.08], [0.3, 0.17, -0.1], 0.012, 0.004, ledger);
  cyl(m.iron, 0.2, 0.025, 0.18, 0.025, 0.05, 0.028, ledger, 10);
  for (const [x, turn] of [[0.15, 0.2], [0.38, 1.4], [0.98, 2.2], [3.2, 2.7], [4.65, 0.4]])
    props.tankard(x, counterTop, b.maxZ - 0.16, turn);
  props.bread(-0.55, counterTop, b.maxZ - 0.26, 0.15, 0.3);
  props.candlestick(-1.05, counterTop, b.maxZ - 0.24);
  props.candlestick(4.28, counterTop, b.maxZ - 0.3);
  // A wedge of cheese under a linen, by the bread.
  box(s.mat("#e4c26f", 0.8), -0.08, counterTop + 0.07, b.maxZ - 0.3, 0.26, 0.14, 0.18, 0.01);
  // The back bar: shelves of bottles and pewter, a mirrorless, honest thing.
  const backZ = rearIn;
  for (const [from, to] of GREAT_ROOM.backBar.runs) {
    block(m.oakDark, from, 0, backZ, to, 0.9, backZ + 0.45);
    block(m.tabletop, from - 0.02, 0.9, backZ, to + 0.02, 0.95, backZ + 0.48);
    block(m.oak, from, 0.95, backZ, to, 2.62, backZ + 0.03);
    for (const y of [1.42, 1.86, 2.3]) {
      block(m.oakWarm, from, y, backZ, to, y + 0.035, backZ + 0.3);
      const brackets = Math.ceil((to - from) / 0.9);
      for (let i = 0; i <= brackets; i++)
        block(m.oakDark, from + ((to - from) * i) / brackets - 0.02, y - 0.1, backZ, from + ((to - from) * i) / brackets + 0.02, y, backZ + 0.18);
    }
    for (let i = 0; i <= 3; i++) {
      const u = from + ((to - from) * i) / 3;
      block(m.oakDark, u - 0.03, 0.95, backZ + 0.02, u + 0.03, 2.62, backZ + 0.1);
    }
    block(m.oakWarm, from - 0.05, 2.62, backZ, to + 0.05, 2.7, backZ + 0.34);
    // The doors below: panelled cupboards.
    const doors = Math.max(2, Math.round((to - from) / 0.8));
    for (let i = 0; i < doors; i++) {
      const u = from + ((to - from) * (i + 0.5)) / doors,
        dw = (to - from) / doors - 0.06;
      box(m.oak, u, 0.46, backZ + 0.455, dw, 0.76, 0.02, 0.005);
      box(m.oakWarm, u, 0.46, backZ + 0.47, dw - 0.14, 0.6, 0.012, 0.004);
      orb(m.iron, u + dw / 2 - 0.05, 0.56, backZ + 0.49, 0.014, 0.014, 0.014);
    }
    // Fill each shelf from the seeded stream.
    let j = 0;
    for (const y of [1.455, 1.895, 2.335])
      for (let u = from + 0.14; u < to - 0.1; u += 0.145 + (j % 4) * 0.012, j++) {
        const z = backZ + 0.15 + ((j * 7) % 5) * 0.012;
        const kind = (j * 5 + Math.floor(y * 3)) % 7;
        if (kind < 3) props.bottle(u, y, z, j);
        else if (kind === 3) props.jug(u, y, z, ["#c9b892", "#7f9a8f", "#b4725a"][j % 3]);
        else if (kind === 4) props.tankard(u, y, z, 1.5 + j);
        else if (kind === 5) {
          cyl(s.mat("#aa9270", 0.75), u, y + 0.08, z, 0.045, 0.16, 0.05, undefined, 12);
          cyl(s.mat("#8e7350", 0.8), u, y + 0.17, z, 0.03, 0.02, 0.035, undefined, 10);
        }
      }
    // A cask on the back bar's top.
    props.cask(from + 0.32, 1.07, backZ + 0.26, 0.11, 0.26, "x");
    props.candlestick(to - 0.2, 0.95, backZ + 0.25);
  }
  // The three great casks on their stillage, with brass taps.
  const c = GREAT_ROOM.casks;
  block(m.oakDark, c.x - 0.95, 0.34, c.z - 0.45, c.x + 0.95, 0.42, c.z - 0.3);
  block(m.oakDark, c.x - 0.95, 0.34, c.z + 0.28, c.x + 0.95, 0.42, c.z + 0.43);
  for (const x of [c.x - 0.85, c.x, c.x + 0.85]) {
    block(m.oakDark, x - 0.04, 0, c.z - 0.42, x + 0.04, 0.34, c.z - 0.34);
    block(m.oakDark, x - 0.04, 0, c.z + 0.32, x + 0.04, 0.34, c.z + 0.4);
  }
  for (const [i, x] of [c.x - 0.66, c.x, c.x + 0.66].entries()) {
    props.cask(x, 0.76, c.z, 0.31, 0.88, "z");
    const tapZ = c.z + 0.47;
    cyl(m.brass, x, 0.68, tapZ, 0.015, 0.07, 0.015, undefined, 8).rotation.x = Math.PI / 2;
    box(m.brass, x, 0.72, tapZ + 0.03, 0.055, 0.012, 0.012, 0.003);
    bar(m.brass, [x, 0.68, tapZ + 0.03], [x, 0.63, tapZ + 0.03], 0.012, 0.012);
    const label = plaque([[["Best", "Mild", "Cider"][i], 170, 0.5]], 0.26, 0.15, "#2f4a42", "#ead7a8");
    const p = new T.Mesh(new T.PlaneGeometry(0.2, 0.11), label);
    p.position.set(x, 0.92, c.z + 0.45);
    p.rotation.x = -0.35;
    s.root.add(p);
  }
  // The beam over the bar: tankards on hooks, hops and a chalkboard.
  const railHigh = ceil - 0.46,
    rz = b.maxZ - 0.05;
  timber(m.oakDark, [b.minX - 0.5, railHigh, rz], [b.maxX, railHigh, rz], 0.09, 0.12);
  for (const x of [-1.1, 1.7, 4.5]) bar(m.iron, [x, railHigh, rz], [x, ceil + 0.03, rz], 0.03, 0.03);
  for (let x = -1.0; x < b.maxX - 0.2; x += 0.27) {
    bar(m.iron, [x, railHigh - 0.05, rz], [x, railHigh - 0.1, rz], 0.009, 0.009);
    props.tankard(x + (0.035 * ((x * 10) % 2 > 1 ? 1 : -1)), railHigh - 0.26, rz, 0.8 + x * 3);
  }
  props.hops([
    [b.minX - 0.4, railHigh + 0.12, rz + 0.12],
    [0.6, railHigh + 0.03, rz + 0.14],
    [2.4, railHigh + 0.12, rz + 0.12],
    [4.2, railHigh + 0.03, rz + 0.14],
    [5.3, railHigh + 0.12, rz + 0.12],
  ]);
  const slate = plaque(
    [
      ["Tonight", 88, 0.13],
      ["Mutton pie · 3d", 58, 0.32],
      ["Barley stew & bread · 2d", 58, 0.46],
      ["Cheese & apple · 1d", 58, 0.6],
      ["Bed in the loft · 4d", 58, 0.77],
      ["four-poster, by arrangement", 42, 0.88, "italic Georgia"],
    ],
    1.05,
    0.82,
    "#2b302c",
    "#e9e3cf",
  );
  const board = new T.Mesh(new T.BoxGeometry(0.02, 0.82, 1.05), slate);
  board.position.set(stair.minX - 0.07, 1.42, -0.86);
  board.castShadow = false;
  s.root.add(board);
  box(m.oakDark, stair.minX - 0.06, 1.42, -0.86, 0.015, 0.91, 1.14, 0.003);
}

/** The stair's flight, its balusters and the panelled cupboard beneath it. */
function staircase(s, m) {
  const { block, timber, cyl, orb, box } = s,
    b = stair,
    run = (b.bottomZ - b.topZ) / b.risers,
    rise = PUB.loft / b.risers;
  for (let i = 0; i < b.risers; i++) {
    const z = b.bottomZ - i * run;
    const treadTop = rise * (i + 1);
    block(m.oakWarm, b.minX, treadTop - 0.04, z - run - 0.015, b.maxX, treadTop, z);
    block(m.oakDark, b.minX + 0.02, treadTop - rise, z - 0.02, b.maxX - 0.02, treadTop - 0.04, z);
  }
  // Closed string on the wall and an open, moulded one to the room.
  const y = (z) => ((b.bottomZ - z) / (b.bottomZ - b.topZ)) * PUB.loft;
  for (const x of [b.minX + 0.02, b.maxX - 0.03])
    timber(m.oakDark, [x, y(b.bottomZ) - 0.1, b.bottomZ + 0.1], [x, y(b.topZ) - 0.1, b.topZ], 0.28, 0.08);
  // Newels and rail, and the balusters between them.
  const railAbove = 0.92,
    railX = b.minX - 0.02;
  timber(m.oakWarm, [railX, y(b.bottomZ) + railAbove, b.bottomZ + 0.03], [railX, y(b.topZ) + railAbove, b.topZ], 0.09, 0.08);
  for (const [z, top] of [[b.bottomZ + 0.03, railAbove + 0.16], [b.topZ, railAbove + 0.15]]) {
    timber(m.oakDark, [railX, y(Math.min(z, b.bottomZ)) - 0.1, z], [railX, y(Math.min(z, b.bottomZ)) + top, z], 0.13, 0.13);
    orb(m.oakWarm, railX, y(Math.min(z, b.bottomZ)) + top + 0.05, z, 0.075, 0.09, 0.075);
  }
  for (let i = 0; i < b.risers; i++) {
    const z = b.bottomZ - (i + 0.5) * run,
      foot = rise * (i + 1);
    cyl(m.oakWarm, railX, foot + (railAbove - 0.1) / 2, z, 0.022, railAbove - 0.1, 0.022, undefined, 6);
    orb(m.oakWarm, railX, foot + 0.3, z, 0.036, 0.08, 0.036);
  }
  // A panelled cupboard under the top of the flight: the tap room's wall.
  const closeZ0 = b.topZ,
    closeZ1 = b.topZ + 1.5;
  block(m.oakDark, b.minX - 0.04, 0, closeZ0, b.minX, y(closeZ1) - 0.05, closeZ1);
  for (let i = 0; i < 3; i++) {
    const z = closeZ0 + 0.25 + i * 0.5;
    box(m.oakWarm, b.minX - 0.05, 0.7, z, 0.012, 1.1, 0.4, 0.004);
  }
}

/** Every table, chair and settle in the room, and what is on them. */
function furnishing(s, m, props) {
  const { box, cyl, block, torus, orb, group, bar, plaque, range } = s,
    g = GREAT_ROOM;
  // The long table under the well, laid for supper.
  const t = g.longTable;
  props.trestleTable(t.x, t.z, t.length, t.width);
  const topY = 0.795;
  for (const side of [-1, 1]) {
    props.bench(t.x, t.z + side * 0.84, t.length - 0.16);
    const places = 6;
    for (let i = 0; i < places; i++) {
      const u = t.x - t.length / 2 + (t.length * (i + 0.5)) / places,
        z = t.z + side * 0.28;
      if ((i + (side > 0 ? 0 : 1)) % 3 === 2) continue;
      props.supper(u, topY, z, (i + (side > 0 ? 0 : 2)) % 3);
      props.tankard(u + 0.16, topY, z - side * 0.08, i * 1.7);
    }
  }
  // Down the table's middle: runner, loaves, candles, a cheese, a big jug.
  block(m.linen, t.x - t.length / 2 + 0.2, topY, t.z - 0.13, t.x + t.length / 2 - 0.2, topY + 0.004, t.z + 0.13);
  const middle = [
    [t.x - 1.5, "stick"],
    [t.x - 1.0, "bread"],
    [t.x - 0.45, "jug"],
    [t.x, "bowl"],
    [t.x + 0.45, "stick"],
    [t.x + 1.0, "bread"],
    [t.x + 1.5, "jug"],
  ];
  const tableCandles = [];
  for (const [u, kind] of middle) {
    if (kind === "stick") tableCandles.push(props.candlestick(u, topY + 0.004, t.z));
    else if (kind === "bread") props.bread(u, topY + 0.004, t.z, 0.13, range(-0.4, 0.4));
    else if (kind === "jug") props.jug(u, topY + 0.004, t.z, "#b4725a");
    else {
      cyl(s.mat("#7d5a3a", 0.8), u, topY + 0.055, t.z, 0.1, 0.1, 0.16, undefined, 18);
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05;
        orb(s.mat(i % 2 ? "#b6523a" : "#c9a14f", 0.45), u + Math.cos(a) * 0.08, topY + 0.13, t.z + Math.sin(a) * 0.08, 0.042, 0.042, 0.042);
      }
    }
  }
  // Round tables either side of the door: stools and a game of dice.
  g.roundTables.forEach((r, i) => {
    props.roundTable(r.x, r.z, r.r);
    const top = 0.765;
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI * 2) / 3 + (i ? 0.5 : -0.3);
      props.stool(r.x + Math.cos(a) * (r.r + 0.26), r.z + Math.sin(a) * (r.r + 0.26));
      props.tankard(r.x + Math.cos(a) * r.r * 0.6, top, r.z + Math.sin(a) * r.r * 0.6, a);
    }
    props.candlestick(r.x + 0.04, top, r.z - 0.03);
    if (i === 0)
      for (const [dx, dz] of [[-0.16, 0.14], [-0.08, 0.2]]) {
        const die = box(m.wax, r.x + dx, top + 0.012, r.z + dz, 0.024, 0.024, 0.024, 0.004);
        die.rotation.y = dx * 4;
      }
    else {
      props.supper(r.x - 0.2, top, r.z + 0.14, 2);
    }
  });
  // The square table by the stairs, four chairs and a hand of cards left out.
  const q = g.squareTable;
  block(m.tabletop, q.x - q.size / 2, 0.73, q.z - q.size / 2, q.x + q.size / 2, 0.78, q.z + q.size / 2);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
    block(m.oakDark, q.x + dx * (q.size / 2 - 0.07) - 0.035, 0, q.z + dz * (q.size / 2 - 0.07) - 0.035, q.x + dx * (q.size / 2 - 0.07) + 0.035, 0.73, q.z + dz * (q.size / 2 - 0.07) + 0.035);
  for (const [dx, dz, turn] of [[0, -0.72, 0], [0, 0.72, Math.PI], [-0.72, 0, Math.PI / 2], [0.72, 0, -Math.PI / 2]])
    props.chair(q.x + dx, q.z + dz, turn);
  props.candlestick(q.x, 0.78, q.z);
  for (const [i, [dx, dz]] of [[-0.22, 0.2], [-0.16, 0.24], [-0.1, 0.2], [0.2, -0.22], [0.26, -0.18]].entries()) {
    const card = box(s.mat(i % 3 ? "#e9dfc6" : "#b6523a", 0.8), q.x + dx, 0.785, q.z + dz, 0.06, 0.003, 0.09, 0);
    card.rotation.y = i * 0.6;
  }
  props.tankard(q.x - 0.26, 0.78, q.z - 0.2, 1);
  props.tankard(q.x + 0.3, 0.78, q.z + 0.24, 4);
  // Each wing's window booth.
  g.booths.forEach((o) => {
    props.settle(o.x, o.z + 0.68, o.length, Math.PI);
    props.bench(o.x, o.z - 0.65, o.length);
    block(m.tabletop, o.x - o.length / 2 + 0.05, 0.73, o.z - 0.38, o.x + o.length / 2 - 0.05, 0.785, o.z + 0.36);
    for (const dx of [-1, 1]) {
      block(m.oakDark, o.x + dx * (o.length / 2 - 0.26) - 0.05, 0, o.z - 0.22, o.x + dx * (o.length / 2 - 0.26) + 0.05, 0.73, o.z + 0.22);
      block(m.oakDark, o.x + dx * (o.length / 2 - 0.26) - 0.06, 0, o.z - 0.3, o.x + dx * (o.length / 2 - 0.26) + 0.06, 0.05, o.z + 0.3);
    }
    props.candlestick(o.x, 0.785, o.z);
    props.supper(o.x - 0.55, 0.785, o.z - 0.1, 0);
    props.supper(o.x + 0.55, 0.785, o.z + 0.1, 1);
    props.tankard(o.x - 0.32, 0.785, o.z + 0.15, 2.2);
    props.tankard(o.x + 0.33, 0.785, o.z - 0.14, 0.5);
    props.bread(o.x, 0.785, o.z + 0.17, 0.09, 0.2);
  });
  // The snug behind the north settle: a bench under the window, a small table.
  const n = g.snug;
  block(m.oakWarm, n.x - n.length / 2, 0.42, rearIn + 0.02, n.x + n.length / 2, 0.47, rearIn + 0.34);
  block(m.oakDark, n.x - n.length / 2, 0, rearIn + 0.02, n.x + n.length / 2, 0.42, rearIn + 0.3);
  block(m.tabletop, n.x - 0.62, 0.73, n.z - 0.12, n.x + 0.62, 0.78, n.z + 0.4);
  for (const dx of [-0.5, 0.5]) block(m.oakDark, n.x + dx - 0.04, 0, n.z - 0.02, n.x + dx + 0.04, 0.73, n.z + 0.3);
  props.tankard(n.x - 0.28, 0.78, n.z + 0.13, 1.9);
  props.candlestick(n.x + 0.3, 0.78, n.z + 0.14);
  const book = group(n.x, 0.78, n.z + 0.1, 0.5);
  box(m.oakDark, 0, 0.018, 0, 0.2, 0.036, 0.28, 0.006, book);
  // The settles either side of the hearth.
  for (const o of g.settles) {
    props.settle(o.x, o.z, o.length, o.faces > 0 ? 0 : Math.PI);
  }
  // The rug and the wing chair, turned to the flames.
  const rug = new T.Mesh(
    new T.BoxGeometry(g.rug.w, 0.018, g.rug.d),
    new T.MeshStandardMaterial({
      map: paintedMaterial(512, 672, (c, w, h) => {
        c.fillStyle = "#7d3f33";
        c.fillRect(0, 0, w, h);
        c.strokeStyle = "#d9c49a";
        c.lineWidth = 12;
        c.strokeRect(22, 22, w - 44, h - 44);
        c.strokeStyle = "#31524a";
        c.lineWidth = 22;
        c.strokeRect(50, 50, w - 100, h - 100);
        c.fillStyle = "#d9c49a";
        for (let j = 0; j < 7; j++)
          for (let i = 0; i < 5; i++) {
            const x = 96 + i * 80,
              y = 104 + j * 78;
            c.save();
            c.translate(x, y);
            c.rotate(Math.PI / 4);
            c.fillStyle = (i + j) % 2 ? "#d9c49a" : "#31524a";
            c.fillRect(-16, -16, 32, 32);
            c.restore();
          }
      }).map,
      roughness: 1,
    }),
  );
  rug.position.set(g.rug.x, 0.012, g.rug.z);
  rug.castShadow = false;
  rug.receiveShadow = true;
  s.root.add(rug);
  const w = group(g.wingChair.x, 0, g.wingChair.z, g.wingChair.rotation);
  const wool = s.mat("#6d4438", 0.97);
  box(wool, 0, 0.32, 0, 0.72, 0.3, 0.68, 0.07, w);
  box(wool, 0, 0.8, -0.3, 0.72, 0.86, 0.17, 0.07, w);
  for (const dx of [-0.34, 0.34]) {
    box(wool, dx, 0.52, 0.02, 0.15, 0.3, 0.68, 0.06, w);
    box(wool, dx * 1.06, 0.98, -0.2, 0.08, 0.5, 0.26, 0.03, w);
  }
  box(s.mat("#855647", 0.97), 0, 0.5, 0.03, 0.54, 0.09, 0.55, 0.04, w);
  for (const [dx, dz] of [[-0.3, -0.28], [0.3, -0.28], [-0.3, 0.28], [0.3, 0.28]])
    cyl(m.oakDark, dx, 0.08, dz, 0.03, 0.16, 0.04, w, 8);
  // A little stool and a clay pipe left on the chair's arm.
  props.stool(-3.62, 0.15, 0, 0.3, 0.17);
  // The dresser: plates on edge, pewter chargers, crocks below.
  const d = g.dresser,
    dz = d.z - d.d / 2;
  block(m.oakDark, d.x - d.w / 2, 0, dz, d.x + d.w / 2, 0.86, dz + d.d);
  block(m.oakWarm, d.x - d.w / 2 - 0.03, 0.86, dz, d.x + d.w / 2 + 0.03, 0.91, dz + d.d + 0.03);
  block(m.oak, d.x - d.w / 2, 0.91, dz, d.x + d.w / 2, 2.35, dz + 0.03);
  for (const y of [1.36, 1.82, 2.3]) block(m.oakWarm, d.x - d.w / 2, y, dz, d.x + d.w / 2, y + 0.03, dz + 0.24);
  for (const dx of [-1, 1]) block(m.oakDark, d.x + (dx * d.w) / 2 - 0.03, 0.91, dz, d.x + (dx * d.w) / 2 + 0.03, 2.35, dz + 0.24);
  for (const [row, y] of [1.39, 1.85].entries())
    for (let i = 0; i < 6; i++) {
      const x = d.x - d.w / 2 + 0.17 + i * 0.27;
      const blue = (i + row) % 2 === 0;
      const p = cyl(blue ? s.mat("#d9d6c5", 0.35) : m.pewter, x, y + 0.13, dz + 0.1, 0.12, 0.014, 0.12, undefined, 18);
      p.rotation.x = Math.PI / 2 - 0.2;
      if (blue) {
        const ring = torus(s.mat("#5f7f88", 0.4), x, y + 0.13, dz + 0.11, 0.085, 0.006);
        ring.rotation.x = -0.2;
      }
    }
  for (let i = 0; i < 5; i++) {
    props.jug(d.x - d.w / 2 + 0.2 + i * 0.33, 0.91, d.z + 0.03, ["#c9b892", "#7f9a8f", "#b4725a"][i % 3]);
  }
  for (const dx of [-0.42, 0.42]) {
    box(m.oak, d.x + dx, 0.44, dz + d.d + 0.01, 0.78, 0.7, 0.02, 0.005);
    box(m.oakWarm, d.x + dx, 0.44, dz + d.d + 0.023, 0.62, 0.54, 0.012, 0.004);
  }
  // Wainscot along the walls, up to the sills: the room's warm band.
  const wainscot = (axis, from, to, at, sign, top = 0.88) => {
    const panels = Math.max(1, Math.round((to - from) / 0.62));
    for (let i = 0; i < panels; i++) {
      const a = from + ((to - from) * i) / panels,
        c = from + ((to - from) * (i + 1)) / panels,
        mid = (a + c) / 2,
        w2 = c - a;
      if (axis === "x") {
        block(m.oak, a, 0.06, at, c, top, at + sign * 0.03);
        box(m.oakWarm, mid, top / 2 + 0.04, at + sign * 0.038, w2 - 0.14, top - 0.26, 0.014, 0.004);
      } else {
        block(m.oak, at, 0.06, a, at + sign * 0.03, top, c);
        box(m.oakWarm, at + sign * 0.038, top / 2 + 0.04, mid, 0.014, top - 0.26, w2 - 0.14, 0.004);
      }
    }
    if (axis === "x") block(m.oakDark, from, top, at, to, top + 0.05, at + sign * 0.06);
    else block(m.oakDark, at, top, from, at + sign * 0.06, top + 0.05, to);
  };
  wainscot("x", -inX, -4.15, rearIn, 1);
  wainscot("x", -2.45, -1.75, rearIn, 1);
  wainscot("x", -3.33, -2.7, frontIn, -1);
  wainscot("x", -1.4, -0.75, frontIn, -1);
  wainscot("x", 0.75, 1.4, frontIn, -1);
  wainscot("x", 2.7, 3.33, frontIn, -1);
  wainscot("z", 2.15, 2.85, -inX, 1);
  wainscot("z", -2.65, -2.15, -inX, 1);
  // Pegs by the door, with a cloak, a hat and a walking stick.
  const pegZ = frontIn - 0.04;
  for (let i = 0; i < 4; i++) {
    const x = -1.32 + i * 0.16;
    bar(m.oakDark, [x, 1.72, pegZ], [x, 1.72, pegZ - 0.1], 0.024, 0.024);
  }
  box(s.mat("#40584f", 0.97), -1.24, 1.14, pegZ - 0.05, 0.42, 1.16, 0.07, 0.03);
  orb(s.mat("#5c4532", 0.9), -0.88, 1.7, pegZ - 0.09, 0.12, 0.05, 0.12);
  cyl(s.mat("#5c4532", 0.9), -0.88, 1.76, pegZ - 0.09, 0.07, 0.1, 0.06, undefined, 12);
  bar(m.oakDark, [1.0, 0.03, pegZ - 0.08], [1.04, 0.95, pegZ - 0.01], 0.03, 0.03);
  // A framed map of the district on the west wing's return, over the booth.
  const mapArt = plaque(
    [
      ["WILLOWMERE", 90, 0.14],
      ["the green · the mill · the wood", 44, 0.28, "italic Georgia"],
      ["· the marsh · the market lane ·", 44, 0.38, "italic Georgia"],
      ["Rooms for the road", 56, 0.62],
      ["ask at the bar", 44, 0.76, "italic Georgia"],
    ],
    0.9,
    0.68,
    "#e4d6b3",
    "#3f4a3e",
  );
  const framed = new T.Mesh(new T.PlaneGeometry(0.72, 0.54), mapArt);
  framed.rotation.y = -Math.PI / 2;
  framed.position.set(-3.375, 1.8, 4.25);
  framed.castShadow = false;
  s.root.add(framed);
  box(m.oakDark, -3.36, 1.8, 4.25, 0.015, 0.6, 0.78, 0.003);
  return tableCandles;
}

/** Builds the great room into `s`; returns what the study animates. */
export function buildGreatRoom(s, upper, m, uniforms) {
  const props = createProps(s, m);
  floorAndFrame(s, m);
  ceiling(upper, m);
  const flames = inglenook(s, m, uniforms, props);
  theBar(s, m, props);
  staircase(s, m);
  furnishing(s, m, props);
  // The two wheels hang through the well from the loft's tie beams.
  const upperProps = createProps(upper, m);
  const wheel = [
    upperProps.chandelier(-3, 3.05, 0, PUB.eaves - 0.1),
    upperProps.chandelier(0, 3.05, 0, PUB.eaves - 0.1),
  ];
  // One lantern lights the bar's low ceiling, on a short chain.
  upperProps.chandelier(2.7, 2.42, -1.05, ceil + 0.02, 0.2, 4);
  return { flames, wheel };
}
