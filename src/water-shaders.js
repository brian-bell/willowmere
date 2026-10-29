// Height and face velocities are stored in RGBA16F: (eta, u, v, foam).
// Two symplectic passes keep the pressure gradient and continuity update coupled.
export const simulationVertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const simulationFragment = /* glsl */ `
precision highp float;
uniform sampler2D uState, uField;
uniform vec2 uTexel, uSize;
uniform float uDt, uTime, uPass, uOpenEnds;
uniform vec4 uImpulses[8];
varying vec2 vUv;
vec4 field(vec2 uv) {
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return vec4(0.0);
  return texture2D(uField, uv);
}
void main() {
  vec4 f = field(vUv);
  if (f.a < 0.5) { gl_FragColor = vec4(0.0); return; }
  vec2 dx = vec2(uTexel.x, 0.0), dz = vec2(0.0, uTexel.y);
  vec2 cell = uSize * uTexel;
  vec4 c = texture2D(uState, vUv);
  vec4 fr = field(vUv + dx), ft = field(vUv + dz);
  if (uPass < 0.5) {
    // Semi-Lagrangian transport by the prescribed current + local wave velocity.
    vec2 back = vUv - (f.gb + c.gb) * uDt / uSize;
    vec4 advected = texture2D(uState, clamp(back, uTexel * 0.5, 1.0 - uTexel * 0.5));
    if (field(back).a < 0.5) advected = c;
    float right = fr.a > 0.5 ? texture2D(uState, vUv + dx).r : c.r;
    float top = ft.a > 0.5 ? texture2D(uState, vUv + dz).r : c.r;
    vec2 velocity = advected.gb - 9.81 * uDt * vec2(right - c.r, top - c.r) / cell;
    velocity *= exp(-uDt * (0.48 + 0.025 / max(f.r, 0.015)));
    velocity *= vec2(fr.a, ft.a);
    gl_FragColor = vec4(advected.r, clamp(velocity, -1.5, 1.5), advected.a);
  } else {
    vec4 l = texture2D(uState, vUv - dx), b = texture2D(uState, vUv - dz);
    vec4 fl = field(vUv - dx), fb = field(vUv - dz);
    // Fluxes through shared faces use the same average resting depth on both cells.
    float divergence = ((f.r + fr.r) * c.g * fr.a - (f.r + fl.r) * l.g * fl.a) * 0.5 / cell.x
                     + ((f.r + ft.r) * c.b * ft.a - (f.r + fb.r) * b.b * fb.a) * 0.5 / cell.y;
    float height = c.r - uDt * divergence;
    float impact = 0.0;
    vec2 p = (vUv - 0.5) * uSize;
    for (int i = 0; i < 8; i++) {
      float r = max(uImpulses[i].z, 0.001);
      float d = dot(p - uImpulses[i].xy, p - uImpulses[i].xy) / (r * r);
      // Zero-integral Mexican-hat impulse avoids adding water at every splash.
      float pulse = (1.0 - d) * exp(-d);
      height += pulse * uImpulses[i].w;
      impact += exp(-d * 0.5) * abs(uImpulses[i].w) * 6.0;
    }
    float sponge = uOpenEnds * (1.0 - smoothstep(0.0, 0.045, min(vUv.y, 1.0 - vUv.y)));
    height *= exp(-uDt * (0.22 + sponge * 8.0));
    float compression = max(0.0, -divergence - 0.28) * 0.055;
    float foam = c.a * exp(-uDt * 0.9) + compression * uDt + impact;
    gl_FragColor = vec4(clamp(height, -min(0.12, f.r * 0.45), min(0.12, f.r * 0.45)), c.gb, clamp(foam, 0.0, 1.0));
  }
}
`;

