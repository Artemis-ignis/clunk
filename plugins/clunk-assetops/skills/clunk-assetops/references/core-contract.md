# Clunk Core and surface contract

## Canonical operations

The shared TypeScript Core owns these operations:

```ts
inspectAsset(bundle, policy)
validateAsset(bundle, policy)
scoreAsset(inspection)
optimizeAsset(bundle, allowlistedPlan)
reinspectAsset(outputBundle, policy)
createPassport(before, after, operations)
```

Adapters may translate paths, browser `File` objects, stdio JSON-RPC, or VS Code commands, but they must not alter the canonical report.

## Required envelope fields

Every inspect or optimize response records:

- `coreBuildId`
- `ruleSetId`
- `inputHash`
- `resultDigest`
- input filename, format, bytes, and output hash when an output exists
- scene/node/depth, mesh/primitive/vertex/triangle, materials/draw calls
- textures and resolution, animation/skin, bounds/dimensions
- scale, normals, UV state, findings, severity, observed value, and policy threshold
- Game-Ready Score and READY/NOT READY decision

## v1 optimization allowlist

Only apply operations that are explicit, safe, and independently re-checkable:

- prune empty nodes
- dedupe identical materials
- clean the allowlisted metadata fields

Create a new file for every output. Never mutate the input. Parse and inspect the output again, then include source/output hashes and before/after digests in the Passport.

## Surface parity matrix

| Surface | Entry point | Must call |
| --- | --- | --- |
| Sites Web | `app/components/ClunkInspector.tsx` and API routes | Core-backed web flow |
| CLI | `scripts/clunk-cli.ts` | Core directly |
| MCP | `integrations/mcp/server.ts` | Core through stdio JSON-RPC |
| VS Code | `integrations/vscode/src/extension.ts` | CLI/Core contract |

Same input plus same policy must produce the same canonical digest across the matrix. Differences in transport or presentation are acceptable; differences in evidence are not.

## Safety and storage

The browser processes original bytes locally by default. D1 stores user/workspace-scoped metadata, reports, runs, Passport records, and the demo credit ledger, not original file bytes. Authenticated API routes require the Sites ChatGPT SIWC headers and must reject missing or cross-workspace access.
