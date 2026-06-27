import * as THREE from "three";
import { syntheticWind } from "../../data/windSynthetic.js";
import { CONFIG } from "../../config.js";

// Wind layer (PLAN-GLM5.2 task 3 / §4.1).
// Single merged BufferGeometry => one draw call. Per-vertex color (speed ->
// cyan/yellow/red) + a per-vertex line-progress attribute drive a flow shader so
// the streamlines visibly travel along their path instead of pulsing in unison.
export function createWindLayer(radius, opts = {}) {
  const count = opts.count ?? CONFIG.windSegments;
  const pointsPerSeg = opts.points ?? 14;
  // ERA5 path (task 5/6): caller passes pre-traced segments whose direction
  // comes from ERA5 u/v. Synthetic path: generate them in-place.
  const segments =
    Array.isArray(opts.segments) && opts.segments.length > 0
      ? opts.segments
      : syntheticWind(radius * 1.024, { count, points: pointsPerSeg, seed: CONFIG.seed });

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
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uFlow: { value: 0.55 }, // flow speed
      uBase: { value: 0.42 }, // baseline opacity floor
      uDepthFade: { value: 1.0 } // front-bright/back-fade strength
    },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      attribute float aProgress;
      varying vec3 vColor;
      varying float vProgress;
      varying float vFront;
      void main() {
        vColor = color;
        vProgress = aProgress;
        // View-space position: front-facing streamlines (closer to camera) have a
        // view-space normal roughly aligned with the view direction. Use the
        // normalized view-space position z as a cheap front/back indicator so the
        // near side reads brighter and the far side fades (task 6: 近处更亮, 远处更淡).
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 vn = normalize(-mv.xyz);
        // front-ness: 1.0 facing camera, 0.0 grazing/behind.
        vFront = clamp(0.5 + 0.5 * vn.z, 0.0, 1.0);
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
      void main() {
        // A moving bright band travels along each streamline along its real ERA5
        // direction (driven by aProgress, advanced by uTime).
        float wave = fract(vProgress * 1.0 - uTime * uFlow);
        float band = smoothstep(0.55, 1.0, wave);
        // Boost saturation in the bright band so warm hues survive ACES/bloom.
        vec3 col = mix(vColor * 0.55, vColor, band);
        float alpha = uBase + band * 0.7;
        // Depth layering: near side bright, far side dim — avoids the flat
        // "random starburst over the ocean" look and adds globe roundness.
        float depthFactor = mix(1.0 - uDepthFade, 1.0, vFront);
        gl_FragColor = vec4(col * (0.7 + band * 1.1) * depthFactor, alpha * depthFactor);
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
