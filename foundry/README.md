# Fraud IQ on Microsoft Foundry

This folder recreates the Foundry portion of the demo from source. It provisions
the `esigfoundry` Foundry resource, the `FraudIQ` project, the model deployments, a
delegated connection to the published Fabric Data Agent, and the versioned
`fraud-iq-orchestrator` prompt agent.

The agent uses one server-side tool:

- **Web IQ** is the application experience for current regulatory grounding. It is
  powered by Foundry's native **Web Search** tool and requires no separate API key.
  Web Search retrieves current guidance with URL citations. The
  prompt limits accepted evidence to the official domains in `config.json`, and
  the validation script rejects citations outside that list. Always on.

The Fabric Data Agent connection remains provisioned for other consumers, but it is
not attached to `fraud-iq-orchestrator` as a tool.

## Prerequisites

- Azure CLI and Python 3.9 or later.
- Contributor access to the target resource group while provisioning.
- Foundry Account Owner or equivalent permission to create the account and project.
- Foundry User on the project to create and run the agent.
- Access to the Fabric workspace, Data Agent, and its Lakehouse source.
- A paid Fabric F2 or higher capacity and a published Fabric Data Agent.
- Web Search enabled for the target Azure subscription.

Web Search sends generated search queries outside the Azure compliance and geography
boundary and incurs separate usage charges. Do not include customer or case data in
search queries. The agent instructions explicitly separate generic regulatory search
terms from governed Fabric evidence. The same restriction applies to Web IQ queries.

## Deploy from scratch

Authenticate to the tenant and run the single deployment entry point from the
repository root:

```powershell
az login --tenant "<tenant-id>"
& foundry/deploy_foundry.ps1 `
  -SubscriptionId "<subscription-id>" `
  -ResourceGroup "esig_demo" `
  -Location "eastus"
```

The script is repeatable. Azure Resource Manager updates the infrastructure,
`deploy_models.ps1` reconciles the deployments declared in `models.json`, `az rest`
creates or updates the Fabric MCP connection, a local `.venv` receives the pinned
SDK range, and Foundry creates a new immutable agent version.

Use `-ReplaceAgent` to delete the existing agent and recreate version 1. Use
`-SkipInfrastructure` to retain the account and project while
reconciling models, the connections, and the agent. Use `-SkipModels` to leave
existing model deployments untouched. Use `-SkipValidation` only when the
regulatory citation check cannot be completed during deployment.

To deploy or verify only the model catalog:

```powershell
& foundry/deploy_models.ps1 `
  -SubscriptionId "<subscription-id>" `
  -ResourceGroup "esig_demo" `
  -FoundryAccountName "esigfoundry"
```

Existing deployments with matching settings are reported as `UNCHANGED`. A
different existing deployment is protected from replacement unless `-Force` is
specified. The manifest includes the three GPT deployments, MAI Image, and the
embedding deployment used by this project.

## Validate Web IQ

Web IQ is enabled whenever the deployed agent contains the native `web_search`
tool. No separate key or connection is required. Run the standard deployment
without `-SkipValidation`; success prints `VALIDATION=PASS` and the official source
URLs returned by the agent. You can also inspect `fraud-iq-orchestrator` in the
Foundry portal and confirm that its tool list contains `web_search`.

## Fabric connection consent

The optional Fabric Data Agent connection uses delegated user authentication. Consumers
that attach it to another agent must have access to the Data Agent and its source data.
On the first query, Foundry can return `CONSENT_REQUIRED`; open the consent URL from
that error, authenticate, and rerun:

```powershell
& foundry/deploy_foundry.ps1 `
  -SubscriptionId "<subscription-id>" `
  -SkipInfrastructure
```

This interactive consent cannot be stored in source control or replaced with a
secret. It is part of Fabric's permission enforcement.

## Configuration

`config.json` versions the agent name, Fabric connection name, deployed model,
regulatory domain allow-list, and validation question. The default Fabric identifiers are the
deployed demo resources:

- Workspace: `c57a379b-7e6d-481a-9c9b-662bb0bae77d`
- Data Agent: `5e157d5a-2694-499b-9b9f-ed10fe73cb5a`
- MCP endpoint: `https://api.fabric.microsoft.com/v1/mcp/workspaces/{workspaceId}/dataagents/{dataAgentId}/agent`

For hard server-side domain restriction, connect a Grounding with Bing Custom Search
instance and replace `WebSearchTool` with its custom-search configuration. The current
implementation enforces the official-domain policy in the agent instructions and in
post-run validation, without provisioning a separate paid Bing Custom Search resource.
