---
applyTo: "fabric/**,infra/**,foundry/**,design/**"
---
# Naming conventions

## Fabric items
- Data items (Lakehouse, Ontology, Eventhouse, notebooks): `fraud_*` snake_case
  (`fraud_lakehouse`, `fraud_ontology`, `fraud_eventhouse`, `fraud_rti`, `load_app_data`).
- Power BI: keep `Rayfin_*` (`Rayfin_FraudModel`, `Rayfin_FraudCockpit`).

## Foundry
- Agents: kebab-case `fraud-<role>-agent`
  (`fraud-triage-agent`, `fraud-investigation-agent`, `fraud-aml-agent`, `fraud-claims-agent`).
- Connections: `conn-<source>-<usage>` (`conn-fabric-fraud-dataagent`).

## Azure resources (CAF abbreviation + workload token `fraudintel` + env)
`rg-fraudintel-<env>`, `kv-fraudintel-<env>`, `func-fraudintel-bot-<env>`, `bot-fraudintel-<env>`,
`appi-fraudintel-<env>`, `log-fraudintel-<env>`, `evhns-fraudintel-<env>`, `aif-fraudintel-<env>`.
Centralize all names in Terraform `locals` — one source of truth.

## Entity model — design contracts ↔ shipped ontology
The **shipped Rayfin ontology (11 entities) is authoritative** and is NOT renamed. The
`design/contracts/entities.schema.json` names map to it as follows (documentation only):

| design contract | ontology (authoritative) |
| --- | --- |
| Customer | Customer |
| Account | Account |
| Transaction | Transaction |
| Device | Transaction attributes (device fields) |
| IP | Transaction attributes (`ipCountry`) |
| Merchant | Transaction attributes (`merchant`) |
| Behavior | derived features (not a persisted entity) |
| RiskSignal | FraudAlert (`riskScore`, `riskDrivers`) |
| AlertCase | FraudAlert + FraudCase |
| (none) | Claim, Policy, Evidence, EntityRelationship, AgentRun, CustomerEvent |

Do not add Device/IP/Merchant/Behavior/RiskSignal/AlertCase as new ontology entities.
