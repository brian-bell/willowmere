import * as THREE from "three";

// window.__willowmere: the hooks Playwright tests and the benchmark scripts
// drive and read. Normal play never calls them. `tune` applies the
// benchmark's render overrides (see docs/performance.md).

/**
 * `g` gathers what the hooks read, with getters for anything main.js
 * reassigns (the camera, the view mode, the look angles, the bakery).
 * `stopAfterJump(heading)` stops walking after a moveTo, turns first
 * person's look to the heading if one is given, and snaps the overview.
 */
export function createDebugApi(g) {
  // Applies the benchmark overrides, or the defaults for anything not overridden.
  function applyTune() {
    const q = g.quality(),
      { overrides, sun, composer, world } = g;
    const shadowUpdate = overrides.shadowUpdate ?? true;
    if (!shadowUpdate && sun.shadow.autoUpdate) sun.shadow.needsUpdate = true;
    sun.shadow.autoUpdate = shadowUpdate;
    g.bloom.enabled = overrides.bloom ?? q !== "performance";
    const samples = overrides.samples ?? 4;
    for (const target of [composer.renderTarget1, composer.renderTarget2])
      if (target.samples !== samples) {
        target.samples = samples;
        target.dispose();
      }
    const foliage = overrides.foliage ?? true;
    world.trees.setFoliageShown(foliage);
    world.bushes.group.visible = foliage;
    world.showFields(overrides.fields ?? true);
    world.trees.setDetail(g.leafDetail());
    world.bushes.setDetail(g.leafDetail());
    g.showSky();
    // The scaler stands aside while the ratio is forced; clearing it resumes
    // from the quality's cap.
    if (!g.interior?.active) g.scaler.reset(q);
    g.resize();
  }
  return {
    tune(settings) {
      for (const [key, value] of Object.entries(settings))
        if (value == null) delete g.overrides[key];
        else g.overrides[key] = value;
      applyTune();
      return this.getDiagnostics().render;
    },
    getState: () => structuredClone(g.state),
    getPlayer: () => ({ x: g.life.player.position.x, z: g.life.player.position.z }),
    // Places the player (for benchmarks and tests that need a far viewpoint),
    // optionally turned to a heading (radians, 0 faces +z).
    moveTo(x, z, heading) {
      g.life.player.position.set(x, g.world.getGroundHeight(x, z), z);
      if (heading !== undefined) g.life.player.rotation.y = heading;
      g.stopAfterJump(heading);
    },
    getFishing: () => ({ phase: g.fishing.phase, fish: { ...g.state.fish } }),
    getTrees: () =>
      g.world.trees.levels().map((tree) => ({
        ...tree,
        distance: g.firstPersonCamera.position.distanceTo(new THREE.Vector3(...tree.center)),
      })),
    getOrchard: () => ({
      ready: g.activities.orchardReady,
      basket: { ...g.state.basket },
      harvested: { ...g.state.harvested },
      shaken: Object.keys(g.state.orchard),
    }),
    getMarket: () => ({
      residents: g.life.npcs.map((n) => n.id),
      deliveries: structuredClone(g.state.deliveries),
      bought: { ...g.state.bought },
      coins: g.state.coins,
      seeds: g.state.seeds,
      pipHat: g.life.player.parent?.getObjectByName("Pip's straw hat")?.visible ?? false,
      lantern: !!g.scene.getObjectByName("Cottage lantern"),
    }),
    getMarsh: () => ({
      birds: { ...g.state.birds },
      watched: g.state.watched,
      coins: g.state.coins,
      wren: g.life.npcs.some((n) => n.id === "wren"),
      heron: !!g.scene.getObjectByName("Marsh heron"),
    }),
    getWood: () => ({
      pressed: { ...g.state.pressed },
      coins: g.state.coins,
      rowan: g.life.npcs.some((n) => n.id === "rowan"),
    }),
    getAllotments: () => ({
      plots: structuredClone(g.state.plots),
      basket: { ...g.state.basket },
      harvested: { ...g.state.harvested },
      coins: g.state.coins,
      seeds: g.state.seeds,
      basil: g.life.npcs.some((n) => n.id === "basil"),
      // Which beds' crops show, and how many "to let" boards stand.
      crops: Object.fromEntries(
        ["carrots", "lettuces", "runner beans", "pumpkins"].map((many) => {
          const mesh = g.scene.getObjectByName(`Allotment ${many}`);
          return [many, mesh ? mesh.count > 0 : null];
        }),
      ),
      boards: g.scene.getObjectByName("Allotment to-let boards")?.count ?? null,
    }),
    getView: () => ({
      mode: g.firstPerson ? "first-person" : "overview",
      camera: g.camera.type,
      position: g.camera.position.toArray(),
      yaw: g.yaw,
      pitch: g.pitch,
      playerVisible: g.life.player.visible,
      pointerLocked: document.pointerLockElement === g.canvas,
    }),
    getInterior: () => g.interior?.diagnostics() ?? { active: false },
    tuneInterior: (settings) => g.interior?.tune(settings),
    placeInterior: (pose) => g.interior?.place(pose),
    getWater: () => g.world.water.diagnostics(),
    getChunks: () => {
      const animating = new Set(g.world.animatedChunks()),
        sphere = new THREE.Sphere();
      return [...g.world.chunks.values()].map((chunk) => ({
        key: chunk.key,
        bounds: [chunk.bounds.min.toArray(), chunk.bounds.max.toArray()],
        animations: chunk.animations.length,
        animating: animating.has(chunk.key),
        glow: chunk.glow.size,
        meshes: chunk.meshes.map((mesh) => {
          sphere
            .copy(mesh.isInstancedMesh ? mesh.boundingSphere : mesh.geometry.boundingSphere)
            .applyMatrix4(mesh.matrixWorld);
          return {
            name: mesh.name,
            visible: mesh.visible,
            instances: mesh.isInstancedMesh ? mesh.count : 0,
            center: sphere.center.toArray(),
            radius: sphere.radius,
          };
        }),
      }));
    },
    /**
     * One line per object in the scene, in traversal order: its transform,
     * geometry, material and instance data hashed. Refactors that must not
     * change the world compare these before and after.
     */
    getSceneFingerprint: () => {
      const lines = [];
      g.scene.updateMatrixWorld(true);
      g.scene.traverse((o) => lines.push(fingerprint(o)));
      return lines;
    },
    getGlowMaterials: () => g.glowMaterials.size,
    getStreaming: () => ({
      pending: g.streamer.pending,
      finished: g.streamer.finished,
      // Jobs each region's builder queued, by region id, once it has loaded.
      regions: g.streamer.loaded,
    }),
    getDiagnostics: () => {
      const { scene, renderer, world, composer, overrides, camera } = g,
        resolution = g.scaler.state;
      return {
        objects: scene.children.length,
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        colliders: g.colliders.length,
        flowers: g.activities.flowerGroups.size,
        programs: renderer.info.programs.length,
        lanterns: {
          pool: world.lanterns.length,
          lamps: world.lamps.length,
          pointLights: scene.children.filter((o) => o.isPointLight).length,
          lit: world.lanterns.map((light) => light.position.toArray()),
          lampPositions: world.lamps.map((lamp) => lamp.toArray()),
        },
        resolution: {
          adaptive: resolution.adaptive,
          pixelRatio: renderer.getPixelRatio(),
          ceiling: resolution.ceiling,
          floor: resolution.floor,
          p95: resolution.p95,
          mean: resolution.mean,
          upWindows: resolution.upWindows,
          drawingBuffer: [g.canvas.width, g.canvas.height],
        },
        shadow: g.sunShadow.diagnostics(),
        fog: [scene.fog.near, scene.fog.far],
        far: camera.far,
        render: {
          pixelRatio: renderer.getPixelRatio(),
          width: composer.renderTarget1.width,
          height: composer.renderTarget1.height,
          samples: composer.renderTarget1.samples,
          bloom: g.bloom.enabled,
          shadowUpdate: g.sun.shadow.autoUpdate,
          water: overrides.water ?? true,
          foliage: world.bushes.group.visible,
          fields: overrides.fields ?? true,
          sky: g.sky.mesh.visible,
          leafDetail: overrides.leafDetail ?? "auto",
          leaves: world.trees.foliage.reduce((n, mesh) => n + mesh.count, 0),
          overrides: { ...overrides },
        },
        position: g.life.player.position.toArray(),
        camera: g.overview.diagnostics(),
      };
    },
    setAdaptiveResolution: (on) => {
      g.scaler.state.adaptive = on;
      g.scaler.reset(g.quality());
      g.resize();
    },
    blocked: g.blocked,
    findPath: g.findPath,
    // The pixel where a click lands on (x, z): clicks meet bridge decks and water.
    project: (x, z) => {
      const y = g.world.surfaceHeight(x, z),
        v = new THREE.Vector3(x, y, z).project(g.camera);
      return {
        x: (v.x * 0.5 + 0.5) * innerWidth,
        y: (-v.y * 0.5 + 0.5) * innerHeight,
      };
    },
  };
}

