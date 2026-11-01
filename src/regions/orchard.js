// The orchard hill north-west of the village: its grassy slopes and path,
// rows of apple and pear trees, three beehives and their bees, a stone
// windmill on the summit and a bench looking back over the village. Loaded
// with import() once the village is on screen and built by the streamer a
// piece at a time. Its shape, colliders and ground heights live in
// orchard-layout.js, which loads with the village.
//
// The trees share the village trees' bark, leaf blade and wind shader, so
// they add no textures. Their leaves carry the ground's height under them
// (trees.materials.grounded), so the wind's shelter near the ground still
// holds on the hill, and a shaken tree's leaves tremble.
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { chunkRandom } from "../world-layout.js";
import { crownShells } from "../trees.js";
import {
  FRUIT_TREES,
  ORCHARD as O,
  PATH,
  hillHeight,
  orchardGrass,
  orchardGround,
  pathDistance,
  pathWeight,
} from "./orchard-layout.js";

const TAU = Math.PI * 2;
// Spacing of the ground mesh's vertices, in metres.
const GROUND_STEP = 0.4;
// Fruit a shake brings down, of the fruit hanging on a tree.
const DROP = 3;

// The sun's direction across the ground (main.js's sun stands at -16, 32, 15).
const SUN = { x: -16 / Math.hypot(16, 15), z: 15 / Math.hypot(16, 15) };

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Streamer jobs for the orchard hill, and a controller for its harvest:
 * shake(id) drops a tree's ripe fruit, setPicked(id, picked) shows or hides
 * the fruit a shake took, and disturbHive(id) sets its bees swirling.
 */
export function orchardJobs(T, world) {
  fruitDummy = new T.Object3D();
  const rand = chunkRandom(-2, -2, 5),
    range = (a, b) => a + (b - a) * rand();
  const harvest = createHarvest(T, world);
  const job = (key, x, z, step, added) => ({ key, x, z, step, added });
  const jobs = [
    job("orchard ground", -24, -29, groundBuilder(T, world), ([mesh]) =>
      world.addStreamed(mesh),
    ),
    ...["apple", "pear"].map((kind) => {
      const trees = FRUIT_TREES.filter((t) => t.kind === kind),
        cx = trees.reduce((n, t) => n + t.x, 0) / trees.length,
        cz = trees.reduce((n, t) => n + t.z, 0) / trees.length;
      return job(
        `orchard ${kind} trees`,
        cx,
        cz,
        treeBuilder(T, world, kind, trees, harvest),
        (meshes) => {
          const [wood, shells, leaves, crown, fruit] = meshes;
          for (const mesh of meshes) world.addStreamed(mesh);
          // The leaves' bounds enclose both blades and the wind's sway.
          leaves.geometry = leaves.userData.coarse;
          leaves.computeBoundingSphere();
          leaves.geometry = leaves.userData.fine;
          leaves.boundingSphere.radius += 0.14;
          world.water.excludeFromCaptures(leaves, crown);
          world.trees.adopt({
            mesh: leaves,
            fine: leaves.userData.fine,
            coarse: leaves.userData.coarse,
            crown,
            underneath: [shells],
            center: leaves.boundingSphere.center.clone(),
          });
          harvest.attach(kind, fruit);
          for (const t of trees)
            world.interactables.push({
              id: `orchard-${t.id}`,
              type: "fruit-tree",
              tree: t.id,
              kind,
              name: `Shake the ${kind} tree`,
              x: t.x,
              z: t.z,
              radius: 1.5,
            });
        },
      );
    }),
    job(
      "orchard windmill, hives and bench",
      O.windmill.x,
      O.windmill.z,
      () => structures(T, range),
      ([mesh, sails]) => {
        world.addStreamed(mesh);
        world.addStreamed(sails);
        const turn = sails.userData.turn;
        world.animate(O.windmill.x, O.windmill.z, (dt, t, clock) => turn(clock));
        world.interactables.push(
          {
            id: "windmill",
            name: "Old windmill",
            x: O.windmill.x + 1.6,
            z: O.windmill.z + 1.6,
            radius: 1.9,
          },
          {
            id: "hilltop-bench",
            name: "Hilltop bench",
            x: O.bench.x,
            z: O.bench.z,
            radius: 1.4,
          },
          ...O.hives.map((h) => ({
            id: `orchard-${h.id}`,
            type: "hive",
            hive: h.id,
            name: "Collect honey",
            x: h.x,
            z: h.z + 0.55,
            radius: 1.2,
          })),
        );
      },
    ),
    job("orchard bees", -36, -31, () => bees(T, harvest), ([mesh]) => {
      world.addStreamed(mesh);
      // Bounds for the bees' whole flight, not where they started.
      mesh.boundingSphere.radius += 1.5;
      world.animate(-36, -31, (dt, t, clock) => mesh.userData.fly(clock));
    }),
    job("orchard flowers", -30, -29, () => flowers(T, range), ([mesh]) => {
      world.addStreamed(mesh, { detail: true });
      world.water.excludeFromCaptures(mesh);
    }),
  ];
  return { jobs, harvest };
}

// --- Ground ---------------------------------------------------------------

// Vertex colours tint the open country's grass texture, so the lawn at the
// mesh's edge (white) matches the fields around it. Tints are the wanted
// colour over the grass texture's own (#7f9f5c), in linear terms.
function tint(T, hex) {
  const base = new T.Color("#7f9f5c"),
    color = new T.Color(hex);
  return new T.Color(color.r / base.r, color.g / base.g, color.b / base.b);
}

