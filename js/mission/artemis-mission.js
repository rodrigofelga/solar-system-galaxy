import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { createOrion } from './orion-model.js';
import { referenceBasis, displayState, integratedPosition, timeAtProgress, progressAtTime, clamp, PLAYBACK_SECONDS } from './trajectory.js';

const OUTBOUND_COLOR = new THREE.Color(0x63b7cb);
const RETURN_COLOR = new THREE.Color(0xd9916f);
const TRAIL_COLOR = new THREE.Color(0xffe7a4);
const PATH_WIDTH = 1.1;
const TRAIL_WIDTH = 1.7;
const TRAIL_SAMPLES = 135;
const TRAIL_PROGRESS = 0.028;
const NOMINAL_MOON_RADIUS = 2.75;
const SAMPLE_GRID = 40000;
const MAX_SAMPLE_LENGTH = 0.03;
const MAX_SAMPLE_TURN = 0.035;

export const MISSION_PHASES = [
  { start: 0, title: 'Launch & initial Earth orbit', text: 'SLS lifts Orion from Earth. This opening segment illustrates launch and early Earth orbit; the local OEM does not cover ascent. The launch rocket is not carried along on the lunar journey.' },
  { start: 0.12, title: 'High Earth orbit & checks', text: 'The crew checks life support, navigation, communications, and spacecraft handling before committing to deep space. Orion and its European Service Module travel together.' },
  { start: 0.26, title: 'Translunar injection', text: 'A service-module engine burn sends Orion out of Earth orbit. The mission then coasts toward the Moon; there is no continuous engine flame.' },
  { start: 0.30, title: 'Outbound lunar coast', text: 'The Moon moves ahead as Orion travels outward. The educational route turns with the existing accelerated lunar orbit so Orion meets the moving Moon. Its geometry is adjusted from NASA data, not an exact ephemeris reconstruction.' },
  { start: 0.56, title: 'Lunar far-side flyby', text: 'Orion passes beyond the Moon and bends onto the return leg. A flyby is one passage, not insertion into a sustained lunar orbit, and no lunar landing takes place.' },
  { start: 0.68, title: 'Free-return journey', text: 'The Earth–Moon gravitational geometry bends the spacecraft back toward Earth. Free return does not mean that navigation or small trajectory corrections are unnecessary.' },
  { start: 0.94, title: 'Re-entry & splashdown', text: 'The service module is discarded. The crew capsule leads with its heat shield, slows in the atmosphere, and descends under parachutes. The final descent is an illustration beyond the OEM’s entry-interface endpoint.' },
];

export class ArtemisMission {
  constructor(view, data) {
    if (data.schema !== 1 || data.rows?.length < 2 || !Number.isFinite(data.flyby)) throw new Error('Mission trajectory data is invalid.');
    this.view = view; this.data = data; this.basis = referenceBasis(data);
    this.active = false; this.playing = true; this.speed = 1; this.progress = 0; this.cameraMode = null;
    this.trajectoryVisible = true; this.dirty = true; this.uiTime = 0;
    this.group = new THREE.Group(); this.group.name = 'Artemis II Earth-centred mission frame'; this.group.visible = false; view.scene.add(this.group);
    this.orion = createOrion(); this.group.add(this.orion.group);
    this.scratch = new Array(12); this.sample = new Array(6); this.nextSample = new Array(6);
    this.earthWorld = new THREE.Vector3(); this.target = new THREE.Vector3(); this.previousTarget = new THREE.Vector3();
    this.worldShip = new THREE.Vector3(); this.worldMoon = new THREE.Vector3(); this.offset = new THREE.Vector3();
    this.deltaTarget = new THREE.Vector3(); this.desiredCamera = new THREE.Vector3(); this.up = new THREE.Vector3(0, 1, 0); this.tangent = new THREE.Vector3();
    this.moonLocal = new THREE.Vector3(); this.routeRotation = new THREE.Quaternion(); this.pathSample = new Array(3);
    this.makePath(); this.makeLabels();
    this.onControlsStart = () => { this.transitioning = false; };
    view.controls.addEventListener('start', this.onControlsStart);
  }

