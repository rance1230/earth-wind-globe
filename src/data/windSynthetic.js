import * as THREE from "three";
import { seededRandom } from "../util/seededRandom.js";

// Synthetic wind streamline data (PLAN-GLM5.2 §4.4 deterministic, task 3).
//
// Seeded PRNG keeps screenshots/playwright stable. A handful of vortex centers
// give the streamlines curvature so they read as wind rather than straight
// lines. Each segment carries a speed->color so the layer can write per-vertex
// colors (cyan -> pale yellow -> red) in a single merged geometry.
//
// Contract: { segments: [{ points: Vec3[], speed, phase, color: [r,g,b] }] }
export function syntheticWind(radius, opts = {}) {
  const count = opts.count ?? 1000;
  const pointsPerSeg = opts.points ?? 14;
  const seed = opts.seed ?? 1337;
  const rand = seededRandom(seed);

  // 3 vortex centers scattered over the globe — streamlines curl around them.
  const vortices = [
    { lat: 18, lon: -40, strength: 1.0 },
    { lat: -28, lon: 95, strength: 0.85 },
    { lat: 42, lon: 150, strength: 0.7 }
  ].map((v) => ({ ...v, pos: toVec(v.lat, v.lon, radius * 1.024) }));

  const segments = [];
  for (let i = 0; i < count; i += 1) {
    const lat = -70 + rand() * 140; // -70..70
    const lon = rand() * 360 - 180;
    const speed = 0.25 + rand() * 0.95; // 0.25..1.2

    const points = [];
    let cur = toVec(lat, lon, radius * 1.024);
    let dir = randomTangent(cur, rand);
    const step = radius * 0.018;
    for (let j = 0; j < pointsPerSeg; j += 1) {
      // Add curl from each nearby vortex so the line bends.
      let curl = new THREE.Vector3();
      for (const v of vortices) {
        const toCenter = v.pos.clone().sub(cur);
        const dist = toCenter.length();
        if (dist < radius * 0.9) {
          const axis = cur.clone().normalize(); // tangent around sphere normal
          const tangentCurl = new THREE.Vector3().crossVectors(axis, toCenter).normalize();
          curl.add(tangentCurl.multiplyScalar(v.strength * 0.06 / (1 + dist * 1.5)));
        }
      }
      dir.add(curl).normalize();
      // Project movement onto the sphere tangent plane.
      const normal = cur.clone().normalize();
      dir.projectOnPlane(normal).normalize();
      cur = cur.clone().add(dir.clone().multiplyScalar(step));
      // Re-project onto the sphere surface.
      cur.setLength(radius * 1.024);
      points.push(cur.clone());
    }

    segments.push({
      points,
      speed,
      phase: rand() * Math.PI * 2,
      color: speedToColor(speed)
    });
  }
  return segments;
}

function toVec(latDeg, lonDeg, radius) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lon = THREE.MathUtils.degToRad(lonDeg);
  return new THREE.Vector3(
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.sin(lat),
    radius * Math.cos(lat) * Math.sin(lon)
  );
}

function randomTangent(point, rand) {
  const normal = point.clone().normalize();
  const helper = Math.abs(normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  return new THREE.Vector3().crossVectors(normal, helper).normalize().applyAxisAngle(normal, rand() * Math.PI * 2);
}

// Map normalized speed (0..1+) to cyan -> pale yellow -> red.
function speedToColor(speed) {
  const t = Math.min(1, Math.max(0, (speed - 0.25) / 0.95));
  let r, g, b;
  if (t < 0.5) {
    // cyan (0.43, 0.97, 1) -> pale yellow (1, 0.9, 0.43)
    const k = t / 0.5;
    r = lerp(0.43, 1.0, k);
    g = lerp(0.97, 0.9, k);
    b = lerp(1.0, 0.43, k);
  } else {
    // pale yellow -> red (1, 0.32, 0.22)
    const k = (t - 0.5) / 0.5;
    r = lerp(1.0, 1.0, k);
    g = lerp(0.9, 0.32, k);
    b = lerp(0.43, 0.22, k);
  }
  return [r, g, b];
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
