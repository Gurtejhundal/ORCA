# System Architecture

## High-level architecture

```text
User
 │
 ▼
Web UI / Voice / Regional Language
 │
 ▼
Conversation API
 │
 ├── Session Context
 │
 ▼
Planner Agent
 │
 ├── Marine Data Task
 ├── Weather Task
 ├── GIS Task
 └── Routing Task
       │
       ▼
Tool / Data Adapter Layer
 │
 ├── INCOIS adapter
 ├── Marine forecast adapter
 ├── Weather/alerts adapter
 ├── PFZ adapter
 └── GIS layer store
       │
       ▼
Normalized Evidence Store
       │
       ▼
Deterministic Decision Engine
 │
 ├── Safety Score
 ├── Fishing Opportunity Score
 ├── Hard Gates
 ├── Route Cost
 └── Confidence
       │
       ▼
Decision Resolver
       │
       ▼
Explanation Agent
       │
       ▼
Answer + Map Layers + Evidence
```

## Core engineering rule

**LLM orchestration and deterministic calculation must be separated.**

The LLM may:
- understand intent;
- create a task plan;
- select tools;
- summarize evidence;
- explain results.

The LLM must not:
- invent SST/wave values;
- calculate safety from intuition;
- generate unverified PFZ coordinates;
- decide whether a restricted-zone intersection exists.

Those operations belong to deterministic code/tools.

## Request lifecycle

1. `POST /api/chat`
2. intent parser returns structured request.
3. planner returns task DAG.
4. executor calls adapters.
5. adapters normalize evidence.
6. decision engine scores candidates.
7. route engine compares alternatives.
8. explanation agent receives only normalized evidence + deterministic result.
9. UI receives a structured `DecisionResponse`.

## Failure isolation

Every adapter returns:

```json
{
  "status": "ok|stale|unavailable|demo",
  "source": "...",
  "observedAt": "...",
  "fetchedAt": "...",
  "data": {},
  "error": null
}
```

One failed tool must not crash the complete pipeline.
