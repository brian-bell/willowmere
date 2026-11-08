// The millpond's weir, built for the millpond's streamer jobs (millpond.js):
// coursed masonry with a rounded coping across the outlet, a stepped glacis
// under the falling water, an apron in the pool below, wing walls along both
// banks, and a timber hatch (a sluice gate) at its east end. The water that
// spills over it is its own sheet: glassy over the crest, streaked down the
// face, foaming where it lands and breaking up downstream.
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";
import { MILLPOND as M, millpondGround } from "./millpond-layout.js";

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const W = M.weir,
  X0 = M.brookX,
  // The wing walls' water faces stand this far either side of the brook's middle.
  FACE = 2.12,
  // The hatch takes the east end of the crest, between these offsets from X0;
  // the water spills over the rest.
  HATCH = { west: 1.1, east: FACE },
  // Where the falling water leaves the coping's rounded nose, lands at the
  // glacis's foot, and its foam has broken up.
  NOSE = W.downstream - 0.02,
  FOOT = W.downstream + 0.64,
  TAIL = W.downstream + 1.75,
  SHEET_TOP = M.surface + 0.004,
  SHEET_FOOT = M.brookSurface + 0.012;

/** Height of the spilling water's sheet at z: level over the crest, then down the face. */
export function sheetHeight(z) {
  if (z <= NOSE) return SHEET_TOP;
  if (z >= FOOT) return SHEET_FOOT;
  const s = (z - NOSE) / (FOOT - NOSE);
  // Curls over the nose, steepens, then eases into the pool.
  return SHEET_TOP - (SHEET_TOP - SHEET_FOOT) * smooth(0, 1, Math.pow(s, 0.85));
}

// The glacis's stones sit under the sheet by the water's depth.
const faceHeight = (z) => sheetHeight(z) - 0.03;

/**
 * Lays the weir into kit `k`. Its dressed stones, the hatch's paddle and
 * ironwork go to `fine`, a layer the overview hides when zoomed
 * far out; the main layer keeps a plain stand-in (the mortared core, a block
 * along the crest and each wall, the hatch's posts and beam), tucked just
 * inside the stones, which is all a far view needs.
 */
