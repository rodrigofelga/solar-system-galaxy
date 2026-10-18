import * as THREE from 'three';
import { SURFACE_VERTEX, SURFACE_FRAGMENT, CORONA_VERTEX, CORONA_FRAGMENT, PROMINENCE_VERTEX, PROMINENCE_FRAGMENT } from './solar-shaders.js';

const CORONA_SPAN = 3.1; // half-width of the corona billboard in solar radii
const QUALITY_PRESETS = [
  { name: 'low', octaves: 3, warp: false, fine: false, loops: 2, streamers: 0 },
  { name: 'medium', octaves: 4, warp: true, fine: false, loops: 4, streamers: 1 },
  { name: 'high', octaves: 5, warp: true, fine: true, loops: 6, streamers: 1 },
];

// Illustrative surface features, defined once in object space and shared by the shader and the interaction markers
// so that markers stay locked to what is drawn. Real active regions and sunspots appear within about +/-35 degrees of the equator.
const solarDirection = (latitudeDeg, longitudeDeg) => {
  const lat = THREE.MathUtils.degToRad(latitudeDeg);
  const lon = THREE.MathUtils.degToRad(longitudeDeg);
  return new THREE.Vector3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));
};
const ACTIVE_REGIONS = [solarDirection(18, 40), solarDirection(-14, 215)];
// [direction, umbra angular radius in radians]; two spots inside each active region.
const SUNSPOTS = [
  [solarDirection(20, 36), 0.05], [solarDirection(16, 46), 0.04],
  [solarDirection(-12, 211), 0.045], [solarDirection(-16, 220), 0.035],
];
const SUNSPOT_GROUPS = [solarDirection(18, 41), solarDirection(-14, 215.5)];
const GRANULATION_SPOT = solarDirection(4, 125);

/**
 * Self-contained animated Sun: GPU plasma surface, camera-facing corona and arcing prominences.
 * Usage: `const sun = new SolarSun(radius)`; add `sun.group` to the scene; call `sun.update()` per frame.
 * - `sun.mesh` is the pickable, axially-rotated photosphere (prominences are its children).
 * - `sun.group` is not rotated, so the corona billboard is unaffected by axial rotation.
 * Plasma time (`uTime`) advances independently of axial rotation and freezes with the global Pause.
 */
