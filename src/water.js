import * as T from "three";
import {
  simulationVertex,
  simulationFragment,
  waterVertex,
  waterFragment,
} from "./water-shaders.js";

const QUALITY = {
  high: {
    river: [64, 640],
    basin: 96,
    reflection: 768,
    refraction: 1,
    interval: 1 / 24,
  },
  balanced: {
    river: [48, 480],
    basin: 64,
    reflection: 512,
    refraction: 0.75,
    interval: 1 / 15,
  },
  performance: {
    river: [24, 240],
    basin: 32,
    reflection: 256,
    refraction: 0.5,
    interval: 1 / 8,
  },
};
const GRAVITY = 9.81;

// Resting bathymetry and a prescribed channel current. The GPU evolves perturbations
// on this steady flow; this is a shallow-water model, not a volumetric Navier–Stokes solve.
export function sampleWaterField(config, x, z) {
  const { size, radius, depth, flow = 0, obstacles = [] } = config;
  let shore;
  if (radius) shore = radius - Math.hypot(x, z);
  else {
    const bank = 0.045 * Math.sin(z * 1.7) + 0.025 * Math.sin(z * 4.1 + 0.7);
    shore = size[0] * 0.5 - Math.abs(x) - bank;
  }
  if (config.hole) shore = Math.min(shore, Math.hypot(x, z) - config.hole);
  for (const rock of obstacles)
    shore = Math.min(shore, Math.hypot(x - rock.x, z - rock.z) - rock.radius);
  if (shore <= 0) return [0, 0, 0, 0];
  const depthAt =
    depth * Math.min(1, Math.max(0.025, shore / (radius ? 0.16 : 0.72)));
  let vx = 0,
    vz = flow * (0.28 + 0.72 * Math.min(1, shore / 0.8));
  // Potential-flow deflection around stones; wake eddies add local circulation.
  for (const rock of obstacles) {
    const dx = x - rock.x,
      dz = z - rock.z;
    const r2 = Math.max(dx * dx + dz * dz, rock.radius * rock.radius);
    const strength = (flow * rock.radius * rock.radius) / (r2 * r2);
    vx -= strength * 2 * dx * dz;
    vz += strength * (dx * dx - dz * dz);
    const wakeZ = dz - rock.radius * 3.5;
    const eddy = Math.exp(-(dx * dx * 3 + wakeZ * wakeZ) / 0.3) * flow * 0.7;
    vx -= wakeZ * eddy;
    vz += dx * eddy;
  }
  return [depthAt, vx, vz, 1];
}

export function waterTimeStep(size, resolution, depth) {
  const dx = size[0] / resolution[0],
    dz = size[1] / resolution[1];
  // Two-dimensional gravity-wave CFL bound, with headroom for imposed advection.
  return Math.min(
    1 / 60,
    0.5 / Math.sqrt(GRAVITY * depth * (1 / dx ** 2 + 1 / dz ** 2)),
  );
}

function surfaceGeometry(config) {
  const geometry = config.radius
    ? new T.RingGeometry(config.hole || 0.0001, config.radius, 96, 28).rotateX(
        -Math.PI / 2,
      )
    : new T.PlaneGeometry(...config.size, 48, 384).rotateX(-Math.PI / 2);
  const p = geometry.attributes.position,
    uv = geometry.attributes.uv;
  for (let i = 0; i < p.count; i++)
    uv.setXY(
      i,
      p.getX(i) / config.size[0] + 0.5,
      p.getZ(i) / config.size[1] + 0.5,
    );
  geometry.computeBoundingBox();
  geometry.boundingBox.min.y = -0.2;
  geometry.boundingBox.max.y = 0.2;
  geometry.computeBoundingSphere();
  geometry.boundingSphere.radius += 0.2;
  return geometry;
}

