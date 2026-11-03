import * as THREE from 'three';
import { SKY_GLSL } from './galaxy-sky.js';

// Quality drops one level at a time if frames run long; phones start at level 1.
export const LENS_QUALITY = [
  { steps: 90, pixelScale: 1 },
  { steps: 64, pixelScale: 0.8 },
  { steps: 44, pixelScale: 0.62 },
];

// One Schwarzschild radius in scene units. The shadow radius is about 2.6 times this.
const SCHWARZSCHILD_RADIUS = 0.4;
const NOISE_SIZE = 256;

// Tileable, so the disk has no seam where its angle wraps. Each channel is an independent pattern.
function createNoiseTexture() {
  let seed = 90210;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const size = NOISE_SIZE;
  const data = new Uint8Array(size * size * 4);
  const fade = (t) => t * t * (3 - 2 * t);
  for (let channel = 0; channel < 4; channel += 1) {
    const field = new Float32Array(size * size);
    let amplitude = 1; let total = 0;
    for (let cells = 4 + channel * 2; cells <= size / 2 && amplitude > 0.05; cells *= 2) {
      const lattice = Float32Array.from({ length: cells * cells }, random);
      const scale = cells / size;
      for (let y = 0; y < size; y += 1) {
        const v = y * scale; const y0 = Math.floor(v); const fy = fade(v - y0);
        for (let x = 0; x < size; x += 1) {
          const u = x * scale; const x0 = Math.floor(u); const fx = fade(u - x0);
          const at = (i, j) => lattice[(j % cells) * cells + (i % cells)];
          const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
          const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
          field[y * size + x] += amplitude * (top * (1 - fy) + bottom * fy);
        }
      }
      total += amplitude; amplitude *= 0.58;
    }
    let low = Infinity; let high = -Infinity;
    for (let i = 0; i < field.length; i += 1) { low = Math.min(low, field[i]); high = Math.max(high, field[i]); }
    for (let i = 0; i < field.length; i += 1) data[i * 4 + channel] = Math.round((field[i] - low) / (high - low) * 255);
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true; texture.needsUpdate = true;
  return texture;
}

const VERTEX = `varying vec2 vNdc;
  void main() { vNdc = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// Distances are in Schwarzschild radii. The step is the exact orbit equation for light in a
// non-rotating black hole's field; the disk is thin and the emission is procedural, so the
// bending is computed while the disk's appearance is illustrative.
const FRAGMENT = `precision highp float;
  varying vec2 vNdc;
  uniform mat4 uProjectionInverse; uniform mat4 uCameraWorld; uniform vec3 uCamera;
  uniform float uTime; uniform float uMix; uniform float uPixel; uniform int uSteps;
  uniform sampler2D uNoise; uniform samplerCube uSky; uniform float uSkyGain; uniform float uCloudGain;
  ${SKY_GLSL}
  const float TAU = 6.2831853;
  const float CRITICAL = 2.598076;
  const float DISK_INNER = 2.75;
  const float DISK_OUTER = 10.0;
  const float BOUND = 15.0;
  const float CYCLE = 9.0;

  float cycleSeed(float cycle) { return fract(sin(cycle * 12.9898) * 43758.5453); }

  // The pattern is carried at the local orbital rate. Pure shear would wind it into ever-finer rings,
  // so two copies, half a cycle apart, take turns: each fades out before it winds too far, and each
  // new cycle draws a different part of the noise, so the motion never repeats.
  float flowLayer(float phi, float logR, float rate, vec4 mask, vec2 scale, float lod, float time, float cycleLength) {
    float position = time / cycleLength; float value = 0.0;
    for (int i = 0; i < 2; i += 1) {
      float shifted = position + float(i) * 0.5;
      float cycle = floor(shifted); float local = shifted - cycle;
      float seed = cycleSeed(cycle + float(i) * 37.0);
      float angle = phi - rate * (local - 0.5) * cycleLength;
      vec2 uv = vec2(angle / TAU * scale.x + seed * 7.0, logR * scale.y + seed * 3.0);
      value += dot(textureLod(uNoise, uv, lod), mask) * (1.0 - abs(2.0 * local - 1.0));
    }
    return value;
  }

  vec3 heatColor(float heat) {
    vec3 color = mix(vec3(0.34, 0.035, 0.0), vec3(1.0, 0.25, 0.025), smoothstep(0.0, 0.32, heat));
    color = mix(color, vec3(1.0, 0.56, 0.13), smoothstep(0.24, 0.62, heat));
    color = mix(color, vec3(1.0, 0.84, 0.5), smoothstep(0.55, 1.05, heat));
    return mix(color, vec3(1.0, 0.97, 0.9), smoothstep(0.95, 1.9, heat));
  }

  // Returns light in rgb and how much it hides what lies behind in a.
  vec4 disk(vec3 hit, vec3 direction, float travelled, float squeeze) {
    float r = length(hit.xz);
    float edge = smoothstep(DISK_INNER - 0.2, DISK_INNER + 0.5, r) * (1.0 - smoothstep(DISK_OUTER - 5.0, DISK_OUTER, r));
    if (edge <= 0.001) return vec4(0.0);
    float phi = atan(hit.z, hit.x); float logR = log(r);
    float slant = max(abs(direction.y), 0.05);
    float footprint = travelled * uPixel / slant * (9.0 / r) * ${NOISE_SIZE.toFixed(1)};
    float lod = clamp(log2(max(footprint, 1.0)) - 0.5 + squeeze, 0.0, 6.0);
    // Each band of streams has its own angular speed, all slowing outward as orbits do.
    float kepler = 7.5 * pow(r, -1.5);
    float broad = flowLayer(phi, logR, kepler * 0.92, vec4(0.0, 0.0, 1.0, 0.0), vec2(1.0, 1.5), lod, uTime, CYCLE * 1.6);
    float streams = flowLayer(phi, logR, kepler, vec4(1.0, 0.0, 0.0, 0.0), vec2(2.0, 3.8), lod, uTime, CYCLE);
    float fine = flowLayer(phi, logR, kepler * 1.12, vec4(0.0, 1.0, 0.0, 0.0), vec2(3.0, 9.5), lod, uTime + 3.0, CYCLE * 0.7);
    float density = broad * 0.42 + streams * 0.42 + fine * 0.28;
    density = smoothstep(0.34, 0.86, density);
    // Light from a thin disk, brightest just outside the innermost stable orbit.
    float profile = pow(3.0 / r, 2.1) * (1.0 - 0.55 * sqrt(max(0.0, DISK_INNER / r)));
    // Gas moving toward the viewer looks brighter and hotter; gravity dims all of it.
    float speed = sqrt(0.5 / max(r - 1.0, 0.2));
    vec3 orbit = vec3(-hit.z, 0.0, hit.x) / r;
    float shift = sqrt(max(1.0 - 1.5 / r, 0.02)) / max(1.0 - speed * dot(orbit, -direction), 0.15);
    float beaming = pow(shift, 2.4);
    float heat = (0.28 + 1.5 * density) * profile * 2.4 * mix(1.0, shift, 0.55);
    float limb = min(1.0 / slant, 3.2);
    // The densest, hottest knots of gas burn a little brighter than the disk around them.
    float flare = 1.0 + 0.8 * density * smoothstep(1.2, 2.4, heat);
    float light = (0.1 + 1.75 * density * density) * profile * beaming * edge * 3.0 * flare * (0.55 + 0.45 * limb);
    float opacity = (1.0 - exp(-(0.22 + density * 1.5) * edge * limb)) * smoothstep(0.0, 0.12, edge);
    return vec4(heatColor(heat) * light, opacity);
  }

  // Weak-field bending along a straight stretch of ray, between distances s0 and s1 from its closest point.
  vec3 bendFar(vec3 position, vec3 direction, float impact, float s0, float s1) {
    vec3 inward = -normalize(position - direction * dot(position, direction));
    float amount = (s1 / sqrt(s1 * s1 + impact * impact) - s0 / sqrt(s0 * s0 + impact * impact)) / impact;
    return normalize(direction + inward * amount);
  }

  // Where the step's curved path meets the disk plane. A straight line between the ends of the step
  // would misplace the hit by a varying amount from pixel to pixel, which shows up as fine hatching.
  vec3 planeHit(vec3 p0, vec3 d0, vec3 p1, vec3 d1, float dt) {
    float low = 0.0; float high = 1.0; float y0 = p0.y; float y1 = p1.y; vec3 hit = p1;
    for (int i = 0; i < 3; i += 1) {
      float t = low + (high - low) * y0 / (y0 - y1);
      float t2 = t * t; float t3 = t2 * t;
      hit = p0 * (2.0 * t3 - 3.0 * t2 + 1.0) + d0 * dt * (t3 - 2.0 * t2 + t) + p1 * (3.0 * t2 - 2.0 * t3) + d1 * dt * (t3 - t2);
      if (hit.y * y0 > 0.0) { low = t; y0 = hit.y; } else { high = t; y1 = hit.y; }
    }
    return hit;
  }

  vec3 pull(vec3 p, float h2) { float r2 = dot(p, p); return -1.5 * h2 * p / (r2 * r2 * sqrt(r2)); }

  vec3 toDisplay(vec3 light) {
    light = (light * (2.51 * light + 0.03)) / (light * (2.43 * light + 0.59) + 0.14);
    vec3 color = pow(clamp(light, 0.0, 1.0), vec3(1.0 / 2.2));
    // Tone mapping bleaches the brightest gas, so its blush is added here: gold passes through pink to a white core.
    // Blue is the last channel to rise, which leaves the orange and gold untouched.
    float blush = smoothstep(0.5, 0.7, color.b) * (1.0 - smoothstep(0.76, 0.9, color.b));
    return color * mix(vec3(1.0), vec3(1.0, 0.86, 0.92), blush);
  }

  void main() {
    vec4 view = uProjectionInverse * vec4(vNdc, 1.0, 1.0);
    vec3 direction = normalize(mat3(uCameraWorld) * (view.xyz / view.w));
    vec3 position = uCamera;
    float travelled = 0.0;
    float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));

    vec3 cross0 = cross(position, direction);
    float impact = length(cross0);
    float h2 = impact * impact;
    bool escaped = false; bool captured = false;
    // Close to the shadow's edge, lensing squeezes the disk's image exponentially, so its detail is drawn smoother.
    float squeeze = clamp(-log(max(impact - CRITICAL, 0.001)) * 0.7, 0.0, 3.0);
    // Repeat images of the disk this close to the shadow are thinner than a pixel. They would only alias, so the photon ring below stands in for them.
    float repeatFade = smoothstep(0.12, 0.55, impact - CRITICAL); float crossings = 0.0;
    vec3 light = vec3(0.0); vec3 mist = vec3(0.0); float hidden = 0.0; float closest = length(position);

    // Rays that pass outside the bound barely bend: only the far-field deflection is applied.
    float along = -dot(position, direction);
    if (impact > BOUND) {
      direction = bendFar(position, direction, impact, -along, 1.0e6);
      escaped = true;
    } else {
      float r0 = length(position);
      if (r0 > BOUND && along > 0.0) {
        float into = along - sqrt(BOUND * BOUND - h2);
        vec3 start = position;
        position += direction * into; travelled += into;
        direction = bendFar(start, direction, impact, -along, into - along);
      }
      if (r0 > BOUND && along <= 0.0) { direction = bendFar(position, direction, impact, -along, 1.0e6); escaped = true; }
    }

    if (!escaped) {
      if (impact < CRITICAL && dot(position, direction) < 0.0) captured = true;
      for (int i = 0; i < uSteps; i += 1) {
        float r = length(position);
        closest = min(closest, r);
        if (r < 1.02) { captured = true; break; }
        if (r > BOUND + 0.5 && dot(position, direction) > 0.0) {
          float out0 = dot(position, normalize(direction));
          direction = bendFar(position, normalize(direction), impact, out0, 1.0e6);
          escaped = true; break;
        }
        float dt = clamp((r - 1.0) * 0.3, 0.04, 1.2);
        // Runge-Kutta: rays near the shadow amplify any error, and a cruder step shows up as moire in the thin secondary image.
        vec3 previous = position; vec3 previousDirection = direction;
        vec3 k1 = pull(position, h2);
        vec3 d2 = direction + k1 * dt * 0.5;
        vec3 k2 = pull(position + direction * dt * 0.5, h2);
        vec3 d3 = direction + k2 * dt * 0.5;
        vec3 k3 = pull(position + d2 * dt * 0.5, h2);
        vec3 d4 = direction + k3 * dt;
        vec3 k4 = pull(position + d3 * dt, h2);
        position += (direction + 2.0 * d2 + 2.0 * d3 + d4) * dt / 6.0;
        direction += (k1 + 2.0 * k2 + 2.0 * k3 + k4) * dt / 6.0;
        float next = length(position);
        travelled += dt;
        // A soft sheet of glowing gas above and below the plane, so the disk has depth.
        float height = position.y / (0.1 + 0.11 * next);
        float haze = exp(-height * height) * pow(3.2 / max(next, 2.4), 2.3) * smoothstep(2.2, 3.4, next) * (1.0 - smoothstep(6.0, 12.0, next));
        mist += (1.0 - hidden) * vec3(1.0, 0.36, 0.08) * haze * dt * 0.085;
        if (previous.y * position.y < 0.0) {
          vec3 hit = planeHit(previous, previousDirection, position, direction, dt);
          vec4 sampleLight = disk(hit, normalize(direction), travelled, squeeze);
          if (crossings > 0.0) sampleLight *= repeatFade;
          crossings += 1.0; squeeze += 1.5;
          light += (1.0 - hidden) * sampleLight.rgb;
          hidden += (1.0 - hidden) * sampleLight.a;
          if (hidden > 0.985) break;
        }
      }
    }

    // Light that skimmed the photon sphere many times forms a thin bright ring just outside the shadow.
    float width = max(fwidth(impact), 0.004);
    float outside = smoothstep(CRITICAL - width, CRITICAL + width, impact);
    float ring = exp(-pow((impact - CRITICAL - 0.05) / max(0.055, width), 2.0));
    float halo = exp(-max(impact - CRITICAL, 0.0) * 1.05) * 0.075;
    vec3 ringLight = vec3(1.0, 0.72, 0.38) * ring * 1.0 + vec3(1.0, 0.36, 0.09) * halo;
    light += (1.0 - hidden) * ringLight * outside + mist * outside;

    if (!captured) {
      // Where lensing smears the sky into long streaks, it is dimmed; the streaks would otherwise compete with the disk.
      vec3 seen = normalize(direction);
      // 1 where the view is undistorted, 0 where it is squashed flat, the same in every screen direction.
      vec3 acrossX = dFdx(seen); vec3 acrossY = dFdy(seen);
      float stretch = 2.0 * length(cross(acrossX, acrossY)) / max(dot(acrossX, acrossX) + dot(acrossY, acrossY), 1.0e-9);
      vec3 sky = skyLight(seen, uPixel, smoothstep(0.1, 0.65, stretch));
      light += (1.0 - hidden) * sky * outside;
    }

    vec3 color = toDisplay(light) + (jitter - 0.5) / 255.0;
    gl_FragColor = vec4(color, uMix);
  }`;

/**
 * The close-up of Sagittarius A*: a full-view pass that bends a ray for each pixel.
 * It draws nothing until it is faded in, and everything behind it can then be switched off.
 */
export class BlackHoleLens {
  constructor(skyTexture) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX, fragmentShader: FRAGMENT,
      uniforms: {
        uProjectionInverse: { value: new THREE.Matrix4() }, uCameraWorld: { value: new THREE.Matrix4() }, uCamera: { value: new THREE.Vector3() },
        uTime: { value: 40 }, uMix: { value: 0 }, uPixel: { value: 0.001 }, uSteps: { value: LENS_QUALITY[0].steps },
        uNoise: { value: null }, uSky: { value: skyTexture }, uSkyGain: { value: 0.85 }, uCloudGain: { value: 0.3 },
      },
      transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.name = 'Sagittarius A* lensing pass';
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 50; this.mesh.visible = false;
    this.position = new THREE.Vector3();
  }

  get mix() { return this.material.uniforms.uMix.value; }
  set mix(value) { this.material.uniforms.uMix.value = value; this.mesh.visible = value > 0.001; }
  get time() { return this.material.uniforms.uTime.value; }

  setSteps(steps) { this.material.uniforms.uSteps.value = steps; }

  update(flowDelta, camera, height) {
    const { uniforms } = this.material;
    uniforms.uTime.value += flowDelta;
    if (!this.mesh.visible) return;
    // The noise is built on first use, so nobody pays for it until they open the close-up.
    if (!uniforms.uNoise.value) uniforms.uNoise.value = createNoiseTexture();
    uniforms.uProjectionInverse.value.copy(camera.projectionMatrixInverse);
    uniforms.uCameraWorld.value.copy(camera.matrixWorld);
    uniforms.uCamera.value.copy(camera.getWorldPosition(this.position)).divideScalar(SCHWARZSCHILD_RADIUS);
    uniforms.uPixel.value = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / Math.max(1, height);
  }

  dispose() {
    this.material.uniforms.uNoise.value?.dispose();
    this.material.dispose(); this.mesh.geometry.dispose(); this.mesh.removeFromParent();
  }
}
