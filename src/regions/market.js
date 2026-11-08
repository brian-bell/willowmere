// The market lane east of the village: its gravel lane and paths, the market
// square's four stalls under striped awnings and bunting, the Copper Kettle
// tea room, the post office, a footbridge over the brook, lamps, a signpost
// and a cart where the lane leaves the map, and its two residents. Loaded with
// import() once the village is on screen and built by the streamer a piece at
// a time. Its shape and colliders live in market-layout.js, which loads with
// the village.
//
// Each piece is one vertex-coloured mesh, plus the village's glass for its
// windows and lamps (which glow at blue hour) and a painted sign or two, so
// the lane adds a handful of draws and no new shader programs.
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { chunkRandom } from "../world-layout.js";
import { createKit } from "./kit.js";
import {
  LANE,
  MARKET as M,
  PATHS,
  bridgeDeck,
  hedgeClumps,
  stallFront,
} from "./market-layout.js";
import { MARKET_RESIDENTS, STALL_BOARDS } from "../content/market.js";

const TAU = Math.PI * 2;

/**
 * Streamer jobs for the market lane. `game.life` takes the lane's residents
 * once their buildings stand.
 */
export function marketJobs(T, world, { life } = {}) {
  const rand = chunkRandom(2, 0, 7),
    range = (a, b) => a + (b - a) * rand();
  const material = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 });
  const { glass, path } = world.materials;
  const job = (key, x, z, step, added) => ({ key, x, z, step, added });
  // A finished piece: its structure, its glass and its signs, registered with
  // the chunk each stands in.
  const finish = (name, kit, signs = []) => {
    const meshes = [kit.mesh(name, material)];
    const glassGeometry = kit.glass();
    kit.dispose();
    if (glassGeometry) {
      const pane = new T.Mesh(glassGeometry, glass);
      pane.name = `${name} glass`;
      pane.castShadow = false;
      pane.receiveShadow = false;
      pane.matrixAutoUpdate = false;
      meshes.push(pane);
    }
    return [...meshes, ...signs];
  };
  const added = (meshes) => {
    for (const mesh of meshes) world.addStreamed(mesh);
  };
  const jobs = [
    job("market lane gravel", 28, 3, () => gravel(T, path), ([mesh]) => {
      world.addStreamed(mesh);
      world.water.excludeFromCaptures(mesh);
    }),
    job("market footbridge", 12, M.bridge.minZ, () => finish("Market footbridge", footbridge(T)), added),
    job(
      "market tea room",
      M.teaRoom.x,
      M.teaRoom.z,
      () => {
        const [main, fine] = teaRoom(T, range),
          detail = fine.mesh("Market tea room detail", material);
        fine.dispose();
        return [...finish("Market tea room", main, [sign(T, "THE COPPER KETTLE", teaSignAt())]), detail];
      },
      (meshes) => {
        // The small round things hide zoomed far out.
        for (const mesh of meshes) world.addStreamed(mesh, { far: mesh.name === "Market tea room detail" });
        world.interactables.push({
          id: "tea-room",
          name: "The Copper Kettle",
          x: M.teaRoom.x,
          z: M.teaRoom.z + M.teaRoom.d / 2 + 0.6,
          radius: 1.3,
        });
      },
    ),
    job(
      "market post office",
      M.postOffice.x,
      M.postOffice.z,
      () => finish("Market post office", postOffice(T), [sign(T, "POST OFFICE", postSignAt())]),
      (meshes) => {
        added(meshes);
        world.interactables.push(
          {
            id: "post-office",
            name: "Post office",
            x: M.postOffice.x + POST_DOOR_X,
            z: M.postOffice.z + M.postOffice.d / 2 + 0.6,
            radius: 1.2,
          },
          {
            id: "post-box",
            name: "Post box",
            x: M.postBox.x - 0.5,
            z: M.postBox.z + 0.55,
            radius: 1,
          },
        );
      },
    ),
    job(
      "market stalls, bunting and lamps",
      M.square.x,
      M.square.z,
      () => {
        const [main, fine] = stalls(T, range),
          detail = fine.mesh("Market stalls detail", material);
        fine.dispose();
        return [...finish("Market stalls and bunting", main, [stallBoards(T)]), detail];
      },
      (meshes) => {
        // The wares and the name boards hide zoomed far out.
        for (const mesh of meshes)
          world.addStreamed(mesh, {
            far: mesh.name === "Market stalls detail" || mesh.name === "Market stall boards",
          });
        world.addLamps(M.lamps);
        world.interactables.push(
          ...M.stalls.map((stall) => {
            const front = stallFront(stall);
            return {
              id: `stall-${stall.id}`,
              type: "stall",
              stall: stall.id,
              name: "Market stall",
              x: front.x,
              z: front.z,
              radius: 1.25,
            };
          }),
        );
      },
    ),
    job(
      "market signpost and cart",
      M.signpost.x,
      M.signpost.z,
      () =>
        finish("Market signpost and cart", lanesEnd(T), [
          sign(T, "WILLOWMERE", { x: M.signpost.x - 0.42, y: 2.02, z: M.signpost.z + 0.06, width: 0.86 }),
          sign(T, "THE COAST · 9 MI", { x: M.signpost.x + 0.46, y: 1.66, z: M.signpost.z + 0.06, width: 0.92 }),
        ]),
      (meshes) => {
        added(meshes);
        world.interactables.push({
          id: "signpost",
          name: "Signpost",
          x: M.signpost.x - 0.2,
          z: M.signpost.z + 0.8,
          radius: 1.2,
        });
      },
    ),
    // The residents join once the square is built, beside their doors.
    job("market residents", M.residents.hazel.x, M.residents.hazel.z, () => [], () => {
      for (const resident of MARKET_RESIDENTS) life?.addResident(resident);
    }),
  ];
  return { jobs };
}

// A painted sign board: cream with dark lettering, like the village's.
function sign(T, text, { x, y, z, width, height = width / 4, ry = 0 }) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const q = canvas.getContext("2d");
  q.fillStyle = "#e9d9ae";
  q.fillRect(0, 0, 512, 128);
  q.strokeStyle = "#827251";
  q.lineWidth = 10;
  q.strokeRect(7, 7, 498, 114);
  q.fillStyle = "#4d5745";
  q.textAlign = "center";
  q.textBaseline = "middle";
  let size = 55;
  q.font = `bold ${size}px Georgia`;
  while (q.measureText(text).width > 460 && size > 20) q.font = `bold ${(size -= 3)}px Georgia`;
  q.fillText(text, 256, 67);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  const mesh = new T.Mesh(
    new T.PlaneGeometry(width, height),
    new T.MeshStandardMaterial({ map: texture, roughness: 1 }),
  );
  mesh.name = `Market sign: ${text}`;
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.updateMatrix();
  mesh.matrixAutoUpdate = false;
  return mesh;
}

// --- Gravel -------------------------------------------------------------------

// The lane, the paths and the square: flat ribbons and an oval just above the
// grass, in the village paths' gravel, their edges a little uneven.
function gravel(T, material) {
  const positions = [];
  const push = (...points) => {
    for (const [x, y, z] of points) positions.push(x, y, z);
  };
  const edge = (x, z, side) => Math.sin(x * 2.7 + z * 1.3 + side) * 0.035 + Math.sin(x * 6.1 - z * 3.7) * 0.02;
  // A strip along a line, with a rounded cap at each end that stays on the map.
  function ribbon(line, half, y) {
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
      left.push([x + nx * l, y, z + nz * l]);
      right.push([x - nx * r, y, z - nz * r]);
    }
    for (let i = 0; i < line.length - 1; i++) {
      push(left[i], right[i], left[i + 1]);
      push(left[i + 1], right[i], right[i + 1]);
    }
    for (const [end, next] of [
      [0, 1],
      [line.length - 1, line.length - 2],
    ]) {
      const [x, z] = line[end],
        [px, pz] = line[next],
        heading = Math.atan2(x - px, z - pz);
      if (x > 47.5) continue;
      const steps = 10;
      for (let s = 0; s < steps; s++) {
        const a0 = heading - Math.PI / 2 + (s / steps) * Math.PI,
          a1 = heading - Math.PI / 2 + ((s + 1) / steps) * Math.PI;
        push(
          [x, y, z],
          [x + Math.sin(a1) * half, y, z + Math.cos(a1) * half],
          [x + Math.sin(a0) * half, y, z + Math.cos(a0) * half],
        );
      }
    }
  }
  // The lane stops at the grass's edge above the map's rim.
  ribbon(
    LANE.filter(([x]) => x <= 47.8),
    M.laneHalfWidth,
    0.104,
  );
  for (const line of PATHS) ribbon(line, M.pathHalfWidth, 0.1);
  const { x: cx, z: cz, rx, rz } = M.square,
    steps = 72;
  for (let s = 0; s < steps; s++) {
    const a0 = (s / steps) * TAU,
      a1 = ((s + 1) / steps) * TAU,
      at = (a) => {
        const wobble = 1 + Math.sin(a * 5 + 1.1) * 0.025 + Math.sin(a * 11) * 0.012;
        return [cx + Math.cos(a) * rx * wobble, 0.107, cz + Math.sin(a) * rz * wobble];
      };
    push([cx, 0.107, cz], at(a1), at(a0));
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
  mesh.name = "Market lane gravel";
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  return mesh;
}

