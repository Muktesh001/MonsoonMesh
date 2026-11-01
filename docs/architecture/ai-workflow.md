# AI analysis workflow

```mermaid
flowchart TD
  Input[Validated incident facts] --> Context[Construct report context]
  Context --> Analysis[Local deterministic structured fallback]
  Analysis --> Check[Validate response schema]
  Check --> Persist[Persist recommendation]
  Persist --> Human[Operator review required]
```

The current service does not call Gemini, infer facts from images, or execute tools.
The LangGraph/RAG, citation retrieval, Gemini adapter, and image analysis remain
unimplemented work. AI output is explicitly uncertain and never dispatches a team.
