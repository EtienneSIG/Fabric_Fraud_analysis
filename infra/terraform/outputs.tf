output "resource_group_name" {
  value = local.resource_group_name
}

output "ai_foundry_endpoint" {
  description = "Microsoft Foundry (AI Services) endpoint — VITE_FOUNDRY_ENDPOINT."
  value       = local.foundry_endpoint
}

output "ai_foundry_name" {
  value = azurerm_cognitive_account.this.name
}

output "model_deployment_names" {
  description = "Foundry deployment names keyed by role (used by deploy_agents.ps1 and the app)."
  value       = { for k, d in azurerm_cognitive_deployment.models : k => d.name }
}

output "eventhub_namespace_fqdn" {
  value = "${azurerm_eventhub_namespace.this.name}.servicebus.windows.net"
}

output "eventhub_name" {
  value = azurerm_eventhub.transactions.name
}

output "key_vault_uri" {
  value = azurerm_key_vault.this.vault_uri
}

output "function_app_name" {
  value = azurerm_function_app_flex_consumption.bot.name
}

output "bot_messaging_endpoint" {
  value = "https://${azurerm_function_app_flex_consumption.bot.default_hostname}/api/messages"
}

output "bot_app_id" {
  description = "Bot Entra app (client) id — used in the Teams app manifest."
  value       = azuread_application.bot.client_id
}

output "graph_obo_client_id" {
  description = "Delegated Graph app (client) id — VITE_GRAPH_OBO_CLIENT_ID."
  value       = azuread_application.graph_obo.client_id
}

output "tenant_id" {
  value = var.tenant_id
}

# --- Azure AI Search (WS-2) — null unless enable_search = true ---
output "search_endpoint" {
  description = "Search endpoint — VITE_SEARCH_ENDPOINT."
  value       = try(module.search[0].search_endpoint, null)
}

output "search_index_name" {
  description = "Corpus index name — VITE_SEARCH_INDEX."
  value       = try(module.search[0].index_name, null)
}

output "search_identity_principal_id" {
  description = "Grant this a Fabric workspace Viewer role on the lakehouse (see module README)."
  value       = try(module.search[0].identity_principal_id, null)
}

# --- RAFT student deployment (WS-6) — null unless raft_student_ft_model_id is set ---
output "raft_student_deployment_name" {
  description = "RAFT fine-tuned student deployment — VITE_RAFT_STUDENT_DEPLOYMENT."
  value       = try(azurerm_cognitive_deployment.raft_student[0].name, null)
}
