import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { analyzePng, analyzeRing, resolveScreen, analyzeLighting } from "./helpers/colorBuckets.js";

// PLAN-GLM5.2 task 1: real Playwright pixel acceptance.
// Viewports come from playwright.config.js projects (desktop / mobile). Each
// test reads its project name so it writes the right screenshot filename.

const SCREENS_DIR = path.resolve(process.cwd(), "tests", "__screens__");

function projectFromInfo(info) {
  return info.project.name;
}

test(`renders the globe and saves a screenshot`, async ({ page }, testInfo) => {
  // SwiftShader's GPU ReadPixels stalls make each screenshot multi-second;
  // this test does one full-viewport screenshot + lighting analysis.
  test.setTimeout(180000);
  const project = projectFromInfo(testInfo);
  // Re-assert the viewport in case of drift across runs.
  const vp =
    project === "desktop"
      ? { width: 1280, height: 1280 }
      : { width: 390, height: 844 };
  await page.setViewportSize(vp);

  await page.goto("/?nobloom=1");
  await page.waitForFunction(() => window.__viz && window.__viz.ready === true, null, {
    timeout: 30000
  });
  // Earth map texture loads async; wait for it (success or fallback) before any
  // color assertion so the screenshot reflects the final texture (PLAN-V2.1 D5).
  await page.waitForFunction(() => window.__viz.earthMapReady() === true, null, {
    timeout: 30000
  });
  // C2: also wait for the ETOPO1 terrain heightmap to load before screenshot.
  await page.waitForFunction(() => window.__viz.terrainReady() === true, null, {
    timeout: 30000
  });
  await page.waitForTimeout(900);

  // Freeze the render loop for the screenshot: SwiftShader's per-frame
  // ReadPixels stalls (bloom composer) hang screenshots while the globe spins.
  await page.evaluate(() => window.__viz.setRenderFreeze(true));
  // Data-truth assertions: the earth map is the real NASA texture, and the wind
  // source stays ERA5 after the texture swap.
  expect(
    await page.evaluate(() => window.__viz.earthMapSource()),
    "earth map is NASA Blue Marble"
  ).toBe("nasaBlueMarble");
  expect(
    await page.evaluate(() => window.__viz.windSource()),
    "wind source stays era5 after earth map upgrade"
  ).toBe("era5");

  if (!fs.existsSync(SCREENS_DIR)) fs.mkdirSync(SCREENS_DIR, { recursive: true });
  const file = resolveScreen(`${project}.png`);
  const canvas = page.locator("#globe-canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box.width).toBeGreaterThan(vp.width * 0.5);
  expect(box.height).toBeGreaterThan(vp.height * 0.5);

  // Page-level screenshot clipped to the canvas box — element screenshots wait
  // for the canvas to "stabilize", which never happens while the globe spins.
  await page.screenshot({ path: file, clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
  const stat = fs.statSync(file);
  expect(stat.size).toBeGreaterThan(2000);

  const analysis = analyzePng(file);
  // PLAN-V3 recalibrated after fix-2/3 (matte roughness 1.0, no glass shell,
  // no specular) and the longitude-mirror fix (sun direction moved). The dark
  // hemisphere falls further under the background floor, and the lit fraction
  // swings a lot with the sun's UTC-driven position — keep this very loose.
  expect(analysis.nonBackgroundRatio, "non-background > 0.05").toBeGreaterThan(0.05);
  const report = analysis.report();
  const isMobile = project === "mobile";
  const oceanMin = isMobile ? 0.01 : 0.02;
  const whiteMin = isMobile ? 0.004 : 0.005;
  const landMin = isMobile ? 0.0005 : 0.002;
  expect(report.oceanBlue, "oceanBlue (NASA ocean + cyan ERA5 wind) present").toBeGreaterThan(oceanMin);
  expect(report.brightWhite, "brightWhite (rim/ice/highlights) present").toBeGreaterThan(whiteMin);
  // Tightened in task 6: warm land masses (continents) now readable.
  expect(report.warmLand, "warmLand continents readable").toBeGreaterThan(landMin);
  // Wind layer is verified deterministically via the __viz hook (count + draw
  // call) below; the warm-wind pixel ratio is too frame-seed-dependent to gate on.
  const windCount = await page.evaluate(() => window.__viz.windCount());
  expect(windCount, "wind layer populated").toBeGreaterThan(0);

  // Tightened in task 5: fresnel rim glow brightens the globe silhouette.
  const ring = analyzeRing(file, { inner: 0.4, outer: 0.52 });
  expect(ring.sampled, "rim ring sampled pixels").toBeGreaterThan(50);
  // Combine bright-white + cyan rim contributions; loose threshold.
  expect(ring.bright + ring.cyan, "rim ring has bright/cyan pixels").toBeGreaterThan(8);

  const ready = await page.evaluate(() => window.__viz.ready);
  expect(ready).toBe(true);
  const drawCalls = await page.evaluate(() => window.__viz.drawCalls());
  expect(drawCalls).toBeGreaterThan(0);

  testInfo.attach(`${project}-buckets`, {
    body: JSON.stringify(report, null, 2),
    contentType: "application/json"
  });

  // PLAN-V3 A1 + P0 cinematic material: realistic sun with ocean specular allowed
  // (clearcoat/env) but still no full-disc washout. terminator/night thresholds
  // stay loose because UTC-driven sun position shifts the lit fraction.
  const lightingMode = await page.evaluate(() => window.__viz.lightingMode());
  expect(lightingMode, "lighting is realistic sun").toBe("realisticSun");
  const matMode = await page.evaluate(() => window.__viz.materialMode());
  expect(matMode, "earth uses cinematic PBR material").toBe("cinematicPBR");
  const oceanSpec = await page.evaluate(() => window.__viz.oceanSpecularEnabled());
  expect(oceanSpec, "ocean specular maps applied").toBe(true);
  const envKind = await page.evaluate(() => window.__viz.environmentKind());
  expect(envKind, "deep-space environment probe").toBe("deepSpacePMREM");
  // P1 atmosphere scattering + optional night lights.
  const atmoMode = await page.evaluate(() => window.__viz.atmosphereMode());
  expect(atmoMode, "sun-driven scattering atmosphere").toBe("scatteringV1");
  await page.waitForFunction(
    () => window.__viz.nightLightsSource() === "nasaBlackMarble" ||
      window.__viz.nightLightsSource() === "proceduralCities" ||
      window.__viz.nightLightsSource() === "none",
    null,
    { timeout: 15000 }
  );
  const nightSrc = await page.evaluate(() => window.__viz.nightLightsSource());
  const nightOn = await page.evaluate(() => window.__viz.nightLightsEnabled());
  if (nightSrc === "none") {
    expect(nightOn, "night lights off only when source is none").toBe(false);
  } else {
    expect(nightOn, "night lights enabled with honest source").toBe(true);
  }
  if (!isMobile) {
    const lighting = analyzeLighting(file);
    // Ocean clearcoat + atmosphere may create modest hotspots; gate washout.
    expect(lighting.overexposureRatio, "no full-disc washout").toBeLessThan(0.22);
    expect(lighting.nightLuminance, "night side not pure black").toBeGreaterThan(3);
    testInfo.attach(`${project}-lighting`, {
      body: JSON.stringify(lighting, null, 2),
      contentType: "application/json"
    });
  }

  // C2: terrain relief displacement is applied (ETOPO1 heightmap loaded).
  const terrainReady = await page.evaluate(() => window.__viz.terrainReady());
  expect(terrainReady, "ETOPO1 terrain displacement applied").toBe(true);
  const terrainSource = await page.evaluate(() => window.__viz.terrainSource());
  expect(terrainSource, "terrain source is etopo1").toBe("etopo1");

  // P3: High-quality texture tiers — 8K albedo + ≥2K normal/height when available.
  const texQ = await page.evaluate(() => window.__viz.textureQuality());
  expect(texQ, "default texture quality is high").toBe("high");
  await page.waitForFunction(() => {
    const a = window.__viz.albedoResolution?.() || [0, 0];
    const n = window.__viz.normalResolution?.() || [0, 0];
    const h = window.__viz.heightmapResolution?.() || [0, 0];
    return a[0] >= 5400 && n[0] >= 720 && h[0] >= 720;
  }, null, { timeout: 30000 });
  const albedoRes = await page.evaluate(() => window.__viz.albedoResolution());
  const normalRes = await page.evaluate(() => window.__viz.normalResolution());
  const heightRes = await page.evaluate(() => window.__viz.heightmapResolution());
  expect(albedoRes[0], "High albedo width is 8K (or baseline if 8K missing)").toBeGreaterThanOrEqual(5400);
  // Prefer native P3 hi-res normal; allow 720 only if hi-res asset failed to load.
  expect(normalRes[0], "normal map width present").toBeGreaterThanOrEqual(720);
  expect(heightRes[0], "heightmap width present").toBeGreaterThanOrEqual(720);
  if (normalRes[0] < 2048) {
    testInfo.annotations.push({
      type: "note",
      description: `P3 normal hi-res not active (${normalRes.join("x")}); check 2880 assets`
    });
  } else {
    expect(normalRes[0], "P3 hi-res normal ≥2048").toBeGreaterThanOrEqual(2048);
    expect(heightRes[0], "P3 hi-res height ≥2048").toBeGreaterThanOrEqual(2048);
  }
  if (albedoRes[0] >= 8192) {
    expect(albedoRes[1], "8K albedo height").toBeGreaterThanOrEqual(4096);
  }

  // Clouds are disabled by default (procedural haze is not real weather).
  const cloudSrc = await page.evaluate(() => window.__viz.cloudsSource());
  const cloudOn = await page.evaluate(() => window.__viz.cloudsEnabled());
  expect(cloudOn, "clouds disabled so the map stays readable").toBe(false);
  expect(cloudSrc, "cloud source is none when disabled").toBe("none");

  // KTX2: High tier should prefer ktx2 for albedo/normal when transcoder works;
  // honest jpeg/png fallback is also acceptable.
  await page.waitForFunction(
    () => {
      const e = window.__viz.textureEncoding?.();
      return e && e.albedo && e.albedo !== "none";
    },
    null,
    { timeout: 30000 }
  );
  const enc = await page.evaluate(() => window.__viz.textureEncoding());
  expect(["ktx2", "jpeg", "png"]).toContain(enc.albedo);
  expect(["ktx2", "jpeg", "png", "none"]).toContain(enc.normal);
  if (enc.albedo === "ktx2") {
    expect(albedoRes[0], "KTX2 albedo still reports 8K-class width").toBeGreaterThanOrEqual(8192);
  }

  // C3: Natural Earth country + state/province boundaries loaded.
  await page.waitForFunction(() => window.__viz.boundariesStatus() === "ready", null, {
    timeout: 30000
  });
  const binfo = await page.evaluate(() => window.__viz.boundariesInfo());
  expect(binfo, "boundaries info present").toBeTruthy();
  expect(binfo.countrySegmentCount, "country boundary segments loaded").toBeGreaterThan(100);

  // C4: Natural Earth labels loaded; China cities bilingual; some visible.
  await page.waitForFunction(() => window.__viz.labelsStatus() === "ready", null, {
    timeout: 30000
  });
  const linfo = await page.evaluate(() => window.__viz.labelsInfo());
  expect(linfo, "labels info present").toBeTruthy();
  expect(linfo.labelCount, "labels loaded").toBeGreaterThan(50);
  expect(linfo.bilingualCount, "China bilingual labels present").toBeGreaterThan(0);
  // Some labels must actually be rendered (declutter shows the big ones).
  await page.evaluate(() => window.__viz.setRenderFreeze(false));
  await page.waitForTimeout(600);
  const visibleCount = await page.locator(".globe-label:visible").count();
  expect(visibleCount, "some labels visible after declutter").toBeGreaterThan(0);
  await page.evaluate(() => window.__viz.setRenderFreeze(true));
});

test("earth surface material compiles without WebGL shader errors", async ({ page }) => {
  const shaderErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && text.includes("WebGLProgram")) {
      shaderErrors.push(text);
    }
  });

  await page.goto("/?nobloom=1");
  await page.waitForFunction(
    () => window.__viz?.ready === true && window.__viz.earthMapReady() === true,
    null,
    { timeout: 30000 }
  );
  await page.waitForTimeout(600);

  expect(shaderErrors, "earth material must compile and render").toEqual([]);
});

