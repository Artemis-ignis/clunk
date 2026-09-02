import * as THREE from '../../../Harvest Frontier/node_modules/three/build/three.module.js';
import { createFarmNpcs } from '../../../Harvest Frontier/src/engine/assets/npcs';
import { createFarmProps } from '../../../Harvest Frontier/src/engine/assets/props';
import { createPlayerAvatar } from '../../../Harvest Frontier/src/engine/animation/playerMotion';

function dump(root: any, label: string) {
  root.updateMatrixWorld(true);
  console.log(`--- ${label}`);
  const rows: [string, number, number][] = [];
  root.traverse((n: any) => {
    if (!n.isMesh) return;
    const b = new THREE.Box3().setFromObject(n);
    rows.push([n.name || n.type, Math.round(b.max.y * 1000) / 1000, Math.round(b.min.y * 1000) / 1000]);
  });
  rows.sort((a, b) => b[1] - a[1]);
  for (const r of rows.slice(0, 6)) console.log(`  ${r[0]}  top=${r[1]} bottom=${r[2]}`);
}

const npc = createFarmNpcs()[0]!;
npc.root.position.set(0, 0, 0);
dump(npc.root, 'kang-taeho');
const av = createPlayerAvatar();
dump(av.root, 'player');
const props = createFarmProps(true).root;
for (const name of ['farmWaterButt', 'farmsteadClutter', 'routeHandCarts', 'fenceLines']) {
  let f: any = null;
  props.traverse((n: any) => { if (!f && n.name === name) f = n; });
  console.log(`--- ${name}: type=${f.type} isInstanced=${!!f.isInstancedMesh} scale=${JSON.stringify(f.scale.toArray())} pos=${JSON.stringify(f.position.toArray().map((v:number)=>Math.round(v*100)/100))}`);
  const b = new THREE.Box3().setFromObject(f);
  console.log(`    world box min=${b.min.toArray().map((v:number)=>Math.round(v*100)/100)} max=${b.max.toArray().map((v:number)=>Math.round(v*100)/100)}`);
  if (name === 'farmWaterButt' || name === 'farmsteadClutter') dump(f, name);
}
