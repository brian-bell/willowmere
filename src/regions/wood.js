// The old wood west of the meadow: its mossy, leaf-strewn floor and trails,
// oaks and amber beeches standing close, the great oak, ferns, mushrooms and
// the fairy ring that glows at blue hour, the hollow log, old stumps, Rowan's
// stump table, a fingerpost, the woodland flowers the player presses, shafts
// of light slanting into the clearings, and Rowan, who forages here. Loaded
// with import() once the village is on screen and built by the streamer a
// piece at a time. Its shape, colliders and ground heights live in
// wood-layout.js, which loads with the village.
//
// The trees, logs and stumps share the village trees' bark, leaf blade and
// wind shader, so they add no textures. The light shafts are the wood's one
// new shader program.
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { chunkRandom } from "../world-layout.js";
import { createKit, limb, splitByChunk } from "./kit.js";
import { crownShells } from "../trees.js";
import {
  TREES,
  WOOD as W,
  logDistance,
  trailDistance,
  trailWeight,
  woodColliders,
  woodFloor,
  woodGround,
  woodHeight,
} from "./wood-layout.js";
import { WOOD_RESIDENTS } from "../content/wood.js";
import { FLOWERS } from "../game/wood.js";

const TAU = Math.PI * 2;
// Spacing of the ground mesh's vertices, in metres.
const GROUND_STEP = 0.4;

// The sun's direction across the ground (main.js's sun stands at -16, 32, 15).
const SUN = new Float32Array([-16, 32, 15].map((v) => v / Math.hypot(16, 32, 15)));

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Streamer jobs for the old wood. `game.life` takes its resident once the
 * table stands; `game.dusk()` says how far into blue hour the day is (0 to 1),
 * for the light shafts and the honeysuckle.
 */
