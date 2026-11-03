// The village's building kit: its random stream, its materials and painted
// textures, and the box, cylinder, orb, beam and sign helpers every village
// builder places parts with. The random stream is shared and drawn in build
// order, so the builders run in the order world.js calls them; `seed` reads
// and resets it (the brook does).

export function createVillageKit(T, scene, { water, colliders, interactables, animate, animated }) {
  let seed = 91372;
  const rand = () =>
      (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296,
    range = (a, b) => a + (b - a) * rand();
  const materialCache = new Map();
  const mat = (color, roughness = 0.9) => {
    const key = color + roughness;
    if (!materialCache.has(key))
      materialCache.set(key, new T.MeshStandardMaterial({ color, roughness }));
    return materialCache.get(key);
  };
  const grass = mat("#7f9f5c"),
    soil = mat("#b9a575"),
    path = mat("#d4be8e"),
    stone = mat("#adada0"),
    darkStone = mat("#7d8980"),
    wood = mat("#866547"),
    darkWood = mat("#65513e"),
    ivory = mat("#e7d6ac"),
    trim = mat("#e8dcbb"),
    roofBlue = mat("#78939c"),
    roofRust = mat("#b66e4e");
  const glass = new T.MeshStandardMaterial({
    color: "#ffcf73",
    emissive: "#ffad41",
    emissiveIntensity: 0.4,
    roughness: 0.3,
  });
  function texture(bg, kind) {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const x = c.getContext("2d");
    x.fillStyle = bg;
    x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2100; i++) {
      x.globalAlpha = range(0.025, 0.095);
      x.fillStyle = rand() > 0.5 ? "#fff" : "#1e2412";
      let a = rand() * 256,
        b = rand() * 256;
      x.fillRect(
        a,
        b,
        range(0.4, 3),
        kind === "wood" ? range(4, 25) : range(0.4, 3),
      );
    }
    x.globalAlpha = 1;
    if (bg === "#7f9f5c" || bg === "#d4be8e") {
      for (let i = 0; i < 40; i++) {
        const xx = rand() * 256,
          yy = rand() * 256,
          rr = range(10, 65),
          gr = x.createRadialGradient(xx, yy, 0, xx, yy, rr);
        gr.addColorStop(
          0,
          rand() > 0.5 ? "rgba(61,86,32,.035)" : "rgba(242,216,134,.026)",
        );
        gr.addColorStop(1, "rgba(0,0,0,0)");
        x.fillStyle = gr;
        x.fillRect(xx - rr, yy - rr, rr * 2, rr * 2);
      }
    }
    if (kind === "roof") {
      for (let y = 0; y < 256; y += 32) {
        x.strokeStyle = "#28393944";
        x.lineWidth = 2;
        x.beginPath();
        x.moveTo(0, y);
        x.lineTo(256, y);
        x.stroke();
        for (let k = 0; k < 8; k++) {
          let xx = k * 40 + (y % 64 ? 20 : 0);
          x.beginPath();
          x.moveTo(xx, y);
          x.lineTo(xx, y + 32);
          x.stroke();
        }
      }
    }
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  }
  ivory.map = texture("#e7d6ac", "plaster");
  wood.map = texture("#866547", "wood");
  darkWood.map = texture("#65513e", "wood");
  roofBlue.map = texture("#78939c", "roof");
  roofRust.map = texture("#b66e4e", "roof");
  grass.map = texture("#7f9f5c");
  grass.map.repeat.set(12, 10);
  path.map = texture("#d4be8e");
  path.map.repeat.set(4, 6);
  for (const m of [ivory, wood, darkWood, roofBlue, roofRust, grass, path])
    m.color.set("#ffffff");
  const boxG = new T.BoxGeometry(1, 1, 1),
    cylG = new T.CylinderGeometry(1, 1, 1, 12),
    sphereG = new T.IcosahedronGeometry(1, 2);
  function mesh(
    geo,
    ma,
    x = 0,
    y = 0,
    z = 0,
    sx = 1,
    sy = 1,
    sz = 1,
    parent = scene,
  ) {
    const o = new T.Mesh(geo, ma);
    o.position.set(x, y, z);
    o.scale.set(sx, sy, sz);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  function box(ma, x, y, z, w, h, d, p = scene) {
    return mesh(boxG, ma, x, y, z, w, h, d, p);
  }
  function cyl(ma, x, y, z, r, h, p = scene) {
    return mesh(cylG, ma, x, y, z, r, h, r, p);
  }
  function orb(ma, x, y, z, sx, sy = sx, sz = sx, p = scene) {
    return mesh(sphereG, ma, x, y, z, sx, sy, sz, p);
  }
  function beam(ma, a, b, width = 0.1, p = scene) {
    const av = new T.Vector3(...a),
      bv = new T.Vector3(...b),
      mid = av.clone().add(bv).multiplyScalar(0.5),
      o = box(ma, ...mid.toArray(), width, av.distanceTo(bv), width, p);
    o.quaternion.setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      bv.sub(av).normalize(),
    );
    return o;
  }
  function label(text, color = "#4d5745") {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const q = c.getContext("2d");
    q.fillStyle = "#e9d9ae";
    q.fillRect(0, 0, 512, 128);
    q.strokeStyle = "#827251";
    q.lineWidth = 10;
    q.strokeRect(7, 7, 498, 114);
    q.fillStyle = color;
    q.textAlign = "center";
    q.textBaseline = "middle";
    q.font = "bold 55px Georgia";
    q.fillText(text, 256, 67);
    const tx = new T.CanvasTexture(c);
    tx.colorSpace = T.SRGBColorSpace;
    return new T.MeshStandardMaterial({ map: tx, roughness: 1 });
  }
  return {
    T, scene, water, colliders, interactables, animate, animated,
    get seed() {
      return seed;
    },
    set seed(value) {
      seed = value;
    },
    rand,
    range,
    mat,
    grass,
    soil,
    path,
    stone,
    darkStone,
    wood,
    darkWood,
    ivory,
    trim,
    roofBlue,
    roofRust,
    glass,
    texture,
    sphereG,
    mesh,
    box,
    cyl,
    orb,
    beam,
    label,
  };
}
