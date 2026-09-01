# Beneficial Ownership

**Domain:** KYC · **Typology:** beneficial-ownership · **Role:** distractor (synthetic)

## Definition

Beneficial ownership identifies the natural persons who ultimately own or control a legal
entity, typically above a percentage threshold (commonly 25%). Opaque or layered ownership
structures can conceal the true controller and are a red flag across several fraud domains.

## Signals

- Ownership chains through multiple jurisdictions with no commercial rationale.
- Nominee directors or shareholders standing in for hidden principals.
- Refusal or inability to disclose ultimate beneficial owners.

## Adjacency to AML

Opaque beneficial ownership is exploited during **layering** and **integration**
(`../aml/layering.md`, `../aml/placement-integration.md`), but identifying beneficial
ownership is a KYC control, not a laundering typology. Keep the distinction: name the
typology, use ownership opacity as supporting evidence.
