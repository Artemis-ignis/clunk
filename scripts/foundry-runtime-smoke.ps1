param(
  [string]$BaseUrl = "http://localhost:3109"
)

$ErrorActionPreference = "Stop"
$BaseUrl = $BaseUrl.TrimEnd("/")
$nonce = [Guid]::NewGuid().ToString("N")
$headers = @{
  "oai-authenticated-user-id" = "clunk-runtime-smoke-$nonce"
  "oai-authenticated-user-email" = "clunk-runtime-smoke@example.invalid"
  "oai-authenticated-user-full-name" = "Clunk Runtime Smoke"
  "Origin" = $BaseUrl
  "Referer" = "$BaseUrl/studio"
}

Add-Type -AssemblyName System.Net.Http
$client = New-Object System.Net.Http.HttpClient

function New-ClunkRequest {
  param(
    [string]$Uri,
    [string]$Method,
    [hashtable]$RequestHeaders,
    [string]$Body
  )

  $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($Method), $Uri)
  foreach ($header in $RequestHeaders.GetEnumerator()) {
    [void]$request.Headers.TryAddWithoutValidation([string]$header.Key, [string]$header.Value)
  }
  if (-not [string]::IsNullOrEmpty($Body)) {
    $request.Content = [System.Net.Http.StringContent]::new($Body, [System.Text.Encoding]::UTF8, "application/json")
  }
  return $request
}

function Read-JsonResponse {
  param(
    [string]$Uri,
    [ValidateSet("GET", "POST")]
    [string]$Method = "GET",
    [hashtable]$RequestHeaders = $headers,
    [string]$Body
  )

  $request = New-ClunkRequest -Uri $Uri -Method $Method -RequestHeaders $RequestHeaders -Body $Body
  $response = $client.SendAsync($request).GetAwaiter().GetResult()
  $content = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  $payload = $null
  if ($content) {
    $payload = $content | ConvertFrom-Json
  }
  return [pscustomobject]@{ response = [pscustomobject]@{ StatusCode = [int]$response.StatusCode; Content = $content }; payload = $payload }
}

$projectBody = (@{
  name = "Clunk runtime smoke $nonce"
  description = "local runtime verification"
} | ConvertTo-Json -Compress)
$projectResult = Read-JsonResponse -Uri "$BaseUrl/api/projects" -Method Post -Body $projectBody
if ($projectResult.response.StatusCode -ne 200 -or -not $projectResult.payload.ok) {
  throw "projects POST failed with HTTP $($projectResult.response.StatusCode)."
}
$projectId = [string]$projectResult.payload.project.id

$seriesBody = (@{
  operation = "create"
  seriesId = "sprite-lab"
  assetKind = "sprite-atlas"
  label = "Clunk runtime smoke sprite"
  prompt = "a compact teal courier sprite with a readable silhouette"
  targetProfileId = "yeongheo-pixi-2d"
  frames = 4
  width = 384
  height = 96
  license = "creator-owned"
  projectId = $projectId
} | ConvertTo-Json -Compress)
$seriesResult = Read-JsonResponse -Uri "$BaseUrl/api/series" -Method Post -Body $seriesBody
if ($seriesResult.response.StatusCode -ne 200 -or -not $seriesResult.payload.ok) {
  throw "series POST failed with HTTP $($seriesResult.response.StatusCode)."
}
$assetId = [string]$seriesResult.payload.assetId
$entry = @($seriesResult.payload.artifacts | Where-Object { $_.role -eq "entry" }) | Select-Object -First 1
if ($null -eq $entry) { throw "series response did not include an entry artifact." }

$generationResult = Read-JsonResponse -Uri "$BaseUrl/api/generation"
if ($generationResult.response.StatusCode -ne 200 -or -not $generationResult.payload.ok) {
  throw "generation GET failed with HTTP $($generationResult.response.StatusCode)."
}
$assetResult = Read-JsonResponse -Uri "$BaseUrl/api/assets/$assetId"
if ($assetResult.response.StatusCode -ne 200 -or -not $assetResult.payload.ok) {
  throw "asset GET failed with HTTP $($assetResult.response.StatusCode)."
}

