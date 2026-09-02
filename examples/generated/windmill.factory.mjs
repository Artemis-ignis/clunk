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
 *
 * The five colours were inline literals until the template library needed to bake the same
 * mill in more than one colourway. They now live in one exported object so a caller can
 * assign over its fields before calling the factory; the values below are the originals, so
 * an untouched call still writes the byte-identical GLB the marketplace listing ships.
 */
export const WINDMILL_PALETTE = {
  stone: { color: 0x8d8778 },
  wood: { color: 0x8a5a33 },
  roof: { color: 0x7a3b2e },
  canvas: { color: 0xe8e2d2 },
  iron: { color: 0x3c3f45 },
};

export function createFarmWindmillModel(THREE) {
  const stone = new THREE.MeshStandardMaterial({ name: "stone-base", color: WINDMILL_PALETTE.stone.color, roughness: 0.95 });
  const wood = new THREE.MeshStandardMaterial({ name: "wood-tower", color: WINDMILL_PALETTE.wood.color, roughness: 0.85 });
  const roof = new THREE.MeshStandardMaterial({ name: "roof-shingle", color: WINDMILL_PALETTE.roof.color, roughness: 0.8 });
  const canvas = new THREE.MeshStandardMaterial({ name: "blade-canvas", color: WINDMILL_PALETTE.canvas.color, roughness: 0.7 });
  const iron = new THREE.MeshStandardMaterial({ name: "iron-hub", color: WINDMILL_PALETTE.iron.color, roughness: 0.5, metalness: 0.6 });

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

  /*
   * Animation socket: rotate this node around Z to spin the blades.
   *
   * The z offset is load bearing. At 0.86 the sails swept *through* the tower — the tower is a
   * cone whose radius is 0.99 at the height the downward sail reaches, so the whole blade plane
   * sat inside the timber, and the hub was buried in the roof cone as well. Measured by
   * scripts/dogfood-intersections.mjs: blade_sail_3 was 19.8% inside tower_body with 3 crossing
   * triangles, blade_hub 14.8% inside roof_cap with 4.
   *
   * Clearances the 1.14 below has to keep:
   *   tower radius at the lowest sail (y = 3.35 - 1.625 = 1.73)   0.986 m
   *   half the spar depth                                         0.030 m
   *   roof cone radius at its base (y = 3.40)                     0.950 m
   *   half the hub length                                         0.150 m
   * so z must clear both 1.016 and 1.100. 1.14 leaves about 4 cm on the tighter one, and the
   * model's bounding box does not change because the stone plinth is still the widest part.
   */
  const bladesPivot = new THREE.Group();
  bladesPivot.name = "blades_pivot";
  bladesPivot.position.set(0, 3.35, 1.14);
  root.add(bladesPivot);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 8), iron);
  hub.name = "blade_hub";
  hub.rotation.x = Math.PI / 2;
  bladesPivot.add(hub);

  /*
   * Windshaft. Moving the hub clear of the roof leaves it hanging in the air, so the shaft that
   * a real mill carries is now modelled: it runs back from the hub into the cap, which is a
   * joint on purpose. It sits on the rotation axis, so spinning `blades_pivot` does not move it
   * off centre.
   */
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.72, 8), iron);
  shaft.name = "wind_shaft";
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = -0.36;
  bladesPivot.add(shaft);

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
