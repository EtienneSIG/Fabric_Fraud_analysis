# Fabric Fraud Intelligence

A demo/pitch **Microsoft Fabric App** (built with the **Rayfin** SDK/CLI) for
banking & insurance **fraud investigation**. It showcases Microsoft Fabric as a
*governed data + AI application platform*: a TypeScript data ontology that
materializes as a Fabric **SQL Database**, a React + Fluent-inspired investigator
UI, and grounded **AI agents** (mock or live Fabric Data Agent) — all behind
Fabric SSO with role-based access, PII masking and a full audit trail.

Fraud use cases covered: **card/payment fraud, AML alert investigation, KYC
refresh, insurance claims fraud, identity fraud, and provider/collusion network
fraud.**

---

## Architecture

```
rayfin/data/            @entity models → Fabric SQL Database (the ontology)
src/
  App.tsx               router + auth guard + role provider
  app/
    routes.tsx          nav + route table
    RoleContext.tsx     RBAC (Analyst / Manager / Auditor)
    layout/AppLayout    sidebar + topbar (role switcher, SSO user, sign-out)
    pages/              Dashboard, AlertQueue, CaseDetail, AMLCopilot,
                        ClaimsFraud, EntityGraph, Settings
    components/         KPIGrid, AlertTable, RiskScoreBadge, EvidencePanel,
                        CaseTimeline, AgentChat, EntityNetwork
  backend/
    models/             domain types + RBAC/PII helpers
    services/           FabricDataAgentClient, FabricWarehouseClient,
                        VectorSearchClient, RiskScoringService, AuditService
    agents/             AgentOrchestrator, PromptTemplates, FraudInvestigationAgent,
                        AMLCaseAgent, ClaimsFraudAgent, context
    api/                alerts, cases, agents, dashboard, entity-graph
  data/seed/            deterministic demo-data generator
  styles/theme.css      Fluent-inspired tokens
fabric.yaml             Fabric App descriptor (rayfin.yml is authoritative)
.env.example            environment variables
```

> Rayfin requires entity classes in `rayfin/data/` (they become the SQL
> Database). The `src/backend/models` layer holds the frontend/service domain
> types that mirror those entities.

## Data models (Fabric SQL / ontology)

Declared with `@entity` decorators in `rayfin/data/*.ts`:

- **Customer** — id, name, segment, country, kycRiskRating, pepFlag, sanctionsFlag
- **Account** — id, customerId, ibanHash, accountOpenDate, status
- **Transaction** — id, accountId, timestamp, amount, currency, merchant, merchantCategory, channel, country, deviceId, ipCountry, counterpartyId
- **FraudAlert** — id, alertType, source, riskScore, severity, status, createdAt, customerId, transactionId, claimId, explanationShort
- **FraudCase** — id, alertId, assignedTo, status, decision, decisionReason, createdAt, updatedAt
- **Claim** — id, policyId, customerId, claimType, claimDate, amountClaimed, repairProvider, status, location
- **Policy** — id, customerId, policyType, startDate, premium, status
- **Evidence** — id, caseId, evidenceType, title, content, sourceSystem, confidence, createdAt
- **EntityRelationship** — id, sourceEntityId, targetEntityId, relationshipType, weight
- **AgentRun** — id, caseId, agentName, prompt, response, groundingSources, createdAt, userId

## Demo data

`src/data/seed` deterministically generates: **20 customers, ~30 accounts,
8 policies, 100 transactions, 8 claims, 15 fraud alerts** (card, AML, KYC,
identity, claims, collusion), **15 cases, 30 evidence records, 20 entity
relationships** (collusion ring around a shared repair provider + shared
devices). Five "hero" alerts drive the demo scenarios below.

## AI agents & grounding

- **AgentOrchestrator** — `investigateAlert`, `summarizeCase`,
  `generateAMLNarrative`, `generateClaimsFraudSummary`, `suggestNextActions`.
