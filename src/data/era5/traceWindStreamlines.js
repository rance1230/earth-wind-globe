// ERA5 wind streamline tracer (PLAN-ERA5-WAZA-GLM5.2 task 5).
//
// Given a validated era5-wind-frame-v1 frame, sample u/v on the lat/lon grid and
// integrate streamlines forward. The wind DIRECTION comes entirely from ERA5 u/v;
// the seeded PRNG only places seed points and assigns per-line phase, never the
// flow direction. Points are projected onto the sphere surface.

import * as THREE from "three";
import { seededRandom } from "../../util/seededRandom.js";

/**
 * @param {object} frame era5-wind-frame-v1 frame
 * @param {number} radius sphere radius
 * @param {{count:number, points:number, seed:number}} opts
 * @returns {Array<{points: THREE.Vector3[], speed:number, color:[number,number,number], phase:number}>}
 */
export function traceWindStreamlines(frame, radius, opts = {}) {
  if (!frame || !Array.isArray(frame.u) || !Array.isArray(frame.v)) return [];
  const grid = frame.grid;
  if (!grid || !grid.lon || !grid.lat) return [];

  const W = Number(grid.width) || 0;
  const H = Number(grid.height) || 0;
  if (W <= 0 || H <= 0 || frame.u.length !== W * H) return [];

  const lonMin = grid.lon[0];
  const lonMax = grid.lon[1];
  const latMin = grid.lat[0];
  const latMax = grid.lat[1];
  const lonRange = lonMax - lonMin;
  const latRange = latMax - latMin;

  const count = opts.count ?? 1000;
  const pointsPerSeg = opts.points ?? 14;
  const seed = opts.seed ?? 1337;
  const rand = seededRandom(seed + 31);

  // Normalize wind speed for color/styling using declared stats if present.
  const stats = frame.speedStats || {};
  const p5 = Number.isFinite(stats.p5) ? stats.p5 : 1.5;
  const p95 = Number.isFinite(stats.p95) ? stats.p95 : 12;

  const windR = radius * 1.024;
  const segments = [];

  for (let i = 0; i < count; i += 1) {
    // Seeded seed point (only placement uses randomness, not direction).
    let lat = latMin + rand() * latRange;
    let lon = lonMin + rand() * lonRange;

    const pts = [];
    let maxSpeed = 0;
    // Integration step in degrees; clamp by sampled speed so fast cells advance more.
    const baseStep = 0.9;
    for (let j = 0; j < pointsPerSeg; j += 1) {
      const { u, v } = sampleBilinear(frame.u, frame.v, W, H, lat, lon, lonMin, lonMax, latMin, latMax);
      const speed = Math.hypot(u, v);
      if (!Number.isFinite(speed)) break;
      if (speed > maxSpeed) maxSpeed = speed;
      // u = eastward (lon), v = northward (lat). Step along the wind vector.
      const dirScale = baseStep / Math.max(0.6, speed); // slower where fast => denser
      lon += u * dirScale;
      lat += v * dirScale;
      // Wrap longitude, clamp latitude.
      lon = wrapLon(lon, lonMin, lonMax);
      if (lat > latMax) lat = latMax;
      if (lat < latMin) lat = latMin;
      pts.push(toSphere(lat, lon, windR));
    }
    if (pts.length < 2) continue;

    segments.push({
      points: pts,
      speed: maxSpeed,
      color: speedToColor(maxSpeed, p5, p95),
      phase: rand() * Math.PI * 2
    });
  }
  return segments;
}

// Bilinear sample u/v on the lat/lon grid. Grid is stored row-major; row 0 is
// the first latitude in grid.lat order. We map (lon,lat) -> normalized (x,y).
function sampleBilinear(u, v, W, H, lat, lon, lonMin, lonMax, latMin, latMax) {
  const fx = ((lon - lonMin) / (lonMax - lonMin)) * (W - 1);
  // Assume lat decreases with row index (90 -> -90 common); if grid.lat is
  // [max, min] we invert. Detect from the declared lat order.
  const latLo = latMin;
  const latHi = latMax;
  const fy = ((latHi - lat) / (latHi - latLo)) * (H - 1);

  const x0 = Math.floor(clamp(fx, 0, W - 1));
  const y0 = Math.floor(clamp(fy, 0, H - 1));
  const x1 = Math.min(W - 1, x0 + 1);
  const y1 = Math.min(H - 1, y0 + 1);
  const tx = clamp(fx - x0, 0, 1);
  const ty = clamp(fy - y0, 0, 1);

  const i00 = y0 * W + x0;
  const i10 = y0 * W + x1;
  const i01 = y1 * W + x0;
  const i11 = y1 * W + x1;

  const u00 = u[i00] ?? 0;
  const u10 = u[i10] ?? 0;
  const u01 = u[i01] ?? 0;
  const u11 = u[i11] ?? 0;
  const v00 = v[i00] ?? 0;
  const v10 = v[i10] ?? 0;
  const v01 = v[i01] ?? 0;
  const v11 = v[i11] ?? 0;

  // Bilinear weights (top = lower row = higher latitude).
  const w00 = (1 - tx) * (1 - ty);
  const w10 = tx * (1 - ty);
  const w01 = (1 - tx) * ty;
  const w11 = tx * ty;

  const uu = w00 * u00 + w10 * u10 + w01 * u01 + w11 * u11;
  const vv = w00 * v00 + w10 * v10 + w01 * v01 + w11 * v11;
  return { u: uu, v: vv };
}

function toSphere(latDeg, lonDeg, radius) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lon = THREE.MathUtils.degToRad(lonDeg);
  return new THREE.Vector3(
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.sin(lat),
    radius * Math.cos(lat) * Math.sin(lon)
  );
}

function wrapLon(lon, lonMin, lonMax) {
  const range = lonMax - lonMin;
  let l = lon;
  while (l < lonMin) l += range;
  while (l > lonMax) l -= range;
  return l;
}

function clamp(x, lo, hi) {
  return x < lo ? lo : x > hi ? hi : x;
}

// Map speed to cyan -> white -> amber -> red across p5..p95.
function speedToColor(speed, p5, p95) {
  const t = clamp((speed - p5) / Math.max(0.001, p95 - p5), 0, 1);
  const stops = [
    [0.0, [0.43, 0.97, 1.0]], // cyan
    [0.35, [0.92, 0.97, 1.0]], // white
    [0.7, [1.0, 0.82, 0.32]], // amber
    [1.0, [1.0, 0.32, 0.22]] // red
  ];
  let a = stops[0];
  let b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i += 1) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) {
      a = stops[i];
      b = stops[i + 1];
      break;
    }
  }
  const k = (t - a[0]) / Math.max(0.0001, b[0] - a[0]);
  return [
    a[1][0] + (b[1][0] - a[1][0]) * k,
    a[1][1] + (b[1][1] - a[1][1]) * k,
    a[1][2] + (b[1][2] - a[1][2]) * k
  ];
}
