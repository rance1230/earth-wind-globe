import * as THREE from "three";

// Boundaries layer (PLAN-V3): Natural Earth admin-0 + admin-1 + China provinces,
// projected onto the sphere as merged THREE.LineSegments (one draw call each).
// Vertices are displaced by the ETOPO1 heightmap so the lines sit ON the terrain
// (planets, ridges) instead of floating above it. Data is build-time-baked into
// public/assets/boundaries; the heightmap is decoded at load time via canvas.

const STATUS = { loading: "loading", ready: "ready", missing: "missing" };

// Heightmap sampling: lon/lat -> normalized land elevation 0..1 (land-only,
// ocean = 0). Matches bake_etopo_heightmap.py (lon -180..180, lat 90..-90 row
// order, downsampled to 720x360).
function sampleHeight(heightData, W, H, lon, lat) {
  if (!heightData) return 0;
  // lon -180..180 -> x 0..W; lat 90..-90 -> y 0..H.
  const nx = (lon + 180) / 360;
  const ny = (90 - lat) / 180;
  let x = Math.floor(nx * W);
  let y = Math.floor(ny * H);
  x = ((x % W) + W) % W; // wrap longitude
  if (y < 0) y = 0;
  if (y > H - 1) y = H - 1;
  return heightData[y * W + x] / 255;
}

// Project a lon/lat polyline onto the displaced sphere. r = radius + (h*0.08 - 0.08)
// matches createEarth.js displacementScale/Bias so lines follow the terrain.
function projectPolyline(ring, radius, heightData, hW, hH) {
  const verts = [];
  for (let i = 0; i < ring.length; i += 1) {
    const [lon, lat] = ring[i];
    const latR = THREE.MathUtils.degToRad(lat);
    const lonR = THREE.MathUtils.degToRad(lon);
    const h = sampleHeight(heightData, hW, hH, lon, lat);
    const r = radius + (h * 0.08 - 0.08);
    // Z sign negated to match SphereGeometry's equirect mapping.
    verts.push(r * Math.cos(latR) * Math.cos(lonR), r * Math.sin(latR), -r * Math.cos(latR) * Math.sin(lonR));
  }
  return verts;
}

export function buildBoundariesLayer(countriesSegs, statesSegs, chinaSegs, radius, heightData, hW, hH) {
  const group = new THREE.Group();
  const allSegs = [
    { segs: countriesSegs, color: new THREE.Color("#dffbff"), opacity: 0.5 },
    { segs: statesSegs, color: new THREE.Color("#9fc6e0"), opacity: 0.3 },
    { segs: chinaSegs, color: new THREE.Color("#ffd27a"), opacity: 0.55 }
  ];

  const layers = [];
  for (const def of allSegs) {
    const positions = [];
    for (const ring of def.segs || []) {
      if (ring.length < 2) continue;
      const v = projectPolyline(ring, radius, heightData, hW, hH);
      for (let i = 0; i + 5 < v.length; i += 3) {
        positions.push(v[i], v[i + 1], v[i + 2], v[i + 3], v[i + 4], v[i + 5]);
      }
    }
    if (positions.length === 0) continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color: def.color,
      transparent: true,
      opacity: def.opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const lines = new THREE.LineSegments(geometry, material);
    lines.renderOrder = 3;
    group.add(lines);
    layers.push({ geometry, material, count: (def.segs || []).length });
  }

  return {
    group,
    status: layers.length > 0 ? STATUS.ready : STATUS.missing,
    countrySegmentCount: countriesSegs ? countriesSegs.length : 0,
    stateSegmentCount: statesSegs ? statesSegs.length : 0,
    chinaSegmentCount: chinaSegs ? chinaSegs.length : 0,
    update() {},
    dispose() {
      for (const l of layers) {
        l.geometry.dispose();
        l.material.dispose();
      }
    }
  };
}

// Decode the ETOPO1 heightmap PNG into a Uint8 grayscale array via canvas.
async function loadHeightData() {
  try {
    const resp = await fetch("assets/earth/etopo1-heightmap-720x360.png", { cache: "no-cache" });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bmp, 0, 0);
    const { data } = ctx.getImageData(0, 0, bmp.width, bmp.height);
    // grayscale: take red channel.
    const gray = new Uint8Array(bmp.width * bmp.height);
    for (let i = 0; i < gray.length; i += 1) gray[i] = data[i * 4];
    return { data: gray, width: bmp.width, height: bmp.height };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[boundaries] heightmap decode failed, lines will float:", err);
    return null;
  }
}

export async function createBoundariesLayerAsync(radius) {
  const MANIFEST_URL = "assets/boundaries/manifest.json";
  try {
    const mresp = await fetch(MANIFEST_URL, { cache: "no-cache" });
    if (!mresp.ok) return emptyFallback("manifest HTTP " + mresp.status);
    const manifest = await mresp.json();
    const entries = manifest.entries || [];
    const countries = entries.find((e) => e.kind === "countries");
    const states = entries.find((e) => e.kind === "states_provinces");
    const china = entries.find((e) => e.kind === "china_provinces");
    const [cData, sData, cnData, hmap] = await Promise.all([
      countries ? fetch("assets/boundaries/" + countries.asset).then((r) => r.json()) : Promise.resolve({ segments: [] }),
      states ? fetch("assets/boundaries/" + states.asset).then((r) => r.json()) : Promise.resolve({ segments: [] }),
      china ? fetch("assets/boundaries/" + china.asset).then((r) => r.json()) : Promise.resolve({ segments: [] }),
      loadHeightData()
    ]);
    const hd = hmap ? hmap.data : null;
    const layer = buildBoundariesLayer(
      cData.segments || [],
      sData.segments || [],
      cnData.segments || [],
      radius,
      hd,
      hmap ? hmap.width : 720,
      hmap ? hmap.height : 360
    );
    layer.manifest = manifest;
    return layer;
  } catch (err) {
    return emptyFallback(String(err));
  }
}

function emptyFallback(reason) {
  const layer = buildBoundariesLayer([], [], [], 2, null, 720, 360);
  layer.status = STATUS.missing;
  layer.missingReason = reason;
  return layer;
}
