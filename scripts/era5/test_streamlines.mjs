#!/usr/bin/env node
// Streamline tracer self-test (PLAN-ERA5-WAZA-GLM5.2 task 5).
// Loads the real ERA5 frame, runs the tracer, and asserts:
//   - segment count matches requested count
//   - all points lie on the sphere within radius tolerance
//   - speed distribution is non-degenerate (non-zero spread, from ERA5)
// Usage: node scripts/era5/test_streamlines.mjs

import fs from "node:fs";
import path from "node:path";
import { traceWindStreamlines } from "../../src/data/era5/traceWindStreamlines.js";

const framePath = path.resolve("public/data/era5/frames/era5-10m-wind-20240115T0000Z.json");
const frame = JSON.parse(fs.readFileSync(framePath, "utf8"));
const radius = 2;
const opts = { count: 1200, points: 18, seed: 1337 };

const segs = traceWindStreamlines(frame, radius, opts);

let minR = Infinity;
let maxR = -Infinity;
let minSpeed = Infinity;
let maxSpeed = -Infinity;
let speedSum = 0;
let pointTotal = 0;
for (const s of segs) {
  for (const p of s.points) {
    const r = p.length();
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    pointTotal += 1;
  }
  if (s.speed < minSpeed) minSpeed = s.speed;
  if (s.speed > maxSpeed) maxSpeed = s.speed;
  speedSum += s.speed;
}
const meanSpeed = speedSum / segs.length;

console.log("segments:", segs.length, "(requested", opts.count + ")");
console.log("points total:", pointTotal);
console.log("radius range:", minR.toFixed(4), "-", maxR.toFixed(4), "(target", radius * 1.024 + ")");
console.log("speed range:", minSpeed.toFixed(3), "-", maxSpeed.toFixed(3), "mean", meanSpeed.toFixed(3));

// Determinism: same seed => same first segment start point.
const segs2 = traceWindStreamlines(frame, radius, opts);
const same = segs.length > 0 &&
  segs[0].points[0].x === segs2[0].points[0].x &&
  segs[0].points[0].y === segs2[0].points[0].y;
console.log("deterministic (same seed):", same);

let ok = true;
const errs = [];
if (segs.length < opts.count * 0.9) { errs.push(`segment count ${segs.length} < 90% of ${opts.count}`); ok = false; }
if (Math.abs(maxR - radius * 1.024) > 0.05 || Math.abs(minR - radius * 1.024) > 0.05) { errs.push(`radius out of tolerance: ${minR}-${maxR}`); ok = false; }
if (maxSpeed <= minSpeed) { errs.push("speed distribution degenerate"); ok = false; }
if (maxSpeed <= 0) { errs.push("speed not positive"); ok = false; }
if (!same) { errs.push("not deterministic with same seed"); ok = false; }

console.log(ok ? "RESULT: PASS" : "RESULT: FAIL");
for (const e of errs) console.log("  -", e);
process.exit(ok ? 0 : 1);
