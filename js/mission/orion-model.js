import * as THREE from 'three';

/** Original low-poly illustration: +Y is the docking/nose direction. No NASA model files. */
export function createOrion() {
  const group = new THREE.Group(); group.name = 'Orion (enlarged educational model)';
  const silver = new THREE.MeshStandardMaterial({ color: 0xdbe3e8, roughness: 0.48, metalness: 0.4, emissive: 0x202a36, emissiveIntensity: 0.25 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf3eee1, roughness: 0.72, emissive: 0x1c2535, emissiveIntensity: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x182330, roughness: 0.65, metalness: 0.2 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x1f5794, roughness: 0.48, metalness: 0.35, emissive: 0x0c2445, emissiveIntensity: 0.5, side: THREE.DoubleSide });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc49c46, roughness: 0.6, metalness: 0.4 });
  const mesh = (geometry, material, parent, x = 0, y = 0, z = 0) => {
    const item = new THREE.Mesh(geometry, material); item.position.set(x, y, z); parent.add(item); return item;
  };
  const capsule = new THREE.Group(); group.add(capsule);
  capsule.position.y = -0.09; // Crew-module centre is the trajectory anchor.
  mesh(new THREE.CylinderGeometry(0.035, 0.09, 0.085, 20), silver, capsule, 0, 0.09);
  mesh(new THREE.CylinderGeometry(0.091, 0.091, 0.012, 20), dark, capsule, 0, 0.042);
  mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.025, 16), white, capsule, 0, 0.143);
  mesh(new THREE.TorusGeometry(0.024, 0.004, 4, 16), dark, capsule, 0, 0.157).rotation.x = Math.PI / 2;
  for (const x of [-0.025, 0.025]) mesh(new THREE.BoxGeometry(0.018, 0.02, 0.006), dark, capsule, x, 0.105, 0.054);
  const service = new THREE.Group(); group.add(service);
  service.position.y = -0.09;
  mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.11, 16), white, service, 0, -0.02);
  mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.016, 16), gold, service, 0, -0.069);
  mesh(new THREE.CylinderGeometry(0.018, 0.032, 0.04, 12, 1, true), dark, service, 0, -0.098);
  // Four solar wings with a visible grid. Shared geometry/materials keep draw data small.
  const panelGeometry = new THREE.BoxGeometry(0.14, 0.007, 0.065);
  const seamGeometry = new THREE.BoxGeometry(0.002, 0.008, 0.066);
  const solarWings = [];
  for (let i = 0; i < 4; i += 1) {
    const wing = new THREE.Group(); wing.rotation.y = Math.PI / 4 + i * Math.PI / 2; service.add(wing);
    solarWings.push(wing);
    mesh(new THREE.BoxGeometry(0.1, 0.008, 0.009), gold, wing, 0.1, -0.01);
    mesh(panelGeometry, blue, wing, 0.215, -0.01);
    for (let j = 0; j < 5; j += 1) mesh(seamGeometry, silver, wing, 0.15 + j * 0.032, -0.01);
  }
  const parachutes = new THREE.Group(); parachutes.visible = false; group.add(parachutes);
  parachutes.position.y = -0.09;
  const red = new THREE.MeshBasicMaterial({ color: 0xc94843, side: THREE.DoubleSide });
  for (let i = 0; i < 3; i += 1) {
    const a = i * Math.PI * 2 / 3; const x = Math.cos(a) * 0.11; const z = Math.sin(a) * 0.11;
    mesh(new THREE.SphereGeometry(0.09, 10, 6, 0, Math.PI*2, 0, Math.PI/2), red, parachutes, x, 0.42, z);
    const cord = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.155, 0), new THREE.Vector3(x, 0.42, z)]);
    parachutes.add(new THREE.Line(cord, new THREE.LineBasicMaterial({ color: 0xc0c8cc })));
  }
  const fill = new THREE.PointLight(0xd4e9ff, 0.8, 0.8, 1); fill.position.set(0.2, 0.3, 0.25); group.add(fill);
  return { group, capsule, service, solarWings, parachutes };
}