// --- Footbridge -----------------------------------------------------------------

// A plank footbridge with a gentle hump, its rails on squared posts, resting
// on stone footings on either bank.
function footbridge(T) {
  const k = createKit(T),
    b = M.bridge,
    planks = ["#8a6a4a", "#7f6145", "#93724f", "#866547"],
    rail = "#6b543f",
    span = b.maxX - b.minX,
    zc = (b.minZ + b.maxZ) / 2,
    width = b.maxZ - b.minZ;
  const count = 22;
  for (let i = 0; i < count; i++) {
    const x = b.minX + ((i + 0.5) / count) * span,
      y = bridgeDeck(x, zc) - 0.05,
      slope = Math.atan(
        ((Math.cos(((x - b.minX) / span) * Math.PI) * Math.PI) / span) * b.rise,
      );
    k.box(planks[i % planks.length], x, y, zc, span / count - 0.025, 0.08, width, 0, 0, slope);
  }
  // Stringers under the planks, following the hump.
  for (const z of [b.minZ + 0.2, b.maxZ - 0.2])
    for (let i = 0; i < 8; i++) {
      const x0 = b.minX + (i / 8) * span,
        x1 = b.minX + ((i + 1) / 8) * span;
      k.rod(rail, [x0, bridgeDeck(x0, zc) - 0.14, z], [x1, bridgeDeck(x1, zc) - 0.14, z], 0.06);
    }
  // Posts and a top rail on each side.
  for (const z of [b.minZ + 0.04, b.maxZ - 0.04]) {
    const posts = 7;
    let previous = null;
    for (let i = 0; i < posts; i++) {
      const x = b.minX + 0.1 + (i / (posts - 1)) * (span - 0.2),
        deck = bridgeDeck(x, zc);
      k.box(rail, x, deck + 0.42, z, 0.09, 0.9, 0.09);
      k.box("#e3d6b5", x, deck + 0.89, z, 0.12, 0.05, 0.12);
      const top = [x, deck + 0.84, z];
      if (previous) k.rod(rail, previous, top, 0.035);
      previous = top;
    }
  }
  // Stone footings on the banks.
  for (const x of [b.minX + 0.25, b.maxX - 0.25]) {
    k.box("#a7a596", x, 0.06, zc, 0.6, 0.26, width + 0.25);
    k.box("#95978a", x, 0.2, zc, 0.5, 0.06, width + 0.1);
  }
  return k;
}

// --- Buildings ------------------------------------------------------------------

// Walls with corner posts and a base course, a gabled roof whose ridge runs
// along x, and front windows. Built about the footprint's centre at the ground.
function cottage(k, { w, d, h, wall, base, timber, roof, ridge, pitch = 1.25 }) {
  k.box(base, 0, 0.18, 0, w + 0.08, 0.36, d + 0.08);
  k.box(wall, 0, h / 2 + 0.18, 0, w, h - 0.36, d);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) k.box(timber, (sx * w) / 2, h / 2, (sz * d) / 2, 0.16, h, 0.16);
  k.box(timber, 0, h - 0.02, d / 2, w + 0.04, 0.14, 0.1);
  k.box(timber, 0, h - 0.02, -d / 2, w + 0.04, 0.14, 0.1);
  // The roof's two slopes, overhanging the walls, and the gables under them.
  const run = d / 2 + 0.38,
    angle = Math.atan2(pitch, d / 2),
    slope = Math.hypot(run, (run / (d / 2)) * pitch);
  for (const side of [-1, 1])
    k.box(
      roof,
      0,
      h + pitch / 2 + 0.02 - ((run - d / 2) / (d / 2)) * pitch * 0.5,
      (side * run) / 2,
      w + 0.5,
      0.13,
      slope,
      0,
      side * angle,
    );
  k.box(ridge, 0, h + pitch + 0.06, 0, w + 0.56, 0.12, 0.2);
  for (const side of [-1, 1])
    k.gable(
      wall,
      side < 0 ? -w / 2 : w / 2 - 0.06,
      h - 0.08,
      0,
      [
        [-d / 2, 0],
        [d / 2, 0],
        [0, pitch],
      ],
      0.06,
    );
}

/** A window in the front (+z) wall at (x, y): glass, frame, mullions and sill. */
function frontWindow(k, x, y, z, w, h, frame) {
  k.glazed(() => k.box("#ffcf73", x, y, z + 0.02, w, h, 0.05));
  k.box(frame, x, y + h / 2 + 0.04, z + 0.05, w + 0.16, 0.08, 0.08);
  k.box(frame, x, y - h / 2 - 0.05, z + 0.08, w + 0.24, 0.07, 0.16);
  for (const sx of [-1, 1]) k.box(frame, x + (sx * (w + 0.08)) / 2, y, z + 0.05, 0.08, h + 0.08, 0.08);
  k.box(frame, x, y, z + 0.06, 0.04, h, 0.04);
  k.box(frame, x, y, z + 0.06, w, 0.04, 0.04);
}

function flowerTub(k, x, z, colors) {
  k.box("#7b5a3f", x, 0.2, z, 0.5, 0.4, 0.4);
  k.ball("#5f8546", x, 0.48, z, 0.26, 0.16, 0.2);
  colors.forEach((c, i) => k.ball(c, x - 0.15 + i * 0.15, 0.58, z + (i % 2 ? 0.06 : -0.05), 0.06));
}

const teaSignAt = () => ({
  x: M.teaRoom.x,
  y: M.teaRoom.h - 0.32,
  z: M.teaRoom.z + M.teaRoom.d / 2 + 0.11,
  width: 2.3,
});

// The Copper Kettle: a cream cottage under a coursed sage roof with ridge
// tiles, finials and bargeboards, framed gables and a corbelled stack with its
// pots. A panelled bay window under a striped, scalloped awning; a half-glazed
// door with a fanlight and a hood; a copper kettle hanging from an iron bracket
// for a sign; a rose climbing beside the door, a window box, shuttered side
// windows, the kitchen's window at the back, and a terrace of tables on the
// lane. Its door, bay, east window, side windows, rear window and stack stand
// where the room inside has them (src/copper-kettle/layout.js).
const TEA = {
  wall: "#efe2c2",
  base: "#a39c88",
  timber: "#6a5442",
  roof: "#7f9a7c",
  roofDark: "#6c8769",
  ridge: "#5e7a62",
  door: "#6f8f86",
  copper: "#b87333",
  copperDark: "#8f5a32",
  iron: "#2f2c2a",
  pitch: 1.25,
};

// Returns two kits: the building, and its small round things (flowers, the
// rose, knobs, cups, the hanging kettle), which the overview hides zoomed far
// out, where they are a pixel each.
function teaRoom(T, range) {
  const main = createKit(T),
    fine = createKit(T),
    k = { ...main, ball: fine.ball, fine },
    t = M.teaRoom,
    front = t.d / 2;
  main.placed(t.x, 0, t.z, 0, () =>
    fine.placed(t.x, 0, t.z, 0, () => {
      teaShell(k, t);
      teaFront(k, t, front);
      teaSides(k, t);
    }),
  );
  // The terrace: round tables, chairs about them, and a teapot on each.
  for (const [i, table] of M.tables.entries()) {
    k.cyl("#6a5442", table.x, 0.36, table.z, 0.06, 0.72);
    k.cyl("#6a5442", table.x, 0.04, table.z, 0.24, 0.06);
    k.cyl("#e9dfc6", table.x, 0.74, table.z, 0.46, 0.05);
    // A cream cloth with a sage hem, falling a little over the edge.
    k.cyl("#f2ead5", table.x, 0.7, table.z, 0.49, 0.1);
    k.cyl("#7f9a7c", table.x, 0.655, table.z, 0.495, 0.02);
    fine.ball(i ? "#b87333" : "#8ca5b0", table.x + 0.1, 0.86, table.z - 0.05, 0.09, 0.08, 0.09);
    fine.cyl(i ? "#b87333" : "#8ca5b0", table.x + 0.2, 0.89, table.z - 0.05, 0.012, 0.09, 0, -0.9);
    fine.ball("#f4efe3", table.x - 0.18, 0.79, table.z + 0.12, 0.045, 0.03, 0.045);
    for (const [cx, cz] of [[-0.22, -0.18], [0.24, 0.16]]) {
      fine.cyl("#f4efe3", table.x + cx, 0.762, table.z + cz, 0.06, 0.008);
      fine.cyl(i ? "#e7b6bb" : "#a9c2a0", table.x + cx, 0.785, table.z + cz, 0.032, 0.04);
    }
    fine.ball("#e4a3b8", table.x - 0.05, 0.84, table.z + 0.22, 0.035);
    fine.cyl("#9fb8d0", table.x - 0.05, 0.79, table.z + 0.22, 0.025, 0.06);
    for (let c = 0; c < 2; c++) {
      const a = (i ? 0.4 : -0.3) + c * Math.PI + range(-0.15, 0.15),
        cx = table.x + Math.sin(a) * 0.72,
        cz = table.z + Math.cos(a) * 0.72;
      k.placed(cx, 0, cz, a + Math.PI, () => {
        k.box("#7f6145", 0, 0.44, 0, 0.42, 0.05, 0.4);
        for (const sx of [-0.17, 0.17])
          for (const sz of [-0.16, 0.16]) k.box("#6a5442", sx, 0.21, sz, 0.04, 0.42, 0.04);
        k.box("#7f6145", 0, 0.72, -0.19, 0.42, 0.5, 0.04);
      });
    }
  }
  return [main, fine];
}

