# SAR Readiness Assessment Guidance

**Domain:** AML · **Typology:** sar-readiness · **Status:** internal guidance (synthetic)

## Purpose

This guidance defines when an AML alert is **ready for a suspicious activity report (SAR)**
and what a defensible narrative must contain. A SAR is filed on *reasonable suspicion*, not
proof. The analyst assembles readiness; a human authoriser decides to file. The system
never files automatically.

## The five-part narrative

Every SAR-ready narrative produced in the AML Copilot follows the same structure so it is
objectively gradeable:

1. **Subject** — the customer/account under suspicion, with identifiers.
2. **Typology** — the named laundering typology (structuring, smurfing, layering,
   trade-based, etc.), citing the exact internal rule breached.
3. **Pattern** — the observed money-movement pattern, with dates and amounts.
4. **Assessment** — why the activity is suspicious and inconsistent with known profile.
5. **Recommendation** — file / do not file / gather more evidence, with rationale.

## Readiness checklist

- The typology is named and the *specific* threshold or rule is cited, not a generic label.
- The pattern is grounded in actual transactions, not inferred.
- Known customer profile (expected activity) is contrasted with observed activity.
- Exculpatory explanations have been considered and addressed.

## Regulatory framing (original summary)

Under AML obligations broadly comparable to PSD2-era and FATF expectations, regulated firms
must monitor, detect and report suspicious activity, and must be able to demonstrate the
reasoning behind a decision to file or not. Cite the obligation in your own words; do not
reproduce published regulatory text verbatim.