function groundBuilder(T, world) {
  const { minX, maxX, minZ, maxZ } = O.ground,
    cols = Math.round((maxX - minX) / GROUND_STEP) + 1,
    rows = Math.round((maxZ - minZ) / GROUND_STEP) + 1,
    positions = new Float32Array(cols * rows * 3),
    colors = new Float32Array(cols * rows * 3),
    uvs = new Float32Array(cols * rows * 2);
  const lawn = new T.Color(1, 1, 1),
    warm = tint(T, "#8fab5c"),
    sunlit = tint(T, "#9fb563"),
    shade = tint(T, "#6f8d4a"),
    clover = tint(T, "#86a65e"),
    earth = tint(T, "#a8966c"),
    worn = tint(T, "#98a266"),
    cool = tint(T, "#6b8a52"),
    color = new T.Color();
  function colorAt(x, z) {
    const h = hillHeight(x, z);
    // Warmer, sun-browned grass up the slope, mottled.
    const mottle =
      Math.sin(x * 0.7 + 0.4) * Math.sin(z * 0.9 - 1.1) + 0.5 * Math.sin(x * 1.9 + z * 1.3);
    color.copy(lawn).lerp(warm, smooth(0.05, 1.4, h));
    if (mottle > 0.4) color.lerp(sunlit, smooth(0.4, 1.1, mottle) * smooth(0.3, 1.6, h) * 0.6);
    // Slopes turned to the afternoon sun a little warmer and brighter, those
    // turned away a little cooler, so the hill's shape reads from above.
    const e = 0.2,
      gx = (hillHeight(x + e, z) - hillHeight(x - e, z)) / (2 * e),
      gz = (hillHeight(x, z + e) - hillHeight(x, z - e)) / (2 * e),
      facing = (-gx * SUN.x - gz * SUN.z) / Math.hypot(gx, 1, gz);
    if (facing > 0) color.lerp(sunlit, Math.min(1, facing * 1.6));
    else color.lerp(cool, Math.min(1, -facing * 1.8));
    // Shade and fallen leaves under each tree.
    for (const t of FRUIT_TREES) {
      const d = Math.hypot(x - t.x, z - t.z);
      if (d < 1.9) color.lerp(shade, (1 - smooth(0.5, 1.9, d)) * 0.7);
    }
    // Clover around the hives.
    const hives = Math.hypot(x + 36.3, (z + 31.8) * 1.4);
    if (hives < 3.4) color.lerp(clover, (1 - smooth(1.5, 3.4, hives)) * 0.8);
    // Trodden ground around the windmill's foot.
    const mill = Math.hypot(x - O.windmill.x, z - O.windmill.z) - O.windmill.radius;
    if (mill < 1.2) color.lerp(worn, 1 - smooth(0.1, 1.2, mill));
    // The path: bare earth down its middle, worn grass at its edges, fading
    // in from the hill's foot.
    const path = pathWeight(x, z) * smooth(O.ground.maxZ, O.ground.maxZ - 0.4, z);
    if (path > 0) color.lerp(worn, smooth(0, 0.5, path)).lerp(earth, smooth(0.45, 1, path));
    return color;
  }
  let row = 0;
  return (deadline) => {
    for (; row < rows; row++) {
      if (performance.now() > deadline) return null;
      const z = minZ + row * GROUND_STEP;
      for (let col = 0; col < cols; col++) {
        const x = minX + col * GROUND_STEP,
          i = row * cols + col;
        positions.set([x, orchardGround(x, z), z], i * 3);
        uvs.set([x / 33.5, -z / 41.6], i * 2);
        // The mesh's edge stays plain lawn, to meet the fields' grass.
        const edge = col === 0 || row === 0 || col === cols - 1 || row === rows - 1;
        (edge ? color.copy(lawn) : colorAt(x, z)).toArray(colors, i * 3);
      }
    }
    const index = new Uint32Array((cols - 1) * (rows - 1) * 6);
    let n = 0;
    for (let r = 0; r < rows - 1; r++)
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c,
          b = a + 1,
          d = a + cols,
          e = d + 1;
        index.set([a, d, b, b, d, e], n);
        n += 6;
      }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new T.BufferAttribute(colors, 3));
    geometry.setAttribute("uv", new T.BufferAttribute(uvs, 2));
    geometry.setIndex(new T.BufferAttribute(index, 1));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const material = world.groundMaterial.clone();
    material.vertexColors = true;
    const mesh = new T.Mesh(geometry, material);
    mesh.name = "Orchard hill ground";
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    return mesh;
  };
}

// --- Fruit trees ------------------------------------------------------------

const KINDS = {
  apple: {
    leaves: ["#4c7a3c", "#5a8843", "#68954a", "#77a252", "#5f8c3f"],
    shell: "#3d6131",
    fruit: ["#c2382c", "#d1553a", "#b5352a", "#d98c3e", "#c94631", "#e0b04f"],
    perCluster: 84,
    leafSize: [0.19, 0.27],
    fruitPerCluster: 1,
  },
  pear: {
    leaves: ["#55833f", "#639047", "#729d4d", "#82aa58", "#5a8a44"],
    shell: "#436a35",
    fruit: ["#c4bf55", "#b2b44b", "#d1c264", "#a7ae49", "#cdb35a"],
    perCluster: 80,
    leafSize: [0.19, 0.27],
    fruitPerCluster: 1,
  },
};

