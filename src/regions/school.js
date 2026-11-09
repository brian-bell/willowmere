// The village school in the map's south-east corner: the schoolroom, a tall
// stone room under a steep slate roof with a cross gable, a bellcote and a
// porch, and the two-storey schoolhouse against its east end; the tarmac
// playground in front with hopscotch chalked on it and the swings; the
// football pitch beyond, mown in stripes, its lines painted and a goal at
// each end; a stone wall with railings along the lane side and a timber
// fence with a kickboard round the rest; the gravel path from the market's
// footpath; a bench, a bicycle rack, the school's board and a lamp at the
// gate; Miss Juniper on the touchline, and the children (src/regions/
// school-kids.js). Loaded with import() once the village is on screen and
// built by the streamer a piece at a time. Its shape and colliders live in
// school-layout.js, which loads with the village.
//
// The structures are vertex-coloured meshes from the parts kit: the grounds
// (pitch stripes and lines, tarmac and kerbs), the schoolroom with its porch,
// the schoolhouse, fences and playthings, each with its glazed windows on the
// village glass, and one detail mesh of small things (railing bars, nets,
// chimney pots, the bell, the bicycle, the chalk), which the overview hides
// zoomed far out. One canvas sign over the porch. No new shader programs
// beyond the children's skinned one.
import { createKit } from "./kit.js";
import { SCHOOL as S, SCHOOL_PATH, PITCH, FENCE_RUNS, swingFeet } from "./school-layout.js";
import { SCHOOL_RESIDENTS, SCHOOL_GOAL_LINES } from "../content/school.js";
import { createKids } from "./school-kids.js";

const COLOR = {
  stone: "#cdbf9f",
  stoneDark: "#a99b7d",
  quoin: "#e2d6ba",
  plinth: "#988c74",
  slate: "#58616b",
  slateDark: "#474f58",
  ridge: "#6e4c3e",
  frame: "#efe9da",
  door: "#3f5f4b",
  timber: "#8f7253",
  timberDark: "#6b543d",
  iron: "#2f3a36",
  white: "#f2f1ea",
  tarmac: "#86827c",
  kerb: "#b7ae9c",
  mownLight: "#86b35d",
  mownDark: "#78a651",
  chalk: "#f4f1e6",
  swing: "#b24f3c",
  bronze: "#a7813f",
  pot: "#a5573e",
};
// The grounds' surfaces, just above the grass (whose top is at 0.05).
const Y = { pitch: 0.062, line: 0.069, yard: 0.074, chalk: 0.079, path: 0.082 };

/**
 * Streamer jobs for the school. `game.life` takes Miss Juniper once the
 * schoolroom stands, and the children read the visitor's position from it.
 * The region hands back `school`, which tells activities.js of the goals the
 * visitor scores.
 */
