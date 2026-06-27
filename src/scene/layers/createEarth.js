import * as THREE from "three";

// Earth (PLAN-V3 task A1).
//
// NASA Blue Marble NG texture with NO emissive self-illumination — replaced by
// a realistic sun DirectionalLight + night-side fill so a day/night terminator
// is visible. Procedural canvas remains the synchronous fallback. matte land
// (roughness ~0.9, metalness 0) avoids specular highlights that read as "glow".

const EARTH_TEXTURE_URL = "/assets/earth/blue-marble-5400x2700.jpg";

// Module-level state read by EarthScene / __viz. Only nasaBlueMarble is set when
// the real texture is actually on screen; proceduralFallback is honest.
let _mapSource = "proceduralFallback"; // "nasaBlueMarble" | "proceduralFallback"
let _mapReady = false;
let _onReadyCbs = [];

export function earthMapSource() {
  return _mapSource;
}
export function earthMapReady() {
  return _mapReady;
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

export function createEarth(radius) {
  // 1) Procedural fallback texture so the globe is visible on the first frame.
  const fallback = new THREE.CanvasTexture(createEarthTexture());
  fallback.colorSpace = THREE.SRGBColorSpace;
  fallback.wrapS = THREE.RepeatWrapping;
  fallback.anisotropy = 4;

  // A1: no emissive — the surface is lit by a realistic sun + night-side fill.
  // Matte land (roughness ~0.9) avoids specular "glow" highlights.
  const material = new THREE.MeshStandardMaterial({
    map: fallback,
    emissive: new THREE.Color(0x000000),
    emissiveIntensity: 0,
    roughness: 0.9,
    metalness: 0.0
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 128, 96), material);

  // 2) Asynchronously load the NASA Blue Marble texture; on success swap it in,
  // on failure keep the fallback and mark the source honestly.
  const loader = new THREE.TextureLoader();
  loader.load(
    EARTH_TEXTURE_URL,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.anisotropy = 8;
      material.map = tex;
      material.needsUpdate = true;
      fallback.dispose();
      _markReady("nasaBlueMarble");
    },
    undefined,
    (err) => {
      // Failure: keep proceduralFallback; earthMapReady() still resolves so
      // downstream waits unblock, but the source is never nasaBlueMarble.
      // eslint-disable-next-line no-console
      console.warn("[createEarth] NASA texture load failed, using proceduralFallback:", err);
      _markReady("proceduralFallback");
    }
  );

  return mesh;
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
