import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const TAU = Math.PI * 2;
const LEAF_AXIS = new T.Vector3(0, 0, 1);

function random(seed) {
  return () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
}

// The folded blade has a pointed tip and an actual raised midrib. There are no
// opaque canopy balls or alpha cards underneath the leaves.
function leafGeometry() {
  const positions = [],
    uvs = [],
    colors = [],
    indices = [];
  const widths = [0, 0.31, 0.25, 0];
  for (let row = 0; row < widths.length; row++) {
    const t = row / (widths.length - 1);
    for (let side = -1; side <= 1; side++) {
      positions.push(
        widths[row] * side,
        Math.sin(t * Math.PI) * (side === 0 ? 0.095 : -0.025) + t * t * 0.09,
        t,
      );
      uvs.push(0.5 + side * widths[row], t);
      const shade = side === 0 ? 1 : side < 0 ? 0.86 : 0.94;
      colors.push(shade, shade, shade * 0.96);
    }
  }
  for (let row = 0; row < widths.length - 1; row++) {
    const a = row * 3,
      b = a + 3;
    if (row > 0) indices.push(a, b, a + 1, a + 1, b + 2, a + 2);
    if (row < widths.length - 2)
      indices.push(a + 1, b, b + 1, a + 1, b + 1, b + 2);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function barkTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext("2d"),
    rand = random(718);
  ctx.fillStyle = "#99846b";
  ctx.fillRect(0, 0, 256, 512);
  // Continuous grain across the texture seam; finer broken cracks sit between
  // the broad cork ridges, so bark reads at both gameplay and portrait scale.
  for (let i = 0; i < 92; i++) {
    const x = rand() * 256,
      phase = rand() * TAU;
    const width = 0.4 + rand() * 2.5;
    for (let offset of [-256, 0, 256]) {
      ctx.beginPath();
      for (let y = -8; y <= 520; y += 4) {
        const xx =
          x +
          offset +
          Math.sin((y * TAU) / 512 + phase) * 4 +
          Math.sin((y * TAU) / 128 + phase) * 1.4;
        if (y === -8) ctx.moveTo(xx, y);
        else ctx.lineTo(xx, y);
      }
      ctx.strokeStyle = i % 3 ? "#695b4a80" : "#dac19a90";
      ctx.lineWidth = width;
      ctx.stroke();
    }
  }
  for (let i = 0; i < 1600; i++) {
    ctx.fillStyle = i % 2 ? "#332b211b" : "#ead9b52a";
    ctx.fillRect(
      rand() * 256,
      rand() * 512,
      0.6 + rand() * 1.7,
      1 + rand() * 6,
    );
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function leafTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = "#c4cca17a";
  ctx.lineWidth = 1.1;
  for (let i = 0; i < 6; i++) {
    const y = 24 + i * 15;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(64, y + 16);
      ctx.quadraticCurveTo(64 + side * 17, y + 3, 64 + side * 37, y - 10);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = "#e5e9bf";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(64, 0);
  ctx.lineTo(64, 128);
  ctx.stroke();
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}

// Specimens share materials, but retain separate bounds so offscreen trees
// can be culled in the village view and its water reflections.
export function createTrees(placements) {
  const group = new T.Group();
  group.name = "Willowmere trees";
  group.userData.dynamic = true; // Keep the leaf wind shader out of world baking.
  const woodParts = [],
    detailParts = [],
    leafRecords = [],
    litterRecords = [];
  const canopyBounds = [],
    specimens = [];
  const dummy = new T.Object3D();
  const bark = barkTexture();
  const woodMaterial = new T.MeshStandardMaterial({
    color: "#ffffff",
    map: bark,
    bumpMap: bark,
    bumpScale: 0.035,
    vertexColors: true,
    roughness: 0.94,
  });
  const detailMaterial = new T.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
  });
  const time = { value: 0 };
  const leafMaterial = new T.MeshStandardMaterial({
    color: "#ffffff",
    map: leafTexture(),
    vertexColors: true,
    roughness: 0.83,
    side: T.DoubleSide,
  });
  const depthMaterial = new T.MeshDepthMaterial({
    depthPacking: T.RGBADepthPacking,
    side: T.DoubleSide,
  });
  function windShader(shader) {
    shader.uniforms.uTreeTime = time;
    shader.vertexShader = "uniform float uTreeTime;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `
      #include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 anchor = instanceMatrix[3].xyz;
        float phase = anchor.x * 0.83 + anchor.z * 0.67;
        float shelter = smoothstep(0.5, 3.0, anchor.y);
        vec3 breeze = vec3(
          sin(uTreeTime * 1.15 + phase) * 0.028,
          sin(uTreeTime * 1.7 + phase * 1.3) * 0.009,
          cos(uTreeTime * 0.94 + phase) * 0.019
        ) * shelter;
        // Convert the world breeze into each rotated/scaled leaf's local basis.
        transformed += vec3(
          dot(instanceMatrix[0].xyz, breeze) / dot(instanceMatrix[0].xyz, instanceMatrix[0].xyz),
          dot(instanceMatrix[1].xyz, breeze) / dot(instanceMatrix[1].xyz, instanceMatrix[1].xyz),
          dot(instanceMatrix[2].xyz, breeze) / dot(instanceMatrix[2].xyz, instanceMatrix[2].xyz)
        );
        transformed.y += sin(uTreeTime * 2.7 + phase * 4.0) * 0.065
          * position.z * position.z * shelter;
      #endif
    `,
    );
  }
  leafMaterial.onBeforeCompile = windShader;
  depthMaterial.onBeforeCompile = windShader;
  leafMaterial.customProgramCacheKey = () => "willowmere-leaf-wind-v1";
  depthMaterial.customProgramCacheKey = () => "willowmere-leaf-depth-v1";

  function detail(geometry, position, scale, color, quaternion = null) {
    const g = geometry.clone();
    dummy.position.copy(position);
    dummy.scale.copy(scale);
    dummy.quaternion.copy(quaternion || new T.Quaternion());
    dummy.updateMatrix();
    g.applyMatrix4(dummy.matrix);
    const c = new T.Color(color),
      colors = [];
    for (let i = 0; i < g.attributes.position.count; i++)
      colors.push(c.r, c.g, c.b);
    g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    detailParts.push(g.index ? g.toNonIndexed() : g);
    if (g.index) g.dispose();
  }

  const ringGeometry = new T.TorusGeometry(1, 0.12, 5, 18);
  const scarGeometry = new T.SphereGeometry(1, 10, 6);
  const stoneGeometry = new T.IcosahedronGeometry(1, 1);
  const lichenGeometry = new T.IcosahedronGeometry(1, 0);
  const mushroomCap = new T.SphereGeometry(1, 10, 6, 0, TAU, 0, Math.PI * 0.57);

  for (const [x, z, scale = 1] of placements) {
    const start = [
      woodParts.length,
      detailParts.length,
      leafRecords.length,
      litterRecords.length,
    ];
    const seed =
      (Math.round((x + 32) * 7381) ^ Math.round((z + 32) * 19391)) >>> 0;
    const rand = random(seed),
      range = (a, b) => a + (b - a) * rand();
    const autumn = x < -17;
    const willow = x > 6 && z > 7 && x < 20;
    const lean = new T.Vector3(range(-0.19, 0.19), 0, range(-0.14, 0.14));
    const rotation = rand() * TAU;
    const stretch = range(0.93, 1.12);
    const localToWorld = (v) =>
      new T.Vector3(x + v.x * scale, v.y * scale, z + v.z * scale);
    const trunkPoints = [
      new T.Vector3(0, 0.07, 0),
      new T.Vector3(-lean.x * 0.2, 0.42, -lean.z * 0.2),
      new T.Vector3(lean.x * 0.45, 1.05, lean.z * 0.45),
      new T.Vector3(lean.x, 1.8, lean.z),
      new T.Vector3(lean.x + 0.09, 2.48, lean.z - 0.06),
      new T.Vector3(lean.x + 0.18, 3.48 * stretch, lean.z),
    ];
    const trunkCurve = new T.CatmullRomCurve3(trunkPoints);

    function branch(
      points,
      radius,
      tipRadius,
      segments = 9,
      radial = 7,
      root = false,
    ) {
      const curve = new T.CatmullRomCurve3(points);
      const frames = curve.computeFrenetFrames(segments, false);
      const vertices = [],
        normals = [],
        uvs = [],
        colors = [],
        indices = [];
      const length = curve.getLength();
      const wood = new T.Color("#c2ab8b"),
        moss = new T.Color("#6f7c47");
      for (let j = 0; j <= segments; j++) {
        const t = j / segments,
          center = curve.getPointAt(t);
        let r = T.MathUtils.lerp(radius, tipRadius, Math.pow(t, 0.72));
        if (radius > 0.2) r += 0.12 * Math.exp(-t * 15);
        for (let k = 0; k <= radial; k++) {
          const a = (k / radial) * TAU;
          const normal = frames.normals[j]
            .clone()
            .multiplyScalar(Math.cos(a))
            .addScaledVector(frames.binormals[j], Math.sin(a));
          const fluting =
            1 +
            0.07 * Math.sin(a * 5 + t * 2.3) +
            0.035 * Math.sin(a * 9 - t * 3.2);
          const point = localToWorld(
            center.clone().addScaledVector(normal, r * fluting),
          );
          vertices.push(...point.toArray());
          normals.push(...normal.toArray());
          uvs.push((k / radial) * (radius > 0.16 ? 2 : 1), t * length * 0.85);
          const color = wood
            .clone()
            .multiplyScalar(0.83 + Math.sin(a * 3 + t * 5) * 0.09);
          const damp =
            Math.max(0, 1 - center.y / (root ? 0.7 : 0.9)) *
            Math.max(0, 0.48 + normal.z * 0.55);
          color.lerp(moss, damp * 0.75);
          colors.push(color.r, color.g, color.b);
          if (j < segments && k < radial) {
            const p = j * (radial + 1) + k,
              q = p + radial + 1;
            indices.push(p, p + 1, q, p + 1, q + 1, q);
          }
        }
      }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute(
        "position",
        new T.Float32BufferAttribute(vertices, 3),
      );
      geometry.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
      geometry.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
      geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
      geometry.setIndex(indices);
      woodParts.push(geometry.toNonIndexed());
      geometry.dispose();
      return curve;
    }

    branch(trunkPoints, 0.235, 0.026, 22, 13);
    for (let i = 0; i < 7; i++) {
      const a = rotation + (i * TAU) / 7 + range(-0.15, 0.15),
        reach = range(0.48, 0.83);
      const direction = new T.Vector3(Math.cos(a), 0, Math.sin(a));
      branch(
        [
          direction.clone().multiplyScalar(0.11).setY(range(0.2, 0.36)),
          direction.clone().multiplyScalar(0.31).setY(0.15),
          direction
            .clone()
            .multiplyScalar(reach * 0.72)
            .setY(0.09),
          direction.clone().multiplyScalar(reach).setY(0.045),
        ],
        range(0.075, 0.115),
        0.009,
        7,
        7,
        true,
      );
    }

    // Old pruning scars are recessed dark ovals, framed by two lips of callus.
    for (let i = 0; i < 2; i++) {
      const t = 0.22 + i * 0.2,
        center = trunkCurve.getPointAt(t);
      const a = rotation + i * 2.1;
      const normal = new T.Vector3(Math.cos(a), 0.05, Math.sin(a)).normalize();
      const q = new T.Quaternion().setFromUnitVectors(LEAF_AXIS, normal);
      const radius = 0.235 + (0.026 - 0.235) * Math.pow(t, 0.72);
      const position = localToWorld(center.addScaledVector(normal, radius));
      detail(
        scarGeometry,
        position,
        new T.Vector3(0.058, 0.115, 0.013).multiplyScalar(scale),
        "#4e4030",
        q,
      );
      detail(
        ringGeometry,
        position.clone().addScaledVector(normal, 0.009 * scale),
        new T.Vector3(0.066, 0.13, 0.038).multiplyScalar(scale),
        "#8a7354",
        q,
      );
      detail(
        ringGeometry,
        position.clone().addScaledVector(normal, 0.015 * scale),
        new T.Vector3(0.034, 0.075, 0.022).multiplyScalar(scale),
        "#a08a61",
        q,
      );
    }

    // Small overlapping crusts follow the sheltered side of the lower trunk.
    // Their irregular outlines sit just proud of the bark, like old lichen.
    const lichenRandom = random(seed ^ 0x713a);
    for (let patch = 0; patch < 3; patch++) {
      const t = 0.09 + patch * 0.1;
      const center = trunkCurve.getPointAt(t);
      const a = rotation + 0.8 + patch * 0.7;
      const normal = new T.Vector3(Math.cos(a), 0, Math.sin(a));
      const across = new T.Vector3(-normal.z, 0, normal.x);
      const q = new T.Quaternion().setFromUnitVectors(LEAF_AXIS, normal);
      const radius =
        0.235 + (0.026 - 0.235) * Math.pow(t, 0.72) + 0.12 * Math.exp(-t * 15);
      for (let lobe = 0; lobe < 4; lobe++) {
        const position = center
          .clone()
          .addScaledVector(normal, radius + 0.003)
          .addScaledVector(across, (lichenRandom() - 0.5) * 0.055);
        position.y += (lichenRandom() - 0.5) * 0.08;
        const size = 0.015 + lichenRandom() * 0.013;
        detail(
          lichenGeometry,
          localToWorld(position),
          new T.Vector3(size, size * 0.8, 0.009).multiplyScalar(scale),
          ["#929576", "#a0a183", "#7b8662"][lobe % 3],
          q,
        );
      }
    }

    const foliageColors = (
      autumn
        ? ["#879252", "#a5a05b", "#bdad66", "#c5b674", "#939553"]
        : willow
          ? ["#567c58", "#6b925b", "#82a464", "#9ab577", "#739659"]
          : ["#50754a", "#668b50", "#7e9e58", "#9ab368", "#6d914f"]
    ).map((c) => new T.Color(c));
    const bounds = new T.Box3();

    function leaf(
      position,
      direction,
      size,
      color,
      narrow = false,
      litter = false,
    ) {
      const p = localToWorld(position);
      const quaternion = new T.Quaternion().setFromUnitVectors(
        LEAF_AXIS,
        direction.clone().normalize(),
      );
      if (litter) {
        const up = new T.Vector3(0, 1, 0);
        const forward = direction.clone().setY(0).normalize();
        quaternion.setFromRotationMatrix(
          new T.Matrix4().makeBasis(up.clone().cross(forward), up, forward),
        );
      } else {
        quaternion.multiply(
          new T.Quaternion().setFromAxisAngle(LEAF_AXIS, range(-1.05, 1.05)),
        );
      }
      const record = {
        position: p,
        quaternion,
        scale: new T.Vector3(narrow ? 0.49 : 1, 1, 1).multiplyScalar(
          size * scale,
        ),
        color,
      };
      (litter ? litterRecords : leafRecords).push(record);
      if (!litter && position.y > 0.8)
        bounds
          .expandByPoint(p)
          .expandByPoint(p.clone().addScaledVector(direction, size * scale));
    }

    function spray(center, radius, index) {
      const baseColor = foliageColors[index % foliageColors.length];
      // Fill a loose ellipsoid with leafy shoots. Paired leaves follow each
      // shoot, leaving irregular edges and small windows into the branchwork.
      const count = willow ? 17 : 21;
      for (let j = 0; j < count; j++) {
        const a = j * 2.39996 + rotation + index * 0.83;
        const y = 1 - (2 * (j + 0.5)) / count;
        const r = Math.sqrt(1 - y * y);
        const direction = new T.Vector3(
          Math.cos(a) * r,
          y * 0.72,
          Math.sin(a) * r,
        ).normalize();
        const end = center
          .clone()
          .add(
            new T.Vector3(
              direction.x * radius,
              direction.y * radius * 0.86,
              direction.z * radius,
            ),
          );
        if (willow && y < 0.25) end.y -= 0.22;
        const start = center.clone().addScaledVector(direction, -0.1);
        const middle = start
          .clone()
          .lerp(end, 0.57)
          .add(new T.Vector3(0, 0.06, 0));
        const twig = branch([start, middle, end], 0.009, 0.001, 2, 3);
        const across = new T.Vector3(
          -direction.z,
          0.1,
          direction.x,
        ).normalize();
        for (let node = 0; node < 3; node++) {
          const t = 0.35 + node * 0.28;
          const point = twig.getPointAt(t);
          for (let side of [-1, 1]) {
            const out = direction
              .clone()
              .multiplyScalar(0.6)
              .addScaledVector(across, side * 0.78)
              .setY(range(-0.15, 0.65))
              .normalize();
            if (willow) out.y -= 0.48;
            out.normalize();
            const color = baseColor
              .clone()
              .offsetHSL(
                range(-0.018, 0.018),
                range(-0.035, 0.025),
                range(-0.035, 0.045),
              );
            leaf(
              point,
              out,
              range(0.23, 0.36) * (willow ? 1.17 : 1),
              color,
              willow,
            );
          }
        }
        leaf(
          end,
          direction,
          range(0.23, 0.31),
          baseColor.clone().offsetHSL(0, 0, 0.04),
          willow,
        );
      }
    }

    // Staggered forks form a crown with a lower skirt, offset shoulders, and
    // a small high leader. Every foliage cluster is attached to a real branch.
    for (let i = 0; i < 9; i++) {
      const a = rotation + i * 2.39996;
      const high = i >= 6;
      const reach = high ? range(0.52, 0.87) : range(0.94, 1.36);
      const height = (high ? range(3.15, 3.65) : range(2.45, 3.12)) * stretch;
      const attachment = trunkCurve.getPointAt(high ? 0.65 : 0.37 + i * 0.04);
      const end = new T.Vector3(
        Math.cos(a) * reach + lean.x,
        height,
        Math.sin(a) * reach + lean.z,
      );
      const middle = attachment
        .clone()
        .lerp(end, 0.48)
        .add(new T.Vector3(0, 0.16, 0));
      const fork = branch(
        [attachment, middle, end],
        high ? 0.065 : 0.09,
        0.012,
        10,
        7,
      );
      spray(end, high ? range(0.4, 0.56) : range(0.52, 0.68), i);
      if (i < 6) {
        const forkStart = fork.getPointAt(0.62);
        const sideEnd = end
          .clone()
          .add(
            new T.Vector3(
              Math.cos(a + 1.05) * 0.42,
              -0.2,
              Math.sin(a + 1.05) * 0.42,
            ),
          );
        branch(
          [
            forkStart,
            forkStart
              .clone()
              .lerp(sideEnd, 0.5)
              .add(new T.Vector3(0, 0.08, 0)),
            sideEnd,
          ],
          0.033,
          0.006,
          6,
          5,
        );
        spray(sideEnd, range(0.33, 0.43), i + 2);
        if (willow) {
          // Flexible terminal shoots hang outside the main crown; their
          // alternating lanceolate leaves catch the light like little ribbons.
          for (let pendant = 0; pendant < 3; pendant++) {
            const angle = a + (pendant - 1) * 0.6;
            const start = sideEnd
              .clone()
              .add(
                new T.Vector3(
                  Math.cos(angle) * 0.16,
                  0.02,
                  Math.sin(angle) * 0.16,
                ),
              );
            const reach = range(0.3, 0.5),
              drop = range(0.72, 1.15);
            const tip = start
              .clone()
              .add(
                new T.Vector3(
                  Math.cos(angle) * reach,
                  -drop,
                  Math.sin(angle) * reach,
                ),
              );
            const arch = start
              .clone()
              .lerp(tip, 0.3)
              .add(new T.Vector3(0, 0.2, 0));
            const pendantCurve = branch(
              [start, arch, tip],
              0.013,
              0.0015,
              7,
              4,
            );
            for (let node = 1; node <= 6; node++) {
              const point = pendantCurve.getPointAt(node / 6);
              for (const side of [-1, 1]) {
                const direction = new T.Vector3(
                  Math.cos(angle + side * 0.9) * 0.4,
                  -1,
                  Math.sin(angle + side * 0.9) * 0.4,
                ).normalize();
                leaf(
                  point,
                  direction,
                  range(0.24, 0.36),
                  foliageColors[(i + node) % foliageColors.length].clone(),
                  true,
                );
              }
            }
          }
        }
      }
    }
    spray(trunkPoints.at(-1), 0.46, 3);
    canopyBounds.push(bounds.expandByScalar(0.16 * scale + 0.05));

    // Quiet details at the foot: mottled moss stones, fallen leaves, a few
    // small ferns, and occasional ochre mushrooms tucked between the roots.
    for (let i = 0; i < 8; i++) {
      const a = rotation + i * 2.4,
        radius = range(0.32, 0.69);
      detail(
        stoneGeometry,
        localToWorld(
          new T.Vector3(Math.cos(a) * radius, 0.085, Math.sin(a) * radius),
        ),
        new T.Vector3(
          range(0.055, 0.12),
          range(0.025, 0.06),
          range(0.045, 0.1),
        ).multiplyScalar(scale),
        ["#707e49", "#7e8a50", "#8a8e62"][i % 3],
      );
    }
    for (let i = 0; i < 17; i++) {
      const a = rand() * TAU,
        radius = range(0.4, 1.02);
      const direction = new T.Vector3(
        Math.cos(a + 1),
        range(0.02, 0.1),
        Math.sin(a + 1),
      ).normalize();
      leaf(
        new T.Vector3(Math.cos(a) * radius, 0.075, Math.sin(a) * radius),
        direction,
        range(0.1, 0.19),
        new T.Color(["#a89a59", "#948653", "#b5a46a", "#758448"][i % 4]),
        false,
        true,
      );
    }
    for (let fern = 0; fern < 2; fern++) {
      const a = rotation + fern * 2.7,
        base = new T.Vector3(Math.cos(a) * 0.59, 0.08, Math.sin(a) * 0.59);
      for (let frond = 0; frond < 5; frond++) {
        const angle = frond * 2.4 + a;
        const direction = new T.Vector3(Math.cos(angle), 0, Math.sin(angle));
        const frondPoints = Array.from({ length: 6 }, (_, i) => {
          const t = i / 5;
          const p = base.clone().addScaledVector(direction, t * 0.28);
          p.y += Math.sin(t * Math.PI * 0.9) * 0.18;
          return p;
        });
        const stem = new T.TubeGeometry(
          new T.CatmullRomCurve3(frondPoints),
          6,
          0.004,
          3,
          false,
        );
        detail(
          stem,
          localToWorld(new T.Vector3()),
          new T.Vector3(scale, scale, scale),
          "#6a8049",
        );
        stem.dispose();
        for (let node = 1; node < 5; node++) {
          const t = node / 5,
            p = frondPoints[node];
          for (const side of [-1, 1]) {
            const out = new T.Vector3(
              Math.cos(angle + side),
              0.3,
              Math.sin(angle + side),
            ).normalize();
            leaf(p, out, 0.095 * (1 - t * 0.55), new T.Color("#658046"), true);
          }
        }
      }
    }
    if (seed % 3 === 0) {
      const a = rotation + 1.2;
      for (let i = 0; i < 3; i++) {
        const base = new T.Vector3(
          Math.cos(a) * (0.43 + i * 0.09),
          0.08,
          Math.sin(a) * 0.45 + i * 0.04,
        );
        const height = range(0.09, 0.16);
        branch(
          [base, base.clone().add(new T.Vector3(0.012, height, 0))],
          0.012,
          0.009,
          3,
          5,
        );
        detail(
          mushroomCap,
          localToWorld(base.clone().add(new T.Vector3(0.012, height, 0))),
          new T.Vector3(0.065, 0.038, 0.065).multiplyScalar(scale),
          "#c29c64",
        );
      }
    }
    specimens.push({
      wood: woodParts.slice(start[0]),
      details: detailParts.slice(start[1]),
      leaves: leafRecords.slice(start[2]),
      litter: litterRecords.slice(start[3]),
    });
  }

  function batch(parts, material, name) {
    const geometry = mergeGeometries(parts, false);
    for (const part of parts) part.dispose();
    if (!geometry) return;
    const mesh = new T.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
  }
  const blade = leafGeometry();
  function instances(records, material, name, wind = false) {
    if (!records.length) return;
    const mesh = new T.InstancedMesh(blade, material, records.length);
    mesh.name = name;
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      dummy.position.copy(record.position);
      dummy.quaternion.copy(record.quaternion);
      dummy.scale.copy(record.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, record.color);
    }
    mesh.castShadow = wind;
    mesh.receiveShadow = true;
    if (wind) mesh.customDepthMaterial = depthMaterial;
    mesh.computeBoundingSphere();
    mesh.boundingSphere.radius += 0.12;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
    return mesh;
  }
  const litterMaterial = leafMaterial.clone();
  for (const specimen of specimens) {
    if (specimen.wood.length)
      batch(
        specimen.wood,
        woodMaterial,
        "Fluted bark, roots and branching twigs",
      );
    if (specimen.details.length)
      batch(
        specimen.details,
        detailMaterial,
        "Tree hollows, moss and woodland details",
      );
    instances(specimen.leaves, leafMaterial, "Living folded leaves", true);
    instances(
      specimen.litter,
      litterMaterial,
      "Leaves settled among the roots",
    );
  }
  for (const geometry of [
    ringGeometry,
    scarGeometry,
    stoneGeometry,
    lichenGeometry,
    mushroomCap,
  ])
    geometry.dispose();
  group.userData.treeCount = placements.length;
  group.userData.leafCount = leafRecords.length;
  return {
    group,
    canopyBounds,
    update: (elapsed) => {
      time.value = elapsed;
    },
  };
}
