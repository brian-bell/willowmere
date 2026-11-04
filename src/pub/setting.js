import * as T from "three";
import { PUB } from "./layout.js";

// The pub's sky, sun and lamps, shared by its study and its walkable room. The
// lamps are a fixed set: blue hour changes only their strength, so no program
// ever recompiles. The two shadow-casting lights stay still and nothing that
// moves casts, so their maps render only when asked.

const DAY = {
  top: new T.Color("#9dbcd0"),
  bottom: new T.Color("#e9e3c8"),
  fog: new T.Color("#dcdcc4"),
  sun: new T.Color("#ffe7c4"),
  hemi: new T.Color("#edf1dc"),
};
const DUSK = {
  top: new T.Color("#2b3a60"),
  bottom: new T.Color("#d08f6e"),
  fog: new T.Color("#5e6a80"),
  sun: new T.Color("#ff9d6a"),
  hemi: new T.Color("#8ba8e2"),
};

/**
 * Lights `scene` for the pub, with `glass` as its window material.
 * `reach` is how far the eye sees: the fog closes and the sky hangs inside it.
 */
export function createPubSetting(scene, glass, { reach = 118, shadowSize = 4096, shadowReach = 21 } = {}) {
  const skyColors = { top: { value: new T.Color() }, bottom: { value: new T.Color() } };
  const sky = new T.Mesh(
    new T.SphereGeometry(reach * 0.95, 24, 12),
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
  sky.renderOrder = -1;
  scene.add(sky);
  scene.fog = new T.Fog("#cfd9c4", reach * 0.29, reach * 0.9);

  // Golden afternoon comes in low over the street and through the front windows.
  const sun = new T.DirectionalLight("#ffe7c4", 2.6);
  sun.position.set(-18, 15, 22);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(shadowSize);
  Object.assign(sun.shadow.camera, {
    left: -shadowReach,
    right: shadowReach,
    top: shadowReach - 2,
    bottom: -shadowReach + 4,
    near: 2,
    far: 70,
  });
  sun.shadow.bias = -0.00022;
  sun.shadow.normalBias = 0.022;
  sun.shadow.autoUpdate = false;
  const hemi = new T.HemisphereLight("#edf1dc", "#6f7a5f", 1.15);
  const fill = new T.DirectionalLight("#d6e4ef", 0.5);
  fill.position.set(16, 10, -18);
  scene.add(sun, sun.target, hemi, fill);

  const lights = {
    fire: new T.PointLight("#ff9a4f", 22, 16, 1.9),
    wheelA: new T.PointLight("#ffc98a", 8, 10, 1.9),
    wheelB: new T.PointLight("#ffc98a", 8, 10, 1.9),
    bar: new T.PointLight("#ffbf7c", 5, 7, 1.9),
    loftEast: new T.PointLight("#ffc98a", 5, 7.5, 1.9),
    loftWest: new T.PointLight("#ffc98a", 5, 7.5, 1.9),
    porch: new T.PointLight("#ffbe73", 3, 8, 1.9),
  };
  lights.fire.position.set(-5.5, 0.85, 0);
  lights.wheelA.position.set(-3, 3.15, 0);
  lights.wheelB.position.set(0, 3.15, 0);
  lights.bar.position.set(2.7, 2.42, -1.05);
  lights.loftEast.position.set(4.5, PUB.loft + 1.72, -1.5);
  lights.loftWest.position.set(-3, PUB.loft + 1.72, 2.5);
  lights.porch.position.set(0, 2.68, PUB.gallery.front - 0.45);
  lights.fire.castShadow = true;
  lights.fire.shadow.mapSize.set(1024, 1024);
  lights.fire.shadow.camera.near = 0.15;
  lights.fire.shadow.camera.far = 16;
  lights.fire.shadow.bias = -0.002;
  lights.fire.shadow.normalBias = 0.03;
  lights.fire.shadow.autoUpdate = false;
  for (const light of Object.values(lights)) scene.add(light);

  return {
    sun,
    fire: lights.fire,
    /** Renders both shadow maps on the next frame. */
    refreshShadows() {
      sun.shadow.needsUpdate = true;
      lights.fire.shadow.needsUpdate = true;
    },
    /**
     * `dusk` runs from golden afternoon (0) to blue hour (1), `indoors` from a
     * bright yard (0) to under the roof (1), and `t` drives the flames' flicker.
     */
    apply(dusk, indoors, t, eye) {
      const d = dusk,
        k = indoors;
      skyColors.top.value.lerpColors(DAY.top, DUSK.top, d);
      skyColors.bottom.value.lerpColors(DAY.bottom, DUSK.bottom, d);
      scene.fog.color.lerpColors(DAY.fog, DUSK.fog, d);
      sun.color.lerpColors(DAY.sun, DUSK.sun, d);
      sun.intensity = 2.6 - 2.15 * d;
      hemi.color.lerpColors(DAY.hemi, DUSK.hemi, d);
      // The sky's light is what would flood through the walls indoors, so going
      // inside dims it to what the windows and the open well can actually bring.
      hemi.intensity = (1.15 - 0.45 * d) * (1 - 0.68 * k);
      fill.intensity = (0.5 - 0.3 * d) * (1 - 0.8 * k);
      scene.environmentIntensity = (0.32 - 0.14 * d) * (1 - 0.5 * k);
      // Lamps work at any hour, but a bright yard outshines them.
      const lamp = 0.25 + 0.75 * Math.max(d, k),
        fireFlicker = 1 + Math.sin(t * 8.3) * 0.09 + Math.sin(t * 13.7 + 1.2) * 0.06 + Math.sin(t * 3.1) * 0.05,
        a = 1 + Math.sin(t * 5.1) * 0.03 + Math.sin(t * 11.3) * 0.02,
        b = 1 + Math.sin(t * 4.3 + 2) * 0.03 + Math.sin(t * 9.7) * 0.02;
      lights.fire.intensity = (5 + 6 * Math.max(d, k)) * fireFlicker;
      lights.wheelA.intensity = 9 * lamp * a;
      lights.wheelB.intensity = 9 * lamp * b;
      lights.bar.intensity = 5 * lamp;
      lights.loftEast.intensity = 5.5 * lamp * b;
      lights.loftWest.intensity = 5.5 * lamp * a;
      lights.porch.intensity = 0.4 + 5 * d;
      glass.emissiveIntensity = d * 0.75 * (1 - 0.75 * k);
      glass.opacity = 0.26 + d * 0.24 * (1 - k);
      sky.position.copy(eye);
    },
  };
}
