const DEG_TO_RAD = Math.PI / 180;

// Deliberately compressed display values keep all worlds explorable in one scene.
// Physical periods inform relative motion but are intentionally accelerated.
// albedoGain evens out exposure, because the shared display light falls off steeply across the compressed distances.
// textureHigh is loaded only while a planet is selected, on devices that can afford it.
export const PLANETS = [
  { name: 'Mercury', color: 0xa7a29b, radius: 0.46, orbitRadius: 10, orbitPeriod: 0.241, rotationPeriod: 58.65, axialTilt: 0.03, initialAngle: 0.5, albedoGain: 0.12, roughness: 0.95, textureHigh: 'assets/textures/mercury-high.jpg' },
  { name: 'Venus', color: 0xe0b77f, radius: 0.82, orbitRadius: 14, orbitPeriod: 0.615, rotationPeriod: -243.02, axialTilt: 177.4, initialAngle: 2.2, albedoGain: 0.2, roughness: 1, textureHigh: 'assets/textures/venus-high.jpg' },
  { name: 'Earth', color: 0x3d95d5, radius: 0.9, orbitRadius: 19, orbitPeriod: 1, rotationPeriod: 0.997, axialTilt: 23.44, initialAngle: 4.3 },
  { name: 'Mars', color: 0xc36c52, radius: 0.62, orbitRadius: 25, orbitPeriod: 1.881, rotationPeriod: 1.026, axialTilt: 25.19, initialAngle: 1.1, albedoGain: 0.5, roughness: 0.95, textureHigh: 'assets/textures/mars-high.jpg' },
  { name: 'Jupiter', color: 0xd1a072, radius: 2.42, orbitRadius: 34, orbitPeriod: 11.862, rotationPeriod: 0.414, axialTilt: 3.13, initialAngle: 5.05, albedoGain: 0.78, roughness: 1, textureHigh: 'assets/textures/jupiter-high.jpg' },
  { name: 'Saturn', color: 0xe0cb99, radius: 2.06, orbitRadius: 44, orbitPeriod: 29.457, rotationPeriod: 0.444, axialTilt: 26.73, initialAngle: 3.25, hasRings: true, albedoGain: 1.05, roughness: 1, textureHigh: 'assets/textures/saturn-high.jpg' },
  { name: 'Uranus', color: 0x89d8df, radius: 1.47, orbitRadius: 54, orbitPeriod: 84.017, rotationPeriod: -0.718, axialTilt: 97.77, initialAngle: 0.05, albedoGain: 1.25, roughness: 1 },
  { name: 'Neptune', color: 0x527fdb, radius: 1.42, orbitRadius: 64, orbitPeriod: 164.79, rotationPeriod: 0.671, axialTilt: 28.32, initialAngle: 4.05, albedoGain: 2.1, roughness: 1 },
].map((planet) => ({ ...planet, axialTilt: planet.axialTilt * DEG_TO_RAD }));