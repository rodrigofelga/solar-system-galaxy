import * as THREE from 'three';
import { createOrion } from './orion-model.js';
import { referenceBasis, displayState, physicalState, timeAtProgress, progressAtTime, clamp, PLAYBACK_SECONDS } from './trajectory.js';

export const MISSION_PHASES = [
  { start: 0, title: 'Launch & initial Earth orbit', text: 'SLS lifts Orion from Earth. This opening segment illustrates launch and early Earth orbit; the local OEM does not cover ascent. The launch rocket is not carried along on the lunar journey.' },
  { start: 0.12, title: 'High Earth orbit & checks', text: 'The crew checks life support, navigation, communications, and spacecraft handling before committing to deep space. Orion and its European Service Module travel together.' },
  { start: 0.26, title: 'Translunar injection', text: 'A service-module engine burn sends Orion out of Earth orbit. The mission then coasts toward the Moon; there is no continuous engine flame.' },
  { start: 0.30, title: 'Outbound lunar coast', text: 'The Moon moves ahead as Orion travels outward. The complete path is Earth-centred: its far-side arc marks where the Moon will be at the flyby, rather than its position at departure.' },
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
    this.makePath(); this.makeLabels();
    this.onControlsStart = () => { this.transitioning = false; };
    view.controls.addEventListener('start', this.onControlsStart);
  }

  makePath() {
    this.count = 1601; const positions = new Float32Array(this.count * 3); const colors = new Float32Array(this.count * 3);
    const color = new THREE.Color(); this.bounds = new THREE.Box3();
    for (let i = 0; i < this.count; i += 1) {
      const p = i / (this.count - 1); displayState(this.data, this.basis, timeAtProgress(this.data, p), this.sample, this.scratch);
      positions.set(this.sample.slice(0, 3), i * 3);
      color.set(p < 0.30 ? 0xe7c48e : (p < progressAtTime(this.data, this.data.flyby) ? 0x63d7ef : 0xff9b79));
      colors.set([color.r, color.g, color.b], i * 3);
      this.bounds.expandByPoint(new THREE.Vector3(...this.sample.slice(0, 3)));
      this.bounds.expandByPoint(new THREE.Vector3(...this.sample.slice(3, 6)));
    }
    this.bounds.expandByPoint(new THREE.Vector3(-1.1, -1.1, -1.1)); this.bounds.expandByPoint(new THREE.Vector3(1.1, 1.1, 1.1));
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.path = new THREE.Line(geometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 })); this.group.add(this.path);
    const trailGeometry = new THREE.BufferGeometry(); trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3));
    this.trail = new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({ color: 0xffe7a4, depthTest: false })); this.trail.renderOrder = 2; this.group.add(this.trail);
    displayState(this.data, this.basis, this.data.flyby, this.sample, this.scratch);
    this.flybyMoon = new THREE.Vector3(this.sample[3], this.sample[4], this.sample[5]);
    this.flybyShip = new THREE.Vector3(this.sample[0], this.sample[1], this.sample[2]);
    this.ghost = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 10), new THREE.MeshBasicMaterial({ color: 0x9db6cd, wireframe: true, transparent: true, opacity: 0.16, depthWrite: false }));
    this.ghost.position.copy(this.flybyMoon); this.group.add(this.ghost);
  }

  makeLabels() {
    this.overlay = document.querySelector('#mission-overlay'); this.labels = [];
    for (const [id, text] of [['earth', 'Earth'], ['moon', 'Moon · moving'], ['orion', 'Orion · enlarged'], ['flyby', 'Moon at flyby']]) {
      const label = document.createElement(id === 'orion' ? 'button' : 'span');
      label.className = `mission-tag mission-tag--${id}`; label.textContent = text;
      if (id === 'orion') { label.type = 'button'; label.setAttribute('aria-label', 'Select and follow Orion'); label.addEventListener('click', () => this.setCamera('follow')); }
      this.overlay.append(label); this.labels.push({ id, label, world: new THREE.Vector3() });
    }
  }

  enable() {
    if (this.active) return;
    const earth = this.view.bodies.get('Earth'); const moon = this.view.bodies.get('Moon');
    const clouds = earth.root.children.find((item) => item.userData.cloudLayer);
    this.saved = { moonParent: moon.root.parent, moonPosition: moon.root.position.clone(), moonQuaternion: moon.root.quaternion.clone(), moonScale: moon.root.scale.clone(), moonSpin: moon.mesh.rotation.y,
      earthAngle: earth.orbitPivot.rotation.y, earthSpin: earth.mesh.rotation.y, cloudSpin: clouds?.rotation.y || 0,
      camera: this.view.camera.position.clone(), target: this.view.controls.target.clone(), min: this.view.controls.minDistance, max: this.view.controls.maxDistance };
    this.active = true; this.group.visible = true; this.overlay.hidden = false;
    this.group.quaternion.setFromAxisAngle(this.up, this.saved.earthAngle);
    this.group.add(moon.root); moon.root.quaternion.identity(); moon.root.scale.set(1, 1, 1);
    moon.orbit.visible = false;
    this.view.focusTarget = null; this.view.focusPosition = null; this.view.followSelected = false;
    this.dirty = true; this.applyState(); this.setCamera('overview'); this.emit();
  }

  disable() {
    if (!this.active) return;
    this.active = false; this.group.visible = false; this.overlay.hidden = true; this.cameraMode = null;
    const moon = this.view.bodies.get('Moon'); this.saved.moonParent.add(moon.root);
    moon.root.position.copy(this.saved.moonPosition); moon.root.quaternion.copy(this.saved.moonQuaternion); moon.root.scale.copy(this.saved.moonScale); moon.mesh.rotation.y = this.saved.moonSpin;
    moon.orbit.visible = this.view.showOrbits;
    this.view.focusTarget = null; this.view.focusPosition = null; this.view.followSelected = false;
    this.view.camera.position.copy(this.saved.camera); this.view.controls.target.copy(this.saved.target);
    this.view.controls.minDistance = this.saved.min; this.view.controls.maxDistance = this.saved.max; this.view.controls.update();
  }

  seek(progress) { this.progress = clamp(progress); this.dirty = true; this.emit(); }
  restart() { this.seek(0); this.playing = true; this.setCamera('overview'); this.emit(); }
  setTrajectory(visible) { this.trajectoryVisible = visible; this.path.visible = visible; this.trail.visible = visible; this.ghost.visible = visible && Math.abs((this.elapsed || 0)-this.data.flyby) > 1800; this.emit(); }
  releaseCamera() { this.cameraMode = null; this.emit(); }

  setCamera(mode) {
    if (!this.active) return;
    if (mode === 'flyby') { this.seek(progressAtTime(this.data, this.data.flyby)); this.playing = false; }
    if (mode === 'return') { this.seek(0.80); this.playing = false; }
    this.cameraMode = mode; this.view.focusTarget = null; this.view.focusPosition = null; this.view.followSelected = false;
    this.dirty = true; this.applyState(); this.calculateTarget(); this.previousTarget.copy(this.target);
    const aspectFit = Math.max(1, 1 / this.view.camera.aspect);
    if (mode === 'overview') this.offset.set(3, 14, 22).multiplyScalar(aspectFit);
    else if (mode === 'flyby') this.offset.set(1.4, 0.9, 1.9).multiplyScalar(aspectFit);
    else if (mode === 'return') this.offset.set(1.5, 3, 7).multiplyScalar(aspectFit * Math.max(1, this.worldShip.distanceTo(this.earthWorld)/7));
    else this.offset.set(0.65, 0.45, 0.9).multiplyScalar(aspectFit);
    this.offset.applyQuaternion(this.group.quaternion);
    this.transitioning = true; this.view.controls.minDistance = 0.35; this.view.controls.maxDistance = 85; this.emit();
  }

  calculateTarget() {
    if (this.cameraMode === 'overview') this.target.copy(this.bounds.getCenter(this.target)).applyQuaternion(this.group.quaternion).add(this.earthWorld);
    else if (this.cameraMode === 'flyby') this.target.copy(this.worldMoon).lerp(this.worldShip, 0.45);
    else if (this.cameraMode === 'return') this.target.copy(this.worldShip).lerp(this.earthWorld, 0.5);
    else this.target.copy(this.worldShip);
  }

  applyState() {
    if (!this.active || !this.dirty) return;
    const time = timeAtProgress(this.data, this.progress); this.elapsed = time;
    const days = time / 86400; const earth = this.view.bodies.get('Earth'); const moon = this.view.bodies.get('Moon');
    earth.orbitPivot.rotation.y = this.saved.earthAngle + days * Math.PI * 2 / 365.25;
    earth.mesh.rotation.y = this.saved.earthSpin + days * Math.PI * 2 / 0.997;
    for (const child of earth.root.children) if (child.userData.cloudLayer) child.rotation.y = this.saved.cloudSpin + days * Math.PI * 2 / 3.5;
    earth.root.getWorldPosition(this.earthWorld); this.group.position.copy(this.earthWorld);
    displayState(this.data, this.basis, time, this.sample, this.scratch);
    this.orion.group.position.fromArray(this.sample); moon.root.position.fromArray(this.sample, 3);
    moon.mesh.rotation.y = this.saved.moonSpin + days * Math.PI * 2 / 27.3;
    displayState(this.data, this.basis, Math.min(this.data.end, time + 2), this.nextSample, this.scratch);
    if (time >= this.data.end - 2) { displayState(this.data, this.basis, time - 2, this.nextSample, this.scratch); this.tangent.set(this.sample[0]-this.nextSample[0], this.sample[1]-this.nextSample[1], this.sample[2]-this.nextSample[2]); }
    else this.tangent.set(this.nextSample[0]-this.sample[0], this.nextSample[1]-this.sample[1], this.nextSample[2]-this.sample[2]);
    this.tangent.normalize(); if (this.progress >= 0.94) this.tangent.negate();
    this.orion.group.quaternion.setFromUnitVectors(this.up, this.tangent);
    this.orion.service.visible = this.progress < 0.94;
    this.orion.solarWings.forEach((wing) => { wing.visible = this.progress >= 0.12 && this.progress < 0.94; });
    this.orion.parachutes.visible = this.progress >= 0.985;
    const index = Math.floor(this.progress * (this.count-1)); this.trail.geometry.setDrawRange(Math.max(0, index-45), Math.min(index, 45)+1);
    this.group.updateWorldMatrix(true, true);
    this.orion.group.getWorldPosition(this.worldShip); moon.root.getWorldPosition(this.worldMoon);
    this.ghost.visible = this.trajectoryVisible && Math.abs(time - this.data.flyby) > 1800;
    this.dirty = false;
  }

  update(delta, globalSpeed, globalPlaying) {
    if (!this.active) return;
    if (this.playing && globalPlaying && globalSpeed > 0 && this.progress < 1) {
      this.progress = clamp(this.progress + delta * globalSpeed * this.speed / PLAYBACK_SECONDS); this.dirty = true;
      if (this.progress === 1) this.playing = false;
    }
    this.applyState();
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
      if (item.id === 'flyby') this.group.localToWorld(item.world.copy(this.flybyMoon));
      item.world.project(this.view.camera);
      item.label.hidden = item.world.z < -1 || item.world.z > 1 || Math.abs(item.world.x) > 0.93 || Math.abs(item.world.y) > 0.88 || (item.id === 'flyby' && (!this.ghost.visible || !this.trajectoryVisible));
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
