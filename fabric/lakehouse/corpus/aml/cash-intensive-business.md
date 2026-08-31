# Cash-Intensive Business Commingling

**Domain:** AML · **Typology:** cash-intensive-business · **Status:** internal reference (synthetic)

## Definition

Cash-intensive businesses (restaurants, car washes, convenience retail) generate large
volumes of legitimate cash, which makes them attractive for **commingling** illicit funds
with genuine takings during the placement stage. The defining challenge is that the
illicit cash is hidden inside otherwise plausible business activity.

## Distinguishing signals

- Declared cash takings inconsistent with observable business size or footfall.
- Deposits that do not track the seasonality or hours of the stated business.
- Round-number "takings" or takings that suspiciously always sit just under thresholds
  (overlap with `structuring.md`).
- Rapid outbound transfers that empty the account after each deposit.

## How it differs from neighbouring typologies

Commingling is a **placement** technique like structuring and smurfing, but its cover is a
*legitimate cash business* rather than splitting amounts across people or transactions. The
discriminator is the presence of a plausible cash-generating front. Where takings are also
split to stay under a threshold, cite structuring as well.

## Controls

Baseline expected takings from business profile; alert on divergence and on
deposit-then-sweep patterns. Escalate to SAR readiness; human approval required.
