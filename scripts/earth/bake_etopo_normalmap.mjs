#!/usr/bin/env node
// Bake a normal map from the ETOPO1 heightmap (PLAN-V3 fix B-2).
//
// Reads the existing land-only ETOPO1 heightmap PNG, computes per-pixel surface
// normals via a Sobel gradient, writes an RGB normal map (tangent-space, +Y up)
// that MeshStandardMaterial.normalMap consumes to add fine surface relief when
// zoomed in (without needing a higher-resolution color texture).
//
// Usage: node scripts/earth/bake_etopo_normalmap.mjs --src public/assets/earth/etopo1-heightmap-720x360.png --out public/assets/earth

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PNG } from "../../node_modules/pngjs/lib/png.js";

const args = process.argv.slice(2);
const src = args[args.indexOf("--src") + 1];
const outDir = args[args.indexOf("--out") + 1] || "public/assets/earth";
const root = path.resolve(outDir);

const png = PNG.sync.read(fs.readFileSync(src));
const { width: W, height: H, data } = png;
// Height as grayscale 0..1 from the red channel.
const h = new Float32Array(W * H);
for (let i = 0; i < W * H; i += 1) h[i] = data[i * 4] / 255;

const out = Buffer.alloc(W * H * 4);
// Sobel strength; tuned so relief reads but doesn't look fake.
const strength = 2.4;
for (let y = 0; y < H; y += 1) {
  for (let x = 0; x < W; x += 1) {
    const xm = (x - 1 + W) % W; // wrap longitude
    const xp = (x + 1) % W;
    const ym = Math.max(0, y - 1);
    const yp = Math.min(H - 1, y + 1);
    const gx =
      -h[ym * W + xm] - 2 * h[y * W + xm] - h[yp * W + xm] +
      h[ym * W + xp] + 2 * h[y * W + xp] + h[yp * W + xp];
    const gy =
      -h[ym * W + xm] - 2 * h[ym * W + x] - h[ym * W + xp] +
      h[yp * W + xm] + 2 * h[yp * W + x] + h[yp * W + xp];
    let nx = -gx * strength;
    let ny = -gy * strength;
    let nz = 1.0;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    const o = (y * W + x) * 4;
    out[o] = Math.round((nx * 0.5 + 0.5) * 255);
    out[o + 1] = Math.round((ny * 0.5 + 0.5) * 255);
    out[o + 2] = Math.round((nz * 0.5 + 0.5) * 255);
    out[o + 3] = 255;
  }
}
const outPng = new PNG({ width: W, height: H });
outPng.data = out;
const fname = "etopo1-normalmap-720x360.png";
const outPath = path.join(root, fname);
fs.writeFileSync(outPath, PNG.sync.write(outPng));
const size = fs.statSync(outPath).size;
const sha = crypto.createHash("sha256").update(fs.readFileSync(outPath)).digest("hex");
console.log(`normalmap: ${W}x${H}, ${size} bytes -> ${outPath}`);

const manifest = {
  schemaVersion: "earth-normalmap-v1",
  asset: fname,
  source: "Derived from NOAA NCEI ETOPO1 Ice heightmap (public domain)",
  sourceUrl:
    "https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO1/data/ice_surface/grid_registered/netcdf/ETOPO1_Ice_g_gmt4.grd.gz",
  credit: "NOAA National Centers for Environmental Information (NCEI)",
  licenseNote: "ETOPO1 is a public-domain NOAA product. Credit: NOAA NCEI.",
  dimensions: { width: W, height: H },
  preprocess: { algorithm: "Sobel gradient from land-only heightmap", strength },
  fileSizeBytes: size,
  sha256: sha,
  generatedAt: new Date().toISOString()
};
fs.writeFileSync(path.join(root, "normalmap-manifest.json"), JSON.stringify(manifest, null, 2));
console.log("manifest written");
