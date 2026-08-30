# Azure support infrastructure (Terraform)

Provisions the **Azure support layer** for the Fabric Fraud Intelligence demo. Fabric items
(Lakehouse, Ontology, Data Agent, Eventhouse, Power BI) stay with the PowerShell + REST scripts
under [`../../fabric/`](../../fabric/); this stack only covers Azure-side resources.

## What it creates
- Resource group, Log Analytics workspace + Application Insights
- Key Vault (RBAC data plane) holding the Graph OBO and Bot secrets
- **Microsoft Foundry** AI Services account + model deployments (orchestrator / reasoning / extraction / embeddings)
- Event Hub namespace + `fraud-transactions` hub (real-time source)
- Storage + **Azure Function (Flex Consumption)** hosting the Teams Bot `/api/messages` endpoint
- **Azure Bot** + Teams channel (own app identity)
- Entra app registration for Microsoft Graph — **delegated (OBO)**, least-privilege scopes

The Foundry **project and agents** are created by
[`../../foundry/agents/deploy_agents.ps1`](../../foundry/agents/deploy_agents.ps1) after `apply`.

## Usage
```powershell
cd infra/terraform
Copy-Item terraform.tfvars.example terraform.tfvars   # then edit
terraform init
terraform fmt -check
terraform validate
terraform plan -out tfplan
# review, then (only with your confirmation):
terraform apply tfplan
```

## Wiring the app
Map outputs to the SPA's `VITE_*` env (see `fabric-fraud-intelligence/src/backend/config.ts`):

| Terraform output | App env var |
| --- | --- |
| `ai_foundry_endpoint` | `VITE_FOUNDRY_ENDPOINT` |
| `graph_obo_client_id` | `VITE_GRAPH_OBO_CLIENT_ID` |
| `tenant_id` | `VITE_FABRIC_TENANT_ID` |
| `function_app_name` / `bot_messaging_endpoint` | backend / Teams manifest |

## Notes
- Model names are variables; confirm region quota (`azure-quotas`) before apply.
- No secrets are emitted as plaintext outputs — they live in Key Vault, read via managed identity.
