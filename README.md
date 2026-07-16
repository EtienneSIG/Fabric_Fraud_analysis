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

## Step-by-step setup de la démo Fabric

1. **Préparer les prérequis**
   - Installer Python 3.10+.
   - Installer Azure CLI (`az`) si vous voulez automatiser la connexion Entra ID.
   - Vérifier que vous avez accès au tenant et au workspace Fabric cible.
2. **Créer l'inventaire de déploiement**
   - Lancer le script :
     - `./scripts/deploy_fabric_demo.py --tenant <tenant-id> --workspace <workspace-name> --interactive-login`
   - Le script valide les assets de démo et génère un manifeste dans `./artifacts/deployment_manifest_<workspace>.md`.
3. **Configurer le workspace cible**
   - Reporter les paramètres workspace/lakehouse/eventhouse dans `fabric_app/config/environments.yaml` (section `fabric`).
4. **Déployer les assets fonctionnels**
   - Notebook de génération : `fabric_app/notebooks/synthetic_data_generator.py`
   - Lakehouse SQL : `fabric_app/pipelines/historical_lakehouse.sql`
   - Eventhouse KQL : `fabric_app/pipelines/realtime_eventhouse.kql`
   - Contrats/ontologie/remédiation/écrans : `fabric_app/contracts`, `fabric_app/ontology`, `fabric_app/remediation`, `fabric_app/screens`
5. **Exécuter le parcours démo**
   - Suivre le runbook : `fabric_app/demo/e2e_demo_validation.yaml`
   - Vérifier la checklist de validation (RLS, gouvernance, latence, explainabilité).

### Exécutable d'orchestration

Commande recommandée :

`./scripts/deploy_fabric_demo.py --tenant <tenant-id> --workspace <workspace-name> --interactive-login`

Options principales :
- `--tenant` : tenant Entra ID (obligatoire)
- `--workspace` : workspace Fabric cible (obligatoire)
- `--interactive-login` : force `az login --tenant ...`
- `--skip-auth` : n'exécute pas la partie login Azure CLI
