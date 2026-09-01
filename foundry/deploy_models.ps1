[CmdletBinding(SupportsShouldProcess=$true)]
param(
  [Parameter(Mandatory=$true)][string]$SubscriptionId,
  [string]$ResourceGroup = "esig_demo",
  [string]$FoundryAccountName = "esigfoundry",
  [string]$ConfigPath = (Join-Path $PSScriptRoot "models.json"),
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$apiVersion = "2025-06-01"

az account set --subscription $SubscriptionId
if ($LASTEXITCODE -ne 0) { throw "Unable to select Azure subscription $SubscriptionId." }

$models = @(Get-Content $ConfigPath -Raw | ConvertFrom-Json)
if ($models.Count -eq 0) { throw "No model deployments are defined in $ConfigPath." }

$accountId = "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroup/providers/Microsoft.CognitiveServices/accounts/$FoundryAccountName"
az resource show --ids $accountId --api-version $apiVersion --output none
if ($LASTEXITCODE -ne 0) { throw "Foundry account not found: $accountId" }

foreach ($model in $models) {
  $deploymentName = [string]$model.deploymentName
  $currentJson = az cognitiveservices account deployment show `
    --resource-group $ResourceGroup `
    --name $FoundryAccountName `
    --deployment-name $deploymentName `
    --output json 2>$null
  $exists = $LASTEXITCODE -eq 0

  if ($exists) {
    $current = $currentJson | ConvertFrom-Json
    $matches = `
      $current.properties.model.format -eq $model.format -and `
      $current.properties.model.name -eq $model.modelName -and `
      $current.properties.model.version -eq $model.modelVersion -and `
      $current.sku.name -eq $model.skuName -and `
      [int]$current.sku.capacity -eq [int]$model.capacity

    if ($matches) {
      Write-Output "MODEL=$deploymentName STATUS=UNCHANGED"
      continue
    }
    if (-not $Force) {
      throw "Model deployment '$deploymentName' differs from models.json. Rerun with -Force to update it."
    }
  }

  $action = if ($exists) { "Update model deployment" } else { "Create model deployment" }
  if (-not $PSCmdlet.ShouldProcess("$FoundryAccountName/$deploymentName", $action)) { continue }

  $body = @{
    sku = @{
      name = [string]$model.skuName
      capacity = [int]$model.capacity
    }
    properties = @{
      model = @{
        format = [string]$model.format
        name = [string]$model.modelName
        version = [string]$model.modelVersion
      }
      raiPolicyName = [string]$model.raiPolicyName
      versionUpgradeOption = [string]$model.versionUpgradeOption
    }
  } | ConvertTo-Json -Depth 10

  $escapedName = [Uri]::EscapeDataString($deploymentName)
  $deploymentUrl = "https://management.azure.com$accountId/deployments/$escapedName" + "?api-version=$apiVersion"
  $bodyFile = Join-Path ([IO.Path]::GetTempPath()) "foundry-model-$escapedName.json"
  try {
    Set-Content -Path $bodyFile -Value $body -Encoding utf8NoBOM
    az rest --method put --url $deploymentUrl --body "@$bodyFile" --output none
    if ($LASTEXITCODE -ne 0) { throw "$action failed for '$deploymentName'." }
  } finally {
    Remove-Item $bodyFile -ErrorAction SilentlyContinue
  }

  $deployedState = az cognitiveservices account deployment show `
    --resource-group $ResourceGroup `
    --name $FoundryAccountName `
    --deployment-name $deploymentName `
    --query properties.provisioningState `
    --output tsv
  if ($LASTEXITCODE -ne 0 -or $deployedState -ne "Succeeded") {
    throw "Model deployment '$deploymentName' finished with state '$deployedState'."
  }
  Write-Output "MODEL=$deploymentName STATUS=SUCCEEDED"
}