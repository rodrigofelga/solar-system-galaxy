import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PLANETS, SUN_DISPLAY_RADIUS } from './data/planets.js';
import { BODY_ORDER, CELESTIAL_BODIES } from './data/celestial-bodies.js';
import { SolarSun } from './sun/solar-sun.js';
import { SolarInteraction } from './sun/solar-interaction.js';
import { SpaceBackdrop } from './space-backdrop.js';

const TAU = Math.PI * 2;
const ORBIT_SECONDS_PER_EARTH_YEAR = 16;
const AXIAL_ROTATION_SECONDS_PER_EARTH_DAY = 4;
const CAMERA_LERP_SPEED = 3.5;
// The Sun's plasma and flares were tuned for this range; faster would strobe rather than inform.
const SUN_MAX_ANIMATION_SPEED = 5;
const SUNWARD_FOCUS_BIAS = 1.7;
const WHITE = new THREE.Color(0xffffff);
// Sunlight strikes the rings at a shallow angle, so they need more gain than the planet to read as bright as they do.
const RING_ALBEDO_BOOST = 3;
const RING_TINT = new THREE.Color(0xf6e7c8);
const OVERVIEW_CAMERA = new THREE.Vector3(0, 40, 104);
// Narrow screens start further back, within the zoom limit, so they still show the outer planets' orbits.
const NARROW_OVERVIEW_ASPECT = 1.7;
const MAX_OVERVIEW_PULLBACK = 1.25;
const MOUSE_PICK_MARGIN = 10;
const TOUCH_PICK_MARGIN = 20;
const ORBIT_VERTEX = /* glsl */ `
attribute float aAngle;
uniform float uRadius;
varying float vAngle;
varying float vNear;
void main(){
  vAngle = aAngle;
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  vNear = clamp((length(cameraPosition) + uRadius + view.z) / (2.0 * uRadius), 0.0, 1.0);
  gl_Position = projectionMatrix * view;
}
`;
// Each orbit brightens just behind its planet, so the line also shows which way the planet is travelling.
const ORBIT_FRAGMENT = /* glsl */ `
uniform float uPlanetAngle;
uniform float uSelected;
uniform vec3 uColor;
uniform vec3 uTrailColor;
varying float vAngle;
varying float vNear;
void main(){
  float trail = exp(-mod(vAngle + uPlanetAngle, 6.2831853) * 2.1);
  float alpha = (0.17 + 0.2 * uSelected) * (0.62 + 0.38 * vNear) + trail * 0.62;
  gl_FragColor = vec4(mix(uColor, uTrailColor, trail), alpha);
}
`;

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
    this.initialCameraPosition = OVERVIEW_CAMERA.clone();
    this.initialTarget = new THREE.Vector3();
    this.currentTarget = new THREE.Vector3();
    this.focusTarget = null;
    this.focusPosition = null;
    this.focusOffset = new THREE.Vector3();
    this.focusPan = new THREE.Vector3();
    this.selectedName = null;
    this.followSelected = false;
    this.textureLoader = new THREE.TextureLoader();
    this.detailBodyName = null;
    this.initialize();
  }

  initialize() {
    let stage = 'creating the WebGL renderer';
    try {
      this.renderer = this.createRenderer();
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 0.65;
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
      this.sunLight = new THREE.PointLight(0xfff0c2, 800, 0, 1.55);
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(1024, 1024);
      this.scene.add(this.sunLight);
      this.backdrop = new SpaceBackdrop({ compact: this.isCompactDevice(), pixelRatio: this.renderer.getPixelRatio() });
      this.scene.add(this.backdrop.group);
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
    this.artemis?.disable();
    this.fallback.textContent = 'The Solar System Explorer lost its WebGL rendering context. Reload the page and verify that browser hardware acceleration is enabled.';
    this.fallback.hidden = false;
  }

  isCompactDevice() { return window.matchMedia?.('(pointer: coarse)').matches || Math.min(window.innerWidth, window.innerHeight) < 640; }

  createSun() {
    // Procedural, self-contained Sun (see js/sun/). It is unlit, so the PointLight above still lights the planets.
    const compact = this.isCompactDevice();
    const requested = new URLSearchParams(window.location.search).get('sunQuality');
    const forcedQuality = { low: 0, medium: 1, high: 2 }[requested] ?? null;
    this.sun = new SolarSun(SUN_DISPLAY_RADIUS, { compact, forcedQuality });
    this.scene.add(this.sun.group);
    this.registerBody('Sun', { mesh: this.sun.mesh, root: this.sun.group, rotationPeriod: 25.38, radius: SUN_DISPLAY_RADIUS, orbitPivot: null });
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
    const material = new THREE.MeshStandardMaterial({ color: data.color, roughness: data.roughness ?? (data.name === 'Earth' ? 0.58 : 0.76), metalness: 0 });
    if (data.albedoGain) this.applyAlbedo(material, data.albedoGain, material.color);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(data.radius, 64, 48), material);
    // Only Earth and the Moon eclipse each other. At display sizes, any other planet's shadow would black out whole worlds far beyond it.
    mesh.castShadow = mesh.receiveShadow = data.name === 'Earth';
    axialPivot.add(mesh);
    // Rotation marker removed
    if (data.name === 'Earth') this.addEarthAtmosphere(axialPivot, data.radius);
    if (data.hasRings) this.addSaturnRings(axialPivot, data.radius, data.albedoGain);
    const orbit = this.createPlanetOrbit(data);
    this.scene.add(orbit);
    this.registerBody(data.name, { mesh, root: axialPivot, rotationPeriod: data.rotationPeriod, orbitPeriod: data.orbitPeriod, radius: data.radius, orbitPivot, orbit, orbitUniforms: orbit.material.uniforms, albedoGain: data.albedoGain, textureHigh: data.textureHigh });
    if (data.albedoGain) this.loadPlanetTexture(data.name);
    else this.loadTexture(data.name, material);
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
    const compact = this.isCompactDevice();
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

  // Divides out the warm tint of the shared Sun light, so these maps show their true colours under it.
  applyAlbedo(material, gain, base = WHITE) {
    const { r, g, b } = this.sunLight.color;
    material.color.setRGB(base.r * gain / r, base.g * gain / g, base.b * gain / b);
  }

  prepareSurfaceMap(texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  // On failure the planet keeps its flat data colour, and a selected planet keeps its standard map.
  loadPlanetTexture(name) {
    const body = this.bodies.get(name);
    this.textureLoader.load(CELESTIAL_BODIES[name].texture, (texture) => {
      body.standardMap = this.prepareSurfaceMap(texture);
      if (!body.detailMap) body.mesh.material.map = texture;
      this.applyAlbedo(body.mesh.material, body.albedoGain);
      body.mesh.material.needsUpdate = true;
    }, undefined, (error) => console.warn(`Could not load ${name} texture; keeping procedural material.`, error));
  }

  // Only the selected planet holds a high-resolution map, which bounds GPU memory on ordinary computers.
  setDetailBody(name) {
    if (this.detailBodyName === name) return;
    const previous = this.bodies.get(this.detailBodyName);
    if (previous?.detailMap) {
      previous.mesh.material.map = previous.standardMap ?? null;
      previous.mesh.material.needsUpdate = true;
      previous.detailMap.dispose();
      previous.detailMap = null;
    }
    this.detailBodyName = name;
    const body = this.bodies.get(name);
    const canAfford = !this.isCompactDevice() && this.renderer.capabilities.maxTextureSize >= 4096;
    if (!body?.textureHigh || !canAfford) return;
    this.textureLoader.load(body.textureHigh, (texture) => {
      if (this.detailBodyName !== name) { texture.dispose(); return; }
      body.detailMap = this.prepareSurfaceMap(texture);
      body.mesh.material.map = texture;
      this.applyAlbedo(body.mesh.material, body.albedoGain);
      body.mesh.material.needsUpdate = true;
    }, undefined, (error) => console.warn(`Could not load high-resolution ${name} texture; keeping the standard map.`, error));
  }

  isCompactDevice() {
    return window.matchMedia?.('(pointer: coarse)').matches || Math.min(window.innerWidth, window.innerHeight) < 640;
  }

  addEarthAtmosphere(parent, radius) {
    // Fades to nothing at the shell's outer edge, so the atmosphere reads as a glow rather than a second sphere.
    parent.add(new THREE.Mesh(new THREE.SphereGeometry(radius * 1.04, 48, 36), new THREE.ShaderMaterial({
      uniforms: { glowColor: { value: new THREE.Color(0x78caff) } },
      vertexShader: 'varying vec3 vNormal; varying vec3 vView; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vNormal = normalMatrix * normal; vView = -mv.xyz; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 glowColor; varying vec3 vNormal; varying vec3 vView; void main() { float glow = smoothstep(0.0, 0.28, abs(dot(normalize(vNormal), normalize(vView)))); gl_FragColor = vec4(glowColor, 0.3 * glow * glow);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
    })));
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

  // The ring map is a radial strip; these radii align its Cassini Division and Encke Gap with Saturn's real rings.
  addSaturnRings(parent, radius, albedoGain) {
    const inner = radius * 1.2;
    const outer = radius * 2.33;
    const geometry = new THREE.RingGeometry(inner, outer, 192, 6);
    const { position, uv } = geometry.attributes;
    for (let index = 0; index < position.count; index += 1) {
      uv.setXY(index, (Math.hypot(position.getX(index), position.getY(index)) - inner) / (outer - inner), 0.5);
    }
    const material = new THREE.MeshStandardMaterial({ color: 0xdcc791, transparent: true, opacity: 0.73, side: THREE.DoubleSide, roughness: 0.86, depthWrite: false });
    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.x = Math.PI / 2;
    parent.add(ring);
    this.textureLoader.load('assets/textures/saturn-rings.png', (texture) => {
      this.prepareSurfaceMap(texture).wrapS = THREE.ClampToEdgeWrapping;
      material.map = texture;
      this.applyAlbedo(material, albedoGain * RING_ALBEDO_BOOST, RING_TINT);
      // A faint self-glow keeps the ring structure legible when viewed from its unlit face.
      material.emissive.set(0xffffff);
      material.emissiveMap = texture;
      material.emissiveIntensity = 0.12;
      material.opacity = 0.96;
      material.needsUpdate = true;
    }, undefined, (error) => console.warn('Could not load Saturn ring texture; keeping the solid ring.', error));
  }

  createOrbit(radius, color, opacity) {
    const points = Array.from({ length: 193 }, (_, index) => {
      const angle = index / 192 * TAU;
      return new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    });
    return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  }

  createPlanetOrbit({ orbitRadius, color }) {
    const segments = 256;
    const positions = new Float32Array((segments + 1) * 3);
    const angles = new Float32Array(segments + 1);
    for (let index = 0; index <= segments; index += 1) {
      const angle = index / segments * TAU;
      positions.set([Math.cos(angle) * orbitRadius, 0, Math.sin(angle) * orbitRadius], index * 3);
      angles[index] = angle;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1));
    return new THREE.Line(geometry, new THREE.ShaderMaterial({
      uniforms: {
        uRadius: { value: orbitRadius },
        uPlanetAngle: { value: 0 },
        uSelected: { value: 0 },
        uColor: { value: new THREE.Color(0.55, 0.66, 0.85) },
        uTrailColor: { value: new THREE.Color(color).lerp(WHITE, 0.45) },
      },
      vertexShader: ORBIT_VERTEX,
      fragmentShader: ORBIT_FRAGMENT,
      transparent: true,
      depthWrite: false,
    }));
  }

  // Small planets are only a few pixels wide in the overview, so a near miss still selects the closest one.
  nearestBodyOnScreen(clientX, clientY, rect, margin) {
    const position = new THREE.Vector3();
    let nearest = null;
    let nearestGap = margin;
    this.bodies.forEach((body) => {
      // From afar the Moon sits almost on top of Earth, so it must be hit directly and cannot steal Earth's near misses.
      if (body.isMoon) return;
      body.mesh.getWorldPosition(position);
      const distance = position.distanceTo(this.camera.position);
      const radiusPx = body.radius / (distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2)) * rect.height / 2;
      position.project(this.camera);
      if (position.z > 1) return;
      const x = rect.left + (position.x + 1) / 2 * rect.width;
      const y = rect.top + (1 - position.y) / 2 * rect.height;
      const gap = Math.hypot(clientX - x, clientY - y) - radiusPx;
      if (gap < nearestGap) { nearest = body.name; nearestGap = gap; }
    });
    return nearest;
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
    if (this.artemis?.active && this.artemis.pick(this.raycaster)) return;
    const hit = this.raycaster.intersectObjects(this.pickableMeshes, false)[0];
    const name = hit?.object.userData.bodyName ?? this.nearestBodyOnScreen(event.clientX, event.clientY, rect, event.pointerType === 'touch' ? TOUCH_PICK_MARGIN : MOUSE_PICK_MARGIN);
    if (name) this.selectBody(name, true);
  }

  selectBody(name, focus = true) {
    const body = this.bodies.get(name);
    if (!body) return;
    this.selectedName = name;
    this.followSelected = false;
    this.bodies.forEach((candidate) => {
      const selected = candidate.name === name;
      candidate.mesh.material.emissive?.set(selected ? 0x1b4e72 : 0x000000);
      candidate.mesh.material.emissiveIntensity = selected ? (candidate.albedoGain ? 0.08 : 0.38) : 0;
      if (candidate.orbitUniforms) candidate.orbitUniforms.uSelected.value = selected ? 1 : 0;
    });
    if (focus) this.focusBody(name);
    this.setDetailBody(name);
    this.onSelect?.(name);
  }

  focusBody(name, earthMoon = false) {
    this.artemis?.releaseCamera();
    const body = this.bodies.get(name);
    if (!body) return;
    const target = new THREE.Vector3();
    body.root.getWorldPosition(target);
    const radius = earthMoon ? 4.5 : body.radius;
    const distance = Math.max(radius * 4.2, name === 'Sun' ? 15 : 3.1);
    const viewDirection = this.camera.position.clone().sub(this.controls.target).normalize();
    // Frame these planets toward their day side, so a focus never opens on an unlit disk.
    if (body.albedoGain) viewDirection.add(target.clone().negate().normalize().multiplyScalar(SUNWARD_FOCUS_BIAS)).normalize();
    this.focusTarget = target;
    this.focusPosition = target.clone().add(viewDirection.multiplyScalar(distance)).add(new THREE.Vector3(radius * 0.25, radius * 0.65, radius * 0.25));
    this.focusOffset.copy(this.focusPosition).sub(this.focusTarget);
    this.focusPan.set(0, 0, 0);
    this.focusSettled = false;
    this.controls.minDistance = Math.max(radius * 1.25, 0.6);
    this.controls.maxDistance = earthMoon ? 44 : Math.max(55, radius * 32);
  }

  focusEarthMoon() {
    this.selectBody('Earth', false);
    this.focusBody('Earth', true);
  }

  setFollowSelected(enabled) {
    if (enabled) this.artemis?.releaseCamera();
    this.followSelected = Boolean(enabled && this.selectedName);
    if (!this.followSelected) return;
    const selected = this.bodies.get(this.selectedName);
    if (!selected) return;
    const target = new THREE.Vector3();
    selected.root.getWorldPosition(target);
    this.focusTarget = target;
    this.focusOffset.copy(this.camera.position).sub(this.controls.target);
    this.focusPan.copy(this.controls.target).sub(target);
    this.focusSettled = false;
    this.focusPosition = target.clone().add(this.focusPan).add(this.focusOffset);
  }

  returnToOverview() {
    this.artemis?.releaseCamera();
    this.followSelected = false;
    this.selectedName = null;
    this.setDetailBody(null);
    this.focusTarget = this.initialTarget.clone();
    this.focusPosition = this.initialCameraPosition.clone();
    this.controls.minDistance = 4;
    this.controls.maxDistance = 150;
    this.bodies.forEach((body) => { body.mesh.material.emissive?.set(0x000000); body.mesh.material.emissiveIntensity = 0; if (body.orbitUniforms) body.orbitUniforms.uSelected.value = 0; });
  }

  updateCamera(delta) {
    if (!this.focusTarget || !this.focusPosition) return;
    if (this.selectedName && (this.followSelected || this.focusTarget)) {
      const selected = this.bodies.get(this.selectedName);
      if (selected) {
        // OrbitControls applies zoom and pan inside its input handlers, so read the viewer's framing before moving on.
        if (this.focusSettled) {
          this.focusOffset.copy(this.camera.position).sub(this.controls.target);
          this.focusPan.copy(this.controls.target).sub(this.focusTarget);
        }
        const worldPosition = new THREE.Vector3();
        selected.root.getWorldPosition(worldPosition);
        this.focusTarget.copy(worldPosition);
        this.focusPosition.copy(worldPosition).add(this.focusPan).add(this.focusOffset);
      }
    }
    const alpha = 1 - Math.exp(-CAMERA_LERP_SPEED * Math.min(delta, 0.1));
    if (this.selectedName && this.bodies.has(this.selectedName)) {
      // Keep the camera centered on the moving planet.
      this.currentTarget.copy(this.focusTarget);
      this.controls.target.copy(this.focusTarget).add(this.focusPan);
      this.camera.position.copy(this.focusPosition);
      this.focusSettled = true;
    } else {
      this.currentTarget.lerp(this.focusTarget, alpha);
      this.controls.target.lerp(this.focusTarget, alpha);
      this.camera.position.lerp(this.focusPosition, alpha);
    }
    if (!this.selectedName && !this.followSelected &&
    this.camera.position.distanceTo(this.focusPosition) < 0.03 &&
    this.controls.target.distanceTo(this.focusTarget) < 0.03) {
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
    this.bodies.forEach((body) => { if (body.orbitUniforms) body.orbitUniforms.uPlanetAngle.value = body.orbitPivot.rotation.y % TAU; });
    this.sun?.update(delta, isPlaying ? delta * Math.min(speed, SUN_MAX_ANIMATION_SPEED) : 0, this.camera);
    if (this.artemis?.active) this.artemis.update(delta, speed, isPlaying);
    if (!this.artemis?.active || !this.artemis.cameraMode) this.updateCamera(delta);
    this.controls.update();
    if (this.artemis?.active) this.artemis.updateLabels();
    this.backdrop?.update(this.camera);
    this.renderer.render(this.scene, this.camera);
  }

  async setArtemisEnabled(enabled) {
    this.artemisRequested = enabled;
    if (!enabled) { this.artemis?.disable(); return null; }
    if (!this.available) throw new Error('The Solar System WebGL scene is unavailable');
    if (!this.artemis) {
      if (!this.artemisLoading) this.artemisLoading = Promise.all([
        import('./mission/artemis-mission.js'),
        fetch('assets/mission/artemis-ii.json').then((response) => { if (!response.ok) throw new Error('The local trajectory file could not load'); return response.json(); }),
      ]).catch((error) => { this.artemisLoading = null; throw error; });
      const [module, data] = await this.artemisLoading;
      if (!this.artemisRequested) return null;
      if (!this.artemis) this.artemis = new module.ArtemisMission(this, data);
    }
    if (!this.artemisRequested) return null;
    this.artemis.enable(); return this.artemis;
  }

  disposeArtemis() { this.artemisRequested = false; this.artemis?.dispose(); this.artemis = null; }

  setOrbitsVisible(isVisible) { this.showOrbits = isVisible; this.bodies.forEach((body) => { if (body.orbit) body.orbit.visible = isVisible; }); }
  getSelectedName() { return this.selectedName; }
  getBodyNames() { return BODY_ORDER.filter((name) => this.bodies.has(name)); }
  reset() { this.returnToOverview(); this.camera.position.copy(this.initialCameraPosition); this.controls.target.copy(this.initialTarget); this.currentTarget.copy(this.initialTarget); this.controls.update(); if (this.artemis?.active) this.artemis.restart(); }
  resize() { if (!this.renderer) return; const { clientWidth: width, clientHeight: height } = this.container; if (!width || !height) return; this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height, false); this.frameOverview(); }
  frameOverview() {
    this.initialCameraPosition.copy(OVERVIEW_CAMERA).multiplyScalar(THREE.MathUtils.clamp(NARROW_OVERVIEW_ASPECT / this.camera.aspect, 1, MAX_OVERVIEW_PULLBACK));
    if (this.overviewFramed) return;
    this.overviewFramed = true;
    this.camera.position.copy(this.initialCameraPosition);
    this.controls.update();
  }
}
