# Claims Image Reuse

**Domain:** Claims · **Typology:** image-reuse · **Role:** distractor (synthetic)

## Definition

Claims image reuse is an insurance-fraud technique where the same damage photograph — or a
lightly altered copy — is submitted across multiple claims. Detection relies on perceptual
image hashing to find near-duplicate images rather than on document reasoning.

## Signals

- Perceptual hash collisions between images on unrelated claims.
- EXIF metadata inconsistent with the claimed incident date or location.
- Identical damage patterns across different policyholders.

## Why this is only a distractor

This is an **image-similarity / ML problem**, not a retrieval-over-documents problem, and
it belongs to insurance claims, not AML. It is included so the corpus spans the app's
breadth, but it must never be surfaced for an AML question. Kept deliberately out of RAFT
training scope.
