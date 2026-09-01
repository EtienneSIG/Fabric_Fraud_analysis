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
| Microsoft Foundry project | [FraudIQ](https://ai.azure.com/nextgen/r/FyQciQyGSOm9599wsQw5qg,esig_demo,,esigfoundry,FraudIQ/home?tid=b7b9a0c6-fe36-41b6-a38d-582c6573e2ff) | Tenant authentication required |

Live application: https://tangy-cove-9493188f6d-centralus.webapp.fabricapps.net

The Lakehouse contains 11 Delta tables and 12,826 source rows. The Ontology binds
those tables to 11 entity types and 11 relationship types. The Data Agent is
published against all 11 tables with evidence-based, human-in-the-loop guidance.

A companion orchestration in **Microsoft Foundry**, defined under `foundry/`, connects
that Fabric Data Agent to regulatory web grounding. It accepts evidence only from the
official domains versioned in `foundry/config.json` and returns source links alongside
the relevant obligations. The orchestrator combines those cited regulations with the
governed case facts; its output remains advisory and subject to human approval.

## Prerequisites

- PowerShell 7, Node.js, npm, Python, and Azure CLI.
- Contributor access to the target Fabric workspace.
- Contributor access to the Azure resource group used for Foundry provisioning.
- Foundry User access to create and execute project agents.
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

### 4b. Microsoft Foundry orchestration

The Foundry resources are defined in `foundry/` and can be recreated with:

```powershell
& foundry/deploy_foundry.ps1 `
  -SubscriptionId "<subscription-id>" `
  -ResourceGroup "esig_demo" `
  -Location "eastus"
```

Open the authenticated [FraudIQ Foundry project](https://ai.azure.com/nextgen/r/FyQciQyGSOm9599wsQw5qg,esig_demo,,esigfoundry,FraudIQ/home?tid=b7b9a0c6-fe36-41b6-a38d-582c6573e2ff)
to inspect the deployed agent and traces. The deployed flow contains:

1. An orchestrator agent for fraud and AML investigations.
2. A connection to the published `Fraud Intelligence Data Agent` for governed case facts.
3. A regulatory research agent with web grounding limited to official regulatory domains.
4. A synthesis step that preserves citations and requires investigator approval before action.

The deployment runs an end-to-end regulatory question and fails if the answer has no
citations or cites a domain outside `foundry/config.json`. Fabric uses delegated user
identity; if the first run returns `CONSENT_REQUIRED`, complete the provided OAuth URL and
rerun with `-SkipInfrastructure`. See `foundry/README.md` for prerequisites and controls.

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

## RAFT — document reasoning (WS-1 → WS-10)

Optional and off by default. Adds the fraud document corpus, an AI Search index, a Foundry IQ
knowledge base, and the fine-tuned AML student model with its in-app A/B compare + Model Quality
tab. The app stays mock-first until `VITE_RAFT_ENABLED=true` **and** a student deployment is wired.

### F1. Corpus → OneLake (WS-1)

```powershell
& fabric/lakehouse/corpus/upload_corpus.ps1 `
  -Ws "<workspace-id>" -Lh "<lakehouse-id>"
```

### F2. AI Search + OneLake indexer (WS-2)

```powershell
cd infra/terraform
$a = "-var=enable_search=true"; terraform apply $a          # provisions srch-<suffix>
& modules/search/create_indexer.ps1 `
  -SearchEndpoint (terraform output -raw ai_search_endpoint) `
  -WorkspaceId "<workspace-id>" -LakehouseId "<lakehouse-id>"
cd ../..
```

### F3. Foundry IQ knowledge base (WS-3) and agent wiring

```powershell
& foundry/knowledge/deploy_knowledge.ps1 `
  -FoundryEndpoint (terraform -chdir=infra/terraform output -raw ai_foundry_endpoint) `
  -WorkspaceId "<workspace-id>" -LakehouseId "<lakehouse-id>" `
  -SearchEndpoint (terraform -chdir=infra/terraform output -raw ai_search_endpoint)

# Re-run the agent topology with the knowledge tool attached:
& foundry/agents/deploy_agents.ps1 `
  -FoundryEndpoint (terraform -chdir=infra/terraform output -raw ai_foundry_endpoint) `
  -FabricDataAgentUrl "<published-data-agent-url>" `
  -KnowledgeConnectionName "conn-onelake-fraud-corpus"
```

### F4. Generate the dataset (WS-4/WS-5) — local or Fabric

```powershell
# Local / papermill:
cd foundry/raft; uv sync
$env:AI_FOUNDRY_ENDPOINT = "<aoai-endpoint>"
papermill 1_gen.ipynb out/1_gen.ipynb -f parameters/gpt-4.1-mini.yaml; cd ../..

# Or in Fabric (OneLake-native, schedulable):
& foundry/raft/fabric/deploy_pipeline.ps1 -Ws "<workspace-id>"
```

### F5. Fine-tune + deploy the student (WS-6) — Developer tier

Run `foundry/raft/2_finetune.ipynb` then `3_deploy.ipynb` (or the 100 % portal path in
[raft-finetune-foundry-ui.md](raft-finetune-foundry-ui.md)). Then surface it via Terraform:

```powershell
cd infra/terraform
$m = "-var=raft_student_ft_model_id=gpt-4.1-mini.ft-<jobid>"; terraform apply $m
cd ../..
```

> **Developer-tier deployments are auto-removed after 24 h.** Recreate on demo morning:
> `& foundry/raft/redeploy_student.ps1`.

### F6. Turn RAFT on in the app

Add to `.env.local`, then rebuild:

```
VITE_RAFT_ENABLED=true
VITE_RAFT_STUDENT_DEPLOYMENT=<student deployment name>
```

Backend env for the live A/B + eval routes (`raft/compare`, `raft/eval`): `AI_FOUNDRY_ENDPOINT`,
`RAFT_STUDENT_DEPLOYMENT`, optionally `RAFT_BASELINE_DEPLOYMENT` (default `gpt-4.1`), and
`ONELAKE_WORKSPACE` / `ONELAKE_LAKEHOUSE` for live eval results.

## Demo modes & graceful degradation

Every integration degrades to a deterministic mock when not configured, and the app **marks the
state**: a discreet **mode badge** in the header (grey *Demo · mock* / amber *Partial* / green
*Live*, with a per-integration tooltip) plus per-panel *Simulated* / *sample* labels on the AML A/B
and Model Quality views. Check readiness before a session:

```powershell
& scripts/demo-readiness.ps1 -EnvFile fabric-fraud-intelligence/.env.local -BackendUrl "<backend>"
```

- **Full mock** (default): nothing wired — 100 % offline, deterministic. Safest for the room.
- **Partial live**: e.g. Foundry agents live, RAFT still mock — the badge shows amber.
- **Live**: all flags set + student deployed + backend routes reachable.
