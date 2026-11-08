// Small outdoor detail around the village's houses: climbing roses, pots and
// beds, door knobs, logs and sacks. Each place merges its detail into one
// vertex-coloured mesh. world.js keeps these meshes out of the village's bake
// and hides them when the overview zooms far out (and beyond first person's
// detail range), as the regions do with their fine parts, so they cost
// nothing in the zoom-cap view. The builders draw only from their own planting
// stream, so the rest of the village keeps its layout.

import { createKit } from "../regions/kit.js";
import { createPlanters } from "../planters.js";

/** A fresh detail builder for one place; `seed` starts its planting stream. */
export function createFine(T, seed) {
  const k = createKit(T, { segments: 8, sphereDetail: 1 }),
    planters = createPlanters(seed),
    scratch = new T.Group();
  // Moves what the planters have grown so far into the kit, so it is moved
  // with whatever frame the kit is building in.
  function settle() {
    const mesh = planters.flush(scratch);
    if (!mesh) return;
    mesh.removeFromParent();
    k.piece(mesh.geometry);
  }
  return {
    k,
    planters,
    /** A planters recipe (geranium, daisies, lavender, spires, topiary) in a named bloom. */
    plant(recipe, bloom, x, y, z, r, ...rest) {
      planters.recipes[recipe](x, y, z, r, planters.blooms[bloom], ...rest);
    },
    /**
     * Builds in a frame at (x, 0, z) turned by ry (a house's own coordinates);
     * frames nest.
     */
    at(x, z, ry, build) {
      k.placed(x, 0, z, ry, () => {
        build();
        settle();
      });
    },
    /** A climbing rose: a painted trellis with rose clumps up it, against a wall facing -z. */
    climber(x, z, width, height, bloom, trellis = "#e8dcbb") {
      const bars = Math.max(2, Math.round(width / 0.22));
      for (let i = 0; i <= bars; i++) {
        const xx = x - width / 2 + (i / bars) * width;
        k.box(trellis, xx, 0.35 + height / 2, z, 0.025, height, 0.025);
      }
      for (let y = 0.6; y < height + 0.3; y += 0.32) k.box(trellis, x, y, z - 0.015, width + 0.04, 0.025, 0.02);
      const clumps = Math.round(height / 0.26);
      for (let i = 0; i < clumps; i++) {
        const f = i / Math.max(1, clumps - 1),
          xx = x + Math.sin(i * 2.3) * width * 0.38 * (0.4 + f * 0.6),
          yy = 0.3 + f * height;
        planters.recipes.geranium(xx, yy, z - 0.06, 0.13 + 0.05 * Math.sin(i * 1.7) ** 2, planters.blooms[bloom]);
      }
      settle();
    },
    /** Everything built, as one mesh added to `scene`, or null when nothing was. */
    finish(name, scene) {
      settle();
      const geometry = k.geometry();
      k.dispose();
      if (!geometry) return null;
      const mesh = new T.Mesh(geometry, planters.material);
      mesh.name = name;
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      scene.add(mesh);
      return mesh;
    },
  };
}
