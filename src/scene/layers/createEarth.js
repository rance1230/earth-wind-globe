import * as THREE from "three";

// Earth (P0 cinematic material upgrade).
//
// Solid physically based earth surface: NASA Blue Marble provides albedo,
// ETOPO1 provides macro displacement + micro normal detail, and derived
// roughness / clearcoat maps separate shiny ocean from matte land.
// MeshPhysicalMaterial keeps us on Three.js's stock lighting path without a
// fragile full custom surface shader.

// P3/KTX2 quality tiers: High prefers KTX2 (Basis ETC1S) then JPEG/PNG.
// Height stays PNG — displacement needs CPU-readable pixels for roughness bake.
// Low keeps lightweight JPEG/PNG only.
const TEXTURE_TIERS = {
  high: {
    albedoKtx2: "assets/earth/ktx2/blue-marble-8192x4096.ktx2",
    albedo: "assets/earth/blue-marble-8192x4096.jpg",
    albedoFallback: "assets/earth/blue-marble-5400x2700.jpg",
    heightmap: "assets/earth/etopo1-heightmap-2880x1440.png",
    heightmapFallback: "assets/earth/etopo1-heightmap-720x360.png",
    normalKtx2: "assets/earth/ktx2/etopo1-normalmap-2880x1440.ktx2",
    normalmap: "assets/earth/etopo1-normalmap-2880x1440.png",
    normalmapFallback: "assets/earth/etopo1-normalmap-720x360.png",
    albedoRes: [8192, 4096],
    heightRes: [2880, 1440],
    normalRes: [2880, 1440],
    segmentsW: 384,
    segmentsH: 288
  },
  low: {
    albedoKtx2: null,
    albedo: "assets/earth/blue-marble-5400x2700.jpg",
    albedoFallback: "assets/earth/blue-marble-5400x2700.jpg",
    heightmap: "assets/earth/etopo1-heightmap-720x360.png",
    heightmapFallback: "assets/earth/etopo1-heightmap-720x360.png",
    normalKtx2: null,
    normalmap: "assets/earth/etopo1-normalmap-720x360.png",
    normalmapFallback: "assets/earth/etopo1-normalmap-720x360.png",
    albedoRes: [5400, 2700],
    heightRes: [720, 360],
    normalRes: [720, 360],
    segmentsW: 256,
    segmentsH: 192
  }
};
// Optional P1 night lights (public-domain NASA Black Marble bake, or procedural).
const NIGHT_LIGHTS_URL = "assets/earth/night-lights-2048x1024.jpg";

// Deliberately exaggerated relative to real-world Earth so relief remains
// visible at interactive zoom, while staying below 7.5% of the radius.
export const TERRAIN_DISPLACEMENT_SCALE = 0.10;
export const TERRAIN_DISPLACEMENT_BIAS = 0;

// Module-level state read by EarthScene / __viz. Only nasaBlueMarble is set when
// the real texture is actually on screen; proceduralFallback is honest.
let _mapSource = "proceduralFallback"; // "nasaBlueMarble" | "proceduralFallback"
let _mapReady = false;
let _terrainReady = false; // C2: ETOPO1 displacement applied
let _materialMode = "cinematicPBR"; // stock path after P0 upgrade
let _oceanSpecularEnabled = false;
let _nightLightsEnabled = false;
let _nightLightsSource = "none"; // "nasaBlackMarble" | "proceduralCities" | "none"
let _textureQuality = "high";
let _albedoResolution = [0, 0];
let _normalResolution = [0, 0];
let _heightmapResolution = [0, 0];
// KTX2 encoding honesty: which formats are actually on the material.
let _textureEncoding = { albedo: "none", normal: "none", height: "none" };
let _onReadyCbs = [];

