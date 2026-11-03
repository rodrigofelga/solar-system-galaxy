import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MISSION_TEXT } from '../js/data/mission-text.js';

const { en, 'pt-BR': pt } = MISSION_TEXT;
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const missionSource = readFileSync(new URL('../js/mission/artemis-mission.js', import.meta.url), 'utf8');
const decode = (value) => value.replaceAll('&amp;', '&');
// Thousands and decimal separators differ between the languages, so compare digits only.
const numbers = (value) => (value.match(/\d+/g) ?? []).join(' ');
const NAMES = ['Artemis II', 'Orion', 'SLS', 'OEM', 'NASA/JSC', 'Reid Wiseman', 'Victor Glover', 'Christina Koch', 'Jeremy Hansen', 'Kim Dongjae', 'Jonathan North', 'Dan Gallagher', 'Astronomy Engine', 'Don Cross', 'MIT'];
const strings = (text) => Object.entries(text).filter(([, value]) => typeof value === 'string');

test('both languages have the same text', () => {
  assert.deepEqual(Object.keys(pt).sort(), Object.keys(en).sort());
  assert.deepEqual(Object.keys(pt.labels).sort(), Object.keys(en.labels).sort());
  assert.equal(pt.phases.length, en.phases.length);
  // The mission module needs three.js, so read its chapter starts from the source.
  const starts = [...missionSource.match(/MISSION_PHASES = \[(.*)\];/)[1].matchAll(/start: ([\d.]+)/g)].map((match) => Number(match[1]));
  assert.deepEqual(starts, [0, 0.12, 0.26, 0.30, 0.56, 0.68, 0.94]);
  assert.equal(en.phases.length, starts.length);
});

test('every Portuguese string is translated', () => {
  strings(en).forEach(([key, value]) => assert.notEqual(pt[key], value, key));
  en.phases.forEach((phase, index) => {
    assert.notEqual(pt.phases[index].title, phase.title);
    assert.notEqual(pt.phases[index].text, phase.text);
  });
  ['earth', 'moon', 'orion', 'orionAction'].forEach((key) => assert.notEqual(pt.labels[key], en.labels[key], key));
});

test('names, designations and numbers match in both languages', () => {
  const pairs = [...strings(en).map(([key, value]) => [key, value, pt[key]]), ...en.phases.flatMap((phase, index) => [[`phase ${index}`, phase.title, pt.phases[index].title], [`phase ${index} text`, phase.text, pt.phases[index].text]])];
  pairs.forEach(([key, a, b]) => {
    assert.equal(numbers(b), numbers(a), `${key} numbers`);
    NAMES.filter((name) => a.includes(name)).forEach((name) => assert.ok(b.includes(name), `${key} lost ${name}`));
  });
});

test('the page shows the same English as the text it switches back to', () => {
  const nodes = [...html.matchAll(/data-mission-text="(\w+)"[^>]*>([^<]*)</g)];
  assert.ok(nodes.length >= 30);
  nodes.forEach(([, key, shown]) => assert.equal(decode(shown), en[key], key));
  const labels = [...html.matchAll(/aria-label="([^"]+)" data-mission-aria="(\w+)"/g)];
  assert.equal(labels.length, 2);
  labels.forEach(([, shown, key]) => assert.equal(shown, en[key], key));
});

test('dynamic text keeps its values and uses Brazilian formats', () => {
  assert.equal(pt.number(0.25), '0,25');
  assert.equal(en.number(0.25), '0.25');
  assert.equal(pt.stamp('2026-04-03', '12:34'), '03/04/2026 12:34');
  assert.equal(en.stamp('2026-04-03', '12:34'), '2026-04-03 12:34');
  assert.equal(pt.clock('x', true), 'x UTC na fonte · OEM de previsão · geometria adaptada');
  assert.equal(en.clock('x', false), 'x UTC source · interpolated OEM · adapted geometry');
  assert.equal(en.unavailable('Oops'), 'Mission unavailable: Oops. Toggle it on to retry.');
});
