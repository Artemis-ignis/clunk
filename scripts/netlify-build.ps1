[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$env:NITRO_PRESET = 'netlify'
npm.cmd run build:netlify

$required = @(
  (Join-Path (Get-Location) 'dist'),
  (Join-Path (Get-Location) '.netlify\functions-internal')
)
$missing = @($required | Where-Object { -not (Test-Path -LiteralPath $_ -PathType Container) })
if ($missing.Count -gt 0) {
  throw "Netlify Nitro build completed without required output: $($missing -join ', ')"
}
