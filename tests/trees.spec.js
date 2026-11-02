import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { createPlayerVisibility } from "../src/visibility.js";

test("tree variants have finite, bounded geometry and stable wind shadows", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await page.waitForFunction(() => window.__willowmere);
  const result = await page.evaluate(async () => {
    const { createTrees } = await import("/src/trees.js");
    const variants = [
      [0, 0, 1],
      [-20, -14, 1.3],
      [8, 16, 1.5],
    ];
    let finite = true,
      bounded = true,
      triangles = 0,
      sharedWind = true;
    const snapshots = [];
    for (const placement of variants) {
      const trees = createTrees([placement]);
      if (trees.group.children.length > 4)
        throw Error("Unbatched tree geometry");
      const leaves = trees.group.getObjectByName("Living folded leaves");
      const matrix = trees.group.matrix.clone();
      const point = trees.group.position.clone();
      for (const mesh of trees.group.children) {
        for (const attribute of Object.values(mesh.geometry.attributes)) {
          finite &&= attribute.array.every(Number.isFinite);
        }
        triangles +=
          ((mesh.geometry.index?.count ??
            mesh.geometry.attributes.position.count) /
            3) *
          (mesh.isInstancedMesh ? mesh.count : 1);
        if (mesh.isInstancedMesh)
          finite &&= mesh.instanceMatrix.array.every(Number.isFinite);
      }
      // The player-visibility volume must cover the actual folded blades,
      // including the drooping willow tips. Low ferns are not occluders.
      for (let i = 0; i < leaves.count; i++) {
        leaves.getMatrixAt(i, matrix);
        if (matrix.elements[13] < 0.8 * placement[2]) continue;
        for (let v = 0; v < leaves.geometry.attributes.position.count; v++) {
          point
            .fromBufferAttribute(leaves.geometry.attributes.position, v)
            .applyMatrix4(matrix);
          bounded &&= trees.canopyBounds[0].containsPoint(point);
        }
      }
      const visibleShader = {
        uniforms: {},
        vertexShader: "#include <begin_vertex>",
      };
      const shadowShader = {
        uniforms: {},
        vertexShader: "#include <begin_vertex>",
      };
      leaves.material.onBeforeCompile(visibleShader);
      leaves.customDepthMaterial.onBeforeCompile(shadowShader);
      trees.update(8.5);
      sharedWind &&=
        visibleShader.uniforms.uTreeTime === shadowShader.uniforms.uTreeTime &&
        shadowShader.uniforms.uTreeTime.value === 8.5;
      trees.update(0);
      sharedWind &&= visibleShader.uniforms.uTreeTime.value === 0;
      snapshots.push(Array.from(leaves.instanceMatrix.array));
    }
    const repeat = createTrees([variants[0]]).group.getObjectByName(
      "Living folded leaves",
    );
    const deterministic = repeat.instanceMatrix.array.every(
      (v, i) => v === snapshots[0][i],
    );
    return { finite, bounded, triangles, sharedWind, deterministic };
  });
  expect(result.finite).toBe(true);
  expect(result.bounded).toBe(true);
  expect(result.sharedWind).toBe(true);
  expect(result.deterministic).toBe(true);
  // Three fully detailed specimens, with roots and ground dressing, stay
  // within a practical geometry budget before the shadow pass.
  expect(result.triangles).toBeLessThan(100000);
  expect(errors).toEqual([]);
});

test("canopy bounds keep the traveler visible behind small trees", { tag: "@logic" }, () => {
  const scene = new THREE.Scene();
  const player = new THREE.Group();
  player.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 1, 0.3),
      new THREE.MeshStandardMaterial(),
    ),
  );
  player.position.set(0, 0, -2);
  scene.add(player);
  const canopy = new THREE.Box3(
    new THREE.Vector3(-0.8, 1, -0.3),
    new THREE.Vector3(0.8, 4, 0.3),
  );
  const visibility = createPlayerVisibility(
    scene,
    player,
    [{ x: 0, z: 0, r: 0.297 }],
    [canopy],
  );
  const ghost = scene.children.find((child) => child !== player);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 5, 10);
  visibility.update(camera);
  expect(ghost.visible).toBe(true);
  visibility.update(camera, false);
  expect(ghost.visible).toBe(false);
  camera.position.set(8, 5, 10);
  visibility.update(camera);
  expect(ghost.visible).toBe(false);
});

test("distant trees can be culled independently while sharing materials", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__willowmere);
  const result = await page.evaluate(async () => {
    const T = await import("/node_modules/three/build/three.module.js");
    const { createTrees } = await import("/src/trees.js");
    const trees = createTrees([
      [0, 0, 1],
      [40, 0, 1],
    ]);
    trees.group.updateMatrixWorld(true);
    const camera = new T.OrthographicCamera(-6, 6, 6, -6, 0.1, 100);
    camera.position.set(0, 6, 12);
    camera.lookAt(0, 2, 0);
    camera.updateMatrixWorld();
    const frustum = new T.Frustum().setFromProjectionMatrix(
      new T.Matrix4().multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      ),
    );
    const visible = trees.group.children.filter((mesh) =>
      frustum.intersectsObject(mesh),
    );
    const leaves = trees.group.children.filter(
      (mesh) => mesh.name === "Living folded leaves",
    );
    return {
      batches: trees.group.children.length,
      visible: visible.length,
      sharedLeaves: leaves[0].material === leaves[1].material,
      sharedShadows:
        leaves[0].customDepthMaterial === leaves[1].customDepthMaterial,
    };
  });
  expect(result.batches).toBe(8);
  expect(result.visible).toBe(4);
  expect(result.sharedLeaves && result.sharedShadows).toBe(true);
});

test("distant canopies draw every other leaf as a coarser blade", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__willowmere);
  const result = await page.evaluate(async () => {
    const T = await import("/node_modules/three/build/three.module.js");
    const { createTrees } = await import("/src/trees.js");
    const trees = createTrees([
      [0, 0, 1],
      [40, 0, 1],
    ]);
    const [near, far] = trees.foliage;
    const full = near.count,
      blade = near.geometry,
      bounds = trees.canopyBounds.map((box) => box.clone());
    const triangles = (mesh) => (mesh.geometry.index.count / 3) * mesh.count;
    const detailed = triangles(near);
    trees.setDetail((center) => (center.x > 20 ? 1 : 0));
    const mixed = {
      near: near.count === full && near.geometry === blade,
      far: far.count === Math.ceil(far.instanceMatrix.count / 2),
    };
    trees.setDetail(1);
    const coarse = triangles(near);
    // The coarse blades stay within the culling sphere (wind sway included).
    const sphere = near.boundingSphere,
      matrix = new T.Matrix4(),
      point = new T.Vector3();
    let enclosed = true;
    for (let i = 0; i < near.count; i++) {
      near.getMatrixAt(i, matrix);
      const p = near.geometry.attributes.position;
      for (let v = 0; v < p.count; v++)
        enclosed &&= sphere.containsPoint(
          point.fromBufferAttribute(p, v).applyMatrix4(matrix),
        );
    }
    trees.setDetail(0);
    return {
      mixed,
      ratio: coarse / detailed,
      enclosed,
      restored: near.count === full && near.geometry === blade,
      boundsKept: trees.canopyBounds.every((box, i) => box.equals(bounds[i])),
      shared: near.material === far.material,
    };
  });
  expect(result.mixed).toEqual({ near: true, far: true });
  expect(result.ratio).toBeLessThan(0.3);
  expect(result.enclosed).toBe(true);
  expect(result.restored && result.boundsKept && result.shared).toBe(true);
});
