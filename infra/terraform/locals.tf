locals {
  workload = "fraudintel"
  suffix   = "${local.workload}-${var.environment}"

  # Single source of truth for resource names (see naming.instructions.md).
  names = {
    resource_group = "rg-${local.suffix}"
    key_vault      = "kv-${local.workload}${var.environment}" # KV: no dashes, <=24 chars
    log_analytics  = "log-${local.suffix}"
    app_insights   = "appi-${local.suffix}"
    ai_foundry     = "aif-${local.suffix}"
    eventhub_ns    = "evhns-${local.suffix}"
    eventhub       = "fraud-transactions"
    bot            = "bot-${local.suffix}"
    function_app   = "func-${local.workload}-bot-${var.environment}"
    func_identity  = "id-${local.workload}-bot-${var.environment}"
    storage        = "st${local.workload}${var.environment}" # storage: no dashes, <=24 chars
    entra_app      = "fraudintel-graph-obo-${var.environment}"
    fabric_conn    = "conn-fabric-fraud-dataagent"
    ai_search      = "srch-${local.suffix}"
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

  model_deployments = {
    orchestrator = var.model_orchestrator
    reasoning    = var.model_reasoning
    extraction   = var.model_extraction
    embeddings   = var.model_embeddings
  }
}
