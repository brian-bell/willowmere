// The map's chunks and the bake that fills them. Static scenery, instanced
// detail, glowing materials and animations are grouped by chunk, so a view
// only pays for the chunks it can see. The village's plain meshes bake into
// one draw per chunk, material and shadow role; small detail (grass,
// blossoms, pebbles) hides beyond first person's detail range. Streamed
// regions join the same chunks through world.addStreamed.
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { WORLD, chunkBounds, chunkCoords, terrainMaxIn } from "./world-layout.js";

/**
 * The chunk grid, made as it is first touched: `chunkAt(x, z)` gives the
 * chunk under a point, `chunkOf(node)` the chunk under a mesh's centre, and
 * `animate(x, z, update)` registers an animation that runs while its chunk
 * is in view.
 */
export function createChunks(T) {
  const chunks = new Map();
  function chunkAt(x, z) {
    const [cx, cz] = chunkCoords(x, z),
      key = `${cx},${cz}`;
    if (!chunks.has(key)) {
      const { minX, maxX, minZ, maxZ } = chunkBounds(cx, cz);
      chunks.set(key, {
        key,
        cx,
        cz,
        // A margin covers parts that reach over the chunk's edge.
        bounds: new T.Box3(
          new T.Vector3(minX - 2, -2, minZ - 2),
          new T.Vector3(
            maxX + 2,
            terrainMaxIn(minX - 2, maxX + 2, minZ - 2, maxZ + 2) + WORLD.canopy + 2,
            maxZ + 2,
          ),
        ),
        meshes: [],
        animations: [],
        glow: new Set(),
      });
    }
    return chunks.get(key);
  }
  const center = new T.Vector3();
  const chunkOf = (node) => {
    if (node.isInstancedMesh) {
      node.computeBoundingSphere();
      center.copy(node.boundingSphere.center);
    } else {
      if (!node.geometry.boundingSphere) node.geometry.computeBoundingSphere();
      center.copy(node.geometry.boundingSphere.center);
    }
    center.applyMatrix4(node.matrixWorld);
    return chunkAt(center.x, center.z);
  };
  function animate(x, z, update) {
    chunkAt(x, z).animations.push(update);
  }
  // Animations run only for chunks the view, or the sun's shadow, can see.
  const visibleChunks = new Set();
  /**
   * Runs the animations of every chunk inside one of `frustums` (every
   * chunk without frustums).
   */
  function update(dt, time, clock, frustums) {
    visibleChunks.clear();
    for (const chunk of chunks.values()) {
      if (!chunk.animations.length) continue;
      if (frustums && !frustums.some((f) => f.intersectsBox(chunk.bounds)))
        continue;
      visibleChunks.add(chunk.key);
      for (const f of chunk.animations) f(dt, time, clock);
    }
  }
  return { chunks, chunkAt, chunkOf, animate, update, animatedChunks: () => [...visibleChunks] };
}

/**
 * Bakes the scene's static meshes into one draw per chunk, material and
 * shadow role, and splits its instanced detail per chunk. Each batch has
 * bounds that hug its chunk, so the main, shadow and reflection passes skip
 * chunks out of view. Plain-coloured materials that differ only in colour
 * share one vertex-coloured material per finish, which keeps the number of
 * batches per chunk low.
 *
 * Roots in `skip` stay as they are. Meshes under a group in `selfCulled`
 * (the trees, which cull per specimen) only join their chunk. Returns every
 * lit material it found, which brightens at blue hour.
 */
