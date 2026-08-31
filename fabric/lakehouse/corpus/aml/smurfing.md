# Smurfing

**Domain:** AML · **Typology:** smurfing · **Status:** internal typology definition (synthetic)

## Definition

Smurfing is the use of **multiple people** ("smurfs") who each conduct sub-threshold
transactions on behalf of a controlling party, so that no single individual and no single
transaction attracts a report. The defining feature is **distribution across many
individuals**, coordinated toward one beneficiary.

## Distinguishing signals

- Many unrelated individuals depositing similar sub-threshold amounts into, or toward, a
  common downstream account.
- Deposits clustered in time and geography but spread across distinct customer identities.
- Beneficiary accounts that aggregate numerous third-party cash-ins with no commercial
  rationale.
- Recruited couriers who cannot explain the source of funds.

## How it differs from neighbouring typologies

Smurfing overlaps heavily with **structuring** — both keep individual amounts under a
threshold — but structuring is one actor splitting their own transaction, while smurfing
recruits **many actors**. It is also distinct from **layering**: smurfing is a placement
technique that gets cash into the system; layering is what happens afterwards to obscure
the trail. Investigators routinely confuse the three; the discriminator is *who* is
transacting and *why the amount is small*.

## Internal threshold reference

The smurfing rule fires when three or more distinct customers credit a common beneficiary
with sub-threshold cash within a rolling 7-day window. Escalate to SAR readiness review;
human approval required before any filing.
