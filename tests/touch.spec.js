import { test, expect } from "@playwright/test";
import {
  isTap,
  prefersTouch,
  STICK_RUN,
  stickSpeed,
  stickVector,
  twoFinger,
  twoFingerModes,
} from "../src/game/touch.js";

const device = (traits) => ({
  coarse: false,
  maxTouchPoints: 0,
  platform: "",
  userAgent: "",
  ...traits,
});

test.describe("touch mode", { tag: "@logic" }, () => {
  test("turns on for iPhones, iPads and other finger-first devices, and stays off on desktops", () => {
    // iPhone, Android phone, iPad in its default (desktop-class) Safari mode, a Mac,
    // a Windows laptop with a touch screen.
    expect(prefersTouch(device({ coarse: true, maxTouchPoints: 5, platform: "iPhone" }))).toBe(true);
    expect(prefersTouch(device({ coarse: true, maxTouchPoints: 5, platform: "Linux armv8l" }))).toBe(true);
    expect(prefersTouch(device({ coarse: false, maxTouchPoints: 5, platform: "MacIntel" }))).toBe(true);
    expect(prefersTouch(device({ coarse: false, maxTouchPoints: 0, platform: "MacIntel" }))).toBe(false);
    expect(prefersTouch(device({ coarse: false, maxTouchPoints: 10, platform: "Win32" }))).toBe(false);
    // A coarse pointer with no touch points (some TVs, emulators without touch) keeps the desktop.
    expect(prefersTouch(device({ coarse: true, maxTouchPoints: 0 }))).toBe(false);
  });

  test("the player's choice overrides the device", () => {
    const phone = device({ coarse: true, maxTouchPoints: 5 }),
      mac = device({ platform: "MacIntel" });
    expect(prefersTouch(phone, "desktop")).toBe(false);
    expect(prefersTouch(mac, "touch")).toBe(true);
    expect(prefersTouch(mac, "auto")).toBe(false);
  });

  test("the thumbstick rests inside its dead zone and leans up to one", () => {
    expect(stickVector(3, -2).magnitude).toBe(0);
    const half = stickVector(0, -30, 48);
    expect(half.x).toBeCloseTo(0);
    expect(half.y).toBeLessThan(0);
    expect(half.magnitude).toBeGreaterThan(0.4);
    expect(half.magnitude).toBeLessThan(0.7);
    // Past the rim it stays at full lean, pointing the same way.
    const far = stickVector(300, 400, 48);
    expect(far.magnitude).toBe(1);
    expect(far.x).toBeCloseTo(0.6);
    expect(far.y).toBeCloseTo(0.8);
  });

  test("leaning further walks faster, and the rim runs", () => {
    expect(stickSpeed(0.3, 3, 5.1)).toBeLessThan(stickSpeed(0.6, 3, 5.1));
    expect(stickSpeed(0.8, 3, 5.1)).toBe(3);
    expect(stickSpeed(STICK_RUN, 3, 5.1)).toBe(5.1);
  });

  test("a tap lifts near where it landed", () => {
    expect(isTap(4)).toBe(true);
    expect(isTap(16)).toBe(false);
  });

  test("two fingers: spread, turn and slide", () => {
    const a0 = { x: 100, y: 200 },
      b0 = { x: 200, y: 200 };
    const pinch = twoFinger(a0, b0, { x: 50, y: 200 }, { x: 250, y: 200 });
    expect(pinch.scale).toBeCloseTo(2);
    expect(pinch.rotation).toBeCloseTo(0);
    // Turning the right finger down is clockwise on screen.
    const twist = twoFinger(a0, b0, a0, { x: 100 + 100 * Math.cos(0.5), y: 200 + 100 * Math.sin(0.5) });
    expect(twist.rotation).toBeCloseTo(0.5);
    expect(twist.scale).toBeCloseTo(1);
    const slide = twoFinger(a0, b0, { x: 100, y: 150 }, { x: 200, y: 150 });
    expect(slide.dy).toBeCloseTo(-50);
    expect(slide.scale).toBeCloseTo(1);
  });

  test("a pinch zooms without turning, a twist turns, a two-finger slide only tilts", () => {
    const start = { zoom: true, twist: false, tilt: false };
    expect(twoFingerModes({ scale: 1.4, rotation: 0.08, dx: 0, dy: 4 }, start)).toEqual(start);
    const twisting = twoFingerModes({ scale: 1.05, rotation: 0.35, dx: 0, dy: 0 }, start);
    expect(twisting).toEqual({ zoom: true, twist: true, tilt: false });
    // Once turning, a later slide does not switch to tilting.
    expect(twoFingerModes({ scale: 1, rotation: 0, dx: 0, dy: 60 }, twisting)).toEqual(twisting);
    const tilting = twoFingerModes({ scale: 1.02, rotation: 0.05, dx: 3, dy: -40 }, start);
    expect(tilting).toEqual({ zoom: false, twist: false, tilt: true });
    expect(twoFingerModes({ scale: 1.6, rotation: 0.6, dx: 0, dy: 0 }, tilting)).toEqual(tilting);
    // A sideways slide is not a tilt.
    expect(twoFingerModes({ scale: 1, rotation: 0, dx: 60, dy: 30 }, start)).toEqual(start);
  });
});
