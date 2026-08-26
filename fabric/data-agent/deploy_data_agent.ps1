param(
  [Parameter(Mandatory=$true)][string]$WorkspaceId,
  [Parameter(Mandatory=$true)][string]$LakehouseId,
  [string]$LakehouseName = "fraud_lakehouse",
  [string]$DisplayName = "Fraud Intelligence Data Agent",
  [string]$FabricToken
)

$ErrorActionPreference = "Stop"

if (-not $FabricToken) {
  $FabricToken = az account get-access-token --resource "https://api.fabric.microsoft.com" --query accessToken -o tsv
}

$headers = @{ Authorization = "Bearer $FabricToken"; "Content-Type" = "application/json" }
$baseUrl = "https://api.fabric.microsoft.com/v1/workspaces/$WorkspaceId"

function ConvertTo-InlineBase64([object]$Value) {
  $json = $Value | ConvertTo-Json -Depth 40
  return [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json))
}

function New-Element([string]$Name, [string]$Type, [object[]]$Children = @()) {
  $element = [ordered]@{
    id = [guid]::NewGuid().ToString()
    is_selected = $true
    display_name = $Name
    type = $Type
  }
  if ($Children.Count -gt 0) { $element.children = $Children }
  return $element
}

$tables = @(
  "account",
  "agent_run",
  "claim",
  "customer",
  "customer_event",
  "entity_relationship",
  "evidence",
  "fraud_alert",
  "fraud_case",
  "policy",
  "transaction"
)
$tableElements = @($tables | ForEach-Object { New-Element $_ "lakehouse_tables.table" })

$dataAgent = [ordered]@{ '$schema' = "2.1.0" }
$dataSource = [ordered]@{
  '$schema' = "1.0.0"
  artifactId = $LakehouseId
  workspaceId = $WorkspaceId
  displayName = $LakehouseName
  type = "lakehouse"
  userDescription = "Governed fraud investigation data for customers, accounts, transactions, alerts, cases, claims, evidence, relationships, agent runs, and customer events."
  dataSourceInstructions = "Use only the selected lakehouse tables. Preserve exact table and column names. Never infer facts that are absent from query results. Treat agent recommendations as advisory and requiring human approval."
  elements = @(
    New-Element "Tables" "lakehouse_tables" $tableElements
  )
}
$fewShots = [ordered]@{
  '$schema' = "1.0.0"
  fewShots = @(
    [ordered]@{
      id = [guid]::NewGuid().ToString()
      question = "Quels sont les dix signaux de fraude les plus risqués ?"
      query = "SELECT TOP 10 id, alertType, riskScore, severity, status, explanationShort FROM fraud_alert ORDER BY riskScore DESC;"
    },
    [ordered]@{
      id = [guid]::NewGuid().ToString()
      question = "Quels dossiers ouverts faut-il traiter en priorité ?"
      query = "SELECT fc.id, fc.status, fc.assignedTo, fa.alertType, fa.riskScore FROM fraud_case fc JOIN fraud_alert fa ON fc.alertId = fa.id WHERE fc.status <> 'Closed' ORDER BY fa.riskScore DESC;"
    },
    [ordered]@{
      id = [guid]::NewGuid().ToString()
      question = "Quels réparateurs concentrent le plus de sinistres ?"
      query = "SELECT repairProvider, COUNT(*) AS claimCount, SUM(amountClaimed) AS totalClaimed FROM claim GROUP BY repairProvider ORDER BY claimCount DESC;"
    },
    [ordered]@{
      id = [guid]::NewGuid().ToString()
      question = "Quels événements clients sont les plus fréquents ?"
      query = "SELECT event, COUNT(*) AS eventCount FROM customer_event GROUP BY event ORDER BY eventCount DESC;"
    }
  )
}
$stageConfig = [ordered]@{
  '$schema' = "1.0.0"
  aiInstructions = "You are a fraud investigation data agent for banking and insurance. Answer in the user's language. Ground every factual claim in query results from fraud_lakehouse, mention relevant record identifiers, distinguish evidence from interpretation, protect personal data, and state when the available data is insufficient. Do not make final case decisions; require human approval."
}
$publishInfo = [ordered]@{
  '$schema' = "1.0.0"
  description = "Published configuration grounded on fraud_lakehouse."
}

$parts = @(
  @{ path = "Files/Config/data_agent.json"; payload = ConvertTo-InlineBase64 $dataAgent; payloadType = "InlineBase64" },
  @{ path = "Files/Config/draft/stage_config.json"; payload = ConvertTo-InlineBase64 $stageConfig; payloadType = "InlineBase64" },
  @{ path = "Files/Config/draft/lakehouse-$LakehouseName/datasource.json"; payload = ConvertTo-InlineBase64 $dataSource; payloadType = "InlineBase64" },
  @{ path = "Files/Config/draft/lakehouse-$LakehouseName/fewshots.json"; payload = ConvertTo-InlineBase64 $fewShots; payloadType = "InlineBase64" },
  @{ path = "Files/Config/published/stage_config.json"; payload = ConvertTo-InlineBase64 $stageConfig; payloadType = "InlineBase64" },
  @{ path = "Files/Config/published/lakehouse-$LakehouseName/datasource.json"; payload = ConvertTo-InlineBase64 $dataSource; payloadType = "InlineBase64" },
  @{ path = "Files/Config/published/lakehouse-$LakehouseName/fewshots.json"; payload = ConvertTo-InlineBase64 $fewShots; payloadType = "InlineBase64" },
  @{ path = "Files/Config/publish_info.json"; payload = ConvertTo-InlineBase64 $publishInfo; payloadType = "InlineBase64" }
)

$items = (Invoke-RestMethod -Uri "$baseUrl/items" -Headers $headers).value
$existing = $items | Where-Object { $_.type -eq "DataAgent" -and $_.displayName -eq $DisplayName } | Select-Object -First 1
$definition = @{ parts = $parts }

if ($existing) {
  $body = @{ definition = $definition } | ConvertTo-Json -Depth 50
  $response = Invoke-WebRequest -Uri "$baseUrl/items/$($existing.id)/updateDefinition" -Headers $headers -Method Post -Body $body -UseBasicParsing
  $itemId = $existing.id
  $action = "Updated"
} else {
  $body = @{
    displayName = $DisplayName
    type = "DataAgent"
    description = "Grounded fraud investigation agent for banking and insurance."
    definition = $definition
  } | ConvertTo-Json -Depth 50
  $response = Invoke-WebRequest -Uri "$baseUrl/items" -Headers $headers -Method Post -Body $body -UseBasicParsing
  $action = "Created"
  $itemId = if ($response.StatusCode -eq 201) { ($response.Content | ConvertFrom-Json).id } else { $null }
}

$operation = $response.Headers['Location']
if ($operation -is [array]) { $operation = $operation[0] }

"ACTION=$action"
"HTTP=$($response.StatusCode)"
if ($itemId) { "DATA_AGENT_ID=$itemId" }
if ($operation) { "OPERATION=$operation" }