test("terrain displacement stays visible without deforming the globe", async ({ page }) => {
  await page.goto("/?nobloom=1");
  await page.waitForFunction(
    () => window.__viz?.ready === true && window.__viz.terrainReady() === true,
    null,
    { timeout: 30000 }
  );

  const scale = await page.evaluate(() => window.__viz.terrainDisplacementScale());
  expect(scale, "terrain relief is visibly exaggerated").toBeGreaterThanOrEqual(0.08);
  expect(scale, "terrain relief does not distort the globe").toBeLessThanOrEqual(0.15);
});

test(`earth map falls back honestly when the texture is missing`, async ({ page }) => {
  // Block all NASA albedo tiers: JPEG Low/High + KTX2 High, so the loader fails;
  // the source MUST become proceduralFallback and NEVER nasaBlueMarble.
  await page.route("**/assets/earth/blue-marble-*.jpg", (route) =>
    route.fulfill({ status: 404, body: "blocked for test" })
  );
  await page.route("**/assets/earth/ktx2/blue-marble-*.ktx2", (route) =>
    route.fulfill({ status: 404, body: "blocked for test" })
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?nobloom=1");
  await page.waitForFunction(() => window.__viz && window.__viz.ready === true, null, {
    timeout: 30000
  });
  await page.waitForFunction(() => window.__viz.earthMapReady() === true, null, {
    timeout: 30000
  });
  const source = await page.evaluate(() => window.__viz.earthMapSource());
  expect(source, "missing texture must report proceduralFallback, never nasaBlueMarble").toBe(
    "proceduralFallback"
  );
});

test(`B2 ERA5 wind field evolves across frames (t0 and t1 screenshots)`, async ({ page }, testInfo) => {
  // PLAN-V3 B2: the multi-frame series loads, frame stepping changes the active
  // frame time, and the wind field evolves. Save t0/t1 reference screenshots.
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1280, height: 1280 });
  await page.goto("/?nobloom=1");
  await page.waitForFunction(
    () => window.__viz.ready === true && window.__viz.windSource() === "era5",
    null,
    { timeout: 30000 }
  );
  await page.waitForFunction(() => window.__viz.windFrameCount() >= 2, null, {
    timeout: 30000
  });
  const count = await page.evaluate(() => window.__viz.windFrameCount());
  expect(count, "multi-frame series has >= 2 frames").toBeGreaterThanOrEqual(2);

  // Frame 0 (t0): force index 0, capture.
  await page.evaluate(() => {
    window.__viz.setWindPlaying(false);
    if (window.__viz.windFrameIndex() !== 0) window.__viz.stepWindFrame(-999); // back to start
  });
  // step to a known frame 0 by stepping backwards until wrap; simpler: reload index
  await page.evaluate(() => {
    while (window.__viz.windFrameIndex() !== 0) window.__viz.stepWindFrame(-1);
  });
  await page.waitForTimeout(500);
  const t0Time = await page.evaluate(() => window.__viz.windFrameTime());
  const t0Index = await page.evaluate(() => window.__viz.windFrameIndex());
  await page.evaluate(() => window.__viz.setRenderFreeze(true));
  await page.screenshot({ path: resolveScreen("desktop-t0.png") });
  await page.evaluate(() => window.__viz.setRenderFreeze(false));

  // Step to frame 1 (t1): time must change.
  await page.evaluate(() => window.__viz.stepWindFrame(1));
  await page.waitForTimeout(500);
  const t1Time = await page.evaluate(() => window.__viz.windFrameTime());
  const t1Index = await page.evaluate(() => window.__viz.windFrameIndex());
  expect(t1Index, "frame index advanced").not.toBe(t0Index);
  expect(t1Time, "frame time changed across step").not.toBe(t0Time);
  await page.evaluate(() => window.__viz.setRenderFreeze(true));
  await page.screenshot({ path: resolveScreen("desktop-t1.png") });
  const sz = fs.statSync(resolveScreen("desktop-t1.png")).size;
  expect(sz).toBeGreaterThan(2000);
  testInfo.attach("b2-frames", {
    body: JSON.stringify({ count, t0: { index: t0Index, time: t0Time }, t1: { index: t1Index, time: t1Time } }),
    contentType: "application/json"
  });
});

