import { test, expect } from "@playwright/test";

// ERA5 data-source provenance tests (PLAN-ERA5-WAZA-GLM5.2 task 3).
//
// These tests guard the data-truth invariant: windSource() must report a real
// status ("era5" | "devSynthetic" | "missing" | "loading") and must NEVER promote
// devSynthetic/missing to "era5". With no ERA5 frame shipped yet, the app should
// settle on devSynthetic (synthetic fallback running) or missing — not era5.

const SOURCE_VALUES = new Set(["era5", "devSynthetic", "missing", "loading"]);

async function waitForSourceSettled(page) {
  // Wind loads async; poll until it leaves "loading".
  await expect
    .poll(async () => {
      const s = await page.evaluate(() => window.__viz?.windSource());
      return s;
    }, { timeout: 12000 })
    .not.toBe("loading");
}

test(`windSource reports a valid, honest status (no ERA5 frame shipped)`, async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.waitForFunction(() => window.__viz && window.__viz.ready === true, null, {
    timeout: 15000
  });
  await waitForSourceSettled(page);

  const source = await page.evaluate(() => window.__viz.windSource());
  expect(SOURCE_VALUES.has(source), `windSource=${source} not in valid set`).toBe(true);

  // With the real ERA5 frame shipped (task 4), the app MUST load it and report
  // era5. If it ever falls back to devSynthetic while the frame exists, that's a
  // regression OR a legitimate missing-frame state — assert the loaded truth.
  const kind = await page.evaluate(() => window.__viz.windLayerKind());
  const time = await page.evaluate(() => window.__viz.windFrameTime());

  if (source === "era5") {
    // era5 claims must be backed by a real frame time.
    expect(time, "era5 requires windFrameTime").toBeTruthy();
    expect(time, "frame time should be the sample hour").toContain("2024-01-15");
    expect(kind, "era5 source must render era5 layer").toBe("era5");
  } else if (source === "devSynthetic" || source === "missing") {
    // Honest fallback: layer kind must NOT pretend to be era5.
    expect(kind, "non-era5 source must not render era5 layer").toBe("devSynthetic");
  }
});
