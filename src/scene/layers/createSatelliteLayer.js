import * as THREE from "three";
import { CONFIG } from "../../config.js";
import { syntheticSatellites } from "../../data/satellitesSynthetic.js";

// Satellite layer (PLAN-GLM5.2 task 4 / §4.1): single THREE.Points draw call.
// Seeded fibonacci-sphere shell with an altitude band; drifts slowly.
//
// Visual upgrade (borrowed from a Three.js particle-shader reference): the
// points now render as soft halo+core glowing discs via a custom ShaderMaterial
// instead of bare square PointsMaterial. Per-point `size` (previously computed
// but discarded) and a `phase` twinkle are wired in as attributes. We keep it
// restrained — no star-cross / sparkle — to preserve the scientific-realism tone.
export function createSatelliteLayer(radius, opts = {}) {
  const count = opts.count ?? CONFIG.satelliteCount;
  // Stars sit on a far shell (4x Earth radius) so they don't crowd the view
  // when zooming into the surface, and read as a distant star field.
  const { positions, sizes, phases } = syntheticSatellites(radius * 4, { count, seed: CONFIG.seed });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1));
  geometry.setAttribute("aPhase", new THREE.Float32BufferAttribute(phases, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0.9 },
      // Distance-attenuation reference distance, matched to the wind layer so
      // star apparent size scales consistently with the globe.
      uSizeBase: { value: 0.075 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, CONFIG.pixelRatioCap) }
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uSizeBase;
      uniform float uPixelRatio;
      attribute float aSize;
      attribute float aPhase;
      varying float vPulse;

      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        // Gentle, low-amplitude brightness breathing (kept subtle so stars stay
        // calm and scientific, not a flickering screensaver).
        float pulse = 0.5 + 0.5 * sin(uTime * 1.8 + aPhase);
        vPulse = pulse;

        float size = aSize * uSizeBase * (1.0 + pulse * 0.15);
        gl_PointSize = clamp(size * (350.0 / -mvPosition.z) * uPixelRatio, 1.5, 18.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying float vPulse;

      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);

        // Soft outer halo + bright core. No star-cross / sparkle.
        float halo = smoothstep(0.5, 0.05, d);
        float core = smoothstep(0.15, 0.0, d);

        float alpha = (halo * 0.4 + core * 0.8) * uOpacity;
        if (alpha < 0.01) discard;

        // Cool-white star; brightness lifted by the core + gentle twinkle.
        vec3 col = vec3(1.0) * (0.8 + core * 1.2 + vPulse * 0.12);

        gl_FragColor = vec4(col, alpha);
      }
    `
  });

  const group = new THREE.Points(geometry, material);

  return {
    group,
    count,
    update(elapsed, delta) {
      group.rotation.y += delta * 0.02;
      group.rotation.x += delta * 0.006;
      material.uniforms.uTime.value = elapsed;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}
