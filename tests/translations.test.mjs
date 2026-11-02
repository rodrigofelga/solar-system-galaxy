import test from 'node:test';
import assert from 'node:assert/strict';
import { CELESTIAL_BODIES } from '../js/data/celestial-bodies.js';
import { CELESTIAL_BODIES_PT, localizedBody } from '../js/i18n/celestial-bodies-pt.js';
import { JOURNEY_TEXT } from '../js/data/journey-text.js';
import { GALACTIC_FEATURES } from '../js/data/galactic-features.js';
import { localizedFeature } from '../js/i18n/galactic-features-pt.js';

const TEXT_FIELDS = ['classification', 'diameter', 'distance', 'rotation', 'orbit', 'temperature', 'axialTilt', 'moons', 'description'];
// Plain numbers and symbols read the same in both languages.
const LANGUAGE_NEUTRAL = /^[\d\s°.,]*(km)?$/;

test('every celestial body has every field in Portuguese', () => {
  assert.deepEqual(Object.keys(CELESTIAL_BODIES_PT).sort(), Object.keys(CELESTIAL_BODIES).sort());
  Object.entries(CELESTIAL_BODIES).forEach(([name, body]) => {
    const pt = CELESTIAL_BODIES_PT[name];
    TEXT_FIELDS.forEach((field) => {
      assert.ok(pt[field], `${name}.${field} is missing`);
      if (!LANGUAGE_NEUTRAL.test(body[field])) assert.notEqual(pt[field], body[field], `${name}.${field} is untranslated`);
    });
    assert.equal(pt.facts.length, body.facts.length, `${name} facts`);
    pt.facts.forEach((fact, index) => assert.notEqual(fact, body.facts[index], `${name} fact ${index}`));
  });
});

test('Portuguese numbers use Brazilian separators', () => {
  assert.equal(CELESTIAL_BODIES_PT.Mercury.diameter, '4.879 km');
  assert.equal(CELESTIAL_BODIES_PT.Venus.orbit, '224,7 dias terrestres');
});

test('localizedBody keeps the shared fields and leaves English alone', () => {
  assert.equal(localizedBody(CELESTIAL_BODIES.Earth, 'en'), CELESTIAL_BODIES.Earth);
  const earth = localizedBody(CELESTIAL_BODIES.Earth, 'pt-BR');
  assert.equal(earth.texture, CELESTIAL_BODIES.Earth.texture);
  assert.equal(earth.name, 'Earth');
  assert.equal(earth.classification, 'Planeta terrestre');
});

test('the journey text has the same keys in both languages, including the timescale explanation', () => {
  assert.deepEqual(Object.keys(JOURNEY_TEXT['pt-BR']).sort(), Object.keys(JOURNEY_TEXT.en).sort());
  assert.match(JOURNEY_TEXT.en.timeRealValue, /230 million Earth years/);
  assert.match(JOURNEY_TEXT['pt-BR'].timeRealValue, /230 milhões de anos terrestres/);
});

test('every galactic feature has every field in Portuguese', () => {
  GALACTIC_FEATURES.forEach((feature) => {
    const pt = localizedFeature(feature, 'pt-BR');
    ['scale', 'description', 'fact', 'sourceLabel'].forEach((field) => assert.notEqual(pt[field], feature[field], `${feature.id}.${field}`));
    if (feature.id !== 'black-hole') assert.notEqual(pt.label, feature.label, `${feature.id}.label`);
    assert.equal(pt.source, feature.source);
    feature.details?.forEach((detail, index) => {
      assert.notEqual(pt.details[index].text, detail.text);
      assert.equal(pt.details[index].source, detail.source);
    });
  });
  assert.equal(localizedFeature(GALACTIC_FEATURES[0], 'en'), GALACTIC_FEATURES[0]);
});
