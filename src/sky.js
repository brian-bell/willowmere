// Eye-level sky: a painted gradient with sun glow, drifting clouds, a ring of
// distant hazy hills that settles the island into a valley, and faint stars at
// blue hour. Everything is computed from the view direction, so the dome has no
// position: it draws at the far plane behind the scene, only on pixels nothing
// else covered, and works for any perspective camera, including water's
// mirrored reflection captures. The village overview never sees the horizon.
const vertexShader = /* glsl */ `
varying vec3 vDirection;
void main() {
  vDirection = position;
  vec4 clip = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  // Pin just inside the far plane so every scene surface wins the depth test.
  gl_Position = vec4(clip.xy, clip.w * 0.99999, clip.w);
}`;

const fragmentShader = /* glsl */ `
uniform float uDusk, uTime;
uniform vec3 uSun;
uniform sampler2D uCloudNoise;
uniform vec3 uZenith[2], uMid[2], uHorizon[2], uGlow[2], uCloud[2], uCloudShade[2];
uniform vec3 uFarHills[2], uMidHills[2], uNearHills[2];
uniform vec3 uFog;
varying vec3 vDirection;

#define PI 3.14159265
vec3 pick(vec3 c[2]) { return mix(c[0], c[1], uDusk); }
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
// Two scales of the baked noise break up its tiling.
float clouds(vec2 uv) {
  return texture2D(uCloudNoise, uv).r * 0.7 + texture2D(uCloudNoise, uv * 2.7 + 0.37).r * 0.3;
}
// Integer frequencies keep each ridge seamless around the full circle.
float ridge(float a, float seed, float f) {
  return sin(a * f + seed) * 0.5 + sin(a * f * 2.0 + seed * 1.7) * 0.3 +
         sin(a * f * 5.0 + seed * 2.9) * 0.12 + sin(a * f * 11.0 + seed * 4.1) * 0.05;
}
// Scattered rounded copses along the nearest ridge; a whole number of slots
// around the circle keeps the seam at azimuth ±PI invisible.
float copses(float a) {
  float n = (a / (2.0 * PI) + 0.5) * 260.0;
  float h = hash(vec2(floor(n), 3.0));
  float x = fract(n) * 2.0 - 1.0;
  return sqrt(max(1.0 - x * x, 0.0)) * step(0.45, h) * (0.3 + 0.7 * h);
}
float layer(float elevation, float top, float w) {
  return 1.0 - smoothstep(top - w, top + w, elevation);
}

void main() {
  vec3 d = normalize(vDirection);
  float elevation = asin(clamp(d.y, -1.0, 1.0));
  // Derivatives are taken outside the branches below, where they are defined.
  float edge = fwidth(elevation) * 1.2;
  vec2 flatDir = normalize(d.xz + 1e-5), sunFlat = normalize(uSun.xz);
  float sunSide = dot(flatDir, sunFlat) * 0.5 + 0.5;
  float sunDot = max(dot(d, uSun), 0.0);

  // Sky gradient, warmed along the horizon on the sun's side.
  float up = clamp(elevation / (PI * 0.5), 0.0, 1.0);
  vec3 sky = mix(pick(uHorizon), pick(uMid), smoothstep(0.0, 0.22, up));
  sky = mix(sky, pick(uZenith), smoothstep(0.18, 0.85, up));
  float horizonBand = exp(-max(elevation, 0.0) * 9.0);
  sky = mix(sky, pick(uGlow), horizonBand * pow(sunSide, 2.0) * mix(0.55, 0.9, uDusk));
  sky += pick(uGlow) * pow(sunDot, 24.0) * mix(0.35, 0.15, uDusk);
  // The sun's disc, bright enough for the bloom pass to soften.
  sky += vec3(2.4, 2.1, 1.6) * smoothstep(0.99955, 0.99985, sunDot) * (1.0 - uDusk);

  // Stars come out at blue hour, thinning toward the horizon glow.
  if (uDusk > 0.4 && elevation > 0.15) {
    vec3 cell = floor(d * 140.0);
    float star = hash(cell.xy + cell.z * 31.7);
    vec3 offset = vec3(hash(cell.yz), hash(cell.zx + 7.0), hash(cell.xy + 3.0)) * 0.6 + 0.2;
    float point = smoothstep(0.3, 0.0, length(d * 140.0 - cell - offset));
    sky += vec3(0.9, 0.92, 1.0) * step(0.993, star) * point * (0.25 + offset.x * 0.6) *
           smoothstep(0.15, 0.7, elevation) * smoothstep(0.4, 1.0, uDusk);
  }

  // A thin layer of cumulus projected onto a plane overhead.
  if (elevation > 0.015) {
    vec2 uv = d.xz / (d.y + 0.12) * 0.11 + uTime * vec2(0.0008, 0.0003);
    float density = clouds(uv);
    float cover = smoothstep(0.54, 0.74, density);
    float lit = clamp((density - texture2D(uCloudNoise, uv + sunFlat * 0.015).r) * 5.0 + 0.55, 0.0, 1.0);
    vec3 cloud = mix(pick(uCloudShade), pick(uCloud), lit);
    cloud = mix(cloud, pick(uGlow), sunSide * horizonBand * 0.6);
    float fade = smoothstep(0.015, 0.18, elevation);
    sky = mix(sky, cloud, cover * fade * 0.92);
  }

  // Distant hills: farther ridges are taller and lost further in the haze.
  if (elevation < 0.08) {
    float azimuth = atan(d.z, d.x);
    float far = 0.045 + 0.03 * ridge(azimuth, 1.3, 2.0);
    float middle = 0.024 + 0.016 * ridge(azimuth, 4.1, 4.0);
    float near = 0.007 + 0.005 * ridge(azimuth, 7.7, 7.0) + 0.004 * copses(azimuth);
    vec3 haze = mix(pick(uHorizon), pick(uGlow), pow(sunSide, 2.0) * 0.5);
    vec3 farColor = mix(pick(uFarHills), haze, 0.35 + 0.4 * smoothstep(far - 0.03, far, elevation));
    vec3 midColor = mix(pick(uMidHills), haze, 0.18);
    // Just below the horizon lies the meadow beyond the far plane, lost in the
    // scene's fog; further down, the valley floor emerges from the haze
    // toward the island's rim.
    float misty = smoothstep(0.004, -0.012, elevation);
    float below = smoothstep(-0.03, -0.11, elevation);
    vec3 nearColor = mix(mix(pick(uNearHills), haze, 0.42), uFog, misty);
    nearColor = mix(nearColor, pick(uNearHills) * 0.92, below);
    sky = mix(sky, farColor, layer(elevation, far, edge));
    sky = mix(sky, midColor, layer(elevation, middle, edge));
    sky = mix(sky, nearColor, layer(elevation, near, edge));
  }

  // Break up gradient banding once the frame is quantized to 8 bits.
  sky += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(sky, 1.0);
}`;

