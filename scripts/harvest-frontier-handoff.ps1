[CmdletBinding()]
param(
  [Parameter()]
  [string]$HarvestRoot = 'C:\Users\50106\Desktop\Harvest Frontier',

  [Parameter()]
  [string]$OutputPath
)

$ErrorActionPreference = 'Stop'

$clunkRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$runtimeRoot = Join-Path $HarvestRoot 'public\assets\runtime'
$tsxEntrypoint = Join-Path $clunkRoot 'node_modules\tsx\dist\cli.mjs'
$cliEntrypoint = Join-Path $clunkRoot 'scripts\clunk-cli.ts'

if (-not (Test-Path -LiteralPath $runtimeRoot -PathType Container)) {
  throw "Harvest Frontier runtime asset directory was not found: $runtimeRoot"
}
if (-not (Test-Path -LiteralPath $tsxEntrypoint -PathType Leaf)) {
  throw "Clunk tsx entrypoint was not found: $tsxEntrypoint"
}

$node = (Get-Command node.exe -ErrorAction Stop).Source
$assets = Get-ChildItem -LiteralPath $runtimeRoot -Filter '*.glb' -File | Sort-Object Name
if ($assets.Count -eq 0) {
  throw "No Harvest Frontier runtime GLB files were found: $runtimeRoot"
}

$records = foreach ($asset in $assets) {
  $hash = (Get-FileHash -LiteralPath $asset.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  $inspectionText = (& $node $tsxEntrypoint $cliEntrypoint inspect $asset.FullName --profile pc 2>&1 | Out-String).Trim()
  if ($LASTEXITCODE -ne 0) {
    throw "Clunk inspection failed for $($asset.Name): $inspectionText"
  }
  try {
    $inspection = $inspectionText | ConvertFrom-Json
  } catch {
    throw "Clunk inspection did not return JSON for $($asset.Name): $inspectionText"
  }

  [ordered]@{
    fileName = $asset.Name
    sourcePath = $asset.FullName
    bytes = $asset.Length
    sha256 = $hash
    clunkInspection = $inspection
  }
}

$manifest = [ordered]@{
  schemaVersion = 1
  generatedAt = (Get-Date).ToUniversalTime().ToString('o')
  sourceProject = (Resolve-Path -LiteralPath $HarvestRoot).Path
  runtimeRoot = (Resolve-Path -LiteralPath $runtimeRoot).Path
  readOnly = $true
  optimizerAllowed = $false
  clunkProfile = 'pc'
  ruleSetId = 'clunk-game-ready-v1'
  assets = @($records)
  collaborationBoundary = @(
    'Harvest Frontier remains the source of truth for semantic nodes, pivots, sockets, colliders, LOD, Meshopt, quantization, and gameplay validation.',
    'This runner reads GLB bytes and invokes Clunk inspect only; it never writes to Harvest Frontier and never runs Clunk optimize.',
    'A changed SHA-256 requires a new inspection and must not reuse an earlier Passport or application evidence.'
  )
}

$json = $manifest | ConvertTo-Json -Depth 50
if ($OutputPath) {
  $resolvedOutput = if ([System.IO.Path]::IsPathRooted($OutputPath)) {
    [System.IO.Path]::GetFullPath($OutputPath)
  } else {
    [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputPath))
  }
  $parent = Split-Path -Parent $resolvedOutput
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
  $fileJson = ($json -replace "`r`n", "`n") + "`n"
  [System.IO.File]::WriteAllText($resolvedOutput, $fileJson, [System.Text.UTF8Encoding]::new($false))
  Write-Output "Wrote read-only Harvest Frontier handoff: $resolvedOutput"
}

Write-Output $json
