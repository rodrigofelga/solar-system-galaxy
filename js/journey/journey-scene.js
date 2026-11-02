import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CELESTIAL_BODIES } from '../data/celestial-bodies.js';
import { SolarSun } from '../sun/solar-sun.js';
import { SpaceBackdrop } from '../space-backdrop.js';
import {
  BODIES, DISK_HEIGHT, ECLIPTIC_NORMAL, ECLIPTIC_X, ECLIPTIC_Y, GALACTIC_RADIUS, GALACTIC_RATE, START_PHASE, SUN_RADIUS, VERTICAL_AMPLITUDE,
  VERTICAL_CYCLES_PER_ORBIT, VORTEX_LAG_PER_RADIUS, orbitAngle, planetPosition, sunPhase, sunPosition, travelDirection, vortexPosition,
} from './journey-model.js';

const TAU = Math.PI * 2;
const MIN_SYSTEM_SCALE = 0.02;
const LEVEL_SECONDS = 2.8;
const FLY_SECONDS = 1.1;
const FRAME_RATE = 1.6;
const SUN_DISTANCE = 6;
const SYSTEM_DISTANCE = 21;
const VIEW_TILT = 40 * Math.PI / 180;
const OVERVIEW = new THREE.Vector3(0, 65, 83);
const WHITE = new THREE.Color(0xffffff);
export const TRAIL_SPANS = { short: 8, medium: 16, long: 48 };

const TRAIL_VERTEX = /* glsl */ `
attribute float aAge;
uniform vec3 uSunNow; uniform vec3 uAxisX; uniform vec3 uAxisY;
uniform float uPhase; uniform float uGalacticRate; uniform float uGalacticRadius; uniform float uDiskHeight;
uniform float uBob; uniform float uBobRate; uniform float uBobPhase;
uniform float uAngle; uniform float uOmega; uniform float uRadius; uniform float uScale;
uniform float uSpan; uniform float uElapsed; uniform float uFrame; uniform float uVortex; uniform float uLag;
varying float vAge;
void main(){
  vAge = aAge;
  float dt = -min(aAge * uSpan, uElapsed);
  float a = uAngle + uOmega * dt;
  float r = uRadius * uScale;
  float lag = uVortex * uLag * r;
  float ph = uPhase + uGalacticRate * (dt - lag);
  vec3 sun = vec3(uGalacticRadius * cos(ph), uDiskHeight + uBob * sin(uBobPhase + uBobRate * (dt - lag)), uGalacticRadius * sin(ph));
  vec3 offset = r * (cos(a) * uAxisX + sin(a) * uAxisY);
  if (uVortex > 0.5) {
    vec3 travel = vec3(-sin(ph), 0.0, cos(ph));
    vec3 side = vec3(-travel.z, 0.0, travel.x);
    offset = r * (cos(a) * side + sin(a) * vec3(0.0, 1.0, 0.0));
  }
  vec3 centre = mix(uSunNow, sun, uFrame);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(centre + offset, 1.0);
}
`;
const TRAIL_FRAGMENT = /* glsl */ `
uniform vec3 uColor; uniform float uOpacity;
varying float vAge;
void main(){
  float fade = pow(1.0 - vAge, 1.5);
  gl_FragColor = vec4(uColor, uOpacity * (0.08 + 0.92 * fade));
}
`;

const v3 = (array) => new THREE.Vector3(array[0], array[1], array[2]);
const ease = (t) => t * t * (3 - 2 * t);

