<#
.SYNOPSIS
  Deploys only what is requested for Fabric Fraud Intelligence, with prerequisite,
  build and performance verification. Ships the minimal artifact for each target:
  the SPA publishes only dist/ (Rayfin static hosting), the backend only its compiled
  runtime (.funcignore), Terraform only the Azure support layer.

.PARAMETER App        Deploy the Rayfin Fabric App (SPA).
.PARAMETER Backend    Deploy the Azure Function backend (Teams bot endpoint).
.PARAMETER Infra      Deploy the Azure support layer (Terraform).
.PARAMETER FoundryAgents  Deploy the Foundry connected-agent topology.
.PARAMETER Fabric     Deploy the Fabric fixtures (lakehouse data, ontology, data agent, Power BI, realtime KQL).
.PARAMETER Verify     Discovery + managed-identity/RBAC check only (no deploy).
.PARAMETER FoundryTenantId / FoundryClientId / FoundryAccount / FoundryProject / FoundryAgentName / FoundryAgentEndpoint
  Optional. Written to the SPA .env.public.local before `rayfin up` to wire the direct Foundry IQ
  agent (tenant/RG-agnostic). Absent -> the app keeps its safe mock path (no cross-tenant login).
.PARAMETER ExistingFoundryProjectEndpoint  Reuse an existing Foundry project and its deployed models.
.PARAMETER NameSuffix  Override the unique name suffix ('' reproduces legacy un-suffixed names for an existing env).
.PARAMETER EnableFabricWorkspace  Create a BILLED Fabric capacity (F SKU) + workspace to host the app.
.PARAMETER WhatIf     Verify + terraform plan only; no apply/publish/rayfin up.
.PARAMETER Force      Skip confirmation prompts before real deployments.
.PARAMETER SkipVerify Skip the build/test/validate gate (not recommended).

.EXAMPLE
  ./deploy.ps1 -App -Backend -WorkspaceId <id>
  ./deploy.ps1 -Infra -SubscriptionId <sub> -TenantId <tid> -WhatIf
  ./deploy.ps1 -Verify -SubscriptionId <sub> -TenantId <tid>
#>
[CmdletBinding()]
param(
  [switch]$App,
  [switch]$Backend,
  [switch]$Infra,
  [switch]$FoundryAgents,
  [switch]$Fabric,
  [switch]$Verify,

  [string]$WorkspaceId,
  [string]$SubscriptionId,
  [string]$TenantId,
  [string]$Environment = 'demo',
  [string]$ExistingResourceGroupName,
  [string]$ExistingFoundryProjectEndpoint,
  [string]$FunctionAppName,
  [string]$FoundryEndpoint,
  [string]$FabricDataAgentUrl,
  [string]$NameSuffix,
  [switch]$EnableFabricWorkspace,
  [string]$FabricAdminMember,

  # Foundry IQ direct-agent wiring for the SPA build (all optional; tenant/RG-agnostic).
  [string]$FoundryTenantId,
  [string]$FoundryClientId,
  [string]$FoundryAccount,
  [string]$FoundryProject,
  [string]$FoundryAgentName,
  [string]$FoundryAgentEndpoint,

  # Fabric fixtures (-Fabric): the item ids/endpoints the fixture scripts need.
  [string]$LakehouseId,
  [string]$SqlEndpoint,
  [string]$PowerBiModelId,
  [string]$KqlCluster,
  [string]$LakehouseDataDir,

  [switch]$WhatIf,
  [switch]$Force,
  [switch]$SkipVerify
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = $PSScriptRoot
$spa = Join-Path $root 'fabric-fraud-intelligence'
$be = Join-Path $root 'backend'
$tf = Join-Path $root 'infra/terraform'

if (-not ($App -or $Backend -or $Infra -or $FoundryAgents -or $Fabric -or $Verify)) {
  Write-Host 'Nothing selected. Choose one or more targets: -App -Backend -Infra -FoundryAgents -Fabric -Verify' -ForegroundColor Yellow
  exit 1
}

# --- helpers ---------------------------------------------------------------
$timings = [System.Collections.Generic.List[object]]::new()

function Measure-Step {
  param([string]$Name, [scriptblock]$Body)
  Write-Host "→ $Name" -ForegroundColor Cyan
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  & $Body
  $sw.Stop()
  $timings.Add([pscustomobject]@{ Step = $Name; Seconds = [math]::Round($sw.Elapsed.TotalSeconds, 1) })
}

function Assert-Tool {
  param([string]$Name, [string]$VersionArgs = '--version')
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $cmd) { throw "Required tool '$Name' not found on PATH." }
  $v = (& $Name $VersionArgs.Split(' ') 2>&1 | Select-Object -First 1)
  Write-Host ("  ✓ {0,-12} {1}" -f $Name, $v) -ForegroundColor DarkGray
}

