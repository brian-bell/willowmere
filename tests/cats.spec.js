import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { createLife } from "../src/life.js";

test("cats walk continuously, pause for idle behavior, and freeze with decorative motion", { tag: "@logic" }, () => {
  const scene = new THREE.Scene();
  const life = createLife(THREE, scene);
  const cats = ["Bracken the tabby cat", "Misty the gray cat"].map((name) =>
    scene.getObjectByName(name),
  );
  cats.forEach((cat) => expect(cat).toBeTruthy());
  const frontLegs = cats.map((cat) => cat.getObjectByName("Front left leg"));
  frontLegs.forEach((leg) => expect(leg).toBeTruthy());
  life.update(0, 0, false);
  const previous = cats.map((cat) => cat.position.clone());
  const previousLegAngles = frontLegs.map((leg) => leg.rotation.x);
  const travelled = [0, 0];
  const pausedFrames = [0, 0];
  for (let frame = 1; frame <= 26 * 30; frame++) {
    life.update(1 / 30, frame / 30, false);
    cats.forEach((cat, i) => {
      const step = cat.position.distanceTo(previous[i]);
      expect(step).toBeLessThan(0.04);
      travelled[i] += step;
      if (step < 1e-6) pausedFrames[i]++;
      previous[i].copy(cat.position);
      const legStep = Math.abs(frontLegs[i].rotation.x - previousLegAngles[i]);
      // A cat's leg should not cycle several times between rendered frames.
      expect(legStep).toBeLessThan(0.25);
      previousLegAngles[i] = frontLegs[i].rotation.x;
    });
  }
  travelled.forEach((distance) => expect(distance).toBeGreaterThan(6));
  pausedFrames.forEach((count) => expect(count).toBeGreaterThan(100));
  const frozen = cats.map((cat) => {
    const transforms = [];
    cat.traverse((object) =>
      transforms.push([object, object.position.clone(), object.quaternion.clone()]),
    );
    return transforms;
  });
  for (let i = 0; i < 30; i++) life.update(1 / 30, 26 + i / 30, false, false);
  frozen.flat().forEach(([object, position, quaternion]) => {
    expect(object.position.distanceTo(position)).toBeLessThan(1e-10);
    expect(object.quaternion.angleTo(quaternion)).toBeLessThan(1e-6);
  });
});
