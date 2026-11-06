// The village's lamps, and the fixed pool of lights that moves to the lamps
// nearest the view.

export function buildLamps(kit) {
  const { cyl, darkWood, stone, box, glass, mesh, T, colliders, scene } = kit;
  // Slim lanterns cast warm pools when the evening arrives.
  const lamps = [];
  function lamp(x, z) {
    cyl(darkWood, x, 1.1, z, 0.075, 2.2);
    cyl(stone, x, 0.18, z, 0.17, 0.25);
    box(darkWood, x, 2.23, z, 0.45, 0.07, 0.43);
    box(glass, x, 2.44, z, 0.3, 0.4, 0.3);
    for (let a of [-1, 1])
      for (let b of [-1, 1])
        box(darkWood, x + a * 0.17, 2.44, z + b * 0.17, 0.035, 0.43, 0.035);
    mesh(new T.ConeGeometry(0.35, 0.25, 4), darkWood, x, 2.76, z).rotation.y =
      Math.PI / 4;
    lamps.push(new T.Vector3(x, 2.4, z));
    colliders.push({ x, z, r: 0.18 });
  }
  for (const [x, z] of [
    [-4, -1],
    [5, -2],
    [-9, 5.5],
    [8.4, 5.6],
    [15.4, 5.6],
    [-10.5, 11.7],
  ])
    lamp(x, z);
  // Every lit material is compiled for the scene's point-light count, so a
  // fixed pool of lights moves to the lamps nearest the view; the glass glows
  // on every lamp. Spare lights wait far below the ground, out of range.
  const LANTERN_LIGHTS = 6,
    LANTERN_REACH = 4,
    LIT_FROM = 0.002,
    spareLight = new T.Vector3(0, -100, 0),
    lampsByDistance = [...lamps],
    focus = new T.Vector2(),
    focusDistance = (lamp) => (lamp.x - focus.x) ** 2 + (lamp.z - focus.y) ** 2,
    nearerFocus = (a, b) => focusDistance(a) - focusDistance(b);
  const lanterns = Array.from({ length: LANTERN_LIGHTS }, () => {
    const light = new T.PointLight("#ffcd82", 0.6, LANTERN_REACH, 2);
    scene.add(light);
    return light;
  });
  // By day the lanterns are dark, but every lit fragment would still test
  // each one's reach. A negative distance on the first point light skips the
  // whole pool (src/shader-chunks.js), with no program to recompile.
  /** Lights the pool for how far into blue hour the day is (0 to 1). */
  function lightLanterns(dusk) {
    const lit = dusk > LIT_FROM;
    for (const light of lanterns) {
      light.intensity = lit ? T.MathUtils.lerp(0.1, 18.0, dusk) : 0;
      light.distance = lit ? LANTERN_REACH : -LANTERN_REACH;
    }
  }
  function placeLanterns(x, z) {
    focus.set(x, z);
    lampsByDistance.sort(nearerFocus);
    for (let i = 0; i < lanterns.length; i++)
      lanterns[i].position.copy(lampsByDistance[i] ?? spareLight);
  }
  placeLanterns(0, 0);
  lightLanterns(0);
  return { lamps, lampsByDistance, lanterns, placeLanterns, lightLanterns };
}
