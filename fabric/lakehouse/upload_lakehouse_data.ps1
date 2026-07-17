param(
  [string]$Ws = "d451f521-7e87-408f-8208-61928f1b84e3",
  [string]$Lh = "67f6d900-b355-4727-b49b-4e05096cf8e7",
  [string]$Dir = "c:\Users\esigwald\01_Dev\Fraud\artifacts\lakehouse_data",
  [string]$Dest = "appdata"
)

$ErrorActionPreference = "Stop"

# Verify the lakehouse exists
$fabTok = az account get-access-token --resource "https://api.fabric.microsoft.com" --query accessToken -o tsv
$fh = @{ Authorization = "Bearer $fabTok" }
$lhs = (Invoke-RestMethod -Uri "https://api.fabric.microsoft.com/v1/workspaces/$Ws/lakehouses" -Headers $fh).value
$match = $lhs | Where-Object { $_.id -eq $Lh }
if (-not $match) {
  "Lakehouses found: " + (($lhs | ForEach-Object { $_.displayName + '=' + $_.id }) -join ', ')
  throw "Lakehouse $Lh not found in workspace $Ws"
}
"Lakehouse OK: $($match.displayName) ($Lh)"

# Upload files via OneLake DFS (ADLS Gen2) API
$stTok = az account get-access-token --resource "https://storage.azure.com" --query accessToken -o tsv
$H = @{ Authorization = "Bearer $stTok" }
$base = "https://onelake.dfs.fabric.microsoft.com/$Ws/$Lh/Files/$Dest"
$chunk = 3145728  # 3 MB

foreach ($f in Get-ChildItem $Dir -Filter *.jsonl) {
  $url = "$base/$($f.Name)"
  Invoke-WebRequest -Method Put -Uri "${url}?resource=file" -Headers $H -UseBasicParsing | Out-Null
  $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
  $len = $bytes.Length
  $pos = 0
  while ($pos -lt $len) {
    $size = [Math]::Min($chunk, $len - $pos)
    $slice = New-Object byte[] $size
    [Array]::Copy($bytes, $pos, $slice, 0, $size)
    Invoke-WebRequest -Method Patch -Uri "${url}?action=append&position=$pos" -Headers $H -Body $slice -ContentType "application/octet-stream" -UseBasicParsing | Out-Null
    $pos += $size
  }
  Invoke-WebRequest -Method Patch -Uri "${url}?action=flush&position=$len" -Headers $H -UseBasicParsing | Out-Null
  "uploaded Files/$Dest/$($f.Name) ($len bytes)"
}
"DONE"