export function woodJobs(T, world, { life, dusk = () => 0 } = {}) {
  const rand = chunkRandom(-2, 0, 17),
    range = (a, b) => a + (b - a) * rand();
  const job = (key, x, z, step, added) => ({ key, x, z, step, added });
  // The nearest water, the village's brook, lies 36 m off: none of the wood
  // would show in its reflections.
  const added = (meshes, options) => {
    for (const mesh of meshes) {
      world.addStreamed(mesh, options);
      world.water.excludeFromCaptures(mesh);
    }
  };
  // Small things also hide when the overview zooms far out (`far`), where
  // a fern or a toadstool is a pixel or two.
  const addedDetail = (mesh, far = false) => {
    world.addStreamed(mesh, { detail: true, far });
    world.water.excludeFromCaptures(mesh);
  };
  const leafMaterials = world.trees.materials.grounded(new T.Vector4(0, 0, -1e4, 0)),
    painted = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 });
  // The trees in six stands, three bands each side of the clearing, each
  // one job, one set of meshes and one level of detail; the great oak stands
  // alone. Zoomed out, where the whole wood is in view, each stand costs
  // three draws; but a stand culls only as a whole, and the village's views
  // by its west edge would draw (and shadow) larger stands they never see.
  // Each tree keeps the seed of its band and side, so regrouping the stands
  // never changes its shape.
  const STAND = (band, side) => `${band}-${side}`,
    grouped = new Map();
  for (const [side, west] of [
    ["west", true],
    ["east", false],
  ])
    for (const [band, from, to] of [
      ["north", -Infinity, -7],
      ["middle", -7, 7],
      ["south", 7, Infinity],
    ]) {
      const name = STAND(band, side);
      if (!grouped.has(name)) grouped.set(name, []);
      TREES.filter((t) => t.x < -35 === west && t.z >= from && t.z < to).forEach((tree, index) =>
        grouped.get(name).push({ ...tree, seed: [index, `${band}-${side}`.length * 7] }),
      );
    }
  const stands = [...grouped].map(([name, trees]) => ({ name, trees }));
  stands.push({
    name: "great oak",
    trees: [{ id: "great-oak", kind: "oak", x: W.oak.x, z: W.oak.z, wide: W.oak.scale, tall: 1.2, great: true }],
  });
  const jobs = [
    job("wood ground", -35, 0, groundBuilder(T, world), added),
    ...stands
      .filter((stand) => stand.trees.length)
      .map((stand) =>
        job(
          `wood trees (${stand.name})`,
          stand.trees.reduce((n, t) => n + t.x, 0) / stand.trees.length,
          stand.trees.reduce((n, t) => n + t.z, 0) / stand.trees.length,
          treeBuilder(T, world, stand, leafMaterials),
          (meshes) => {
            const [, shells, leaves, crown] = meshes;
            added(meshes);
            // The leaves' bounds enclose both blades and the wind's sway.
            leaves.geometry = leaves.userData.coarse;
            leaves.computeBoundingSphere();
            leaves.geometry = leaves.userData.fine;
            leaves.boundingSphere.radius += 0.14;
            world.trees.adopt({
              mesh: leaves,
              fine: leaves.userData.fine,
              coarse: leaves.userData.coarse,
              crown,
              underneath: [shells],
              center: leaves.boundingSphere.center.clone(),
              // The coarse level keeps a quarter of a stand's leaves (half of
              // the great oak's), so zoomed out the wood costs what it did
              // with half as many leaves up close.
              far: stand.name === "great oak" ? 0.5 : FAR_SHARE,
            });
            if (stand.name === "great oak")
              world.interactables.push({
                id: "great-oak",
                name: "The great oak",
                x: W.oak.x + 1.6,
                z: W.oak.z + 0.9,
                radius: 1.6,
              });
          },
        ),
      ),
    job("wood logs, stumps and table", W.log.x, W.log.z, () => logsAndStumps(T, world, range, painted), (meshes) => {
      // Zoomed far out, their shadows are a few pixels.
      added(meshes, { fineShadow: true });
      const l = W.log;
      world.interactables.push(
        {
          id: "hollow-log",
          name: "Hollow log",
          // The log's open end, on the trail's side.
          x: l.x - Math.cos(l.turn) * (l.length / 2 + 0.6),
          z: l.z - Math.sin(l.turn) * (l.length / 2 + 0.6),
          radius: 1.3,
        },
        { id: "wood-signpost", name: "Fingerpost", x: W.signpost.x, z: W.signpost.z - 0.7, radius: 1.2 },
      );
    }),
    // The ferns, toadstools and flowers are split per chunk where they are
    // built (the streamer adds what a job returns), so each part culls on
    // its own.
    job("wood ferns", -36, 2, () => splitByChunk(T, ferns(T, range)[0]), (meshes) => {
      for (const mesh of meshes) addedDetail(mesh, true);
    }),
    job(
      "wood mushrooms and fairy ring",
      W.ring.x,
      W.ring.z,
      () => {
        const [toadstools, ring] = mushrooms(T, range);
        return [ring, ...splitByChunk(T, toadstools)];
      },
      ([ring, ...toadstools]) => {
        for (const part of toadstools) addedDetail(part, true);
        // The ring glows at blue hour, like the village's lamps.
        added([ring]);
        world.interactables.push({
          id: "fairy-ring",
          name: "Fairy ring",
          x: W.ring.x,
          z: W.ring.z,
          radius: W.ring.r + 0.9,
        });
      },
    ),
    job(
      "wood flowers",
      -33,
      2,
      () => {
        const [stems, blooms, honeysuckle] = flowers(T, range);
        return [honeysuckle, ...splitByChunk(T, stems), ...splitByChunk(T, blooms)];
      },
      ([honeysuckle, ...meshes]) => {
        for (const mesh of [honeysuckle, ...meshes]) addedDetail(mesh, true);
        const open = honeysuckle.userData.open;
        world.animate(W.flowers.honeysuckle.x, W.flowers.honeysuckle.z, () => open(dusk()));
        for (const flower of FLOWERS) {
          const at = W.flowers[flower.id];
          world.interactables.push({
            id: `wood-${flower.id}`,
            type: "wood-flower",
            flower: flower.id,
            name: flower.name,
            x: at.x,
            z: at.z,
            radius: 1.4,
          });
        }
      },
    ),
    job("wood light shafts", W.clearing.x, W.clearing.z, () => shafts(T), ([mesh]) => {
      added([mesh], { far: true });
      const shine = mesh.userData.shine;
      world.animate(W.clearing.x, W.clearing.z, (dt, t, clock) => shine(clock, dusk()));
    }),
    // Rowan joins once her table stands, by the clearing's east edge.
    job("wood resident", W.residents.rowan.x, W.residents.rowan.z, () => [], () => {
      for (const resident of WOOD_RESIDENTS) life?.addResident(resident);
    }),
  ];
  return { jobs };
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
  const { minX, maxX, minZ, maxZ } = W.ground,
    cols = Math.round((maxX - minX) / GROUND_STEP) + 1,
    rows = Math.round((maxZ - minZ) / GROUND_STEP) + 1,
    positions = new Float32Array(cols * rows * 3),
    colors = new Float32Array(cols * rows * 3),
    uvs = new Float32Array(cols * rows * 2);
  // The wood is darker than the fields: a mossy floor, strewn with amber
  // beech leaves and browner oak litter, brighter moss in the clearing, bare
  // earth down the trails.
  const lawn = new T.Color(1, 1, 1),
    floor = tint(T, "#5b6c41"),
    dark = tint(T, "#4d5c38"),
    moss = tint(T, "#6f9a4f"),
    ring = tint(T, "#5c8f45"),
    beech = tint(T, "#8a6a3c"),
    oak = tint(T, "#6d6a40"),
    dell = tint(T, "#64776a"),
    earth = tint(T, "#8e7754"),
    worn = tint(T, "#7c8050"),
    sunlit = tint(T, "#6f7f48"),
    color = new T.Color();
  const near = (x, z, list, reach) =>
    list.filter((t) => Math.abs(t.x - x) < reach && Math.abs(t.z - z) < reach);
  function colorAt(x, z) {
    const mottle =
      Math.sin(x * 0.9 + 0.4) * Math.sin(z * 1.1 - 1.3) + 0.5 * Math.sin(x * 2.3 + z * 1.7);
    color.copy(floor);
    if (mottle > 0.3) color.lerp(dark, smooth(0.3, 1.2, mottle) * 0.6);
    // Leaf litter under each tree: amber under the beeches, brown under the oaks.
    for (const t of near(x, z, TREES, 2.6)) {
      const d = Math.hypot(x - t.x, z - t.z);
      if (d < 2.6)
        color.lerp(t.kind === "beech" ? beech : oak, (1 - smooth(0.6, 2.6, d)) * (t.kind === "beech" ? 0.5 : 0.35));
    }
    const great = Math.hypot(x - W.oak.x, z - W.oak.z);
    if (great < 4.5) color.lerp(oak, (1 - smooth(1.2, 4.5, great)) * 0.6);
    // Slopes turned to the afternoon sun a little brighter.
    const e = 0.3,
      gx = (woodHeight(x + e, z) - woodHeight(x - e, z)) / (2 * e),
      gz = (woodHeight(x, z + e) - woodHeight(x, z - e)) / (2 * e),
      facing = (-gx * SUN[0] - gz * SUN[2]) / Math.hypot(gx, 1, gz);
    if (facing > 0) color.lerp(sunlit, Math.min(1, facing * 1.5));
    // The clearing's moss, and the greener ring in it.
    const c = W.clearing,
      clearing = 1 - smooth(c.r - 1.4, c.r + 0.8, Math.hypot(x - c.x, z - c.z));
    if (clearing > 0) color.lerp(moss, clearing * 0.85);
    const r = Math.abs(Math.hypot(x - W.ring.x, z - W.ring.z) - W.ring.r);
    if (r < 0.5) color.lerp(ring, (1 - smooth(0.1, 0.5, r)) * 0.8);
    // A cooler, bluish haze over the bluebell dell.
    const b = W.flowers.bluebell,
      dellAt = Math.hypot(x - b.x, z - b.z);
    if (dellAt < 3.4) color.lerp(dell, (1 - smooth(1.2, 3.4, dellAt)) * 0.7);
    // The floor gives way to the fields' lawn along the wood's borders.
    color.lerp(lawn, 1 - woodFloor(x, z));
    // The trails: bare earth down their middles, worn at their edges, fading
    // in from the meadow.
    const trail = trailWeight(x, z) * smooth(W.ground.maxX, W.ground.maxX - 0.6, x);
    if (trail > 0) color.lerp(worn, smooth(0, 0.5, trail)).lerp(earth, smooth(0.45, 1, trail));
    return color;
  }
  let row = 0;
  return (deadline) => {
    for (; row < rows; row++) {
      if (performance.now() > deadline) return null;
      const z = minZ + row * GROUND_STEP;
      for (let col = 0; col < cols; col++) {
        const x = Math.min(maxX, minX + col * GROUND_STEP),
          i = row * cols + col;
        positions.set([x, woodGround(x, z), z], i * 3);
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
    mesh.name = "Old wood floor";
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    return [mesh];
  };
}

// --- Trees ----------------------------------------------------------------

// Each kind's shape and colours. Oaks spread wide and low; beeches stand
// taller and narrower, in amber.
const KINDS = {
  oak: {
    leaves: ["#50754a", "#5d8448", "#6e9150", "#87a35c", "#64884a"],
    bark: "#a08a70",
    limbs: 5,
    trunkTop: 2.6,
    trunk: 0.21,
    reach: [1.5, 2.1],
    height: [4, 4.9],
    top: 5.8,
    cluster: [1.05, 1.25],
    side: [0.75, 0.9],
    crown: 1.2,
    perCluster: 60,
    leafSize: [0.33, 0.44],
  },
  beech: {
    leaves: ["#c08a3e", "#cf9d4c", "#b07438", "#d8b05c", "#a7883f"],
    bark: "#b2ada0",
    limbs: 4,
    trunkTop: 3,
    trunk: 0.18,
    reach: [1.1, 1.6],
    height: [4.6, 5.6],
    top: 6.5,
    cluster: [0.95, 1.1],
    side: [0.7, 0.85],
    crown: 1.1,
    perCluster: 60,
    leafSize: [0.31, 0.42],
  },
};

// Each cluster's shell sits this deep inside its leaves (a fraction of its
// radius), this dark beside them, this squat underneath and this lumpy. The
// leaves reach down to LOWEST below the cluster's centre (the great oak's,
// which walkers stand under, all the way round); below that the shell's
// shade is the crown's underside.
const SHELL = 0.56,
  SHELL_TONE = 0.6,
  SHELL_UNDER = 0.75,
  SHELL_ROUGH = 0.16,
  LOWEST = 0.72,
  // The share of a stand's leaves the overview's coarse level draws.
  FAR_SHARE = 0.25;

/**
 * A leaf lying on a crown where the outward normal is `n`: its face turned
 * out, its tip drooping roughly downhill and lifted a little off the crown,
 * so from above it shows its face rather than its edge.
 */
function shingle(T, n, rand) {
  // Downhill on the crown: straight down, less its part along the normal.
  const down = new T.Vector3(0, -1, 0).addScaledVector(n, n.y);
  if (down.lengthSq() < 1e-6) down.set(1, 0, 0);
  down.normalize();
  const across = new T.Vector3().crossVectors(n, down),
    spin = (rand() - 0.5) * 2.8,
    lift = 0.2 + rand() * 0.55,
    tip = down
      .multiplyScalar(Math.cos(spin))
      .addScaledVector(across, Math.sin(spin))
      .multiplyScalar(Math.cos(lift))
      .addScaledVector(n, Math.sin(lift))
      .normalize(),
    face = n.clone().addScaledVector(tip, -n.dot(tip)).normalize(),
    side = new T.Vector3().crossVectors(face, tip),
    roll = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), (rand() - 0.5) * 0.9);
  return new T.Quaternion()
    .setFromRotationMatrix(new T.Matrix4().makeBasis(side, face, tip))
    .multiply(roll);
}

