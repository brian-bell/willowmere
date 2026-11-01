// Frame-time overlay for finding stutters on devices without developer tools,
// such as tablets: open the game with ?hud. It shows the frame rate and the
// slowest frames of the last few seconds, and logs every stall with what
// changed in the frame before it (pixel ratio, shaders, uploads, shadow
// fit, streaming, view). The second row of buttons switches off one cost at
// a time through window.__willowmere.tune, and every five-second window is
// logged with what was switched off, so one session on a device attributes
// its frame time. "Copy" puts the log on the clipboard to paste into a
// report. Loaded only with ?hud, so normal play never pays for it.
const STALL = 45, // Two missed refreshes at 60 Hz.
  WINDOW = 5000,
  LOG = 40;

// Each toggle is a tune override; Ratio cycles through forced pixel ratios.
const TOGGLES = [
  ["Coarse leaves", { leafDetail: 1 }],
  ["No foliage", { foliage: false }],
  ["No water", { water: false }],
  ["Frozen shadows", { shadowUpdate: false }],
  ["No bloom", { bloom: false }],
  ["No MSAA", { samples: 0 }],
  ["No fields", { fields: false }],
];
const RATIOS = [null, 1, 0.75, 0.5];
// "Run test" measures each cost switched off on its own, with the game as
// played measured between them, so a device that changes speed partway
// (heat, power saving) shows up instead of skewing one result. The last
// segment combines the cuts a lighter preset could make.
const TEST = [
  ["Coarse leaves", { leafDetail: 1 }],
  ["No foliage", { foliage: false }],
  ["No water", { water: false }],
  ["Frozen shadows", { shadowUpdate: false }],
  ["No bloom", { bloom: false }],
  ["No MSAA", { samples: 0 }],
  ["Ratio 1", { pixelRatio: 1 }],
  ["Ratio 0.75", { pixelRatio: 0.75 }],
  ["No fields", { fields: false }],
  [
    "Coarse leaves + no water + no bloom + no MSAA + ratio 1",
    { leafDetail: 1, water: false, bloom: false, samples: 0, pixelRatio: 1 },
  ],
];
const TEST_KEYS = [
    ...new Set(TEST.flatMap(([, settings]) => Object.keys(settings))),
  ],
  SETTLE = 1500;

/**
 * `probe()` returns the frame's state as a flat object of numbers and
 * strings; a stall lists the keys whose values changed in the frame before.
 * `counters()` returns draw calls and triangles, averaged per window.
 * `tune(settings)` applies benchmark overrides (null restores a default).
 */