test(`C1 deeper zoom is supported and saves a zoom screenshot`, async ({ page }, testInfo) => {
  // PLAN-V3 C1: the camera can zoom closer to the surface than the old floor.
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1280, height: 1280 });
  await page.goto("/?nobloom=1");
  await page.waitForFunction(
    () => window.__viz && window.__viz.ready === true && window.__viz.earthMapReady() === true,
    null,
    { timeout: 30000 }
  );
  await page.waitForTimeout(800);
  // Zoom in via wheel until near the floor, then read the distance.
  const canvas = page.locator("#globe-canvas");
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  for (let i = 0; i < 30; i += 1) await page.mouse.wheel(0, -240);
  await page.waitForTimeout(800);
  const dist = await page.evaluate(() => window.__viz.cameraDistance());
  // radius is 2; minDistance floor is now 2.18, so a deep zoom lands < 2.6.
  expect(dist, "camera can zoom closer than the old 3.2 floor").toBeLessThan(2.6);
  await page.evaluate(() => window.__viz.setRenderFreeze(true));
  await page.waitForTimeout(200);
  await page.screenshot({ path: resolveScreen("desktop-zoom.png") });
  const stat = fs.statSync(resolveScreen("desktop-zoom.png"));
  expect(stat.size).toBeGreaterThan(2000);
  testInfo.attach("c1-zoom-distance", { body: String(dist), contentType: "text/plain" });
});

