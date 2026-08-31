# CNP Detection Thresholds

**Domain:** Card · **Typology:** cnp-thresholds · **Role:** distractor (synthetic)

## Scope

Illustrative detection thresholds for card-not-present fraud. Synthetic values, present as
an AML distractor — these thresholds have nothing to do with money-laundering monitoring.

## Thresholds

| Rule | Trigger | Window |
| --- | --- | --- |
| Card testing | > 5 authorisations under 2 units on one PAN | 10 min |
| Velocity | > 8 CNP transactions on one card | 1 h |
| Geo-impossibility | Two authorisations implying travel faster than feasible | per pair |
| New-device high-value | First-seen device, transaction > 500 units | per event |

## Note

If a retriever returns this table for a question about structuring or SAR readiness, that
is exactly the failure mode RAFT is trained to correct. AML thresholds live in
`../aml/transaction-monitoring-thresholds.md`.