// The walls, the coursed roof, the framed gables and the stack.
function teaShell(k, t) {
  const { w, d, h } = t,
    { wall, base, timber, roof, roofDark, ridge, pitch } = TEA;
  // A stone plinth with a drip course, the walls, and oak posts at the corners.
  k.box(base, 0, 0.18, 0, w + 0.08, 0.36, d + 0.08);
  k.box("#b4ad98", 0, 0.38, 0, w + 0.12, 0.05, d + 0.12);
  k.box(wall, 0, h / 2 + 0.18, 0, w, h - 0.36, d);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) k.box(timber, (sx * w) / 2, h / 2, (sz * d) / 2, 0.16, h, 0.16);
  k.box(timber, 0, h - 0.02, d / 2, w + 0.04, 0.14, 0.1);
  k.box(timber, 0, h - 0.02, -d / 2, w + 0.04, 0.14, 0.1);
  // The roof's two slopes: a sage slab each, with the tile courses standing
  // proud of it and a darker eave course, under a row of ridge tiles.
  const run = d / 2 + 0.38,
    angle = Math.atan2(pitch, d / 2),
    slope = Math.hypot(run, (run / (d / 2)) * pitch),
    centreY = h + pitch / 2 + 0.02 - ((run - d / 2) / (d / 2)) * pitch * 0.5,
    courses = 9,
    eaves = [];
  for (const side of [-1, 1]) {
    k.box(roof, 0, centreY, (side * run) / 2, w + 0.5, 0.13, slope, 0, side * angle);
    // Down the slope (towards the eave) and out of it (up off the roof).
    const down = [side * Math.cos(angle), -Math.sin(angle)],
      out = [side * Math.sin(angle), Math.cos(angle)],
      top = [0 - (down[0] * slope) / 2 + (side * run) / 2, centreY - (down[1] * slope) / 2];
    for (let i = 1; i <= courses; i++) {
      const f = i / courses,
        z = top[0] + down[0] * slope * f - down[0] * 0.04 + out[0] * 0.075,
        y = top[1] + down[1] * slope * f - down[1] * 0.04 + out[1] * 0.075;
      k.box(i === courses ? roofDark : i % 2 ? "#7a957a" : "#86a183", 0, y, z, w + 0.5, 0.05, 0.16, 0, side * (angle + 0.12));
    }
    eaves.push({ side, z: top[0] + down[0] * slope, y: top[1] + down[1] * slope });
  }
  const ridgeY = h + pitch + 0.08;
  k.cyl(ridge, 0, ridgeY, 0, 0.11, w + 0.56, 0, Math.PI / 2);
  for (let i = 0; i <= 8; i++) k.fine.cyl("#527058", -(w + 0.5) / 2 + (i * (w + 0.5)) / 8, ridgeY, 0, 0.122, 0.04, 0, Math.PI / 2);
  // Finials over the gables, and bargeboards along their rakes.
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 + 0.25);
    k.fine.post(timber, x, 0, ridgeY - 0.1, ridgeY + 0.22, 0.035);
    k.ball(TEA.copper, x, ridgeY + 0.26, 0, 0.06, 0.08, 0.06);
    k.fine.post(timber, x, 0, h + pitch - 0.35, h + pitch - 0.05, 0.03);
    k.ball(timber, x, h + pitch - 0.38, 0, 0.045);
    for (const side of [-1, 1]) {
      const zEave = side * run,
        yEave = h - ((run - d / 2) / (d / 2)) * pitch,
        zMid = zEave / 2,
        yMid = (yEave + h + pitch + 0.02) / 2,
        length = Math.hypot(run, h + pitch + 0.02 - yEave);
      k.box("#f2ead5", x, yMid - 0.07, zMid, 0.05, 0.2, length, 0, side * angle);
      for (let s = 1; s < 6; s++) {
        const f = s / 6;
        k.ball("#f2ead5", x, yEave + (h + pitch - yEave) * f - 0.19, zEave * (1 - f), 0.035, 0.035, 0.035);
      }
    }
  }
  // Half-round gutters along both eaves, and a downpipe at each front corner.
  for (const { side, z, y } of eaves) {
    k.cyl("#3f3a35", 0, y - 0.07, z + side * 0.04, 0.06, w + 0.5, 0, Math.PI / 2);
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2 + 0.16);
      k.fine.rod("#3f3a35", [x, y - 0.08, z + side * 0.04], [x, y - 0.25, side * (d / 2 + 0.12)], 0.035);
      k.post("#3f3a35", x, side * (d / 2 + 0.12), 0.05, y - 0.25, 0.035);
      k.fine.box("#3f3a35", x, 0.08, side * (d / 2 + 0.2), 0.1, 0.06, 0.14);
    }
  }
  // Framed gables: a collar, three studs and two braces in oak on the cream.
  for (const sx of [-1, 1]) {
    const x = sx < 0 ? -w / 2 - 0.035 : w / 2 + 0.035,
      gableOutline = [
        [-d / 2, 0],
        [d / 2, 0],
        [0, pitch],
      ];
    k.gable(wall, sx < 0 ? -w / 2 : w / 2 - 0.06, h - 0.08, 0, gableOutline, 0.06);
    k.box(timber, x, h + 0.45, 0, 0.05, 0.08, d * (1 - 0.45 / pitch) - 0.05);
    for (const z of [-0.7, 0, 0.7]) {
      const top = h - 0.08 + pitch * (1 - Math.abs(z) / (d / 2)) - 0.06;
      k.box(timber, x, (h + top) / 2, z, 0.05, top - h, 0.08);
    }
    for (const side of [-1, 1]) k.beam(timber, [x, h + 0.04, side * 1.45], [x, h + 0.42, side * 0.75], 0.07);
    // A rail across the wall below, at the side windows' sills.
    k.box(timber, x, 1.0, 0, 0.05, 0.08, d - 0.1);
  }
  // The stack: brick, two oversailing courses, and two pots, one copper-capped.
  const sx = 1.5,
    sz = -0.7;
  k.box("#b08868", sx, h + 1.2, sz, 0.5, 1.4, 0.5);
  k.box("#9c7558", sx, h + 1.78, sz, 0.58, 0.08, 0.58);
  k.box("#a87f62", sx, h + 1.88, sz, 0.62, 0.07, 0.62);
  k.box("#8f6a50", sx, h + 0.55, sz, 0.56, 0.05, 0.56);
  for (const [i, px] of [-0.12, 0.13].entries()) {
    k.cyl("#b5653f", sx + px, h + 2.07, sz, 0.08, 0.3);
    k.cyl("#a35a38", sx + px, h + 2.22, sz, 0.095, 0.04);
    if (i) {
      k.cyl(TEA.copper, sx + px, h + 2.3, sz, 0.11, 0.05);
      k.ball(TEA.copper, sx + px, h + 2.35, sz, 0.05);
    }
  }
}

