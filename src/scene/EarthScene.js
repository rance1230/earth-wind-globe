import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { CONFIG, QUALITY } from "../config.js";
import {
  createEarth,
  earthMapSource,
  earthMapReady,
  earthMapAttribution,
  onEarthMapReady,
  terrainReady,
  terrainSource
} from "./layers/createEarth.js";
import { createAtmosphere } from "./layers/createAtmosphere.js";
import { createWindLayer } from "./layers/createWindLayer.js";
import { createSatelliteLayer } from "./layers/createSatelliteLayer.js";
import { createBoundariesLayerAsync } from "./layers/createBoundariesLayer.js";
import { createLabelsLayerAsync } from "./layers/createLabelsLayer.js";
import { loadEra5WindFrame } from "../data/era5/loadEra5WindFrame.js";
import { traceWindStreamlines } from "../data/era5/traceWindStreamlines.js";
import {
  setActiveEra5,
  markSyntheticActive,
  markMissing,
  markLoading,
  active as activeWindSource
} from "../data/windSource.js";

// Deterministic intro framing (PLAN task 4.4). Used by init + resetCamera so the
// globe always opens on the same longitude. Tuned in task 6 to face
// Africa / Arabian Peninsula / Indian Ocean.
const INTRO_ROTATION_Y = Math.PI * 0.5;

// lon/lat (degrees) -> unit vector on the sphere (ECEF, matches equirect map).
function llrToVec(lonDeg, latDeg, r) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lon = THREE.MathUtils.degToRad(lonDeg);
  return new THREE.Vector3(
    r * Math.cos(lat) * Math.cos(lon),
    r * Math.sin(lat),
    r * Math.cos(lat) * Math.sin(lon)
  );
}

