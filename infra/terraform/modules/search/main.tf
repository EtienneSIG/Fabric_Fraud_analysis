# Azure AI Search service backing the RAFT retrieval layer (WS-2).
# Provisions the SERVICE, its managed identity and data-plane RBAC only. The OneLake data
# source, index and indexer are created by create_indexer.ps1 (data-plane REST) because the
# azurerm provider does not model the OneLake files indexer — see README.md.

resource "azurerm_search_service" "this" {
  name                = var.name
  resource_group_name = var.resource_group_name
  location            = var.location
  sku                 = var.sku # Basic tier or higher is required for the OneLake indexer.

  # RBAC data-plane auth so create_indexer.ps1 can use an AAD token instead of admin keys.
  local_authentication_enabled = var.local_authentication_enabled

  identity {
    type = "SystemAssigned"
  }

  tags = var.tags
}

# Let the deploying principal create the index / indexer over the data plane.
resource "azurerm_role_assignment" "search_service_contributor" {
  scope                = azurerm_search_service.this.id
  role_definition_name = "Search Service Contributor"
  principal_id         = var.deployer_principal_id
}

resource "azurerm_role_assignment" "search_index_data_contributor" {
  scope                = azurerm_search_service.this.id
  role_definition_name = "Search Index Data Contributor"
  principal_id         = var.deployer_principal_id
}
