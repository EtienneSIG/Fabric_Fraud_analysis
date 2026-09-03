data "azurerm_client_config" "current" {}

# --------------------------------------------------------------------------
# Resource group + observability
# --------------------------------------------------------------------------
resource "azurerm_resource_group" "this" {
  count    = var.existing_resource_group_name == "" ? 1 : 0
  name     = local.names.resource_group
  location = var.location
  tags     = var.tags

  lifecycle {
    prevent_destroy = true
  }
}

moved {
  from = azurerm_resource_group.this
  to   = azurerm_resource_group.this[0]
}

locals {
  resource_group_name = var.existing_resource_group_name != "" ? var.existing_resource_group_name : azurerm_resource_group.this[0].name
}

resource "azurerm_log_analytics_workspace" "this" {
  name                = local.names.log_analytics
  resource_group_name = local.resource_group_name
  location            = var.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = var.tags
}

resource "azurerm_application_insights" "this" {
  name                = local.names.app_insights
  resource_group_name = local.resource_group_name
  location            = var.location
  workspace_id        = azurerm_log_analytics_workspace.this.id
  application_type    = "web"
  tags                = var.tags
}

# --------------------------------------------------------------------------
# Key Vault (RBAC data plane, no plaintext secret outputs)
# --------------------------------------------------------------------------
resource "azurerm_key_vault" "this" {
  name                          = local.names.key_vault
  resource_group_name           = local.resource_group_name
  location                      = var.location
  tenant_id                     = var.tenant_id
  sku_name                      = "standard"
  rbac_authorization_enabled    = true
  purge_protection_enabled      = false
  soft_delete_retention_days    = 7
  public_network_access_enabled = false
  tags                          = var.tags
}

# Let the deploying principal write secrets under RBAC.
resource "azurerm_role_assignment" "kv_deployer" {
  scope                = azurerm_key_vault.this.id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = data.azurerm_client_config.current.object_id
}

# --------------------------------------------------------------------------
# Microsoft Foundry (AI Services account + model deployments)
# Foundry PROJECT and AGENTS are provisioned by foundry/agents/deploy_agents.ps1.
# --------------------------------------------------------------------------
resource "azurerm_cognitive_account" "this" {
  name                  = local.names.ai_foundry
  resource_group_name   = local.resource_group_name
  location              = var.location
  kind                  = "AIServices"
  sku_name              = "S0"
  custom_subdomain_name = local.names.ai_foundry
  local_auth_enabled    = false

  # Reflects the allowProjectManagement patch below; without it azurerm sees drift and
  # would try to REPLACE the account (destroying project/agent/models).
  project_management_enabled = true

  identity {
    type = "SystemAssigned"
  }

  tags = var.tags
}

# The AIServices account must allow project management before a project can be created.
# azurerm doesn't expose this property, so patch it in place (no recreate -> models preserved).
resource "azapi_update_resource" "enable_project_mgmt" {
  count       = var.existing_foundry_project_endpoint == "" ? 1 : 0
  type        = "Microsoft.CognitiveServices/accounts@2025-06-01"
  resource_id = azurerm_cognitive_account.this.id

  body = {
    properties = {
      allowProjectManagement = true
    }
  }
}

# Foundry PROJECT (Agent Service host). Child of the AI Services account; created only when we are
# not reusing an existing project. Agents themselves are data-plane (foundry/agents/deploy_agents.ps1).
resource "azapi_resource" "foundry_project" {
  count     = var.existing_foundry_project_endpoint == "" ? 1 : 0
  type      = "Microsoft.CognitiveServices/accounts/projects@2025-06-01"
  name      = var.foundry_project_name
  parent_id = azurerm_cognitive_account.this.id
  location  = var.location

  identity {
    type = "SystemAssigned"
  }

  body = {
    properties = {
      displayName = var.foundry_project_name
      description = "Fraud IQ orchestration project (Agent Service, API 2025-11-15-preview)."
    }
  }

  schema_validation_enabled = false
  depends_on                = [azapi_update_resource.enable_project_mgmt]
}

