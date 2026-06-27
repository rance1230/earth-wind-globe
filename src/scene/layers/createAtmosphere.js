import * as THREE from "three";

// Atmosphere (PLAN-GLM5.2 task 5): keep the original glass shell and add a
// fresnel rim glow on top. The rim is rendered on BackSide so it shows brightest
// at the globe silhouette where the surface normal turns away from the view.
export function createAtmosphere(radius) {
  const group = new THREE.Group();

  // Original glass shell (unchanged, gives the planet its hazy envelope).
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: "#a8f4ff",
    transparent: true,
    opacity: 0.16,
    roughness: 0.08,
    metalness: 0,
    transmission: 0.4,
    thickness: 0.18,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending
  });
  const glass = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.018, 96, 64), glassMaterial);
  glass.renderOrder = 4;
  group.add(glass);

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
