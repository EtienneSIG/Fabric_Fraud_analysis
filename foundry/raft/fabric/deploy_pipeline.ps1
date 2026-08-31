#requires -Version 7.0
<#
.SYNOPSIS
  Materialise the RAFT Fabric ingestion: import gen_fabric.ipynb as a Fabric Notebook item and wrap
  it in a Data Pipeline that runs it on the attached Lakehouse. Idempotent (create or update in place).

.DESCRIPTION
  Uses the Fabric REST API with an AAD token (az login). The pipeline runs the notebook, which reads
  the corpus from OneLake (Files/corpus) and writes raft_train.jsonl / raft_val.jsonl to Files/raft.
  Foundry does NOT train from OneLake directly: set push_to_foundry=True (notebook param) to upload the
  JSONL to the Foundry resource via files.create, or download from OneLake and use the portal wizard.

.PARAMETER Ws
  Fabric workspace id (GUID) hosting the Lakehouse that holds Files/corpus.

.EXAMPLE
  ./deploy_pipeline.ps1 -Ws 00000000-0000-0000-0000-000000000000
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Ws,
  [string]$NotebookPath = (Join-Path $PSScriptRoot 'gen_fabric.ipynb'),
  [string]$PipelineDefPath = (Join-Path $PSScriptRoot 'pipeline-content.json'),
  [string]$NotebookName = 'raft_gen_fabric',
  [string]$PipelineName = 'raft-ingestion'
)

$ErrorActionPreference = 'Stop'
$api = 'https://api.fabric.microsoft.com/v1'

function Get-FabricToken {
  $t = az account get-access-token --resource 'https://api.fabric.microsoft.com' --query accessToken -o tsv
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($t)) { throw 'az login required (Fabric token).' }
  return $t
}
$script:Hdr = @{ Authorization = "Bearer $(Get-FabricToken)"; 'Content-Type' = 'application/json' }

function ConvertTo-B64 ([string]$Text) {
  return [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Text))
}

# Fabric item create/updateDefinition are long-running: 202 + Location, poll until Succeeded.
function Invoke-FabricLro {
  param([string]$Method, [string]$Uri, [string]$Body)
  $r = Invoke-WebRequest -Method $Method -Uri $Uri -Headers $script:Hdr -Body $Body -UseBasicParsing -SkipHttpErrorCheck
  if ($r.StatusCode -ge 400) {
    throw "Fabric $Method $Uri -> $($r.StatusCode): $($r.Content)"
  }
  if ($r.StatusCode -eq 202) {
    $loc = $r.Headers['Location']; if ($loc -is [array]) { $loc = $loc[0] }
    while ($true) {
      Start-Sleep -Seconds 3
      $op = Invoke-RestMethod -Method Get -Uri $loc -Headers $script:Hdr
      if ($op.status -eq 'Succeeded') { return $op }
      if ($op.status -eq 'Failed') { throw "Fabric operation failed: $($op | ConvertTo-Json -Depth 6)" }
    }
  }
  if ($r.Content) { return ($r.Content | ConvertFrom-Json) }
  return $null
}

function Get-ItemId {
  param([string]$DisplayName, [string]$Type)
  $items = (Invoke-RestMethod -Method Get -Uri "$api/workspaces/$Ws/items?type=$Type" -Headers $script:Hdr).value
  return ($items | Where-Object { $_.displayName -eq $DisplayName } | Select-Object -First 1).id
}

function Set-FabricItem {
  param([string]$DisplayName, [string]$Type, [hashtable]$Definition)
  $existing = Get-ItemId -DisplayName $DisplayName -Type $Type
  if ($existing) {
    "Updating $Type '$DisplayName' ($existing)"
    $body = @{ definition = $Definition } | ConvertTo-Json -Depth 8
    Invoke-FabricLro -Method Post -Uri "$api/workspaces/$Ws/items/$existing/updateDefinition" -Body $body | Out-Null
    return $existing
  }
  "Creating $Type '$DisplayName'"
  $body = @{ displayName = $DisplayName; type = $Type; definition = $Definition } | ConvertTo-Json -Depth 8
  Invoke-FabricLro -Method Post -Uri "$api/workspaces/$Ws/items" -Body $body | Out-Null
  $id = Get-ItemId -DisplayName $DisplayName -Type $Type
  if (-not $id) { throw "Created $Type '$DisplayName' but could not resolve its id." }
  return $id
}

# 1) Import the notebook (.ipynb) as a Fabric Notebook item.
if (-not (Test-Path $NotebookPath)) { throw "Notebook not found: $NotebookPath" }
$nbB64 = ConvertTo-B64 (Get-Content -Raw -Path $NotebookPath)
$nbDef = @{
  format = 'ipynb'
  parts  = @(@{ path = 'notebook-content.ipynb'; payload = $nbB64; payloadType = 'InlineBase64' })
}
$notebookId = Set-FabricItem -DisplayName $NotebookName -Type 'Notebook' -Definition $nbDef
"Notebook id: $notebookId"

# 2) Bind the pipeline definition to this notebook + workspace, then create/update the Data Pipeline.
if (-not (Test-Path $PipelineDefPath)) { throw "Pipeline definition not found: $PipelineDefPath" }
$pipeText = (Get-Content -Raw -Path $PipelineDefPath).
  Replace('{{NOTEBOOK_ID}}', $notebookId).
  Replace('{{WORKSPACE_ID}}', $Ws)
$pipDef = @{
  parts = @(@{ path = 'pipeline-content.json'; payload = (ConvertTo-B64 $pipeText); payloadType = 'InlineBase64' })
}
$pipelineId = Set-FabricItem -DisplayName $PipelineName -Type 'DataPipeline' -Definition $pipDef
"Pipeline id: $pipelineId"

""
"Done. Next:"
"  - Attach the Lakehouse holding Files/corpus to the '$NotebookName' notebook (Fabric UI) before the first run."
"  - Grant the workspace identity 'Cognitive Services OpenAI User' on the Foundry resource for teacher calls."
"  - Run the '$PipelineName' pipeline (or schedule it). Output lands in OneLake Files/raft/."
