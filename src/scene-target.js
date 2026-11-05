import * as THREE from "three";

// Options for the multisampled target a scene draws into. Its colour stays HDR
// for bloom but needs no alpha, so where the GPU can multisample 11-11-10 float
// it takes half the memory of RGBA16F, and half the bandwidth to resolve. Frames
// differ from RGBA16F's by under a level on average, without visible banding
// (see docs/performance.md). Nothing reads the scene's depth after the pass
// (water resolves its own copy earlier), so the end-of-pass depth resolve is
// skipped.
export function sceneTargetOptions(renderer, maxSamples) {
  const gl = renderer.getContext();
  const counts = renderer.extensions.has("EXT_color_buffer_float")
    ? gl.getInternalformatParameter(gl.RENDERBUFFER, gl.R11F_G11F_B10F, gl.SAMPLES)
    : null;
  const format =
    counts?.[0] >= maxSamples
      ? { format: THREE.RGBFormat, type: THREE.UnsignedInt101111Type }
      : { type: THREE.HalfFloatType };
  return { ...format, resolveDepthBuffer: false };
}
