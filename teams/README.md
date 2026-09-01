# Teams app package

Side-loadable Teams app that surfaces fraud-case **approval Adaptive Cards** (approve / escalate /
dismiss). Decisions are human-in-the-loop and flow back through the bot endpoint to OneLake.

## Contents
- `manifest.json` — bot manifest; `${{BOT_APP_ID}}` is the Terraform output `bot_app_id`.
- `color.png` (192×192) and `outline.png` (32×32) — add your icons before packaging.

## Package + side-load
```powershell
# from Terraform: $botId = terraform -chdir=../infra/terraform output -raw bot_app_id
(Get-Content manifest.json) -replace '\$\{\{BOT_APP_ID\}\}', $botId | Set-Content manifest.local.json
Compress-Archive -Path manifest.local.json,color.png,outline.png -DestinationPath fraudintel-teams.zip -Force
```
Upload `fraudintel-teams.zip` in Teams → Apps → Manage your apps → Upload a custom app.

The bot messaging endpoint is the Azure Function `/api/messages` (Terraform output
`bot_messaging_endpoint`).
