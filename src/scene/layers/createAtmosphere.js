import * as THREE from "three";

// Atmosphere (PLAN-V3 fix): the old MeshPhysicalMaterial glass shell
// (transmission/thickness/low roughness) reflected the RoomEnvironment as a
// mirror-like glassy layer. It is removed; only the fresnel rim glow remains —
// a soft blue halo at the globe silhouette that emits light instead of
// reflecting it.
export function createAtmosphere(radius) {
  const group = new THREE.Group();

  // Fresnel rim glow: slightly larger sphere, BackSide, additive.
  const rimMaterial = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide,
    uniforms: {
      uColor: { value: new THREE.Color("#7fe6ff") },
      uPower: { value: 2.6 },
      uIntensity: { value: 1.15 }
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uPower;
      uniform float uIntensity;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        // BackSide flips the normal; take the absolute so the rim peaks at the
        // silhouette (normal perpendicular to view direction).
        float rim = pow(1.0 - abs(dot(vNormal, vView)), uPower);
        rim *= uIntensity;
        gl_FragColor = vec4(uColor * rim, rim);
      }
    `
  });
  const rim = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.085, 96, 64), rimMaterial);
  rim.renderOrder = 5;
  group.add(rim);

  return group;
}
