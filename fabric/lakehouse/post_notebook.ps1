param(
  [Parameter(Mandatory=$true)][string]$PyFile,
  [Parameter(Mandatory=$true)][string]$DisplayName,
  [string]$Description = "",
  [string]$Workspace = "d451f521-7e87-408f-8208-61928f1b84e3",
  [string]$LakehouseId = "67f6d900-b355-4727-b49b-4e05096cf8e7",
  [string]$LakehouseName = "fraud_lakehouse"
)

$token = az account get-access-token --resource "https://api.fabric.microsoft.com" --query accessToken -o tsv
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }

$src = Get-Content -Raw -Path $PyFile
$src = $src -replace "`r`n", "`n"
# ipynb requires source as an array of lines, each keeping its trailing newline
$srcLines = @($src -split "(?<=`n)")

$nb = [ordered]@{
  nbformat = 4
  nbformat_minor = 5
  cells = @(
    [ordered]@{ cell_type = "code"; execution_count = $null; metadata = @{}; outputs = @(); source = $srcLines }
  )
  metadata = [ordered]@{
    language_info = @{ name = "python" }
    kernelspec = @{ name = "synapse_pyspark"; display_name = "Synapse PySpark" }
    dependencies = [ordered]@{
      lakehouse = [ordered]@{
        default_lakehouse = $LakehouseId
        default_lakehouse_name = $LakehouseName
        default_lakehouse_workspace_id = $Workspace
        known_lakehouses = @(@{ id = $LakehouseId })
      }
    }
  }
}

$ipynb = $nb | ConvertTo-Json -Depth 30
$bytes = [System.Text.Encoding]::UTF8.GetBytes($ipynb)
$b64 = [System.Convert]::ToBase64String($bytes)

$body = @{
  displayName = $DisplayName
  description = $Description
  definition = @{ format = "ipynb"; parts = @(@{ path = "notebook-content.ipynb"; payload = $b64; payloadType = "InlineBase64" }) }
} | ConvertTo-Json -Depth 10

try {
  $r = Invoke-WebRequest -Uri "https://api.fabric.microsoft.com/v1/workspaces/$Workspace/notebooks" -Headers $headers -Method Post -Body $body
  "STATUS=$($r.StatusCode)"
  if ($r.StatusCode -eq 201) { "NOTEBOOK_ID=" + ($r.Content | ConvertFrom-Json).id }
  else { "OPLOC=" + $r.Headers['Location'] }
} catch {
  "ERROR: $($_.Exception.Message)"; $_.ErrorDetails.Message
}
