# Search module (WS-2) — Azure AI Search over the OneLake corpus

Provides the retrieval layer RAFT is trained against, and the real backing for the app's
Foundry IQ. Terraform provisions the **service, its managed identity and data-plane RBAC**;
the OneLake **data source, index and indexer** are created by
[`create_indexer.ps1`](./create_indexer.ps1) because the `azurerm` provider does not model
the OneLake files indexer (a preview feature).

## What Terraform provisions

- `azurerm_search_service` — **Basic tier or higher** (the free tier cannot run the OneLake
  indexer), with a system-assigned managed identity.
- Data-plane role assignments (`Search Service Contributor`, `Search Index Data Contributor`)
  for the deploying principal, so `create_indexer.ps1` can authenticate with an AAD token
  instead of admin keys.

## Hard prerequisites

- **Same tenant as the Fabric workspace.** The OneLake indexer cannot be created if the
  search service is in a different tenant.
- Creating and assigning the managed identity requires **Owner** or **User Access
  Administrator** on the resource group.
- The search service identity must be granted a **Fabric workspace Viewer** role on the
  workspace that owns `fraud_lakehouse`. This is a Fabric-plane grant, not an Azure RBAC
  assignment — it is intentionally out of Terraform. Use the module output
  `identity_principal_id`.

Management-plane roles alone are not sufficient for the data-plane index/indexer actions.

## Creating the index and indexer

After `terraform apply` (with `enable_search = true`):

```powershell
& infra/terraform/modules/search/create_indexer.ps1 `
  -SearchEndpoint "<search_endpoint output>" `
  -WorkspaceId    "c57a379b-7e6d-481a-9c9b-662bb0bae77d" `
  -LakehouseId    "257366a1-4675-4c66-a69e-1ec7ab653706" `
  -CorpusPath     "corpus"
```

Upload the corpus first with `fabric/lakehouse/corpus/upload_corpus.ps1`.

> The OneLake indexer is a preview feature; re-verify `-ApiVersion` and the data-source
> shape against current Azure AI Search documentation before a client run.
