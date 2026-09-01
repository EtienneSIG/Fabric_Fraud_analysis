# Card-Not-Present Fraud

**Domain:** Card · **Typology:** card-not-present · **Role:** distractor (synthetic)

## Definition

Card-not-present (CNP) fraud is unauthorised use of card credentials where the physical
card is not presented — online, telephone or mail order. The credentials are stolen
(phishing, data breach, skimming) and used remotely. This is a **card fraud** typology and
is deliberately included in the corpus as a distractor for AML retrieval: a retriever that
surfaces this for a money-laundering question has failed.

## Signals

- Transactions from a device or geography inconsistent with the cardholder.
- Rapid card-testing: many small authorisations to validate stolen numbers.
- Shipping-billing address mismatch, high-risk merchant category.

## Not to be confused with

CNP fraud is unrelated to AML typologies such as structuring or layering. It is also
distinct from **friendly fraud** and **chargeback abuse**, where the genuine cardholder
disputes a legitimate purchase — see `friendly-fraud.md` and `chargeback-vs-dispute.md`.
