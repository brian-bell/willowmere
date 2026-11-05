import { BODY_DEPTH, createShapes, radiusAt } from "./shapes.js";

const channels = (color) => [(color >> 16) & 255, (color >> 8) & 255, color & 255];
const pack = ([r, g, b]) =>
  (Math.min(255, Math.round(r)) << 16) |
  (Math.min(255, Math.round(g)) << 8) |
  Math.min(255, Math.round(b));

/** A colour made darker (k < 1) or lighter (k > 1), as hexadecimal. */
export const shade = (color, k) => pack(channels(color).map((c) => c * k));
/** A colour part of the way to another. */
export const mix = (a, b, t) => {
  const to = channels(b);
  return pack(channels(a).map((c, i) => c + (to[i] - c) * t));
};

/**
 * The few verbs every piece of a person is built with. `material(color)` gives
 * the shared plain material for a colour, which the batching in src/life.js
 * later bakes into vertex colours.
 */
export function createKit(THREE, material) {
  const shapes = createShapes(THREE);
  const up = new THREE.Vector3(0, 1, 0);
  const kit = {
    THREE,
    shapes,
    /** One part: a named or given shape, placed, scaled and turned. */
    part(parent, shape, color, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) {
      const mesh = new THREE.Mesh(
        typeof shape === "string" ? shapes[shape] : shape,
        material(color),
      );
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      mesh.rotation.set(rx, ry, rz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    },
    /** A strap, stem or rod laid between two points; its thin side faces forward. */
    span(parent, shape, color, a, b, width, thick = width) {
      const from = new THREE.Vector3(...a),
        to = new THREE.Vector3(...b),
        along = to.clone().sub(from),
        length = along.length();
      const mesh = kit.part(
        parent,
        shape,
        color,
        (a[0] + b[0]) / 2,
        (a[1] + b[1]) / 2,
        (a[2] + b[2]) / 2,
        width,
        length,
        thick,
      );
      mesh.quaternion.setFromUnitVectors(up, along.normalize());
      return mesh;
    },
    group(parent, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
      const group = new THREE.Group();
      group.position.set(x, y, z);
      group.rotation.set(rx, ry, rz);
      parent.add(group);
      return group;
    },
    /** Cloth over a body: takes the body's front-to-back squash. */
    wear(parent, geometry, color) {
      return kit.part(parent, geometry, color, 0, 0, 0, 1, 1, BODY_DEPTH);
    },
    /** How far forward a body's surface is at x and y, for laying things on it. */
    onBody(profile, x, y, lift = 0.004) {
      const r = radiusAt(profile, y);
      return Math.sqrt(Math.max(0, r * r - x * x)) * BODY_DEPTH + lift;
    },
    /**
     * Folds a group that will never move into its parent, so its parts merge
     * with the parent's and it costs no draw of its own. Its transform may
     * only turn and move, or its children would shear.
     */
    flatten(group) {
      group.updateMatrix();
      const { parent } = group;
      for (const child of [...group.children]) {
        child.applyMatrix4(group.matrix);
        parent.add(child);
      }
      group.removeFromParent();
    },
  };
  return kit;
}
