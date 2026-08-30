# Fabric deployment

This document records the currently deployed Fabric Fraud Intelligence environment
and the scripts used to reproduce it. Item IDs identify deployed resources but do
not grant access; authentication and workspace permissions are still required.

## Current environment

| Resource | Display name | Item ID |
| --- | --- | --- |
| Workspace | Fraud Intelligence | `c57a379b-7e6d-481a-9c9b-662bb0bae77d` |
| Rayfin app | Fabric Fraud Intelligence | `92debd6c-91f7-41c5-84bd-5768142108be` |
| Fabric SQL database | Application database | `6609ad24-166c-447c-a0fa-8154a438c5ac` |
| Lakehouse | fraud_lakehouse | `257366a1-4675-4c66-a69e-1ec7ab653706` |
| Notebook | load_app_data | `4233149f-5e14-46d0-abcb-21e4e84d05a1` |
| Ontology | fraud_ontology | `63594cf9-f0d8-477b-ae09-01702415fb7b` |
| Data Agent | Fraud Intelligence Data Agent | `5e157d5a-2694-499b-9b9f-ed10fe73cb5a` |
| Eventhouse | fraud_eventhouse | `adef1cdd-dbd2-499e-a2c6-fbd0d608c080` |
| KQL database | fraud_rti | `2993fbea-f2b2-405a-94eb-7e38fc281665` |
| Semantic model | Rayfin_FraudModel | `c7f098a6-ed7f-4300-960c-b3bd07a6d020` |
| Report | Rayfin_FraudCockpit | `cbcafc47-60f6-4e1a-ab84-a4eb41aee703` |

Live application: https://tangy-cove-9493188f6d-centralus.webapp.fabricapps.net

The Lakehouse contains 11 Delta tables and 12,826 source rows. The Ontology binds
those tables to 11 entity types and 11 relationship types. The Data Agent is
published against all 11 tables with evidence-based, human-in-the-loop guidance.

## Prerequisites

- PowerShell 7, Node.js, npm, Python, and Azure CLI.
- Contributor access to the target Fabric workspace.
- An Azure CLI or Rayfin session authenticated in the target Microsoft Entra tenant.
- The `fabric-fraud-intelligence` npm dependencies installed.

Keep tenant-specific values outside committed environment files. The commands below
accept the tenant ID as a parameter where it is required.

## Deployment order

Run the commands from the repository root.

### 1. Rayfin application

```powershell
Set-Location fabric-fraud-intelligence
npm install
npm run build
npx rayfin up --workspace-id "c57a379b-7e6d-481a-9c9b-662bb0bae77d"
Set-Location ..
```

### 2. Lakehouse and load notebook

```powershell
& fabric/lakehouse/run_load.ps1
```

This creates or updates `fraud_lakehouse`, publishes `load_app_data`, uploads the
JSONL source files, and materializes the 11 application tables.

### 3. Fabric IQ Ontology

```powershell
python fabric/ontology/build_ontology.py `
  --workspace-id "c57a379b-7e6d-481a-9c9b-662bb0bae77d" `
  --lakehouse-id "257366a1-4675-4c66-a69e-1ec7ab653706"

& fabric/ontology/post_ontology.ps1 `
  -Ws "c57a379b-7e6d-481a-9c9b-662bb0bae77d" `
  -TenantId "<tenant-id>"
```

The deployer is idempotent. An existing item is reported as `STATUS=EXISTS` with
its `ONTOLOGY_ID` and portal URL rather than failing on HTTP 409.

### 4. Fabric Data Agent

```powershell
& fabric/data-agent/deploy_data_agent.ps1 `
  -WorkspaceId "c57a379b-7e6d-481a-9c9b-662bb0bae77d" `
  -LakehouseId "257366a1-4675-4c66-a69e-1ec7ab653706"
```

The script creates the agent or updates the definition of an existing agent with
the same display name.

### 5. Eventhouse and KQL objects

```powershell
& fabric/realtime/deploy_kql.ps1 `
  -Cluster "<eventhouse-query-uri>" `
  -Database "fraud_rti"

& fabric/realtime/ingest_kql.ps1 `
  -Cluster "<eventhouse-query-uri>" `
  -Database "fraud_rti"
```

### 6. Power BI model and report

