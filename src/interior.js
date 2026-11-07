import * as T from "three";
import { createThumbstick, isTouchMode, TOUCH_LOOK } from "./game/touch-controls.js";
import { viewportSize } from "./game/browser.js";
import { STICK_RUN } from "./game/touch.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { SoftBloomPass, BloomOutputPass } from "./bloom.js";
import { InteriorAO } from "./interior-ao.js";
import { sceneTargetOptions } from "./scene-target.js";
import { createBakery } from "./bakery.js";
import { createRosewood } from "./rosewood.js";
import { createHeronRoom } from "./pub/room.js";
import { createWindmillRoom } from "./windmill/room.js";
import { createPostOffice } from "./post-office/room.js";
import { createThistledownRoom } from "./thistledown/room.js";
import { createInteriorWalker } from "./interior-movement.js";
import "./interior.css";

// The walkable interiors share one camera, input, postprocessing chain and
// panel. Each room (the bakery, Rosewood, the inn, the windmill, the post office,
// the B&B) is built the first time it opens
// and supplies its scene, lights, walkable layout, the points E answers at,
// and its own animation; `state` and `save` are the visit's progress.
const ROOMS = {
  bakery: () => createBakery(),
  rosewood: (progress) => createRosewood(progress),
  heron: () => createHeronRoom(),
  windmill: () => createWindmillRoom(),
  "post-office": (progress) => createPostOffice(progress),
  thistledown: () => createThistledownRoom(),
};