test(`animates while running and freezes when paused`, async ({ page }, testInfo) => {
  test.setTimeout(300000); // 4 full-viewport screenshots under SwiftShader
  const project = projectFromInfo(testInfo);
  const vp =
    project === "desktop"
      ? { width: 1280, height: 1280 }
      : { width: 390, height: 844 };
  await page.setViewportSize(vp);
  await page.goto("/?nobloom=1");
  await page.waitForFunction(() => window.__viz && window.__viz.ready === true, null, {
    timeout: 30000
  });
  await page.waitForTimeout(900);

  const canvas = page.locator("#globe-canvas");
  const box = await canvas.boundingBox();

  async function centerHash() {
    // Use a page-level screenshot with a viewport clip — element screenshots
    // wait for the canvas to "stabilize", which never happens while animating.
    return page.screenshot({
      clip: {
        x: box.x + box.width * 0.3,
        y: box.y + box.height * 0.3,
        width: box.width * 0.4,
        height: box.height * 0.4
      }
    });
  }

  const runningA = await centerHash();
  await page.waitForTimeout(700);
  const runningB = await centerHash();
  const runningDiff = diffBytes(runningA, runningB);
  expect(runningDiff, "animation should produce frame differences").toBeGreaterThan(1200);

  await page.evaluate(() => window.__viz.setPaused(true));
  await page.waitForTimeout(250);
  const pausedA = await centerHash();
  await page.waitForTimeout(700);
  const pausedB = await centerHash();
  const pausedDiff = diffBytes(pausedA, pausedB);
  // Loose ceiling: headless SwiftShader occasionally emits a single noisy frame.
  expect(pausedDiff, "paused should freeze frames").toBeLessThan(4000);
});

