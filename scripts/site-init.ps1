[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string] $Target = (Get-Location).Path,

  [string] $Starter = 'C:\Users\50106\.codex\plugins\cache\openai-bundled\sites\0.1.40\skills\sites-building\templates\vinext-starter',
  [switch] $SkipInstall
)

$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$targetPath = [System.IO.Path]::GetFullPath($Target)
$starterPath = [System.IO.Path]::GetFullPath($Starter)
if (-not (Test-Path -LiteralPath $starterPath -PathType Container)) {
  throw "Sites starter was not found: $starterPath"
}
if (-not (Test-Path -LiteralPath $targetPath -PathType Container)) {
  New-Item -ItemType Directory -Path $targetPath | Out-Null
}

$allowed = @('.git', '.DS_Store', 'work', 'outputs')
$content = Get-ChildItem -LiteralPath $targetPath -Force | Where-Object { $_.Name -notin $allowed }
if ($content) {
  throw "Target is not empty; refusing to overwrite: $targetPath"
}

Get-ChildItem -LiteralPath $starterPath -Force | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination $targetPath -Recurse -Force
}

if (-not (Test-Path -LiteralPath (Join-Path $targetPath '.openai\hosting.json') -PathType Leaf)) {
  throw 'Starter copy completed without .openai/hosting.json.'
}

if (-not $SkipInstall) {
  Push-Location $targetPath
  try {
    & npm.cmd ci --ignore-scripts --prefer-offline --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  } finally {
    Pop-Location
  }
}

Write-Output "Sites starter ready: $targetPath"
