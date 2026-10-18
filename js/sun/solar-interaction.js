import * as THREE from 'three';

const MIN_SUN_SCREEN_RADIUS = 60; // px; interaction is only active when the Sun is zoomed in enough to explore
const HOVER_THROTTLE_MS = 40;

/**
 * Screen-space picking for the Sun's solar-activity features.
 *
 * Prominence loops are thin tubes, so instead of ray-casting against them we project their (animated)
 * centre-lines to the screen and select the nearest one within a pixel tolerance. This gives forgiving
 * hit areas (larger for touch) that follow the animation exactly, and needs no extra invisible meshes.
 * Surface markers use the same tolerance. Anything behind the Sun's disk is ignored.
 */
export class SolarInteraction {
  constructor({ sun, camera, domElement, container, onHoverChange }) {
    this.sun = sun;
    this.camera = camera;
    this.dom = domElement;
    this.container = container;
    this.onHoverChange = onHoverChange;
    this.enabled = false;
    this.hovered = null;
    this.lastHover = 0;
    this.markerCache = [];
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'solar-tooltip';
    this.tooltip.setAttribute('aria-hidden', 'true');
    this.tooltip.hidden = true;
    container.append(this.tooltip);
    this.dom.addEventListener('pointermove', (event) => this.handleMove(event));
    this.dom.addEventListener('pointerleave', () => this.clearHover());
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    this.sun.setExploreMode(this.enabled);
    if (!this.enabled) this.clearHover();
  }

  /** True when the Sun is large enough on screen for feature selection to be meaningful. */
  isActive() {
    if (!this.enabled) return false;
    const center = this.sun.group.getWorldPosition(new THREE.Vector3());
    const distance = this.camera.position.distanceTo(center);
    const height = this.dom.clientHeight || 1;
    const radiusPx = (this.sun.radius / (distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2))) * (height / 2);
    return radiusPx >= MIN_SUN_SCREEN_RADIUS;
  }

  /** Finds the best feature under the pointer, or null. */
  pick(clientX, clientY, isTouch) {
    if (!this.isActive()) return null;
    const rect = this.dom.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const markerTolerance = isTouch ? 34 : 18;
    const loopTolerance = isTouch ? 30 : 13;
    const cameraPosition = this.camera.getWorldPosition(new THREE.Vector3());
    const center = this.sun.group.getWorldPosition(new THREE.Vector3());
    const occludeRadius = this.sun.radius * 0.985;
    const occluded = (point) => segmentHitsSphere(cameraPosition, point, center, occludeRadius);
    const toScreen = (point) => {
      const ndc = point.clone().project(this.camera);
      return { x: (ndc.x * 0.5 + 0.5) * rect.width, y: (-ndc.y * 0.5 + 0.5) * rect.height, behind: ndc.z > 1 };
    };
    let best = null;
    const consider = (score, hit) => { if (score <= 1 && (!best || score < best.score)) best = { score, ...hit }; };

    this.markerCache = this.sun.getMarkerWorldPositions(this.camera, this.markerCache);
    this.markerCache.forEach((marker) => {
      if (!marker.facing || occluded(marker.world)) return;
      const p = toScreen(marker.world);
      if (p.behind) return;
      // Markers win ties against loops they overlap because their targets are deliberate.
      consider(Math.hypot(p.x - sx, p.y - sy) / markerTolerance * 0.85, { id: marker.id, key: marker.key, label: marker.label });
    });

    this.sun.getLoopPolylines().forEach((loop) => {
      const pts = loop.points.map((point) => ({ ...toScreen(point), hidden: occluded(point) }));
      for (let i = 0; i < pts.length; i += 1) {
        const a = pts[i];
        if (a.behind || a.hidden) continue;
        consider(Math.hypot(a.x - sx, a.y - sy) / loopTolerance, { id: 'prominence', key: loop.key, loopIndex: loop.index, label: 'Solar prominence' });
        const b = pts[i + 1];
        if (!b || b.behind || b.hidden) continue;
        consider(distanceToSegment(sx, sy, a, b) / loopTolerance, { id: 'prominence', key: loop.key, loopIndex: loop.index, label: 'Solar prominence' });
      }
    });
    return best;
  }

  /** Returns true if a feature was selected for this tap, so normal body picking can be skipped. */
  handleTap(event, onFeature) {
    if (!this.enabled) return false;
    const hit = this.pick(event.clientX, event.clientY, event.pointerType !== 'mouse');
    if (!hit) return false;
    onFeature(hit);
    return true;
  }

  handleMove(event) {
    if (!this.enabled || event.pointerType !== 'mouse' || event.buttons !== 0) { if (this.hovered && event.buttons !== 0) this.clearHover(); return; }
    const now = performance.now();
    if (now - this.lastHover < HOVER_THROTTLE_MS) return;
    this.lastHover = now;
    const hit = this.pick(event.clientX, event.clientY, false);
    if (!hit) { this.clearHover(); return; }
    if (!this.hovered || this.hovered.key !== hit.key) {
      this.hovered = hit;
      this.sun.setHover(hit.key);
      this.tooltip.textContent = `${hit.label} · click to learn more`;
      this.onHoverChange?.(hit);
    }
    const rect = this.container.getBoundingClientRect();
    this.tooltip.style.transform = `translate(${Math.min(event.clientX - rect.left + 14, rect.width - 190)}px, ${Math.max(event.clientY - rect.top - 34, 4)}px)`;
    this.tooltip.hidden = false;
    this.dom.style.cursor = 'pointer';
  }

  clearHover() {
    if (!this.hovered && this.tooltip.hidden) return;
    this.hovered = null;
    this.sun.setHover(null);
    this.tooltip.hidden = true;
    this.dom.style.cursor = '';
    this.onHoverChange?.(null);
  }
}

function distanceToSegment(px, py, a, b) {
  const dx = b.x - a.x; const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : THREE.MathUtils.clamp(((px - a.x) * dx + (py - a.y) * dy) / lengthSquared, 0, 1);
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

/** True if the segment from `from` to `to` passes through the sphere before reaching `to`. */
function segmentHitsSphere(from, to, center, radius) {
  const d = to.clone().sub(from);
  const f = from.clone().sub(center);
  const a = d.dot(d);
  const b = 2 * f.dot(d);
  const c = f.dot(f) - radius * radius;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return false;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t > 0 && t < 0.999;
}
