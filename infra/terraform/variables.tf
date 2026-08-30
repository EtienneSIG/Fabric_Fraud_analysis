variable "subscription_id" {
  type        = string
  description = "Azure subscription id to deploy the support resources into."
}

variable "environment" {
  type        = string
  description = "Short environment token used in resource names (e.g. dev, demo, prod)."
  default     = "demo"

  validation {
    condition     = can(regex("^[a-z0-9]{2,8}$", var.environment))
    error_message = "environment must be 2-8 lowercase alphanumeric characters."
  }
}

variable "location" {
  type        = string
  description = "Azure region for the support resources."
  default     = "swedencentral"
}

variable "tenant_id" {
  type        = string
  description = "Entra tenant id (used by the app for OBO)."
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to every resource."
  default = {
    workload = "fraudintel"
    managed  = "terraform"
  }
}

# --- Foundry model deployments (names are AI Foundry deployment names, not raw model ids) ---
variable "model_orchestrator" {
  type        = string
  description = "Small fast model for the triage/orchestrator agent."
  default     = "gpt-4o-mini"
}

variable "model_reasoning" {
  type        = string
  description = "Strong model for fraud investigation / AML reasoning."
  default     = "gpt-4o"
}

variable "model_extraction" {
  type        = string
  description = "Small model for claims summary / extraction."
  default     = "gpt-4o-mini"
}

variable "model_embeddings" {
  type        = string
  description = "Embeddings model for knowledge / vector grounding."
  default     = "text-embedding-3-large"
}

variable "model_capacity" {
  type        = number
  description = "TPM capacity (thousands) per model deployment. Validate against region quota."
  default     = 20
}

variable "eventhub_partition_count" {
  type        = number
  description = "Partitions for the real-time transactions event hub."
  default     = 4
}
