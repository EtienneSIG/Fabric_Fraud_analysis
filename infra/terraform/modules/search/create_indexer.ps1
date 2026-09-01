param(
  [Parameter(Mandatory = $true)][string]$SearchEndpoint,   # https://srch-fraudintel-<env>.search.windows.net
  [Parameter(Mandatory = $true)][string]$WorkspaceId,      # Fabric workspace GUID
  [Parameter(Mandatory = $true)][string]$LakehouseId,      # fraud_lakehouse item GUID
  [string]$IndexName = "fraud-corpus-index",
  [string]$CorpusPath = "corpus",                          # Files/<CorpusPath>
  # Preview surface — re-verify before a client run (the OneLake indexer is preview).
  [string]$ApiVersion = "2024-05-01-preview"
)

$ErrorActionPreference = "Stop"

# Data-plane RBAC token (module grants Search Service/Index Data Contributor to the caller).
$tok = az account get-access-token --resource "https://search.azure.com" --query accessToken -o tsv
$H = @{ Authorization = "Bearer $tok"; "Content-Type" = "application/json" }

function Put-Resource($kind, $name, $body) {
  $uri = "$SearchEndpoint/$kind/$name`?api-version=$ApiVersion"
  Invoke-RestMethod -Method Put -Uri $uri -Headers $H -Body ($body | ConvertTo-Json -Depth 12) | Out-Null
  "  $kind/$name upserted"
}

$dsName = "fraud-corpus-ds"

# 1. OneLake files data source over Files/<CorpusPath> in the lakehouse (idempotent upsert).
$dataSource = @{
  name        = $dsName
  type        = "onelake"
  credentials = @{ connectionString = "ResourceId=$WorkspaceId" }
  container   = @{ name = $LakehouseId; query = $CorpusPath }
}
Put-Resource "datasources" $dsName $dataSource

# 2. Index. Content is extracted from the markdown documents; metadata carries the corpus path.
$index = @{
  name   = $IndexName
  fields = @(
    @{ name = "id"; type = "Edm.String"; key = $true; searchable = $false; filterable = $true }
    @{ name = "content"; type = "Edm.String"; searchable = $true; filterable = $false; sortable = $false }
    @{ name = "metadata_storage_path"; type = "Edm.String"; searchable = $false; filterable = $true }
    @{ name = "metadata_storage_name"; type = "Edm.String"; searchable = $true; filterable = $true }
  )
}
Put-Resource "indexes" $IndexName $index

# 3. Indexer: base64-encode the OneLake path as the document key, extract text from markdown.
$indexer = @{
  name            = "fraud-corpus-indexer"
  dataSourceName  = $dsName
  targetIndexName = $IndexName
  parameters      = @{ configuration = @{ parsingMode = "default"; dataToExtract = "contentAndMetadata" } }
  fieldMappings   = @(
    @{ sourceFieldName = "metadata_storage_path"; targetFieldName = "id"; mappingFunction = @{ name = "base64Encode" } }
  )
}
Put-Resource "indexers" $indexer.name $indexer

# Kick a run so the corpus is indexed immediately.
Invoke-RestMethod -Method Post -Uri "$SearchEndpoint/indexers/$($indexer.name)/run`?api-version=$ApiVersion" -Headers $H | Out-Null
"DONE — indexer '$($indexer.name)' running over Files/$CorpusPath"
