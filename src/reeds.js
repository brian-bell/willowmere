import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const TAU = Math.PI * 2;

function random(seed) {
  return () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
}

function seedTexture() {
  const rand = random(1907),
    data = new Uint8Array(64 * 128 * 4);
  for (let i = 0; i < data.length; i += 4) {
    const grain = 185 + Math.floor(rand() * 70);
    data.set([grain, grain, grain, 255], i);
  }
  const texture = new T.DataTexture(data, 64, 128);
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(2, 3);
  texture.generateMipmaps = true;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.magFilter = T.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

// Curved ribbons and rounded seed heads share a breeze, including their shadows.
// Short stretches of each bank are batched separately for reflection culling.
export function createReeds(placements, bedHeight) {
  const group = new T.Group();
  group.name = "Riverbank reeds";
  group.userData.dynamic = true;
  const time = { value: 0 },
    grain = seedTexture();
  const foliageMaterial = new T.MeshStandardMaterial({
    vertexColors: true,
    side: T.DoubleSide,
    roughness: 0.85,
  });
  const headMaterial = new T.MeshStandardMaterial({
    vertexColors: true,
    map: grain,
    bumpMap: grain,
    bumpScale: 0.004,
    roughness: 1,
  });
  const depthMaterial = new T.MeshDepthMaterial({
    depthPacking: T.RGBADepthPacking,
    side: T.DoubleSide,
  });
  function windShader(shader) {
    shader.uniforms.uReedTime = time;
    shader.vertexShader =
      "uniform float uReedTime;\nattribute vec3 reedWind;\n" +
      shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      float sway = sin(uReedTime * 1.15 + reedWind.z) * 0.055
        + sin(uReedTime * 0.47 + reedWind.z * 1.7) * 0.025;
      transformed.x += sway * reedWind.x;
      transformed.z += cos(uReedTime * 0.91 + reedWind.z) * 0.035 * reedWind.x;
      transformed.x += sin(uReedTime * 2.4 + reedWind.z * 3.0)
        * 0.012 * reedWind.y;`,
    );
  }
  for (const material of [foliageMaterial, headMaterial, depthMaterial]) {
    material.onBeforeCompile = windShader;
    material.customProgramCacheKey = () => "willowmere-reed-wind-v1";
  }

  const batches = new Map(),
    greens = ["#718b48", "#829956", "#587847", "#8b9b58"],
    straw = new T.Color("#ab985b"),
    rootColor = new T.Color("#625b35"),
    up = new T.Vector3(0, 1, 0);

  for (const { x, z, height } of placements) {
    const rand = random(
        (Math.round((x + 30) * 7381) ^ Math.round((z + 30) * 19391)) >>> 0,
      ),
      range = (a, b) => a + (b - a) * rand(),
      root = new T.Vector3(x, bedHeight(x, z), z),
      // Keep the crown above the water while rooting the plant in the channel bed.
      crown = 0.64 + height * 0.74,
      length = crown - root.y,
      phase = x * 0.71 + z * 0.63,
      angle = rand() * TAU,
      lean = range(0.08, 0.2),
      leafColor = new T.Color(greens[Math.floor(rand() * greens.length)]);
    const key = `${x < 12 ? "west" : "east"}:${Math.floor((z + 21) / 7)}`;
    if (!batches.has(key)) batches.set(key, [[], []]);
    const parts = batches.get(key);

    function finish(geometry, colorAt, head = false, flutter = null) {
      const position = geometry.attributes.position,
        colors = [],
        wind = [];
      for (let i = 0; i < position.count; i++) {
        const h = Math.max(0, (position.getY(i) - root.y) / length),
          color = colorAt(i, h);
        colors.push(color.r, color.g, color.b);
        wind.push(h * h, flutter?.[i] || 0, phase);
      }
      geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
      geometry.setAttribute("reedWind", new T.Float32BufferAttribute(wind, 3));
      parts[head ? 1 : 0].push(geometry);
    }

    const stem = new T.QuadraticBezierCurve3(
      root,
      root.clone().add(new T.Vector3(0, length * 0.57, 0)),
      new T.Vector3(x + Math.cos(angle) * lean, crown, z + Math.sin(angle) * lean),
    );
    const stemGeometry = new T.TubeGeometry(stem, 9, 0.014, 6, false);
    finish(stemGeometry, (i, h) =>
      rootColor.clone().lerp(leafColor, Math.min(1, h * 2)),
    );

    // Each folded blade has two lit faces, a raised midrib and a fine pointed tip.
    const leafCount = 5 + Math.floor(rand() * 3);
    for (let leaf = 0; leaf < leafCount; leaf++) {
      const bearing = angle + leaf * 2.399 + range(-0.3, 0.3),
        dry = leaf === 0 && rand() < 0.45,
        upright = leaf % 3 === 0,
        rise = length * (dry ? range(0.6, 0.76) : range(0.85, 1.16)),
        reach = upright ? range(0.15, 0.3) : range(0.35, 0.65),
        droop = rise * (upright ? 0.035 : range(0.17, 0.31)),
        width = range(0.028, 0.044),
        twist = range(-0.5, 0.5),
        color = dry ? straw : leafColor.clone().multiplyScalar(range(0.9, 1.12)),
        positions = [],
        uvs = [],
        indices = [],
        flutter = [],
        segments = 16;
      for (let segment = 0; segment <= segments; segment++) {
        const t = segment / segments,
          spread = reach * Math.pow(t, 1.7),
          y = root.y + rise * (2 * t - t * t) - droop * Math.pow(t, 4),
          halfWidth = width * Math.pow(Math.sin(Math.PI * t), 0.75),
          turn = bearing + twist * t;
        for (let side = -1; side <= 1; side++) {
          const ridge = side === 0 ? halfWidth * 0.3 : 0;
          positions.push(
            x + Math.cos(bearing) * spread - Math.sin(turn) * halfWidth * side,
            y + ridge,
            z + Math.sin(bearing) * spread + Math.cos(turn) * halfWidth * side,
          );
          uvs.push((side + 1) / 2, t);
          flutter.push(Math.pow(t, 4));
        }
        if (segment < segments)
          for (let side = 0; side < 2; side++) {
            const a = segment * 3 + side;
            indices.push(a, a + 3, a + 1, a + 1, a + 3, a + 4);
          }
      }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      finish(
        geometry,
        (i, h) => {
          const tint = rootColor.clone().lerp(color, Math.min(1, h * 2.3));
          tint.lerp(
            straw,
            Math.max(0, (Math.floor(i / 3) / segments - 0.72) * 0.7),
          );
          return tint.multiplyScalar(i % 3 === 1 ? 1.1 : i % 3 === 0 ? 0.91 : 1);
        },
        false,
        flutter,
      );
    }

    // Young shoots break up the rhythm of the mature velvet-brown cattails.
    if (rand() < 0.2) continue;
    const headLength = range(0.22, 0.34),
      radius = range(0.044, 0.06),
      headBase = stem.getPoint(1),
      tangent = stem.getTangent(1),
      rotation = new T.Quaternion().setFromUnitVectors(up, tangent),
      profile = [
        [0, 0],
        [0.7, 0.025],
        [0.97, 0.08],
        [1, 0.2],
        [0.96, 0.76],
        [0.85, 0.93],
        [0.52, 0.985],
        [0, 1],
      ].map(([r, y]) => new T.Vector2(r * radius, y * headLength)),
      head = new T.LatheGeometry(profile, 10);
    head.applyQuaternion(rotation).translate(...headBase.toArray());
    const headColor = new T.Color(rand() < 0.3 ? "#88623d" : "#6e4b30");
    finish(head, (i) => headColor.clone().multiplyScalar(range(0.9, 1.13)), true);

    const tipLength = range(0.055, 0.11),
      tip = new T.ConeGeometry(0.009, tipLength, 5);
    tip.translate(0, headLength + tipLength / 2 - 0.015, 0);
    tip.applyQuaternion(rotation).translate(...headBase.toArray());
    finish(tip, () => straw);
  }

  for (const [key, parts] of batches) {
    for (let i = 0; i < parts.length; i++) {
      if (!parts[i].length) continue;
      const geometry = mergeGeometries(parts[i]);
      for (const part of parts[i]) part.dispose();
      geometry.computeBoundingBox();
      geometry.boundingBox.expandByScalar(0.25);
      geometry.computeBoundingSphere();
      geometry.boundingSphere.radius += 0.25;
      const mesh = new T.Mesh(geometry, i ? headMaterial : foliageMaterial);
      mesh.name = `${i ? "Cattail heads" : "Reed leaves and stems"} · ${key}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.customDepthMaterial = depthMaterial;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }
  }

  return {
    group,
    update(elapsed) {
      time.value = elapsed;
    },
  };
}
