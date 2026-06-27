// PNG -> HSV color-bucket analysis (PLAN-V2.1-EARTH-MAP D5 recalibration).
//
// Buckets and background detection are now calibrated to the NASA Blue Marble NG
// texture (5400×2700, July 2004 base topography/bathymetry) rather than the old
// procedural canvas. NASA palette is higher-saturation and truer-hue, so the
// warm-land / ocean thresholds are stable; background still tolerates the dark
// space + CSS radial-gradient bleed. Buckets: ocean / warm land / bright white /
// warm wind; ignores low-value background and optional HUD region.

import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

// Background is the dark space around the globe. In practice the canvas is
// translucent and the CSS radial-gradient bleeds through, so the actual corner
// color lands near (20,31,31). Treat any low-value, low-saturation pixel as
// background regardless of its exact hue — robust to bloom/ACES drift.
function isBackgroundPixel(r, g, b, a, tol = 14) {
  if (a === 0) return true;
  const max = Math.max(r, g, b);
  // Dark backdrop pixels (value < ~58) are background.
  if (max <= 58) return true;
  // Plus the exact #05070b scene background as a tolerance band.
  if (Math.abs(r - 5) <= tol && Math.abs(g - 7) <= tol && Math.abs(b - 11) <= tol) return true;
  return false;
}

function rgbToHsv(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

// Bucket definitions (loose thresholds — PLAN-GLM5.2 I3 deliberately relaxed).
function bucketOf(h, s, v) {
  // Warm wind: yellow/red hues. Additive blending + ACES dilutes saturation, so
  // accept S >= 0.28 and let brightness gate out dark mud. H is unreliable when
  // S is near zero, so require the saturation floor first.
  if (s >= 0.28 && h <= 60 && v >= 0.5) return "windWarm";
  // Warm land: warm hues (H 10-85). ACES tone-maps land down to S ~0.08-0.2, so
  // the floor is low; the hue range excludes ocean (H 180-235) and pure whites.
  if (h >= 10 && h <= 85 && s >= 0.08 && s < 0.75 && v >= 0.4) return "warmLand";
  // Ocean blue: H 180-235.
  if (h >= 180 && h <= 235 && s >= 0.12) return "oceanBlue";
  // Bright white / cyan-tinted rim: high value, low saturation.
  if (v >= 0.72 && s <= 0.18) return "brightWhite";
  return "other";
}

export const BUCKETS = ["oceanBlue", "warmLand", "brightWhite", "windWarm"];

/**
 * @param {string} file - path to PNG
 * @param {{ skipRegion?: (x,y,w,h)=>boolean }} opts
 */
export function analyzePng(file, opts = {}) {
  const buffer = fs.readFileSync(file);
  const png = PNG.sync.read(buffer);
  const { width, height, data } = png;
  const counts = { oceanBlue: 0, warmLand: 0, brightWhite: 0, windWarm: 0, other: 0, background: 0 };
  const edgeCounts = { brightWhite: 0, cyanEdge: 0, total: 0 };
  const total = width * height;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];
      if (opts.skipRegion && opts.skipRegion(x, y, width, height)) continue;
      if (isBackgroundPixel(r, g, b, a)) {
        counts.background += 1;
        continue;
      }
      const { h, s, v } = rgbToHsv(r, g, b);
      const bucket = bucketOf(h, s, v);
      counts[bucket] += 1;
    }
  }
  const analyzed = total - counts.background;
  const ratio = (label) => (analyzed > 0 ? counts[label] / analyzed : 0);
  return {
    width,
    height,
    total,
    analyzed,
    nonBackgroundRatio: analyzed / total,
    counts,
    ratio,
    report() {
      return {
        oceanBlue: ratio("oceanBlue"),
        warmLand: ratio("warmLand"),
        brightWhite: ratio("brightWhite"),
        windWarm: ratio("windWarm"),
        other: ratio("other")
      };
    }
  };
}

// Analyze only a silhouette ring around the projected globe center to assert a
// rim glow (task 5) without depending on exact brightness.
export function analyzeRing(file, opts = {}) {
  const buffer = fs.readFileSync(file);
  const png = PNG.sync.read(buffer);
  const { width, height, data } = png;
  const cx = width / 2;
  const cy = height / 2;
  const innerR = (opts.inner ?? 0.38) * Math.min(width, height) / 2;
  const outerR = (opts.outer ?? 0.5) * Math.min(width, height) / 2;
  let bright = 0;
  let cyan = 0;
  let sampled = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < innerR || d > outerR) continue;
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];
      if (a === 0) continue;
      if (isBackgroundPixel(r, g, b, a)) continue;
      sampled += 1;
      const { h, s, v } = rgbToHsv(r, g, b);
      if (v >= 0.72 && s <= 0.22) bright += 1;
      if (h >= 170 && h <= 220 && s >= 0.18 && v >= 0.55) cyan += 1;
    }
  }
  return { bright, cyan, sampled, brightRatio: sampled ? bright / sampled : 0, cyanRatio: sampled ? cyan / sampled : 0 };
}

export function resolveScreen(name) {
  return path.resolve(process.cwd(), "tests", "__screens__", name);
}
