<#
.SYNOPSIS
  Provisions the Microsoft Foundry Agent Service topology for Fabric Fraud Intelligence:
  a Fabric connection + a Triage orchestrator delegating to connected sub-agents
  (investigation / AML / claims), grounded on the Fabric Data Agent with OBO.

.DESCRIPTION
  Uses the GA Foundry Agents Service (API 2025-11-15-preview). Reads model deployment
  names and endpoints from the Terraform outputs (infra/terraform). Idempotent: an
  existing agent of the same name is updated rather than duplicated.

  This script provisions the AGENTS only. The AI Services account + model deployments
  come from Terraform; the Fabric Data Agent comes from fabric/data-agent/.

.NOTES
  Pitfalls (user memory): read HTTP error bodies via $_.ErrorDetails.Message; az failures
  surface through $LASTEXITCODE, not exceptions.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$FoundryEndpoint,     # tf output ai_foundry_endpoint
  [Parameter(Mandatory)][string]$FabricDataAgentUrl,  # Data Agent published URL (fabric/data-agent)
  [string]$ApiVersion = '2025-11-15-preview',
  [string]$ModelOrchestrator = 'orchestrator',        # tf deployment names (keys), not raw model ids
  [string]$ModelReasoning = 'reasoning',
  [string]$ModelExtraction = 'extraction',
  [string]$ConnectionName = 'conn-fabric-fraud-dataagent',
  [string]$KnowledgeConnectionName = ''   # optional WS-3 OneLake knowledge (Foundry IQ)
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

# HITL, regulator-safe system prompt shared by every agent (mirror of PromptTemplates.ts).
$hitl = @'
You support fraud analysts. Ground every claim in the Fabric data via the Microsoft Fabric tool.
NEVER make a final fraud decision. All output is advisory and REQUIRES human approval.
Respond in the locale provided in the request context (fr or en).
'@

# 1) Fabric connection (Microsoft Fabric tool grounds on the Data Agent with OBO user identity).
Write-Host "Ensuring connection $ConnectionName ..."
$connection = @{
  name       = $ConnectionName
  type       = 'MicrosoftFabric'
  target     = $FabricDataAgentUrl
  authType   = 'OnBehalfOf'
}
Invoke-Foundry -Method 'PUT' -Path "connections/$ConnectionName" -Body $connection | Out-Null

$fabricTool = @{ type = 'fabric_dataagent'; connection = $ConnectionName }

# Optional Foundry IQ knowledge tool over the OneLake corpus (WS-3). Additive: when the
# knowledge connection is supplied, every agent can also reason over the document corpus.
$agentTools = @($fabricTool)
if (-not [string]::IsNullOrWhiteSpace($KnowledgeConnectionName)) {
  $agentTools += @{ type = 'knowledge'; connection = $KnowledgeConnectionName }
}

# 2) Connected sub-agents. Each declares it is a sub-agent (single-response principle).
$subAgents = @(
  @{ name = 'fraud-investigation-agent'; model = $ModelReasoning
     instructions = "$hitl`nYou are a SUB-AGENT. Do NOT reply to the user. Investigate the alert/case and return findings to the parent." }
  @{ name = 'fraud-aml-agent'; model = $ModelReasoning
     instructions = "$hitl`nYou are a SUB-AGENT. Do NOT reply to the user. Produce an AML/SAR narrative grounded in data; return it to the parent." }
  @{ name = 'fraud-claims-agent'; model = $ModelExtraction
     instructions = "$hitl`nYou are a SUB-AGENT. Do NOT reply to the user. Summarize claims-fraud evidence and return it to the parent." }
)

$connectedTools = @()
foreach ($a in $subAgents) {
  Write-Host "Upserting agent $($a.name) ..."
  $body = @{
    name         = $a.name
    model        = $a.model
    instructions = $a.instructions
    tools        = $agentTools
  }
  $created = Invoke-Foundry -Method 'PUT' -Path "assistants/$($a.name)" -Body $body
  $connectedTools += @{
    type           = 'connected_agent'
    name           = $a.name
    id             = $created.id
    description    = "Delegate $($a.name.Replace('fraud-','').Replace('-agent','')) tasks to this specialist."
  }
}

# 3) Triage orchestrator — the ONLY agent that replies to the user.
Write-Host 'Upserting fraud-triage-agent (orchestrator) ...'
$triage = @{
  name         = 'fraud-triage-agent'
  model        = $ModelOrchestrator
  instructions = @"
$hitl
You are the ORCHESTRATOR and the only agent that replies to the user. Classify the intent
(investigation / AML / claims) and delegate to the matching connected agent. Combine their
findings into ONE response. Always append that human approval is required.
"@
  tools        = $agentTools + $connectedTools
}
$orchestrator = Invoke-Foundry -Method 'PUT' -Path 'assistants/fraud-triage-agent' -Body $triage

Write-Host "Done. Orchestrator id: $($orchestrator.id)"
Write-Host 'Set VITE_FOUNDRY_ENABLED=true and VITE_BACKEND_API_URL to route the app through these agents.'
