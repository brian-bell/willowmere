import * as THREE from "three";
import { Pass, FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

// Bloom with the response of UnrealBloomPass (strength, radius, threshold), but
// every pass runs at quarter resolution or below. The result is not blended
// back into the scene target: BloomOutputPass adds it while tone mapping, so no
// full-resolution pass touches the multisampled scene buffer a second time.
const LEVELS = 5;
// Blur sigma per level, in that level's texels. Level 0 is a quarter of the
// drawing buffer; with the halving between levels these widths match
// UnrealBloomPass's five half-resolution-based mips.
const SIGMAS = [0.8, 1.1, 1.6, 2.2, 2.7];
const BLOOM_FACTORS = [1.0, 0.8, 0.6, 0.4, 0.2];

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

function target(name) {
  const t = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    depthBuffer: false,
  });
  t.texture.name = name;
  t.texture.generateMipmaps = false;
  return t;
}

function blurMaterial(sigma) {
  const radius = Math.ceil(sigma * 2.5);
  const weights = Array.from({ length: radius + 1 }, (_, i) =>
    Math.exp((-0.5 * i * i) / (sigma * sigma)),
  );
  const sum = weights.reduce((a, w, i) => a + (i ? 2 * w : w), 0);
  return new THREE.ShaderMaterial({
    defines: { RADIUS: radius },
    uniforms: {
      tInput: { value: null },
      step: { value: new THREE.Vector2() },
      weights: { value: weights.map((w) => w / sum) },
    },
    vertexShader,
    fragmentShader: /* glsl */ `
      uniform sampler2D tInput;
      uniform vec2 step;
      uniform float weights[RADIUS + 1];
      varying vec2 vUv;
      void main() {
        vec3 sum = texture2D(tInput, vUv).rgb * weights[0];
        for (int i = 1; i <= RADIUS; i++) {
          vec2 offset = step * float(i);
          sum += (texture2D(tInput, vUv + offset).rgb +
            texture2D(tInput, vUv - offset).rgb) * weights[i];
        }
        gl_FragColor = vec4(sum, 1.0);
      }`,
    depthTest: false,
    depthWrite: false,
  });
}

