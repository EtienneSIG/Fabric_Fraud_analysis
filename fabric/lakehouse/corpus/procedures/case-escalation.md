# Case Escalation Procedure

**Domain:** Procedures · **Typology:** case-escalation · **Role:** procedure (synthetic)

## Purpose

Defines how a monitoring alert becomes a case and how a case is escalated. Cross-domain:
applies to AML, card, KYC and identity alerts alike. Human approval gates every material
step; agents are advisory only.

## Steps

1. **Alert triage** — confirm the firing rule against actual data; discard obvious noise.
2. **Case creation** — open a case, attach the alert, customer 360 and evidence.
3. **Investigation** — assemble the narrative (for AML, the five-part SAR structure).
4. **Escalation decision** — analyst recommends; authoriser decides. For AML, a SAR-ready
   case is escalated to the nominated officer, never auto-filed.
5. **Outcome & writeback** — decision and rationale are written to the audit trail and the
   OneLake decision tables, feeding the retraining backlog.

## References

AML narrative: `../aml/sar-filing-guidance.md`. Filing steps: `sar-filing-procedure.md`.
Freeze action: `card-freeze.md`.