export function createHud(probe, { counters, tune } = {}) {
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
    toggles = document.createElement("div"),
    list = document.createElement("div");
  const button = (label, onclick, row = buttons) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.onclick = (event) => {
      event.stopPropagation();
      onclick(b);
    };
    Object.assign(b.style, {
      font: "inherit",
      marginRight: "6px",
      padding: "2px 8px",
      margin: "2px 6px 2px 0",
    });
    row.append(b);
    return b;
  };
  panel.append(summary, buttons, toggles, list);
  document.body.append(panel);
  // Taps on the panel must not walk the player.
  for (const type of ["pointerdown", "pointerup", "click", "touchstart"])
    panel.addEventListener(type, (event) => event.stopPropagation());

  const start = performance.now(),
    frames = [], // [time, interval, cpu]
    stalls = [],
    windows = [],
    active = new Set();
  let ratio = 0,
    // The automatic test: its segments and results, while it runs.
    test = null,
    // The current measurement window: frame intervals, script times, counters.
    measuring = null,
    previous = null,
    previousFrame = null,
    last = 0,
    lastDraw = 0;
  const elapsed = (t) => ((t - start) / 1000).toFixed(1);
  const describe = (state) =>
    Object.entries(state)
      .map(([key, value]) => `${key} ${value}`)
      .join(", ");
  const label = () =>
    [...active, ...(RATIOS[ratio] ? [`ratio ${RATIOS[ratio]}`] : [])].join(
      " + ",
    ) || "as played";
  // Windows start a second after a toggle, once the change has settled.
  const newWindow = (now, settle = 0, name = null) =>
    (measuring = {
      name,
      from: now + settle,
      intervals: [],
      cpu: [],
      calls: 0,
      triangles: 0,
    });
  function closeWindow(now) {
    const w = measuring,
      n = w.intervals.length;
    if (n < 3) return null;
    w.intervals.sort((a, b) => a - b);
    w.cpu.sort((a, b) => a - b);
    const at = (list, q) => list[Math.floor((list.length - 1) * q)];
    windows.push(
      `${elapsed(now)} s, ${w.name ?? label()}: ${(n / ((now - w.from) / 1000)).toFixed(1)} fps, ` +
        `frame median ${at(w.intervals, 0.5).toFixed(1)} / p95 ${at(w.intervals, 0.95).toFixed(1)} ms, ` +
        `script median ${at(w.cpu, 0.5).toFixed(1)} ms` +
        (w.calls
          ? `, ${Math.round(w.calls / n)} draws, ${(w.triangles / n / 1e6).toFixed(2)}M triangles`
          : "") +
        ` | ${previous ? describe(previous) : ""}`,
    );
    return at(w.intervals, 0.5);
  }
  // Segments alternate: as played, then the next cut, then as played again.
  function startSegment(now) {
    const i = test.results.length,
      [name, settings] = i % 2 ? TEST[(i - 1) / 2] : ["As played", {}];
    tune({
      ...Object.fromEntries(TEST_KEYS.map((key) => [key, null])),
      ...settings,
    });
    newWindow(now, SETTLE, `Test ${i + 1}/${TEST.length * 2 + 1}, ${name}`);
    test.button.textContent = `Testing ${i + 1}/${TEST.length * 2 + 1}`;
  }
  function finishTest() {
    const r = test.results,
      lines = [
        "Test summary (frame median; change against the as-played runs either side):",
      ];
    for (let i = 1; i < r.length; i += 2) {
      const before = r[i - 1],
        after = r[i + 1] ?? before,
        base = (before + after) / 2,
        drift = Math.abs(after - before) / Math.min(before, after);
      lines.push(
        `${TEST[(i - 1) / 2][0]}: ${r[i].toFixed(1)} ms against ${base.toFixed(1)} ms ` +
          `(${(((r[i] - base) / base) * 100).toFixed(0)}%)` +
          (drift > 0.2
            ? `, unreliable: as played moved ${before.toFixed(0)}→${after.toFixed(0)} ms`
            : ""),
      );
    }
    windows.push(lines.join("\n"));
    tune(Object.fromEntries(TEST_KEYS.map((key) => [key, null])));
    test.button.textContent = "Run test";
    test = null;
  }
  function report() {
    const now = performance.now(),
      recent = frames.filter(([t]) => now - t < WINDOW),
      intervals = recent.map(([, i]) => i).sort((a, b) => a - b),
      cpu = recent.map(([, , c]) => c).sort((a, b) => a - b),
      at = (list, q) =>
        list.length ? list[Math.floor((list.length - 1) * q)] : 0,
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
      `\n\nFive-second windows (${windows.length}):\n` +
      windows.join("\n") +
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
    windows.length = 0;
    measuring = null;
  });
  button("Hide", (b) => {
    const hidden = (list.style.display = list.style.display ? "" : "none");
    summary.style.display = list.style.display;
    b.textContent = hidden ? "Show" : "Hide";
  });

  if (tune) {
    button("Run test", (b) => {
      if (test) return;
      for (const name of active)
        toggles.querySelector(`[data-name="${name}"]`)?.click();
      if (ratio) {
        ratio = RATIOS.length - 1;
        toggles.querySelector("[data-ratio]")?.click();
      }
      test = { button: b, results: [] };
      startSegment(performance.now());
    });
    for (const [name, settings] of TOGGLES)
      button(
        name,
        (b) => {
          const on = !active.has(name);
          if (on) active.add(name);
          else active.delete(name);
          tune(
            on
              ? settings
              : Object.fromEntries(
                  Object.keys(settings).map((key) => [key, null]),
                ),
          );
          b.style.outline = on ? "2px solid #e8c25a" : "";
          newWindow(performance.now(), 1000);
        },
        toggles,
      ).dataset.name = name;
    button(
      "Ratio auto",
      (b) => {
        ratio = (ratio + 1) % RATIOS.length;
        tune({ pixelRatio: RATIOS[ratio] });
        b.textContent = `Ratio ${RATIOS[ratio] ?? "auto"}`;
        b.style.outline = RATIOS[ratio] ? "2px solid #e8c25a" : "";
        newWindow(performance.now(), 1000);
      },
      toggles,
    ).dataset.ratio = "";
  }

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
        if (!measuring) newWindow(now);
        if (now >= measuring.from) {
          measuring.intervals.push(interval);
          measuring.cpu.push(cpu);
          const c = counters?.();
          if (c) {
            measuring.calls += c.calls;
            measuring.triangles += c.triangles;
          }
          if (now - measuring.from >= WINDOW) {
            const median = closeWindow(now);
            if (!test) newWindow(now);
            else {
              test.results.push(median ?? NaN);
              if (test.results.length > TEST.length * 2) finishTest();
              else startSegment(now);
              if (!test) newWindow(now);
            }
          }
        }
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