# --------------------------------------------------------------------------
# Foundry observability: connect Application Insights to the project so the
# Agent Service emits server-side agent traces (latency, tool calls, prompts).
# Auth = Project Managed Identity (AAD) — matches the account's local_auth_enabled=false;
# Entra ingestion requires the project MI to hold "Monitoring Metrics Publisher" on the AI resource.
# --------------------------------------------------------------------------
resource "azapi_resource" "foundry_appinsights_connection" {
  count     = var.existing_foundry_project_endpoint == "" && var.enable_foundry_appinsights ? 1 : 0
  type      = "Microsoft.CognitiveServices/accounts/projects/connections@2025-06-01"
  name      = "appinsights"
  parent_id = azapi_resource.foundry_project[0].id

  body = {
    properties = {
      category      = "AppInsights"
      target        = azurerm_application_insights.this.id
      authType      = "AAD"
      isSharedToAll = true
      metadata = {
        ApiType    = "Azure"
        ResourceId = azurerm_application_insights.this.id
      }
    }
  }

  schema_validation_enabled = false
  depends_on                = [azapi_resource.foundry_project]
}

# The Foundry project managed identity ingests agent traces into Application Insights (the portal
# grants this automatically when you pick "Project managed identity"; Terraform grants it explicitly).
resource "azurerm_role_assignment" "foundry_mi_metrics_publisher" {
  count                = var.existing_foundry_project_endpoint == "" && var.enable_foundry_appinsights ? 1 : 0
  scope                = azurerm_application_insights.this.id
  role_definition_name = "Monitoring Metrics Publisher"
  principal_id         = azapi_resource.foundry_project[0].identity[0].principal_id
}

resource "azurerm_cognitive_deployment" "models" {
  for_each = local.model_deployments

  # Deployment name == model name (matches foundry/models.json + config.json agent references).
  name                 = each.value.name
  cognitive_account_id = azurerm_cognitive_account.this.id

  model {
    format  = "OpenAI"
    name    = each.value.name
    version = each.value.version
  }

  sku {
    name     = var.model_deployment_sku
    capacity = var.model_capacity
  }
}

# RAFT fine-tuned student deployment (WS-6). Terraform only provisions the DEPLOYMENT of an
# already-trained model; the fine-tuning job runs from foundry/raft (data-plane), not here.
# Default tier Developer has no hourly hosting fee but is auto-removed after 24h — redeploy
# with foundry/raft/redeploy_student.ps1. If the provider/API rejects the Developer SKU,
# fall back to the azapi/REST path documented in foundry/raft/README.md.
resource "azurerm_cognitive_deployment" "raft_student" {
  count                = var.raft_student_ft_model_id != "" ? 1 : 0
  name                 = var.raft_student_deployment_name
  cognitive_account_id = azurerm_cognitive_account.this.id

  model {
    format = "OpenAI"
    name   = var.raft_student_ft_model_id
  }

  sku {
    name     = var.raft_student_sku
    capacity = var.model_capacity
  }
}

# --------------------------------------------------------------------------
# Azure AI Search over the OneLake corpus (RAFT retrieval layer, WS-2).
# Service + identity + data-plane RBAC only; index/indexer via modules/search/create_indexer.ps1.
# --------------------------------------------------------------------------
module "search" {
  count  = var.enable_search ? 1 : 0
  source = "./modules/search"

  name                  = local.names.ai_search
  resource_group_name   = local.resource_group_name
  location              = var.location
  sku                   = var.search_sku
  index_name            = var.search_index_name
  deployer_principal_id = data.azurerm_client_config.current.object_id
  tags                  = var.tags
}

# --------------------------------------------------------------------------
# Event Hub (Eventstream source for real-time transaction scoring)
# --------------------------------------------------------------------------
resource "azurerm_eventhub_namespace" "this" {
  name                         = local.names.eventhub_ns
  resource_group_name          = local.resource_group_name
  location                     = var.location
  sku                          = "Standard"
  capacity                     = 1
  local_authentication_enabled = false
  tags                         = var.tags
}

resource "azurerm_eventhub" "transactions" {
  name              = local.names.eventhub
  namespace_id      = azurerm_eventhub_namespace.this.id
  partition_count   = var.eventhub_partition_count
  message_retention = 1
}

# --------------------------------------------------------------------------
# Storage + Function App (Flex Consumption) hosting the Teams Bot endpoint
# --------------------------------------------------------------------------
resource "azurerm_storage_account" "func" {
  name                     = local.names.storage
  resource_group_name      = local.resource_group_name
  location                 = var.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  min_tls_version          = "TLS1_2"
  # Tenant policy forbids shared-key auth; use Entra ID (managed identity) only.
  shared_access_key_enabled       = false
  default_to_oauth_authentication = true
  tags                            = var.tags
}

