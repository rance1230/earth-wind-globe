import * as THREE from "three";
import { syntheticWind } from "../../data/windSynthetic.js";
import { CONFIG } from "../../config.js";

// Wind layer (PLAN-GLM5.2 task 3 / §4.1 + B3 enhancement).
// Single merged BufferGeometry => one draw call. Per-vertex color (speed ->
// cyan/yellow/red) + a per-vertex line-progress attribute drive a flow shader so
// the streamlines visibly travel along their path instead of pulsing in unison.
// B3: dual-wave glow (sharp core + soft halo) gives the lines more voluminous
// presence without changing geometry.
export function createWindLayer(radius, opts = {}) {
  const count = opts.count ?? CONFIG.windSegments;
  const pointsPerSeg = opts.points ?? 14;
  // ERA5 path (task 5/6): caller passes pre-traced segments whose direction
  // comes from ERA5 u/v. Synthetic path: generate them in-place.
  const segments =
    Array.isArray(opts.segments) && opts.segments.length > 0
      ? opts.segments
      : syntheticWind(radius * 1.06, { count, points: pointsPerSeg, seed: CONFIG.seed });

  const positions = [];
  const colors = [];
  const progress = [];
  for (const seg of segments) {
    const c = seg.color;
    for (let i = 0; i < seg.points.length - 1; i += 1) {
      const a = seg.points[i];
      const b = seg.points[i + 1];
      const t0 = i / (seg.points.length - 1);
      const t1 = (i + 1) / (seg.points.length - 1);
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      colors.push(c[0], c[1], c[2], c[0], c[1], c[2]);
      progress.push(t0, t1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("aProgress", new THREE.Float32BufferAttribute(progress, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    blending: THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uFlow: { value: 0.55 },
      uBase: { value: 0.12 },
      uDepthFade: { value: 1.0 },
      uSunDir: { value: new THREE.Vector3(1, 0, 0) }
    },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      attribute float aProgress;
      varying vec3 vColor;
      varying float vProgress;
      varying float vFront;
      varying float vSunDot;
      uniform vec3 uSunDir;
      void main() {
        vColor = color;
        vProgress = aProgress;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 vn = normalize(-mv.xyz);
        vFront = clamp(0.5 + 0.5 * vn.z, 0.0, 1.0);
        // Day/night factor: world-space normal dot sun direction.
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vec3 worldNormal = normalize(worldPos.xyz);
        vSunDot = dot(worldNormal, uSunDir);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uFlow;
      uniform float uBase;
      uniform float uDepthFade;
      varying vec3 vColor;
      varying float vProgress;
      varying float vFront;
      varying float vSunDot;
      void main() {
        // Primary traveling bright band (sharp core).
        float wave = fract(vProgress * 1.0 - uTime * uFlow);
        float band = smoothstep(0.50, 1.0, wave);
        // Secondary soft glow trail (wider, dimmer) adds volume.
        float wave2 = fract(vProgress * 1.0 - uTime * uFlow * 0.85 + 0.3);
        float glow = smoothstep(0.25, 0.85, wave2) * 0.35;
        // Combine: band is the bright core, glow is the soft halo.
        float intensity = band + glow;
        // Day/night blend: day side darkens and boosts alpha for contrast
        // against bright Blue Marble; night side keeps the glowy look.
        float isDay = smoothstep(-0.1, 0.3, vSunDot);
        vec3 nightCol = mix(vColor * 0.50, vColor, intensity);
        float nightAlpha = uBase + intensity * 0.75;
        // Day: deeper, more opaque so wind reads over bright land/ocean.
        vec3 dayCol = vColor * 0.42;
        float dayAlpha = (uBase * 0.55 + intensity * 0.9) * 0.82;
        vec3 col = mix(nightCol, dayCol, isDay);
        float alpha = mix(nightAlpha, dayAlpha, isDay);
        float depthFactor = mix(1.0 - uDepthFade, 1.0, vFront);
        gl_FragColor = vec4(col * (0.45 + intensity * 0.6) * depthFactor, alpha * 0.50 * depthFactor);
      }
    `
  });

  const group = new THREE.LineSegments(geometry, material);

  return {
    group,
    count: segments.length,
    update(elapsed) {
      material.uniforms.uTime.value = elapsed;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}
