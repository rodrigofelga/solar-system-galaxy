// GLSL for the procedural Sun. All shaders are original; no video frames or stock textures are used.
// Colours are written as final display (sRGB) values and the materials are unlit, so the Sun never
// interferes with the Three.js PointLight that illuminates the planets.

// 3D simplex noise (Ashima Arts / Ian McEwan, MIT licence).
export const NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

export const SURFACE_VERTEX = /* glsl */ `
varying vec3 vObjPos;
varying vec3 vViewNormal;
varying vec3 vViewDir;
void main(){
  vObjPos = position;
  vViewNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewDir = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

// Defines: OCTAVES (int), WARP (full 3-channel fbm domain warp), FINE (second granulation layer).
// Noise is sampled from the object-space direction, so there are no UV seams or pole pinching, and
// the pattern rotates with the mesh (axial rotation) while uTime drives the independent plasma flow.
export const SURFACE_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform vec3 uRegions[2];
uniform vec4 uSpots[4];
varying vec3 vObjPos;
varying vec3 vViewNormal;
varying vec3 vViewDir;
${NOISE_GLSL}
float fbm(vec3 p){
  float a = 0.5; float s = 0.0;
  for (int i = 0; i < OCTAVES; i++){
    s += a * snoise(p);
    p = p * 2.03 + vec3(7.1, 3.7, 5.3);
    a *= 0.5;
  }
  return s * 1.6;
}
vec3 palette(float h){
  vec3 deepRed = vec3(0.36, 0.03, 0.0);
  vec3 burnt   = vec3(0.78, 0.17, 0.01);
  vec3 orange  = vec3(1.0, 0.45, 0.04);
  vec3 yellow  = vec3(1.0, 0.78, 0.22);
  vec3 white   = vec3(1.0, 0.95, 0.76);
  vec3 c = mix(deepRed, burnt, smoothstep(0.0, 0.28, h));
  c = mix(c, orange, smoothstep(0.24, 0.52, h));
  c = mix(c, yellow, smoothstep(0.5, 0.78, h));
  c = mix(c, white, smoothstep(0.8, 1.0, h));
  return c;
}
void main(){
  vec3 p = normalize(vObjPos);
  float t = uTime;
#ifdef WARP
  vec3 q = vec3(fbm(p * 2.0 + vec3(0.0, t * 0.04, 0.0)),
                fbm(p * 2.0 + vec3(5.2, 1.3, -t * 0.035)),
                fbm(p * 2.0 + vec3(t * 0.03, 8.1, 2.7)));
#else
  vec3 q = vec3(snoise(p * 2.0 + vec3(0.0, t * 0.04, 0.0)),
                snoise(p * 2.0 + vec3(5.2, 1.3, -t * 0.035)),
                snoise(p * 2.0 + vec3(t * 0.03, 8.1, 2.7)));
#endif
  float large = fbm(p * 2.6 + 1.6 * q + vec3(0.0, 0.0, t * 0.02)) * 0.5 + 0.5;
  float mid   = fbm(p * 7.0 + 2.0 * q + vec3(t * 0.06, 0.0, -t * 0.04)) * 0.5 + 0.5;
  float gran  = snoise(p * 34.0 + q * 2.5 + vec3(t * 0.18, -t * 0.11, t * 0.07)) * 0.5 + 0.5;
#ifdef FINE
  gran = gran * 0.65 + (snoise(p * 75.0 + q * 3.0 + vec3(-t * 0.25, t * 0.2, 0.0)) * 0.5 + 0.5) * 0.35;
#endif
  // Concentrated bright active regions and darker reddish zones.
  float activeRegion = smoothstep(0.5, 0.82, snoise(p * 1.7 + vec3(2.0, t * 0.008, -1.0)) * 0.5 + 0.5 + 0.25 * (large - 0.5));
  float cool = smoothstep(0.5, 0.78, fbm(p * 3.3 + q * 1.2 + vec3(11.0, 0.0, t * 0.015)) * 0.5 + 0.5);
  float heat = 0.46 + 0.7 * (large - 0.5) + 0.35 * (mid - 0.5) + 0.34 * (gran - 0.5) + 0.42 * activeRegion - 0.3 * cool;
  // Fixed illustrative active regions and sunspots (object space, so they rotate with the Sun and stay aligned with their markers).
  float regionGlow = 0.0;
  for (int i = 0; i < 2; i++){ regionGlow = max(regionGlow, smoothstep(0.9, 0.985, dot(p, uRegions[i]))); }
  float umbra = 0.0; float penumbra = 0.0;
  for (int i = 0; i < 4; i++){
    float ang = acos(clamp(dot(p, uSpots[i].xyz), -1.0, 1.0));
    float a = uSpots[i].w;
    umbra = max(umbra, 1.0 - smoothstep(a * 0.8, a, ang));
    penumbra = max(penumbra, 1.0 - smoothstep(a * 1.6, a * 2.1, ang));
  }
  heat += 0.22 * regionGlow - 0.3 * penumbra;
  heat = clamp(heat, 0.0, 1.0);
  vec3 col = palette(heat);
  col = mix(col, vec3(0.06, 0.012, 0.0), umbra * 0.92);
  // Limb darkening and reddening.
  float mu = clamp(dot(normalize(vViewNormal), normalize(vViewDir)), 0.0, 1.0);
  col *= 0.6 + 0.4 * pow(mu, 0.45);
  col = mix(col, vec3(0.8, 0.14, 0.01), pow(1.0 - mu, 3.0) * 0.4);
  gl_FragColor = vec4(col, 1.0);
}
`;