# Data-plane access for the deployer so the package container can be created over Entra ID.
resource "azurerm_role_assignment" "deployer_storage" {
  scope                = azurerm_storage_account.func.id
  role_definition_name = "Storage Blob Data Owner"
  principal_id         = data.azurerm_client_config.current.object_id
}

resource "azurerm_storage_container" "func" {
  name                  = "app-package"
  storage_account_id    = azurerm_storage_account.func.id
  container_access_type = "private"
  depends_on            = [azurerm_role_assignment.deployer_storage]
}

resource "azurerm_service_plan" "func" {
  name                = "asp-${local.suffix}"
  resource_group_name = local.resource_group_name
  location            = var.location
  os_type             = "Linux"
  sku_name            = "FC1"
  tags                = var.tags
}

resource "azurerm_function_app_flex_consumption" "bot" {
  name                = local.names.function_app
  resource_group_name = local.resource_group_name
  location            = var.location
  service_plan_id     = azurerm_service_plan.func.id

  storage_container_type      = "blobContainer"
  storage_container_endpoint  = "${azurerm_storage_account.func.primary_blob_endpoint}${azurerm_storage_container.func.name}"
  storage_authentication_type = "SystemAssignedIdentity"

  runtime_name           = "node"
  runtime_version        = "22"
  maximum_instance_count = 40
  instance_memory_in_mb  = 2048

  identity {
    type = "SystemAssigned"
  }

  site_config {
    application_insights_connection_string = azurerm_application_insights.this.connection_string
  }

  app_settings = merge({
    AZURE_TENANT_ID                       = var.tenant_id
    KEY_VAULT_URI                         = azurerm_key_vault.this.vault_uri
    AI_FOUNDRY_ENDPOINT                   = local.foundry_project_endpoint
    EVENTHUB_NAMESPACE                    = "${azurerm_eventhub_namespace.this.name}.servicebus.windows.net"
    EVENTHUB_NAME                         = azurerm_eventhub.transactions.name
    APPLICATIONINSIGHTS_CONNECTION_STRING = azurerm_application_insights.this.connection_string
    }, var.enable_entra_apps ? {
    BOT_APP_ID                   = azuread_application.bot[0].client_id
    GRAPH_OBO_CLIENT_ID          = azuread_application.graph_obo[0].client_id
    GRAPH_OBO_CLIENT_SECRET_NAME = azurerm_key_vault_secret.graph_obo[0].name
  } : {})

  tags = var.tags
}

resource "azurerm_role_assignment" "func_storage" {
  scope                = azurerm_storage_account.func.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_function_app_flex_consumption.bot.identity[0].principal_id
}

resource "azurerm_role_assignment" "func_kv" {
  scope                = azurerm_key_vault.this.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_function_app_flex_consumption.bot.identity[0].principal_id
}

resource "azurerm_role_assignment" "func_eventhub" {
  scope                = azurerm_eventhub_namespace.this.id
  role_definition_name = "Azure Event Hubs Data Receiver"
  principal_id         = azurerm_function_app_flex_consumption.bot.identity[0].principal_id
}

# --------------------------------------------------------------------------
# Azure Bot + Teams channel (own app identity — not mixed with Graph OBO app)
# --------------------------------------------------------------------------
resource "azuread_application" "bot" {
  count            = var.enable_entra_apps ? 1 : 0
  display_name     = "bot-${local.suffix}"
  sign_in_audience = "AzureADMultipleOrgs"
}

resource "azuread_application_password" "bot" {
  count          = var.enable_entra_apps ? 1 : 0
  application_id = azuread_application.bot[0].id
  display_name   = "bot-secret"
}

resource "azurerm_key_vault_secret" "bot" {
  count        = var.enable_entra_apps ? 1 : 0
  name         = "bot-app-secret"
  value        = azuread_application_password.bot[0].value
  key_vault_id = azurerm_key_vault.this.id
  depends_on   = [azurerm_role_assignment.kv_deployer]
}

