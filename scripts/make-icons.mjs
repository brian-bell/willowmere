// Draws the Home Screen icons in public/icons/ from the favicon's sprig
// (index.html), so the art stays generated in code:
//   node scripts/make-icons.mjs
// Run it again after changing the drawing below, and commit the PNGs.
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const OUT = new URL("../public/icons/", import.meta.url);
// The favicon's sprig on its 40-unit grid, drawn at `scale` around the centre
// of a full-bleed square; iOS and Android round the corners themselves.
const icon = (scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
  <defs><radialGradient id="g" cx="0.5" cy="0.38" r="0.75">
    <stop offset="0" stop-color="#3f6653"/><stop offset="1" stop-color="#28493f"/>
  </radialGradient></defs>
  <rect width="40" height="40" fill="url(#g)"/>
  <g transform="translate(20 20) scale(${scale}) translate(-20 -19)" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 32V15M20 24C7 25 7 9 7 9s14 0 13 15M20 20C20 7 33 6 33 6s1 14-13 14"
      fill="#dce9b5" stroke="#dce9b5" stroke-width="1.2"/>
  </g>
</svg>`;
const ICONS = [
  { file: "apple-touch-icon.png", size: 180, scale: 0.78 },
  { file: "icon-192.png", size: 192, scale: 0.78 },
  { file: "icon-512.png", size: 512, scale: 0.78 },
  // Maskable icons keep their drawing inside the middle 80%.
  { file: "icon-maskable-512.png", size: 512, scale: 0.6 },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
);
const page = await browser.newPage();
for (const { file, size, scale } of ICONS) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${icon(scale)}`,
  );
  await page.screenshot({ path: new URL(file, OUT).pathname, omitBackground: false });
  console.log(file);
}
await browser.close();