function Confirm-Step {
  param([string]$Message)
  if ($Force -or $WhatIf) { return $true }
  return ((Read-Host "$Message  [y/N]") -match '^(y|yes)$')
}

function Invoke-Native {
  param([string]$What, [scriptblock]$Body)
  & $Body
  if ($LASTEXITCODE -ne 0) { throw "$What failed (exit $LASTEXITCODE)." }
}

# Writes the provided VITE_FOUNDRY_* values to the SPA's .env.public.local so `rayfin up`'s
# `vite build --mode public` wires the direct Foundry IQ agent. Only keys passed on the command line
# are written; absent keys leave the app on its safe mock path (no cross-tenant login). This file is
# mode-scoped, so it takes precedence over the .env.local that rayfin refreshes.
function Set-PublicEnv {
  $pairs = [ordered]@{
    VITE_FOUNDRY_TENANT_ID      = $FoundryTenantId
    VITE_FOUNDRY_CLIENT_ID      = $FoundryClientId
    VITE_FOUNDRY_ACCOUNT        = $FoundryAccount
    VITE_FOUNDRY_PROJECT        = $FoundryProject
    VITE_FOUNDRY_AGENT_NAME     = $FoundryAgentName
    VITE_FOUNDRY_AGENT_ENDPOINT = $FoundryAgentEndpoint
  }
  $provided = @($pairs.GetEnumerator() | Where-Object { $_.Value })
  if ($provided.Count -eq 0) { return }
  $envFile = Join-Path $spa '.env.public.local'
  $lines = @(if (Test-Path $envFile) { Get-Content $envFile })
  foreach ($p in $provided) {
    $lines = @($lines | Where-Object { $_ -notmatch "^\s*$($p.Key)=" })
    $lines += "$($p.Key)=$($p.Value)"
  }
  Set-Content -Path $envFile -Value $lines -Encoding UTF8
  Write-Host ("  Wrote {0} Foundry var(s) to .env.public.local" -f $provided.Count) -ForegroundColor DarkGray
}

# Expected resource names (mirror infra/terraform/locals.tf naming convention).
function Get-Names {
  $w = 'fraudintel'
  [pscustomobject]@{
    ResourceGroup = "rg-$w-$Environment"
    KeyVault      = "kv-$w$Environment"
    Foundry       = "aif-$w-$Environment"
    EventHubNs    = "evhns-$w-$Environment"
    Storage       = "st$w$Environment"
    FunctionApp   = if ($FunctionAppName) { $FunctionAppName } else { "func-$w-bot-$Environment" }
  }
}

