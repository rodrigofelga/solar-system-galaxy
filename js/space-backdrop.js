import * as THREE from 'three';

// All of these stay inside the camera's far plane, including at maximum zoom-out.
const SKY_RADIUS = 245;
const BAND_NORMAL = new THREE.Vector3(0.38, 0.86, -0.34).normalize();
const STAR_TINTS = [
  [0.72, 0.8, 1], [0.84, 0.89, 1], [0.84, 0.89, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1],
  [1, 0.95, 0.84], [1, 0.95, 0.84], [1, 0.84, 0.66], [1, 0.72, 0.52],
];
// follow is how far a layer moves with the camera: below 1 it drifts slightly, which reads as depth.
const STAR_LAYERS = [
  { count: 5600, radius: 240, follow: 1, size: [1.5, 2.2], brightness: [0.16, 0.5], bandBias: 0.5 },
  { count: 1500, radius: 225, follow: 0.96, size: [1.8, 2.8], brightness: [0.42, 0.85], bandBias: 0.25 },
  { count: 110, radius: 210, follow: 0.92, size: [4.5, 8], brightness: [0.8, 1], bandBias: 0 },
];

const STAR_VERTEX = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
uniform float uPixelRatio;
varying vec3 vColor;
void main(){
  vColor = aColor;
  gl_PointSize = aSize * uPixelRatio;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
// A tight core with a soft skirt, so large stars glow instead of reading as discs.
const STAR_FRAGMENT = /* glsl */ `
varying vec3 vColor;
void main(){
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d >= 1.0) discard;
  float core = smoothstep(0.42, 0.0, d);
  float skirt = (1.0 - d) * (1.0 - d) * 0.32;
  gl_FragColor = vec4(vColor * (core + skirt), 1.0);
}
`;
const ECLIPTIC_VERTEX = /* glsl */ `
varying vec2 vPlane;
varying float vFacing;
void main(){
  vPlane = position.xy;
  vec3 toCamera = normalize(cameraPosition - (modelMatrix * vec4(position, 1.0)).xyz);
  vFacing = abs(toCamera.y);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const ECLIPTIC_FRAGMENT = /* glsl */ `
uniform float uRadius;
varying vec2 vPlane;
varying float vFacing;
void main(){
  float r = clamp(length(vPlane) / uRadius, 0.0, 1.0);
  // Fades when seen edge-on, where a flat disc would otherwise cut a straight horizon across the sky.
  float glow = pow(1.0 - r, 2.6) * 0.09 * smoothstep(0.03, 0.4, vFacing);
  gl_FragColor = vec4(vec3(1.0, 0.68, 0.42) * glow, 1.0);
}
`;

// Seeded, so the sky is the same on every visit and viewers can learn its landmarks.
const seededRandom = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let mixed = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
  return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
};

const lattice = (x, y, z) => {
  const value = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return value - Math.floor(value);
};
const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const valueNoise = (x, y, z) => {
  const [ix, iy, iz] = [Math.floor(x), Math.floor(y), Math.floor(z)];
  const [fx, fy, fz] = [smooth(x - ix), smooth(y - iy), smooth(z - iz)];
  const along = (j, k) => THREE.MathUtils.lerp(lattice(ix, iy + j, iz + k), lattice(ix + 1, iy + j, iz + k), fx);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(along(0, 0), along(1, 0), fy),
    THREE.MathUtils.lerp(along(0, 1), along(1, 1), fy),
    fz,
  );
};
// Each octave is turned off the lattice axes, which would otherwise show as straight edges in the sky.
const clouds = (x, y, z) => valueNoise(0.8 * x + 0.6 * y, -0.48 * x + 0.64 * y + 0.6 * z, 0.36 * x - 0.48 * y + 0.8 * z) * 0.55
  + valueNoise(1.26 * x - 1.68 * z + 5, 2.1 * y, 1.68 * x + 1.26 * z) * 0.3
  + valueNoise(3.44 * x + 2.58 * y, -2.58 * x + 3.44 * y + 9, 4.3 * z) * 0.15;

/** Deep-space surroundings: a dim painted sky, layered stars and a faint glow along the planets' plane. */
export class SpaceBackdrop {
  constructor({ compact = false, pixelRatio = 1 } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'SpaceBackdrop';
    this.layers = [];
    this.createSky(compact);
    const random = seededRandom(20260401);
    STAR_LAYERS.forEach((layer) => this.createStars(layer, compact, pixelRatio, random));
    this.createEclipticGlow();
  }

  // Colours live on the vertices, so the glow costs no per-pixel noise. Dithering hides banding in the dark gradients.
  createSky(compact) {
    const geometry = new THREE.IcosahedronGeometry(SKY_RADIUS, compact ? 14 : 24);
    const { position } = geometry.attributes;
    const colors = new Float32Array(position.count * 3);
    const direction = new THREE.Vector3();
    const color = new THREE.Color();
    for (let index = 0; index < position.count; index += 1) {
      direction.fromBufferAttribute(position, index).normalize();
      const { x, y, z } = direction;
      const latitude = direction.dot(BAND_NORMAL);
      const texture = clouds(x * 2.6 + 3, y * 2.6, z * 2.6 + 1);
      const band = Math.exp(-((latitude / 0.3) ** 2)) * THREE.MathUtils.smoothstep(texture, 0.28, 0.72);
      const warm = THREE.MathUtils.smoothstep(clouds(x * 1.7 + 11, y * 1.7 + 4, z * 1.7), 0.56, 0.78);
      const teal = THREE.MathUtils.smoothstep(clouds(x * 1.9 - 7, y * 1.9, z * 1.9 + 13), 0.58, 0.8);
      color.setRGB(
        0.008 + 0.075 * band + 0.05 * warm + 0.004 * teal,
        0.016 + 0.082 * band + 0.018 * warm + 0.03 * teal,
        0.047 + 0.135 * band + 0.038 * warm + 0.042 * teal,
        THREE.SRGBColorSpace,
      );
      colors.set([color.r, color.g, color.b], index * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const sky = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, depthTest: false, toneMapped: false, dithering: true }));
    sky.renderOrder = -20;
    sky.frustumCulled = false;
    this.addLayer(sky, 1);
  }

  // Everything here is left out of the transparent pass: it must draw first, so that every body covers it.
  createStars({ count, radius, follow, size, brightness, bandBias }, compact, pixelRatio, random) {
    const total = compact ? Math.ceil(count * 0.55) : count;
    const positions = new Float32Array(total * 3);
    const sizes = new Float32Array(total);
    const colors = new Float32Array(total * 3);
    const direction = new THREE.Vector3();
    for (let index = 0; index < total; index += 1) {
      direction.set(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1);
      while (direction.lengthSq() > 1 || direction.lengthSq() < 1e-4) direction.set(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1);
      direction.normalize();
      if (random() < bandBias) direction.addScaledVector(BAND_NORMAL, -direction.dot(BAND_NORMAL) * (0.72 + random() * 0.28)).normalize();
      direction.toArray(positions, index * 3);
      positions[index * 3] *= radius; positions[index * 3 + 1] *= radius; positions[index * 3 + 2] *= radius;
      // Squaring skews the population toward faint stars, as in the real sky.
      const weight = random() ** 2;
      sizes[index] = THREE.MathUtils.lerp(size[0], size[1], weight);
      const light = THREE.MathUtils.lerp(brightness[0], brightness[1], weight);
      const tint = STAR_TINTS[Math.floor(random() * STAR_TINTS.length)];
      colors[index * 3] = tint[0] * light; colors[index * 3 + 1] = tint[1] * light; colors[index * 3 + 2] = tint[2] * light;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    const stars = new THREE.Points(geometry, new THREE.ShaderMaterial({
      uniforms: { uPixelRatio: { value: pixelRatio } },
      vertexShader: STAR_VERTEX,
      fragmentShader: STAR_FRAGMENT,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    }));
    stars.renderOrder = -10;
    stars.frustumCulled = false;
    this.addLayer(stars, follow);
  }

  createEclipticGlow() {
    const radius = 50;
    const glow = new THREE.Mesh(new THREE.CircleGeometry(radius, 96), new THREE.ShaderMaterial({
      uniforms: { uRadius: { value: radius } },
      vertexShader: ECLIPTIC_VERTEX,
      fragmentShader: ECLIPTIC_FRAGMENT,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    }));
    glow.rotation.x = -Math.PI / 2;
    glow.renderOrder = -6;
    glow.frustumCulled = false;
    this.group.add(glow);
  }

  addLayer(object, follow) {
    this.group.add(object);
    this.layers.push({ object, follow });
  }

  // The sky keeps its distance as the camera moves, so zooming out never reaches or clips it.
  update(camera) {
    this.layers.forEach(({ object, follow }) => object.position.copy(camera.position).multiplyScalar(follow));
  }
}
