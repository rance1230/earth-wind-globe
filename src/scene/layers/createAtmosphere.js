import * as THREE from "three";

// Atmosphere P1: sun-driven approximate Rayleigh + Mie limb scattering.
// Two additive shells (outer BackSide Rayleigh, inner softer Mie/horizon glow).
// Not full ray-march optical depth — tuned for interactive cinematic look while
// staying cheap under SwiftShader and stock WebGL2.

let _atmosphereMode = "scatteringV1";

export function atmosphereMode() {
  return _atmosphereMode;
}

export function createAtmosphere(radius) {
  const group = new THREE.Group();
  _atmosphereMode = "scatteringV1";

  // --- Outer Rayleigh shell (thick blue limb, day-weighted) ---
  const rayleighMaterial = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide,
    uniforms: {
      uSunDir: { value: new THREE.Vector3(1, 0.2, 0) },
      uRayleigh: { value: new THREE.Color("#4aa7ff") },
      uMie: { value: new THREE.Color("#fff2e0") },
      uHorizon: { value: new THREE.Color("#ffb07a") },
      uIntensity: { value: 1.05 },
      uPower: { value: 3.2 }
    },
    vertexShader: /* glsl */ `
      varying vec3 vView;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldPos = world.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir;
      uniform vec3 uRayleigh;
      uniform vec3 uMie;
      uniform vec3 uHorizon;
      uniform float uIntensity;
      uniform float uPower;
      varying vec3 vView;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;

      // Henyey-Greenstein-like phase (g>0 forward scatter for soft sun glow).
      float phaseHG(float mu, float g) {
        float g2 = g * g;
        return (1.0 - g2) / pow(max(1e-4, 1.0 + g2 - 2.0 * g * mu), 1.5);
      }

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(vView);
        vec3 L = normalize(uSunDir);

        // Limb factor: thicker air at silhouette.
        float ndv = abs(dot(N, V));
        float limb = pow(1.0 - ndv, uPower);

        float mu = clamp(dot(N, L), -1.0, 1.0);
        float day = smoothstep(-0.25, 0.35, mu);
        float terminator = 1.0 - abs(smoothstep(-0.2, 0.2, mu) * 2.0 - 1.0);

        // View-sun angle for forward scatter near the bright limb.
        float muVS = clamp(dot(V, L), -1.0, 1.0);
        float miePhase = phaseHG(muVS, 0.72);
        float rayPhase = 0.75 * (1.0 + muVS * muVS);

        // Night limb stays faintly visible so the disc doesn't hard-cut.
        float nightLimb = mix(0.22, 1.0, day);

        vec3 rayleigh = uRayleigh * rayPhase * limb;
        vec3 mie = uMie * miePhase * limb * day * 0.35;
        vec3 horizon = uHorizon * terminator * limb * 0.55;

        vec3 col = (rayleigh + mie + horizon) * uIntensity * nightLimb;
        float a = clamp(limb * uIntensity * nightLimb * 0.95, 0.0, 1.0);
        gl_FragColor = vec4(col, a);
      }
    `
  });
  const rayleigh = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.12, 96, 64),
    rayleighMaterial
  );
  rayleigh.renderOrder = 4;
  rayleigh.name = "atmosphere-rayleigh";
  group.add(rayleigh);

  // --- Inner glow shell (tighter rim + warm day edge) ---
  const glowMaterial = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide,
    uniforms: {
      uSunDir: { value: new THREE.Vector3(1, 0.2, 0) },
      uColor: { value: new THREE.Color("#8fd9ff") },
      uWarm: { value: new THREE.Color("#ffc9a0") },
      uIntensity: { value: 0.55 },
      uPower: { value: 5.5 }
    },
    vertexShader: /* glsl */ `
      varying vec3 vView;
      varying vec3 vWorldNormal;
      void main() {
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir;
      uniform vec3 uColor;
      uniform vec3 uWarm;
      uniform float uIntensity;
      uniform float uPower;
      varying vec3 vView;
      varying vec3 vWorldNormal;
      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(vView);
        vec3 L = normalize(uSunDir);
        float limb = pow(1.0 - abs(dot(N, V)), uPower);
        float mu = clamp(dot(N, L), -1.0, 1.0);
        float day = smoothstep(-0.1, 0.5, mu);
        float term = 1.0 - abs(smoothstep(-0.15, 0.15, mu) * 2.0 - 1.0);
        vec3 col = mix(uColor, uWarm, term * 0.65 + (1.0 - day) * 0.15);
        float a = limb * uIntensity * mix(0.28, 1.0, day);
        gl_FragColor = vec4(col * a * 1.2, a);
      }
    `
  });
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.055, 96, 64),
    glowMaterial
  );
  glow.renderOrder = 5;
  glow.name = "atmosphere-glow";
  group.add(glow);

  // --- Front-side in-scatter veil (very soft day-side air over the disc) ---
  const veilMaterial = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.FrontSide,
    uniforms: {
      uSunDir: { value: new THREE.Vector3(1, 0.2, 0) },
      uColor: { value: new THREE.Color("#6eb8ff") },
      uIntensity: { value: 0.12 }
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldNormal;
      varying vec3 vView;
      void main() {
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir;
      uniform vec3 uColor;
      uniform float uIntensity;
      varying vec3 vWorldNormal;
      varying vec3 vView;
      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(vView);
        vec3 L = normalize(uSunDir);
        float fres = pow(1.0 - max(0.0, dot(N, V)), 2.5);
        float day = smoothstep(0.0, 0.6, dot(N, L));
        float a = fres * day * uIntensity;
        gl_FragColor = vec4(uColor * a, a);
      }
    `
  });
  const veil = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.018, 64, 48),
    veilMaterial
  );
  veil.renderOrder = 3;
  veil.name = "atmosphere-veil";
  group.add(veil);

  return group;
}
