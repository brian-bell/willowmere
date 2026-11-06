// @ts-check
// Merged scenery is built from parts that were made non-indexed so they could
// merge, which leaves three vertices per triangle: the vertex shader runs for
// each one, in the main pass, the sun's shadow and every reflection. Welding
// shares the vertices that are copies of one another (every attribute equal),
// so the GPU draws the same triangles from the same values, and the village
// shades 41% of the vertices it did. See docs/performance.md.

const HASH_SEED = 2166136261;

/**
 * Welds `geometry`'s identical vertices in place and indexes it. Geometry
 * with interleaved or morph attributes is left as it is, and so is geometry
 * where no two vertices match. Returns the geometry.
 * @param {typeof import("three")} T
 * @param {import("three").BufferGeometry} geometry
 */
export function weldVertices(T, geometry) {
  if (
    !geometry.attributes.position ||
    Object.values(geometry.attributes).some(
      (a) => "isInterleavedBufferAttribute" in a || "isInstancedBufferAttribute" in a,
    ) ||
    Object.keys(geometry.morphAttributes).length
  )
    return geometry;
  // Plain attributes only, from here on.
  const named = /** @type {Record<string, import("three").BufferAttribute>} */ (geometry.attributes),
    attributes = Object.values(named),
    position = named.position,
    count = position.count;
  const parts = attributes.map((a) => ({ values: a.array, size: a.itemSize }));
  // Copies share a position, so the position's bits alone pick the bucket
  // (0 and -0 hash apart and so never merge there, which is harmless); every
  // attribute is compared before two vertices merge.
  const { array: positions, itemSize: positionSize } = position,
    words =
      positions.BYTES_PER_ELEMENT === 4
        ? new Uint32Array(positions.buffer, positions.byteOffset, positions.length)
        : positions;
  const hash = (v) => {
    let h = HASH_SEED;
    for (let k = v * positionSize, end = k + positionSize; k < end; k++)
      h = Math.imul(h ^ words[k], 16777619);
    return (h ^ (h >>> 15)) >>> 0;
  };
  const same = (a, b) => {
    for (const { values, size } of parts)
      for (let k = 0; k < size; k++) if (values[a * size + k] !== values[b * size + k]) return false;
    return true;
  };
  // Open addressing over the unique vertices, at most half full.
  let slots = 1;
  while (slots < count * 2) slots <<= 1;
  const table = new Int32Array(slots).fill(-1),
    mask = slots - 1,
    remap = new Uint32Array(count),
    first = new Uint32Array(count);
  let unique = 0;
  for (let v = 0; v < count; v++) {
    let slot = hash(v) & mask;
    for (;;) {
      const found = table[slot];
      if (found < 0) {
        table[slot] = unique;
        first[unique] = v;
        remap[v] = unique++;
        break;
      }
      if (same(first[found], v)) {
        remap[v] = found;
        break;
      }
      slot = (slot + 1) & mask;
    }
  }
  if (unique === count) return geometry;
  for (const [name, attribute] of Object.entries(named)) {
    const { array, itemSize, normalized } = attribute,
      welded = new array.constructor(unique * itemSize);
    for (let u = 0; u < unique; u++)
      for (let k = 0; k < itemSize; k++) welded[u * itemSize + k] = array[first[u] * itemSize + k];
    const replacement = new T.BufferAttribute(welded, itemSize, normalized);
    replacement.name = attribute.name;
    replacement.usage = attribute.usage;
    geometry.setAttribute(name, replacement);
  }
  // Groups and the draw range count indices, which for a non-indexed geometry
  // were its vertices in the same order, so they still hold.
  const source = geometry.index?.array,
    length = source ? source.length : count,
    index = unique > 65535 ? new Uint32Array(length) : new Uint16Array(length);
  for (let i = 0; i < length; i++) index[i] = remap[source ? source[i] : i];
  geometry.setIndex(new T.BufferAttribute(index, 1));
  return geometry;
}
