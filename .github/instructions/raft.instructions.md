---
applyTo: "foundry/raft/**,foundry/knowledge/**,fabric/lakehouse/corpus/**"
---

# Copilot instructions — RAFT layer

These instructions cover the RAFT (Retrieval-Augmented Fine-Tuning) capability:
the fraud document corpus, the Foundry IQ knowledge base, and the notebooks that
generate, train, deploy and evaluate the domain-specialised student model.

They extend the repo-wide instructions in `.github/`; where the two overlap, the
repo-wide conventions win.

## What this layer is for

RAFT trains a model to *reason over* retrieved documents rather than merely access
them. The rest of this repository retrieves **structured** data — SQL over the 11
`fraud_lakehouse` Delta tables, the `fraud_ontology` graph, KQL over the Eventhouse.
This layer is the only **unstructured document** path, and it is deliberately
complementary: it does not replace the Fabric Data Agent's NL2SQL grounding.

It also implements the `model iteration` edge of the closed remediation loop in
`README.md` — the edge that was dotted because nothing implemented it. Keep that
framing in any documentation written here.

## Model targets

Resolve models from parameter files, never from literals in notebook cells.

- **Student: `gpt-4.1-mini`.** GA for SFT and DPO, available for fine-tuning in
  **Sweden Central** and North Central US, supports tool calling, and sits on the same
  new-Foundry path as the repository's hosted agents and MCP data-agent integration.
- **Teacher: `gpt-5.4` or `gpt-4.1`.** Dataset generation only; it never needs to be
  fine-tunable.
- **Baseline: `gpt-4.1`.** Same family as the student, so the measured delta isolates
  fine-tuning rather than a change of model family.
- **Optional second student: `Phi-4-mini-instruct`,** as a specialist answering model
  behind the orchestrator.

**Two constraints that decide the architecture.** No GPT-5-series model supports
supervised fine-tuning — GPT-5 offers reinforcement fine-tuning only, gated by
invitation — so the gpt-4.1 family is the ceiling for RAFT. And the Phi-4 family is
documented as **Tool calling: No**, so a Phi-4 model can never be the triage
orchestrator; it can only serve as a leaf answering model. Phi-4 fine-tuning also runs
on the **classic portal with a hub-based project**, a different path from the rest of
this repository — do not migrate the main flow onto it.

Watch context windows when assembling RAFT prompts: a golden document plus several
distractors is a large prompt. Phi-4 accepts 16,384 input tokens; Phi-4-mini-instruct
accepts 131,072.

**Prefer the GPT path because it is the low-friction one.** It requires no Azure
Marketplace subscription, no hub-based project and no classic portal — a Foundry project,
a JSONL file, and the portal wizard, Python SDK or REST API. Enable **automatic
deployment** on successful training (supported for OpenAI models only) to remove a manual
step. Every epoch produces a **deployable checkpoint**, so keep the last three: they give
a usable model even when a run overfits. Use **continuous fine-tuning** — a previously
fine-tuned model referenced as `base-model.ft-{jobid}` can be the base of the next job —
to implement the retraining loop rather than merely describing it.

## Cost and deployment rules

- Default fine-tuned deployments to the **Developer Tier**: no hourly hosting fee, token
  rates matching Global Standard, no SLA or data-residency guarantee. Standard and
  Global Standard bill **$1.70/hour regardless of traffic**, which over a multi-week
  preparation window dwarfs the training cost by two orders of magnitude.
- Developer Tier deployments are **removed automatically after 24 hours**. Always ship a
  one-command redeploy script alongside any deployment code, and reference it in the
  day-of checklist.
- Use the **Developer training tier** while iterating (50% off Global, pre-emptible) and
  **Global** for the final run.
- A customised model permits **only one deployment** at a time.
- Fine-tuning requires the **Foundry Owner** role, or a custom role carrying
  `Microsoft.CognitiveServices/accounts/deployments/write`. A Foundry User can train but
  cannot deploy.

## Use-case scope

- The training domain is **AML alert investigation / SAR readiness**, surfaced through
  the AML Copilot screen. Its output is already structured — subject, typology, pattern,
  assessment, recommendation — which makes it objectively gradeable.
- The other five fraud domains (card, KYC, identity, claims, collusion networks) belong
  in the corpus as **distractors**, not as training targets. Do not broaden the training
  scope to cover them — it dilutes the dataset and weakens the measured result.
- Provider/collusion network fraud is a graph-centrality problem, not a retrieval
  problem. Keep it out of the RAFT scope entirely.
- Near-duplicate, easily-confused documents are **intentional**. Do not deduplicate or
  "clean up" overlapping typology definitions — structuring, smurfing and layering must
  stay confusable, because the distractors are the point.

## Data rules

- **Synthetic content only.** No real customer data, ever.
- **No verbatim third-party regulatory text.** Write original summaries of PSD2 / AML
  obligations rather than reproducing published text.
- Any export from the `AgentRun` entity must pass through the existing PII masking
  helpers before it reaches `foundry/raft/data/`.
- Datasets under `foundry/raft/data/` are versioned artefacts: committed, reproducible,
  and regenerated deterministically from a parameter file.
- Training and validation files are **JSONL in the Chat Completions conversational
  format, UTF-8 with a byte-order mark, under 512 MB each**. Start from at least 50
  well-crafted examples; a job accepts 10 but that is far too few to influence the model.
  Prune low-quality examples before adding volume — they actively hurt.

## Notebook conventions

- Keep the four-stage split — generate, fine-tune, deploy, evaluate — as separate
  notebooks. Do not merge stages: each has a very different run time and cost profile,
  and they are demonstrated separately.
- Every notebook must run **both** interactively and non-interactively from a papermill
  parameter file. No stage may depend on state left in another notebook's kernel.
- Notebooks read configuration from the environment, never from hard-coded endpoints,
  keys, workspace IDs or deployment names.
- Print run time and estimated cost at the top of each notebook.
- **Keep the system message identical between training and inference.** A fine-tuned chat
  model behaves unpredictably when the deployed system message differs from the trained
  one — a silent failure mode that surfaces on stage.
- Verify regional quota before the first run of any training job.

## Infrastructure

- Azure resources for this layer go in `infra/terraform/`, following the existing module
  layout. Do not provision from notebooks what Terraform can provision.
- Azure AI Search must be **Basic tier or higher** and **in the same tenant** as the
  Fabric workspace, otherwise the OneLake indexer cannot be created.
- Document required roles in the module README. Management-plane roles alone are not
  sufficient for Foundry development actions.

## Evaluation

- Every claim about model quality must be reproducible from `foundry/raft/eval/`.
  Never state an improvement that the harness cannot regenerate.
- Always report baseline **and** tuned figures together. A tuned score on its own is
  not evidence.
- Report quality and economics side by side: groundedness, retrieval quality and
  relevance, plus tokens per investigation, latency and cost per 1 000 investigations.

## Integration with the existing app

- New capability is **additive and config-gated**, following the existing `isMock()`
  pattern. `npm run dev:demo` must keep working fully offline with deterministic seed
  data after every change.
- All new user-facing strings are localised in **EN, FR and ES**.
- AI output stays **advisory**. A fine-tuned model does not remove human approval, and
  every run continues to be written to `AgentRun` and the audit trail.
