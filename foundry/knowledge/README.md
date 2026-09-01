# Foundry IQ knowledge base (WS-3)

Makes the app's **Foundry IQ** real. The Fraud IQ screen combines live Fabric IQ with
simulated Work IQ and Foundry IQ; this workstream turns the Foundry IQ third into a live
**Microsoft OneLake** knowledge source over the fraud document corpus
(`fabric/lakehouse/corpus`, uploaded to `Files/corpus`).

Foundry IQ is the agentic retrieval layer — it plans sub-queries, runs them across sources
and unifies the result. That is exactly the retrieval behaviour the RAFT student (WS-4) is
trained to exploit. This layer is **additive** to the NL2SQL Data Agent, not a replacement:
structured questions still go to the Data Agent; document questions go to the corpus.

## Deploy

1. Upload the corpus: `fabric/lakehouse/corpus/upload_corpus.ps1`.
2. (Optional, recommended) provision Azure AI Search and run the indexer
   (`infra/terraform/modules/search`) for vector retrieval.
3. Create the knowledge source:

```powershell
& foundry/knowledge/deploy_knowledge.ps1 `
  -FoundryEndpoint "<tf output ai_foundry_endpoint>" `
  -WorkspaceId     "c57a379b-7e6d-481a-9c9b-662bb0bae77d" `
  -LakehouseId     "257366a1-4675-4c66-a69e-1ec7ab653706" `
  -SearchEndpoint  "<tf output search_endpoint>"   # omit for direct OneLake retrieval
```

4. Connect it to the triage topology:

```powershell
& foundry/agents/deploy_agents.ps1 `
  -FoundryEndpoint "<...>" -FabricDataAgentUrl "<...>" `
  -KnowledgeConnectionName "conn-onelake-fraud-corpus"
```

## Switching the app to live Foundry IQ

The Fraud IQ screen reads liveness from config. Set `VITE_FOUNDRY_ENABLED=true` with a
`VITE_BACKEND_API_URL` to switch Foundry IQ from *Simulated* to *Live*. With the flag off
the screen keeps its deterministic simulated behaviour, so `npm run dev:demo` is unchanged.

## Caveats

- Fabric data agents and OneLake knowledge surface in Foundry over **MCP**; the exact
  resource shape is preview. Re-verify `-ApiVersion` and the connection/knowledge payloads
  against current documentation before a client run.
- Retrieval runs with **OBO** user identity, so Fabric RLS and PII masking still hold.
- AI output stays **advisory**; human approval is always required.