# Discovers an already-deployed RG and, if it is not yet tracked by Terraform, imports it so a
# re-apply reuses the existing group instead of failing on create. Read-only unless the user
# confirms the import; never mutates state under -WhatIf.
function Invoke-Discovery {
  param([Parameter(Mandatory)][string]$Sub)
  $n = Get-Names
  Invoke-Native 'az account set' { az account set --subscription $Sub }
  Invoke-Native 'terraform init' { terraform "-chdir=$tf" init -input=false -upgrade=false | Out-Null }

  $rgExists = ((az group exists --name $n.ResourceGroup) -eq 'true')
  Write-Host ('  Resource group {0}: {1}' -f $n.ResourceGroup, $(if ($rgExists) { 'EXISTS (re-deploy)' } else { 'absent (will be created)' })) -ForegroundColor DarkGray
  if (-not $rgExists) { return }

  $inventory = az resource list --resource-group $n.ResourceGroup --query '[].{name:name, type:type}' -o json | ConvertFrom-Json
  if ($inventory) {
    Write-Host ('  {0} existing resource(s) in the group:' -f @($inventory).Count) -ForegroundColor DarkGray
    $inventory | Sort-Object type | Format-Table -AutoSize | Out-Host
  }

  $inState = @(terraform "-chdir=$tf" state list 2>$null) -contains 'azurerm_resource_group.this'
  if ($inState) { Write-Host '  RG already tracked in Terraform state.' -ForegroundColor DarkGray; return }
  if ($WhatIf) { Write-Host '  WhatIf: existing RG would be imported into Terraform state before apply.' -ForegroundColor Yellow; return }
  if (Confirm-Step 'RG exists but is not in Terraform state. Import it to reuse it?') {
    $rgId = "/subscriptions/$Sub/resourceGroups/$($n.ResourceGroup)"
    Invoke-Native 'terraform import RG' {
      terraform "-chdir=$tf" import "-var=subscription_id=$Sub" "-var=tenant_id=$TenantId" "-var=environment=$Environment" 'azurerm_resource_group.this' $rgId
    }
  }
}

# Verifies the Function App system-assigned identity and its least-privilege role assignments
# (Key Vault / Storage / Event Hub). Self-heals missing assignments with -Force or on confirmation.
function Test-IdentitiesAndRbac {
  param([Parameter(Mandatory)][string]$Sub)
  $n = Get-Names
  $rg = $n.ResourceGroup
  if ((az group exists --name $rg) -ne 'true') {
    Write-Warning "  Resource group '$rg' not found; deploy -Infra first."
    return
  }
  $principalId = az functionapp identity show -g $rg -n $n.FunctionApp --query principalId -o tsv 2>$null
  if ([string]::IsNullOrWhiteSpace($principalId)) {
    Write-Warning "  Function app '$($n.FunctionApp)' has no system-assigned identity yet (deploy -Infra first)."
    return
  }
  Write-Host "  Function MI principal: $principalId" -ForegroundColor DarkGray
  $base = "/subscriptions/$Sub/resourceGroups/$rg/providers"
  $checks = @(
    @{ Role = 'Key Vault Secrets User'; Scope = "$base/Microsoft.KeyVault/vaults/$($n.KeyVault)" }
    @{ Role = 'Storage Blob Data Owner'; Scope = "$base/Microsoft.Storage/storageAccounts/$($n.Storage)" }
    @{ Role = 'Azure Event Hubs Data Receiver'; Scope = "$base/Microsoft.EventHub/namespaces/$($n.EventHubNs)" }
  )
  foreach ($c in $checks) {
    $count = az role assignment list --assignee $principalId --scope $c.Scope --query "length([?roleDefinitionName=='$($c.Role)'])" -o tsv 2>$null
    if (-not [string]::IsNullOrWhiteSpace($count) -and [int]$count -gt 0) {
      Write-Host ('  OK  {0}' -f $c.Role) -ForegroundColor DarkGreen
      continue
    }
    Write-Warning ('  MISSING: {0} on {1}' -f $c.Role, (($c.Scope -split '/')[-1]))
    if (-not $WhatIf -and ($Force -or (Confirm-Step "Create missing role assignment '$($c.Role)'?"))) {
      Invoke-Native 'az role assignment create' {
        az role assignment create --assignee-object-id $principalId --assignee-principal-type ServicePrincipal --role $c.Role --scope $c.Scope --output none
      }
    }
  }
}

