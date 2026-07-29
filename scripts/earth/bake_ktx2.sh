#!/usr/bin/env bash
# Bake High-tier earth textures to KTX2 (Basis ETC1S) for smaller download size.
# Requires: basisu (brew install basis_universal)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
OUT="public/assets/earth/ktx2"
mkdir -p "$OUT" public/basis

if ! command -v basisu >/dev/null 2>&1; then
  echo "basisu not found. Install with: brew install basis_universal" >&2
  exit 1
fi

# Keep transcoder in sync with three.js
cp -f node_modules/three/examples/jsm/libs/basis/basis_transcoder.js public/basis/
cp -f node_modules/three/examples/jsm/libs/basis/basis_transcoder.wasm public/basis/

echo "[ktx2] albedo 8K ETC1S..."
basisu -ktx2 -q 192 -mipmap \
  -output_file "$OUT/blue-marble-8192x4096.ktx2" \
  public/assets/earth/blue-marble-8192x4096.jpg

echo "[ktx2] normal 2880 linear..."
basisu -ktx2 -q 200 -mipmap -linear \
  -output_file "$OUT/etopo1-normalmap-2880x1440.ktx2" \
  public/assets/earth/etopo1-normalmap-2880x1440.png

echo "[ktx2] height 2880 linear (optional; runtime may still use PNG for displacement)..."
basisu -ktx2 -q 180 -mipmap -linear \
  -output_file "$OUT/etopo1-heightmap-2880x1440.ktx2" \
  public/assets/earth/etopo1-heightmap-2880x1440.png

echo "[ktx2] clouds..."
basisu -ktx2 -q 180 -mipmap \
  -output_file "$OUT/clouds-2048x1024.ktx2" \
  public/assets/earth/clouds-2048x1024.png

ls -lh "$OUT"
echo "[ktx2] done"