export function earthMapSource() {
  return _mapSource;
}
export function earthMapReady() {
  return _mapReady;
}
export function terrainReady() {
  return _terrainReady;
}
export function terrainSource() {
  return _terrainReady ? "etopo1" : "none";
}
export function materialMode() {
  return _materialMode;
}
export function oceanSpecularEnabled() {
  return _oceanSpecularEnabled;
}
export function nightLightsEnabled() {
  return _nightLightsEnabled;
}
export function nightLightsSource() {
  return _nightLightsSource;
}
export function textureQuality() {
  return _textureQuality;
}
export function albedoResolution() {
  return _albedoResolution.slice();
}
export function normalResolution() {
  return _normalResolution.slice();
}
export function heightmapResolution() {
  return _heightmapResolution.slice();
}
export function textureEncoding() {
  return { ..._textureEncoding };
}
export function earthMapAttribution() {
  return _mapSource === "nasaBlueMarble"
    ? "NASA Blue Marble — NASA Earth Observatory"
    : "Procedural fallback (not a high-precision map)";
}
export function onEarthMapReady(cb) {
  if (_mapReady) cb();
  else _onReadyCbs.push(cb);
}
function _markReady(source) {
  _mapSource = source;
  _mapReady = true;
  _onReadyCbs.forEach((cb) => cb());
  _onReadyCbs = [];
}

/**
 * Bake roughness + clearcoat maps from the land-only heightmap.
 * Ocean (near-black) → low roughness / high clearcoat.
 * Land (brighter)    → high roughness / zero clearcoat.
 */