  makePath() {
    this.sampleProgress = this.chooseSamples(); this.count = this.sampleProgress.length;
    const positions = new Float32Array(this.count * 3); const colors = new Float32Array(this.count * 3);
    const color = new THREE.Color(); const flyby = progressAtTime(this.data, this.data.flyby); this.bounds = new THREE.Box3();
    for (let i = 0; i < this.count; i += 1) {
      const p = this.sampleProgress[i]; displayState(this.data, this.basis, timeAtProgress(this.data, p), this.sample, this.scratch);
      positions.set(this.sample.slice(0, 3), i * 3);
      // Dim the loops around Earth so they do not compete with the planet; blend across the flyby.
      color.copy(OUTBOUND_COLOR).lerp(RETURN_COLOR, THREE.MathUtils.smoothstep(p, flyby - 0.01, flyby + 0.01));
      color.multiplyScalar(0.55 + 0.45 * THREE.MathUtils.smoothstep(p, 0.26, 0.30) * (1 - THREE.MathUtils.smoothstep(p, 0.90, 0.94)));
      colors.set([color.r, color.g, color.b], i * 3);
      this.bounds.expandByPoint(new THREE.Vector3(...this.sample.slice(0, 3)));
      this.bounds.expandByPoint(new THREE.Vector3(...this.sample.slice(3, 6)));
    }
    this.bounds.expandByPoint(new THREE.Vector3(-1.1, -1.1, -1.1)); this.bounds.expandByPoint(new THREE.Vector3(1.1, 1.1, 1.1));
    const geometry = new LineGeometry(); geometry.setPositions(positions); geometry.setColors(colors);
    this.path = new Line2(geometry, new LineMaterial({ vertexColors: true, linewidth: PATH_WIDTH, alphaToCoverage: true })); this.group.add(this.path);
    // A short highlight behind Orion, brightest at the craft; instance 0 is the segment at its position.
    const trailGeometry = new LineGeometry(); trailGeometry.setPositions(new Float32Array((TRAIL_SAMPLES + 1) * 3));
    const trailColors = new Float32Array((TRAIL_SAMPLES + 1) * 3);
    for (let i = 0; i <= TRAIL_SAMPLES; i += 1) { color.copy(TRAIL_COLOR).multiplyScalar(1 - 0.75 * i / TRAIL_SAMPLES); trailColors.set([color.r, color.g, color.b], i * 3); }
    trailGeometry.setColors(trailColors);
    this.trail = new Line2(trailGeometry, new LineMaterial({ vertexColors: true, linewidth: TRAIL_WIDTH, alphaToCoverage: true })); this.trail.frustumCulled = false; this.trail.renderOrder = 2; this.group.add(this.trail);
    displayState(this.data, this.basis, this.data.flyby, this.sample, this.scratch);
    this.sourceMoonRadius = Math.hypot(...this.sample.slice(3, 6));
    this.displayPositions = positions;
  }

  // Chapter pacing makes uniform progress coarse where time is compressed, such as at perigee,
  // so keep a sample wherever the route has turned or travelled enough to show as a straight segment.
  chooseSamples() {
    displayState(this.data, this.basis, this.data.flyby, this.sample, this.scratch);
    const sourceMoonRadius = Math.hypot(this.sample[3], this.sample[4], this.sample[5]);
    const point = (p) => { displayState(this.data, this.basis, timeAtProgress(this.data, p), this.sample, this.scratch); return new THREE.Vector3().fromArray(integratedPosition(this.sample, sourceMoonRadius, NOMINAL_MOON_RADIUS, p, this.pathSample)); };
    const kept = [0]; let previous = point(0); let heading = null; let travelled = 0; let turned = 0;
    for (let i = 1; i <= SAMPLE_GRID; i += 1) {
      const p = i / SAMPLE_GRID; const current = point(p); const step = current.clone().sub(previous); const length = step.length();
      if (length > 0) { step.divideScalar(length); if (heading) turned += heading.angleTo(step); heading = step; travelled += length; }
      if (travelled > MAX_SAMPLE_LENGTH || turned > MAX_SAMPLE_TURN || i === SAMPLE_GRID) { kept.push(p); travelled = 0; turned = 0; }
      previous = current;
    }
    return Float64Array.from(kept);
  }