// The front: the bay under its awning, the door, the east window and its box,
// the climbing rose, the hanging kettle and the chalkboard on the terrace.
function teaFront(k, t, front) {
  const { timber, wall, door, copper, copperDark, iron } = TEA;
  // ---- the bay: a panelled base, three lights in front and one in each cheek
  const bx = -1.5,
    bw = 1.7,
    bd = 0.45,
    bz = front + bd / 2,
    glassBottom = 0.9,
    glassTop = 1.76;
  k.box(wall, bx, 0.62, bz, bw, 0.56, bd);
  for (const x of [bx - 0.56, bx, bx + 0.56]) {
    k.fine.box("#e2d3b0", x, 0.62, front + bd + 0.005, 0.44, 0.34, 0.02);
    k.fine.box(timber, x, 0.8, front + bd + 0.012, 0.46, 0.025, 0.02);
  }
  k.box(timber, bx, glassBottom - 0.02, bz + 0.03, bw + 0.14, 0.07, bd + 0.12);
  k.glazed(() => {
    k.box("#ffcf73", bx, (glassBottom + glassTop) / 2, front + bd - 0.02, bw - 0.1, glassTop - glassBottom, 0.04);
    for (const sx of [-1, 1]) k.box("#ffcf73", bx + (sx * bw) / 2, (glassBottom + glassTop) / 2, front + bd / 2, 0.04, glassTop - glassBottom, bd - 0.1);
  });
  for (const sx of [-1, 1])
    for (const z of [front + 0.04, front + bd]) k.box(timber, bx + (sx * bw) / 2, (glassBottom + glassTop) / 2, z, 0.08, glassTop - glassBottom + 0.04, 0.08);
  for (const x of [bx - 0.283, bx + 0.283]) k.box(timber, x, (glassBottom + glassTop) / 2, front + bd + 0.005, 0.05, glassTop - glassBottom, 0.05);
  k.box(timber, bx, 1.5, front + bd + 0.005, bw, 0.04, 0.05);
  for (const sx of [-1, 1]) k.box(timber, bx + (sx * bw) / 2 + sx * 0.005, 1.5, bz, 0.05, 0.04, bd);
  k.box(timber, bx, glassTop + 0.04, bz + 0.02, bw + 0.14, 0.08, bd + 0.1);
  k.box(TEA.roofDark, bx, glassTop + 0.14, front + bd / 2 + 0.03, bw + 0.2, 0.05, bd + 0.12, 0, 0.38);
  // ---- the striped awning over the bay, its scalloped valance and its arms
  const stripes = 7,
    aw = 1.74;
  for (let i = 0; i < stripes; i++)
    k.box(i % 2 ? "#f2ead5" : "#5f8e86", bx - 0.87 + (i + 0.5) * (aw / stripes), 2.05, front + 0.62, aw / stripes + 0.002, 0.04, 0.95, 0, 0.42);
  const lipY = 2.05 - 0.475 * Math.sin(0.42),
    lipZ = front + 0.62 + 0.475 * Math.cos(0.42);
  for (let i = 0; i < stripes * 2; i++) {
    const x = bx - 0.87 + (i + 0.5) * (aw / (stripes * 2));
    k.fine.cyl(Math.floor(i / 2) % 2 ? "#f2ead5" : "#5f8e86", x, lipY - 0.03, lipZ, aw / (stripes * 4) + 0.005, 0.02, Math.PI / 2);
  }
  k.box("#5f8e86", bx, lipY - 0.01, lipZ, aw, 0.05, 0.025);
  for (const sx of [-1, 1]) {
    k.fine.rod(iron, [bx + sx * 0.86, 1.62, front + 0.04], [bx + sx * 0.86, lipY - 0.02, lipZ - 0.02], 0.014);
    k.fine.box(iron, bx + sx * 0.86, 2.24, front + 0.04, 0.05, 0.06, 0.06);
  }
  // ---- the door: half-glazed, a fanlight, a hood on brackets, a brass knob
  const dz = front + 0.02;
  k.box(door, 0, 0.92, dz, 0.95, 1.56, 0.08);
  k.glazed(() => k.box("#ffcf73", 0, 1.3, dz + 0.045, 0.62, 0.56, 0.02));
  for (const x of [-0.104, 0.104]) k.fine.box(door, x, 1.3, dz + 0.06, 0.03, 0.56, 0.02);
  k.fine.box(door, 0, 1.3, dz + 0.06, 0.62, 0.03, 0.02);
  for (const sx of [-1, 1]) k.fine.box("#5f7f77", sx * 0.2, 0.55, dz + 0.05, 0.3, 0.5, 0.02);
  k.ball("#d8b25a", 0.34, 0.98, dz + 0.08, 0.035);
  k.fine.box("#d8b25a", 0, 0.76, dz + 0.055, 0.26, 0.05, 0.015);
  // A fan of glass over the door, with its bars.
  k.box(timber, 0, 1.72, dz + 0.02, 1.15, 0.08, 0.1);
  const fan = new k.unit.cylinder.constructor(0.42, 0.42, 0.04, 16, 1, false, -Math.PI / 2, Math.PI);
  k.glazed(() => k.add(fan, null, 0, 1.76, dz + 0.04, 1, 1, 0.55, -Math.PI / 2));
  fan.dispose();
  for (let i = 1; i < 5; i++) {
    const a = (i / 5) * Math.PI;
    k.fine.rod(timber, [0, 1.77, dz + 0.07], [Math.cos(a) * 0.4, 1.77 + Math.sin(a) * 0.22, dz + 0.07], 0.012);
  }
  for (const sx of [-1, 1]) k.box(timber, sx * 0.53, 1.04, front + 0.06, 0.1, 1.98, 0.1);
  // The hood: two curved brackets and a little sage roof.
  for (const sx of [-1, 1]) {
    k.fine.beam(timber, [sx * 0.6, 1.78, front + 0.05], [sx * 0.6, 2.06, front + 0.42], 0.06);
    k.fine.box(timber, sx * 0.6, 1.95, front + 0.1, 0.06, 0.3, 0.1);
  }
  k.box(TEA.roofDark, 0, 2.15, front + 0.25, 1.45, 0.06, 0.6, 0, 0.32);
  k.box(timber, 0, 2.07, front + 0.52, 1.45, 0.07, 0.05);
  k.box("#b6ae99", 0, 0.08, front + 0.32, 1.3, 0.12, 0.5);
  k.box("#b6ae99", 0, 0.04, front + 0.65, 1.1, 0.08, 0.3);
  // ---- the east window, its box of flowers, and the rose by the door
  frontWindow(k, 1.55, 1.38, front, 0.95, 0.85, timber);
  k.box("#6f8f86", 1.55, 0.84, front + 0.2, 1.05, 0.18, 0.24);
  for (let i = 0; i < 9; i++) {
    k.ball("#5f8546", 1.1 + i * 0.112, 0.97, front + 0.2 + (i % 2 ? 0.05 : -0.04), 0.07, 0.06, 0.07);
    k.ball(["#e4a3b8", "#f3e3a2", "#b7a6d6", "#f2ead5"][i % 4], 1.12 + i * 0.112, 1.04, front + 0.22 + (i % 2 ? -0.03 : 0.04), 0.04);
  }
  for (const sx of [-1, 1]) k.fine.box(iron, 1.55 + sx * 0.42, 0.72, front + 0.12, 0.03, 0.12, 0.2);
  // A trellis beside the door, a rambling rose up it and over the hood.
  for (const x of [0.66, 0.82, 0.98]) k.fine.box("#e9dfc6", x, 1.3, front + 0.035, 0.025, 1.8, 0.02);
  for (let y = 0.6; y < 2.2; y += 0.32) k.fine.box("#e9dfc6", 0.82, y, front + 0.045, 0.36, 0.02, 0.02);
  const rose = [
    [0.86, 0.55], [0.74, 0.8], [0.92, 1.0], [0.7, 1.25], [0.88, 1.45], [0.76, 1.7], [0.9, 1.92], [0.72, 2.12], [0.55, 2.28], [0.36, 2.3],
  ];
  rose.forEach(([x, y], i) => {
    k.ball(i % 3 ? "#5f8546" : "#4d7440", x, y, front + 0.1, 0.12, 0.1, 0.07);
    k.ball(i % 2 ? "#e4a3b8" : "#d98b8b", x + (i % 2 ? 0.06 : -0.05), y + 0.04, front + 0.16, 0.035);
  });
  // ---- the hanging sign: a copper kettle from a scrolled iron bracket
  const sx = 2.25,
    out = 0.78,
    by = 2.2;
  k.fine.box(iron, sx, by, front + 0.03, 0.1, 0.36, 0.04);
  k.fine.box(iron, sx, by + 0.12, front + out / 2 + 0.03, 0.03, 0.03, out);
  k.fine.beam(iron, [sx, by - 0.14, front + 0.04], [sx, by + 0.1, front + out * 0.6], 0.025);
  k.fine.cyl(iron, sx, by + 0.12, front + out + 0.04, 0.035, 0.03);
  for (const z of [front + out - 0.06, front + out + 0.04]) k.fine.rod(iron, [sx, by + 0.11, z], [sx, by - 0.03, z], 0.007);
  const ky = by - 0.3,
    kz = front + out;
  k.ball(copper, sx, ky, kz, 0.17, 0.14, 0.17);
  k.fine.cyl(copperDark, sx, ky - 0.13, kz, 0.14, 0.03);
  k.fine.cyl(copper, sx, ky + 0.13, kz, 0.08, 0.05);
  k.ball(copperDark, sx, ky + 0.17, kz, 0.03);
  k.fine.rod(copper, [sx, ky - 0.03, kz - 0.15], [sx, ky + 0.12, kz - 0.29], 0.025);
  k.fine.rod(copper, [sx, ky + 0.12, kz - 0.29], [sx, ky + 0.15, kz - 0.33], 0.018);
  k.fine.rod(copperDark, [sx, ky + 0.12, kz - 0.1], [sx, ky + 0.25, kz], 0.014);
  k.fine.rod(copperDark, [sx, ky + 0.25, kz], [sx, ky + 0.12, kz + 0.1], 0.014);
  // ---- an A-board on the terrace, chalked with the day's teas
  const ax = 1.45,
    az = front + 0.95;
  for (const side of [-1, 1]) {
    // The two boards lean together at the top, like a tent.
    k.fine.box("#6a5442", ax, 0.42, az + side * 0.11, 0.56, 0.82, 0.04, 0, -side * 0.26);
    k.fine.box("#2c3230", ax, 0.44, az + side * 0.125, 0.46, 0.66, 0.02, 0, -side * 0.26);
    for (let i = 0; i < 4; i++)
      k.fine.box("#f3efe2", ax + (i % 2 ? 0.04 : -0.03), 0.66 - i * 0.13, az + side * (0.082 + i * 0.035), 0.3 - (i % 2) * 0.1, 0.025, 0.012, 0, -side * 0.26);
  }
  // Flower tubs by the door.
  flowerTub(k, -0.85, front + 0.45, ["#e4a3b8", "#f3e3a2", "#d98b8b"]);
  flowerTub(k, 0.85, front + 0.45, ["#b7a6d6", "#f3e3a2", "#e4a3b8"]);
}