export function createInterior({
  renderer,
  onExit,
  onStep,
  onInteract,
  state,
  save,
}) {
  const rooms = new Map();
  let room = null,
    walker = null;
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
  environment.dispose();
  pmrem.dispose();
  // Every room's shadowing lights are fixed and almost everything they light
  // is merged static geometry. Their maps refresh in turn a few times a
  // second for the slow movers (the bakery's cat and star mobile), instead of
  // re-rendering the room once per light every frame.
  let shadowLights = [];
  let shadowClock = 0,
    shadowTurn = 0,
    shadowMotion = true;
  function refreshShadows() {
    for (const light of shadowLights) light.shadow.needsUpdate = true;
    shadowClock = 0;
  }
  function openRoom(id) {
    if (!rooms.has(id)) {
      const built = ROOMS[id]({ state, save });
      built.id = id;
      built.scene.matrixWorldAutoUpdate = false;
      built.scene.environment = environmentTarget.texture;
      built.scene.environmentIntensity = built.environmentIntensity ?? 0.24;
      for (const light of built.shadowLights) light.shadow.autoUpdate = false;
      rooms.set(id, { room: built, walker: createInteriorWalker(built.layout) });
    }
    ({ room, walker } = rooms.get(id));
    shadowLights = room.shadowLights;
    renderPass.scene = room.scene;
    ao.scene = room.scene;
  }
  const renderTarget = new T.WebGLRenderTarget(innerWidth, innerHeight, {
    samples: 2,
    ...sceneTargetOptions(renderer, 4),
  });
  const composer = new EffectComposer(renderer, renderTarget);
  const renderPass = new RenderPass(new T.Scene(), camera);
  composer.addPass(renderPass);
  const ao = new InteriorAO(renderPass.scene, camera, innerWidth, innerHeight, 12);
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
    <header class="bakery-heading"><span>WILLOWMERE</span><h1></h1></header>
    <nav class="bakery-actions" aria-label="Room controls">
      <button id="bakery-look" aria-pressed="false">Free look <span aria-hidden="true">⌖</span></button>
      <button id="bakery-menu" aria-label="Pause your visit">Pause <kbd>Esc</kbd></button>
    </nav>
    <div class="bakery-crosshair" aria-hidden="true"><i></i></div>
    <button id="bakery-interact" hidden><kbd>E</kbd><span></span></button>
    <div id="bakery-note" role="status" hidden><span></span><p></p></div>
    <footer class="bakery-help"><span class="desktop-only"><b>WASD</b> walk <i>·</i> <b>Drag</b> look <i>·</i> <b>E</b> interact</span><span class="touch-only"><b>Left thumb</b> walk <i>·</i> <b>Drag</b> look</span><span>Make yourself at home.</span></footer>
    <div class="bakery-touch" role="group">
      <button data-walk="forward" aria-label="Walk forward">↑</button>
      <button data-walk="left" aria-label="Step left">←</button>
      <button data-walk="back" aria-label="Walk backward">↓</button>
      <button data-walk="right" aria-label="Step right">→</button>
    </div>
    <button class="bakery-photo-return" hidden>Return to your visit <kbd>P</kbd></button>
    <dialog id="bakery-pause" aria-labelledby="bakery-pause-title">
      <span class="bakery-eyebrow">A MOMENT TO YOURSELF</span><h2 id="bakery-pause-title">Stay a little longer.</h2>
      <p class="desktop-only">Walk with WASD. Drag to look around, or turn with ← and →. Press E near something that catches your eye.</p><p class="touch-only">Hold the lower left of the screen and lean your thumb to walk, or to the rim to hurry. Drag anywhere else to look around, and tap the button that appears near something that catches your eye.</p>
      <button id="bakery-resume">Keep wandering <span>→</span></button>
      <div class="bakery-pause-options"><button id="bakery-light" aria-pressed="false">After hours</button><button id="bakery-photo" aria-pressed="false">Photo <kbd>P</kbd></button></div>
      <button id="bakery-exit">Return to the village</button>
    </dialog>
  `;
  document.querySelector("#game").append(panel);
  const $ = (selector) => panel.querySelector(selector);
  // Touch mode walks with a thumbstick in place of the arrow pad.
  const stick = createThumbstick(panel);
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
  function clearInput() {
    keys.clear();
    touch.clear();
    stick.reset();
    walker?.stop();
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
  // A room with stairs says how high the eye stands; the rest stand level.
  const eyeHeight = () => room.eyeAt?.(walker) ?? 2.45;
  function scanNearby() {
    const p = walker.position;
    let best = null,
      score = Infinity;
    for (const point of room.points) {
      if (point.available && !point.available()) continue;
      const dx = point.x - p.x,
        dz = point.z - p.z,
        distance = Math.hypot(dx, dz);
      const dy = point.y - eyeHeight();
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
      // A fallback point (Rosewood's ball throw, which is always in front of
      // the visitor) answers only when nothing else does.
      const value = distance + (1 - facing) + (point.fallback ? 100 : 0);
      if (!occluded && value < score) {
        best = point;
        score = value;
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
    // A room answers its own activities; a plain point shows its note.
    const result = room.interact?.(nearest) ?? nearest;
    if (result.night !== undefined) setNight(result.night);
    if (result.title) showNote(result.title, result.text);
    onInteract?.(result.sound);
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
    if (isTouchMode() && stick.claim(e)) {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (dragging) return;
    dragging = { id: e.pointerId, x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  document.addEventListener("pointermove", (e) => {
    if (!active || paused) return;
    if (stick.move(e)) return;
    if (document.pointerLockElement === canvas)
      walker.look(-e.movementX * 0.0025, -e.movementY * 0.0025);
    else if (dragging?.id === e.pointerId) {
      const rate = isTouchMode() ? TOUCH_LOOK : 0.0035;
      walker.look(
        -(e.clientX - dragging.x) * rate,
        -(e.clientY - dragging.y) * rate,
      );
      dragging.x = e.clientX;
      dragging.y = e.clientY;
    }
  });
  const stopDrag = (e) => {
    if (stick.end(e)) return;
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
  function setNight(value) {
    night = room.night = value;
    room.setNight(night);
    $("#bakery-light").textContent = room.nightLabels[night ? 1 : 0];
    $("#bakery-light").setAttribute("aria-pressed", String(night));
  }
  $("#bakery-light").onclick = () => setNight(!night);
  panel.hidden = true;
  // Benchmark overrides for attributing render cost; empty in normal play.
  const overrides = {};

  return {
    get active() {
      return active;
    },
    get room() {
      return room?.id ?? null;
    },
    enter(id = "bakery") {
      openRoom(id);
      night = !!room.night;
      $(".bakery-heading h1").textContent = room.title;
      panel.setAttribute("aria-label", room.ariaLabel);
      $(".bakery-touch").setAttribute("aria-label", room.touchLabel);
      $("#bakery-menu").setAttribute("aria-label", room.pauseLabel);
      $("#bakery-light").textContent = room.nightLabels[night ? 1 : 0];
      $("#bakery-light").setAttribute("aria-pressed", String(night));
      room.enter?.();
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
        `${room.ariaLabel}. WASD to walk, drag to look, arrow keys to turn, E to interact, Escape to pause.`,
      );
      this.resize();
      canvas.focus({ preventScroll: true });
    },
    exit() {
      room?.leave?.();
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
      const { width, height } = viewportSize();
      camera.aspect = width / height;
      camera.fov = camera.aspect < 0.8 ? 78 : 66;
      camera.updateProjectionMatrix();
      const quality = document.querySelector("#quality").value;
      ao.enabled = overrides.ao ?? quality !== "performance";
      bloom.enabled = overrides.bloom ?? quality !== "performance";
      ao.resolutionScale = overrides.aoScale ?? 0.5;
      ao.setKernelSize(overrides.aoSamples ?? 12);
      if (!room) return;
      const shadowSize =
        overrides.sunShadow ?? (quality === "high" ? 2048 : 1024);
      if (room.sun.shadow.mapSize.x !== shadowSize) {
        room.sun.shadow.mapSize.setScalar(shadowSize);
        room.sun.shadow.map?.dispose();
        room.sun.shadow.map = null;
      }
      if (room.windowLight)
        room.windowLight.castShadow = overrides.windowShadow ?? true;
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
      composer.setSize(width, height);
    },
    place(pose) {
      walker?.place(pose);
      room?.place?.(pose);
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
        let forward =
          Number(keys.has("w") || keys.has("arrowup") || held("forward")) -
          Number(keys.has("s") || keys.has("arrowdown") || held("back"));
        let strafe =
          Number(keys.has("d") || held("right")) -
          Number(keys.has("a") || held("left"));
        // The thumbstick walks as far as it leans, and runs at its rim.
        const lean = stick.value;
        if (lean.magnitude > 0) {
          forward = -lean.y;
          strafe = lean.x;
        }
        walker.look(
          ((keys.has("arrowleft") ? 1 : 0) - (keys.has("arrowright") ? 1 : 0)) *
            dt *
            1.65,
          ((keys.has("pageup") ? 1 : 0) - (keys.has("pagedown") ? 1 : 0)) * dt,
        );
        moved = walker.update(
          dt,
          forward,
          strafe,
          keys.has("shift") || lean.magnitude >= STICK_RUN,
        );
      }
      const bobTarget =
        motion && moved > 0.0001 ? Math.sin(walker.distance * 8) * 0.016 : 0;
      bob = T.MathUtils.lerp(bob, bobTarget, 1 - Math.exp(-dt * 12));
      camera.position.set(walker.position.x, eyeHeight() + bob, walker.position.z);
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
      } else if (
        motion &&
        !room.staticShadows &&
        shadowClock > (overrides.shadowRefresh ?? 0.125)
      ) {
        shadowLights[shadowTurn].shadow.needsUpdate = true;
        shadowTurn = (shadowTurn + 1) % shadowLights.length;
        shadowClock = 0;
      }
      room.update(time, motion, { dt, walker, moved });
      // Things that happen on their own (Bark bringing the ball back) speak too.
      const note = room.takeNote?.();
      if (note) {
        if (note.title) showNote(note.title, note.text);
        onInteract?.(note.sound);
      }
      room.scene.updateMatrixWorld();
      renderer.toneMappingExposure = room.exposure ?? 1.05;
      renderer.info.reset();
      composer.render();
    },
    diagnostics: () => ({
      active,
      room: room?.id ?? null,
      mode: "first-person",
      position: walker ? { ...walker.position } : null,
      yaw: walker?.yaw,
      pitch: walker?.pitch,
      nearest: nearest?.id || null,
      paused,
      night,
      photo,
      pointerLocked: document.pointerLockElement === canvas,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      programs: renderer.info.programs?.length ?? 0,
      render: {
        pixelRatio: composer._pixelRatio,
        width: composer.renderTarget1.width,
        height: composer.renderTarget1.height,
        samples: composer.renderTarget1.samples,
        ao: ao.enabled,
        aoWidth: ao.width,
        aoSamples: ao.kernel.length,
        bloom: bloom.enabled,
        sunShadow: room?.sun.shadow.mapSize.x,
        shadowAutoUpdate: room?.sun.shadow.autoUpdate,
      },
      ...room?.diagnostics?.(),
    }),
  };
}
