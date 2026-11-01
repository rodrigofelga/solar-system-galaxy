import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CREW, CREW_TEXT, SOCIAL_ICONS } from '../js/data/crew.js';

test('all four crew members appear with their flown roles and agencies', () => {
  assert.deepEqual(CREW.map(({ name, en, agency }) => [name, en.role, agency]), [
    ['Reid Wiseman', 'Commander', 'NASA'],
    ['Victor Glover', 'Pilot', 'NASA'],
    ['Christina Koch', 'Mission Specialist', 'NASA'],
    ['Jeremy Hansen', 'Mission Specialist', 'CSA'],
  ]);
});

test('every profile is complete in English and Brazilian Portuguese', () => {
  for (const member of CREW) {
    for (const language of ['en', 'pt-BR']) {
      const copy = member[language];
      assert.ok(copy.role && copy.agencyName && copy.bio.includes(member.name), `${member.name} ${language}`);
      assert.ok(copy.facts.length >= 1 && copy.facts.length <= 2);
    }
    assert.notEqual(member.en.bio, member['pt-BR'].bio);
  }
  assert.deepEqual(Object.keys(CREW_TEXT.en).sort(), Object.keys(CREW_TEXT['pt-BR']).sort());
  assert.equal(CREW_TEXT['pt-BR'].title, 'Conheça a Tripulação da Artemis II');
});

test('links use official agency hosts and only documented social accounts', () => {
  const social = { 'Reid Wiseman': ['astro_reid', 'astro_reid'], 'Victor Glover': ['astrovicglover', 'AstroVicGlover'], 'Christina Koch': ['astro_christina', 'Astro_Christina'], 'Jeremy Hansen': ['astrojeremy', 'Astro_Jeremy'] };
  for (const member of CREW) {
    const host = new URL(member.bioUrl).hostname;
    assert.ok(host === 'www.nasa.gov' || host === 'www.asc-csa.gc.ca');
    assert.equal(member.social.Instagram, `https://www.instagram.com/${social[member.name][0]}/`);
    assert.equal(member.social.X, `https://x.com/${social[member.name][1]}`);
    Object.keys(member.social).forEach((network) => assert.ok(SOCIAL_ICONS[network]));
  }
});

test('portraits exist locally and stay small', () => {
  for (const member of CREW) {
    const size = fs.statSync(new URL(`../${member.portrait}`, import.meta.url)).size;
    assert.ok(size > 5000 && size < 120000, `${member.portrait}: ${size}`);
  }
});
