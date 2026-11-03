import test from 'node:test';
import assert from 'node:assert/strict';
import { BLACK_HOLE_TEXT } from '../js/data/black-hole-text.js';

const { en, 'pt-BR': pt } = BLACK_HOLE_TEXT;

test('both languages carry the same controls and six explained concepts', () => {
  assert.deepEqual(Object.keys(pt).sort(), Object.keys(en).sort());
  assert.equal(en.concepts.length, 6);
  assert.equal(pt.concepts.length, 6);
  en.concepts.forEach((concept, i) => {
    assert.equal(pt.concepts[i].source, concept.source);
    assert.notEqual(pt.concepts[i].text, concept.text);
    assert.match(concept.source, /^https:\/\//);
  });
});

test('the shadow is distinguished from the event horizon', () => {
  assert.match(en.concepts[0].text, /larger than the event horizon/);
  assert.match(pt.concepts[0].text, /maior que o horizonte de eventos/);
  assert.match(en.concepts[1].text, /inside the shadow/);
  assert.match(pt.concepts[1].text, /dentro da sombra/);
});

test('the illustration is not presented as an observation', () => {
  assert.match(en.concepts[2].text, /conceptual illustration, not what it is observed to have/);
  assert.match(pt.concepts[2].text, /ilustração conceitual/);
  assert.match(en.concepts[5].text, /not telescope footage/);
  assert.match(pt.concepts[5].text, /não uma filmagem de telescópio/);
});

test('numbers follow each language', () => {
  assert.equal(en.number('0.25'), '0.25');
  assert.equal(pt.number('0.25'), '0,25');
});
