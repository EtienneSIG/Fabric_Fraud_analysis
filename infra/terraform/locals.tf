locals {
  workload      = "fraudintel"
  suffix        = "${local.workload}-${var.environment}"
  unique_suffix = substr(md5("${var.subscription_id}-${var.environment}"), 0, 6)

  # Single source of truth for resource names (see naming.instructions.md).
  names = {
    resource_group = "rg-${local.suffix}"
    key_vault      = "kv-${local.workload}${var.environment}${local.unique_suffix}" # KV: no dashes, <=24 chars
    log_analytics  = "log-${local.suffix}"
    app_insights   = "appi-${local.suffix}"
    ai_foundry     = "aif-${local.suffix}-${local.unique_suffix}"
    eventhub_ns    = "evhns-${local.suffix}-${local.unique_suffix}"
    eventhub       = "fraud-transactions"
    bot            = "bot-${local.suffix}-${local.unique_suffix}"
    function_app   = "func-${local.workload}-bot-${var.environment}-${local.unique_suffix}"
    func_identity  = "id-${local.workload}-bot-${var.environment}"
    storage        = "st${local.workload}${var.environment}${local.unique_suffix}" # storage: no dashes, <=24 chars
    entra_app      = "fraudintel-graph-obo-${var.environment}"
    fabric_conn    = "conn-fabric-fraud-dataagent"
    ai_search      = "srch-${local.suffix}-${local.unique_suffix}"
  }

  # Least-privilege delegated Microsoft Graph scopes for the analyst-driven (OBO) flows.
  graph_delegated_scopes = [
    "User.Read",
    "Mail.Send",
    "Calendars.Read",
    "Files.ReadWrite.All",
    "Sites.ReadWrite.All",
    "ChannelMessage.Send",
  ]

  foundry_endpoint = var.existing_foundry_project_endpoint != "" ? var.existing_foundry_project_endpoint : azurerm_cognitive_account.this.endpoint

  model_deployments = var.existing_foundry_project_endpoint == "" ? {
    orchestrator = { name = var.model_orchestrator, version = var.model_orchestrator_version }
    reasoning    = { name = var.model_reasoning, version = var.model_reasoning_version }
    extraction   = { name = var.model_extraction, version = var.model_extraction_version }
    embeddings   = { name = var.model_embeddings, version = var.model_embeddings_version }
  } : {}
}