resource "azurerm_bot_service_azure_bot" "this" {
  count               = var.enable_entra_apps ? 1 : 0
  name                = local.names.bot
  resource_group_name = local.resource_group_name
  location            = "global"
  microsoft_app_id    = azuread_application.bot[0].client_id
  microsoft_app_type  = "MultiTenant"
  sku                 = "F0"
  endpoint            = "https://${azurerm_function_app_flex_consumption.bot.default_hostname}/api/messages"
  tags                = var.tags
}

resource "azurerm_bot_channel_ms_teams" "this" {
  count               = var.enable_entra_apps ? 1 : 0
  bot_name            = azurerm_bot_service_azure_bot.this[0].name
  location            = azurerm_bot_service_azure_bot.this[0].location
  resource_group_name = local.resource_group_name
}

# --------------------------------------------------------------------------
# Entra app registration for Microsoft Graph — DELEGATED (OBO) only
# --------------------------------------------------------------------------
data "azuread_application_published_app_ids" "well_known" {}

resource "azuread_service_principal" "msgraph" {
  count        = var.enable_entra_apps ? 1 : 0
  client_id    = data.azuread_application_published_app_ids.well_known.result["MicrosoftGraph"]
  use_existing = true
}

resource "azuread_application" "graph_obo" {
  count            = var.enable_entra_apps ? 1 : 0
  display_name     = local.names.entra_app
  sign_in_audience = "AzureADMyOrg"

  required_resource_access {
    resource_app_id = data.azuread_application_published_app_ids.well_known.result["MicrosoftGraph"]

    dynamic "resource_access" {
      for_each = local.graph_delegated_scopes
      content {
        id   = azuread_service_principal.msgraph[0].oauth2_permission_scope_ids[resource_access.value]
        type = "Scope"
      }
    }
  }
}

resource "azuread_application_password" "graph_obo" {
  count          = var.enable_entra_apps ? 1 : 0
  application_id = azuread_application.graph_obo[0].id
  display_name   = "graph-obo-secret"
}

resource "azurerm_key_vault_secret" "graph_obo" {
  count        = var.enable_entra_apps ? 1 : 0
  name         = "graph-obo-client-secret"
  value        = azuread_application_password.graph_obo[0].value
  key_vault_id = azurerm_key_vault.this.id
  depends_on   = [azurerm_role_assignment.kv_deployer]
}

# --------------------------------------------------------------------------
# Public SPA app registration for the direct-browser Foundry IQ path
# (MSAL PublicClientApplication → signed-in user calls the agent responses API).
# Off by default; enable with enable_fraudiq_spa and paste the client id into
# Settings › Agents › Client ID (SPA). The analyst also needs a data-plane role
# on the Foundry account (fraudiq_analyst_object_ids below) for the ai.azure.com
# token to be authorized — Owner/Contributor grant no dataActions.
# --------------------------------------------------------------------------
resource "azuread_application" "fraudiq_spa" {
  count            = var.enable_fraudiq_spa ? 1 : 0
  display_name     = "rayfin-fraudiq-spa"
  sign_in_audience = "AzureADMyOrg"

  single_page_application {
    redirect_uris = var.fraudiq_spa_redirect_uris
  }

  # Delegated permission so the signed-in analyst can call the Foundry agent responses API
  # (aud https://ai.azure.com). Without it the token request fails AADSTS650057 (invalid resource).
  # Consent is interactive: the SPA requests the specific user_impersonation scope (not .default),
  # so the analyst consents at sign-in — the deploying principal usually can't admin-consent for the org.
  required_resource_access {
    resource_app_id = "18a66f5f-dbdf-4c17-9dd7-1634712a9cbe" # Azure Machine Learning Services (https://ai.azure.com)
    resource_access {
      id   = "1a7925b5-f871-417a-9b8b-303f9f29fa10" # user_impersonation (delegated)
      type = "Scope"
    }
  }
}

resource "azuread_service_principal" "fraudiq_spa" {
  count     = var.enable_fraudiq_spa ? 1 : 0
  client_id = azuread_application.fraudiq_spa[0].client_id
}

# Data-plane grant so signed-in analysts can call the agent responses API on the
# Foundry account (the SPA direct path). Empty list by default → manages none.
resource "azurerm_role_assignment" "fraudiq_analyst" {
  for_each             = toset(var.fraudiq_analyst_object_ids)
  scope                = azurerm_cognitive_account.this.id
  role_definition_name = var.fraudiq_analyst_role
  principal_id         = each.value
}