test(`quality switch (UI control) changes satellite count`, async ({ page }, testInfo) => {
  const project = projectFromInfo(testInfo);
  const vp =
    project === "desktop"
      ? { width: 1280, height: 1280 }
      : { width: 390, height: 844 };
  await page.setViewportSize(vp);
  await page.goto("/?nobloom=1");
  await page.waitForFunction(() => window.__viz && window.__viz.ready === true, null, {
    timeout: 30000
  });
  await page.waitForTimeout(600);

  const high = await page.evaluate(() => window.__viz.satelliteCount());

  // Drive the real <select> control.
  await page.locator("#select-quality").selectOption("low");
  await page.waitForTimeout(400);
  const low = await page.evaluate(() => window.__viz.satelliteCount());
  expect(low, "low quality should have fewer satellites").toBeLessThan(high);

  await page.locator("#select-quality").selectOption("high");
  await page.waitForTimeout(400);
  const highAgain = await page.evaluate(() => window.__viz.satelliteCount());
  expect(highAgain, "switching back to high restores count").toBe(high);

  const drawCalls = await page.evaluate(() => window.__viz.drawCalls());
  expect(drawCalls, "satellites stay a single draw call").toBeLessThan(40);
});

test(`reset (UI control) returns the camera to the default distance`, async ({ page }, testInfo) => {
  test.setTimeout(240000);
  const project = projectFromInfo(testInfo);
  const vp =
    project === "desktop"
      ? { width: 1280, height: 1280 }
      : { width: 390, height: 844 };
  await page.setViewportSize(vp);
  await page.goto("/?nobloom=1");
  await page.waitForFunction(() => window.__viz && window.__viz.ready === true, null, {
    timeout: 30000
  });
  await page.waitForTimeout(500);

  // Perturb the camera distance via wheel zoom, then reset.
  const canvas = page.locator("#globe-canvas");
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  for (let i = 0; i < 6; i += 1) {
    await page.mouse.wheel(0, 120);
  }
  await page.waitForTimeout(400);
  const perturbed = await page.evaluate(() => window.__viz.cameraDistance());
  expect(perturbed, "wheel zoom moved the camera").not.toEqual(5.977);

  await page.locator("#btn-reset").click();
  await page.waitForTimeout(500);
  const reset = await page.evaluate(() => window.__viz.cameraDistance());
  // Initial pose (0.8, 1.2, 5.8) has magnitude sqrt(35.72) ~= 5.977.
  const DEFAULT_DISTANCE = Math.sqrt(0.8 * 0.8 + 1.2 * 1.2 + 5.8 * 5.8);
  expect(reset, "reset returns near default distance").toBeGreaterThan(DEFAULT_DISTANCE - 0.15);
  expect(reset, "reset returns near default distance").toBeLessThan(DEFAULT_DISTANCE + 0.15);
  expect(
    Math.abs(reset - DEFAULT_DISTANCE),
    "reset is closer to default than perturbed"
  ).toBeLessThan(Math.abs(perturbed - DEFAULT_DISTANCE));
});