```powershell
& fabric/powerbi/deploy_model.ps1 `
  -Workspace "c57a379b-7e6d-481a-9c9b-662bb0bae77d" `
  -Server "<lakehouse-sql-endpoint>"

& fabric/powerbi/deploy_report.ps1 `
  -Workspace "c57a379b-7e6d-481a-9c9b-662bb0bae77d" `
  -ModelId "c7f098a6-ed7f-4300-960c-b3bd07a6d020"
```

Check each script's parameters before targeting another workspace; connection and
item IDs are environment-specific.

## Validation

```powershell
# Application
Set-Location fabric-fraud-intelligence
npm test -- --run
npm run build
Set-Location ..

# Ontology existence and target tenant
& fabric/ontology/post_ontology.ps1 `
  -Ws "c57a379b-7e6d-481a-9c9b-662bb0bae77d" `
  -TenantId "<tenant-id>"

# Deployed semantic model
& fabric/powerbi/validate_model.ps1 `
  -Workspace "c57a379b-7e6d-481a-9c9b-662bb0bae77d" `
  -ModelId "c7f098a6-ed7f-4300-960c-b3bd07a6d020"
```

## Current limitations

### Realtime ingestion identity

The Rayfin authentication client cannot currently acquire the required Kusto
audience token in this tenant and returns `AADSTS65002`. The Eventhouse, KQL
database, table, and scoring functions are deployed, but seeding transactions
requires an Azure CLI identity, service principal, or managed identity authorized
for the Kusto endpoint.

### Power BI compatibility tables

The historical semantic model expects `transactions`, `fraud_clusters`, `alerts`,
`fraud_cases`, `merchants`, `customers`, and `fraud_flow_edges`. The application
notebook currently produces the 11 singular application tables instead. The model
and report items can be deployed, but their visuals are not data-valid until a
compatibility ETL materializes these seven analytical tables and the model refresh
completes successfully.

### Data Agent conversations

The public Fabric REST API supports Data Agent lifecycle and definition management,
but does not expose a conversation endpoint. The application therefore retains its
deterministic grounded fallback for in-app agent responses.

## Extended integrations (Foundry Agent Service + O365)

These are optional and off by default; the app stays mock-first until the flags are set.

### A. Azure support infrastructure (Terraform)

```powershell
cd infra/terraform
Copy-Item terraform.tfvars.example terraform.tfvars   # edit subscription_id / tenant_id
terraform init
terraform validate
terraform plan -out tfplan
terraform apply tfplan            # only with your confirmation
```

Provisions Foundry (AI Services + model deployments), Key Vault, Event Hub, Log Analytics,
the Teams **Azure Bot**, the **Azure Function** (bot `/api/messages` endpoint) and the
**delegated (OBO)** Graph app registration. See [infra/terraform/README.md](../infra/terraform/README.md).

### B. Foundry agents (connected-agent topology)

```powershell
& foundry/agents/deploy_agents.ps1 `
  -FoundryEndpoint (terraform -chdir=infra/terraform output -raw ai_foundry_endpoint) `
  -FabricDataAgentUrl "<published-data-agent-url>"
```

Creates `conn-fabric-fraud-dataagent` and the `fraud-triage-agent` orchestrator delegating to
`fraud-investigation-agent` / `fraud-aml-agent` / `fraud-claims-agent`, grounded on Fabric with OBO.

### C. Backend

Mount the handlers in [backend/](../backend/) on the Rayfin `functions` service (preferred), and
deploy the Azure Function for the Teams bot endpoint. Point the SPA at it via `VITE_BACKEND_API_URL`.

### D. Teams app

Package and side-load [teams/](../teams/) (`manifest.json` uses the `bot_app_id` output).

### E. Turn it on

In `.env.local` (see [.env.example](../fabric-fraud-intelligence/.env.example)):

```
VITE_FABRIC_APP_MODE=fabric
VITE_BACKEND_API_URL=<backend url>
VITE_FOUNDRY_ENDPOINT=<tf ai_foundry_endpoint>
VITE_GRAPH_OBO_CLIENT_ID=<tf graph_obo_client_id>
VITE_FOUNDRY_ENABLED=true
VITE_WORKIQ_ENABLED=true
VITE_TEAMS_ENABLED=true
```
