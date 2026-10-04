import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ColorService } from './ColorService.js';

const MM_TO_SCENE_UNITS = 0.01; // 1200mm pallet -> 12 scene units

/**
 * Owns the Three.js scene/camera/renderer/controls lifecycle for the 3D
 * pallet view. Kept as a plain class (not a hook) so all the imperative,
 * non-React Three.js bookkeeping lives in one place; the React side only
 * ever calls init/build/resize/dispose through a thin ref-based hook.
 */
export class ThreeSceneController {
  constructor(hostElement) {
    this.host = hostElement;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.group = null;
    this.autorotate = false;
    this._rafId = null;
    this._resizeObserver = null;
    this._onWindowResize = () => this.resize();
  }

  /** Returns true on success; false if WebGL/Three could not be initialized. */
  init() {
    const host = this.host;
    const width = host.clientWidth || 800;
    const height = host.clientHeight || 500;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    } catch {
      host.innerHTML =
        '<div style="padding:24px;color:#e7a13a">3D view unavailable: this browser does not support ' +
        'WebGL. The 2D Top/Side views and the table still work fully.</div>';
      return false;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c1118);
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    host.innerHTML = '';
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(40, 80, 30);
    scene.add(dir);
    const dir2 = new THREE.DirectionalLight(0x88aaff, 0.25);
    dir2.position.set(-30, 20, -40);
    scene.add(dir2);

    const group = new THREE.Group();
    scene.add(group);

    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.controls = controls;
    this.group = group;

    if (window.ResizeObserver) {
      this._resizeObserver = new ResizeObserver(() => this.resize());
      this._resizeObserver.observe(host);
    }
    window.addEventListener('resize', this._onWindowResize);

    const loop = () => {
      this._rafId = requestAnimationFrame(loop);
      if (this.autorotate) group.rotation.y += 0.0035;
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    return true;
  }

  resize() {
    if (!this.renderer) return;
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /** Clears and rebuilds the pallet + boxes geometry from a StackResult. */
  build(result) {
    const g = this.group;
    while (g.children.length) g.remove(g.children[0]);
    g.rotation.set(0, 0, 0);
    if (!result || !result.layers.length) return;

    const pallet = result.config.pallet;
    const S = MM_TO_SCENE_UNITS;
    const cx = pallet.length / 2;
    const cz = pallet.width / 2; // centre the pallet on the origin

    const deckGeo = new THREE.BoxGeometry(pallet.length * S, Math.max(pallet.deckHeight, 20) * S, pallet.width * S);
    const deckMat = new THREE.MeshLambertMaterial({ color: 0x6b5331 });
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.set(0, (pallet.deckHeight * S) / 2, 0);
    g.add(deck);
    const deckEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(deckGeo),
      new THREE.LineBasicMaterial({ color: 0x3a2c18 })
    );
    deckEdges.position.copy(deck.position);
    g.add(deckEdges);

    const n = result.layers.length;
    const drawEdges = result.placed.length <= 600;
    const gap = 2; // mm visual gap between boxes
    result.placed.forEach((b) => {
      const dx = Math.max(b.dimX - gap, 1);
      const dy = Math.max(b.dimY - gap, 1);
      const dz = Math.max(b.dimZ - gap, 1);
      const geo = new THREE.BoxGeometry(dx * S, dz * S, dy * S); // y(up)=dimZ, z(depth)=dimY
      const mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(ColorService.layerColor(b.layer, n)) });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set((b.x + b.dimX / 2 - cx) * S, (b.z + b.dimZ / 2) * S, (b.y + b.dimY / 2 - cz) * S);
      g.add(mesh);
      if (drawEdges) {
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(geo),
          new THREE.LineBasicMaterial({ color: 0x0c1118 })
        );
        edges.position.copy(mesh.position);
        g.add(edges);
      }
    });

    const gridSize = Math.max(pallet.length, pallet.width) * S * 1.8;
    const gridHelper = new THREE.GridHelper(gridSize, 18, 0x2b384a, 0x1a2533);
    gridHelper.position.y = 0;
    g.add(gridHelper);

    this.resetView(result);
  }

  resetView(result) {
    if (!result) return;
    const pallet = result.config.pallet;
    const S = MM_TO_SCENE_UNITS;
    const span = Math.max(pallet.length, pallet.width, result.totalHeight) * S;
    const d = span * 1.7;
    this.camera.position.set(d * 0.9, d * 0.8, d * 1.0);
    this.controls.target.set(0, (result.totalHeight * S) / 2, 0);
    this.controls.update();
  }

  setAutorotate(value) {
    this.autorotate = value;
  }

  getPng() {
    if (!this.renderer) return null;
    this.renderer.render(this.scene, this.camera);
    try {
      return this.renderer.domElement.toDataURL('image/png');
    } catch {
      return null;
    }
  }

  dispose() {
    if (this._rafId != null) cancelAnimationFrame(this._rafId);
    window.removeEventListener('resize', this._onWindowResize);
    if (this._resizeObserver) this._resizeObserver.disconnect();
    if (this.controls) this.controls.dispose();
    if (this.renderer) this.renderer.dispose();
  }
}
