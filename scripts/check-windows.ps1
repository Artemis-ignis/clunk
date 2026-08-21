[CmdletBinding()]
param(
  [string] $ProjectRoot = (Get-Location).Path
)

$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$root = [System.IO.Path]::GetFullPath($ProjectRoot)
$checks = [ordered]@{}
$checks.PowerShell = $PSVersionTable.PSVersion.ToString()
$checks.WSLIndicators = [bool]($env:WSL_DISTRO_NAME -or $env:WSL_INTEROP -or $env:WSLENV)
$checks.Node = (Get-Command node -ErrorAction SilentlyContinue).Source
$checks.Npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
$checks.Python = (Get-Command python -ErrorAction SilentlyContinue).Source
$checks.Workspace = $root

if ($checks.WSLIndicators) { throw 'WSL environment detected; Clunk requires PowerShell.' }
if (-not $checks.Node -or -not $checks.Npm) { throw 'Windows Node.js and npm.cmd are required.' }

$bad = @()
$textExtensions = @('.ts', '.tsx', '.mjs', '.mts', '.json', '.jsonl', '.css', '.md')
Get-ChildItem -LiteralPath $root -Recurse -File -Force | Where-Object {
  $_.FullName -notmatch '\\node_modules\\|\\.git\\|\\dist\\|\\.next\\' -and
  $textExtensions -contains $_.Extension.ToLowerInvariant()
} | ForEach-Object {
  $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
  if ($bytes -contains 0) { return }
  $text = [System.Text.Encoding]::UTF8.GetString($bytes)
  if ($text.Contains("`r`n")) { $bad += $_.FullName }
}

if ($bad.Count -gt 0) {
  $bad | ForEach-Object { Write-Output "CRLF source file: $_" }
  throw 'Source files must use UTF-8 LF. PowerShell files are intentionally excluded from this check.'
}

$checks | ConvertTo-Json -Compress