export function createWaterSystem(scene, { quality = "high" } = {}) {
  const group = new T.Group();
  group.name = "Willowmere water · shared fluid model";
  group.userData.dynamic = true;
  scene.add(group);
  const bodies = [];
  // Dense scenery that the captures barely resolve, such as individual leaves.
  const captureExcluded = new Set();
  const zero = new T.DataTexture(new Uint8Array(4), 1, 1);
  zero.needsUpdate = true;
  const sceneTarget = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType });
  sceneTarget.depthTexture = new T.DepthTexture(1, 1, T.UnsignedIntType);
  const simScene = new T.Scene(),
    simCamera = new T.Camera();
  const simMaterial = new T.ShaderMaterial({
    name: "Shallow water · staggered velocity / continuity",
    vertexShader: simulationVertex,
    fragmentShader: simulationFragment,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uState: { value: zero },
      uField: { value: zero },
      uTexel: { value: new T.Vector2() },
      uSize: { value: new T.Vector2() },
      uDt: { value: 0 },
      uTime: { value: 0 },
      uPass: { value: 0 },
      uOpenEnds: { value: 0 },
      uImpulses: { value: Array.from({ length: 8 }, () => new T.Vector4()) },
    },
  });
  const quad = new T.Mesh(new T.PlaneGeometry(2, 2), simMaterial);
  quad.frustumCulled = false;
  simScene.add(quad);
  const frustum = new T.Frustum(),
    projectionView = new T.Matrix4();
  const clipPlane = new T.Plane(new T.Vector3(0, 1, 0), 0);
  const savedViewport = new T.Vector4(),
    savedScissor = new T.Vector4();
  const savedClear = new T.Color(),
    viewDirection = new T.Vector3(),
    drawingBufferSize = new T.Vector2();
  const reflectionLook = new T.Vector3(),
    cameraDirection = new T.Vector3(),
    reflectionCorner = new T.Vector3(),
    reflectionCrop = new T.Matrix4();
  let time = 0,
    pendingDt = 0,
    renderFrame = 0,
    initialized = false,
    gpuSimulation = true;
  let disposed = false,
    lastCaptureCount = 0,
    totalSteps = 0,
    wallTime = 0;
  let settings = QUALITY[quality] || QUALITY.high;

  function allocate(body) {
    body.field?.dispose();
    for (const target of body.states || []) target.dispose();
    const resolution = body.config.radius
      ? [settings.basin, settings.basin]
      : settings.river;
    body.resolution = [...resolution];
    const [width, height] = resolution,
      data = new Float32Array(width * height * 4);
    for (let z = 0; z < height; z++)
      for (let x = 0; x < width; x++) {
        const f = sampleWaterField(
          body.config,
          ((x + 0.5) / width - 0.5) * body.config.size[0],
          ((z + 0.5) / height - 0.5) * body.config.size[1],
        );
        data.set(f, (z * width + x) * 4);
      }
    body.field = new T.DataTexture(
      data,
      width,
      height,
      T.RGBAFormat,
      T.FloatType,
    );
    body.field.needsUpdate = true;
    body.states = Array.from(
      { length: 2 },
      () =>
        new T.WebGLRenderTarget(width, height, {
          type: T.HalfFloatType,
          minFilter: T.LinearFilter,
          magFilter: T.LinearFilter,
          depthBuffer: false,
        }),
    );
    body.read = 0;
    body.needsClear = true;
    body.maxStep = waterTimeStep(
      body.config.size,
      resolution,
      body.config.depth,
    );
    const u = body.mesh.material.uniforms;
    u.uField.value = body.field;
    u.uState.value = zero;
    u.uTexel.value.set(1 / width, 1 / height);
    body.reflection.setSize(settings.reflection, settings.reflection);
    body.lastReflection = -Infinity;
    body.reflectionReady = false;
    u.uReflectionReady.value = 0;
  }

  function addBody(options) {
    const config = {
      depth: 0.6,
      amplitude: 0.021,
      flow: 0,
      absorption: [1.45, 0.48, 0.29],
      scatter: "#2b6861",
      roughness: 0.18,
      ...options,
    };
    config.size ||= [config.radius * 2, config.radius * 2];
    if (bodies.some((b) => b.config.id === config.id))
      throw Error(`Duplicate water body: ${config.id}`);
    const reflection = new T.WebGLRenderTarget(
      settings.reflection,
      settings.reflection,
      { type: T.HalfFloatType },
    );
    const uniforms = T.UniformsUtils.merge([
      T.UniformsLib.lights,
      T.UniformsLib.fog,
      {
        uTime: { value: time },
        uAmplitude: { value: config.amplitude },
        uSize: { value: new T.Vector2(...config.size) },
        uTexel: { value: new T.Vector2() },
        uField: { value: zero },
        uState: { value: zero },
        uReflection: { value: null },
        uReflectionMatrix: { value: new T.Matrix4() },
        uReflectionScale: { value: new T.Vector2(1, 1) },
        uScene: { value: null },
        uDepth: { value: null },
        uInvProjection: { value: new T.Matrix4() },
        uCameraWorld: { value: new T.Matrix4() },
        uViewport: { value: new T.Vector2(1, 1) },
        uViewDirection: { value: new T.Vector3() },
        uIsOrthographic: { value: 1 },
        uReflectionReady: { value: 0 },
        uAbsorption: { value: new T.Vector3(...config.absorption) },
        uScatter: { value: new T.Color(config.scatter) },
        uSunDirection: { value: new T.Vector3(-16, 32, 15).normalize() },
        uSunColor: { value: new T.Color("#fff0d6").multiplyScalar(2.4) },
        uSkyColor: { value: new T.Color("#abc2a1") },
        uDusk: { value: 0 },
        uRoughness: { value: config.roughness },
      },
    ]);
    // UniformsUtils clones textures: these render targets must remain live shared inputs.
    uniforms.uScene.value = sceneTarget.texture;
    uniforms.uDepth.value = sceneTarget.depthTexture;
    uniforms.uReflection.value = reflection.texture;
    const material = new T.ShaderMaterial({
      name: `Physical water · ${config.id}`,
      uniforms,
      vertexShader: waterVertex,
      fragmentShader: waterFragment,
      lights: true,
      fog: true,
    });
    const mesh = new T.Mesh(surfaceGeometry(config), material);
    mesh.name = `Water surface · ${config.id}`;
    mesh.position.set(config.x, config.y, config.z);
    mesh.receiveShadow = true;
    mesh.userData.waterBody = config.id;
    group.add(mesh);
    const body = {
      config,
      mesh,
      reflection,
      impulses: [],
      sources: [],
      jets: [],
      lastReflection: -Infinity,
      reflectionReady: false,
    };
    bodies.push(body);
    allocate(body);
    return body;
  }

  function disturb(id, x, z, strength = 0.018, radius = 0.12) {
    const body = bodies.find((b) => b.config.id === id);
    if (!body || !Number.isFinite(x + z + strength + radius) || radius <= 0)
      return false;
    const localX = x - body.config.x,
      localZ = z - body.config.z;
    if (
      Math.abs(localX) > body.config.size[0] / 2 ||
      Math.abs(localZ) > body.config.size[1] / 2 ||
      !sampleWaterField(body.config, localX, localZ)[3]
    )
      return false;
    if (body.impulses.length >= 32) body.impulses.shift();
    body.impulses.push(
      new T.Vector4(
        localX,
        localZ,
        Math.max(0.04, radius),
        T.MathUtils.clamp(strength, -0.08, 0.08),
      ),
    );
    return true;
  }

  function addSource(
    id,
    { x, z, radius = 0.09, strength = 0.008, interval = 0.22, phase = 0 },
  ) {
    const body = bodies.find((b) => b.config.id === id);
    if (!body) throw Error(`Unknown water body: ${id}`);
    body.sources.push({ x, z, radius, strength, interval, next: time + phase });
  }

  function addJet(id, { start, end, arc = 0.25, radius = 0.014, phase = 0 }) {
    const body = bodies.find((b) => b.config.id === id);
    if (!body) throw Error(`Unknown water body: ${id}`);
    const origin = new T.Vector3(...start),
      landing = new T.Vector3(...end);
    // Ballistic trajectory reaches the actual water plane; droplet phase and impact
    // source have the same period, so ripples originate beneath falling water.
    const duration =
      Math.sqrt((2 * (Math.max(0, start[1] - end[1]) + arc)) / GRAVITY) +
      Math.sqrt((2 * arc) / GRAVITY);
    const velocityY =
      (end[1] - start[1] + 0.5 * GRAVITY * duration ** 2) / duration;
    const point = (f, p = new T.Vector3()) => {
      p.copy(origin).lerp(landing, f);
      p.y =
        origin.y +
        velocityY * f * duration -
        0.5 * GRAVITY * (f * duration) ** 2;
      return p;
    };
    const points = Array.from({ length: 41 }, (_, i) => point(i / 40));
    const material = new T.MeshPhysicalMaterial({
      color: "#b7d9d0",
      roughness: 0.09,
      metalness: 0,
      transparent: true,
      opacity: 0.55,
      clearcoat: 1,
      depthWrite: false,
    });
    const stream = new T.Mesh(
      new T.TubeGeometry(new T.CatmullRomCurve3(points), 40, radius, 6, false),
      material,
    );
    stream.name = `Water jet · ${id}`;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uJetTime = body.mesh.material.uniforms.uTime;
      shader.vertexShader = "varying float vJetAlong;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvJetAlong = uv.x;",
      );
      shader.fragmentShader =
        "uniform float uJetTime; varying float vJetAlong;\n" +
        shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <alphamap_fragment>",
        "#include <alphamap_fragment>\ndiffuseColor.a *= .68 + .32 * sin(vJetAlong * 105.0 - uJetTime * 24.0);",
      );
    };
    group.add(stream);
    const drops = new T.InstancedMesh(
      new T.SphereGeometry(radius * 1.2, 6, 4),
      material,
      12,
    );
    drops.frustumCulled = false;
    group.add(drops);
    const dummy = new T.Object3D();
    for (let i = 0; i < drops.count; i++) {
      dummy.position.copy(point(i / drops.count));
      dummy.scale.set(0.75, 1.2 + (i / drops.count) * 1.4, 0.75);
      dummy.updateMatrix();
      drops.setMatrixAt(i, dummy.matrix);
    }
    body.jets.push({ stream, drops, point, phase, duration, dummy });
    const period = duration / drops.count;
    addSource(id, {
      x: end[0],
      z: end[2],
      radius: 0.075,
      strength: 0.004,
      interval: period,
      phase: (period - (phase % period)) % period,
    });
    return stream;
  }

  function update(dt) {
    if (disposed || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.05);
    time += dt;
    pendingDt = Math.min(0.05, pendingDt + dt);
    for (const body of bodies) {
      body.mesh.material.uniforms.uTime.value = time;
      for (const source of body.sources)
        if (time >= source.next) {
          disturb(
            body.config.id,
            source.x,
            source.z,
            source.strength,
            source.radius,
          );
          source.next +=
            source.interval *
            (Math.floor((time - source.next) / source.interval) + 1);
        }
      for (const jet of body.jets) {
        for (let i = 0; i < jet.drops.count; i++) {
          const f =
            ((time + jet.phase) / jet.duration + i / jet.drops.count) % 1;
          jet.point(f, jet.dummy.position);
          jet.dummy.scale.set(0.75, 1.2 + f * 1.4, 0.75);
          jet.dummy.updateMatrix();
          jet.drops.setMatrixAt(i, jet.dummy.matrix);
        }
        jet.drops.instanceMatrix.needsUpdate = true;
      }
    }
  }

  function simulate(renderer, body, dt) {
    if (body.needsClear) {
      renderer.setClearColor(0, 0);
      for (const target of body.states) {
        renderer.setRenderTarget(target);
        renderer.clear();
      }
      body.needsClear = false;
    }
    if (!gpuSimulation) return;
    const u = simMaterial.uniforms;
    u.uField.value = body.field;
    u.uTexel.value.set(1 / body.resolution[0], 1 / body.resolution[1]);
    u.uSize.value.set(...body.config.size);
    u.uOpenEnds.value = body.config.radius ? 0 : 1;
    const count = Math.ceil(dt / body.maxStep);
    if (count) {
      u.uDt.value = dt / count;
      for (let step = 0; step < count; step++) {
        for (const impulse of u.uImpulses.value) impulse.set(0, 0, 1, 0);
        if (step === 0)
          body.impulses
            .splice(0, 8)
            .forEach((p, i) => u.uImpulses.value[i].copy(p));
        for (let pass = 0; pass < 2; pass++) {
          u.uPass.value = pass;
          u.uState.value = body.states[body.read].texture;
          renderer.setRenderTarget(body.states[1 - body.read]);
          renderer.render(simScene, simCamera);
          body.read = 1 - body.read;
        }
        totalSteps++;
      }
    }
    body.mesh.material.uniforms.uState.value = body.states[body.read].texture;
  }

  function captureReflection(renderer, camera, body) {
    // Clone the camera type: orthographic village views require an orthographic mirror.
    if (!body.mirrorCamera || body.mirrorCamera.type !== camera.type)
      body.mirrorCamera = camera.clone();
    const mirror = body.mirrorCamera;
    mirror.copy(camera, false);
    camera.getWorldPosition(mirror.position);
    mirror.position.y = 2 * body.config.y - mirror.position.y;
    camera.getWorldDirection(cameraDirection);
    reflectionLook.copy(camera.position).add(cameraDirection);
    reflectionLook.y = 2 * body.config.y - reflectionLook.y;
    mirror.up.set(0, -1, 0);
    mirror.lookAt(reflectionLook);
    mirror.updateMatrixWorld(true);
    const reflectionScale = body.mesh.material.uniforms.uReflectionScale.value;
    reflectionScale.set(1, 1);
    if (camera.isOrthographicCamera) {
      // Only the reflected footprint of this pool is sampled by its surface.
      // Crop conservatively around the displaced geometry, keeping the crop in
      // the texture matrix so cached reflections remain aligned as the view moves.
      const bounds = body.mesh.geometry.boundingBox;
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const x of [bounds.min.x, bounds.max.x])
        for (const y of [bounds.min.y, bounds.max.y])
          for (const z of [bounds.min.z, bounds.max.z]) {
            reflectionCorner
              .set(x, y, z)
              .applyMatrix4(body.mesh.matrixWorld)
              .project(mirror);
            minX = Math.min(minX, reflectionCorner.x);
            maxX = Math.max(maxX, reflectionCorner.x);
            minY = Math.min(minY, reflectionCorner.y);
            maxY = Math.max(maxY, reflectionCorner.y);
          }
      // Keep a guard band for normal distortion at the shoreline.
      minX = Math.max(-1, minX - 0.05);
      maxX = Math.min(1, maxX + 0.05);
      minY = Math.max(-1, minY - 0.05);
      maxY = Math.min(1, maxY + 0.05);
      const width = maxX - minX,
        height = maxY - minY;
      if (width > 0 && height > 0) {
        reflectionCrop.set(
          2 / width,
          0,
          0,
          -(maxX + minX) / width,
          0,
          2 / height,
          0,
          -(maxY + minY) / height,
          0,
          0,
          1,
          0,
          0,
          0,
          0,
          1,
        );
        mirror.projectionMatrix.premultiply(reflectionCrop);
        mirror.projectionMatrixInverse.copy(mirror.projectionMatrix).invert();
        reflectionScale.set(2 / width, 2 / height);
        renderer.getDrawingBufferSize(drawingBufferSize);
        // Quantize allocation sizes to avoid resizing targets for every zoom step.
        const pixels = (extent, size) =>
          Math.min(
            settings.reflection,
            Math.max(64, Math.ceil((extent * size) / 2 / 64) * 64),
          );
        body.reflection.setSize(
          pixels(width, drawingBufferSize.x),
          pixels(height, drawingBufferSize.y),
        );
      }
    } else {
      body.reflection.setSize(settings.reflection, settings.reflection);
    }
    const matrix = body.mesh.material.uniforms.uReflectionMatrix.value;
    matrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    matrix
      .multiply(mirror.projectionMatrix)
      .multiply(mirror.matrixWorldInverse);
    clipPlane.constant = -body.config.y + 0.015;
    renderer.clippingPlanes = [clipPlane];
    renderer.setRenderTarget(body.reflection);
    if (!renderer.autoClear) renderer.clear();
    renderer.render(scene, mirror);
    body.lastReflection = wallTime;
    body.reflectionReady = true;
    body.mesh.material.uniforms.uReflectionReady.value = 1;
    lastCaptureCount++;
  }

  function render(renderer, camera, { dt = 0, dusk = 0, sun } = {}) {
    if (disposed) return;
    if (!initialized) {
      gpuSimulation = renderer.extensions.has("EXT_color_buffer_float");
      if (!gpuSimulation) {
        // Keep the same optical/wave model on GPUs without float render attachments.
        sceneTarget.texture.type = T.UnsignedByteType;
        for (const body of bodies)
          body.reflection.texture.type = T.UnsignedByteType;
      }
      initialized = true;
    }
    wallTime += Math.max(0, dt);
    camera.updateMatrixWorld();
    if (scene.matrixWorldAutoUpdate) scene.updateMatrixWorld();
    projectionView.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    frustum.setFromProjectionMatrix(projectionView);
    const visible = bodies.filter(
      (body) => body.mesh.visible && frustum.intersectsObject(body.mesh),
    );
    lastCaptureCount = 0;
    for (const body of bodies)
      if (!visible.includes(body)) body.impulses.length = 0;
    if (!visible.length) {
      pendingDt = 0;
      return;
    }
    const previousTarget = renderer.getRenderTarget(),
      previousToneMapping = renderer.toneMapping;
    const previousClipping = renderer.clippingPlanes,
      previousShadow = renderer.shadowMap.autoUpdate;
    const previousMatrixUpdate = scene.matrixWorldAutoUpdate;
    const previousXr = renderer.xr.enabled,
      previousScissorTest = renderer.getScissorTest();
    const previousClearAlpha = renderer.getClearAlpha();
    const surfaceVisibility = bodies.map((body) => body.mesh.visible);
    const excludedVisibility = [...captureExcluded].map((o) => [o, o.visible]);
    renderer.getClearColor(savedClear);
    renderer.getViewport(savedViewport);
    renderer.getScissor(savedScissor);
    try {
      renderer.xr.enabled = false;
      scene.matrixWorldAutoUpdate = false;
      renderer.shadowMap.autoUpdate = false;
      renderer.toneMapping = T.NoToneMapping;
      renderer.setScissorTest(false);
      for (const body of visible) {
        if (gpuSimulation) simulate(renderer, body, pendingDt);
        else body.impulses.length = 0;
      }
      pendingDt = 0;
      for (const body of bodies) body.mesh.visible = false;
      for (const object of captureExcluded) object.visible = false;
      renderer.setClearColor(savedClear, previousClearAlpha);
      const size = renderer.getDrawingBufferSize(drawingBufferSize);
      const width = Math.max(1, Math.round(size.x * settings.refraction));
      const height = Math.max(1, Math.round(size.y * settings.refraction));
      if (sceneTarget.width !== width || sceneTarget.height !== height)
        sceneTarget.setSize(width, height);
      renderer.clippingPlanes = [];
      renderer.setRenderTarget(sceneTarget);
      if (!renderer.autoClear) renderer.clear();
      renderer.render(scene, camera);
      // One scene reflection per frame after warmup; basins and river cache independently.
      const overdue = visible
        .filter((b) => wallTime - b.lastReflection >= settings.interval)
        .sort((a, b) => a.lastReflection - b.lastReflection);
      for (const body of overdue.filter(
        (b, i) => !b.reflectionReady || i === 0,
      ))
        captureReflection(renderer, camera, body);
      camera.getWorldDirection(viewDirection).negate();
      for (const body of visible) {
        const u = body.mesh.material.uniforms;
        u.uInvProjection.value.copy(camera.projectionMatrixInverse);
        u.uCameraWorld.value.copy(camera.matrixWorld);
        u.uViewport.value.set(width, height);
        u.uViewDirection.value.copy(viewDirection);
        u.uIsOrthographic.value = camera.isOrthographicCamera ? 1 : 0;
        u.uDusk.value = dusk;
        if (scene.background?.isColor) u.uSkyColor.value.copy(scene.background);
        if (sun) {
          u.uSunDirection.value
            .copy(sun.position)
            .sub(sun.target.position)
            .normalize();
          u.uSunColor.value.copy(sun.color).multiplyScalar(sun.intensity);
        }
      }
      renderFrame++;
    } finally {
      bodies.forEach((body, i) => {
        body.mesh.visible = surfaceVisibility[i];
      });
      for (const [object, wasVisible] of excludedVisibility)
        object.visible = wasVisible;
      renderer.clippingPlanes = previousClipping;
      renderer.toneMapping = previousToneMapping;
      renderer.shadowMap.autoUpdate = previousShadow;
      scene.matrixWorldAutoUpdate = previousMatrixUpdate;
      renderer.xr.enabled = previousXr;
      renderer.setClearColor(savedClear, previousClearAlpha);
      renderer.setRenderTarget(previousTarget);
      renderer.setViewport(savedViewport);
      renderer.setScissor(savedScissor);
      renderer.setScissorTest(previousScissorTest);
    }
  }

  // Hidden from refraction and reflection captures, kept in shadows and the main view.
  function excludeFromCaptures(...objects) {
    for (const object of objects) if (object) captureExcluded.add(object);
  }

  function setQuality(value) {
    if (!QUALITY[value] || quality === value) return;
    quality = value;
    settings = QUALITY[value];
    for (const body of bodies) allocate(body);
  }

  function diagnostics() {
    return {
      model: "shallow-water + gravity/capillary waves",
      quality,
      simulation: gpuSimulation ? "GPU RGBA16F" : "analytic fallback",
      time,
      steps: totalSteps,
      captures: lastCaptureCount,
      frame: renderFrame,
      refraction: [sceneTarget.width, sceneTarget.height],
      bodies: bodies.map((b) => ({
        id: b.config.id,
        resolution: [...b.resolution],
        maxStep: b.maxStep,
        reflectionReady: b.reflectionReady,
        reflectionSize: [b.reflection.width, b.reflection.height],
        impulses: b.impulses.length,
        sources: b.sources.length,
        vertices: b.mesh.geometry.attributes.position.count,
        surface: b.config.y,
      })),
    };
  }

  // Explicitly requested diagnostics only: no GPU readback in the animation loop.
  function inspect(renderer, id) {
    const body = bodies.find((b) => b.config.id === id);
    if (!body || !gpuSimulation || body.needsClear) return null;
    const [w, h] = body.resolution,
      pixels = new Uint16Array(w * h * 4);
    renderer.readRenderTargetPixels(body.states[body.read], 0, 0, w, h, pixels);
    let maxHeight = 0,
      maxVelocity = 0,
      foam = 0,
      energy = 0,
      finite = true,
      dryError = 0,
      activeCells = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const height = T.DataUtils.fromHalfFloat(pixels[i]);
      const vx = T.DataUtils.fromHalfFloat(pixels[i + 1]),
        vz = T.DataUtils.fromHalfFloat(pixels[i + 2]);
      const f = T.DataUtils.fromHalfFloat(pixels[i + 3]);
      finite &&= Number.isFinite(height + vx + vz + f);
      maxHeight = Math.max(maxHeight, Math.abs(height));
      maxVelocity = Math.max(maxVelocity, Math.hypot(vx, vz));
      foam = Math.max(foam, f);
      energy += height * height;
      if (Math.abs(height) > 0.00005) activeCells++;
      if (!body.field.image.data[i + 3])
        dryError = Math.max(
          dryError,
          Math.abs(height) + Math.abs(vx) + Math.abs(vz),
        );
    }
    return {
      finite,
      maxHeight,
      maxVelocity,
      foam,
      energy,
      dryError,
      activeCells,
    };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    const geometries = new Set(),
      materials = new Set();
    group.traverse((o) => {
      if (o.geometry) geometries.add(o.geometry);
      if (o.material) materials.add(o.material);
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const body of bodies) {
      body.field.dispose();
      body.reflection.dispose();
      for (const target of body.states) target.dispose();
    }
    sceneTarget.dispose();
    zero.dispose();
    quad.geometry.dispose();
    simMaterial.dispose();
  }
  return {
    get time() {
      return time;
    },
    group,
    addBody,
    addSource,
    addJet,
    disturb,
    update,
    render,
    excludeFromCaptures,
    setQuality,
    diagnostics,
    inspect,
    dispose,
  };
}
