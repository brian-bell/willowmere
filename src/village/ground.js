// The ground: the village's soil and grass slabs, the open country's soil
// strips and one grass surface with the village and each region's ground
// cut out of it, and the soft contact shadows under buildings and shrubs.

import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { regions } from "../regions/index.js";
import { WORLD, inset, terrainHeight } from "../world-layout.js";

/**
 * Boxes that tile `outer` outside every box in `holes`: one column between
 * each pair of neighbouring x edges, its spans joined with the same spans in
 * the column before.
 */
function boxesOutside(outer, holes) {
  const xs = [
      ...new Set([outer.minX, outer.maxX, ...holes.flatMap((h) => [h.minX, h.maxX])]),
    ]
      .filter((x) => x >= outer.minX && x <= outer.maxX)
      .sort((a, b) => a - b),
    boxes = [];
  let open = new Map();
  for (let i = 0; i < xs.length - 1; i++) {
    const minX = xs[i],
      maxX = xs[i + 1],
      next = new Map();
    let spans = [[outer.minZ, outer.maxZ]];
    for (const h of holes)
      if (h.minX < maxX && h.maxX > minX)
        spans = spans.flatMap(([a, b]) =>
          [
            [a, Math.min(b, h.minZ)],
            [Math.max(a, h.maxZ), b],
          ].filter(([c, d]) => d > c),
        );
    for (const [minZ, maxZ] of spans) {
      const key = `${minZ},${maxZ}`,
        box = open.get(key) ?? { minX, maxX, minZ, maxZ };
      if (open.has(key)) box.maxX = maxX;
      else boxes.push(box);
      next.set(key, box);
    }
    open = next;
  }
  return boxes;
}