export class EarthScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.renderer = null;
    this.composer = null;
    this.controls = null;
    this.root = new THREE.Group();
    this.clock = new THREE.Clock();
    this.resizeObserver = null;
    this.layers = [];

    // State (full wiring lands in task 2; minimal now so __viz can answer).
    this.quality = CONFIG.defaultQuality;
    this.paused = false;
    this.postprocessingEnabled = false;
    this.currentWindCount = 0;
    this.currentSatelliteCount = 0;
    // Frozen accumulated time used while paused so frame diff ~= 0.
    this.frozenElapsed = 0;
    this.frozenDelta = 0;
    // ERA5 wind source state (task 3). Defaults to loading; resolved async.
    this.era5Frame = null;
    this.era5Stats = null;
    this.windLayerKind = "devSynthetic"; // "era5" | "devSynthetic"
  }

  init() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    // ?lowres=1 (used by Playwright under SwiftShader) halves the backing-store
    // pixel ratio so full-viewport screenshots don't stall on ReadPixels.
    const lowres = new URLSearchParams(window.location.search).get("lowres") === "1";
    this.testScale = lowres ? 0.5 : 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.pixelRatioCap) * this.testScale);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.15; // A1: low indoor reflection, terminator reads clearly
    this.scene.background = new THREE.Color("#05070b");

    this.camera.position.set(0.8, 1.2, CONFIG.cameraDistance);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    // C1: allow deeper zoom into the surface (radius=2, so 2.15 grazes the
    // terrain/atmosphere shell) and a wider pull-back range.
    this.controls.minDistance = 2.18;
    this.controls.maxDistance = 12;
    this.controls.zoomSpeed = 0.8;

    // A1: realistic sun as the key light. Direction is updated from the current
    // wind frame UTC time (subsolar point); a strong night-side hemisphere fill
    // keeps the dark hemisphere readable without flattening the terminator.
    this.sunLight = new THREE.DirectionalLight("#fff6e8", 2.6);
    this.scene.add(this.sunLight, this.sunLight.target);
    // Night-side fill: sky tint over a dim ground, lifted enough that the dark
    // hemisphere's terrain/labels stay readable (max channel > background floor)
    // but clearly dimmer than the sun-lit day side.
    this.nightFill = new THREE.HemisphereLight("#aebfe0", "#070b14", 1.8);
    this.scene.add(this.nightFill, this.root);
    // A modest ambient lift so the dark hemisphere's terrain stays above the
    // screenshot background-detection floor (max channel > ~58), keeping labels
    // and geography readable on the night side while the sun-lit day side is
    // still clearly brighter.
    this.nightAmbient = new THREE.AmbientLight("#7d8aa6", 0.7);
    this.scene.add(this.nightAmbient);
    this.nightFillEnabled = true;
    // Initial sun direction from the default ERA5 frame time; re-applied on
    // wind frame change in B2 via updateSunFromTime().
    this.updateSunFromTime(this.era5Frame?.timeUtc ?? null);

    // Initial framing: rotate so the Americas + Africa face the camera on load,
    // then let the globe drift slowly. Equirect texture maps lon 0 to the seam,
    // so this offset puts ~-60° longitude toward the viewer.
    this.root.rotation.y = INTRO_ROTATION_Y;

    this.buildLayers();

    // postprocessing with graceful degradation (PLAN-GLM5.2 §4.5 / I7).
    // Bloom tuned low enough that warm wind hues stay readable (task 3) while
    // still giving the rim/satellites a glow; refined further in task 7.
    // ?nobloom=1 skips the composer entirely — used by Playwright under SwiftShader
    // where the composer's per-frame render-target ReadPixels stalls screenshots.
    const skipBloom = new URLSearchParams(window.location.search).get("nobloom") === "1";
    if (skipBloom) {
      this.postprocessingEnabled = false;
      this.composer = null;
    } else {
      try {
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.38, 0.5, 0.32));
        this.postprocessingEnabled = true;
      } catch (err) {
        this.postprocessingEnabled = false;
        this.composer = null;
        // eslint-disable-next-line no-console
        console.warn("[EarthScene] postprocessing unavailable, falling back to direct render", err);
      }
    }

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas.parentElement);
    this.resize();
    this.animate();

    this.attachTestHook();

    // Earth map readiness propagation: when the NASA texture resolves (success or
    // fallback), update the HUD badge. The __viz hook exposes the honest source.
    onEarthMapReady(() => this.updateEarthMapBadge());

    // C3: async boundaries load (Natural Earth admin-0 + admin-1, single draw
    // call each). Missing data degrades to an empty group (honest fallback).
    this.boundariesStatus = "loading";
    this.loadBoundaries();

    // C4: async DOM labels load (Natural Earth populated places; China bilingual).
    this.labelsStatus = "loading";
    this.loadLabels();

    // Async ERA5 load (task 3). Wind starts as synthetic so the globe renders
    // immediately; if a validated ERA5 frame arrives we swap the wind layer to
    // ERA5-driven streamlines. Missing/invalid frames are reported honestly.
    markLoading();
    this.loadEra5();
  }

  async loadLabels() {
    try {
      const layer = await createLabelsLayerAsync(CONFIG.radius);
      this.labelsLayer = layer;
      this.labelsStatus = layer.status;
      // Mount the label DOM container over the canvas.
      if (this.canvas && this.canvas.parentElement) {
        this.canvas.parentElement.appendChild(layer.container);
      }
      this.labelsInfo = {
        labelCount: layer.labelCount,
        bilingualCount: layer.bilingualCount,
        source: "naturalEarth110m"
      };
    } catch (err) {
      this.labelsStatus = "missing";
      // eslint-disable-next-line no-console
      console.warn("[EarthScene] labels load failed:", err);
    }
  }

  async loadBoundaries() {
    try {
      const layer = await createBoundariesLayerAsync(CONFIG.radius);
      this.boundariesLayer = layer;
      this.root.add(layer.group);
      this.boundariesStatus = layer.status;
      this.boundariesLayerInfo = {
        countrySegmentCount: layer.countrySegmentCount,
        stateSegmentCount: layer.stateSegmentCount,
        source: "naturalEarth110m"
      };
    } catch (err) {
      this.boundariesStatus = "missing";
      // eslint-disable-next-line no-console
      console.warn("[EarthScene] boundaries load failed:", err);
    }
  }

  async loadEra5() {
    try {
      const result = await loadEra5WindFrame();
      if (result.status === "era5") {
        this.era5Frame = result.frame;
        this.era5Stats = result.stats;
        this.rebuildWindLayerAsEra5();
      } else {
        // Honest status: no ERA5 frame usable. Keep synthetic fallback running
        // so the globe still animates, but label it devSynthetic, never era5.
        markSyntheticActive();
        this.windLayerKind = "devSynthetic";
        this.updateWindSourceBadge();
        // eslint-disable-next-line no-console
        console.warn("[EarthScene] ERA5 frame unavailable, using devSynthetic wind:", result.reason);
      }
    } catch (err) {
      markMissing(String(err));
      this.updateWindSourceBadge();
      // eslint-disable-next-line no-console
      console.warn("[EarthScene] ERA5 load error:", err);
    }
  }

  rebuildWindLayerAsEra5() {
    if (!this.era5Frame) return;
    const preset = QUALITY[this.quality] ?? QUALITY[CONFIG.defaultQuality];
    // Generate ERA5-driven streamlines (task 5 supplies the integrator).
    const segments = traceWindStreamlines(this.era5Frame, CONFIG.radius, {
      count: preset.windSegments,
      points: preset.windPoints,
      seed: CONFIG.seed
    });
    if (!segments || segments.length === 0) {
      markSyntheticActive("traceWindStreamlines returned no segments");
      this.updateWindSourceBadge();
      return;
    }
    // Dispose the synthetic wind layer and rebuild from ERA5 streamlines.
    if (this.windLayer) {
      this.windLayer.dispose?.();
      this.root.remove(this.windLayer.group);
    }
    this.windLayer = createWindLayer(CONFIG.radius, {
      count: preset.windSegments,
      points: preset.windPoints,
      segments
    });
    this.root.add(this.windLayer.group);
    // Refresh the layers list (satellites unchanged).
    this.layers = [this.windLayer, this.satelliteLayer];
    this.currentWindCount = this.windLayer.count ?? segments.length;
    this.windLayerKind = "era5";
    setActiveEra5(this.era5Frame);
    this.updateWindSourceBadge();
  }

  updateWindSourceBadge() {
    // HUD element is updated from main.js via the hook; no-op here if absent.
    const badge = typeof document !== "undefined" ? document.querySelector("#wind-source") : null;
    if (!badge) return;
    const { status, isEra5 } = activeWindSource();
    badge.textContent = isEra5
      ? "ERA5 风场"
      : status === "missing"
        ? "ERA5 数据缺失"
        : "合成风场（dev）";
    badge.dataset.source = status;
  }

  buildLayers() {
    // Static layers (do not depend on quality, never rebuilt).
    this.earthMesh = createEarth(CONFIG.radius);
    this.atmosphereMesh = createAtmosphere(CONFIG.radius);
    this.root.add(this.earthMesh, this.atmosphereMesh);
    this.buildDynamicLayers();
  }

  buildDynamicLayers() {
    const preset = QUALITY[this.quality] ?? QUALITY[CONFIG.defaultQuality];
    this.currentPreset = preset;
    const wind = createWindLayer(CONFIG.radius, { count: preset.windSegments, points: preset.windPoints });
    const satellites = createSatelliteLayer(CONFIG.radius, { count: preset.satelliteCount });
    this.windLayer = wind;
    this.satelliteLayer = satellites;
    this.root.add(wind.group, satellites.group);
    // Only dynamic layers animate + need dispose on quality change.
    this.layers = [wind, satellites];
    this.currentWindCount = wind.count ?? 0;
    this.currentSatelliteCount = satellites.count ?? 0;
    // Update pixel ratio cap for the active preset.
    if (this.renderer) {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.pixelRatioCap));
    }
  }

  disposeDynamicLayers() {
    for (const layer of this.layers) {
      layer.dispose?.();
      if (layer.group) this.root.remove(layer.group);
    }
    this.layers = [];
    this.windLayer = null;
    this.satelliteLayer = null;
  }

  resize() {
    const bounds = this.canvas.parentElement.getBoundingClientRect();
    let width = Math.max(320, Math.floor(bounds.width));
    let height = Math.max(320, Math.floor(bounds.height));
    // Under SwiftShader (test mode, ?lowres=1) halve the backing store to keep
    // full-viewport screenshots from stalling; CSS stretches it to fill.
    const renderW = Math.floor(width * this.testScale);
    const renderH = Math.floor(height * this.testScale);
    this.camera.aspect = renderW / renderH;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(renderW, renderH, false);
    // Stretch the backing store back to the CSS box.
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    if (this.composer) this.composer.setSize(renderW, renderH);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    if (this.renderFrozen) return;
    const liveElapsed = this.clock.getElapsedTime();
    const liveDelta = this.clock.getDelta();
    // While paused, freeze the animation clock so wind/satellite layers stop
    // advancing (frame diff ~= 0). OrbitControls damping keeps running.
    const elapsed = this.paused ? this.frozenElapsed : liveElapsed;
    const delta = this.paused ? 0 : liveDelta;
    if (!this.paused) this.frozenElapsed = liveElapsed;
    this.root.rotation.y += delta * 0.08;
    // A1: refresh the sun only when the wind frame time changes (not every
    // frame) so the canvas can settle for stable screenshots. The sun is in
    // world space and tracks the camera once per frame-time change.
    const sunTime = this.currentFrameTimeUtc ?? this.era5Frame?.timeUtc ?? null;
    if (sunTime !== this._lastSunTime) {
      this._lastSunTime = sunTime;
      this.updateSunFromTime(sunTime);
    }
    for (const layer of this.layers) layer.update?.(elapsed, delta);
    this.controls.update();
    // C4: project DOM labels each frame (declutter + back-face cull).
    if (this.labelsLayer) {
      const rect = this.canvas.getBoundingClientRect();
      this.labelsLayer.update(this.camera, rect, CONFIG.radius);
    }
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  // --- state mutators (full behavior completed in task 2) ---
  setPaused(value) {
    this.paused = !!value;
  }

  // Freeze the RAF render loop for stable screenshots under SwiftShader (the
  // bloom composer's per-frame ReadPixels stalls hang screenshots while the
  // globe spins). Renders one final frame, then stops scheduling rAF.
  setRenderFreeze(v) {
    this.renderFrozen = !!v;
    if (this.renderFrozen) {
      if (this.composer) this.composer.render();
      else this.renderer.render(this.scene, this.camera);
    }
  }

  setQuality(quality) {
    if (!QUALITY[quality]) return;
    if (quality === this.quality) return;
    this.quality = quality;
    this.disposeDynamicLayers();
    this.buildDynamicLayers();
  }

  resetCamera() {
    this.camera.position.set(0.8, 1.2, CONFIG.cameraDistance);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    // Reset the framing rotation too so the view returns to the intro shot.
    this.root.rotation.y = INTRO_ROTATION_Y;
  }

  // A1: position the sun light. The sun is in WORLD space and does NOT follow
  // the globe's spin — physically the sun is fixed while Earth rotates, so a
  // stable terminator crosses the visible disc and geography slides under it.
  // Its world longitude shifts with the wind-frame UTC (B2) via the subsolar
  // longitude, latitude is a fixed declination for a stable terminator.
  updateSunFromTime(timeUtc) {
    let hourUTC = 12; // noon default -> sun over the prime meridian
    if (typeof timeUtc === "string") {
      const m = /T(\d{2}):(\d{2})/.exec(timeUtc);
      if (m) hourUTC = Number(m[1]) + Number(m[2]) / 60;
    }
    const subsolarLon = -15 * (hourUTC - 12); // degrees
    // Fixed declination ~ +18° (northern summer) for a stable terminator.
    const subsolarLat = 18;
    // Pure subsolar-point sun direction (world space). This produces a clear
    // diagonal terminator across the visible disc rather than flattening it.
    // The wind-frame hour shifts which longitude is lit (B2). We do NOT bias
    // toward the camera — that would wash out the day/night contrast.
    const dir = llrToVec(subsolarLon, subsolarLat, 1);
    const far = this.camera.position.length() + 10;
    this.sunLight.position.copy(dir.clone().multiplyScalar(far));
    this.sunLight.target.position.set(0, 0, 0);
    this.sunLight.target.updateMatrixWorld();
    this.currentSunDirection = [dir.x, dir.y, dir.z];
  }

  updateEarthMapBadge() {
    const badge = typeof document !== "undefined" ? document.querySelector("#earth-map-source") : null;
    if (!badge) return;
    const src = earthMapSource();
    badge.textContent = src === "nasaBlueMarble" ? "NASA Blue Marble" : "程序化纹理（fallback）";
    badge.dataset.source = src;
  }

  // --- deterministic Playwright hook (PLAN-GLM5.2 §4.3) ---
  attachTestHook() {
    if (typeof window === "undefined") return;
    window.__viz = {
      ready: true,
      paused: () => this.paused,
      quality: () => this.quality,
      drawCalls: () => this.renderer.info.render.calls,
      satelliteCount: () => this.currentSatelliteCount,
      windCount: () => this.currentWindCount,
      cameraDistance: () => this.camera.position.length(),
      postprocessing: () => this.postprocessingEnabled,
      // ERA5 provenance hooks (task 3). windSource() is the single source of
      // truth — never promotes devSynthetic/missing to "era5".
      windSource: () => activeWindSource().status,
      windLayerKind: () => this.windLayerKind,
      windFrameTime: () => this.era5Frame?.timeUtc ?? null,
      windFrameStats: () => this.era5Stats ?? null,
      era5Ready: () => activeWindSource().isEra5,
      // Earth map provenance hooks (PLAN-V2.1 task 4). Only nasaBlueMarble when
      // the real texture is on screen; proceduralFallback is honest otherwise.
      earthMapReady: () => earthMapReady(),
      // A1 lighting hooks.
      lightingMode: () => "realisticSun",
      nightFillEnabled: () => this.nightFillEnabled,
      sunDirection: () => this.currentSunDirection ?? [1, 0, 0],
      setRenderFreeze: (v) => this.setRenderFreeze(v),
      earthMapSource: () => earthMapSource(),
      earthMapAttribution: () => earthMapAttribution(),
      // C2 terrain relief hooks.
      terrainReady: () => terrainReady(),
      terrainSource: () => terrainSource(),
      terrainDisplacementScale: () => 0.045,
      // C3 boundaries hooks.
      boundariesStatus: () => this.boundariesStatus,
      boundariesInfo: () => this.boundariesLayerInfo ?? null,
      // C4 labels hooks.
      labelsStatus: () => this.labelsStatus,
      labelsInfo: () => this.labelsInfo ?? null,
      visibleLabelCount: () =>
        document ? document.querySelectorAll(".globe-label:not([style*='display: none'])").length : 0,
      setPaused: (v) => this.setPaused(v),
      setQuality: (q) => this.setQuality(q),
      resetCamera: () => this.resetCamera()
    };
  }
}