export function schoolJobs(T, world, { life } = {}) {
  const material = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 });
  const { glass, path } = world.materials;
  const job = (key, x, z, step, added) => ({ key, x, z, step, added });
  // Nothing here is near water, so nothing goes into the reflections.
  const add = (mesh, options) => {
    world.addStreamed(mesh, options);
    world.water.excludeFromCaptures(mesh);
  };
  // A finished piece: its structure, its glass, and its small detail, which
  // hides zoomed far out.
  const finish = (name, k, fine) => {
    const meshes = [k.mesh(name, material)];
    const pane = k.glass();
    if (pane) {
      const mesh = new T.Mesh(pane, glass);
      mesh.name = `${name} glass`;
      mesh.castShadow = mesh.receiveShadow = false;
      mesh.matrixAutoUpdate = false;
      meshes.push(mesh);
    }
    k.dispose();
    if (fine) {
      const detail = fine.mesh(`${name} detail`, material);
      detail.userData.far = true;
      fine.dispose();
      meshes.push(detail);
    }
    return meshes;
  };
  const added = (meshes) => {
    for (const mesh of meshes) add(mesh, { far: !!mesh.userData.far, fineShadow: !!mesh.userData.far });
  };
  // The children, built a child at a time across the streamer's slices.
  const obstacles = [
    { minX: S.porch.x - S.porch.w / 2, maxX: S.porch.x + S.porch.w / 2, minZ: S.porch.z - S.porch.d / 2, maxZ: S.porch.z + S.porch.d / 2 },
    { x: S.residents.juniper.x, z: S.residents.juniper.z, r: 0.32 },
    ...swingFeet().map(([x, z]) => ({ x, z, r: 0.1 })),
  ];
  // What the game hears from the school: `onGoal(team, scorer)` is called
  // for every goal once the children are in.
  const school = { match: null, kids: null, goalLines: SCHOOL_GOAL_LINES, onGoal: null };
  let building = null;
  const jobs = [
    job("school grounds", PITCH.x, PITCH.z, () => {
      const k = createKit(T, { segments: 8, sphereDetail: 0 }),
        fine = createKit(T, { segments: 6, sphereDetail: 0 });
      grounds(k, fine);
      const meshes = finish("School grounds", k, fine);
      // Flat ground casts nothing.
      for (const mesh of meshes) mesh.castShadow = false;
      return [...meshes, gravel(T, path)];
    }, added),
    job(
      "schoolroom",
      S.school.x,
      S.school.z,
      () => {
        const k = createKit(T, { segments: 10, sphereDetail: 1 }),
          fine = createKit(T, { segments: 6, sphereDetail: 0 });
        schoolroom(k, fine);
        return [...finish("Schoolroom", k, fine), sign(T, "WILLOWMERE SCHOOL", signAt())];
      },
      (meshes) => {
        for (const mesh of meshes)
          add(mesh, { far: !!mesh.userData.far || mesh.name.startsWith("School sign"), fineShadow: !!mesh.userData.far });
        world.interactables.push(
          { id: "school-door", name: "School door", x: S.porch.x, z: S.porch.z + S.porch.d / 2 + 0.6, radius: 1.1 },
          { id: "school-board", name: "School board", x: S.board.x - 0.1, z: S.board.z - 0.7, radius: 1 },
        );
        for (const resident of SCHOOL_RESIDENTS) life?.addResident(resident);
      },
    ),
    job(
      "schoolhouse, fences and playthings",
      S.house.x,
      S.house.z + 6,
      () => {
        const k = createKit(T, { segments: 8, sphereDetail: 0 }),
          fine = createKit(T, { segments: 5, sphereDetail: 0 });
        schoolhouse(k, fine);
        fences(k, fine);
        playthings(k, fine);
        return finish("Schoolhouse and playground", k, fine);
      },
      (meshes) => {
        added(meshes);
        world.addLamps([S.lamp]);
        world.interactables.push(
          { id: "school-swings", name: "Swings", x: S.swings.x, z: S.swings.z + 1.6, radius: 1.1 },
          { id: "schoolhouse", name: "Schoolhouse", x: S.house.x + 0.7, z: S.house.z + S.house.d / 2 + 0.6, radius: 1 },
          { id: "school-goal", name: "Goal", x: PITCH.goals[0] + 1.2, z: PITCH.z, radius: 1 },
        );
      },
    ),
    job(
      "schoolchildren",
      PITCH.x,
      PITCH.z - 3,
      (deadline) => {
        building ??= createKids(T, {
          groundHeight: (x, z) => world.terrainHeight(x, z) + 0.062,
          player: life?.player ?? null,
          obstacles,
        });
        return building.step(deadline);
      },
      (meshes) => {
        const kids = building.kids;
        world.water.excludeFromCaptures(...meshes);
        school.kids = kids;
        school.match = kids.match;
        kids.match.onGoal = (team, scorer) => school.onGoal?.(team, scorer);
        // Their animation runs while any part of the lot is in view: one
        // update a frame, whichever chunk calls it.
        const update = (dt, t, clock) => kids.update(dt, clock, world.farDetail());
        for (const [x, z] of [
          [PITCH.x, PITCH.z],
          [31, 25],
          [43, 25],
          [31, 36],
          [43, 36],
        ])
          world.animate(x, z, update);
      },
    ),
  ];
  return { jobs, school };
}

// --- The grounds -----------------------------------------------------------

