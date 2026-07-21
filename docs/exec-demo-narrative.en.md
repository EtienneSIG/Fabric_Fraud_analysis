# Fabric Fraud Intelligence — Executive Demo Narrative

> **One-sentence pitch:** a single, data-to-decision platform that detects,
> explains and lets you act on fraud — built entirely on Microsoft Fabric, with an
> enterprise semantic layer (Fabric IQ Ontology) and AI-generated narratives.

**Target duration:** 10–12 minutes · **Audience:** executive committee / risk & compliance leadership
**App:** https://fleet-north-8c279cc767-swedencentral.webapp.fabricapps.net

---

## 1. The problem (30 s)

Fraud costs financial institutions billions every year, but the real cost is
operational: teams juggle dozens of tools, alerts arrive without context, and every
investigation means manually reconstructing the customer's story. **The result:
delays, false positives, and decisions that are hard to audit.**

> *"Today an analyst spends most of their time gathering context, not deciding.
> We flipped that ratio."*

---

## 2. One platform, four layers (1 min)

| Layer | What the exec should take away |
| --- | --- |
| **Data** — `fraud_lakehouse` | All customer, transaction, alert and journey data in one governed lakehouse (Delta tables). A single source of truth. |
| **Semantics** — Fabric IQ Ontology | 11 business concepts (Customer, Account, Transaction, Alert, Case…) and their relationships, defined once and reused everywhere — by humans **and** by AI. |
| **Application** — Rayfin Fabric App | A modern, role-secured investigation experience, running directly inside Fabric. |
| **Intelligence** — Microsoft IQ | The intelligence layer that **grounds the agents**: **Fabric IQ** (data & ontology), **Work IQ** (M365 work context) and **Foundry IQ** (agent knowledge & tools). |

**Key message: no integration to build, no data to copy — everything lives in Fabric,
and the AI is *grounded* in reality through Microsoft IQ (no hallucination).**

> **Microsoft IQ in one sentence:** Microsoft's shared intelligence layer that gives
> agents the right context — your **data** (Fabric IQ), your **work** (Work IQ) and
> your agents' **knowledge** (Foundry IQ). Our anti-fraud platform combines all three.

---

## 3. The demo walkthrough

### Screen 1 — Dashboard (1 min)
- Open the app. Show the **KPIs** (open alerts, critical cases, amounts at risk).
- Switch the **role** (Analyst → Auditor) in the top right: the **PII data masks
  automatically**.
- **Talking point:** *"Governance isn't a layer bolted on afterwards: the role
  determines what each person sees, natively."*

### Screen 2 — Fraud Flow: the customer journey at scale (2–3 min)
- Show the **Sankey**: ~10,000 customer journeys, from first actions to the final
  event (fraud or normal activity).
- **Hover** a ribbon → the exact number of customers who follow that path appears.
- Tick **"Fraud events only"**: only the fraud typologies remain
  (Card Fraud, Account Takeover, Money Mule, Identity Fraud).
- Scroll down to the **location map**: a defrauded customer's journey is shown
  geographically — you *see* the impossible jump (e.g., Paris → Beijing in minutes).
- **Talking point:** *"We're no longer looking at rows of transactions, we're reading
  a story. The anomaly jumps out."*

### Screen 3 — Entity Graph: the network and the AI explanation (3–4 min · the highlight)
- The graph is built **from the real events**: the **red hubs** are the fraud
  typologies, the other nodes are the **customers** whose journey ends there.
- Change **"Size by"** (Degree → Betweenness): the nodes that **bridge** several
  frauds grow larger → these are the likely orchestration points of a network.
- Use the **fraud filter** to isolate one or more typologies.
- **Click a customer** → right-hand panel:
  - their centrality metrics,
  - an **AI-generated narrative** that explains *what is happening*: the journey
    sequence, the decisive signal, the possible collusion link, and **the
    recommended action**.
