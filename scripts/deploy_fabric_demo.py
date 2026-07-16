#!/usr/bin/env python3
"""Fabric demo deployment helper."""

from __future__ import annotations

import argparse
import re
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
    DeploymentAsset("Environment Config", REPO_ROOT / "fabric_app/config/environments.yaml"),
    DeploymentAsset("Synthetic Notebook", REPO_ROOT / "fabric_app/notebooks/synthetic_data_generator.py"),
    DeploymentAsset("Lakehouse SQL Pipeline", REPO_ROOT / "fabric_app/pipelines/historical_lakehouse.sql"),
    DeploymentAsset("Eventhouse KQL Pipeline", REPO_ROOT / "fabric_app/pipelines/realtime_eventhouse.kql"),
    DeploymentAsset("Fraud Contracts", REPO_ROOT / "fabric_app/contracts/fraud_output_contract.json"),
    DeploymentAsset("Fraud Patterns", REPO_ROOT / "fabric_app/contracts/fraud_patterns.yaml"),
    DeploymentAsset("Ontology", REPO_ROOT / "fabric_app/ontology/fraud_ontology.yaml"),
    DeploymentAsset("Remediation Loop", REPO_ROOT / "fabric_app/remediation/alert_case_loop.yaml"),
    DeploymentAsset("Demo Validation Runbook", REPO_ROOT / "fabric_app/demo/e2e_demo_validation.yaml"),
]


def run_command(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, check=True, text=True, capture_output=True)


def ensure_az_installed() -> None:
    if shutil.which("az") is None:
        raise RuntimeError(
            "Azure CLI (`az`) not found. Install it or use --skip-auth to skip authentication checks."
        )


def authenticate(tenant: str, interactive_login: bool) -> None:
    ensure_az_installed()
    if interactive_login:
        print(f"Interactive login to tenant {tenant}...")
        subprocess.run(["az", "login", "--tenant", tenant], check=True)
    else:
        print("Validating existing Azure CLI session...")
        run_command(["az", "account", "show"])

    tenant_result = run_command(["az", "account", "show", "--query", "tenantId", "-o", "tsv"])
    current_tenant = tenant_result.stdout.strip()
    if current_tenant.lower() != tenant.lower():
        print(
            (
                f"⚠ Active tenant '{current_tenant}' differs from requested tenant '{tenant}'. "
                f"Run `az login --tenant {tenant}` to switch tenants."
            ),
            file=sys.stderr,
        )


def validate_assets() -> list[DeploymentAsset]:
    missing = [asset for asset in ASSETS if not asset.path.exists()]
    if missing:
        missing_text = "\n".join(f"- {asset.label}: {asset.path}" for asset in missing)
        raise RuntimeError(f"Missing assets:\n{missing_text}")
    return ASSETS


def write_manifest(tenant: str, workspace: str, assets: list[DeploymentAsset]) -> Path:
    artifacts_dir = REPO_ROOT / "artifacts"
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    workspace_slug = re.sub(r"[^a-z0-9_-]+", "_", workspace.lower()).strip("_") or "workspace"
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
            "1. Import the synthetic data notebook into the workspace.",
            "2. Deploy the Lakehouse SQL script to initialize curated/case tables.",
            "3. Deploy the Eventhouse KQL query for realtime features.",
            "4. Publish contracts, ontology, scoring specs, and UX screens.",
            "5. Run end-to-end validation (`fabric_app/demo/e2e_demo_validation.yaml`).",
        ]
    )
    manifest.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return manifest


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Assisted deployment of Fabric demo.")
    parser.add_argument("--tenant", required=True, help="Target Entra ID tenant.")
    parser.add_argument("--workspace", required=True, help="Target Fabric workspace name.")
    parser.add_argument(
        "--interactive-login",
        action="store_true",
        help="Opens an interactive login via `az login --tenant`.",
    )
    parser.add_argument(
        "--skip-auth",
        action="store_true",
        help="Skips the Azure CLI authentication phase.",
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
        extra_details = ""
        if isinstance(exc, subprocess.CalledProcessError) and exc.stderr:
            extra_details = f"\n{exc.stderr.strip()}"
        print(f"❌ Assisted deployment failed: {exc}{extra_details}", file=sys.stderr)
        return 1

    print("✅ Deployment preparation complete.")
    print(f"Generated manifest: {manifest}")
    print("Follow the manifest runtime sequence to complete deployment in Fabric.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
