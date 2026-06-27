import * as THREE from "three";

export function createEarth(radius) {
  const texture = new THREE.CanvasTexture(createEarthTexture());
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.58,
    metalness: 0.08
  });

  return new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 64), material);
}

function createEarthTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  const ocean = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  ocean.addColorStop(0, "#07162a");
  ocean.addColorStop(0.55, "#0b2745");
  ocean.addColorStop(1, "#020813");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalAlpha = 0.88;
  drawLand(ctx, 220, 186, 150, 58, -0.12);
  drawLand(ctx, 420, 238, 90, 132, 0.2);
  drawLand(ctx, 585, 160, 175, 85, 0.08);
  drawLand(ctx, 710, 262, 118, 102, -0.2);
  drawLand(ctx, 818, 323, 86, 48, 0.28);
  drawLand(ctx, 120, 338, 120, 56, 0.12);

  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = "#20a8ff";
  ctx.lineWidth = 2;
  for (let i = 0; i < 32; i += 1) {
    const y = 40 + ((i * 37) % 430);
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= canvas.width; x += 48) {
      ctx.lineTo(x, y + Math.sin(x * 0.018 + i) * 7);
    }
    ctx.stroke();
  }

  return canvas;
}

function drawLand(ctx, cx, cy, rx, ry, phase) {
  ctx.fillStyle = "#7f8d68";
  ctx.strokeStyle = "#d09260";
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let i = 0; i <= 96; i += 1) {
    const a = (i / 96) * Math.PI * 2;
    const wobble = 1 + Math.sin(a * 3 + phase) * 0.16 + Math.cos(a * 7 - phase) * 0.08;
    const x = cx + Math.cos(a) * rx * wobble;
    const y = cy + Math.sin(a) * ry * wobble;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}