function bakeOceanLandMaps(hmapImage) {
  const W = hmapImage.width || 720;
  const H = hmapImage.height || 360;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(hmapImage, 0, 0, W, H);
  const imgData = ctx.getImageData(0, 0, W, H);
  const d = imgData.data;

  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = W;
  roughCanvas.height = H;
  const roughCtx = roughCanvas.getContext("2d");
  const roughData = roughCtx.createImageData(W, H);
  const rd = roughData.data;

  const coatCanvas = document.createElement("canvas");
  coatCanvas.width = W;
  coatCanvas.height = H;
  const coatCtx = coatCanvas.getContext("2d");
  const coatData = coatCtx.createImageData(W, H);
  const cd = coatData.data;

  for (let i = 0; i < d.length; i += 4) {
    const h = d[i] / 255;
    // Soft land/ocean blend so coasts don't hard-step.
    // h≈0 ocean, h>0.03 land (heightmap is land-only, bathymetry clamped to 0).
    const land = smoothstep(0.0, 0.045, h);

    // P4: ocean satin, not mirror — higher roughness + lower coat cut glints.
    // Ocean roughness ~0.32–0.42; land ~0.86–0.96.
    const oceanR = 92; // ~0.36
    const landR = 220 + Math.min(25, h * 40); // ~0.86–0.96
    const r = Math.round(oceanR + (landR - oceanR) * land);

    // Clearcoat only on water; weaker coat so day-side Atlantic doesn't blow out.
    const coat = Math.round((1.0 - land) * 140);

    rd[i] = r;
    rd[i + 1] = r;
    rd[i + 2] = r;
    rd[i + 3] = 255;

    cd[i] = coat;
    cd[i + 1] = coat;
    cd[i + 2] = coat;
    cd[i + 3] = 255;
  }

  roughCtx.putImageData(roughData, 0, 0);
  coatCtx.putImageData(coatData, 0, 0);

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.needsUpdate = true;

  const clearcoatMap = new THREE.CanvasTexture(coatCanvas);
  clearcoatMap.wrapS = THREE.RepeatWrapping;
  clearcoatMap.colorSpace = THREE.NoColorSpace;
  clearcoatMap.needsUpdate = true;

  return { roughnessMap, clearcoatMap };
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function textureSize(tex, fallbackRes) {
  const img = tex?.image;
  const w = img?.width || tex?.source?.data?.width || fallbackRes[0] || 0;
  const h = img?.height || tex?.source?.data?.height || fallbackRes[1] || 0;
  return [w, h];
}

export function createEarth(radius, opts = {}) {
  const quality = opts.quality === "low" ? "low" : "high";
  const tier = TEXTURE_TIERS[quality];
  const loaders = opts.loaders || null;
  _textureQuality = quality;
  _albedoResolution = [0, 0];
  _normalResolution = [0, 0];
  _heightmapResolution = [0, 0];
  _textureEncoding = { albedo: "none", normal: "none", height: "none" };

  // 1) Procedural fallback texture so the globe is visible on the first frame.
  const fallback = new THREE.CanvasTexture(createEarthTexture());
  fallback.colorSpace = THREE.SRGBColorSpace;
  fallback.wrapS = THREE.RepeatWrapping;
  fallback.anisotropy = 4;

  // Cinematic PBR defaults: land starts matte; ocean maps applied after heightmap.
  // P4: env/clearcoat dialed down further so ocean reads as water, not a lamp.
  const material = new THREE.MeshPhysicalMaterial({
    map: fallback,
    emissive: new THREE.Color(0xfff0d0),
    emissiveMap: null,
    emissiveIntensity: 0,
    roughness: 0.9,
    metalness: 0.0,
    envMapIntensity: 0.32,
    clearcoat: 0.38,
    clearcoatRoughness: 0.42,
    reflectivity: 0.22,
    ior: 1.33,
    transparent: false,
    opacity: 1,
    depthTest: true,
    depthWrite: true,
    side: THREE.FrontSide,
    displacementScale: 0,
    displacementBias: TERRAIN_DISPLACEMENT_BIAS
  });
  _materialMode = "cinematicPBR";
  _oceanSpecularEnabled = false;
  _nightLightsEnabled = false;
  _nightLightsSource = "none";

  // P1: night-side only city lights. Multiply stock emissive by a sun-night
  // factor so day-side never glows. uSunDir is updated from EarthScene.
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSunDir = { value: new THREE.Vector3(1, 0.2, 0) };
    shader.uniforms.uNightBoost = { value: 1.55 };
    material.userData.shader = shader;

    // Sphere world-position radial ≈ surface normal (stable under parent spin).
    shader.vertexShader = `
      varying vec3 vNightWorldNormal;
      ${shader.vertexShader}
    `.replace(
      "#include <begin_vertex>",
      /* glsl */ `
      #include <begin_vertex>
      vNightWorldNormal = normalize((modelMatrix * vec4(position, 1.0)).xyz);
      `
    );

    // Gate emissive after emissiveMap, before lights accumulation.
    // MeshPhysical builds: totalEmissiveRadiance = emissive; + emissivemap_fragment
    // then later outgoingLight += totalEmissiveRadiance.
    shader.fragmentShader = `
      uniform vec3 uSunDir;
      uniform float uNightBoost;
      varying vec3 vNightWorldNormal;
      ${shader.fragmentShader}
    `.replace(
      "#include <emissivemap_fragment>",
      /* glsl */ `
      #include <emissivemap_fragment>
      {
        float mu = dot(normalize(vNightWorldNormal), normalize(uSunDir));
        // Harder day cut so city lights never wash the sunlit disc.
        float nightFactor = 1.0 - smoothstep(-0.05, 0.08, mu);
        totalEmissiveRadiance *= nightFactor * uNightBoost;
      }
      `
    );
  };
  material.customProgramCacheKey = () => "earth-cinematicPBR-nightLights-v4";

  // P3: denser mesh on High so hi-res displacement reads smoothly when zoomed.
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, tier.segmentsW, tier.segmentsH),
    material
  );

  const classicLoader = new THREE.TextureLoader();
  const loadTexture =
    loaders?.loadTexture?.bind(loaders) ||
    ((opts, onOk, onFail) => {
      classicLoader.load(opts.fallback, (tex) => onOk(tex, "jpeg"), undefined, onFail);
    });

  // Helper for PNG/JPEG-only paths (heightmap + night lights).
  function loadClassic(url, fallbackUrl, onOk, onFail) {
    classicLoader.load(
      url,
      onOk,
      undefined,
      () => {
        if (fallbackUrl && fallbackUrl !== url) classicLoader.load(fallbackUrl, onOk, undefined, onFail);
        else onFail?.();
      }
    );
  }

  // 2) NASA Blue Marble albedo — High prefers KTX2.
  loadTexture(
    {
      ktx2: quality === "high" ? tier.albedoKtx2 : null,
      fallback: tier.albedo,
      colorSpace: THREE.SRGBColorSpace,
      anisotropy: quality === "high" ? 16 : 8,
      wrapS: THREE.RepeatWrapping
    },
    (tex, encoding) => {
      material.map = tex;
      material.needsUpdate = true;
      fallback.dispose();
      _albedoResolution = textureSize(tex, tier.albedoRes);
      _textureEncoding.albedo = encoding;
      // If primary 8K path failed and we somehow got nothing useful, still mark NASA only when sized.
      if (_albedoResolution[0] >= 3600) {
        _markReady("nasaBlueMarble");
      } else {
        _markReady("proceduralFallback");
      }
      // eslint-disable-next-line no-console
      console.log(
        `[createEarth] albedo ${_albedoResolution.join("x")} via ${encoding} (q=${quality})`
      );
    },
    (err) => {
      // Try low-tier JPEG explicitly before procedural.
      classicLoader.load(
        tier.albedoFallback,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.wrapS = THREE.RepeatWrapping;
          tex.anisotropy = 8;
          material.map = tex;
          material.needsUpdate = true;
          fallback.dispose();
          _albedoResolution = textureSize(tex, [5400, 2700]);
          _textureEncoding.albedo = "jpeg";
          _markReady("nasaBlueMarble");
        },
        undefined,
        () => {
          // eslint-disable-next-line no-console
          console.warn("[createEarth] NASA texture load failed, using proceduralFallback:", err);
          _albedoResolution = [0, 0];
          _textureEncoding.albedo = "none";
          _markReady("proceduralFallback");
        }
      );
    }
  );

  // 3) ETOPO1 heightmap — always PNG (need image data for roughness bake).
  const applyHeightmap = (hmap, resHint) => {
    hmap.wrapS = THREE.RepeatWrapping;
    hmap.anisotropy = 4;
    hmap.minFilter = THREE.LinearMipmapLinearFilter;
    material.displacementMap = hmap;
    material.displacementScale = TERRAIN_DISPLACEMENT_SCALE;
    material.displacementBias = TERRAIN_DISPLACEMENT_BIAS;
    material.needsUpdate = true;
    _terrainReady = true;
    _heightmapResolution = textureSize(hmap, resHint);
    _textureEncoding.height = "png";

    try {
      const img = hmap.image;
      if (img && (img.width || img.naturalWidth)) {
        const { roughnessMap, clearcoatMap } = bakeOceanLandMaps(img);
        material.roughnessMap = roughnessMap;
        material.clearcoatMap = clearcoatMap;
        material.roughness = 1.0;
        material.clearcoat = 0.42;
        material.clearcoatRoughness = 0.38;
        material.envMapIntensity = 0.38;
        material.needsUpdate = true;
        _oceanSpecularEnabled = true;
        _materialMode = "cinematicPBR";
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[createEarth] ocean/land PBR map generation failed:", e);
      _oceanSpecularEnabled = false;
    }
  };

  loadClassic(
    tier.heightmap,
    tier.heightmapFallback,
    (hmap) => applyHeightmap(hmap, tier.heightRes),
    (err) => {
      // eslint-disable-next-line no-console
      console.warn("[createEarth] ETOPO1 heightmap load failed, smooth globe:", err);
      _terrainReady = false;
      _oceanSpecularEnabled = false;
      _heightmapResolution = [0, 0];
      _textureEncoding.height = "none";
    }
  );

  // 4) ETOPO1 normal — High prefers KTX2.
  loadTexture(
    {
      ktx2: quality === "high" ? tier.normalKtx2 : null,
      fallback: tier.normalmap,
      colorSpace: THREE.NoColorSpace,
      anisotropy: quality === "high" ? 8 : 4,
      wrapS: THREE.RepeatWrapping
    },
    (nmap, encoding) => {
      material.normalMap = nmap;
      material.normalScale = new THREE.Vector2(
        quality === "high" ? 1.55 : 1.35,
        quality === "high" ? 1.55 : 1.35
      );
      material.needsUpdate = true;
      _normalResolution = textureSize(nmap, tier.normalRes);
      _textureEncoding.normal = encoding;
    },
    () => {
      loadClassic(
        tier.normalmapFallback,
        tier.normalmapFallback,
        (nmap) => {
          material.normalMap = nmap;
          material.normalScale = new THREE.Vector2(1.35, 1.35);
          material.needsUpdate = true;
          _normalResolution = textureSize(nmap, [720, 360]);
          _textureEncoding.normal = "png";
        },
        () => {
          _normalResolution = [0, 0];
          _textureEncoding.normal = "none";
        }
      );
    }
  );

  // 5) P1 night lights (procedural / optional NASA).
  const applyNightMap = (ntex, source) => {
    ntex.colorSpace = THREE.SRGBColorSpace;
    ntex.wrapS = THREE.RepeatWrapping;
    ntex.anisotropy = 8;
    ntex.minFilter = THREE.LinearMipmapLinearFilter;
    material.emissiveMap = ntex;
    material.emissiveIntensity = source === "nasaBlackMarble" ? 1.7 : 1.35;
    material.needsUpdate = true;
    _nightLightsEnabled = true;
    _nightLightsSource = source;
    // eslint-disable-next-line no-console
    console.log(`[createEarth] night lights enabled (${source})`);
  };

  classicLoader.load(
    NIGHT_LIGHTS_URL,
    (ntex) => applyNightMap(ntex, "nasaBlackMarble"),
    undefined,
    () => {
      try {
        applyNightMap(bakeProceduralNightLights(), "proceduralCities");
      } catch (e) {
        _nightLightsEnabled = false;
        _nightLightsSource = "none";
        material.emissiveIntensity = 0;
        // eslint-disable-next-line no-console
        console.warn("[createEarth] night lights unavailable:", e);
      }
    }
  );

  return mesh;
}

