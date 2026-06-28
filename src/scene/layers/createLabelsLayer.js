import * as THREE from "three";

// Labels layer (PLAN-V3 task C4). DOM-based labels (HTML divs) projected onto
// the sphere each frame. Declutter: hide labels whose screen position overlaps a
// closer/already-shown label, and hide back-facing ones. China labels render
// "EN / 中文"; all others English only. Runtime fetches the build-time-baked JSON.

const STATUS = { loading: "loading", ready: "ready", missing: "missing" };

export async function createLabelsLayerAsync(radius) {
  const container = document.createElement("div");
  container.className = "globe-labels";
  container.style.position = "absolute";
  container.style.inset = "0";
  container.style.pointerEvents = "none";
  container.style.zIndex = "5";

  let labels = [];
  let status = STATUS.loading;
  let missingReason = null;
  try {
    const resp = await fetch("/assets/labels/labels-110m.json", { cache: "no-cache" });
    if (!resp.ok) {
      status = STATUS.missing;
      missingReason = "HTTP " + resp.status;
    } else {
      const data = await resp.json();
      labels = Array.isArray(data.labels) ? data.labels : [];
      status = STATUS.ready;
    }
  } catch (err) {
    status = STATUS.missing;
    missingReason = String(err);
  }

  // Create DOM elements, one per label.
  const els = labels.map((l) => {
    const el = document.createElement("div");
    el.className = "globe-label" + (l.capital ? " globe-label--capital" : "");
    // China cities bilingual; others English only.
    el.textContent = l.nameZh ? `${l.name} / ${l.nameZh}` : l.name;
    el.dataset.bilingual = l.nameZh ? "1" : "0";
    el.style.display = "none";
    container.appendChild(el);
    return { el, label: l, pos: new THREE.Vector3() };
  });

  return {
    container,
    status,
    missingReason,
    labelCount: labels.length,
    bilingualCount: labels.filter((l) => l.nameZh).length,
    // Project each label to screen, hide back-facing + declutter by overlap.
    // rootRotationY: the earth root group's Y rotation — labels must rotate with
    // the globe so they sit on the same geography as the texture/boundaries.
    update(camera, canvasRect, radiusVal, rootRotationY = 0) {
      if (els.length === 0) return;
      const yAxis = new THREE.Vector3(0, 1, 0);
      // Track screen rects of shown labels for greedy declutter (labels are
      // population-sorted, so bigger cities win).
      const placed = [];
      const camDir = new THREE.Vector3();
      camera.getWorldDirection(camDir);
      for (const item of els) {
        const { label, el, pos } = item;
        const latR = THREE.MathUtils.degToRad(label.lat);
        const lonR = THREE.MathUtils.degToRad(label.lon);
        const r = radiusVal;
        pos.set(r * Math.cos(latR) * Math.cos(lonR), r * Math.sin(latR), r * Math.cos(latR) * Math.sin(lonR));
        // Apply the globe's spin so the label's geographic anchor matches the
        // rotated texture/boundaries (the root cause of misalignment: DOM labels
        // used to ignore root.rotation.y while the globe spun under them).
        if (rootRotationY !== 0) pos.applyAxisAngle(yAxis, rootRotationY);
        // Back-face cull: label normal (pos normalized) must face the camera.
        const normal = pos.clone().normalize();
        const toCam = camera.position.clone().sub(pos).normalize();
        if (normal.dot(toCam) < 0.1) {
          el.style.display = "none";
          continue;
        }
        // Project to screen.
        const projected = pos.clone().project(camera);
        const sx = (projected.x * 0.5 + 0.5) * canvasRect.width;
        const sy = (-projected.y * 0.5 + 0.5) * canvasRect.height;
        // Skip if off-screen.
        if (sx < 0 || sy < 0 || sx > canvasRect.width || sy > canvasRect.height) {
          el.style.display = "none";
          continue;
        }
        // Estimate label box (measure once lazily).
        let w = el._w;
        let h = el._h;
        if (w == null) {
          el.style.display = "block";
          const rect = el.getBoundingClientRect();
          w = el._w = rect.width || 40;
          h = el._h = rect.height || 12;
        }
        const box = { x: sx - w / 2, y: sy - h / 2, w, h };
        // Declutter: overlap check against already-placed labels.
        let overlap = false;
        for (const p of placed) {
          if (!(box.x + box.w <= p.x || p.x + p.w <= box.x || box.y + box.h <= p.y || p.y + p.h <= box.y)) {
            overlap = true;
            break;
          }
        }
        if (overlap) {
          el.style.display = "none";
          continue;
        }
        el.style.display = "block";
        el.style.left = `${sx - w / 2}px`;
        el.style.top = `${sy - h / 2}px`;
        // Fade by distance to camera edge so limb labels dim.
        el.style.opacity = String(THREE.MathUtils.clamp(normal.dot(toCam) * 1.4, 0.2, 1));
        placed.push(box);
      }
    },
    dispose() {
      for (const item of els) item.el.remove();
      if (container.parentNode) container.parentNode.removeChild(container);
    }
  };
}
