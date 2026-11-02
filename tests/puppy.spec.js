import { test, expect } from "@playwright/test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createLife } from "../src/life.js";

test("Lily and Pip stay together on their walk and pause with reduced motion", { tag: "@logic" }, () => {
  const scene = new THREE.Scene();
  const life = createLife(THREE, scene);
  const lily = life.npcs.find((npc) => npc.id === "lily");
  const puppy = scene.getObjectByName("Pip the puppy");
  const leash = scene.getObjectByName("Lily and Pip leash");
  expect(lily).toBeTruthy();
  expect(puppy).toBeTruthy();
  const origin = lily.group.position.clone();
  let travelled = 0;
  let previous = origin.clone();
  // Sample two complete laps, including their sniffing stops and wraparound.
  for (let i = 0; i < 1800; i++) {
    life.update(1 / 30, i / 30, false);
    const step = lily.group.position.distanceTo(previous);
    assert.ok(step < 0.06, "Walk must remain continuous at lap boundaries");
    travelled += step;
    previous.copy(lily.group.position);
    assert.ok(lily.group.position.distanceTo(puppy.position) < 0.85);
    expect(lily.group.position.distanceTo(puppy.position)).toBeGreaterThan(
      0.55,
    );
    // Both stay on the obstacle-free eastern lane, before the riverbank.
    for (const position of [lily.group.position, puppy.position]) {
      assert.ok(position.x > 4.1);
      assert.ok(position.x < 8.5);
      assert.ok(position.z > 1.5);
      assert.ok(position.z < 4.5);
    }
    for (const segment of leash.children) {
      assert.ok(segment.position.y > 0.2);
      assert.ok(Number.isFinite(segment.quaternion.w));
      assert.ok(segment.scale.y > 0);
    }
  }
  expect(travelled).toBeGreaterThan(12);
  const frozen = [lily.group, puppy, ...leash.children].map((o) => ({
    p: o.position.clone(),
    q: o.quaternion.clone(),
  }));
  for (let i = 0; i < 60; i++) life.update(1 / 30, 60 + i / 30, false, false);
  [lily.group, puppy, ...leash.children].forEach((o, i) => {
    expect(o.position.distanceTo(frozen[i].p)).toBeLessThan(1e-10);
    expect(o.quaternion.angleTo(frozen[i].q)).toBeLessThan(1e-6);
  });
});
