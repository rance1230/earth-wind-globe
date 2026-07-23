import * as THREE from "three";

// Atmosphere (PLAN-V3 fix + B2 upgrade): the old MeshPhysicalMaterial glass shell
// (transmission/thickness/low roughness) reflected the RoomEnvironment as a
// mirror-like glassy layer. It is removed.
//
// B2 upgrade: the fresnel rim glow now includes Mie + Rayleigh scattering,
// producing warm sunrise/sunset orange at the terminator while keeping the
// cyan rim glow at the silhouette.
export function createAtmosphere(radius) {
  const group = new THREE.Group();

  // Fresnel rim glow + atmospheric scattering: slightly larger sphere,
  // BackSide, additive.
  const rimMaterial = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide,
    uniforms: {
      uColor: { value: new THREE.Color("#7fe6ff") },
      uPower: { value: 2.6 },
      uIntensity: { value: 1.15 },
      uSunDir: { value: new THREE.Vector3(1, 0, 0) },
      uMieStrength: { value: 0.25 },
      uRayleighStrength: { value: 0.15 }
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vWorldNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uPower;
      uniform float uIntensity;
      uniform vec3 uSunDir;
      uniform float uMieStrength;
      uniform float uRayleighStrength;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vWorldNormal;
      void main() {
        // Fresnel rim (silhouette glow).
        float rim = pow(1.0 - abs(dot(vNormal, vView)), uPower);
        rim *= uIntensity;

        // Sun direction in view space for Mie/Rayleigh.
        vec3 sunDir = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);

        // Mie scattering: strong forward peak toward the sun.
        // This produces a bright white/yellow glow on the sun-facing limb.
        float sunDot = dot(vNormal, sunDir);
        float mie = pow(max(sunDot, 0.0), 12.0) * uMieStrength;

        // Rayleigh scattering: color shift at the terminator.
        // Near the terminator (sunDot ≈ 0) we get warm orange/red.
        // Blue side faces the camera; orange side faces away from sun at horizon.
        float rayleigh = pow(1.0 - abs(sunDot), 3.0) * uRayleighStrength;
        vec3 sunsetColor = mix(vec3(1.0, 0.45, 0.15), vec3(1.0, 0.8, 0.4), rayleigh);

        // Combine: base cyan rim + mie forward glow + rayleigh sunset color.
        vec3 col = uColor * rim;
        col += vec3(1.0, 0.95, 0.85) * mie * 0.5;
        col += sunsetColor * rayleigh * rim * 2.0;

        float alpha = rim + mie * 0.3;
        gl_FragColor = vec4(col, alpha);
      }
    `
  });
  const rim = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.085, 96, 64), rimMaterial);
  rim.renderOrder = 5;
  group.add(rim);

  return group;
}
