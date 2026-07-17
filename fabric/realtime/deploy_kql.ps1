$cluster = "https://trd-jsagenp1qksbhfjaf5.z9.kusto.fabric.microsoft.com"
$ktok = az account get-access-token --resource $cluster --query accessToken -o tsv
$kh = @{ Authorization = "Bearer $ktok"; "Content-Type" = "application/json" }
$db = "fraud_rti"

$cmds = @(
  ".create table Transactions (Timestamp:datetime, TransactionId:string, SourceAccount:string, MerchantId:string, DeviceId:string, IpId:string, Amount:real)",
  ".create-or-alter function with (docstring='Rolling fraud features per source account (5m/1h/24h windows)', folder='fraud') rolling_features() { Transactions | where Timestamp > ago(24h) | extend age_minutes = datetime_diff('minute', now(), Timestamp) | summarize tx_count_5m = countif(age_minutes <= 5), amount_5m = sumif(Amount, age_minutes <= 5), tx_count_1h = countif(age_minutes <= 60), amount_1h = sumif(Amount, age_minutes <= 60), tx_count_24h = count(), amount_24h = sum(Amount) by SourceAccount }",
  ".create-or-alter function with (docstring='Realtime scoring features joined to transactions', folder='fraud') realtime_scoring_features() { Transactions | lookup kind=leftouter rolling_features() on SourceAccount | project Timestamp, TransactionId, SourceAccount, MerchantId, DeviceId, IpId, Amount, tx_count_5m, tx_count_1h, tx_count_24h, amount_5m, amount_1h, amount_24h }"
)

foreach ($c in $cmds) {
  $b = @{ db = $db; csl = $c } | ConvertTo-Json
  try {
    $null = Invoke-RestMethod -Uri "$cluster/v1/rest/mgmt" -Headers $kh -Method Post -Body $b
    Write-Output ("OK  : " + $c.Substring(0, [Math]::Min(55, $c.Length)))
  } catch {
    Write-Output ("FAIL: " + $c.Substring(0, [Math]::Min(55, $c.Length)) + " => " + $_.ErrorDetails.Message)
  }
}
