#!/usr/bin/env node
// Bake Natural Earth boundaries into compact line-segment JSON (PLAN-V3 task C3).
//
// Extracts polygon ring coordinates from the public-domain Natural Earth
// admin-0 (countries) and admin-1 (states/provinces) GeoJSON, writes a compact
// { segments: [[lon,lat],...] } JSON each, and a manifest with source/license/
// sha256. Runtime projects these onto the sphere as a single merged LineSegments.
//
// Usage: node scripts/boundaries/bake_boundaries.mjs --out public/assets/boundaries

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function hash(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

// Flatten all polygon rings (outer + holes) of a geometry into line segments.
function ringsOf(geom) {
  const out = [];
  if (geom.type === "Polygon") {
    for (const ring of geom.coordinates) out.push(ring);
  } else if (geom.type === "MultiPolygon") {
    for (const poly of geom.coordinates) for (const ring of poly) out.push(ring);
  } else if (geom.type === "LineString") {
    out.push(geom.coordinates);
  } else if (geom.type === "MultiLineString") {
    for (const ln of geom.coordinates) out.push(ln);
  }
  return out;
}

function extractSegments(fc) {
  const segs = [];
  for (const f of fc.features) {
    if (!f.geometry) continue;
    for (const ring of ringsOf(f.geometry)) {
      // ring: array of [lon,lat]; keep as-is (each is a polyline).
      segs.push(ring);
    }
  }
  return segs;
}

function main() {
  const outDir = process.argv[process.argv.indexOf("--out") + 1] || "public/assets/boundaries";
  const root = path.resolve(outDir);
  const countriesSrc = path.join(root, "ne_110m_countries_raw.geojson");
  const statesSrc = path.join(root, "ne_110m_states_raw.geojson");

  const sources = [
    {
      raw: countriesSrc,
      outName: "countries-110m.json",
      kind: "countries",
      naturalEarthName: "ne_110m_admin_0_countries",
      sourceUrl:
        "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson",
      scale: "1:110m"
    },
    {
      raw: statesSrc,
      outName: "states-110m.json",
      kind: "states_provinces",
      naturalEarthName: "ne_110m_admin_1_states_provinces",
      sourceUrl:
        "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_1_states_provinces.geojson",
      scale: "1:110m"
    }
  ];

  const manifestEntries = [];
  for (const s of sources) {
    if (!fs.existsSync(s.raw)) {
      console.error(`missing raw: ${s.raw}`);
      process.exit(1);
    }
    const fc = JSON.parse(fs.readFileSync(s.raw, "utf8"));
    const segs = extractSegments(fc);
    const compact = { kind: s.kind, segments: segs };
    const outPath = path.join(root, s.outName);
    fs.writeFileSync(outPath, JSON.stringify(compact));
    const size = fs.statSync(outPath).size;
    const sha = hash(outPath);
    console.log(`${s.kind}: ${segs.length} segments, ${size} bytes -> ${outPath}`);
    manifestEntries.push({
      kind: s.kind,
      asset: s.outName,
      naturalEarthName: s.naturalEarthName,
      source: "Natural Earth (public domain, public-domain vector)",
      sourceUrl: s.sourceUrl,
      scale: s.scale,
      credit: "Natural Earth (naturalearthdata.com)",
      licenseNote: "Natural Earth is public domain. Free for any use; no permission needed.",
      segmentCount: segs.length,
      fileSizeBytes: size,
      sha256: sha,
      generatedAt: new Date().toISOString()
    });
  }

  const manifest = {
    schemaVersion: "boundaries-v1",
    entries: manifestEntries
  };
  const mpath = path.join(root, "manifest.json");
  fs.writeFileSync(mpath, JSON.stringify(manifest, null, 2));
  console.log(`manifest -> ${mpath}`);
  // Remove the bulky raw GeoJSON (we keep only the compact segment JSON).
  for (const s of sources) {
    if (fs.existsSync(s.raw)) fs.unlinkSync(s.raw);
  }
  console.log("removed raw geojson");
}

main();
