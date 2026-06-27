#!/usr/bin/env python3
"""Fetch one ERA5 10m wind frame from ARCO-ERA5 (Google public bucket).

PLAN-ERA5-WAZA-GLM5.2 task 4. Anonymous read of the public Zarr, fixed UTC hour,
downsample to ~2deg, emit an era5-wind-frame-v1 JSON + manifest.json. No auth,
no account, no Cloud billing project required (anonymous storage).

Usage:
    .venv/bin/python scripts/era5/fetch_arco_era5_sample.py \
        --time 2024-01-15T00:00:00Z --out public/data/era5 --max-json-mb 2

Data source: gs://gcp-public-data-arco-era5/ar/full_37-1h-0p25deg-chunk-1.zarr-v3
Producer: ECMWF / Copernicus Climate Change Service (C3S)
"""

import argparse
import json
import math
import os
import sys
from datetime import datetime, timezone

import gcsfs
import numpy as np
import xarray as xr

ZARR_PATH = "gs://gcp-public-data-arco-era5/ar/full_37-1h-0p25deg-chunk-1.zarr-v3"
U_VAR = "10m_u_component_of_wind"
V_VAR = "10m_v_component_of_wind"
SCHEMA_VERSION = "era5-wind-frame-v1"

LICENSE_NOTICE = (
    "Contains modified Copernicus Climate Change Service information. "
    "ERA5 produced by ECMWF / Copernicus Climate Change Service (C3S). "
    "Neither the European Commission nor ECMWF is responsible for any use "
    "of the downstream products."
)


def parse_time(s):
    # Accept 2024-01-15T00:00:00Z or 2024-01-15T00:00:00
    s2 = s.replace("Z", "+00:00") if s.endswith("Z") else s
    dt = datetime.fromisoformat(s2)
    return dt