// A tapered tube along a curve, with the village trees' bark colouring.
function limb(T, curve, radius, tip, segments, radial, out) {
  const frames = curve.computeFrenetFrames(segments, false),
    vertices = [],
    normals = [],
    uvs = [],
    colors = [],
    indices = [],
    length = curve.getLength(),
    wood = new T.Color("#b49c7c"),
    color = new T.Color(),
    normal = new T.Vector3(),
    point = new T.Vector3();
  for (let j = 0; j <= segments; j++) {
    const t = j / segments,
      center = curve.getPointAt(t),
      r = radius + (tip - radius) * Math.pow(t, 0.8);
    for (let k = 0; k <= radial; k++) {
      const a = (k / radial) * TAU;
      normal
        .copy(frames.normals[j])
        .multiplyScalar(Math.cos(a))
        .addScaledVector(frames.binormals[j], Math.sin(a));
      point.copy(center).addScaledVector(normal, r);
      vertices.push(point.x, point.y, point.z);
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(k / radial, t * length * 0.85);
      color.copy(wood).multiplyScalar(0.8 + 0.1 * Math.sin(a * 3 + t * 4));
      colors.push(color.r, color.g, color.b);
      if (j < segments && k < radial) {
        const p = j * (radial + 1) + k,
          q = p + radial + 1;
        indices.push(p, p + 1, q, p + 1, q + 1, q);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  out.push(geometry.toNonIndexed());
  geometry.dispose();
}

/**
 * Builds one kind's trees a tree per slice, then returns its five meshes:
 * wood, the shady shells inside the crowns, the leaves, the distant crowns,
 * and the fruit (hanging and fallen).
 */
function treeBuilder(T, world, kind, trees, harvest) {
  const style = KINDS[kind],
    { materials, blades } = world.trees,
    wood = [],
    shells = [],
    leaves = [],
    fruit = [],
    crownClusters = [],
    leafColors = style.leaves.map((c) => new T.Color(c)),
    fruitColors = style.fruit.map((c) => new T.Color(c)),
    shellColor = new T.Color(style.shell),
    up = new T.Vector3(0, 1, 0),
    axis = new T.Vector3(0, 0, 1);
  let next = 0;
  function build(tree, index) {
    const rand = chunkRandom(index, kind === "apple" ? 41 : 43, 9),
      range = (a, b) => a + (b - a) * rand(),
      s = tree.scale,
      // Seated a touch into the slope, so the trunk's foot never floats.
      base = orchardGround(tree.x, tree.z) - 0.04,
      at = (x, y, z) => new T.Vector3(tree.x + x * s, base + y * s, tree.z + z * s),
      lean = [range(-0.12, 0.12), range(-0.12, 0.12)],
      rotation = range(0, TAU),
      pear = kind === "pear",
      trunkTop = pear ? 1.05 : 0.95;
    const curve = (points) => new T.CatmullRomCurve3(points.map((p) => at(...p)));
    limb(
      T,
      curve([
        [0, -0.05, 0],
        [lean[0] * 0.4, trunkTop * 0.5, lean[1] * 0.4],
        [lean[0], trunkTop, lean[1]],
      ]),
      (pear ? 0.13 : 0.14) * s,
      0.085 * s,
      6,
      9,
      wood,
    );
    const clusters = [];
    const limbs = pear ? 4 : 5;
    for (let i = 0; i < limbs; i++) {
      const a = rotation + (i * TAU) / limbs + range(-0.25, 0.25),
        reach = pear ? range(0.6, 0.85) : range(0.95, 1.3),
        height = pear ? range(2.1, 2.6) : range(1.85, 2.25),
        end = [Math.cos(a) * reach + lean[0], height, Math.sin(a) * reach + lean[1]],
        middle = [
          Math.cos(a) * reach * 0.45 + lean[0],
          trunkTop + (height - trunkTop) * 0.62,
          Math.sin(a) * reach * 0.45 + lean[1],
        ];
      limb(T, curve([[lean[0], trunkTop - 0.08, lean[1]], middle, end]), 0.065 * s, 0.018 * s, 6, 6, wood);
      clusters.push({ at: end, radius: pear ? range(0.5, 0.6) : range(0.55, 0.68) });
      // A side shoot from each limb fills the crown between them.
      const side = [
        middle[0] + Math.cos(a + 0.9) * (pear ? 0.35 : 0.55),
        middle[1] + range(0.3, 0.55),
        middle[2] + Math.sin(a + 0.9) * (pear ? 0.35 : 0.55),
      ];
      limb(T, curve([middle, side]), 0.03 * s, 0.01 * s, 3, 5, wood);
      clusters.push({ at: side, radius: pear ? range(0.42, 0.5) : range(0.42, 0.52) });
    }
    if (pear) {
      // A central leader carries the pear's taller, narrower crown.
      const top = [lean[0] * 1.3, 3.4, lean[1] * 1.3];
      limb(T, curve([[lean[0], trunkTop - 0.05, lean[1]], [lean[0] * 1.15, 2.4, lean[1] * 1.15], top]), 0.07 * s, 0.015 * s, 6, 6, wood);
      clusters.push({ at: top, radius: 0.5 }, { at: [lean[0] * 1.2, 2.85, lean[1] * 1.2], radius: 0.7 });
    } else clusters.push({ at: [lean[0], 2.45, lean[1]], radius: 0.72 });
    const crown = [];
    for (const [c, cluster] of clusters.entries()) {
      const center = at(...cluster.at),
        radius = cluster.radius * s,
        baseColor = leafColors[(index + c) % leafColors.length];
      crown.push({ center, radius, color: baseColor });
      shells.push({ center, radius: radius * 0.58, color: shellColor });
      // Leaves spread over the cluster's outer layer, pointing outward.
      for (let j = 0; j < style.perCluster; j++) {
        const y = 1 - (2 * (j + 0.5)) / style.perCluster,
          ring = Math.sqrt(1 - y * y),
          a = j * 2.39996 + c * 0.7 + rotation,
          direction = new T.Vector3(Math.cos(a) * ring, y * 0.8, Math.sin(a) * ring).normalize(),
          depth = range(0.7, 1.04),
          position = center.clone().add(
            new T.Vector3(direction.x * radius * depth, direction.y * radius * 0.86 * depth, direction.z * radius * depth),
          ),
          out = direction
            .clone()
            .add(new T.Vector3(range(-0.6, 0.6), range(-0.2, 0.7), range(-0.6, 0.6)))
            .normalize(),
          quaternion = new T.Quaternion()
            .setFromUnitVectors(axis, out)
            .multiply(new T.Quaternion().setFromAxisAngle(axis, range(-1, 1))),
          size = range(...style.leafSize) * s;
        leaves.push({
          position,
          quaternion,
          scale: new T.Vector3(1, 1, 1).multiplyScalar(size),
          color: baseColor
            .clone()
            .offsetHSL(range(-0.015, 0.015), range(-0.03, 0.03), range(-0.04, 0.05)),
          lift: base,
        });
      }
      // Fruit on the crown's sunny underside and flanks.
      for (let f = 0; f < style.fruitPerCluster + (c % 2); f++) {
        const a = range(0, TAU),
          y = range(-0.75, 0.25),
          ring = Math.sqrt(1 - y * y),
          position = center
            .clone()
            .add(new T.Vector3(Math.cos(a) * ring * radius * 0.92, y * radius * 0.85, Math.sin(a) * ring * radius * 0.92));
        fruit.push({
          tree: tree.id,
          position,
          turn: range(0, TAU),
          size: range(0.85, 1.12),
          color: fruitColors[Math.floor(range(0, fruitColors.length))],
        });
      }
    }
    // A few windfalls in the grass beneath.
    for (let f = 0; f < 2; f++) {
      const a = range(0, TAU),
        r = range(0.5, 1.3) * s,
        x = tree.x + Math.cos(a) * r,
        z = tree.z + Math.sin(a) * r;
      fruit.push({
        tree: null,
        position: new T.Vector3(x, orchardGround(x, z) + 0.05, z),
        turn: range(0, TAU),
        size: range(0.85, 1.05),
        tilt: 1.3,
        color: fruitColors[Math.floor(range(0, fruitColors.length))]
          .clone()
          .offsetHSL(0, -0.1, -0.08),
      });
    }
    crownClusters.push(...crown);
  }
  return (deadline) => {
    while (next < trees.length) {
      build(trees[next], next);
      next++;
      if (performance.now() > deadline) return null;
    }
    // Merging and instancing run in a slice of their own.
    if (next++ === trees.length) return null;
    const name = kind === "apple" ? "Apple" : "Pear";
    // Wood: one merged mesh in the village trees' bark.
    const woodGeometry = mergeGeometries(wood, false);
    for (const part of wood) part.dispose();
    woodGeometry.computeBoundingSphere();
    const woodMesh = new T.Mesh(woodGeometry, materials.wood);
    woodMesh.name = `${name} trees' bark and limbs`;
    // Shells: shade inside the crowns, so a modest number of leaves reads
    // as a full canopy. The leaves cast the crown's shadow.
    const shellMesh = crownShells(shells, 1, materials.crown, new T.IcosahedronGeometry(1, 1));
    shellMesh.name = `${name} trees' canopy shade`;
    shellMesh.visible = true;
    shellMesh.castShadow = false;
    // Leaves: the village's blades, with each tree's ground height.
    const ordered = [...leaves.filter((_, i) => i % 2 === 0), ...leaves.filter((_, i) => i % 2)],
      lift = new T.InstancedBufferAttribute(
        Float32Array.from(ordered, (leaf) => leaf.lift),
        1,
      ),
      fine = blades.fine.clone(),
      coarse = blades.coarse.clone();
    fine.setAttribute("groundLift", lift);
    coarse.setAttribute("groundLift", lift);
    const leafMesh = new T.InstancedMesh(fine, harvest.leafMaterials.leaf, ordered.length),
      dummy = new T.Object3D();
    ordered.forEach((leaf, i) => {
      dummy.position.copy(leaf.position);
      dummy.quaternion.copy(leaf.quaternion);
      dummy.scale.copy(leaf.scale);
      dummy.updateMatrix();
      leafMesh.setMatrixAt(i, dummy.matrix);
      leafMesh.setColorAt(i, leaf.color);
    });
    leafMesh.customDepthMaterial = harvest.leafMaterials.depth;
    leafMesh.userData.fine = fine;
    leafMesh.userData.coarse = coarse;
    leafMesh.name = `${name} trees' leaves`;
    leafMesh.castShadow = true;
    // Distant crowns, for first person beyond the leaves' range.
    const crownMesh = crownShells(crownClusters, 1, materials.crown, new T.IcosahedronGeometry(1, 1));
    crownMesh.name = `${name} trees' distant crowns`;
    // Fruit.
    const fruitMesh = new T.InstancedMesh(
      kind === "apple" ? appleGeometry(T) : pearGeometry(T),
      new T.MeshStandardMaterial({ roughness: 0.55 }),
      fruit.length + trees.length * DROP,
    );
    fruitMesh.name = `${name}s`;
    fruitMesh.userData.records = fruit;
    fruitMesh.castShadow = true;
    // Hanging fruit and windfalls; the spare slots, for fruit on its way
    // down, wait unseen inside the first fruit.
    fruit.forEach((record, slot) => {
      placeFruit(fruitMesh, slot, record.position, record, record.tilt ?? 0);
      fruitMesh.setColorAt(slot, record.color);
    });
    for (let slot = fruit.length; slot < fruitMesh.count; slot++) {
      placeFruit(fruitMesh, slot, fruit[0].position, fruit[0], 0, 0);
      fruitMesh.setColorAt(slot, fruit[0].color);
    }
    fruitMesh.computeBoundingSphere();
    for (const mesh of [woodMesh, shellMesh, leafMesh, crownMesh, fruitMesh]) {
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
    }
    woodMesh.castShadow = true;
    return [woodMesh, shellMesh, leafMesh, crownMesh, fruitMesh];
  };
}

// Sets a fruit's instance: at `position`, turned about its stalk and tipped
// by `tilt` (a windfall lies on its side).
let fruitDummy = null;
function placeFruit(mesh, slot, position, record, tilt = 0, scale = record.size) {
  fruitDummy.position.copy(position);
  fruitDummy.rotation.set(tilt, record.turn, tilt * 0.4);
  fruitDummy.scale.setScalar(scale);
  fruitDummy.updateMatrix();
  mesh.setMatrixAt(slot, fruitDummy.matrix);
}

function appleGeometry(T) {
  const geometry = new T.SphereGeometry(0.088, 9, 6);
  // A dimple at the stalk, and a little squash.
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    position.setY(i, y * 0.9 - (y > 0.07 ? 0.02 : 0));
  }
  geometry.computeVertexNormals();
  return geometry;
}

function pearGeometry(T) {
  const profile = [
    [0, -0.07],
    [0.04, -0.064],
    [0.055, -0.04],
    [0.052, -0.01],
    [0.035, 0.025],
    [0.024, 0.055],
    [0.008, 0.075],
    [0, 0.077],
  ].map(([x, y]) => new T.Vector2(x * 1.15, y * 1.15));
  const geometry = new T.LatheGeometry(profile, 9);
  geometry.computeVertexNormals();
  return geometry;
}

// --- Harvest ----------------------------------------------------------------

function createHarvest(T, world) {
  const shake = new T.Vector4(0, 0, -100, 0),
    leafMaterials = world.trees.materials.grounded(shake),
    clock = world.trees.materials.time,
    meshes = {},
    picked = new Set(),
    falling = [],
    hiveStirred = new Map(),
    position = new T.Vector3(),
    place = placeFruit;
  let spareSlot = 0,
    animating = false;
  // Hanging fruit records by tree, and their instance slots.
  const byTree = new Map();
  function refresh(id) {
    const entry = byTree.get(id);
    if (!entry) return;
    const { mesh, slots } = entry;
    // The first DROP fruits on a tree are the ripe ones a shake brings down.
    slots.forEach(({ slot, record }, i) =>
      place(mesh, slot, record.position, record, 0, i < DROP && picked.has(id) ? 0 : record.size),
    );
    mesh.instanceMatrix.needsUpdate = true;
  }
  return {
    leafMaterials,
    /** Takes charge of a kind's fruit once its trees have streamed in. */
    attach(kind, mesh) {
      meshes[kind] = mesh;
      const records = mesh.userData.records;
      records.forEach((record, slot) => {
        if (!record.tree) return;
        if (!byTree.has(record.tree)) byTree.set(record.tree, { mesh, slots: [] });
        byTree.get(record.tree).slots.push({ slot, record });
      });
      // Spare slots, past the records, carry fruit on its way down.
      mesh.userData.spare = records.length;
      for (const [id, entry] of byTree) if (entry.mesh === mesh) refresh(id);
      if (!animating) {
        animating = true;
        world.animate(O.summit.x, O.summit.z + 5, (dt, t) => this.update(t));
      }
    },
    /** Hides (or regrows) the fruit a shake takes from tree `id`. */
    setPicked(id, value) {
      if (value === picked.has(id)) return;
      if (value) picked.add(id);
      else picked.delete(id);
      refresh(id);
    },
    /**
     * Shakes tree `id` and drops its ripe fruit, which tumble to the grass
     * and are gathered up; returns how many fell. With `motion` off nothing
     * moves: the fruit is simply gathered.
     */
    shake(id, motion = true) {
      const entry = byTree.get(id),
        tree = FRUIT_TREES.find((t) => t.id === id);
      if (!entry || picked.has(id)) return 0;
      const t = clock.value;
      if (motion) shake.set(tree.x, tree.z, t, 0.05);
      const { mesh, slots } = entry,
        drops = slots.slice(0, DROP);
      drops.forEach(({ record }, i) => {
        if (!motion) return;
        const spares = mesh.count - mesh.userData.spare,
          slot = mesh.userData.spare + (spareSlot++ % spares),
          a = Math.atan2(record.position.z - tree.z, record.position.x - tree.x),
          x = record.position.x + Math.cos(a) * 0.35,
          z = record.position.z + Math.sin(a) * 0.35;
        mesh.setColorAt(slot, record.color);
        mesh.instanceColor.needsUpdate = true;
        falling.push({
          mesh,
          slot,
          record,
          start: t + 0.08 + i * 0.12,
          from: record.position.clone(),
          to: new T.Vector3(x, orchardGround(x, z) + 0.06, z),
        });
      });
      picked.add(id);
      refresh(id);
      return drops.length;
    },
    /** Sets a hive's bees swirling for a few seconds. */
    disturbHive(id) {
      hiveStirred.set(id, clock.value);
    },
    hiveStir(id, t) {
      const since = t - (hiveStirred.get(id) ?? -100);
      return since < 0 || since > 5 ? 0 : 1 - since / 5;
    },
    /** Moves falling fruit; runs while the orchard is in view. */
    update(t) {
      if (!falling.length) return;
      for (let i = falling.length - 1; i >= 0; i--) {
        const f = falling[i],
          since = t - f.start,
          fall = Math.sqrt((2 * (f.from.y - f.to.y)) / 9.8);
        let scale = f.record.size,
          tilt = 0;
        if (since < 0) position.copy(f.from);
        else if (since < fall) {
          const u = since / fall;
          position.lerpVectors(f.from, f.to, u);
          position.y = f.from.y - 4.9 * since * since;
          tilt = u * 2;
        } else {
          // A small bounce, a moment in the grass, then into the basket.
          const after = since - fall;
          position.copy(f.to);
          position.y += Math.max(0, Math.sin(Math.min(after / 0.28, 1) * Math.PI)) * 0.08;
          tilt = 2 + after;
          scale *= 1 - smooth(1.1, 1.6, after);
          if (after > 1.6) {
            scale = 0;
            falling.splice(i, 1);
          }
        }
        place(f.mesh, f.slot, position, f.record, tilt, scale);
        f.mesh.instanceMatrix.needsUpdate = true;
      }
    },
  };
}

// --- Windmill, hives and bench --------------------------------------------

// Every structure shares one vertex-coloured material: one draw per pass.
// The windmill's sails are a second mesh that turns.
function structures(T, range) {
  const parts = [],
    sailParts = [],
    color = new T.Color(),
    matrix = new T.Matrix4(),
    rotation = new T.Euler(),
    quaternion = new T.Quaternion(),
    position = new T.Vector3(),
    scale = new T.Vector3();
  const unitBox = new T.BoxGeometry(1, 1, 1),
    unitCylinder = new T.CylinderGeometry(1, 1, 1, 10);
  let into = parts;
  function add(base, hex, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
    const geometry = base.clone();
    matrix.compose(
      position.set(x, y, z),
      quaternion.setFromEuler(rotation.set(rx, ry, rz, "YXZ")),
      scale.set(sx, sy, sz),
    );
    geometry.applyMatrix4(matrix);
    paint(geometry, hex);
    into.push(geometry);
    return geometry;
  }
  function paint(geometry, hex) {
    color.set(hex);
    const count = geometry.attributes.position.count,
      colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) color.toArray(colors, i * 3);
    geometry.setAttribute("color", new T.BufferAttribute(colors, 3));
  }
  const box = (hex, x, y, z, w, h, d, ry = 0, rx = 0, rz = 0) =>
    add(unitBox, hex, x, y, z, w, h, d, rx, ry, rz);
  const post = (hex, x, z, bottom, top, r = 0.06) =>
    add(unitCylinder, hex, x, (bottom + top) / 2, z, r, top - bottom, r);
  // Builds parts in a local frame, then moves them to (x, y, z) turned by ry.
  function placed(x, y, z, ry, build) {
    const before = into.length;
    build();
    const frame = new T.Matrix4().compose(
      new T.Vector3(x, y, z),
      new T.Quaternion().setFromEuler(new T.Euler(0, ry, 0)),
      new T.Vector3(1, 1, 1),
    );
    for (let i = before; i < into.length; i++) into[i].applyMatrix4(frame);
  }
  const wood = ["#8a6a4a", "#7f6145", "#93724f"],
    darkWood = "#5f4c3a",
    pick = (list) => list[Math.floor(range(0, list.length))];

  // The windmill: a limewashed stone tower on a darker plinth, tapering to a
  // tarred wooden cap; its sails face south-east, over the village.
  const w = O.windmill;
  let floor = Infinity;
  for (let a = 0; a < TAU; a += TAU / 12)
    floor = Math.min(floor, orchardGround(w.x + Math.cos(a) * w.radius, w.z + Math.sin(a) * w.radius));
  const towerHeight = 5.4,
    capBase = floor + towerHeight,
    profile = [];
  for (let y = -0.7; y <= towerHeight + 1e-6; y += 0.3) {
    const t = Math.max(0, y) / towerHeight;
    profile.push(new T.Vector2(w.radius - 0.5 * t + (y < 0.3 ? 0.06 : 0), y));
  }
  const tower = new T.LatheGeometry(profile, 20);
  tower.translate(w.x, floor, w.z);
  {
    const p = tower.attributes.position,
      colors = new Float32Array(p.count * 3);
    const lime = new T.Color("#e2dac6"),
      course = new T.Color("#cfc6b0"),
      plinth = new T.Color("#9d9886");
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) - floor;
      color.copy(y < 0.3 ? plinth : Math.round(y / 0.3) % 2 ? lime : course);
      // Weathering streaks below the windows.
      const a = Math.atan2(p.getZ(i) - w.z, p.getX(i) - w.x);
      color.multiplyScalar(1 - 0.05 * Math.max(0, Math.sin(a * 5 + 1)) * smooth(1, 4, y));
      color.toArray(colors, i * 3);
    }
    tower.setAttribute("color", new T.BufferAttribute(colors, 3));
    tower.deleteAttribute("uv");
    tower.setAttribute("uv", new T.BufferAttribute(new Float32Array(p.count * 2), 2));
    parts.push(tower);
  }
  const radiusAt = (y) => w.radius - 0.5 * (y / towerHeight);
  // A string course under the cap.
  add(unitCylinder, "#b9b19c", w.x, capBase - 0.1, w.z, radiusAt(towerHeight) + 0.07, 0.16, radiusAt(towerHeight) + 0.07);
  // The cap: an ogee dome of tarred boards, with a finial.
  const capProfile = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    capProfile.push(new T.Vector2((radiusAt(towerHeight) + 0.12) * Math.cos(t * Math.PI * 0.5) ** 0.8, t * 1.35));
  }
  const cap = new T.LatheGeometry(capProfile, 20);
  cap.translate(w.x, capBase, w.z);
  paint(cap, "#5b4a3c");
  cap.deleteAttribute("uv");
  cap.setAttribute("uv", new T.BufferAttribute(new Float32Array(cap.attributes.position.count * 2), 2));
  parts.push(cap);
  add(unitCylinder, darkWood, w.x, capBase + 1.45, w.z, 0.05, 0.3, 0.05);
  // Door and windows face the path's end; the sails face the village.
  const doorAngle = Math.atan2(0.72, 0.69),
    shaft = new T.Vector3(0.52, 0, 0.85).normalize(),
    face = (angle, y, build, out = 0) => {
      const r = radiusAt(y) + out;
      placed(w.x + Math.sin(angle) * r, floor + y, w.z + Math.cos(angle) * r, angle, build);
    };
  face(doorAngle, 0, () => {
    box(darkWood, 0, 0.82, 0, 0.86, 1.64, 0.14);
    box("#4d3d30", 0, 0.82, 0.05, 0.08, 1.5, 0.05);
    box("#b9b19c", 0, 1.74, 0.02, 1.12, 0.18, 0.2);
    box("#a59f8c", 0, 0.06, 0.32, 1.1, 0.12, 0.5);
  }, 0.07);
  for (const [angle, y] of [
    [doorAngle + 0.55, 2.55],
    [doorAngle - 1.4, 3.75],
    [doorAngle + 2.4, 2.9],
  ])
    face(angle, y, () => {
      box(darkWood, 0, 0, 0, 0.5, 0.66, 0.1);
      box("#f3d896", 0, 0, 0.04, 0.36, 0.52, 0.04);
      box("#b9b19c", 0, -0.38, 0.06, 0.62, 0.08, 0.14);
    });
  // The windshaft and hub, out of the cap toward the sails.
  const hub = new T.Vector3(w.x, capBase + 0.55, w.z).addScaledVector(shaft, radiusAt(towerHeight) + 0.55);
  {
    const length = radiusAt(towerHeight) + 0.6,
      geometry = unitCylinder.clone().rotateX(Math.PI / 2);
    geometry.applyMatrix4(
      matrix.compose(
        new T.Vector3(w.x, capBase + 0.55, w.z).addScaledVector(shaft, length / 2),
        quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), shaft),
        scale.set(0.13, 0.13, length),
      ),
    );
    paint(geometry, darkWood);
    parts.push(geometry);
  }
  // The sails, built in the hub's frame (the shaft along +z), each a stock
  // with a lattice and a sailcloth on its leading side.
  into = sailParts;
  add(unitCylinder.clone().rotateX(Math.PI / 2), "#4e3f33", 0, 0, 0.12, 0.22, 0.22, 0.32);
  for (let k = 0; k < 4; k++) {
    const before = sailParts.length,
      length = 3.7,
      width = 0.86;
    box("#6b5644", 0, length / 2, 0.2, 0.11, length + 0.2, 0.11);
    for (const x of [0.12, width])
      box("#7b6450", x, length / 2 + 0.55, 0.22, 0.05, length - 0.9, 0.05);
    for (let i = 0; i < 9; i++) {
      const y = 0.9 + (i / 8) * (length - 1.05);
      box("#7b6450", width / 2 + 0.06, y, 0.22, width - 0.04, 0.04, 0.04);
    }
    box("#ece3cc", width / 2 + 0.07, length / 2 + 0.55, 0.25, width - 0.12, length - 1.0, 0.015);
    const spin = new T.Matrix4().makeRotationZ((k * Math.PI) / 2);
    for (let i = before; i < sailParts.length; i++) sailParts[i].applyMatrix4(spin);
  }
  into = parts;

  // The beehives: white lifts under a pitched roof, on a little stand, their
  // entrances facing south.
  for (const h of O.hives) {
    const ground = Math.min(
      ...[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => orchardGround(h.x + sx * 0.3, h.z + sz * 0.3)),
      ),
    );
    placed(h.x, ground, h.z, range(-0.15, 0.15), () => {
      for (const sx of [-0.24, 0.24])
        for (const sz of [-0.24, 0.24]) post(darkWood, sx, sz, -0.25, 0.34, 0.035);
      box("#8a7258", 0, 0.36, 0, 0.62, 0.06, 0.62);
      box("#e8e2d2", 0, 0.42, 0.33, 0.48, 0.04, 0.12, 0, 0.3);
      const lifts = [
        ["#f2eee2", 0.26],
        ["#e9e3d3", 0.2],
        ["#f2eee2", 0.2],
      ];
      let y = 0.4;
      lifts.forEach(([hex, height], i) => {
        box(hex, 0, y + height / 2, 0, 0.6 + (i % 2) * 0.02, height, 0.6 + (i % 2) * 0.02);
        y += height;
      });
      box("#3b3026", 0, 0.45, 0.305, 0.3, 0.04, 0.02);
      // The roof.
      const pitch = 0.5;
      for (const side of [-1, 1])
        box("#b9a487", side * 0.17, y + 0.1, 0, 0.4, 0.04, 0.72, 0, 0, -side * pitch);
      box("#8f7a62", 0, y + 0.2, 0, 0.06, 0.05, 0.74);
      box("#e9e3d3", 0, y + 0.05, 0, 0.6, 0.1, 0.6);
    });
  }

  // The bench, beside the path near the top, looking over the village.
  const b = O.bench,
    facing = Math.atan2(-b.x, -b.z);
  placed(b.x, orchardGround(b.x, b.z), b.z, facing, () => {
    for (const zz of [-0.22, 0, 0.22]) box(pick(wood), 0, 0.5, zz, 1.8, 0.09, 0.16);
    for (const yy of [0.85, 1.07]) box(pick(wood), 0, yy, -0.33, 1.8, 0.15, 0.08);
    for (const xx of [-0.7, 0.7]) {
      box(darkWood, xx, 0.2, 0, 0.12, 0.72, 0.56);
      box(darkWood, xx, 0.73, -0.33, 0.1, 0.86, 0.1);
    }
  });

  // Two gateposts where the path leaves the village.
  {
    const [x0, z0] = PATH[10],
      [x1, z1] = PATH[12],
      along = Math.atan2(x1 - x0, z1 - z0);
    for (const side of [-1, 1]) {
      const x = x0 + Math.cos(along) * side * 0.95,
        z = z0 - Math.sin(along) * side * 0.95,
        g = orchardGround(x, z);
      post(pick(wood), x, z, g - 0.2, g + 1.05, 0.075);
      add(unitCylinder, darkWood, x, g + 1.08, z, 0.085, 0.05, 0.085);
    }
  }

  const merge = (list) => {
    const geometry = mergeGeometries(
      list.map((part) => (part.index ? part.toNonIndexed() : part)),
      false,
    );
    for (const part of list) part.dispose();
    geometry.computeBoundingSphere();
    return geometry;
  };
  const material = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 });
  const mesh = new T.Mesh(merge(parts), material);
  mesh.name = "Orchard windmill, hives and bench";
  const sails = new T.Mesh(merge(sailParts), material);
  sails.name = "Windmill sails";
  unitBox.dispose();
  unitCylinder.dispose();
  for (const m of [mesh, sails]) {
    m.castShadow = m.receiveShadow = true;
    m.matrixAutoUpdate = false;
  }
  // The sails turn slowly about the shaft.
  const facingShaft = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), shaft),
    spin = new T.Quaternion(),
    zAxis = new T.Vector3(0, 0, 1);
  sails.position.copy(hub);
  sails.quaternion.copy(facingShaft);
  sails.updateMatrix();
  sails.userData.turn = (clock) => {
    sails.quaternion.copy(facingShaft).multiply(spin.setFromAxisAngle(zAxis, -clock * 0.32));
    sails.updateMatrix();
    sails.updateMatrixWorld();
  };
  return [mesh, sails];
}