// The pitch mown in stripes with its lines, the playground's tarmac and
// kerb, and the hopscotch chalked on it.
function grounds(k, fine) {
  const p = S.pitch,
    // The mown grass runs a metre past the lines (onPlayground).
    mown = { minX: p.minX - 1, maxX: p.maxX + 1, minZ: p.minZ - 1, maxZ: p.maxZ + 1 },
    stripes = 12,
    width = (mown.maxX - mown.minX) / stripes;
  for (let i = 0; i < stripes; i++)
    k.box(
      i % 2 ? COLOR.mownDark : COLOR.mownLight,
      mown.minX + (i + 0.5) * width,
      Y.pitch - 0.005,
      (mown.minZ + mown.maxZ) / 2,
      width,
      0.01,
      mown.maxZ - mown.minZ,
    );
  // Lines: touch and goal lines, halfway, the centre circle and spot, and a
  // goal area at each end.
  const line = (x1, z1, x2, z2) => {
    const length = Math.hypot(x2 - x1, z2 - z1);
    k.box(COLOR.white, (x1 + x2) / 2, Y.line, (z1 + z2) / 2, 0.07, 0.008, length + 0.07, Math.atan2(x2 - x1, z2 - z1));
  };
  line(p.minX, p.minZ, p.maxX, p.minZ);
  line(p.minX, p.maxZ, p.maxX, p.maxZ);
  line(p.minX, p.minZ, p.minX, p.maxZ);
  line(p.maxX, p.minZ, p.maxX, p.maxZ);
  line(PITCH.x, p.minZ, PITCH.x, p.maxZ);
  const ring = 28,
    r = 1.5;
  for (let i = 0; i < ring; i++) {
    const a0 = (i / ring) * Math.PI * 2,
      a1 = ((i + 1) / ring) * Math.PI * 2;
    line(PITCH.x + Math.cos(a0) * r, PITCH.z + Math.sin(a0) * r, PITCH.x + Math.cos(a1) * r, PITCH.z + Math.sin(a1) * r);
  }
  k.cyl(COLOR.white, PITCH.x, Y.line, PITCH.z, 0.1, 0.008);
  for (const [i, x] of PITCH.goals.entries()) {
    const dir = i === 0 ? 1 : -1,
      depth = 1.6,
      half = 2.6;
    line(x, PITCH.z - half, x + dir * depth, PITCH.z - half);
    line(x, PITCH.z + half, x + dir * depth, PITCH.z + half);
    line(x + dir * depth, PITCH.z - half, x + dir * depth, PITCH.z + half);
    k.cyl(COLOR.white, x + dir * 3.2, Y.line, PITCH.z, 0.07, 0.008);
  }
  // The playground: tarmac, a stone kerb along its south edge, a drain.
  const y = S.yard;
  k.box(COLOR.tarmac, (y.minX + y.maxX) / 2, Y.yard - 0.012, (y.minZ + y.maxZ) / 2, y.maxX - y.minX, 0.024, y.maxZ - y.minZ);
  k.box(COLOR.kerb, (y.minX + y.maxX) / 2, Y.yard - 0.005, y.maxZ + 0.06, y.maxX - y.minX + 0.12, 0.05, 0.14);
  for (const x of [y.minX - 0.06, y.maxX + 0.06])
    k.box(COLOR.kerb, x, Y.yard - 0.005, (y.minZ + y.maxZ) / 2, 0.14, 0.05, y.maxZ - y.minZ + 0.24);
  // Rubber matting under the swings.
  k.box("#5b4b44", S.swings.x, Y.yard + 0.004, S.swings.z, S.swings.span - 0.3, 0.02, 2.2);
  // Hopscotch: eight squares, doubled at three, and a semicircle to turn in.
  const h = S.hopscotch,
    q = h.square,
    doubles = [2, 4, 6];
  fine.box(COLOR.chalk, h.x - q / 2, Y.chalk, h.z, 0.03, 0.004, q);
  for (let i = 0; i < 8; i++) {
    const x0 = h.x - q / 2 + i * q,
      x1 = x0 + q,
      half = doubles.includes(i) ? q : q / 2;
    for (const z of [h.z - half, h.z + half]) fine.box(COLOR.chalk, (x0 + x1) / 2, Y.chalk, z, q, 0.004, 0.03);
    fine.box(COLOR.chalk, x1, Y.chalk, h.z, 0.03, 0.004, Math.max(half, doubles.includes(i + 1) ? q : q / 2) * 2);
    if (doubles.includes(i)) fine.box(COLOR.chalk, (x0 + x1) / 2, Y.chalk, h.z, q, 0.004, 0.03);
  }
  // A chalked circle for skipping, and a few scribbles.
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    fine.box(COLOR.chalk, S.skipping.x + Math.cos(a) * 0.75, Y.chalk, S.skipping.z + Math.sin(a) * 0.75, 0.03, 0.004, 0.27, -a);
  }
}