export class SolarSun {
  constructor(radius, { compact = false, forcedQuality = null } = {}) {
    this.radius = radius;
    this.time = 0;
    this.adaptive = forcedQuality === null;
    this.slowFrames = 0;
    this.smoothedDelta = 1 / 60;
    this.group = new THREE.Group();
    this.group.name = 'SolarSun';

    this.surfaceMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uRegions: { value: ACTIVE_REGIONS.map((d) => d.clone()) },
        uSpots: { value: SUNSPOTS.map(([d, a]) => new THREE.Vector4(d.x, d.y, d.z, a)) },
      },
      vertexShader: SURFACE_VERTEX,
      fragmentShader: SURFACE_FRAGMENT,
      defines: { OCTAVES: 5 },
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 64), this.surfaceMaterial);
    this.mesh.name = 'Sun';
    this.group.add(this.mesh);

    this.coronaMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uSpan: { value: CORONA_SPAN }, uStreamers: { value: 1 } },
      vertexShader: CORONA_VERTEX,
      fragmentShader: CORONA_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.corona = new THREE.Mesh(new THREE.PlaneGeometry(radius * CORONA_SPAN * 2, radius * CORONA_SPAN * 2), this.coronaMaterial);
    this.corona.renderOrder = 1;
    this.corona.frustumCulled = false;
    this.group.add(this.corona);

    this.createProminences();
    this.createMarkers();
    this.setQuality(forcedQuality ?? (compact ? 1 : 2));
  }

  /** Marker anchors in the Sun's rotating object space (Y is the rotation axis). */
  createMarkers() {
    const R = this.radius;
    this.hoverKey = null;
    this.selectedLoop = null;
    const texture = this.createRingTexture();
    const defs = [
      { id: 'activeRegion', dir: ACTIVE_REGIONS[0], label: 'Magnetic active region' },
      { id: 'sunspot', dir: SUNSPOT_GROUPS[0], label: 'Sunspots' },
      { id: 'sunspot', dir: SUNSPOT_GROUPS[1], label: 'Sunspots' },
      { id: 'granulation', dir: GRANULATION_SPOT, label: 'Photospheric granulation' },
    ];
    this.markers = defs.map((def, index) => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.5, depthWrite: false }));
      sprite.position.copy(def.dir).multiplyScalar(R * 1.012);
      sprite.scale.setScalar(R * 0.1);
      sprite.renderOrder = 3;
      sprite.visible = false;
      this.mesh.add(sprite);
      return { ...def, key: `surface-${index}`, sprite, surface: true };
    });
    // The corona is not attached to a surface point, so its marker floats just outside the limb, facing the camera.
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.5, depthWrite: false }));
    sprite.scale.setScalar(R * 0.1);
    sprite.renderOrder = 3;
    sprite.visible = false;
    this.group.add(sprite);
    this.coronaMarker = { id: 'corona', key: 'corona', label: 'Solar corona', sprite, surface: false };
    this.markers.push(this.coronaMarker);
    this.exploreMode = false;
  }

  createRingTexture() {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = 'rgba(190, 235, 255, 0.95)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(size / 2, size / 2, size * 0.34, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(190, 235, 255, 0.9)';
    ctx.beginPath(); ctx.arc(size / 2, size / 2, 3, 0, Math.PI * 2); ctx.fill();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  setExploreMode(enabled) {
    this.exploreMode = Boolean(enabled);
    this.markers.forEach((marker) => { marker.sprite.visible = this.exploreMode; });
    if (!this.exploreMode) { this.hoverKey = null; this.setSelectedLoop(null); }
  }

  /** World-space anchor of each marker, with a flag for whether it faces the camera. */
  getMarkerWorldPositions(camera, target = []) {
    const center = this.group.getWorldPosition(new THREE.Vector3());
    const toCamera = camera.getWorldPosition(new THREE.Vector3()).sub(center).normalize();
    this.mesh.updateWorldMatrix(true, false);
    return this.markers.map((marker, i) => {
      const world = marker.sprite.getWorldPosition(target[i]?.world ?? new THREE.Vector3());
      const facing = marker.surface ? world.clone().sub(center).normalize().dot(toCamera) > 0.08 : true;
      return { id: marker.id, key: marker.key, label: marker.label, world, facing };
    });
  }

  /** Current world-space polylines of the visible prominences, reflecting their animated height. */
  getLoopPolylines() {
    const R = this.radius;
    this.mesh.updateWorldMatrix(true, true);
    const result = [];
    this.loops.forEach((loop, index) => {
      if (!loop.holder.visible) return;
      const life = loop.material.uniforms.uLife.value;
      if (life < 0.18) return;
      const points = loop.samples.map((local) => {
        const r = local.length();
        const scaled = local.clone().multiplyScalar((R * 0.99 + (r - R * 0.99) * life) / r);
        return loop.holder.localToWorld(scaled);
      });
      result.push({ index, key: `loop-${index}`, points });
    });
    return result;
  }

  placeCoronaMarker(camera) {
    const center = this.group.getWorldPosition(new THREE.Vector3());
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    this.coronaMarker.sprite.position.copy(center).addScaledVector(right, 0.8).addScaledVector(up, 0.55).sub(center).normalize().multiplyScalar(this.radius * 1.75).add(center);
  }

  setHover(key) { this.hoverKey = key; }

  setSelectedLoop(index) {
    if (this.selectedLoop === index) return;
    if (index !== null && this.selectedLoop !== index) this.holdLoopAtPeak(this.loops[index]);
    this.selectedLoop = index;
  }

  /** Pin a loop at the sustained part of its cycle while selected; its internal plasma flow keeps animating. */
  holdLoopAtPeak(loop) {
    const u = (this.time - loop.shift) / loop.period + loop.phase;
    const cycle = Math.floor(u);
    const f = u - cycle;
    if (f < 0.32 || f > 0.62) loop.shift = this.time - (cycle + 0.45 - loop.phase) * loop.period;
  }

  createProminences() {
    const R = this.radius;
    this.loops = [];
    const specs = [
      { span: 0.42, height: 0.55, period: 23, phase: 0.05 },
      { span: 0.3, height: 0.38, period: 17, phase: 0.45 },
      { span: 0.55, height: 0.7, period: 31, phase: 0.7 },
      { span: 0.26, height: 0.32, period: 19, phase: 0.25 },
      { span: 0.36, height: 0.48, period: 27, phase: 0.85 },
      { span: 0.48, height: 0.6, period: 21, phase: 0.6 },
    ];
    specs.forEach((spec, index) => {
      const material = new THREE.ShaderMaterial({
        uniforms: { uLife: { value: 0 }, uRadius: { value: R }, uTime: { value: 0 }, uSeed: { value: index * 13.7 }, uHighlight: { value: 0 } },
        vertexShader: PROMINENCE_VERTEX,
        fragmentShader: PROMINENCE_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const holder = new THREE.Group();
      const samples = [];
      [[1, 0], [0.82, 0.045]].forEach(([heightScale, lateral]) => {
        const points = [];
        for (let i = 0; i <= 24; i += 1) {
          const t = i / 24;
          const phi = (t - 0.5) * spec.span;
          const lift = R * 0.99 + R * spec.height * heightScale * Math.pow(Math.sin(Math.PI * t), 0.75);
          const wobble = R * lateral * Math.sin(t * Math.PI);
          points.push(new THREE.Vector3(Math.sin(phi) * lift, Math.cos(phi) * lift, wobble));
        }
        if (heightScale === 1) for (let i = 0; i < points.length; i += 2) samples.push(points[i]);
        const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 48, R * 0.03, 6, false), material);
        tube.renderOrder = 2;
        tube.frustumCulled = false;
        holder.add(tube);
      });
      this.mesh.add(holder);
      this.loops.push({ holder, material, samples, shift: 0, ...spec, cycle: -1 });
    });
  }

  setQuality(level) {
    const index = THREE.MathUtils.clamp(Math.round(level), 0, QUALITY_PRESETS.length - 1);
    if (index === this.qualityIndex) return;
    this.qualityIndex = index;
    const preset = QUALITY_PRESETS[index];
    this.quality = preset;
    const defines = this.surfaceMaterial.defines;
    defines.OCTAVES = preset.octaves;
    if (preset.warp) defines.WARP = 1; else delete defines.WARP;
    if (preset.fine) defines.FINE = 1; else delete defines.FINE;
    this.surfaceMaterial.needsUpdate = true;
    this.coronaMaterial.uniforms.uStreamers.value = preset.streamers;
    this.loops.forEach((loop, i) => { loop.holder.visible = i < preset.loops; });
  }

  randomizeLoop(loop) {
    const direction = new THREE.Vector3(Math.random() - 0.5, (Math.random() - 0.5) * 1.4, Math.random() - 0.5).normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2));
    loop.holder.quaternion.copy(quaternion);
  }

  /** Real-frame delta drives adaptive quality; `simDelta` (already scaled by speed/pause) drives animation. */
  update(realDelta, simDelta, camera) {
    this.time += simDelta;
    this.surfaceMaterial.uniforms.uTime.value = this.time;
    this.coronaMaterial.uniforms.uTime.value = this.time;
    this.corona.quaternion.copy(camera.quaternion);
    if (this.exploreMode) this.placeCoronaMarker(camera);

    const activity = 0.6 + 0.4 * Math.sin(this.time * 0.05);
    this.loops.forEach((loop, index) => {
      if (!loop.holder.visible) return;
      const selected = this.selectedLoop === index;
      if (selected) loop.shift += simDelta; // freeze the cycle phase while selected; plasma flow (uTime) still animates
      const u = (this.time - loop.shift) / loop.period + loop.phase;
      const cycle = Math.floor(u);
      if (cycle !== loop.cycle) { loop.cycle = cycle; this.randomizeLoop(loop); }
      const f = u - cycle;
      const envelope = THREE.MathUtils.smoothstep(f, 0, 0.3) * (1 - THREE.MathUtils.smoothstep(f, 0.65, 1));
      loop.material.uniforms.uLife.value = envelope * (selected ? 0.9 : activity);
      loop.material.uniforms.uTime.value = this.time;
      const target = selected ? 1 : (this.hoverKey === `loop-${index}` ? 0.5 : 0);
      const uniform = loop.material.uniforms.uHighlight;
      uniform.value += (target - uniform.value) * Math.min(1, realDelta * 8 + 0.02);
    });
    if (this.exploreMode) {
      this.markers.forEach((marker) => {
        const hovered = this.hoverKey === marker.key;
        marker.sprite.material.opacity += ((hovered ? 1 : 0.45) - marker.sprite.material.opacity) * 0.2;
        marker.sprite.scale.setScalar(this.radius * (hovered ? 0.13 : 0.1));
      });
    }

    if (this.adaptive && realDelta > 0) {
      this.smoothedDelta += (realDelta - this.smoothedDelta) * 0.05;
      this.slowFrames = this.smoothedDelta > 0.036 ? this.slowFrames + 1 : 0;
      if (this.slowFrames > 120 && this.qualityIndex > 0) { this.setQuality(this.qualityIndex - 1); this.slowFrames = 0; this.smoothedDelta = 1 / 60; }
    }
  }

  dispose() {
    this.group.traverse((object) => { object.geometry?.dispose(); object.material?.dispose?.(); });
  }
}
