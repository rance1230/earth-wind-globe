import { chromium } from '@playwright/test';
import fs from 'node:fs';

const OUT = '/tmp/earth-final';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

  await page.goto('http://127.0.0.1:5173/');
  await page.waitForFunction(() => window.__viz && window.__viz.ready === true, null, { timeout: 60000 });
  await page.waitForFunction(() => window.__viz.earthMapReady() === true, null, { timeout: 60000 });
  await page.waitForFunction(() => window.__viz.terrainReady() === true, null, { timeout: 60000 });
  await page.waitForTimeout(4000);
  await page.evaluate(() => window.__viz.setPaused(true));

  const canvas = page.locator('#globe-canvas');
  const box = await canvas.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // 1. 默认视角
  await page.evaluate(() => window.__viz.setRenderFreeze(true));
  await page.screenshot({ path: `${OUT}/01-default.png` });

  // 2. 旋转到北美/南美昼面（看风场白天可见性）
  await page.evaluate(() => window.__viz.setRenderFreeze(false));
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 220, cy + 80, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__viz.setRenderFreeze(true));
  await page.screenshot({ path: `${OUT}/02-day-americas.png` });

  // 3. 旋转到亚洲/欧洲夜面（看城市夜光）
  await page.evaluate(() => window.__viz.setRenderFreeze(false));
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 400, cy - 50, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__viz.setRenderFreeze(true));
  await page.screenshot({ path: `${OUT}/03-night-asia.png` });

  // 4. 旋转到晨昏线附近（看大气散射）
  await page.evaluate(() => window.__viz.setRenderFreeze(false));
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 150, cy - 120, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__viz.setRenderFreeze(true));
  await page.screenshot({ path: `${OUT}/04-terminator.png` });

  // 5. Zoom in 近表面
  await page.evaluate(() => window.__viz.setRenderFreeze(false));
  await page.mouse.move(cx, cy);
  for (let i = 0; i < 10; i++) await page.mouse.wheel(0, -180);
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__viz.setRenderFreeze(true));
  await page.screenshot({ path: `${OUT}/05-zoomed.png` });

  // 6. 拉远全览
  await page.evaluate(() => window.__viz.setRenderFreeze(false));
  await page.mouse.move(cx, cy);
  for (let i = 0; i < 15; i++) await page.mouse.wheel(0, 250);
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__viz.setRenderFreeze(true));
  await page.screenshot({ path: `${OUT}/06-wide.png` });

  // 7. 太平洋风场密集区
  await page.evaluate(() => window.__viz.resetCamera());
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__viz.setRenderFreeze(false));
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 250, cy - 150, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__viz.setRenderFreeze(true));
  await page.screenshot({ path: `${OUT}/07-pacific-wind.png` });

  await browser.close();
  console.log('Screenshots saved to', OUT);
  for (const f of fs.readdirSync(OUT).sort()) {
    const stat = fs.statSync(`${OUT}/${f}`);
    console.log(`  ${f}  ${(stat.size / 1024).toFixed(1)} KB`);
  }
})();