/** Draws one shared simulation state from one or two viewpoints inside the Milky Way explorer's scene. */
export class JourneyScene {
  constructor(galaxy, { compact = false, reduceMotion = false, panes, onCameraStart }) {
    this.galaxy = galaxy;
    this.compact = compact;
    this.reduceMotion = reduceMotion;
    this.onCameraStart = onCameraStart;
    this.scene = galaxy.scene;
    this.renderer = galaxy.renderer;
    this.time = 0;
    this.trailStart = 0;
    this.trailSpan = TRAIL_SPANS.medium;
    this.level = 0;
    this.levelTarget = 1;
    this.showTrails = true;
    this.showSunPath = true;
    this.showPlanes = true;
    this.highlight = null;
    this.spin = 0;
    this.scaleNow = MIN_SYSTEM_SCALE;
    this.root = new THREE.Group();
    this.root.name = 'SolarSystemJourney';
    this.scene.add(this.root);
    this.textureLoader = new THREE.TextureLoader();
    this.shared = this.createSharedUniforms();
    this.createLights();
    this.backdrop = new SpaceBackdrop({ compact, pixelRatio: this.renderer.getPixelRatio(), bandNormal: new THREE.Vector3(0, 1, 0), eclipticGlow: false });
    this.root.add(this.backdrop.group);
    this.sun = new SolarSun(SUN_RADIUS, { compact });
    this.root.add(this.sun.group);
    this.planets = BODIES.map((body) => this.createPlanet(body));
    this.trails = BODIES.map((body) => this.createTrail(body, body.orbit, body.omega, new THREE.Color(body.color).lerp(WHITE, 0.35), compact ? 420 : 840));
    this.sunTrail = this.createTrail({ name: 'Sun' }, 0, 0, new THREE.Color(0xffd27a), 240);
    this.createPlaneGuides();
    this.createDirectionArrow();
    this.views = {
      main: this.createView('main', panes.main),
      second: this.createView('second', panes.second),
    };
    this.setMode('B', true);
  }

  createSharedUniforms() {
    return {
      uSunNow: { value: new THREE.Vector3() },
      uAxisX: { value: v3(ECLIPTIC_X) },
      uAxisY: { value: v3(ECLIPTIC_Y) },
      uPhase: { value: START_PHASE },
      uGalacticRate: { value: GALACTIC_RATE },
      uGalacticRadius: { value: GALACTIC_RADIUS },
      uDiskHeight: { value: DISK_HEIGHT },
      uBob: { value: VERTICAL_AMPLITUDE },
      uBobRate: { value: GALACTIC_RATE * VERTICAL_CYCLES_PER_ORBIT },
      uBobPhase: { value: 0 },
      uScale: { value: 1 },
      uSpan: { value: this.trailSpan },
      uElapsed: { value: 0 },
      uFrame: { value: 1 },
      uVortex: { value: 0 },
      uLag: { value: VORTEX_LAG_PER_RADIUS / (GALACTIC_RATE * GALACTIC_RADIUS) },
    };
  }

  createLights() {
    this.light = new THREE.PointLight(0xfff2de, 3.4, 0, 0);
    this.ambient = new THREE.AmbientLight(0x9db6dc, 0.2);
    this.root.add(this.light, this.ambient);
  }

  // A map is shown small here, so large ones are drawn down to spare GPU memory on top of the Solar System view's copy.
  loadSurface(name, material) {
    const limit = this.compact ? 1024 : 2048;
    this.textureLoader.load(CELESTIAL_BODIES[name].texture, (texture) => {
      if (this.disposed) { texture.dispose(); return; }
      const { image } = texture;
      let map = texture;
      if (image.width > limit) {
        const canvas = document.createElement('canvas');
        canvas.width = limit; canvas.height = limit / 2;
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        map = new THREE.CanvasTexture(canvas);
        texture.dispose();
      }
      map.colorSpace = THREE.SRGBColorSpace;
      map.wrapS = THREE.RepeatWrapping;
      material.map = map;
      material.color.set(0xffffff);
      material.needsUpdate = true;
    }, undefined, (error) => console.warn(`Could not load ${name} texture for the journey; keeping its flat colour.`, error));
  }

