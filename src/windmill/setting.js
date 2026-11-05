import * as T from "three";
import { FRUIT_TREES, ORCHARD, orchardGround, pathWeight } from "../regions/orchard-layout.js";
import { SCALE, TOWER, WINDOWS, polar, wallRadius } from "./layout.js";
import { LANTERNS } from "./tower.js";

// What surrounds the windmill's inside: the sky and country seen from its
// windows, the sun and its shafts through the dust, and a lantern on each floor.
// The hill and its fruit trees are the real hill's, from orchard-layout.js, at the
// tower's scale, so the view from the top looks down on what you walked up. Past
// them is a painted panorama whose horizon stays at the eye. The lights are a
// fixed set, so evening changes only their strength.

const TAU = Math.PI * 2;
const { windmill: W } = ORCHARD;

const DAY = {
  top: new T.Color("#8fb4d0"),
  bottom: new T.Color("#ece6cf"),
  sun: new T.Color("#ffe3b8"),
  hemi: new T.Color("#e4e9e6"),
  land: new T.Color("#ffffff"),
};
const DUSK = {
  top: new T.Color("#1c2850"),
  bottom: new T.Color("#b77a64"),
  sun: new T.Color("#8fa6dc"),
  hemi: new T.Color("#65759e"),
  land: new T.Color("#39436a"),
};

// The afternoon sun, in the tower's own bearings. It comes in over the door's
// left, through the ground floor's window, the bin floor's and the sail window.
const SUN_THETA = -0.72,
  SUN_HEIGHT = 0.72;
export const SUN_DIRECTION = new T.Vector3(
  Math.sin(SUN_THETA) * Math.cos(SUN_HEIGHT),
  Math.sin(SUN_HEIGHT),
  Math.cos(SUN_THETA) * Math.cos(SUN_HEIGHT),
);

/** A map position as the tower's frame sees it. */
function fromMap(mx, mz) {
  const dx = mx - W.x,
    dz = mz - W.z,
    r = Math.hypot(dx, dz) * SCALE,
    theta = Math.atan2(dx, dz) - W.doorBearing;
  return { r, theta, ...polar(r, theta) };
}

/** A tower-frame position as a map position. */
function toMap(r, theta) {
  const b = theta + W.doorBearing,
    d = r / SCALE;
  return { x: W.x + Math.sin(b) * d, z: W.z + Math.cos(b) * d };
}

function rng(seed) {
  return () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
}

// The far country as one long strip round the tower: `u` is the bearing, and the
// horizon sits a quarter of the way down, with the land spread below it.
const PANORAMA = { radius: 54, above: 13, below: 40, width: 4096, height: 512 };
const horizon = (PANORAMA.above / (PANORAMA.above + PANORAMA.below)) * PANORAMA.height;
// Below the horizon by this angle, in the strip's pixels.
const belowHorizon = (radians) =>
  horizon + (Math.tan(radians) * PANORAMA.radius * PANORAMA.height) / (PANORAMA.above + PANORAMA.below);

