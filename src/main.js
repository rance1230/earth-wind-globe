import "./styles.css";
import { EarthScene } from "./scene/EarthScene.js";

const canvas = document.querySelector("#globe-canvas");
const scene = new EarthScene(canvas);

scene.init();
