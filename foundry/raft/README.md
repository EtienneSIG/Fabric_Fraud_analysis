# RAFT — Retrieval-Augmented Fine-Tuning for AML

This layer teaches a model to **reason over retrieved fraud documents** rather than merely
retrieve them. It is the only unstructured-document path in the repository (everything else is
SQL over Delta tables, the ontology graph, or KQL) and it is deliberately complementary to the
Fabric Data Agent's NL2SQL grounding.

It also implements the `model iteration` edge of the closed remediation loop in the root
`README.md` — the edge that was dotted because nothing implemented it. RAFT *completes* that
architecture; it does not bolt on a new one.

## Why AML

AML alert investigation / SAR readiness is the single training domain. It is document-grounded
by nature (typologies, thresholds, obligations live in prose), its output is already structured
and objectively gradeable (subject · typology · pattern · assessment · recommendation), and its
typologies overlap heavily (structuring / smurfing / layering) which produces genuinely hard
distractors. The other five fraud domains stay in the corpus as **distractors only** — do not
broaden training scope.

## Pipeline (four separate stages)

| Notebook | Stage | Runtime | Cost |
| --- | --- | --- | --- |
| `1_gen.ipynb` | Generate the synthetic RAFT dataset (teacher) | ~5 min → hours | a few USD of tokens |
| `2_finetune.ipynb` | Fine-tune the student (SFT/LoRA) | ~1.5 h | training a few USD |
| `3_deploy.ipynb` | Deploy the student (Developer tier) | < 10 min | **hosting — see warning** |
| `4_eval.ipynb` | Baseline vs RAFT (delegates to `eval/`) | ~ Stage 1 | a few USD of tokens |

Every notebook runs interactively **and** non-interactively via papermill and reads config from
the environment. Model names come from `parameters/*.yaml`, never from a notebook cell.

```powershell
papermill 1_gen.ipynb out/1_gen.ipynb -f parameters/gpt-4.1-mini.yaml
```

> **Générer dans Fabric plutôt qu'en local ?** [`fabric/`](fabric/) matérialise l'ingestion OneLake :
> `gen_fabric.ipynb` (lit `Files/corpus`, écrit `Files/raft/*.jsonl`) + `deploy_pipeline.ps1` (Data
> Pipeline planifiable). Même logique que `1_gen.ipynb`, IO OneLake. Voir [`fabric/README.md`](fabric/README.md).

Install the notebook dependencies with **uv** (`pyproject.toml`):

```powershell
uv sync                                   # dev: resolves from pyproject
# or, reproducible / CI (exact pins + hashes, index-agnostic):
uv pip install --require-hashes -r requirements.txt
```

It uses the OpenAI Python SDK against Azure OpenAI, api-version `2025-04-01-preview` (so the
`trainingType` tier applies) with hyperparameters under `method`, and the Cognitive Services
management SDK for deployment. `requirements.txt` is the committed pin set (produced by
`uv export --frozen --no-emit-project --format requirements.txt -o requirements.txt`).
**`uv.lock` is git-ignored** — on a managed workstation it embeds internal feed URLs; relock
off-station only.

> **Prefer the portal?** The whole train-and-deploy flow can be done **100 % in the Foundry UI**
> (no SDK) — see the step-by-step guide with screenshots:
> [docs/raft-finetune-foundry-ui.md](../../docs/raft-finetune-foundry-ui.md).

## Model targets (see `.github/instructions/raft.instructions.md`)

- **Student:** `gpt-4.1-mini` (SFT/DPO GA, supports tool calling, Sweden Central).
- **Teacher:** `gpt-5.4` or `gpt-4.1` (dataset generation only; batch). `gpt-5.4` is unverified —
  fall back to `gpt-4.1` if unavailable in-region.
- **Baseline:** `gpt-4.1` (same family as the student, isolates the fine-tuning delta).
- No GPT-5-series model supports SFT; the gpt-4.1 family is the ceiling for RAFT.

## Cost — the hosting fee is the trap, not the training

Training a ~1M-token dataset over 2 epochs costs about **$4** (≈$2 on Developer). **Hosting is
the risk:** a Standard/Global-Standard deployment bills **$1.70/hour regardless of traffic**
(~$857 over a three-week prep window). Always deploy on the **Developer tier**: no hourly fee,
Global-Standard token rates, no SLA.

**Developer-tier deployments are auto-removed after 24 h.** Recreate the endpoint on the morning
of the demo with `redeploy_student.ps1` (see the day-of checklist in
`docs/exec-demo-narrative.md`). This is the single largest operational risk.

## Roles

Fine-tuning access requires the **Cognitive Services OpenAI Contributor** role on the Foundry
(Azure OpenAI) resource; **deploying** the resulting model additionally needs
`Microsoft.CognitiveServices/accounts/deployments/write` (Foundry Owner). A user who can train
cannot necessarily deploy. See
[Customize a model with fine-tuning](https://learn.microsoft.com/azure/foundry/openai/how-to/fine-tuning).

## Data

`data/` holds versioned, reproducible artefacts: `seed_questions.jsonl` (deterministic AML seed,
also emitted by the WS-5 trace exporter), `eval_questions.jsonl`, and `*.sample.jsonl` illustrating
the Chat Completions RAFT format. Training/validation files are JSONL, **UTF-8 with BOM**, < 512 MB.
The system message is **identical between training and inference** — a silent failure mode if it
drifts.

## Possible evolution

A second, specialist student `Phi-4-mini-instruct` (a leaf answering model behind the orchestrator,
never the orchestrator itself — Phi-4 has no tool calling) is out of scope for this iteration: it
runs on the classic-portal hub-based path and adds a second pipeline to maintain.
