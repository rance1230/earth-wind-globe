// ERA5 wind frame loader (PLAN-ERA5-WAZA-GLM5.2 task 3; V3 B1/B2 multi-frame).
//
// Fetches the manifest pointed at public/data/era5/manifest.json and then the
// referenced frame JSON(s), validating each before returning. On ANY failure
// (missing manifest, fetch error, validation error) it resolves to
// { status: "missing" } — callers must surface that honestly to the UI and to
// window.__viz.windSource(); we never relabel a missing/invalid frame as ERA5.
//
// V3 adds loadEra5WindSeries() for the time-ordered multi-frame series so the
// runtime can step/animate through frames (B2).

import { validateEra5WindFrame } from "./validateEra5WindFrame.js";

const MANIFEST_URL = "data/era5/manifest.json";

function resolveFrameUrl(frameRel, baseUrlHref) {
  // frame path in manifest is relative to the manifest directory.
  return new URL(frameRel, baseUrlHref).href;
}

/**
 * Single-frame load (back-compat). Resolves to the default frame.
 * @returns {Promise<{status:"era5",frame,stats}|{status:"missing",reason:string}>}
 */
export async function loadEra5WindFrame() {
  let manifest;
  const manifestHref = new URL(MANIFEST_URL, window.location.href).href;
  try {
    const resp = await fetch(manifestHref, { cache: "no-cache" });
    if (!resp.ok) return { status: "missing", reason: `manifest fetch failed: HTTP ${resp.status}` };
    manifest = await resp.json();
  } catch (err) {
    return { status: "missing", reason: `manifest fetch error: ${String(err)}` };
  }
  if (!manifest || !manifest.frame) {
    return { status: "missing", reason: "manifest has no frame path" };
  }
  return loadOne(manifest.frame, manifestHref);
}

async function loadOne(frameRel, manifestHref) {
  const frameUrl = resolveFrameUrl(frameRel, manifestHref);
  let frame;
  try {
    const resp = await fetch(frameUrl, { cache: "no-cache" });
    if (!resp.ok) return { status: "missing", reason: `frame fetch failed: HTTP ${resp.status}` };
    frame = await resp.json();
  } catch (err) {
    return { status: "missing", reason: `frame fetch error: ${String(err)}` };
  }
  const { ok, errors, stats } = validateEra5WindFrame(frame);
  if (!ok) return { status: "missing", reason: `frame invalid: ${errors.join("; ")}` };
  return { status: "era5", frame, stats };
}

/**
 * V3 B1/B2: load the full time-ordered frame series.
 * @returns {Promise<{status:"era5",frames:Array<{frame,stats,timeUtc}>,count:number}|{status:"missing",reason:string}>}
 */
export async function loadEra5WindSeries() {
  const manifestHref = new URL(MANIFEST_URL, window.location.href).href;
  let manifest;
  try {
    const resp = await fetch(manifestHref, { cache: "no-cache" });
    if (!resp.ok) return { status: "missing", reason: `manifest fetch failed: HTTP ${resp.status}` };
    manifest = await resp.json();
  } catch (err) {
    return { status: "missing", reason: `manifest fetch error: ${String(err)}` };
  }
  const list = Array.isArray(manifest.frames) && manifest.frames.length > 0
    ? manifest.frames.map((f) => f.file)
    : manifest.frame
      ? [manifest.frame]
      : [];
  if (list.length === 0) return { status: "missing", reason: "manifest has no frames" };
  const out = [];
  for (const rel of list) {
    const r = await loadOne(rel, manifestHref);
    if (r.status === "era5") out.push({ frame: r.frame, stats: r.stats, timeUtc: r.frame.timeUtc });
  }
  if (out.length === 0) return { status: "missing", reason: "no valid frames loaded" };
  return { status: "era5", frames: out, count: out.length };
}
