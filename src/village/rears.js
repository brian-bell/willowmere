// The backs of the village's houses, which used to be bare plaster with the
// roof's gable left open: a closed rear gable with its timbers and a small
// window, gutters and a downpipe into a water butt, and for each house a back
// door, windows and what its trade leaves out the back. The big parts bake
// with the village; the small ones (climbing roses, beds, knobs, logs, sacks)
// go into one fine mesh per house that hides zoomed far out (fine.js).
// Nothing here draws from the village's random stream, so it moves nothing
// else. Rosewood's back is its kitchen extension (rosewood-yard.js), so it
// gains only the gable and gutters here.

import { HOUSES } from "./buildings.js";
import { createFine } from "./fine.js";

const house = (id) => HOUSES.find((h) => h.id === id);

// Where a house's back door and windows are, along its rear wall from its
// centre; which side of the door its lantern hangs; and the side its downpipe
// comes down (-1 west, 1 east).
const BACKS = {
  home: { pipe: 1 },
  bakery: { door: -1.3, lantern: -0.72, windows: [0.15], pipe: -1 },
  mill: { door: 0.95, lantern: -0.72, windows: [-0.75], pipe: 1 },
  thistledown: { door: 0.8, lantern: -0.72, windows: [-0.85], pipe: -1 },
};

// Ground the meadow's grass leaves bare behind the houses: the back steps
// and the log store, where blades would poke through.
export const REAR_CLEARINGS = Object.entries(BACKS).flatMap(([id, back]) => {
  const { x, z, d } = house(id),
    rear = z - d / 2,
    out = [];
  if (back.door != null) out.push({ minX: x + back.door - 0.75, maxX: x + back.door + 0.75, minZ: rear - 0.9, maxZ: rear });
  if (id === "bakery") out.push({ minX: x + 1.0, maxX: x + 2.3, minZ: rear - 0.75, maxZ: rear });
  return out;
});

/** Whether the village's meadow grass may grow at (x, z). */
export const rearsAllowGrass = (x, z) =>
  !REAR_CLEARINGS.some((c) => x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ);