/**
 * Reshapes a copy of the coarse blade, a rhombus, into a leaf: broadest a
 * third of the way up and narrower, so lying face up it no longer reads as
 * a square. Same triangles, about the same area once the wood scales it up.
 */
function kite(geometry) {
  const position = geometry.attributes.position;
  let tip = 0;
  for (let i = 0; i < position.count; i++) tip = Math.max(tip, position.getZ(i));
  for (let i = 0; i < position.count; i++) {
    const z = position.getZ(i);
    if (z > tip * 0.05 && z < tip * 0.95) position.setZ(i, tip * 0.36);
    position.setX(i, position.getX(i) * 0.78);
  }
  geometry.computeVertexNormals();
  return geometry;
}

// Paints the bark of the last limb pushed to `out`: the kind's own bark,
// greening with moss low down and on its upper side.
const LIMB_BARK = "#b49c7c";
function barkPaint(T, out, bark, base, moss) {
  const geometry = out.at(-1),
    position = geometry.attributes.position,
    normal = geometry.attributes.normal,
    color = geometry.attributes.color,
    c = new T.Color(),
    tone = new T.Color(bark),
    reference = new T.Color(LIMB_BARK).r;
  for (let i = 0; i < position.count; i++) {
    const low = 1 - smooth(0.2, 1.4, position.getY(i) - base),
      up = smooth(0.2, 0.9, normal.getY(i));
    // limb() shades its bark around the limb; keep that shading on this tone.
    c.copy(tone)
      .multiplyScalar(color.getX(i) / reference)
      .lerp(moss, Math.max(low * 0.7, up * 0.45));
    color.setXYZ(i, c.r, c.g, c.b);
  }
}

/**
 * Builds a stand of trees a limb per slice, then returns its four meshes:
 * wood, the shady shells inside the crowns, the leaves, and the distant
 * crowns.
 */
