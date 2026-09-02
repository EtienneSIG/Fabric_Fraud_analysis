# Fraud IQ on Microsoft Foundry

This folder recreates the Foundry portion of the demo from source. It provisions
the `esigfoundry` Foundry resource, the `FraudIQ` project, the model deployments, a
delegated connection to the published Fabric Data Agent, an optional Key Vault +
Web IQ connection, and the versioned `fraud-iq-orchestrator` prompt agent.

The agent uses up to two server-side tools:

- **Web Search** retrieves current regulatory guidance with URL citations. The
  prompt limits accepted evidence to the official domains in `config.json`, and
  the validation script rejects citations outside that list. Always on.
- **Web IQ** (Microsoft Web IQ, MCP tool `conn-web-iq`) is an optional, more
  targeted regulatory grounding source. It only attaches once the real Web IQ API
  key is stored in Key Vault — see [Enable Web IQ](#enable-web-iq) below. Until
  then the agent keeps working on Web Search alone.

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
- To enable Web IQ: a Microsoft Web IQ subscription/API key.

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

The script is repeatable. Azure Resource Manager updates the infrastructure
(including a `kv-esigfoundry` Key Vault used only to store the Web IQ key),
`deploy_models.ps1` reconciles the deployments declared in `models.json`, `az rest`
creates or updates the Fabric MCP connection and (once the Web IQ key is set) the
Web IQ connection, a local `.venv` receives the pinned SDK range, and Foundry
creates a new immutable agent version.

Use `-ReplaceAgent` to delete the existing agent and recreate version 1. Use
`-SkipInfrastructure` to retain the account, project, and Key Vault while
reconciling models, the connections, and the agent. Use `-SkipModels` to leave
existing model deployments untouched. Use `-SkipKeyVault` to skip Key Vault
provisioning and the Web IQ connection lookup entirely (keeps the agent on Web
Search only). Use `-SkipValidation` only when delegated Fabric consent cannot be
completed during deployment.

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

## Enable Web IQ

Web IQ is prepared but stays off until a real API key is available — this repo has
no access to your Foundry/Web IQ subscription, so finish this step yourself:

1. Deploy (or redeploy) once to provision `kv-esigfoundry`:
   ```powershell
   & foundry/deploy_foundry.ps1 -SubscriptionId "<subscription-id>" -ResourceGroup "esig_demo"
   ```
   If you're not the Key Vault data-plane admin yet, add
   `-KeyVaultAdminPrincipalId "<your-object-id>"` (or grant yourself **Key Vault
   Secrets Officer** on `kv-esigfoundry` with `az role assignment create`).
2. Store your Web IQ API key as the `webiq-api-key` secret:
   ```powershell
   az keyvault secret set --vault-name "kv-esigfoundry" --name "webiq-api-key" --value "<your-web-iq-api-key>"
   ```
3. Rerun the deployment (infra is idempotent, so `-SkipInfrastructure` is optional
   but faster once the vault already exists):
   ```powershell
   & foundry/deploy_foundry.ps1 -SubscriptionId "<subscription-id>" -ResourceGroup "esig_demo" -SkipInfrastructure
   ```
   The script reads the secret, creates/updates the `conn-web-iq` connection, and
   redeploys `fraud-iq-orchestrator` with the Web IQ MCP tool attached. Validation
   (step 4 below) then exercises whichever tool the agent actually used.
4. Confirm it worked: rerun without `-SkipValidation` (the default) and check the
   printed `AGENT_ID`/`VALIDATION=PASS` output, or open the project in the Foundry
   portal and inspect the `fraud-iq-orchestrator` tool list for `mcp`/`webiq`.

If the secret is missing or empty, the script prints a warning and deploys with
Web Search only — it never fails the deployment for this reason.

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

`config.json` versions the agent name, connection names (`fabricConnectionName`,
`webIqConnectionName`), deployed model, Web IQ MCP URL/secret name, regulatory
domain allow-list, and validation question. The default Fabric identifiers are the
deployed demo resources:

- Workspace: `c57a379b-7e6d-481a-9c9b-662bb0bae77d`
- Data Agent: `5e157d5a-2694-499b-9b9f-ed10fe73cb5a`
- MCP endpoint: `https://api.fabric.microsoft.com/v1/mcp/workspaces/{workspaceId}/dataagents/{dataAgentId}/agent`

For hard server-side domain restriction, connect a Grounding with Bing Custom Search
instance and replace `WebSearchTool` with its custom-search configuration. The current
implementation enforces the official-domain policy in the agent instructions and in
post-run validation, without provisioning a separate paid Bing Custom Search resource.
