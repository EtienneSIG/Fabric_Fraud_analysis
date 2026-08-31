# RAFT evaluation harness (WS-7)

Proves the session's claim with numbers, not impressions. Runs the same question set against the
**baseline** (`gpt-4.1`) and the **RAFT-tuned student**, scores groundedness, retrieval quality
and relevance, and captures the economics — tokens per investigation, latency, and cost per 1,000
investigations. Always reports **baseline and tuned together**; a tuned score alone is not evidence.

## Run (one command)

```powershell
python harness.py `
  --questions ../data/eval_questions.jsonl `
  --baseline gpt-4.1 `
  --student-deployment raft-student `
  --out results
```

Writes `results/results-<stamp>.json` and `results/latest.json`. `4_eval.ipynb` calls the same
`run_comparison` / `write_results` functions, so notebook and CLI produce identical numbers.

## Live vs offline

- **Offline (default):** deterministic stubs, so the harness runs with no Azure and the app's
  Model Quality tab always has numbers. Reproducible from a clean clone.
- **Live:** set `AI_FOUNDRY_ENDPOINT` and `RAFT_EVAL_LIVE=1` to score real completions from the
  baseline model and the deployed student. Groundedness is checked with the Foundry built-in
  evaluators (Azure AI Content Safety) — consistency of the response with the supplied context,
  exactly the failure mode RAFT corrects.

## Committed artefact

`results/sample.json` is the versioned baseline-vs-RAFT snapshot the app reads offline (WS-9). Real
runs overwrite `latest.json`; regenerate `sample.json` from a run you want to pin.

Price assumptions for the offline economics are overridable with `RAFT_BASELINE_PRICE_PER_1M` and
`RAFT_STUDENT_PRICE_PER_1M`.
