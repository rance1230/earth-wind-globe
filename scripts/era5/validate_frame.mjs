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

function loadTargets(argPath) {
  const raw = fs.readFileSync(argPath, "utf8");
  const parsed = JSON.parse(raw);
  const dir = path.dirname(path.resolve(argPath));
  const targets = [];
  // Multi-frame series manifest (B1): validate every frame.
  if (parsed && Array.isArray(parsed.frames) && parsed.frames.length > 0 && !Array.isArray(parsed.u)) {
    for (const fr of parsed.frames) {
      const fp = path.resolve(dir, fr.file);
      targets.push({ frame: JSON.parse(fs.readFileSync(fp, "utf8")), source: fp });
    }
    return targets;
  }
  // Single-frame manifest: pointer + no `u` array.
  if (parsed && typeof parsed === "object" && parsed.frame && !Array.isArray(parsed.u)) {
    const framePath = path.resolve(dir, parsed.frame);
    return [{ frame: JSON.parse(fs.readFileSync(framePath, "utf8")), source: framePath }];
  }
  // A direct frame JSON.
  return [{ frame: parsed, source: path.resolve(argPath) }];
}

function main() {
  const argPath = process.argv[2];
  if (!argPath) {
    console.error("usage: node scripts/era5/validate_frame.mjs <manifest-or-frame.json>");
    process.exit(2);
  }
  let targets;
  try {
    targets = loadTargets(argPath);
  } catch (err) {
    console.error(`failed to load ${argPath}: ${err.message}`);
    process.exit(2);
  }
  let allOk = true;
  for (const { frame, source } of targets) {
    const { ok, errors, stats } = validateEra5WindFrame(frame);
    console.log(`frame: ${source}`);
    console.log(`schemaVersion: ${frame.schemaVersion}`);
    console.log(`timeUtc: ${frame.timeUtc}`);
    console.log(`declared speedStats: ${JSON.stringify(frame.speedStats)}`);
    console.log(`recomputed stats: ${JSON.stringify(stats)}`);
    if (ok) {
      console.log("RESULT: VALID");
    } else {
      console.log("RESULT: INVALID");
      for (const e of errors) console.log(`  - ${e}`);
      allOk = false;
    }
  }
  process.exit(allOk ? 0 : 1);
}

main();
