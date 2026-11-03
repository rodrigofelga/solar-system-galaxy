import * as THREE from 'three';
import { BlackHoleLens } from './black-hole-lens.js';

const smoothstep = THREE.MathUtils.smoothstep;
// Camera distances over which the close-up replaces the small model seen from the galaxy.
const LENS_FAR = 90;
const LENS_NEAR = 42;
const LENS_FADE_RATE = 5;

/** The small model seen from the galaxy and the journey, plus the close-up. Neither is an EHT reconstruction. */
export class GalacticBlackHole {
  constructor(skyTexture) {
    this.group = new THREE.Group();
    this.group.name = 'Sagittarius A* (enlarged illustration)';
    this.time = 0;
    const shadow = new THREE.Mesh(new THREE.SphereGeometry(0.95, 64, 48), new THREE.MeshBasicMaterial({ color: 0x010105 }));
    this.group.add(shadow);

    this.diskMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      transparent: true, side: THREE.DoubleSide, depthWrite: false,
      vertexShader: `varying vec2 vDisk;
        void main() { vDisk = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uTime; varying vec2 vDisk;
        void main() {
          float r = length(vDisk); float a = atan(vDisk.y, vDisk.x);
          float flow = a * 7.0 - uTime * 0.8 + r * 5.0;
          float filaments = 0.6 + 0.22 * sin(flow + 1.8 * sin(a * 3.0 + r * 8.0 - uTime))
            + 0.18 * sin(r * 46.0 + a * 5.0 - uTime * 1.5);
          float inner = exp(-(r - 1.12) * 1.15);
          float edges = smoothstep(1.08, 1.2, r) * (1.0 - smoothstep(2.6, 4.0, r));
          float bright = (0.4 + 0.6 * filaments) * (0.7 + 0.3 * sin(a + 1.0));
          vec3 col = mix(vec3(0.32, 0.08, 0.5), vec3(1.0, 0.32, 0.06), inner);
          col = mix(col, vec3(1.0, 0.87, 0.5), pow(inner, 3.0) * 0.85);
          gl_FragColor = vec4(col * (0.75 + bright), edges * (0.22 + inner * 0.7) * bright);
        }`,
    });
    const disk = new THREE.Mesh(new THREE.RingGeometry(1.08, 4, 160, 24), this.diskMaterial);
    disk.rotation.x = -Math.PI / 2;
    disk.renderOrder = 2;
    this.group.add(disk);

    // A camera-facing light ring evokes bent light; it does not solve geodesics.
    this.ringMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, depthTest: false,
      vertexShader: `varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uTime; varying vec2 vUv;
        void main() {
          vec2 p = (vUv - 0.5) * 6.0; float d = length(p); float a = atan(p.y, p.x);
          if (d < 0.94) { gl_FragColor = vec4(0.003, 0.003, 0.01, 1.0); return; }
          float ring = exp(-pow((d - 1.06) / 0.075, 2.0));
          float glow = exp(-pow((d - 1.1) / 0.24, 2.0)) * 0.4;
          float flow = 0.72 + 0.2 * sin(a * 3.0 - uTime * 0.5) + 0.08 * sin(a * 11.0 + uTime);
          float opacity = (ring + glow) * flow * smoothstep(0.94, 1.0, d);
          gl_FragColor = vec4(mix(vec3(1.0, 0.27, 0.035), vec3(1.0, 0.85, 0.4), ring), opacity);
        }`,
    });
    this.lightRing = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), this.ringMaterial);
    this.lightRing.renderOrder = 3;
    this.group.add(this.lightRing);
    this.group.scale.setScalar(0.55);
    this.closeup = false;
    this.lens = new BlackHoleLens(skyTexture);
  }

  setCloseup(enabled) { this.closeup = enabled; }

  update(simDelta, camera) {
    this.time += simDelta;
    this.diskMaterial.uniforms.uTime.value = this.time;
    this.ringMaterial.uniforms.uTime.value = this.time;
    this.lightRing.quaternion.copy(camera.quaternion);
  }

  // flowDelta is the close-up's own clock, so pausing the light leaves the camera free.
  updateCloseup(delta, flowDelta, camera, height) {
    const near = this.closeup ? 1 - smoothstep(camera.position.length(), LENS_NEAR, LENS_FAR) : 0;
    let mix = this.lens.mix + (near - this.lens.mix) * (1 - Math.exp(-delta * LENS_FADE_RATE));
    if (Math.abs(near - mix) < 0.002) mix = near;
    this.lens.mix = mix;
    this.group.visible = mix < 0.5;
    this.lens.update(flowDelta, camera, height);
    return mix;
  }

  dispose() { this.lens.dispose(); }
}
