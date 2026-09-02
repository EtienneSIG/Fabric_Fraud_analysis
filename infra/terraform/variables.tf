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

variable "name_suffix" {
  type        = string
  description = "Overrides the computed unique name suffix. Set to \"\" to reproduce legacy un-suffixed names for an env deployed before the suffix existed. Leave null for the default md5-derived suffix."
  default     = null
}

variable "enable_fabric_workspace" {
  type        = bool
  description = "Create a BILLED Fabric capacity (F SKU) + workspace to host the Rayfin app. Off by default — the capacity is billed hourly; pause it when idle."
  default     = false
}

variable "fabric_capacity_sku" {
  type        = string
  description = "Fabric capacity SKU. F2 is the smallest/cheapest."
  default     = "F2"
}

variable "fabric_admin_member" {
  type        = string
  description = "Fabric capacity admin. Entra USER -> UPN; service principal -> object id. Empty falls back to the deployer object id."
  default     = ""
}

variable "fabric_workspace_name" {
  type        = string
  description = "Display name of the Fabric workspace created for the app."
  default     = "Fraud Intelligence"
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
  default     = "2026-07-09"
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
  default     = "2026-07-09"
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

variable "foundry_project_name" {
  type        = string
  description = "Name of the Foundry project (Agent Service) created under the AI Services account."
  default     = "fraud-intelligence"
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

variable "enable_fraudiq_spa" {
  type        = bool
  description = "Create the public SPA app registration (rayfin-fraudiq-spa) for the direct-browser Foundry IQ path. Off by default; requires directory-write rights."
  default     = false
}

variable "fraudiq_spa_redirect_uris" {
  type        = list(string)
  description = "SPA redirect URIs for rayfin-fraudiq-spa — the .../msal-redirect.html and .../popup-relay.html of each app origin (Rayfin prod host + localhost)."
  default = [
    "https://mild-falls-763438f7b8-swedencentral.webapp.fabricapps.net/msal-redirect.html",
    "https://mild-falls-763438f7b8-swedencentral.webapp.fabricapps.net/popup-relay.html",
    "http://localhost:5173/msal-redirect.html",
    "http://localhost:5173/popup-relay.html",
  ]
}

variable "fraudiq_analyst_object_ids" {
  type        = list(string)
  description = "Entra object ids (users/groups) granted the Foundry data-plane role for the direct-browser Foundry IQ path. Empty = manage none (grant out of band). Do NOT re-list a principal already granted manually — it 409s unless imported."
  default     = []
}

variable "fraudiq_analyst_role" {
  type        = string
  description = "Data-plane role granted to fraudiq_analyst_object_ids on the Foundry account. 'Cognitive Services User' is the portable choice; 'Azure AI User' may not exist in every tenant."
  default     = "Cognitive Services User"
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
