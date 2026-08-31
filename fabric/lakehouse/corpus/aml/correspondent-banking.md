# Correspondent Banking Risk

**Domain:** AML · **Typology:** correspondent-banking · **Status:** internal reference (synthetic)

## Definition

Correspondent banking is the provision of banking services by one institution (the
correspondent) to another (the respondent), typically to enable cross-border payments. It
is an AML concern because the correspondent often cannot see the respondent's underlying
customers — creating a **nested** relationship where risk is one or more steps removed.

## Key risks

- **Nested / downstream correspondents** — the respondent itself serves other banks,
  hiding the true originator.
- **Payable-through accounts** — the respondent's customers transact directly, bypassing
  the correspondent's own onboarding.
- **Opaque originator / beneficiary data** in cross-border messages.
- Exposure to higher-risk jurisdictions through the corridor.

## Relationship to layering

Correspondent chains are a common vehicle for **layering**: each hop across an institution
adds distance from the source. Distinguish the two — correspondent banking is the
*relationship*; layering is the *technique* that abuses it. A narrative should name both.

## Controls

Enhanced due diligence on respondents, transparency of originator/beneficiary information,
and monitoring for pass-through behaviour. Escalate anomalies to SAR readiness review;
human approval required.
