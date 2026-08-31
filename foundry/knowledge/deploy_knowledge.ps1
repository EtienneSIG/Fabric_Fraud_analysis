<#
.SYNOPSIS
  Deploys the Foundry IQ knowledge base for Fabric Fraud Intelligence: a Microsoft OneLake
  knowledge source over the fraud document corpus (Files/corpus), so the Foundry agents can
  reason over unstructured documents in addition to the NL2SQL Data Agent.

.DESCRIPTION
  Uses the GA Foundry Agents Service (API 2025-11-15-preview). Idempotent: an existing
  connection / knowledge source of the same name is updated rather than duplicated. This is
  the retrieval layer WS-4 fine-tunes against and the real backing for the app's Foundry IQ.

  Prerequisites: the corpus is uploaded (fabric/lakehouse/corpus/upload_corpus.ps1) and, for
  vector retrieval, the Azure AI Search index exists (infra/terraform/modules/search).

.NOTES
  Fabric data agents and OneLake knowledge surface in Foundry over MCP; the exact resource
  shape is preview — re-verify against current docs before a client run. Read HTTP error
  bodies via $_.ErrorDetails.Message; az failures surface through $LASTEXITCODE.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$FoundryEndpoint,   # tf output ai_foundry_endpoint
  [Parameter(Mandatory)][string]$WorkspaceId,       # Fabric workspace GUID
  [Parameter(Mandatory)][string]$LakehouseId,       # fraud_lakehouse item GUID
  [string]$CorpusPath = 'corpus',                   # Files/<CorpusPath>
  [string]$KnowledgeName = 'fraud-corpus-knowledge',
  [string]$ConnectionName = 'conn-onelake-fraud-corpus',
  [string]$SearchEndpoint = '',                     # optional: WS-2 search endpoint for vector retrieval
  [string]$SearchIndex = 'fraud-corpus-index',
  [string]$ApiVersion = '2025-11-15-preview'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Get-FoundryToken {
  $token = az account get-access-token --resource 'https://ai.azure.com' --query accessToken -o tsv
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($token)) {
    throw 'Failed to acquire a Foundry access token via az. Run az login first.'
  }
  return $token
}

function Invoke-Foundry {
  param([string]$Method, [string]$Path, $Body)
  $headers = @{ Authorization = "Bearer $(Get-FoundryToken)"; 'Content-Type' = 'application/json' }
  $uri = "$($FoundryEndpoint.TrimEnd('/'))/$($Path.TrimStart('/'))?api-version=$ApiVersion"
  try {
    $json = if ($null -ne $Body) { $Body | ConvertTo-Json -Depth 20 } else { $null }
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -Body $json
  }
  catch {
    Write-Error "Foundry $Method $Path failed: $($_.ErrorDetails.Message)"
    throw
  }
}

# 1) OneLake knowledge connection (OBO user identity, so RLS/PII masking still hold).
Write-Host "Ensuring OneLake knowledge connection $ConnectionName ..."
$connection = @{
  name     = $ConnectionName
  type     = 'MicrosoftOneLake'
  target   = "https://onelake.dfs.fabric.microsoft.com/$WorkspaceId/$LakehouseId/Files/$CorpusPath"
  authType = 'OnBehalfOf'
  metadata = @{ workspaceId = $WorkspaceId; lakehouseId = $LakehouseId; path = $CorpusPath }
}
Invoke-Foundry -Method 'PUT' -Path "connections/$ConnectionName" -Body $connection | Out-Null

# 2) Knowledge source over the connection. If a Search endpoint is supplied, back it with the
#    WS-2 vector index; otherwise fall back to direct OneLake file retrieval.
Write-Host "Upserting knowledge source $KnowledgeName ..."
$knowledge = @{
  name        = $KnowledgeName
  type        = 'onelake'
  connection  = $ConnectionName
  description = 'Fraud document corpus (AML training domain + distractors). Advisory only; human approval required.'
}
if (-not [string]::IsNullOrWhiteSpace($SearchEndpoint)) {
  $knowledge.searchIndex = @{ endpoint = $SearchEndpoint; index = $SearchIndex }
}
$created = Invoke-Foundry -Method 'PUT' -Path "knowledge/$KnowledgeName" -Body $knowledge

Write-Host "Done. Knowledge source: $KnowledgeName (connection $ConnectionName)."
Write-Host "Connect it to the agents:"
Write-Host "  foundry/agents/deploy_agents.ps1 ... -KnowledgeConnectionName $ConnectionName"
