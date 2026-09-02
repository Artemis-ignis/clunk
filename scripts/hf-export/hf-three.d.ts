/**
 * Type shim for the Harvest Frontier copy of three.
 *
 * WHY THE IMPORT GOES BY PATH. The exporter has to run against HF's own three
 * (r185): the objects HF's factories build and the GLTFExporter that serialises
 * them must be ONE module instance, or every `instanceof` inside the exporter
 * fails. Node resolves a bare `three` from inside HF's tree to HF's copy, so
 * this repo's scripts import that build by relative path to land on the same
 * module. TypeScript has no `types` entry for that path, hence these
 * declarations.
 *
 * WHY THEY POINT AT CLUNK'S `three`. A wildcard ambient module cannot re-export
 * a relative path (the specifier is resolved against the wildcard pattern, not
 * against this file), so HF's own @types/three 0.185 is not reachable from
 * here. Clunk's @types/three 0.179 describes the same API for everything this
 * pipeline touches. Where an object really crosses between the two type
 * identities — an HF factory's return value handed to a helper in lib.mts — it
 * goes through `crossThree()` there, which documents the re-label.
 *
 * Nothing is written into the Harvest Frontier checkout; it is read-only.
 */
declare module '*/Harvest Frontier/node_modules/three/build/three.module.js' {
  export * from 'three';
}
declare module '*/Harvest Frontier/node_modules/three/examples/jsm/exporters/GLTFExporter.js' {
  export * from 'three/examples/jsm/exporters/GLTFExporter.js';
}
