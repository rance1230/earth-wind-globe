// era5-wind-frame-v1 validator (PLAN-ERA5-WAZA-GLM5.2 task 2/3, §3.2).
//
// Pure function, no DOM, importable from both the browser loader and the Node
// CLI validator. Returns { ok, errors, stats }. NEVER throws on bad data —
// callers decide. A frame that fails here is reported as `missing`/`invalid`,
// never silently relabeled as ERA5.

export const REQUIRED_FIELDS = [
  "schemaVersion",
  "source",
  "producer",
  "access",
  "variables",
  "units",
  "timeUtc",
  "grid",
  "u",
  "v",
  "speedStats",
  "preprocess",
  "licenseNotice"
];

export function validateEra5WindFrame(frame) {
  const errors = [];
  if (!frame || typeof frame !== "object") {
    return { ok: false, errors: ["frame is not an object"], stats: null };
  }
  for (const key of REQUIRED_FIELDS) {
    if (!(key in frame)) errors.push(`missing field: ${key}`);
  }
  if (frame.schemaVersion && frame.schemaVersion !== "era5-wind-frame-v1") {
    errors.push(`unexpected schemaVersion: ${frame.schemaVersion}`);
  }
  // ERA5 provenance must be explicit — a synthetic fallback must NOT be labeled ERA5.
  const src = String(frame.source ?? "").toLowerCase();
  if (src && !src.includes("era5")) {
    errors.push(`source does not declare ERA5: ${frame.source}`);
  }
  if (frame.producer && !/copernicus|ecmwf/i.test(String(frame.producer))) {
    errors.push(`producer must reference Copernicus/ECMWF: ${frame.producer}`);
  }

  const grid = frame.grid;
  let width = 0;
  let height = 0;
  if (grid && typeof grid === "object") {
    width = Number(grid.width) || 0;
    height = Number(grid.height) || 0;
    if (!Array.isArray(grid.lon) || grid.lon.length !== 2) {
      errors.push("grid.lon must be [min,max]");
    }
    if (!Array.isArray(grid.lat) || grid.lat.length !== 2) {
      errors.push("grid.lat must be [min,max]");
    }
  }

  const u = frame.u;
  const v = frame.v;
  if (!Array.isArray(u) || !Array.isArray(v)) {
    errors.push("u and v must be arrays");
  } else if (u.length !== v.length) {
    errors.push(`u/v length mismatch: ${u.length} vs ${v.length}`);
  } else if (width && height && u.length !== width * height) {
    errors.push(`u length ${u.length} != width*height ${width * height}`);
  }

  // Recompute speed stats to catch malformed numbers.
  let stats = null;
  if (Array.isArray(u) && Array.isArray(v) && u.length === v.length && u.length > 0) {
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let nonFinite = 0;
    for (let i = 0; i < u.length; i += 1) {
      const uu = u[i];
      const vv = v[i];
      if (!Number.isFinite(uu) || !Number.isFinite(vv)) {
        nonFinite += 1;
        continue;
      }
      const sp = Math.hypot(uu, vv);
      if (sp < min) min = sp;
      if (sp > max) max = sp;
      sum += sp;
    }
    const n = u.length - nonFinite;
    if (n <= 0) {
      errors.push("no finite wind values");
    } else {
      stats = {
        min,
        max,
        mean: sum / n,
        nonFinite,
        count: n
      };
    }
  }

  // speedStats sanity: declared stats must be finite and ordered.
  if (frame.speedStats) {
    const s = frame.speedStats;
    for (const k of ["min", "max", "mean", "p95"]) {
      if (s[k] !== undefined && !Number.isFinite(s[k])) {
        errors.push(`speedStats.${k} not finite`);
      }
    }
    if (
      Number.isFinite(s.min) &&
      Number.isFinite(s.max) &&
      Number.isFinite(s.mean) &&
      !(s.min <= s.mean && s.mean <= s.max)
    ) {
      errors.push("speedStats not ordered: min <= mean <= max violated");
    }
    if (Number.isFinite(s.p95) && Number.isFinite(s.mean) && s.p95 < s.mean) {
      errors.push("speedStats p95 < mean");
    }
  }

  return { ok: errors.length === 0, errors, stats };
}
