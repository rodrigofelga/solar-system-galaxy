import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PLANETS } from './data/planets.js';
import { BODY_ORDER, CELESTIAL_BODIES } from './data/celestial-bodies.js';
import { SolarSun } from './sun/solar-sun.js';
import { SolarInteraction } from './sun/solar-interaction.js';

const TAU = Math.PI * 2;
const ORBIT_SECONDS_PER_EARTH_YEAR = 16;
const AXIAL_ROTATION_SECONDS_PER_EARTH_DAY = 4;
const CAMERA_LERP_SPEED = 3.5;

export class SolarSystemView {
  constructor(container, fallback, onSelect) {
    this.container = container;
    this.fallback = fallback;
    this.onSelect = onSelect;
    this.showOrbits = true;
    this.bodies = new Map();
    this.pickableMeshes = [];
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.initialCameraPosition = new THREE.Vector3(0, 46, 86);
    this.initialTarget = new THREE.Vector3();
    this.currentTarget = new THREE.Vector3();
    this.focusTarget = null;
    this.focusPosition = null;
    this.focusOffset = new THREE.Vector3();
    this.selectedName = null;
    this.followSelected = false;
    this.textureLoader = new THREE.TextureLoader();
    this.initialize();
  }

  initialize() {
    let stage = 'creating the WebGL renderer';
    try {
      this.renderer = this.createRenderer();
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.1;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.domElement.setAttribute('aria-hidden', 'true');
      this.renderer.domElement.addEventListener('webglcontextlost', (event) => { event.preventDefault(); this.handleContextLoss(); }, { once: true });
      this.container.append(this.renderer.domElement);

      stage = 'creating the camera controls';
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x02040c);
      this.camera = new THREE.PerspectiveCamera(42, 1, 0.08, 260);
      this.camera.position.copy(this.initialCameraPosition);
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.target.copy(this.initialTarget);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.07;
      this.controls.minDistance = 1.15;
      this.controls.maxDistance = 150;
      this.controls.maxPolarAngle = Math.PI * 0.975;
      this.controls.update();
      this.pointerDown = null;
      this.activePointers = new Set();
      this.multiTouch = false;
      this.renderer.domElement.addEventListener('pointerdown', (event) => {
        this.activePointers.add(event.pointerId);
        if (this.activePointers.size === 1) this.multiTouch = false;
        else this.multiTouch = true;
        this.pointerDown = { x: event.clientX, y: event.clientY };
      });
      this.renderer.domElement.addEventListener('pointerup', (event) => this.pickBody(event));
      this.renderer.domElement.addEventListener('pointercancel', (event) => { this.activePointers.delete(event.pointerId); if (this.activePointers.size === 0) this.multiTouch = false; });

      stage = 'building the Solar System scene';
      this.scene.add(new THREE.HemisphereLight(0x99b7e0, 0x05070c, 0.22));
      this.sunLight = new THREE.PointLight(0xfff0c2, 2500, 0, 1.55);
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(1024, 1024);
      this.scene.add(this.sunLight);
      this.createStarfield();
      this.createSun();
      PLANETS.forEach((planet) => this.createPlanet(planet));
      this.createMoon();

      stage = 'sizing the renderer';
      this.resize();
      this.available = true;
    } catch (error) {
      this.handleInitializationFailure(stage, error);
    }
  }

  createRenderer() {
    const attempts = [
      { label: 'high-performance antialiased WebGL', options: { antialias: true, powerPreference: 'high-performance' } },
      { label: 'browser-default antialiased WebGL', options: { antialias: true } },
      { label: 'browser-default WebGL', options: { antialias: false } },
    ];
    const errors = [];
    for (const attempt of attempts) {
      try { return new THREE.WebGLRenderer(attempt.options); }
      catch (error) { errors.push(`${attempt.label}: ${error instanceof Error ? error.message : String(error)}`); console.warn(`Could not create ${attempt.label}; trying the next compatible renderer option.`, error); }
    }
    throw new Error(`No compatible WebGL rendering context could be created. ${errors.join(' | ')}`);
  }

  handleInitializationFailure(stage, error) {
    console.error(`Solar System Explorer initialization failed while ${stage}.`, error);
    this.available = false;
    this.controls?.dispose();
    if (this.renderer?.domElement?.parentElement === this.container) this.renderer.domElement.remove();
    this.renderer?.dispose();
    this.container.setAttribute('aria-label', 'Solar System Explorer unavailable');
    this.fallback.textContent = `The Solar System Explorer could not finish ${stage}. ${error instanceof Error ? error.message : ''} Reload the page after checking WebGL and hardware-acceleration settings.`;
    this.fallback.hidden = false;
  }

  handleContextLoss() {
    console.error('The Solar System Explorer lost its WebGL rendering context.');
    this.available = false;
    this.fallback.textContent = 'The Solar System Explorer lost its WebGL rendering context. Reload the page and verify that browser hardware acceleration is enabled.';
    this.fallback.hidden = false;
  }

  createStarfield() {
    const count = 2200;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();
    for (let index = 0; index < count; index += 1) {
      const radius = 105 + Math.random() * 85;
      const theta = Math.random() * TAU;
      const phi = Math.acos(2 * Math.random() - 1);
      const offset = index * 3;
      positions[offset] = radius * Math.sin(phi) * Math.cos(theta);
      positions[offset + 1] = radius * Math.cos(phi);
      positions[offset + 2] = radius * Math.sin(phi) * Math.sin(theta);
      color.setHSL(0.55 + Math.random() * 0.12, 0.45, 0.7 + Math.random() * 0.25);
      colors[offset] = color.r; colors[offset + 1] = color.g; colors[offset + 2] = color.b;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.scene.add(new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.42, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.88 })));
  }

  createSun() {
    // Procedural, self-contained Sun (see js/sun/). It is unlit, so the PointLight above still lights the planets.
    const compact = window.matchMedia?.('(pointer: coarse)').matches || Math.min(window.innerWidth, window.innerHeight) < 640;
    const requested = new URLSearchParams(window.location.search).get('sunQuality');
    const forcedQuality = { low: 0, medium: 1, high: 2 }[requested] ?? null;
    this.sun = new SolarSun(3.65, { compact, forcedQuality });
    this.scene.add(this.sun.group);
    this.registerBody('Sun', { mesh: this.sun.mesh, root: this.sun.group, rotationPeriod: 25.38, radius: 3.65, orbitPivot: null });
    this.solarInteraction = new SolarInteraction({ sun: this.sun, camera: this.camera, domElement: this.renderer.domElement, container: this.container });
  }

  /** Enables or disables selectable solar-activity features (markers, prominence picking, hover). */
  setSolarExplore(enabled) { this.solarInteraction?.setEnabled(enabled); }
  /** Highlights a prominence loop (by index) or clears the highlight with null. */
  setSolarLoopSelected(index) { this.sun?.setSelectedLoop(index); }

  createPlanet(data) {
    const orbitPivot = new THREE.Object3D();
    orbitPivot.rotation.y = data.initialAngle;
    this.scene.add(orbitPivot);
    const axialPivot = new THREE.Object3D();
    axialPivot.rotation.z = data.axialTilt;
    axialPivot.position.x = data.orbitRadius;
    orbitPivot.add(axialPivot);
    const material = new THREE.MeshStandardMaterial({ color: data.color, roughness: data.name === 'Earth' ? 0.58 : 0.76, metalness: 0 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(data.radius, 64, 48), material);
    mesh.castShadow = true; mesh.receiveShadow = true;
    axialPivot.add(mesh);
    this.addRotationMarker(mesh, data);
    if (data.name === 'Earth') this.addEarthAtmosphere(axialPivot, data.radius);
    if (data.hasRings) this.addSaturnRings(axialPivot, data.radius);
    const orbit = this.createOrbit(data.orbitRadius);
    this.scene.add(orbit);
    this.registerBody(data.name, { mesh, root: axialPivot, rotationPeriod: data.rotationPeriod, orbitPeriod: data.orbitPeriod, radius: data.radius, orbitPivot, orbit });
    this.loadTexture(data.name, material);
  }

  createMoon() {
    const earth = this.bodies.get('Earth');
    if (!earth) return;
    const moonOrbit = new THREE.Object3D();
    moonOrbit.rotation.z = 5.14 * Math.PI / 180;
    earth.root.add(moonOrbit);
    const moonAnchor = new THREE.Object3D();
    moonAnchor.position.x = 2.75;
    moonOrbit.add(moonAnchor);
    // Adaptive terrain tessellation: lighter mesh on phones/coarse-pointer devices.
    const compact = window.matchMedia?.('(pointer: coarse)').matches || Math.min(window.innerWidth, window.innerHeight) < 640;
    const [widthSegments, heightSegments] = compact ? [128, 64] : [320, 160];
    const moonMaterial = new THREE.MeshStandardMaterial({ color: 0xb8b6ad, roughness: 0.92, metalness: 0 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.28, widthSegments, heightSegments), moonMaterial);
    mesh.castShadow = true; mesh.receiveShadow = true;
    moonAnchor.add(mesh);
    this.loadMoonElevation(moonMaterial);
    const orbit = this.createOrbit(2.75, 0x9cb6d5, 0.44);
    earth.root.add(orbit);
    this.registerBody('Moon', { mesh, root: moonAnchor, rotationPeriod: 27.3, radius: 0.28, moonOrbit, orbit, isMoon: true });
    this.loadTexture('Moon', mesh.material);
  }

  // NASA SVS 4720 LOLA elevation (8-bit, roughly -9.1 km to +10.8 km, ~19.9 km span).
  // True relief is ~1.1% of the Moon's radius; it is exaggerated about 4x so it is visible
  // while the body remains effectively spherical (max radial offset is about +/-2.3%).
  // Bias roughly re-centres the map so mean displaced radius stays at the nominal 0.28.
  loadMoonElevation(material) {
    const MOON_DISPLACEMENT_SCALE = 0.0128;
    const MOON_DISPLACEMENT_BIAS = -0.0128 * 0.46;
    this.textureLoader.load('assets/textures/moon-elevation-nasa-1k.jpg', (texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      texture.needsUpdate = true;
      material.displacementMap = texture;
      material.displacementScale = MOON_DISPLACEMENT_SCALE;
      material.displacementBias = MOON_DISPLACEMENT_BIAS;
      // Displacement does not recompute normals, so the same map drives bump shading for crater relief.
      material.bumpMap = texture;
      material.bumpScale = 2.5;
      material.needsUpdate = true;
    }, undefined, (error) => console.warn('Could not load Moon elevation map; keeping smooth Moon sphere.', error));
  }

  registerBody(name, body) {
    body.name = name;
    body.mesh.userData.bodyName = name;
    this.bodies.set(name, body);
    this.pickableMeshes.push(body.mesh);
  }

  loadTexture(name, material) {
    const info = CELESTIAL_BODIES[name];
    if (!info?.texture) return;
    this.textureLoader.load(info.texture, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.needsUpdate = true;
      material.map = texture;
      material.color.set(0xffffff);
      material.needsUpdate = true;
    }, undefined, (error) => console.warn(`Could not load ${name} texture; keeping procedural material.`, error));
  }

  addEarthAtmosphere(parent, radius) {
    parent.add(new THREE.Mesh(new THREE.SphereGeometry(radius * 1.04, 48, 36), new THREE.MeshBasicMaterial({ color: 0x78caff, transparent: true, opacity: 0.14, side: THREE.BackSide, depthWrite: false })));
    const cloudMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.88,
      roughness: 0.92,
      metalness: 0,
      alphaTest: 0.015,
      depthWrite: false,
    });
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.012, 64, 48), cloudMaterial);
    clouds.userData.cloudLayer = true;
    clouds.renderOrder = 1;
    parent.add(clouds);
    this.textureLoader.load('assets/textures/earth-clouds.png', (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.needsUpdate = true;
      cloudMaterial.map = texture;
      cloudMaterial.needsUpdate = true;
    }, undefined, (error) => console.warn('Could not load Earth cloud texture; keeping the transparent atmospheric shell.', error));
  }

  addRotationMarker(mesh, data) {
    const marker = new THREE.Mesh(new THREE.SphereGeometry(data.radius * 0.1, 12, 8), new THREE.MeshStandardMaterial({ color: new THREE.Color(data.color).offsetHSL(0, 0.1, -0.16), roughness: 0.85 }));
    marker.position.set(data.radius * 0.89, data.radius * 0.24, 0);
    mesh.add(marker);
  }

  addSaturnRings(parent, radius) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 1.35, radius * 2.42, 128), new THREE.MeshStandardMaterial({ color: 0xdcc791, transparent: true, opacity: 0.73, side: THREE.DoubleSide, roughness: 0.86, depthWrite: false }));
    ring.rotation.x = Math.PI / 2;
    parent.add(ring);
  }

  createOrbit(radius, color = 0x7692be, opacity = 0.34) {
    const points = Array.from({ length: 193 }, (_, index) => {
      const angle = index / 192 * TAU;
      return new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    });
    return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  }

  pickBody(event) {
    this.activePointers.delete(event.pointerId);
    const wasMultiTouch = this.multiTouch;
    if (this.activePointers.size === 0) this.multiTouch = false;
    if (wasMultiTouch) return; // pinch / two-finger pan: never a tap
    if (!this.available || !this.pointerDown || Math.hypot(event.clientX - this.pointerDown.x, event.clientY - this.pointerDown.y) > 8) return;
    if (this.solarInteraction?.handleTap(event, (hit) => this.onSolarFeature?.(hit))) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.pickableMeshes, false)[0];
    if (hit) this.selectBody(hit.object.userData.bodyName, true);
  }

  selectBody(name, focus = true) {
    const body = this.bodies.get(name);
    if (!body) return;
    this.selectedName = name;
    this.followSelected = false;
    this.bodies.forEach((candidate) => {
      const selected = candidate.name === name;
      candidate.mesh.material.emissive?.set(selected ? 0x1b4e72 : 0x000000);
      candidate.mesh.material.emissiveIntensity = selected ? 0.38 : 0;
    });
    if (focus) this.focusBody(name);
    this.onSelect?.(name);
  }

  focusBody(name, earthMoon = false) {
    const body = this.bodies.get(name);
    if (!body) return;
    const target = new THREE.Vector3();
    body.root.getWorldPosition(target);
    const radius = earthMoon ? 4.5 : body.radius;
    const distance = Math.max(radius * 4.2, name === 'Sun' ? 15 : 3.1);
    const viewDirection = this.camera.position.clone().sub(this.controls.target).normalize();
    this.focusTarget = target;
    this.focusPosition = target.clone().add(viewDirection.multiplyScalar(distance)).add(new THREE.Vector3(radius * 0.25, radius * 0.65, radius * 0.25));
    this.focusOffset.copy(this.focusPosition).sub(this.focusTarget);
    this.controls.minDistance = Math.max(radius * 1.25, 0.6);
    this.controls.maxDistance = earthMoon ? 44 : Math.max(55, radius * 32);
  }

  focusEarthMoon() {
    this.selectBody('Earth', false);
    this.focusBody('Earth', true);
  }

  setFollowSelected(enabled) {
    this.followSelected = Boolean(enabled && this.selectedName);
    if (!this.followSelected) return;
    const selected = this.bodies.get(this.selectedName);
    if (!selected) return;
    const target = new THREE.Vector3();
    selected.root.getWorldPosition(target);
    this.focusTarget = target;
    this.focusOffset.copy(this.camera.position).sub(this.controls.target);
    this.focusPosition = target.clone().add(this.focusOffset);
  }

  returnToOverview() {
    this.followSelected = false;
    this.selectedName = null;
    this.focusTarget = this.initialTarget.clone();
    this.focusPosition = this.initialCameraPosition.clone();
    this.controls.minDistance = 4;
    this.controls.maxDistance = 150;
    this.bodies.forEach((body) => { body.mesh.material.emissive?.set(0x000000); body.mesh.material.emissiveIntensity = 0; });
  }

  updateCamera(delta) {
    if (!this.focusTarget || !this.focusPosition) return;
    if (this.followSelected && this.selectedName) {
      const selected = this.bodies.get(this.selectedName);
      if (selected) {
        const worldPosition = new THREE.Vector3();
        selected.root.getWorldPosition(worldPosition);
        this.focusTarget.copy(worldPosition);
        this.focusPosition.copy(worldPosition).add(this.focusOffset);
      }
    }
    const alpha = 1 - Math.exp(-CAMERA_LERP_SPEED * Math.min(delta, 0.1));
    this.currentTarget.lerp(this.focusTarget, alpha);
    this.controls.target.lerp(this.focusTarget, alpha);
    this.camera.position.lerp(this.focusPosition, alpha);
    if (!this.followSelected && this.camera.position.distanceTo(this.focusPosition) < 0.03 && this.controls.target.distanceTo(this.focusTarget) < 0.03) {
      this.focusTarget = null;
      this.focusPosition = null;
    }
  }

  update(delta, speed, isPlaying) {
    if (!this.available) return;
    if (isPlaying) {
      this.bodies.forEach((body) => {
        if (body.isMoon) return;
        const days = Math.max(Math.abs(body.rotationPeriod), 0.2);
        body.mesh.rotation.y += delta * speed * TAU / (AXIAL_ROTATION_SECONDS_PER_EARTH_DAY * days) * Math.sign(body.rotationPeriod || 1);
        body.root.children.filter((child) => child.userData.cloudLayer).forEach((clouds) => { clouds.rotation.y += delta * speed * 0.45; });
        if (body.orbitPivot) body.orbitPivot.rotation.y += delta * speed * TAU / (ORBIT_SECONDS_PER_EARTH_YEAR * body.orbitPeriod);
      });
      const moon = this.bodies.get('Moon');
      if (moon?.moonOrbit) {
        moon.moonOrbit.rotation.y += delta * speed * TAU / 2.7;
        moon.mesh.rotation.y = -moon.moonOrbit.rotation.y;
      }
    }
    this.sun?.update(delta, isPlaying ? delta * speed : 0, this.camera);
    this.updateCamera(delta);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  setOrbitsVisible(isVisible) { this.showOrbits = isVisible; this.bodies.forEach((body) => { if (body.orbit) body.orbit.visible = isVisible; }); }
  getSelectedName() { return this.selectedName; }
  getBodyNames() { return BODY_ORDER.filter((name) => this.bodies.has(name)); }
  reset() { this.returnToOverview(); this.camera.position.copy(this.initialCameraPosition); this.controls.target.copy(this.initialTarget); this.currentTarget.copy(this.initialTarget); this.controls.update(); }
  resize() { if (!this.renderer) return; const { clientWidth: width, clientHeight: height } = this.container; if (!width || !height) return; this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height, false); }
}