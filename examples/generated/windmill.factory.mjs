/**
 * Farm windmill — procedural three.js factory, generation-pipeline demo asset.
 *
 * Written code-first in the img2threejs discipline (blockout → structure → form → material),
 * no photogrammetry, no downloaded art. Conventions the Clunk gate can check today and the
 * profile contract will check later:
 *   - named animation socket `blades_pivot` (spin the blades by rotating that node)
 *   - five distinct materials, no duplicates
 *   - every primitive carries normals and UVs (built-in geometries)
 *   - root.userData.sockets documents the contract and survives export as glTF extras
 */
export function createFarmWindmillModel(THREE) {
  const stone = new THREE.MeshStandardMaterial({ name: "stone-base", color: 0x8d8778, roughness: 0.95 });
  const wood = new THREE.MeshStandardMaterial({ name: "wood-tower", color: 0x8a5a33, roughness: 0.85 });
  const roof = new THREE.MeshStandardMaterial({ name: "roof-shingle", color: 0x7a3b2e, roughness: 0.8 });
  const canvas = new THREE.MeshStandardMaterial({ name: "blade-canvas", color: 0xe8e2d2, roughness: 0.7 });
  const iron = new THREE.MeshStandardMaterial({ name: "iron-hub", color: 0x3c3f45, roughness: 0.5, metalness: 0.6 });

  const root = new THREE.Group();
  root.name = "farm_windmill";
  root.userData = {
    generator: "clunk-generate-pipeline",
    sockets: ["blades_pivot"],
    upAxis: "+Y",
  };

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.5, 0.5, 10), stone);
  base.name = "base_plinth";
  base.position.y = 0.25;
  root.add(base);

  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 1.18, 2.9, 10), wood);
  tower.name = "tower_body";
  tower.position.y = 0.5 + 1.45;
  root.add(tower);

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.85, 0.08), roof);
  door.name = "tower_door";
  door.position.set(0, 0.95, 1.12);
  door.rotation.x = -0.08;
  root.add(door);

  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.9, 10), roof);
  cap.name = "roof_cap";
  cap.position.y = 0.5 + 2.9 + 0.45;
  root.add(cap);

  // Animation socket: rotate this node around Z to spin the blades.
  const bladesPivot = new THREE.Group();
  bladesPivot.name = "blades_pivot";
  bladesPivot.position.set(0, 3.35, 0.86);
  root.add(bladesPivot);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 8), iron);
  hub.name = "blade_hub";
  hub.rotation.x = Math.PI / 2;
  bladesPivot.add(hub);

  for (let index = 0; index < 4; index++) {
    const blade = new THREE.Group();
    blade.name = `blade_arm_${index + 1}`;
    blade.rotation.z = (Math.PI / 2) * index;

    const spar = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.55, 0.06), wood);
    spar.name = `blade_spar_${index + 1}`;
    spar.position.y = 0.85;
    blade.add(spar);

    const sail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.25, 0.03), canvas);
    sail.name = `blade_sail_${index + 1}`;
    sail.position.set(0.2, 0.95, 0);
    blade.add(sail);

    bladesPivot.add(blade);
  }

  const railing = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.045, 6, 14), wood);
  railing.name = "deck_railing";
  railing.rotation.x = Math.PI / 2;
  railing.position.y = 1.9;
  root.add(railing);

  return root;
}

export default createFarmWindmillModel;
