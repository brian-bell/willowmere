// Fishing from the millpond's jetty: cast, watch the float, and press when it
// dips. Most fish are let go; each species is noted in the journal.

export const FISH = [
  { id: "roach", name: "roach", weight: 30, line: "A silver roach, quick as a wink." },
  { id: "rudd", name: "rudd", weight: 22, line: "A rudd, its fins as red as rosehips." },
  { id: "perch", name: "perch", weight: 20, line: "A striped perch, spines up and indignant." },
  { id: "tench", name: "tench", weight: 14, line: "A tench, olive green and sleepy." },
  { id: "gudgeon", name: "gudgeon", weight: 8, line: "A whiskered gudgeon, up from the gravel by the weir." },
  {
    id: "carp",
    name: "golden carp",
    weight: 6,
    line: "A golden carp! The miller swears it is older than the mill.",
  },
];

// Seconds: how long the float sits before a bite, and how long a bite lasts.
const WAIT = [2.5, 6.5],
  BITE = 1.1;

/**
 * The float and line, and the cast's state. `water` disturbs the pond at the
 * float; `random` is injectable for tests.
 */
export function createFishing(T, { water, body, surface, random = Math.random }) {
  const group = new T.Group();
  group.name = "Fishing float and line";
  group.userData.dynamic = true;
  group.visible = false;
  // A red-capped float: one sphere, coloured by height.
  const floatGeometry = new T.SphereGeometry(0.055, 12, 8),
    colors = [],
    position = floatGeometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const top = position.getY(i) > 0.005;
    colors.push(...(top ? [0.78, 0.12, 0.08] : [0.93, 0.92, 0.86]));
  }
  floatGeometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  const float = new T.Mesh(
    floatGeometry,
    new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 }),
  );
  float.castShadow = true;
  const lineGeometry = new T.BufferGeometry();
  lineGeometry.setAttribute("position", new T.BufferAttribute(new Float32Array(6), 3));
  const line = new T.Line(
    lineGeometry,
    new T.LineBasicMaterial({ color: "#e9e2cc", transparent: true, opacity: 0.75 }),
  );
  line.frustumCulled = false;
  group.add(float, line);

  let phase = "idle",
    elapsed = 0,
    waitFor = 0;
  const target = new T.Vector3(),
    from = new T.Vector3();
  function ripple(strength, radius) {
    water?.disturb(body, target.x, target.z, strength, radius);
  }
  function stop() {
    phase = "idle";
    group.visible = false;
  }
  return {
    group,
    get active() {
      return phase !== "idle";
    },
    get phase() {
      return phase;
    },
    /** Where the float lies on the water. */
    float: target,
    /** Casts the float to (x, z) on the water. */
    cast(x, z) {
      target.set(x, surface, z);
      phase = "waiting";
      elapsed = 0;
      waitFor = WAIT[0] + random() * (WAIT[1] - WAIT[0]);
      group.visible = true;
      ripple(0.03, 0.18);
    },
    /**
     * The player's press: "early" before a bite, "catch" with a fish during
     * one. Either way the cast ends.
     */
    press() {
      if (phase === "idle") return null;
      const bitten = phase === "bite";
      stop();
      if (!bitten) return { kind: "early" };
      let roll = random() * FISH.reduce((sum, fish) => sum + fish.weight, 0);
      const fish = FISH.find((f) => (roll -= f.weight) < 0) || FISH[0];
      ripple(0.04, 0.22);
      return { kind: "catch", fish };
    },
    cancel: stop,
    /**
     * Advances the cast and moves the float and line. `rod` is the rod tip's
     * position. Returns { kind: "miss" } once when a bite passes unanswered.
     */
    update(dt, time, rod) {
      if (phase === "idle") return null;
      elapsed += dt;
      let result = null;
      if (phase === "waiting" && elapsed >= waitFor) {
        phase = "bite";
        elapsed = 0;
        ripple(0.025, 0.12);
      } else if (phase === "bite" && elapsed >= BITE) {
        stop();
        result = { kind: "miss" };
      }
      // The float rides the ripples, and ducks under during a bite.
      const dip = phase === "bite" ? 0.045 * Math.min(1, elapsed * 8) : 0;
      float.position.set(
        target.x,
        surface + 0.012 + Math.sin(time * 2.3) * 0.006 - dip,
        target.z + (phase === "bite" ? Math.sin(time * 31) * 0.012 : 0),
      );
      from.copy(rod);
      const p = line.geometry.attributes.position;
      p.setXYZ(0, from.x, from.y, from.z);
      p.setXYZ(1, float.position.x, float.position.y + 0.05, float.position.z);
      p.needsUpdate = true;
      return result;
    },
  };
}