function paintCountry(c, w, h, lights) {
  const random = rng(8123),
    px = (theta) => ((((theta / TAU) % 1) + 1) % 1) * w;
  const ridge = (base, amp, seed, hex) => {
    c.fillStyle = hex;
    c.beginPath();
    c.moveTo(0, h);
    for (let n = 0; n <= 700; n++) {
      const x = (n / 700) * w,
        t = (n / 700) * TAU,
        y =
          base -
          amp *
            (0.6 * Math.sin(t * 3 + seed) +
              0.32 * Math.sin(t * 7 + seed * 2.1) +
              0.14 * Math.sin(t * 17 + seed * 3.3) +
              0.06 * Math.sin(t * 41 + seed));
      c.lineTo(x, y);
    }
    c.lineTo(w, h);
    c.closePath();
    c.fill();
  };
  // Blue distance, then the nearer hills.
  ridge(horizon - 10, 15, 0.7, "#a9bdc9");
  ridge(horizon - 3, 11, 2.3, "#94aeae");
  ridge(horizon + 3, 7, 4.1, "#8ba58d");
  // The fields, a patchwork running out to the hedges.
  const greens = ["#8fab6a", "#9cb573", "#86a463", "#a8ba78", "#b5bd77", "#7f9f62", "#c4c283"];
  c.fillStyle = "#88a666";
  c.fillRect(0, horizon + 8, w, h);
  for (let band = 0; band < 7; band++) {
    const y0 = horizon + 7 + band * band * 2.4 + band * 3,
      y1 = horizon + 7 + (band + 1) * (band + 1) * 2.4 + (band + 1) * 3 + 1;
    let x = 0;
    while (x < w) {
      const fw = (50 + random() * 150) * (1 + band * 0.45);
      c.fillStyle = greens[Math.floor(random() * greens.length)];
      c.fillRect(x, y0, fw + 1, y1 - y0);
      x += fw;
    }
    c.fillStyle = `rgba(62,88,52,${0.55 - band * 0.04})`;
    c.fillRect(0, y1 - 1, w, 1 + band * 0.45);
  }
  // Far trees along the hedges.
  for (let i = 0; i < 620; i++) {
    const x = random() * w,
      depth = random() ** 1.5,
      y = horizon + 5 + depth * 34,
      r = 1.4 + depth * 3.2;
    c.fillStyle = ["#5c7c4e", "#50704a", "#6a8554"][Math.floor(random() * 3)];
    c.beginPath();
    c.ellipse(x, y - r * 0.6, r, r * 0.9, 0, 0, TAU);
    c.fill();
  }

  // The old wood, a long dark bank to the south.
  const wood = (a0, a1) => {
    for (let i = 0; i < 520; i++) {
      const t = random(),
        x = px(a0 + (a1 - a0) * t),
        y = belowHorizon(0.02 + random() * 0.12),
        r = 5 + random() * 9;
      c.fillStyle = ["#44603f", "#3c5639", "#51703f", "#6b7d3a"][Math.floor(random() * 4)];
      c.beginPath();
      c.ellipse(x, y, r * 1.2, r, 0, 0, TAU);
      c.fill();
    }
  };
  wood(-1.75, -0.62);

  // The millpond, shining past the pears.
  {
    const a = fromMap(12.5, -31.2).theta,
      x = px(a),
      y = belowHorizon(0.06);
    const sheen = c.createLinearGradient(x, y - 8, x, y + 10);
    sheen.addColorStop(0, "#d5e8ee");
    sheen.addColorStop(1, "#8fb6c4");
    c.fillStyle = sheen;
    c.beginPath();
    c.ellipse(x, y, 78, 9, 0, 0, TAU);
    c.fill();
    c.fillStyle = "rgba(255,255,255,0.65)";
    for (let i = 0; i < 18; i++) c.fillRect(x - 60 + random() * 120, y - 4 + random() * 8, 6 + random() * 18, 1);
  }

  // The village: roofs and chimneys in rows, thickening round the green.
  const centre = fromMap(0, 0);
  const roofs = ["#a8604a", "#8d5a48", "#b26d51", "#7c6152", "#94543f", "#9c7157"],
    walls = ["#e8dcc2", "#dfd2b4", "#efe5cf", "#d6c7a8"],
    houses = [];
  for (let i = 0; i < 86; i++) {
    const spread = random() ** 1.3 * (random() > 0.5 ? 1 : -1) * 0.48,
      down = 0.07 + random() * 0.15 * (1 - Math.abs(spread) * 0.9);
    houses.push({ a: centre.theta + spread, down, s: 7 + down * 42 + random() * 3 });
  }
  houses.sort((a, b) => a.down - b.down);
  for (const house of houses) {
    const x = px(house.a),
      y = belowHorizon(house.down),
      s = house.s,
      flip = random() > 0.5 ? 1 : -1;
    c.fillStyle = walls[Math.floor(random() * walls.length)];
    c.fillRect(x - s * 0.72, y - s * 0.5, s * 1.44, s * 0.5);
    c.fillStyle = roofs[Math.floor(random() * roofs.length)];
    c.beginPath();
    c.moveTo(x - s * 0.84, y - s * 0.48);
    c.lineTo(x + flip * s * 0.1, y - s * 1.08);
    c.lineTo(x + s * 0.84, y - s * 0.48);
    c.closePath();
    c.fill();
    // Its chimney.
    c.fillStyle = "#7d6a58";
    c.fillRect(x + flip * s * 0.34, y - s * 1.08, s * 0.14, s * 0.42);
    if (lights) {
      // A lit window or two for the evening.
      lights.fillStyle = "#ffcb7c";
      lights.fillRect(x - s * 0.3, y - s * 0.32, s * 0.2, s * 0.17);
      if (random() > 0.5) lights.fillRect(x + s * 0.12, y - s * 0.32, s * 0.2, s * 0.17);
    }
    // A thread of smoke from some.
    if (random() > 0.7) {
      c.strokeStyle = "rgba(240,238,232,0.45)";
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(x + flip * s * 0.41, y - s * 1.1);
      c.bezierCurveTo(x + s * 0.8, y - s * 1.8, x + s * 0.2, y - s * 2.2, x + s * 1.1, y - s * 3);
      c.stroke();
    }
  }
  // Trees among them.
  for (let i = 0; i < 44; i++) {
    const a = centre.theta + (random() - 0.5) * 1.05,
      down = 0.06 + random() * 0.17,
      x = px(a),
      y = belowHorizon(down),
      r = 4 + down * 26;
    c.fillStyle = ["#5d7f49", "#6d8d4f", "#527142"][Math.floor(random() * 3)];
    c.beginPath();
    c.ellipse(x, y - r, r * 0.95, r * 1.05, 0, 0, TAU);
    c.fill();
  }
}