# --- 1. prerequisites ------------------------------------------------------
Measure-Step 'Prerequisite check' {
  Assert-Tool node
  Assert-Tool npm
  if ($Infra -or $Verify) { Assert-Tool terraform }
  if ($Backend) { Assert-Tool func }
  if ($Infra -or $FoundryAgents -or $Fabric -or $Verify) { Assert-Tool az }

  $nodeMajor = [int]((node -v).TrimStart('v').Split('.')[0])
  if ($nodeMajor -lt 20) { throw "Node >= 20 required (found $nodeMajor)." }
}

# --- 2. verification gate --------------------------------------------------
if (-not $SkipVerify) {
  if ($App) {
    Measure-Step 'Verify SPA (i18n + build + tests)' {
      Push-Location $spa
      try {
        Invoke-Native 'i18n:check' { npm run i18n:check }
        Invoke-Native 'build' { npm run build }
        Invoke-Native 'test' { npm test }
      }
      finally { Pop-Location }
    }
  }
  if ($Backend) {
    Measure-Step 'Verify backend (tsc)' {
      Push-Location $be
      try { Invoke-Native 'build' { npm run build } } finally { Pop-Location }
    }
  }
  if ($Infra) {
    Measure-Step 'Verify Terraform (validate)' {
      Push-Location $tf
      try {
        Invoke-Native 'init' { terraform init -input=false -upgrade=false | Out-Null }
        Invoke-Native 'validate' { terraform validate | Out-Null }
      }
      finally { Pop-Location }
    }
  }
}

# --- 2b. discovery / verification only --------------------------------------
if ($Verify) {
  if (-not $SubscriptionId) { throw '-Verify requires -SubscriptionId (and -TenantId to import an existing RG).' }
  Measure-Step 'Discovery (existing RG + inventory)' { Invoke-Discovery -Sub $SubscriptionId }
  Measure-Step 'Verify managed identity + RBAC' { Test-IdentitiesAndRbac -Sub $SubscriptionId }
}

# --- 3. infra (Terraform) --------------------------------------------------
if ($Infra) {
  if (-not $SubscriptionId -or -not $TenantId) { throw '-Infra requires -SubscriptionId and -TenantId.' }
  Measure-Step 'Discovery (reuse existing RG if already deployed)' { Invoke-Discovery -Sub $SubscriptionId }
  Measure-Step 'Terraform plan (what-if / delta)' {
    Push-Location $tf
    try {
      # Full-token vars (PowerShell expands the whole string, avoiding the -var=$x pitfall).
      $vSub = "-var=subscription_id=$SubscriptionId"
      $vTid = "-var=tenant_id=$TenantId"
      $vEnv = "-var=environment=$Environment"
      $tfVars = @($vSub, $vTid, $vEnv)
      if ($ExistingResourceGroupName) {
        $tfVars += "-var=existing_resource_group_name=$ExistingResourceGroupName"
      }
      if ($ExistingFoundryProjectEndpoint) {
        $tfVars += "-var=existing_foundry_project_endpoint=$ExistingFoundryProjectEndpoint"
      }
      # Reproduce legacy un-suffixed names (pass -NameSuffix '') to keep an existing env non-destructive.
      if ($PSBoundParameters.ContainsKey('NameSuffix')) {
        $tfVars += "-var=name_suffix=$NameSuffix"
      }
      if ($EnableFabricWorkspace) {
        $tfVars += '-var=enable_fabric_workspace=true'
        $admin = if ($FabricAdminMember) { $FabricAdminMember } else { az account show --query user.name -o tsv }
        if ($admin) { $tfVars += "-var=fabric_admin_member=$admin" }
      }
      # -detailed-exitcode: 0 = no delta, 1 = error, 2 = changes pending.
      terraform plan -input=false -detailed-exitcode -out tfplan @tfVars | Tee-Object -Variable planLog
      $planCode = $LASTEXITCODE
      if ($planCode -eq 1) { throw 'Terraform plan failed.' }
      $hasDelta = $planCode -eq 2
      $m = $planLog | Select-String -Pattern 'Plan:|No changes' | Select-Object -Last 1
      $summary = if ($m) { $m.Line.Trim() } else { '' }
      if ($hasDelta) {
        Write-Host ("  Delta detected: {0}" -f $(if ($summary) { $summary } else { 'changes pending' })) -ForegroundColor Yellow
      }
      else {
        Write-Host '  Delta: none — infrastructure already matches the configuration.' -ForegroundColor DarkGreen
      }
      if ($WhatIf) {
        Write-Host '  WhatIf: plan only, nothing applied.' -ForegroundColor Yellow
      }
      elseif (-not $hasDelta) {
        Write-Host '  Nothing to apply.' -ForegroundColor DarkGray
      }
      elseif (Confirm-Step 'Apply this Terraform plan?') {
        Invoke-Native 'apply' { terraform apply -input=false tfplan }
      }
    }
    finally { Pop-Location }
  }
  if (-not $WhatIf) {
    Measure-Step 'Verify managed identity + RBAC' { Test-IdentitiesAndRbac -Sub $SubscriptionId }
  }
}

