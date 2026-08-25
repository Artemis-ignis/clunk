[CmdletBinding()]
param(
  [switch]$Build
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$checks = [System.Collections.Generic.List[object]]::new()

function Add-Check([string]$Name, [bool]$Pass, [string]$Detail) {
  $checks.Add([ordered]@{ name = $Name; pass = $Pass; detail = $Detail })
}

Add-Check 'netlify-config' (Test-Path -LiteralPath (Join-Path $root 'netlify.toml') -PathType Leaf) 'Committed Netlify build contract exists.'
Add-Check 'nitro-dependency' (Test-Path -LiteralPath (Join-Path $root 'node_modules\nitro') -PathType Container) 'Vinext is paired with Nitro for the Netlify target.'
Add-Check 'auth-boundary' $false 'Current workspace auth and D1 data still depend on Cloudflare/Sites bindings; Google/GitHub Netlify Identity migration is not claimed until a Netlify site and backend are linked.'

if ($Build) {
  Push-Location $root
  try {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'scripts\netlify-build.ps1')
    Add-Check 'netlify-public-output' (Test-Path -LiteralPath (Join-Path $root 'dist') -PathType Container) 'Nitro public output exists.'
    Add-Check 'netlify-function-output' (Test-Path -LiteralPath (Join-Path $root '.netlify\functions-internal') -PathType Container) 'Netlify server function output exists.'
  } finally {
    Pop-Location
  }
}

$result = [ordered]@{
  schemaVersion = 1
  checkedAt = (Get-Date).ToUniversalTime().ToString('o')
  ok = (@($checks | Where-Object { -not $_.pass }).Count -eq 0)
  checks = @($checks)
}
$result | ConvertTo-Json -Depth 8
if (-not $result.ok) { exit 2 }
