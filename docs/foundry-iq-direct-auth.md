# Foundry IQ — direct SPA path: troubleshooting & resolution

How the **direct-browser Foundry IQ** path (Fraud IQ → "Run the agentic investigation" / free
investigation) was made to return the **real** agent answer instead of the deterministic mock, and
why each step mattered. The direct path signs the analyst in with MSAL and calls the Foundry agent
responses API **as that user** (`src/services/FoundryAgentClient.ts`).

## Symptom
Foundry IQ / Web IQ stayed on the **mock** answer even though Settings showed the connection wired.
The badges said "Live" but the reply was instant/deterministic, and the sign-in popup misbehaved
(blank, closed fast, double window, or "user_cancelled").

## Root causes & fixes (in the order they were found)

| # | Root cause | Why it degraded to mock | Fix |
|---|---|---|---|
| 1 | **Agent timeout 5 s** (`DEFAULT_AGENT_TIMEOUT_MS`) | `gpt-5.6-terra` is a reasoning model; a real call takes 20–60 s → every call timed out at 5 s → `degraded` fallback | `generalSettings.ts`: default **90 s**; probe **90 s** |
| 2 | **`max_output_tokens: 1200`** | Reasoning + `web_search` tokens count against the budget → response `status: incomplete` (`reason: max_output_tokens`), empty `output_text` → SPA throws "empty" → mock | `FoundryAgentClient.ts`: **6000** |
| 3 | **Reasoning effort = medium** (~60 s) | Slow, and 1200-token responses never finished | `foundry/deploy_agents.py`: `Reasoning(effort="low")` (≈20 s, complete). Per-request `reasoning` is rejected via the agent endpoint (`Not allowed when agent is specified`) — it must live in the agent definition |
| 4 | **Badge hardcoded `Live`** + `degraded` never surfaced | You couldn't tell mock from real | `FraudIQ.tsx` badge reflects the real run (`foundryLive`); `microsoftIq.ts` returns `foundryLive`; `[diag:fraudiq]` traces LIVE vs DEGRADED |
| 5 | **MSAL v5 popup mode wrong for the context** | The relay/bridge (`popupRelayUri` + `navigatePopups`) opened a 2nd window / closed early and lost the response in a **standalone tab**; a plain popup breaks in the **Fabric iframe** (COOP severs `window.opener`) | Context-aware: `window.self !== window.top` → **relay bridge** only when embedded; **plain synchronous popup** in a standalone tab |
| 6 | **Redirect page didn't broadcast** | MSAL v5 delivers the popup response over a **`BroadcastChannel`** (`waitForBridgeResponse`), not via the popup URL → the main frame waited 60 s → mock | `msal-redirect.html` (`src/auth/msalRedirect.ts`) **always** calls `broadcastResponseToMainFrame()` |
| 7 | **Wrong tenant account** | The agent lives in tenant `MngEnvMCAP379967` (`1f692b89…`); signing in with a corp/pro account (different tenant) yields no valid token | Sign in with the **demo-tenant** account that holds the data-plane role |
| 8 | **`AADSTS650057: Invalid resource`** | The SPA app registration declared **no API permission** for `https://ai.azure.com` (Azure ML Services), so the token request was rejected | Added the `user_impersonation` delegated permission; switched the SPA scope from `.default` to **`https://ai.azure.com/user_impersonation`** so the analyst can **consent interactively** at sign-in (the deploying principal couldn't admin-consent) |

## What "Live" now requires (runtime)
1. Settings › Agents wired (endpoint / tenant / SPA client id / agent) — or baked `VITE_FOUNDRY_*`.
2. Sign in with the **demo-tenant** account (`admin@MngEnvMCAP379967.onmicrosoft.com`) that has the
   **Cognitive Services User** role on `aif-fraudintel-demo`.
3. **Consent** once to "Azure Machine Learning Services … on your behalf" (interactive, user-level).

## Identity / RBAC / consent (3 distinct things)
- **Authentication** (token issuance): needs the SPA to declare the `ai.azure.com` permission + consent.
- **Authorization** (data-plane): needs the **Cognitive Services User** RBAC role on the Foundry account.
- **Tenant**: the sign-in authority is the agent's tenant — a foreign account can't be authorized.

## Diagnostics (App Insights + console)
`src/backend/diag.ts` forwards to Application Insights (`trackTrace`/`trackException`) when a
connection string is set (Settings › General or `VITE_APPINSIGHTS_CONNECTION_STRING`), else console-only.
Filter the browser console by `[diag:`:
- `[diag:fraudiq]` — run start (configured vs mock), LIVE vs DEGRADED + latency, errors.
- `[diag:foundryiq]` — token acquisition, `agent HTTP <status>`, parsed answer, or `direct agent failed (<reason>)`.
- `[diag:msal]` — MSAL's own verbose logs (popup open, BroadcastChannel wait, token).

KQL:
```kusto
traces
| where message startswith "[diag:"
| where severityLevel >= 2   // Warning/Error = degraded runs + failures
| order by timestamp desc
```

## Deploy commands (this path is a separate publish)
The direct-SPA agent (`fraud-iq-orchestrator`, `effort=low`) is **not** part of
`deploy.ps1 -FoundryAgents` (that only provisions the connected-agent topology
`fraud-triage-agent` + sub-agents via `foundry/agents/deploy_agents.ps1`). Deploy/redeploy it
out of band:
```powershell
foundry/.venv/Scripts/python foundry/deploy_agents.py --endpoint <projectEndpoint> --replace
```

## Terraform / infra state
`infra/terraform/main.tf` → `azuread_application.fraudiq_spa` now declares the
`ai.azure.com` `user_impersonation` `required_resource_access`, so a fresh
`terraform apply -var=enable_fraudiq_spa=true` reproduces the permission. **Consent is not codified**
(the deploying principal usually lacks org-consent rights) — it is granted interactively at first
sign-in, or once by a Global Admin (`az ad app permission admin-consent --id <spa-client-id>`).
The analyst data-plane role stays in `azurerm_role_assignment.fraudiq_analyst`
(`fraudiq_analyst_object_ids` + `fraudiq_analyst_role = "Cognitive Services User"`).
