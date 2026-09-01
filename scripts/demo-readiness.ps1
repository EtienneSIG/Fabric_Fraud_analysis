# Demo readiness check — reports which integrations would run live vs degrade to mock.
# Read-only. Mirrors the app's config gates (config.ts) so "what the room will see" is predictable.
#
#   ./scripts/demo-readiness.ps1 -EnvFile fabric-fraud-intelligence/.env.local -BackendUrl https://<backend>
#
# Nothing is provisioned or changed.
[CmdletBinding()]
param(
  [string]$EnvFile = 'fabric-fraud-intelligence/.env.local',
  [string]$BackendUrl
)

$ErrorActionPreference = 'Stop'

function Read-DotEnv([string]$path) {
  $map = @{}
  if (Test-Path $path) {
    foreach ($line in Get-Content -Path $path) {
      $t = $line.Trim()
      if ($t -and -not $t.StartsWith('#') -and $t.Contains('=')) {
        $k, $v = $t.Split('=', 2)
        $map[$k.Trim()] = $v.Trim().Trim('"')
      }
    }
  }
  return $map
}

function Val([hashtable]$envMap, [string]$key) {
  if ($envMap.ContainsKey($key) -and $envMap[$key]) { return $envMap[$key] }
  $proc = [Environment]::GetEnvironmentVariable($key)
  if ($proc) { return $proc }
  return ''
}

$envMap = Read-DotEnv $EnvFile
function IsFlag([string]$k) { return (Val $envMap $k).ToLower() -eq 'true' }

$mode = Val $envMap 'VITE_FABRIC_APP_MODE'
$dataAgent = (Val $envMap 'VITE_FABRIC_DATA_AGENT_ID'); if (-not $dataAgent) { $dataAgent = Val $envMap 'VITE_RAYFIN_DATA_AGENT_ID' }
$backend = if ($BackendUrl) { $BackendUrl } else { Val $envMap 'VITE_BACKEND_API_URL' }
$student = Val $envMap 'VITE_RAFT_STUDENT_DEPLOYMENT'

$isMock = ($mode -ne 'fabric') -or (-not $dataAgent)
$backendReady = (-not $isMock) -and [bool]$backend

$features = [ordered]@{
  'Fabric data (NL2SQL grounding)' = -not $isMock
  'Foundry agents'                 = $backendReady -and (IsFlag 'VITE_FOUNDRY_ENABLED')
  'RAFT A/B + eval'                = $backendReady -and (IsFlag 'VITE_RAFT_ENABLED') -and [bool]$student
  'Work IQ (O365 signals)'         = $backendReady -and (IsFlag 'VITE_WORKIQ_ENABLED')
  'Teams notifications'            = $backendReady -and (IsFlag 'VITE_TEAMS_ENABLED')
}

"RAFT / Fabric demo readiness"
"  env file : $EnvFile" + $(if (Test-Path $EnvFile) { '' } else { '  (not found - reading process env only)' })
"  app mode : $mode" + $(if ($isMock) { '  -> MOCK (offline-safe)' } else { '  -> fabric' })
"  backend  : " + $(if ($backend) { $backend } else { '(none)' })
""
$live = 0
foreach ($k in $features.Keys) {
  $on = [bool]$features[$k]
  if ($on) { $live++ }
  "  [{0}] {1}" -f $(if ($on) { 'LIVE' } else { 'mock' }), $k
}
""

# Optional live probe: does the backend actually expose the RAFT eval route?
if ($backend) {
  $uri = "$($backend.TrimEnd('/'))/api/raft/eval"
  try {
    $r = Invoke-WebRequest -Method Get -Uri $uri -TimeoutSec 8 -UseBasicParsing -SkipHttpErrorCheck
    $note = if ($r.StatusCode -eq 200) { ' (route present)' } else { ' (missing/error -> app uses sample)' }
    "  probe GET /api/raft/eval -> HTTP $($r.StatusCode)$note"
  }
  catch {
    "  probe GET /api/raft/eval -> unreachable ($($_.Exception.Message)) -> app uses sample"
  }
  ""
}

$overall = if ($live -eq 0) { 'DEMO / MOCK (fully offline, deterministic)' }
elseif ($live -eq $features.Count) { 'LIVE (all integrations wired)' }
else { "PARTIAL LIVE ($live/$($features.Count) integrations)" }
"Overall: $overall"
"Anything not wired degrades gracefully to mock; the UI marks it with the header mode badge + per-panel Simulated/sample labels."
