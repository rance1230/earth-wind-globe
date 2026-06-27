import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { CONFIG } from "../config.js";
import { createEarth } from "./layers/createEarth.js";
import { createAtmosphere } from "./layers/createAtmosphere.js";
import { createWindLayer } from "./layers/createWindLayer.js";
import { createSatelliteLayer } from "./layers/createSatelliteLayer.js";

export class EarthScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.renderer = null;
    this.composer = null;
    this.controls = null;
    this.root = new THREE.Group();
    this.clock = new THREE.Clock();
    this.resizeObserver = null;
    this.layers = [];
  }

  init() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.pixelRatioCap));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.background = new THREE.Color("#05070b");

    this.camera.position.set(0.8, 1.2, CONFIG.cameraDistance);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 3.2;
    this.controls.maxDistance = 9;

    const key = new THREE.DirectionalLight("#ffffff", 2.8);
    key.position.set(3, 4, 3);
    const fill = new THREE.HemisphereLight("#cdeeff", "#07111d", 1.6);
    this.scene.add(key, fill, this.root);

    const earth = createEarth(CONFIG.radius);
    const atmosphere = createAtmosphere(CONFIG.radius);
    const wind = createWindLayer(CONFIG.radius);
    const satellites = createSatelliteLayer(CONFIG.radius);
    this.root.add(earth, atmosphere, wind.group, satellites.group);
    this.layers.push(wind, satellites);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.72, 0.42, 0.2));

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas.parentElement);
    this.resize();
    this.animate();
  }

  resize() {
    const bounds = this.canvas.parentElement.getBoundingClientRect();
    const width = Math.max(320, Math.floor(bounds.width));
    const height = Math.max(320, Math.floor(bounds.height));
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const elapsed = this.clock.getElapsedTime();
    const delta = this.clock.getDelta();
    this.root.rotation.y += delta * 0.08;
    for (const layer of this.layers) layer.update?.(elapsed, delta);
    this.controls.update();
    this.composer.render();
  }
}
