param(
  [string]$Workspace = "d451f521-7e87-408f-8208-61928f1b84e3",
  [string]$Server = "s2zomy43xm2efanba4mnd2uyq4-eh2vdvehp2hubaqimgji6g4e4m.datawarehouse.fabric.microsoft.com",
  [string]$Db = "fraud_lakehouse",
  [string]$DisplayName = "Rayfin_FraudModel"
)

$token = az account get-access-token --resource "https://api.fabric.microsoft.com" --query accessToken -o tsv
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }

$bim = Get-Content -Raw -Path "c:\Users\esigwald\01_Dev\Fraud\artifacts\model.bim"
$bim = $bim.Replace("__SERVER__", $Server).Replace("__DB__", $Db)
$bimB64 = [System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($bim))

$pbism = '{"version":"4.0","settings":{}}'
$pbismB64 = [System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($pbism))

$body = @{
  displayName = $DisplayName
  description = "Rayfin fraud Direct Lake semantic model"
  definition = @{
    parts = @(
      @{ path = "model.bim"; payload = $bimB64; payloadType = "InlineBase64" },
      @{ path = "definition.pbism"; payload = $pbismB64; payloadType = "InlineBase64" }
    )
  }
} | ConvertTo-Json -Depth 10

try {
  $r = Invoke-WebRequest -Uri "https://api.fabric.microsoft.com/v1/workspaces/$Workspace/semanticModels" -Headers $headers -Method Post -Body $body
  "STATUS=$($r.StatusCode)"
  if ($r.StatusCode -eq 201) { "MODEL_ID=" + ($r.Content | ConvertFrom-Json).id }
  else { "OPLOC=" + $r.Headers['Location'] }
} catch {
  "ERROR: $($_.Exception.Message)"; $_.ErrorDetails.Message
}
