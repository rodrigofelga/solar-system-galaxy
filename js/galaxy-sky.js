import * as THREE from 'three';

// Shared by the wide view and the black hole, which looks the sky up along each bent ray.
// Stars are placed per pixel so they stay sharp; the dust and nebulae come from a small baked cube.
export const SKY_GLSL = `
  float skyHash(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
  vec3 starLayer(vec3 direction, float cells, float pixel, float rarity, float density) {
    vec3 grid = direction * cells; vec3 cell = floor(grid);
    float pick = skyHash(cell);
    if (pick > density) return vec3(0.0);
    vec3 offset = vec3(skyHash(cell + 11.1), skyHash(cell + 23.7), skyHash(cell + 41.3));
    float dist = length(grid - cell - 0.2 - offset * 0.6);
    float size = max(cells * pixel * 0.62, 0.012);
    float tone = skyHash(cell + 67.9);
    vec3 tint = tone < 0.3 ? vec3(0.66, 0.78, 1.0) : tone < 0.72 ? vec3(1.0, 0.95, 0.88) : vec3(1.0, 0.72, 0.5);
    return tint * pow(skyHash(cell + 5.3), rarity) * exp(-dist * dist / (size * size));
  }
  vec3 skyLight(vec3 direction, float pixel, float clarity) {
    vec4 baked = textureCube(uSky, direction);
    vec3 light = baked.rgb * baked.rgb * 0.62 * uCloudGain * mix(0.3, 1.0, clarity);
    float crowd = baked.a;
    light += starLayer(direction, 70.0, pixel, 9.0, 0.3) * 2.2 * uSkyGain * clarity;
    light += starLayer(direction, 150.0, pixel, 5.5, 0.14 + crowd * 0.6) * 0.65 * uSkyGain * clarity;
    light += starLayer(direction, 310.0, pixel, 3.0, 0.03 + crowd * 0.5) * 0.25 * uSkyGain * clarity;
    return light;
  }`;

// Colour is stored as its square root, to keep precision in the dark parts of an 8-bit cube.
const BAKE_FRAGMENT = `precision highp float;
  varying vec3 vDirection;
  float hash(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
  float noise(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 6; i += 1) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; } return v; }
  void main() {
    vec3 d = normalize(vDirection);
    // A band of stars and dust across the sky, tilted away from the black hole's disk.
    vec3 pole = normalize(vec3(0.52, 0.85, 0.08));
    float lat = dot(d, pole);
    float warp = fbm(d * 3.0 + 4.0) - 0.5;
    float band = exp(-pow((lat + warp * 0.2) / 0.3, 2.0));
    float core = exp(-pow((lat + warp * 0.12) / 0.11, 2.0));
    float bulge = pow(max(dot(d, normalize(vec3(-0.75, 0.3, -0.58))), 0.0), 3.5);
    float cloud = fbm(d * 6.5 + warp * 2.0);
    float dust = smoothstep(0.4, 0.62, fbm(d * 9.0 + vec3(warp * 3.0, 9.0, 2.0)));
    float glow = band * (0.04 + 0.34 * cloud) + core * 0.26 * cloud + bulge * band * 0.22;
    vec3 color = mix(vec3(0.3, 0.38, 0.66), vec3(0.95, 0.5, 0.26), clamp(core + bulge * 0.7 + (cloud - 0.5), 0.0, 1.0)) * glow * (1.0 - dust * 0.92 * (band * 0.7 + 0.3));
    // Faint clouds of ionised gas and cold blue reflection, kept well below the disk's brightness.
    float rose = smoothstep(0.54, 0.8, fbm(d * 3.7 + 31.0)) * smoothstep(0.32, 0.75, fbm(d * 11.0 + 5.0));
    float teal = smoothstep(0.56, 0.82, fbm(d * 3.1 + 61.0)) * smoothstep(0.3, 0.75, fbm(d * 10.0 + 15.0));
    color += vec3(0.72, 0.13, 0.26) * rose * (0.08 + band * 0.42);
    color += vec3(0.08, 0.24, 0.42) * teal * (0.12 + band * 0.14);
    color += vec3(0.0006, 0.0009, 0.002);
    gl_FragColor = vec4(sqrt(clamp(color, 0.0, 1.0)), clamp(band * (0.5 + cloud) * (1.0 - dust * 0.7), 0.0, 1.0));
  }`;

const DIRECTION_VERTEX = `varying vec3 vDirection;
  void main() { vDirection = position; vec4 clip = projectionMatrix * mat4(mat3(modelViewMatrix)) * vec4(position, 1.0); gl_Position = clip.xyww; }`;

const SKY_FRAGMENT = `precision highp float;
  varying vec3 vDirection; uniform samplerCube uSky; uniform float uPixel; uniform float uSkyGain; uniform float uCloudGain;
  ${SKY_GLSL}
  void main() {
    vec3 light = skyLight(normalize(vDirection), uPixel, 1.0);
    gl_FragColor = vec4(pow(light, vec3(1.0 / 2.2)), 1.0);
  }`;

/** A dark, detailed sky behind the galaxy. The cube is baked once and costs one lookup per pixel afterwards. */
export class GalaxySky {
  constructor(renderer, compact) {
    const size = compact ? 384 : 768;
    this.target = new THREE.WebGLCubeRenderTarget(size, { generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const bakeMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthTest: false, depthWrite: false, toneMapped: false,
      vertexShader: `varying vec3 vDirection; void main() { vDirection = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: BAKE_FRAGMENT,
    });
    const bakeScene = new THREE.Scene(); bakeScene.add(new THREE.Mesh(geometry, bakeMaterial));
    const colorSpace = renderer.outputColorSpace;
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    new THREE.CubeCamera(0.1, 10, this.target).update(renderer, bakeScene);
    renderer.outputColorSpace = colorSpace;
    bakeMaterial.dispose();
    this.material = new THREE.ShaderMaterial({
      uniforms: { uSky: { value: this.target.texture }, uPixel: { value: 0.001 }, uSkyGain: { value: 0.22 }, uCloudGain: { value: 0.03 } },
      vertexShader: DIRECTION_VERTEX, fragmentShader: SKY_FRAGMENT,
      side: THREE.BackSide, depthTest: false, depthWrite: false, toneMapped: false,
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.name = 'Illustrative sky'; this.mesh.frustumCulled = false; this.mesh.renderOrder = -10;
  }

  get texture() { return this.target.texture; }

  update(camera, height) {
    this.material.uniforms.uPixel.value = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / Math.max(1, height);
  }

  dispose() {
    this.target.dispose(); this.material.dispose(); this.mesh.geometry.dispose(); this.mesh.removeFromParent();
  }
}