// --- Bees and flowers -------------------------------------------------------

function bees(T, harvest) {
  const perHive = 5,
    count = O.hives.length * perHive,
    geometry = new T.SphereGeometry(1, 5, 4),
    mesh = new T.InstancedMesh(
      geometry,
      new T.MeshStandardMaterial({ color: "#e0b23c", roughness: 0.6 }),
      count,
    ),
    dummy = new T.Object3D(),
    ground = O.hives.map((h) => orchardGround(h.x, h.z));
  mesh.name = "Orchard bees";
  mesh.castShadow = false;
  mesh.matrixAutoUpdate = false;
  // Each bee loops around its hive, now and then out over the clover.
  const fly = (clock) => {
    O.hives.forEach((h, k) => {
      const stir = harvest.hiveStir(h.id, clock);
      for (let i = 0; i < perHive; i++) {
        const n = k * perHive + i,
          speed = 1.3 + i * 0.37 + stir * 2.5,
          phase = n * 1.7,
          reach = 0.45 + 0.35 * Math.sin(clock * 0.21 + phase) ** 2 + stir * 0.5,
          a = clock * speed + phase;
        dummy.position.set(
          h.x + Math.cos(a) * reach * (1 + 0.6 * Math.sin(a * 0.5)),
          ground[k] + 1.15 + 0.25 * Math.sin(a * 2.3 + phase) + stir * 0.3,
          h.z + 0.25 + Math.sin(a * 1.3) * reach,
        );
        dummy.rotation.set(0, -a, 0);
        dummy.scale.set(0.022, 0.018, 0.034);
        dummy.updateMatrix();
        mesh.setMatrixAt(n, dummy.matrix);
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  fly(0);
  mesh.userData.fly = fly;
  return mesh;
}

// Clover and wildflowers: a carpet by the hives, and a scatter under the
// trees and along the path.
function flowers(T, range) {
  const count = 620,
    mesh = new T.InstancedMesh(
      new T.IcosahedronGeometry(1, 0),
      new T.MeshStandardMaterial({ roughness: 0.8 }),
      count,
    ),
    dummy = new T.Object3D(),
    palette = ["#f4efe2", "#e9c6dc", "#c9a9de", "#f1d36a", "#f7f3ea", "#d892b4"].map(
      (c) => new T.Color(c),
    );
  let n = 0,
    tries = 0;
  while (n < count && tries++ < 20000) {
    let x, z;
    const pick = range(0, 1);
    if (pick < 0.45) {
      // The clover by the hives.
      const a = range(0, TAU),
        r = 3.2 * Math.sqrt(range(0, 1));
      x = -36.3 + Math.cos(a) * r;
      z = -31.8 + Math.sin(a) * r * 0.72;
    } else if (pick < 0.8) {
      const t = FRUIT_TREES[Math.floor(range(0, FRUIT_TREES.length))],
        a = range(0, TAU),
        r = range(0.6, 2.2);
      x = t.x + Math.cos(a) * r;
      z = t.z + Math.sin(a) * r;
    } else {
      const [px, pz] = PATH[Math.floor(range(0, PATH.length))],
        a = range(0, TAU);
      x = px + Math.cos(a) * range(0.8, 1.6);
      z = pz + Math.sin(a) * range(0.8, 1.6);
    }
    if (!orchardGrass(x, z) || pathDistance(x, z) < 0.8) continue;
    dummy.position.set(x, orchardGround(x, z) + range(0.14, 0.24), z);
    dummy.rotation.set(range(0, 1), range(0, TAU), 0);
    const size = range(0.035, 0.055);
    dummy.scale.set(size, size * 0.7, size);
    dummy.updateMatrix();
    mesh.setMatrixAt(n, dummy.matrix);
    mesh.setColorAt(n++, palette[Math.floor(range(0, palette.length))]);
  }
  mesh.count = n;
  mesh.name = "Orchard clover and wildflowers";
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  mesh.computeBoundingSphere();
  return mesh;
}
