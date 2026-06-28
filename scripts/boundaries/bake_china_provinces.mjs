#!/usr/bin/env node
// Bake China province boundaries from Natural Earth 10m admin-1 (PLAN-V3 fix C).
//
// Reads the public-domain NE 10m admin-1 GeoJSON, filters China provinces
// (admin=="China" / adm0_a3=="CHN"), extracts polygon rings, writes a compact
// { kind, segments } JSON + manifest entry. China has bilingual province names
// (name + name_zh) in NE 10m. The source file (~40MB) lives in /tmp and is never
// committed; the output is tiny.
//
// Usage: node scripts/boundaries/bake_china_provinces.mjs --src /tmp/ne_10m_admin1.geojson --out public/assets/boundaries

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function ringsOf(geom) {
  const out = [];
  if (geom.type === "Polygon") for (const ring of geom.coordinates) out.push(ring);
  else if (geom.type === "MultiPolygon") for (const poly of geom.coordinates) for (const ring of poly) out.push(ring);
  return out;
}

const args = process.argv.slice(2);
const src = args[args.indexOf("--src") + 1];
const outDir = args[args.indexOf("--out") + 1] || "public/assets/boundaries";
const root = path.resolve(outDir);
const fc = JSON.parse(fs.readFileSync(src, "utf8"));

const china = fc.features.filter(
  (f) => f.properties && (f.properties.admin === "China" || f.properties.adm0_a3 === "CHN")
);
const segments = [];
const provinces = [];
for (const f of china) {
  const p = f.properties || {};
  const rings = ringsOf(f.geometry || {});
  for (const ring of rings) segments.push(ring);
  provinces.push({ name: p.name, nameZh: p.name_zh || p.name_zht || null });
}

const out = { kind: "china_provinces", segments, provinces };
const outPath = path.join(root, "china-provinces-10m.json");
fs.writeFileSync(outPath, JSON.stringify(out));
const size = fs.statSync(outPath).size;
const sha = crypto.createHash("sha256").update(fs.readFileSync(outPath)).digest("hex");
console.log(
  `china provinces: ${china.length} features, ${segments.length} segments, ${size} bytes -> ${outPath}`
);
provinces.slice(0, 8).forEach((p) => console.log(`  ${p.name} / ${p.nameZh}`));

// Append a manifest entry into the boundaries manifest.
const mpath = path.join(root, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(mpath, "utf8"));
const entry = {
  kind: "china_provinces",
  asset: "china-provinces-10m.json",
  naturalEarthName: "ne_10m_admin_1_states_provinces",
  source: "Natural Earth 10m admin-1 (public domain, China subset)",
  sourceUrl:
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson",
  scale: "1:10m",
  credit: "Natural Earth (naturalearthdata.com)",
  licenseNote: "Natural Earth is public domain. Free for any use; no permission needed.",
  segmentCount: segments.length,
  provinceCount: china.length,
  bilingualPolicy: "China provinces carry nameZh (name_zh) where available",
  fileSizeBytes: size,
  sha256: sha,
  generatedAt: new Date().toISOString()
};
manifest.entries = (manifest.entries || []).filter((e) => e.kind !== "china_provinces");
manifest.entries.push(entry);
fs.writeFileSync(mpath, JSON.stringify(manifest, null, 2));
console.log("manifest updated");
