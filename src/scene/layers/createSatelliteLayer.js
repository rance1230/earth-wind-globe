import * as THREE from "three";
import { CONFIG } from "../../config.js";
import { syntheticSatellites } from "../../data/satellitesSynthetic.js";

// Satellite layer (PLAN-GLM5.2 task 4 / §4.1): single THREE.Points draw call.
// Seeded fibonacci-sphere shell with an altitude band; drifts slowly.
export function createSatelliteLayer(radius, opts = {}) {
  const count = opts.count ?? CONFIG.satelliteCount;
  const { positions } = syntheticSatellites(radius * 1.22, { count, seed: CONFIG.seed });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: "#ffffff",
    size: 0.03,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const group = new THREE.Points(geometry, material);

  return {
    group,
    count,
    update(_elapsed, delta) {
      group.rotation.y += delta * 0.02;
      group.rotation.x += delta * 0.006;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}
