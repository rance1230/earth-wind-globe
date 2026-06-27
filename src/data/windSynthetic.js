import * as THREE from "three";
import { CONFIG } from "../config.js";

export function syntheticWind(radius) {
  const segments = [];
  for (let i = 0; i < CONFIG.windSegments; i += 1) {
    const lat = -68 + ((i * 137.5) % 136);
    const lon = (i * 47) % 360;
    const speed = 0.35 + ((i * 29) % 100) / 100;
    const points = [];
    for (let j = 0; j < 9; j += 1) {
      const curl = Math.sin((lat + j * 6) * 0.08) * 8;
      points.push(toSphere(lat + j * 1.2, lon + j * (3.6 + speed * 4) + curl, radius));
    }
    segments.push({ points, speed, phase: i * 0.31 });
  }
  return segments;
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
