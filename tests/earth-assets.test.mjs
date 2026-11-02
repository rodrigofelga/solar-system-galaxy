import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const texture = (name) => readFileSync(new URL(`../assets/textures/${name}`, import.meta.url));
const hash = (name) => createHash('sha256').update(texture(name)).digest('hex').slice(0, 16);

test('Earth and Moon maps are unchanged', () => {
  assert.equal(hash('earth.jpg'), 'a7030a53a7db9dca');
  assert.equal(hash('moon.jpg'), 'f7130a1822681fa7');
  assert.equal(hash('moon-original-backup.jpg'), 'f7130a1822681fa7');
  assert.equal(hash('moon-elevation-nasa-1k.jpg'), '6d93f887e7d8bedf');
});

// Commit 53227f2 replaced the old cloud map, which also painted a second surface over Earth, with this clouds-only one.
test('the cloud layer is the clouds-only RGBA map documented in ASSET_ATTRIBUTION.md', () => {
  assert.equal(hash('earth-clouds.png'), '31ae8c9c6a7a9d32');
  const png = texture('earth-clouds.png');
  assert.equal(png.readUInt32BE(16), 1024);
  assert.equal(png.readUInt32BE(20), 512);
  assert.equal(png[25], 6, 'colour type 6 is RGBA');
});

test('the Solar System view still loads the cloud map', () => {
  const view = readFileSync(new URL('../js/solar-system-view.js', import.meta.url), 'utf8');
  assert.ok(view.includes("'assets/textures/earth-clouds.png'"));
});
