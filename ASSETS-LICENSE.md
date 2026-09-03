# Asset files — separate terms

> `LICENSE` (MIT) is kept verbatim so that GitHub can detect it; this file carries the scope note that would otherwise sit under it.

The MIT licence in `LICENSE` applies to Clunk's **source code**. It does **not**
apply to the game-asset files listed below. Those files are the products sold
or distributed through the Clunk marketplace (https://clunk.games/marketplace),
and all rights in them are reserved by Artemis Inc. (주식회사 아르테미스) or
the respective upstream authors.

## Paths covered by these terms

- `public/market/**` (3D models, textures, sprite sheets, previews)
- `examples/**/*.glb`, `examples/**/*.gltf`, `examples/**/*.png`, `examples/**/*.webp`,
  `examples/**/*.jpg` (generated and exported asset files and their renders)
- `public/gacha/*.jpg` (photographed posters of the machine scene)
- Any file obtained from the Clunk storage API (`/api/marketplace/assets/...`)

## What you may do with those files

- **Evaluate** them locally to run, test, review or judge this repository.
- Nothing else is granted here. Use inside your own game or product requires
  the licence that comes with the asset on its marketplace page (currently the
  free-beta licence shown at the point of download).

## Third-party sources

Assets derived from the Harvest Frontier project keep their upstream terms as
recorded in `examples/harvest-frontier/**` and the source ledger produced by
`npm run sources:audit`. Where upstream terms are more permissive than the
above, the upstream terms govern that file.

## Code that renders assets

Loaders, viewers, inspectors and export scripts are code and stay under MIT,
even when they ship with sample data.
