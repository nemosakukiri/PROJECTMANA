import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium";
const svg = readFileSync(new URL("../public/icon-source.svg", import.meta.url), "utf-8");

const sizes = [
  { size: 16, out: "favicon-16.png" },
  { size: 32, out: "favicon-32.png" },
  { size: 180, out: "apple-touch-icon.png" },
  { size: 192, out: "icon-192.png" },
  { size: 512, out: "icon-512.png" },
];

const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
for (const { size, out } of sizes) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<!doctype html><html><body style="margin:0;padding:0;">${svg.replace(
      'width="512" height="512"',
      `width="${size}" height="${size}"`
    )}</body></html>`
  );
  const outPath = fileURLToPath(new URL(`../public/${out}`, import.meta.url));
  await page.screenshot({ path: outPath, omitBackground: false });
  await page.close();
  console.log(`wrote ${outPath}`);
}
await browser.close();
