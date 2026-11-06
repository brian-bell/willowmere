import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { weldVertices } from "../src/geometry-weld.js";

// Every triangle corner's values, in draw order, which welding must keep.
const corners = (geometry) => {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  return Object.fromEntries(
    Object.keys(geometry.attributes)
      .sort()
      .map((name) => [name, Array.from(flat.attributes[name].array)]),
  );
};

test("welding shares copied vertices and draws the same triangles", { tag: "@logic" }, () => {
  // A merged part arrives non-indexed: three vertices per triangle.
  const box = new THREE.BoxGeometry(1, 2, 3).toNonIndexed(),
    before = corners(box);
  expect(box.attributes.position.count).toBe(36);
  weldVertices(THREE, box);
  // A corner shared by three faces stays three vertices: their normals and
  // uvs differ, and only copies merge.
  expect(box.attributes.position.count).toBe(24);
  expect(box.index.count).toBe(36);
  expect(corners(box)).toEqual(before);
  // A smooth sphere shares far more.
  const sphere = new THREE.IcosahedronGeometry(1, 2),
    sphereBefore = corners(sphere);
  weldVertices(THREE, sphere);
  expect(sphere.attributes.position.count).toBeLessThan(sphere.index.count / 3);
  expect(corners(sphere)).toEqual(sphereBefore);
});

test("welding remaps an index and leaves geometry with nothing to share alone", { tag: "@logic" }, () => {
  // Two quads whose shared edge was stored twice.
  const quads = new THREE.BufferGeometry();
  quads.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0, 2, 0, 0, 2, 1, 0, 1, 1, 0, 0, 1, 0], 3),
  );
  quads.setIndex([0, 1, 2, 0, 2, 7, 3, 4, 5, 3, 5, 6]);
  const before = corners(quads);
  weldVertices(THREE, quads);
  expect(quads.attributes.position.count).toBe(6);
  expect(corners(quads)).toEqual(before);
  // No two vertices alike: no index added, nothing replaced.
  const triangle = new THREE.BufferGeometry();
  const position = new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3);
  triangle.setAttribute("position", position);
  weldVertices(THREE, triangle);
  expect(triangle.index).toBe(null);
  expect(triangle.attributes.position).toBe(position);
});
