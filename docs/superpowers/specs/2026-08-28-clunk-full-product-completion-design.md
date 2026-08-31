# Clunk Full Product Completion Design

## Design read

Reading this as: a redesign and completion of a technical game-asset product for game teams and technical artists, with a precise asset-first and evidence-first language, leaning toward a restrained industrial foundry system with real previews and explicit state boundaries.

## Purpose

Clunk must operate as one coherent product, not as a landing page followed by disconnected demonstrations.

The product promise is:

> 아이디어를 실제 게임 에셋으로 만들고, 버전과 provenance를 남기고, Game Ready 근거와 함께 팀에 전달한다.

The current repository already contains the real Core AssetOps pipeline, procedural authoring, Clunk Series native authoring, Sites authentication, D1/R2 boundaries, Passport, MCP, CLI, collaboration, and marketplace publication gates. This design completes the product surface around those contracts without weakening their meaning.

## Scope boundary

In scope:

- Public Discover, Create, Game Ready, Developers, Pricing, Series and Docs surfaces.
- Authenticated Studio, Workspace, asset detail, generation history, Remix and Kits.
- Native local authoring for the supported 2D, atlas, Spine, material and GLB/animation paths.
- Hash-addressed asset records, source-linked remixes, artifact manifests, download/export responses, and Passport/evidence links.
- Provider capability discovery that distinguishes native, adapter-required, and environment-unavailable paths.
- Sites-compatible auth, D1/R2 persistence, Cloudflare migration documentation, and verification.
- Collaboration with FORGE FRONT only through Clunk-facing handoff documentation and APIs. The FORGE FRONT repository is not edited and its game is not implemented here.

Out of scope unless real credentials and a verified runtime are present:

- Google OAuth, GitHub OAuth, or an invented local OAuth session.
- Payment capture, paid entitlement, customer/revenue claims, or creator marketplace claims.
- Remote GPU execution, TRELLIS.2 inference, Blender installation, or a browser runtime PASS that has not been captured.
- DNS changes, production migration, deletion, reset, or changes in another repository.

## Product lifecycle

Every product action maps to a truthful state:

1. Plan: choose asset family, target profile, license declaration and prompt.
2. Create: Clunk-native authoring writes separate artifact bytes.
3. Remix: a source asset is required; the new request records source asset id and source hash and writes new bytes.
4. Inspect: Core calculates metrics from the new bytes and records a fresh evidence envelope.
5. Review: visual runtime, player-facing, and human review remain separate lanes.
6. Package: a Kit records members and hash-only artifact manifest. Individual bytes remain addressable and are never silently overwritten.
7. Export: authenticated workspace downloads can retrieve stored artifacts and a JSON manifest. A missing R2 binding is an explicit unavailable state.
8. Publish: marketplace status remains Draft-first. PUBLISHED remains gated by storage, provenance, license, static, runtime, player-facing and human PASS.

## Data model additions

The existing generation, asset, artifact, review, Passport and listing tables remain the source of truth. Add only the smallest tables needed for product-level grouping:

- `clunk_projects`: workspace-owned project names and descriptions.
- `clunk_asset_kits`: workspace-owned package records with title, description, status and manifest JSON.
- `clunk_asset_kit_members`: ordered asset membership with source hash and role.

Generation rows gain no destructive migration. Remix metadata is stored in the existing recipe JSON and provenance JSON. A project or kit can be created after a generation and linked by id.

## API contracts

### `POST /api/series`

Existing creation remains compatible. It additionally accepts:

```ts
{
  operation?: "create" | "remix";
  sourceAssetId?: string;
  projectId?: string;
}
```

For `remix`, the source asset must belong to the current workspace. The source hash is copied into the native provenance input and the recipe records the source asset id. The output gets a new content-addressed asset id. No input bytes are replaced.

### `GET /api/assets/:assetId` and `GET /api/assets/:assetId?file=...`

Authenticated workspace detail and artifact download. The route checks workspace ownership and exact file names. It returns an unavailable response when R2 is not configured, rather than returning a false download.

### `GET|POST /api/projects`

List or create workspace projects. Names are validated, scoped by workspace and do not claim project execution beyond the records that exist.

### `GET|POST /api/kits`

List kits or create a Kit from up to 12 workspace assets. Creation verifies every asset belongs to the workspace, collects current artifact hashes, and writes a deterministic hash-only manifest. It does not duplicate raw bytes.

### `GET /api/kits/:kitId`

Returns the Kit manifest and member artifact list. `?download=manifest` returns the same manifest as an attachment. An actual binary archive is not claimed unless an archive writer is implemented and verified.

### `GET /api/providers`

Returns the checked-in capability registry. Native Clunk Series authoring is available; external inference, OAuth and payment are unavailable or adapter-required. The response contains no invented provider success.

## UI surfaces

- Studio has Create, Result, Review and Package sections. Remix is enabled only after a real result exists and always shows the source link.
- Workspace shows recent generated assets, source-linked remixes, kits, Game Ready lanes, Passport and credits.
- Asset detail shows artifact list, hashes, provenance, evidence, Passport link, Remix action and Kit action.
- Kits shows actual workspace assets and generated manifests. Empty, loading, unavailable and error states are explicit.
- Discover remains public and asset-first. It never exposes private workspace assets and never turns a Draft into a public product.
- Developers exposes the provider registry, MCP, CLI and handoff documentation.

## Security and truth rules

- User identity comes only from the provider-neutral server auth boundary.
- Every private query is scoped by workspace id.
- All browser writes enforce same-origin when an Origin header is present.
- Asset ids and file names use strict safe-id validation.
- R2 object keys are generated server-side.
- Manifests contain hashes and metadata, not mutable raw bytes.
- `productionReady` remains false until every required Core and review gate is genuinely recorded.
- A sample, fixture, local preview, environment-unavailable runner, or provider registry entry is never presented as a completed production result.

## Verification

Pure lifecycle contracts are covered by TypeScript tests. API contracts are covered by source and mocked D1 tests. UI contracts assert route links, labels, and explicit unavailable states. The final gate runs typecheck, lint, focused product/series/API tests, build and the full test script. Browser verification, when used, is headless and checks the rendered public routes plus authenticated workspace states without opening a visible Chrome window.

## Completion definition

The product is complete when a user can start at the public site, enter Studio, produce a real native artifact, see its hash and evidence boundary, remix it into a new source-linked artifact, place real assets into a hash-only Kit, inspect/download what R2 actually stores, open a Game Ready detail view, and hand the resulting manifest to a collaborator or MCP/CLI client. Unsupported external services remain clearly documented as unavailable rather than silently substituted.