- **PromptTemplates** — system prompts for `FraudInvestigationAgent`,
  `AMLCaseAgent`, `ClaimsFraudAgent`, all sharing regulator-safe guardrails.
- **FabricDataAgentClient** — `askDataAgent(question, context)`,
  `getGeneratedQuery(runId)`, `listGroundingSources(runId)`. In **mock mode**
  (default, or when `FABRIC_DATA_AGENT_ID` is unset) it returns deterministic,
  grounded responses from the seeded data plus a generated NL2SQL query. Set
  `FABRIC_APP_MODE=fabric` to route to a real Fabric Data Agent over REST.
- Every interaction is persisted to **AgentRun** and the **audit trail**.
- All recommendations are **advisory and require human approval**.

## Backend endpoints (callable API modules)

| REST shape | Module function |
|---|---|
| `GET /api/alerts` | `api/alerts.getAlerts(filter)` |
| `GET /api/alerts/:id` | `api/alerts.getAlert(id)` |
| `GET /api/cases/:id` | `api/cases.getCase(id)` |
| `POST /api/cases/:id/agent/investigate` | `api/agents.investigate(id, user)` |
| `POST /api/cases/:id/agent/aml-narrative` | `api/agents.amlNarrative(id, user)` |
| `POST /api/cases/:id/agent/claims-summary` | `api/agents.claimsSummary(id, user)` |
| `POST /api/cases/:id/decision` | `api/cases.postDecision(id, input)` |
| `GET /api/dashboard/kpis` | `api/dashboard.getKpis()` |
| `GET /api/entity-graph` | `api/entity-graph.getEntityGraph()` |

## Demo scripts

1. **Card fraud real-time alert** — Dashboard → top high-risk alert (ecommerce
   geo/IP mismatch) → CaseDetail → *Investigate* → review drivers → **Escalate**.
2. **AML layering investigation** — AML Copilot → select the layering alert →
   *Generate AML narrative* → inspect money-movement wires → SAR readiness.
3. **KYC refresh event** — Alert Queue → filter *KYC* → PEP customer with stale
   CDD → CaseDetail → *Request documents*.
4. **Insurance claim photo reuse / provider anomaly** — Claims Fraud → select the
   image-reuse alert → *Generate claims summary* → provider-concentration bars.
5. **Executive fraud command center** — Dashboard KPIs + Entity Graph collusion
   ring (shared provider & devices) for a leadership walkthrough.

## Governance & security

- **Role-based UI**: Analyst / Manager / Auditor (switch in the top bar).
- **PII masking**: name & IBAN masked for roles without view permission (Auditor).
- **Human-in-the-loop**: agent output is non-binding; decisions are explicit.
- **Audit trail**: decisions and every agent run are logged (Settings → Audit).

## Commands

```bash
npm run dev        # deploy backend to Fabric + run UI locally (Vite)
npm run build      # tsc + vite production build
npm run seed       # notes on seeding (demo data is generated in-app)
npm run deploy     # rayfin up  (deploy app + apply schema)
npm run deploy:db  # rayfin up db apply  (schema only)
```

## Fabric / Rayfin deployment

```bash
# Scaffold (reference)
npm create @microsoft/rayfin@latest fabric-fraud-intelligence

# Sign in and deploy
npx rayfin login
npx rayfin up                 # creates App + SQL Database + SQL analytics endpoint
npx rayfin up db apply        # apply schema changes only
```

Notes:
- **Fabric capacity**: deploy to a workspace on a Fabric capacity in a region
  that supports **Fabric Apps (preview)** (a Trial capacity in an unsupported
  region returns `403 feature not available`).
- **Tenant setting**: enable **Fabric App Items (preview)** in the Admin portal.
- **Fabric SSO**: deployed apps authenticate with Microsoft Entra ID (Fabric
  SSO); email/password is local-dev only and works only inside the Fabric portal.
- On deploy, the `@entity` models materialize as a **SQL Database** item (the
  ontology) with a free **SQL analytics endpoint** any Power BI report can query.
