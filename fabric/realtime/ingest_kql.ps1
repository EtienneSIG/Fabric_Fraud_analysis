$cluster = "https://trd-jsagenp1qksbhfjaf5.z9.kusto.fabric.microsoft.com"
$ktok = az account get-access-token --resource $cluster --query accessToken -o tsv
$kh = @{ Authorization = "Bearer $ktok"; "Content-Type" = "application/json" }
$db = "fraud_rti"

$rng = [System.Random]::new(42)
$now = Get-Date
$rows = New-Object System.Collections.Generic.List[string]
for ($i = 0; $i -lt 800; $i++) {
    $ts = $now.AddMinutes(-1 * $rng.Next(0, 1440)).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    $tid = "T9{0:D7}" -f $i
    $acc = "A{0:D6}" -f $rng.Next(0, 7000)
    $mer = "M{0:D5}" -f $rng.Next(0, 1200)
    $dev = "D{0:D6}" -f $rng.Next(0, 3500)
    $ip  = "IP{0:D6}" -f $rng.Next(0, 2500)
    $amt = [math]::Round((Get-Random -Minimum 5 -Maximum 4000) + $rng.NextDouble(), 2)
    $rows.Add("$ts,$tid,$acc,$mer,$dev,$ip,$amt")
}
# inject a velocity burst for one account in the last 10 minutes
$burstAcc = "A006999"
for ($j = 0; $j -lt 25; $j++) {
    $ts = $now.AddSeconds(-1 * $rng.Next(0, 600)).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    $tid = "TB{0:D6}" -f $j
    $mer = "M{0:D5}" -f $rng.Next(0, 1200)
    $dev = "D000001"
    $ip  = "IP000001"
    $amt = [math]::Round((Get-Random -Minimum 800 -Maximum 5000) + $rng.NextDouble(), 2)
    $rows.Add("$ts,$tid,$burstAcc,$mer,$dev,$ip,$amt")
}

$csv = ($rows -join "`n")
$csl = ".ingest inline into table Transactions with (format='csv') <|`n$csv"
$body = @{ db = $db; csl = $csl } | ConvertTo-Json
try {
    Invoke-RestMethod -Uri "$cluster/v1/rest/mgmt" -Headers $kh -Method Post -Body $body | Out-Null
    "INGESTED $($rows.Count) rows"
} catch {
    "INGEST_FAIL: $($_.Exception.Message)"; $_.ErrorDetails.Message
}

# verify
$q = @{ db = $db; csl = "Transactions | summarize total=count(), last24h=countif(Timestamp > ago(24h)), distinct_accounts=dcount(SourceAccount)" } | ConvertTo-Json
try {
    $r = Invoke-RestMethod -Uri "$cluster/v1/rest/query" -Headers $kh -Method Post -Body $q
    "VERIFY: " + ($r.Tables[0].Rows | ConvertTo-Json -Compress)
} catch { "VERIFY_FAIL: $($_.ErrorDetails.Message)" }
