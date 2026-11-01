// Frame-time overlay for finding stutters on devices without developer tools,
// such as tablets: open the game with ?hud. It shows the frame rate and the
// slowest frames of the last few seconds, and logs every stall with what
// changed in the frame before it (pixel ratio, shaders, uploads, shadow
// fit, streaming, view). "Copy" puts the log on the clipboard to paste
// into a report. Loaded only with ?hud, so normal play never pays for it.
const STALL = 45, // Two missed refreshes at 60 Hz.
  WINDOW = 5000,
  LOG = 40;

/**
 * `probe()` returns the frame's state as a flat object of numbers and
 * strings; a stall lists the keys whose values changed in the frame before.
 */
export function createHud(probe) {
  const panel = document.createElement("div");
  panel.id = "hud";
  Object.assign(panel.style, {
    position: "fixed",
    left: "8px",
    bottom: "8px",
    zIndex: 1000,
    maxWidth: "min(92vw, 520px)",
    maxHeight: "45vh",
    overflow: "auto",
    padding: "6px 8px",
    font: "11px/1.35 ui-monospace, Menlo, monospace",
    color: "#f4f1e6",
    background: "rgba(20, 24, 18, 0.78)",
    borderRadius: "6px",
    whiteSpace: "pre-wrap",
    pointerEvents: "auto",
  });
  const summary = document.createElement("div"),
    buttons = document.createElement("div"),
    list = document.createElement("div");
  const button = (label, onclick) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.onclick = (event) => {
      event.stopPropagation();
      onclick(b);
    };
    Object.assign(b.style, { font: "inherit", marginRight: "6px", padding: "2px 8px" });
    buttons.append(b);
  };
  panel.append(summary, buttons, list);
  document.body.append(panel);
  // Taps on the panel must not walk the player.
  for (const type of ["pointerdown", "pointerup", "click", "touchstart"])
    panel.addEventListener(type, (event) => event.stopPropagation());

  const start = performance.now(),
    frames = [], // [time, interval, cpu]
    stalls = [];
  let previous = null,
    previousFrame = null,
    last = 0,
    lastDraw = 0;
  const elapsed = (t) => ((t - start) / 1000).toFixed(1);
  const describe = (state) =>
    Object.entries(state)
      .map(([key, value]) => `${key} ${value}`)
      .join(", ");
  function report() {
    const now = performance.now(),
      recent = frames.filter(([t]) => now - t < WINDOW),
      intervals = recent.map(([, i]) => i).sort((a, b) => a - b),
      cpu = recent.map(([, , c]) => c).sort((a, b) => a - b),
      at = (list, q) => (list.length ? list[Math.floor((list.length - 1) * q)] : 0),
      over = (ms) => intervals.filter((i) => i > ms).length,
      fps = intervals.length / Math.min(WINDOW / 1000, (now - start) / 1000);
    return (
      `${navigator.userAgent}\n` +
      `${innerWidth}×${innerHeight} css, devicePixelRatio ${devicePixelRatio}\n` +
      `t ${elapsed(now)} s, last ${WINDOW / 1000} s: ${fps.toFixed(0)} fps, ` +
      `frame median ${at(intervals, 0.5).toFixed(1)} / p95 ${at(intervals, 0.95).toFixed(1)} / max ${at(intervals, 1).toFixed(1)} ms, ` +
      `script median ${at(cpu, 0.5).toFixed(1)} / max ${at(cpu, 1).toFixed(1)} ms, ` +
      `over 20 ms ${over(20)}, over 34 ms ${over(34)}, over ${STALL} ms ${over(STALL)}\n` +
      (previous ? describe(previous) : "")
    );
  }
  function logText() {
    return (
      report() +
      `\n\nStalls (${stalls.length}${stalls.length >= LOG ? "+, newest kept" : ""}):\n` +
      stalls.join("\n")
    );
  }
  button("Copy", async (b) => {
    const text = logText();
    try {
      await navigator.clipboard.writeText(text);
      b.textContent = "Copied";
    } catch {
      // Older Safari: select the text for a manual copy instead.
      list.textContent = text;
      getSelection().selectAllChildren(list);
      b.textContent = "Selected";
    }
    setTimeout(() => (b.textContent = "Copy"), 1500);
  });
  button("Clear", () => {
    stalls.length = 0;
    frames.length = 0;
  });
  button("Hide", (b) => {
    const hidden = (list.style.display = list.style.display ? "" : "none");
    summary.style.display = list.style.display;
    b.textContent = hidden ? "Show" : "Hide";
  });

  return {
    /** Call once per outdoor frame, after it is drawn. */
    frame(now, cpu) {
      const interval = last ? now - last : 0;
      last = now;
      const state = probe(),
        changed = previous
          ? Object.keys(state)
              .filter((key) => state[key] !== previous[key])
              .map((key) => `${key} ${previous[key]}→${state[key]}`)
              .join(", ")
          : "";
      if (interval) {
        frames.push([now, interval, cpu]);
        while (frames.length && now - frames[0][0] > WINDOW) frames.shift();
      }
      // A long interval ends at this frame. The work behind it was usually
      // the previous frame's (script or GPU), or a pause between frames.
      if (interval > STALL && previousFrame)
        stalls.push(
          `${elapsed(now)} s: ${interval.toFixed(0)} ms. Frame before: script ` +
            `${previousFrame.cpu.toFixed(1)} ms, ${previousFrame.changed || "no change"}. ` +
            `This frame: script ${cpu.toFixed(1)} ms, ${changed || "no change"} | ${describe(state)}`,
        );
      if (stalls.length > LOG) stalls.shift();
      previous = state;
      previousFrame = { cpu, changed };
      if (now - lastDraw > 500) {
        lastDraw = now;
        summary.textContent = report().split("\n").slice(2).join("\n");
        if (list.style.display !== "none" && !getSelection().toString())
          list.textContent = stalls.slice(-8).reverse().join("\n");
      }
    },
  };
}
