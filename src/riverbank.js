import * as T from "three";

const TAU = Math.PI * 2;
const bankZones = {
  west: [
    { kind: "sand", z: -15.3, length: 5.2, across: 0.48 },
    { kind: "rock", z: -8.2, length: 4.1, across: 0.34 },
    { kind: "grass", z: 9.5, length: 6.2, across: 0.62 },
    { kind: "gravel", z: 17.4, length: 3.7, across: 0.35 },
  ],
  east: [
    { kind: "gravel", z: -16.3, length: 4.4, across: 0.4 },
    { kind: "rock", z: -7.1, length: 4.3, across: 0.35 },
    { kind: "sand", z: 10.1, length: 5.5, across: 0.44 },
    { kind: "grass", z: 17.2, length: 4.6, across: 0.62 },
  ],
};
const colors = {
  turf: new T.Color("#7f9f5c"),
  grass: new T.Color("#6f9254"),
  earth: new T.Color("#a2926e"),
  damp: new T.Color("#777e66"),
  sand: new T.Color("#d1bb8a"),
  gravel: new T.Color("#aaa790"),
  rock: new T.Color("#969b89"),
};

function random(seed) {
  return () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
}

function smooth(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function edge(z) {
  return 2.1 + 0.045 * Math.sin(z * 1.7) + 0.025 * Math.sin(z * 4.1 + 0.7);
}

function bankWidth(z, side) {
  return 1.05 + 0.14 * Math.sin(z * 0.48 + side * 1.6);
}

function bankHeight(z, u, side) {
  const rise = Math.sin(Math.PI * Math.pow(u, 0.72));
  return (
    0.054 +
    0.018 * (1 - u) +
    rise * (0.077 + 0.009 * Math.sin(z * 0.77 + side * 1.7)) +
    rise * 0.006 * Math.sin(z * 4.7 + u * 9.2)
  );
}

function patchWeight(zone, z, u, side) {
  const sway = 0.34 * Math.sin(z * 0.93 + side) + 0.15 * Math.sin(z * 2.2);
  const across = zone.kind === "grass" ? 0.83 : zone.kind === "sand" ? 0.62 : 0.68;
  const distance = Math.hypot(
    (z - zone.z + sway) / zone.length,
    (u - zone.across) / across,
  );
  return 1 - smooth(0.67, 1.07, distance);
}

function surfaceColor(side, z, u) {
  const color = colors.turf.clone().lerp(colors.earth, (1 - smooth(0.02, 0.72, u)) * 0.6);
  for (const zone of bankZones[side < 0 ? "west" : "east"]) {
    const weight = patchWeight(zone, z, u, side);
    color.lerp(colors[zone.kind], weight * (zone.kind === "grass" ? 0.8 : 0.94));
  }
  color.lerp(colors.damp, (1 - smooth(0, 0.19, u)) * 0.45);
  const mottling = 1 + 0.025 * Math.sin(z * 6.2 + u * 21) * Math.sin(z * 3.7 - u * 17);
  return color.multiplyScalar(mottling);
}

function bankPoint(side, z, u) {
  return [12 + side * (edge(z) + bankWidth(z, side) * u), bankHeight(z, u, side), z];
}

function terrainTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d"),
    rand = random(251803);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 6500; i++) {
    const shade = Math.floor(223 + rand() * 32);
    ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
    ctx.fillRect(rand() * 256, rand() * 256, 0.5 + rand() * 1.6, 0.5 + rand() * 1.6);
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function terrain(side, material) {
  const positions = [],
    colorData = [],
    uvs = [],
    indices = [],
    rows = 280,
    columns = 10;
  for (let row = 0; row <= rows; row++) {
    const z = -20.95 + (row / rows) * 41.9;
    for (let column = 0; column <= columns; column++) {
      const u = column / columns,
        color = surfaceColor(side, z, u);
      positions.push(...bankPoint(side, z, u));
      colorData.push(color.r, color.g, color.b);
      uvs.push(u * 2.8, z * 1.45);
      if (row === rows || column === columns) continue;
      const a = row * (columns + 1) + column,
        b = a + 1,
        c = a + columns + 1,
        d = c + 1;
      if (side < 0) indices.push(a, b, c, b, d, c);
      else indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new T.Float32BufferAttribute(colorData, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new T.Mesh(geometry, material);
  mesh.name = side < 0 ? "West riverbank" : "East riverbank";
  mesh.receiveShadow = true;
  return mesh;
}

function grassGeometry() {
  const vertices = [],
    indices = [];
  for (let blade = 0; blade < 5; blade++) {
    const angle = blade * (TAU / 5),
      c = Math.cos(angle),
      s = Math.sin(angle),
      offset = blade * 0.025,
      base = vertices.length / 3,
      reach = 0.055 + (blade % 2) * 0.02,
      height = 0.16 + (blade % 3) * 0.036;
    vertices.push(
      c * offset - s * 0.025, 0, s * offset + c * 0.025,
      c * offset + s * 0.025, 0, s * offset - c * 0.025,
      c * (offset + reach), height, s * (offset + reach),
    );
    indices.push(base, base + 1, base + 2);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// Each bank uses its own seed, so river dressing does not rearrange the village.
export function createRiverbank(scene) {
  const terrainMaterial = new T.MeshStandardMaterial({
    vertexColors: true,
    map: terrainTexture(),
    roughness: 1,
    side: T.DoubleSide,
  });
  scene.add(terrain(-1, terrainMaterial), terrain(1, terrainMaterial));

  const rock = new T.InstancedMesh(
    new T.IcosahedronGeometry(1, 1),
    new T.MeshStandardMaterial({ roughness: 0.96, flatShading: true }),
    240,
  );
  rock.name = "Riverbank angular rocks";
  const cobbles = new T.InstancedMesh(
    new T.DodecahedronGeometry(1, 0),
    new T.MeshStandardMaterial({ roughness: 0.98, flatShading: true }),
    180,
  );
  cobbles.name = "Riverbank rounded cobbles";
  const pebbles = new T.InstancedMesh(
    new T.IcosahedronGeometry(1, 0),
    new T.MeshStandardMaterial({ roughness: 1, flatShading: true }),
    1300,
  );
  pebbles.name = "Riverbank shingle and pebbles";
  const grass = new T.InstancedMesh(
    grassGeometry(),
    new T.MeshStandardMaterial({
      color: "#ffffff",
      emissive: "#40532c",
      emissiveIntensity: 0.12,
      roughness: 1,
      side: T.DoubleSide,
    }),
    420,
  );
  grass.name = "Riverbank grass tufts";

  const randomValue = random(731042),
    range = (a, b) => a + (b - a) * randomValue(),
    dummy = new T.Object3D(),
    rockColors = ["#92958a", "#aaa99a", "#777e76", "#b6ad99", "#858b79", "#a89b80", "#6e7e73"].map((c) => new T.Color(c)),
    cobbleColors = ["#b4ad98", "#8d9388", "#a29780", "#777f77", "#c1b69c", "#949b8d"].map((c) => new T.Color(c)),
    pebbleColors = ["#b7ab90", "#928e7b", "#c4b89a", "#899087", "#aaa997", "#766f63", "#d1c2a4"].map((c) => new T.Color(c));
  let rockCount = 0,
    cobbleCount = 0,
    pebbleCount = 0,
    grassCount = 0;

  function addStone(kind, side, z, u, size) {
    const [x, y, zz] = bankPoint(side, z, u),
      rounded = kind === "cobble",
      height = size * range(rounded ? 0.62 : 0.42, rounded ? 0.95 : 0.72),
      mesh = kind === "rock" ? rock : rounded ? cobbles : pebbles,
      palette = kind === "rock" ? rockColors : rounded ? cobbleColors : pebbleColors;
    dummy.position.set(x, y + height * 0.34, zz);
    dummy.rotation.set(range(-0.24, 0.24), range(0, TAU), range(-0.24, 0.24));
    dummy.scale.set(size * range(0.75, 1.55), height, size * range(0.75, 1.6));
    dummy.updateMatrix();
    const index = kind === "rock" ? rockCount++ : rounded ? cobbleCount++ : pebbleCount++;
    mesh.setMatrixAt(index, dummy.matrix);
    mesh.setColorAt(index, palette[Math.floor(randomValue() * palette.length)]);
  }

  for (const side of [-1, 1]) {
    const zones = bankZones[side < 0 ? "west" : "east"];
    for (const zone of zones) {
      if (zone.kind === "rock") {
        for (let i = 0; i < 64; i++) {
          const z = range(zone.z - zone.length * 0.9, zone.z + zone.length * 0.9),
            u = range(0.07, 0.88);
          if (randomValue() > patchWeight(zone, z, u, side)) continue;
          addStone(randomValue() < 0.48 ? "cobble" : "rock", side, z, u, i < 7 ? range(0.2, 0.36) : range(0.08, 0.22));
        }
      }
      if (["sand", "gravel", "rock"].includes(zone.kind)) {
        for (let i = 0; i < 240; i++) {
          const z = range(zone.z - zone.length, zone.z + zone.length),
            u = range(0.03, zone.kind === "sand" ? 0.72 : 0.92);
          if (randomValue() > patchWeight(zone, z, u, side) * (zone.kind === "sand" ? 0.46 : 0.91)) continue;
          addStone("pebble", side, z, u, range(0.025, zone.kind === "rock" ? 0.085 : 0.065));
        }
      }
    }
    // Loose groups and solitary stones continue through the grassy and plain reaches.
    for (let stretch = -20.3; stretch < 20.4; stretch += 1.65) {
      const anchorZ = stretch + range(-0.7, 0.7),
        anchorU = range(0.12, 0.88),
        rocky = Math.max(...zones.filter((zone) => zone.kind === "rock" || zone.kind === "gravel").map((zone) => patchWeight(zone, anchorZ, anchorU, side)));
      if (randomValue() > 0.62 + rocky * 0.3) continue;
      const groupSize = randomValue() < 0.29 ? 1 : randomValue() < 0.72 ? 2 : 3;
      for (let i = 0; i < groupSize; i++) {
        const z = Math.max(-20.75, Math.min(20.75, anchorZ + range(-0.32, 0.32))),
          u = Math.max(0.09, Math.min(0.93, anchorU + range(-0.21, 0.21))),
          sizeRoll = randomValue(),
          size = sizeRoll < 0.11 ? range(0.22, 0.34) : sizeRoll < 0.47 ? range(0.12, 0.21) : range(0.065, 0.13);
        addStone(randomValue() < 0.5 ? "rock" : "cobble", side, z, u, size);
      }
    }
    // A light scatter of small stones ties the distinct bank materials together.
    for (let i = 0; i < 230; i++) {
      const z = range(-20.7, 20.7),
        u = range(0.08, 0.93),
        bare = Math.max(...zones.filter((zone) => zone.kind !== "grass").map((zone) => patchWeight(zone, z, u, side)));
      if (randomValue() < 0.28 + bare * 0.36)
        addStone("pebble", side, z, u, range(0.022, 0.07));
    }
    for (let i = 0; i < 260; i++) {
      const z = range(-20.7, 20.7),
        u = range(0.26, 0.98),
        grassy = zones.find((zone) => zone.kind === "grass"),
        grassWeight = patchWeight(grassy, z, u, side),
        bareWeight = zones.reduce((weight, zone) => zone.kind === "grass" ? weight : Math.max(weight, patchWeight(zone, z, u, side)), 0);
      if (randomValue() > (0.32 + grassWeight * 0.6) * (1 - bareWeight * 0.94)) continue;
      const [x, y, zz] = bankPoint(side, z, u);
      dummy.position.set(x, y - 0.005, zz);
      dummy.rotation.set(0, range(0, TAU), 0);
      dummy.scale.set(range(0.7, 1.35), range(0.58, 1.25), range(0.7, 1.35));
      dummy.updateMatrix();
      grass.setMatrixAt(grassCount++, dummy.matrix);
      grass.setColorAt(grassCount - 1, new T.Color(["#68854b", "#7f9e59", "#91a765", "#647f4b"][Math.floor(randomValue() * 4)]));
    }
  }
  rock.count = rockCount;
  cobbles.count = cobbleCount;
  pebbles.count = pebbleCount;
  grass.count = grassCount;
  rock.castShadow = rock.receiveShadow = true;
  cobbles.castShadow = cobbles.receiveShadow = true;
  pebbles.receiveShadow = true;
  grass.receiveShadow = true;
  scene.add(rock, cobbles, pebbles, grass);
}