function treeBuilder(T, world, stand, leafMaterials) {
  const { materials, blades } = world.trees,
    moss = new T.Color("#7d8a4c"),
    wood = [],
    shells = [],
    leaves = [],
    crownClusters = [];
  let next = 0;
  function* build(tree, order) {
    // A tree's place in its first band (see woodJobs), which seeds its shape.
    const index = tree.seed?.[0] ?? order;
    const style = KINDS[tree.kind],
      rand = tree.seed ? chunkRandom(index, tree.seed[1], 19) : chunkRandom(index, stand.name.length * 7 + 3, 19),
      range = (a, b) => a + (b - a) * rand(),
      wide = tree.wide ?? tree.scale,
      tall = tree.tall ?? tree.scale,
      // Seated a touch into the floor, so the trunk's foot never floats.
      base = woodGround(tree.x, tree.z) - 0.05,
      at = (x, y, z) => new T.Vector3(tree.x + x * wide, base + y * tall, tree.z + z * wide),
      curve = (points) => new T.CatmullRomCurve3(points.map((p) => at(...p))),
      // Young trees lean further, reaching for the light between crowns.
      lean = tree.young
        ? [range(-0.35, 0.35), range(-0.35, 0.35)]
        : [range(-0.14, 0.14), range(-0.14, 0.14)],
      rotation = range(0, TAU),
      leafColors = style.leaves.map((c) => new T.Color(c)),
      great = !!tree.great,
      limbs = great ? 8 : style.limbs,
      trunkTop = style.trunkTop * (great ? 0.85 : range(0.86, 1.12));
    const paint = () => barkPaint(T, wood, style.bark, base, moss);
    // The trunk, flaring at its foot over a few roots.
    limb(
      T,
      curve([
        [0, -0.05, 0],
        [lean[0] * 0.3, trunkTop * 0.45, lean[1] * 0.3],
        [lean[0], trunkTop, lean[1]],
      ]),
      style.trunk * (great ? 1.9 : 1) * wide,
      style.trunk * 0.55 * wide,
      6,
      great ? 10 : 7,
      wood,
    );
    paint();
    const roots = great ? 6 : 4;
    for (let i = 0; i < roots; i++) {
      const a = rotation + (i * TAU) / roots + range(-0.3, 0.3),
        out = great ? 1.25 : 0.6;
      limb(
        T,
        curve([
          [0, 0.45, 0],
          [Math.cos(a) * out * 0.45, 0.12, Math.sin(a) * out * 0.45],
          [Math.cos(a) * out, -0.06, Math.sin(a) * out],
        ]),
        style.trunk * 0.5 * wide,
        0.03 * wide,
        3,
        4,
        wood,
      );
      paint();
    }
    yield;
    const clusters = [];
    for (let i = 0; i < limbs; i++) {
      const a = rotation + (i * TAU) / limbs + range(-0.25, 0.25),
        reach = range(...style.reach) * (great ? 1.25 : 1),
        height = range(...style.height) * (great ? 0.95 : 1),
        start = trunkTop * range(0.72, 0.98),
        end = [Math.cos(a) * reach + lean[0], height, Math.sin(a) * reach + lean[1]],
        middle = [
          Math.cos(a) * reach * 0.45 + lean[0],
          start + (height - start) * 0.55,
          Math.sin(a) * reach * 0.45 + lean[1],
        ];
      limb(T, curve([[lean[0], start, lean[1]], middle, end]), 0.085 * wide, 0.025 * wide, 5, 5, wood);
      paint();
      clusters.push({ at: end, radius: range(...style.cluster) });
      // A side shoot from every other limb fills the crown between them.
      if (i % 2) {
        yield;
        continue;
      }
      const side = [
        middle[0] + Math.cos(a + 0.9) * reach * 0.4,
        middle[1] + range(0.5, 0.9),
        middle[2] + Math.sin(a + 0.9) * reach * 0.4,
      ];
      limb(T, curve([middle, side]), 0.04 * wide, 0.012 * wide, 2, 4, wood);
      paint();
      clusters.push({ at: side, radius: range(...style.side) });
      yield;
    }
    // A leader carries the crown's top.
    const top = [lean[0] * 1.4, style.top, lean[1] * 1.4];
    limb(T, curve([[lean[0], trunkTop - 0.1, lean[1]], [lean[0] * 1.2, (trunkTop + style.top) / 2, lean[1] * 1.2], top]), 0.08 * wide, 0.02 * wide, 5, 5, wood);
    paint();
    clusters.push({ at: top, radius: style.crown });
    for (const [c, cluster] of clusters.entries()) {
      const center = at(...cluster.at),
        radius = cluster.radius * wide,
        baseColor = leafColors[(index + c) % leafColors.length],
        // The great oak, which walkers stand under, keeps the village trees'
        // finer leaf; the rest of the wood draws the coarse blade shaped as a
        // leaf (see kite), twice a fine leaf's area for half its triangles,
        // so half as many cover a crown (see the leaves' mesh below).
        count = great ? 84 : Math.round(style.perCluster * (tree.young ? tree.scale + 0.15 : 1));
      crownClusters.push({ center, radius, color: baseColor });
      // The shell is the shade deep inside the cluster, well within the
      // leaves and darker than them, as in the orchard: the leaves make the
      // crown's surface, and the shell only shows through their gaps.
      shells.push({ center, radius: radius * SHELL, color: baseColor.clone().multiplyScalar(SHELL_TONE) });
      // Leaves lie over the cluster's outer layer like shingles, face out and
      // tips drooping outward, so each shows its face to the sky and the
      // camera above; most sit on the crown's top and flanks, which are seen.
      for (let j = 0; j < count; j++) {
        const y = 1 - ((1 + (great ? 1 : LOWEST)) * (j + 0.5)) / count,
          ring = Math.sqrt(1 - y * y),
          a = j * 2.39996 + c * 0.7 + rotation,
          direction = new T.Vector3(Math.cos(a) * ring, y * 0.82, Math.sin(a) * ring).normalize(),
          depth = range(0.68, 1.04),
          position = center
            .clone()
            .add(new T.Vector3(direction.x, direction.y * 0.82, direction.z).multiplyScalar(radius * depth)),
          quaternion = shingle(T, direction, rand);
        const size = (great ? range(0.36, 0.48) : range(...style.leafSize)) * Math.sqrt(wide);
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
      if (c % 4 === 3) yield;
    }
  }
  // Each tree's shells and distant crown are shaped as it finishes, so the
  // last slice only merges.
  const shellShape = new T.IcosahedronGeometry(1, 1),
    shellParts = [],
    crownParts = [],
    shape = (clusters, stretch = 1, rough = 0) =>
      crownShells(clusters, stretch, materials.crown, shellShape, rough).geometry;
  let building = null,
    shellsFrom = 0,
    crownsFrom = 0;
  const merged = (parts) => {
    const geometry = mergeGeometries(parts, false);
    for (const part of parts) part.dispose();
    geometry.computeBoundingSphere();
    return geometry;
  };
  return (deadline) => {
    while (next < stand.trees.length) {
      building ??= build(stand.trees[next], next);
      if (building.next().done) {
        building = null;
        next++;
        // The shade inside is lumpier than a distant crown, and flatter
        // underneath, so it never shows through the leaves as a ball.
        if (shells.length > shellsFrom) shellParts.push(shape(shells.slice(shellsFrom), SHELL_UNDER, SHELL_ROUGH));
        if (crownClusters.length > crownsFrom) crownParts.push(shape(crownClusters.slice(crownsFrom)));
        shellsFrom = shells.length;
        crownsFrom = crownClusters.length;
      }
      if (performance.now() > deadline) return null;
    }
    // Merging and instancing run in a slice of their own.
    if (next++ === stand.trees.length) return null;
    const name = stand.name === "great oak" ? "Great oak" : `Old wood trees (${stand.name})`;
    const woodMesh = new T.Mesh(merged(wood), materials.wood);
    woodMesh.name = `${name}: bark and limbs`;
    // Shells: the crowns' leafy mass, so a modest number of leaves reads as
    // a full canopy. The leaves cast the crown's shadow, dappled.
    const shellMesh = new T.Mesh(merged(shellParts), materials.crown);
    shellMesh.name = `${name}: canopy shade`;
    shellMesh.castShadow = false;
    // Every fourth leaf first, then the rest of the even ones, then the odd:
    // the overview's coarse level draws a leading share, evenly spread.
    const ordered = [0, 2, 1, 3].flatMap((k) => leaves.filter((_, i) => i % 4 === k)),
      lift = new T.InstancedBufferAttribute(Float32Array.from(ordered, (l) => l.lift), 1),
      // Away from the great oak, even the nearest leaves are the coarse
      // blade; far off (level 1) half of them still show.
      fine = stand.name === "great oak" ? blades.fine.clone() : kite(blades.coarse.clone()),
      coarse = kite(blades.coarse.clone());
    fine.setAttribute("groundLift", lift);
    coarse.setAttribute("groundLift", lift);
    const leafMesh = new T.InstancedMesh(fine, leafMaterials.leaf, ordered.length),
      dummy = new T.Object3D();
    ordered.forEach((record, i) => {
      dummy.position.copy(record.position);
      dummy.quaternion.copy(record.quaternion);
      dummy.scale.copy(record.scale);
      dummy.updateMatrix();
      leafMesh.setMatrixAt(i, dummy.matrix);
      leafMesh.setColorAt(i, record.color);
    });
    leafMesh.customDepthMaterial = leafMaterials.depth;
    leafMesh.userData.fine = fine;
    leafMesh.userData.coarse = coarse;
    leafMesh.name = `${name}: leaves`;
    leafMesh.castShadow = true;
    // Distant crowns, for first person beyond the leaves' range.
    const crownMesh = new T.Mesh(merged(crownParts), materials.crown);
    crownMesh.name = `${name}: distant crowns`;
    crownMesh.castShadow = true;
    crownMesh.visible = false;
    for (const mesh of [woodMesh, shellMesh, leafMesh, crownMesh]) {
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
    }
    // Under a closed canopy the trunks' shadows fall in the leaves' shade;
    // only the great oak, which stands in the open, casts its own.
    woodMesh.castShadow = stand.name === "great oak";
    return [woodMesh, shellMesh, leafMesh, crownMesh];
  };
}

// --- Logs, stumps, Rowan's table and the fingerpost -------------------------

// Flips a non-indexed tube inside out, so its inner wall faces inward.
function insideOut(geometry) {
  const flip = (attribute, negate) => {
    const a = attribute.array,
      size = attribute.itemSize;
    for (let i = 0; i < a.length; i += size * 3)
      for (let k = 0; k < size; k++) {
        const t = a[i + size + k];
        a[i + size + k] = a[i + size * 2 + k];
        a[i + size * 2 + k] = t;
      }
    if (negate) for (let i = 0; i < a.length; i++) a[i] = -a[i];
  };
  for (const [name, attribute] of Object.entries(geometry.attributes))
    flip(attribute, name === "normal");
  return geometry;
}

/**
 * The hollow log, the stumps and fallen branches in the trees' bark; Rowan's
 * stump table with her basket, flower press and jar, and the fingerpost, as
 * one painted mesh.
 */
function logsAndStumps(T, world, range, material) {
  const bark = [],
    moss = new T.Color("#7d8a4c"),
    heart = new T.Color("#5a4632"),
    cut = new T.Color("#c7a77a"),
    mossy = (geometry, amount = 0.7) => {
      const position = geometry.attributes.position,
        normal = geometry.attributes.normal,
        color = geometry.attributes.color,
        c = new T.Color();
      for (let i = 0; i < position.count; i++) {
        c.fromBufferAttribute(color, i).lerp(moss, smooth(0.1, 0.8, normal.getY(i)) * amount);
        color.setXYZ(i, c.r, c.g, c.b);
      }
    };
  // The hollow log: an outer tube of mossy bark, a dark inner wall, and a
  // pale rim of rotten wood at each open end.
  const l = W.log,
    ex = Math.cos(l.turn),
    ez = Math.sin(l.turn),
    lx = (t) => l.x + ex * t,
    lz = (t) => l.z + ez * t,
    ly = (t) => woodGround(lx(t), lz(t)) + l.radius - 0.08,
    line = (r) =>
      new T.CatmullRomCurve3(
        [-0.5, -0.17, 0.17, 0.5].map(
          (k) => new T.Vector3(lx(k * l.length), ly(k * l.length) + Math.sin(k * 3) * 0.03, lz(k * l.length)),
        ),
      ),
    paintTube = (tone) => {
      const geometry = bark.at(-1),
        color = geometry.attributes.color,
        c = new T.Color();
      for (let i = 0; i < color.count; i++) {
        c.fromBufferAttribute(color, i).multiply(tone).multiplyScalar(1 / 0.7);
        color.setXYZ(i, c.r, c.g, c.b);
      }
    };
  limb(T, line(), l.radius, l.radius * 0.9, 10, 14, bark);
  mossy(bark.at(-1), 0.85);
  limb(T, line(), l.radius * 0.8, l.radius * 0.72, 6, 12, bark);
  paintTube(heart);
  insideOut(bark.at(-1));
  for (const end of [-0.5, 0.5]) {
    const t = end * l.length,
      r = end < 0 ? l.radius : l.radius * 0.9,
      rim = new T.RingGeometry(r * 0.78, r, 14, 1).toNonIndexed(),
      count = rim.attributes.position.count,
      colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) cut.toArray(colors, i * 3);
    rim.setAttribute("color", new T.BufferAttribute(colors, 3));
    rim.lookAt(new T.Vector3(ex * end, 0, ez * end));
    rim.translate(lx(t), ly(t), lz(t));
    bark.push(rim);
  }
  // Stumps: short mossy trunks, sawn flat, with pale tops.
  const stump = (x, z, s) => {
    const base = woodGround(x, z) - 0.04,
      h = 0.42 * s,
      r = 0.3 * s;
    limb(
      T,
      new T.CatmullRomCurve3([new T.Vector3(x, base, z), new T.Vector3(x, base + h * 0.5, z), new T.Vector3(x, base + h, z)]),
      r * 1.12,
      r,
      3,
      12,
      bark,
    );
    mossy(bark.at(-1), 0.4);
    // Moss creeps up from the foot.
    const position = bark.at(-1).attributes.position,
      color = bark.at(-1).attributes.color,
      c = new T.Color();
    for (let i = 0; i < position.count; i++) {
      c.fromBufferAttribute(color, i).lerp(moss, (1 - smooth(0, h * 0.8, position.getY(i) - base)) * 0.7);
      color.setXYZ(i, c.r, c.g, c.b);
    }
    const top = new T.CircleGeometry(r, 12).rotateX(-Math.PI / 2).toNonIndexed(),
      colors = new Float32Array(top.attributes.position.count * 3);
    for (let i = 0; i < top.attributes.position.count; i++) {
      const p = top.attributes.position,
        rings = 0.88 + 0.12 * Math.sin(Math.hypot(p.getX(i), p.getZ(i)) * 60);
      c.copy(cut).multiplyScalar(rings).toArray(colors, i * 3);
    }
    top.setAttribute("color", new T.BufferAttribute(colors, 3));
    top.translate(x, base + h, z);
    bark.push(top);
  };
  for (const [x, z, s] of W.stumps) stump(x, z, s);
  // Rowan's table is the biggest stump of all.
  stump(W.table.x, W.table.z, W.table.r / 0.3);
  // Fallen branches across the floor.
  for (let i = 0; i < 9; i++) {
    let x, z;
    for (let tries = 0; tries < 20; tries++) {
      x = range(W.ground.minX + 2, W.ground.maxX - 4);
      z = range(W.ground.minZ + 2, W.ground.maxZ - 2);
      if (trailDistance(x, z) > 1.6 && !blockedFloor(x, z, 1.2)) break;
    }
    const a = range(0, TAU),
      length = range(1.2, 2.4),
      points = [-0.5, 0, 0.5].map((k) => {
        const px = x + Math.cos(a) * length * k,
          pz = z + Math.sin(a) * length * k;
        return new T.Vector3(px, woodGround(px, pz) + 0.05 + (k === 0 ? 0.04 : 0), pz);
      });
    limb(T, new T.CatmullRomCurve3(points), 0.06, 0.025, 5, 5, bark);
    mossy(bark.at(-1), 0.5);
  }
  const barkGeometry = mergeGeometries(bark, false);
  for (const part of bark) part.dispose();
  barkGeometry.computeBoundingSphere();
  const barkMesh = new T.Mesh(barkGeometry, world.trees.materials.wood);
  barkMesh.name = "Old wood logs and stumps";
  barkMesh.castShadow = barkMesh.receiveShadow = true;
  barkMesh.matrixAutoUpdate = false;

  // Rowan's things on her table, and the fingerpost.
  const k = createKit(T, { segments: 10 }),
    t = W.table,
    top = woodGround(t.x, t.z) - 0.04 + 0.42 * (t.r / 0.3);
  k.placed(t.x, top, t.z, -0.5, () => {
    // A wicker basket with a handle, half full of mushrooms.
    k.cyl("#a07a4a", -0.16, 0.1, 0.05, 0.17, 0.2);
    k.cyl("#8a6a40", -0.16, 0.2, 0.05, 0.175, 0.025);
    k.rod("#8a6a40", [-0.32, 0.2, 0.05], [-0.16, 0.42, 0.05], 0.015);
    k.rod("#8a6a40", [-0.16, 0.42, 0.05], [0, 0.2, 0.05], 0.015);
    for (const [x, z] of [
      [-0.2, 0.02],
      [-0.1, 0.1],
      [-0.14, -0.04],
    ])
      k.ball("#c8a070", x, 0.22, z, 0.05, 0.03, 0.05);
    // The flower press: two boards with a bolt at each corner.
    k.box("#7a5a3a", 0.18, 0.02, -0.05, 0.26, 0.03, 0.2);
    k.box("#e9e0c8", 0.18, 0.045, -0.05, 0.23, 0.02, 0.17);
    k.box("#7a5a3a", 0.18, 0.07, -0.05, 0.26, 0.03, 0.2);
    for (const [x, z] of [
      [0.07, -0.13],
      [0.29, -0.13],
      [0.07, 0.03],
      [0.29, 0.03],
    ])
      k.cyl("#5c5a55", x, 0.08, z, 0.012, 0.09);
    // A jar of something gathered.
    k.cyl("#b98a5a", 0.12, 0.08, 0.17, 0.045, 0.14);
    k.cyl("#e6dcc4", 0.12, 0.16, 0.17, 0.05, 0.02);
  });
  const s = W.signpost,
    foot = woodGround(s.x, s.z) - 0.05;
  k.post("#76604a", s.x, s.z, foot, foot + 1.55, 0.05);
  // Its arm points east, back to the village, and west, into the wood.
  k.box("#a58b68", s.x, foot + 1.32, s.z, 0.04, 0.16, 0.7, 0.1);
  k.box("#a58b68", s.x, foot + 1.1, s.z, 0.6, 0.15, 0.04, -0.08);
  k.pyramid("#5d6b3f", s.x, foot + 1.6, s.z, 0.09, 0.1);
  const painted = k.mesh("Rowan's table and the fingerpost", material);
  k.dispose();
  return [barkMesh, painted];
}

