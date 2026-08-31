# Friendly Fraud

**Domain:** Card · **Typology:** friendly-fraud · **Role:** distractor (synthetic)

## Definition

Friendly fraud (first-party fraud) occurs when a genuine cardholder makes a legitimate
purchase and then falsely disputes it as unauthorised to obtain a refund while keeping the
goods. It is distinguished from third-party CNP fraud by the fact that the **real
cardholder is the perpetrator**.

## Signals

- Dispute filed on a transaction from the cardholder's own trusted device and geography.
- History of repeated disputes across merchants.
- Delivery confirmed to the cardholder's verified address.

## Confusable neighbours

Friendly fraud sits next to **chargeback abuse** and ordinary **disputes**
(`chargeback-vs-dispute.md`) and is the opposite of third-party **card-not-present** fraud
(`card-not-present.md`). It is a card-operations concept, included here purely as an AML
distractor.
