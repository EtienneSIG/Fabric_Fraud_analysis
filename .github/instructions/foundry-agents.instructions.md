---
applyTo: "foundry/**"
---
# Foundry Agent Service rules

- Target the **GA Microsoft Foundry Agents Service**, API `2025-11-15-preview`. Do NOT use the
  deprecated classic agents (retired 2027-03-31).
- **Connected-agent topology:** one `fraud-triage-agent` orchestrator delegating to
  `fraud-investigation-agent`, `fraud-aml-agent`, `fraud-claims-agent`, `fraud-regulatory-agent`.
  Publish each agent separately; each gets its own Agent Identity — reconfigure its Azure permissions
  after publish.
- **Single-response principle:** only the orchestrator answers the user. Every sub-agent's
  instructions must explicitly say it is a sub-agent that returns findings to the parent.
- **Grounding:** attach the native **Microsoft Fabric tool via `conn-fabric-fraud-dataagent`** with
  OBO user identity (preserves RLS + PII). Add function tools for risk-scoring and sanctions.
- **Web IQ (regulatory):** `fraud-regulatory-agent` grounds on **Microsoft Web IQ** via `conn-web-iq`
  (key from Key Vault, managed by the agent). Restrict every web search to the official-domain
  allow-list with `site:` operators and validate citations against it; NEVER put case PII in a web
  query (generic legal terms only). The app path uses the backend proxy (`/api/webiq/search`, Entra ID).
- **Models via variables** (`model_orchestrator` / `model_reasoning` / `model_extraction`); match the
  model to the task to control token cost. Enable content-safety guardrails on input, tool calls,
  tool responses and final output.
- **HITL:** instructions must forbid final fraud decisions and always require human approval
  (reuse the regulator-safe prompts in `src/backend/agents/PromptTemplates.ts`).
- **Locale:** the invocation passes the active UI locale; agents respond in that locale (FR or EN).