// FNV-1a over the bytes of typed arrays (or plain number lists).
function hash(...arrays) {
  let h = 0x811c9dc5;
  for (const a of arrays) {
    if (!a) {
      h = Math.imul(h ^ 0xff, 0x01000193);
      continue;
    }
    const bytes = ArrayBuffer.isView(a)
      ? new Uint8Array(a.buffer, a.byteOffset, a.byteLength)
      : new Uint8Array(Float64Array.from(a).buffer);
    for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i], 0x01000193);
  }
  return (h >>> 0).toString(16);
}

function geometryPrint(geometry) {
  if (!geometry) return "-";
  const names = Object.keys(geometry.attributes).sort();
  return [
    names.map((name) => `${name}=${hash(geometry.attributes[name].array)}`).join(","),
    hash(geometry.index?.array),
    geometry.drawRange.start,
    geometry.drawRange.count,
    geometry.groups.length,
  ].join(":");
}

function materialPrint(material) {
  if (!material) return "-";
  if (Array.isArray(material)) return material.map(materialPrint).join("+");
  return [
    material.id,
    material.type,
    material.name,
    material.color?.getHexString(),
    material.emissive?.getHexString(),
    material.emissiveIntensity,
    material.roughness,
    material.metalness,
    material.opacity,
    material.transparent,
    material.vertexColors,
    material.side,
    material.depthWrite,
    material.map?.id,
    material.customProgramCacheKey?.(),
  ].join(":");
}

function fingerprint(o) {
  const instances = o.isInstancedMesh
    ? hash(
        o.instanceMatrix.array.subarray(0, o.count * 16),
        o.instanceColor?.array.subarray(0, o.count * 3),
      )
    : "-";
  return [
    o.id,
    o.type,
    o.name,
    o.visible,
    o.castShadow,
    o.receiveShadow,
    o.frustumCulled,
    o.renderOrder,
    o.matrixAutoUpdate,
    o.children.length,
    hash(o.matrixWorld.elements),
    geometryPrint(o.geometry),
    materialPrint(o.material),
    o.isInstancedMesh ? o.count : "",
    instances,
  ].join("|");
}
