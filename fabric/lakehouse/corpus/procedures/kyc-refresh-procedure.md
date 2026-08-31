# KYC Refresh Procedure

**Domain:** Procedures · **Typology:** kyc-refresh · **Role:** procedure (synthetic)

## Purpose

Operational steps to execute a KYC refresh once triggered. The *policy* for when to refresh
lives in `../kyc/kyc-refresh.md`; this is the *how*.

## Steps

1. Determine trigger (cycle or event) and required verification depth by risk band.
2. Request and verify updated identity, address and beneficial-ownership evidence.
3. Re-screen for PEP and adverse media (see `../aml/pep-screening.md`).
4. Recompute the customer risk rating and update the monitoring baseline.
5. Record the refresh, evidence and any risk-band change in the audit trail.

## Note

A completed refresh strengthens later AML assessments by keeping "expected activity"
current. An overdue refresh should itself be flagged as a control gap during any
investigation. Human approval required for any resulting risk-band change.
