# Transaction Monitoring Thresholds

**Domain:** AML · **Typology:** monitoring-thresholds · **Status:** internal configuration (synthetic)

## Scope

This document records the AML transaction-monitoring thresholds referenced by SAR-readiness
narratives. All values are synthetic and illustrative; a live deployment tunes them per
jurisdiction and risk appetite.

## Thresholds

| Rule | Trigger | Window |
| --- | --- | --- |
| Cash reporting threshold | Single cash transaction ≥ 10,000 units | per transaction |
| Structuring | Aggregate same-customer cash ≥ 90% of threshold, no single breach | 72 h |
| Smurfing | ≥ 3 distinct customers crediting one beneficiary, sub-threshold | 7 d |
| Layering / pass-through | ≥ 3 hops, in/out match within 2%, held < 48 h | 48 h |
| TBML | Invoice unit price deviates > 30% from reference band | per shipment |
| Velocity | Transaction count > 5× the customer's 90-day baseline | 24 h |
| Dormant reactivation | Dormant > 180 d then high-value activity | per event |

## Usage

A monitoring rule firing is a **signal, not a verdict**. The analyst must confirm the
pattern against actual transactions, name the typology, and assess against the customer's
expected profile before the alert becomes SAR-ready. Human approval is always required.

## Cross-references

Typology definitions: `structuring.md`, `smurfing.md`, `layering.md`,
`trade-based-laundering.md`. Escalation path: `../procedures/case-escalation.md`.