$remixBody = (@{
  operation = "remix"
  sourceAssetId = $assetId
  seriesId = "sprite-lab"
  assetKind = "sprite-atlas"
  label = "Clunk runtime smoke remix"
  prompt = "same courier silhouette, amber utility jacket, readable player-facing contrast"
  targetProfileId = "yeongheo-pixi-2d"
  frames = 4
  width = 384
  height = 96
  license = "creator-owned"
  projectId = $projectId
} | ConvertTo-Json -Compress)
$remixResult = Read-JsonResponse -Uri "$BaseUrl/api/series" -Method Post -Body $remixBody
if ($remixResult.response.StatusCode -ne 200 -or -not $remixResult.payload.ok) {
  throw "series remix POST failed with HTTP $($remixResult.response.StatusCode)."
}
$remixAssetId = [string]$remixResult.payload.assetId
$remixAssetResult = Read-JsonResponse -Uri "$BaseUrl/api/assets/$remixAssetId"
if ($remixAssetResult.response.StatusCode -ne 200 -or -not $remixAssetResult.payload.ok) {
  throw "remix asset GET failed with HTTP $($remixAssetResult.response.StatusCode)."
}
$remixRecipe = $null
if ($remixAssetResult.payload.generation.recipeJson) {
  $remixRecipe = [string]$remixAssetResult.payload.generation.recipeJson | ConvertFrom-Json
}

$downloadPath = Join-Path ([System.IO.Path]::GetTempPath()) ("clunk-runtime-smoke-" + $nonce + ".bin")
try {
  $fileQuery = [Uri]::EscapeDataString([string]$entry.fileName)
  $downloadRequest = New-ClunkRequest -Uri "$BaseUrl/api/assets/$assetId`?file=$fileQuery&download=1" -Method "GET" -RequestHeaders $headers
  $downloadHttpResponse = $client.SendAsync($downloadRequest).GetAwaiter().GetResult()
  $downloadBytes = $downloadHttpResponse.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
  [System.IO.File]::WriteAllBytes($downloadPath, $downloadBytes)
  $downloadResponse = [pscustomobject]@{ StatusCode = [int]$downloadHttpResponse.StatusCode; Headers = $downloadHttpResponse.Headers }
  if ($downloadResponse.StatusCode -ne 200) {
    throw "artifact download failed with HTTP $($downloadResponse.StatusCode)."
  }
  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  try {
    $downloadHash = -join ($sha256.ComputeHash([System.IO.File]::ReadAllBytes($downloadPath)) | ForEach-Object { $_.ToString("x2") })
  } finally {
    $sha256.Dispose()
  }
} finally {
  if (Test-Path -LiteralPath $downloadPath) {
    Remove-Item -LiteralPath $downloadPath -Force
  }
}

[pscustomobject]@{
  ok = $true
  projectStatus = $projectResult.response.StatusCode
  seriesStatus = $seriesResult.response.StatusCode
  generationStatus = $generationResult.response.StatusCode
  assetStatus = $assetResult.response.StatusCode
  downloadStatus = $downloadResponse.StatusCode
  projectId = $projectId
  seriesProjectId = [string]$seriesResult.payload.projectId
  assetProjectId = [string]$assetResult.payload.generation.projectId
  projectLinked = ($seriesResult.payload.projectId -eq $projectId -and $assetResult.payload.generation.projectId -eq $projectId)
  operation = $seriesResult.payload.operation
  storageStatus = $seriesResult.payload.storageStatus
  artifactCount = @($seriesResult.payload.artifacts).Count
  entryShaMatches = ($downloadHash -eq ([string]$entry.sha256).ToLowerInvariant() -and [string]($downloadResponse.Headers.GetValues("x-clunk-sha256") | Select-Object -First 1) -eq ([string]$entry.sha256))
  remixStatus = $remixResult.response.StatusCode
  remixAssetDifferent = ($remixAssetId -ne $assetId)
  remixSourceLinked = ($remixResult.payload.sourceAssetId -eq $assetId -and $remixRecipe.sourceAssetId -eq $assetId -and $remixResult.payload.sourceHash -eq $assetResult.payload.asset.sha256)
} | ConvertTo-Json -Compress
