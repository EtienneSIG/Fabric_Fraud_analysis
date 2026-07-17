param(
  [string]$Workspace = "d451f521-7e87-408f-8208-61928f1b84e3",
  [string]$Root = "c:\Users\esigwald\01_Dev\Fraud\artifacts\rayfin_report",
  [string]$DisplayName = "Rayfin_FraudCockpit"
)

$token = az account get-access-token --resource "https://api.fabric.microsoft.com" --query accessToken -o tsv
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }

$rootPath = (Resolve-Path $Root).Path
$files = Get-ChildItem -Path $rootPath -Recurse -File
$parts = @()
foreach ($f in $files) {
  $rel = $f.FullName.Substring($rootPath.Length + 1).Replace("\", "/")
  $b64 = [System.Convert]::ToBase64String([System.IO.File]::ReadAllBytes($f.FullName))
  $parts += @{ path = $rel; payload = $b64; payloadType = "InlineBase64" }
}

"Parts: $($parts.Count)"
$parts | ForEach-Object { " - " + $_.path }

$body = @{
  displayName = $DisplayName
  description = "Rayfin fraud cockpit report (Executive, Sankey fraud-flow, Graph, Remediation)"
  definition = @{ parts = $parts }
} | ConvertTo-Json -Depth 12

try {
  $r = Invoke-WebRequest -Uri "https://api.fabric.microsoft.com/v1/workspaces/$Workspace/reports" -Headers $headers -Method Post -Body $body
  "STATUS=$($r.StatusCode)"
  if ($r.StatusCode -eq 201) { "REPORT_ID=" + ($r.Content | ConvertFrom-Json).id }
  else { "OPLOC=" + $r.Headers['Location'] }
} catch {
  "ERROR: $($_.Exception.Message)"; $_.ErrorDetails.Message
}