- **Talking point:** *"The AI doesn't just score: it tells the case and proposes the
  decision, drawing on the same ontology as our teams."*

### Screen 4 — From alert to decision (1–2 min)
- **Alert Queue → Case Detail**: open a case, show the gathered **evidence**, the
  **timeline**, and the **copilot** that drafts an investigation summary.
- Show the **decision** (escalate / SAR / close) and the traceability for audit.
- **AML Copilot** / **Claims Fraud**: same patterns for money laundering and
  insurance fraud — *one foundation, many business lines.*

### Screen 5 — Fraud IQ: from 90 minutes to 30 seconds (3 min · the highlight)

Open the **Fraud IQ** tab (the anti-fraud application of **Microsoft IQ**: Fabric IQ /
Work IQ / Foundry IQ). Run the **flagship scenario**:

**The alert context** (red banner): a card used at **03:00**, in a **hotel abroad**,
**41 transactions in 4 hours**, an **unusual country**, and the **phone located in a
different country**.

**Without Fraud IQ** (left column): the analyst runs through **10 manual steps** —
rules engine, scores, data warehouse, Teams, emails, similar incidents, procedures,
a call to a colleague, consolidation, decision → **≈ 90 minutes**.

**With Fraud IQ**: a single prompt — *"Analyze this fraud alert and recommend an
action."* — then click **"Launch the agentic investigation."** The three IQs reveal
themselves in a cascade:
- **Work IQ** *(simulated)* — a colleague handled an identical case 5 days ago; Teams
  threads mention the same hotel; a similar investigation already exists.
- **Fabric IQ** *(live on the ontology + the lakehouse)* — first out-of-country
  transaction in 12 months, velocity ~4× the baseline, purchase at 03:00, linked alert.
- **Foundry IQ** *(simulated)* — applies the fraud policy, cross-checks the typology,
  draws on the memory of past cases, and **reasons**.

**The recommendation**: **fraud confidence 92%**, **card temporarily blocked**,
**customer contact recommended**, **investigation case created automatically** →
**≈ 30 s**.

- **Talking point:** *"The same agent reasons across our data (Fabric IQ, already
  real), the way we work (Work IQ) and regulatory knowledge (Foundry IQ). We move
  from 90 minutes of manual orchestration to 30 seconds of an explained, auditable
  decision."*

> **Variants to mention** depending on the audience: KYC document fraud (OCR + vision
> + RAG + agents), anti-money-laundering (AML), an autonomous end-to-end investigation
> agent.

---

## 4. What makes this unique (1 min)

1. **Microsoft IQ**, surfaced here as **Fraud IQ** — an agent grounded on three
   dimensions at once: **data** (Fabric IQ, already live), **work** (Work IQ) and
   **knowledge** (Foundry IQ).
2. **Fabric IQ Ontology** — a governed enterprise semantic layer: the same business
   definitions power the dashboards, the agents and the workflows.
3. **Zero data copy** — the app, the lakehouse and the ontology share OneLake.
4. **Trustworthy AI** — the narratives are *grounded* in the real data and the
   ontology, not hallucinations.
5. **Native governance** — roles, PII masking and audit built in by design.
6. **Time-to-value** — deployed and iterated in days, not months.

---

## 5. Conclusion & next steps (30 s)

> *"We went from raw alerts to explained, auditable decisions — on a single platform.
> The next step: connect your real sources and calibrate the typologies to your
> scenarios."*

**Call to action:** a half-day scoping workshop to identify 2–3 priority typologies
and a pilot on a real scope.

---

### Numbers cheat sheet

- **3** Microsoft IQs combined: Fabric IQ (live), Work IQ, Foundry IQ
- **11** business entities · **11** relationships in the `fraud_ontology` ontology
- **11** governed Delta tables in `fraud_lakehouse` (~12.8k rows loaded in the demo)
- **~10,000** customer journeys analyzed in the Fraud Flow
- **4** fraud typologies + **5** benign journeys modeled
