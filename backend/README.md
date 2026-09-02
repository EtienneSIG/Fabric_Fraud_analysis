# Backend (app-adjacent server logic)

Hosts the app-adjacent server logic that the SPA cannot do safely in the browser: the Foundry
agent proxy, Microsoft Graph (OBO), Teams bot messaging endpoint, and OneLake writeback.

## Design
- **Host-agnostic handlers** in [`src/handlers.ts`](src/handlers.ts) contain the business logic
  with no host binding, so they can run on either host:
  - **Preferred:** the native **Rayfin `functions` service** (shares the Fabric SSO context →
    natural OBO). Mount these handlers there.
  - **Azure Function (Flex Consumption):** [`src/functions.ts`](src/functions.ts) wraps the same
    handlers and, crucially, hosts the **Teams Bot `/api/messages`** endpoint (Bot Framework needs
    a public endpoint + bot identity). Provisioned by [`../infra/terraform`](../infra/terraform).
- Real integrations (Foundry, Graph, OneLake) are isolated behind `TODO(...)` markers and return
  simulated results until wired — mirrors the SPA's mock-first contract.

## Routes (match the SPA service clients)
| Route | Handler | SPA client |
| --- | --- | --- |
| `POST /api/agents/run` | `runAgent` | `FoundryAgentClient` |
| `GET /api/workiq/signals` | `workIqSignals` | `WorkIqGraphClient` |
| `POST /api/webiq/search` | `regulatoryWebSearch` | `WebIqClient` |
| `POST /api/notify/teams` | `notifyTeams` | `TeamsNotificationService` |
| `POST /api/cases/decision` | `upsertCaseDecision` | closed-loop writeback |
| `POST /api/reports/email` | `emailReport` | `O365ReportService` |
| `POST /api/evidence/upload` | `uploadEvidence` | `O365ReportService` |
| `POST /api/messages` | Bot Framework | Teams Adaptive Card callbacks |

## Local run
```powershell
cd backend
npm install
npm run build
func start   # requires Azure Functions Core Tools v4
```
Point the SPA at it: `VITE_BACKEND_API_URL=http://localhost:7071/api`.
Set `VITE_WEBIQ_ENABLED=true` to exercise `/api/webiq/search`; without configured Web IQ
credentials, the handler returns deterministic mock citations from the official-domain allow-list.

## Minimal deployment package

`.funcignore` keeps `src/`, `tsconfig.json`, source maps and docs out of the zip — only the
compiled `dist/` + production `node_modules` + `host.json` ship. Build with dev deps, then prune
to production before publishing:

```powershell
npm ci                 # all deps (typescript is needed to build)
npm run build          # tsc -> dist/
npm prune --omit=dev   # drop typescript/@types from node_modules
func azure functionapp publish (terraform -chdir=../infra/terraform output -raw function_app_name)
```

## Security
- Delegated Microsoft Graph (OBO) only — never app-only for analyst-driven reads.
- Secrets from Key Vault via managed identity; never in code or app settings in plaintext.
