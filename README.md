# Fabric Fraud Intelligence

An end-to-end fraud detection and investigation solution built on **Microsoft Fabric**,
combining a **Rayfin Fabric App** (React frontend + Fabric SQL backend), a governed
**Lakehouse**, and a **Fabric IQ Ontology** semantic layer.

**Public demo:** https://tangy-cove-9493188f6d-centralus.webapp.fabricapps.net
**Workspace:** `Fraud Intelligence` (`c57a379b-7e6d-481a-9c9b-662bb0bae77d`)

The public deployment runs exclusively on synthetic seed data and deterministic
agent responses. It does not grant anonymous access to the Fabric SQL database,
Lakehouse, Ontology, Data Agent, Eventhouse, semantic model, or report.

The current Fabric deployment includes the Rayfin app and SQL database, a Lakehouse
with 11 Delta tables, a load notebook, a Fabric IQ Ontology, a published Data Agent,
an Eventhouse with a KQL database, and Power BI semantic model and report items.
See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the deployed item inventory,
repeatable deployment commands, validation steps, and current limitations.

An **extended integration layer** (mock-first, gated by config) adds **Azure AI Foundry
Agent Service** (connected agents grounded on Fabric via OBO), **Microsoft 365** (Teams
approval cards, Outlook, SharePoint, Work IQ signals over Microsoft Graph delegated/OBO),
a **closed remediation loop** (alert → case → OneLake writeback → retraining), and
**Terraform** for the Azure support layer. The UI is localized in **English, French and
Spanish**. See [docs/innovations-and-roadmap.md](docs/innovations-and-roadmap.md) for the
innovation highlights and the roadmap of evolutions still to build.

## Demo video


https://github.com/user-attachments/assets/ccec2599-2d85-422a-b76b-db16fc66f93f


