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
    else {
      clearTimeout(timer);
      stopMusic();
    }
    return enabled;
  }
  // A little waltz for Rosewood's record player, looped while it plays.
  const WALTZ = [
    [392, 1],
    [523.25, 0.5],
    [587.33, 0.5],
    [659.25, 1],
    [587.33, 0.5],
    [523.25, 0.5],
    [493.88, 1],
    [440, 0.5],
    [493.88, 0.5],
    [523.25, 1.5],
    [0, 0.5],
    [440, 1],
    [523.25, 0.5],
    [587.33, 0.5],
    [523.25, 1],
    [493.88, 0.5],
    [440, 0.5],
    [392, 1.5],
    [0, 0.5],
  ];
  let music = null;
  function playWaltz() {
    if (!enabled) return;
    const beat = 0.42;
    let at = context.currentTime + 0.05;
    for (const [frequency, beats] of WALTZ) {
      if (frequency) {
        tone(frequency, at, beat * beats * 1.6, 0.05, "triangle");
        tone(frequency / 2, at, beat * beats * 1.2, 0.025);
      }
      at += beat * beats;
    }
    const length = WALTZ.reduce((sum, [, beats]) => sum + beats, 0) * beat;
    music = setTimeout(playWaltz, length * 1000);
  }
  function stopMusic() {
    clearTimeout(music);
    music = null;
  }
  // Short sounds the walkable rooms ask for by name; unknown names chime.
  const cues = {
    chime() {
      [523.25, 659.25, 783.99].forEach((n, i) =>
        tone(n, context.currentTime + i * 0.08, 0.65, 0.09),
      );
    },
    woof() {
      const now = context.currentTime;
      for (const at of [0, 0.22]) {
        const o = context.createOscillator(),
          g = context.createGain();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(420, now + at);
        o.frequency.exponentialRampToValueAtTime(170, now + at + 0.12);
        g.gain.setValueAtTime(0.0001, now + at);
        g.gain.linearRampToValueAtTime(0.05, now + at + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.14);
        o.connect(g);
        g.connect(master);
        o.start(now + at);
        o.stop(now + at + 0.16);
      }
    },
    cuckoo() {
      for (let i = 0; i < 3; i++) {
        tone(784, context.currentTime + i * 0.7, 0.22, 0.07);
        tone(622.25, context.currentTime + i * 0.7 + 0.24, 0.32, 0.07);
      }
    },
    kettle() {
      const now = context.currentTime,
        o = context.createOscillator(),
        g = context.createGain();
      o.frequency.setValueAtTime(1400, now + 1.2);
      o.frequency.linearRampToValueAtTime(2100, now + 2.6);
      g.gain.setValueAtTime(0.0001, now + 1.2);
      g.gain.linearRampToValueAtTime(0.02, now + 2);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 3.4);
      o.connect(g);
      g.connect(master);
      o.start(now + 1.2);
      o.stop(now + 3.5);
    },
    bubbles() {
      for (let i = 0; i < 6; i++)
        tone(
          500 + Math.random() * 700,
          context.currentTime + i * 0.09,
          0.08,
          0.03,
        );
    },
    // A long wooden groan: the windmill's brake biting or letting go.
    creak() {
      const now = context.currentTime,
        o = context.createOscillator(),
        g = context.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(92, now);
      o.frequency.linearRampToValueAtTime(58, now + 1.1);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.028, now + 0.18);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 1.25);
      o.connect(g);
      g.connect(master);
      o.start(now);
      o.stop(now + 1.3);
    },
    dig() {
      for (let i = 0; i < 5; i++)
        tone(
          90 + Math.random() * 40,
          context.currentTime + i * 0.16,
          0.09,
          0.04,
          "triangle",
        );
    },
    "music:on"() {
      stopMusic();
      playWaltz();
    },
    "music:off": stopMusic,
  };
  return {
    toggle,
    /** Plays the named cue (see `cues`) when sound is on; stops music any time. */
    cue(name = "chime") {
      if (name === "music:off") {
        stopMusic();
        return;
      }
      if (!enabled) return;
      (cues[name] ?? cues.chime)();
    },
    setVolume(v) {
      volume = v;
      if (master)
        master.gain.setTargetAtTime(enabled ? v : 0, context.currentTime, 0.15);
    },
    chime() {
      if (enabled) cues.chime();
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
      stopMusic();
      context?.close();
    },
  };
}
