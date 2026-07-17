$pbtok = az account get-access-token --resource "https://analysis.windows.net/powerbi/api" --query accessToken -o tsv
$h = @{ Authorization = "Bearer $pbtok"; "Content-Type" = "application/json" }
$ws = "d451f521-7e87-408f-8208-61928f1b84e3"
$model = "9d2b5e8a-a4a9-42fa-b0f9-05fbeb770ecc"

$dax = 'EVALUATE ROW("TotalTx", [Total Transactions], "FraudTx", [Fraud Transactions], "FraudRate", [Fraud Rate], "FraudAmt", [Fraud Amount], "OpenCases", [Open Cases])'

$body = @{ queries = @(@{ query = $dax }); serializerSettings = @{ includeNulls = $true } } | ConvertTo-Json -Depth 6
try {
  $r = Invoke-RestMethod -Uri "https://api.powerbi.com/v1.0/myorg/groups/$ws/datasets/$model/executeQueries" -Headers $h -Method Post -Body $body
  $r.results[0].tables[0].rows | ConvertTo-Json -Depth 6
} catch { "QERR: $($_.Exception.Message)"; $_.ErrorDetails.Message }

# Sankey flow edges sample (top flows leading to Confirmed Fraud)
$dax2 = 'EVALUATE TOPN(8, SUMMARIZECOLUMNS(fraud_flow_edges[source], fraud_flow_edges[target], "Value", [Flow Value]), [Value], DESC)'
$body2 = @{ queries = @(@{ query = $dax2 }); serializerSettings = @{ includeNulls = $true } } | ConvertTo-Json -Depth 6
try {
  $r2 = Invoke-RestMethod -Uri "https://api.powerbi.com/v1.0/myorg/groups/$ws/datasets/$model/executeQueries" -Headers $h -Method Post -Body $body2
  "--- Top Sankey flows ---"
  $r2.results[0].tables[0].rows | ConvertTo-Json -Depth 6
} catch { "QERR2: $($_.Exception.Message)"; $_.ErrorDetails.Message }