/**
 * Soft city-light blobs from major populated places (Natural Earth labels).
 * Public-domain coordinates only — not a photographic night map.
 */
function bakeProceduralNightLights() {
  const W = 2048;
  const H = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, H);

  // Major urban clusters (lon, lat, relative brightness). Approximate only.
  const cities = [
    [139.7, 35.7, 1.0], [-74.0, 40.7, 1.0], [-118.2, 34.0, 0.9], [116.4, 39.9, 0.95],
    [121.5, 31.2, 0.95], [72.9, 19.1, 0.9], [77.2, 28.6, 0.85], [88.4, 22.6, 0.7],
    [2.35, 48.86, 0.85], [-0.12, 51.5, 0.85], [13.4, 52.5, 0.7], [37.6, 55.75, 0.8],
    [126.98, 37.57, 0.85], [135.5, 34.7, 0.75], [-46.6, -23.55, 0.85], [-43.2, -22.9, 0.7],
    [31.25, 30.05, 0.75], [3.39, 6.45, 0.65], [106.8, -6.17, 0.75], [100.5, 13.75, 0.65],
    [103.85, 1.29, 0.7], [151.2, -33.87, 0.7], [144.97, -37.81, 0.55], [-79.4, 43.66, 0.6],
    [-87.63, 41.85, 0.7], [-95.35, 29.75, 0.55], [28.97, 41.02, 0.7], [51.42, 35.67, 0.55],
    [12.5, 41.9, 0.55], [-3.7, 40.4, 0.55], [4.9, 52.37, 0.5], [139.75, 35.68, 1.0],
    [114.17, 22.32, 0.75], [121.57, 25.04, 0.6], [104.07, 30.67, 0.55], [113.26, 23.13, 0.7],
    [-99.13, 19.43, 0.85], [-58.38, -34.6, 0.7], [18.42, -33.92, 0.45], [28.05, -26.2, 0.5],
    [36.82, -1.29, 0.45], [55.27, 25.2, 0.55], [46.72, 24.69, 0.5], [-77.04, 38.9, 0.55]
  ];

  for (const [lon, lat, b] of cities) {
    const x = ((lon + 180) / 360) * W;
    const y = ((90 - lat) / 180) * H;
    const r = 6 + b * 18;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255, 230, 170, ${0.55 + b * 0.4})`);
    g.addColorStop(0.35, `rgba(255, 180, 90, ${0.25 + b * 0.25})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // Seam wrap near ±180°.
    if (x < r) {
      ctx.beginPath();
      ctx.arc(x + W, y, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (x > W - r) {
      ctx.beginPath();
      ctx.arc(x - W, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

// Equirectangular canvas: x = longitude (-180..180), y = latitude (90..-90).
function createEarthTexture() {
  const W = 2048;
  const H = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Deep ocean base with a subtle latitudinal banding (polar darker).
  const ocean = ctx.createLinearGradient(0, 0, 0, H);
  ocean.addColorStop(0.0, "#08263f");
  ocean.addColorStop(0.18, "#0c3a63");
  ocean.addColorStop(0.5, "#0e4377");
  ocean.addColorStop(0.82, "#0c3a63");
  ocean.addColorStop(1.0, "#08263f");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, W, H);

  // Latitudinal current hints — faint cyan streaks.
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = "#2db0ff";
  ctx.lineWidth = 2;
  for (let i = 0; i < 14; i += 1) {
    const y = (H * (0.2 + (i / 14) * 0.6)) | 0;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 24) {
      ctx.lineTo(x, y + Math.sin(x * 0.01 + i) * 6);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Helper to draw an irregular filled landmass from lat/lon points.
  const lon2x = (lon) => ((lon + 180) / 360) * W;
  const lat2y = (lat) => ((90 - lat) / 180) * H;
  function drawLandmass(points, fill) {
    ctx.beginPath();
    points.forEach(([lon, lat], i) => {
      const x = lon2x(lon);
      const y = lat2y(lat);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  const landFill = "#3a5a26";
  const desertFill = "#9a6a2a";
  const iceFill = "#dfeaf2";

  // Simplified continents (recognizable silhouettes, longitude/latitude).
  drawLandmass(
    [
      [-168, 65], [-155, 70], [-130, 70], [-95, 72], [-75, 78], [-60, 75],
      [-55, 60], [-70, 48], [-80, 42], [-82, 30], [-95, 28], [-100, 25],
      [-110, 23], [-118, 32], [-125, 40], [-128, 49], [-135, 56], [-150, 60], [-168, 65]
    ],
    landFill
  );
  drawLandmass([[-95, 22], [-86, 18], [-78, 9], [-83, 8], [-92, 16], [-95, 22]], landFill);
  drawLandmass(
    [
      [-80, 12], [-70, 12], [-58, 8], [-50, 0], [-35, -8], [-38, -23],
      [-50, -34], [-65, -42], [-70, -53], [-74, -50], [-72, -38], [-76, -25],
      [-80, -12], [-82, 0], [-80, 12]
    ],
    landFill
  );
  drawLandmass(
    [[-10, 58], [5, 60], [15, 62], [30, 60], [40, 55], [38, 47], [25, 46],
     [12, 45], [0, 43], [-9, 44], [-10, 58]],
    landFill
  );
  drawLandmass(
    [
      [-17, 21], [-5, 35], [10, 36], [25, 32], [34, 30], [38, 18], [44, 12],
      [51, 11], [42, -2], [40, -15], [35, -25], [25, -34], [18, -34], [12, -20],
      [9, -5], [4, 5], [-8, 8], [-17, 14], [-17, 21]
    ],
    "#6a5a2a"
  );
  ctx.globalAlpha = 0.5;
  drawLandmass(
    [[-10, 28], [10, 30], [25, 30], [33, 28], [30, 20], [10, 18], [-8, 20], [-10, 28]],
    desertFill
  );
  ctx.globalAlpha = 1;
  drawLandmass(
    [
      [30, 60], [60, 70], [90, 74], [120, 73], [150, 70], [170, 66], [175, 60],
      [160, 55], [140, 50], [135, 42], [125, 38], [122, 30], [110, 22], [100, 14],
      [92, 12], [80, 9], [72, 22], [62, 25], [55, 26], [48, 30], [45, 38],
      [42, 44], [40, 50], [35, 56], [30, 60]
    ],
    landFill
  );
  drawLandmass([[70, 24], [78, 22], [88, 22], [84, 10], [78, 8], [72, 16], [70, 24]], landFill);
  drawLandmass([[95, 5], [105, 2], [115, 0], [110, -4], [100, -2], [95, 5]], landFill);
  drawLandmass([[120, -2], [135, -3], [140, -5], [130, -8], [118, -7], [120, -2]], landFill);
  drawLandmass(
    [[114, -22], [125, -14], [138, -12], [145, -16], [153, -26], [150, -36],
     [140, -38], [128, -34], [118, -32], [114, -28], [114, -22]],
    "#7a6a30"
  );
  drawLandmass(
    [[-50, 82], [-25, 82], [-18, 76], [-25, 65], [-45, 62], [-52, 70], [-50, 82]],
    "#9fb0bb"
  );
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = iceFill;
  ctx.fillRect(0, (H * 0.93) | 0, W, H - (H * 0.93) | 0);
  ctx.globalAlpha = 1;
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = iceFill;
  ctx.fillRect(0, 0, W, (H * 0.06) | 0);
  ctx.globalAlpha = 1;

  return canvas;
}
