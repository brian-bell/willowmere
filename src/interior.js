import * as T from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { SoftBloomPass, BloomOutputPass } from "./bloom.js";
import { createBakery } from "./bakery.js";
import { createInteriorWalker } from "./interior-movement.js";
import "./interior.css";

class InteriorAO extends SSAOPass {
  // The blurred contact occlusion is soft, so half resolution keeps its look
  // while quartering the normal pass, sampling and blur fill.
  resolutionScale = 0.5;

  setSize(width, height) {
    super.setSize(
      Math.max(1, Math.round(width * this.resolutionScale)),
      Math.max(1, Math.round(height * this.resolutionScale)),
    );
  }

  setKernelSize(size) {
    if (this.kernel.length === size) return;
    this.kernel.length = 0;
    this._generateSampleKernel(size);
    this.ssaoMaterial.defines.KERNEL_SIZE = size;
    this.ssaoMaterial.needsUpdate = true;
  }

  render(renderer, ...args) {
    // RenderPass already updated the shadows for this frame. The normal pass
    // needs only geometry, so reuse those same shadow maps.
    const autoUpdate = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    try {
      super.render(renderer, ...args);
    } finally {
      renderer.shadowMap.autoUpdate = autoUpdate;
    }
  }

  _overrideVisibility() {
    super._overrideVisibility();
    this.scene.traverse((object) => {
      if (object.isMesh && object.visible && object.material.transparent) {
        object.visible = false;
        this._visibilityCache.push(object);
      }
    });
  }
}