export function buildWeir(T, k, fine, range) {
  const pick = (list) => list[Math.floor(range(0, list.length))];
  const dry = ["#a49d89", "#968f7c", "#aaa18a", "#8f8a7a", "#9d9682", "#b0a68f"].map(
      (c) => new T.Color(c),
    ),
    wet = new T.Color("#59604f"),
    algae = new T.Color("#4c5c3d"),
    sunk = new T.Color("#454c40"),
    moss = new T.Color("#6c7d43"),
    mortar = "#6d6a5f",
    color = new T.Color(),
    normal = new T.Vector3(),
    matrix = new T.Matrix4(),
    quaternion = new T.Quaternion(),
    euler = new T.Euler();

  // One dressed stone: a block with chamfered edges (44 triangles), coloured
  // per vertex so it darkens and greens where the water wets it and takes
  // moss on top.
  function chamfered(w, h, d, r) {
    const points = [],
      [a, b, c] = [w / 2, h / 2, d / 2];
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        for (const sz of [-1, 1])
          points.push(
            new T.Vector3(sx * a, sy * (b - r), sz * (c - r)),
            new T.Vector3(sx * (a - r), sy * b, sz * (c - r)),
            new T.Vector3(sx * (a - r), sy * (b - r), sz * c),
          );
    return new ConvexGeometry(points);
  }
  function stone(x, y, z, w, h, d, { ry = 0, rx = 0, waterline = M.brookSurface, mossy = 0, round = 0.035 } = {}) {
    const geometry = chamfered(w, h, d, Math.min(round, w * 0.3, h * 0.3, d * 0.3));
    matrix.compose(
      new T.Vector3(x, y, z),
      quaternion.setFromEuler(euler.set(rx, ry, 0, "YXZ")),
      new T.Vector3(1, 1, 1),
    );
    geometry.applyMatrix4(matrix);
    const base = pick(dry).clone().multiplyScalar(range(0.9, 1.06)),
      position = geometry.attributes.position,
      normals = geometry.attributes.normal,
      colors = new Float32Array(position.count * 3),
      // Some stones carry a mossy cap; the rest only a hint.
      cap = mossy * range(0.3, 1);
    for (let i = 0; i < position.count; i++) {
      const vy = position.getY(i);
      normal.fromBufferAttribute(normals, i);
      color.copy(base);
      // Wet just above the waterline, a band of weed at it, dark below.
      color.lerp(wet, 0.75 * smooth(waterline + 0.12, waterline - 0.01, vy));
      color.lerp(algae, 0.55 * smooth(0.06, 0, Math.abs(vy - waterline + 0.02)));
      color.lerp(sunk, 0.5 * smooth(waterline - 0.05, waterline - 0.3, vy));
      if (normal.y > 0.55 && vy > waterline + 0.05) color.lerp(moss, cap * normal.y);
      color.toArray(colors, i * 3);
    }
    geometry.setAttribute("color", new T.BufferAttribute(colors, 3));
    k.into(fine, () => k.piece(geometry));
  }

  // --- The weir's body ---------------------------------------------------
  // A mortared core behind the stones: it fills the joints with shadow.
  const coreOutline = [];
  for (let z = NOSE; z <= FOOT + 0.2; z += 0.06) coreOutline.push([-z, faceHeight(z) - 0.1]);
  coreOutline.push([-(FOOT + 0.2), -0.85], [-(W.upstream - 0.08), -0.85], [-(W.upstream - 0.08), 0.24], [-NOSE, 0.24]);
  k.gable(mortar, X0 - FACE - 0.1, 0, 0, coreOutline, (FACE + 0.1) * 2);

  // The coping: long stones across the crest, keyed into the wing walls.
  const copingDepth = NOSE - W.upstream + 0.1,
    copingZ = (NOSE + W.upstream - 0.1) / 2,
    copingH = 0.22;
  for (let x = X0 - FACE - 0.3; x < X0 + FACE + 0.3; ) {
    const length = Math.min(range(0.46, 0.74), X0 + FACE + 0.3 - x);
    const mid = x + length / 2 - X0,
      // The hatch's bay stays dry behind its shut paddle.
      dryBay = mid > HATCH.west && mid < HATCH.east,
      underWater = Math.abs(mid) < FACE && !dryBay;
    stone(x + length / 2, W.top - copingH / 2 + range(-0.008, 0.006), copingZ, length - 0.018, copingH, copingDepth, {
      ry: range(-0.012, 0.012),
      waterline: underWater ? M.surface : M.brookSurface + 0.1,
      mossy: underWater ? 0 : 0.5,
      round: 0.07,
    });
    x += length;
  }
  // The stand-in along the crest, wet where the water runs over it.
  k.box("#717666", X0, W.top - 0.02 - copingH / 2, copingZ, (FACE + 0.26) * 2, copingH, copingDepth - 0.04);
  // The glacis: courses of stones laid down the face, joints broken course
  // to course, under the falling water.
  const rows = 5;
  for (let r = 0; r < rows; r++) {
    const z0 = NOSE + 0.03 + (r / rows) * (FOOT + 0.14 - NOSE),
      z1 = NOSE + 0.03 + ((r + 1) / rows) * (FOOT + 0.14 - NOSE),
      zm = (z0 + z1) / 2,
      slope = Math.atan2(faceHeight(z0) - faceHeight(z1), z1 - z0),
      along = Math.hypot(z1 - z0, faceHeight(z0) - faceHeight(z1)),
      h = 0.2,
      top = faceHeight(zm),
      cy = top - (Math.cos(slope) * h) / 2,
      cz = zm - (Math.sin(slope) * h) / 2;
    let x = X0 - FACE + (r % 2 ? -0.2 : 0);
    while (x < X0 + FACE) {
      const start = Math.max(x, X0 - FACE),
        end = Math.min(x + range(0.38, 0.62), X0 + FACE),
        mid = (start + end) / 2 - X0,
        dryBay = mid > HATCH.west && r < 2;
      if (end - start > 0.08)
        stone((start + end) / 2, cy + range(-0.008, 0.008), cz, end - start - 0.022, h, along - 0.018, {
          rx: slope + range(-0.03, 0.03),
          waterline: dryBay ? M.brookSurface : top + 0.2,
          round: 0.04,
        });
      x = end;
    }
  }
  // The apron: big flags on the pool's bed, where the falling water lands.
  for (let z = FOOT + 0.14; z < TAIL - 0.3; z += 0.42) {
    let x = X0 - FACE + range(0, 0.3);
    while (x < X0 + FACE - 0.1) {
      const end = Math.min(x + range(0.5, 0.9), X0 + FACE);
      stone((x + end) / 2, -0.5 + range(-0.02, 0.02), z + 0.2, end - x - 0.03, 0.66, 0.38, {
        ry: range(-0.04, 0.04),
        waterline: 0.4,
        round: 0.05,
      });
      x = end;
    }
  }

  // --- Wing walls ----------------------------------------------------------
  // Coursed walls along both banks, upstream into the pond's outlet and
  // downstream along the brook, splayed out at their ends. Their coping
  // follows the bank behind, stepping down from the weir.
  function wall(side, path, waterline, least) {
    const thick = 0.36;
    for (let s = 0; s < path.length - 1; s++) {
      const [ax, az] = path[s],
        [bx, bz] = path[s + 1],
        length = Math.hypot(bx - ax, bz - az),
        dx = (bx - ax) / length,
        dz = (bz - az) / length,
        ry = Math.atan2(-dz, dx),
        // The segment's normal on the bank's side, away from the water.
        flip = -dz * side < 0 ? -1 : 1,
        out = [-dz * flip, dx * flip];
      const topAt = (t) => {
        const x = ax + dx * t,
          z = az + dz * t,
          bank = millpondGround(x + out[0] * (thick / 2 + 0.25), z + out[1] * (thick / 2 + 0.25));
        return Math.max(bank + 0.07, least(z));
      };
      // The stand-in: one block under the segment's lowest coping.
      let lowest = Infinity;
      for (let i = 0; i <= 8; i++) lowest = Math.min(lowest, topAt((i / 8) * length));
      const standBottom = waterline - 0.12;
      k.box(
        "#958e7b",
        (ax + bx) / 2,
        (lowest - 0.02 + standBottom) / 2,
        (az + bz) / 2,
        length - 0.04,
        lowest - 0.02 - standBottom,
        thick - 0.04,
        ry,
      );
      // Courses from below the bed up to the coping, joints broken.
      let course = 0;
      for (let y = waterline - 0.28; ; course++) {
        const h = range(0.17, 0.23);
        let any = false;
        for (let t = course % 2 ? -0.18 : 0; t < length - 0.02; ) {
          const t0 = Math.max(0, t),
            t1 = Math.min(length, t + range(0.34, 0.6)),
            tm = (t0 + t1) / 2,
            top = topAt(tm) - 0.13;
          if (y + h <= top + 0.02 && t1 - t0 > 0.1) {
            any = true;
            stone(ax + dx * tm, y + h / 2, az + dz * tm, t1 - t0 - 0.02, h - 0.018, thick, {
              ry: ry + range(-0.015, 0.015),
              waterline,
              mossy: 0.15,
            });
          }
          t = t1;
        }
        y += h;
        if (!any) break;
      }
      // The coping, a touch proud on the water's side.
      for (let t = s === 0 ? 0 : 0.01; t < length - 0.04; ) {
        const t1 = Math.min(length, t + range(0.44, 0.7)),
          tm = (t + t1) / 2,
          top = topAt(tm),
          cx = ax + dx * tm - out[0] * 0.03,
          cz = az + dz * tm - out[1] * 0.03;
        stone(cx, top - 0.065, cz, t1 - t - 0.02, 0.13, thick + 0.06, {
          ry: ry + range(-0.02, 0.02),
          waterline,
          mossy: 0.35,
          round: 0.04,
        });
        t = t1;
      }
    }
  }
  const centre = FACE + 0.18;
  for (const side of [-1, 1]) {
    const at = (offset) => X0 + side * offset;
    // Downstream, along the brook.
    wall(
      side,
      [
        [at(centre), W.upstream - 0.06],
        [at(centre), W.downstream + 1.05],
        [at(centre + 0.5), W.downstream + 1.75],
      ],
      M.brookSurface,
      (z) => (z < W.downstream + 0.1 ? 0.56 : 0.3),
    );
    // Upstream, along the pond's outlet.
    wall(
      side,
      [
        [at(centre), W.upstream - 0.06],
        [at(centre), W.upstream - 0.9],
        [at(centre + 0.55), W.upstream - 1.45],
      ],
      M.surface,
      () => 0.55,
    );
  }

  // --- The hatch -------------------------------------------------------------
  // Two oak posts in the crest, a head beam across, a shut paddle of boards
  // between them, and the rack and winding gear that lift it.
  const oak = ["#7d6c59", "#736352", "#85735e"],
    iron = "#3f3f3c",
    rust = "#6b4e3a",
    // The paddle shuts the bay at the crest, where the pond's water ends.
    gate = W.crest + 0.01,
    westPost = X0 + HATCH.west + 0.08,
    eastPost = X0 + HATCH.east - 0.08,
    beamY = 1.32;
  for (const x of [westPost, eastPost])
    k.box(pick(oak), x, (beamY - 0.35) / 2, gate, 0.14, beamY + 0.35, 0.16);
  k.box(pick(oak), (westPost + eastPost) / 2 + 0.1, beamY + 0.07, gate, eastPost - westPost + 0.5, 0.14, 0.18);
  const span = eastPost - westPost - 0.16;
  k.into(fine, () => {
    // Iron shoes where the posts meet the coping.
    for (const x of [westPost, eastPost]) k.box(iron, x, W.top + 0.05, gate, 0.18, 0.1, 0.2);
    // The paddle: boards between the posts, banded with iron, its top above the pond.
    const boards = 3;
    for (let i = 0; i < boards; i++) {
      const x = westPost + 0.08 + ((i + 0.5) / boards) * span;
      k.box(pick(oak), x, 0.17, gate + 0.02, span / boards - 0.012, 0.92, 0.06);
    }
    for (const y of [0.2, 0.52]) k.box(rust, (westPost + eastPost) / 2, y, gate + 0.06, span, 0.05, 0.015);
  });

  // The rack, the pinion and crank above the beam.
  const rackX = (westPost + eastPost) / 2,
    rackTop = beamY + 0.72;
  k.into(fine, () => {
    k.box(iron, rackX, (0.62 + rackTop) / 2, gate + 0.06, 0.06, rackTop - 0.62, 0.03);
    for (let y = beamY + 0.22; y < rackTop - 0.03; y += 0.065)
      k.box(iron, rackX, y, gate + 0.085, 0.05, 0.025, 0.025);
    // A cast-iron frame on the beam holds the pinion's axle.
    for (const dx of [-0.13, 0.13]) k.box(iron, rackX + dx, beamY + 0.3, gate + 0.11, 0.03, 0.42, 0.05);
    k.box(iron, rackX, beamY + 0.155, gate + 0.11, 0.3, 0.03, 0.08);
    k.cyl(iron, rackX, beamY + 0.42, gate + 0.15, 0.085, 0.035, Math.PI / 2);
    k.rod(iron, [rackX + 0.18, beamY + 0.42, gate + 0.15], [rackX - 0.18, beamY + 0.42, gate + 0.15], 0.018);
    // The crank, its arm hanging and wooden handle.
    k.box(iron, rackX + 0.2, beamY + 0.32, gate + 0.15, 0.025, 0.24, 0.035);
    k.rod("#7a5e42", [rackX + 0.2, beamY + 0.22, gate + 0.15], [rackX + 0.36, beamY + 0.22, gate + 0.15], 0.022);
  });
}

