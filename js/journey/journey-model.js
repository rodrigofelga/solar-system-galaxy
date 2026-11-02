import { PLANETS, SUN_DISPLAY_RADIUS } from '../data/planets.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

// Display values shared with the Milky Way explorer, so the marker and the journey agree. All lengths are galaxy-scene units.
export const GALACTIC_RADIUS = 26;
export const GALACTIC_RATE = 0.105; // radians per model second, the explorer's own marker rate
export const START_PHASE = -0.7; // the explorer's starting Sun position, treated as "today"
export const DISK_HEIGHT = 0.2;
export const SECONDS_PER_EARTH_YEAR = 16; // the Solar System explorer's own rate
// 8,178 pc spread over 26 units is about 315 pc per unit, so this is close to the real 100 pc or so.
export const VERTICAL_AMPLITUDE = 0.32;
export const VERTICAL_CYCLES_PER_ORBIT = 3.2;
export const SYSTEM_SCALE = 0.11;
export const SUN_RADIUS = SUN_DISPLAY_RADIUS * SYSTEM_SCALE;
export const NEPTUNE_REAL_KM = 4.5e9;
export const KM_PER_UNIT = (8178 * 3.0857e13) / GALACTIC_RADIUS;
export const REAL_SUN_SPEED_KMS = 230;
// NASA planetary fact sheet mean orbital speeds, km/s.
export const REAL_ORBIT_SPEEDS = { Mercury: 47.4, Venus: 35, Earth: 29.8, Mars: 24.1, Jupiter: 13.1, Saturn: 9.7, Uranus: 6.8, Neptune: 5.4 };

const VERTICAL_RATE = GALACTIC_RATE * VERTICAL_CYCLES_PER_ORBIT;
const VORTEX_LAG_PER_RADIUS = 1.25;

// Hipparcos / IAU J2000 equatorial-to-galactic rotation; each row is a galactic axis in equatorial coordinates.
const EQUATORIAL_TO_GALACTIC = [
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [0.4941094279, -0.4448296300, 0.7469822445],
  [-0.8676661490, -0.1980763734, 0.4559837762],
];
const OBLIQUITY = 23.4393 * DEG;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const combine = (a, x, b, y, c = [0, 0, 0], z = 0) => [0, 1, 2].map((i) => a[i] * x + b[i] * y + c[i] * z);
const eclipticInGalactic = (eq) => EQUATORIAL_TO_GALACTIC.map((row) => dot(row, eq));

export const EQUINOX_GALACTIC = eclipticInGalactic([1, 0, 0]);
export const ECLIPTIC_POLE_GALACTIC = eclipticInGalactic([0, -Math.sin(OBLIQUITY), Math.cos(OBLIQUITY)]);
/** The computed tilt between the planets' plane and the galactic disk: about 60.2 degrees. */
export const PLANE_TILT_DEGREES = Math.acos(ECLIPTIC_POLE_GALACTIC[2]) / DEG;

// Galactic axes at the Sun's starting position, in scene coordinates: toward the centre, along rotation, north.
const toCentre = [-Math.cos(START_PHASE), 0, -Math.sin(START_PHASE)];
const alongRotation = [-Math.sin(START_PHASE), 0, Math.cos(START_PHASE)];
const north = [0, 1, 0];
const toScene = ([x, y, z]) => combine(toCentre, x, alongRotation, y, north, z);

// The planets' plane keeps a fixed direction in space as the Sun orbits, so these axes never rotate with the galactic orbit.
export const ECLIPTIC_X = toScene(EQUINOX_GALACTIC);
export const ECLIPTIC_NORMAL = toScene(ECLIPTIC_POLE_GALACTIC);
export const ECLIPTIC_Y = cross(ECLIPTIC_NORMAL, ECLIPTIC_X);

export const BODIES = PLANETS.map((planet) => ({
  name: planet.name,
  color: planet.color,
  radius: planet.radius * SYSTEM_SCALE,
  orbit: planet.orbitRadius * SYSTEM_SCALE,
  omega: TAU / (SECONDS_PER_EARTH_YEAR * planet.orbitPeriod),
  initialAngle: planet.initialAngle,
  rotationPeriod: planet.rotationPeriod,
  axialTilt: planet.axialTilt,
  hasRings: Boolean(planet.hasRings),
  albedoGain: planet.albedoGain,
  orbitPeriod: planet.orbitPeriod,
}));

