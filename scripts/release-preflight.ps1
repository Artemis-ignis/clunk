[CmdletBinding()]
param(
  [string]$ProjectRoot = (Get-Location).Path,
  [switch]$Json
)

$ErrorActionPreference = "Stop"
# CLUNK_RELEASE_PREFLIGHT is intentionally fail-closed: a report with missing
# production configuration is useful evidence, but it is not a release PASS.

$envFileValues = @{}
$envFilePath = Join-Path $ProjectRoot ".dev.vars"
if (Test-Path -LiteralPath $envFilePath -PathType Leaf) {
  foreach ($line in Get-Content -LiteralPath $envFilePath) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') {
      $envFileValues[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
    }
  }
}

function Test-ConfiguredSecret {
  param([Parameter(Mandatory = $true)][string]$Name)

  $processValue = [Environment]::GetEnvironmentVariable($Name, "Process")
  if (-not [string]::IsNullOrWhiteSpace($processValue)) { return $true }
  return $envFileValues.ContainsKey($Name) -and -not [string]::IsNullOrWhiteSpace([string]$envFileValues[$Name])
}

function Add-Check {
  param(
    [Parameter(Mandatory = $true)][AllowEmptyCollection()][System.Collections.Generic.List[object]]$List,
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Status,
    [Parameter(Mandatory = $true)][string]$Detail
  )

  $List.Add([pscustomobject]@{
    name = $Name
    status = $Status
    detail = $Detail
  }) | Out-Null
}

$checks = [System.Collections.Generic.List[object]]::new()
$hostingPath = Join-Path $ProjectRoot ".openai\hosting.json"
if (-not (Test-Path -LiteralPath $hostingPath -PathType Leaf)) {
  Add-Check $checks "sites-bindings" "BLOCKED" "The active .openai/hosting.json file is missing."
} else {
  try {
    $hosting = Get-Content -Raw -LiteralPath $hostingPath | ConvertFrom-Json
    if ($hosting.d1 -eq "DB" -and $hosting.r2 -eq "ASSETS") {
      Add-Check $checks "sites-bindings" "PASS" "D1 DB and R2 ASSETS bindings are declared."
    } else {
      Add-Check $checks "sites-bindings" "BLOCKED" "The active hosting declaration must expose d1=DB and r2=ASSETS."
    }
  } catch {
    Add-Check $checks "sites-bindings" "BLOCKED" "The active hosting declaration is not valid JSON."
  }
}

$sourceAuditPath = Join-Path $ProjectRoot "scripts\audit-clunk-github-sources.ps1"
if (-not (Test-Path -LiteralPath $sourceAuditPath -PathType Leaf)) {
  Add-Check $checks "source-audit" "BLOCKED" "The pinned GitHub source audit script is missing."
} else {
  $auditExit = 1
  $auditReport = $null
  try {
    $auditOutput = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $sourceAuditPath 2>&1
    $auditExit = $LASTEXITCODE
    $auditReport = (($auditOutput | Out-String).Trim() | ConvertFrom-Json)
  } catch {
    $auditReport = $null
  }
  if ($auditExit -eq 0 -and $auditReport -and $auditReport.ok -eq $true) {
    Add-Check $checks "source-audit" "PASS" "All audited GitHub sources are pinned and license-aware."
  } else {
    Add-Check $checks "source-audit" "BLOCKED" "The pinned GitHub source audit did not pass."
  }
}

$oauthPairs = @(
  @{ id = "google"; client = "GOOGLE_CLIENT_ID"; secret = "GOOGLE_CLIENT_SECRET"; redirect = "GOOGLE_REDIRECT_URI" },
  @{ id = "github"; client = "GITHUB_CLIENT_ID"; secret = "GITHUB_CLIENT_SECRET"; redirect = "GITHUB_REDIRECT_URI" }
)
foreach ($pair in $oauthPairs) {
  $clientConfigured = Test-ConfiguredSecret $pair.client
  $secretConfigured = Test-ConfiguredSecret $pair.secret
  $redirectConfigured = Test-ConfiguredSecret $pair.redirect
  if ($clientConfigured -and $secretConfigured -and $redirectConfigured) {
    Add-Check $checks ("oauth-" + $pair.id) "PASS" "The provider client id, secret, and callback URI are configured without exposing values."
  } else {
    Add-Check $checks ("oauth-" + $pair.id) "CONFIG_REQUIRED" ("Set " + $pair.client + ", " + $pair.secret + ", and " + $pair.redirect + " in the deployment secret store.")
  }
}