// Footings the floor's scatter keeps clear of.
let floorFootings = null;
function blockedFloor(x, z, margin) {
  for (const c of (floorFootings ??= woodColliders()))
    if (Math.hypot(x - c.x, z - c.z) < c.r + margin) return true;
  if (logDistance(x, z) < W.log.radius + margin) return true;
  return false;
}

// --- Ferns ----------------------------------------------------------------

// One fern: fronds arching out from the crown, each a tapering strip.
function fernGeometry(T) {
  const parts = [],
    fronds = 6,
    segments = 6;
  for (let f = 0; f < fronds; f++) {
    const a = (f / fronds) * TAU + (f % 2) * 0.35,
      reach = 0.5 + (f % 3) * 0.08,
      lift = 0.42 + (f % 2) * 0.1,
      positions = [],
      colors = [],
      indices = [];
    for (let s = 0; s <= segments; s++) {
      const t = s / segments,
        r = reach * t,
        y = lift * Math.sin(t * Math.PI * 0.8) - t * t * 0.12,
        // Leaflets: the frond's edge steps in and out along its length.
        w = 0.12 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.08)) * (s % 2 ? 1 : 0.45),
        cx = Math.cos(a) * r,
        cz = Math.sin(a) * r,
        px = -Math.sin(a) * w,
        pz = Math.cos(a) * w,
        shade = 0.55 + 0.45 * t;
      positions.push(cx + px, y, cz + pz, cx - px, y, cz - pz);
      colors.push(shade, shade, shade * 0.9, shade * 0.9, shade * 0.9, shade * 0.8);
      if (s < segments) {
        const i = s * 2;
        indices.push(i, i + 2, i + 1, i + 1, i + 2, i + 3);
      }
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    parts.push(geometry.toNonIndexed());
  }
  const geometry = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  geometry.computeVertexNormals();
  return geometry;
}