// The side windows, shuttered, and the kitchen's window at the back.
function teaSides(k, t) {
  const { w, d } = t,
    { timber } = TEA;
  for (const sx of [-1, 1]) {
    const x = (sx * w) / 2;
    k.glazed(() => k.box("#ffcf73", x + sx * 0.02, 1.4, 0, 0.05, 0.75, 0.8));
    for (const z of [-0.43, 0.43]) k.box(timber, x + sx * 0.05, 1.4, z, 0.06, 0.85, 0.07);
    k.box(timber, x + sx * 0.05, 1.82, 0, 0.06, 0.07, 0.94);
    k.box(timber, x + sx * 0.08, 0.98, 0, 0.14, 0.06, 1.0);
    k.box(timber, x + sx * 0.055, 1.4, 0, 0.04, 0.75, 0.035);
    k.box(timber, x + sx * 0.055, 1.48, 0, 0.04, 0.035, 0.8);
    for (const side of [-1, 1]) {
      k.box("#6f8f86", x + sx * 0.06, 1.4, side * 0.66, 0.04, 0.85, 0.4);
      for (const y of [1.15, 1.4, 1.65]) k.box("#5f7f77", x + sx * 0.085, y, side * 0.66, 0.015, 0.03, 0.34);
    }
  }
  // The kitchen's window, over the sink, with a pot of herbs on its sill.
  const rz = -d / 2,
    rx = -0.55;
  k.glazed(() => k.box("#ffcf73", rx, 1.55, rz - 0.02, 0.85, 0.8, 0.05));
  k.box(timber, rx, 1.99, rz - 0.05, 1.01, 0.08, 0.08);
  k.box(timber, rx, 1.11, rz - 0.08, 1.09, 0.07, 0.16);
  for (const x of [rx - 0.47, rx + 0.47]) k.box(timber, x, 1.55, rz - 0.05, 0.08, 0.88, 0.08);
  k.box(timber, rx, 1.55, rz - 0.06, 0.04, 0.8, 0.04);
  k.box(timber, rx, 1.72, rz - 0.06, 0.85, 0.035, 0.04);
  k.cyl("#ad6a4b", rx + 0.3, 1.21, rz - 0.1, 0.07, 0.13);
  for (let i = 0; i < 4; i++) k.ball("#5f8546", rx + 0.27 + (i % 2) * 0.06, 1.34 + i * 0.02, rz - 0.1, 0.06);
}

// The door stands east of the middle, as it does from inside (src/post-office/).
const POST_DOOR_X = 0.7;
const postSignAt = () => ({
  x: M.postOffice.x,
  y: M.postOffice.h - 0.3,
  z: M.postOffice.z + M.postOffice.d / 2 + 0.11,
  width: 2,
});

// The post office: red brick under a slate roof, a green door, a bench for
// waiting, parcels stacked by the wall, and a pillar box at the lane.
function postOffice(T) {
  const k = createKit(T),
    p = M.postOffice,
    front = p.d / 2,
    trim = "#e6dcc4";
  k.placed(p.x, 0, p.z, 0, () => {
    cottage(k, {
      w: p.w,
      d: p.d,
      h: p.h,
      wall: "#b97a5e",
      base: "#8e8a7e",
      timber: trim,
      roof: "#6d7a80",
      ridge: "#56626a",
      pitch: 1.1,
    });
    k.box("#a8705a", -1.3, p.h + 1.05, -0.5, 0.45, 1.2, 0.45);
    k.box("#4f6b56", POST_DOOR_X, 0.98, front + 0.02, 0.9, 1.6, 0.08);
    k.box(trim, POST_DOOR_X, 1.84, front + 0.04, 1.1, 0.1, 0.1);
    k.box("#d8b25a", POST_DOOR_X + 0.25, 0.98, front + 0.08, 0.06, 0.06, 0.04);
    k.box("#a8a294", POST_DOOR_X, 0.08, front + 0.3, 1.2, 0.12, 0.45);
    frontWindow(k, -1.0, 1.35, front, 1.3, 0.9, trim);
    k.box("#6c8f5c", -1.0, 0.8, front + 0.2, 1.35, 0.18, 0.22);
    for (let i = 0; i < 5; i++) k.ball(["#e6c35a", "#e7a2a2", "#f1ece0"][i % 3], -1.5 + i * 0.25, 0.94, front + 0.22, 0.07);
    for (const x of [-p.w / 2, p.w / 2])
      k.glazed(() => k.box("#ffcf73", x + (x < 0 ? -0.02 : 0.02), 1.35, 0, 0.05, 0.7, 0.75));
    // The back room's window, in the rear wall.
    k.glazed(() => k.box("#ffcf73", 1.3, 1.4, -front - 0.02, 0.85, 0.7, 0.05));
    k.box(trim, 1.3, 1.8, -front - 0.05, 1.01, 0.08, 0.08);
    k.box(trim, 1.3, 0.99, -front - 0.08, 1.09, 0.07, 0.16);
    for (const x of [0.83, 1.77]) k.box(trim, x, 1.4, -front - 0.05, 0.08, 0.78, 0.08);
    // A bench under the window, and parcels by the door.
    k.box("#7f6145", -1.0, 0.44, front + 0.62, 1.5, 0.06, 0.36);
    k.box("#7f6145", -1.0, 0.7, front + 0.46, 1.5, 0.3, 0.05);
    for (const x of [-1.6, -0.4]) k.box("#65513e", x, 0.22, front + 0.62, 0.06, 0.44, 0.3);
    k.box("#c9a676", 1.75, 0.2, front + 0.35, 0.5, 0.4, 0.4, 0.2);
    k.box("#d6b689", 1.7, 0.52, front + 0.33, 0.36, 0.26, 0.3, -0.15);
    k.box("#b8915f", 1.8, 0.11, front + 0.85, 0.36, 0.22, 0.3, 0.5);
  });
  // The pillar box.
  const b = M.postBox;
  k.cyl("#b3392f", b.x, 0.62, b.z, 0.22, 1.2);
  k.ball("#b3392f", b.x, 1.22, b.z, 0.235, 0.12, 0.235);
  k.cyl("#3d3a36", b.x, 0.04, b.z, 0.26, 0.08);
  k.box("#2f2a26", b.x, 1.0, b.z + 0.21, 0.22, 0.04, 0.04);
  k.box("#e6c35a", b.x, 0.78, b.z + 0.215, 0.14, 0.1, 0.02);
  return k;
}

// --- Stalls, bunting and lamps -------------------------------------------------

const AWNINGS = {
  seeds: ["#6f9a5a", "#f2ead5"],
  lanterns: ["#c46a4a", "#f2ead5"],
  hats: ["#5f7fa3", "#f2ead5"],
  produce: ["#d39a3c", "#f2ead5"],
};

// A strip of canvas `width` across at x, from a to b ([z, y] each).
function slab(k, hex, x, a, b, width, thick = 0.035) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]) + 0.02;
  k.box(hex, x, (a[1] + b[1]) / 2, (a[0] + b[0]) / 2, width, thick, length, 0, Math.atan2(a[1] - b[1], b[0] - a[0]));
}

// Builds parts in both kits in a frame at (x, y, z), turned by ry, then tipped by rx.
function tipped(T, k, f, [x, y, z], ry, rx, build) {
  const frame = new T.Matrix4().compose(
    new T.Vector3(x, y, z),
    new T.Quaternion().setFromEuler(new T.Euler(rx, ry, 0, "YXZ")),
    new T.Vector3(1, 1, 1),
  );
  k.transformed(frame, () => f.transformed(frame, build));
}

// A chalk slate in a wooden frame, `w` by `h`, facing +z at the origin, with
// a few lines of chalk.
function slate(f, w, h) {
  f.box("#8a6a4a", 0, 0, -0.008, w + 0.04, h + 0.04, 0.016);
  f.box("#2f3330", 0, 0, 0.002, w, h, 0.008);
  const lines = [0.62, 0.8, 0.5, 0.7];
  for (let i = 0; i < 4; i++)
    f.box("#e8e2d0", (i % 2 ? -0.04 : 0) * w, h * (0.3 - i * 0.2), 0.007, w * lines[i], h * 0.05, 0.003);
}

