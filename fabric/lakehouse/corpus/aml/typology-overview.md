# AML Typology Overview

**Domain:** AML · **Typology:** typology-index · **Status:** internal reference (synthetic)

## Purpose

A single entry point that indexes the money-laundering typologies this corpus covers and
states, in one line each, the discriminator that separates confusable neighbours. This is
deliberately the document a naive retriever will surface for almost any AML question — it
is a useful map but a weak citation. A SAR-ready narrative must cite the *specific*
typology document and rule, not this overview.

## Index

- **Structuring** — one actor splits their own transaction below a reporting threshold.
- **Smurfing** — many recruited actors each move sub-threshold amounts to one beneficiary.
- **Layering** — obscuring origin through chains of transfers; amount is irrelevant.
- **Trade-based** — value hidden inside mis-invoiced trade documents.
- **Placement / Integration** — the surrounding stages; see the stages reference.

## The confusable trio

Structuring, smurfing and layering are the most frequently mislabelled. Memorise the
discriminators: *who transacts* (one vs many) separates structuring from smurfing; *why the
amount is small* (threshold avoidance vs irrelevant) separates both from layering. An
answer that says only "many small transactions" has not identified a typology.

## Cross-references

Every bullet above has a dedicated document. See also `customer-risk-rating.md` and
`pep-screening.md` for the customer-context signals that raise or lower suspicion.