/** Ferns and bracken over the floor, thickest under the trees. */
function ferns(T, range) {
  const count = 340,
    mesh = new T.InstancedMesh(
      fernGeometry(T),
      new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: T.DoubleSide }),
      count,
    ),
    dummy = new T.Object3D(),
    greens = ["#4f7a3a", "#5c8743", "#6a9248", "#48703a"].map((c) => new T.Color(c)),
    bracken = ["#8a7a42", "#97874c"].map((c) => new T.Color(c)),
    c = W.clearing,
    flowers = Object.values(W.flowers);
  let placed = 0;
  for (let tries = 0; tries < 4000 && placed < count; tries++) {
    const x = range(W.ground.minX + 0.8, W.ground.maxX - 1),
      z = range(W.ground.minZ + 0.8, W.ground.maxZ - 0.8),
      edge = W.ground.maxX - x;
    if (edge < 4 && range(0, 1) > edge / 6) continue;
    if (trailDistance(x, z, 1.2) < 0.95) continue;
    if (Math.hypot(x - c.x, z - c.z) < c.r - 0.9) continue;
    if (blockedFloor(x, z, 0.35)) continue;
    if (flowers.some((f) => Math.hypot(x - f.x, z - f.z) < 1.3)) continue;
    if (Math.hypot(x - W.table.x, z - W.table.z) < 1.4) continue;
    if (Math.hypot(x - W.residents.rowan.x, z - W.residents.rowan.z) < 1) continue;
    const size = range(0.7, 1.35);
    dummy.position.set(x, woodGround(x, z) - 0.02, z);
    dummy.rotation.set(range(-0.08, 0.08), range(0, TAU), range(-0.08, 0.08));
    dummy.scale.set(size, size * range(0.85, 1.15), size);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);
    const palette = range(0, 1) < 0.15 ? bracken : greens;
    mesh.setColorAt(placed++, palette[Math.floor(range(0, palette.length))]);
  }
  mesh.count = placed;
  mesh.name = "Old wood ferns";
  // Low enough that the canopy's shade covers them; they only take shadows.
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  mesh.computeBoundingSphere();
  return [mesh];
}

// --- Mushrooms and the fairy ring ------------------------------------------

// A toadstool: a stem and a domed cap, coloured by the instance.
function toadstoolGeometry(T) {
  const stem = new T.CylinderGeometry(0.16, 0.2, 1, 5, 1, true).translate(0, 0.5, 0).toNonIndexed(),
    cap = new T.SphereGeometry(0.5, 7, 3, 0, TAU, 0, Math.PI / 2).scale(1, 0.62, 1).translate(0, 0.92, 0).toNonIndexed(),
    paint = (geometry, value) => {
      const colors = new Float32Array(geometry.attributes.position.count * 3).fill(value);
      geometry.setAttribute("color", new T.BufferAttribute(colors, 3));
      geometry.deleteAttribute("uv");
    };
  paint(stem, 1.6);
  paint(cap, 1);
  const geometry = mergeGeometries([stem, cap], false);
  stem.dispose();
  cap.dispose();
  return geometry;
}

/**
 * Toadstools at the trees' feet and on the logs, and the fairy ring: pale
 * mushrooms in a circle in the clearing, which glow at blue hour.
 */
