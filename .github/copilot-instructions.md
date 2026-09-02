# Fabric Fraud Intelligence (Rayfin) — repo instructions

Fraud investigation workbench built on Microsoft Fabric. Front end is a **Rayfin Fabric App**
(React 19 + Vite + TypeScript SPA) backed by a Fabric SQL Database (the ontology). The wider repo
also ships Fabric artifacts (Lakehouse, Ontology / Fabric IQ, Data Agent, Eventhouse/KQL, Power BI)
deployed by PowerShell + REST, and an Azure support layer provisioned by Terraform.

## Architecture principles (do not break)
- **Mock-first.** The app runs fully offline on a deterministic seed dataset. Real Fabric/Azure
  calls are gated by `isMock()` in `fabric-fraud-intelligence/src/backend/config.ts`. Every real
  integration MUST keep a mock fallback so `npm run build` and `vitest` stay green with flags off.
- **Swappable service clients.** Follow the existing pattern in
  `src/backend/services/FabricDataAgentClient.ts`: one class, a real code path plus a deterministic
  mock path, selected by config. New clients (Foundry, Work IQ, Teams, O365) do the same.
- **Human-in-the-loop (HITL) governance.** All agent output is advisory. Never let an agent take a
  final fraud decision; always require human approval and record it via `AgentRun` + `AuditService`.
- **Identity passthrough.** Real data access flows through Fabric with the signed-in user's identity
  so RLS and PII masking are enforced end to end. Do not add service-principal shortcuts that bypass
  row-level security for user-facing reads.

## Foundry ↔ Fabric
- Use the **Foundry Agent Service** (GA, API `2025-11-15-preview`) — not the deprecated classic agents.
- Ground agents on Fabric through the **native Microsoft Fabric tool + a Foundry connection**
  (`conn-fabric-fraud-dataagent`) with **on-behalf-of (OBO)** user identity. Do not hand-roll an
  NL2SQL REST proxy for the real path.
- Multi-agent: a Triage orchestrator delegates to connected agents (investigation / AML / claims).
  Only the orchestrator replies to the user; every sub-agent's instructions must state it is a
  sub-agent. Match the model to the task (see model tiers below).

## Model tiers (IDs come from Terraform variables, never hardcode)
- Orchestrator / triage → small fast model (`var.model_orchestrator`).
- Fraud investigation / AML narrative (reasoning) → strong model (`var.model_reasoning`).
- Claims summary / extraction → small model (`var.model_extraction`).
- Embeddings / knowledge → `var.model_embeddings` (text-embedding-3-large).

## Backend host
- App-adjacent server logic (agent proxy, Graph OBO, OneLake writeback) runs on the **native Rayfin
  `functions` service** (shares Fabric SSO context). A single Terraform-provisioned **Azure Function
  (Flex Consumption)** hosts the Teams Bot messaging endpoint and is the fallback for anything the
  Rayfin functions can't do.

## Microsoft Graph / O365
- Use **delegated permissions + OBO** (analyst-driven scenarios). Do NOT mix application and
  delegated permissions in the same app registration. Least-privilege only.

## Code design principles (apply with judgment, not dogma)
- **DRY** — factor out genuine duplication (e.g. the shared mock+real service pattern, the
  `backendApi` helper, i18n keys). But do not create an abstraction for a single call site; a little
  duplication is cheaper than the wrong abstraction.
- **YAGNI** — build only what the current use case needs. No speculative options, config knobs,
  interfaces, or "future-proof" layers that nothing uses yet.
- **KISS** — prefer the smallest clear solution. A plain function beats a class; a literal beats a
  factory. Match the shape of the existing lightweight service clients.
- **SOLID — challenge it against the code.** Follow the spirit (one clear responsibility, depend on
  the `isMock()`/config seam so real and mock paths swap cleanly), but don't add layers of interfaces,
  DI containers, or wrappers where a small module already reads well. When SOLID would add a surface
  layer that the code size doesn't justify, keep the lighter code and note why.
