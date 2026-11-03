// Fingerprints the world as createWorld builds it, without a browser, to check
// that a refactor of the village leaves it exactly as it was:
//
//   node scripts/world-fingerprint.mjs before.json        (on main)
//   node scripts/world-fingerprint.mjs after.json         (on the branch)
//   cmp before.json after.json
//
// A stub canvas records every texture's drawing. The output hashes each
// object in the scene (order, ids, transforms, geometry, materials,
// instances), the colliders, interactables, lamps and chunks, the ground and
// planting heights on a grid, and the scene again after a few animated steps.
// The summary it prints names whichever part differs.
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const [out = "world-fingerprint.json", repo = process.cwd()] = process.argv.slice(2);
const noop = () => {};
const drawLog = createHash("sha1");
const log = (...a) => drawLog.update(JSON.stringify(a, (k, v) => (typeof v === "number" ? Math.round(v * 1e4) / 1e4 : typeof v === "object" && v && !Array.isArray(v) ? String(v) : v)));
const ctx2d = new Proxy({}, {
  get: (t, k) => (k in t ? t[k] : (...a) => { log(k, a); return k === "createRadialGradient" || k === "createLinearGradient" ? { addColorStop: (...b) => log("stop", b) } : k === "measureText" ? { width: 10 } : k === "getImageData" ? { data: new Uint8ClampedArray(4) } : undefined; }),
  set: (t, k, v) => (log("set", k, v), true),
});
const canvases = [];
globalThis.document = {
  createElement: () => { const c = { width: 0, height: 0, style: {}, getContext: () => ctx2d }; canvases.push(c); return c; },
  createElementNS: () => ({ style: {} }),
};
globalThis.window = globalThis;
globalThis.performance ??= { now: () => 0 };
const T = await import(pathToFileURL(`${repo}/node_modules/three/build/three.module.js`).href);
const { createWorld } = await import(pathToFileURL(`${repo}/src/world.js`).href);
const scene = new T.Scene();
const world = createWorld(T, scene);
const h = (v) => createHash("sha1").update(typeof v === "string" ? v : JSON.stringify(v)).digest("hex").slice(0, 16);
const r = (n) => (typeof n === "number" ? Math.round(n * 1e6) / 1e6 : n);
const arr = (a) => h(Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString("base64"));
const mat = (m) => !m ? null : Array.isArray(m) ? m.map(mat) : ({ id: m.id, type: m.type, name: m.name, color: m.color?.getHex(), emissive: m.emissive?.getHex(), ei: r(m.emissiveIntensity), rough: r(m.roughness), metal: r(m.metalness), vc: m.vertexColors, transparent: m.transparent, opacity: r(m.opacity), side: m.side, map: m.map ? m.map.id : null, dw: m.depthWrite, defines: m.defines });
const geo = (g) => !g ? null : ({ id: g.id, index: g.index ? arr(g.index.array) : null, attrs: Object.fromEntries(Object.entries(g.attributes).map(([k, a]) => [k, arr(a.array)])), groups: g.groups });
const objects = [];
scene.updateMatrixWorld(true);
scene.traverse((o) => objects.push({ type: o.type, name: o.name, id: o.id, visible: o.visible, cast: o.castShadow, recv: o.receiveShadow, order: o.renderOrder, frustum: o.frustumCulled, m: h(o.matrixWorld.elements.map(r)), geo: o.geometry ? h(geo(o.geometry)) : null, mat: o.material ? mat(o.material) : null, count: o.count, inst: o.instanceMatrix ? arr(o.instanceMatrix.array) : null, ic: o.instanceColor ? arr(o.instanceColor.array) : null, light: o.isLight ? [o.color.getHex(), r(o.intensity), r(o.distance)] : null }));
for (let i = 1; i <= 6; i++) world.update(0.045, i * 0.045);
world.placeLanterns(10, -5);
const animatedState = [];
scene.updateMatrixWorld(true);
scene.traverse((o) => animatedState.push([o.id, h(o.matrixWorld.elements.map(r)), o.visible, o.material && !Array.isArray(o.material) ? r(o.material.opacity) : null, o.isPoints ? arr(o.geometry.attributes.position.array) : null]));
const result = {
  animated: h(animatedState),
  objects: objects.length,
  scene: h(objects),
  colliders: h(world.colliders.map((c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, typeof v === "function" ? "fn" : r(v)])))),
  interactables: h(world.interactables.map((i) => Object.fromEntries(Object.entries(i).filter(([, v]) => typeof v !== "object" && typeof v !== "function").map(([k, v]) => [k, r(v)])))),
  lamps: h(world.lamps.map((v) => v.toArray().map(r))),
  chunks: h([...world.chunks.values()].map((c) => [c.key, c.meshes.map((m) => m.id), c.animations.length, c.glow.size])),
  ground: h(Array.from({ length: 400 }, (_, i) => { const x = -47 + (i % 20) * 4.9, z = -41 + Math.floor(i / 20) * 4.3; return [r(world.getGroundHeight(x, z)), r(world.surfaceHeight(x, z)), world.isPlantable(x, z)]; })),
  canvases: canvases.length,
  drawing: drawLog.digest("hex").slice(0, 16),
  canvasSizes: h(canvases.map((c) => [c.width, c.height])),
  maxMaterialId: Math.max(...objects.flatMap((o) => (o.mat ? [].concat(o.mat).map((m) => m.id) : [0]))),
};
writeFileSync(out, JSON.stringify({ result, objects }, null, 0));
console.log(JSON.stringify(result));
