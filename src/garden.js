import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// The fenced kitchen garden: three raised beds of mixed vegetables, a cutting
// border along the back fence, a climbing-rose arch over the gate, a scarecrow,
// and the clutter of a garden in use. Plants and painted props each share one
// vertex-coloured material, and timber reuses the village's wood, so the whole
// garden adds two materials to the static bake rather than one per colour.
export function createGarden(materials) {
  const { wood, darkWood, trim, soil, path } = materials;
  const plantMat = new T.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.82,
  });
  const propMat = new T.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.68,
  });
  // A private generator keeps the rest of the village layout unchanged.
  let seed = 51277;
  const rand = () =>
      (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296,
    range = (a, b) => a + (b - a) * rand(),
    pick = (list) => list[Math.floor(rand() * list.length)];

  const boxG = new T.BoxGeometry(1, 1, 1),
    stickG = new T.CylinderGeometry(1, 1, 1, 5),
    cylG = new T.CylinderGeometry(1, 1, 1, 10),
    coneG = new T.ConeGeometry(1, 1, 6),
    lumpG = new T.IcosahedronGeometry(1, 0),
    ballG = new T.IcosahedronGeometry(1, 1),
    berryG = new T.SphereGeometry(1, 6, 4),
    potG = new T.CylinderGeometry(1, 0.74, 1, 10),
    torusG = new T.TorusGeometry(1, 0.13, 4, 10, Math.PI);
  // A tapered, cupped leaf: base at the origin, length along +z, edges curling up.
  const leafG = new T.SphereGeometry(1, 6, 4);
  {
    const p = leafG.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = (p.getZ(i) + 1) / 2,
        x = p.getX(i) * 0.5 * (1 - 0.55 * u) * (0.55 + Math.sin(u * Math.PI));
      p.setXYZ(i, x, p.getY(i) * 0.1 + x * x * 0.9 + u * u * 0.18, u);
    }
    leafG.computeVertexNormals();
  }
  // Pumpkins and squash bulge between shallow ribs.
  const gourdG = new T.SphereGeometry(1, 12, 7);
  {
    const p = gourdG.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        z = p.getZ(i),
        k = 1 + 0.07 * Math.cos(Math.atan2(z, x) * 8);
      p.setXYZ(i, x * k, p.getY(i), z * k);
    }
    gourdG.computeVertexNormals();
  }

  const batches = new Map(),
    frames = [new T.Matrix4()],
    m4 = new T.Matrix4(),
    q = new T.Quaternion(),
    e = new T.Euler(),
    v = new T.Vector3(),
    s = new T.Vector3(),
    ca = new T.Color(),
    cb = new T.Color();
  const local = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) =>
    new T.Matrix4().compose(
      v.set(x, y, z),
      q.setFromEuler(e.set(rx, ry, rz, "YXZ")),
      s.set(sx, sy, sz),
    );
  // Runs build() with its placements relative to a parent transform.
  function within(matrix, build) {
    frames.push(frames.at(-1).clone().multiply(matrix));
    build();
    frames.pop();
  }
  // Coloured pieces fade from base to tip along their own height, with a
  // little per-piece jitter so repeated plants do not read as copies.
  function place(geometry, material, matrix, base, tip = base, cast = true) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    if (material === plantMat || material === propMat) {
      const p = g.attributes.position,
        colors = new Float32Array(p.count * 3);
      g.computeBoundingBox();
      const { min, max } = g.boundingBox,
        span = max.y - min.y || 1,
        lift = range(0.92, 1.08);
      ca.set(base);
      cb.set(tip);
      for (let i = 0; i < p.count; i++) {
        const f = (p.getY(i) - min.y) / span;
        colors[i * 3] = (ca.r + (cb.r - ca.r) * f) * lift;
        colors[i * 3 + 1] = (ca.g + (cb.g - ca.g) * f) * lift;
        colors[i * 3 + 2] = (ca.b + (cb.b - ca.b) * f) * lift;
      }
      g.setAttribute("color", new T.BufferAttribute(colors, 3));
    }
    g.applyMatrix4(frames.at(-1).clone().multiply(matrix));
    const key = `${material.uuid}/${cast}`;
    if (!batches.has(key)) batches.set(key, { material, cast, geometries: [] });
    batches.get(key).geometries.push(g);
  }
  const block = (ma, x, y, z, w, h, d, ry = 0, base, tip) =>
    place(boxG, ma, local(x, y, z, 0, ry, 0, w, h, d), base, tip);
  // A thin rod between two points.
  function rod(ma, a, b, r, base, tip, geometry = stickG) {
    const from = new T.Vector3(...a),
      to = new T.Vector3(...b),
      mid = from.clone().add(to).multiplyScalar(0.5),
      length = from.distanceTo(to);
    q.setFromUnitVectors(new T.Vector3(0, 1, 0), to.sub(from).normalize());
    place(
      geometry,
      ma,
      new T.Matrix4().compose(mid, q, s.set(r, length, r)),
      base,
      tip,
    );
  }
  function leaf(x, y, z, heading, tilt, w, length, base, tip, roll = 0) {
    place(
      leafG,
      plantMat,
      local(x, y, z, -tilt, heading, roll, w, w, length),
      base,
      tip,
    );
  }
  // Heading that points a leaf's +z outward along angle a in the xz plane.
  const outward = (a) => Math.PI / 2 - a;
  // Bed plants root in the raised soil; border plants in the lawn.
  const bedTop = 0.22,
    lawn = 0.05;

  // ---- Plants -------------------------------------------------------------
  function cabbage(x, z, sc, red) {
    const [outer, edge, heart] = red
      ? ["#4f3a55", "#8d5d8a", "#9a6b98"]
      : ["#4d7356", "#93b48d", "#c7d9a0"];
    within(local(x, bedTop, z, 0, rand() * 6.28, 0, sc), () => {
      place(
        ballG,
        plantMat,
        local(0, 0.15, 0, 0, 0, 0, 0.14, 0.13, 0.14),
        edge,
        heart,
      );
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        leaf(
          Math.cos(a) * 0.05,
          0.06,
          Math.sin(a) * 0.05,
          outward(a),
          0.45,
          0.36,
          0.26,
          outer,
          edge,
        );
      }
    });
  }
  function lettuce(x, z, sc, red) {
    const [base, tip] = red ? ["#7c9a4e", "#9b4a4c"] : ["#86ad57", "#c4dd86"];
    within(local(x, bedTop, z, 0, rand() * 6.28, 0, sc), () => {
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4,
          inner = i > 5;
        leaf(
          0,
          0.04,
          0,
          outward(a),
          inner ? 1.05 : 0.7,
          inner ? 0.24 : 0.32,
          inner ? 0.17 : 0.21,
          base,
          tip,
          range(-0.3, 0.3),
        );
      }
    });
  }
  function chard(x, z, sc) {
    const stem = pick(["#c8353d", "#e9c43c", "#e27ca3", "#f0ead6", "#e0782f"]);
    within(local(x, bedTop, z, 0, rand() * 6.28, 0, sc), () => {
      for (let i = 0; i < 5; i++) {
        const a = i * 2.5,
          tilt = range(0.15, 0.45),
          h = range(0.22, 0.3),
          tx = Math.cos(a) * Math.sin(tilt) * h,
          tz = Math.sin(a) * Math.sin(tilt) * h,
          ty = Math.cos(tilt) * h;
        rod(plantMat, [0, 0.03, 0], [tx, ty, tz], 0.012, stem, stem);
        leaf(
          tx,
          ty - 0.02,
          tz,
          outward(a),
          Math.PI / 2 - tilt - 0.35,
          0.3,
          0.24,
          "#355f35",
          "#4f7d43",
        );
      }
    });
  }
  function carrot(x, z, sc) {
    within(local(x, bedTop - 0.03, z, 0, rand() * 6.28, 0, sc), () => {
      place(
        coneG,
        plantMat,
        local(0, 0.035, 0, Math.PI, 0, 0, 0.035, 0.07, 0.035),
        "#c7561f",
        "#e98a35",
      );
      for (let i = 0; i < 4; i++) {
        const a = i * 1.7 + range(-0.3, 0.3),
          top = [Math.cos(a) * 0.07, range(0.2, 0.28), Math.sin(a) * 0.07];
        rod(plantMat, [0, 0.06, 0], top, 0.007, "#5e8a3c", "#78a548");
        place(
          lumpG,
          plantMat,
          local(top[0], top[1], top[2], 0, a, 0, 0.07, 0.035, 0.05),
          "#5f9a3f",
          "#93c45c",
        );
      }
    });
  }
  function tomato(x, z, h) {
    within(local(0, bedTop - 0.16, 0), () => tomatoPlant(x, z, h));
  }
  function tomatoPlant(x, z, h) {
    const poles = [0, 2.1, 4.2].map((a) => [
      Math.cos(a) * 0.2,
      Math.sin(a) * 0.2,
    ]);
    for (const [px, pz] of poles)
      rod(
        propMat,
        [x + px, 0.16, z + pz],
        [x + px * 0.15, h, z + pz * 0.15],
        0.012,
        "#b49a62",
        "#d7c58f",
      );
    rod(
      propMat,
      [x - 0.06, h * 0.82, z],
      [x + 0.06, h * 0.82, z],
      0.03,
      "#7b6a4c",
    );
    for (let i = 0; i < 9; i++) {
      const a = i * 2.3,
        y = 0.3 + (i / 9) * (h - 0.35),
        r = 0.16 - i * 0.008;
      place(
        lumpG,
        plantMat,
        local(
          x + Math.cos(a) * r * 0.6,
          y,
          z + Math.sin(a) * r * 0.6,
          rand(),
          rand() * 6,
          0,
          r,
          r * 0.8,
          r,
        ),
        "#3f6a35",
        "#6d9446",
      );
    }
    const fruit = ["#d23f2c", "#d23f2c", "#e0552f", "#f0a43a", "#9dbb4f"];
    for (let i = 0; i < 9; i++) {
      const a = i * 1.9 + 0.4,
        y = 0.32 + rand() * (h - 0.5),
        r = range(0.17, 0.21),
        c = pick(fruit);
      place(
        berryG,
        plantMat,
        local(
          x + Math.cos(a) * r,
          y,
          z + Math.sin(a) * r,
          0,
          0,
          0,
          0.045,
          0.04,
          0.045,
        ),
        c,
        c,
      );
    }
  }
  // Runner beans climb a cane wigwam and flower scarlet.
  function beans(x, z) {
    within(local(0, bedTop - 0.16, 0), () => beanWigwam(x, z));
  }
  function beanWigwam(x, z) {
    const top = [x, 1.55, z];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4,
        foot = [x + Math.cos(a) * 0.36, 0.16, z + Math.sin(a) * 0.36];
      rod(
        propMat,
        foot,
        [x - Math.cos(a) * 0.05, 1.68, z - Math.sin(a) * 0.05],
        0.012,
        "#a8905d",
        "#d2bd85",
      );
      for (let k = 0; k < 7; k++) {
        const f = (k + 0.5) / 7,
          px = foot[0] + (top[0] - foot[0]) * f,
          py = foot[1] + (top[1] - foot[1]) * f,
          pz = foot[2] + (top[2] - foot[2]) * f,
          side = k % 2 ? 1 : -1,
          ox = Math.cos(a + side * 0.9) * 0.06,
          oz = Math.sin(a + side * 0.9) * 0.06;
        place(
          lumpG,
          plantMat,
          local(px + ox, py, pz + oz, rand(), rand() * 6, 0, 0.1, 0.07, 0.09),
          "#3d6c36",
          "#6a9a48",
        );
        if (k % 2 && k < 6)
          place(
            berryG,
            plantMat,
            local(px + ox * 2, py + 0.05, pz + oz * 2, 0, 0, 0, 0.028),
            "#d9412e",
            "#ee6a3d",
          );
        if (k % 3 === 1)
          rod(
            plantMat,
            [px - ox, py, pz - oz],
            [px - ox * 1.2, py - 0.16, pz - oz * 1.2],
            0.01,
            "#6f9a42",
            "#86ad4f",
          );
      }
    }
  }
  function pumpkin(x, z, sc, color, y = bedTop) {
    within(local(x, y, z, 0, rand() * 6.28, 0, sc), () => {
      place(
        gourdG,
        plantMat,
        local(0, 0.11, 0, 0, 0, 0, 0.17, 0.12, 0.17),
        color[0],
        color[1],
      );
      rod(
        plantMat,
        [0, 0.21, 0],
        [0.02, 0.27, 0.01],
        0.016,
        "#6b5a32",
        "#8a7a45",
      );
      for (let i = 0; i < 4; i++) {
        const a = i * 1.6 + 0.8,
          r = range(0.22, 0.32);
        rod(
          plantMat,
          [0, 0.03, 0],
          [Math.cos(a) * r, 0.05, Math.sin(a) * r],
          0.01,
          "#5f8a3a",
          "#5f8a3a",
        );
        leaf(
          Math.cos(a) * r,
          0.05,
          Math.sin(a) * r,
          outward(a),
          range(-0.1, 0.25),
          0.62,
          0.26,
          "#3f6c3b",
          "#6a9752",
        );
      }
    });
  }
  function marigold(x, z, sc) {
    const bloom = pick(["#ef9324", "#f3be2d", "#cf5a22", "#f6d64a"]);
    within(local(x, lawn, z, 0, rand() * 6.28, 0, sc), () => {
      place(
        lumpG,
        plantMat,
        local(0, 0.08, 0, 0, 0, 0, 0.13, 0.09, 0.13),
        "#3e6a37",
        "#5e8c43",
      );
      for (let i = 0; i < 5; i++) {
        const a = i * 1.3,
          r = i ? 0.08 : 0;
        place(
          lumpG,
          plantMat,
          local(
            Math.cos(a) * r,
            0.15 + (i ? 0 : 0.02),
            Math.sin(a) * r,
            0,
            a,
            0,
            0.045,
            0.028,
            0.045,
          ),
          bloom,
          bloom,
        );
      }
    });
  }
  // Sunflowers turn their faces toward the overview camera's quarter.
  function sunflower(x, z, h) {
    const lean = range(-0.08, 0.08);
    rod(
      plantMat,
      [x, lawn, z],
      [x + lean, h, z + 0.06],
      0.022,
      "#4e7a35",
      "#6d9545",
    );
    for (const f of [0.3, 0.52, 0.72])
      leaf(
        x + lean * f,
        h * f,
        z,
        outward(rand() * 6.28),
        0.2,
        0.42,
        0.22,
        "#3f6b35",
        "#5f8c43",
      );
    within(
      local(x + lean, h, z + 0.08, -0.35, 0.55, 0, range(0.9, 1.15)),
      () => {
        place(
          cylG,
          plantMat,
          local(0, 0, 0, Math.PI / 2, 0, 0, 0.1, 0.05, 0.1),
          "#3d2717",
          "#6a4322",
        );
        for (let i = 0; i < 13; i++) {
          const a = (i / 13) * Math.PI * 2;
          place(
            leafG,
            plantMat,
            local(
              Math.cos(a) * 0.07,
              Math.sin(a) * 0.07,
              -0.01,
              0,
              0,
              0,
              0.11,
              0.11,
              0.13,
            )
              .multiply(new T.Matrix4().makeRotationZ(a - Math.PI / 2))
              .multiply(new T.Matrix4().makeRotationX(-Math.PI / 2)),
            "#e9a91f",
            "#f6cf3c",
          );
        }
      },
    );
  }
  function hollyhock(x, z, h, color) {
    rod(plantMat, [x, lawn, z], [x, h, z], 0.016, "#4c7537", "#6a9446");
    for (let i = 0; i < 4; i++)
      leaf(
        x,
        lawn + 0.02,
        z,
        outward(i * 1.6 + rand()),
        0.35,
        0.5,
        0.2,
        "#3c6635",
        "#5c8a45",
      );
    for (let i = 0; i < 9; i++) {
      const f = 0.42 + (i / 9) * 0.58,
        y = h * f,
        r = 0.075 * (1.15 - f * 0.75),
        a = i * 2.2,
        ox = Math.cos(a) * 0.04,
        oz = Math.sin(a) * 0.04 + 0.02;
      place(
        berryG,
        plantMat,
        local(x + ox, y, z + oz, 0.9, 0.55, 0, r, r * 0.45, r),
        color[0],
        color[1],
      );
    }
  }

  // Delphiniums: tapering spires of small blue or violet florets.
  function delphinium(x, z, h, color) {
    rod(plantMat, [x, lawn, z], [x, h, z], 0.014, "#4c7537", "#5f8a42");
    for (let i = 0; i < 3; i++)
      leaf(
        x,
        lawn + 0.02,
        z,
        outward(i * 2.1 + rand()),
        0.5,
        0.42,
        0.17,
        "#3c6635",
        "#5c8a45",
      );
    for (let i = 0; i < 12; i++) {
      const f = 0.5 + (i / 12) * 0.5,
        r = 0.05 * (1.2 - f),
        a = i * 2.4;
      place(
        berryG,
        plantMat,
        local(
          x + Math.cos(a) * r,
          h * f,
          z + Math.sin(a) * r,
          0,
          0,
          0,
          0.032 * (1.4 - f * 0.6),
        ),
        color[0],
        color[1],
      );
    }
  }

  // ---- Structures ---------------------------------------------------------
  function bed(cx, cz, w, d) {
    block(soil, cx, 0.13, cz, w - 0.08, 0.16, d - 0.08);
    for (let i = 0; i < 3; i++) {
      const rz = cz + (i - 1) * (d / 3.4);
      place(
        cylG,
        soil,
        local(cx, 0.2, rz, 0, 0, Math.PI / 2, 0.07, w - 0.2, 0.1),
      );
    }
    for (const side of [-1, 1]) {
      block(wood, cx, 0.17, cz + side * (d / 2), w + 0.12, 0.24, 0.1);
      block(wood, cx + side * (w / 2), 0.17, cz, 0.1, 0.24, d - 0.1);
      for (const end of [-1, 1])
        block(
          darkWood,
          cx + end * (w / 2),
          0.2,
          cz + side * (d / 2),
          0.13,
          0.33,
          0.13,
        );
    }
  }
  function arch(x, z1, z2) {
    const mid = (z1 + z2) / 2,
      r = (z2 - z1) / 2,
      postH = 1.75;
    for (const dx of [-0.16, 0.16]) {
      for (const z of [z1, z2])
        block(trim, x + dx, postH / 2, z, 0.08, postH, 0.08);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI,
          b = ((i + 1) / 8) * Math.PI;
        rod(
          trim,
          [x + dx, postH + Math.sin(a) * r * 0.45, mid - Math.cos(a) * r],
          [x + dx, postH + Math.sin(b) * r * 0.45, mid - Math.cos(b) * r],
          0.035,
          null,
          null,
          boxG,
        );
      }
    }
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI;
      block(
        trim,
        x,
        postH + Math.sin(a) * r * 0.45,
        mid - Math.cos(a) * r,
        0.4,
        0.04,
        0.05,
      );
    }
    for (const z of [z1, z2])
      for (const y of [0.5, 1.0, 1.5]) block(trim, x, y, z, 0.4, 0.035, 0.04);
    // Climbing roses wind up both posts and across the top.
    const blooms = ["#de4f6a", "#ef8ea6", "#c8364f", "#f6c0cb", "#f3e6c8"];
    for (let i = 0; i < 34; i++) {
      const f = i / 33,
        t = f * (postH * 2 + Math.PI * r * 0.75),
        onTop = t > postH && t < postH + Math.PI * r * 0.75;
      let y, z;
      if (t <= postH) [y, z] = [t, z1];
      else if (onTop) {
        const a = ((t - postH) / (Math.PI * r * 0.75)) * Math.PI;
        [y, z] = [postH + Math.sin(a) * r * 0.45, mid - Math.cos(a) * r];
      } else [y, z] = [postH * 2 + Math.PI * r * 0.75 - t, z2];
      const px = x + range(-0.18, 0.18),
        pz = z + range(-0.12, 0.12);
      place(
        lumpG,
        plantMat,
        local(
          px,
          y + range(0, 0.1),
          pz,
          rand(),
          rand() * 6,
          0,
          0.13,
          0.1,
          0.12,
        ),
        "#355f36",
        "#5a8a45",
      );
      for (let k = 0; k < (onTop ? 2 : 1); k++) {
        const c = pick(blooms);
        place(
          berryG,
          plantMat,
          local(
            px + range(-0.1, 0.1),
            y + range(0.02, 0.1),
            pz + range(-0.08, 0.08),
            0,
            0,
            0,
            0.058,
            0.05,
            0.058,
          ),
          c,
          c,
        );
      }
    }
  }
  function scarecrow(x, z) {
    within(local(x, 0, z, 0, 0.5, 0), () => {
      place(stickG, darkWood, local(0, 0.85, 0, 0, 0, 0, 0.035, 1.7, 0.035));
      place(boxG, darkWood, local(0, 1.26, 0, 0, 0, 0, 0.95, 0.05, 0.05));
      block(propMat, 0, 1.12, 0, 0.36, 0.42, 0.18, 0, "#8f3f32", "#b9583f");
      block(propMat, 0, 1.26, 0, 0.82, 0.12, 0.12, 0, "#a44d39", "#b9583f");
      block(propMat, 0, 1.08, 0.095, 0.1, 0.1, 0.01, 0, "#e3b54d");
      for (const side of [-1, 1]) {
        block(
          propMat,
          side * 0.09,
          0.73,
          0,
          0.13,
          0.42,
          0.14,
          0,
          "#4b5f80",
          "#5d7398",
        );
        place(
          coneG,
          propMat,
          local(
            side * 0.47,
            1.26,
            0,
            0,
            0,
            (-side * Math.PI) / 2,
            0.06,
            0.12,
            0.06,
          ),
          "#d9b25a",
          "#ecd27c",
        );
        place(
          coneG,
          propMat,
          local(side * 0.09, 0.48, 0, Math.PI, 0, 0, 0.06, 0.1, 0.06),
          "#ecd27c",
          "#d9b25a",
        );
      }
      block(propMat, 0.1, 0.8, 0.071, 0.08, 0.08, 0.01, 0, "#c9884a");
      place(
        ballG,
        propMat,
        local(0, 1.5, 0, 0, 0, 0, 0.13, 0.14, 0.12),
        "#c8a874",
        "#dcc193",
      );
      for (const side of [-1, 1])
        place(
          berryG,
          propMat,
          local(side * 0.045, 1.53, 0.11, 0, 0, 0, 0.016),
          "#2e2a26",
        );
      place(
        cylG,
        propMat,
        local(0, 1.6, 0, 0.12, 0, 0, 0.26, 0.02, 0.26),
        "#c9a44d",
        "#dcbb63",
      );
      place(
        coneG,
        propMat,
        local(0, 1.69, -0.01, 0.12, 0, 0, 0.13, 0.17, 0.13),
        "#c9a44d",
        "#e2c46f",
      );
      place(
        cylG,
        propMat,
        local(0, 1.635, -0.005, 0.12, 0, 0, 0.135, 0.03, 0.135),
        "#9b3b33",
      );
    });
    // A crow keeps it company on the crossbar.
    within(local(x, 1.32, z, 0, 0.5, 0), () => {
      place(
        ballG,
        propMat,
        local(0.32, 0.05, 0, 0, 0, 0, 0.06, 0.055, 0.09),
        "#26262b",
        "#3a3a40",
      );
      place(
        berryG,
        propMat,
        local(0.32, 0.12, 0.07, 0, 0, 0, 0.038),
        "#26262b",
        "#3a3a40",
      );
      place(
        coneG,
        propMat,
        local(0.32, 0.12, 0.12, Math.PI / 2, 0, 0, 0.012, 0.05, 0.012),
        "#d8a640",
      );
    });
  }

  // ---- Props --------------------------------------------------------------
  function crate(x, y, z, ry, fill) {
    within(local(x, y, z, 0, ry, 0), () => {
      const w = 0.56,
        h = 0.34,
        d = 0.4;
      block(darkWood, 0, 0.015, 0, w - 0.02, 0.03, d - 0.02);
      for (const yy of [0.1, 0.26]) {
        for (const side of [-1, 1]) {
          block(wood, 0, yy, side * (d / 2 - 0.012), w, 0.11, 0.024);
          block(wood, side * (w / 2 - 0.012), yy, 0, 0.024, 0.11, d);
        }
      }
      for (const a of [-1, 1])
        for (const b of [-1, 1])
          block(
            darkWood,
            a * (w / 2 - 0.02),
            h / 2,
            b * (d / 2 - 0.02),
            0.045,
            h,
            0.045,
          );
      if (!fill) return;
      for (let i = 0; i < fill.count; i++) {
        const px = range(-w / 2 + 0.08, w / 2 - 0.08),
          pz = range(-d / 2 + 0.08, d / 2 - 0.08),
          c = pick(fill.colors);
        if (fill.kind === "carrot")
          place(
            coneG,
            plantMat,
            local(
              px,
              h - 0.02,
              pz,
              Math.PI / 2,
              rand() * 6,
              0,
              0.028,
              0.18,
              0.028,
            ),
            c,
            c,
          );
        else if (fill.kind === "cabbage")
          place(
            ballG,
            plantMat,
            local(px * 0.6, h - 0.02, pz * 0.4, 0, 0, 0, 0.1, 0.09, 0.1),
            c[0],
            c[1],
          );
        else
          place(
            berryG,
            plantMat,
            local(px, h - 0.02 + rand() * 0.04, pz, 0, 0, 0, fill.size),
            c,
            c,
          );
      }
      if (fill.kind === "carrot")
        for (let i = 0; i < 6; i++)
          place(
            lumpG,
            plantMat,
            local(
              range(-0.2, 0.2),
              h + 0.03,
              d / 2 + 0.03,
              0,
              rand() * 6,
              0,
              0.07,
              0.03,
              0.06,
            ),
            "#5f9a3f",
            "#86b754",
          );
    });
  }
  function compost(x, z) {
    within(local(x, 0, z, 0, 0, 0), () => {
      const w = 0.9;
      for (const a of [-1, 1])
        for (const b of [-1, 1])
          block(darkWood, a * (w / 2), 0.4, b * (w / 2), 0.07, 0.8, 0.07);
      for (let i = 0; i < 4; i++) {
        const y = 0.12 + i * 0.19;
        for (const side of [-1, 1]) {
          block(wood, 0, y, side * (w / 2), w, 0.12, 0.03);
          block(wood, side * (w / 2), y, 0, 0.03, 0.12, w);
        }
      }
      place(ballG, soil, local(0, 0.55, 0, 0, 0, 0, 0.42, 0.2, 0.42));
      for (let i = 0; i < 9; i++)
        place(
          lumpG,
          plantMat,
          local(
            range(-0.25, 0.25),
            0.7,
            range(-0.25, 0.25),
            rand(),
            rand() * 6,
            0,
            0.06,
            0.02,
            0.06,
          ),
          pick(["#6e8a3c", "#9a7a3c", "#b2934a", "#c45a2c"]),
        );
    });
  }
  function rainBarrel(x, z) {
    place(cylG, wood, local(x, 0.42, z, 0, 0, 0, 0.3, 0.8, 0.3));
    for (const y of [0.12, 0.42, 0.72])
      place(
        cylG,
        propMat,
        local(x, y, z, 0, 0, 0, 0.31, 0.04, 0.31),
        "#4f5455",
        "#5f6566",
      );
    place(
      cylG,
      propMat,
      local(x, 0.815, z, 0, 0, 0, 0.27, 0.02, 0.27),
      "#2f4a4f",
      "#3e5d60",
    );
  }
  function wateringCan(x, z, ry) {
    within(local(x, 0.05, z, 0, ry, 0), () => {
      place(
        cylG,
        propMat,
        local(0, 0.11, 0, 0, 0, 0, 0.1, 0.2, 0.1),
        "#4c7a66",
        "#6d9a82",
      );
      place(
        cylG,
        propMat,
        local(0, 0.215, 0, 0, 0, 0, 0.08, 0.015, 0.08),
        "#3d6455",
      );
      rod(
        propMat,
        [0.08, 0.06, 0],
        [0.26, 0.24, 0],
        0.012,
        "#4c7a66",
        "#6d9a82",
      );
      place(
        coneG,
        propMat,
        local(0.27, 0.25, 0, 0, 0, Math.PI / 2 + 0.75, 0.035, 0.05, 0.035),
        "#5d8a75",
      );
      place(
        torusG,
        propMat,
        local(-0.02, 0.21, 0, 0, 0, 0, 0.08, 0.08, 0.08),
        "#3d6455",
      );
    });
  }
  function wheelbarrow(x, z, ry) {
    within(local(x, 0, z, 0, ry, 0), () => {
      const paint = ["#9d4632", "#c0623f"];
      block(propMat, 0, 0.36, 0, 0.62, 0.03, 0.48, 0, ...paint);
      for (const side of [-1, 1]) {
        place(
          boxG,
          propMat,
          local(0, 0.46, side * 0.27, side * 0.35, 0, 0, 0.66, 0.22, 0.025),
          ...paint,
        );
        place(
          boxG,
          propMat,
          local(side * 0.34, 0.46, 0, 0, 0, -side * 0.4, 0.025, 0.22, 0.56),
          ...paint,
        );
        rod(wood, [0.2, 0.3, side * 0.2], [-0.62, 0.42, side * 0.25], 0.022);
        rod(
          darkWood,
          [-0.18, 0.32, side * 0.2],
          [-0.2, 0.02, side * 0.22],
          0.02,
        );
      }
      place(
        cylG,
        propMat,
        local(0.42, 0.15, 0, Math.PI / 2, 0, 0, 0.15, 0.05, 0.15),
        "#2f2f31",
        "#3c3c3f",
      );
      place(
        cylG,
        propMat,
        local(0.42, 0.15, 0, Math.PI / 2, 0, 0, 0.06, 0.07, 0.06),
        "#8d9396",
      );
      place(ballG, soil, local(0, 0.45, 0, 0, 0, 0, 0.27, 0.1, 0.2));
      place(
        gourdG,
        plantMat,
        local(0.08, 0.53, 0.05, 0, 0, 0.3, 0.11, 0.08, 0.11),
        "#d9822e",
        "#eda14a",
      );
      place(
        gourdG,
        plantMat,
        local(-0.12, 0.52, -0.06, 0, 0, -0.2, 0.09, 0.07, 0.09),
        "#d6c49a",
        "#ece0bf",
      );
    });
  }
  // Long-handled tools lean on whatever is nearest; heading turns the lean.
  function tool(kind, x, z, heading, lean) {
    within(local(x, 0.03, z, lean, heading, 0), () => {
      const steel = ["#5b6266", "#7d8589"],
        handle = ["#8e6a42", "#b08a5a"],
        length = kind === "spade" || kind === "fork" ? 0.95 : 1.4;
      place(
        stickG,
        propMat,
        local(0, length / 2 + 0.12, 0, 0, 0, 0, 0.018, length, 0.018),
        ...handle,
      );
      if (kind === "spade") {
        block(propMat, 0, 0.1, 0, 0.17, 0.22, 0.02, 0, ...steel);
        place(
          torusG,
          propMat,
          local(0, length + 0.12, 0, 0, 0, 0, 0.06, 0.07, 0.07),
          ...handle,
        );
      } else if (kind === "fork") {
        block(propMat, 0, 0.2, 0, 0.16, 0.03, 0.025, 0, ...steel);
        for (let i = 0; i < 4; i++)
          block(
            propMat,
            -0.06 + i * 0.04,
            0.1,
            0,
            0.014,
            0.2,
            0.014,
            0,
            ...steel,
          );
        place(
          torusG,
          propMat,
          local(0, length + 0.12, 0, 0, 0, 0, 0.06, 0.07, 0.07),
          ...handle,
        );
      } else if (kind === "rake") {
        block(propMat, 0, 0.1, 0, 0.38, 0.03, 0.03, 0, ...steel);
        for (let i = 0; i < 9; i++)
          block(
            propMat,
            -0.17 + i * 0.0425,
            0.06,
            0.02,
            0.012,
            0.012,
            0.07,
            0,
            ...steel,
          );
      } else {
        block(propMat, 0, 0.09, 0.04, 0.15, 0.08, 0.012, 0, ...steel);
      }
    });
  }
  function sack(x, z, ry, tint) {
    within(local(x, 0, z, 0, ry, 0), () => {
      place(
        ballG,
        propMat,
        local(0, 0.2, 0, 0, 0, 0, 0.19, 0.22, 0.15),
        tint[0],
        tint[1],
      );
      place(
        coneG,
        propMat,
        local(0, 0.45, 0, 0, 0, 0, 0.07, 0.1, 0.06),
        tint[1],
        tint[1],
      );
      place(
        cylG,
        propMat,
        local(0, 0.41, 0, 0, 0, 0, 0.06, 0.02, 0.05),
        "#6d5638",
      );
    });
  }
  function potStack(x, z) {
    for (let i = 0; i < 4; i++)
      place(
        potG,
        propMat,
        local(x, 0.09 + i * 0.06, z, Math.PI, 0, 0, 0.12, 0.17, 0.12),
        "#9e5d40",
        "#c27b56",
      );
  }
  function herbPot(x, z, sc, foliage) {
    place(
      potG,
      propMat,
      local(x, 0.1 * sc, z, 0, 0, 0, 0.12 * sc, 0.2 * sc, 0.12 * sc),
      "#9e5d40",
      "#c27b56",
    );
    place(
      cylG,
      propMat,
      local(x, 0.205 * sc, z, 0, 0, 0, 0.13 * sc, 0.03 * sc, 0.13 * sc),
      "#b06c4b",
    );
    for (let i = 0; i < 4; i++)
      place(
        lumpG,
        plantMat,
        local(
          x + range(-0.05, 0.05) * sc,
          (0.25 + rand() * 0.1) * sc,
          z + range(-0.05, 0.05) * sc,
          rand(),
          rand() * 6,
          0,
          0.09 * sc,
          0.08 * sc,
          0.09 * sc,
        ),
        foliage[0],
        foliage[1],
      );
  }
  function seedTray(x, y, z, ry) {
    within(local(x, y, z, 0, ry, 0), () => {
      block(propMat, 0, 0.025, 0, 0.42, 0.05, 0.26, 0, "#3b3936", "#4a4743");
      block(soil, 0, 0.052, 0, 0.39, 0.01, 0.23);
      for (let i = 0; i < 4; i++)
        for (let k = 0; k < 3; k++)
          place(
            lumpG,
            plantMat,
            local(
              -0.15 + i * 0.1,
              0.075,
              -0.07 + k * 0.07,
              0,
              rand() * 6,
              0,
              0.03,
              0.025,
              0.03,
            ),
            "#6ea648",
            "#9ccc62",
          );
    });
  }

  // ---- Layout -------------------------------------------------------------
  // The fence encloses x -19..-13.8, z 6..13.7 with its gate at x -13.8,
  // z 8..11. The overview camera looks from the south-east (+x, +z), so tall
  // plants stand along the back fence and low ones along the front.
  const bedX = -16.95,
    bedW = 3.3;
  for (const z of [7.6, 9.75, 11.9]) bed(bedX, z, bedW, 1.3);
  // Bark paths between the beds and in from the gate.
  for (const [x, z, w, d] of [
    [-16.6, 8.675, 4.6, 0.7],
    [-16.6, 10.825, 4.6, 0.7],
    [-14.4, 9.75, 0.9, 2.85],
  ])
    place(
      boxG,
      path,
      local(x, 0.065, z, 0, 0, 0, w, 0.03, d),
      null,
      null,
      false,
    );

  // Back bed: staked tomatoes and a runner-bean wigwam.
  beans(-18.15, 7.6);
  for (let i = 0; i < 4; i++)
    tomato(-17.45 + i * 0.68, 7.6 + (i % 2 ? 0.12 : -0.12), range(1.05, 1.25));
  // Middle bed: cabbages, the scarecrow and rainbow chard.
  for (let i = 0; i < 6; i++)
    for (const dz of [-0.3, 0.3])
      if (i !== 3)
        cabbage(
          -18.3 + i * 0.36 + (dz > 0 ? 0.12 : 0),
          9.75 + dz,
          range(0.9, 1.1),
          (i + (dz > 0 ? 1 : 0)) % 3 === 0,
        );
  scarecrow(-17.15, 9.75);
  for (let i = 0; i < 4; i++)
    for (const dz of [-0.3, 0.3])
      chard(
        -15.98 + i * 0.2 + (dz > 0 ? 0.05 : 0),
        9.75 + dz,
        range(0.9, 1.15),
      );
  // Front bed: lettuces, carrot rows and pumpkins spilling over the edge.
  for (let i = 0; i < 5; i++)
    for (const dz of [-0.32, 0.05])
      lettuce(
        -18.35 + i * 0.3 + (dz > 0 ? 0.15 : 0),
        11.9 + dz,
        range(0.85, 1.05),
        (i + (dz > 0 ? 1 : 0)) % 2 === 0,
      );
  for (let i = 0; i < 9; i++)
    for (const dz of [-0.35, -0.05, 0.25])
      carrot(
        -16.85 + i * 0.12 + range(-0.02, 0.02),
        11.9 + dz,
        range(0.8, 1.05),
      );
  pumpkin(-15.35, 11.75, 1.1, ["#d06f22", "#ee9a3e"]);
  pumpkin(-15.15, 12.3, 0.85, ["#c9b98f", "#e9e0c2"]);
  pumpkin(-15.65, 12.4, 0.75, ["#d39a34", "#e8bd5a"]);
  // Back border: sunflowers and hollyhocks against the fence.
  const hollyhocks = [
    ["#c53f73", "#e57aa4"],
    ["#e9d9cf", "#fbf3ea"],
    ["#e58fb0", "#f6bfd2"],
    ["#c2405a", "#df6d82"],
    ["#e9c35a", "#f6df91"],
  ];
  const delphiniums = [
    ["#4f62ad", "#8597dc"],
    ["#6d4f9e", "#a487cf"],
    ["#5a7fc0", "#a6c0ea"],
  ];
  for (let i = 0; i < 9; i++) {
    const x = -18.65 + i * 0.4 + range(-0.05, 0.05),
      z = 6.4 + range(-0.06, 0.06);
    if (i % 3 === 1) sunflower(x, z + 0.05, range(1.7, 2.05));
    else if (i % 3 === 0) hollyhock(x, z, range(1.3, 1.65), pick(hollyhocks));
    else delphinium(x, z, range(1.05, 1.3), pick(delphiniums));
  }
  // Front border: marigolds and potted herbs inside the near fence.
  for (let i = 0; i < 11; i++)
    marigold(-18.65 + i * 0.3, 13.2 + (i % 2) * 0.12, range(1.1, 1.4));
  herbPot(-14.75, 13.25, 1.3, ["#5d8a55", "#86ad6f"]);
  herbPot(-14.45, 13.1, 1.0, ["#6f8f6a", "#a7bba0"]);
  herbPot(-14.6, 12.85, 0.9, ["#4f7a3c", "#7aa04f"]);

  // Garden clutter along the east side, inside the gate.
  compost(-14.78, 6.75);
  // Long tools lean on the east fence.
  tool("rake", -14.17, 6.45, Math.PI / 2, 0.36);
  tool("spade", -14.12, 6.85, Math.PI / 2, 0.3);
  tool("hoe", -14.17, 7.2, Math.PI / 2, 0.36);
  rainBarrel(-14.42, 7.75);
  wateringCan(-14.75, 8.25, 2.4);
  wheelbarrow(-14.55, 11.35, Math.PI / 2 + 0.25);
  crate(-14.55, 0, 12.3, 0.1, {
    kind: "tomato",
    count: 14,
    size: 0.045,
    colors: ["#d23f2c", "#e0552f", "#f0a43a"],
  });
  crate(-14.2, 0, 12.75, -0.15, {
    kind: "carrot",
    count: 9,
    colors: ["#d9682a", "#e98a35"],
  });
  crate(-14.5, 0.34, 12.32, 0.25, {
    kind: "cabbage",
    count: 3,
    colors: [
      ["#5d8a62", "#a5c39b"],
      ["#6d4d6e", "#9a6b98"],
    ],
  });
  seedTray(-14.6, 0.68, 12.32, 0.3);
  sack(-14.15, 12.05, 0.4, ["#b89c6b", "#d2bb8b"]);
  sack(-14.95, 13.35, -0.3, ["#a58a5d", "#c7ae7f"]);
  potStack(-14.15, 13.35);
  // A fork left standing in the front bed.
  within(local(0, bedTop - 0.1, 0), () =>
    tool("fork", -15.55, 11.5, 0.4, 0.12),
  );
  arch(-13.8, 8.05, 10.95);

  const group = new T.Group();
  for (const { material, cast, geometries } of batches.values()) {
    const merged = mergeGeometries(geometries, false);
    geometries.forEach((g) => g.dispose());
    const mesh = new T.Mesh(merged, material);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  for (const g of [
    boxG,
    stickG,
    cylG,
    coneG,
    lumpG,
    ballG,
    berryG,
    potG,
    torusG,
    leafG,
    gourdG,
  ])
    g.dispose();
  return group;
}