// Gravity-wave dispersion plus short capillary detail. All surfaces use world units.
export const waveFunctions = /* glsl */ `
uniform float uTime, uAmplitude;
uniform vec2 uSize;
uniform sampler2D uField, uState;
vec3 wave(vec2 p, vec2 direction, float wavelength, float amplitude, float phase) {
  float k = 6.2831853 / wavelength;
  float omega = sqrt(9.81 * k + 0.000074 * k * k * k);
  float a = dot(p, direction) * k - omega * uTime + phase;
  return vec3(sin(a), direction * (k * cos(a))) * amplitude;
}
vec3 waves(vec2 p) {
  vec3 w = wave(p, vec2(0.28, 0.96), 1.74, 0.32, 0.0);
  w += wave(p, vec2(-0.60, 0.80), 0.93, 0.23, 1.7);
  w += wave(p, vec2(0.91, 0.4146), 0.51, 0.15, 4.1);
  w += wave(p, vec2(-0.89, 0.456), 0.29, 0.10, 2.3);
  w += wave(p, vec2(0.78, -0.626), 1.19, 0.12, 5.2);
  w += wave(p, vec2(-0.32, -0.947), 0.67, 0.07, 0.8);
  w += wave(p, vec2(0.54, 0.842), 0.38, 0.04, 3.6);
  return w * uAmplitude;
}
`;

