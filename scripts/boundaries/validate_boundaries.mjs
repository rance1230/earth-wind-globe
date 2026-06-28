#!/usr/bin/env node
// Boundaries asset validator (PLAN-V3 task C3). Node built-ins only.
// Checks the boundaries-v1 manifest + referenced segment JSON:
//   1. each asset exists, non-empty
//   2. valid JSON with a segments array, count > 0
//   3. declared sha256 == actual
//   4. total asset size <= 12 MB
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const MAX_MB = 12;
function fail(m) { console.error("BOUNDARIES FAILED: " + m); process.exit(1); }

const manifestPath = process.argv[2];
if (!manifestPath) { console.error("usage: validate_boundaries.mjs <manifest.json>"); process.exit(2); }
const dir = path.dirname(path.resolve(manifestPath));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (manifest.schemaVersion !== "boundaries-v1") fail("schemaVersion " + manifest.schemaVersion);
if (!Array.isArray(manifest.entries) || manifest.entries.length === 0) fail("no entries");

let total = 0;
for (const e of manifest.entries) {
  for (const k of ["kind", "asset", "source", "credit", "licenseNote", "fileSizeBytes", "sha256"]) {
    if (!(k in e)) fail(`entry ${e.kind || "?"} missing ${k}`);
  }
  const ap = path.resolve(dir, e.asset);
  if (!fs.existsSync(ap)) fail(`asset missing: ${ap}`);
  const buf = fs.readFileSync(ap);
  if (buf.length === 0) fail(`empty asset: ${ap}`);
  const data = JSON.parse(buf.toString("utf8"));
  if (!Array.isArray(data.segments) || data.segments.length === 0) fail(`no segments in ${e.asset}`);
  const sha = crypto.createHash("sha256").update(buf).digest("hex");
  if (sha !== e.sha256) fail(`sha256 mismatch ${e.asset}`);
  if (buf.length !== Number(e.fileSizeBytes)) fail(`size mismatch ${e.asset}`);
  total += buf.length;
  console.log(`${e.kind}: ${data.segments.length} segments, ${buf.length} bytes, sha256 ok`);
}
if (total / (1024 * 1024) > MAX_MB) fail(`total ${total} exceeds ${MAX_MB}MB`);
console.log(`RESULT: PASS (total ${total} bytes)`);
process.exit(0);