export function buildGround(kit) {
  const { box, soil, grass, T, mesh, mat } = kit;
  // Sculpted meadow base, its floating soil rim discreetly visible at the wooded margins.
  // The channel is physically recessed, so refraction sees its bed rather than lawn.
  // Ground slabs, roads and the riverbed only receive shadows. As casters they would
  // fill the whole shadow map without darkening anything the camera can see.
  // The village keeps its original island slabs; the open country around it
  // adds the same layers out to the map's rim. The brook's channel runs on
  // past the village's edges into the millpond's ground and the marsh's.
  const { ground, village } = WORLD,
    groundDepth = village.maxZ - village.minZ,
    groundZ = (village.minZ + village.maxZ) / 2;
  const flat = [
    box(
      soil,
      (village.minX + village.maxX) / 2,
      -1.18,
      groundZ,
      village.maxX - village.minX,
      0.34,
      groundDepth,
    ),
  ];
  for (const [left, right] of [
    [village.minX, 9.7],
    [14.3, village.maxX],
  ])
    flat.push(
      box(soil, (left + right) / 2, -0.58, groundZ, right - left, 1.06, groundDepth),
    );
  for (const [left, right] of [
    [village.minX + 0.2, 9.7],
    [14.3, village.maxX - 0.2],
  ])
    flat.push(
      box(grass, (left + right) / 2, -0.1, groundZ, right - left, 0.3, groundDepth - 0.4),
    );
  // The open country's ground: two meshes, its grass and its soil, kept out
  // of the village's bake so the village's batches stay as they were and the
  // fields can be measured on their own (tune({ fields: false })).
  const fieldGrass = [],
    fieldSoil = [];
  // Texture laid out in world space, so neighbouring pieces continue it.
  const worldUV = (geometry) => {
    const position = geometry.attributes.position,
      normal = geometry.attributes.normal,
      uv = geometry.attributes.uv;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i),
        z = position.getZ(i);
      if (Math.abs(normal.getY(i)) > 0.5) uv.setXY(i, x / 33.5, -z / 41.6);
      else uv.setXY(i, (x + z) / 33.5, position.getY(i) / 41.6);
    }
    return geometry;
  };
  const slab = (minX, maxX, minZ, maxZ, y, height) =>
    worldUV(
      new T.BoxGeometry(maxX - minX, height, maxZ - minZ).translate(
        (minX + maxX) / 2,
        y,
        (minZ + maxZ) / 2,
      ),
    );
  // Soil fills the ring around the village in strips. Under a region with a
  // deep bed (the millpond's) only the deepest layer runs, below its bed.
  const regionGrounds = regions.filter((r) => r.ground).map((r) => r.ground),
    deepBeds = regions.filter((r) => r.ground && r.deepBed).map((r) => r.ground);
  for (const { minX, maxX, minZ, maxZ } of boxesOutside(ground, [village, ...deepBeds]))
    fieldSoil.push(
      slab(minX, maxX, minZ, maxZ, -1.18, 0.34),
      slab(minX, maxX, minZ, maxZ, -0.58, 1.06),
    );
  for (const { minX, maxX, minZ, maxZ } of deepBeds)
    fieldSoil.push(slab(minX, maxX, minZ, maxZ, -1.18, 0.34));
  // The grass is one surface with the village and each region's ground cut
  // out, so no seams cross it. It meets the village's grass at its inset edge;
  // the brook runs on into the millpond's ground north and the marsh's south
  // (without the marsh, the grass meets its channel at the village's true
  // south edge, where a thin wall closes it). Below it, thin grass walls show
  // at the map's rim, behind a 0.2 m soil lip.
  const lip = 0.2,
    outerGrass = inset(ground, lip),
    villageGrass = inset(village, lip),
    top = 0.05;
  const field = new T.Shape([
      new T.Vector2(outerGrass.minX, -outerGrass.minZ),
      new T.Vector2(outerGrass.maxX, -outerGrass.minZ),
      new T.Vector2(outerGrass.maxX, -outerGrass.maxZ),
      new T.Vector2(outerGrass.minX, -outerGrass.maxZ),
    ]),
    { minX, maxX, minZ, maxZ } = villageGrass;
  // The village's hole runs round its grass edge, with a notch for each
  // region's ground that meets an edge (the orchard hill's and the
  // millpond's, north; the marsh's, south). A region's ground
  // apart from the village is a hole of its own.
  const meets = (a, b) => Math.abs(a - b) < 1e-6,
    north = regionGrounds.filter((g) => meets(g.maxZ, minZ)).sort((a, b) => a.minX - b.minX),
    east = regionGrounds.filter((g) => meets(g.minX, maxX)).sort((a, b) => a.minZ - b.minZ),
    southGrounds = regionGrounds.filter((g) => meets(g.minZ, maxZ)),
    // The brook's channel, unless a region's ground (the marsh's) carries
    // the brook on south of the village.
    channelOpen = !southGrounds.some((g) => g.minX <= 9.7 && g.maxX >= 14.3),
    south = [
      ...southGrounds,
      ...(channelOpen ? [{ minX: 9.7, maxX: 14.3, maxZ: village.maxZ }] : []),
    ].sort((a, b) => b.maxX - a.maxX),
    west = regionGrounds.filter((g) => meets(g.maxX, minX)).sort((a, b) => b.maxZ - a.maxZ),
    notched = new Set([...north, ...east, ...south, ...west]);
  const hole = (points) => new T.Path(points.map(([x, z]) => new T.Vector2(x, -z)));
  field.holes.push(
    hole([
      ...north.flatMap((g) => [
        [g.minX, minZ],
        [g.minX, g.minZ],
        [g.maxX, g.minZ],
        [g.maxX, minZ],
      ]),
      [maxX, minZ],
      ...east.flatMap((g) => [
        [maxX, g.minZ],
        [g.maxX, g.minZ],
        [g.maxX, g.maxZ],
        [maxX, g.maxZ],
      ]),
      [maxX, maxZ],
      ...south.flatMap((g) => [
        [g.maxX, maxZ],
        [g.maxX, g.maxZ],
        [g.minX, g.maxZ],
        [g.minX, maxZ],
      ]),
      [minX, maxZ],
      ...west.flatMap((g) => [
        [minX, g.maxZ],
        [g.minX, g.maxZ],
        [g.minX, g.minZ],
        [minX, g.minZ],
      ]),
      [minX, minZ],
    ]),
    ...regionGrounds
      .filter((g) => !notched.has(g))
      .map((g) =>
        hole([
          [g.minX, g.minZ],
          [g.maxX, g.minZ],
          [g.maxX, g.maxZ],
          [g.minX, g.maxZ],
        ]),
      ),
  );
  fieldGrass.push(
    worldUV(new T.ShapeGeometry(field).rotateX(-Math.PI / 2).translate(0, top, 0)),
  );
  const g = outerGrass,
    t = 0.3,
    wall = (minX, maxX, minZ, maxZ) =>
      fieldGrass.push(slab(minX, maxX, minZ, maxZ, top - 0.1525, 0.295));
  wall(g.minX, g.maxX, g.minZ, g.minZ + t);
  wall(g.minX, g.maxX, g.maxZ - t, g.maxZ);
  wall(g.minX, g.minX + t, g.minZ + t, g.maxZ - t);
  wall(g.maxX - t, g.maxX, g.minZ + t, g.maxZ - t);
  if (channelOpen) wall(9.7, 14.3, village.maxZ, village.maxZ + t);
  const fieldGround = [
    [fieldGrass, grass, "Open country grass"],
    [fieldSoil, soil, "Open country soil"],
  ].map(([pieces, material, name]) => {
    const merged = mergeGeometries(pieces, false);
    for (const piece of pieces) piece.dispose();
    const m = mesh(merged, material);
    m.name = name;
    m.castShadow = false;
    m.userData.dynamic = true;
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    return m;
  });
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 128;
  const sh = shadowCanvas.getContext("2d"),
    shade = sh.createRadialGradient(64, 64, 5, 64, 64, 63);
  shade.addColorStop(0, "rgba(31,46,27,.34)");
  shade.addColorStop(0.45, "rgba(31,46,27,.21)");
  shade.addColorStop(1, "rgba(31,46,27,0)");
  sh.fillStyle = shade;
  sh.fillRect(0, 0, 128, 128);
  const contactMat = new T.MeshBasicMaterial({
    map: new T.CanvasTexture(shadowCanvas),
    transparent: true,
    depthWrite: false,
  });
  function contact(x, z, w, d) {
    const m = mesh(
      new T.PlaneGeometry(w, d),
      contactMat,
      x,
      terrainHeight(x, z) + 0.13,
      z,
    );
    m.rotation.x = -Math.PI / 2;
    m.castShadow = false;
    m.receiveShadow = false;
    return m;
  }
  const palette = ["#66834b", "#739153", "#789957", "#89a361", "#668654"].map(
    (v) => mat(v),
  );
  return { flat, fieldGround, contact };
}
