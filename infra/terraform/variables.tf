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

variable "existing_resource_group_name" {
  type        = string
  description = "Existing resource group to deploy into. Leave empty to create rg-fraudintel-<environment>."
  default     = ""
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
  default     = "gpt-5.6-terra"
}

variable "model_orchestrator_version" {
  type        = string
  description = "Model version for the orchestrator deployment."
  default     = "2026-03-17"
}

variable "model_reasoning" {
  type        = string
  description = "Strong model for fraud investigation / AML reasoning."
  default     = "gpt-5.6-sol"
}

variable "model_reasoning_version" {
  type        = string
  description = "Model version for the reasoning deployment."
  default     = "2026-07-09"
}

variable "model_extraction" {
  type        = string
  description = "Small model for claims summary / extraction."
  default     = "gpt-5.6-luna"
}

variable "model_extraction_version" {
  type        = string
  description = "Model version for the extraction deployment."
  default     = "2026-03-17"
}

variable "model_embeddings" {
  type        = string
  description = "Embeddings model for knowledge / vector grounding."
  default     = "text-embedding-3-small"
}

variable "model_embeddings_version" {
  type        = string
  description = "Model version for the embeddings deployment."
  default     = "1"
}

variable "model_deployment_sku" {
  type        = string
  description = "Deployment SKU for the Foundry model deployments (e.g. DataZoneStandard, GlobalStandard)."
  default     = "DataZoneStandard"
}

variable "model_capacity" {
  type        = number
  description = "TPM capacity (thousands) per model deployment. Validate against region quota."
  default     = 20
}

variable "existing_foundry_project_endpoint" {
  type        = string
  description = "Existing Foundry project endpoint to use for agents. Empty uses the Terraform-managed AI Services account."
  default     = ""
}

# --- Microsoft Web IQ (regulatory web grounding, Web IQ pillar) ---
# The Web IQ credential is NOT a Terraform variable: place the app-only client secret directly in
# Key Vault under var.webiq_client_secret_name so it never lands in Terraform state.
variable "webiq_client_id" {
  type        = string
  description = "Entra app (client) id bound to the Web IQ account for app-only tokens. Empty disables Web IQ."
  default     = ""
}

variable "webiq_tenant_id" {
  type        = string
  description = "Tenant id for the Web IQ client-credentials token. Empty falls back to var.tenant_id."
  default     = ""
}

variable "webiq_client_secret_name" {
  type        = string
  description = "Key Vault secret name holding the Web IQ app client secret (created out-of-band, not by Terraform)."
  default     = "webiq-client-secret"
}

variable "webiq_official_domains" {
  type        = list(string)
  description = "Official regulatory domains the Web IQ agent restricts search and citations to."
  default = [
    "acpr.banque-france.fr",
    "amf-france.org",
    "eur-lex.europa.eu",
    "legifrance.gouv.fr",
    "tracfin.economie.gouv.fr",
    "eba.europa.eu",
  ]
}

variable "eventhub_partition_count" {
  type        = number
  description = "Partitions for the real-time transactions event hub."
  default     = 4
}

# --- Azure AI Search over the OneLake corpus (RAFT retrieval layer, WS-2) ---
variable "enable_entra_apps" {
  type        = bool
  description = "Provision the Entra app registrations (Teams bot + Graph OBO). Disable when the deploying principal lacks directory-write rights; the app stays mock-first and the Function App backend still deploys."
  default     = true
}

variable "enable_search" {
  type        = bool
  description = "Provision the Azure AI Search service backing the RAFT corpus. Off by default to keep base cost down."
  default     = false
}

variable "search_sku" {
  type        = string
  description = "Search SKU. Basic tier or higher is required for the OneLake indexer."
  default     = "basic"
}

variable "search_index_name" {
  type        = string
  description = "Corpus search index name created by modules/search/create_indexer.ps1."
  default     = "fraud-corpus-index"
}

# --- RAFT fine-tuned student deployment (WS-6) ---
variable "raft_student_ft_model_id" {
  type        = string
  description = "Fine-tuned student model id (e.g. gpt-4.1-mini.ft-<jobid>). Empty disables the deployment; training itself runs from foundry/raft, not Terraform."
  default     = ""
}

variable "raft_student_deployment_name" {
  type        = string
  description = "Deployment name for the RAFT student — surfaced to the app as VITE_RAFT_STUDENT_DEPLOYMENT."
  default     = "raft-student"
}

variable "raft_student_sku" {
  type        = string
  description = "Deployment tier for the fine-tuned student. Developer avoids the hourly hosting fee (auto-removed after 24h; redeploy with foundry/raft/redeploy_student.ps1)."
  default     = "Developer"
}
