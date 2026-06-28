#!/usr/bin/env node
// Bake label data from Natural Earth populated places (PLAN-V3 task C4).
//
// Extracts name + lon/lat + population for a curated set of labels: world
// capitals/major cities + the country label (admin-0) centroid is approximated
// from the boundary centroids file. China labels get both EN and ZH (from the
// NAME_ZH field); all others EN only. Output is a compact JSON + manifest.
//
// Usage: node scripts/labels/bake_labels.mjs --out public/assets/labels

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function hash(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function main() {
  const outDir = process.argv[process.argv.indexOf("--out") + 1] || "public/assets/labels";
  const root = path.resolve(outDir);
  const raw = path.join(root, "ne_110m_places_raw.geojson");
  if (!fs.existsSync(raw)) {
    console.error("missing raw: " + raw);
    process.exit(1);
  }
  const fc = JSON.parse(fs.readFileSync(raw, "utf8"));

  // Curate labels: major cities by population + all capitals.
  const labels = [];
  const seen = new Set();
  for (const f of fc.features) {
    const p = f.properties || {};
    const lon = f.geometry && f.geometry.coordinates ? f.geometry.coordinates[0] : p.LONGITUDE;
    const lat = f.geometry && f.geometry.coordinates ? f.geometry.coordinates[1] : p.LATITUDE;
    if (lon == null || lat == null) continue;
    const isCapital = /capital/i.test(p.FEATURECLA || "");
    const pop = p.POP_MAX || p.POP_MIN || 0;
    // Keep capitals and cities with pop > 1M (110m set is coarse).
    if (!isCapital && pop < 1000000) continue;
    const key = (p.NAMEASCII || p.NAME || "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const isChina = p.ADM0NAME === "China" || p.SOV0NAME === "China" || p.ISO_A2 === "CN";
    labels.push({
      name: p.NAMEASCII || p.NAME,
      nameZh: isChina ? p.NAME_ZH || null : null, // China cities get bilingual
      iso: p.ISO_A2 || null,
      country: p.ADM0NAME || p.SOV0NAME || null,
      lon,
      lat,
      population: pop,
      capital: isCapital ? 1 : 0
    });
  }
  // Sort by population desc so declutter can prefer big cities.
  labels.sort((a, b) => (b.population || 0) - (a.population || 0));

  const out = { kind: "city_labels", labels };
  const outPath = path.join(root, "labels-110m.json");
  fs.writeFileSync(outPath, JSON.stringify(out));
  const size = fs.statSync(outPath).size;
  const sha = hash(fs.readFileSync(outPath));
  console.log(`labels: ${labels.length} entries, ${size} bytes -> ${outPath}`);

  const manifest = {
    schemaVersion: "labels-v1",
    asset: "labels-110m.json",
    source: "Natural Earth populated places (public domain)",
    sourceUrl:
      "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_populated_places.geojson",
    scale: "1:110m",
    credit: "Natural Earth (naturalearthdata.com)",
    licenseNote: "Natural Earth is public domain. Free for any use.",
    labelCount: labels.length,
    bilingualPolicy: "China cities carry nameZh (NAME_ZH); others English only",
    fileSizeBytes: size,
    sha256: sha,
    generatedAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log("manifest written");
  // remove raw
  fs.unlinkSync(raw);
  console.log("removed raw geojson");
}

main();
