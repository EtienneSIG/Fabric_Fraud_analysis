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
  [switch]$SkipValidation,
  # --- Web IQ (regulatory MCP grounding). Off by default: skipped gracefully until the real
  # Web IQ API key is stored in Key Vault. See foundry/README.md for the one-time setup.
  [string]$KeyVaultName = "kv-esigfoundry",
  [switch]$SkipKeyVault,
  [string]$KeyVaultAdminPrincipalId = ""
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

  $deployKeyVaultFlag = if ($SkipKeyVault) { "false" } else { "true" }
  az deployment group create `
    --name "fraud-iq-foundry" `
    --resource-group $ResourceGroup `
    --template-file (Join-Path $scriptRoot "main.bicep") `
    --parameters `
      foundryAccountName=$FoundryAccountName `
      foundryProjectName=$FoundryProjectName `
      location=$Location `
      deployKeyVault=$deployKeyVaultFlag `
      keyVaultName=$KeyVaultName `
      keyVaultAdminPrincipalId=$KeyVaultAdminPrincipalId `
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

# Optional Web IQ (regulatory MCP) connection. Stays off (mock/web-search-only agent) until the
# real key is stored in Key Vault; nothing here fails the deployment when it's missing yet.
$webIqConfig = Get-Content $configPath -Raw | ConvertFrom-Json
$webIqConnectionName = $webIqConfig.webIqConnectionName
$webIqMcpUrl = $webIqConfig.webIqMcpUrl
$webIqSecretName = $webIqConfig.webIqSecretName
$webIqConnectionId = $null

if (-not $SkipKeyVault) {
  $webIqKey = az keyvault secret show --vault-name $KeyVaultName --name $webIqSecretName --query value -o tsv 2>$null
  if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($webIqKey)) {
    Write-Host "Ensuring connection $webIqConnectionName ..."
    $webIqConnectionId = "$projectId/connections/$webIqConnectionName"
    $webIqConnectionUri = "https://management.azure.com$webIqConnectionId" + "?api-version=2025-10-01-preview"
    $webIqConnectionBody = @{
      properties = @{
        category    = "CustomKeys"
        authType    = "ApiKey"
        target      = $webIqMcpUrl
        credentials = @{ keys = @{ "x-apikey" = $webIqKey } }
        isSharedToAll = $true
      }
    } | ConvertTo-Json -Depth 10

    $webIqBodyFile = Join-Path ([IO.Path]::GetTempPath()) "fraud-iq-webiq-connection.json"
    try {
      Set-Content -Path $webIqBodyFile -Value $webIqConnectionBody -Encoding utf8NoBOM
      az rest --method put --uri $webIqConnectionUri --body "@$webIqBodyFile" --output none
    } finally {
      Remove-Item $webIqBodyFile -ErrorAction SilentlyContinue
    }
  } else {
    Write-Warning "Web IQ secret '$webIqSecretName' not found in Key Vault '$KeyVaultName'. Deploying fraud-iq-orchestrator with web search only; see foundry/README.md to enable Web IQ."
  }
}

if (-not (Test-Path $pythonPath)) {
  python -m venv $venvPath
}
& $pythonPath -m pip install --disable-pip-version-check -r (Join-Path $scriptRoot "requirements.txt")

$agentArgs = @(
  (Join-Path $scriptRoot "deploy_agents.py"),
  "--endpoint", $projectEndpoint,
  "--config", $configPath
)
if ($ReplaceAgent) { $agentArgs += "--replace" }
if ($webIqConnectionId) { $agentArgs += @("--webiq-connection-id", $webIqConnectionId, "--webiq-mcp-url", $webIqMcpUrl) }
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
if ($webIqConnectionId) { "WEBIQ_CONNECTION_ID=$webIqConnectionId" }