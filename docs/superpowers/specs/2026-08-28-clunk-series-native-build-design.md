# Clunk Series Native Build Design

## Status

Approved for implementation by the user's explicit instruction to clone GitHub sources and rebuild them as Clunk-native series rather than external integrations.

## Design read

This is an existing-product architectural rebuild for game developers and technical artists. The product language is an industrial creative workstation with real 2D/3D artifacts, restrained motion, and evidence that appears after creation rather than replacing it. Design dials: `DESIGN_VARIANCE 8`, `MOTION_INTENSITY 6`, `VISUAL_DENSITY 4`.

## North star

Clunk should own a local-first series of asset tools that turns a reference or prompt into a traceable game asset package:

```text
Clunk Forge → Clunk Sprite → Clunk Material → Clunk Motion
                       ↓
              Clunk Game Ready → Clunk Market
```

The series is Clunk software. GitHub repositories are source material and, where licenses permit, selected implementation material. No series feature may depend on an unverified external API or pretend that a model runtime is available.

## Source policy

Every cloned repository is recorded with URL, commit, license, local clone path, and integration decision in `packages/clunk-series/src/source-manifest.ts` and `docs/third-party/clunk-series-sources.ko.md`.

### Adopted sources

- `donmccurdy/glTF-Transform` at the audited commit, MIT. Use the already installed packages for Clunk's own GLB transform rail.
- `zeux/meshoptimizer` at the audited commit, MIT. Record as the performance source for the mesh optimization rail; do not ship an unbuilt binary.
- `RodZill4/material-maker` at the audited commit, MIT. Reimplement the useful procedural graph concept in a Clunk-owned JSON graph and deterministic local texture writer.
- `xinntao/Real-ESRGAN` at the audited commit, BSD-3-Clause. Keep as an optional local enhancement source; model weights remain separately licensed and are never implied to ship.
- `digitable-lol/blender-mcp` at the audited commit, MIT. Use its headless/local boundary as source material for a Clunk Motion Lab contract, without depending on the repository at runtime.

### Isolated or excluded sources

- `microsoft/TRELLIS.2` is MIT code but requires a Linux NVIDIA environment with substantial VRAM and separate model/dependency terms. It remains a research source record, not a default commercial runtime.
- `blendi-remade/sprite-sheet-creator` has no root license file in the audited clone. Do not copy its code or bundled assets. Its visible workflow is treated as product research only.

## Clunk-owned architecture

Create `packages/clunk-series` as a focused, runtime-neutral TypeScript module. It owns:

- series catalog and source provenance
- common job, artifact, bundle, license, and readiness contracts
- native authoring dispatch for Forge, Sprite, Material, and Motion
- deterministic material graph and PNG output
- series bundle manifest generation
- Game Ready handoff to `packages/core`

The module may call existing Clunk Core authoring and inspection functions, but it never bypasses source/output hash, fresh reopen, provenance, or license status. Generated assets stay `productionReady: false` until the existing evidence and human gates say otherwise.

### Series boundaries

#### Clunk Asset Forge

Owns reference-to-3D authoring using the current Clunk real-byte authoring path, with source reference, prompt hash, recipe hash, and target profile attached to every job.

#### Clunk Sprite Lab

Owns 2D image, sprite atlas, and Spine bundle authoring using Clunk-native output contracts. It preserves grid, frame, alpha, pivot, motion, and human-review separation.

#### Clunk Material Lab

Owns a Clunk material graph with deterministic base color, roughness, metallic, and normal map artifacts plus an inspectable graph manifest. The graph is not falsely presented as a third-party Material Maker project.

#### Clunk Motion Lab

Owns animation-clip artifacts and a local-runner contract. A missing Blender/GPU runner returns `ENVIRONMENT_UNAVAILABLE`, never a successful fake animation.

#### Clunk Game Ready

Owns the common handoff to Core inspection, optimization, output reopen, Passport, and the static/runtime/player-facing/human evidence lanes.

#### Clunk Market

Owns series bundle identity, listing draft metadata, license clearance state, and publishability. Existing payment-unconfigured boundaries stay explicit.

## Data flow

```text
request + source/license
        ↓
series plan and deterministic request hash
        ↓
Clunk-native authoring
        ↓
separate artifacts + per-file SHA-256
        ↓
fresh Core inspection using the target profile
        ↓
series manifest + Passport-ready evidence
        ↓
explicit storage / download / listing draft
```

The first implementation is synchronous and local-first because the current repository has verified synchronous authoring contracts. A future queue can consume the same job contract without changing artifact semantics.

## Product surface

Add a public `/series` route that explains the six Clunk-owned series and shows source transparency. Extend Studio with a series rail and route all live creation actions through the Clunk series contract. Keep unsupported actions absent or visibly unavailable. Do not add fake OAuth, payment, AI provider success, or external runtime controls.

## Error and license handling

- A missing or non-commercial upstream condition is a source status, not an application crash.
- A source with no license is excluded from copied implementation and visibly marked research-only.
- A local runner absence produces `ENVIRONMENT_UNAVAILABLE`.
- A missing storage binding produces `LOCAL_PREVIEW_ONLY`.
- Every artifact includes a source role, license status, prompt/reference provenance, byte length, and SHA-256.
- No input artifact is overwritten.

## Testing and completion criteria

Before implementation, tests must fail for the new series catalog, source manifest, native creation, material graph, bundle manifest, and Game Ready handoff. Then implement the smallest working contracts and run the focused tests.

Completion requires:

1. The GitHub clones are recorded with audited commits and licenses.
2. Clunk-native series modules produce real deterministic artifacts for Forge, Sprite, Material, and Motion.
3. Material Lab produces real PNG bytes and a graph manifest that reopens through the image analyzer.
4. Game Ready receives the real artifact bytes and preserves Core evidence semantics.
5. Studio and `/series` expose the series without claiming unsupported external runtimes.
6. Existing Core, generation, review, marketplace, auth, D1/R2, MCP, CLI, and Sites behavior remains intact.
7. Typecheck, lint, focused tests, full tests, build, and browser checks are freshly run.
8. Any unavailable GPU, OAuth, payment, or production deployment work is documented as unavailable rather than simulated.
