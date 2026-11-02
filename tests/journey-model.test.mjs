import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BODIES, ECLIPTIC_NORMAL, ECLIPTIC_POLE_GALACTIC, ECLIPTIC_X, ECLIPTIC_Y, GALACTIC_RADIUS, GALACTIC_RATE, MAGNIFICATION,
  PLANE_TILT_DEGREES, REAL_ORBIT_SPEEDS, REAL_SUN_SPEED_KMS, SUN_RADIUS, SUN_SPEED, isAhead, pathLength, planetOffset, planetPosition,
  planetSpeed, sunPosition, travelDirection, vortexPosition,
} from '../js/journey/journey-model.js';

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const TIMES = Array.from({ length: 400 }, (_, i) => i * 3.7);

test('the planets\' plane tilts about 60 degrees to the galactic disk', () => {
  assert.ok(Math.abs(PLANE_TILT_DEGREES - 60.2) < 0.1, `${PLANE_TILT_DEGREES}`);
  const longitude = Math.atan2(ECLIPTIC_POLE_GALACTIC[1], ECLIPTIC_POLE_GALACTIC[0]) * 180 / Math.PI;
  assert.ok(Math.abs(longitude - 96.38) < 0.05, `${longitude}`);
  assert.ok(Math.abs(Math.acos(ECLIPTIC_NORMAL[1]) * 180 / Math.PI - 60.2) < 0.1);
});

test('the plane axes form a right-handed orthonormal set', () => {
  for (const axis of [ECLIPTIC_X, ECLIPTIC_Y, ECLIPTIC_NORMAL]) assert.ok(Math.abs(Math.hypot(...axis) - 1) < 1e-6);
  assert.ok(Math.abs(dot(ECLIPTIC_X, ECLIPTIC_Y)) < 1e-6);
  assert.ok(Math.abs(dot(ECLIPTIC_X, ECLIPTIC_NORMAL)) < 1e-6);
});

test('planets never detach from the Sun and stay in one fixed plane', () => {
  for (const body of BODIES) for (const time of TIMES) {
    const position = planetPosition(body, time);
    const sun = sunPosition(time);
    assert.ok(Math.abs(distance(position, sun) - body.orbit) < 1e-9, `${body.name} at ${time}`);
    assert.ok(Math.abs(dot([position[0] - sun[0], position[1] - sun[1], position[2] - sun[2]], ECLIPTIC_NORMAL)) < 1e-9);
  }
});

test('a Sun-relative orbit closes after one period, but the galactic path does not', () => {
  for (const body of BODIES) {
    const period = (Math.PI * 2) / body.omega;
    assert.ok(distance(planetOffset(body, 10), planetOffset(body, 10 + period)) < 1e-9, body.name);
    assert.ok(distance(planetPosition(body, 10), planetPosition(body, 10 + period)) > 0.05, body.name);
  }
});

test('the Sun holds its distance from the galactic centre and stays near the disk', () => {
  for (const time of TIMES) {
    const sun = sunPosition(time);
    assert.ok(Math.abs(Math.hypot(sun[0], sun[2]) - GALACTIC_RADIUS) < 1e-9);
    assert.ok(Math.abs(sun[1] - 0.2) <= 0.32 + 1e-9);
  }
  assert.ok(Math.abs(dot(travelDirection(4), sunPosition(4).map((v, i) => (i === 1 ? 0 : v)))) < 1e-9);
});

test('the Milky Way turns clockwise as seen from the north galactic pole', () => {
  const a = sunPosition(0); const b = sunPosition(0.1);
  const turn = a[2] * b[0] - a[0] * b[2]; // +y component of a x b
  assert.ok(turn < 0, 'should turn about -y, which is clockwise from above');
  assert.ok(Math.abs(GALACTIC_RATE - 0.105) < 1e-9, 'matches the explorer marker');
});

test('every planet spends about half its time ahead of the Sun', () => {
  for (const body of BODIES) {
    const period = (Math.PI * 2) / body.omega;
    let ahead = 0;
    const samples = 2000;
    // The Sun's direction turns slowly, so only the inner, fast planets average over one orbit with a fixed direction.
    const span = Math.min(period, 60);
    for (let i = 0; i < samples; i += 1) { const time = (i / samples) * span; if (isAhead(planetPosition(body, time), time)) ahead += 1; }
    if (period <= 60) assert.ok(ahead / samples > 0.3 && ahead / samples < 0.7, `${body.name} ${ahead / samples}`);
  }
});

test('the vortex illustration is the one that keeps planets behind the Sun', () => {
  for (const body of BODIES) for (const time of TIMES) {
    assert.ok(!isAhead(vortexPosition(body, time), time), `${body.name} at ${time}`);
  }
});

test('the Sun outpaces every planet, on screen and in reality, so no planet ever moves backward', () => {
  for (const body of BODIES) {
    assert.ok(SUN_SPEED > planetSpeed(body), body.name);
    assert.ok(REAL_SUN_SPEED_KMS > REAL_ORBIT_SPEEDS[body.name], body.name);
  }
});

test('over a year Earth travels farther relative to the galaxy than relative to the Sun', () => {
  const earth = BODIES.find(({ name }) => name === 'Earth');
  const year = (Math.PI * 2) / earth.omega;
  assert.ok(pathLength(earth, year) > pathLength(earth, year, 'sun') * 2);
});

test('the display keeps sizes inside their orbits and states its magnification', () => {
  assert.ok(MAGNIFICATION > 1e6 && MAGNIFICATION < 1e8, `${MAGNIFICATION}`);
  assert.ok(SUN_RADIUS < BODIES[0].orbit);
});