function mushrooms(T, range) {
  const geometry = toadstoolGeometry(T),
    toadstools = new T.InstancedMesh(
      geometry,
      new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }),
      150,
    ),
    ring = new T.InstancedMesh(
      geometry,
      new T.MeshStandardMaterial({
        vertexColors: true,
        color: "#efe6cf",
        roughness: 0.6,
        // Lit from within at blue hour (glowMaterials raise its intensity).
        emissive: "#4f8a66",
        emissiveIntensity: 0.25,
      }),
      W.ring.count + 6,
    ),
    dummy = new T.Object3D(),
    browns = ["#8a5a32", "#a8743f", "#b98a52", "#6f4a2c"].map((c) => new T.Color(c)),
    red = new T.Color("#c23a2a"),
    pale = new T.Color("#f2e9d6");
  const put = (mesh, slot, x, y, z, size, tilt = 0.12) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(range(-tilt, tilt), range(0, TAU), range(-tilt, tilt));
    dummy.scale.set(size, size * range(0.8, 1.2), size);
    dummy.updateMatrix();
    mesh.setMatrixAt(slot, dummy.matrix);
  };
  let n = 0;
  // Clusters at the feet of trees.
  for (const tree of TREES) {
    if (n >= toadstools.count - 20) break;
    if (range(0, 1) < 0.45) continue;
    const a = range(0, TAU),
      count = Math.floor(range(2, 5));
    for (let k = 0; k < count && n < toadstools.count - 20; k++) {
      const r = range(0.4, 0.75) * tree.scale,
        b = a + range(-0.4, 0.4),
        x = tree.x + Math.cos(b) * r,
        z = tree.z + Math.sin(b) * r;
      put(toadstools, n, x, woodGround(x, z) - 0.01, z, range(0.07, 0.13));
      toadstools.setColorAt(n++, range(0, 1) < 0.12 ? red : browns[Math.floor(range(0, browns.length))]);
    }
  }
  // Little brackets along the top of the hollow log.
  const l = W.log;
  for (let k = 0; k < 14 && n < toadstools.count; k++) {
    const t = range(-0.45, 0.45) * l.length,
      side = range(-0.6, 0.6),
      x = l.x + Math.cos(l.turn) * t - Math.sin(l.turn) * side * l.radius,
      z = l.z + Math.sin(l.turn) * t + Math.cos(l.turn) * side * l.radius,
      y = woodGround(x, z) + l.radius * 2 - 0.08 - Math.abs(side) * 0.1;
    put(toadstools, n, x, y, z, range(0.04, 0.07), 0.3);
    toadstools.setColorAt(n++, browns[Math.floor(range(0, browns.length))]);
  }
  // A few in the moss along the trails.
  for (let tries = 0; tries < 200 && n < toadstools.count; tries++) {
    const x = range(W.ground.minX + 1, W.ground.maxX - 2),
      z = range(W.ground.minZ + 1, W.ground.maxZ - 1),
      d = trailDistance(x, z, 1.6);
    if (d < 0.75 || d > 1.5 || blockedFloor(x, z, 0.15)) continue;
    put(toadstools, n, x, woodGround(x, z) - 0.01, z, range(0.06, 0.1));
    toadstools.setColorAt(n++, browns[Math.floor(range(0, browns.length))]);
  }
  toadstools.count = n;
  // The fairy ring, with a few strays just outside it.
  let m = 0;
  for (let k = 0; k < W.ring.count; k++) {
    const a = (k / W.ring.count) * TAU + range(-0.12, 0.12),
      r = W.ring.r + range(-0.08, 0.08),
      x = W.ring.x + Math.cos(a) * r,
      z = W.ring.z + Math.sin(a) * r;
    put(ring, m, x, woodGround(x, z) - 0.01, z, range(0.11, 0.16), 0.06);
    ring.setColorAt(m++, pale);
  }
  for (let k = 0; k < 6; k++) {
    const a = range(0, TAU),
      r = W.ring.r + range(0.3, 0.7),
      x = W.ring.x + Math.cos(a) * r,
      z = W.ring.z + Math.sin(a) * r;
    put(ring, m, x, woodGround(x, z) - 0.01, z, range(0.06, 0.09));
    ring.setColorAt(m++, pale);
  }
  toadstools.name = "Old wood toadstools";
  ring.name = "Fairy ring";
  for (const mesh of [toadstools, ring]) {
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.computeBoundingSphere();
  }
  return [toadstools, ring];
}

// --- Woodland flowers ---------------------------------------------------------

// Each flower's patch: how many plants, how far they spread, how tall they
// stand, and the colours of their blooms.
const PATCHES = {
  primrose: { plants: 26, spread: 1.1, height: [0.08, 0.12], bloom: 0.045, flat: 0.45, per: 3, colors: ["#f3e48c", "#f6ea9f", "#efdb78"] },
  bluebell: { plants: 220, spread: 3, height: [0.18, 0.3], bloom: 0.028, flat: 1.3, per: 4, droop: true, colors: ["#5a63c4", "#6a6fd0", "#4d58b0", "#7a76d6"] },
  campion: { plants: 26, spread: 1.1, height: [0.3, 0.48], bloom: 0.035, flat: 0.5, per: 2, colors: ["#d4507a", "#e0688c", "#c8456e"] },
  foxglove: { plants: 9, spread: 0.9, height: [0.8, 1.15], bloom: 0.04, flat: 1.4, spike: 9, colors: ["#b2509e", "#c463ac", "#a6488f"] },
  sorrel: { plants: 22, spread: 0.7, height: [0.05, 0.08], bloom: 0.025, flat: 0.5, per: 1, colors: ["#f4eef0", "#efe2ec"] },
  anemone: { plants: 60, spread: 1.6, height: [0.1, 0.16], bloom: 0.04, flat: 0.4, per: 1, colors: ["#f7f5ee", "#f2eef4", "#f4f0e2"] },
};

/**
 * The woodland flowers: a patch of each round its spot (W.flowers), stems in
 * one mesh and blooms in another, and the honeysuckle twined over its stump,
 * whose blooms open at blue hour.
 */
