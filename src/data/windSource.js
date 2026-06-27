// Unified wind data source state (PLAN-ERA5-WAZA-GLM5.2 task 3).
//
// Single place that knows whether the active wind field is real ERA5, the
// devSynthetic fallback, or missing. EarthScene reads `active()` to drive both
// the wind layer and window.__viz.windSource() so UI and Playwright always see
// the truth. We NEVER promote devSynthetic/missing to "era5".

// Status values:
//   "era5"         — a validated ERA5 frame is loaded and in use
//   "devSynthetic" — synthetic fallback is in use (clearly labeled, not ERA5)
//   "missing"      — no usable data at all
//   "loading"      — initial transient while loading

let activeStatus = "loading";
let activeFrame = null;
let activeReason = null;

export function setActiveEra5(frame) {
  activeStatus = "era5";
  activeFrame = frame;
  activeReason = null;
}

export function setActiveFallback(reason) {
  // Used when ERA5 is unavailable: either fall back to synthetic (devSynthetic)
  // or report missing. The caller decides which; this just records the choice.
  activeFrame = null;
  activeReason = reason ?? "era5 unavailable";
}

export function markSyntheticActive() {
  activeStatus = "devSynthetic";
}

export function markMissing(reason) {
  activeStatus = "missing";
  activeReason = reason ?? "no wind data";
}

export function markLoading() {
  activeStatus = "loading";
}

export function active() {
  return {
    status: activeStatus,
    isEra5: activeStatus === "era5",
    frame: activeFrame,
    reason: activeReason
  };
}
