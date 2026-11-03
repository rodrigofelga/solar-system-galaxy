import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GALACTIC_FEATURES } from './data/galactic-features.js';
import { localizedFeature } from './i18n/galactic-features-pt.js';
import { GalacticBlackHole } from './galactic-black-hole.js';
import { GalaxySky } from './galaxy-sky.js';
import { LENS_QUALITY } from './black-hole-lens.js';
import { BLACK_HOLE_TEXT } from './data/black-hole-text.js';
import { watchOnScreen } from './on-screen.js';

const TAU = Math.PI * 2;
const OVERVIEW = [0, 65, 83];
const WIDE_FOV = 46;
// A longer lens for the close-up, so the disk stays in proportion to the shadow.
const CLOSEUP_FOV = 30;
const CLOSEUP_VIEWS = { cinematic: [1.8, 0.82, 8.3], threeQuarter: [3.6, 3.9, 6.2], face: [0, 8.2, 1.6], edge: [0, 0.14, 7.6] };
// Frames slower than this, on average, lower the close-up's quality one level.
const SLOW_FRAME = 1 / 38;
const QUALITY_WINDOW = 45;
const warpHeight = (r, a) => 5.5 * Math.pow(Math.max(0, (r - 23) / 27), 1.7) * Math.sin(a - 0.5);