// The gravel path from the market's footpath to the playground.
function gravel(T, material) {
  const positions = [],
    line = SCHOOL_PATH,
    half = S.path.halfWidth,
    edge = (x, z, side) => Math.sin(x * 2.7 + z * 1.3 + side) * 0.035 + Math.sin(x * 6.1 - z * 3.7) * 0.02;
  const left = [],
    right = [];
  for (let i = 0; i < line.length; i++) {
    const [x, z] = line[i],
      [ax, az] = line[Math.max(i - 1, 0)],
      [bx, bz] = line[Math.min(i + 1, line.length - 1)],
      length = Math.hypot(bx - ax, bz - az) || 1,
      nx = -(bz - az) / length,
      nz = (bx - ax) / length,
      l = half + edge(x, z, 0),
      r = half + edge(x, z, 2);
    left.push([x + nx * l, Y.path, z + nz * l]);
    right.push([x - nx * r, Y.path, z - nz * r]);
  }
  const push = (...points) => {
    for (const [x, y, z] of points) positions.push(x, y, z);
  };
  for (let i = 0; i < line.length - 1; i++) {
    push(left[i], left[i + 1], right[i]);
    push(left[i + 1], right[i + 1], right[i]);
  }
  // A rounded end where it leaves the market's path.
  const [x, z] = line[0],
    [px, pz] = line[1],
    heading = Math.atan2(x - px, z - pz);
  for (let s = 0; s < 10; s++) {
    const a0 = heading - Math.PI / 2 + (s / 10) * Math.PI,
      a1 = heading - Math.PI / 2 + ((s + 1) / 10) * Math.PI;
    push([x, Y.path, z], [x + Math.sin(a1) * half, Y.path, z + Math.cos(a1) * half], [x + Math.sin(a0) * half, Y.path, z + Math.cos(a0) * half]);
  }
  // Every triangle faces up, whichever way it was wound.
  for (let i = 0; i < positions.length; i += 9) {
    const ax = positions[i + 3] - positions[i],
      az = positions[i + 5] - positions[i + 2],
      bx = positions[i + 6] - positions[i],
      bz = positions[i + 8] - positions[i + 2];
    if (az * bx - ax * bz < 0)
      for (let k = 0; k < 3; k++) {
        const t = positions[i + 3 + k];
        positions[i + 3 + k] = positions[i + 6 + k];
        positions[i + 6 + k] = t;
      }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const mesh = new T.Mesh(geometry, material);
  mesh.name = "School path";
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  return mesh;
}

// --- Buildings ---------------------------------------------------------------

/**
 * A roof whose ridge runs along x over a w × d footprint at (x, z), from the
 * eaves at y0 to the ridge at y1, overhanging by `o`, with ridge tiles.
 */
function roof(k, { x, z, w, d }, y0, y1, o = 0.3, hex = COLOR.slate) {
  const rise = y1 - y0,
    slope = Math.atan2(rise, d / 2),
    run = d / 2 + o,
    drop = o * Math.tan(slope),
    length = Math.hypot(run, rise + drop);
  for (const side of [-1, 1]) {
    const cz = z + (side * run) / 2,
      cy = y1 - (rise + drop) / 2 + 0.06;
    k.box(hex, x, cy, cz, w + 2 * o * 0.8, 0.12, length, 0, side * slope);
    // A darker course along the eaves.
    k.box(COLOR.slateDark, x, y0 - drop + 0.1, z + side * (run - 0.12), w + 2 * o * 0.8, 0.06, 0.26, 0, side * slope);
  }
  k.box(COLOR.ridge, x, y1 + 0.1, z, w + 2 * o * 0.8, 0.14, 0.2);
}

/** A gable end's triangle at x0 (to x0 + depth), over a wall `d` deep at z, from y0 up `rise`. */
const gableEnd = (k, hex, x0, z, d, y0, rise, depth = 0.2) =>
  k.gable(hex, x0, y0, z, [[-d / 2, 0], [d / 2, 0], [0, rise]], depth);

/** A tall window in a south-facing wall at z: stone surround, glazing bars, sill and hood. */
function tallWindow(k, fine, x, y, z, w, h) {
  k.glazed(() => k.box("#ffcf73", x, y, z + 0.02, w, h, 0.05));
  for (const sx of [-1, 1]) k.box(COLOR.quoin, x + (sx * (w + 0.12)) / 2, y, z + 0.05, 0.12, h + 0.12, 0.1);
  k.box(COLOR.quoin, x, y - h / 2 - 0.07, z + 0.09, w + 0.32, 0.1, 0.18);
  // A pointed hood over the head.
  k.placed(x, y + h / 2 + 0.04, z + 0.06, -Math.PI / 2, () =>
    k.gable(COLOR.quoin, 0, 0, 0, [[-w / 2 - 0.12, 0], [w / 2 + 0.12, 0], [0, 0.32]], 0.1),
  );
  k.box(COLOR.frame, x, y, z + 0.06, 0.04, h, 0.04);
  for (let i = 1; i < 4; i++) fine.box(COLOR.frame, x, y - h / 2 + (i * h) / 4, z + 0.06, w, 0.03, 0.03);
}

// The schoolroom: a tall stone room, its front facing the playground, under
// a steep slate roof with a cross gable over the middle window; a bellcote
// on the west gable, a stack at the east end and the porch at the west end
// of the front.
function schoolroom(k, fine) {
  const b = S.school,
    front = b.z + b.d / 2,
    west = b.x - b.w / 2,
    east = b.x + b.w / 2;
  // Walls and plinth, quoins at the corners, a band at the sills.
  k.box(COLOR.stone, b.x, b.h / 2, b.z, b.w, b.h, b.d);
  k.box(COLOR.plinth, b.x, 0.2, b.z, b.w + 0.08, 0.4, b.d + 0.08);
  for (const x of [west, east])
    for (const z of [b.z - b.d / 2, front])
      for (let y = 0.5; y < b.h; y += 0.5) k.box(COLOR.quoin, x, y + 0.12, z, y % 1 ? 0.34 : 0.22, 0.24, y % 1 ? 0.22 : 0.34);
  k.box(COLOR.stoneDark, b.x, 0.9, front + 0.02, b.w, 0.08, 0.06);
  // Gables and the roof.
  gableEnd(k, COLOR.stone, west, b.z, b.d, b.h, b.ridge - b.h);
  gableEnd(k, COLOR.stone, east - 0.2, b.z, b.d, b.h, b.ridge - b.h);
  roof(k, b, b.h, b.ridge);
  // The cross gable over the middle window, its roof running back to the ridge.
  const gx = b.x + 0.9,
    gw = 3,
    apex = b.ridge - 0.5,
    rise = apex - b.h;
  k.placed(gx, b.h, front - 0.2, -Math.PI / 2, () =>
    k.gable(COLOR.stone, 0, 0, 0, [[-gw / 2, 0], [gw / 2, 0], [0, rise]], 0.24),
  );
  const slope = Math.atan2(rise, gw / 2),
    run = gw / 2 + 0.25,
    length = Math.hypot(run, rise + 0.25 * Math.tan(slope)),
    back = (b.d / 2) * 0.95;
  for (const side of [-1, 1])
    k.box(COLOR.slate, gx + (side * run) / 2, apex - (rise + 0.25 * Math.tan(slope)) / 2 + 0.06, front - back / 2 + 0.15, length, 0.12, back + 0.3, 0, 0, -side * slope);
  k.box(COLOR.ridge, gx, apex + 0.08, front - back / 2 + 0.15, 0.2, 0.14, back + 0.3);
  // Windows: two either side of the cross gable's tall one, and its round light.
  for (const x of [b.x - 1.3, b.x + 3.2]) tallWindow(k, fine, x, 1.85, front, 0.9, 1.75);
  tallWindow(k, fine, gx, 2.1, front, 1.2, 2.3);
  k.glazed(() => k.cyl("#ffcf73", gx, apex - 0.75, front + 0.02, 0.26, 0.05, Math.PI / 2));
  k.cyl(COLOR.quoin, gx, apex - 0.75, front + 0.01, 0.34, 0.06, Math.PI / 2);
  // Back windows, high up, and one in the west gable.
  for (const x of [b.x - 2.5, b.x, b.x + 2.5]) {
    k.glazed(() => k.box("#ffcf73", x, 2.1, b.z - b.d / 2 - 0.02, 0.8, 1.3, 0.05));
    k.box(COLOR.quoin, x, 1.38, b.z - b.d / 2 - 0.08, 1.0, 0.1, 0.16);
  }
  k.glazed(() => k.box("#ffcf73", west - 0.02, 3.6, b.z, 0.05, 1.1, 0.7));
  // The bellcote on the west gable's apex: two piers under a little gable,
  // the bell hung between them.
  const bx = west + 0.15,
    top = b.ridge;
  for (const s of [-1, 1]) k.box(COLOR.quoin, bx, top + 0.4, b.z + s * 0.28, 0.32, 0.8, 0.14);
  k.box(COLOR.quoin, bx, top + 0.84, b.z, 0.4, 0.1, 0.74);
  k.pyramid(COLOR.slate, bx, top + 1.09, b.z, 0.42, 0.42);
  fine.add(fine.unit.cone, COLOR.bronze, bx, top + 0.43, b.z, 0.13, 0.24, 0.13, Math.PI, Math.PI / 4);
  fine.rod(COLOR.iron, [bx, top + 0.62, b.z - 0.22], [bx, top + 0.62, b.z + 0.22], 0.015);
  // A stack at the east end, its pots.
  const cx = east - 0.7,
    cz = b.z - 0.6;
  k.box(COLOR.stoneDark, cx, b.ridge - 0.2, cz, 0.6, 1.6, 0.5);
  k.box(COLOR.quoin, cx, b.ridge + 0.62, cz, 0.7, 0.08, 0.6);
  for (const s of [-1, 1]) fine.cyl(COLOR.pot, cx + s * 0.14, b.ridge + 0.78, cz, 0.08, 0.26);
  // Gutters along the eaves and a downpipe at each front corner.
  const gutter = (x0, x1, z) => fine.box(COLOR.iron, (x0 + x1) / 2, b.h - 0.08, z, x1 - x0, 0.08, 0.1);
  gutter(west - 0.2, east + 0.2, b.z - b.d / 2 - 0.32);
  gutter(west - 0.2, gx - gw / 2 - 0.2, front + 0.32);
  gutter(gx + gw / 2 + 0.2, east + 0.2, front + 0.32);
  for (const x of [west + 0.22, east - 0.22]) fine.cyl(COLOR.iron, x, b.h / 2, front + 0.3, 0.035, b.h);
  porch(k, fine);
}

// The porch: stone, gabled, the door in its south face, the sign above.
function porch(k, fine) {
  const p = S.porch,
    front = p.z + p.d / 2,
    rise = 0.75;
  k.box(COLOR.stone, p.x, p.h / 2, p.z, p.w, p.h, p.d);
  k.box(COLOR.plinth, p.x, 0.2, p.z, p.w + 0.06, 0.4, p.d + 0.06);
  k.placed(p.x, p.h, front - 0.2, -Math.PI / 2, () =>
    k.gable(COLOR.stone, 0, 0, 0, [[-p.w / 2, 0], [p.w / 2, 0], [0, rise]], 0.2),
  );
  const slope = Math.atan2(rise, p.w / 2),
    run = p.w / 2 + 0.18,
    length = Math.hypot(run, rise + 0.18 * Math.tan(slope));
  for (const side of [-1, 1])
    k.box(COLOR.slate, p.x + (side * run) / 2, p.h + rise / 2 - 0.03, p.z + 0.08, length, 0.1, p.d + 0.3, 0, 0, -side * slope);
  k.box(COLOR.ridge, p.x, p.h + rise + 0.07, p.z + 0.08, 0.16, 0.12, p.d + 0.3);
  // The door: arched surround, planked leaf, step.
  k.box(COLOR.quoin, p.x, 1.08, front + 0.03, 1.1, 2.16, 0.08);
  k.box(COLOR.door, p.x, 1.0, front + 0.06, 0.86, 1.95, 0.06);
  k.placed(p.x, 2.0, front + 0.05, -Math.PI / 2, () => k.gable(COLOR.quoin, 0, 0, 0, [[-0.55, 0], [0.55, 0], [0, 0.3]], 0.08));
  k.box(COLOR.kerb, p.x, 0.07, front + 0.3, 1.2, 0.14, 0.5);
  for (let i = -1; i <= 1; i++) fine.box(COLOR.timberDark, p.x + i * 0.22, 1.0, front + 0.095, 0.02, 1.85, 0.01);
  fine.ball(COLOR.bronze, p.x + 0.3, 1.0, front + 0.11, 0.04);
  // The date stone in the gable.
  k.box(COLOR.quoin, p.x, p.h + 0.25, front + 0.02, 0.5, 0.26, 0.04);
  // Boot scraper and a coat of hooks' worth of bags by the door.
  fine.box(COLOR.iron, p.x - 0.75, 0.08, front + 0.25, 0.3, 0.12, 0.06);
}

const signAt = () => ({
  x: S.school.x - 1.3,
  y: S.school.h + 0.2,
  z: S.school.z + S.school.d / 2 + 0.36,
  width: 2.6,
});

/** A painted board with `text`, hung where `signAt` says. One draw. */
function sign(T, text, { x, y, z, width, height = width / 5 }) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 128;
  const q = canvas.getContext("2d");
  q.fillStyle = "#294536";
  q.fillRect(0, 0, 640, 128);
  q.strokeStyle = "#d9c58f";
  q.lineWidth = 8;
  q.strokeRect(10, 10, 620, 108);
  q.fillStyle = "#efe2b8";
  q.textAlign = "center";
  q.textBaseline = "middle";
  let size = 58;
  q.font = `bold ${size}px Georgia`;
  while (q.measureText(text).width > 580 && size > 20) q.font = `bold ${(size -= 3)}px Georgia`;
  q.fillText(text, 320, 68);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  const mesh = new T.Mesh(new T.PlaneGeometry(width, height), new T.MeshStandardMaterial({ map: texture, roughness: 1 }));
  mesh.name = `School sign: ${text}`;
  mesh.position.set(x, y, z);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.updateMatrix();
  mesh.matrixAutoUpdate = false;
  return mesh;
}

