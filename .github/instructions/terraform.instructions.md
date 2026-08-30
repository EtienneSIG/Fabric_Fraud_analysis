---
applyTo: "infra/terraform/**"
---
# Terraform rules

- Providers: `azurerm` (features {}) and `azuread`. Pin versions in `providers.tf`.
- Scope: Azure **support** resources only. Do NOT provision Fabric items here — those stay with the
  PowerShell + REST scripts under `fabric/`.
- **Naming via `locals`.** All resource names derive from a single naming local using the
  `fraudintel` workload token + `var.environment` (see `.github/instructions/naming.instructions.md`).
- **No secrets in state or code.** Generated secrets (Entra client secret, bot secret) go into Key
  Vault; apps read them via Key Vault references / managed identity. Never output secrets in plaintext.
- **Managed identity + least-privilege RBAC.** Prefer user-assigned MI for the Function App; grant
  Key Vault Secrets User, AI project data-plane, and Event Hub roles by assignment, not by keys.
- **Graph app registration is delegated** (OBO), least-privilege scopes only.
- Model deployment names are variables (`model_orchestrator`, `model_reasoning`, `model_extraction`,
  `model_embeddings`); validate availability/quota per region before apply.
- `outputs.tf` exposes only what the app/scripts consume (endpoints, ids) mapped to `VITE_*` names.
- Verify with `terraform fmt -check` and `terraform validate` before proposing apply. Never run
  `terraform apply` without explicit user confirmation.
