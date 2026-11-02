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
    getGlowMaterials: () => g.glowMaterials.size,
    getStreaming: () => ({
      pending: g.streamer.pending,
      finished: g.streamer.finished,
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