// The schoolhouse: two storeys of the same stone, its door and windows to
// the front, a stack on its east gable.
function schoolhouse(k, fine) {
  const b = S.house,
    front = b.z + b.d / 2,
    east = b.x + b.w / 2;
  k.box(COLOR.stone, b.x, b.h / 2, b.z, b.w, b.h, b.d);
  k.box(COLOR.plinth, b.x, 0.2, b.z, b.w + 0.08, 0.4, b.d + 0.08);
  for (const z of [b.z - b.d / 2, front])
    for (let y = 0.5; y < b.h; y += 0.5) k.box(COLOR.quoin, east, y + 0.12, z, y % 1 ? 0.34 : 0.22, 0.24, y % 1 ? 0.22 : 0.34);
  // A band between the floors.
  k.box(COLOR.stoneDark, b.x, 2.35, front + 0.02, b.w, 0.1, 0.06);
  k.box(COLOR.stoneDark, east + 0.02, 2.35, b.z, 0.06, 0.1, b.d);
  for (const x0 of [b.x - b.w / 2, east - 0.2]) gableEnd(k, COLOR.stone, x0, b.z, b.d, b.h, b.ridge - b.h);
  roof(k, b, b.h, b.ridge, 0.28);
  // Door under a hood on brackets, a window beside it, two above.
  const dx = b.x + 0.7;
  k.box(COLOR.quoin, dx, 1.06, front + 0.03, 1.0, 2.12, 0.07);
  k.box("#7d3e34", dx, 1.0, front + 0.06, 0.8, 1.95, 0.06);
  k.box(COLOR.slate, dx, 2.25, front + 0.3, 1.2, 0.08, 0.6);
  for (const s of [-1, 1]) fine.box(COLOR.timberDark, dx + s * 0.5, 2.1, front + 0.2, 0.06, 0.25, 0.4);
  fine.ball(COLOR.bronze, dx + 0.28, 1.0, front + 0.1, 0.035);
  const win = (x, y, w, h) => {
    k.glazed(() => k.box("#ffcf73", x, y, front + 0.02, w, h, 0.05));
    k.box(COLOR.quoin, x, y - h / 2 - 0.06, front + 0.08, w + 0.22, 0.09, 0.16);
    k.box(COLOR.quoin, x, y + h / 2 + 0.07, front + 0.05, w + 0.22, 0.14, 0.1);
    k.box(COLOR.frame, x, y, front + 0.06, 0.04, h, 0.04);
    k.box(COLOR.frame, x, y, front + 0.06, w, 0.04, 0.04);
  };
  win(b.x - 0.8, 1.4, 0.9, 1.1);
  win(b.x - 0.8, 3.45, 0.9, 1.0);
  win(dx, 3.45, 0.9, 1.0);
  // Its east gable's stack, and the pots.
  k.box(COLOR.stoneDark, east - 0.3, b.ridge - 0.1, b.z, 0.5, 1.4, 0.7);
  k.box(COLOR.quoin, east - 0.3, b.ridge + 0.62, b.z, 0.6, 0.08, 0.8);
  for (const s of [-1, 1]) fine.cyl(COLOR.pot, east - 0.3, b.ridge + 0.78, b.z + s * 0.18, 0.08, 0.26);
  // A climbing rose by the door, a pot of geraniums under the window.
  for (let i = 0; i < 9; i++)
    fine.ball(i % 3 ? "#5c7f43" : "#d0566a", dx - 0.62 + Math.sin(i * 1.7) * 0.06, 0.4 + i * 0.22, front + 0.12, 0.13, 0.11, 0.07);
  fine.cyl(COLOR.pot, b.x - 0.8, 0.18, front + 0.32, 0.2, 0.36);
  for (let i = 0; i < 5; i++) fine.ball(i % 2 ? "#c9443c" : "#5f8a45", b.x - 0.8 + (i - 2) * 0.09, 0.44, front + 0.32 + (i % 2) * 0.05, 0.09);
}