// The hill: a polar mesh whose heights and colours come straight from the map.
function hillMesh(material) {
  const rings = 34,
    segments = 72,
    positions = [],
    colors = [],
    indices = [],
    grass = new T.Color(),
    path = new T.Color("#c7b48a"),
    worn = new T.Color("#a79a78"),
    low = new T.Color("#85a564"),
    high = new T.Color("#a8bd70"),
    floorHere = orchardGround(W.x, W.z);
  for (let i = 0; i <= rings; i++) {
    const r = 0.4 + (PANORAMA.radius - 0.4) * (i / rings) ** 1.4;
    for (let j = 0; j <= segments; j++) {
      const theta = (j / segments) * TAU,
        p = polar(r, theta),
        m = toMap(r, theta),
        y = (orchardGround(m.x, m.z) - floorHere) * SCALE;
      positions.push(p.x, y, p.z);
      const mottle = 0.5 + 0.5 * Math.sin(m.x * 1.7 + 0.8 * Math.sin(m.z * 2.3)) * Math.sin(m.z * 1.3);
      grass.copy(low).lerp(high, mottle * 0.7 + 0.15).multiplyScalar(0.94 + 0.12 * Math.sin(theta * 13 + i));
      grass.lerp(path, pathWeight(m.x, m.z));
      // Trodden ground around the tower's foot, as outside.
      grass.lerp(worn, 1 - Math.min(1, Math.max(0, (r - 4.6) / 3)));
      colors.push(grass.r, grass.g, grass.b);
      if (i < rings && j < segments) {
        const a = i * (segments + 1) + j,
          b = a + segments + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  const mesh = new T.Mesh(geometry, material);
  mesh.name = "Windmill's hill";
  mesh.frustumCulled = false;
  return mesh;
}

function fruitTrees(material) {
  const blob = new T.IcosahedronGeometry(1, 2),
    p = blob.attributes.position,
    colors = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const v = 0.56 + 0.44 * ((p.getY(i) + 1) / 2);
    colors.set([v, v, v], i * 3);
  }
  blob.setAttribute("color", new T.BufferAttribute(colors, 3));
  const crowns = FRUIT_TREES.length * 2,
    mesh = new T.InstancedMesh(blob, material, crowns),
    matrix = new T.Matrix4(),
    color = new T.Color(),
    q = new T.Quaternion(),
    s = new T.Vector3(),
    at = new T.Vector3(),
    floorHere = orchardGround(W.x, W.z),
    apple = new T.Color("#739a4f"),
    pear = new T.Color("#8ca45a");
  let n = 0;
  for (const tree of FRUIT_TREES) {
    const { x, z } = fromMap(tree.x, tree.z),
      y = (orchardGround(tree.x, tree.z) - floorHere) * SCALE,
      size = 2.05 * SCALE * tree.scale;
    for (const [dy, r, dx] of [[0.9, 0.62, -0.1], [1.25, 0.48, 0.18]]) {
      matrix.compose(at.set(x + dx * size, y + dy * size, z + dx * size * 0.5), q, s.setScalar(r * size));
      mesh.setMatrixAt(n, matrix);
      mesh.setColorAt(n, color.copy(tree.kind === "apple" ? apple : pear).multiplyScalar(0.94 + (n % 3) * 0.05));
      n++;
    }
  }
  mesh.name = "Windmill's fruit trees";
  mesh.frustumCulled = false;
  return mesh;
}

// A soft shaft of sun from each window it reaches: nested prisms that fade along
// their length and toward every corner, and as a face turns edge-on, so no edge of
// one ever shows. Merged, so all of them are one transparent draw.
function sunShafts() {
  const positions = [],
    faces = [],
    down = SUN_DIRECTION.clone().negate();
  for (const w of WINDOWS) {
    if (Math.cos(w.theta - SUN_THETA) < 0.35) continue;
    const r = wallRadius(w.y) + TOWER.wall * 0.7,
      centre = polar(r, w.theta),
      tx = Math.cos(w.theta),
      tz = -Math.sin(w.theta),
      length = Math.min(9.5, (w.y + 0.2) / -down.y);
    for (const shrink of [1, 0.72]) {
      const hw = (w.w / 2) * shrink,
        hh = (w.h / 2) * shrink,
        corners = [
          [-hw, -hh],
          [hw, -hh],
          [hw, hh],
          [-hw, hh],
        ].map(([u, v]) => [centre.x + tx * u, w.y + v, centre.z + tz * u]);
      for (let i = 0; i < 4; i++) {
        const a = corners[i],
          b = corners[(i + 1) % 4],
          a2 = [a[0] + down.x * length, a[1] + down.y * length, a[2] + down.z * length],
          b2 = [b[0] + down.x * length, b[1] + down.y * length, b[2] + down.z * length];
        for (const [v, across, along] of [
          [a, 0, 0],
          [b, 1, 0],
          [b2, 1, 1],
          [a, 0, 0],
          [b2, 1, 1],
          [a2, 0, 1],
        ]) {
          positions.push(...v);
          faces.push(across, along);
        }
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(faces, 2));
  geometry.computeVertexNormals();
  const material = new T.ShaderMaterial({
    transparent: true,
    blending: T.AdditiveBlending,
    depthWrite: false,
    side: T.DoubleSide,
    uniforms: { strength: { value: 1 }, tint: { value: new T.Color("#ffdca8") } },
    vertexShader: /* glsl */ `
      varying vec2 vFace;
      varying vec3 vNormal2;
      varying vec3 vView;
      void main() {
        vFace = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal2 = normalMatrix * normal;
        vView = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float strength;
      uniform vec3 tint;
      varying vec2 vFace;
      varying vec3 vNormal2;
      varying vec3 vView;
      void main() {
        float across = sin(clamp(vFace.x, 0.0, 1.0) * 3.14159);
        float left = clamp(1.0 - vFace.y, 0.0, 1.0);
        float along = left * sqrt(left) * smoothstep(0.0, 0.05, vFace.y);
        float onFace = abs(dot(vNormal2, vView)) / max(length(vNormal2) * length(vView), 1e-4);
        float nearEye = smoothstep(0.2, 1.6, length(vView));
        float a = across * across * along * onFace * onFace * nearEye;
        gl_FragColor = vec4(tint * a * strength * 0.1, 1.0);
      }`,
  });
  const mesh = new T.Mesh(geometry, material);
  mesh.name = "Windmill's sun shafts";
  mesh.frustumCulled = false;
  return mesh;
}

// Flour dust hanging in the well, drifting; the sun's shafts catch it.
function flourDust() {
  const random = rng(6131),
    count = 340,
    positions = new Float32Array(count * 3),
    seeds = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const y = random() * TOWER.curb,
      r = Math.sqrt(random()) * wallRadius(y),
      a = random() * TAU,
      p = polar(r, a);
    positions.set([p.x, y, p.z], i * 3);
    seeds.set([random() * TAU, 0.5 + random()], i * 2);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.BufferAttribute(positions, 3));
  geometry.setAttribute("seed", new T.BufferAttribute(seeds, 2));
  const material = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    uniforms: {
      time: { value: 0 },
      strength: { value: 1 },
      tint: { value: new T.Color("#ffe6bd") },
      scale: { value: 700 },
    },
    vertexShader: /* glsl */ `
      attribute vec2 seed;
      uniform float time;
      uniform float scale;
      varying float fade;
      void main() {
        vec3 p = position;
        p.x += sin(time * 0.11 * seed.y + seed.x) * 0.42;
        p.y += sin(time * 0.07 * seed.y + seed.x * 1.7) * 0.5;
        p.z += cos(time * 0.09 * seed.y + seed.x * 2.3) * 0.42;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float d = max(0.3, -mv.z);
        gl_PointSize = clamp(0.011 * seed.y * scale / d, 1.0, 6.0);
        fade = smoothstep(0.3, 1.2, d) * (0.45 + 0.55 * sin(time * 0.4 * seed.y + seed.x * 5.0) * sin(time * 0.4 * seed.y + seed.x * 5.0));
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 tint;
      uniform float strength;
      varying float fade;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.1, d);
        gl_FragColor = vec4(tint * a * fade * strength * 0.24, 1.0);
      }`,
  });
  const points = new T.Points(geometry, material);
  points.name = "Windmill's flour dust";
  points.frustumCulled = false;
  return points;
}

export function createWindmillSetting(scene, materials) {
  const skyColors = { top: { value: new T.Color() }, bottom: { value: new T.Color() } };
  const sky = new T.Mesh(
    new T.SphereGeometry(58, 24, 12),
    new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: skyColors,
      vertexShader: /* glsl */ `
        varying float h;
        void main() {
          h = normalize(position).y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top;
        uniform vec3 bottom;
        varying float h;
        void main() {
          gl_FragColor = vec4(mix(bottom, top, smoothstep(-0.02, 0.5, h)), 1.0);
        }`,
    }),
  );
  sky.frustumCulled = false;
  sky.renderOrder = -2;
  sky.name = "Windmill's sky";
  scene.add(sky);

  // The panorama, with a matching strip of lit windows for the evening.
  const canvases = [0, 1].map(() => {
    const canvas = document.createElement("canvas");
    canvas.width = PANORAMA.width;
    canvas.height = PANORAMA.height;
    return canvas;
  });
  const lightCtx = canvases[1].getContext("2d");
  paintCountry(canvases[0].getContext("2d"), PANORAMA.width, PANORAMA.height, lightCtx);
  const texture = (canvas) => {
    const map = new T.CanvasTexture(canvas);
    map.colorSpace = T.SRGBColorSpace;
    map.wrapS = T.RepeatWrapping;
    map.anisotropy = 4;
    return map;
  };
  const stripGeometry = new T.CylinderGeometry(
    PANORAMA.radius,
    PANORAMA.radius,
    PANORAMA.above + PANORAMA.below,
    64,
    1,
    true,
  );
  stripGeometry.translate(0, (PANORAMA.above - PANORAMA.below) / 2, 0);
  const land = new T.MeshBasicMaterial({
    map: texture(canvases[0]),
    transparent: false,
    alphaTest: 0.5,
    side: T.BackSide,
    fog: false,
  });
  const strip = new T.Mesh(stripGeometry, land);
  strip.name = "Windmill's far country";
  strip.frustumCulled = false;
  strip.renderOrder = -1;
  const villageLights = new T.MeshBasicMaterial({
    map: texture(canvases[1]),
    transparent: true,
    blending: T.AdditiveBlending,
    depthWrite: false,
    side: T.BackSide,
    fog: false,
    opacity: 0,
  });
  const lit = new T.Mesh(stripGeometry, villageLights);
  lit.name = "Windmill's village lights";
  lit.frustumCulled = false;
  scene.add(strip, lit);

  const hillMaterial = new T.MeshBasicMaterial({ vertexColors: true, fog: false }),
    treeMaterial = new T.MeshBasicMaterial({ vertexColors: true, fog: false }),
    hill = hillMesh(hillMaterial),
    trees = fruitTrees(treeMaterial);
  scene.add(hill, trees);

  // The sun comes in through the windows on its side and lights what it lands on.
  const sun = new T.DirectionalLight("#ffe3b8", 3.1),
    centre = TOWER.curb / 2 + 1;
  sun.target.position.set(0, centre, 0);
  sun.position.copy(SUN_DIRECTION).multiplyScalar(34).add(sun.target.position);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(2048);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 12, bottom: -12, near: 8, far: 62 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.autoUpdate = false;
  const hemi = new T.HemisphereLight("#e4e9e6", "#8a7b68", 1);
  scene.add(sun, sun.target, hemi);

  const lamps = LANTERNS.map((l) => {
    const light = new T.PointLight("#ffbe7a", 1, 6.6, 1.7);
    light.position.set(l.x, l.y, l.z);
    scene.add(light);
    return light;
  });

  const shafts = sunShafts(),
    dust = flourDust();
  scene.add(shafts, dust);

  return {
    sun,
    dust,
    /** Runs from a golden afternoon (0) to lamplit evening (1). */
    apply(dusk, t, eye, pixelHeight) {
      const d = dusk;
      skyColors.top.value.lerpColors(DAY.top, DUSK.top, d);
      skyColors.bottom.value.lerpColors(DAY.bottom, DUSK.bottom, d);
      sun.color.lerpColors(DAY.sun, DUSK.sun, d);
      sun.intensity = 3.1 - 2.75 * d;
      hemi.color.lerpColors(DAY.hemi, DUSK.hemi, d);
      hemi.intensity = 0.62 - 0.42 * d;
      scene.environmentIntensity = 0.3 - 0.19 * d;
      land.color.lerpColors(DAY.land, DUSK.land, d);
      hillMaterial.color.copy(land.color);
      treeMaterial.color.copy(land.color);
      villageLights.opacity = d;
      materials.glow.emissiveIntensity = 0.9 + 2.1 * d;
      const flicker = 1 + Math.sin(t * 5.1) * 0.03 + Math.sin(t * 11.3) * 0.02;
      for (let i = 0; i < lamps.length; i++) {
        const sway = i % 2 ? flicker : 2 - flicker;
        lamps[i].intensity = (3.6 + 4.6 * d) * sway;
      }
      shafts.material.uniforms.strength.value = 1 - 0.9 * d;
      const dustShader = dust.material.uniforms;
      dustShader.time.value = t;
      dustShader.strength.value = 1 - 0.55 * d;
      if (pixelHeight) dustShader.scale.value = pixelHeight;
      sky.position.copy(eye);
      strip.position.copy(eye);
      lit.position.copy(eye);
    },
  };
}
