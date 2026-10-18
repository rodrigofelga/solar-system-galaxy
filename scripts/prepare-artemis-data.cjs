// Optional offline preparation only. Runtime requires neither Node nor Astronomy Engine.
// Usage: node scripts/prepare-artemis-data.cjs /path/to/astronomy-engine/astronomy.min.js
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const astronomy = require(path.resolve(process.argv[2]));
const source = fs.readFileSync('assets/mission/orion-nasa-source.oem', 'utf8');
const epoch = Date.parse('2026-04-01T22:35:00Z');
const round = (x, n) => Number(x.toFixed(n));
const rows = source.split(/\r?\n/).filter((line) => /^2026-/.test(line)).map((line) => {
  const [stamp, ...state] = line.trim().split(/\s+/);
  const time = new Date(`${stamp}Z`);
  const moon = astronomy.GeoMoonState(time);
  return [round((time.getTime() - epoch) / 1000, 3), ...state.map((v, i) => round(Number(v), i < 3 ? 3 : 7)),
    ...[moon.x, moon.y, moon.z].map((v) => round(v * astronomy.KM_PER_AU, 3)),
    ...[moon.vx, moon.vy, moon.vz].map((v) => round(v * astronomy.KM_PER_AU / 86400, 7))];
});
let nearest = rows[0];
let distance = Infinity;
for (const row of rows) {
  const d = Math.hypot(row[1] - row[7], row[2] - row[8], row[3] - row[9]);
  if (d < distance) { distance = d; nearest = row; }
}
const data = {
  schema: 1, epoch: new Date(epoch).toISOString(), frame: 'Earth-centred EME2000 / EQJ approximation',
  units: 'seconds from epoch, km, km/s',
  columns: ['t', 'x', 'y', 'z', 'vx', 'vy', 'vz', 'moonX', 'moonY', 'moonZ', 'moonVx', 'moonVy', 'moonVz'],
  source: 'https://www.nasa.gov/wp-content/uploads/2026/03/all-artemis-ii-oem-files.zip',
  sourceMember: 'Artemis_II_OEM_2026_04_10_Post-ICPS-Sep-to-EI.asc',
  sourceCreated: '2026-04-10T03:22:19Z', sourceSHA256: crypto.createHash('sha256').update(source).digest('hex'),
  moonModel: 'Astronomy Engine GeoMoonState (EQJ), MIT, Don Cross, source file commit 826e26ff3a6dc03ee46658b1138fef582d96c5d9; computed, not NASA telemetry',
  first: rows[0][0], last: rows.at(-1)[0], flyby: nearest[0], flybyDistanceKm: round(distance, 3),
  tli: (Date.parse('2026-04-02T23:49:00Z') - epoch) / 1000,
  tliDuration: 350, end: (Date.parse('2026-04-11T00:07:00Z') - epoch) / 1000,
  note: 'NASA published OEM includes reconstructed states and a forecast tail after sourceCreated. Launch/entry/splashdown extensions and chapter pacing are illustrative. Lunar positions are computed independently, not mission tracking data.',
  rows,
};
fs.writeFileSync('assets/mission/artemis-ii.json', JSON.stringify(data));
console.log(JSON.stringify({samples: rows.length, flybyUTC: new Date(epoch + data.flyby * 1000).toISOString(), moonCentreKm: distance, bytes: fs.statSync('assets/mission/artemis-ii.json').size}, null, 2));