> Full quality (with sound): **[Fabric Fraud Intelligence (live).mp4](https://raw.githubusercontent.com/EtienneSIG/Fabric_Fraud_analysis/main/video/Fabric%20Fraud%20Intelligence%20%28live%29.mp4)**

---

## Repository structure

| Folder | Theme | Contents |
| --- | --- | --- |
| `fabric-fraud-intelligence/` | **Application** | Rayfin Fabric App — React/TS frontend, entity models, mock agent services. Deploy with `npx rayfin up`. |
| `fabric/ontology/` | **Semantic layer** | Fabric IQ Ontology builder (`build_ontology.py`), REST deployer (`post_ontology.ps1`), generated `create_body.json` + `parts/`, and `fraud_ontology.yaml` (deployed model doc). |
| `fabric/data-agent/` | **AI grounding** | Idempotent Fabric Data Agent deployment grounded on the 11 `fraud_lakehouse` tables with fraud-specific instructions and few-shot SQL. |
| `fabric/lakehouse/` | **Data** | Loads the app dataset into `fraud_lakehouse` Delta tables (`load_app_data.py`, `run_load.ps1`, `upload_lakehouse_data.ps1`, `post_notebook.ps1`) + historical SQL. |
| `fabric/realtime/` | **Streaming** | Eventhouse/KQL specs and deploy scripts. |
| `fabric/powerbi/` | **Reporting** | Semantic model (`model.bim`) + report deploy scripts. |
| `design/` | **Architecture blueprint** | Canonical contracts, fraud patterns, risk-scoring spec, screen UX contracts, remediation loop, environment config. |
| `infra/terraform/` | **Infrastructure (IaC)** | Terraform for the Azure support layer — AI Foundry + model deployments, Key Vault, Event Hub, Log Analytics/App Insights, Azure Bot, Function App, delegated Graph app registration. |
| `backend/` | **App-adjacent backend** | Host-agnostic handlers (Foundry proxy, Graph OBO, Teams bot, OneLake writeback) + an Azure Functions wrapper for the Teams bot endpoint. |
| `foundry/agents/` | **Agent Service** | Deploys the Foundry connected-agent topology (triage → investigation / AML / claims) grounded on Fabric via a connection with OBO. |
| `teams/` | **Teams app** | Side-loadable Teams app manifest for approval Adaptive Cards. |
| `.github/` | **Conventions** | Repo-wide + path-scoped Copilot instructions (architecture, i18n, naming, Terraform, Foundry agents). |
| `docs/` | **Docs** | Executive demo narrative, deployment guide, and the innovations & roadmap. |

## The Rayfin application

The app in `fabric-fraud-intelligence/` is a **Fabric App** built with the
**Rayfin** SDK/CLI — Microsoft's framework for shipping data-centric applications
that run *inside* Microsoft Fabric. Rayfin turns a set of TypeScript `@entity`
classes into a governed **Fabric SQL Database** (the ontology / system of record),
exposes a typed data client to the frontend, and handles **Fabric SSO** (Microsoft
Entra ID) so the deployed app authenticates against the tenant with no custom
identity code.

On top of that foundation, the app is a **fraud investigator's workbench** for
banking & insurance. It demonstrates Microsoft Fabric as a *governed data + AI
application platform*, covering the full fraud lifecycle: **card/payment fraud,
AML alert investigation, KYC refresh, insurance claims fraud, identity fraud and
provider/collusion network fraud.**

### How it fits together

```mermaid
flowchart LR
  classDef app fill:#4f46e5,color:#ffffff,stroke:#312e81,stroke-width:1px
  classDef fabric fill:#0d9488,color:#ffffff,stroke:#134e4a,stroke-width:1px
  classDef foundry fill:#7c3aed,color:#ffffff,stroke:#4c1d95,stroke-width:1px
  classDef o365 fill:#0f6cbd,color:#ffffff,stroke:#083b6f,stroke-width:1px
  classDef infra fill:#64748b,color:#ffffff,stroke:#334155,stroke-width:1px

  subgraph App["Rayfin Fabric App · React 19 + Vite 7 · EN/FR/ES"]
    UI["Investigator UI<br/>Dashboard · Alerts · Graph · Fraud IQ"]:::app
    GOV["Role provider<br/>RBAC · PII masking"]:::app
    SVC["Service clients<br/>mock + real, gated by isMock()"]:::app
  end

  subgraph Back["App-adjacent backend<br/>Rayfin functions / Azure Function"]
    API["Handlers<br/>agents · workiq · teams · decision · reports"]:::infra
  end

  subgraph Fabric["Microsoft Fabric"]
    SQL["Fabric SQL DB<br/>@entity ontology"]:::fabric
    LH["fraud_lakehouse<br/>Delta tables"]:::fabric
    ONT["fraud_ontology<br/>Fabric IQ"]:::fabric
    DA["Fabric Data Agent<br/>NL2SQL grounding"]:::fabric
    EH["Eventhouse / KQL<br/>real-time scoring"]:::fabric
    BI["Power BI<br/>Rayfin Fraud Cockpit"]:::fabric
  end

  subgraph Foundry["Azure AI Foundry Agent Service"]
    TRI["fraud-triage-agent<br/>orchestrator"]:::foundry
    SUB["connected agents<br/>investigation · AML · claims"]:::foundry
  end

  subgraph O365["Microsoft 365 · Graph (delegated/OBO)"]
    TEAMS["Teams<br/>approval cards"]:::o365
    MAIL["Outlook · SharePoint<br/>reports · evidence"]:::o365
  end

  subgraph Az["Azure support · Terraform"]
    KV["Key Vault"]:::infra
    EHNS["Event Hub"]:::infra
    OBS["Log Analytics<br/>App Insights"]:::infra
  end

  UI --> GOV --> SVC
  SVC -->|mock path| SQL
  SVC -->|real path| API
  API --> TRI --> SUB
  TRI -->|Fabric tool + connection · OBO| DA
  DA --- SQL --- LH --> ONT
  LH --> BI
  EH -.->|risk threshold| API
  API --> TEAMS
  API --> MAIL
  API -->|writeback| LH
  Az -.-> Back
  Az -.-> Foundry
  UI -->|SSO · RBAC · PII| Fabric
```

### End-to-end flows

**Grounded multi-agent investigation** — the orchestrator is the only agent that replies;
sub-agents ground on Fabric with the analyst's identity so RLS and PII masking hold.

```mermaid
flowchart LR
  classDef a fill:#4f46e5,color:#fff,stroke:#312e81
  classDef f fill:#7c3aed,color:#fff,stroke:#4c1d95
  classDef d fill:#0d9488,color:#fff,stroke:#134e4a
  Q["Analyst question"]:::a --> T["Triage orchestrator"]:::f
  T -->|delegate| I["Investigation"]:::f
  T -->|delegate| M["AML"]:::f
  T -->|delegate| C["Claims"]:::f
  I & M & C -->|Fabric tool · OBO| G["Data Agent → Lakehouse/Ontology"]:::d
  G --> T
  T --> R["Single explainable answer<br/>advisory · human approval"]:::a
```

**Closed remediation loop** — a crossed risk threshold drives a human-in-the-loop decision
back into OneLake and the retraining backlog.

```mermaid
flowchart LR
  classDef e fill:#0d9488,color:#fff,stroke:#134e4a
  classDef o fill:#0f6cbd,color:#fff,stroke:#083b6f
  classDef l fill:#64748b,color:#fff,stroke:#334155
  TH["Risk threshold<br/>(Eventhouse/Activator)"]:::e --> AL["Alert → Case"]:::e
  AL --> CARD["Teams Adaptive Card<br/>approve · escalate · dismiss"]:::o
  CARD --> DEC["Analyst decision"]:::o
  DEC -->|OneLake writeback| WB["decision · feedback tables"]:::l
  WB --> RT["Retraining backlog"]:::l
  RT -.->|model iteration| TH
```

- **`rayfin/data/*.ts`** — `@entity` models (Customer, Account, Transaction,
  FraudAlert, FraudCase, Claim, Policy, Evidence, EntityRelationship, AgentRun,
  CustomerEvent). These materialize as the Fabric SQL Database on `rayfin up`.
- **`src/backend/`** — domain models with **RBAC + PII masking** helpers, service
  clients (`FabricDataAgentClient`, `FabricWarehouseClient`, `RiskScoringService`,
  `AuditService`) and an **AgentOrchestrator** with regulator-safe prompt templates.
- **`src/app/`** — the React UI: router + auth guard, a **role provider**
  (Analyst / Manager / Auditor), and the screens below.
- **Grounding modes** — by default agents run in **mock mode** with deterministic,
  grounded responses from the seeded data (plus a generated NL2SQL query). Set
  `FABRIC_APP_MODE=fabric` with a `FABRIC_DATA_AGENT_ID` to route to a **live
  Fabric Data Agent** over REST. Every agent run and decision is written to the
  **AgentRun** entity and the **audit trail**, and all AI output is advisory —
  **human approval is always required.**

### Screens

#### Dashboard — Fraud Command Center
KPIs (alerts today, high-risk alerts, average investigation time, estimated fraud
exposure, false-positive rate), alerts broken down by fraud type and severity, and
a ranked table of the top high-risk alerts with risk scores and explanations.

![Dashboard — Fraud Command Center](docs/images/dashboard.png)

#### Alert Queue
The working list of open alerts across every fraud type, with risk scoring,
severity and status — the analyst's entry point into a case.

![Alert Queue](docs/images/alert-queue.png)

#### Case Detail
A single investigation view: alert context, customer 360, a case timeline, an
evidence panel, and a grounded **agent chat** that can investigate the alert and
suggest next actions. Decisions (escalate / close / request documents) are explicit
and logged.

![Case Detail](docs/images/case-detail.png)

#### Fraud Flow — Customer 360 event journeys
A Sankey of customer journeys: pick a final event and see the five events that most
often precede it, with a fraud-only filter and hover counts. A geographic **event
map** and an example **Customer 360 event log** ground each journey in real data.

![Fraud Flow — Customer 360 event journeys](docs/images/fraud-flow.png)

#### Entity Graph
An event-derived, force-directed graph where **red hubs are fraud typologies** and
the surrounding nodes are the customers whose journey ended in that fraud. Nodes are
sized by **centrality** (degree / closeness / betweenness), can be filtered by fraud
type, and clicking a node produces an **AI narrative** explaining the entity's role
and key risk signals.

![Entity Graph](docs/images/entity-graph.png)

#### Fraud IQ — the fraud application of Microsoft IQ
A flagship **"90 min → 30 sec"** real-time card-fraud scenario plus free-form
investigation, combining the three IQs: **Fabric IQ** (live, from the deployed
ontology + lakehouse), **Work IQ** and **Foundry IQ** (simulated). It contrasts the
manual, 10-step investigation with a single agentic prompt that grounds across
enterprise data, work context and agent knowledge, then returns an explainable,
human-approvable recommendation.

![Fraud IQ — the fraud application of Microsoft IQ](docs/images/fraud-iq.png)

#### AML Copilot
Transaction-monitoring narrative and **SAR readiness**, grounded on Fabric data:
select an AML alert, generate a structured suspicious-activity narrative (subject,
typology, pattern, assessment, recommendation) and inspect the underlying
money-movement wires.

![AML Copilot](docs/images/aml-copilot.png)

#### Claims Fraud
Insurance claim investigation — perceptual **image-hash reuse**, repair-provider
**concentration** and collusion. Generate a claims-fraud summary and review the
provider-concentration bars that expose organised rings.

![Claims Fraud](docs/images/claims-fraud.png)

#### Settings & Governance
The **role & access matrix** (View PII / Make decisions / Audit access per role),
environment configuration (app mode, workspace, Data Agent, tenant), and the
**audit trail** of every agent run and decision.

![Settings & Governance](docs/images/settings.png)

### Run locally

```powershell
cd fabric-fraud-intelligence
npm install
npm run dev
```

> Local dev uses a mock auth service and deterministic seed data, so no Fabric
> connection is required to explore the UI.

### Deploy to Fabric

```powershell
cd fabric-fraud-intelligence
npx rayfin up --workspace-id "c57a379b-7e6d-481a-9c9b-662bb0bae77d"
```

On deploy, the `@entity` models materialize as a **Fabric SQL Database** item (the
ontology) with a free **SQL analytics endpoint** any Power BI report can query, and
the app authenticates users with **Fabric SSO**.

## The data + semantic layer

`fraud_lakehouse` holds 11 governed Delta tables (customer, account, transaction, policy,
claim, fraud_alert, fraud_case, evidence, entity_relationship, agent_run, customer_event).
The **`fraud_ontology`** Fabric IQ item binds those tables into 11 entity types and 11
relationship types, deriving an instance graph from foreign-key columns.

The published **`Fraud Intelligence Data Agent`** (`5e157d5a-2694-499b-9b9f-ed10fe73cb5a`)
is grounded on the same lakehouse. Its published configuration selects the 11 tables,
enforces evidence-based and human-in-the-loop answers, and includes fraud-specific SQL
examples. The public Fabric REST API manages its lifecycle and grounding configuration;
it does not currently expose a conversation endpoint, so the embedded app keeps its
deterministic fallback for in-app agent responses.

```powershell
# 1. materialize app data as Delta tables
& fabric/lakehouse/run_load.ps1
# 2. build + deploy the ontology
python fabric/ontology/build_ontology.py `
  --workspace-id "c57a379b-7e6d-481a-9c9b-662bb0bae77d" `
  --lakehouse-id "257366a1-4675-4c66-a69e-1ec7ab653706"
& fabric/ontology/post_ontology.ps1 `
  -Ws "c57a379b-7e6d-481a-9c9b-662bb0bae77d" `
  -TenantId "<tenant-id>"

# 3. create or update the published Data Agent
& fabric/data-agent/deploy_data_agent.ps1 `
  -WorkspaceId "c57a379b-7e6d-481a-9c9b-662bb0bae77d" `
  -LakehouseId "257366a1-4675-4c66-a69e-1ec7ab653706"
```

## Demo

- **Live walkthrough:** see the demo video at the top of this README.
- **Executive demo script:** [docs/exec-demo-narrative.md](docs/exec-demo-narrative.md) (FR) and [docs/exec-demo-narrative.en.md](docs/exec-demo-narrative.en.md) (EN).
