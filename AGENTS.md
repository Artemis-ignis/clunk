# Clunk repository operating rules

## Runtime

- Windows PowerShell/pwsh is the supported execution environment.
- Do not call WSL, `bash.exe`, or the Sites `.sh` initializer from this project.
- Use `npm.cmd`, `npx.cmd`, the bundled Windows Node/Python paths when available, and
  `scripts/site-init.ps1` for future starter initialization.
- Keep source text UTF-8. Source/config files use LF; PowerShell and Windows command files use
  CRLF as declared in `.gitattributes` and `.editorconfig`.

## Product truth

- Clunk's evidence starts from real GLB/GLTF bytes, input hash, declared rule set, and a fresh
  reinspection of every generated artifact.
- Never substitute mock metrics, a fixture-only PASS, or a screenshot for a real artifact result.
- Never overwrite an input asset during optimization; output and Passport files are separate.
- Do not call an asset READY unless parse, policy, optimize, fresh recheck, blocker, score, and
  downloaded-artifact reopen gates are all recorded.

## Asset authoring

- Use the installed `Clunk Asset Forge` plugin as the single Clunk reference-to-Three.js entry
  point. The upstream `img2threejs` checkout is implementation source; the Harvest Frontier
  wrapper is not a Clunk workflow.
- Record provenance, license, prompt/reference role, and hashes for every generated or imported
  sample.