const palette = {
  zenith: ["#5d8fc4", "#1d2a52"],
  mid: ["#93bad8", "#3d5185"],
  horizon: ["#e6e2c8", "#9c98b8"],
  glow: ["#ffd79a", "#f2a582"],
  cloud: ["#fffaf0", "#d9a6a8"],
  cloudShade: ["#c7cfd8", "#3e4670"],
  farHills: ["#9db4c6", "#4a5880"],
  midHills: ["#86a98f", "#36455f"],
  nearHills: ["#6b9160", "#26343e"],
};

// Tileable value-noise fbm, baked once so the shader samples instead of hashing.
function cloudNoise(T, size = 256) {
  let seed = 4271;
  const rand = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const field = new Float32Array(size * size);
  for (let octave = 0, amplitude = 0.5; octave < 5; octave++, amplitude /= 2) {
    const period = 8 << octave,
      lattice = Array.from({ length: period * period }, rand),
      at = (i, j) => lattice[(j % period) * period + (i % period)];
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const u = (x / size) * period,
          v = (y / size) * period,
          i = Math.floor(u),
          j = Math.floor(v),
          fu = (u - i) ** 2 * (3 - 2 * (u - i)),
          fv = (v - j) ** 2 * (3 - 2 * (v - j)),
          top = at(i, j) + (at(i + 1, j) - at(i, j)) * fu,
          bottom = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * fu;
        field[y * size + x] += amplitude * (top + (bottom - top) * fv);
      }
  }
  let min = Infinity,
    max = -Infinity;
  for (const value of field) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  const data = new Uint8Array(size * size);
  for (let i = 0; i < data.length; i++)
    data[i] = Math.round(((field[i] - min) / (max - min)) * 255);
  const texture = new T.DataTexture(data, size, size, T.RedFormat);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.magFilter = T.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export function createSky(T, sun) {
  const uniforms = {
    uCloudNoise: { value: cloudNoise(T) },
    uDusk: { value: 0 },
    uTime: { value: 0 },
    uSun: {
      value: sun.position.clone().sub(sun.target.position).normalize(),
    },
    uFog: { value: new T.Color() },
  };
  for (const [name, pair] of Object.entries(palette))
    uniforms["u" + name[0].toUpperCase() + name.slice(1)] = {
      value: pair.map((c) => new T.Color(c)),
    };
  const material = new T.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side: T.BackSide,
    depthWrite: false,
  });
  const mesh = new T.Mesh(new T.SphereGeometry(1, 48, 24), material);
  mesh.name = "sky";
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  mesh.userData.dynamic = true;
  // After the opaque scene, so covered pixels skip the shader, and before the
  // water surfaces (renderOrder 1e6), so refraction and reflections include it.
  mesh.renderOrder = 1e5;
  mesh.raycast = () => {};
  return {
    mesh,
    update(dusk, time, fog) {
      uniforms.uDusk.value = dusk;
      uniforms.uTime.value = time;
      if (fog) uniforms.uFog.value.copy(fog);
    },
  };
}
