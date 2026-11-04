import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";

// Soft contact occlusion for a room. The blur keeps its look at half
// resolution, which quarters the normal pass, sampling and blur fill.
export class InteriorAO extends SSAOPass {
  resolutionScale = 0.5;

  setSize(width, height) {
    super.setSize(
      Math.max(1, Math.round(width * this.resolutionScale)),
      Math.max(1, Math.round(height * this.resolutionScale)),
    );
  }

  setKernelSize(size) {
    if (this.kernel.length === size) return;
    this.kernel.length = 0;
    this._generateSampleKernel(size);
    this.ssaoMaterial.defines.KERNEL_SIZE = size;
    this.ssaoMaterial.needsUpdate = true;
  }

  render(renderer, ...args) {
    // RenderPass already updated the shadows for this frame. The normal pass
    // needs only geometry, so reuse those same shadow maps.
    const autoUpdate = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    try {
      super.render(renderer, ...args);
    } finally {
      renderer.shadowMap.autoUpdate = autoUpdate;
    }
  }

  _overrideVisibility() {
    super._overrideVisibility();
    this.scene.traverse((object) => {
      if ((object.isMesh || object.isSprite) && object.visible && object.material.transparent) {
        object.visible = false;
        this._visibilityCache.push(object);
      }
    });
  }
}
