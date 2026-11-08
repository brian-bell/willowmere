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
  const k = createKit(T, { segments: 10, sphereDetail: 1 }),
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
      // What has grown so far belongs to the frame it was grown in.
      settle();
      k.placed(x, 0, z, ry, () => {
        build();
        settle();
      });
    },
    /**
     * A rambling rose along a stem through `points` ([x, y, z] each): leafy
     * clusters with flowers dotted through them, and a few strands hanging.
     */
    rambler(points, bloom, hang = 3) {
      const [petal, eye] = planters.blooms[bloom],
        greens = planters.foliage.geranium,
        { range } = planters;
      for (let i = 1; i < points.length; i++) {
        const [ax, ay, az] = points[i - 1],
          [bx, by, bz] = points[i],
          steps = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay, bz - az) / 0.12));
        k.beam("#5d5a3c", points[i - 1], points[i], 0.02);
        for (let j = 0; j < steps; j++) {
          const f = (j + 0.5) / steps,
            x = ax + (bx - ax) * f,
            y = ay + (by - ay) * f,
            z = az + (bz - az) * f;
          // A dark core fills the gaps between the leafy shoots springing from it.
          k.ball(greens[0], x, y, z, 0.07, 0.06, 0.07);
          for (let n = 0; n < 4; n++) {
            const a = range(0, Math.PI * 2);
            planters.trail(x, y + 0.05, z, range(0.16, 0.3), greens, Math.cos(a), Math.sin(a));
          }
          for (let n = 0; n < (j % 2) + 1; n++) {
            const fx = x + range(-0.12, 0.12),
              fy = y + range(-0.06, 0.1),
              fz = z + range(-0.12, 0.12);
            k.ball(petal, fx, fy, fz, 0.04, 0.032, 0.04);
            k.ball(eye, fx, fy + 0.02, fz, 0.02);
          }
        }
      }
      // Strands hanging from the stem's highest stretch.
      const top = points.reduce((a, b) => (b[1] > a[1] ? b : a));
      for (let i = 0; i < hang; i++)
        planters.trail(top[0] + range(-0.15, 0.15), top[1], top[2] + range(-0.08, 0.08), range(0.3, 0.55), planters.foliage.geranium, 0, -0.3);
    },
    /** A climbing rose on a painted trellis against a wall facing -z. */
    climber(x, z, width, height, bloom, trellis = "#e8dcbb") {
      settle();
      const bars = Math.max(2, Math.round(width / 0.22));
      for (let i = 0; i <= bars; i++) {
        const xx = x - width / 2 + (i / bars) * width;
        k.box(trellis, xx, 0.35 + height / 2, z, 0.025, height, 0.025);
      }
      for (let y = 0.6; y < height + 0.3; y += 0.32) k.box(trellis, x, y, z - 0.015, width + 0.04, 0.025, 0.02);
      const points = [];
      for (let y = 0.2; y <= height + 0.3; y += 0.4) points.push([x + Math.sin(y * 3.1) * width * 0.3, y, z - 0.07]);
      this.rambler(points, bloom);
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
