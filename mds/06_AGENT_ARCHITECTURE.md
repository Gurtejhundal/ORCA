# Agent Architecture

Do not create agents just to increase the count. Six roles are enough.

## 1. Planner Agent

### Responsibility
Convert a user request into an executable task graph.

### Inputs
- user message;
- conversation context;
- current time;
- known user location if supplied.

### Output
Strict JSON plan.

### Forbidden
- fetching data itself;
- making final safety judgments.

---

## 2. Marine Intelligence Agent

### Responsibility
Retrieve/normalize:
- PFZ/fishing advisory;
- SST;
- chlorophyll when available;
- waves;
- currents;
- tides/ocean variables.

### Tools
Only data adapters.

---

## 3. Weather & Hazard Agent

### Responsibility
Retrieve:
- wind;
- storm/cyclone/lightning advisory where available;
- hazardous weather indicators;
- relevant forecast window.

---

## 4. Geospatial Agent

### Responsibility
Pure geospatial operations:
- distance;
- nearest candidate;
- point-in-polygon;
- route-boundary intersections;
- buffered hazard zones;
- route geometry preparation.

No natural-language reasoning is required here.

---

## 5. Decision & Conflict Resolver

### Responsibility
Combine deterministic outputs.

Example conflict:

```text
Fishing Opportunity = 92
Safety = 38
```

Result:
`REJECT candidate due to hard safety gate`.

The fishing agent is not allowed to override the safety engine.

---

## 6. Explanation Agent

### Responsibility
Turn the final machine result into:
- concise user answer;
- evidence bullets;
- route comparison;
- warning text;
- regional-language output.

It receives the completed decision, not raw internet access.

## Agent trace for demo

Expose a lightweight trace:

```text
Planner         ✓ 6 tasks
Marine Agent    ✓ PFZ + SST + waves
Weather Agent   ✓ wind + advisory
GIS Agent       ✓ 2 boundary checks
Decision Engine ✓ 3 candidates scored
Route Engine    ✓ 2 routes compared
Explanation     ✓ answer generated
```

This makes agentic execution visible to judges.