function flowers(T, range) {
  const stems = new T.InstancedMesh(
      new T.CylinderGeometry(1, 1, 1, 4).translate(0, 0.5, 0),
      new T.MeshStandardMaterial({ color: "#5b7d3c", roughness: 0.85 }),
      700,
    ),
    blooms = new T.InstancedMesh(
      new T.OctahedronGeometry(1, 0),
      new T.MeshStandardMaterial({ roughness: 0.7 }),
      1700,
    ),
    dummy = new T.Object3D(),
    leafGreen = new T.Color("#4f7436");
  let s = 0,
    b = 0;
  const bloom = (x, y, z, sx, sy, color) => {
    if (b >= blooms.count) return;
    dummy.position.set(x, y, z);
    dummy.rotation.set(range(-0.3, 0.3), range(0, TAU), range(-0.3, 0.3));
    dummy.scale.set(sx, sy, sx);
    dummy.updateMatrix();
    blooms.setMatrixAt(b, dummy.matrix);
    blooms.setColorAt(b++, color);
  };
  const stem = (x, y, z, height, lean = [0, 0]) => {
    if (s >= stems.count) return;
    dummy.position.set(x, y, z);
    dummy.rotation.set(lean[0], 0, lean[1]);
    dummy.scale.set(0.006, height, 0.006);
    dummy.updateMatrix();
    stems.setMatrixAt(s++, dummy.matrix);
  };
  for (const [id, p] of Object.entries(PATCHES)) {
    const at = W.flowers[id],
      colors = p.colors.map((c) => new T.Color(c));
    for (let i = 0; i < p.plants; i++) {
      const a = range(0, TAU),
        r = p.spread * Math.sqrt(range(0, 1)),
        x = at.x + Math.cos(a) * r,
        z = at.z + Math.sin(a) * r;
      if (trailDistance(x, z, 1) < 0.6 || blockedFloor(x, z, 0.05)) continue;
      const ground = woodGround(x, z),
        height = range(...p.height),
        color = colors[Math.floor(range(0, colors.length))];
      // A rosette of leaves at the foot of the low flowers.
      if (height < 0.2 && i % 2 === 0) bloom(x, ground + 0.015, z, 0.07, 0.012, leafGreen);
      if (p.spike) {
        // Foxgloves: a tall stem hung with bells, smallest at the top.
        stem(x, ground, z, height);
        bloom(x, ground + 0.03, z, 0.16, 0.03, leafGreen);
        for (let k = 0; k < p.spike; k++) {
          const t = 0.45 + (k / p.spike) * 0.5,
            turn = k * 2.4;
          bloom(
            x + Math.cos(turn) * 0.035,
            ground + height * t,
            z + Math.sin(turn) * 0.035,
            p.bloom * (1.15 - t * 0.6),
            p.bloom * p.flat * (1.15 - t * 0.6),
            color,
          );
        }
        continue;
      }
      const lean = [range(-0.25, 0.25), range(-0.25, 0.25)];
      stem(x, ground, z, height, lean);
      const tipX = x + Math.sin(-lean[1]) * height,
        tipZ = z + Math.sin(lean[0]) * height,
        tipY = ground + height * 0.96;
      for (let k = 0; k < p.per; k++) {
        // Bluebells hang their bells down one side of the arching stem.
        const along = p.droop ? 1 - k * 0.16 : 1,
          side = p.droop ? 0.03 + k * 0.012 : range(-0.03, 0.03);
        bloom(
          x + (tipX - x) * along + (p.droop ? side : range(-0.02, 0.02)),
          ground + (tipY - ground) * along - (p.droop ? 0.02 + k * 0.01 : 0),
          z + (tipZ - z) * along + (p.droop ? 0 : side),
          p.bloom,
          p.bloom * p.flat,
          color,
        );
      }
    }
  }
  stems.count = s;
  stems.name = "Woodland flower stems";
  blooms.name = "Woodland flowers";
  // Honeysuckle twined over its stump: its leaves join the other flowers'
  // blooms; its buds, a mesh of their own, open into cream trumpets at blue
  // hour.
  const h = W.flowers.honeysuckle,
    stump = W.stumps.find(([x, z]) => Math.hypot(x - h.x, z - h.z) < 0.5) ?? [h.x, h.z, 1],
    top = woodGround(h.x, h.z) - 0.04 + 0.42 * stump[2],
    radius = 0.3 * stump[2],
    honeysuckle = new T.InstancedMesh(
      new T.OctahedronGeometry(1, 0),
      new T.MeshStandardMaterial({ roughness: 0.7 }),
      26,
    ),
    bud = new T.Color("#a8b26a"),
    open = new T.Color("#f4e2b0"),
    leaves = new T.Color("#557a3a");
  const twined = () => {
    const a = range(0, TAU),
      y = range(-0.38, 0.12) * stump[2],
      reach = radius * (y > 0 ? range(0.2, 1.1) : 1.08);
    return [h.x + Math.cos(a) * reach, top + y, h.z + Math.sin(a) * reach];
  };
  for (let k = 0; k < 50; k++) {
    const [x, y, z] = twined();
    bloom(x, y, z, 0.05, 0.015, leaves);
  }
  for (let k = 0; k < honeysuckle.count; k++) {
    const [x, y, z] = twined();
    dummy.position.set(x, y, z);
    dummy.rotation.set(range(-1, 1), range(0, TAU), range(-1, 1));
    dummy.scale.set(0.03, 0.06, 0.03);
    dummy.updateMatrix();
    honeysuckle.setMatrixAt(k, dummy.matrix);
  }
  blooms.count = b;
  honeysuckle.name = "Honeysuckle";
  honeysuckle.material.color.copy(bud);
  honeysuckle.userData.open = (dusk) => {
    honeysuckle.material.color.lerpColors(bud, open, smooth(0.3, 0.8, dusk));
  };
  for (const mesh of [stems, blooms, honeysuckle]) {
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.computeBoundingSphere();
  }
  return [stems, blooms, honeysuckle];
}

// --- Light shafts --------------------------------------------------------------

// Where sunlight slants through the canopy to the floor.
const SHAFTS = [
  { x: -34.2, z: 0.2, r: 1.2 },
  { x: -36.4, z: 2.6, r: 0.8 },
  { x: -37.4, z: 12.6, r: 0.9 },
  { x: -31.4, z: -15, r: 0.8 },
  { x: -28.6, z: 3.8, r: 0.7 },
  { x: -39, z: -8.4, r: 0.7 },
];

/**
 * Soft shafts of sunlight slanting down into the clearing and the gaps:
 * open tubes along the sun's direction, brightest where they face the eye
 * and fading at both ends. They fade out as blue hour falls.
 */
function shafts(T) {
  const length = 9,
    parts = SHAFTS.map(({ x, z, r }) => {
      const geometry = new T.CylinderGeometry(r * 0.7, r, length, 14, 1, true);
      // Up the tube is toward the sun.
      geometry.translate(0, length / 2, 0);
      geometry.applyMatrix4(
        new T.Matrix4().makeRotationFromQuaternion(
          new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(...SUN)),
        ),
      );
      geometry.translate(x, woodGround(x, z) - 0.1, z);
      return geometry;
    }),
    geometry = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  geometry.computeBoundingSphere();
  const material = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
    blending: T.AdditiveBlending,
    uniforms: { strength: { value: 0.1 } },
    vertexShader: `varying vec2 vUv;varying vec3 vNormal;varying vec3 vView;
void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vView=-mv.xyz;vNormal=normalMatrix*normal;gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `varying vec2 vUv;varying vec3 vNormal;varying vec3 vView;uniform float strength;
void main(){float facing=abs(dot(normalize(vNormal),normalize(vView)));float end=smoothstep(0.,.25,vUv.y)*(1.-smoothstep(.55,.95,vUv.y));gl_FragColor=vec4(vec3(1.,.86,.58)*facing*facing*end*strength,1.);}`,
  });
  const mesh = new T.Mesh(geometry, material);
  mesh.name = "Old wood light shafts";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.matrixAutoUpdate = false;
  mesh.renderOrder = 2;
  mesh.userData.shine = (clock, dusk) => {
    const level = 1 - smooth(0.05, 0.55, dusk);
    // The material's flag, since the overview's zoom owns the mesh's.
    material.visible = level > 0.01;
    // A slow breathing, as leaves overhead move across the sun.
    material.uniforms.strength.value = 0.1 * level * (0.85 + 0.15 * Math.sin(clock * 0.4));
  };
  return [mesh];
}