export class SoftBloomPass extends Pass {
  constructor(strength = 1, radius = 0, threshold = 1) {
    super();
    this.strength = strength;
    this.radius = radius;
    this.threshold = threshold;
    this.needsSwap = false;
    this.bright = target("SoftBloom.bright");
    this.horizontal = [];
    this.vertical = [];
    for (let i = 0; i < LEVELS; i++) {
      this.horizontal.push(target(`SoftBloom.h${i}`));
      this.vertical.push(target(`SoftBloom.v${i}`));
    }
    this.result = target("SoftBloom.result");
    // Each quarter-resolution texel averages four thresholded 2 × 2 taps, the
    // same input UnrealBloomPass thresholds at half resolution.
    this.brightMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        texel: { value: new THREE.Vector2() },
        threshold: { value: threshold },
      },
      vertexShader,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform vec2 texel;
        uniform float threshold;
        varying vec2 vUv;
        vec3 bright(vec2 uv) {
          vec3 c = texture2D(tDiffuse, uv).rgb;
          return c * smoothstep(threshold, threshold + 0.01, luminance(c));
        }
        void main() {
          gl_FragColor = vec4(0.25 * (
            bright(vUv + vec2(-texel.x, -texel.y)) +
            bright(vUv + vec2(texel.x, -texel.y)) +
            bright(vUv + vec2(-texel.x, texel.y)) +
            bright(vUv + vec2(texel.x, texel.y))), 1.0);
        }`,
      depthTest: false,
      depthWrite: false,
    });
    this.blurMaterials = SIGMAS.map(blurMaterial);
    this.compositeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        levels: { value: this.vertical.map((t) => t.texture) },
        factors: { value: new Array(LEVELS).fill(0) },
      },
      vertexShader,
      fragmentShader: /* glsl */ `
        uniform sampler2D levels[${LEVELS}];
        uniform float factors[${LEVELS}];
        varying vec2 vUv;
        void main() {
          vec3 sum = vec3(0.0);
          ${Array.from(
            { length: LEVELS },
            (_, i) =>
              `sum += factors[${i}] * texture2D(levels[${i}], vUv).rgb;`,
          ).join("\n")}
          gl_FragColor = vec4(sum, 1.0);
        }`,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(null);
  }

  get texture() {
    return this.result.texture;
  }

  setSize(width, height) {
    this.brightMaterial.uniforms.texel.value.set(1 / width, 1 / height);
    let w = Math.max(1, Math.round(width / 4)),
      h = Math.max(1, Math.round(height / 4));
    this.bright.setSize(w, h);
    this.result.setSize(w, h);
    for (let i = 0; i < LEVELS; i++) {
      this.horizontal[i].setSize(w, h);
      this.vertical[i].setSize(w, h);
      this.blurMaterials[i].userData.size = [w, h];
      w = Math.max(1, Math.round(w / 2));
      h = Math.max(1, Math.round(h / 2));
    }
  }

  draw(renderer, material, output) {
    this.quad.material = material;
    renderer.setRenderTarget(output);
    this.quad.render(renderer);
  }

  render(renderer, writeBuffer, readBuffer) {
    const brightUniforms = this.brightMaterial.uniforms;
    brightUniforms.tDiffuse.value = readBuffer.texture;
    brightUniforms.threshold.value = this.threshold;
    this.draw(renderer, this.brightMaterial, this.bright);
    let input = this.bright;
    for (let i = 0; i < LEVELS; i++) {
      const material = this.blurMaterials[i],
        [w, h] = material.userData.size;
      // The horizontal pass also downsamples the previous level by sampling
      // it bilinearly at this level's texel centers.
      material.uniforms.tInput.value = input.texture;
      material.uniforms.step.value.set(1 / w, 0);
      this.draw(renderer, material, this.horizontal[i]);
      material.uniforms.tInput.value = this.horizontal[i].texture;
      material.uniforms.step.value.set(0, 1 / h);
      this.draw(renderer, material, this.vertical[i]);
      input = this.vertical[i];
    }
    const factors = this.compositeMaterial.uniforms.factors.value;
    for (let i = 0; i < LEVELS; i++)
      factors[i] =
        this.strength *
        THREE.MathUtils.lerp(
          BLOOM_FACTORS[i],
          1.2 - BLOOM_FACTORS[i],
          this.radius,
        );
    // UnrealBloomPass blends its composite with SRC_ALPHA, and that alpha is
    // the sum of these factors. Apply it too so the strength keeps its look.
    const alpha = factors.reduce((a, b) => a + b, 0);
    for (let i = 0; i < LEVELS; i++) factors[i] *= alpha;
    this.draw(renderer, this.compositeMaterial, this.result);
  }

  dispose() {
    for (const t of [
      this.bright,
      this.result,
      ...this.horizontal,
      ...this.vertical,
    ])
      t.dispose();
    for (const m of [
      this.brightMaterial,
      this.compositeMaterial,
      ...this.blurMaterials,
    ])
      m.dispose();
    this.quad.dispose();
  }
}

// OutputPass that adds a SoftBloomPass result before tone mapping.
export class BloomOutputPass extends OutputPass {
  constructor(bloom) {
    super();
    this.bloom = bloom;
    this.none = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    this.none.needsUpdate = true;
    this.uniforms.tBloom = { value: this.none };
    const sample = "gl_FragColor = texture2D( tDiffuse, vUv );";
    if (!this.material.fragmentShader.includes(sample))
      throw Error("OutputShader changed; update BloomOutputPass.");
    this.material.fragmentShader = this.material.fragmentShader
      .replace(
        "uniform sampler2D tDiffuse;",
        "uniform sampler2D tDiffuse;\nuniform sampler2D tBloom;",
      )
      .replace(
        sample,
        `${sample}\ngl_FragColor.rgb += texture2D( tBloom, vUv ).rgb;`,
      );
  }

  render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
    this.uniforms.tBloom.value = this.bloom.enabled
      ? this.bloom.texture
      : this.none;
    super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
  }

  dispose() {
    this.none.dispose();
    super.dispose();
  }
}
