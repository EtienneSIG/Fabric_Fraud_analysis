param(
  [string]$Ws = "d451f521-7e87-408f-8208-61928f1b84e3",
  [string]$Body = "$PSScriptRoot\create_body.json"
)

$ErrorActionPreference = "Stop"
$tok = az account get-access-token --resource "https://api.fabric.microsoft.com" --query accessToken -o tsv
$H = @{ Authorization = "Bearer $tok"; "Content-Type" = "application/json" }
$json = Get-Content -Raw -Path $Body

try {
  $r = Invoke-WebRequest -Method Post -Uri "https://api.fabric.microsoft.com/v1/workspaces/$Ws/items" -Headers $H -Body $json -UseBasicParsing
  "STATUS=$($r.StatusCode)"
  if ($r.StatusCode -eq 201) {
    "ONTOLOGY_ID=" + ($r.Content | ConvertFrom-Json).id
  }
  elseif ($r.StatusCode -eq 202) {
    $loc = $r.Headers['Location']; if ($loc -is [array]) { $loc = $loc[0] }
    "OPERATION=$loc"
    for ($i = 0; $i -lt 40; $i++) {
      Start-Sleep -Seconds 6
      $op = Invoke-RestMethod -Uri $loc -Headers $H
      "[$i] $($op.status)"
      if ($op.status -in @("Succeeded", "Failed")) {
        if ($op.status -eq "Succeeded") {
          $res = Invoke-RestMethod -Uri "$loc/result" -Headers $H
          "ONTOLOGY_ID=" + $res.id
        } else {
          $op | ConvertTo-Json -Depth 8
        }
        break
      }
    }
  }
}
catch {
  "ERROR: $($_.Exception.Message)"
  if ($_.ErrorDetails) { $_.ErrorDetails.Message }
  elseif ($_.Exception.Response) {
    $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $sr.ReadToEnd()
  }
}
