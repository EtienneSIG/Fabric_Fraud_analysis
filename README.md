# Fabric Fraud Intelligence

An end-to-end fraud detection and investigation solution built on **Microsoft Fabric**,
combining a **Rayfin Fabric App** (React frontend + Fabric SQL backend), a governed
**Lakehouse**, and a **Fabric IQ Ontology** semantic layer.

**Live app:** https://fleet-north-8c279cc767-swedencentral.webapp.fabricapps.net
**Workspace:** `Fraud_analysis` (`d451f521-7e87-408f-8208-61928f1b84e3`)

## Repository structure

| Folder | Theme | Contents |
| --- | --- | --- |
| `fabric-fraud-intelligence/` | **Application** | Rayfin Fabric App — React/TS frontend, entity models, mock agent services. Deploy with `npx rayfin up`. |
| `fabric/ontology/` | **Semantic layer** | Fabric IQ Ontology builder (`build_ontology.py`), REST deployer (`post_ontology.ps1`), generated `create_body.json` + `parts/`, and `fraud_ontology.yaml` (deployed model doc). |
| `fabric/lakehouse/` | **Data** | Loads the app dataset into `fraud_lakehouse` Delta tables (`load_app_data.py`, `run_load.ps1`, `upload_lakehouse_data.ps1`, `post_notebook.ps1`) + historical SQL. |
| `fabric/realtime/` | **Streaming** | Eventhouse/KQL specs and deploy scripts. |
| `fabric/powerbi/` | **Reporting** | Semantic model (`model.bim`) + report deploy scripts. |
| `design/` | **Architecture blueprint** | Canonical contracts, fraud patterns, risk-scoring spec, screen UX contracts, remediation loop, environment config. |
| `docs/` | **Docs** | Executive demo narrative and supporting documentation. |

## The application

The app (`fabric-fraud-intelligence/`) surfaces:

- **Dashboard** — KPIs and alert overview with role-based access (Analyst / Manager / Auditor) and PII masking.
- **Fraud Flow** — a Customer 360 Sankey of ~10k customer journeys, a geographic **event map**, a fraud-only filter, and hover counts.
- **Entity Graph** — an event-derived force-directed graph (fraud-type hubs + customers), centrality sizing (degree / closeness / betweenness), fraud filtering, and an **AI narrative** explaining each entity.
- **Microsoft IQ** — a grounded-investigation view combining **Fabric IQ** (live, from the deployed ontology + lakehouse), **Work IQ** and **Foundry IQ** (simulated) to answer fraud questions.
- **Alert Queue, Case Detail, AML Copilot, Claims Fraud** — investigation workflows with grounded agent assistance.

### Run locally

```powershell
cd fabric-fraud-intelligence
npm install
npm run dev
```

### Deploy to Fabric

```powershell
cd fabric-fraud-intelligence
npx rayfin up --workspace "Fraud_analysis"
```

## The data + semantic layer

`fraud_lakehouse` holds 11 governed Delta tables (customer, account, transaction, policy,
claim, fraud_alert, fraud_case, evidence, entity_relationship, agent_run, customer_event).
The **`fraud_ontology`** Fabric IQ item binds those tables into 11 entity types and 11
relationship types, deriving an instance graph from foreign-key columns.

```powershell
# 1. materialize app data as Delta tables
& fabric/lakehouse/run_load.ps1
# 2. build + deploy the ontology
python fabric/ontology/build_ontology.py
& fabric/ontology/post_ontology.ps1
```

## Demo

See [docs/exec-demo-narrative.md](docs/exec-demo-narrative.md) for the executive demo script.
