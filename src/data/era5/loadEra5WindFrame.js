// ERA5 wind frame loader (PLAN-ERA5-WAZA-GLM5.2 task 3).
//
// Fetches the manifest pointed at public/data/era5/manifest.json and then the
// referenced frame JSON, validating it before returning. On ANY failure
// (missing manifest, fetch error, validation error) it resolves to
// { status: "missing" } — callers must surface that honestly to the UI and to
// window.__viz.windSource(); we never relabel a missing/invalid frame as ERA5.

import { validateEra5WindFrame } from "./validateEra5WindFrame.js";

const MANIFEST_URL = "data/era5/manifest.json";

/**
 * @returns {Promise<{status: "era5", frame}|{status: "missing", reason: string}>}
 */
export async function loadEra5WindFrame() {
  let manifest;
  try {
    const resp = await fetch(MANIFEST_URL, { cache: "no-cache" });
    if (!resp.ok) {
      return { status: "missing", reason: `manifest fetch failed: HTTP ${resp.status}` };
    }
    manifest = await resp.json();
  } catch (err) {
    return { status: "missing", reason: `manifest fetch error: ${String(err)}` };
  }

  if (!manifest || !manifest.frame) {
    return { status: "missing", reason: "manifest has no frame path" };
  }

  // Frame path in the manifest is relative to the manifest directory, so resolve
  // it against the manifest URL (not the document base).
  const frameUrl = new URL(manifest.frame, new URL(MANIFEST_URL, window.location.href)).href;

  let frame;
  try {
    const resp = await fetch(frameUrl, { cache: "no-cache" });
    if (!resp.ok) {
      return { status: "missing", reason: `frame fetch failed: HTTP ${resp.status}` };
    }
    frame = await resp.json();
  } catch (err) {
    return { status: "missing", reason: `frame fetch error: ${String(err)}` };
  }

  const { ok, errors, stats } = validateEra5WindFrame(frame);
  if (!ok) {
    return { status: "missing", reason: `frame invalid: ${errors.join("; ")}` };
  }
  return { status: "era5", frame, stats };
}