// A trestle stall with a counter at its front (+z, local), four posts and a
// striped awning sloping down over the counter, with each stall's wares. The
// frame, the counter and the awning go in `k`; the wares, the awning's
// scallops and the other small things go in `f`, which the overview hides
// zoomed far out.
function stall(T, k, f, kind, range) {
  const { w, d } = M.stallSize,
    [stripe, cream] = AWNINGS[kind],
    wood = "#8a6a4a",
    dark = "#65513e",
    plank = "#7f6145",
    front = d / 2 - 0.05,
    rear = -d / 2 + 0.05,
    side = (w - 0.1) / 2;
  // Posts on footings, rails along their tops for the awning to lie on, and
  // a cross brace behind.
  for (const sx of [-1, 1]) {
    k.box(dark, sx * side, 1.0, front, 0.08, 2.0, 0.08);
    k.box(dark, sx * side, 1.15, rear, 0.08, 2.3, 0.08);
    for (const z of [front, rear]) k.box("#5a4636", sx * side, 0.04, z, 0.13, 0.08, 0.13);
    k.beam(dark, [sx * side, 2.24, rear], [sx * side, 1.94, front], 0.05);
    k.beam(dark, [sx * side, 0.3, rear + 0.04], [-sx * side, 1.0, rear + 0.04], 0.04);
  }
  k.box(dark, 0, 1.95, front, w - 0.1, 0.06, 0.05);
  k.box(dark, 0, 2.25, rear, w - 0.1, 0.06, 0.05);
  // The counter: a plank top on trestles, under a cloth that falls over its
  // front, hemmed in the awning's colour.
  k.box(wood, 0, 0.84, d / 2 - 0.3, w - 0.1, 0.07, 0.66);
  for (const sx of [-0.95, 0.95]) {
    k.beam(plank, [sx, 0, d / 2 - 0.04], [sx, 0.8, d / 2 - 0.3], 0.05);
    k.beam(plank, [sx, 0, -0.02], [sx, 0.8, d / 2 - 0.3], 0.05);
  }
  k.box(plank, 0, 0.3, d / 2 - 0.3, 1.9, 0.05, 0.05);
  k.box(cream, 0, 0.88, d / 2 - 0.05, w - 0.06, 0.012, 0.18);
  k.box(cream, 0, 0.6, d / 2 + 0.04, w - 0.06, 0.57, 0.02);
  k.box(stripe, 0, 0.36, d / 2 + 0.052, w - 0.05, 0.07, 0.008);
  // The back shelf on brackets.
  k.box(wood, 0, 1.18, -d / 2 + 0.2, w - 0.16, 0.05, 0.3);
  for (const sx of [-1, 1])
    k.beam(dark, [sx * (side - 0.08), 1.0, rear + 0.03], [sx * (side - 0.08), 1.15, -d / 2 + 0.3], 0.03);
  // The awning: stripes from the back posts' tops out over the counter,
  // bellied a little between, a scalloped valance along the front and
  // canvas cheeks at the sides.
  const stripes = 9,
    across = w + 0.16,
    band = across / stripes,
    back = [rear, 2.32],
    tip = [d / 2 + 0.38, 1.88],
    belly = [(back[0] + tip[0]) / 2, (back[1] + tip[1]) / 2 - 0.045];
  for (let i = 0; i < stripes; i++) {
    const x = -across / 2 + (i + 0.5) * band,
      hex = i % 2 ? cream : stripe;
    slab(k, hex, x, back, belly, band + 0.002);
    slab(k, hex, x, belly, tip, band + 0.002);
    k.box(hex, x, tip[1] - 0.06, tip[0] + 0.01, band - 0.02, 0.1, 0.025);
    f.cyl(hex, x, tip[1] - 0.11, tip[0], band / 2 - 0.012, 0.022, Math.PI / 2);
  }
  for (const sx of [-1, 1])
    k.gable(
      stripe,
      sx > 0 ? across / 2 - 0.03 : -across / 2 + 0.01,
      0,
      0,
      [
        [-rear, 2.27],
        [-tip[0] + 0.08, 1.87],
        [-rear, 1.8],
      ],
      0.02,
    );
  // The stall's name board over the back of the awning (its painted face is
  // stallBoards()), on two stubby uprights.
  f.box(dark, 0, BOARD.y, rear - 0.01, BOARD.w + 0.1, BOARD.h + 0.07, 0.04);
  for (const sx of [-0.6, 0.6]) f.box(dark, sx, 2.31, rear - 0.01, 0.05, 0.16, 0.04);
  // The honesty box at the counter's corner, with its padlock.
  k.box("#5a4636", w / 2 - 0.3, 0.97, d / 2 - 0.15, 0.24, 0.2, 0.18);
  k.box("#d8b25a", w / 2 - 0.3, 1.075, d / 2 - 0.15, 0.12, 0.01, 0.02);
  f.box("#c9a34a", w / 2 - 0.3, 0.98, d / 2 - 0.055, 0.045, 0.05, 0.016);
  f.box("#3d3a36", w / 2 - 0.3, 1.015, d / 2 - 0.055, 0.03, 0.025, 0.008);
  const top = 0.88;
  if (kind === "seeds") {
    // Packets standing on a stepped rack, three rows deep, each with its
    // label.
    const packets = ["#e6c35a", "#e7a2a2", "#b7a6d6", "#9cc48a", "#f0b27a", "#8fb8d8"],
      steps = [0.2, 0.12, 0.04];
    steps.forEach((h, row) => k.box(wood, -0.27, top + h / 2, d / 2 - 0.5 + row * 0.15, 1.52, h, 0.15));
    for (let row = 0; row < 3; row++)
      for (let i = 0; i < 9; i++) {
        const x = -0.95 + i * 0.17,
          y = top + steps[row] + 0.075,
          z = d / 2 - 0.47 + row * 0.15,
          ry = range(-0.08, 0.08);
        f.box(packets[(i + row * 2) % packets.length], x, y, z, 0.12, 0.15, 0.02, ry, -0.35);
        f.box("#f4efe3", x, y + 0.019, z - 0.007, 0.09, 0.065, 0.024, ry, -0.35);
        f.box(packets[(i + row * 2 + 3) % packets.length], x, y + 0.019, z - 0.007, 0.035, 0.035, 0.028, ry, -0.35);
      }
    // A chalked price slate leaning on the honesty box.
    tipped(T, k, f, [w / 2 - 0.58, top + 0.12, d / 2 - 0.12], -0.2, -0.25, () => slate(f, 0.24, 0.2));
    // Sacks of seed behind, their necks rolled down, one with a scoop.
    [
      [-0.6, "#5a4a3a"],
      [0.15, "#c9a35a"],
    ].forEach(([x, seed]) => {
      k.ball("#cdb58a", x, 0.25, -0.05, 0.28, 0.25, 0.24);
      f.cyl("#bfa577", x, 0.46, -0.05, 0.2, 0.07);
      f.cyl(seed, x, 0.49, -0.05, 0.175, 0.02);
    });
    f.rod("#b8b4aa", [0.2, 0.5, -0.02], [0.3, 0.66, 0.05], 0.015);
    f.cyl("#b8b4aa", 0.17, 0.5, -0.05, 0.05, 0.05);
    // Seedlings in terracotta pots along the back shelf.
    for (let i = 0; i < 6; i++) {
      const x = -0.85 + i * 0.34,
        z = -d / 2 + 0.2;
      f.cyl("#b5653f", x, 1.265, z, 0.055, 0.12);
      f.cyl("#a85a37", x, 1.325, z, 0.064, 0.03);
      f.cyl("#4a3a2c", x, 1.341, z, 0.05, 0.004);
      f.ball(packets[3], x - 0.02, 1.39, z, 0.045, 0.04, 0.045);
      f.ball("#6f9a5a", x + 0.025, 1.375, z + 0.01, 0.04, 0.035, 0.04);
    }
    // Bunches of dried lavender and strawflowers hung from the front rail.
    [-0.7, 0, 0.7].forEach((x, i) => {
      const head = i === 1 ? "#e6c35a" : "#9a86c4";
      f.rod("#d8cba8", [x, 1.93, front], [x, 1.8, front], 0.006);
      f.cyl("#8a9a5a", x, 1.73, front, 0.022, 0.15);
      for (let n = 0; n < 5; n++) {
        const a = n * 1.26;
        // Spikes splayed a little, as a hung bunch falls open.
        f.add(
          f.unit.sphere,
          head,
          x + Math.cos(a) * 0.035,
          1.6 - (n % 2) * 0.02,
          front + Math.sin(a) * 0.035,
          0.016,
          0.06,
          0.016,
          -Math.sin(a) * 0.25,
          0,
          Math.cos(a) * 0.25,
        );
      }
    });
    // A watering can set down behind.
    f.cyl("#7f9a9c", 0.85, 0.12, -0.3, 0.1, 0.22);
    f.rod("#7f9a9c", [0.93, 0.08, -0.3], [1.08, 0.26, -0.3], 0.015);
    f.rod("#6c8587", [0.76, 0.2, -0.3], [0.85, 0.3, -0.3], 0.012);
  } else if (kind === "lanterns") {
    // Paper lanterns hung along the awning's edge, ribbed, capped and
    // tasselled, and set out on the counter.
    for (let i = 0; i < 5; i++) {
      const x = -0.9 + i * 0.45,
        z = d / 2 + 0.2,
        hang = 1.55 - (i % 2) * 0.12;
      f.rod("#3d3a36", [x, tip[1] - 0.18, z], [x, hang + 0.14, z], 0.008);
      k.glazed(() => k.ball("#ffcf73", x, hang, z, 0.13, 0.16, 0.13));
      for (const dy of [-0.06, 0.06]) f.cyl("#c46a4a", x, hang + dy, z, 0.124, 0.008);
      f.cyl("#3d3a36", x, hang + 0.15, z, 0.06, 0.03);
      f.cyl("#3d3a36", x, hang - 0.15, z, 0.05, 0.025);
      f.cyl("#b5584a", x, hang - 0.21, z, 0.012, 0.09);
    }
    for (const x of [-0.6, 0.1]) {
      k.glazed(() => k.cyl("#ffcf73", x, top + 0.16, d / 2 - 0.35, 0.1, 0.26));
      k.cyl("#3d3a36", x, top + 0.31, d / 2 - 0.35, 0.11, 0.04);
      f.cyl("#3d3a36", x, top + 0.02, d / 2 - 0.35, 0.105, 0.04);
      f.rod("#3d3a36", [x - 0.07, top + 0.33, d / 2 - 0.35], [x, top + 0.42, d / 2 - 0.35], 0.006);
      f.rod("#3d3a36", [x + 0.07, top + 0.33, d / 2 - 0.35], [x, top + 0.42, d / 2 - 0.35], 0.006);
    }
    // A square tin lantern with a pyramid cap.
    const sx = 0.5,
      sz = d / 2 - 0.3;
    k.glazed(() => k.box("#ffcf73", sx, top + 0.15, sz, 0.15, 0.22, 0.15));
    f.box("#3d3a36", sx, top + 0.02, sz, 0.19, 0.04, 0.19);
    for (const a of [-1, 1])
      for (const b of [-1, 1]) f.box("#3d3a36", sx + a * 0.08, top + 0.15, sz + b * 0.08, 0.02, 0.24, 0.02);
    f.pyramid("#3d3a36", sx, top + 0.33, sz, 0.14, 0.12);
    f.ball("#3d3a36", sx, top + 0.41, sz, 0.02);
    // Folded lanterns stacked on the back shelf and a box of candles.
    const paper = ["#e7a2a2", "#ffcf73", "#9fb8d0", "#f2ead5", "#b7a6d6"];
    for (const [j, x] of [-0.75, -0.35].entries())
      for (let n = 0; n < 3; n++) f.cyl(paper[(j * 2 + n) % paper.length], x, 1.22 + n * 0.035, -d / 2 + 0.2, 0.11, 0.032);
    f.box(wood, 0.35, 1.245, -d / 2 + 0.2, 0.34, 0.08, 0.18);
    for (let n = 0; n < 6; n++)
      f.cyl("#f4efe3", 0.24 + (n % 3) * 0.11, 1.32, -d / 2 + 0.16 + Math.floor(n / 3) * 0.08, 0.016, 0.1);
    // A crate packed with straw behind.
    f.box("#a8865c", 0.45, 0.15, -0.28, 0.45, 0.3, 0.35);
    f.box("#e3c27a", 0.45, 0.305, -0.28, 0.41, 0.02, 0.31);
  } else if (kind === "hats") {
    // Straw boaters on stands, a bonnet on the second, more hats on the
    // shelf with ribbon on spools, and hatboxes behind.
    const ribbons = ["#b5584a", "#5f7fa3", "#6f9a5a", "#8a5f8f"],
      z = d / 2 - 0.35;
    for (let i = 0; i < 4; i++) {
      const x = -0.85 + i * 0.5;
      f.cyl("#65513e", x, top + 0.01, z, 0.07, 0.02);
      f.cyl("#65513e", x, top + 0.12, z, 0.025, 0.22);
      if (i === 1) {
        f.ball("#e8c983", x, top + 0.3, z - 0.02, 0.14, 0.12, 0.15);
        f.cyl("#e3c27a", x, top + 0.33, z + 0.08, 0.17, 0.02, 1.15);
        f.cyl(ribbons[i], x, top + 0.3, z - 0.02, 0.143, 0.035);
        for (const s of [-1, 1]) f.box(ribbons[i], x + s * 0.11, top + 0.17, z + 0.07, 0.025, 0.2, 0.006, 0, 0, s * 0.15);
        continue;
      }
      f.cyl("#e3c27a", x, top + 0.24, z, 0.22, 0.02);
      f.cyl("#e8c983", x, top + 0.31, z, 0.13, 0.12);
      f.cyl(ribbons[i], x, top + 0.28, z, 0.133, 0.04);
      f.ball(ribbons[i], x + 0.1, top + 0.28, z + 0.09, 0.03, 0.025, 0.02);
      for (const s of [-1, 1]) f.box(ribbons[i], x + 0.1 + s * 0.025, top + 0.24, z + 0.1, 0.022, 0.07, 0.005, 0, 0, s * 0.35);
    }
    for (let i = 0; i < 3; i++) {
      const x = -0.6 + i * 0.6;
      f.cyl("#e3c27a", x, 1.24, -d / 2 + 0.2, 0.18, 0.02);
      f.cyl(ribbons[(i + 1) % 4], x, 1.29, -d / 2 + 0.2, 0.11, 0.08);
      if (i !== 1) f.ball("#e7a2a2", x + 0.09, 1.31, -d / 2 + 0.27, 0.035);
    }
    for (const [j, x] of [-0.3, 0.3].entries())
      for (let n = 0; n < 2; n++)
        f.cyl(ribbons[(j * 2 + n) % 4], x - 0.03 + n * 0.06, 1.245, -d / 2 + 0.3, 0.04, 0.045, 0, Math.PI / 2);
    for (const [x, zb, boxes] of [
      [-0.7, -0.3, [["#e7b6bb", 0.2, 0.24], ["#9fb8d0", 0.16, 0.2]]],
      [0.65, -0.25, [["#f2ead5", 0.18, 0.22]]],
    ]) {
      let y = 0;
      for (const [hex, r, h] of boxes) {
        f.cyl(hex, x, y + h / 2, zb, r, h);
        f.cyl(stripe, x, y + h - 0.02, zb, r + 0.012, 0.04);
        f.cyl(cream, x, y + h * 0.45, zb, r + 0.004, 0.03);
        y += h + 0.02;
      }
    }
  } else {
    // Slatted crates of apples, carrots with their tops on, cabbages and
    // onions; jam on the shelf, a marrow the size of a cat, a pumpkin and a
    // basket behind, a hanging scale and a chalked sign on the post.
    const crates = [
      ["#c2382c", 0.07],
      ["#e08a3a", 0.055],
      ["#7da55a", 0.11],
      ["#d1a34a", 0.1],
    ];
    crates.forEach(([hex, size], i) => {
      const x = -0.84 + i * 0.56,
        z = d / 2 - 0.35;
      k.box("#a8865c", x, top + 0.08, z, 0.48, 0.16, 0.42);
      for (const dy of [0.05, 0.11]) f.box("#7a5d40", x, top + dy, z + 0.212, 0.48, 0.012, 0.006);
      f.box("#94744e", x, top + 0.165, z + 0.205, 0.5, 0.02, 0.02);
      for (let n = 0; n < 6; n++) {
        const fx = x - 0.14 + (n % 3) * 0.14 + range(-0.02, 0.02),
          fy = top + 0.17 + size * 0.6,
          fz = z - 0.08 + Math.floor(n / 3) * 0.16;
        if (i === 1) {
          // Carrots lying along the crate, their leafy tops to the back.
          f.ball(hex, fx, fy, fz + 0.03, size * 0.65, size * 0.6, size * 1.9);
          f.ball("#5f9a45", fx, fy + 0.02, fz - 0.1, 0.035, 0.025, 0.06);
        } else if (i === 2) {
          // Cabbages in their outer leaves.
          f.ball(hex, fx, fy, fz, size, size * 0.9, size);
          f.ball("#9cc47a", fx - 0.04, fy - 0.04, fz + 0.04, 0.085, 0.05, 0.085);
          f.ball("#9cc47a", fx + 0.05, fy - 0.045, fz - 0.03, 0.08, 0.045, 0.08);
        } else {
          f.ball(hex, fx, fy, fz, size, size * 0.9, size);
          if (i === 3) f.cyl("#a07a3a", fx, fy + size * 0.95, fz, 0.012, 0.04);
        }
      }
    });
    k.box("#a8865c", -0.5, 0.2, -0.1, 0.5, 0.4, 0.42);
    // A pumpkin, from three crossed ellipsoids so it has ribs.
    for (let n = 0; n < 3; n++) f.add(f.unit.sphere, "#d1953a", -0.5, 0.5, -0.1, 0.21, 0.15, 0.13, 0, (n * Math.PI) / 3);
    f.cyl("#6f6a3a", -0.5, 0.66, -0.1, 0.02, 0.06);
    k.box("#a8865c", 0.4, 0.2, -0.15, 0.5, 0.4, 0.42, 0.2);
    // Jars of jam with gingham lids, and the marrow, on the back shelf.
    for (let n = 0; n < 4; n++) {
      const x = -0.95 + n * 0.11;
      f.cyl("#9c2f3a", x, 1.245, -d / 2 + 0.22, 0.035, 0.08);
      f.cyl("#f2ead5", x, 1.292, -d / 2 + 0.22, 0.04, 0.016);
    }
    f.add(f.unit.sphere, "#4f7a34", 0.15, 1.315, -d / 2 + 0.2, 0.38, 0.11, 0.12, 0, 0.08);
    f.cyl("#8a8a4a", 0.53, 1.33, -d / 2 + 0.17, 0.02, 0.07, 0, Math.PI / 2);
    // A wicker basket of apples behind.
    f.cyl("#b08a55", 0.95, 0.09, -0.35, 0.16, 0.18);
    f.cyl("#9a7546", 0.95, 0.18, -0.35, 0.17, 0.03);
    for (let n = 0; n < 3; n++) f.ball("#c2382c", 0.95 + Math.cos(n * 2.1) * 0.07, 0.21, -0.35 + Math.sin(n * 2.1) * 0.07, 0.065);
    // A brass hanging scale from the front rail.
    f.rod("#3d3a36", [0.05, 1.92, front], [0.05, 1.62, front], 0.008);
    f.cyl("#c9a34a", 0.05, 1.56, front, 0.07, 0.03, Math.PI / 2);
    f.cyl("#f2ead5", 0.05, 1.56, front + 0.016, 0.056, 0.004, Math.PI / 2);
    for (let n = 0; n < 3; n++) {
      const a = (n * TAU) / 3;
      f.rod("#3d3a36", [0.05, 1.49, front], [0.05 + Math.cos(a) * 0.11, 1.31, front + Math.sin(a) * 0.11], 0.004);
    }
    f.cyl("#c9a34a", 0.05, 1.3, front, 0.13, 0.02);
    // The chalked sign, hung on the front post at the counter's end.
    tipped(T, k, f, [-side, 1.32, front + 0.06], 0, 0, () => slate(f, 0.3, 0.38));
  }
}

