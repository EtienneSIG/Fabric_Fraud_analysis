#!/usr/bin/env python3
"""Fabric demo deployment helper."""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class DeploymentAsset:
    label: str
    path: Path


ASSETS = [
    DeploymentAsset("Environment config", REPO_ROOT / "fabric_app/config/environments.yaml"),
    DeploymentAsset("Synthetic notebook", REPO_ROOT / "fabric_app/notebooks/synthetic_data_generator.py"),
    DeploymentAsset("Lakehouse SQL pipeline", REPO_ROOT / "fabric_app/pipelines/historical_lakehouse.sql"),
    DeploymentAsset("Eventhouse KQL pipeline", REPO_ROOT / "fabric_app/pipelines/realtime_eventhouse.kql"),
    DeploymentAsset("Fraud contracts", REPO_ROOT / "fabric_app/contracts/fraud_output_contract.json"),
    DeploymentAsset("Fraud patterns", REPO_ROOT / "fabric_app/contracts/fraud_patterns.yaml"),
    DeploymentAsset("Ontology", REPO_ROOT / "fabric_app/ontology/fraud_ontology.yaml"),
    DeploymentAsset("Remediation loop", REPO_ROOT / "fabric_app/remediation/alert_case_loop.yaml"),
    DeploymentAsset("Demo validation runbook", REPO_ROOT / "fabric_app/demo/e2e_demo_validation.yaml"),
]


def run_command(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, check=True, text=True, capture_output=True)


def ensure_az_installed() -> None:
    if shutil.which("az") is None:
        raise RuntimeError("Azure CLI (`az`) introuvable. Installez-le ou utilisez --skip-auth.")


def authenticate(tenant: str, interactive_login: bool) -> None:
    ensure_az_installed()
    if interactive_login:
        print(f"Connexion interactive au tenant {tenant}...")
        subprocess.run(["az", "login", "--tenant", tenant], check=True)
    else:
        print("Validation de la session Azure CLI existante...")
        run_command(["az", "account", "show"])

    tenant_result = run_command(["az", "account", "show", "--query", "tenantId", "-o", "tsv"])
    current_tenant = tenant_result.stdout.strip()
    if current_tenant.lower() != tenant.lower():
        print(
            f"⚠ Tenant actif '{current_tenant}' différent du tenant demandé '{tenant}'.",
            file=sys.stderr,
        )


def validate_assets() -> list[DeploymentAsset]:
    missing = [asset for asset in ASSETS if not asset.path.exists()]
    if missing:
        missing_text = "\n".join(f"- {asset.label}: {asset.path}" for asset in missing)
        raise RuntimeError(f"Assets manquants:\n{missing_text}")
    return ASSETS


def write_manifest(tenant: str, workspace: str, assets: list[DeploymentAsset]) -> Path:
    artifacts_dir = REPO_ROOT / "artifacts"
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    workspace_slug = workspace.lower().replace(" ", "_")
    manifest = artifacts_dir / f"deployment_manifest_{workspace_slug}.md"

    lines = [
        "# Fabric demo deployment manifest",
        "",
        f"- Tenant: `{tenant}`",
        f"- Workspace: `{workspace}`",
        "",
        "## Assets to deploy",
        "",
    ]
    lines.extend(f"- {asset.label}: `{asset.path.relative_to(REPO_ROOT)}`" for asset in assets)
    lines.extend(
        [
            "",
            "## Runtime sequence",
            "",
            "1. Importer le notebook de génération de données synthétiques dans le workspace.",
            "2. Déployer le script SQL Lakehouse pour initialiser les tables de curation/cases.",
            "3. Déployer la requête KQL Eventhouse pour les features temps réel.",
            "4. Publier les contrats, l'ontologie, les specs de scoring et les écrans.",
            "5. Exécuter la validation E2E (`fabric_app/demo/e2e_demo_validation.yaml`).",
        ]
    )
    manifest.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return manifest


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Déploiement assisté de la démo Fabric.")
    parser.add_argument("--tenant", required=True, help="Tenant Entra ID cible.")
    parser.add_argument("--workspace", required=True, help="Nom du workspace Fabric cible.")
    parser.add_argument(
        "--interactive-login",
        action="store_true",
        help="Ouvre une connexion interactive via `az login --tenant`.",
    )
    parser.add_argument(
        "--skip-auth",
        action="store_true",
        help="Ignore la phase d'authentification Azure CLI.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        if not args.skip_auth:
            authenticate(args.tenant, args.interactive_login)

        assets = validate_assets()
        manifest = write_manifest(args.tenant, args.workspace, assets)
    except (RuntimeError, subprocess.CalledProcessError) as exc:
        print(f"❌ Échec du déploiement assisté: {exc}", file=sys.stderr)
        return 1

    print("✅ Préparation de déploiement terminée.")
    print(f"Manifeste généré: {manifest}")
    print("Suivez ensuite la séquence du manifeste pour déployer dans Fabric.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
