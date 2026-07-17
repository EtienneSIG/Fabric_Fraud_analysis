param(
  [string]$Ws = "d451f521-7e87-408f-8208-61928f1b84e3",
  [string]$Py = "$PSScriptRoot\load_app_data.py",
  [string]$Name = "load_app_data"
)

$ErrorActionPreference = "Stop"

# 1. Create the notebook item (bound to fraud_lakehouse)
$tok = az account get-access-token --resource "https://api.fabric.microsoft.com" --query accessToken -o tsv
$H = @{ Authorization = "Bearer $tok"; "Content-Type" = "application/json" }

# Reuse an existing notebook of this name if present, else create it
$nbs = (Invoke-RestMethod -Uri "https://api.fabric.microsoft.com/v1/workspaces/$Ws/notebooks" -Headers $H).value
$hit = $nbs | Where-Object { $_.displayName -eq $Name } | Select-Object -Last 1
$nbId = if ($hit) { $hit.id } else { $null }

if (-not $nbId) {
  $post = & "$PSScriptRoot\post_notebook.ps1" -PyFile $Py -DisplayName $Name
  $post
  for ($j = 0; $j -lt 12 -and -not $nbId; $j++) {
    Start-Sleep -Seconds 5
    $nbs = (Invoke-RestMethod -Uri "https://api.fabric.microsoft.com/v1/workspaces/$Ws/notebooks" -Headers $H).value
    $hit = $nbs | Where-Object { $_.displayName -eq $Name } | Select-Object -Last 1
    if ($hit) { $nbId = $hit.id }
  }
}
if (-not $nbId) { throw "No NOTEBOOK_ID returned" }
"NB=$nbId"

# 2. Trigger a RunNotebook job
$run = Invoke-WebRequest -Method Post -Uri "https://api.fabric.microsoft.com/v1/workspaces/$Ws/items/$nbId/jobs/instances?jobType=RunNotebook" -Headers $H -Body "{}" -UseBasicParsing
$loc = $run.Headers['Location']
if ($loc -is [array]) { $loc = $loc[0] }
"JOB=$loc"

# 3. Poll until the job completes
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 10
  $st = Invoke-RestMethod -Uri $loc -Headers $H
  $status = $st.status
  "[$i] $status"
  if ($status -in @("Completed", "Failed", "Cancelled", "Deduped")) {
    if ($status -ne "Completed") { $st | ConvertTo-Json -Depth 8 }
    break
  }
}
"RUN_DONE=$status"
