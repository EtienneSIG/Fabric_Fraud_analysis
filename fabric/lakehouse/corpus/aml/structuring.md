# Structuring

**Domain:** AML · **Typology:** structuring · **Status:** internal typology definition (synthetic)

## Definition

Structuring is the deliberate act of breaking a single large cash transaction into
multiple smaller transactions, each individually below a mandatory reporting threshold,
in order to avoid triggering a currency transaction report or an automated monitoring
alert. The defining feature is **intent to evade a reporting threshold** — the amounts
are engineered to sit just under the line.

## Distinguishing signals

- Multiple cash deposits of, for example, 9,200–9,800 units when the reporting threshold
  is 10,000, across a short window (often 24–72 hours).
- Deposits split across several branches, ATMs or channels on the same day.
- Round-trip patterns where the aggregate would clearly have breached the threshold.
- A customer who asks staff about reporting limits before transacting.

## How it differs from neighbouring typologies

Structuring is defined by **threshold avoidance by a single actor or account**. It is
*not* the same as **smurfing**, where many individuals each move sub-threshold amounts on
behalf of a coordinator, nor **layering**, which is about disguising origin through chains
of transfers rather than staying under a reporting line. An investigator must cite the
threshold-avoidance intent explicitly; "many small transactions" alone is not structuring.

## Internal threshold reference

The structuring monitoring rule fires when aggregated same-customer cash credits exceed
90% of the reporting threshold across a rolling 72-hour window while no single transaction
breaches it. Escalate to SAR readiness review; do not auto-file. Human approval required.
