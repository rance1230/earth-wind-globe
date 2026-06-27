#!/usr/bin/env node
// Earth asset validator (PLAN-V2.1-EARTH-MAP-EXEC-GLM5.2 task 2).
//
// Uses ONLY Node built-ins (fs, crypto, path). No npm dependency.
// Checks the earth-map-v1 manifest + its referenced texture JPEG:
//   1. texture file exists and is non-empty
//   2. real JPEG dimensions (parsed from SOF0/SOF2 marker) >= 3600x1800
//   3. actual sha256 == manifest.sha256
//   4. total asset size (texture) <= 12 MB
// Exits non-zero with a reason on any failure.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const MAX_TOTAL_MB = 12;

// Minimal JPEG dimension parser: scan for the Start-Of-Frame markers (0xFFC0
// baseline, 0xFFC2 progressive) and read height/width from the frame header.
function jpegDimensions(buf) {
  // JPEG starts with SOI 0xFFD8.
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) {
    throw new Error("not a JPEG (missing SOI 0xFFD8)");
  }
  let i = 2;
  while (i + 8 < buf.length) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1];
    // Padding fill bytes 0xFF can precede a marker; skip standalone 0xFF00.
    if (marker === 0x00 || marker === 0xff) {
      i += 2;
      continue;
    }
    // SOF markers (baseline C0, extended C1, progressive C2) carry dims.
    // Layout after marker: 2-byte length, 1-byte precision, 2-byte height,
    // 2-byte width (big-endian).
    if (marker >= 0xc0 && marker <= 0xc3) {
      const height = buf.readUInt16BE(i + 5);
      const width = buf.readUInt16BE(i + 7);
      return { width, height };
    }
    // Other markers carry a 2-byte segment length; skip past them.
    const segLen = buf.readUInt16BE(i + 2);
    if (segLen < 2) throw new Error("invalid JPEG segment length");
    i += 2 + segLen;
  }
  throw new Error("no SOF marker found in JPEG");
}

function fail(msg) {
  console.error(`EARTH ASSET VALIDATION FAILED: ${msg}`);
  process.exit(1);
}

function main() {
  const manifestPath = process.argv[2];
  if (!manifestPath) {
    console.error("usage: node scripts/earth/validate_earth_assets.mjs <manifest.json>");
    process.exit(2);
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (err) {
    fail(`cannot read manifest ${manifestPath}: ${err.message}`);
  }

  const required = ["schemaVersion", "asset", "source", "credit", "licenseNote", "dimensions", "fileSizeBytes", "sha256"];
  for (const k of required) {
    if (!(k in manifest)) fail(`manifest missing field: ${k}`);
  }
  if (manifest.schemaVersion !== "earth-map-v1") {
    fail(`unexpected schemaVersion: ${manifest.schemaVersion}`);
  }
  if (!/NASA/i.test(String(manifest.source))) {
    fail(`source must declare NASA provenance: ${manifest.source}`);
  }

  const dir = path.dirname(path.resolve(manifestPath));
  const assetPath = path.resolve(dir, manifest.asset);
  if (!fs.existsSync(assetPath)) fail(`asset file missing: ${assetPath}`);

  const buf = fs.readFileSync(assetPath);
  if (buf.length === 0) fail(`asset file is empty: ${assetPath}`);

  // 1) real JPEG dimensions
  let dims;
  try {
    dims = jpegDimensions(buf);
  } catch (err) {
    fail(`JPEG dimension parse failed: ${err.message}`);
  }

  // 2) declared dimensions match real ones, and meet the floor
  const declW = Number(manifest.dimensions.width);
  const declH = Number(manifest.dimensions.height);
  if (dims.width !== declW || dims.height !== declH) {
    fail(`dimension mismatch: JPEG ${dims.width}x${dims.height} vs manifest ${declW}x${declH}`);
  }
  if (declW < 3600 || declH < 1800) {
    fail(`dimensions ${declW}x${declH} below floor 3600x1800`);
  }

  // 3) sha256
  const hash = crypto.createHash("sha256").update(buf).digest("hex");
  if (hash !== manifest.sha256) {
    fail(`sha256 mismatch: computed ${hash} vs manifest ${manifest.sha256}`);
  }

  // 4) declared size matches real, and total <= 12 MB
  if (buf.length !== Number(manifest.fileSizeBytes)) {
    fail(`size mismatch: file ${buf.length} vs manifest ${manifest.fileSizeBytes}`);
  }
  const totalMb = buf.length / (1024 * 1024);
  if (totalMb > MAX_TOTAL_MB) {
    fail(`asset ${totalMb.toFixed(2)} MB exceeds ${MAX_TOTAL_MB} MB limit`);
  }

  console.log(`asset:    ${assetPath}`);
  console.log(`schema:   ${manifest.schemaVersion}`);
  console.log(`source:   ${manifest.source}`);
  console.log(`credit:   ${manifest.credit}`);
  console.log(`license:  ${manifest.licenseNote}`);
  console.log(`dims:     ${dims.width}x${dims.height}`);
  console.log(`size:     ${buf.length} bytes (${totalMb.toFixed(3)} MB)`);
  console.log(`sha256:   ${hash}`);
  console.log("RESULT: PASS");
  process.exit(0);
}

main();
