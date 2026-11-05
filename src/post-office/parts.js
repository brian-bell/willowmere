import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createRoomKit } from "../interior-kit.js";

// The rooms' kit with the few things a room this full of small parts wants:
// sharp boxes (12 triangles rather than a rounded box's hundreds), rods between
// two points, boxes whose texture is laid out in metres so pieces of a wall line
// up, and a way to merge a moving group, which the room's bake leaves alone.
export function createParts(root, seed) {
  const kit = createRoomKit(root, seed);
  const { mesh, box } = kit;
  const b = (m, x, y, z, w, h, d, p = root) => box(m, x, y, z, w, h, d, 0, p);
  const rb = (m, x, y, z, w, h, d, r = 0.015, p = root) => box(m, x, y, z, w, h, d, r, p);
  const up = new T.Vector3(0, 1, 0);

  /** A round bar from `a` to `c`. */
  function rod(m, a, c, r = 0.02, segments = 6, p = root) {
    const start = new T.Vector3(...a),
      end = new T.Vector3(...c),
      o = mesh(new T.CylinderGeometry(r, r, start.distanceTo(end), segments), m, 0, 0, 0, p);
    o.position.copy(start).add(end).multiplyScalar(0.5);
    o.quaternion.setFromUnitVectors(up, end.sub(start).normalize());
    return o;
  }

  /** A box textured in metres: `su` and `sv` metres to a repeat, V counted from `v0`. */
  function tiled(m, x, y, z, w, h, d, su = 1.6, sv = su, p = root, v0 = 0) {
    const g = new T.BoxGeometry(w, h, d),
      { position, normal, uv } = g.attributes;
    for (let i = 0; i < position.count; i++) {
      const px = position.getX(i) + x,
        py = position.getY(i) + y,
        pz = position.getZ(i) + z;
      if (Math.abs(normal.getX(i)) > 0.5) uv.setXY(i, pz / su, (py - v0) / sv);
      else if (Math.abs(normal.getY(i)) > 0.5) uv.setXY(i, px / su, pz / sv);
      else uv.setXY(i, px / su, (py - v0) / sv);
    }
    return mesh(g, m, x, y, z, p);
  }

  /** A flat band on the floor, its texture repeating along its length. */
  function strip(m, x, y, z, length, width, repeat, turn = 0, p = root) {
    const g = new T.PlaneGeometry(length, width),
      { uv } = g.attributes;
    for (let i = 0; i < uv.count; i++) uv.setX(i, (uv.getX(i) * length) / repeat);
    const o = mesh(g, m, x, y, z, p);
    o.rotation.set(-Math.PI / 2, 0, turn);
    o.castShadow = false;
    return o;
  }

  /** A turned shape from [radius, height] pairs. */
  function turned(m, profile, x, y, z, segments = 18, p = root) {
    return mesh(
      new T.LatheGeometry(profile.map(([r, h]) => new T.Vector2(r, h)), segments),
      m,
      x,
      y,
      z,
      p,
    );
  }

  /**
   * Merges a moving group's meshes by material, in the group's own space, so it
   * costs a draw per material rather than one per part. Children in `spare`
   * keep moving on their own.
   */
  function mergeGroup(group, spare = new Set()) {
    group.updateMatrixWorld(true);
    const inverse = new T.Matrix4().copy(group.matrixWorld).invert(),
      batches = new Map(),
      relative = new T.Matrix4();
    group.traverse((o) => {
      if (!o.isMesh || o.material.transparent) return;
      for (let q = o; q && q !== group; q = q.parent) if (spare.has(q)) return;
      if (!batches.has(o.material)) batches.set(o.material, []);
      batches.get(o.material).push(o);
    });
    for (const [material, items] of batches) {
      if (items.length < 2) continue;
      const parts = items.map((o) => {
        const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        return g.applyMatrix4(relative.multiplyMatrices(inverse, o.matrixWorld));
      });
      const merged = mergeGeometries(parts);
      parts.forEach((g) => g.dispose());
      if (!merged) continue;
      items.forEach((o) => o.removeFromParent());
      const whole = new T.Mesh(merged, material);
      whole.receiveShadow = true;
      group.add(whole);
    }
    return group;
  }

  return { ...kit, root, b, rb, rod, tiled, strip, turned, mergeGroup };
}