// The stalls' name boards: each board's paint is a quarter of one canvas, so
// all four are one mesh and one texture, hidden zoomed far out like the wares.
const BOARD = { w: 1.5, h: 0.29, y: 2.53 };

function stallBoards(T) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const q = canvas.getContext("2d"),
    planes = [];
  M.stalls.forEach((s, row) => {
    const y = row * 128,
      [stripe] = AWNINGS[s.id],
      text = STALL_BOARDS[s.id];
    q.fillStyle = "#e9d9ae";
    q.fillRect(0, y, 512, 128);
    q.strokeStyle = stripe;
    q.lineWidth = 12;
    q.strokeRect(8, y + 8, 496, 112);
    q.fillStyle = "#4d5745";
    q.textAlign = "center";
    q.textBaseline = "middle";
    let size = 62;
    q.font = `bold ${size}px Georgia`;
    while (q.measureText(text).width > 440 && size > 20) q.font = `bold ${(size -= 3)}px Georgia`;
    q.fillText(text, 256, y + 68);
    const plane = new T.PlaneGeometry(BOARD.w, BOARD.h),
      uv = plane.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - (row + 1) / 4 + uv.getY(i) / 4);
    // Painted on both faces: the overview sees the far stalls from behind.
    const rear = plane.clone().rotateY(Math.PI);
    plane.translate(0, BOARD.y, -M.stallSize.d / 2 + 0.05 + 0.012);
    rear.translate(0, BOARD.y, -M.stallSize.d / 2 + 0.05 - 0.032);
    for (const face of [plane, rear]) {
      face.rotateY(s.facing);
      face.translate(s.x, 0, s.z);
      planes.push(face);
    }
  });
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  const mesh = new T.Mesh(mergeGeometries(planes, false), new T.MeshStandardMaterial({ map: texture, roughness: 1 }));
  for (const plane of planes) plane.dispose();
  mesh.name = "Market stall boards";
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  return mesh;
}

