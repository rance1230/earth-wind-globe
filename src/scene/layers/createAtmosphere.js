import * as THREE from "three";

export function createAtmosphere(radius) {
  const material = new THREE.MeshPhysicalMaterial({
    color: "#a8f4ff",
    transparent: true,
    opacity: 0.18,
    roughness: 0.08,
    metalness: 0,
    transmission: 0.4,
    thickness: 0.18,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending
  });

  const shell = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.018, 96, 64), material);
  shell.renderOrder = 4;
  return shell;
}
