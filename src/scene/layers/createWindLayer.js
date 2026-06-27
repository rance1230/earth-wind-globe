import * as THREE from "three";
import { syntheticWind } from "../../data/windSynthetic.js";

export function createWindLayer(radius) {
  const group = new THREE.Group();
  const lines = syntheticWind(radius * 1.024).map((segment) => {
    const geometry = new THREE.BufferGeometry().setFromPoints(segment.points);
    const material = new THREE.LineBasicMaterial({
      color: segment.speed > 0.72 ? "#ffe66d" : "#6ff7ff",
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending
    });
    const line = new THREE.Line(geometry, material);
    line.userData.phase = segment.phase;
    group.add(line);
    return line;
  });

  return {
    group,
    update(elapsed) {
      for (const line of lines) {
        line.material.opacity = 0.36 + Math.sin(elapsed * 2 + line.userData.phase) * 0.2 + 0.28;
      }
    }
  };
}
