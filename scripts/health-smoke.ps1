[CmdletBinding()]
param(
  [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
$BaseUrl = $BaseUrl.TrimEnd("/")

Add-Type -AssemblyName System.Net.Http
$client = [System.Net.Http.HttpClient]::new()
try {
  $response = $client.GetAsync("$BaseUrl/api/health").GetAwaiter().GetResult()
  $content = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  $payload = $content | ConvertFrom-Json
  $runtimeReady = $payload.runtime.db -eq "configured" -and $payload.runtime.assets -eq "configured"
  $ok = [int]$response.StatusCode -eq 200 -and $payload.schema -eq "clunk.health.v1" -and $payload.ok -eq $true -and $runtimeReady
  [pscustomobject]@{
    ok = $ok
    url = "$BaseUrl/api/health"
    httpStatus = [int]$response.StatusCode
    schema = [string]$payload.schema
    status = [string]$payload.status
    runtime = $payload.runtime
  } | ConvertTo-Json -Compress -Depth 8
  if (-not $ok) { exit 1 }
} finally {
  $client.Dispose()
}
