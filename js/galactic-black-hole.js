import * as THREE from 'three';

/** Enlarged teaching model, not a relativistic renderer or an EHT reconstruction. */
export class GalacticBlackHole {
  constructor() {
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
    this.createWind();
    this.setCloseup(false);
  }

  createWind() {
    const count = 1800;
    const params = new Float32Array(count * 3);
    // Fixed seeds keep the shape reproducible between loads.
    let seed = 1974;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < count; i += 1) {
      params[i * 3] = random() * Math.PI * 2;
      params[i * 3 + 1] = random();
      params[i * 3 + 2] = i % 2 ? 1 : -1;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute('aParams', new THREE.BufferAttribute(params, 3));
    this.windMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPixels: { value: 600 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec3 aParams; uniform float uTime; uniform float uPixels; varying float vFade;
        void main() {
          float t = fract(aParams.y + uTime * 0.035);
          float h = 0.8 + t * 6.5; float r = 0.4 + h * (0.2 + 0.25 * fract(aParams.x));
          float a = aParams.x + t * 0.65;
          vec3 p = vec3(cos(a) * r, h * aParams.z, sin(a) * r);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(0.4 * uPixels / max(1.0, -mv.z), 1.0, 38.0);
          vFade = sin(t * 3.141593) * 0.06;
        }`,
      fragmentShader: `varying float vFade;
        void main() { float d = length(gl_PointCoord - 0.5) * 2.0;
          if (d > 1.0) discard; gl_FragColor = vec4(0.35, 0.3, 0.95, exp(-d*d*5.0) * vFade); }`,
    });
    this.wind = new THREE.Points(geometry, this.windMaterial);
    this.wind.frustumCulled = false;
    this.group.add(this.wind);
  }

  setCloseup(enabled) {
    this.closeup = enabled;
    this.group.scale.setScalar(enabled ? 1 : 0.55);
    this.wind.visible = enabled;
  }

  update(simDelta, camera, pixels) {
    this.time += simDelta;
    this.diskMaterial.uniforms.uTime.value = this.time;
    this.ringMaterial.uniforms.uTime.value = this.time;
    this.windMaterial.uniforms.uTime.value = this.time;
    this.windMaterial.uniforms.uPixels.value = pixels;
    this.lightRing.quaternion.copy(camera.quaternion);
  }
}
