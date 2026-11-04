import { expect } from "@playwright/test";

/**
 * Desktop starts with the camera controls folded behind the Camera button;
 * opens them so a test can click zoom, tilt, yaw, pan and the view toggle.
 * Phones and touch screens show them already, so nothing is clicked there.
 */
export async function showCameraControls(page) {
  const toggle = page.locator("#camera-toggle");
  if (!(await toggle.isVisible())) return;
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
}
