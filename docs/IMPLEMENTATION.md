# First vertical slice

The supplied mds files remain the source specifications. This implementation covers the attached first-milestone brief; it does not claim the entire Gateway definition of done (including rehearsals, live sources and multilingual support).

## Data flow

1. A bounded deterministic English parser resolves a trip and an explicit IST time. It asks for missing fields.
2. The execution plan runs marine/fishing and weather providers concurrently. Each failure becomes an unavailable result.
3. GeoJSON routes are checked using Turf intersection/containment, including segments whose endpoints lie outside a polygon. Every route must remain inside the synthetic water mask.
4. Routes are sampled at intervals no greater than 1 km, including both endpoints. Each point has a calculated arrival time using the configurable assumed speed.
5. For each variable, the nearest valid forecast point is selected within the configured spatial limit. Invalid units, expired values, impossible values or absent critical readings cannot be used. Co-located conflicting hazard readings use the maximum hazard and reduce confidence.
6. Deterministic functions calculate route risk, hard gates, opportunity and candidate utility. Feasible routes are compared by cost. Rejected candidates cannot win.
7. An explanation renderer inserts only computed values, names and rejection reasons. It is not a static stored answer.
8. The UI displays the generated decision, map geometry, evidence and actual execution trace.

## Formulas and limitations

All prototype thresholds and weights are in packages/engine/src/config.ts.

- Weighted risk: wave .30, wind .20, alert .20, current .10, restricted boundary .15, uncertainty .05. Safety is rounded 100 × (1 − risk).
- Wave ≥3 m, wind ≥15 m/s, current ≥1.8 m/s, severe alert ≥3, restricted crossing, invalid critical evidence, or leaving the demo water mask rejects the applicable option. **These are synthetic prototype rules, not certified limits.**
- The displayed voyage safety is the worst sampled route score. Destination safety is separately labelled in the candidate table.
- Confidence = coverage × freshness × source quality × consistency. DEMO has a .85 freshness factor and source quality is itself a synthetic input. Cached evidence decays by observed age. There is no claim of calibrated confidence.
- Relative opportunity combines PFZ signal .45, SST suitability .25, chlorophyll suitability .20 and other signal .10. Individual terms are multiplied by evidence quality. Without evidence a term contributes zero. This is not a species model or catch probability.
- Route cost uses normalized distance .10, mean risk .35, maximum risk .45, and uncertainty .10. Rejected cost is null, not JSON-invalid infinity.
- Candidate utility = opportunity − .8 × (100 − voyage safety) − .15 × route kilometers.
- A point forecast field is sampled by nearest-neighbour lookup; this prototype does not implement physical interpolation, bathymetry, current-aware travel times or vessel-specific exposure.

The allowed deterministic waypoint fallback from mds/10_GEOSPATIAL_AND_ROUTING.md is used. Six input paths (direct and southern passage for each zone) are evaluated. These are neither computed nautical routes nor a globally optimal path search.

The coastline and water mask are schematic rectangles, explicitly labelled DEMO. They only constrain the demonstration. Actual coast/bathymetry clearance must be established before real navigation use.

## Deliberate architecture choices

Turf runs inside the Next.js process under services/geo; a separate FastAPI server would duplicate runtime and contract management without adding a scientific calculation this slice needs. No database is necessary for immutable fixtures and browser-held context. MapLibre uses local GeoJSON and fonts, so internet or tile-provider outages do not break the replay.

An agent trace row is recorded around a real function execution. Durations are measured; no staged timer animations are used. The summed tool time is not wall-clock latency because retrieval tools can run concurrently.

The interface is English only, with no voice, account, payment, admin or persistence features. No LLM is configured. The remaining provider-specific endpoints from the long-term API specification are deferred; the implemented public boundary is chat/plan/health.

## Next phase

Verify a permitted marine/PFZ data source, implement adapters returning the existing evidence contracts, add retrieval timeouts/retry, and validate normalization and validity against captured real responses. Introduce structured LLM parsing only after assembling an independently labelled query set. Keep the decision engine independent of model-generated prose.

Implementation references checked during the build: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [MapLibre GeoJSON examples](https://maplibre.org/maplibre-gl-js/docs/examples/), [MapLibre style sources](https://maplibre.org/maplibre-style-spec/sources/).