/**
 * The water spilling over the weir: one sheet from the crest down the face
 * and out over the pool, its foam drifting with the brook. Its material's
 * `userData.time` takes the clock.
 */
export function weirCascade(T) {
  const across = 16,
    positions = [],
    uvs = [],
    acrossFraction = [],
    index = [];
  // Rows close together over the curve, wider apart in the pool.
  const zs = [];
  for (let z = W.crest - 0.06; z < NOSE; z += 0.09) zs.push(z);
  for (let i = 0; i <= 9; i++) zs.push(NOSE + (i / 9) * (FOOT - NOSE));
  for (let i = 1; i <= 6; i++) zs.push(FOOT + (i / 6) * (TAIL - FOOT));
  zs.forEach((z, j) => {
    // The sheet spans the open crest, then its foam spreads across the pool.
    const spread = smooth(FOOT - 0.05, FOOT + 0.6, z),
      west = X0 - FACE + 0.03 + 0.04 * spread,
      east = X0 + HATCH.west - 0.02 + (FACE - 0.1 - HATCH.west) * spread,
      y = sheetHeight(z);
    for (let i = 0; i <= across; i++) {
      const x = west + (i / across) * (east - west);
      positions.push(x, y, z);
      uvs.push(x - X0, z - W.crest);
      acrossFraction.push(i / across);
      if (i < across && j < zs.length - 1) {
        const a = j * (across + 1) + i,
          b = a + across + 1;
        index.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  });
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("across", new T.Float32BufferAttribute(acrossFraction, 1));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  const time = { value: 0 };
  const material = new T.MeshStandardMaterial({
    color: "#ffffff",
    roughness: 0.3,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  material.userData.time = time;
  const d = (z) => (z - W.crest).toFixed(3);
  const shared = `
    uniform float uCascadeTime;
    varying vec2 vCascade;
    varying float vAcross;
    const float NOSE_D = ${d(NOSE)}, FOOT_D = ${d(FOOT)}, TAIL_D = ${d(TAIL)};
    float cascadeHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float cascadeNoise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(cascadeHash(i), cascadeHash(i + vec2(1.0, 0.0)), f.x),
        mix(cascadeHash(i + vec2(0.0, 1.0)), cascadeHash(i + vec2(1.0)), f.x), f.y);
    }
  `;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCascadeTime = time;
    shader.vertexShader = shared + "attribute float across;\n" + shader.vertexShader;
    // The foam heaves a little where the water lands.
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      vCascade = uv;
      vAcross = across;
      float churn = smoothstep(FOOT_D - 0.1, FOOT_D + 0.1, uv.y) * (1.0 - smoothstep(FOOT_D, TAIL_D, uv.y));
      transformed.y += churn * 0.012 * sin(uv.x * 9.0 + uCascadeTime * 6.0) * sin(uv.y * 11.0 - uCascadeTime * 4.3);`,
    );
    shader.fragmentShader = shared + "float cascadeWhite;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <alphamap_fragment>",
      `#include <alphamap_fragment>
      float dz = vCascade.y, ax = vCascade.x, t = uCascadeTime;
      // Over the crest: a clear, glassy tongue of the pond's water.
      // Down the face: streaks that quicken and whiten as the water falls.
      float fall = smoothstep(NOSE_D - 0.03, FOOT_D, dz);
      float lane = ax * 23.0 + sin(ax * 6.5) * 2.0;
      float streak = cascadeNoise(vec2(lane, dz * 5.0 - t * (1.2 + 6.0 * fall)));
      streak = mix(streak, cascadeNoise(vec2(lane * 2.3, dz * 9.0 - t * 8.0)), 0.4);
      // At the foot and below: churned foam that thins and drifts away.
      float pool = smoothstep(FOOT_D - 0.06, FOOT_D + 0.04, dz);
      float beyond = clamp((dz - FOOT_D) / (TAIL_D - FOOT_D), 0.0, 1.0);
      vec2 drift = vec2(ax * 4.0, (dz - t * 0.42) * 4.5);
      float foam = cascadeNoise(drift) * 0.6 + cascadeNoise(drift * 2.7 + 3.1) * 0.4;
      float cover = smoothstep(0.25 + 0.6 * beyond, 0.45 + 0.6 * beyond, foam) * (1.0 - smoothstep(0.55, 1.0, beyond));
      float white = mix(smoothstep(0.25, 0.95, fall) * (0.45 + 0.55 * streak), mix(1.0, cover, smoothstep(0.0, 0.25, beyond)), pool);
      float alpha = mix(mix(0.28 + 0.12 * streak, 0.62 + 0.3 * streak, fall), 0.92 * mix(1.0, cover, smoothstep(0.0, 0.2, beyond)), pool);
      cascadeWhite = white;
      vec3 glassy = vec3(0.42, 0.55, 0.52);
      diffuseColor.rgb = mix(glassy * (0.85 + 0.3 * streak), vec3(0.94, 0.97, 0.96), white);
      diffuseColor.a *= alpha
        * smoothstep(0.0, 0.06, dz + 0.06)
        * smoothstep(0.0, 0.012, vAcross) * (1.0 - smoothstep(0.985, 1.0, vAcross));`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      `#include <roughnessmap_fragment>
      roughnessFactor = mix(0.06, 0.7, cascadeWhite);`,
    );
  };
  material.customProgramCacheKey = () => "millpond-cascade-2";
  const mesh = new T.Mesh(geometry, material);
  mesh.name = "Millpond weir cascade";
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  return mesh;
}
