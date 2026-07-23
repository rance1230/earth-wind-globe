import * as THREE from "three";

// Atmosphere: rim glow using AdditiveBlending. The rim only adds light at the
// silhouette edge (BackSide + rim shader); the center of the globe remains
// unaffected so the solid earth surface reads clearly.
export function createAtmosphere(radius) {
  const group = new THREE.Group();

  const rimMaterial = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide,
    uniforms: {
      uColor: { value: new THREE.Color("#7fe6ff") },
      uPower: { value: 4.5 },
      uIntensity: { value: 0.62 }
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
        float rim = pow(1.0 - abs(dot(vNormal, vView)), uPower);
        rim *= uIntensity;
        gl_FragColor = vec4(uColor * rim, rim);
      }
    `
  });
  const rim = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.08, 96, 64), rimMaterial);
  rim.renderOrder = 5;
  group.add(rim);

  return group;
}
