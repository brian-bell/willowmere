import * as THREE from "three";
import { WORLD, terrainField, terrainHeight, terrainMaxIn } from "../world-layout.js";
import { CAMERA_HEADING } from "./overview-camera.js";

// Eye-level views resolve finer shadow texels than the village overview.
export const SHADOW_MAP_SIZES = {
  high: { overview: 2048, firstPerson: 4096 },
  balanced: { overview: 1536, firstPerson: 2048 },
  performance: { overview: 1024, firstPerson: 1024 },
};

// The sun never moves. Its shadow camera rolls with each yaw step so the overview's
// footprint lines up with the map, and its bounds follow the receivers in view in
// fixed sizes and whole-texel steps, so shadow edges hold still while the view
// follows or pans and change only in small steps while it zooms.
export function createSunShadow({ sun, overviewCamera, firstPersonCamera }) {
  const shadowCamera = sun.shadow.camera;
  // The soil rim's base and the tallest canopy on the highest ground bound every
  // receiver vertically. A view's own ceiling counts only the ground under it,
  // and the village's receivers, which shadow sizes are fractions of, stand on
  // flat ground.
  const SHADOW_FLOOR = -1.4,
    SHADOW_CEILING = terrainField.max + WORLD.canopy,
    SHADOW_REFERENCE_CEILING = WORLD.canopy,
    SHADOW_MARGIN = 1,
    // Depth bias in metres; the shadow map stores depth across near..far.
    SHADOW_BIAS = 0.0126,
    // Fractions of the village's light-space extent, about 12% apart, so a
    // texel's size never depends on the map's. The largest steps cover views
    // wider than the village; any larger view takes the whole map.
    SHADOW_STEPS = Array.from({ length: 17 }, (_, i) =>
      i < 10 ? 0.32 * 1.12 ** i : 1.12 ** (i - 10),
    ),
    // First person fits the shadow to a village-sized box of ground around the
    // eye, reaching this far ahead of it, so eye-level detail keeps the
    // 4096 map's density on a map of any size, and turning only shifts it.
    FIRST_PERSON_SHADOW_AHEAD = 10;
  const shadowLight = sun.position.clone().sub(sun.target.position).normalize(),
    shadowPoint = new THREE.Vector3(),
    shadowRay = new THREE.Vector3(),
    shadowSize = new THREE.Vector2(),
    shadowCenter = new THREE.Vector2(),
    shadowView = new THREE.Box2(),
    // The overview's ground footprint, where its tallest ground is looked up.
    shadowFootprint = new THREE.Box2(),
    // Light-space bounds of the village's receivers (the size reference) and of
    // the whole map's (where the shadow box may go).
    villageShadow = new THREE.Box2(),
    worldShadow = new THREE.Box2(),
    shadowStep = [10, 10];
  let shadowYaw = null;
  // The depth range spans the world's receivers along the light, with a metre spare.
  {
    let near = Infinity,
      far = -Infinity;
    const { shadow } = WORLD;
    for (let i = 0; i < 8; i++) {
      shadowPoint.set(
        i & 1 ? shadow.maxX : shadow.minX,
        i & 2 ? SHADOW_CEILING : SHADOW_FLOOR,
        i & 4 ? shadow.maxZ : shadow.minZ,
      );
      const depth = sun.position.clone().sub(shadowPoint).dot(shadowLight);
      near = Math.min(near, depth);
      far = Math.max(far, depth);
    }
    shadowCamera.near = Math.max(0.1, near - 1);
    shadowCamera.far = far + 1;
    sun.shadow.bias = -SHADOW_BIAS / (shadowCamera.far - shadowCamera.near);
  }
  function addShadowPoint(box, point) {
    point.applyMatrix4(shadowCamera.matrixWorldInverse);
    box.expandByPoint(shadowCenter.set(point.x, point.y));
  }
  // Adds a ground box's receivers, from floor to ceiling, offset by (dx, dz),
  // to a light-space box.
  function addShadowBox(box, bounds, dx, dz, floor, ceiling) {
    for (let i = 0; i < 8; i++)
      addShadowPoint(
        box,
        shadowPoint.set(
          (i & 1 ? bounds.maxX : bounds.minX) + dx,
          i & 2 ? ceiling : floor,
          (i & 4 ? bounds.maxZ : bounds.minZ) + dz,
        ),
      );
    return box;
  }
  function roll(yaw) {
    // Point light-space x along the screen's right edge, projected across the sunlight.
    const heading = CAMERA_HEADING + THREE.MathUtils.degToRad(yaw);
    shadowPoint.set(Math.cos(heading), 0, -Math.sin(heading));
    shadowPoint
      .addScaledVector(shadowLight, -shadowPoint.dot(shadowLight))
      .normalize();
    shadowCamera.up.crossVectors(shadowLight, shadowPoint);
    shadowCamera.position.copy(sun.position);
    shadowCamera.lookAt(sun.target.position);
    shadowCamera.updateMatrixWorld();
    addShadowBox(
      villageShadow.makeEmpty(),
      WORLD.shadowReference,
      0,
      0,
      SHADOW_FLOOR,
      SHADOW_REFERENCE_CEILING,
    );
    addShadowBox(worldShadow.makeEmpty(), WORLD.shadow, 0, 0, SHADOW_FLOOR, SHADOW_CEILING);
    shadowYaw = yaw;
  }
  function setMapSize(quality, firstPerson) {
    const size = SHADOW_MAP_SIZES[quality][firstPerson ? "firstPerson" : "overview"];
    if (sun.shadow.mapSize.x === size) return;
    sun.shadow.mapSize.setScalar(size);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
    if (!sun.shadow.autoUpdate) sun.shadow.needsUpdate = true;
  }
  function fit({ firstPerson, yaw, targetYaw }) {
    if (shadowYaw !== targetYaw) roll(targetYaw);
    if (firstPerson) {
      // A village-sized box centred a little ahead of the eye, raised to the
      // ground the eye stands on.
      const { shadowReference: v } = WORLD,
        ahead = FIRST_PERSON_SHADOW_AHEAD,
        x = firstPersonCamera.position.x - Math.sin(yaw) * ahead,
        z = firstPersonCamera.position.z - Math.cos(yaw) * ahead,
        lift = terrainHeight(firstPersonCamera.position.x, firstPersonCamera.position.z);
      addShadowBox(
        shadowView.makeEmpty(),
        v,
        x - (v.minX + v.maxX) / 2,
        z - (v.minZ + v.maxZ) / 2,
        SHADOW_FLOOR + lift,
        SHADOW_REFERENCE_CEILING + lift,
      );
    } else {
      // Trace the overview's corner rays through every receiver height, up to
      // the canopy above the highest ground the view's footprint can reach.
      overviewCamera.updateMatrixWorld();
      overviewCamera.getWorldDirection(shadowRay);
      shadowFootprint.makeEmpty();
      for (let i = 0; i < 8; i++) {
        shadowPoint
          .set(i & 1 ? 1 : -1, i & 2 ? 1 : -1, -1)
          .unproject(overviewCamera);
        const y = i & 4 ? SHADOW_CEILING : SHADOW_FLOOR;
        shadowPoint.addScaledVector(shadowRay, (y - shadowPoint.y) / shadowRay.y);
        shadowFootprint.expandByPoint(shadowCenter.set(shadowPoint.x, shadowPoint.z));
      }
      const ceiling =
        terrainMaxIn(
          shadowFootprint.min.x,
          shadowFootprint.max.x,
          shadowFootprint.min.y,
          shadowFootprint.max.y,
        ) + WORLD.canopy;
      shadowView.makeEmpty();
      for (let i = 0; i < 8; i++) {
        shadowPoint
          .set(i & 1 ? 1 : -1, i & 2 ? 1 : -1, -1)
          .unproject(overviewCamera);
        const y = i & 4 ? ceiling : SHADOW_FLOOR;
        shadowPoint.addScaledVector(shadowRay, (y - shadowPoint.y) / shadowRay.y);
        addShadowPoint(shadowView, shadowPoint);
      }
      shadowView.expandByScalar(SHADOW_MARGIN);
    }
    shadowView.getSize(shadowSize);
    shadowView.getCenter(shadowCenter);
    const bounds = [0, 0, 0, 0];
    for (const axis of [0, 1]) {
      const key = axis ? "y" : "x",
        reference = villageShadow.max[key] - villageShadow.min[key],
        low = worldShadow.min[key],
        full = worldShadow.max[key] - low,
        last = SHADOW_STEPS.length - 1,
        // Less a hair, so first person's village-sized box takes the 1.0 step.
        needed = Math.min(shadowSize[key], full) / reference - 1e-9;
      // Grow at once; shrink only when the view fits well inside the smaller
      // size. First person's box never changes size, so it takes its step at once.
      let step = shadowStep[axis];
      if (firstPerson || needed > SHADOW_STEPS[step]) {
        step = SHADOW_STEPS.findIndex((s) => s >= needed);
        if (step < 0) step = last;
      } else while (step > 0 && needed < SHADOW_STEPS[step - 1] * 0.96) step--;
      shadowStep[axis] = step;
      const extent = Math.min(reference * SHADOW_STEPS[step], full),
        texel = extent / sun.shadow.mapSize[key],
        start = THREE.MathUtils.clamp(
          shadowCenter[key] - extent / 2,
          low,
          low + full - extent,
        );
      bounds[axis * 2] = Math.floor(start / texel) * texel;
      bounds[axis * 2 + 1] = bounds[axis * 2] + extent;
    }
    const [left, right, bottom, top] = bounds;
    if (
      left !== shadowCamera.left ||
      right !== shadowCamera.right ||
      bottom !== shadowCamera.bottom ||
      top !== shadowCamera.top
    ) {
      Object.assign(shadowCamera, { left, right, bottom, top });
      shadowCamera.updateProjectionMatrix();
    }
  }
  return {
    camera: shadowCamera,
    /** Fits the shadow to the view: the overview's, or first person's facing `yaw`. */
    fit,
    /** Picks the map size for a quality and view. */
    setMapSize,
    diagnostics: () => ({
      mapSize: sun.shadow.mapSize.x,
      // The village's light-space extent, which shadow sizes are fractions of.
      reference: villageShadow.getSize(new THREE.Vector2()).toArray(),
      bounds: [shadowCamera.left, shadowCamera.right, shadowCamera.bottom, shadowCamera.top],
    }),
  };
}