/** Builds every house's back; returns the fine meshes for world.js to register. */
export function buildRears(kit, { contact }) {
  const { T, scene, box, cyl, beam, mesh, mat, colliders, ivory, stone, darkStone, wood, darkWood, trim, glass, roofBlue, roofRust } = kit;
  const metal = mat("#5f6b68", 0.6),
    butt = mat("#56705f"),
    shutterGreen = mat("#5e7d66"),
    shutterBlue = mat("#6f8fa3");
  const fines = [];

  // A window in a wall facing -z at local (x, y, z), with shutters and a sill.
  function backWindow(p, x, y, z, w, h, shutter) {
    box(darkWood, x, y, z, w + 0.17, h + 0.17, 0.1, p);
    box(glass, x, y, z - 0.06, w, h, 0.03, p);
    box(trim, x, y, z - 0.085, 0.06, h, 0.05, p);
    box(trim, x, y + h * 0.1, z - 0.085, w, 0.06, 0.05, p);
    box(trim, x, y - h / 2 - 0.09, z - 0.13, w + 0.3, 0.09, 0.3, p);
    if (!shutter) return;
    for (const side of [-1, 1]) {
      const sx = x + side * (w / 2 + 0.22);
      box(shutter, sx, y, z - 0.02, 0.32, h + 0.12, 0.06, p);
      for (const yy of [-0.32, 0.32]) box(darkWood, sx, y + yy * h, z - 0.06, 0.28, 0.05, 0.02, p);
      beam(darkWood, [sx - 0.12, y - 0.3 * h, z - 0.06], [sx + 0.12, y + 0.3 * h, z - 0.06], 0.035, p);
    }
  }
  // A ledged plank back door with a stone step and a little pent hood.
  function backDoor(p, x, z, lantern, hood, fine) {
    box(darkWood, x, 1.25, z, 0.97, 1.8, 0.1, p);
    box(wood, x, 1.22, z - 0.07, 0.79, 1.64, 0.06, p);
    for (let xx = -0.3; xx <= 0.31; xx += 0.15) box(darkWood, x + xx, 1.22, z - 0.105, 0.012, 1.6, 0.012, p);
    for (const yy of [0.62, 1.82]) box(darkWood, x, yy, z - 0.11, 0.74, 0.1, 0.03, p);
    beam(darkWood, [x - 0.3, 0.68, z - 0.115], [x + 0.3, 1.76, z - 0.115], 0.07, p);
    box(stone, x, 0.14, z - 0.32, 1.25, 0.24, 0.6, p);
    box(stone, x, 0.07, z - 0.7, 1.1, 0.12, 0.3, p);
    const slab = box(hood, x, 2.42, z - 0.32, 1.3, 0.08, 0.72, p);
    slab.rotation.x = -0.38;
    for (const side of [-1, 1]) beam(darkWood, [x + side * 0.55, 2.0, z - 0.03], [x + side * 0.55, 2.3, z - 0.55], 0.06, p);
    // A wall lantern beside the door, its glass lit at blue hour.
    const lx = x + lantern;
    box(darkWood, lx, 2.02, z - 0.08, 0.05, 0.05, 0.18, p);
    box(darkWood, lx, 1.88, z - 0.2, 0.17, 0.03, 0.17, p);
    box(glass, lx, 1.78, z - 0.2, 0.12, 0.17, 0.12, p);
    box(darkWood, lx, 1.68, z - 0.2, 0.17, 0.03, 0.17, p);
    fine.k.ball("#c9a65a", x + 0.28, 1.15, z - 0.13, 0.035);
    fine.k.box("#3a3430", x + 0.28, 1.36, z - 0.115, 0.05, 0.12, 0.02);
    // A boot scraper and a doormat.
    fine.k.box("#3a3430", x - 0.56, 0.32, z - 0.5, 0.22, 0.02, 0.03);
    fine.k.box("#9a7b4f", x, 0.27, z - 0.38, 0.62, 0.015, 0.34);
  }
  // A water butt under the downpipe.
  function waterButt(p, x, z) {
    cyl(butt, x, 0.45, z, 0.27, 0.8, p);
    for (const y of [0.16, 0.72]) cyl(darkStone, x, y, z, 0.285, 0.04, p);
    cyl(darkWood, x, 0.87, z, 0.29, 0.04, p);
  }

  for (const { id, x, z, w, d, h, roof } of HOUSES) {
    const back = BACKS[id],
      rz = -d / 2,
      tiles = roof === "blue" ? roofBlue : roofRust,
      fine = createFine(T, 3100 + HOUSES.findIndex((hs) => hs.id === id) * 97);
    const p = new T.Group();
    p.position.set(x, 0, z);
    scene.add(p);
    // The rear gable, closed like the front, with its timbers.
    const shape = new T.Shape();
    shape.moveTo(-w / 2, 0);
    shape.lineTo(0, h * 0.69);
    shape.lineTo(w / 2, 0);
    shape.closePath();
    mesh(new T.ExtrudeGeometry(shape, { depth: 0.055, bevelEnabled: false }), ivory, 0, h + 0.4, rz - 0.07, 1, 1, 1, p);
    for (const side of [-1, 1])
      beam(darkWood, [side * (w / 2 + 0.12), h + 0.42, rz - 0.11], [0, h * 1.69 + 0.45, rz - 0.11], 0.15, p);
    box(darkWood, 0, h + 0.42, rz - 0.05, w + 0.3, 0.18, 0.19, p);
    backWindow(p, 0, h + 1.12, rz - 0.04, 0.46, 0.46, null);
    // Corner posts and the sill rail, as at the front.
    for (const xx of [-w / 2 + 0.07, w / 2 - 0.07]) box(darkWood, xx, h / 2 + 0.4, rz - 0.035, 0.15, h, 0.15, p);
    box(darkWood, 0, 0.62, rz - 0.04, w, 0.16, 0.13, p);
    // Gutters under both eaves, and a downpipe at one back corner into a butt.
    for (const side of [-1, 1]) {
      box(metal, side * (w / 2 + 0.43), h + 0.29, 0, 0.1, 0.08, d + 0.8, p);
      box(metal, side * (w / 2 + 0.43), h + 0.29, rz - 0.4, 0.13, 0.11, 0.04, p);
    }
    const ps = back.pipe,
      px = ps * (w / 2 + 0.09),
      pz = rz - 0.12;
    beam(metal, [ps * (w / 2 + 0.43), h + 0.27, rz - 0.3], [px, h - 0.05, pz], 0.07, p);
    cyl(metal, px, (h + 1.0) / 2, pz, 0.04, h - 1.0, p);
    for (let y = 1.2; y < h - 0.2; y += 0.9) box(metal, px, y, pz + 0.05, 0.1, 0.04, 0.08, p);
    const bx = ps * (w / 2 + 0.05),
      bz = rz - 0.42;
    beam(metal, [px, 0.55 + 0.47, pz], [bx, 0.95, bz + 0.06], 0.07, p);
    waterButt(p, bx, bz);
    colliders.push({ x: x + bx, z: z + bz, r: 0.3 });
    // The back door, windows and, Rosewood aside, what each household keeps out the back.
    const shutter = id === "mill" || id === "thistledown" ? shutterBlue : shutterGreen;
    for (const wx of back.windows ?? []) backWindow(p, wx, 1.75, rz - 0.04, 0.72, 0.95, shutter);
    fine.at(x, z, 0, () => {
      if (back.door != null) backDoor(p, back.door, rz - 0.04, back.lantern, tiles, fine);
      if (id === "bakery") bakeryBack(p, fine, x, z, w, rz);
      if (id === "mill") millBack(fine, w, rz);
      if (id === "thistledown") thistledownBack(fine, w, rz);
    });
    if (id === "bakery") {
      colliders.push({ x: x + 1.65, z: z + rz - 0.33, w: 1.25, d: 0.62 });
      contact(x + 1.65, z + rz - 0.33, 1.6, 1);
    }
    if (id === "mill") colliders.push({ x: x - 1.6, z: z + rz - 0.25, w: 1.2, d: 0.45 }, { x, z: z + rz - 0.45, r: 0.45 });
    if (id === "thistledown") colliders.push({ x: x - 0.85, z: z + rz - 0.3, w: 1.5, d: 0.46 }, { x: x + 1.68, z: z + rz - 0.44, r: 0.35 });
    const detail = fine.finish(`Village house back detail (${id})`, scene);
    if (detail) fines.push(detail);
  }

  // The bakery: a covered store of oven logs and flour sacks by the door; on
  // its west side, the wall Rosewood looks at, a window with a box of herbs
  // and a climbing rose.
  function bakeryBack(p, fine, x, z, w, rz) {
    const { k, plant, planters } = fine,
      lx = 1.65,
      lz = rz - 0.33;
    for (const xx of [-0.58, 0.58])
      for (const zz of [-0.28, 0.28]) box(darkWood, lx + xx, zz < 0 ? 0.65 : 0.72, lz + zz, 0.08, zz < 0 ? 1.3 : 1.44, 0.08, p);
    const lid = box(roofRust, lx, 1.42, lz, 1.4, 0.07, 0.86, p);
    lid.rotation.x = -0.22;
    box(darkWood, lx, 0.06, lz, 1.2, 0.08, 0.6, p);
    for (let row = 0; row < 4; row++)
      for (let i = 0; i < 6 - (row % 2); i++) {
        const xx = lx - 0.5 + (i + (row % 2) * 0.5) * 0.2;
        k.cyl(i % 3 ? "#8a6a4a" : "#7a5c3f", xx, 0.2 + row * 0.19, lz, 0.09, 0.56, Math.PI / 2);
        for (const end of [-0.285, 0.285]) k.cyl("#cfae7c", xx, 0.2 + row * 0.19, lz + end, 0.075, 0.01, Math.PI / 2);
      }
    // Flour sacks slumped by the door.
    for (const [sx, sz, s] of [
      [-0.42, -0.4, 1],
      [-0.2, -0.72, 0.9],
      [-0.5, -0.78, 0.85],
    ]) {
      k.ball("#ddd0ad", sx, 0.3 * s, rz + sz, 0.22 * s, 0.3 * s, 0.2 * s);
      k.box("#b9a57d", sx, 0.6 * s, rz + sz, 0.08, 0.06, 0.08);
    }
    colliders.push({ x: x - 0.37, z: z + rz - 0.6, r: 0.38 });
    // The west wall: a window, a box of herbs beneath it and a rose by the back corner.
    const west = new T.Group();
    west.position.set(-w / 2 - 0.0, 0, -0.3);
    west.rotation.y = Math.PI / 2;
    p.add(west);
    backWindow(west, 0, 1.8, -0.04, 0.8, 1, shutterGreen);
    box(wood, 0, 1.02, -0.28, 0.95, 0.2, 0.28, west);
    // The herbs grow in the house frame: the box runs along the west wall.
    for (let j = 0; j < 4; j++) {
      const zz = -0.3 - 0.36 + j * 0.24;
      plant(j % 2 ? "lavender" : "daisies", j % 2 ? "lavender" : "white", -w / 2 - 0.28, 1.1, zz, 0.12);
    }
    for (let j = 0; j < 3; j++) planters.trail(-w / 2 - 0.42, 1.12, -0.6 + j * 0.3, 0.3, planters.foliage.ivy, -1, 0);
    fine.at(-w / 2, -1.45, Math.PI / 2, () => fine.climber(0, -0.03, 0.42, 2.3, "blush"));
  }
  // The mill: sacks of grain on a pallet, a worn millstone propped against
  // the wall, and a rose by the door.
  function millBack(fine, w, rz) {
    const { k } = fine;
    k.box("#7a5c3f", 0, 0.06, rz - 0.45, 0.8, 0.1, 0.7);
    for (const [sx, sz, sy, s] of [
      [-0.18, -0.3, 0.38, 1],
      [0.2, -0.32, 0.38, 1],
      [0.0, -0.62, 0.36, 0.95],
      [0.02, -0.42, 0.78, 0.9],
    ]) {
      k.ball("#d8c9a0", sx, sy * s, rz + sz, 0.24 * s, 0.26 * s, 0.2 * s);
      k.box("#a08a62", sx, sy * s + 0.25 * s, rz + sz, 0.07, 0.06, 0.07);
    }
    // The millstone: a thick stone disc with an eye, leaning on the wall.
    k.cyl("#9a958a", -1.6, 0.62, rz - 0.22, 0.6, 0.18, -0.22 + Math.PI / 2);
    k.cyl("#5a564f", -1.6, 0.62, rz - 0.32, 0.12, 0.05, -0.22 + Math.PI / 2);
    fine.climber(1.85, rz - 0.03, 0.4, 2.2, "lilac");
  }
  // Thistledown, the B&B: a kitchen herb bed under the window, milk churns by
  // the door and a rose up the corner.
  function thistledownBack(fine, w, rz) {
    const { k, plant, planters } = fine;
    planters.bed(-0.85, rz - 0.3, 1.5, 0.46);
    for (let i = 0; i < 5; i++)
      plant(["lavender", "daisies", "geranium", "daisies", "lavender"][i], ["lavender", "white", "rose", "butter", "lilac"][i], -1.45 + i * 0.3, 0.12, rz - 0.3, 0.17);
    for (const [cx, cz] of [
      [1.55, -0.38],
      [1.82, -0.5],
    ]) {
      k.cyl("#b9bdb5", cx, 0.3, rz + cz, 0.15, 0.5);
      k.cyl("#b9bdb5", cx, 0.62, rz + cz, 0.08, 0.16);
      k.cyl("#9da19a", cx, 0.72, rz + cz, 0.1, 0.04);
      k.cyl("#8b8f88", cx, 0.42, rz + cz, 0.155, 0.03);
    }
    fine.climber(w / 2 - 0.3, rz - 0.03, 0.4, 2.0, "coral");
  }
  return fines;
}
