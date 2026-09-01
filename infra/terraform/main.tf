data "azurerm_client_config" "current" {}

# --------------------------------------------------------------------------
# Resource group + observability
# --------------------------------------------------------------------------
resource "azurerm_resource_group" "this" {
  name     = local.names.resource_group
  location = var.location
  tags     = var.tags
}

resource "azurerm_log_analytics_workspace" "this" {
  name                = local.names.log_analytics
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = var.tags
}

resource "azurerm_application_insights" "this" {
  name                = local.names.app_insights
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  workspace_id        = azurerm_log_analytics_workspace.this.id
  application_type    = "web"
  tags                = var.tags
}

# --------------------------------------------------------------------------
# Key Vault (RBAC data plane, no plaintext secret outputs)
# --------------------------------------------------------------------------
resource "azurerm_key_vault" "this" {
  name                       = local.names.key_vault
  resource_group_name        = azurerm_resource_group.this.name
  location                   = azurerm_resource_group.this.location
  tenant_id                  = var.tenant_id
  sku_name                   = "standard"
  rbac_authorization_enabled = true
  purge_protection_enabled   = false
  soft_delete_retention_days = 7
  tags                       = var.tags
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
  resource_group_name   = azurerm_resource_group.this.name
  location              = azurerm_resource_group.this.location
  kind                  = "AIServices"
  sku_name              = "S0"
  custom_subdomain_name = local.names.ai_foundry

  identity {
    type = "SystemAssigned"
  }

  tags = var.tags
}

resource "azurerm_cognitive_deployment" "models" {
  for_each = local.model_deployments

  name                 = each.key
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
  resource_group_name   = azurerm_resource_group.this.name
  location              = azurerm_resource_group.this.location
  sku                   = var.search_sku
  index_name            = var.search_index_name
  deployer_principal_id = data.azurerm_client_config.current.object_id
  tags                  = var.tags
}

# --------------------------------------------------------------------------
# Event Hub (Eventstream source for real-time transaction scoring)
# --------------------------------------------------------------------------
resource "azurerm_eventhub_namespace" "this" {
  name                = local.names.eventhub_ns
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  sku                 = "Standard"
  capacity            = 1
  tags                = var.tags
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
  resource_group_name      = azurerm_resource_group.this.name
  location                 = azurerm_resource_group.this.location
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
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  os_type             = "Linux"
  sku_name            = "FC1"
  tags                = var.tags
}

resource "azurerm_function_app_flex_consumption" "bot" {
  name                = local.names.function_app
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
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

  app_settings = {
    AZURE_TENANT_ID                       = var.tenant_id
    KEY_VAULT_URI                         = azurerm_key_vault.this.vault_uri
    BOT_APP_ID                            = azuread_application.bot.client_id
    AI_FOUNDRY_ENDPOINT                   = azurerm_cognitive_account.this.endpoint
    EVENTHUB_NAMESPACE                    = "${azurerm_eventhub_namespace.this.name}.servicebus.windows.net"
    EVENTHUB_NAME                         = azurerm_eventhub.transactions.name
    GRAPH_OBO_CLIENT_ID                   = azuread_application.graph_obo.client_id
    GRAPH_OBO_CLIENT_SECRET_NAME          = azurerm_key_vault_secret.graph_obo.name
    WEBIQ_CLIENT_ID                       = var.webiq_client_id
    WEBIQ_TENANT_ID                       = coalesce(var.webiq_tenant_id, var.tenant_id)
    WEBIQ_CLIENT_SECRET_NAME              = var.webiq_client_secret_name
    WEBIQ_OFFICIAL_DOMAINS                = join(",", var.webiq_official_domains)
    APPLICATIONINSIGHTS_CONNECTION_STRING = azurerm_application_insights.this.connection_string
  }

  tags = var.tags
}

resource "azurerm_role_assignment" "func_storage" {
  scope                = azurerm_storage_account.func.id
  role_definition_name = "Storage Blob Data Owner"
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
  display_name     = "bot-${local.suffix}"
  sign_in_audience = "AzureADMultipleOrgs"
}

resource "azuread_application_password" "bot" {
  application_id = azuread_application.bot.id
  display_name   = "bot-secret"
}

resource "azurerm_key_vault_secret" "bot" {
  name         = "bot-app-secret"
  value        = azuread_application_password.bot.value
  key_vault_id = azurerm_key_vault.this.id
  depends_on   = [azurerm_role_assignment.kv_deployer]
}

resource "azurerm_bot_service_azure_bot" "this" {
  name                = local.names.bot
  resource_group_name = azurerm_resource_group.this.name
  location            = "global"
  microsoft_app_id    = azuread_application.bot.client_id
  microsoft_app_type  = "MultiTenant"
  sku                 = "F0"
  endpoint            = "https://${azurerm_function_app_flex_consumption.bot.default_hostname}/api/messages"
  tags                = var.tags
}

resource "azurerm_bot_channel_ms_teams" "this" {
  bot_name            = azurerm_bot_service_azure_bot.this.name
  location            = azurerm_bot_service_azure_bot.this.location
  resource_group_name = azurerm_resource_group.this.name
}

# --------------------------------------------------------------------------
# Entra app registration for Microsoft Graph — DELEGATED (OBO) only
# --------------------------------------------------------------------------
data "azuread_application_published_app_ids" "well_known" {}

resource "azuread_service_principal" "msgraph" {
  client_id    = data.azuread_application_published_app_ids.well_known.result["MicrosoftGraph"]
  use_existing = true
}

resource "azuread_application" "graph_obo" {
  display_name     = local.names.entra_app
  sign_in_audience = "AzureADMyOrg"

  required_resource_access {
    resource_app_id = data.azuread_application_published_app_ids.well_known.result["MicrosoftGraph"]

    dynamic "resource_access" {
      for_each = local.graph_delegated_scopes
      content {
        id   = azuread_service_principal.msgraph.oauth2_permission_scope_ids[resource_access.value]
        type = "Scope"
      }
    }
  }
}

resource "azuread_application_password" "graph_obo" {
  application_id = azuread_application.graph_obo.id
  display_name   = "graph-obo-secret"
}

resource "azurerm_key_vault_secret" "graph_obo" {
  name         = "graph-obo-client-secret"
  value        = azuread_application_password.graph_obo.value
  key_vault_id = azurerm_key_vault.this.id
  depends_on   = [azurerm_role_assignment.kv_deployer]
}
