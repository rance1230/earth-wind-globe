import * as THREE from "three";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";

// Shared loaders for P3/P4 assets. High tier prefers KTX2 (Basis ETC1S) with
// honest JPEG/PNG fallback when transcoder or asset is missing.

/**
 * @param {THREE.WebGLRenderer} renderer
 * @returns {{
 *   textureLoader: THREE.TextureLoader,
 *   ktx2Loader: KTX2Loader | null,
 *   ktx2Supported: boolean,
 *   loadTexture: Function,
 *   dispose: Function
 * }}
 */
export function createTextureLoaders(renderer) {
  const textureLoader = new THREE.TextureLoader();
  let ktx2Loader = null;
  let ktx2Supported = false;

  try {
    ktx2Loader = new KTX2Loader();
    // Served from public/basis (copied from three/examples/jsm/libs/basis).
    ktx2Loader.setTranscoderPath("basis/");
    ktx2Loader.detectSupport(renderer);
    ktx2Supported = true;
  } catch (err) {
    ktx2Loader = null;
    ktx2Supported = false;
    // eslint-disable-next-line no-console
    console.warn("[textureLoaders] KTX2 unavailable:", err);
  }

  /**
   * Prefer KTX2 URL when available; fall back to classic texture URL.
   * @param {{ ktx2?: string, fallback: string, colorSpace?: string, anisotropy?: number, wrapS?: number, wrapT?: number, isColor?: boolean }} opts
   * @param {(tex: THREE.Texture, encoding: 'ktx2'|'jpeg'|'png'|'unknown') => void} onOk
   * @param {(err?: unknown) => void} [onFail]
   */
  function loadTexture(opts, onOk, onFail) {
    const {
      ktx2,
      fallback,
      colorSpace = THREE.NoColorSpace,
      anisotropy = 4,
      wrapS = THREE.RepeatWrapping,
      wrapT = THREE.ClampToEdgeWrapping
    } = opts;

    const applyCommon = (tex) => {
      tex.wrapS = wrapS;
      tex.wrapT = wrapT;
      tex.anisotropy = anisotropy;
      tex.colorSpace = colorSpace;
      // Compressed textures already carry mips when baked with -mipmap.
      if (!tex.isCompressedTexture) {
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = true;
      } else {
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
      }
      tex.needsUpdate = true;
      return tex;
    };

    const loadFallback = () => {
      if (!fallback) {
        onFail?.(new Error("no fallback texture url"));
        return;
      }
      textureLoader.load(
        fallback,
        (tex) => {
          applyCommon(tex);
          const enc = fallback.endsWith(".png") ? "png" : fallback.endsWith(".jpg") || fallback.endsWith(".jpeg") ? "jpeg" : "unknown";
          onOk(tex, enc);
        },
        undefined,
        (err) => onFail?.(err)
      );
    };

    if (ktx2 && ktx2Loader && ktx2Supported) {
      ktx2Loader.load(
        ktx2,
        (tex) => {
          applyCommon(tex);
          onOk(tex, "ktx2");
        },
        undefined,
        () => {
          // eslint-disable-next-line no-console
          console.warn(`[textureLoaders] KTX2 failed, fallback: ${fallback || "(none)"}`);
          loadFallback();
        }
      );
    } else {
      loadFallback();
    }
  }

  function dispose() {
    try {
      ktx2Loader?.dispose?.();
    } catch {
      /* ignore */
    }
    ktx2Loader = null;
    ktx2Supported = false;
  }

  return {
    textureLoader,
    ktx2Loader,
    get ktx2Supported() {
      return ktx2Supported;
    },
    loadTexture,
    dispose
  };
}