  updateTrail() {
    // Find the last sample at or behind Orion, then walk back along the route.
    let low = 0; let high = this.count - 1;
    while (high - low > 1) { const mid = (low + high) >> 1; if (this.sampleProgress[mid] <= this.progress) low = mid; else high = mid; }
    const segments = this.trail.geometry.attributes.instanceStart.data; const from = this.displayPositions; let length = 0;
    for (let index = low; index > 0 && length < TRAIL_SAMPLES && this.progress - this.sampleProgress[index] < TRAIL_PROGRESS; index -= 1, length += 1) {
      const a = index * 3; const b = a - 3;
      segments.array.set([from[a], from[a+1], from[a+2], from[b], from[b+1], from[b+2]], length * 6);
    }
    segments.needsUpdate = true; this.trail.geometry.instanceCount = length;
  }

  makeLabels() {
    this.overlay = document.querySelector('#mission-overlay'); this.labels = [];
    for (const [id, text] of [['earth', 'Earth'], ['moon', 'Moon · moving'], ['orion', 'Orion · enlarged']]) {
      const label = document.createElement(id === 'orion' ? 'button' : 'span');
      label.className = `mission-tag mission-tag--${id}`; label.textContent = text;
      if (id === 'orion') { label.type = 'button'; label.setAttribute('aria-label', 'Select and follow Orion'); label.addEventListener('click', () => this.setCamera('follow')); }
      this.overlay.append(label); this.labels.push({ id, label, world: new THREE.Vector3() });
    }
  }

  enable() {
    if (this.active) return;
    this.saved = { min: this.view.controls.minDistance, max: this.view.controls.maxDistance };
    if (this.progress >= 1) this.progress = 0;
    this.playing = true; this.wasPlaying = true; this.catchingUp = false;
    this.active = true; this.group.visible = true; this.overlay.hidden = false;
    this.updateReference(true);
    this.view.focusTarget = null; this.view.focusPosition = null; this.view.followSelected = false;
    this.dirty = true; this.applyState(); this.setCamera('overview'); this.emit();
  }

  disable() {
    if (!this.active) return;
    const ownedCamera = Boolean(this.cameraMode);
    this.active = false; this.group.visible = false; this.overlay.hidden = true; this.cameraMode = null;
    if (ownedCamera) {
      this.view.controls.minDistance = this.saved.min; this.view.controls.maxDistance = this.saved.max;
    }
    // Keep the current camera pose; returning to overview uses the host's smooth transition.

  }

  seek(progress) { this.progress = clamp(progress); this.catchingUp = false; this.dirty = true; this.emit(); }
  restart() { this.seek(0); this.playing = true; this.setCamera('overview'); this.emit(); }
  setTrajectory(visible) { this.trajectoryVisible = visible; this.path.visible = visible; this.trail.visible = visible; this.emit(); }
  releaseCamera() { this.cameraMode = null; this.emit(); }

