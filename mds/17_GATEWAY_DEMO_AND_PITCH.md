# Gateway Demo and Pitch

## 3-minute demo structure

### 0:00–0:20 — Problem
"Marine data exists, but operational decisions require fishermen to combine PFZ, waves, weather, currents and geospatial restrictions. ORCA converts these fragmented sources into one evidence-backed decision."

### 0:20–0:35 — Differentiator
"ORCA is not a chatbot. Its agents retrieve evidence, while a deterministic marine decision engine scores safety, fishing opportunity and routes."

### 0:35–1:45 — Live flagship query

Use:

> "I am leaving from Nagapattinam tomorrow at 5 AM. Where should I fish and what is the safest route?"

Show:
1. task decomposition;
2. data retrieval;
3. candidate zones;
4. hazards;
5. route;
6. scores;
7. evidence.

### 1:45–2:20 — Counterfactual

Ask:

> "Why not the nearest fishing zone?"

Show side-by-side route comparison.

This is the strongest proof that ORCA reasons rather than merely retrieves.

### 2:20–2:45 — Agent conflict

Show:
- fishing opportunity high;
- safety poor;
- candidate rejected or time-window changed.

### 2:45–3:00 — Impact

"ORCA provides an extensible decision layer for fishermen, researchers and coastal operators, with regional-language interaction and transparent evidence provenance."

---

# Judge questions

## "Is this just ChatGPT with APIs?"
Answer:
No. The LLM handles intent, planning and explanation. Numerical safety, opportunity, geofence intersections and route ranking are deterministic services operating on retrieved evidence.

## "How are you validating safety?"
Answer:
The prototype uses transparent configurable scoring and hard gates. We explicitly do not claim the prototype thresholds are certified maritime standards; production deployment would require validation with INCOIS/domain authorities.

## "What happens when an API fails?"
Answer:
Each provider is isolated. ORCA exposes unavailable/stale state, reduces confidence and uses a labelled cached fallback if configured. It never fabricates missing measurements.

## "What is novel?"
Answer:
Cross-source spatiotemporal evidence fusion + conflict resolution + counterfactual safe-route comparison, exposed conversationally.

## "Why agents?"
Answer:
The tasks have different tools and evidence types. Planning, marine retrieval, weather hazards, GIS operations and explanation have separate responsibilities, while deterministic decision code prevents LLM hallucination from becoming a safety decision.
