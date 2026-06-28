#!/usr/bin/env python3
"""Bake a low-res displacement heightmap from ETOPO1 (PLAN-V3 task C2).

Reads the ETOPO1 Ice surface netCDF (public domain, NOAA NCEI), downsample to a
small equirectangular heightmap PNG for Three.js displacement. Only positive
elevation (land) is used for displacement gain; bathymetry is clamped to 0 so the
ocean stays a smooth sphere. The final PNG is ~tens-of-KB (well under the 12 MB
asset cap). The 395 MB source lives in /tmp and is never committed.

Usage:
    .venv/bin/python scripts/earth/bake_etopo_heightmap.py \
        --src /tmp/etopo1.grd.gz --out public/assets/earth --width 720 --height 360
"""

import argparse
import gzip
import hashlib
import json
import os
import shutil
from datetime import datetime, timezone

import numpy as np
from PIL import Image


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--out", default="public/assets/earth")
    ap.add_argument("--width", type=int, default=720)
    ap.add_argument("--height", type=int, default=360)
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    # Decompress to a temp .nc in /tmp (the source is gzipped netCDF3).
    nc_path = args.src
    if nc_path.endswith(".gz"):
        nc_path = nc_path[:-3]
        if not os.path.exists(nc_path):
            print(f"[etopo] decompressing {args.src} -> {nc_path}", flush=True)
            with gzip.open(args.src, "rb") as f_in, open(nc_path, "wb") as f_out:
                shutil.copyfileobj(f_in, f_out)

    import netCDF4

    print(f"[etopo] reading {nc_path}", flush=True)
    ds = netCDF4.Dataset(nc_path)
    # ETOPO1 grid-registered GMT4: variable 'z', dims (y, x) = (10801, 21601).
    z = ds.variables["z"][:]
    print(f"[etopo] raw grid {z.shape} min {float(np.nanmin(z))} max {float(np.nanmax(z))}", flush=True)

    # ETOPO1 grid-registered: rows go N->S? GMT4 'z' is row-major, latitude
    # decreasing. Downsample by block-mean to target height.
    H, W = z.shape
    th, tw = args.height, args.width
    by = H // th
    bx = W // tw
    small = np.zeros((th, tw), dtype=np.float32)
    for j in range(th):
        for i in range(tw):
            block = z[j * by:(j + 1) * by, i * bx:(i + 1) * bx]
            small[j, i] = np.nanmean(block)

    # Land-only displacement: clamp negative (bathymetry) to 0 so the ocean is a
    # smooth sphere; keep positive elevation normalized 0..255 by a sensible cap
    # (max land ~ 6000 m -> use 6000 as the gain ceiling).
    land = np.clip(small, 0, None)
    cap = 6000.0
    norm = np.clip(land / cap, 0.0, 1.0)
    img8 = (norm * 255.0).astype(np.uint8)

    fname = f"etopo1-heightmap-{tw}x{th}.png"
    path = os.path.join(args.out, fname)
    Image.fromarray(img8, mode="L").save(path, optimize=True)
    size = os.path.getsize(path)
    sha = hashlib.sha256(open(path, "rb").read()).hexdigest()
    print(f"[etopo] wrote {path} ({size} bytes)", flush=True)

    manifest = {
        "schemaVersion": "earth-heightmap-v1",
        "asset": fname,
        "source": "NOAA NCEI ETOPO1 Ice surface (1 arc-minute global relief, public domain)",
        "sourceUrl": "https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO1/data/ice_surface/grid_registered/netcdf/ETOPO1_Ice_g_gmt4.grd.gz",
        "credit": "NOAA National Centers for Environmental Information (NCEI)",
        "licenseNote": "ETOPO1 is a public-domain NOAA product. Credit: NOAA NCEI.",
        "dimensions": {"width": tw, "height": th},
        "units": "normalized land elevation 0..255 (bathymetry clamped to 0, cap 6000m)",
        "preprocess": {"downsample": f"block-mean {tw}x{th}", "landOnly": True, "capMeters": cap},
        "fileSizeBytes": size,
        "sha256": sha,
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    mpath = os.path.join(args.out, "heightmap-manifest.json")
    open(mpath, "w").write(json.dumps(manifest, indent=2))
    print(f"[etopo] wrote manifest {mpath}", flush=True)
    print("[etopo] done", flush=True)


if __name__ == "__main__":
    main()
