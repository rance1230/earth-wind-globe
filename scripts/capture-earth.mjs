import { chromium } from '@playwright/test';
import fs from 'node:fs';

const OUT = '/tmp/earth-screens';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // 使用正常模式（bloom 开启）来截图
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForFunction(() => window.__viz && window.__viz.ready === true, null, { timeout: 30000 });
  await page.waitForFunction(() => window.__viz.earthMapReady() === true, null, { timeout: 30000 });
  await page.waitForFunction(() => window.__viz.terrainReady() === true, null, { timeout: 30000 });
  await page.waitForTimeout(2000);

  // 1. 默认视角
  await page.screenshot({ path: `${OUT}/01-default.png` });

  // 2. 暂停后旋转到不同角度 — 看夜面
  await page.evaluate(() => window.__viz.setPaused(true));
  await page.evaluate(() => window.__viz.setRenderFreeze(true));
  await page.screenshot({ path: `${OUT}/02-paused-default.png` });

  // 解冻，旋转
  await page.evaluate(() => window.__viz.setRenderFreeze(false));
  await page.evaluate(() => {
    // 通过 OrbitControls 旋转约 90 度
    const canvas = document.querySelector('#globe-canvas');
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: cx, clientY: cy, button: 0 }));
    canvas.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: cx + 400, clientY: cy, button: 0 }));
    canvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: cx + 400, clientY: cy, button: 0 }));
  });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__viz.setRenderFreeze(true));
  await page.screenshot({ path: `${OUT}/03-rotated.png` });

  // 3. Zoom in 近表面
  await page.evaluate(() => window.__viz.setRenderFreeze(false));
  const canvas = page.locator('#globe-canvas');
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  for (let i = 0; i < 25; i++) await page.mouse.wheel(0, -200);
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__viz.setRenderFreeze(true));
  await page.screenshot({ path: `${OUT}/04-zoomed.png` });

  // 4. 再转一个角度看晨昏线
  await page.evaluate(() => window.__viz.setRenderFreeze(false));
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
  await page.mouse.up();
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__viz.setRenderFreeze(true));
  await page.screenshot({ path: `${OUT}/05-terminator.png` });

  await browser.close();
  console.log(`Screenshots saved to ${OUT}/`);
  for (const f of fs.readdirSync(OUT)) {
    const stat = fs.statSync(`${OUT}/${f}`);
    console.log(`  ${f}  ${(stat.size / 1024).toFixed(1)} KB`);
  }
})();
