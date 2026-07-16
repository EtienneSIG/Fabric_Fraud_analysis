# Fabric_Fraud_analysis

Microsoft Fabric / Rayfin fraud management workspace scaffold.

## Repository structure

- `fabric_app/notebooks` synthetic data generation and fraud-pattern injection starter code.
- `fabric_app/contracts` canonical entity and fraud pattern contracts.
- `fabric_app/pipelines` Eventhouse/KQL and Lakehouse pipeline specs.
- `fabric_app/scoring` risk scoring and graph-feature specification.
- `fabric_app/ontology` ontology and graph bindings.
- `fabric_app/backend` Rayfin backend skeleton.
- `fabric_app/screens` four-screen UX contracts.
- `fabric_app/remediation` alert-to-case remediation loop.
- `fabric_app/demo` end-to-end demo and validation runbook.

## Notes

- This repository currently contains architecture assets and scaffolding only.
- No project-specific lint/build/test commands are defined yet.

## Step-by-step Fabric demo setup

1. **Prepare prerequisites**
   - Install Python 3.10+.
   - Install Azure CLI (`az`) if you want to automate Entra ID sign-in.
   - Verify you have access to the target tenant and Fabric workspace.
   - Use either `./scripts/deploy_fabric_demo.py ...` (executable mode) or `python3 scripts/deploy_fabric_demo.py ...`.
2. **Generate the deployment inventory**
   - Run the script:
     - `./scripts/deploy_fabric_demo.py --tenant <tenant-id> --workspace <workspace-name> --interactive-login`
   - The script validates demo assets and writes a manifest in `./artifacts/deployment_manifest_<workspace>.md`.
3. **Configure the target workspace**
   - Configure workspace/lakehouse/eventhouse parameters in `fabric_app/config/environments.yaml` (section `fabric`).
   - At minimum update: `fabric_workspace`, `lakehouse.name`, `eventhouse.database`, and security values under `security`.
4. **Deploy functional assets**
   - Generator notebook: `fabric_app/notebooks/synthetic_data_generator.py`
   - Lakehouse SQL: `fabric_app/pipelines/historical_lakehouse.sql`
   - Eventhouse KQL: `fabric_app/pipelines/realtime_eventhouse.kql`
   - Contracts/ontology/remediation/screens: `fabric_app/contracts`, `fabric_app/ontology`, `fabric_app/remediation`, `fabric_app/screens`
5. **Run demo walkthrough**
   - Follow the runbook: `fabric_app/demo/e2e_demo_validation.yaml`
   - Validate the checklist (RLS, governance, latency, explainability).

### Deployment helper executable

Use the same command shown in step 2:
- `./scripts/deploy_fabric_demo.py --tenant <tenant-id> --workspace <workspace-name> --interactive-login`
- `python3 scripts/deploy_fabric_demo.py --tenant <tenant-id> --workspace <workspace-name> --interactive-login`

Main options:
- `--tenant`: target Entra ID tenant (required)
- `--workspace`: target Fabric workspace (required)
- `--interactive-login`: forces `az login --tenant ...`
- `--skip-auth`: skips Azure CLI login/auth checks
