import * as THREE from "three";

// Three renders a shadow map as depth packed into an RGBA colour target with a
// depth buffer behind it, and reads it back with sixteen fetches and unpacks per
// lit fragment. Shadows are the largest part of the frame (see
// docs/performance.md), so the sun and spot lights here use a depth texture alone,
// with no colour attachment to clear and store, which the fragment reads through
// the hardware's comparison filter (src/shader-chunks.js). Point lights keep
// three's own packed cube maps.
//
// `src/shader-chunks.js` patches the shaders to match, so every page that imports
// it must call this on its renderer, before the first render.

function createDepthTarget(renderer, width, height, name) {
  const depthTexture = new THREE.DepthTexture(width, height, THREE.FloatType);
  depthTexture.compareFunction = THREE.LessEqualCompare;
  depthTexture.magFilter = depthTexture.minFilter = THREE.LinearFilter;
  depthTexture.name = name;
  const target = new THREE.WebGLRenderTarget(width, height, {
    depthTexture,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
  });
  // Three insists on a colour attachment, so let it make one, then take it away.
  renderer.initRenderTarget(target);
  const gl = renderer.getContext();
  renderer.state.bindFramebuffer(
    gl.FRAMEBUFFER,
    renderer.properties.get(target).__webglFramebuffer,
  );
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
  // Texture.dispose() skips a render target's own texture, so free it here. Three
  // frees only what it finds left when the target itself is disposed.
  const color = renderer.properties.get(target.texture);
  gl.deleteTexture(color.__webglTexture);
  delete color.__webglTexture;
  renderer.info.memory.textures--;
  // What three binds as the light's shadow map is `map.texture`.
  Object.defineProperty(target, "texture", { value: depthTexture });
  // A capture can read a map before its first update: nothing is shadowed yet.
  const previous = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  renderer.clear();
  renderer.setRenderTarget(previous);
  return target;
}

export function useDepthShadowMaps(renderer) {
  // What runs around each update of a scene's shadow maps (see `around`).
  const hooks = new Map();
  function install() {
    const shadowMap = renderer.shadowMap,
      render = shadowMap.render;
    // Three makes a map only where a light has none, so give each light its own
    // first. A light that resizes sets its `map` to null, as it would anyway, and
    // a map from before a lost context has no framebuffer any more.
    shadowMap.render = function (lights, scene, camera) {
      if (shadowMap.enabled)
        for (const light of lights) {
          const shadow = light.shadow;
          if (light.isPointLight) continue;
          if (shadow.map && renderer.properties.get(shadow.map).__webglFramebuffer) continue;
          shadow.map = createDepthTarget(
            renderer,
            shadow.mapSize.x,
            shadow.mapSize.y,
            `${light.name}.shadowMap`,
          );
          shadow.camera.updateProjectionMatrix();
        }
      const around = hooks.get(scene);
      if (!around || !shadowMap.enabled || (!shadowMap.autoUpdate && !shadowMap.needsUpdate))
        return render.call(shadowMap, lights, scene, camera);
      for (const { before } of around) before();
      try {
        render.call(shadowMap, lights, scene, camera);
      } finally {
        for (const { after } of around) after();
      }
    };
  }
  install();
  // A context coming back makes three build a new shadow renderer (its own
  // listener ran first, being older).
  renderer.domElement.addEventListener("webglcontextrestored", install);
  return {
    /**
     * Runs `before` and `after` around every update of `scene`'s shadow maps,
     * so what casts into them can differ from what the view draws (shrubs
     * cast with their coarse leaves). By then three has gathered the view's
     * draws, each with its geometry, so swapping a mesh's geometry changes
     * only its shadow; it reads an instanced mesh's count as it draws, so
     * `after` must put any count back.
     */
    around(scene, ...levels) {
      if (!hooks.has(scene)) hooks.set(scene, []);
      hooks.get(scene).push(...levels);
    },
  };
}