export function bakeScenery(T, scene, { chunkAt, chunkOf }, { skip, selfCulled }) {
  scene.updateMatrixWorld(true);
  const point = new T.Vector3(),
    instanceMatrix = new T.Matrix4(),
    instanceColor = new T.Color();
  const plainMaterial = (m) =>
    m.type === "MeshStandardMaterial" &&
    !m.vertexColors &&
    !m.transparent &&
    m.onBeforeCompile === T.Material.prototype.onBeforeCompile &&
    m.emissive.getHex() === 0 &&
    ![
      "map",
      "lightMap",
      "aoMap",
      "emissiveMap",
      "bumpMap",
      "normalMap",
      "displacementMap",
      "roughnessMap",
      "metalnessMap",
      "alphaMap",
      "envMap",
    ].some((slot) => m[slot]);
  const sharedMaterials = new Map();
  function bakedMaterial(m) {
    if (!plainMaterial(m)) return m;
    const key = [m.roughness, m.metalness, m.side, m.flatShading, m.shadowSide].join("/");
    if (!sharedMaterials.has(key)) {
      const shared = m.clone();
      shared.color.set(0xffffff);
      shared.vertexColors = true;
      sharedMaterials.set(key, shared);
    }
    return sharedMaterials.get(key);
  }
  // Every draw has a fixed cost, so a chunk's share of a batch smaller than
  // this joins the same batch in a neighbouring chunk instead of drawing alone.
  const MIN_BATCH_TRIANGLES = 4000;
  // Merges small parts ({ chunk, items, triangles }) into the largest part
  // within one chunk of them, smallest first, and returns the parts left.
  function clusterParts(parts) {
    const sorted = [...parts].sort((a, b) => a.triangles - b.triangles);
    for (const part of sorted) {
      if (part.merged || part.triangles >= MIN_BATCH_TRIANGLES) continue;
      let target = null;
      for (const other of sorted)
        if (
          other !== part &&
          !other.merged &&
          Math.abs(other.chunk.cx - part.chunk.cx) <= 1 &&
          Math.abs(other.chunk.cz - part.chunk.cz) <= 1 &&
          (!target || other.triangles > target.triangles)
        )
          target = other;
      if (!target) continue;
      target.items.push(...part.items);
      target.triangles += part.triangles;
      part.merged = true;
    }
    return sorted.filter((part) => !part.merged);
  }
  const triangleCount = (geometry) =>
    (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
  // Instanced detail spread across the map splits into one mesh per chunk,
  // or per few chunks where it is sparse. Trees keep their own per-specimen
  // meshes and detail levels.
  function splitInstances(mesh) {
    const byChunk = new Map(),
      perInstance = triangleCount(mesh.geometry);
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, instanceMatrix);
      point.setFromMatrixPosition(instanceMatrix).applyMatrix4(mesh.matrixWorld);
      const chunk = chunkAt(point.x, point.z);
      if (!byChunk.has(chunk))
        byChunk.set(chunk, { chunk, items: [], triangles: 0 });
      const part = byChunk.get(chunk);
      part.items.push(i);
      part.triangles += perInstance;
    }
    const parts = clusterParts(byChunk.values());
    if (parts.length < 2) {
      if (parts.length) parts[0].chunk.meshes.push(mesh);
      return;
    }
    for (const { chunk, items: indices } of parts) {
      const part = new T.InstancedMesh(mesh.geometry, mesh.material, indices.length);
      part.name = `${mesh.name || "Instances"} (chunk ${chunk.key})`;
      part.castShadow = mesh.castShadow;
      part.receiveShadow = mesh.receiveShadow;
      part.matrixAutoUpdate = mesh.matrixAutoUpdate;
      part.matrix.copy(mesh.matrix);
      part.matrix.decompose(part.position, part.quaternion, part.scale);
      indices.forEach((source, i) => {
        mesh.getMatrixAt(source, instanceMatrix);
        part.setMatrixAt(i, instanceMatrix);
        if (mesh.instanceColor) {
          mesh.getColorAt(source, instanceColor);
          part.setColorAt(i, instanceColor);
        }
      });
      part.computeBoundingSphere();
      mesh.parent.add(part);
      part.updateMatrixWorld();
      chunk.meshes.push(part);
    }
    mesh.removeFromParent();
  }
  // Every lit material, the village's and those streamed in after it.
  const glowMaterials = new Set();
  // Batches group by material, shadow role and vertex layout, then by chunk.
  const batches = new Map(),
    remove = [],
    instanced = [];
  function collect(node, dynamic = false) {
    if (selfCulled.includes(node)) return;
    dynamic = dynamic || node.userData.dynamic;
    for (const child of [...node.children]) collect(child, dynamic);
    if (!node.isMesh && !node.isPoints) return;
    // Lit materials brighten at blue hour; main.js finds them through their chunk.
    if (!Array.isArray(node.material) && node.material.emissive?.getHex() > 0) {
      chunkOf(node).glow.add(node.material);
      glowMaterials.add(node.material);
    }
    if (node.isInstancedMesh) {
      instanced.push(node);
      return;
    }
    if (
      !node.isMesh ||
      dynamic ||
      Array.isArray(node.material) ||
      node.material.transparent
    )
      return;
    const chunk = chunkOf(node),
      material = bakedMaterial(node.material),
      geometry = node.geometry.clone().applyMatrix4(node.matrixWorld),
      flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (flat !== geometry) geometry.dispose();
    if (material !== node.material) {
      const colors = new Float32Array(flat.attributes.position.count * 3),
        { r, g, b } = node.material.color;
      for (let i = 0; i < colors.length; i += 3) {
        colors[i] = r;
        colors[i + 1] = g;
        colors[i + 2] = b;
      }
      flat.setAttribute("color", new T.BufferAttribute(colors, 3));
    }
    // Only geometries with the same attributes can merge.
    const attributes = Object.keys(flat.attributes).sort().join(),
      key = `${material.uuid}/${node.castShadow}/${node.receiveShadow}/${attributes}`;
    if (!batches.has(key))
      batches.set(key, {
        material,
        castShadow: node.castShadow,
        receiveShadow: node.receiveShadow,
        chunks: new Map(),
      });
    const { chunks: parts } = batches.get(key);
    if (!parts.has(chunk)) parts.set(chunk, { chunk, items: [], triangles: 0 });
    const part = parts.get(chunk);
    part.items.push(flat);
    part.triangles += triangleCount(flat);
    remove.push(node);
  }
  for (const root of [...scene.children])
    if (!skip.has(root)) collect(root);
  // Trees cull per specimen already; register them with their chunk.
  for (const group of selfCulled)
    for (const mesh of group.children) if (mesh.isMesh) chunkOf(mesh).meshes.push(mesh);
  for (const mesh of instanced) splitInstances(mesh);
  for (const batch of batches.values())
    for (const { chunk, items: geometries } of clusterParts(batch.chunks.values())) {
      const merged = mergeGeometries(geometries, false);
      if (merged) {
        merged.computeBoundingSphere();
        const obj = new T.Mesh(merged, batch.material);
        obj.name = `Baked scenery (chunk ${chunk.key})`;
        obj.castShadow = batch.castShadow;
        obj.receiveShadow = batch.receiveShadow;
        scene.add(obj);
        chunk.meshes.push(obj);
      } else console.error("Could not merge a scenery batch", batch.material);
      for (const g of geometries) g.dispose();
    }
  for (const obj of remove) obj.removeFromParent();
  scene.updateMatrixWorld(true);
  return glowMaterials;
}

