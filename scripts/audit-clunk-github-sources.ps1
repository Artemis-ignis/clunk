[CmdletBinding()]
param(
  [string]$SourceRoot = "C:\Users\50106\Documents\Codex\clunk-github-sources-20260828",
  [switch]$CloneMissing
)

$ErrorActionPreference = "Stop"

$sourceSpecs = @(
  [pscustomobject]@{
    id = "gltf-transform"
    repository = "https://github.com/donmccurdy/glTF-Transform"
    commit = "e9feb829f071f6febfb68707ffc3146502325b34"
    integration = "adapted"
    licenseRequired = $true
  },
  [pscustomobject]@{
    id = "meshoptimizer"
    repository = "https://github.com/zeux/meshoptimizer"
    commit = "bf38bbcd760aeb82c7066360913302563e22d082"
    integration = "adapted"
    licenseRequired = $true
  },
  [pscustomobject]@{
    id = "material-maker"
    repository = "https://github.com/RodZill4/material-maker"
    commit = "ad19fcf0ee34a7caf74df709dc4de7112f0d467d"
    integration = "adapted"
    licenseRequired = $true
  },
  [pscustomobject]@{
    id = "real-esrgan"
    repository = "https://github.com/xinntao/Real-ESRGAN"
    commit = "a4abfb2979a7bbff3f69f58f58ae324608821e27"
    integration = "adapted"
    licenseRequired = $true
  },
  [pscustomobject]@{
    id = "blender-mcp-headless"
    repository = "https://github.com/digitable-lol/blender-mcp"
    commit = "ae010efa2a3f3d799ef1074d7cd3d9a7f36a0118"
    integration = "adapted"
    licenseRequired = $true
  },
  [pscustomobject]@{
    id = "trellis2"
    repository = "https://github.com/microsoft/TRELLIS.2"
    commit = "75fbf0183001ed9876c8dbb35de6b68552ee08bd"
    integration = "research-only"
    licenseRequired = $true
  },
  [pscustomobject]@{
    id = "sprite-sheet-creator"
    repository = "https://github.com/blendi-remade/sprite-sheet-creator"
    commit = "4e0eeb413fc0ee1b3650957f47eb187dd4bdbf2d"
    integration = "excluded-license"
    licenseRequired = $false
  }
)

function Invoke-GitAt {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  $output = & git -C $Path @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw (($output | Out-String).Trim())
  }
  return (($output | Out-String).Trim())
}

if ($CloneMissing) {
  New-Item -ItemType Directory -Force -Path $SourceRoot | Out-Null
}

$results = foreach ($spec in $sourceSpecs) {
  $path = Join-Path -Path $SourceRoot -ChildPath $spec.id
  $exists = Test-Path -LiteralPath $path -PathType Container
  $cloned = $false
  $cloneError = $null

  if (-not $exists -and $CloneMissing) {
    try {
      & git clone $spec.repository $path 2>&1 | Out-Null
      if ($LASTEXITCODE -ne 0) {
        throw "git clone exited with code $LASTEXITCODE"
      }
      Invoke-GitAt -Path $path -Arguments @("checkout", "--detach", $spec.commit) | Out-Null
      $exists = $true
      $cloned = $true
    } catch {
      $cloneError = $_.Exception.Message
    }
  }

  $head = $null
  $gitError = $null
  if ($exists) {
    try {
      $head = Invoke-GitAt -Path $path -Arguments @("rev-parse", "HEAD")
    } catch {
      $gitError = $_.Exception.Message
    }
  }

  $licenseFiles = @()
  if ($exists) {
    $licenseFiles = @(Get-ChildItem -LiteralPath $path -File -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -match "^(LICENSE|LICENCE|COPYING|NOTICE)(\..*)?$" } |
      Select-Object -ExpandProperty Name)
  }

  $pinned = $exists -and ($head -eq $spec.commit)
  $licenseFound = $licenseFiles.Count -gt 0
  $status = if (-not $exists) {
    "MISSING"
  } elseif ($gitError) {
    "NOT_A_GIT_CHECKOUT"
  } elseif (-not $pinned) {
    "PIN_MISMATCH"
  } elseif ($spec.licenseRequired -and -not $licenseFound) {
    "LICENSE_MISSING"
  } elseif (-not $spec.licenseRequired -and -not $licenseFound) {
    "EXCLUDED_LICENSE"
  } else {
    "PASS"
  }

  [pscustomobject]@{
    id = $spec.id
    repository = $spec.repository
    path = $path
    expectedCommit = $spec.commit
    head = $head
    integration = $spec.integration
    exists = $exists
    clonedThisRun = $cloned
    pinned = $pinned
    licenseFiles = $licenseFiles
    licenseFound = $licenseFound
    licenseRequired = $spec.licenseRequired
    status = $status
    error = if ($cloneError) { $cloneError } elseif ($gitError) { $gitError } else { $null }
  }
}

$ok = ($results | Where-Object { $_.status -notin @("PASS", "EXCLUDED_LICENSE") }).Count -eq 0
[pscustomobject]@{
  schemaVersion = 1
  checkedAt = [DateTime]::UtcNow.ToString("o")
  sourceRoot = $SourceRoot
  cloneMissingRequested = [bool]$CloneMissing
  ok = $ok
  sources = @($results)
} | ConvertTo-Json -Depth 6

if (-not $ok) { exit 1 }
