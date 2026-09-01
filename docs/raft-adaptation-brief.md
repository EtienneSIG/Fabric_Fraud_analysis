# RAFT adaptation brief — Fabric Fraud Intelligence

Reference for the RAFT (Retrieval-Augmented Fine-Tuning) capability added to this repository
for the session **"Teaching AI Agents to Read Like Domain Experts"**. It teaches a model to
*reason over* retrieved fraud documents rather than merely retrieve them, and it makes the
`model iteration` edge of the closed remediation loop (root `README.md`) solid.

The authoritative, path-scoped rules live in
[`.github/instructions/raft.instructions.md`](../.github/instructions/raft.instructions.md).
This document is the human-readable overview.

## Why it exists

Every other retrieval path in the repository is **structured** — SQL over the 11
`fraud_lakehouse` Delta tables, the `fraud_ontology` graph, KQL over the Eventhouse. RAFT is
the only **unstructured document** path. It needs a corpus, a retrieval layer over it, a
synthetic training set, a fine-tuned student and an evaluation harness that proves the gain.

## Training scope — train one, distract with the rest

The training domain is **AML alert investigation / SAR readiness** (the AML Copilot screen):
document-grounded by nature, already structured (subject · typology · pattern · assessment ·
recommendation) so objectively gradeable, with heavily overlapping typologies (structuring /
smurfing / layering) that make genuinely hard distractors. The other five fraud domains stay
in the corpus **only as distractors** — never widen training scope.

## Model targets

- **Student:** `gpt-4.1-mini` (SFT/DPO GA, tool calling, Sweden Central).
- **Teacher:** `gpt-5.4` or `gpt-4.1` (dataset generation only; `gpt-5.4` unverified → fall
  back to `gpt-4.1`).
- **Baseline:** `gpt-4.1` (same family as the student, isolates the fine-tuning delta).
- No GPT-5-series model supports SFT; Phi-4 has no tool calling (leaf model only, classic
  portal) and is out of scope for this iteration.

## Cost — hosting is the trap

Training a ~1M-token set over 2 epochs ≈ **$4**. A Standard/Global-Standard deployment bills
**$1.70/hour regardless of traffic** (~$857 over three weeks). Always deploy on the
**Developer tier** (no hourly fee) — but it is **auto-removed after 24 h**, so recreate it on
demo morning with `foundry/raft/redeploy_student.ps1` (see the day-of checklist in
[`exec-demo-narrative.md`](exec-demo-narrative.md)).

## Workstreams (as shipped)

| WS | What | Where |
| --- | --- | --- |
| WS-1 | Fraud document corpus (~27 docs, AML training + distractors) | `fabric/lakehouse/corpus/` |
| WS-2 | Azure AI Search over OneLake (service in TF, indexer in script) | `infra/terraform/modules/search/` |
| WS-3 | Foundry IQ knowledge base + agent wiring | `foundry/knowledge/` |
| WS-4 | RAFT notebooks (generate · fine-tune · deploy · eval) | `foundry/raft/` |
| WS-5 | AgentRun trace exporter → seed questions | `backend/` |
| WS-6 | Student deployment (Terraform, Developer tier) + redeploy script | `infra/terraform/`, `foundry/raft/` |
| WS-7 | Evaluation harness (baseline vs RAFT + economics) | `foundry/raft/eval/` |
| WS-8 | Live baseline-vs-RAFT A/B toggle | AML Copilot screen |
| WS-9 | Model quality & cost tab | Settings & Governance screen |
| WS-10 | Docs & Copilot conventions | `.github/`, `docs/` |

## Non-negotiables

- `npm run dev:demo` keeps working fully offline; every new capability is additive and
  config-gated (`isMock()` / `isRaftEnabled()`).
- Human-in-the-loop stays mandatory; AI output is advisory and audited.
- Synthetic data only; no verbatim regulatory text; no secrets in the repo.

## Definition of done

- The demo runs end to end from a clean clone plus documented Azure prerequisites.
- `npm run dev:demo` still works fully offline, unchanged.
- The baseline-vs-RAFT comparison is reproducible and its numbers are versioned
  (`foundry/raft/eval/results/sample.json`).
- A one-command redeploy exists and is in the day-of checklist.
- The `model iteration` edge in the README diagram is solid, not dotted.