$stateConfigured = Test-ConfiguredSecret "CLUNK_OAUTH_STATE_SECRET"
$sessionConfigured = Test-ConfiguredSecret "CLUNK_AUTH_SESSION_SECRET"
if ($stateConfigured -and $sessionConfigured) {
  Add-Check $checks "oauth-session-secrets" "PASS" "OAuth state and local session signing secrets are configured."
} else {
  Add-Check $checks "oauth-session-secrets" "CONFIG_REQUIRED" "Set CLUNK_OAUTH_STATE_SECRET and CLUNK_AUTH_SESSION_SECRET in the deployment secret store."
}

$billingProvider = [Environment]::GetEnvironmentVariable("CLUNK_BILLING_PROVIDER", "Process")
if ([string]::IsNullOrWhiteSpace($billingProvider) -and $envFileValues.ContainsKey("CLUNK_BILLING_PROVIDER")) {
  $billingProvider = [string]$envFileValues["CLUNK_BILLING_PROVIDER"]
}
if ($billingProvider -eq "stripe" -and (Test-ConfiguredSecret "STRIPE_SECRET_KEY") -and (Test-ConfiguredSecret "STRIPE_WEBHOOK_SECRET")) {
  Add-Check $checks "billing" "PASS" "Stripe secret and webhook signing secret are configured."
} else {
  Add-Check $checks "billing" "CONFIG_REQUIRED" "Set CLUNK_BILLING_PROVIDER=stripe, STRIPE_SECRET_KEY, and STRIPE_WEBHOOK_SECRET before enabling paid checkout."
}

if ((Test-ConfiguredSecret "TRELLIS_ENDPOINT") -and (Test-ConfiguredSecret "TRELLIS_MODEL_ID")) {
  Add-Check $checks "trellis2" "PASS" "TRELLIS.2 endpoint and model identity are configured."
} else {
  Add-Check $checks "trellis2" "CONFIG_REQUIRED" "A real TRELLIS_ENDPOINT and TRELLIS_MODEL_ID are required; no fake inference result is accepted."
}

$blenderConfigured = Test-ConfiguredSecret "BLENDER_BIN"
$blenderPath = [Environment]::GetEnvironmentVariable("BLENDER_BIN", "Process")
if ([string]::IsNullOrWhiteSpace($blenderPath) -and $envFileValues.ContainsKey("BLENDER_BIN")) {
  $blenderPath = [string]$envFileValues["BLENDER_BIN"]
}
if ($blenderConfigured -and (Test-Path -LiteralPath $blenderPath -PathType Leaf)) {
  Add-Check $checks "blender-runner" "PASS" "A real Blender executable is configured."
} else {
  Add-Check $checks "blender-runner" "CONFIG_REQUIRED" "BLENDER_BIN must point to an installed executable before runtime animation evidence can pass."
}

$artifactBuild = (Test-Path -LiteralPath (Join-Path $ProjectRoot "dist\server\index.js") -PathType Leaf) -and
  (Test-Path -LiteralPath (Join-Path $ProjectRoot "dist\client") -PathType Container)
if ($artifactBuild) {
  Add-Check $checks "artifact-build" "PASS" "The current default build contains server and client output."
} else {
  Add-Check $checks "artifact-build" "BLOCKED" "Run npm.cmd run build before attempting a release."
}

$ok = @($checks | Where-Object { $_.status -ne "PASS" }).Count -eq 0
$report = [pscustomobject]@{
  schemaVersion = 1
  checkedAt = [DateTime]::UtcNow.ToString("o")
  projectRoot = $ProjectRoot
  ok = $ok
  checks = @($checks)
}
$report | ConvertTo-Json -Depth 6

if (-not $ok) { exit 1 }
