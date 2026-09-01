output "search_endpoint" {
  description = "Search service endpoint — surfaced to the app as VITE_SEARCH_ENDPOINT."
  value       = "https://${azurerm_search_service.this.name}.search.windows.net"
}

output "search_service_name" {
  value = azurerm_search_service.this.name
}

output "index_name" {
  description = "Corpus index name — VITE_SEARCH_INDEX."
  value       = var.index_name
}

output "identity_principal_id" {
  description = "Search managed identity. Grant it a Fabric workspace Viewer role on the lakehouse (see README)."
  value       = azurerm_search_service.this.identity[0].principal_id
}
