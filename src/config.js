// Quality presets consumed by setQuality() (dispose + rebuild). PLAN-GLM5.2 §4.2.
export const QUALITY = {
  high: { windSegments: 1000, windPoints: 14, satelliteCount: 1600, pixelRatioCap: 2 },
  low: { windSegments: 500, windPoints: 10, satelliteCount: 800, pixelRatioCap: 1.5 }
};

export const CONFIG = {
  radius: 2,
  cameraDistance: 5.8,
  seed: 1337,
  defaultQuality: "high",
  // Legacy fields kept for backward-compat with placeholder layers until they are
  // rewired to read from QUALITY in tasks 2-4.
  windSegments: QUALITY.high.windSegments,
  windPoints: QUALITY.high.windPoints,
  satelliteCount: QUALITY.high.satelliteCount,
  pixelRatioCap: QUALITY.high.pixelRatioCap
};