# --- 4. backend (Azure Function, runtime only) -----------------------------
if ($Backend -and -not $WhatIf) {
  if (Confirm-Step 'Publish the backend Azure Function?') {
    Measure-Step 'Deploy backend (prune + publish)' {
      Push-Location $be
      try {
        Invoke-Native 'build' { npm run build }
        Invoke-Native 'prune' { npm prune --omit=dev }
        $name = $FunctionAppName
        if (-not $name -and (Test-Path (Join-Path $tf '.terraform'))) {
          $name = (terraform "-chdir=$tf" output -raw function_app_name 2>$null)
        }
        if (-not $name) { throw 'Function app name unknown: pass -FunctionAppName or deploy -Infra first.' }
        Invoke-Native 'func publish' { func azure functionapp publish $name }
      }
      finally {
        Pop-Location
        try { npm install --prefix $be | Out-Null } catch { Write-Warning 'Could not restore backend dev deps locally.' }
      }
    }
  }
}

# --- 5. SPA (Rayfin static hosting, dist only) -----------------------------
if ($App -and -not $WhatIf) {
  if (-not $WorkspaceId -and (Test-Path (Join-Path $tf '.terraform'))) {
    $WorkspaceId = (terraform "-chdir=$tf" output -raw fabric_workspace_id 2>$null)
  }
  if (-not $WorkspaceId) { throw '-App requires -WorkspaceId (or run -Infra -EnableFabricWorkspace first).' }
  Set-PublicEnv
  if (Confirm-Step 'Deploy the Rayfin app (rayfin up)?') {
    Measure-Step 'Deploy SPA (rayfin up)' {
      Push-Location $spa
      try { Invoke-Native 'rayfin up' { npx rayfin up --workspace-id $WorkspaceId } } finally { Pop-Location }
    }
  }
}

