import {
  CONTROL_MODES,
  isTap,
  prefersTouch,
  STICK_RADIUS,
  stickVector,
  twoFinger,
  twoFingerModes,
} from "./touch.js";

// Touch mode: the controls an iPhone or iPad gets in place of the mouse and
// keyboard. It is on when the device's main pointer is a finger (see
// prefersTouch in touch.js), or when the player picks it in settings, and it
// marks <html> with the class `touch` for the stylesheet. Desktop input is
// untouched while it is off.
//
// - Village view: tap walks or talks, as a click does; one finger drags the
//   map, two pinch to zoom, twist to turn it and slide up or down to tilt it.
// - First person, outdoors and in the rooms: a thumbstick appears wherever
//   the left thumb lands, and a drag anywhere else looks around.

const STORAGE_KEY = "willowmere-controls";
const TIPS_KEY = "willowmere-touch-tips";
// Radians of look per CSS pixel dragged.
export const TOUCH_LOOK = 0.0042;

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private windows may refuse storage; the choice lasts for the visit.
  }
}

/** The player's controls choice: `?touch=1` or `?touch=0` wins, then settings. */
export function controlMode() {
  const param = new URLSearchParams(location.search).get("touch");
  if (param === "1" || param === "on") return "touch";
  if (param === "0" || param === "off") return "desktop";
  const saved = readStorage(STORAGE_KEY);
  return CONTROL_MODES.includes(saved) ? saved : "auto";
}

/** True when this device, with the player's choice, uses touch mode. */
export function touchModeFor(mode = controlMode()) {
  return prefersTouch(
    {
      coarse: matchMedia("(pointer: coarse)").matches,
      maxTouchPoints: navigator.maxTouchPoints || 0,
      platform: navigator.platform || "",
      userAgent: navigator.userAgent,
    },
    mode,
  );
}

/** Applies touch mode to the page; returns whether it is on. */
export function applyTouchMode(mode = controlMode()) {
  const on = touchModeFor(mode);
  document.documentElement.classList.toggle("touch", on);
  return on;
}

export function saveControlMode(mode) {
  writeStorage(STORAGE_KEY, mode);
}

export const isTouchMode = () => document.documentElement.classList.contains("touch");

/** Shows a tip once per device, the first time `id` comes up. */
export function tipOnce(id, show) {
  const seen = (readStorage(TIPS_KEY) || "").split(",");
  if (seen.includes(id)) return;
  writeStorage(TIPS_KEY, [...seen.filter(Boolean), id].join(","));
  show();
}

/**
 * A thumbstick that appears where a thumb lands in the screen's lower left,
 * and rests faintly in the corner otherwise. `value` is the deflection from
 * `stickVector`: x right, y down, magnitude 0 to 1.
 */
export function createThumbstick(host) {
  const base = document.createElement("div");
  base.className = "thumbstick";
  base.setAttribute("aria-hidden", "true");
  base.innerHTML = "<i></i>";
  host.append(base);
  const knob = base.firstChild;
  const value = { x: 0, y: 0, magnitude: 0 };
  let id = null,
    originX = 0,
    originY = 0;
  function release() {
    id = null;
    Object.assign(value, { x: 0, y: 0, magnitude: 0 });
    base.classList.remove("held");
    base.style.left = base.style.top = "";
    knob.style.transform = "";
  }
  return {
    value,
    get active() {
      return id !== null;
    },
    /** Takes a finger that lands in the stick's half of the screen. */
    claim(e) {
      if (id !== null || e.clientX > innerWidth * 0.45 || e.clientY < innerHeight * 0.3)
        return false;
      id = e.pointerId;
      originX = e.clientX;
      originY = e.clientY;
      base.classList.add("held");
      base.style.left = `${originX}px`;
      base.style.top = `${originY}px`;
      return true;
    },
    move(e) {
      if (e.pointerId !== id) return false;
      const dx = e.clientX - originX,
        dy = e.clientY - originY,
        reach = Math.min(1, STICK_RADIUS / Math.max(1, Math.hypot(dx, dy)));
      Object.assign(value, stickVector(dx, dy));
      knob.style.transform = `translate(${dx * reach}px, ${dy * reach}px)`;
      return true;
    },
    end(e) {
      if (e && e.pointerId !== id) return false;
      if (id !== null) release();
      return true;
    },
    reset: release,
  };
}

/**
 * The outdoor game's touch input on the canvas. `enabled()` says whether
 * touch mode is on; `blocked()` whether something else has the screen (a room,
 * a conversation, a dialog); `firstPerson()` which view is showing, and
 * `canWalk()` whether the thumbstick may take a finger (not in photo mode).
 * `onTap(e)` acts on a tap as a click would, `onLook(dx, dy)` turns the head
 * in radians, and `onPress()` runs when a finger lands.
 */
