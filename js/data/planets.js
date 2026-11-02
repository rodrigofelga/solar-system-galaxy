const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS_KM = 6371;
const EARTH_DISPLAY_RADIUS = 0.9;
const SIZE_COMPRESSION = 0.55;
const displayRadius = (radiusKm) => EARTH_DISPLAY_RADIUS * (radiusKm / EARTH_RADIUS_KM) ** SIZE_COMPRESSION;

export const SUN_DISPLAY_RADIUS = 5.2;
// Extra size in the wide view only, fading to 1 as the camera nears a body, so close-ups and the Artemis II mapping keep the radii above.
// Rocky planets get more because they are only a few pixels wide; it is shared across each group, so the size order is kept.
export const SUN_OVERVIEW_BOOST = 1.08;
const ROCKY_OVERVIEW_BOOST = 1.3;
const GIANT_OVERVIEW_BOOST = 1.1;

// Deliberately compressed display values keep all worlds explorable in one scene.
// Radii follow one rule, so every size comparison keeps its order: true ratio to Earth, raised to SIZE_COMPRESSION.
// At 1 this would be true scale, with Mercury 29 times smaller than Jupiter; at 0.55 it is about 6 times.
// The Sun is compressed further, because at the same rule it would reach past Mercury's orbit.
// Physical periods inform relative motion but are intentionally accelerated.
// albedoGain evens out exposure, because the shared display light falls off steeply across the compressed distances.
// textureHigh is loaded only while a planet is selected, on devices that can afford it.
export const PLANETS = [
  { name: 'Mercury', color: 0xa7a29b, radiusKm: 2439.7, orbitRadius: 10, orbitPeriod: 0.241, rotationPeriod: 58.65, axialTilt: 0.03, initialAngle: 0.5, albedoGain: 0.12, roughness: 0.95, textureHigh: 'assets/textures/mercury-high.jpg' },
  { name: 'Venus', color: 0xe0b77f, radiusKm: 6051.8, orbitRadius: 14, orbitPeriod: 0.615, rotationPeriod: -243.02, axialTilt: 177.4, initialAngle: 2.6, albedoGain: 0.2, roughness: 1, textureHigh: 'assets/textures/venus-high.jpg' },
  { name: 'Earth', color: 0x3d95d5, radiusKm: EARTH_RADIUS_KM, orbitRadius: 19, orbitPeriod: 1, rotationPeriod: 0.997, axialTilt: 23.44, initialAngle: 0.8 },
  { name: 'Mars', color: 0xc36c52, radiusKm: 3389.5, orbitRadius: 25, orbitPeriod: 1.881, rotationPeriod: 1.026, axialTilt: 25.19, initialAngle: 1.9, albedoGain: 0.5, roughness: 0.95, textureHigh: 'assets/textures/mars-high.jpg' },
  { name: 'Jupiter', color: 0xd1a072, radiusKm: 69911, orbitRadius: 35, orbitPeriod: 11.862, rotationPeriod: 0.414, axialTilt: 3.13, initialAngle: 2.75, albedoGain: 0.82, roughness: 1, textureHigh: 'assets/textures/jupiter-high.jpg' },
  { name: 'Saturn', color: 0xe0cb99, radiusKm: 58232, orbitRadius: 47, orbitPeriod: 29.457, rotationPeriod: 0.444, axialTilt: 26.73, initialAngle: 0.28, hasRings: true, albedoGain: 1.17, roughness: 1, textureHigh: 'assets/textures/saturn-high.jpg' },
  { name: 'Uranus', color: 0x89d8df, radiusKm: 25362, orbitRadius: 58, orbitPeriod: 84.017, rotationPeriod: -0.718, axialTilt: 97.77, initialAngle: 3.5, albedoGain: 1.4, roughness: 1 },
  { name: 'Neptune', color: 0x527fdb, radiusKm: 24622, orbitRadius: 68, orbitPeriod: 164.79, rotationPeriod: 0.671, axialTilt: 28.32, initialAngle: 1.45, albedoGain: 2.31, roughness: 1 },
].map((planet) => ({
  ...planet,
  radius: displayRadius(planet.radiusKm),
  axialTilt: planet.axialTilt * DEG_TO_RAD,
  overviewBoost: planet.radiusKm < EARTH_RADIUS_KM * 2 ? ROCKY_OVERVIEW_BOOST : GIANT_OVERVIEW_BOOST,
}));