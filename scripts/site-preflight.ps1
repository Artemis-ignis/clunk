[CmdletBinding()]
param(
  [Parameter()]
  [string]$ProjectRoot
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = Join-Path $PSScriptRoot '..'
}
$root = (Resolve-Path -LiteralPath $ProjectRoot).Path
$hostingPath = Join-Path $root '.openai\hosting.json'
$distRoot = Join-Path $root 'dist'

if (-not (Test-Path -LiteralPath $hostingPath -PathType Leaf)) {
  throw "Sites hosting metadata was not found: $hostingPath"
}

$hosting = Get-Content -Raw -LiteralPath $hostingPath | ConvertFrom-Json
$checks = @(
  [ordered]@{
    name = 'source-hosting-json'
    path = $hostingPath
    pass = ($hosting.d1 -eq 'DB' -and $hosting.r2 -eq 'ASSETS')
    detail = 'D1 binding DB and R2 binding ASSETS are declared for product metadata and artifact bytes.'
  },
  [ordered]@{
    name = 'worker-entry'
    path = (Join-Path $distRoot 'server\index.js')
    pass = (Test-Path -LiteralPath (Join-Path $distRoot 'server\index.js') -PathType Leaf)
    detail = 'Cloudflare Worker-compatible server entry exists.'
  },
  [ordered]@{
    name = 'built-hosting-json'
    path = (Join-Path $distRoot '.openai\hosting.json')
    pass = (Test-Path -LiteralPath (Join-Path $distRoot '.openai\hosting.json') -PathType Leaf)
    detail = 'Built output carries Sites hosting metadata.'
  },
  [ordered]@{
    name = 'built-static-assets'
    path = (Join-Path $distRoot 'client')
    pass = (Test-Path -LiteralPath (Join-Path $distRoot 'client') -PathType Container)
    detail = 'Built client assets exist.'
  },
  [ordered]@{
    name = 'built-d1-migrations'
    path = (Join-Path $distRoot '.openai\drizzle')
    pass = ((Test-Path -LiteralPath (Join-Path $distRoot '.openai\drizzle') -PathType Container) -and (@(Get-ChildItem -LiteralPath (Join-Path $distRoot '.openai\drizzle') -Filter '*.sql' -File).Count -gt 0))
    detail = 'At least one D1 migration is staged in the built output.'
  }
)

$result = [ordered]@{
  schemaVersion = 1
  checkedAt = (Get-Date).ToUniversalTime().ToString('o')
  projectRoot = $root
  ok = (@($checks | Where-Object { -not $_.pass }).Count -eq 0)
  checks = @($checks)
}

$json = $result | ConvertTo-Json -Depth 10
Write-Output $json
if (-not $result.ok) { exit 1 }
