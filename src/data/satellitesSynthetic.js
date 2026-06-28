import { seededRandom } from "../util/seededRandom.js";
import { CONFIG } from "../config.js";

// Synthetic satellite positions (PLAN-GLM5.2 §4.4 deterministic, task 4).
// Fibonacci-sphere distribution gives an even, non-clumpy shell; a seeded PRNG
// adds altitude jitter + a per-satellite orbital phase so the layer can drift.
// Contract: { positions: Float32Array, sizes: Float32Array, phases: Float32Array }.
export function syntheticSatellites(radius, opts = {}) {
  const count = opts.count ?? CONFIG.satelliteCount;
  const seed = opts.seed ?? CONFIG.seed;
  const rand = seededRandom(seed + 7777); // offset so wind & satellites differ

  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const golden = Math.PI * (3 - Math.sqrt(5)); // ~2.39996
  const TAU = Math.PI * 2;

  for (let i = 0; i < count; i += 1) {
    // Even unit-sphere point via fibonacci lattice.
    const y = 1 - (i / Math.max(1, count - 1)) * 2; // 1..-1
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    // Altitude band proportional to the (now much larger) shell radius so the
    // spread reads as depth, not a thin shell hugging one distance.
    const altitude = radius + radius * 0.06 + rand() * radius * 0.14;
    positions[i * 3] = Math.cos(theta) * r * altitude;
    positions[i * 3 + 1] = y * altitude;
    positions[i * 3 + 2] = Math.sin(theta) * r * altitude;
    sizes[i] = 0.6 + rand() * 0.8;
    // Per-point twinkle phase (deterministic via the same seeded PRNG) used by
    // the shader's subtle brightness pulse. Keeps stars alive without breaking
    // the scientific-realism tone.
    phases[i] = rand() * TAU;
  }
  return { positions, sizes, phases };
}