// --- Fences --------------------------------------------------------------------

// The lane side is a low stone wall under iron railings, with stone piers
// and open iron gates at the path; the rest a timber fence with a kickboard
// along its foot, so the ball comes back.
function fences(k, fine) {
  const g = S.gate;
  for (const [x1, z1, x2, z2] of FENCE_RUNS) {
    const length = Math.hypot(x2 - x1, z2 - z1),
      angle = Math.atan2(x2 - x1, z2 - z1),
      mx = (x1 + x2) / 2,
      mz = (z1 + z2) / 2;
    if (z1 === S.fence.minZ && z2 === S.fence.minZ) {
      // Wall, coping and railings.
      k.box(COLOR.stone, mx, 0.25, mz, 0.34, 0.5, length, angle);
      k.box(COLOR.quoin, mx, 0.53, mz, 0.42, 0.07, length + 0.04, angle);
      k.box(COLOR.iron, mx, 1.14, mz, 0.04, 0.04, length, angle);
      k.box(COLOR.iron, mx, 0.62, mz, 0.04, 0.04, length, angle);
      const bars = Math.round(length / 0.14);
      for (let i = 0; i <= bars; i++) {
        const t = i / bars,
          x = x1 + (x2 - x1) * t,
          z = z1 + (z2 - z1) * t;
        fine.box(COLOR.iron, x, 0.88, z, 0.025, 0.56, 0.025);
        fine.pyramid(COLOR.iron, x, 1.2, z, 0.03, 0.08);
      }
      continue;
    }
    // Posts every 2 m, a kickboard and two rails.
    const posts = Math.max(1, Math.round(length / 2));
    for (let i = 0; i <= posts; i++) {
      const t = i / posts;
      k.box(COLOR.timberDark, x1 + (x2 - x1) * t, 0.55, z1 + (z2 - z1) * t, 0.11, 1.1, 0.11);
    }
    k.box(COLOR.timber, mx, 0.16, mz, 0.05, 0.28, length, angle);
    for (const y of [0.6, 0.98]) k.box(COLOR.timber, mx, y, mz, 0.06, 0.07, length, angle);
  }
  // Stone piers either side of the gate, with caps and balls, and the gates
  // standing open, swung in against the wall.
  for (const s of [-1, 1]) {
    const x = g.x + s * (g.halfWidth + 0.12);
    k.box(COLOR.quoin, x, 0.7, S.fence.minZ, 0.4, 1.4, 0.4);
    k.box(COLOR.stoneDark, x, 1.44, S.fence.minZ, 0.48, 0.08, 0.48);
    k.ball(COLOR.quoin, x, 1.6, S.fence.minZ, 0.15);
    k.placed(g.x + s * g.halfWidth, 0, S.fence.minZ + 0.05, s * 1.35, () => {
      k.box(COLOR.iron, s * -0.42, 0.25, 0, 0.84, 0.04, 0.03);
      k.box(COLOR.iron, s * -0.42, 1.05, 0, 0.84, 0.04, 0.03);
      for (let i = 0; i <= 6; i++) fine.box(COLOR.iron, s * -(i * 0.14), 0.65, 0, 0.02, 0.8, 0.02);
    });
  }
}