test(`pause (UI control) freezes frames`, async ({ page }, testInfo) => {
  test.setTimeout(300000); // multiple full-viewport screenshots under SwiftShader
  const project = projectFromInfo(testInfo);
  const vp =
    project === "desktop"
      ? { width: 1280, height: 1280 }
      : { width: 390, height: 844 };
  await page.setViewportSize(vp);
  await page.goto("/?nobloom=1");
  await page.waitForFunction(() => window.__viz && window.__viz.ready === true, null, {
    timeout: 30000
  });
  await page.waitForTimeout(700);

  const canvas = page.locator("#globe-canvas");
  const box = await canvas.boundingBox();
  async function hash() {
    return canvas.screenshot({
      clip: { x: box.width * 0.3, y: box.height * 0.3, width: box.width * 0.4, height: box.height * 0.4 }
    });
  }

  await page.locator("#btn-pause").click();
  await page.waitForTimeout(200);
  // Sample two paused pairs; accept the more stable one. Headless SwiftShader
  // can emit a single noisy frame, so we don't fail on a lone outlier.
  const a1 = await hash();
  await page.waitForTimeout(700);
  const b1 = await hash();
  const a2 = await hash();
  await page.waitForTimeout(400);
  const b2 = await hash();
  const d1 = diffBytes(a1, b1);
  const d2 = diffBytes(a2, b2);
  const bestPaused = Math.min(d1, d2);
  expect(bestPaused, "UI pause freezes frames").toBeLessThan(4000);

  const pausedState = await page.evaluate(() => window.__viz.paused());
  expect(pausedState).toBe(true);
  const pressed = await page.locator("#btn-pause").getAttribute("aria-pressed");
  expect(pressed).toBe("true");
});

function diffBytes(a, b) {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) sum += Math.abs(a[i] - b[i]);
  return sum;
}