/** An illustrative volume, not a reconstruction of Gaia catalogue positions. */
export class GalaxyView {
  constructor(container) {
    this.container = container;
    this.phase = -0.7;
    this.showOrbit = true;
    this.labelsVisible = true;
    this.anchors = new Map();
    this.transition = null;
    this.viewPreset = 'overview';
    this.tourTime = null;
    this.seed = 721;
    this.available = false;
    this.journey = null;
    this.language = 'en';
    this.flowPlaying = true;
    this.flowSpeed = 1;
    this.flowHeldByMotion = false;
    this.onScreen = true;
    this.status = document.querySelector('#galaxy-status');
    this.bindUI();
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.compact = window.matchMedia('(pointer: coarse)').matches;
      this.basePixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
      this.renderer.setPixelRatio(this.basePixelRatio);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.setClearColor(0x02040b);
      this.renderer.domElement.setAttribute('aria-hidden', 'true');
      container.prepend(this.renderer.domElement);
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(46, 1, 0.05, 900);
      this.camera.position.fromArray(OVERVIEW);
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.minDistance = 2;
      this.controls.maxDistance = 340;
      this.controls.addEventListener('start', () => { this.transition = null; this.viewPreset = null; this.stopTour(); });
      this.sky = new GalaxySky(this.renderer, this.compact);
      this.scene.add(this.sky.mesh);
      this.createGalaxy();
      this.qualityLevel = this.compact ? 1 : 0;
      this.qualityFrames = 0; this.qualityTime = 0;
      this.blackHole.lens.setSteps(LENS_QUALITY[this.qualityLevel].steps);
      this.createLabels();
      this.bindPicking();
      this.renderer.domElement.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        this.fail('The galactic view lost its graphics context. Reload to restore it.');
      });
      this.available = true;
      this.resize();
      this.observer = new ResizeObserver(() => this.resize());
      this.observer.observe(container);
      this.visibility = watchOnScreen(container, (onScreen) => { this.onScreen = onScreen; });
      this.status.textContent = 'Drag to orbit · scroll to zoom · right-drag to pan · click a label to explore';
    } catch (error) {
      console.error('Galactic explorer could not start.', error);
      this.renderer?.domElement.remove();
      this.renderer?.dispose();
      this.fail('The 3D galactic view could not start. Check WebGL and hardware acceleration, then reload.');
    }
  }

  random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  pointCloud(count, sample, size, opacity = 1, dark = false) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();
    for (let i = 0; i < count; i += 1) {
      const point = sample(i);
      positions.set(point.position, i * 3);
      color.set(point.color).multiplyScalar(point.brightness ?? 1);
      colors.set([color.r, color.g, color.b], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.ShaderMaterial({
      uniforms: { uSize: { value: size }, uOpacity: { value: opacity }, uPixels: { value: 600 } },
      vertexColors: true, transparent: true, depthWrite: false, blending: dark ? THREE.NormalBlending : THREE.AdditiveBlending,
      vertexShader: `uniform float uSize; uniform float uPixels; varying vec3 vColor;
        void main() { vColor = color; vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv; gl_PointSize = clamp(uSize * uPixels / max(1.0, -mv.z), 1.0, 48.0); }`,
      fragmentShader: `uniform float uOpacity; varying vec3 vColor;
        void main() { float d = length(gl_PointCoord - 0.5) * 2.0;
          if (d > 1.0) discard; float a = exp(-d*d*5.0) * (1.0-smoothstep(0.6,1.0,d));
          gl_FragColor = vec4(vColor, a * uOpacity); }`,
    });
    const cloud = new THREE.Points(geometry, material);
    if (dark) cloud.renderOrder = 1;
    cloud.userData.baseOpacity = opacity;
    this.scene.add(cloud);
    return cloud;
  }

  createGalaxy() {
    const { compact } = this;
    this.clouds = [];
    // Most stars are faint and a few are bright, as in a real field, so structure shows instead of a uniform haze.
    const starLight = (low, high) => low + (high - low) * Math.pow(this.random(), 3.2);
    // A warm diffuse disk and blue young stars along four schematic spiral arms.
    this.clouds.push(this.pointCloud(compact ? 16000 : 34000, (i) => {
      const r = 4 + Math.pow(this.random(), 0.7) * 46;
      const inArm = this.random() < 0.72;
      const a = inArm ? i % 4 * TAU / 4 + Math.log(r / 5) * 2.65 + (this.random() + this.random() - 1) * 0.48 : this.random() * TAU;
      return { position: [r * Math.cos(a), warpHeight(r, a) + (this.random() + this.random() - 1) * (0.4 + r * 0.018), r * Math.sin(a)], color: inArm ? (this.random() < 0.1 ? '#e8a3bd' : '#9ec3f2') : '#b5ab9f', brightness: starLight(0.42, 1.9) };
    }, 0.27, 1));
    this.clouds.push(this.pointCloud(compact ? 5000 : 11000, () => {
      const r = Math.sqrt(this.random()) * 46;
      const a = this.random() * TAU;
      return { position: [r * Math.cos(a), warpHeight(r, a) + (this.random() + this.random() - 1) * 4, r * Math.sin(a)], color: '#b9a48e', brightness: starLight(0.25, 1) };
    }, 0.34, 0.34));
    this.clouds.push(this.pointCloud(compact ? 4500 : 10000, () => {
      const r = Math.pow(this.random(), 1.4) * 10;
      const a = this.random() * TAU;
      const z = this.random() * 2 - 1;
      return { position: [r * Math.sqrt(1 - z * z) * Math.cos(a), r * z * 0.48, r * Math.sqrt(1 - z * z) * Math.sin(a)], color: this.random() < 0.35 ? '#ffc58e' : '#f6dcb6', brightness: starLight(0.3, 1.5) };
    }, 0.25, 0.5));
    this.clouds.push(this.pointCloud(compact ? 2500 : 6000, () => ({
      position: [(this.random() + this.random() - 1) * 15, (this.random() - 0.5) * 1.5, (this.random() + this.random() - 1) * 2.8], color: '#f3cda2', brightness: starLight(0.25, 1.3),
    }), 0.25, 0.42));
    this.clouds.push(this.pointCloud(compact ? 1200 : 3000, () => {
      const r = 12 + this.random() * 65;
      const a = this.random() * TAU;
      const z = this.random() * 2 - 1;
      return { position: [r * Math.sqrt(1 - z * z) * Math.cos(a), r * z * 0.7, r * Math.sqrt(1 - z * z) * Math.sin(a)], color: '#c7b6a2' };
    }, 0.21, 0.4));
    // Pink clusters evoke H II regions without claiming measured cloud positions.
    this.clouds.push(this.pointCloud(compact ? 700 : 1500, (i) => {
      const cluster = i % 24;
      const r = 13 + (cluster % 6) * 6;
      const a = cluster % 4 * TAU / 4 + Math.log(r / 5) * 2.65;
      const spread = () => (this.random() + this.random() - 1) * 2.8;
      return { position: [r * Math.cos(a) + spread(), warpHeight(r, a) + spread() * 0.4, r * Math.sin(a) + spread()], color: i % 5 === 0 ? '#79a6d8' : '#d9709f', brightness: starLight(0.35, 1) };
    }, 0.8, 0.2));
    // A faint glow of unresolved stars, so the arms and the bulge read as structure and not only as points.
    this.clouds.push(this.pointCloud(compact ? 600 : 1300, (i) => {
      const r = 5 + Math.pow(this.random(), 0.8) * 42;
      const a = i % 4 * TAU / 4 + Math.log(r / 5) * 2.65 + (this.random() + this.random() - 1) * 0.3;
      return { position: [r * Math.cos(a), warpHeight(r, a), r * Math.sin(a)], color: i % 7 === 0 ? '#a8618a' : '#4f6fae' };
    }, 4.2, 0.09));
    this.clouds.push(this.pointCloud(compact ? 220 : 420, () => {
      const r = Math.pow(this.random(), 1.6) * 8;
      const a = this.random() * TAU;
      return { position: [r * Math.cos(a) * 1.5, (this.random() - 0.5) * r * 0.5, r * Math.sin(a) * 0.8], color: '#c98a52' };
    }, 5, 0.1));
    // Dark dust along the inner edge of each arm and across the bulge.
    this.clouds.push(this.pointCloud(compact ? 1100 : 2400, (i) => {
      const onBulge = i % 6 === 0;
      const r = onBulge ? 2 + this.random() * 9 : 6 + Math.pow(this.random(), 0.75) * 40;
      const a = onBulge ? this.random() * TAU : i % 4 * TAU / 4 + Math.log(r / 5) * 2.65 - 0.34 + (this.random() + this.random() - 1) * 0.3;
      return { position: [r * Math.cos(a), warpHeight(r, a) + (this.random() - 0.5) * 0.35, r * Math.sin(a)], color: '#0a0607' };
    }, 3.2, 0.065, true));
    this.darkHalo = new THREE.Group();
    for (let i = 0; i < 3; i += 1) {
      const points = Array.from({ length: 161 }, (_, j) => new THREE.Vector3(Math.cos(j / 160 * TAU) * 96, 0, Math.sin(j / 160 * TAU) * 96));
      const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0xa178d9, transparent: true, opacity: 0.28 }));
      if (i === 1) ring.rotation.x = Math.PI / 2;
      if (i === 2) ring.rotation.z = Math.PI / 2;
      this.darkHalo.add(ring);
    }
    this.darkHalo.visible = false;
    this.scene.add(this.darkHalo);
    const orbitPoints = Array.from({ length: 193 }, (_, i) => new THREE.Vector3(Math.cos(i / 192 * TAU) * 26, 0.2, Math.sin(i / 192 * TAU) * 26));
    this.orbit = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(orbitPoints), new THREE.LineBasicMaterial({ color: 0xffcf70, transparent: true, opacity: 0.55 }));
    this.scene.add(this.orbit);
    this.sun = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffe6a4 }));
    this.scene.add(this.sun);
    this.blackHole = new GalacticBlackHole(this.sky.texture);
    this.scene.add(this.blackHole.group, this.blackHole.lens.mesh);
    this.highlight = new THREE.Mesh(new THREE.RingGeometry(0.65, 0.78, 48), new THREE.MeshBasicMaterial({ color: 0x8cddff, side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthTest: false }));
    this.highlight.visible = false;
    this.scene.add(this.highlight);
    this.updateSun();
  }

  createLabels() {
    GALACTIC_FEATURES.forEach((feature) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'galaxy-label'; button.textContent = feature.label;
      button.setAttribute('aria-label', `Explore ${feature.label}`);
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => this.selectFeature(feature.id));
      this.container.append(button);
      this.anchors.set(feature.id, { button, position: new THREE.Vector3(...feature.position) });
    });
  }

  bindUI() {
    this.selector = document.querySelector('#galaxy-feature');
    GALACTIC_FEATURES.forEach((feature) => {
      const option = document.createElement('option');
      option.value = feature.id; option.textContent = feature.label; this.selector.append(option);
    });
    this.selector.addEventListener('change', () => { if (this.selector.value) this.selectFeature(this.selector.value); });
    document.querySelectorAll('[data-galaxy-view]').forEach((button) => button.addEventListener('click', () => this.setView(button.dataset.galaxyView)));
    document.querySelector('#galaxy-black-hole').addEventListener('click', () => this.selectFeature('black-hole'));
    this.tourButton = document.querySelector('#galaxy-tour');
    this.tourButton.addEventListener('click', () => {
      if (!this.available) return;
      if (this.tourTime !== null) this.stopTour();
      else { this.tourTime = 0; this.tourStep = -1; this.tourButton.textContent = 'Stop tour'; this.tourButton.setAttribute('aria-pressed', 'true'); }
    });
    document.querySelector('#galaxy-labels').addEventListener('click', (event) => {
      this.labelsVisible = !this.labelsVisible;
      event.currentTarget.textContent = this.labelsVisible ? 'Hide labels' : 'Show labels';
      event.currentTarget.setAttribute('aria-pressed', String(this.labelsVisible));
    });
    document.querySelector('#galaxy-halo').addEventListener('click', (event) => {
      if (!this.available) return;
      this.darkHalo.visible = !this.darkHalo.visible;
      event.currentTarget.setAttribute('aria-pressed', String(this.darkHalo.visible));
      event.currentTarget.textContent = this.darkHalo.visible ? 'Hide dark halo' : 'Show dark halo';
      if (this.darkHalo.visible) this.selectFeature('dark-halo');
      else { this.stopTour(); if (this.selected === 'dark-halo') this.closePanel(); }
    });
    document.querySelector('#galaxy-panel-close').addEventListener('click', () => this.closePanel());
    this.bindCloseupControls();
    document.querySelector('#galaxy-fullscreen').addEventListener('click', async () => {
      const section = document.querySelector('#galaxy-panel');
      try {
        if (document.fullscreenElement === section) await document.exitFullscreen();
        else if (section.requestFullscreen) await section.requestFullscreen();
        else throw new Error('Fullscreen unavailable');
      } catch { this.status.textContent = 'Fullscreen is unavailable in this browser. You can still orbit, zoom, and pan here.'; }
    });
    document.addEventListener('fullscreenchange', () => {
      document.querySelector('#galaxy-fullscreen').textContent = document.fullscreenElement === document.querySelector('#galaxy-panel') ? 'Exit fullscreen' : 'Fullscreen';
      this.resize();
    });
  }

  bindCloseupControls() {
    this.closeupControls = document.querySelector('#black-hole-controls');
    this.flowButton = document.querySelector('#black-hole-play');
    this.flowButton.addEventListener('click', () => {
      if (!this.globalPlaying) { this.resumeGlobal?.(); this.flowPlaying = true; } else this.flowPlaying = !this.flowPlaying;
      this.flowHeldByMotion = false;
      this.updateCloseupControls();
    });
    this.closeupControls.querySelectorAll('[data-flow-speed]').forEach((button) => button.addEventListener('click', () => { this.flowSpeed = Number(button.dataset.flowSpeed); this.updateCloseupControls(); }));
    this.closeupControls.querySelectorAll('[data-closeup-view]').forEach((button) => button.addEventListener('click', () => this.setCloseupView(button.dataset.closeupView)));
    document.querySelector('#black-hole-reset').addEventListener('click', () => this.setCloseupView('cinematic'));
    this.renderCloseupText();
  }

  setCloseupView(name) {
    if (!this.available || !this.blackHole.closeup) return;
    this.closeupView = name;
    const offset = new THREE.Vector3(...CLOSEUP_VIEWS[name]).multiplyScalar(Math.max(1, 1.35 / this.camera.aspect));
    this.viewPreset = null;
    this.moveCamera(offset, new THREE.Vector3());
    this.updateCloseupControls();
  }

  // People who ask for less motion get the destination without the flight.
  moveCamera(position, target) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.transition = null; this.camera.position.copy(position); this.controls.target.copy(target);
    } else this.transition = { position, target };
  }

  renderCloseupText() {
    const text = BLACK_HOLE_TEXT[this.language] ?? BLACK_HOLE_TEXT.en;
    this.closeupControls.setAttribute('aria-label', text.controlsLabel);
    this.closeupControls.querySelectorAll('[data-closeup-text]').forEach((node) => { node.textContent = text[node.dataset.closeupText]; });
    this.closeupControls.querySelectorAll('[data-flow-speed]').forEach((button) => { button.textContent = `${text.number(button.dataset.flowSpeed)}×`; });
    this.updateCloseupControls();
  }

  updateCloseupControls() {
    const text = BLACK_HOLE_TEXT[this.language] ?? BLACK_HOLE_TEXT.en;
    const held = this.globalPlaying === false;
    this.flowButton.textContent = held ? text.resume : this.flowPlaying ? text.pause : text.play;
    this.flowButton.setAttribute('aria-pressed', String(!this.flowPlaying || held));
    this.closeupControls.querySelectorAll('[data-flow-speed]').forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.flowSpeed) === this.flowSpeed)));
    this.closeupControls.querySelectorAll('[data-closeup-view]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.closeupView === this.closeupView)));
    const note = document.querySelector('#black-hole-note');
    note.textContent = this.flowHeldByMotion ? text.reducedMotion : ''; note.hidden = !this.flowHeldByMotion;
  }

  closePanel() {
    const wasBlackHoleCloseup = this.blackHole?.closeup;
    document.querySelector('#galaxy-info').hidden = true;
    this.selected = null;
    this.setBlackHoleFocus(false);
    if (this.highlight) this.highlight.visible = false;
    this.selector.value = '';
    this.anchors.forEach(({ button }) => button.setAttribute('aria-pressed', 'false'));
    this.stopTour();
    if (wasBlackHoleCloseup) this.setView('overview');
  }

  bindPicking() {
    const pointers = new Set();
    let start = null;
    let multi = false;
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', (event) => {
      pointers.add(event.pointerId);
      if (pointers.size === 1) { start = [event.clientX, event.clientY]; multi = false; }
      else multi = true;
    });
    canvas.addEventListener('pointercancel', (event) => pointers.delete(event.pointerId));
    canvas.addEventListener('pointerup', (event) => {
      pointers.delete(event.pointerId);
      if (event.button !== 0 || multi || !start || Math.hypot(event.clientX - start[0], event.clientY - start[1]) > 7) return;
      const rect = canvas.getBoundingClientRect();
      let nearest = null;
      let distance = 46;
      this.anchors.forEach((anchor, id) => {
        if (id === 'dark-halo' && !this.darkHalo.visible) return;
        const p = anchor.position.clone().project(this.camera);
        if (p.z < -1 || p.z > 1) return;
        const d = Math.hypot((p.x + 1) * rect.width / 2 - (event.clientX - rect.left), (1 - p.y) * rect.height / 2 - (event.clientY - rect.top));
        if (d < distance) { distance = d; nearest = id; }
      });
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), this.camera);
      if (nearest) this.selectFeature(nearest);
      else if (ray.ray.intersectsSphere(new THREE.Sphere(new THREE.Vector3(), 50))) this.selectFeature('disk', false);
    });
  }

  setLanguage(language) {
    this.language = language;
    const isPortuguese = language === 'pt-BR';
    GALACTIC_FEATURES.forEach((feature) => {
      const { label } = localizedFeature(feature, language);
      const { button } = this.anchors.get(feature.id) ?? {};
      if (button) {
        button.textContent = label;
        button.setAttribute('aria-label', `${isPortuguese ? 'Explorar' : 'Explore'} ${label}`);
      }
      const option = this.selector?.querySelector(`option[value="${feature.id}"]`);
      if (option) option.textContent = label;
    });
    this.renderCloseupText();
    if (this.selected && !document.querySelector('#galaxy-info').hidden) this.renderFeature(GALACTIC_FEATURES.find((item) => item.id === this.selected));
  }

  renderFeature(source) {
    const feature = localizedFeature(source, this.language);
    document.querySelector('#galaxy-info-title').textContent = feature.label;
    document.querySelector('#galaxy-info-scale').textContent = feature.scale;
    document.querySelector('#galaxy-info-description').textContent = feature.description;
    document.querySelector('#galaxy-info-fact').textContent = feature.fact;
    const details = document.querySelector('#galaxy-info-details');
    details.replaceChildren(...(feature.details || []).map((item) => {
      const wrapper = document.createElement('div');
      const term = document.createElement('dt'); term.textContent = item.label;
      const definition = document.createElement('dd'); definition.append(`${item.text} `);
      const link = document.createElement('a');
      link.href = item.source; link.textContent = item.sourceLabel;
      link.target = '_blank'; link.rel = 'noopener noreferrer';
      definition.append(link); wrapper.append(term, definition);
      return wrapper;
    }));
    details.hidden = !feature.details;
    const sourceLink = document.querySelector('#galaxy-info-source');
    sourceLink.href = feature.source; sourceLink.textContent = feature.sourceLabel;
    this.renderConcepts(source.id === 'black-hole');
  }

  renderConcepts(visible) {
    const section = document.querySelector('#galaxy-info-concepts'); section.hidden = !visible;
    if (!visible) return;
    const text = BLACK_HOLE_TEXT[this.language] ?? BLACK_HOLE_TEXT.en;
    section.querySelector('h3').textContent = text.conceptsTitle;
    section.querySelector('dl').replaceChildren(...text.concepts.map((item) => {
      const wrapper = document.createElement('div');
      const term = document.createElement('dt'); term.textContent = item.label;
      const definition = document.createElement('dd'); definition.append(`${item.text} `);
      const link = document.createElement('a');
      link.href = item.source; link.textContent = item.sourceLabel;
      link.target = '_blank'; link.rel = 'noopener noreferrer';
      definition.append(link); wrapper.append(term, definition);
      return wrapper;
    }));
  }

  selectFeature(id, focus = true, touring = false) {
    if (!this.available) return;
    const feature = GALACTIC_FEATURES.find((item) => item.id === id);
    if (!feature) return;
    if (!touring) this.stopTour();
    this.viewPreset = null;
    this.selected = id;
    this.setBlackHoleFocus(id === 'black-hole');
    this.selector.value = id;
    this.renderFeature(feature);
    document.querySelector('#galaxy-info').hidden = false;
    this.anchors.forEach(({ button }, key) => button.setAttribute('aria-pressed', String(key === id)));
    if (id === 'dark-halo') {
      this.darkHalo.visible = true;
      const button = document.querySelector('#galaxy-halo');
      button.textContent = 'Hide dark halo'; button.setAttribute('aria-pressed', 'true');
    }
    if (id === 'black-hole' && focus) { this.setCloseupView('cinematic'); return; }
    if (focus) {
      const target = id === 'dark-halo' ? new THREE.Vector3() : this.anchors.get(id).position;
      const offset = new THREE.Vector3(...(feature.offset || [8, 13, 22]));
      this.transition = { position: target.clone().add(offset), target: target.clone() };
    }
  }

  setView(view) {
    if (!this.available) return;
    this.stopTour();
    this.setBlackHoleFocus(false);
    this.viewPreset = view;
    this.transition = { position: this.presetPosition(view), target: new THREE.Vector3() };
    this.status.textContent = view === 'edge' || view === 'warp' ? 'Disk thickness and outer warp are exaggerated for visibility. Drag to explore from any angle.' : 'Drag to orbit · scroll to zoom · right-drag to pan · click a label to explore';
  }

  presetPosition(view) {
    const positions = { overview: OVERVIEW, top: [0, 125, 0.01], edge: [0, 6, 125], warp: [95, 15, 60] };
    return new THREE.Vector3(...(positions[view] || OVERVIEW)).multiplyScalar(Math.max(1, 1.25 / this.camera.aspect));
  }

  setBlackHoleFocus(enabled) {
    const changed = enabled !== Boolean(this.blackHole?.closeup);
    this.blackHole?.setCloseup(enabled);
    if (changed && this.available) this.applyQuality();
    this.closeupControls.hidden = !enabled;
    if (changed && enabled && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { this.flowPlaying = false; this.flowHeldByMotion = true; }
    if (!enabled) this.closeupView = null;
    this.updateCloseupControls();
    this.container.classList.toggle('black-hole-closeup', enabled);
    const badge = document.querySelector('#galaxy-scale-badge');
    badge.hidden = !enabled;
    this.status.textContent = enabled ? 'Sagittarius A* close-up · greatly enlarged · drag to orbit the gas disk · Galaxy overview returns to the full galaxy' : 'Drag to orbit · scroll to zoom · right-drag to pan · click a label to explore';
    this.onStatusChange?.();
  }

  applyQuality() {
    const scale = this.blackHole.closeup ? LENS_QUALITY[this.qualityLevel].pixelScale : 1;
    const cap = this.compact ? Math.min(this.basePixelRatio, 1.25) : this.basePixelRatio;
    this.renderer.setPixelRatio((this.blackHole.closeup ? cap : this.basePixelRatio) * scale);
    this.blackHole.lens.setSteps(LENS_QUALITY[this.qualityLevel].steps);
    this.updatePointScale();
  }

  updatePointScale() {
    const height = this.container.clientHeight * this.renderer.getPixelRatio();
    this.clouds?.forEach((cloud) => { cloud.material.uniforms.uPixels.value = height; });
  }

  // Only frames with the close-up fully showing count, so a slow transition cannot lower quality.
  watchQuality(delta) {
    if (this.blackHole.lens.mix < 1 || delta > 0.25 || !this.onScreen) { this.qualityFrames = 0; this.qualityTime = 0; return; }
    this.qualityFrames += 1; this.qualityTime += delta;
    if (this.qualityFrames < QUALITY_WINDOW) return;
    const slow = this.qualityTime / this.qualityFrames > SLOW_FRAME;
    this.qualityFrames = 0; this.qualityTime = 0;
    if (slow && this.qualityLevel < LENS_QUALITY.length - 1) { this.qualityLevel += 1; this.applyQuality(); }
  }

  stopTour() {
    this.tourTime = null;
    this.tourButton.textContent = 'Guided tour'; this.tourButton.setAttribute('aria-pressed', 'false');
  }

  updateSun() {
  this.sun.position.set(Math.cos(this.phase) * 26, 0.2, Math.sin(this.phase) * 26);
  this.anchors.get('sun')?.position.copy(this.sun.position);
  }

  reset() {
    this.phase = -0.7; this.showOrbit = true; this.setView('overview'); this.closePanel();
  }

  update(delta, speed, isPlaying) {
    if (!this.available) return;
    // The journey runs its own clock and draws this same scene from its own cameras.
    if (this.journey?.active) {
      this.blackHole.lens.mix = 0; this.blackHole.group.visible = true; this.sky.mesh.visible = false;
      this.clouds.forEach((cloud) => { cloud.visible = true; });
      this.blackHole.update(delta, this.journey.scene.views.main.camera);
      this.journey.update(delta); return;
    }
    if (this.globalPlaying !== isPlaying) { this.globalPlaying = isPlaying; this.updateCloseupControls(); }
    if (isPlaying) this.phase += delta * speed * 0.105;
    this.updateSun();
    this.orbit.visible = this.showOrbit && !this.blackHole.closeup;
    if (this.tourTime !== null && isPlaying) {
      this.tourTime += delta * speed;
      const stops = ['disk', 'bar', 'bulge', 'black-hole', 'arms', 'nurseries', 'sun', 'thick-disk', 'medium', 'warp', 'halo', 'dark-halo'];
      const step = Math.floor(this.tourTime / 7);
      if (step >= stops.length) { this.stopTour(); this.setView('overview'); }
      else if (step !== this.tourStep) { this.tourStep = step; this.selectFeature(stops[step], true, true); }
    }
    if (this.transition) {
      const alpha = 1 - Math.exp(-delta * 3);
      this.camera.position.lerp(this.transition.position, alpha);
      this.controls.target.lerp(this.transition.target, alpha);
      if (this.camera.position.distanceTo(this.transition.position) < 0.02 && this.controls.target.distanceTo(this.transition.target) < 0.02) this.transition = null;
    }
    const fov = this.blackHole.closeup ? CLOSEUP_FOV : WIDE_FOV;
    if (this.camera.fov !== fov) {
      this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-delta * 3));
      if (Math.abs(this.camera.fov - fov) < 0.02) this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    this.controls.update(); this.camera.updateMatrixWorld();
    this.blackHole.update(isPlaying ? delta * speed : 0, this.camera);
    const flowDelta = isPlaying && this.flowPlaying ? delta * this.flowSpeed : 0;
    const lensMix = this.blackHole.updateCloseup(delta, flowDelta, this.camera, this.container.clientHeight * this.renderer.getPixelRatio());
    this.watchQuality(delta);
    // Once the close-up covers the view, everything behind it is skipped.
    const covered = lensMix >= 1;
    this.sky.mesh.visible = !covered;
    this.sky.update(this.camera, this.container.clientHeight * this.renderer.getPixelRatio());
    this.clouds.forEach((cloud) => {
      cloud.visible = !covered;
      const targetOpacity = cloud.userData.baseOpacity * (1 - lensMix);
      cloud.material.uniforms.uOpacity.value += (targetOpacity - cloud.material.uniforms.uOpacity.value) * (1 - Math.exp(-delta * 5));
    });
    const occupied = [];
    // Selected labels win collisions; the selector always exposes every structure.
    const ordered = [...this.anchors].sort(([a], [b]) => Number(b === this.selected) - Number(a === this.selected));
    ordered.forEach(([id, { button, position }]) => {
      const p = position.clone().project(this.camera);
      button.hidden = !this.labelsVisible || this.blackHole.closeup || p.z < -1 || p.z > 1 || Math.abs(p.x) > 0.94 || Math.abs(p.y) > 0.9 || (id === 'dark-halo' && !this.darkHalo.visible);
      if (button.hidden) return;
      const x = (p.x + 1) * this.container.clientWidth / 2;
      const y = (1 - p.y) * this.container.clientHeight / 2;
      const labelY = id === 'black-hole'
        ? y - 34
        : id === 'sun'
          ? y - button.offsetHeight / 2 - 12
          : y;
      const halfWidth = button.offsetWidth / 2;
      const halfHeight = button.offsetHeight / 2;
      const box = { left: x - halfWidth - 4, right: x + halfWidth + 4, top: labelY - halfHeight - 3, bottom: labelY + halfHeight + 3 };
      button.hidden = box.left < 4 || box.right > this.container.clientWidth - 4 || occupied.some((other) => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top);
      if (!button.hidden) occupied.push(box);
      button.style.left = `${x}px`; button.style.top = `${labelY}px`;
    });
    this.highlight.visible = Boolean(this.selected && this.selected !== 'dark-halo' && this.selected !== 'black-hole');
    if (this.highlight.visible) {
      this.highlight.position.copy(this.anchors.get(this.selected).position);
      this.highlight.quaternion.copy(this.camera.quaternion);
    }
    if (lensMix > 0 && !this.onScreen) return;
    this.renderer.render(this.scene, this.camera);
  }

  fail(message) {
    this.available = false; this.status.textContent = message;
    const fallback = document.querySelector('#galaxy-fallback');
    fallback.textContent = message; fallback.hidden = false;
    document.querySelectorAll('#galaxy-panel button, #galaxy-panel select').forEach((control) => { control.disabled = true; });
  }

  resize() {
    if (!this.renderer || !this.camera) return;
    const width = this.container.clientWidth; const height = this.container.clientHeight;
    if (!width || !height) return;
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
    if (this.viewPreset) {
      this.camera.position.copy(this.presetPosition(this.viewPreset));
      this.controls.target.set(0, 0, 0);
      this.transition = null;
      this.controls.update();
    }
    this.renderer.setSize(width, height, false);
    this.updatePointScale();
    this.journey?.resize();
  }
}