# --- 6. Foundry agents -----------------------------------------------------
if ($FoundryAgents -and -not $WhatIf) {
  if (-not $FoundryEndpoint -or -not $FabricDataAgentUrl) {
    throw '-FoundryAgents requires -FoundryEndpoint and -FabricDataAgentUrl.'
  }
  if (Confirm-Step 'Deploy Foundry connected agents?') {
    Measure-Step 'Deploy Foundry agents' {
      & (Join-Path $root 'foundry/agents/deploy_agents.ps1') `
        -FoundryEndpoint $FoundryEndpoint -FabricDataAgentUrl $FabricDataAgentUrl
    }
  }
}

# --- 7. Fabric fixtures (data + ontology + data agent + Power BI + realtime) ---
# Terraform only creates the capacity + empty workspace; the item content lives in fabric/ and is
# pushed here with the signed-in user's identity (preserves RLS/OBO). Each sub-step runs only when
# the id/endpoint it needs is supplied, and is individually confirmed.
if ($Fabric -and -not $WhatIf) {
  if (-not $WorkspaceId -and (Test-Path (Join-Path $tf '.terraform'))) {
    $WorkspaceId = (terraform "-chdir=$tf" output -raw fabric_workspace_id 2>$null)
  }
  if (-not $WorkspaceId) { throw '-Fabric requires -WorkspaceId (the Fabric workspace hosting the items).' }
  $fab = Join-Path $root 'fabric'
  $dataDir = if ($LakehouseDataDir) { $LakehouseDataDir } else { Join-Path $root 'artifacts/lakehouse_data' }

  if ($LakehouseId) {
    if (Confirm-Step 'Load lakehouse fixtures (upload JSONL + run notebook)?') {
      Measure-Step 'Fabric: lakehouse data' {
        & (Join-Path $fab 'lakehouse/upload_lakehouse_data.ps1') -Ws $WorkspaceId -Lh $LakehouseId -Dir $dataDir
        & (Join-Path $fab 'lakehouse/run_load.ps1') -Ws $WorkspaceId -Lh $LakehouseId
      }
    }
  } else { Write-Host '  Skip lakehouse fixtures: pass -LakehouseId to enable.' -ForegroundColor DarkYellow }

  if ($TenantId -and $LakehouseId) {
    if (Confirm-Step 'Deploy the Fabric ontology (Fabric IQ)?') {
      Measure-Step 'Fabric: ontology' {
        # Rebuild the definition for THIS workspace/lakehouse so bindings are never hardcoded.
        $py = Get-Command python -ErrorAction SilentlyContinue
        if (-not $py) { $py = Get-Command python3 -ErrorAction SilentlyContinue }
        if (-not $py) { throw 'python not found on PATH (needed to build the ontology definition).' }
        Invoke-Native 'build_ontology.py' { & $py.Source (Join-Path $fab 'ontology/build_ontology.py') --workspace-id $WorkspaceId --lakehouse-id $LakehouseId }
        & (Join-Path $fab 'ontology/post_ontology.ps1') -Ws $WorkspaceId -TenantId $TenantId
      }
    }
  } else { Write-Host '  Skip ontology: pass -TenantId and -LakehouseId to enable.' -ForegroundColor DarkYellow }

  if ($LakehouseId) {
    if (Confirm-Step 'Deploy the Fabric Data Agent?') {
      Measure-Step 'Fabric: data agent' {
        & (Join-Path $fab 'data-agent/deploy_data_agent.ps1') -WorkspaceId $WorkspaceId -LakehouseId $LakehouseId
      }
    }
  }

  if ($SqlEndpoint) {
    if (Confirm-Step 'Deploy the Power BI semantic model?') {
      Measure-Step 'Fabric: Power BI model' {
        & (Join-Path $fab 'powerbi/deploy_model.ps1') -Workspace $WorkspaceId -Server $SqlEndpoint
      }
    }
    if ($PowerBiModelId -and (Confirm-Step 'Deploy the Power BI report?')) {
      Measure-Step 'Fabric: Power BI report' {
        & (Join-Path $fab 'powerbi/deploy_report.ps1') -Workspace $WorkspaceId -ModelId $PowerBiModelId
      }
    } elseif (-not $PowerBiModelId) {
      Write-Host '  Skip Power BI report: pass -PowerBiModelId (from the model step) to enable.' -ForegroundColor DarkYellow
    }
  } else { Write-Host '  Skip Power BI: pass -SqlEndpoint (lakehouse SQL connection string, e.g. <id>.datawarehouse.fabric.microsoft.com) to enable.' -ForegroundColor DarkYellow }

  if ($KqlCluster) {
    if (Confirm-Step 'Deploy the realtime KQL schema?') {
      Measure-Step 'Fabric: realtime KQL' {
        & (Join-Path $fab 'realtime/deploy_kql.ps1') -Cluster $KqlCluster
      }
    }
  } else { Write-Host '  Skip realtime KQL: pass -KqlCluster (Eventhouse query URI) to enable.' -ForegroundColor DarkYellow }
}

# --- summary ---------------------------------------------------------------
Write-Host ''
Write-Host 'Timing summary' -ForegroundColor Green
$timings | Format-Table -AutoSize
if ($WhatIf) { Write-Host 'WhatIf: verification + plan only, nothing was deployed.' -ForegroundColor Yellow }
