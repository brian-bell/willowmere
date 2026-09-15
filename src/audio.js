export function createAudio() {
  let context,
    master,
    enabled = false,
    volume = 0.35,
    timer;
  const tone = (frequency, start, duration, level, type = "sine") => {
    if (!context) return;
    const o = context.createOscillator(),
      g = context.createGain();
    o.type = type;
    o.frequency.value = frequency;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(level, start + 0.018);
    g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    o.connect(g);
    g.connect(master);
    o.start(start);
    o.stop(start + duration + 0.02);
  };
  function birds() {
    if (!enabled) return;
    const now = context.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = context.createOscillator(),
        g = context.createGain();
      o.frequency.setValueAtTime(1600 + i * 180, now + i * 0.13);
      o.frequency.exponentialRampToValueAtTime(
        2600 + i * 100,
        now + i * 0.13 + 0.06,
      );
      o.frequency.exponentialRampToValueAtTime(1900, now + i * 0.13 + 0.12);
      g.gain.setValueAtTime(0.0001, now + i * 0.13);
      g.gain.linearRampToValueAtTime(0.026, now + i * 0.13 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.13 + 0.15);
      o.connect(g);
      g.connect(master);
      o.start(now + i * 0.13);
      o.stop(now + i * 0.13 + 0.17);
    }
    timer = setTimeout(birds, 4500 + Math.random() * 6500);
  }
  async function toggle() {
    if (!context) {
      context = new (window.AudioContext || window.webkitAudioContext)();
      master = context.createGain();
      master.gain.value = 0;
      master.connect(context.destination);
      const buffer = context.createBuffer(
        1,
        context.sampleRate * 4,
        context.sampleRate,
      );
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        last = (last + Math.random() * 0.025 - 0.0125) / 1.015;
        data[i] = last;
      }
      const noise = context.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const f = context.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 900;
      noise.connect(f);
      f.connect(master);
      noise.start();
    }
    await context.resume();
    enabled = !enabled;
    master.gain.setTargetAtTime(enabled ? volume : 0, context.currentTime, 0.4);
    if (enabled) birds();
    else clearTimeout(timer);
    return enabled;
  }
  return {
    toggle,
    setVolume(v) {
      volume = v;
      if (master)
        master.gain.setTargetAtTime(enabled ? v : 0, context.currentTime, 0.15);
    },
    chime() {
      if (!enabled) return;
      [523.25, 659.25, 783.99].forEach((n, i) =>
        tone(n, context.currentTime + i * 0.08, 0.65, 0.09),
      );
    },
    step() {
      if (enabled)
        tone(
          105 + Math.random() * 20,
          context.currentTime,
          0.07,
          0.025,
          "triangle",
        );
    },
    dispose() {
      clearTimeout(timer);
      context?.close();
    },
  };
}