export const planetIndex = (name) => BODIES.findIndex((body) => body.name === name);

export const sunPhase = (time) => START_PHASE + GALACTIC_RATE * time;

/** The Sun's position in the galaxy at a model time. */
export function sunPosition(time) {
  const phase = sunPhase(time);
  return [
    GALACTIC_RADIUS * Math.cos(phase),
    DISK_HEIGHT + VERTICAL_AMPLITUDE * Math.sin(VERTICAL_RATE * time),
    GALACTIC_RADIUS * Math.sin(phase),
  ];
}

/** The Sun's unit direction of travel along its galactic orbit. */
export function travelDirection(time) {
  const phase = sunPhase(time);
  return [-Math.sin(phase), 0, Math.cos(phase)];
}

export const orbitAngle = (body, time) => body.initialAngle + body.omega * time;

/** A planet's offset from the Sun. This closed circle is the only orbital motion in the model. */
export function planetOffset(body, time, scale = 1) {
  const angle = orbitAngle(body, time);
  return combine(ECLIPTIC_X, body.orbit * scale * Math.cos(angle), ECLIPTIC_Y, body.orbit * scale * Math.sin(angle));
}

/** Galaxy position: the shared Sun motion plus the unchanged offset. Planets have no path of their own. */
export function planetPosition(body, time, scale = 1) {
  const sun = sunPosition(time);
  const offset = planetOffset(body, time, scale);
  return [sun[0] + offset[0], sun[1] + offset[1], sun[2] + offset[2]];
}

/** The MISLEADING picture, drawn only when labelled inaccurate: rings face the direction of travel and trail behind the Sun. */
export function vortexPosition(body, time, scale = 1) {
  const lag = (VORTEX_LAG_PER_RADIUS * body.orbit * scale) / (GALACTIC_RATE * GALACTIC_RADIUS);
  const sun = sunPosition(time - lag);
  const travel = travelDirection(time - lag);
  const side = cross(travel, north);
  const angle = orbitAngle(body, time);
  const offset = combine(side, body.orbit * scale * Math.cos(angle), north, body.orbit * scale * Math.sin(angle));
  return [sun[0] + offset[0], sun[1] + offset[1], sun[2] + offset[2]];
}
export { VORTEX_LAG_PER_RADIUS };

/** Whether a planet is on the leading side of the Sun, measured along the direction of travel. */
export function isAhead(position, time) {
  const sun = sunPosition(time);
  return dot([position[0] - sun[0], position[1] - sun[1], position[2] - sun[2]], travelDirection(time)) > 0;
}

/** Display speeds, in units per model second. The Sun's exceeds every planet's, as it does in reality. */
export const SUN_SPEED = GALACTIC_RATE * GALACTIC_RADIUS;
export const planetSpeed = (body) => body.orbit * body.omega;

export const earthOrbits = (time) => time / SECONDS_PER_EARTH_YEAR;
export const galacticOrbits = (time) => (GALACTIC_RATE * time) / TAU;
/** How many times larger the drawn system is than the real one, at the galaxy's own scale. */
export const MAGNIFICATION = (PLANETS.at(-1).orbitRadius * SYSTEM_SCALE * KM_PER_UNIT) / NEPTUNE_REAL_KM;

/** Length of the path a planet traces over a span, relative to the Sun or relative to the galaxy. */
export function pathLength(body, span, relativeTo = 'galaxy', samples = 480) {
  if (relativeTo === 'sun') return body.orbit * body.omega * span;
  let length = 0;
  let previous = planetPosition(body, 0);
  for (let i = 1; i <= samples; i += 1) {
    const point = planetPosition(body, (span * i) / samples);
    length += Math.hypot(point[0] - previous[0], point[1] - previous[1], point[2] - previous[2]);
    previous = point;
  }
  return length;
}