  createPlanet(body) {
    const root = new THREE.Object3D();
    const basis = new THREE.Matrix4().makeBasis(v3(ECLIPTIC_X), v3(ECLIPTIC_NORMAL), v3(ECLIPTIC_Y).negate());
    root.quaternion.setFromRotationMatrix(basis);
    const pivot = new THREE.Object3D();
    pivot.rotation.z = body.axialTilt;
    root.add(pivot);
    const material = new THREE.MeshStandardMaterial({ color: body.color, roughness: 0.95, metalness: 0 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(body.radius, this.compact ? 24 : 40, this.compact ? 16 : 28), material);
    pivot.add(mesh);
    this.loadSurface(body.name, material);
    if (body.hasRings) this.addRings(pivot, body.radius);
    this.root.add(root);
    return { body, root, mesh };
  }

  addRings(parent, radius) {
    const inner = radius * 1.2; const outer = radius * 2.33;
    const geometry = new THREE.RingGeometry(inner, outer, this.compact ? 64 : 128, 2);
    const { position, uv } = geometry.attributes;
    for (let i = 0; i < position.count; i += 1) uv.setXY(i, (Math.hypot(position.getX(i), position.getY(i)) - inner) / (outer - inner), 0.5);
    const material = new THREE.MeshStandardMaterial({ color: 0xdcc791, transparent: true, opacity: 0.85, side: THREE.DoubleSide, roughness: 0.9, depthWrite: false });
    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.x = Math.PI / 2;
    parent.add(ring);
    this.textureLoader.load('assets/textures/saturn-rings.png', (texture) => {
      if (this.disposed) { texture.dispose(); return; }
      texture.colorSpace = THREE.SRGBColorSpace;
      material.map = texture; material.color.set(0xffffff); material.needsUpdate = true;
    }, undefined, (error) => console.warn('Could not load Saturn ring texture for the journey.', error));
  }

  // Trails are evaluated from the model in the vertex shader, so they are exact, need no history, and follow any jump in time.
  createTrail(body, radius, omega, color, vertices) {
    const ages = new Float32Array(vertices);
    for (let i = 0; i < vertices; i += 1) ages[i] = i / (vertices - 1);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices * 3), 3));
    geometry.setAttribute('aAge', new THREE.BufferAttribute(ages, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: { ...this.shared, uAngle: { value: 0 }, uOmega: { value: omega }, uRadius: { value: radius }, uColor: { value: color }, uOpacity: { value: 0.85 } },
      vertexShader: TRAIL_VERTEX,
      fragmentShader: TRAIL_FRAGMENT,
      transparent: true,
      depthWrite: false,
    });
    const line = new THREE.Line(geometry, material);
    line.frustumCulled = false;
    this.root.add(line);
    return { body, line, material };
  }

  createPlaneGuides() {
    const outer = BODIES.at(-1).orbit * 1.06;
    this.planes = new THREE.Group();
    const basis = new THREE.Matrix4().makeBasis(v3(ECLIPTIC_X), v3(ECLIPTIC_NORMAL), v3(ECLIPTIC_Y).negate());
    const ecliptic = new THREE.Group();
    ecliptic.quaternion.setFromRotationMatrix(basis);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(outer, 96), new THREE.MeshBasicMaterial({ color: 0x6fb8ff, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2;
    ecliptic.add(disc);
    BODIES.forEach((body) => {
      const points = Array.from({ length: 161 }, (_, i) => new THREE.Vector3(Math.cos(i / 160 * TAU) * body.orbit, 0, Math.sin(i / 160 * TAU) * body.orbit));
      ecliptic.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x8fb0d8, transparent: true, opacity: 0.32, depthWrite: false })));
    });
    this.planes.add(ecliptic);
    // A ring parallel to the galactic disk and an arc between the two planes make the tilt readable from any angle.
    const circle = Array.from({ length: 121 }, (_, i) => new THREE.Vector3(Math.cos(i / 120 * TAU) * outer, 0, Math.sin(i / 120 * TAU) * outer));
    this.planes.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(circle), new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.42, depthWrite: false })));
    const normal = v3(ECLIPTIC_NORMAL);
    const up = new THREE.Vector3(0, 1, 0);
    const node = new THREE.Vector3().crossVectors(up, normal).normalize();
    const inDisk = new THREE.Vector3().crossVectors(node, up).normalize();
    const inPlane = new THREE.Vector3().crossVectors(node, normal).normalize();
    const arcRadius = outer * 0.82;
    const angle = inDisk.angleTo(inPlane);
    const axis = new THREE.Vector3().crossVectors(inDisk, inPlane).normalize();
    const arc = Array.from({ length: 25 }, (_, i) => inDisk.clone().applyAxisAngle(axis, angle * i / 24).multiplyScalar(arcRadius));
    this.planes.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), ...arc, new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffe9b8, transparent: true, opacity: 0.42, depthWrite: false })));
    this.tiltAnchor = inDisk.clone().applyAxisAngle(axis, angle / 2).multiplyScalar(arcRadius * 1.08);
    this.tiltPoint = new THREE.Vector3();
    this.root.add(this.planes);
  }

  createDirectionArrow() {
    const material = new THREE.MeshBasicMaterial({ color: 0x9fe6ff, transparent: true, opacity: 0.75, depthWrite: false });
    this.arrow = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.3, 8), material);
    shaft.position.y = 0.65;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.26, 12), material);
    head.position.y = 1.43;
    this.arrow.add(shaft, head);
    this.arrowTip = new THREE.Vector3();
    this.root.add(this.arrow);
  }

  createView(id, pane) {
    const camera = new THREE.PerspectiveCamera(46, 1, 0.03, 900);
    camera.position.copy(OVERVIEW);
    const controls = new OrbitControls(camera, pane);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.3;
    controls.maxDistance = 340;
    const view = { id, pane, camera, controls, frame: 1, frameTarget: 1, model: 'shared', follow: 'system', planet: 'Earth', fly: null, last: new THREE.Vector3(), rect: { x: 0, y: 0, width: 1, height: 1 } };
    controls.addEventListener('start', () => { view.fly = null; this.onCameraStart?.(view); });
    return view;
  }

  /** A: one view relative to the Sun. B: one view relative to the galaxy. C and D: two views of the same instant. */
  setMode(mode, instant = false) {
    const { main, second } = this.views;
    this.mode = mode;
    this.split = mode === 'C' || mode === 'D';
    main.frameTarget = mode === 'A' ? 0 : 1;
    main.model = 'shared';
    second.frameTarget = mode === 'C' ? 0 : 1;
    second.model = mode === 'D' ? 'vortex' : 'shared';
    second.follow = 'system';
    if ((mode !== 'B' && main.follow === 'free') || (mode === 'D' && main.follow !== 'system')) {
      main.follow = 'system';
      main.last.copy(this.followPoint(main));
    }
    if (instant) { main.frame = main.frameTarget; second.frame = second.frameTarget; }
    if (this.split) {
      if (this.levelTarget !== 1) this.setLevel('journey');
      second.camera.position.copy(main.camera.position);
      second.controls.target.copy(main.controls.target);
      second.last.copy(this.followPoint(second));
      this.flyFollow(second, true);
    }
    this.resize();
  }

  setLevel(level) {
    const target = level === 'galaxy' ? 0 : 1;
    if (target === this.levelTarget && !this.levelMoving()) {
      if (target === 1) this.frameSolarSystem();
      return;
    }
    this.levelTarget = target;
    this.levelStart = this.level;
    if (level === 'galaxy' && this.views.main.follow === 'free') this.views.main.follow = 'system';
    this.levelFrom = { position: this.views.main.camera.position.clone(), target: this.views.main.controls.target.clone() };
    this.levelClock = 0;
  }

  setFollow(view, follow, planet = view.planet) {
    view.follow = follow;
    view.planet = planet;
    if (this.level < 0.99 && this.levelTarget === 1) return;
    view.last.copy(this.followPoint(view));
    if (follow !== 'free') this.flyFollow(view);
  }

  followPoint(view, out = new THREE.Vector3()) {
    if (view.follow === 'planet') {
      const entry = this.planets.find(({ body }) => body.name === view.planet);
      return out.fromArray(this.bodyPosition(entry.body, view));
    }
    return out.fromArray(sunPosition(this.time));
  }

  bodyPosition(body, view) {
    return view.model === 'vortex' ? vortexPosition(body, this.time, this.scaleNow) : planetPosition(body, this.time, this.scaleNow);
  }

  presetDistance(view) {
    const narrow = Math.max(1, 1.25 / view.camera.aspect);
    if (view.follow === 'planet') {
      const { body } = this.planets.find((entry) => entry.body.name === view.planet);
      return Math.max(body.radius * 11, 1.8) * narrow;
    }
    return (view.follow === 'sun' ? SUN_DISTANCE : SYSTEM_DISTANCE) * narrow;
  }

  // Opens the planets' plane toward the camera and keeps the direction of travel across the screen, wherever the Sun is on its orbit.
  defaultDirection() {
    const travel = v3(travelDirection(this.time));
    const normal = v3(ECLIPTIC_NORMAL);
    const across = normal.dot(travel);
    const inPlane = travel.clone().addScaledVector(normal, -across).normalize().multiplyScalar(across >= 0 ? -1 : 1);
    return normal.multiplyScalar(Math.cos(VIEW_TILT)).addScaledVector(inPlane, Math.sin(VIEW_TILT)).normalize();
  }

  flyFollow(view, useDefault = false) {
    const direction = useDefault ? this.defaultDirection() : view.camera.position.clone().sub(view.controls.target).normalize();
    this.startFly(view, direction.multiplyScalar(this.presetDistance(view)));
  }

  startFly(view, offset) {
    if (this.reduceMotion) {
      const point = this.followPoint(view);
      view.controls.target.copy(point); view.camera.position.copy(point).add(offset); view.last.copy(point); view.fly = null;
      return;
    }
    view.fly = { clock: 0, position: view.camera.position.clone(), target: view.controls.target.clone(), offset };
  }

  frameSolarSystem(distance = null) {
    const view = this.views.main;
    const narrow = Math.max(1, 1.25 / view.camera.aspect);
    this.startFly(view, this.defaultDirection().multiplyScalar(distance ? distance * narrow : this.presetDistance(view)));
  }

  /** Starts time at the explorer's current Sun position, so the marker does not jump. */
  startAt(phase) {
    const wrapped = ((phase - START_PHASE) % TAU + TAU) % TAU;
    this.time = wrapped / GALACTIC_RATE;
    this.trailStart = this.time;
    this.levelFrom = { position: this.galaxy.camera.position.clone(), target: this.galaxy.controls.target.clone() };
    this.views.main.camera.position.copy(this.levelFrom.position);
    this.views.main.controls.target.copy(this.levelFrom.target);
    this.levelClock = 0;
    this.level = 0;
    this.levelStart = 0;
    this.levelTarget = 1;
    if (this.reduceMotion) this.levelClock = LEVEL_SECONDS;
  }

  reset() {
    this.time = 0;
    this.trailStart = 0;
    this.levelTarget = 1;
    this.level = 1;
    Object.values(this.views).forEach((view) => { view.fly = null; view.frame = view.frameTarget; });
    this.scaleNow = 1;
    const { main, second } = this.views;
    [main, second].forEach((view) => {
      const point = this.followPoint(view);
      view.last.copy(point);
      view.controls.target.copy(point);
      view.camera.position.copy(point).add(this.defaultDirection().multiplyScalar(this.presetDistance(view)));
    });
  }

  advance(seconds) { this.time += seconds; }

  update(delta, simDelta) {
    this.time += simDelta;
    this.spin = simDelta;
    this.updateLevel(delta);
    this.scaleNow = MIN_SYSTEM_SCALE * (1 / MIN_SYSTEM_SCALE) ** this.level;
    this.updateCamera(this.views.main, delta);
    if (this.split) this.updateCamera(this.views.second, delta);
    this.updateShared();
    this.planets.forEach(({ body, mesh }) => {
      const days = Math.max(Math.abs(body.rotationPeriod), 0.2);
      mesh.rotation.y += simDelta * TAU / (4 * days) * Math.sign(body.rotationPeriod || 1);
    });
    this.sun.mesh.rotation.y += simDelta * TAU / (4 * 25.38);
    this.sun.update(delta, simDelta, this.views.main.camera);
    const sun = sunPosition(this.time);
    this.galaxy.sun.position.set(sun[0], sun[1], sun[2]);
    this.galaxy.phase = sunPhase(this.time);
    this.galaxy.anchors.get('sun')?.position.copy(this.galaxy.sun.position);
  }

  updateLevel(delta) {
    const main = this.views.main;
    if (this.levelClock === undefined || this.levelClock >= LEVEL_SECONDS) {
      this.level = this.levelTarget;
      return;
    }
    this.levelClock = Math.min(LEVEL_SECONDS, this.levelClock + delta);
    const progress = ease(this.levelClock / LEVEL_SECONDS);
    this.level = this.levelStart + (this.levelTarget - this.levelStart) * progress;
    const sun = new THREE.Vector3().fromArray(sunPosition(this.time));
    const goal = this.levelTarget === 1
      ? { target: sun, position: sun.clone().add(this.defaultDirection().multiplyScalar(SYSTEM_DISTANCE * Math.max(1, 1.25 / main.camera.aspect))) }
      : { target: new THREE.Vector3(), position: OVERVIEW.clone().multiplyScalar(Math.max(1, 1.25 / main.camera.aspect)) };
    main.camera.position.lerpVectors(this.levelFrom.position, goal.position, progress);
    main.controls.target.lerpVectors(this.levelFrom.target, goal.target, progress);
    if (this.levelClock >= LEVEL_SECONDS) main.last.copy(this.followPoint(main));
  }

  levelMoving() { return this.levelClock !== undefined && this.levelClock < LEVEL_SECONDS; }

  updateCamera(view, delta) {
    view.frame += (view.frameTarget - view.frame) * (this.reduceMotion ? 1 : 1 - Math.exp(-delta * FRAME_RATE * 2));
    if (Math.abs(view.frame - view.frameTarget) < 0.002) view.frame = view.frameTarget;
    const followable = !(view === this.views.main && this.levelMoving()) && this.level > 0.5;
    if (followable) {
      const point = this.followPoint(view);
      if (view.fly) {
        view.fly.clock = Math.min(FLY_SECONDS, view.fly.clock + delta);
        const progress = ease(view.fly.clock / FLY_SECONDS);
        view.controls.target.lerpVectors(view.fly.target, point, progress);
        view.camera.position.lerpVectors(view.fly.position, point.clone().add(view.fly.offset), progress);
        if (view.fly.clock >= FLY_SECONDS) view.fly = null;
      } else if (view.follow !== 'free') {
        const move = point.clone().sub(view.last);
        view.camera.position.add(move);
        view.controls.target.add(move);
      }
      view.last.copy(point);
    }
    view.controls.update();
    view.camera.updateMatrixWorld();
  }

  updateShared() {
    const { shared } = this;
    const sun = sunPosition(this.time);
    shared.uSunNow.value.fromArray(sun);
    shared.uPhase.value = sunPhase(this.time) % TAU;
    shared.uBobPhase.value = (GALACTIC_RATE * VERTICAL_CYCLES_PER_ORBIT * this.time) % TAU;
    shared.uScale.value = this.scaleNow;
    shared.uSpan.value = this.trailSpan;
    shared.uElapsed.value = this.time - this.trailStart;
    this.trails.forEach(({ body, material }) => {
      material.uniforms.uAngle.value = orbitAngle(body, this.time) % TAU;
      material.uniforms.uOpacity.value = this.highlight ? (this.highlight === body.name ? 1 : 0.22) : 0.82;
    });
  }

  applyView(view) {
    const vortex = view.model === 'vortex';
    const { shared } = this;
    shared.uFrame.value = view.frame;
    shared.uVortex.value = vortex ? 1 : 0;
    const showBodies = this.level > 0.1;
    this.planets.forEach(({ body, root }) => {
      root.visible = showBodies;
      root.position.fromArray(this.bodyPosition(body, view));
      root.scale.setScalar(this.scaleNow);
    });
    const sun = shared.uSunNow.value;
    this.sun.group.position.copy(sun);
    this.sun.group.scale.setScalar(this.scaleNow);
    this.sun.group.visible = this.level > 0.12;
    this.sun.corona.quaternion.copy(view.camera.quaternion);
    this.sun.halo.quaternion.copy(view.camera.quaternion);
    this.light.position.copy(sun);
    this.galaxy.sun.visible = this.level < 0.3;
    this.trails.forEach(({ line }) => { line.visible = this.showTrails && this.level > 0.25; });
    this.sunTrail.line.visible = this.showSunPath;
    this.galaxy.orbit.visible = this.showSunPath && view.frame > 0.5;
    this.planes.visible = this.showPlanes && !vortex && this.level > 0.5;
    this.planes.position.copy(sun);
    this.planes.scale.setScalar(this.scaleNow);
    this.tiltPoint.copy(this.tiltAnchor).multiplyScalar(this.scaleNow).add(sun);
    const travel = v3(travelDirection(this.time));
    this.arrow.visible = this.level > 0.7 && view.frame > 0.5;
    this.arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), travel);
    const lift = new THREE.Vector3().copy(sun).addScaledVector(travel, SUN_RADIUS * this.scaleNow * 1.15);
    this.arrow.position.copy(lift);
    this.arrow.scale.setScalar(this.scaleNow);
    this.arrowTip.copy(lift).addScaledVector(travel, 1.75 * this.scaleNow);
    this.backdrop.update(view.camera);
  }

  render() {
    const { renderer, galaxy } = this;
    const { clientWidth: width, clientHeight: height } = this.renderer.domElement.parentElement;
    if (!width || !height) return;
    const views = this.split ? [this.views.second, this.views.main] : [this.views.main];
    const fade = 0.8 - 0.52 * this.level;
    renderer.setScissorTest(true);
    views.forEach((view) => {
      const { x, y, width: w, height: h } = view.rect;
      renderer.setViewport(x, height - y - h, w, h);
      renderer.setScissor(x, height - y - h, w, h);
      galaxy.clouds.forEach((cloud) => {
        cloud.material.uniforms.uOpacity.value = cloud.userData.baseOpacity * (fade / 0.8);
        cloud.material.uniforms.uPixels.value = h * renderer.getPixelRatio();
      });
      this.applyView(view);
      renderer.render(this.scene, view.camera);
    });
    renderer.setScissorTest(false);
  }

  resize() {
    const host = this.renderer.domElement.parentElement;
    const { clientWidth: width, clientHeight: height } = host;
    if (!width || !height) return;
    const { main, second } = this.views;
    const stacked = width < 620;
    if (!this.split) main.rect = { x: 0, y: 0, width, height };
    else if (stacked) {
      second.rect = { x: 0, y: 0, width, height: Math.floor(height / 2) };
      main.rect = { x: 0, y: Math.floor(height / 2), width, height: height - Math.floor(height / 2) };
    } else {
      second.rect = { x: 0, y: 0, width: Math.floor(width / 2), height };
      main.rect = { x: Math.floor(width / 2), y: 0, width: width - Math.floor(width / 2), height };
    }
    [main, second].forEach((view) => {
      view.camera.aspect = view.rect.width / Math.max(1, view.rect.height);
      view.camera.updateProjectionMatrix();
      Object.assign(view.pane.style, { left: `${view.rect.x}px`, top: `${view.rect.y}px`, width: `${view.rect.width}px`, height: `${view.rect.height}px` });
      view.pane.hidden = view === second && !this.split;
    });
  }

  /** Screen position of a world point inside a view, in pixels from the view's corner, or null when behind the camera. */
  project(view, point, out = new THREE.Vector3()) {
    out.copy(point).project(view.camera);
    if (out.z < -1 || out.z > 1) return null;
    return { x: (out.x + 1) / 2 * view.rect.width, y: (1 - out.y) / 2 * view.rect.height };
  }

  dispose() {
    this.disposed = true;
    Object.values(this.views).forEach((view) => view.controls.dispose());
    this.root.traverse((object) => {
      object.geometry?.dispose();
      if (object.material) { object.material.map?.dispose(); object.material.dispose(); }
    });
    this.scene.remove(this.root);
    this.galaxy.sun.visible = true;
    this.galaxy.orbit.visible = true;
    this.renderer.setViewport(0, 0, this.renderer.domElement.clientWidth, this.renderer.domElement.clientHeight);
  }
}
