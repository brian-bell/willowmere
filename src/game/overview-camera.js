import * as THREE from "three";
import { WORLD, terrainHeight } from "../world-layout.js";

// The village overview: an orthographic camera that follows the player, with
// yaw, tilt, pan and zoom controls. Each control eases toward its target
// unless motion is reduced; the view's heading also sets which way the
// movement keys walk.

const $ = (s) => document.querySelector(s);
// The resting offset from the view's target; yaw turns it around the target
// and tilt pitches it, preserving its length.
const RESTING_OFFSET = new THREE.Vector3(27, 36, 44);
export const CAMERA_DISTANCE = RESTING_OFFSET.length(),
  // Yaw 0 looks along this heading; the sun's shadow rolls with it.
  CAMERA_HEADING = Math.atan2(RESTING_OFFSET.x, RESTING_OFFSET.z),
  DEFAULT_TILT = THREE.MathUtils.radToDeg(Math.asin(RESTING_OFFSET.y / CAMERA_DISTANCE)),
  MIN_TILT = 20,
  MAX_TILT = 75,
  TILT_STEP = 5,
  YAW_STEP = 15,
  PAN_STEP = 3,
  PAN_LIMIT = 18,
  DEFAULT_VIEW_HEIGHT = 18,
  MIN_VIEW_HEIGHT = 10,
  // Zoomed out this far the view holds more than the village; coarse foliage
  // and hidden small detail (src/game/detail.js) keep it within the village
  // view's cost.
  MAX_VIEW_HEIGHT = 39,
  ZOOM_STEP = 3;

/**
 * `isFirstPerson()` disables the zoom buttons at eye level; `onZoom()` refits
 * the cameras' frustums while the zoom eases.
 */