  setCamera(mode) {
    if (!this.active) return;
    if (mode === 'flyby') this.seek(progressAtTime(this.data, this.data.flyby));
    if (mode === 'return') this.seek(0.80);
    this.cameraMode = mode; this.view.focusTarget = null; this.view.focusPosition = null; this.view.followSelected = false;
    this.dirty = true; this.applyState(); this.calculateTarget(); this.previousTarget.copy(this.target);
    const aspectFit = Math.max(1, 1 / this.view.camera.aspect);
    if (mode === 'overview') this.offset.set(2, 5, 8).multiplyScalar(aspectFit);
    else if (mode === 'flyby') this.offset.set(1.4, 0.9, 1.9).multiplyScalar(aspectFit);
    else if (mode === 'return') this.offset.set(1.5, 3, 7).multiplyScalar(aspectFit * Math.max(1, this.worldShip.distanceTo(this.earthWorld)/7));
    else this.offset.set(0.65, 0.45, 0.9).multiplyScalar(aspectFit);
    this.offset.applyQuaternion(this.group.quaternion);
    this.transitioning = true; this.view.controls.minDistance = 0.35; this.view.controls.maxDistance = 85; this.emit();
  }

  calculateTarget() {
    if (this.cameraMode === 'overview') this.target.copy(this.earthWorld).lerp(this.worldMoon, 0.5);
    else if (this.cameraMode === 'flyby') this.target.copy(this.worldMoon).lerp(this.worldShip, 0.45);
    else if (this.cameraMode === 'return') this.target.copy(this.worldShip).lerp(this.earthWorld, 0.5);
    else this.target.copy(this.worldShip);
  }

  updateReference(alignRoute = false, delta = 0) {
    const earth = this.view.bodies.get('Earth'); const moon = this.view.bodies.get('Moon');
    earth.root.getWorldPosition(this.earthWorld); moon.root.getWorldPosition(this.worldMoon);
    this.group.position.copy(this.earthWorld);
    this.moonLocal.copy(this.worldMoon).sub(this.earthWorld);
    if (alignRoute) {
      // Read the original lunar hierarchy; never write celestial transforms.
      moon.root.parent.getWorldQuaternion(this.routeRotation);
      if (this.catchingUp && delta > 0) {
        this.group.quaternion.rotateTowards(this.routeRotation, delta * 8);
        if (this.group.quaternion.angleTo(this.routeRotation) < 0.001) this.catchingUp = false;
      } else this.group.quaternion.copy(this.routeRotation);
    }
    this.group.updateWorldMatrix(true, false);
  }

  adapt(position, progress, out) {
    return integratedPosition(position, this.sourceMoonRadius, this.moonLocal.length(), progress, out);
  }

  applyState(delta = 0) {
    if (!this.active) return;
    // Even with Orion paused, the Earth-relative origin and camera follow the host system.
    this.updateReference(this.playing || this.dirty, delta);
    if (this.dirty || this.playing) {
      const time = timeAtProgress(this.data, this.progress); this.elapsed = time;
      displayState(this.data, this.basis, time, this.sample, this.scratch);
      this.adapt(this.sample, this.progress, this.pathSample);
      this.orion.group.position.fromArray(this.pathSample);
      const next = Math.min(1, this.progress + 0.0005);
      displayState(this.data, this.basis, timeAtProgress(this.data, next), this.nextSample, this.scratch);
      this.adapt(this.nextSample, next, this.pathSample);
      this.tangent.fromArray(this.pathSample).sub(this.orion.group.position);
      if (this.tangent.lengthSq() > 1e-12) {
        this.tangent.normalize(); if (this.progress >= 0.94) this.tangent.negate();
        this.orion.group.quaternion.setFromUnitVectors(this.up, this.tangent);
      }
      // Scale the precomputed NASA-inspired route to the ordinary lunar spacing.
      if (!this.pathAdapted) {
        for (let i = 0; i < this.count; i++) {
          displayState(this.data, this.basis, timeAtProgress(this.data, this.sampleProgress[i]), this.sample, this.scratch);
          this.adapt(this.sample, this.sampleProgress[i], this.pathSample); this.displayPositions.set(this.pathSample, i*3);
        }
        this.path.geometry.setPositions(this.displayPositions); this.pathAdapted = true;
      }
    }
    this.orion.service.visible = this.progress < 0.94;
    this.orion.solarWings.forEach((wing) => { wing.visible = this.progress >= 0.12 && this.progress < 0.94; });
    this.orion.parachutes.visible = this.progress >= 0.985;
    this.updateTrail();
    this.group.updateWorldMatrix(true, true);
    this.orion.group.getWorldPosition(this.worldShip);
    this.dirty = false;
  }

