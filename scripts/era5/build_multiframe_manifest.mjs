#!/usr/bin/env node
// Rebuild the ERA5 manifest as a multi-frame time-series (PLAN-V3 B1).
// Scans public/data/era5/frames/*.json, reads each frame's timeUtc, and emits a
// manifest with both `frame` (default/first, back-compat) and `frames` (sorted
// time-ordered list). Keeps the loader's single-frame path working while B2
// adds series playback.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("public/data/era5");
const framesDir = path.join(root, "frames");
const files = fs.readdirSync(framesDir).filter((f) => f.endsWith(".json"));
const frames = [];
for (const f of files) {
  const data = JSON.parse(fs.readFileSync(path.join(framesDir, f), "utf8"));
  frames.push({
    file: `frames/${f}`,
    timeUtc: data.timeUtc,
    source: data.source,
    producer: data.producer,
    access: data.access,
    variables: data.variables,
    units: data.units,
    speedStats: data.speedStats
  });
}
// Sort by time.
frames.sort((a, b) => (a.timeUtc < b.timeUtc ? -1 : a.timeUtc > b.timeUtc ? 1 : 0));

const manifest = {
  schemaVersion: "era5-wind-series-v1",
  // Back-compat: default frame (first in series).
  frame: frames[0].file,
  timeUtc: frames[0].timeUtc,
  frameCount: frames.length,
  frames,
  source: frames[0].source,
  producer: frames[0].producer,
  access: frames[0].access,
  licenseNotice:
    "Contains modified Copernicus Climate Change Service information. ERA5 produced by ECMWF / Copernicus Climate Change Service (C3S). Neither the European Commission nor ECMWF is responsible for any use of the downstream products."
};
fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`manifest: ${frames.length} frames -> ${path.join(root, "manifest.json")}`);
for (const fr of frames) console.log(`  ${fr.timeUtc}  speedStats.mean=${fr.speedStats.mean}`);