// A lamp like the village's: post, glass box, cap and finial.
function lamp(k, x, z) {
  k.cyl("#65513e", x, 1.1, z, 0.075, 2.2);
  k.cyl("#adada0", x, 0.18, z, 0.17, 0.25);
  k.box("#65513e", x, 2.23, z, 0.45, 0.07, 0.43);
  k.glazed(() => k.box("#ffcf73", x, 2.44, z, 0.3, 0.4, 0.3));
  for (const a of [-1, 1])
    for (const b of [-1, 1]) k.box("#65513e", x + a * 0.17, 2.44, z + b * 0.17, 0.035, 0.43, 0.035);
  k.pyramid("#65513e", x, 2.76, z, 0.35, 0.25);
}

// Returns two kits: the stalls, bunting, lamps and shrubs, and the stalls'
// wares and small fittings, which the overview hides zoomed far out.
function stalls(T, range) {
  const k = createKit(T),
    fine = createKit(T);
  for (const s of M.stalls)
    k.placed(s.x, 0, s.z, s.facing, () => fine.placed(s.x, 0, s.z, s.facing, () => stall(T, k, fine, s.id, range)));
  // Bunting: two strings crossing the square from pole to pole, sagging in
  // the middle, with pennants of every awning's colour.
  const pennants = ["#c46a4a", "#e6c35a", "#5f7fa3", "#6f9a5a", "#f2ead5", "#d39a3c"],
    top = 3.2;
  for (const p of M.poles) {
    k.cyl("#65513e", p.x, top / 2, p.z, 0.06, top);
    k.ball("#d8b25a", p.x, top + 0.05, p.z, 0.08);
  }
  const [a, b, c, d] = M.poles;
  for (const [from, to] of [
    [a, d],
    [b, c],
    [a, b],
    [c, d],
  ]) {
    const length = Math.hypot(to.x - from.x, to.z - from.z),
      flags = Math.floor(length / 0.42),
      at = (t) => [
        from.x + (to.x - from.x) * t,
        top - 0.08 - Math.sin(t * Math.PI) * 0.75,
        from.z + (to.z - from.z) * t,
      ],
      heading = Math.atan2(to.x - from.x, to.z - from.z);
    for (let i = 0; i < 12; i++) k.rod("#e8dcbb", at(i / 12), at((i + 1) / 12), 0.01);
    for (let i = 1; i < flags; i++) {
      const [x, y, z] = at(i / flags);
      k.placed(x, y, z, heading, () =>
        k.gable(
          pennants[i % pennants.length],
          -0.01,
          0,
          0,
          [
            [-0.13, 0],
            [0.13, 0],
            [0, -0.28],
          ],
          0.02,
        ),
      );
    }
  }
  for (const l of M.lamps) lamp(k, l.x, l.z);
  // Flowering shrubs by the buildings and the square.
  const leaves = ["#5f8546", "#6b9150", "#577d42"],
    blossoms = ["#e4a3b8", "#f3e3a2", "#b7a6d6", "#f2ead5"];
  M.shrubs.forEach(([x, z], i) => {
    for (let n = 0; n < 4; n++) {
      const a = n * 1.9 + i,
        r = n ? 0.22 : 0;
      k.ball(leaves[(i + n) % 3], x + Math.cos(a) * r, 0.34 + (n ? 0 : 0.12), z + Math.sin(a) * r, 0.36, 0.34, 0.34);
    }
    for (let n = 0; n < 9; n++) {
      const a = n * 2.4 + i * 0.7,
        r = 0.18 + (n % 3) * 0.1;
      k.ball(blossoms[i % blossoms.length], x + Math.cos(a) * r, 0.52 + (n % 2) * 0.14, z + Math.sin(a) * r, 0.05);
    }
  });
  return [k, fine];
}

// --- The lane's end -------------------------------------------------------------

// A fingerpost pointing home and out to the coast, and a farm cart left by
// the lane with sacks and a crate aboard.
function lanesEnd(T) {
  const k = createKit(T),
    s = M.signpost;
  k.box("#6a5442", s.x, 1.15, s.z, 0.12, 2.3, 0.12);
  k.pyramid("#5a4636", s.x, 2.4, s.z, 0.1, 0.16);
  // Boards: west (home) higher, east (the coast) lower, each with a point.
  for (const [dir, y, width] of [
    [-1, 2.02, 0.95],
    [1, 1.66, 1.02],
  ]) {
    const x = s.x + dir * (width / 2 - 0.02);
    k.box("#8a6a4a", x, y, s.z, width, 0.27, 0.07);
    // The point, as a short wedge beyond the board's end.
    k.box("#8a6a4a", x + dir * (width / 2 + 0.07), y, s.z, 0.12, 0.19, 0.07, 0, 0, Math.PI / 4);
  }
  // Hedgerows either side of the lane as it leaves the map, with a few
  // hawthorn flowers.
  const greens = ["#56783f", "#5f8546", "#4f7139", "#678c4b"];
  hedgeClumps().forEach(([x, z], i) => {
    const h = 0.55 + ((i * 7) % 5) * 0.05;
    k.ball(greens[i % greens.length], x, h, z, 0.55, h, 0.5);
    k.ball(greens[(i + 2) % greens.length], x + 0.2, h + 0.25, z + 0.1, 0.34, 0.3, 0.32);
    if (i % 2) k.ball("#f2ead5", x - 0.15, h + 0.42, z + 0.32, 0.05);
  });
  // The cart, its shafts resting on the grass towards the lane.
  const c = M.cart;
  k.placed(c.x, 0, c.z, 0.12, () => {
    k.box("#8a6a4a", 0, 0.72, 0, c.w, 0.08, c.d - 0.4);
    for (const sx of [-1, 1]) k.box("#7f6145", (sx * c.w) / 2, 0.9, 0, 0.06, 0.32, c.d - 0.4);
    k.box("#7f6145", 0, 0.9, (c.d - 0.4) / 2, c.w, 0.32, 0.06);
    k.box("#7f6145", 0, 0.9, -(c.d - 0.4) / 2, c.w, 0.32, 0.06);
    for (const sx of [-1, 1]) {
      const x = (sx * (c.w + 0.12)) / 2;
      k.cyl("#5a4636", x, 0.5, 0.15, 0.48, 0.06, 0, Math.PI / 2);
      k.cyl("#8a6a4a", x, 0.5, 0.15, 0.4, 0.07, 0, Math.PI / 2);
      k.cyl("#5a4636", x, 0.5, 0.15, 0.09, 0.12, 0, Math.PI / 2);
      k.rod("#6a5442", [sx * 0.4, 0.62, -(c.d - 0.4) / 2], [sx * 0.35, 0.08, -(c.d + 0.9) / 2 - 0.4], 0.035);
    }
    k.cyl("#5a4636", 0, 0.5, 0.15, 0.04, c.w + 0.1, 0, Math.PI / 2);
    for (const [x, z] of [
      [-0.35, 0.3],
      [0.3, 0.45],
      [-0.1, -0.3],
    ])
      k.ball("#d9c49a", x, 0.98, z, 0.28, 0.24, 0.24);
    k.box("#a8865c", 0.35, 0.95, -0.4, 0.45, 0.4, 0.45, 0.3);
  });
  return k;
}
