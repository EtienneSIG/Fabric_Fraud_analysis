variable "name" {
  type        = string
  description = "Azure AI Search service name (lowercase, 2-60 chars, alphanumeric and dashes)."
}

variable "resource_group_name" {
  type        = string
  description = "Resource group that holds the search service."
}

variable "location" {
  type        = string
  description = "Azure region. Must be the same tenant as the Fabric workspace (see README)."
}

variable "sku" {
  type        = string
  description = "Search SKU. Basic tier or higher is required for the OneLake indexer."
  default     = "basic"

  validation {
    condition     = contains(["basic", "standard", "standard2", "standard3"], var.sku)
    error_message = "sku must be basic or a standard tier (the free tier cannot run the OneLake indexer)."
  }
}

variable "local_authentication_enabled" {
  type        = bool
  description = "Keep admin keys enabled. RBAC (AAD) is preferred for create_indexer.ps1."
  default     = true
}

variable "deployer_principal_id" {
  type        = string
  description = "Object id granted data-plane roles so it can create the index and indexer."
}

variable "index_name" {
  type        = string
  description = "Name of the corpus search index created by create_indexer.ps1."
  default     = "fraud-corpus-index"
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to the search service."
  default     = {}
}
