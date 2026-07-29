import { chromium } from '@playwright/test';
import fs from 'node:fs';

const OUT = '/tmp/earth-screens';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  await page.goto('http://127.0.0.1:5173/');
  await page.waitForFunction(() => window.__viz && window.__viz.ready === true, null, { timeout: 30000 });
  await page.waitForFunction(() => window.__viz.earthMapReady() === true, null, { timeout: 30000 });
  await page.waitForFunction(() => window.__viz.terrainReady() === true, null, { timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.__viz.setPaused(true));

  // Helper: get current sun direction
  async function sunDir() {
    return page.evaluate(() => {
      const d = window.__viz.sunDirection();
      return { x: d[0], y: d[1], z: d[2] };
    });
  }

  // Helper: rotate to face a direction
  async function rotateGlobeToFace(dir) {
    await page.evaluate((targetDir) => {
      // 设置 root rotation 使目标方向朝向相机
      // 相机在 (0.8, 1.2, 5.8) 附近，大致看 +Z 方向
      // 我们需要计算使 targetDir 朝向 +Z 的 rotation.y
      const target = new (window.THREE?.Vector3 || Object)(targetDir.x, targetDir.y, targetDir.z);
      const angle = Math.atan2(target.x, target.z);
      // 访问 root group
      const canvas = document.querySelector('#globe-canvas');
      const app = canvas.closest('#app');
      // 直接操作 EarthScene 实例比较困难，我们用 mouse drag
    }, dir);
  }

  // 1. 昼面（太阳直射面）— 通过拖拽找到亮面
  await page.evaluate(() => window.__viz.setRenderFreeze(false));
  const canvas = page.locator('#globe-canvas');
  const box = await canvas.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // 拖拽几次找到合适的角度
  for (let i = 0; i < 3; i++) {
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx - 200, cy, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(200);
  }
  await page.evaluate(() => window.__viz.setRenderFreeze(true));
  await page.screenshot({ path: `${OUT}/06-day-side.png` });

  // 2. 中等 zoom 看地形
  await page.evaluate(() => window.__viz.setRenderFreeze(false));
  await page.mouse.move(cx, cy);
  for (let i = 0; i < 8; i++) await page.mouse.wheel(0, -150);
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__viz.setRenderFreeze(true));
  await page.screenshot({ path: `${OUT}/07-mid-zoom.png` });

  // 3. 拉远看整体
  await page.evaluate(() => window.__viz.setRenderFreeze(false));
  await page.mouse.move(cx, cy);
  for (let i = 0; i < 15; i++) await page.mouse.wheel(0, 200);
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__viz.setRenderFreeze(true));
  await page.screenshot({ path: `${OUT}/08-wide.png` });

  // 4. 看风场密集区域
  await page.evaluate(() => window.__viz.resetCamera());
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__viz.setRenderFreeze(false));
  // 旋转到北太平洋（风场比较密集）
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 300, cy - 100, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__viz.setRenderFreeze(true));
  await page.screenshot({ path: `${OUT}/09-wind-detail.png` });

  await browser.close();
  console.log('Screenshots saved to', OUT);
})();