  update(delta, globalSpeed, globalPlaying) {
    if (!this.active) return;
    if (this.playing && !this.wasPlaying) this.catchingUp = true;
    this.wasPlaying = this.playing;
    if (this.playing && globalPlaying && globalSpeed > 0 && this.progress < 1) {
      // The replay has its own clock: the simulation only holds it (Pause), it never rescales it.
      this.progress = clamp(this.progress + delta * this.speed / PLAYBACK_SECONDS); this.dirty = true;
      if (this.progress === 1) this.playing = false;
    }
    this.applyState(delta);
    if (this.cameraMode) {
      this.calculateTarget(); this.deltaTarget.copy(this.target).sub(this.previousTarget);
      this.view.camera.position.add(this.deltaTarget); this.view.controls.target.add(this.deltaTarget); this.previousTarget.copy(this.target);
      if (this.transitioning) {
        const alpha = 1 - Math.exp(-delta * 4);
        this.desiredCamera.copy(this.target).add(this.offset);
        this.view.camera.position.lerp(this.desiredCamera, alpha); this.view.controls.target.lerp(this.target, alpha);
        if (this.view.camera.position.distanceTo(this.desiredCamera) < 0.008) this.transitioning = false;
      }
    }
    this.uiTime += delta; if (this.uiTime > 0.1) { this.uiTime = 0; this.emit(); }
  }

  updateLabels() {
    this.view.camera.updateMatrixWorld();
    for (const item of this.labels) {
      if (item.id === 'earth') item.world.copy(this.earthWorld);
      if (item.id === 'moon') item.world.copy(this.worldMoon);
      if (item.id === 'orion') item.world.copy(this.worldShip);
      item.world.project(this.view.camera);
      item.label.hidden = item.world.z < -1 || item.world.z > 1 || Math.abs(item.world.x) > 0.93 || Math.abs(item.world.y) > 0.88;
      item.label.style.left = `${(item.world.x + 1) * 50}%`; item.label.style.top = `${(1 - item.world.y) * 50}%`;
    }
  }

  pick(raycaster) {
    if (!this.active) return false;
    const sphere = new THREE.Sphere(this.worldShip, 0.22);
    const hit = raycaster.ray.intersectSphere(sphere, this.deltaTarget);
    if (!hit) return false;
    // Earth or Moon in front of the craft must win the pick.
    for (const [position, radius] of [[this.earthWorld, 0.9], [this.worldMoon, 0.28]]) {
      const bodyHit = raycaster.ray.intersectSphere(new THREE.Sphere(position, radius), this.desiredCamera);
      if (bodyHit && bodyHit.distanceToSquared(raycaster.ray.origin) < hit.distanceToSquared(raycaster.ray.origin)) return false;
    }
    this.setCamera('follow'); return true;
  }

  get phase() { let index = 0; for (let i = 1; i < MISSION_PHASES.length; i += 1) if (this.progress >= MISSION_PHASES[i].start) index = i; return index; }
  emit() { this.onChange?.(this); }
  dispose() {
    this.disable(); this.view.controls.removeEventListener('start', this.onControlsStart);
    const geometries = new Set(); const materials = new Set();
    this.group.traverse((object) => { if (object.geometry) geometries.add(object.geometry); if (object.material) materials.add(object.material); });
    geometries.forEach((geometry) => geometry.dispose()); materials.forEach((material) => material.dispose());
    this.group.removeFromParent(); this.labels.forEach(({ label }) => label.remove());
  }
}
