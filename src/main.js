import "./styles.css";
import { EarthScene } from "./scene/EarthScene.js";

const canvas = document.querySelector("#globe-canvas");
const scene = new EarthScene(canvas);

scene.init();

// UI wiring (PLAN-GLM5.2 task 2). Each control drives scene state and the
// deterministic __viz hook that Playwright asserts against.
const btnPause = document.querySelector("#btn-pause");
const btnReset = document.querySelector("#btn-reset");
const selectQuality = document.querySelector("#select-quality");

function syncPauseLabel() {
  const paused = scene.paused;
  btnPause.textContent = paused ? "播放" : "暂停";
  btnPause.setAttribute("aria-pressed", String(paused));
}

btnPause.addEventListener("click", () => {
  scene.setPaused(!scene.paused);
  syncPauseLabel();
});

btnReset.addEventListener("click", () => {
  scene.resetCamera();
});

selectQuality.addEventListener("change", () => {
  scene.setQuality(selectQuality.value);
  // Quality switch rebuilds wind; refresh the source badge afterward.
  scene.updateWindSourceBadge?.();
});

// Recording / demo mode (PLAN-ERA5-WAZA task 7): press "h" to hide HUD +
// controls for a clean capture. Press again (or "s") to show.
function setDemoMode(on) {
  document.body.classList.toggle("demo-mode", on);
}
let demoMode = false;
window.addEventListener("keydown", (e) => {
  if (e.key === "h") {
    demoMode = !demoMode;
    setDemoMode(demoMode);
  }
});

// Expose a recording-mode hook for Playwright / scripts.
window.__viz = window.__viz || {};
window.__viz.setDemoMode = setDemoMode;
window.__viz.demoMode = () => document.body.classList.contains("demo-mode");

syncPauseLabel();
