param(
  [Parameter(Mandatory=$true)][string]$Ws,
  [Parameter(Mandatory=$true)][string]$Lh,
  [string]$Dir = (Join-Path $PSScriptRoot "."),
  [string]$Dest = "corpus"
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

# Upload corpus (.md + manifest.yaml) via OneLake DFS (ADLS Gen2), preserving folder layout.
$stTok = az account get-access-token --resource "https://storage.azure.com" --query accessToken -o tsv
$H = @{ Authorization = "Bearer $stTok" }
$base = "https://onelake.dfs.fabric.microsoft.com/$Ws/$Lh/Files/$Dest"
$chunk = 3145728  # 3 MB
$root = (Resolve-Path $Dir).Path

$files = Get-ChildItem $root -Recurse -File -Include *.md, manifest.yaml

# Create the intermediate directories first (idempotent).
$dirs = $files | ForEach-Object {
  $rel = $_.DirectoryName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
  $rel
} | Where-Object { $_ -ne "" } | Sort-Object -Unique
foreach ($d in $dirs) {
  Invoke-WebRequest -Method Put -Uri "$base/$d`?resource=directory" -Headers $H -UseBasicParsing | Out-Null
}

foreach ($f in $files) {
  $rel = $f.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
  $url = "$base/$rel"
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
  "uploaded Files/$Dest/$rel ($len bytes)"
}
"DONE ($($files.Count) files)"