// --- Playthings and fittings -------------------------------------------------

// The swings' frame, the goals and their nets, the bench, the bicycle rack
// with a bicycle in it, the school's board and the lamp.
function playthings(k, fine) {
  // Swings: an A-frame at each end of the top bar.
  const s = S.swings,
    top = s.height;
  for (const end of [-1, 1]) {
    const x = s.x + (end * s.span) / 2;
    for (const side of [-1, 1]) k.rod(COLOR.swing, [x, top, s.z], [x, 0, s.z + side * 0.75], 0.045);
    k.rod(COLOR.swing, [x, 0.7, s.z - 0.52], [x, 0.7, s.z + 0.52], 0.03);
  }
  k.rod(COLOR.swing, [s.x - s.span / 2 - 0.1, top, s.z], [s.x + s.span / 2 + 0.1, top, s.z], 0.055);
  for (const dx of s.seats)
    for (const side of [-1, 1]) fine.cyl(COLOR.iron, s.x + dx + side * 0.21, top - 0.04, s.z, 0.03, 0.08);
  // Goals: white posts and crossbar, side and back bars running down to the
  // ground behind, and a net over the back and sides.
  const { width, height, depth } = S.goal;
  for (const [i, x] of PITCH.goals.entries()) {
    const back = x + (i === 0 ? -depth : depth),
      z0 = PITCH.z - width / 2,
      z1 = PITCH.z + width / 2;
    for (const z of [z0, z1]) {
      k.post(COLOR.white, x, z, 0, height, 0.045);
      k.rod(COLOR.white, [x, height, z], [back, 0.05, z], 0.025);
    }
    k.rod(COLOR.white, [x, height, z0 - 0.045], [x, height, z1 + 0.045], 0.045);
    k.rod(COLOR.white, [back, 0.04, z0], [back, 0.04, z1], 0.025);
    // The net: strings down the slope and across it, and over each side.
    const cords = 10;
    for (let j = 0; j <= cords; j++) {
      const z = z0 + (j / cords) * width;
      fine.rod(COLOR.white, [x, height, z], [back, 0.05, z], 0.008);
    }
    for (let j = 1; j < 5; j++) {
      const t = j / 5,
        bx = x + (back - x) * t,
        by = height + (0.05 - height) * t;
      fine.rod(COLOR.white, [bx, by, z0], [bx, by, z1], 0.008);
      for (const z of [z0, z1]) fine.rod(COLOR.white, [bx, by, z], [bx, 0.05, z], 0.008);
    }
  }
  // The bench in the corner, facing the path.
  const b = S.bench;
  k.placed(b.x, 0, b.z, b.turn, () => {
    for (const sx of [-0.6, 0.6]) {
      k.box(COLOR.iron, sx, 0.22, 0, 0.06, 0.44, 0.42);
      k.box(COLOR.iron, sx, 0.62, -0.2, 0.06, 0.42, 0.05);
    }
    for (const z of [-0.12, 0, 0.12]) k.box(COLOR.timber, 0, 0.45, z, 1.45, 0.04, 0.1);
    for (const y of [0.62, 0.78]) k.box(COLOR.timber, 0, y, -0.21, 1.45, 0.1, 0.03);
  });
  // The bicycle rack, with one bicycle in it.
  const r = S.rack;
  for (let i = 0; i < 4; i++) {
    const z = r.z - 0.5 + i * 0.33;
    k.rod(COLOR.iron, [r.x - 0.2, 0, z], [r.x - 0.2, 0.5, z], 0.02);
    k.rod(COLOR.iron, [r.x + 0.2, 0, z], [r.x + 0.2, 0.5, z], 0.02);
    k.rod(COLOR.iron, [r.x - 0.2, 0.5, z], [r.x + 0.2, 0.5, z], 0.02);
  }
  fine.placed(r.x + 0.25, 0, r.z - 0.17, 0, () => {
    for (const x of [-0.42, 0.42]) fine.add(fine.unit.cylinder, "#2a2826", x, 0.32, 0, 0.3, 0.035, 0.3, Math.PI / 2);
    fine.rod("#2f6a8a", [-0.42, 0.32, 0], [0, 0.32, 0], 0.02);
    fine.rod("#2f6a8a", [0, 0.32, 0], [0.3, 0.62, 0], 0.02);
    fine.rod("#2f6a8a", [-0.42, 0.32, 0], [-0.15, 0.62, 0], 0.02);
    fine.rod("#2f6a8a", [-0.15, 0.62, 0], [0.3, 0.62, 0], 0.02);
    fine.rod("#2f6a8a", [0.3, 0.62, 0], [0.42, 0.32, 0], 0.02);
    fine.box("#3b2f28", -0.17, 0.72, 0, 0.2, 0.05, 0.1);
    fine.rod(COLOR.iron, [0.34, 0.82, -0.22], [0.34, 0.82, 0.22], 0.015);
    fine.box("#c9b47a", 0.48, 0.6, 0, 0.18, 0.16, 0.24);
  });
  // The school's board outside the gate, facing the path.
  const sb = S.board;
  for (const s of [-1, 1]) k.box(COLOR.timberDark, sb.x + s * 0.42, 0.65, sb.z, 0.08, 1.3, 0.08);
  k.box(COLOR.door, sb.x, 1.05, sb.z - 0.03, 1.0, 0.6, 0.05);
  k.box(COLOR.slate, sb.x, 1.42, sb.z, 1.15, 0.06, 0.18);
  fine.box(COLOR.chalk, sb.x - 0.2, 1.1, sb.z - 0.06, 0.4, 0.28, 0.01);
  fine.box("#e9c46a", sb.x + 0.25, 0.98, sb.z - 0.06, 0.3, 0.22, 0.01);
  // The lamp at the gate.
  const l = S.lamp;
  k.cyl("#65513e", l.x, 1.1, l.z, 0.075, 2.2);
  k.cyl("#adada0", l.x, 0.18, l.z, 0.17, 0.25);
  k.box("#65513e", l.x, 2.23, l.z, 0.45, 0.07, 0.43);
  k.glazed(() => k.box("#ffcf73", l.x, 2.44, l.z, 0.3, 0.4, 0.3));
  for (const a of [-1, 1]) for (const c of [-1, 1]) k.box("#65513e", l.x + a * 0.17, 2.44, l.z + c * 0.17, 0.035, 0.43, 0.035);
  k.pyramid("#65513e", l.x, 2.76, l.z, 0.35, 0.25);
  // A pile of coats and bags by the goal, where the children dropped them.
  const bx = PITCH.goals[0] - 0.4,
    bz = PITCH.z - S.goal.width / 2 - 1.1;
  const coats = ["#b9473c", "#3e6aa1", "#d6b34a", "#5b7c48"];
  coats.forEach((c, i) => fine.box(c, bx + (i % 2) * 0.35, 0.09 + Math.floor(i / 2) * 0.08, bz + (i % 3) * 0.2, 0.5, 0.08, 0.38, i * 0.7));
}
