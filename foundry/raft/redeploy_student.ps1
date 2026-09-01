<#
.SYNOPSIS
  One-command redeploy of the RAFT fine-tuned student on the Developer tier (WS-6).

.DESCRIPTION
  Developer-tier deployments have no hourly hosting fee but are AUTO-REMOVED AFTER 24 HOURS.
  This script recreates the endpoint on the morning of the demo. It mirrors the Terraform
  resource azurerm_cognitive_deployment.raft_student and the notebook 3_deploy.ipynb, so all
  three paths converge on the same deployment.

  A customised model permits only ONE deployment at a time. Deploying requires the Foundry
  Owner role (or Microsoft.CognitiveServices/accounts/deployments/write).

.NOTES
  Reads the fine-tuned model id from -FtModelId or foundry/raft/data/ft_model_id.txt (Stage 2).
  az failures surface through $LASTEXITCODE; HTTP error bodies via $_.ErrorDetails.Message.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$ResourceGroup,   # tf output resource_group_name
  [Parameter(Mandatory)][string]$AccountName,     # tf output ai_foundry_name
  [string]$FtModelId = '',                         # e.g. gpt-4.1-mini.ft-<jobid>
  [string]$DeploymentName = 'raft-student',
  [string]$Sku = 'Developer',
  [int]$Capacity = 20
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($FtModelId)) {
  $file = Join-Path $PSScriptRoot 'data/ft_model_id.txt'
  if (-not (Test-Path $file)) { throw "Provide -FtModelId or run 2_finetune.ipynb to produce data/ft_model_id.txt." }
  $FtModelId = (Get-Content $file -Raw).Trim()
}
Write-Host "Redeploying $FtModelId as '$DeploymentName' (tier $Sku) on $AccountName ..."
Write-Warning 'Developer-tier deployments are auto-removed after 24h. Run this again on demo morning.'

az cognitiveservices account deployment create `
  --resource-group $ResourceGroup `
  --name $AccountName `
  --deployment-name $DeploymentName `
  --model-name $FtModelId `
  --model-format OpenAI `
  --sku-name $Sku `
  --sku-capacity $Capacity | Out-Null

if ($LASTEXITCODE -ne 0) {
  throw "Deployment failed (az exit $LASTEXITCODE). If the Developer SKU is rejected, use the azapi/REST fallback in README.md."
}
Write-Host "Done. Set VITE_RAFT_STUDENT_DEPLOYMENT=$DeploymentName and VITE_RAFT_ENABLED=true in the app config."
