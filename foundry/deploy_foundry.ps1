param(
  [Parameter(Mandatory=$true)][string]$SubscriptionId,
  [string]$ResourceGroup = "esig_demo",
  [string]$Location = "eastus",
  [string]$FoundryAccountName = "esigfoundry",
  [string]$FoundryProjectName = "FraudIQ",
  [string]$FabricWorkspaceId = "c57a379b-7e6d-481a-9c9b-662bb0bae77d",
  [string]$FabricDataAgentId = "5e157d5a-2694-499b-9b9f-ed10fe73cb5a",
  [switch]$ReplaceAgent,
  [switch]$SkipInfrastructure,
  [switch]$SkipModels,
  [switch]$SkipValidation
)

$ErrorActionPreference = "Stop"
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$configPath = Join-Path $scriptRoot "config.json"
$venvPath = Join-Path $scriptRoot ".venv"
$pythonPath = Join-Path $venvPath "Scripts/python.exe"

az account set --subscription $SubscriptionId
$tenantId = az account show --query tenantId -o tsv
if (-not $tenantId) { throw "Azure CLI authentication is required. Run az login and retry." }

if (-not $SkipInfrastructure) {
  $groupExists = az group exists --name $ResourceGroup
  if ($groupExists -ne "true") {
    az group create --name $ResourceGroup --location $Location --output none
  }

  az deployment group create `
    --name "fraud-iq-foundry" `
    --resource-group $ResourceGroup `
    --template-file (Join-Path $scriptRoot "main.bicep") `
    --parameters `
      foundryAccountName=$FoundryAccountName `
      foundryProjectName=$FoundryProjectName `
      location=$Location `
    --output none
}

if (-not $SkipModels) {
  & (Join-Path $scriptRoot "deploy_models.ps1") `
    -SubscriptionId $SubscriptionId `
    -ResourceGroup $ResourceGroup `
    -FoundryAccountName $FoundryAccountName
  if ($LASTEXITCODE -ne 0) { throw "Foundry model deployment failed." }
}

$projectEndpoint = "https://$FoundryAccountName.services.ai.azure.com/api/projects/$FoundryProjectName"
$projectId = "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroup/providers/Microsoft.CognitiveServices/accounts/$FoundryAccountName/projects/$FoundryProjectName"
$connectionName = (Get-Content $configPath -Raw | ConvertFrom-Json).fabricConnectionName
$connectionId = "$projectId/connections/$connectionName"
$fabricEndpoint = "https://api.fabric.microsoft.com/v1/mcp/workspaces/$FabricWorkspaceId/dataagents/$FabricDataAgentId/agent"
$connectionUri = "https://management.azure.com$connectionId" + "?api-version=2025-10-01-preview"
$connectionBody = @{
  properties = @{
    category = "RemoteTool"
    authType = "UserEntraToken"
    target = $fabricEndpoint
    audience = "https://analysis.windows.net/powerbi/api"
    isSharedToAll = $true
  }
} | ConvertTo-Json -Depth 10

$bodyFile = Join-Path ([IO.Path]::GetTempPath()) "fraud-iq-foundry-connection.json"
try {
  Set-Content -Path $bodyFile -Value $connectionBody -Encoding utf8NoBOM
  az rest --method put --uri $connectionUri --body "@$bodyFile" --output none
} finally {
  Remove-Item $bodyFile -ErrorAction SilentlyContinue
}

if (-not (Test-Path $pythonPath)) {
  python -m venv $venvPath
}
& $pythonPath -m pip install --disable-pip-version-check -r (Join-Path $scriptRoot "requirements.txt")

$agentArgs = @(
  (Join-Path $scriptRoot "deploy_agents.py"),
  "--endpoint", $projectEndpoint,
  "--fabric-connection-id", $connectionId,
  "--config", $configPath
)
if ($ReplaceAgent) { $agentArgs += "--replace" }
& $pythonPath @agentArgs
if ($LASTEXITCODE -ne 0) { throw "Foundry agent deployment failed." }

if (-not $SkipValidation) {
  & $pythonPath `
    (Join-Path $scriptRoot "validate_foundry.py") `
    --endpoint $projectEndpoint `
    --config $configPath
  if ($LASTEXITCODE -ne 0) { throw "Foundry end-to-end validation failed." }
}

"FOUNDRY_PROJECT_ENDPOINT=$projectEndpoint"
"FABRIC_CONNECTION_ID=$connectionId"
"FABRIC_DATA_AGENT_ENDPOINT=$fabricEndpoint"
"TENANT_ID=$tenantId"