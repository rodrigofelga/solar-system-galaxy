import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANETS, SUN_DISPLAY_RADIUS, SUN_OVERVIEW_BOOST } from '../js/data/planets.js';

const planet = (name) => PLANETS.find((candidate) => candidate.name === name);
// Saturn's outer ring edge, from addSaturnRings in js/solar-system-view.js.
const reach = ({ radius, hasRings }) => radius * (hasRings ? 2.33 : 1);

test('Earth keeps the display radius and orbit the Artemis II mission mapping depends on', () => {
  assert.equal(planet('Earth').radius, 0.9);
  assert.equal(planet('Earth').orbitRadius, 19);
});

test('display sizes keep the true size order of the planets', () => {
  const bySize = [...PLANETS].sort((a, b) => a.radius - b.radius).map(({ name }) => name);
  const byTrueSize = [...PLANETS].sort((a, b) => a.radiusKm - b.radiusKm).map(({ name }) => name);
  assert.deepEqual(bySize, byTrueSize);
});

test('scale stays intentionally educational: giants read larger, small worlds stay visible', () => {
  const jupiterToEarth = planet('Jupiter').radius / planet('Earth').radius;
  assert.ok(jupiterToEarth > 3 && jupiterToEarth < 11, `Jupiter is ${jupiterToEarth} Earths`);
  assert.ok(planet('Mercury').radius >= 0.5);
  assert.ok(planet('Mars').radius >= 0.6);
  assert.ok(SUN_DISPLAY_RADIUS > planet('Jupiter').radius * 1.5);
});

test('neighbouring planets cannot touch, even at closest approach', () => {
  PLANETS.slice(1).forEach((outer, index) => {
    const inner = PLANETS[index];
    const gap = outer.orbitRadius - inner.orbitRadius - reach(outer) - reach(inner);
    assert.ok(gap > 1, `${inner.name} to ${outer.name} leaves ${gap}`);
  });
  assert.ok(planet('Mercury').orbitRadius - planet('Mercury').radius - SUN_DISPLAY_RADIUS > 3);
});

test('the wide-view boost keeps the size order and never lets neighbours touch', () => {
  const boosted = (planet) => planet.radius * planet.overviewBoost;
  const bySize = [...PLANETS].sort((a, b) => boosted(a) - boosted(b)).map(({ name }) => name);
  const byTrueSize = [...PLANETS].sort((a, b) => a.radiusKm - b.radiusKm).map(({ name }) => name);
  assert.deepEqual(bySize, byTrueSize);
  PLANETS.slice(1).forEach((outer, index) => {
    const inner = PLANETS[index];
    const gap = outer.orbitRadius - inner.orbitRadius - reach(outer) * outer.overviewBoost - reach(inner) * inner.overviewBoost;
    assert.ok(gap > 0.5, `${inner.name} to ${outer.name} leaves ${gap}`);
  });
  assert.ok(planet('Mercury').orbitRadius - planet('Mercury').radius * planet('Mercury').overviewBoost - SUN_DISPLAY_RADIUS * SUN_OVERVIEW_BOOST > 3);
});
