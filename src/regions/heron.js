import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createPlanters } from "../planters.js";
import { HERON_KEEPER } from "../content/pub.js";
import { PUB } from "../pub/layout.js";
import { exteriorSections, tiles } from "../pub/exterior.js";
import { createPubOutsideMaterials, createStorey, paintOutsideBrick, paintOutsideNogging } from "../pub/parts.js";
import { HERON, HERON_DOOR, heronLamps, onMap } from "./heron-layout.js";

// The Drowsy Heron's outside, streamed in like any region's structures but
// from the study's own design (src/pub/exterior.js), so the two cannot differ.
// Every part is painted one colour and merged, as the parts kit does, leaving
// few draws: the structure, its small trim, the tiles, brick, herringbone,
// the village's glass and the painted signs. Nothing inside is built: the door
// opens onto the walkable room (src/pub/room.js).

// Parts smaller than this across are trim, which hides when zoomed far out.
const TRIM_SIZE = 1.6;

/** One job that works through the shell a section at a time, between frames. */
export function heronJobs(T, world, { life } = {}) {
  const root = new T.Group();
  root.position.set(HERON.x, 0.05, HERON.z);
  root.scale.setScalar(HERON.scale);
  root.updateMatrixWorld(true);
  const buckets = { structure: [], trim: [], glass: [] },
    painted = new Map();
  const m = createPubOutsideMaterials(world.materials.glass);
  const stored = (geometry, matrix, keep) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    for (const name of Object.keys(g.attributes))
      if (!["position", "normal", keep].includes(name)) g.deleteAttribute(name);
    g.applyMatrix4(matrix);
    return g;
  };
  // Moves everything the last section built out of its meshes, into the
  // buckets it will merge into, painted its material's colour.
  function collect() {
    root.updateMatrixWorld(true);
    const meshes = [];
    root.traverse((o) => {
      if (o.isMesh && !o.isInstancedMesh) meshes.push(o);
    });
    for (const o of meshes) {
      const material = o.material;
      if (material.map) {
        if (!painted.has(material)) painted.set(material, { parts: [], casts: o.castShadow });
        painted.get(material).parts.push(stored(o.geometry, o.matrixWorld, "uv"));
      } else if (material === m.glass) {
        buckets.glass.push(stored(o.geometry, o.matrixWorld));
      } else {
        const g = stored(o.geometry, o.matrixWorld, material.vertexColors ? "color" : undefined);
        if (!material.vertexColors) kit.paint(g, material.color);
        g.computeBoundingBox();
        const size = g.boundingBox.getSize(new T.Vector3()).length();
        (size < TRIM_SIZE || material.vertexColors ? buckets.trim : buckets.structure).push(g);
      }
    }
    for (const pane of kit.takePanes()) buckets.glass.push(stored(pane, root.matrixWorld));
    root.clear();
    // Each section merges what it made, so the last merge joins only a few
    // long pieces and costs one frame nothing to speak of.
    for (const bucket of [buckets.structure, buckets.trim, buckets.glass, ...[...painted.values()].map((p) => p.parts)]) {
      const fresh = bucket.splice(bucket.solid ?? 0);
      if (!fresh.length) continue;
      bucket.push(mergeGeometries(fresh, false));
      bucket.solid = bucket.length;
      for (const part of fresh) part.dispose();
    }
  }
  let kit = null,
    shell = null,
    planters = null,
    court = null;
  const tileRoof = () => {
    const roof = tiles(root, [...shell.tilePanes.roof, ...shell.tilePanes.ground], kit.random, {
      width: 0.38,
      exposure: 0.27,
      lean: true,
    });
    roof.castShadow = false;
    roof.removeFromParent();
    roof.matrix.copy(root.matrixWorld);
    roof.name = "Drowsy Heron tiles";
    return roof;
  };
  const meshFrom = (name, parts, material, casts = true) => {
    const geometry = mergeGeometries(parts, false);
    for (const part of parts) part.dispose();
    geometry.computeBoundingSphere();
    const mesh = new T.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = casts;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    return mesh;
  };
  const steps = [
    () => {
      m.brick = paintOutsideBrick();
    },
    () => {
      m.nogging = paintOutsideNogging();
      kit = createStorey(root, 8101, m, { lean: true });
      kit.paint = (geometry, color) => {
        const colors = new Float32Array(geometry.attributes.position.count * 3);
        for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
        geometry.setAttribute("color", new T.BufferAttribute(colors, 3));
      };
      planters = createPlanters(8821);
      shell = exteriorSections(m, planters, { sway: false });
      steps.splice(
        2,
        0,
        ...shell.sections.map(({ build }) => () => {
          build(kit);
          collect();
        }),
        () => {
          shell.gallery(kit, kit);
          collect();
        },
        () => {
          shell.yard(kit);
          collect();
        },
        () => {
          shell.lanterns(kit);
          collect();
        },
      );
    },
    () => {
      // The forecourt and its path to the square, in the market's own gravel.
      const a = onMap(-HERON.court.halfW, PUB.halfD),
        c = onMap(HERON.court.halfW, HERON.court.front),
        y = 0.062,
        positions = [];
      const quad = (p, q, r, t) =>
        positions.push(...p, ...q, ...r, ...p, ...r, ...t);
      quad([a.x, y, a.z], [a.x, y, c.z], [c.x, y, c.z], [c.x, y, a.z]);
      const { path, pathHalfWidth: half } = HERON;
      for (let i = 0; i < path.length - 1; i++) {
        const [ax, az] = path[i],
          [bx, bz] = path[i + 1];
        quad([ax - half, y, az], [bx - half, y, bz], [bx + half, y, bz], [ax + half, y, az]);
      }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      court = new T.Mesh(geometry, world.materials.path);
      court.name = "Drowsy Heron forecourt";
      court.castShadow = false;
      court.receiveShadow = true;
      court.matrixAutoUpdate = false;
    },
  ];
  const job = {
    key: "drowsy heron",
    x: HERON.x,
    z: HERON.z,
    step(deadline) {
      while (steps.length && performance.now() < deadline) steps.shift()();
      if (steps.length) return undefined;
      const colour = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 });
      const pieces = [
        { mesh: meshFrom("Drowsy Heron", buckets.structure, colour) },
        { mesh: meshFrom("Drowsy Heron trim", buckets.trim, colour, false), far: true },
        { mesh: tileRoof(), far: true },
        { mesh: meshFrom("Drowsy Heron glass", buckets.glass, m.glass, false) },
        { mesh: court, ground: true },
      ];
      for (const [material, { parts, casts }] of painted)
        pieces.push({ mesh: meshFrom(`Drowsy Heron ${material.name || "painted"}`, parts, material, casts) });
      job.pieces = pieces;
      return pieces.map((p) => p.mesh);
    },
    added() {
      for (const { mesh, far = false, ground } of job.pieces) {
        world.addStreamed(mesh, { far, fineShadow: !ground && mesh.castShadow });
        world.water.excludeFromCaptures(mesh);
      }
      world.addLamps(heronLamps());
      world.interactables.push({ id: "heron", name: PUB.name, ...HERON_DOOR, radius: 1.45 });
      life?.addResident({ ...HERON_KEEPER, ...onMap(HERON.keeper.x, HERON.keeper.z) });
    },
  };
  return { jobs: [job] };
}