export const waterVertex = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
#include <shadowmap_pars_vertex>
${waveFunctions}
uniform mat4 uReflectionMatrix;
varying vec3 vWorld, vRest;
varying vec2 vUv;
varying vec4 vReflection, vScreen;
void main() {
  vUv = uv;
  vRest = (modelMatrix * vec4(position, 1.0)).xyz;
  vec4 field = texture2D(uField, uv);
  float edge = smoothstep(0.0, 0.10, field.r) * field.a;
  vec3 w = waves(vRest.xz);
  vec3 displaced = position;
  displaced.y += (w.x + texture2D(uState, uv).r) * edge;
  vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);
  vWorld = worldPosition.xyz;
  vReflection = uReflectionMatrix * worldPosition;
  vec4 mvPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * mvPosition;
  vScreen = gl_Position;
  vec3 transformedNormal = normalMatrix * vec3(0.0, 1.0, 0.0);
  #include <shadowmap_vertex>
  #include <fog_vertex>
}
`;

export const waterFragment = /* glsl */ `
#include <common>
#include <packing>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
#include <fog_pars_fragment>
${waveFunctions}
uniform sampler2D uReflection, uScene, uDepth;
uniform vec2 uTexel, uViewport;
uniform vec3 uAbsorption, uScatter, uSunDirection, uSunColor, uSkyColor, uViewDirection;
uniform mat4 uInvProjection, uCameraWorld;
uniform float uReflectionReady, uDusk, uIsOrthographic, uRoughness;
varying vec3 vWorld, vRest;
varying vec2 vUv;
varying vec4 vReflection, vScreen;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + 1.0), f.x), f.y);
}
vec3 unproject(vec2 uv) {
  float d = texture2D(uDepth, uv).x;
  vec4 p = uInvProjection * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  return (uCameraWorld * vec4(p.xyz / p.w, 1.0)).xyz;
}
float caustic(vec2 p) {
  p *= 7.0;
  p += vec2(sin(p.y * 0.68 + uTime * 0.64), cos(p.x * 0.59 - uTime * 0.51)) * 0.8;
  float a = abs(sin(p.x + p.y * 0.38) * sin(p.y - p.x * 0.24));
  return pow(1.0 - a, 18.0);
}
void main() {
  vec4 field = texture2D(uField, vUv);
  if (field.a < 0.5) discard;
  vec4 state = texture2D(uState, vUv);
  vec2 cell = uTexel * uSize;
  vec2 slope = vec2(
    texture2D(uState, vUv + vec2(uTexel.x, 0)).r - texture2D(uState, vUv - vec2(uTexel.x, 0)).r,
    texture2D(uState, vUv + vec2(0, uTexel.y)).r - texture2D(uState, vUv - vec2(0, uTexel.y)).r
  ) / (2.0 * cell);
  slope += waves(vRest.xz).yz;
  // Two-phase flow mapping transports micro-ripples without unbounded UV stretching.
  float phase = fract(uTime * 0.16), phaseB = fract(uTime * 0.16 + 0.5);
  vec2 p = vRest.xz - field.gb * phase * 6.25;
  vec2 q = vRest.xz - field.gb * phaseB * 6.25;
  vec2 a = vec2(sin(p.x * 43.0 + p.y * 17.0 + sin(p.y * 11.0)), cos(p.y * 37.0 - p.x * 21.0 + sin(p.x * 9.0)));
  vec2 b = vec2(sin(q.x * 43.0 + q.y * 17.0 + sin(q.y * 11.0)), cos(q.y * 37.0 - q.x * 21.0 + sin(q.x * 9.0)));
  float footprint = max(length(dFdx(vRest.xz)), length(dFdy(vRest.xz)));
  slope += mix(a, b, abs(phase * 2.0 - 1.0)) * min(uAmplitude * 2.8, 0.055) * (1.0 - smoothstep(0.02, 0.12, footprint));
  slope *= smoothstep(0.0, 0.07, field.r);
  vec3 N = normalize(vec3(-slope.x, 1.0, -slope.y));
  vec3 V = uIsOrthographic > 0.5 ? uViewDirection : normalize(cameraPosition - vWorld);
  float NoV = max(dot(N, V), 0.05);
  vec2 screenUV = vScreen.xy / vScreen.w * 0.5 + 0.5;
  vec3 behind = unproject(screenUV);
  float verticalDepth = clamp(vWorld.y - behind.y, 0.0, 3.0);
  vec2 offset = (mat3(viewMatrix) * N).xy * 0.014 * min(verticalDepth, 1.0);
  vec2 refractUV = clamp(screenUV + offset, 1.0 / uViewport, 1.0 - 1.0 / uViewport);
  vec3 refractedPoint = unproject(refractUV);
  // Reject foreground samples: a bank or bridge must never smear into the water.
  if (refractedPoint.y > vWorld.y - 0.012) { refractUV = screenUV; refractedPoint = behind; }
  float thickness = clamp((vWorld.y - refractedPoint.y) / max(V.y, 0.25), 0.0, 4.0);
  vec3 transmission = exp(-uAbsorption * thickness);
  vec3 bed = texture2D(uScene, refractUV).rgb;
  float shadow = getShadowMask();
  float focus = caustic(refractedPoint.xz + slope * min(thickness, 0.8));
  bed *= 1.0 + focus * 0.34 * exp(-thickness * 0.7) * (1.0 - uDusk * 0.85) * shadow;
  vec3 underwater = bed * transmission + uScatter * (1.0 - transmission) * (0.55 + shadow * 0.45);
  vec2 reflectUV = vReflection.xy / vReflection.w;
  reflectUV += slope * 0.018;
  vec3 reflected = texture2D(uReflection, clamp(reflectUV, 0.002, 0.998)).rgb;
  reflected = mix(uSkyColor, reflected, uReflectionReady);
  float fresnel = 0.02037 + 0.97963 * pow(1.0 - NoV, 5.0); // Air/water IOR 1.333.
  vec3 color = mix(underwater, reflected, fresnel);
  // GGX sunlight with derivative-based specular antialiasing.
  vec3 H = normalize(V + uSunDirection);
  float NoL = max(dot(N, uSunDirection), 0.0), NoH = max(dot(N, H), 0.0);
  float rough = clamp(uRoughness + length(fwidth(N)) * 0.35, 0.09, 0.45);
  float alpha2 = pow(rough, 4.0);
  float denom = NoH * NoH * (alpha2 - 1.0) + 1.0;
  float D = alpha2 / max(PI * denom * denom, 0.00001);
  float k = pow(rough + 1.0, 2.0) / 8.0;
  float G = NoV / (NoV * (1.0 - k) + k) * NoL / (NoL * (1.0 - k) + k);
  float F = 0.02037 + 0.97963 * pow(1.0 - max(dot(V, H), 0.0), 5.0);
  color += uSunColor * min(D * G * F / max(4.0 * NoV, 0.05), 3.0) * shadow;
  vec2 foamUV = vRest.xz - field.gb * uTime * 0.6;
  float broken = noise(foamUV * 19.0) * 0.6 + noise(foamUV * 43.0) * 0.4;
  float shore = (1.0 - smoothstep(0.012, 0.065, field.r)) * smoothstep(0.38, 0.7, broken) * 0.45;
  float foam = clamp(state.a * smoothstep(0.22, 0.72, broken) * 1.6 + shore, 0.0, 0.75);
  color = mix(color, vec3(0.69, 0.77, 0.70) * (0.45 + shadow * 0.55) * (1.0 - uDusk * 0.55), foam);
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;
