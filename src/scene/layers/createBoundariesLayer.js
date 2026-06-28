import * as THREE from "three";

// Boundaries layer (PLAN-V3 task C3): Natural Earth admin-0 + admin-1 line work,
// projected onto the sphere as a single merged THREE.LineSegments (one draw call).
// The caller passes already-loaded segment arrays (lon/lat polylines); we never
// fetch at runtime — all data is build-time-baked into public/assets/boundaries.

const STATUS = { loading: "loading", ready: "ready", missing: "missing" };

// Project a lon/lat polyline onto the sphere at `radius`, returning flat [x,y,z]
// vertex pairs (each consecutive pair = one line segment) plus per-vertex data.
function projectPolyline(ring, radius) {
  const verts = [];
  for (let i = 0; i < ring.length; i += 1) {
    const [lon, lat] = ring[i];
    const latR = THREE.MathUtils.degToRad(lat);
    const lonR = THREE.MathUtils.degToRad(lon);
    const r = radius;
    verts.push(r * Math.cos(latR) * Math.cos(lonR), r * Math.sin(latR), r * Math.cos(latR) * Math.sin(lonR));
  }
  return verts;
}

export function buildBoundariesLayer(countriesSegs, statesSegs, radius) {
  const group = new THREE.Group();
  const allSegs = [
    { segs: countriesSegs, color: new THREE.Color("#dffbff"), opacity: 0.5 },
    { segs: statesSegs, color: new THREE.Color("#9fc6e0"), opacity: 0.32 }
  ];

  const layers = [];
  for (const def of allSegs) {
    // Build a single LineSegments geometry: every pair of consecutive polyline
    // points becomes one segment. Merge across all polylines => one draw call.
    const positions = [];
    for (const ring of def.segs || []) {
      if (ring.length < 2) continue;
      const v = projectPolyline(ring, radius);
      // emit segment pairs (v0,v1),(v1,v2),...
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
    layers.push({
      geometry,
      material,
      count: (def.segs || []).length
    });
  }

  return {
    group,
    status: layers.length > 0 ? STATUS.ready : STATUS.missing,
    countrySegmentCount: countriesSegs ? countriesSegs.length : 0,
    stateSegmentCount: statesSegs ? statesSegs.length : 0,
    update() {},
    dispose() {
      for (const l of layers) {
        l.geometry.dispose();
        l.material.dispose();
      }
    }
  };
}

// Load + build in one async call; on fetch/parse failure returns a ready-but-empty
// group with status "missing" so the globe still renders (honest fallback).
export async function createBoundariesLayerAsync(radius) {
  const MANIFEST_URL = "/assets/boundaries/manifest.json";
  try {
    const mresp = await fetch(MANIFEST_URL, { cache: "no-cache" });
    if (!mresp.ok) return emptyFallback("manifest HTTP " + mresp.status);
    const manifest = await mresp.json();
    const entries = manifest.entries || [];
    const countries = entries.find((e) => e.kind === "countries");
    const states = entries.find((e) => e.kind === "states_provinces");
    const [cData, sData] = await Promise.all([
      countries ? fetch("/assets/boundaries/" + countries.asset).then((r) => r.json()) : Promise.resolve({ segments: [] }),
      states ? fetch("/assets/boundaries/" + states.asset).then((r) => r.json()) : Promise.resolve({ segments: [] })
    ]);
    const layer = buildBoundariesLayer(cData.segments || [], sData.segments || [], radius);
    layer.manifest = manifest;
    return layer;
  } catch (err) {
    return emptyFallback(String(err));
  }
}

function emptyFallback(reason) {
  const layer = buildBoundariesLayer([], [], 2);
  layer.status = STATUS.missing;
  layer.missingReason = reason;
  return layer;
}
