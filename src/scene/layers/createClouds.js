import * as THREE from "three";

// P4 cloud shell: translucent equirect cloud map just above the terrain,
// slowly drifting in longitude. Additive/normal blending keeps day side soft
// without blotting out Blue Marble detail.

const CLOUDS_URL = "assets/earth/clouds-2048x1024.png";
const CLOUDS_KTX2_URL = "assets/earth/ktx2/clouds-2048x1024.ktx2";

let _cloudsEnabled = false;
let _cloudsSource = "none"; // "procedural" | "none"
let _cloudsEncoding = "none"; // "ktx2" | "png" | "none"

export function cloudsEnabled() {
  return _cloudsEnabled;
}
export function cloudsSource() {
  return _cloudsSource;
}
export function cloudsEncoding() {
  return _cloudsEncoding;
}

export function createClouds(radius, opts = {}) {
  const group = new THREE.Group();
  group.name = "clouds";
  _cloudsEnabled = false;
  _cloudsSource = "none";
  _cloudsEncoding = "none";
  const loaders = opts.loaders || null;

  // Slightly outside max terrain displacement so clouds don't z-fight peaks.
  const shellR = radius * (opts.radiusScale ?? 1.035);
  const geometry = new THREE.SphereGeometry(shellR, 96, 64);

  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.0, // raised when texture loads
    depthWrite: false,
    roughness: 1.0,
    metalness: 0.0,
    side: THREE.FrontSide,
    // Soften self-shadowing; clouds stay readable on night with slight emissive.
    emissive: new THREE.Color(0x8899aa),
    emissiveIntensity: 0.08
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 2;
  mesh.visible = false;
  group.add(mesh);

  const driftSpeed = opts.driftSpeed ?? 0.012; // rad/s relative to earth root

  const applyCloudTex = (tex, encoding) => {
    material.map = tex;
    material.opacity = 0.78;
    material.transparent = true;
    material.alphaTest = 0.02;
    material.needsUpdate = true;
    mesh.visible = true;
    _cloudsEnabled = true;
    _cloudsSource = "procedural";
    _cloudsEncoding = encoding;
    // eslint-disable-next-line no-console
    console.log(`[createClouds] cloud layer ready (procedural, ${encoding})`);
  };

  if (loaders?.loadTexture) {
    loaders.loadTexture(
      {
        ktx2: CLOUDS_KTX2_URL,
        fallback: CLOUDS_URL,
        colorSpace: THREE.SRGBColorSpace,
        anisotropy: 8,
        wrapS: THREE.RepeatWrapping,
        wrapT: THREE.ClampToEdgeWrapping
      },
      (tex, encoding) => applyCloudTex(tex, encoding),
      (err) => {
        _cloudsEnabled = false;
        _cloudsSource = "none";
        _cloudsEncoding = "none";
        mesh.visible = false;
        // eslint-disable-next-line no-console
        console.warn("[createClouds] cloud texture missing; layer disabled:", err);
      }
    );
  } else {
    const loader = new THREE.TextureLoader();
    loader.load(
      CLOUDS_URL,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.anisotropy = 8;
        applyCloudTex(tex, "png");
      },
      undefined,
      (err) => {
        _cloudsEnabled = false;
        _cloudsSource = "none";
        mesh.visible = false;
        // eslint-disable-next-line no-console
        console.warn("[createClouds] cloud texture missing; layer disabled:", err);
      }
    );
  }

  return {
    group,
    update(_elapsed, delta = 0) {
      if (!_cloudsEnabled) return;
      // Drift opposite to default earth spin so clouds crawl across continents.
      mesh.rotation.y += delta * driftSpeed;
    },
    dispose() {
      geometry.dispose();
      material.map?.dispose?.();
      material.dispose();
      _cloudsEnabled = false;
      _cloudsSource = "none";
    }
  };
}
