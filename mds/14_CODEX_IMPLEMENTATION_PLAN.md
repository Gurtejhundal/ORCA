# Codex Implementation Plan

Use this file as the master execution sequence.

## Phase 0 — Repository scaffold

Ask Codex to create:

```text
/apps/web
/services/geo
/packages/contracts
/data/demo
/docs
```

Set:
- TypeScript strict mode;
- linting;
- `.env.example`;
- shared schemas;
- health endpoint.

Acceptance:
- app boots;
- map renders;
- FastAPI health works;
- contracts compile.

---

## Phase 1 — Static end-to-end vertical slice

Implement with fixture data first:

```text
query
→ structured plan
→ candidate zones
→ deterministic scores
→ route comparison
→ map
→ explanation
```

Do not integrate live APIs yet.

Acceptance:
- flagship query completes end-to-end;
- no hard-coded final prose;
- changing fixture values changes decision.

---

## Phase 2 — Marine adapter

Build provider interface:

```ts
interface MarineProvider {
  getSnapshot(input: MarineRequest): Promise<Evidence[]>
}
```

Implement:
- OpenMeteoMarineProvider or selected live provider;
- FixtureMarineProvider fallback.

Acceptance:
- provider switch via env;
- timeout/retry;
- unit normalization;
- source/freshness metadata.

---

## Phase 3 — PFZ adapter

Implement:

```ts
interface FishingZoneProvider {
  getCandidates(input: FishingZoneRequest): Promise<CandidateFishingZone[]>
}
```

Use authoritative cached/current data where machine-readable live access is not robust.

Acceptance:
- never invent zone coordinates;
- data mode visible.

---

## Phase 4 — Geospatial service

Implement:
- Haversine;
- polygon intersection;
- route risk sampling;
- route candidate generation;
- GeoJSON serialization.

Acceptance tests mandatory.

---

## Phase 5 — Decision engine

Implement pure functions:

```ts
calculateSafety(...)
calculateOpportunity(...)
calculateConfidence(...)
rankCandidates(...)
compareRoutes(...)
```

No LLM dependency.

Acceptance:
- same inputs => same outputs;
- hard gates tested;
- score breakdown returned.

---

## Phase 6 — Planner/tool calling

LLM returns validated JSON only.

Use schema validation. If invalid:
- retry once with validation error;
- otherwise deterministic fallback intent parser.

Acceptance:
- flagship query maps to correct tools;
- follow-up reuses context.

---

## Phase 7 — Explanation layer

Input:
- selected decision;
- alternatives;
- normalized evidence.

Output:
- user-language explanation only.

Acceptance:
- numeric claims must be present in supplied evidence/decision;
- no new coordinates/measurements may appear.

---

## Phase 8 — UI polish

Add:
- map layer toggles;
- agent trace;
- evidence drawer;
- route comparison;
- data-source badge;
- demo reset.

---

## Phase 9 — Demo resilience

Add:
- local fixtures;
- provider timeouts;
- error banner;
- cache;
- one-click flagship demo;
- health panel hidden behind keyboard shortcut/admin route.

## Codex rule

Give Codex **one phase at a time** with acceptance criteria.  
Do not prompt: "Build the entire SIH solution."
