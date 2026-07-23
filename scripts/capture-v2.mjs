import { chromium } from '@playwright/test';
import fs from 'node:fs';

const OUT = '/tmp/earth-v2';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  await page.goto('http://127.0.0.1:5173/');
  await page.waitForFunction(() => window.__viz && window.__viz.ready === true, null, { timeout: 60000 });
  await page.waitForFunction(() => window.__viz.earthMapReady() === true, null, { timeout: 60000 });
  await page.waitForFunction(() => window.__viz.terrainReady() === true, null, { timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.__viz.setPaused(true));

  // 1. Default view
  await page.evaluate(() => window.__viz.setRenderFreeze(true));
  await page.screenshot({ path: `${OUT}/01-default.png` });

  // 2. Day side (rotate to face sun)
  await page.evaluate(() => window.__viz.setRenderFreeze(false));
  const canvas = page.locator('#globe-canvas');
  const box = await canvas.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // Drag to find a good day-side view
  for (let i = 0; i < 2; i++) {
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx - 180, cy, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => window.__viz.setRenderFreeze(true));
  await page.screenshot({ path: `${OUT}/02-day-side.png` });

  // 3. Night side
  await page.evaluate(() => window.__viz.setRenderFreeze(false));
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 350, cy, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__viz.setRenderFreeze(true));
  await page.screenshot({ path: `${OUT}/03-night-side.png` });

  // 4. Mid zoom
  await page.evaluate(() => window.__viz.setRenderFreeze(false));
  await page.mouse.move(cx, cy);
  for (let i = 0; i < 8; i++) await page.mouse.wheel(0, -150);
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__viz.setRenderFreeze(true));
  await page.screenshot({ path: `${OUT}/04-mid-zoom.png` });

  // 5. Wide view
  await page.evaluate(() => window.__viz.setRenderFreeze(false));
  await page.mouse.move(cx, cy);
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 200);
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__viz.setRenderFreeze(true));
  await page.screenshot({ path: `${OUT}/05-wide.png` });

  await browser.close();
  console.log('Screenshots saved to', OUT);
  for (const f of fs.readdirSync(OUT)) {
    const stat = fs.statSync(`${OUT}/${f}`);
    console.log(`  ${f}  ${(stat.size / 1024).toFixed(1)} KB`);
  }
})();