- Rule of thumb: reach for a new abstraction on the **third** repetition or a real second consumer,
  not the first. Prefer deleting code over adding indirection. If a pattern already exists
  (service client, handler, i18n bundle), mirror it instead of inventing a parallel one.

## Conventions
- See `.github/instructions/` for i18n, naming, Terraform and Foundry-agent rules (auto-applied by path).
- Keep the existing `fabric-fraud-intelligence/AGENTS.md` (Rayfin skill loading) — extend, don't replace.
- PowerShell deploy scripts: mind the pitfalls recorded in user memory (`-var=$x` no expansion,
  `az` errors via `$LASTEXITCODE`, HTTP error body in `$_.ErrorDetails.Message`).

## Gotchas — don't re-learn these
- **Two Foundry clients, don't confuse them.** `src/backend/services/FoundryAgentClient.ts` is the
  backend-proxy path (`isFoundryEnabled()` → `/api/agents/run`, needs `VITE_FOUNDRY_ENABLED` + a
  reachable backend). `src/services/FoundryAgentClient.ts` is the **direct SPA** path (MSAL popup +
  `askFoundryAgent`, gated by `foundryDirectConfigured()` reading the tenant/client/endpoint the
  analyst types in **Settings › Agents**). A Settings "Test connection" probe MUST hit the same path
  the tab configures (direct → `probeFoundryDirect()`, else the backend `foundryAgent.probe()`),
  otherwise it always reports mock.
- **Simulated/staggered loaders must advance monotonically.** Phase timers scheduled *before* an
  awaited call (e.g. `setTimeout(setPhase(1), 600)`) roll the phase **backward** when the mock
  resolves in ~0 ms, so later columns never reveal (stuck loader). Use `setPhase(p => Math.max(p, n))`.
- **RBAC stays coupled.** The Function-MI storage role in `infra/terraform/main.tf`
  (`azurerm_role_assignment.func_storage`, now `Storage Blob Data Contributor`) and the
  `Test-IdentitiesAndRbac` check in `deploy.ps1` must change **together**, or the self-heal flags a
  false "MISSING" and re-creates the old role.
- **No root-level Node manifest.** The Rayfin CLI runs via `npx` from `fabric-fraud-intelligence/`.
  A `package.json`/`package-lock.json` at the repo **root** is a stray `npm`-at-root artifact —
  gitignored (`/package.json`, `/package-lock.json`), never commit it.
- **Run the SPA from its folder.** `npm run dev` / `rayfin up` only work from
  `fabric-fraud-intelligence/`, never the repo root (root vite runs fail).
- **Build-time vs runtime config.** SPA `VITE_*` (incl. `VITE_APPINSIGHTS_CONNECTION_STRING`,
  `VITE_FOUNDRY_*`) are wired by `deploy.ps1 Set-PublicEnv` into `.env.public.local`; the same knobs
  have a no-rebuild runtime twin in **Settings › Général / Agents** (localStorage). Keep both paths.

## Demo assets — keep screenshots & slide deck in sync (MANDATORY)
When a change adds, removes, or visibly alters a UI screen/feature, you MUST update the demo
assets in the same change so the guided demo stays accurate:
- Regenerate the affected screenshot(s) in `docs/images/*.png` (used by the README).
- Copy them into the Remotion deck: `video/remotion-slidedeck/public/` (same filenames)
  — e.g. `Copy-Item docs/images/*.png video/remotion-slidedeck/public/ -Force`.
- If a screen is added / removed / reordered, update the flow in
  `video/remotion-slidedeck/src/slides.ts` (order, title, caption, `say` cue) AND the
  README "Screens" section.
- Never ship a feature change that leaves the README screenshots or the slide deck stale.

## Verify after changes
- `cd fabric-fraud-intelligence && npm run build && npm test` must pass (mock mode).
- `cd infra/terraform && terraform validate` for infra changes.
- If UI screens changed: screenshots in `docs/images/` and `video/remotion-slidedeck/public/`
  (+ `slides.ts` flow) are refreshed and consistent.

