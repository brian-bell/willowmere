import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createTrees } from "./trees.js";
import { createReeds } from "./reeds.js";
import { createRiverbank } from "./riverbank.js";
import { createWaterSystem, sampleWaterField } from "./water.js";
export function createWorld(T, scene) {
  const initialChildren = new Set(scene.children);
  const water = createWaterSystem(scene);
  const colliders = [],
    interactables = [],
    animated = [];
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
  // Sculpted meadow base, its floating soil rim discreetly visible at the wooded margins.
  // The channel is physically recessed, so refraction sees its bed rather than lawn.
  box(soil, 0, -1.18, 0, 48, 0.34, 42);
  for (const [left, right] of [
    [-24, 9.7],
    [14.3, 24],
  ])
    box(soil, (left + right) / 2, -0.58, 0, right - left, 1.06, 42);
  for (const [left, right] of [
    [-23.8, 9.7],
    [14.3, 23.8],
  ])
    box(grass, (left + right) / 2, -0.1, 0, right - left, 0.3, 41.6);
  const groundH = (x, z) => 0.04;
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 128;
  const sh = shadowCanvas.getContext("2d"),
    shade = sh.createRadialGradient(64, 64, 5, 64, 64, 63);
  shade.addColorStop(0, "rgba(31,46,27,.34)");
  shade.addColorStop(0.45, "rgba(31,46,27,.21)");
  shade.addColorStop(1, "rgba(31,46,27,0)");
  sh.fillStyle = shade;
  sh.fillRect(0, 0, 128, 128);
  const contactMat = new T.MeshBasicMaterial({
    map: new T.CanvasTexture(shadowCanvas),
    transparent: true,
    depthWrite: false,
  });
  function contact(x, z, w, d) {
    const m = mesh(new T.PlaneGeometry(w, d), contactMat, x, 0.13, z);
    m.rotation.x = -Math.PI / 2;
    m.castShadow = false;
    m.receiveShadow = false;
    return m;
  }
  const palette = ["#66834b", "#739153", "#789957", "#89a361", "#668654"].map(
    (v) => mat(v),
  );
  // Broad connected village paths.
  const pathEdge = mat("#b2ac77");
  function road(x, z, w, d) {
    const horizontal = w > d,
      r = Math.min(w, d) * 0.5,
      core = Math.max(w, d) * 0.5 - r,
      outline = [];
    const add = (u, v) => outline.push(horizontal ? [u, v] : [v, u]);
    for (let u = -core; u <= core + 0.01; u += Math.max(0.3, core / 12))
      add(u, r + Math.sin(u * 2.8 + x) * 0.035 + Math.sin(u * 6 + z) * 0.025);
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI / 2 - (i / 16) * Math.PI;
      add(core + Math.cos(a) * r, Math.sin(a) * r);
    }
    for (let u = core; u >= -core - 0.01; u -= Math.max(0.3, core / 12))
      add(u, -r + Math.sin(u * 3.1 + x) * 0.04);
    for (let i = 0; i <= 16; i++) {
      const a = -Math.PI / 2 - (i / 16) * Math.PI;
      add(-core + Math.cos(a) * r, Math.sin(a) * r);
    }
    const shape = new T.Shape();
    outline.forEach(([a, b], i) =>
      i ? shape.lineTo(a, b) : shape.moveTo(a, b),
    );
    shape.closePath();
    const m = mesh(new T.ShapeGeometry(shape), path, x, 0.105, z);
    m.rotation.x = -Math.PI / 2;
  }
  road(-3, 3, 28, 3.2);
  road(-2, -1.8, 3.2, 12.5);
  road(-7, -1.6, 3.1, 7);
  road(2, -4.5, 3, 6);
  road(16, -0.7, 2.7, 9);
  road(-12, 9, 3, 13);
  road(-6, 10.3, 13, 2.8);
  const plaza = cyl(path, -1, 0.08, 2.7, 5.3, 0.08);
  plaza.scale.z = 4.5;
  // A shared bathymetry field drives both the carved bed and the fluid boundary.
  const riverLayoutSeed = seed;
  const riverConfig = {
    id: "river",
    x: 12,
    y: 0.108,
    z: 0,
    size: [4.2, 42],
    depth: 0.82,
    flow: 0.44,
    amplitude: 0.024,
    obstacles: [
      { x: -0.84, z: -4.7, radius: 0.22 },
      { x: 0.84, z: 7.2, radius: 0.2 },
      { x: -0.72, z: 12.5, radius: 0.27 },
      { x: 1.72, z: -6.5, radius: 0.18 },
    ],
  };
  water.addBody(riverConfig);
  const bedMaterial = mat("#8b9277", 0.96);
  bedMaterial.map = texture("#8b9277", "stone");
  bedMaterial.color.set("#ffffff");
  bedMaterial.map.repeat.set(3, 28);
  const bedGeometry = new T.PlaneGeometry(4.6, 42, 56, 420).rotateX(
    -Math.PI / 2,
  );
  const bedPositions = bedGeometry.attributes.position;
  for (let i = 0; i < bedPositions.count; i++) {
    const x = bedPositions.getX(i),
      z = bedPositions.getZ(i);
    const field = sampleWaterField(riverConfig, x, z);
    const bottom = field[3] ? riverConfig.y - field[0] - 0.018 : 0.045;
    bedPositions.setY(
      i,
      bottom + (field[0] > 0.12 ? Math.sin(x * 11 + z * 2.7) * 0.025 : 0),
    );
  }
  bedGeometry.computeVertexNormals();
  mesh(bedGeometry, bedMaterial, 12, 0, 0);
  const pebbleColors = ["#9a987e", "#78877b", "#a8a088", "#677b72"].map(
    (c) => new T.Color(c),
  );
  const pebbles = new T.InstancedMesh(
    new T.IcosahedronGeometry(1, 1),
    new T.MeshStandardMaterial({ roughness: 0.85 }),
    430,
  );
  const dum = new T.Object3D();
  for (let i = 0; i < pebbles.count; i++) {
    const x = range(-1.94, 1.94),
      z = range(-20.8, 20.8);
    const [depth] = sampleWaterField(riverConfig, x, z);
    dum.position.set(12 + x, riverConfig.y - depth - 0.01, z);
    dum.scale.set(range(0.035, 0.1), range(0.025, 0.065), range(0.045, 0.13));
    dum.rotation.set(rand(), rand() * 6.28, rand());
    dum.updateMatrix();
    pebbles.setMatrixAt(i, dum.matrix);
    pebbles.setColorAt(i, pebbleColors[i % pebbleColors.length]);
  }
  pebbles.receiveShadow = true;
  scene.add(pebbles);
  // Saturated stone is darker and smoother just below the lapping waterline.
  function wetStone(base) {
    const material = base.clone();
    material.onBeforeCompile = (shader) => {
      shader.vertexShader =
        "varying float vStoneHeight;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvStoneHeight = (modelMatrix * vec4(transformed, 1.0)).y;",
      );
      shader.fragmentShader =
        "varying float vStoneHeight;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        "#include <color_fragment>\ndiffuseColor.rgb *= mix(0.62, 1.0, smoothstep(0.08, 0.22, vStoneHeight));",
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor = mix(0.34, roughnessFactor, smoothstep(0.08, 0.22, vStoneHeight));",
      );
    };
    material.customProgramCacheKey = () => "river-wet-stone";
    return material;
  }
  const wetRiverStone = wetStone(darkStone);
  for (const rock of riverConfig.obstacles) {
    orb(
      wetRiverStone,
      12 + rock.x,
      0.07,
      rock.z,
      rock.radius * 1.16,
      0.18,
      rock.radius * 1.24,
    );
    water.addSource("river", {
      x: 12 + rock.x,
      z: rock.z + rock.radius + 0.09,
      radius: 0.11,
      strength: 0.004,
      interval: 0.31,
    });
  }
  water.addJet("river", {
    start: [13.78, 0.48, -6.48],
    end: [13.79, 0.108, -6.1],
    arc: 0.015,
    radius: 0.009,
  });
  water.addJet("river", {
    start: [13.9, 0.35, -6.34],
    end: [13.89, 0.108, -5.98],
    arc: 0.01,
    radius: 0.007,
    phase: 0.07,
  });
  createRiverbank(scene);
  // Keep downstream village placements stable after replacing the old bank stones.
  seed = riverLayoutSeed;
  for (let i = 0; i < 568; i++) rand();
  dum.rotation.set(0, 0, 0);
  colliders.push(
    { x: 12, z: -8.5, w: 4.3, d: 19.5 },
    { x: 12, z: 13, w: 4.3, d: 16.5 },
  );
  // Timber bridge with graceful hump, cap rails and peg details.
  for (let i = 0; i < 19; i++) {
    const x = 9.1 + i * 0.32,
      y = 0.24 + Math.sin((i / 18) * Math.PI) * 0.39;
    box(wood, x, y, 3, 0.305, 0.18, 3.5);
    for (let z of [1.32, 4.68])
      if (i % 3 === 0) {
        box(darkWood, x, y + 0.5, z, 0.13, 0.95, 0.13);
        orb(trim, x, y + 1.01, z, 0.105);
      }
  }
  for (let side of [1.3, 4.7])
    for (let i = 0; i < 6; i++) {
      const x = 9.1 + i * 0.96,
        y = 0.24 + Math.sin((i / 6) * Math.PI) * 0.39;
      beam(
        wood,
        [x, y + 0.97, side],
        [
          x + 0.96,
          0.24 + Math.sin(((i + 1) / 6) * Math.PI) * 0.39 + 0.97,
          side,
        ],
        0.13,
      );
    }
  colliders.push(
    { x: 12, z: 1.2, w: 6, d: 0.18 },
    { x: 12, z: 4.8, w: 6, d: 0.18 },
  );
  const roofVariants = new Map();
  function roof(x, z, w, d, base, height, ma, p) {
    if (ma === ivory) {
      const shape = new T.Shape();
      shape.moveTo(-w / 2, 0);
      shape.lineTo(0, height);
      shape.lineTo(w / 2, 0);
      shape.closePath();
      return mesh(
        new T.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false }),
        ma,
        x,
        base,
        z - d / 2,
        1,
        1,
        1,
        p,
      );
    }
    const slope = Math.atan2(height, w / 2),
      length = Math.hypot(height, w / 2);
    if (!roofVariants.has(ma)) {
      const c = ma === roofBlue ? "#78949b" : "#b77e61";
      roofVariants.set(
        ma,
        [-0.025, 0, 0.02, 0.04].map((v) => {
          const m = mat(c).clone();
          m.color.offsetHSL(0, 0, v);
          return m;
        }),
      );
    }
    const variants = roofVariants.get(ma),
      rows = Math.max(2, Math.ceil(length / 0.29)),
      cols = Math.max(2, Math.ceil(d / 0.44));
    for (let side of [-1, 1]) {
      const slab = box(
        ma,
        x + (side * w) / 4,
        base + height / 2,
        z,
        length + 0.04,
        0.1,
        d,
        p,
      );
      slab.rotation.z = -side * slope;
      for (let row = 0; row < rows; row++) {
        const f = (row + 0.5) / rows;
        for (let col = 0; col < cols; col++) {
          const zz = z - d / 2 + ((col + 0.5) * d) / cols;
          const tile = box(
            variants[rand() < 0.65 ? 1 : Math.floor(rand() * 4)],
            x + (side * f * w) / 2,
            base + height * (1 - f) + 0.074,
            zz,
            length / rows + 0.045,
            0.055,
            d / cols - 0.012,
            p,
          );
          tile.rotation.z = -side * slope;
        }
      }
    }
  }
  const plantMats = ["#4a7752", "#65874d", "#90a560"].map((c) => mat(c));
  const flowerMats = ["#e4c471", "#e4a38f", "#d9d4b4", "#a49bbe"].map((c) =>
    mat(c),
  );
  function pot(x, z, s = 0.5, p = scene, y = 0) {
    const terr = mat("#ae7354");
    cyl(terr, x, y + s * 0.38, z, s * 0.45, s * 0.75, p);
    cyl(terr, x, y + s * 0.79, z, s * 0.51, s * 0.12, p);
    cyl(darkWood, x, y + s * 0.86, z, s * 0.38, 0.06, p);
    for (let i = 0; i < 4; i++) {
      const xx = x + range(-s * 0.3, s * 0.3),
        zz = z + range(-s * 0.3, s * 0.3);
      orb(
        plantMats[i % 3],
        xx,
        y + s * 1.07,
        zz,
        s * 0.32,
        s * 0.5,
        s * 0.32,
        p,
      );
      if (i < 3)
        orb(
          flowerMats[i % 4],
          xx,
          y + s * 1.48,
          zz,
          s * 0.16,
          s * 0.1,
          s * 0.16,
          p,
        );
    }
  }
  function windowAt(x, y, z, w = 0.8, h = 1.1, p = scene) {
    box(darkWood, x, y, z, w + 0.19, h + 0.19, 0.11, p);
    box(glass, x, y, z + 0.07, w, h, 0.03, p);
    box(trim, x, y, z + 0.095, 0.075, h + 0.1, 0.07, p);
    box(trim, x, y + 0.04, z + 0.1, w + 0.1, 0.065, 0.07, p);
    box(trim, x, y - h / 2 - 0.1, z + 0.16, w + 0.34, 0.12, 0.37, p);
    if (h > 0.8) {
      box(wood, x, y - h / 2 - 0.2, z + 0.24, w + 0.16, 0.2, 0.3, p);
      for (let j = 0; j < 5; j++) {
        orb(
          plantMats[j % 3],
          x - w * 0.4 + j * w * 0.2,
          y - h / 2 - 0.05,
          z + 0.32,
          0.16,
          0.12,
          0.16,
          p,
        );
        orb(
          flowerMats[j % 4],
          x - w * 0.4 + j * w * 0.2,
          y - h / 2 + 0.04,
          z + 0.33,
          0.07,
          0.06,
          0.07,
          p,
        );
      }
    }
    for (let side of [-1, 1]) {
      box(wood, x + side * (w / 2 + 0.22), y, z, 0.27, h + 0.16, 0.09, p);
      for (let yy = -2; yy <= 2; yy++)
        box(
          darkWood,
          x + side * (w / 2 + 0.22),
          y + yy * 0.17,
          z + 0.055,
          0.24,
          0.025,
          0.035,
          p,
        );
    }
  }
  function house(x, z, w, d, h, ro, sign, id) {
    contact(x, z, w + 2, d + 2);
    const p = new T.Group();
    p.position.set(x, 0, z);
    scene.add(p);
    box(stone, 0, 0.22, 0, w + 0.16, 0.42, d + 0.12, p);
    box(ivory, 0, h / 2 + 0.4, 0, w, h, d, p);
    roof(0, 0, w + 0.8, d + 0.8, h + 0.4, h * 0.69, ro, p);
    roof(0, d / 2 + 0.015, w, 0.055, h + 0.4, h * 0.69, ivory, p);
    for (let side of [-1, 1])
      beam(
        darkWood,
        [side * (w / 2 + 0.12), h + 0.42, d / 2 + 0.11],
        [0, h * 1.69 + 0.45, d / 2 + 0.11],
        0.15,
        p,
      );
    box(darkWood, 0, h + 0.42, d / 2 + 0.05, w + 0.3, 0.18, 0.19, p);
    box(darkWood, 0, h + 1.05, d / 2 + 0.1, 0.14, 1.3, 0.14, p);
    for (let xx of [-w / 2 + 0.07, w / 2 - 0.07])
      box(darkWood, xx, h / 2 + 0.4, d / 2 + 0.035, 0.15, h, 0.15, p);
    box(darkWood, 0, 0.62, d / 2 + 0.04, w, 0.16, 0.13, p);
    // Individual weatherboard fascia and roof ridge tiles.
    for (let zz = -d / 2 - 0.35; zz < d / 2 + 0.4; zz += 0.34)
      cyl(ro, 0, h * 1.69 + 0.43, zz, 0.11, 0.35, p).rotation.x = Math.PI / 2;
    // Stone chimney, brick offsets and copper cap.
    const cx = w * 0.28,
      cz = -d * 0.16,
      cy = h * 1.69;
    box(mat("#9d8973"), cx, cy, cz, 0.65, 1.8, 0.62, p);
    for (let yy = -3; yy < 4; yy++) {
      box(wood, cx, cy + yy * 0.22, cz + 0.316, 0.66, 0.027, 0.017, p);
      box(
        wood,
        cx + (yy % 2 ? 0.12 : -0.13),
        cy + yy * 0.22 + 0.1,
        cz + 0.32,
        0.02,
        0.2,
        0.017,
        p,
      );
    }
    box(stone, cx, cy + 0.93, cz, 0.83, 0.15, 0.79, p);
    for (let i = 0; i < 4; i++) {
      const puff = orb(
        new T.MeshStandardMaterial({
          color: "#d4d3be",
          transparent: true,
          opacity: 0.17 - i * 0.022,
          depthWrite: false,
        }),
        x + cx + i * 0.12,
        cy + 1.35 + i * 0.47,
        z + cz,
        0.26 + i * 0.12,
        0.4 + i * 0.12,
        0.26 + i * 0.12,
      );
      animated.push((dt, t) => {
        puff.position.x = x + cx + i * 0.12 + Math.sin(t * 0.45 + i) * 0.14;
        puff.position.y = cy + 1.35 + i * 0.47 + Math.sin(t * 0.6 + i) * 0.09;
      });
    }
    const dz = d / 2 + 0.13;
    box(darkWood, 0, 1.25, dz, 0.97, 1.8, 0.1, p);
    box(wood, 0, 1.22, dz + 0.075, 0.79, 1.64, 0.08, p);
    for (let xx = -0.3; xx <= 0.3; xx += 0.15)
      box(darkWood, xx, 1.2, dz + 0.123, 0.015, 1.58, 0.013, p);
    box(glass, 0, 1.62, dz + 0.13, 0.49, 0.44, 0.016, p);
    orb(mat("#d0b067"), 0.25, 1.1, dz + 0.16, 0.05, 0.05, 0.05, p);
    box(stone, 0, 0.2, dz + 0.45, 1.5, 0.25, 0.7, p);
    box(stone, 0, 0.12, dz + 0.84, 1.75, 0.12, 0.3, p);
    windowAt(-w * 0.3, 1.9, dz, 0.76, 1, p);
    windowAt(w * 0.3, 1.9, dz, 0.76, 1, p);
    windowAt(0, h + 0.94, dz, 0.67, 0.65, p);
    // Right wall window visible to camera.
    const win = new T.Group();
    win.position.set(w / 2 + 0.05, 0, 0);
    win.rotation.y = Math.PI / 2;
    p.add(win);
    windowAt(0, 1.8, 0, 0.9, 1, win);
    pot(-w / 2 + 0.15, d / 2 + 0.7, 0.62, p);
    pot(w / 2 - 0.1, d / 2 + 0.68, 0.58, p);
    if (sign) {
      box(darkWood, 0, 2.66, dz + 0.12, 2, 0.12, 0.12, p);
      box(label(sign), 0, 2.67, dz + 0.205, 1.78, 0.46, 0.07, p);
    }
    // Entrance canopy, supported on carved posts.
    roof(0, d / 2 + 0.62, 1.85, 1.05, 2.15, 0.35, ro, p);
    for (let xx of [-0.77, 0.77]) {
      box(wood, xx, 1.22, d / 2 + 1.02, 0.09, 1.85, 0.09, p);
      beam(
        wood,
        [xx, 2.1, d / 2 + 1.02],
        [xx * 0.5, 2.1, d / 2 + 0.65],
        0.07,
        p,
      );
    }
    colliders.push({ x, z, w: w + 0.15, d: d + 0.2 });
    interactables.push({
      id,
      name: sign || "Rosewood Cottage",
      type: id,
      x,
      z: z + d / 2 + 1.1,
      radius: 2,
    });
    return p;
  }
  house(-7, -6, 5.5, 4.3, 3.25, roofBlue, "ROSEWOOD", "home");
  house(1.2, -8.4, 4.8, 4.2, 3, roofRust, "THE DAILY LOAF", "bakery");
  house(17, -7, 4.4, 4.4, 3.5, roofBlue, "WILLOW MILL", "mill");
  house(-15, -3, 4, 3.6, 2.7, roofRust, "", "cottage");
  // Bakery's flour store has a lower shed roof and working delivery hatch.
  box(stone, 4.33, 0.18, -8.2, 1.6, 0.3, 3.15);
  box(ivory, 4.3, 1.13, -8.2, 1.6, 1.85, 3.1);
  const shed = box(roofRust, 4.32, 2.34, -8.2, 2.05, 0.15, 3.65);
  shed.rotation.z = -0.27;
  box(darkWood, 5.12, 1.22, -8.1, 0.08, 1.35, 1.3);
  for (let i = 0; i < 7; i++)
    box(wood, 5.18, 1.22, -8.68 + i * 0.19, 0.075, 1.3, 0.17);
  box(darkWood, 5.23, 1.22, -8.1, 0.08, 0.09, 1.35);
  colliders.push({ x: 4.4, z: -8.2, w: 1.8, d: 3.3 });
  contact(4.4, -8.2, 3, 4);
  // A gabled mill hoist rises above the wheel, with suspended flour sacks below.
  const hoist = new T.Group();
  hoist.position.set(15.4, 0, -5.6);
  scene.add(hoist);
  box(ivory, 0, 4.55, 0, 1.5, 1.8, 1.8, hoist);
  roof(0, 0, 1.83, 2.03, 5.45, 0.73, roofBlue, hoist);
  roof(0, 0.91, 1.5, 0.03, 5.45, 0.73, ivory, hoist);
  box(darkWood, 0, 4.65, 0.94, 0.8, 1.14, 0.06, hoist);
  box(wood, 0, 5.25, 1.38, 0.12, 0.14, 1.1, hoist);
  beam(darkWood, [0, 5.26, 1.8], [0, 3.22, 1.8], 0.025, hoist);
  orb(mat("#c0ae82"), 0, 2.99, 1.8, 0.28, 0.36, 0.22, hoist);
  for (let x of [-0.66, 0.66])
    box(darkWood, x, 4.6, 0.94, 0.1, 1.62, 0.1, hoist);
  // Bakery outdoor display with striped awning, crates and small loaves.
  box(wood, 3.9, 0.65, -4.4, 2.5, 0.85, 0.9);
  for (let i = 0; i < 7; i++)
    orb(mat("#c89b56"), 3.1 + i * 0.24, 1.16, -4.4, 0.18, 0.12, 0.11);
  for (let i = 0; i < 6; i++) {
    const aw = box(
      i % 2 ? trim : mat("#a66b52"),
      2.85 + i * 0.43,
      2.35,
      -4.3,
      0.43,
      0.08,
      1.35,
    );
    aw.rotation.x = 0.13;
  }
  for (let x of [2.7, 5.1]) box(wood, x, 1.2, -3.72, 0.07, 2.3, 0.07);
  // Working mill wheel, clean concentric rings and wooden paddles.
  const wheel = new T.Group();
  wheel.userData.dynamic = true;
  wheel.position.set(14.12, 1.43, -6.5);
  scene.add(wheel);
  wheel.rotation.z = Math.PI / 2;
  const torG = new T.TorusGeometry(1.38, 0.105, 6, 32);
  for (let y of [-0.35, 0.35]) {
    const ring = mesh(torG, darkWood, 0, y, 0, 1, 1, 1, wheel);
    ring.rotation.x = Math.PI / 2;
  }
  for (let i = 0; i < 12; i++) {
    let a = (i * Math.PI) / 6;
    const padd = box(
      wood,
      Math.cos(a) * 1.37,
      0,
      Math.sin(a) * 1.37,
      0.38,
      0.88,
      0.21,
      wheel,
    );
    padd.rotation.y = -a;
    beam(
      darkWood,
      [0, 0, 0],
      [Math.cos(a) * 1.35, 0, Math.sin(a) * 1.35],
      0.1,
      wheel,
    );
  }
  cyl(darkWood, 0, 0, 0, 0.18, 1.2, wheel);
  animated.push((dt) => (wheel.rotation.y += dt * 0.18));
  // Sealed stone walls enclose each pool below the rounded lip.
  function basinWall(x, y, z, inner, outer, height) {
    const ring = new T.Shape();
    ring.absarc(0, 0, outer, 0, Math.PI * 2, false);
    const hole = new T.Path();
    hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
    ring.holes.push(hole);
    const geometry = new T.ExtrudeGeometry(ring, {
      depth: height,
      steps: 1,
      bevelEnabled: false,
      curveSegments: 48,
    });
    geometry.rotateX(-Math.PI / 2);
    mesh(geometry, stone, x, y, z);
  }
  // Central fountain with shallow clear water, central carved basin and gentle jets.
  cyl(darkStone, -1, 0.18, 2.5, 1.65, 0.25);
  cyl(stone, -1, 0.32, 2.5, 1.53, 0.2);
  basinWall(-1, 0.42, 2.5, 1.32, 1.48, 0.15);
  water.addBody({
    id: "fountain-lower",
    x: -1,
    y: 0.5725,
    z: 2.5,
    radius: 1.32,
    hole: 0.285,
    depth: 0.15,
    amplitude: 0.004,
    absorption: [0.7, 0.24, 0.12],
    scatter: "#517e70",
    roughness: 0.13,
  });
  const rim = mesh(
    new T.TorusGeometry(1.43, 0.115, 8, 48),
    trim,
    -1,
    0.61,
    2.5,
  );
  rim.rotation.x = Math.PI / 2;
  cyl(stone, -1, 0.78, 2.5, 0.28, 0.7);
  cyl(trim, -1, 1.1, 2.5, 0.66, 0.09);
  basinWall(-1, 1.145, 2.5, 0.53, 0.63, 0.08);
  const bowl = mesh(
    new T.TorusGeometry(0.58, 0.09, 7, 32),
    stone,
    -1,
    1.23,
    2.5,
  );
  bowl.rotation.x = Math.PI / 2;
  water.addBody({
    id: "fountain-upper",
    x: -1,
    y: 1.22,
    z: 2.5,
    radius: 0.53,
    hole: 0.125,
    depth: 0.075,
    amplitude: 0.002,
    absorption: [0.55, 0.18, 0.1],
    scatter: "#517e70",
    roughness: 0.12,
  });
  cyl(stone, -1, 1.42, 2.5, 0.12, 0.48);
  orb(trim, -1, 1.72, 2.5, 0.21);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    water.addJet("fountain-lower", {
      start: [-1 + Math.cos(a) * 0.09, 1.65, 2.5 + Math.sin(a) * 0.09],
      end: [-1 + Math.cos(a) * 0.92, 0.5725, 2.5 + Math.sin(a) * 0.92],
      arc: 0.045,
      phase: i * 0.073,
      radius: 0.012,
    });
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    water.addJet("fountain-upper", {
      start: [-1 + Math.cos(a) * 0.16, 1.69, 2.5 + Math.sin(a) * 0.16],
      end: [-1 + Math.cos(a) * 0.35, 1.22, 2.5 + Math.sin(a) * 0.35],
      arc: 0.02,
      phase: i * 0.11,
      radius: 0.008,
    });
  }
  colliders.push({ x: -1, z: 2.5, r: 1.7 });
  interactables.push({
    id: "fountain",
    name: "Wishing Fountain",
    type: "fountain",
    x: -1,
    z: 4.6,
    radius: 2,
  });
  function bench(x, z, rot = 0) {
    const p = new T.Group();
    p.position.set(x, 0, z);
    p.rotation.y = rot;
    scene.add(p);
    for (let zz of [-0.22, 0, 0.22])
      box(wood, 0, 0.61, zz, 1.95, 0.11, 0.17, p);
    for (let yy of [0.98, 1.24]) box(wood, 0, yy, -0.35, 1.95, 0.18, 0.095, p);
    for (let xx of [-0.75, 0.75]) {
      box(darkWood, xx, 0.33, 0, 0.13, 0.65, 0.6, p);
      box(darkWood, xx, 0.86, -0.35, 0.11, 0.92, 0.11, p);
    }
    colliders.push({ x, z, r: 1 });
  }
  bench(-4.6, 3.1, Math.PI / 2);
  bench(2.7, 2.7, -Math.PI / 2);
  bench(-5, 10.9, Math.PI);
  bench(17, 5.7, Math.PI);
  // Enclosed kitchen garden, orderly vegetable beds, trellis and watering can.
  function fence(x1, z1, x2, z2) {
    colliders.push({
      x: (x1 + x2) / 2,
      z: (z1 + z2) / 2,
      w: Math.max(0.12, Math.abs(x2 - x1)),
      d: Math.max(0.12, Math.abs(z2 - z1)),
    });
    const len = Math.hypot(x2 - x1, z2 - z1),
      n = Math.ceil(len / 1.45);
    for (let i = 0; i <= n; i++) {
      let f = i / n,
        x = x1 + (x2 - x1) * f,
        z = z1 + (z2 - z1) * f;
      box(trim, x, 0.57, z, 0.13, 1.1, 0.13);
      mesh(new T.ConeGeometry(0.12, 0.15, 4), trim, x, 1.19, z);
      if (i < n)
        for (let y of [0.47, 0.87])
          beam(
            trim,
            [x, y, z],
            [x + (x2 - x1) / n, y, z + (z2 - z1) / n],
            0.085,
          );
    }
  }
  fence(-19, 6, -19, 13.7);
  fence(-19, 13.7, -13.8, 13.7);
  fence(-13.8, 13.7, -13.8, 11);
  fence(-19, 6, -14, 6);
  fence(-13.8, 6, -13.8, 8);
  const bedSoil = mat("#796146");
  for (let z of [7.1, 9.6, 12.1]) {
    box(bedSoil, -16.6, 0.14, z, 3.7, 0.15, 1.45);
    for (let zz of [-0.75, 0.75])
      box(wood, -16.6, 0.2, z + zz, 3.9, 0.22, 0.12);
    for (let x of [-18.5, -14.7]) box(wood, x, 0.2, z, 0.1, 0.22, 1.55);
    for (let i = 0; i < 8; i++) {
      let x = -18.2 + i * 0.47;
      orb(plantMats[i % 3], x, 0.39, z, 0.3, 0.25, 0.38);
      if (z > 11) orb(mat("#d9a45a"), x, 0.5, z, 0.13);
    }
  }
  interactables.push({
    id: "garden",
    name: "Community Garden",
    type: "garden",
    x: -13,
    z: 9.4,
    radius: 2,
  });
  colliders.push({ x: -16.6, z: 9.6, w: 4.5, d: 7.5 });
  // Slim lanterns cast warm pools when the evening arrives.
  const lanterns = [];
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
    const light = new T.PointLight("#ffcd82", 0.6, 4, 2);
    light.position.set(x, 2.4, z);
    scene.add(light);
    lanterns.push(light);
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
  // Each tree keeps four material batches so offscreen specimens can be culled.
  const treePlacements = [
    [-20, -14, 1.3],
    [-16, -13, 1.2],
    [-11, -13, 1.4],
    [-4, -15, 1.5],
    [3, -15, 1.1],
    [7, -13, 1.35],
    [18, -15, 1.5],
    [22, -11, 1.2],
    [21, -1, 1.35],
    [20, 10, 1.1],
    [18, 15, 1.45],
    [8, 16, 1.5],
    [3, 16, 1.15],
    [-3, 17, 1.3],
    [-9, 16, 1.15],
    [-18, 17, 1.3],
    [-22, 8, 1.1],
    [-21, 1, 1.4],
    [-18, -7, 1],
    [-9, 8, 1.05],
    [6, -5, 0.9],
    [6.7, 8.5, 1.1],
  ];
  const trees = createTrees(treePlacements);
  scene.add(trees.group);
  for (const [x, z, s] of treePlacements) {
    contact(x, z, 2.1 * s, 2.1 * s);
    colliders.push({ x, z, r: 0.33 * s });
  }
  animated.push((dt, time) => trees.update(time));
  // Orchard and picket details around the first cottages.
  fence(-10, -3.2, -9, -3.2);
  fence(-5, -3.2, -3.8, -3.2);
  fence(-10.4, -3.2, -10.4, -7);
  fence(-18, -0.7, -15.6, -0.7);
  fence(-13.7, -0.7, -12.5, -0.7);
  // Bushes and garden border flowers, instanced for a dense but efficient painterly meadow.
  const bPositions = [];
  for (let i = 0; i < 45; i++) {
    const a = (i / 45) * Math.PI * 2;
    bPositions.push([Math.cos(a) * 21.8, Math.sin(a) * 18.7, range(0.55, 1)]);
  }
  for (let i = 0; i < 9; i++) bPositions.push([-10 + i * 0.7, -9.1, 0.5]);
  for (const [x, z, s] of bPositions)
    orb(
      plantMats[Math.floor(rand() * 3)],
      x,
      s * 0.43,
      z,
      s,
      s * 0.7,
      s * 0.78,
    );
  const blades = new T.InstancedMesh(
    new T.ConeGeometry(0.035, 0.32, 3),
    mat("#66834a"),
    3400,
  );
  const blossoms = new T.InstancedMesh(sphereG, flowerMats[0], 950);
  blossoms.instanceColor = new T.InstancedBufferAttribute(
    new Float32Array(950 * 3),
    3,
  );
  let bi = 0,
    fi = 0;
  function inRoad(x, z) {
    return (
      (Math.abs(z - 3) < 2 && x > -17 && x < 10) ||
      (Math.abs(x + 2) < 2 && z > -8 && z < 5) ||
      (Math.abs(x + 7) < 2 && z > -5 && z < 3) ||
      (Math.abs(x + 12) < 1.9 && z > 3) ||
      (Math.abs(z - 10.3) < 1.7 && x > -13 && x < 1) ||
      Math.hypot(x + 1, (z - 2.7) * 1.16) < 5.35 ||
      (x > 9.4 && x < 14.6) ||
      (x > 14.4 && x < 17.6 && z > -5 && z < 5)
    );
  }
  function isBlocked(x, z) {
    return colliders.some((c) =>
      c.w
        ? Math.abs(x - c.x) < c.w / 2 + 0.45 &&
          Math.abs(z - c.z) < c.d / 2 + 0.45
        : Math.hypot(x - c.x, z - c.z) < c.r + 0.2,
    );
  }
  let tries = 0;
  while (bi < 3400 && tries++ < 22000) {
    const x = range(-22.7, 22.7),
      z = range(-19.5, 19.5);
    if (inRoad(x, z) || isBlocked(x, z)) continue;
    dum.position.set(x, 0.15, z);
    dum.rotation.set(range(-0.3, 0.3), rand() * 6.28, range(-0.3, 0.3));
    dum.scale.set(1, range(0.6, 1.4), 1);
    dum.updateMatrix();
    blades.setMatrixAt(bi++, dum.matrix);
    if (
      fi < 950 &&
      rand() < 0.34 &&
      Math.sin(x * 0.72) + Math.sin(z * 0.84) + Math.sin((x + z) * 0.47) > 0.65
    ) {
      dum.position.y = 0.28;
      dum.scale.set(0.07, 0.045, 0.07);
      dum.updateMatrix();
      blossoms.setMatrixAt(fi, dum.matrix);
      blossoms.setColorAt(
        fi,
        new T.Color(
          ["#f0db9a", "#e0baab", "#d9d8c5", "#b2a3c9"][Math.floor(rand() * 4)],
        ),
      );
      fi++;
    }
  }
  blades.count = bi;
  blossoms.count = fi;
  blades.receiveShadow = true;
  scene.add(blades, blossoms);

  // Reeds and broad lily leaves interrupt the water edge with natural silhouettes.
  const reedPlacements = [],
    lilyMat = mat("#71926a");
  for (let i = 0; i < 35; i++) {
    const z = range(-18, 18);
    if (z > 0.3 && z < 5.6) continue;
    const x = rand() > 0.5 ? 10.22 : 13.78;
    for (let k = 0; k < 3; k++) {
      const xx = x + range(-0.17, 0.17),
        zz = z + range(-0.25, 0.25),
        h = range(0.45, 0.85);
      // Settle into the shallows on the waterward side of the bank stones.
      reedPlacements.push({ x: xx + (x < 12 ? 0.22 : -0.22), z: zz, height: h });
    }
  }
  const reeds = createReeds(reedPlacements, (x, z) => {
    const [depth] = sampleWaterField(riverConfig, x - riverConfig.x, z);
    return riverConfig.y - depth - 0.02;
  });
  scene.add(reeds.group);
  animated.push((dt, time) => reeds.update(time));
  for (const [x, z] of [
    [11.1, 8],
    [13, -11],
    [11.4, 13],
    [12.7, -3],
  ]) {
    const floating = new T.Group();
    floating.userData.dynamic = true;
    floating.position.set(x, 0.139, z);
    scene.add(floating);
    const leaf = mesh(
      new T.CircleGeometry(0.26, 28, 0, Math.PI * 1.85),
      lilyMat,
      0,
      0,
      0,
      1,
      1,
      1,
      floating,
    );
    leaf.rotation.x = -Math.PI / 2;
    leaf.rotation.z = rand() * 6.28;
    orb(flowerMats[1], 0.02, 0.06, 0, 0.09, 0.05, 0.09, floating);
    animated.push(() => {
      const t = water.time;
      floating.position.y =
        0.139 + Math.sin(x * 1.01 + z * 3.46 - t * 5.95) * 0.011;
      floating.rotation.z = Math.sin(z * 2.1 - t * 3.6) * 0.025;
      floating.rotation.x = Math.cos(x * 2.3 + t * 2.8) * 0.02;
    });
  }
  // Curving beds of lavender near front walkway.
  const stalkMat = mat("#79916a"),
    lavender = mat("#a59cb5");
  for (let i = 0; i < 26; i++) {
    let a = i * 0.35,
      x = -5 + Math.cos(a) * range(0.8, 1.4),
      z = 7 + Math.sin(a) * 0.45;
    mesh(new T.ConeGeometry(0.08, 0.44, 5), lavender, x, 0.43, z);
  }
  // Irregular cobbles settle into path edges and the fountain apron.
  const stones = new T.InstancedMesh(
    new T.DodecahedronGeometry(1, 0),
    stone,
    220,
  );
  for (let i = 0; i < 220; i++) {
    let x, z;
    if (i < 90) {
      let a = (i / 90) * 6.283;
      x = -1 + Math.cos(a) * range(2.1, 2.8);
      z = 2.5 + Math.sin(a) * range(2.1, 2.8);
    } else {
      x = range(-16, 8.5);
      z = 3 + (rand() > 0.5 ? 1 : -1) * range(1.35, 1.62);
    }
    dum.position.set(x, 0.108, z);
    dum.rotation.set(0, rand() * 6.28, 0);
    dum.scale.set(range(0.11, 0.2), 0.045, range(0.12, 0.24));
    dum.updateMatrix();
    stones.setMatrixAt(i, dum.matrix);
  }
  stones.receiveShadow = true;
  scene.add(stones);
  // Handcrafted village accents: mailboxes, well used barrels, stacked firewood and flags.
  function barrel(x, z) {
    cyl(wood, x, 0.42, z, 0.31, 0.76);
    for (let y of [0.14, 0.67]) cyl(darkStone, x, y, z, 0.325, 0.05);
    cyl(darkWood, x, 0.81, z, 0.27, 0.045);
  }
  barrel(-10, -5);
  barrel(-10, -5.8);
  barrel(4.25, -7.1);
  barrel(19.5, -5.9);
  for (let i = 0; i < 8; i++) {
    const o = cyl(
      wood,
      -4.1 + (i % 4) * 0.27,
      0.21 + Math.floor(i / 4) * 0.23,
      -6.6,
      0.115,
      0.65,
    );
    o.rotation.x = Math.PI / 2;
  }
  box(wood, -4.7, 0.65, -2.65, 0.08, 1.3, 0.08);
  box(roofBlue, -4.7, 1.35, -2.65, 0.56, 0.38, 0.45);
  box(trim, -4.7, 1.37, -2.405, 0.38, 0.13, 0.01);
  const flags = new T.Group();
  scene.add(flags);
  beam(darkWood, [-4.2, 3.2, -2.5], [4.7, 3.2, -2.5], 0.025, flags);
  for (let i = 0; i < 13; i++) {
    let x = -3.8 + i * 0.65,
      y = 3.12 - Math.sin((i / 12) * Math.PI) * 0.45;
    const shape = new T.Shape();
    shape.moveTo(-0.2, 0);
    shape.lineTo(0.2, 0);
    shape.lineTo(0, -0.38);
    shape.closePath();
    mesh(
      new T.ShapeGeometry(shape),
      new T.MeshStandardMaterial({
        color: ["#b58462", "#d8c491", "#819a97"][i % 3],
        side: T.DoubleSide,
      }),
      x,
      y,
      -2.5,
      1,
      1,
      1,
      flags,
    );
  }
  // Sunny dust motes drifting subtly through the air.
  const pGeo = new T.BufferGeometry(),
    pos = new Float32Array(120 * 3);
  for (let i = 0; i < 120; i++) {
    pos[i * 3] = range(-20, 20);
    pos[i * 3 + 1] = range(0.6, 5);
    pos[i * 3 + 2] = range(-16, 17);
  }
  pGeo.setAttribute("position", new T.BufferAttribute(pos, 3));
  const particles = new T.Points(
    pGeo,
    new T.PointsMaterial({
      color: "#f8e4b4",
      size: 0.045,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    }),
  );
  scene.add(particles);
  animated.push((dt, t) => {
    particles.rotation.y = Math.sin(t * 0.04) * 0.015;
    particles.position.y = Math.sin(t * 0.3) * 0.1;
  });
  // Bake static architectural and botanical meshes into one draw per material.
  scene.updateMatrixWorld(true);
  const batches = new Map(),
    remove = [];
  function collect(node, dynamic = false) {
    dynamic = dynamic || node.userData.dynamic;
    for (const child of [...node.children]) collect(child, dynamic);
    if (
      !node.isMesh ||
      node.isInstancedMesh ||
      dynamic ||
      Array.isArray(node.material) ||
      node.material.transparent
    )
      return;
    const geometry = node.geometry.clone().applyMatrix4(node.matrixWorld);
    const key = node.material.uuid;
    if (!batches.has(key))
      batches.set(key, { material: node.material, geometries: [] });
    batches
      .get(key)
      .geometries.push(geometry.index ? geometry.toNonIndexed() : geometry);
    remove.push(node);
  }
  for (const root of [...scene.children])
    if (!initialChildren.has(root)) collect(root);
  for (const { material, geometries } of batches.values()) {
    const merged = mergeGeometries(geometries, false);
    if (merged) {
      const obj = new T.Mesh(merged, material);
      obj.castShadow = true;
      obj.receiveShadow = true;
      scene.add(obj);
    }
    for (const g of geometries) g.dispose();
  }
  for (const obj of remove) obj.removeFromParent();
  const getGroundHeight = (x, z) =>
    x >= 9.1 && x <= 14.86 && z >= 1.25 && z <= 4.75
      ? 0.33 + Math.sin(((x - 9.1) / 5.76) * Math.PI) * 0.39
      : 0.05;
  const isPlantable = (x, z) =>
    Math.abs(x) < 22 && Math.abs(z) < 18 && !inRoad(x, z) && !isBlocked(x, z);
  return {
    water,
    getGroundHeight,
    isPlantable,
    colliders,
    treeCanopies: trees.canopyBounds,
    interactables,
    spawn: { x: -2.8, z: 6.2 },
    update(dt, time) {
      water.update(dt);
      for (const f of animated) f(dt, time);
    },
    lanterns,
  };
}