def percentile(a, q):
    a = a[np.isfinite(a)]
    if a.size == 0:
        return float("nan")
    return float(np.percentile(a, q))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--time", default="2024-01-15T00:00:00Z")
    ap.add_argument("--out", default="public/data/era5")
    ap.add_argument("--max-json-mb", type=float, default=2.0)
    ap.add_argument("--lon-step", type=float, default=2.0)
    ap.add_argument("--lat-step", type=float, default=2.0)
    args = ap.parse_args()

    dt = parse_time(args.time)
    print(f"[era5] target time: {dt.isoformat()}", flush=True)
    print(f"[era5] zarr: {ZARR_PATH} (anonymous)", flush=True)

    # Anonymous GCS access — no token, no account.
    fs = gcsfs.GCSFileSystem(token="anon")
    ds = xr.open_zarr(fs.get_mapper(ZARR_PATH), consolidated=True, chunks=None)

    # Select the nearest time to the requested hour.
    tsel = ds.time.sel(time=np.datetime64(dt), method="nearest")
    print(f"[era5] nearest time in dataset: {str(tsel.values)}", flush=True)

    u = ds[U_VAR].sel(time=tsel)
    v = ds[V_VAR].sel(time=tsel)
    # ARCO full_37 coords: longitude 0..360 (or named), latitude 90..-90.
    # Normalize to lon -180..180, lat -90..90.
    lon = u["longitude"].values
    lat = u["latitude"].values

    u_np = u.values.astype(np.float32)
    v_np = v.values.astype(np.float32)

    # Convert longitude to [-180, 180) if stored as [0, 360).
    if float(lon.min()) >= 0 and float(lon.max()) > 180:
        # roll so that 180 -> -180
        shift = np.argmax(lon >= 180.0)
        lon = ((lon + 180.0) % 360.0) - 180.0
        u_np = np.roll(u_np, shift, axis=1)
        v_np = np.roll(v_np, shift, axis=1)
        order = np.argsort(lon)
        lon = lon[order]
        u_np = u_np[:, order]
        v_np = v_np[:, order]

    # Ensure latitude ascending (-90..90) for clean indexing.
    if float(lat[0]) > float(lat[-1]):
        lat = lat[::-1]
        u_np = u_np[::-1, :]
        v_np = v_np[::-1, :]

    # Downsample by striding toward ~lon_step / lat_step deg.
    lon0, lon1 = float(lon.min()), float(lon.max())
    lat0, lat1 = float(lat.min()), float(lat.max())
    lon_stride = max(1, int(round(args.lon_step / max(1e-6, (lon1 - lon0) / (len(lon) - 1)))))
    lat_stride = max(1, int(round(args.lat_step / max(1e-6, (lat1 - lat0) / (len(lat) - 1)))))
    u_ds = u_np[::lat_stride, ::lon_stride]
    v_ds = v_np[::lat_stride, ::lon_stride]
    lon_ds = lon[::lon_stride]
    lat_ds = lat[::lat_stride]

    h, w = u_ds.shape
    speed = np.hypot(u_ds, v_ds)
    finite = speed[np.isfinite(speed)]
    if finite.size == 0:
        print("[era5] ERROR: no finite wind values after selection", file=sys.stderr)
        sys.exit(1)

    speed_stats = {
        "min": round(float(finite.min()), 4),
        "max": round(float(finite.max()), 4),
        "mean": round(float(finite.mean()), 4),
        "p5": round(percentile(finite, 5), 4),
        "p95": round(percentile(finite, 95), 4),
    }
    print(f"[era5] grid {w}x{h} lon[{lon_ds.min():.1f},{lon_ds.max():.1f}] "
          f"lat[{lat_ds.min():.1f},{lat_ds.max():.1f}]", flush=True)
    print(f"[era5] speedStats {speed_stats}", flush=True)

    u_list = [round(float(x), 3) for x in u_ds.ravel()]
    v_list = [round(float(x), 3) for x in v_ds.ravel()]

    # Compute the UTC time tag up front (keep UTC, never convert to local zone).
    utc_dt = dt.astimezone(timezone.utc).replace(tzinfo=None) if dt.tzinfo else dt
    time_utc_str = utc_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

    frame = {
        "schemaVersion": SCHEMA_VERSION,
        "source": "ERA5 ARCO on Google Cloud Public Datasets",
        "producer": "ECMWF / Copernicus Climate Change Service",
        "access": "Google Cloud Public Datasets (anonymous)",
        "variables": [U_VAR, V_VAR],
        "units": "m s**-1",
        "timeUtc": time_utc_str,
        "grid": {
            "lon": [round(float(lon_ds.min()), 2), round(float(lon_ds.max()), 2)],
            "lat": [round(float(lat_ds.min()), 2), round(float(lat_ds.max()), 2)],
            "lonStep": round(float((lon1 - lon0) / max(1, len(lon) - 1) * lon_stride), 3),
            "latStep": round(float((lat1 - lat0) / max(1, len(lat) - 1) * lat_stride), 3),
            "width": int(w),
            "height": int(h),
            "downsampled": True,
            "lonOrder": "ascending",
            "latOrder": "ascending"
        },
        "u": u_list,
        "v": v_list,
        "speedStats": speed_stats,
        "preprocess": {
            "downsample": f"stride lon={lon_stride} lat={lat_stride} (~{args.lon_step}deg/~{args.lat_step}deg)",
            "source": ZARR_PATH,
            "command": f"python scripts/era5/fetch_arco_era5_sample.py --time {args.time} --out {args.out}"
        },
        "licenseNotice": LICENSE_NOTICE
    }

    os.makedirs(os.path.join(args.out, "frames"), exist_ok=True)
    frame_name = f"era5-10m-wind-{utc_dt.strftime('%Y%m%dT%H%MZ')}.json"
    frame_path = os.path.join(args.out, "frames", frame_name)
    with open(frame_path, "w") as f:
        json.dump(frame, f)
    size_mb = os.path.getsize(frame_path) / (1024 * 1024)
    print(f"[era5] wrote frame {frame_path} ({size_mb:.3f} MB)", flush=True)
    if size_mb > args.max_json_mb:
        print(f"[era5] WARNING: frame {size_mb:.3f} MB exceeds limit {args.max_json_mb} MB",
              file=sys.stderr)

    manifest = {
        "schemaVersion": SCHEMA_VERSION,
        "frame": f"frames/{frame_name}",
        "timeUtc": time_utc_str,
        "source": frame["source"],
        "producer": frame["producer"],
        "licenseNotice": LICENSE_NOTICE
    }
    manifest_path = os.path.join(args.out, "manifest.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"[era5] wrote manifest {manifest_path}", flush=True)
    print("[era5] done", flush=True)


if __name__ == "__main__":
    main()
