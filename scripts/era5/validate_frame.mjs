#!/usr/bin/env node
// ERA5 frame validator CLI (PLAN-ERA5-WAZA-GLM5.2 task 4).
//
// Usage: node scripts/era5/validate_frame.mjs <manifest-or-frame.json>
//
// Loads a manifest.json (reads its `frame` path) OR a frame JSON directly,
// runs the shared validator, recomputes speedStats, and prints a report.
// Exits non-zero on invalid frames. No network, no auth.

import fs from "node:fs";
import path from "node:path";
import { validateEra5WindFrame } from "../../src/data/era5/validateEra5WindFrame.js";

function loadTarget(argPath) {
  const raw = fs.readFileSync(argPath, "utf8");
  const parsed = JSON.parse(raw);
  // A manifest has a `frame` pointer and the data arrays (`u`/`v`) are absent.
  // A frame has the `u` array directly. Detect manifest by pointer + no `u`.
  if (parsed && typeof parsed === "object" && parsed.frame && !Array.isArray(parsed.u)) {
    const dir = path.dirname(path.resolve(argPath));
    const framePath = path.resolve(dir, parsed.frame);
    return { frame: JSON.parse(fs.readFileSync(framePath, "utf8")), source: framePath };
  }
  return { frame: parsed, source: path.resolve(argPath) };
}

function main() {
  const argPath = process.argv[2];
  if (!argPath) {
    console.error("usage: node scripts/era5/validate_frame.mjs <manifest-or-frame.json>");
    process.exit(2);
  }
  let target;
  try {
    target = loadTarget(argPath);
  } catch (err) {
    console.error(`failed to load ${argPath}: ${err.message}`);
    process.exit(2);
  }
  const { frame, source } = target;
  const { ok, errors, stats } = validateEra5WindFrame(frame);

  console.log(`frame: ${source}`);
  console.log(`schemaVersion: ${frame.schemaVersion}`);
  console.log(`source: ${frame.source}`);
  console.log(`producer: ${frame.producer}`);
  console.log(`timeUtc: ${frame.timeUtc}`);
  console.log(`grid: ${JSON.stringify(frame.grid)}`);
  console.log(`declared speedStats: ${JSON.stringify(frame.speedStats)}`);
  console.log(`recomputed stats: ${JSON.stringify(stats)}`);
  if (ok) {
    console.log("RESULT: VALID");
    process.exit(0);
  } else {
    console.log("RESULT: INVALID");
    for (const e of errors) console.log(`  - ${e}`);
    process.exit(1);
  }
}

main();