export const CORONA_VERTEX = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Camera-facing billboard. uSpan is the half-width of the quad in solar radii.
export const CORONA_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uSpan;
uniform float uStreamers;
varying vec2 vUv;
${NOISE_GLSL}
void main(){
  vec2 c = (vUv - 0.5) * 2.0 * uSpan;
  float d = length(c);
  float ang = atan(c.y, c.x);
  vec2 dir = vec2(cos(ang), sin(ang));
  float fall = pow(1.0 / max(d, 0.5), 2.6);
  float edge = 1.0 - smoothstep(uSpan * 0.55, uSpan, d);
  float n = snoise(vec3(dir * 1.6, uTime * 0.04 + d * 0.15)) * 0.5 + 0.5;
  float streak = 1.0;
  if (uStreamers > 0.5){
    float s = snoise(vec3(dir * 4.5, uTime * 0.03 + d * 0.5)) * 0.5 + 0.5;
    streak = 0.65 + 0.7 * smoothstep(0.35, 0.85, s) * smoothstep(1.0, 1.6, d);
  }
  float limb = smoothstep(1.0, 1.04, d) * (1.0 - smoothstep(1.04, 1.5, d)) * 0.55;
  float a = (fall * (0.55 + 0.6 * n) * streak + limb * fall * 2.0) * edge;
  a = clamp(a * 0.65, 0.0, 1.0);
  vec3 inner = vec3(1.0, 0.72, 0.28);
  vec3 outer = vec3(0.95, 0.32, 0.05);
  vec3 col = mix(outer, inner, smoothstep(2.4, 1.0, d));
  gl_FragColor = vec4(col, a);
}
`;

// Prominence loops: the vertex shader scales height above the surface by uLife so loops grow and
// collapse without recreating geometry; feet stay anchored to the photosphere.
export const PROMINENCE_VERTEX = /* glsl */ `
uniform float uLife;
uniform float uRadius;
varying vec3 vViewNormal;
varying vec3 vViewDir;
varying vec2 vUv;
void main(){
  vUv = uv;
  float r = length(position);
  vec3 dir = position / r;
  float h = max(r - uRadius * 0.99, 0.0);
  vec3 pos = dir * (uRadius * 0.99 + h * uLife);
  vViewNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vViewDir = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

export const PROMINENCE_FRAGMENT = /* glsl */ `
uniform float uLife;
uniform float uTime;
uniform float uSeed;
uniform float uHighlight;
varying vec3 vViewNormal;
varying vec3 vViewDir;
varying vec2 vUv;
${NOISE_GLSL}
void main(){
  float core = pow(clamp(abs(dot(normalize(vViewNormal), normalize(vViewDir))), 0.0, 1.0), 1.4);
  float along = smoothstep(0.0, 0.12, vUv.x) * (1.0 - smoothstep(0.88, 1.0, vUv.x));
  float flow = snoise(vec3(vUv.x * 9.0 - uTime * 0.6, vUv.y * 2.0, uSeed)) * 0.5 + 0.5;
  float a = core * along * (0.45 + 0.75 * flow) * smoothstep(0.0, 0.3, uLife);
  vec3 col = mix(vec3(1.0, 0.3, 0.04), vec3(1.0, 0.72, 0.25), core * flow);
  a *= 1.0 + 0.9 * uHighlight;
  col = mix(col, vec3(1.0, 0.93, 0.62), 0.55 * uHighlight);
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
}
`;
