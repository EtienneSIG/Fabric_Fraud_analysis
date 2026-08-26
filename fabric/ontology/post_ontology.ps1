param(
  [Parameter(Mandatory=$true)][string]$Ws,
  [Parameter(Mandatory=$true)][string]$TenantId,
  [string]$RayfinProjectRoot = (Join-Path $PSScriptRoot "..\..\fabric-fraud-intelligence"),
  [string]$Body = "$PSScriptRoot\create_body.json"
)

$ErrorActionPreference = "Stop"
$authModule = Join-Path $RayfinProjectRoot "node_modules\@microsoft\rayfin-cli\dist\auth\index.js"
if (-not (Test-Path $authModule)) {
  throw "Rayfin authentication module not found at $authModule. Run npm install in $RayfinProjectRoot."
}

$tokenScript = @'
import { pathToFileURL } from "node:url";

const [authModule, tenantId] = process.argv.slice(1);
const { getAuthenticatedToken } = await import(pathToFileURL(authModule).href);
const result = await getAuthenticatedToken(undefined, { tenantId });
const payload = JSON.parse(Buffer.from(result.token.split(".")[1], "base64url").toString("utf8"));

if (payload.tid !== tenantId) {
  throw new Error(`Rayfin token tenant ${payload.tid} does not match target tenant ${tenantId}.`);
}

console.log(`__RAYFIN_TOKEN__${result.token}`);
'@

$tokenOutput = @(& node --input-type=module -e $tokenScript $authModule $TenantId 2>&1)
if ($LASTEXITCODE -ne 0) {
  throw "Rayfin authentication failed: $($tokenOutput -join [Environment]::NewLine)"
}

$tokenLine = $tokenOutput | Where-Object { "$_".StartsWith("__RAYFIN_TOKEN__") } | Select-Object -Last 1
if (-not $tokenLine) {
  throw "Rayfin authentication did not return a Fabric token. Run 'rayfin login --tenant $TenantId' from $RayfinProjectRoot."
}
$tok = "$tokenLine".Substring("__RAYFIN_TOKEN__".Length)
$H = @{ Authorization = "Bearer $tok"; "Content-Type" = "application/json" }
$json = Get-Content -Raw -Path $Body
$itemDefinition = $json | ConvertFrom-Json

function Write-ExistingOntology {
  $items = @()
  $uri = "https://api.fabric.microsoft.com/v1/workspaces/$Ws/items"
  do {
    $page = Invoke-RestMethod -Uri $uri -Headers $H
    $items += @($page.value)
    $uri = $page.continuationUri
  } while ($uri)

  $ontology = $items |
    Where-Object { $_.displayName -eq $itemDefinition.displayName -and $_.type -eq "Ontology" } |
    Select-Object -First 1
  if (-not $ontology) {
    throw "Fabric reported that '$($itemDefinition.displayName)' already exists, but no matching Ontology was returned by the workspace items API."
  }

  "STATUS=EXISTS"
  "ONTOLOGY_ID=$($ontology.id)"
  "ONTOLOGY_URL=https://app.fabric.microsoft.com/groups/$Ws/ontologies/$($ontology.id)?ctid=$TenantId"
}

try {
  $r = Invoke-WebRequest -Method Post -Uri "https://api.fabric.microsoft.com/v1/workspaces/$Ws/items" -Headers $H -Body $json -UseBasicParsing
  "STATUS=$($r.StatusCode)"
  if ($r.StatusCode -eq 201) {
    "ONTOLOGY_ID=" + ($r.Content | ConvertFrom-Json).id
  }
  elseif ($r.StatusCode -eq 202) {
    $loc = $r.Headers['Location']; if ($loc -is [array]) { $loc = $loc[0] }
    "OPERATION=$loc"
    for ($i = 0; $i -lt 40; $i++) {
      Start-Sleep -Seconds 6
      $op = Invoke-RestMethod -Uri $loc -Headers $H
      "[$i] $($op.status)"
      if ($op.status -in @("Succeeded", "Failed")) {
        if ($op.status -eq "Succeeded") {
          $res = Invoke-RestMethod -Uri "$loc/result" -Headers $H
          "ONTOLOGY_ID=" + $res.id
        } else {
          $op | ConvertTo-Json -Depth 8
        }
        break
      }
    }
  }
}
catch {
  if ($_.Exception.Response.StatusCode -eq 409) {
    Write-ExistingOntology
    return
  }
  "ERROR: $($_.Exception.Message)"
  if ($_.ErrorDetails) { $_.ErrorDetails.Message }
  elseif ($_.Exception.Response) {
    $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $sr.ReadToEnd()
  }
}