export function createInterior({ renderer, onExit, onStep, onInteract }) {
  const bakery = createBakery();
  bakery.scene.matrixWorldAutoUpdate = false;
  const walker = createInteriorWalker(bakery.layout);
  const canvas = renderer.domElement;
  const camera = new T.PerspectiveCamera(
    66,
    innerWidth / innerHeight,
    0.06,
    60,
  );
  camera.rotation.order = "YXZ";
  const pmrem = new T.PMREMGenerator(renderer);
  const environment = new RoomEnvironment();
  const environmentTarget = pmrem.fromScene(environment, 0.04);
  bakery.scene.environment = environmentTarget.texture;
  bakery.scene.environmentIntensity = 0.24;
  environment.dispose();
  pmrem.dispose();
  // Both shadowing lights are fixed and almost everything they light is merged
  // static geometry. Their maps refresh in turn a few times a second for the
  // slow cat and star mobile, instead of re-rendering the room twice a frame.
  const shadowLights = [bakery.sun, bakery.windowLight];
  for (const light of shadowLights) light.shadow.autoUpdate = false;
  let shadowClock = 0,
    shadowTurn = 0,
    shadowMotion = true;
  function refreshShadows() {
    for (const light of shadowLights) light.shadow.needsUpdate = true;
    shadowClock = 0;
  }
  const renderTarget = new T.WebGLRenderTarget(innerWidth, innerHeight, {
    samples: 2,
    type: T.HalfFloatType,
  });
  const composer = new EffectComposer(renderer, renderTarget);
  composer.addPass(new RenderPass(bakery.scene, camera));
  const ao = new InteriorAO(bakery.scene, camera, innerWidth, innerHeight, 12);
  ao.kernelRadius = 0.35;
  ao.minDistance = 0.001;
  ao.maxDistance = 0.035;
  composer.addPass(ao);
  const bloom = new SoftBloomPass(0.13, 0.4, 1.3);
  composer.addPass(bloom);
  composer.addPass(new BloomOutputPass(bloom));

  const panel = document.createElement("section");
  panel.id = "bakery-view";
  panel.setAttribute("aria-label", "Inside The Daily Loaf");
  panel.innerHTML = `
    <header class="bakery-heading"><span>WILLOWMERE</span><h1>The Daily Loaf</h1></header>
    <nav class="bakery-actions" aria-label="Bakery controls">
      <button id="bakery-look" aria-pressed="false">Free look <span aria-hidden="true">⌖</span></button>
      <button id="bakery-menu" aria-label="Pause bakery visit">Pause <kbd>Esc</kbd></button>
    </nav>
    <div class="bakery-crosshair" aria-hidden="true"><i></i></div>
    <button id="bakery-interact" hidden><kbd>E</kbd><span></span></button>
    <div id="bakery-note" role="status" hidden><span></span><p></p></div>
    <footer class="bakery-help"><span><b>WASD</b> walk <i>·</i> <b>Drag</b> look <i>·</i> <b>E</b> interact</span><span>Make yourself at home.</span></footer>
    <div class="bakery-touch" role="group" aria-label="Walk around the bakery">
      <button data-walk="forward" aria-label="Walk forward">↑</button>
      <button data-walk="left" aria-label="Step left">←</button>
      <button data-walk="back" aria-label="Walk backward">↓</button>
      <button data-walk="right" aria-label="Step right">→</button>
    </div>
    <button class="bakery-photo-return" hidden>Return to your visit <kbd>P</kbd></button>
    <dialog id="bakery-pause" aria-labelledby="bakery-pause-title">
      <span class="bakery-eyebrow">A MOMENT TO YOURSELF</span><h2 id="bakery-pause-title">Stay a little longer.</h2>
      <p>Walk with WASD. Drag to look around, or turn with ← and →. Press E near something that catches your eye.</p>
      <button id="bakery-resume">Keep wandering <span>→</span></button>
      <div class="bakery-pause-options"><button id="bakery-light" aria-pressed="false">After hours</button><button id="bakery-photo" aria-pressed="false">Photo <kbd>P</kbd></button></div>
      <button id="bakery-exit">Return to the village</button>
    </dialog>
  `;
  document.querySelector("#game").append(panel);
  const $ = (selector) => panel.querySelector(selector);
  const pauseDialog = $("#bakery-pause");
  const prompt = $("#bakery-interact");
  const keys = new Set(),
    touch = new Map();
  let active = false,
    paused = false,
    photo = false,
    night = false;
  let dragging = null,
    nearest = null,
    noteRemaining = 0,
    lastStepDistance = 0,
    bob = 0;
  let pointerLockReleasedAt = -Infinity;
  const points = [
    {
      id: "door",
      x: 4.8,
      z: 5.45,
      y: 2,
      range: 1.85,
      label: "Step out into Willowmere",
    },
    {
      id: "pastries",
      x: 4.55,
      z: 2.55,
      y: 2.55,
      range: 2.5,
      label: "Admire the pastries",
      title: "SOMETHING SWEET",
      text: "Moon croissants, berry daydreams, and just one more for the walk home. Finn has saved the warmest batch for his neighbors.",
    },
    {
      id: "crumb",
      x: -2.9,
      z: 0.5,
      y: 1.4,
      range: 1.85,
      label: "Say hello to Crumb",
      title: "CRUMB · KEEPER OF THE MOON FLOUR",
      text: "“A pinch of starlight. Three patient folds. And never, ever rush the dough.” Crumb tips his little hat.",
    },
    {
      id: "oven",
      x: -4.8,
      z: -2.1,
      y: 2,
      range: 2.25,
      label: "Warm your hands",
      title: "EMBER & ASH",
      text: "The old oven settles with a soft crackle. It has kept this room warm through a hundred winters, and it has room for one more pair of cold hands.",
    },
    {
      id: "cat",
      x: -6.5,
      z: 0.45,
      y: 1.4,
      range: 1.85,
      label: "Pet Cinnamon",
      title: "CINNAMON · HEAD OF AFTERNOON NAPS",
      text: "Cinnamon opens one sleepy eye, leans into your hand, and decides that you may stay.",
    },
    {
      id: "tea",
      x: -4.7,
      z: 2.5,
      y: 1.9,
      range: 1.85,
      label: "Pause for a little tea",
      title: "A CUP OF QUIET",
      text: "Wildflower tea, a spoonful of honey, and nowhere you need to be. The chair by the window is always yours.",
    },
    {
      id: "bell",
      x: 6.45,
      z: -0.6,
      y: 2.1,
      range: 1.7,
      label: "Ring the counter bell",
      title: "A LITTLE DING",
      text: "“Just a moment!” Finn calls from the flour store. “If the croissants start floating, put the kettle on.”",
    },
  ];

  function clearInput() {
    keys.clear();
    touch.clear();
    walker.stop();
    dragging = null;
  }
  function releaseMouse() {
    if (document.pointerLockElement === canvas) document.exitPointerLock();
  }
  function setPaused(value) {
    paused = value;
    clearInput();
    if (value) {
      releaseMouse();
      if (!pauseDialog.open) pauseDialog.showModal();
    } else {
      if (pauseDialog.open) pauseDialog.close();
      canvas.focus({ preventScroll: true });
    }
  }
  pauseDialog.addEventListener("close", () => {
    paused = false;
    clearInput();
    canvas.focus({ preventScroll: true });
  });
  pauseDialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    setPaused(false);
  });
  function setPhoto(value) {
    photo = value;
    panel.classList.toggle("is-photo", value);
    $(".bakery-photo-return").hidden = !value;
    $("#bakery-photo").setAttribute("aria-pressed", String(value));
    if (value) setPaused(false);
  }
  function showNote(title, message) {
    $("#bakery-note span").textContent = title;
    $("#bakery-note p").textContent = message;
    $("#bakery-note").hidden = false;
    noteRemaining = 8;
  }
  function scanNearby() {
    const p = walker.position;
    let best = null,
      score = Infinity;
    for (const point of points) {
      const dx = point.x - p.x,
        dz = point.z - p.z,
        distance = Math.hypot(dx, dz);
      const dy = point.y - 2.45;
      const facing =
        ((-Math.sin(walker.yaw) * dx - Math.cos(walker.yaw) * dz) *
          Math.cos(walker.pitch) +
          Math.sin(walker.pitch) * dy) /
        Math.max(Math.hypot(distance, dy), 0.001);
      if (distance > point.range || facing < 0.48) continue;
      // Reject interactions through another fixture, allowing the final approach
      // to the target's own surface (counter, table, bench or oven).
      let occluded = false;
      for (let d = 0.15; d < distance - 0.95; d += 0.15) {
        if (
          walker.blocked(
            p.x + (dx * d) / distance,
            p.z + (dz * d) / distance,
            0.02,
          )
        ) {
          occluded = true;
          break;
        }
      }
      if (!occluded && distance + (1 - facing) < score) {
        best = point;
        score = distance + (1 - facing);
      }
    }
    nearest = best;
    prompt.hidden = !best || paused || photo;
    if (best) prompt.querySelector("span").textContent = best.label;
    panel.classList.toggle("can-interact", !!best && !paused && !photo);
  }
  function interact() {
    if (!active || paused) return;
    scanNearby();
    if (!nearest) return;
    if (nearest.id === "door") {
      onExit();
      return;
    }
    showNote(nearest.title, nearest.text);
    onInteract?.();
  }
  async function captureMouse() {
    if (!active || paused) return;
    if (document.pointerLockElement === canvas) {
      releaseMouse();
      return;
    }
    if (!canvas.requestPointerLock) {
      showNote(
        "LOOK AROUND",
        "Drag anywhere in the room to look around. WASD moves your feet; the arrow keys let you turn.",
      );
      return;
    }
    try {
      await canvas.requestPointerLock();
    } catch {
      showNote(
        "LOOK AROUND",
        "Drag anywhere in the room to look around. Free look is unavailable in this browser.",
      );
    }
  }
  document.addEventListener("pointerlockchange", () => {
    const locked = document.pointerLockElement === canvas;
    if (!locked) {
      pointerLockReleasedAt = performance.now();
      clearInput();
    }
    panel.classList.toggle("mouse-captured", locked);
    $("#bakery-look").setAttribute("aria-pressed", String(locked));
  });
  canvas.addEventListener("pointerdown", (e) => {
    if (!active || paused || e.button !== 0) return;
    canvas.focus({ preventScroll: true });
    if (document.pointerLockElement === canvas) {
      interact();
      return;
    }
    if (dragging) return;
    dragging = { id: e.pointerId, x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  document.addEventListener("pointermove", (e) => {
    if (!active || paused) return;
    if (document.pointerLockElement === canvas)
      walker.look(-e.movementX * 0.0025, -e.movementY * 0.0025);
    else if (dragging?.id === e.pointerId) {
      walker.look(
        -(e.clientX - dragging.x) * 0.0035,
        -(e.clientY - dragging.y) * 0.0035,
      );
      dragging.x = e.clientX;
      dragging.y = e.clientY;
    }
  });
  const stopDrag = (e) => {
    if (dragging?.id === e.pointerId) dragging = null;
  };
  canvas.addEventListener("pointerup", stopDrag);
  canvas.addEventListener("pointercancel", stopDrag);
  canvas.addEventListener("lostpointercapture", stopDrag);
  panel.querySelectorAll("[data-walk]").forEach((button) => {
    button.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (!active || paused) return;
      button.setPointerCapture(e.pointerId);
      touch.set(e.pointerId, button.dataset.walk);
    });
    const release = (e) => touch.delete(e.pointerId);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  });
  $("#bakery-menu").onclick = () => setPaused(true);
  $("#bakery-resume").onclick = () => setPaused(false);
  $("#bakery-look").onclick = captureMouse;
  $("#bakery-interact").onclick = interact;
  $("#bakery-exit").onclick = onExit;
  $("#bakery-photo").onclick = () => setPhoto(!photo);
  $(".bakery-photo-return").onclick = () => setPhoto(false);
  $("#bakery-light").onclick = () => {
    night = !night;
    bakery.setNight(night);
    $("#bakery-light").textContent = night ? "Golden afternoon" : "After hours";
    $("#bakery-light").setAttribute("aria-pressed", String(night));
  };
  panel.hidden = true;
  // Benchmark overrides for attributing render cost; empty in normal play.
  const overrides = {};

  return {
    get active() {
      return active;
    },
    enter() {
      active = true;
      paused = false;
      panel.hidden = false;
      walker.reset();
      clearInput();
      bob = 0;
      lastStepDistance = 0;
      nearest = null;
      noteRemaining = 0;
      $("#bakery-note").hidden = true;
      document.querySelector("#game").classList.add("in-bakery");
      canvas.setAttribute(
        "aria-label",
        "Inside The Daily Loaf. WASD to walk, drag to look, arrow keys to turn, E to interact, Escape to pause.",
      );
      this.resize();
      canvas.focus({ preventScroll: true });
    },
    exit() {
      active = false;
      releaseMouse();
      clearInput();
      setPaused(false);
      setPhoto(false);
      panel.hidden = true;
      document.querySelector("#game").classList.remove("in-bakery");
      canvas.setAttribute(
        "aria-label",
        "Interactive village. Move with WASD or arrow keys, interact with E.",
      );
      canvas.focus({ preventScroll: true });
    },
    key(event) {
      const key = event.key.toLowerCase();
      if (event.target.matches("input,select,textarea")) return;
      if (key === "escape") {
        event.preventDefault();
        if (event.repeat) return;
        if (document.pointerLockElement === canvas) {
          releaseMouse();
          return;
        }
        if (performance.now() - pointerLockReleasedAt < 250) return;
        if (photo) setPhoto(false);
        else setPaused(!paused);
        return;
      }
      if (key === "p" && !event.repeat) {
        setPhoto(!photo);
        return;
      }
      if (paused) return;
      if (key === "e" && !event.repeat) {
        event.preventDefault();
        interact();
        return;
      }
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "shift",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
          "pageup",
          "pagedown",
        ].includes(key)
      ) {
        event.preventDefault();
        keys.add(key);
      }
    },
    keyUp(event) {
      keys.delete(event.key.toLowerCase());
    },
    blur() {
      clearInput();
    },
    resize() {
      camera.aspect = innerWidth / innerHeight;
      camera.fov = camera.aspect < 0.8 ? 78 : 66;
      camera.updateProjectionMatrix();
      const quality = document.querySelector("#quality").value;
      ao.enabled = overrides.ao ?? quality !== "performance";
      bloom.enabled = overrides.bloom ?? quality !== "performance";
      ao.resolutionScale = overrides.aoScale ?? 0.5;
      ao.setKernelSize(overrides.aoSamples ?? 12);
      const shadowSize =
        overrides.sunShadow ?? (quality === "high" ? 2048 : 1024);
      if (bakery.sun.shadow.mapSize.x !== shadowSize) {
        bakery.sun.shadow.mapSize.setScalar(shadowSize);
        bakery.sun.shadow.map?.dispose();
        bakery.sun.shadow.map = null;
      }
      bakery.windowLight.castShadow = overrides.windowShadow ?? true;
      for (const light of shadowLights)
        light.shadow.autoUpdate = overrides.shadowRefresh === 0;
      refreshShadows();
      // 2x MSAA slightly steps curved edges at these ratios; high keeps 4x.
      const samples = overrides.samples ?? (quality === "high" ? 4 : 2);
      for (const target of [composer.renderTarget1, composer.renderTarget2])
        if (target.samples !== samples) {
          target.samples = samples;
          target.dispose();
        }
      // The village sets its quality's full pixel ratio while the bakery is open.
      composer.setPixelRatio(overrides.pixelRatio ?? renderer.getPixelRatio());
      composer.setSize(innerWidth, innerHeight);
    },
    tune(settings) {
      for (const [key, value] of Object.entries(settings))
        if (value == null) delete overrides[key];
        else overrides[key] = value;
      this.resize();
      return this.diagnostics().render;
    },
    update(dt, time, motion) {
      let moved = 0;
      if (!paused) {
        const held = (action) => [...touch.values()].includes(action);
        const forward =
          Number(keys.has("w") || keys.has("arrowup") || held("forward")) -
          Number(keys.has("s") || keys.has("arrowdown") || held("back"));
        const strafe =
          Number(keys.has("d") || held("right")) -
          Number(keys.has("a") || held("left"));
        walker.look(
          ((keys.has("arrowleft") ? 1 : 0) - (keys.has("arrowright") ? 1 : 0)) *
            dt *
            1.65,
          ((keys.has("pageup") ? 1 : 0) - (keys.has("pagedown") ? 1 : 0)) * dt,
        );
        moved = walker.update(dt, forward, strafe, keys.has("shift"));
      }
      const bobTarget =
        motion && moved > 0.0001 ? Math.sin(walker.distance * 8) * 0.016 : 0;
      bob = T.MathUtils.lerp(bob, bobTarget, 1 - Math.exp(-dt * 12));
      camera.position.set(walker.position.x, 2.45 + bob, walker.position.z);
      camera.rotation.set(walker.pitch, walker.yaw, 0, "YXZ");
      if (walker.distance - lastStepDistance > 0.75) {
        onStep?.();
        lastStepDistance = walker.distance;
      }
      if (noteRemaining > 0 && !paused) {
        noteRemaining -= dt;
        if (noteRemaining <= 0) $("#bakery-note").hidden = true;
      }
      scanNearby();
      shadowClock += dt;
      if (motion !== shadowMotion) {
        // Reduced motion poses the cat and mobile at rest; capture that once.
        shadowMotion = motion;
        refreshShadows();
      } else if (motion && shadowClock > (overrides.shadowRefresh ?? 0.125)) {
        shadowLights[shadowTurn].shadow.needsUpdate = true;
        shadowTurn = (shadowTurn + 1) % shadowLights.length;
        shadowClock = 0;
      }
      bakery.update(time, motion);
      bakery.scene.updateMatrixWorld();
      renderer.toneMappingExposure = 1.05;
      renderer.info.reset();
      composer.render();
    },
    diagnostics: () => ({
      active,
      mode: "first-person",
      position: { ...walker.position },
      yaw: walker.yaw,
      pitch: walker.pitch,
      nearest: nearest?.id || null,
      paused,
      night,
      photo,
      pointerLocked: document.pointerLockElement === canvas,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      render: {
        pixelRatio: composer._pixelRatio,
        width: composer.renderTarget1.width,
        height: composer.renderTarget1.height,
        samples: composer.renderTarget1.samples,
        ao: ao.enabled,
        aoWidth: ao.width,
        aoSamples: ao.kernel.length,
        bloom: bloom.enabled,
        sunShadow: bakery.sun.shadow.mapSize.x,
        shadowAutoUpdate: bakery.sun.shadow.autoUpdate,
      },
    }),
  };
}