export function createOverviewCamera({ camera, isFirstPerson, onZoom }) {
  const offset = RESTING_OFFSET.clone(),
    pan = new THREE.Vector2(),
    targetPan = new THREE.Vector2(),
    panOffset = new THREE.Vector3(),
    // Where the view wants to be, where it is, and where it looks once panned.
    target = new THREE.Vector3(0, 0, 1.5),
    eased = target.clone(),
    viewTarget = new THREE.Vector3(),
    // Unit vectors on the ground plane along the screen's right and down.
    screenRight = new THREE.Vector2(offset.z, -offset.x).normalize(),
    screenDown = new THREE.Vector2(offset.x, offset.z).normalize();
  let tilt = DEFAULT_TILT,
    targetTilt = DEFAULT_TILT,
    yaw = 0,
    targetYaw = 0,
    heading = CAMERA_HEADING,
    viewHeight = 29,
    targetViewHeight = 29,
    snap = false;

  // Touch mode offers one button that undoes every change to the view.
  function updateViewReset() {
    const moved =
      targetYaw !== 0 ||
      targetTilt !== DEFAULT_TILT ||
      targetPan.lengthSq() > 0 ||
      targetViewHeight !== DEFAULT_VIEW_HEIGHT;
    $(".view-controls").classList.toggle("view-moved", moved);
  }
  function setYaw(angle) {
    targetYaw = THREE.MathUtils.euclideanModulo(angle, 360);
    $("#yaw-angle").textContent = `${Math.round(targetYaw)}°`;
    $("#yaw-reset").disabled = targetYaw === 0;
    updateViewReset();
  }
  function setPan(x, y) {
    targetPan.set(
      THREE.MathUtils.clamp(x, -PAN_LIMIT, PAN_LIMIT),
      THREE.MathUtils.clamp(y, -PAN_LIMIT, PAN_LIMIT),
    );
    $("#pan-left").disabled = targetPan.x <= -PAN_LIMIT;
    $("#pan-right").disabled = targetPan.x >= PAN_LIMIT;
    $("#pan-up").disabled = targetPan.y <= -PAN_LIMIT;
    $("#pan-down").disabled = targetPan.y >= PAN_LIMIT;
    $("#pan-reset").disabled = targetPan.lengthSq() === 0;
    updateViewReset();
  }
  function setTilt(angle) {
    targetTilt = THREE.MathUtils.clamp(angle, MIN_TILT, MAX_TILT);
    updateTiltControls();
  }
  function updateTiltControls() {
    $("#tilt-up").disabled = targetTilt >= MAX_TILT;
    $("#tilt-down").disabled = targetTilt <= MIN_TILT;
    $("#tilt-angle").textContent = `${Math.round(targetTilt)}°`;
    $("#tilt-reset").disabled = targetTilt === DEFAULT_TILT;
    updateViewReset();
  }
  function updateZoomControls() {
    const firstPerson = isFirstPerson();
    $("#zoom-in").disabled = firstPerson || targetViewHeight <= MIN_VIEW_HEIGHT;
    $("#zoom-out").disabled = firstPerson || targetViewHeight >= MAX_VIEW_HEIGHT;
    $("#zoom-reset").disabled = firstPerson || targetViewHeight === DEFAULT_VIEW_HEIGHT;
  }
  function setZoom(height) {
    targetViewHeight = THREE.MathUtils.clamp(height, MIN_VIEW_HEIGHT, MAX_VIEW_HEIGHT);
    updateZoomControls();
    updateViewReset();
  }

  return {
    camera,
    screenRight,
    screenDown,
    /** Where the overview looks, panning included. */
    viewTarget,
    get viewHeight() {
      return viewHeight;
    },
    get targetViewHeight() {
      return targetViewHeight;
    },
    get targetYaw() {
      return targetYaw;
    },
    setYaw,
    setTilt,
    setPan,
    setZoom,
    updateZoomControls,
    /** The view's zoom (its height in metres), yaw and tilt (degrees), as a gesture starts. */
    pose: () => ({ zoom: targetViewHeight, yaw: targetYaw, tilt: targetTilt }),
    /**
     * Sets zoom, yaw and tilt at once, without easing, so the view keeps up
     * with the fingers moving it.
     */
    place({ zoom, yaw: nextYaw, tilt: nextTilt }) {
      setZoom(zoom);
      if (viewHeight !== targetViewHeight) {
        viewHeight = targetViewHeight;
        onZoom();
      }
      setYaw(nextYaw);
      yaw = targetYaw;
      setTilt(nextTilt);
      tilt = targetTilt;
    },
    /**
     * Pans the map by a finger's movement in CSS pixels, so the ground under
     * the finger follows it; `screenHeight` is the canvas's height.
     */
    dragBy(dx, dy, screenHeight) {
      const metresPerPixel = (camera.top - camera.bottom) / Math.max(1, screenHeight),
        // The ground is foreshortened up the screen by the tilt.
        rise = Math.max(0.2, Math.sin(THREE.MathUtils.degToRad(tilt)));
      setPan(targetPan.x - dx * metresPerPixel, targetPan.y - (dy * metresPerPixel) / rise);
      pan.copy(targetPan);
    },
    /** Eases the view back to how it starts. */
    resetView() {
      setZoom(DEFAULT_VIEW_HEIGHT);
      setTilt(DEFAULT_TILT);
      setYaw(0);
      setPan(0, 0);
    },
    /** Starts at a zoom without easing there. */
    zoomAt(height) {
      viewHeight = targetViewHeight = height;
    },
    /** The next frame takes the view straight to the player (a jump). */
    snap() {
      snap = true;
    },
    /** Wires the view buttons and shows their starting state. */
    bindControls() {
      updateZoomControls();
      $("#zoom-in").onclick = () => setZoom(targetViewHeight - ZOOM_STEP);
      $("#zoom-out").onclick = () => setZoom(targetViewHeight + ZOOM_STEP);
      $("#zoom-reset").onclick = () => setZoom(DEFAULT_VIEW_HEIGHT);
      // Desktop folds the whole panel behind this button (see style.css).
      $("#camera-toggle").onclick = () => {
        const shown = $(".view-controls").classList.toggle("camera-shown");
        $("#camera-toggle").setAttribute("aria-expanded", String(shown));
        $("#camera-toggle").title = shown ? "Hide camera controls" : "Show camera controls";
      };
      // Small screens fold tilt, yaw and pan behind this button (see style.css).
      $("#camera-more").onclick = () => {
        const open = $(".view-controls").classList.toggle("camera-open");
        $("#camera-more").setAttribute("aria-expanded", String(open));
        $("#camera-more").innerHTML = `<span aria-hidden="true">${open ? "×" : "⋯"}</span>`;
      };
      updateTiltControls();
      $("#tilt-up").onclick = () => setTilt(targetTilt + TILT_STEP);
      $("#tilt-down").onclick = () => setTilt(targetTilt - TILT_STEP);
      $("#tilt-reset").onclick = () => setTilt(DEFAULT_TILT);
      setYaw(0);
      $("#yaw-left").onclick = () => setYaw(targetYaw - YAW_STEP);
      $("#yaw-right").onclick = () => setYaw(targetYaw + YAW_STEP);
      $("#yaw-reset").onclick = () => setYaw(0);
      setPan(0, 0);
      $("#pan-left").onclick = () => setPan(targetPan.x - PAN_STEP, targetPan.y);
      $("#pan-right").onclick = () => setPan(targetPan.x + PAN_STEP, targetPan.y);
      $("#pan-up").onclick = () => setPan(targetPan.x, targetPan.y - PAN_STEP);
      $("#pan-down").onclick = () => setPan(targetPan.x, targetPan.y + PAN_STEP);
      $("#pan-reset").onclick = () => setPan(0, 0);
      $("#view-reset").onclick = () => this.resetView();
    },
    /** Fits the orthographic frustum to the screen's aspect. */
    fit(aspect) {
      const height = aspect < 0.9 ? viewHeight * 1.35 : viewHeight;
      camera.left = (-height * aspect) / 2;
      camera.right = (height * aspect) / 2;
      camera.top = height / 2;
      camera.bottom = -height / 2;
      camera.updateProjectionMatrix();
    },
    /** Eases the yaw and points the screen's axes; runs before movement. */
    turn(dt, motion) {
      // Take the shortest arc, including when rotation crosses the 0°/360° seam.
      const yawDelta = THREE.MathUtils.euclideanModulo(targetYaw - yaw + 180, 360) - 180;
      yaw = motion
        ? THREE.MathUtils.euclideanModulo(yaw + yawDelta * (1 - Math.exp(-dt * 8)), 360)
        : targetYaw;
      heading = CAMERA_HEADING + THREE.MathUtils.degToRad(yaw);
      screenRight.set(Math.cos(heading), -Math.sin(heading));
      screenDown.set(Math.sin(heading), Math.cos(heading));
    },
    /** Follows the player at `p` and places the camera; runs after movement. */
    follow(dt, motion, p, started) {
      // The view stays composed around the village, then gently accompanies longer
      // walks, up to the map's edge.
      const follow = started ? 0.85 : 0.48,
        bounds = WORLD.camera;
      // On the hill it rises with the ground under the player, who stays framed.
      target.set(
        THREE.MathUtils.clamp(p.x * follow, bounds.minX, bounds.maxX),
        terrainHeight(p.x, p.z),
        THREE.MathUtils.clamp(1.5 + (p.z - 5) * follow, bounds.minZ, bounds.maxZ),
      );
      if (Math.abs(viewHeight - targetViewHeight) > 0.01) {
        viewHeight = motion
          ? THREE.MathUtils.lerp(viewHeight, targetViewHeight, 1 - Math.exp(-dt * 2.4))
          : targetViewHeight;
        onZoom();
      }
      // A jump (moveTo) takes the view straight there.
      if (snap) eased.copy(target);
      else eased.lerp(target, 1 - Math.exp(-dt * 1.8));
      snap = false;
      tilt = motion ? THREE.MathUtils.lerp(tilt, targetTilt, 1 - Math.exp(-dt * 8)) : targetTilt;
      // Pitch around the view's horizontal axis, preserving heading and distance.
      const pitch = THREE.MathUtils.degToRad(tilt),
        groundDistance = CAMERA_DISTANCE * Math.cos(pitch);
      offset.set(
        groundDistance * Math.sin(heading),
        CAMERA_DISTANCE * Math.sin(pitch),
        groundDistance * Math.cos(heading),
      );
      if (motion) pan.lerp(targetPan, 1 - Math.exp(-dt * 8));
      else pan.copy(targetPan);
      // Keep pan directions aligned with the screen on the village's ground plane.
      panOffset.set(
        screenRight.x * pan.x + screenDown.x * pan.y,
        0,
        screenRight.y * pan.x + screenDown.y * pan.y,
      );
      viewTarget.copy(eased).add(panOffset);
      camera.position.copy(viewTarget).add(offset);
      camera.lookAt(viewTarget);
    },
    diagnostics: () => ({
      tilt,
      targetTilt,
      yaw,
      targetYaw,
      viewHeight,
      targetViewHeight,
      offset: offset.toArray(),
      pan: pan.toArray(),
      targetPan: targetPan.toArray(),
    }),
  };
}
