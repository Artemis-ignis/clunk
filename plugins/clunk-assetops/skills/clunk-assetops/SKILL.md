---
name: clunk-assetops
description: Build or operate Clunk's evidence-first Game AssetOps workflow across Sites Web, CLI, MCP, and VS Code when real GLB/GLTF bytes, deterministic reports, safe optimization, or Passport evidence are involved.
---

# Clunk AssetOps

Use this skill when a task touches Clunk's asset inspection, Game-Ready Score, allowlisted optimization, Passport evidence, or any adapter surface. Keep the Core contract as the only analysis authority.

## Product invariants

- Start from real GLB/GLTF bytes. Record filename, format, byte size, SHA-256, policy, findings, score, and deterministic result digest.
- Never overwrite an input. Optimization must create a separate artifact, parse it again, and fresh-reinspect it before reporting success or READY.
- Do not invent metrics, customer proof, performance claims, or screenshots. A UI screenshot is evidence only when it came from a real run.
- Treat an unknown extension, animation, skin, texture rewrite, mesh simplification, Draco/Meshopt compression, and quantization as outside the v1 automatic allowlist unless the policy explicitly changes.
- Keep credits and stored runs workspace-scoped. Do not trust a client-supplied userId; Sites SIWC headers are the authentication boundary.

## Surface routing

Use the same functions and envelope across surfaces. The implementation authority is `packages/core/src/index.ts` and its contracts. Web/Sites calls the browser-facing adapter, CLI calls `scripts/clunk-cli.ts`, MCP calls `integrations/mcp/server.ts`, and VS Code calls `integrations/vscode/src/extension.ts`. Never create a second parser or scoring algorithm in an adapter.

Read [the surface contract](references/core-contract.md) before changing an adapter or adding a new one.

## Asset authoring and provenance

For Clunk-owned reference-to-Three.js asset work, use the installed `Clunk Asset Forge` as the single entry point. The upstream `img2threejs` checkout is implementation source only. Do not use the Harvest Frontier wrapper as a Clunk authoring path. Record source/reference role, license, generated/imported status, and hash for every sample.

## Frontend quality gate

For landing, login, pricing, and product presentation work, apply the installed `design-taste-frontend` v2 skill audit-first. Keep one coherent theme, typography/radius/accent system, accessible focus and contrast, deliberate motion, and explicit mobile collapse. Use ImageGen only for a purposeful raster asset such as an OG card or product hero; never generate a fake score, finding, metric, or Passport screenshot. Inspect any generated asset and keep its provenance.

## Windows execution

Use PowerShell and Windows commands only. Do not call WSL, `bash.exe`, or shell initializers. Keep source/config UTF-8 with LF and PowerShell/command files with their declared Windows line endings. For browser QA or servers, use hidden noninteractive processes so the user's desktop is not interrupted.

## Verification

Before handoff, run the smallest relevant checks and then the full gate when source changed:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run api:smoke
npm.cmd run site:preflight
npm.cmd run build --prefix integrations\vscode
```

For a new surface, verify canonical parity (`coreBuildId`, `ruleSetId`, `inputHash`, `resultDigest`) against CLI and MCP, and reopen a downloaded GLB independently. Do not mark the product complete while private Sites deployment or deployed-browser authentication remains unverified.