export function createTouchControls({
  canvas,
  host,
  overview,
  enabled,
  blocked,
  firstPerson,
  canWalk = () => true,
  onTap,
  onLook,
  onPress,
}) {
  const stick = createThumbstick(host);
  // Fingers on the canvas, by pointer id.
  const fingers = new Map();
  // A two-finger gesture on the map: where it began and what it is doing.
  let pair = null,
    // The finger turning the head in first person.
    lookId = null;

  function reset() {
    for (const id of fingers.keys())
      if (canvas.hasPointerCapture?.(id)) canvas.releasePointerCapture(id);
    fingers.clear();
    pair = null;
    lookId = null;
    stick.reset();
  }

  function startPair() {
    const [a, b] = [...fingers.values()];
    pair = {
      a: { x: a.x, y: a.y },
      b: { x: b.x, y: b.y },
      view: overview.pose(),
      modes: undefined,
      twistFrom: 0,
      tiltFrom: 0,
    };
    for (const f of fingers.values()) f.gesture = true;
  }

  function updatePair() {
    const [a, b] = [...fingers.values()];
    const g = twoFinger(pair.a, pair.b, a, b);
    const before = pair.modes;
    pair.modes = twoFingerModes(g, pair.modes);
    if (pair.modes.twist && !before?.twist) pair.twistFrom = g.rotation;
    if (pair.modes.tilt && !before?.tilt) pair.tiltFrom = g.dy;
    const { view } = pair;
    overview.place({
      zoom: pair.modes.zoom ? view.zoom / g.scale : view.zoom,
      yaw: pair.modes.twist ? view.yaw + ((g.rotation - pair.twistFrom) * 180) / Math.PI : view.yaw,
      tilt: pair.modes.tilt ? view.tilt + (g.dy - pair.tiltFrom) * 0.18 : view.tilt,
    });
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (!enabled() || blocked()) return;
    e.preventDefault();
    onPress?.();
    if (firstPerson()) {
      if (canWalk() && stick.claim(e)) {
        canvas.setPointerCapture(e.pointerId);
        return;
      }
      if (lookId !== null) return;
      lookId = e.pointerId;
    } else if (fingers.size >= 2) return;
    fingers.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      moved: 0,
      gesture: false,
    });
    canvas.setPointerCapture(e.pointerId);
    if (!firstPerson() && fingers.size === 2) startPair();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!enabled()) return;
    if (stick.move(e)) return;
    const f = fingers.get(e.pointerId);
    if (!f) return;
    const dx = e.clientX - f.x,
      dy = e.clientY - f.y;
    f.x = e.clientX;
    f.y = e.clientY;
    f.moved = Math.max(f.moved, Math.hypot(f.x - f.startX, f.y - f.startY));
    if (blocked()) return;
    if (firstPerson()) {
      if (e.pointerId === lookId) onLook(-dx * TOUCH_LOOK, -dy * TOUCH_LOOK);
      return;
    }
    if (pair) updatePair();
    // One finger drags the map once it has clearly left the spot it pressed.
    else if (f.gesture || !isTap(f.moved)) {
      f.gesture = true;
      overview.dragBy(dx, dy, canvas.clientHeight);
    }
  });

  function lift(e) {
    if (stick.end(e)) return;
    const f = fingers.get(e.pointerId);
    if (!f) return;
    fingers.delete(e.pointerId);
    if (e.pointerId === lookId) lookId = null;
    if (pair) {
      // The finger left behind carries on as a drag, from where it is.
      pair = null;
      return;
    }
    if (e.type === "pointerup" && !f.gesture && isTap(f.moved) && enabled() && !blocked())
      onTap(e);
  }
  canvas.addEventListener("pointerup", lift);
  canvas.addEventListener("pointercancel", lift);
  canvas.addEventListener("lostpointercapture", (e) => {
    if (fingers.has(e.pointerId) || stick.active) lift(e);
  });
  // iOS Safari zooms the page on its own pinch gestures unless told not to.
  for (const type of ["gesturestart", "gesturechange"])
    document.addEventListener(type, (e) => enabled() && e.preventDefault(), { passive: false });

  return {
    stick,
    reset,
    /** What the tests read: fingers down, the stick and any gesture. */
    diagnostics: () => ({
      fingers: fingers.size,
      stick: { ...stick.value, active: stick.active },
      gesture: pair?.modes ? { ...pair.modes } : null,
    }),
  };
}
