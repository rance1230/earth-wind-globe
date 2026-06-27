import * as THREE from "three";
import { syntheticSatellites } from "../../data/satellitesSynthetic.js";

export function createSatelliteLayer(radius) {
  const { positions } = syntheticSatellites(radius * 1.22);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: "#ffffff",
    size: 0.018,
    transparent: true,
    opacity: 0.86,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const group = new THREE.Points(geometry, material);

  return {
    group,
    update(_elapsed, delta) {
      group.rotation.y += delta * 0.018;
      group.rotation.x += delta * 0.006;
    }
  };
}
