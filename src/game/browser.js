// The page as an app on phones and tablets: full screen where the browser
// allows it, a nudge toward the Home Screen on iPhone (whose Safari cannot go
// full screen), and nothing the browser's own gestures can grab. The pinch
// that would zoom the page is stopped in touch-controls.js; the stylesheet
// keeps the page from scrolling or bouncing (see `.touch` in style.css).

const $ = (s) => document.querySelector(s);

/** True when the game was opened from the Home Screen, or is full screen there. */
export const isStandalone = () =>
  matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches ||
  navigator.standalone === true;

const fullscreenElement = () =>
  document.fullscreenElement ?? document.webkitFullscreenElement ?? null;

function canFullscreen() {
  const root = document.documentElement;
  return !!(
    (document.fullscreenEnabled || document.webkitFullscreenEnabled) &&
    (root.requestFullscreen || root.webkitRequestFullscreen)
  );
}

async function toggleFullscreen() {
  const root = document.documentElement;
  if (fullscreenElement())
    await (document.exitFullscreen ?? document.webkitExitFullscreen)?.call(document);
  else await (root.requestFullscreen ?? root.webkitRequestFullscreen)?.call(root, { navigationUI: "hide" });
}

/** True on iPhone and iPod, whose Safari has no full screen for pages. */
const isIPhone = () => /iPhone|iPod/.test(navigator.userAgent);
/** True on iPhone and iPad, including an iPad whose Safari reports a Mac. */
const isAppleTouch = () =>
  isIPhone() ||
  /iPad/.test(navigator.userAgent) ||
  (/Mac/.test(navigator.platform) && navigator.maxTouchPoints > 1);

/**
 * The size the game fills, in CSS pixels. Opened from the Home Screen, an
 * iPhone's or iPad's Safari can lay the page out shorter than the screen, by
 * about the status bar's height, and leave a strip of bare page under the
 * game. There the screen's own height is used, and `--app-height` on <html>
 * tells the stylesheet (`.standalone` in style.css). A window narrower than
 * the screen, such as an iPad app in Split View or Stage Manager, keeps the
 * window's size.
 */
export function viewportSize() {
  const width = innerWidth;
  let height = innerHeight;
  if (isAppleTouch() && isStandalone()) {
    const long = Math.max(screen.width, screen.height),
      short = Math.min(screen.width, screen.height),
      landscape = width > height,
      screenWidth = landscape ? long : short,
      screenHeight = landscape ? short : long;
    if (Math.abs(screenWidth - width) < 2 && screenHeight > height && screenHeight - height < 160)
      height = screenHeight;
  }
  document.documentElement.style.setProperty("--app-height", `${height}px`);
  return { width, height };
}

/**
 * Wires the settings' full-screen button and Home Screen note, and resizes
 * once a turned device has settled. `onResize()` refits the game to the screen;
 * `toast(text)` shows a passing note.
 */
export function setupBrowser({ canvas, onResize, toast }) {
  const root = document.documentElement;
  root.classList.toggle("standalone", isStandalone());

  const button = $("#fullscreen");
  const updateButton = () => {
    const on = !!fullscreenElement();
    button.setAttribute("aria-pressed", String(on));
    button.lastChild.textContent = on ? "Leave full screen" : "Full screen";
  };
  button.hidden = !canFullscreen() || isStandalone();
  button.onclick = async () => {
    try {
      await toggleFullscreen();
    } catch {
      toast("This browser can't go full screen here.");
    }
  };
  for (const type of ["fullscreenchange", "webkitfullscreenchange"])
    document.addEventListener(type, () => {
      updateButton();
      onResize();
    });
  updateButton();
  // iPhone's Safari can only go full screen from the Home Screen.
  $("#home-screen-tip").hidden = isStandalone() || canFullscreen() || !isIPhone();

  // A long press on the scene would offer to save an image or select text.
  canvas.addEventListener("contextmenu", (e) => {
    if (root.classList.contains("touch")) e.preventDefault();
  });
  // A quick second tap would zoom the page in browsers that ignore touch-action.
  document.addEventListener(
    "dblclick",
    (e) => {
      if (root.classList.contains("touch")) e.preventDefault();
    },
    { passive: false },
  );
  // Sizes read during a turn can be the old ones; read them again once it settles.
  const settle = () => setTimeout(onResize, 250);
  screen.orientation?.addEventListener?.("change", settle);
  window.addEventListener("orientationchange", settle);
}
