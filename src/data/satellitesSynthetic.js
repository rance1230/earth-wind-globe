import { CONFIG } from "../config.js";

export function syntheticSatellites(radius) {
  const positions = new Float32Array(CONFIG.satelliteCount * 3);
  for (let i = 0; i < CONFIG.satelliteCount; i += 1) {
    const t = i / CONFIG.satelliteCount;
    const inclination = Math.acos(1 - 2 * t);
    const azimuth = i * 2.399963229728653;
    const altitude = radius + ((i * 17) % 100) / 100 * 0.42;
    positions[i * 3] = Math.sin(inclination) * Math.cos(azimuth) * altitude;
    positions[i * 3 + 1] = Math.cos(inclination) * altitude;
    positions[i * 3 + 2] = Math.sin(inclination) * Math.sin(azimuth) * altitude;
  }
  return { positions, sizes: new Float32Array(CONFIG.satelliteCount).fill(1) };
}
