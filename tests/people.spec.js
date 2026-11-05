import { test, expect } from "@playwright/test";
import * as T from "three";
import { ALLOTMENT_RESIDENTS } from "../src/content/allotments.js";
import { MARKET_RESIDENTS } from "../src/content/market.js";
import { MARSH_RESIDENTS } from "../src/content/marsh.js";
import { HERON_KEEPER } from "../src/content/pub.js";
import { WOOD_RESIDENTS } from "../src/content/wood.js";
import { createLife } from "../src/life.js";

function everyone() {
  const scene = new T.Scene(),
    life = createLife(T, scene);
  for (const def of [
    ...MARKET_RESIDENTS,
    ...WOOD_RESIDENTS,
    ...MARSH_RESIDENTS,
    ...ALLOTMENT_RESIDENTS,
    { ...HERON_KEEPER, x: 0, z: 0 },
  ])
    life.addResident(def);
  scene.updateMatrixWorld(true);
  // Lily walks, so she keeps her joints; the rest stand.
  return { scene, life, standing: life.npcs.filter((npc) => npc.id !== "lily") };
}

const isContactShadow = (mesh) => mesh.geometry.type === "CircleGeometry";

function drawn(group) {
  const meshes = [];
  group.traverseVisible((object) => {
    if (object.isMesh) meshes.push(object);
  });
  return meshes;
}
const triangles = (meshes) =>
  meshes.reduce((sum, mesh) => sum + mesh.geometry.index.count / 3, 0);

/** The vertical extent of what a figure draws, without its contact shadow. */
function extent(meshes) {
  const box = new T.Box3();
  for (const mesh of meshes)
    if (!isContactShadow(mesh)) box.expandByObject(mesh, true);
  return box;
}

test("a resident who streams in batches as tightly as one who lives in the village", { tag: "@logic" }, () => {
  const { standing } = everyone();
  expect(standing).toHaveLength(9);
  for (const npc of standing) {
    const meshes = drawn(npc.group);
    // Its contact shadow, body, head, eyes and two arms.
    expect(meshes.length, npc.id).toBeLessThanOrEqual(6);
    expect(triangles(meshes), npc.id).toBeLessThan(10500);
  }
});

test("everyone stands on the ground, and the traveler's feet stay there mid-stride", { tag: "@logic" }, () => {
  const { scene, life, standing } = everyone();
  for (const npc of standing) {
    const { min } = extent(drawn(npc.group));
    expect(Math.abs(min.y - npc.group.position.y), npc.id).toBeLessThan(0.02);
  }
  life.setPlayerMotion(3, 0);
  for (let i = 0; i < 60; i++) life.update(1 / 60, 0, true);
  const lowest = [];
  for (let i = 0; i < 60; i++) {
    life.update(1 / 60, 0, true);
    scene.updateMatrixWorld(true);
    lowest.push(extent(drawn(life.player)).min.y);
  }
  // Neither walking on air nor wading through the path.
  expect(Math.max(...lowest)).toBeLessThan(0.05);
  expect(Math.min(...lowest)).toBeGreaterThan(-0.025);
});

test("zoomed far out, each resident draws one coarse copy that keeps their shape", { tag: "@logic" }, () => {
  const { scene, life, standing } = everyone();
  const near = new Map(
    standing.map((npc) => {
      const meshes = drawn(npc.group);
      return [npc, { count: meshes.length, triangles: triangles(meshes), box: extent(meshes) }];
    }),
  );
  life.setCastShadows(false);
  scene.updateMatrixWorld(true);
  for (const npc of standing) {
    const meshes = drawn(npc.group),
      detailed = near.get(npc),
      box = extent(meshes);
    expect(meshes, npc.id).toHaveLength(2);
    expect(meshes.filter(isContactShadow), npc.id).toHaveLength(1);
    expect(meshes.some((mesh) => mesh.castShadow), npc.id).toBe(false);
    expect(triangles(meshes), npc.id).toBeLessThan(detailed.triangles * 0.42);
    // The same height from the same feet, wherever the copy was cut from.
    expect(Math.abs(box.max.y - detailed.box.max.y), npc.id).toBeLessThan(0.05);
    expect(Math.abs(box.min.y - detailed.box.min.y), npc.id).toBeLessThan(0.05);
  }
  life.setCastShadows(true);
  for (const npc of standing) {
    expect(drawn(npc.group).length, npc.id).toBe(near.get(npc).count);
  }
});