/**
 * Small detail and the open country, whose visibility first person and the
 * benchmark change. `fieldGround` is the open country's ground, which
 * showFields("ground") keeps.
 */
export function createDetail(chunks, fieldGround) {
  // Grass, blossoms and pebbles cover only a few pixels in the distance, so
  // first person skips the parts beyond DETAIL_RANGE. Each part keeps its
  // world-space bounds; they never move.
  const DETAIL_RANGE = 30,
    DETAIL_NAMES = ["Grass blades", "Meadow blossoms", "River pebbles"],
    detailParts = [];
  function addDetail(mesh, field = false) {
    const sphere = (mesh.isInstancedMesh ? mesh.boundingSphere : mesh.geometry.boundingSphere)
      .clone()
      .applyMatrix4(mesh.matrixWorld);
    detailParts.push({ mesh, sphere, field });
  }
  // The open country's ground and grass, which a benchmark can hide to
  // measure them: shown is true, false, or "ground" for the ground alone.
  const fieldPatches = [];
  let fieldsShown = true;
  const fieldShown = (mesh) =>
    fieldsShown === true || (fieldsShown === "ground" && fieldGround.includes(mesh));
  for (const chunk of chunks.values())
    for (const mesh of chunk.meshes)
      if (DETAIL_NAMES.some((name) => mesh.name.startsWith(name))) addDetail(mesh);
  return {
    addDetail,
    /** A streamed piece of the open country, shown or hidden with the rest. */
    addField(mesh) {
      fieldPatches.push(mesh);
      mesh.visible &&= fieldShown(mesh);
    },
    /**
     * Shows or hides the open country (for measuring its cost): true, false,
     * or "ground" to hide only its grass.
     */
    showFields(shown) {
      fieldsShown = shown;
      for (const mesh of [...fieldGround, ...fieldPatches]) mesh.visible = fieldShown(mesh);
    },
    /**
     * Hides small detail more than DETAIL_RANGE from (x, z), or shows it all
     * when called without a position (the overview).
     */
    setDetailFocus(x, z) {
      for (const { mesh, sphere, field } of detailParts)
        mesh.visible =
          (!field || fieldShown(mesh)) &&
          (x === undefined ||
            Math.hypot(sphere.center.x - x, sphere.center.z - z) - sphere.radius <
              DETAIL_RANGE);
    },
  };
}
