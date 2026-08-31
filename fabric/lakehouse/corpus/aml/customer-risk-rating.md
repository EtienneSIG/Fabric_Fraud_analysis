# Customer Risk Rating

**Domain:** AML · **Typology:** customer-risk-rating · **Status:** internal methodology (synthetic)

## Purpose

Customer risk rating sets the baseline against which monitoring alerts are judged. The same
transaction pattern is more or less suspicious depending on the customer's risk profile and
expected activity. A SAR-ready narrative must contrast **observed** activity against
**expected** activity — this document defines "expected".

## Risk factors

- **Customer type** — individual, SME, corporate, trust, cash-intensive business.
- **Geography** — residence, operating jurisdictions, corridors used.
- **Product** — accounts, wires, trade finance, correspondent relationships.
- **Behavioural baseline** — typical volumes, counterparties and channels over 90 days.
- **PEP / adverse media status** — see `pep-screening.md`.

## Rating bands

Ratings are Low, Medium, High. High-risk customers receive enhanced due diligence and a
tighter monitoring threshold multiplier. A velocity alert that is noise for a High-risk
trading company may be highly suspicious for a Low-risk salaried individual.

## Use in narratives

When assessing an alert, state the customer's risk band and expected activity first, then
show how the observed pattern departs from it. "Inconsistent with profile" is only credible
when the profile is stated. Human approval required before any filing decision.
