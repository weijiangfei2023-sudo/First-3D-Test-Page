import * as THREE from 'three';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import modelData from './assets/model.gltf';

const host = document.querySelector('#scene');
const status = document.querySelector('#status');
const reset = document.querySelector('#reset');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
} catch (error) {
  status.textContent = '无法启动三维展示，请使用开启硬件加速的新版 Chrome 或 Edge 浏览器。';
  throw error;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0xffffff);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
host.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.rotateSpeed = 0.7;
controls.zoomSpeed = 0.8;
controls.minPolarAngle = 0.001;
controls.maxPolarAngle = Math.PI - 0.001;
scene.add(new THREE.HemisphereLight(0xffffff, 0x909090, 1.8));
for (const [position, intensity] of [[[4, 6, 5], 2.5], [[-4, 2, -3], 1.5], [[1, -4, 2], 0.7]]) {
  const light = new THREE.DirectionalLight(0xffffff, intensity);
  light.position.set(...position);
  scene.add(light);
}
let loaded = false;
function resize() {
  const width = host.clientWidth, height = host.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(host);
resize();

new GLTFLoader().parse(modelData, '', gltf => {
  const model = gltf.scene;
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = 3 / Math.max(size.x, size.y, size.z);
  // Normalize in a parent group to preserve the exported transforms and materials.
  const display = new THREE.Group();
  display.add(model);
  display.scale.setScalar(scale);
  display.position.copy(center).multiplyScalar(-scale);
  scene.add(display);
  const radius = size.length() * scale / 2;
  const halfFov = Math.min(THREE.MathUtils.degToRad(camera.fov / 2), Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
  const distance = radius / Math.sin(halfFov) * 1.14;
  camera.position.copy(new THREE.Vector3(1.2, 0.8, 1.4).normalize().multiplyScalar(distance));
  camera.near = radius / 1000;
  camera.far = distance * 30;
  camera.updateProjectionMatrix();
  controls.minDistance = radius * 1.08;
  controls.maxDistance = distance * 3;
  controls.target.set(0,0,0);
  controls.update();
  controls.saveState();
  loaded = true;
  reset.disabled = false;
  status.hidden = true;
  host.dataset.loaded = 'true';
}, error => {
  console.error(error);
  status.textContent = '模型加载失败，请使用新版 Chrome 或 Edge 浏览器重新打开页面。';
});
reset.addEventListener('click', () => {
  // Clear residual drag inertia before restoring the saved camera.
  controls.enableDamping = false;
  controls.update();
  controls.reset();
  controls.enableDamping = true;
  host.focus({preventScroll:true});
});
host.addEventListener('keydown', event => {
  if (!loaded) return;
  const keys = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'];
  if (!keys.includes(event.key)) return;
  event.preventDefault();
  const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
  if(event.key === 'ArrowLeft') spherical.theta -= 0.1;
  if(event.key === 'ArrowRight') spherical.theta += 0.1;
  if(event.key === 'ArrowUp') spherical.phi -= 0.1;
  if(event.key === 'ArrowDown') spherical.phi += 0.1;
  if(event.key === '+' || event.key === '=') spherical.radius *= 0.9;
  if(event.key === '-') spherical.radius *= 1.1;
  spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.001, Math.PI - 0.001);
  spherical.radius = THREE.MathUtils.clamp(spherical.radius, controls.minDistance, controls.maxDistance);
  camera.position.setFromSpherical(spherical).add(controls.target);
  controls.update();
});
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
