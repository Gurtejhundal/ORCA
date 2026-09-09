# ORCA — Marine EcOsystem Reasoning with Collaborative Agents

**Parts 1–4 are implemented as a tested prototype with separate live and demo paths. It is not production navigation software.** See the [verified readiness matrix](backend/READINESS.md) and [backend architecture](backend/README.md).
- **Part 1**: Marine Data Foundation, INCOIS connectors, Open-Meteo, PostgreSQL/PostGIS.
- **Part 2**: Multi-Agent Orchestration (DAG execution), Indic & English Voice Architecture (ASR & TTS via Bhashini), Conversational Intelligence.
- **Part 3**: Deterministic Marine Risk Engine (0-100 score), Safe PFZ Ranking with Hard Gates, Risk-Aware A* Routing, Route Comparison, Geofencing Proximity & Trajectory Prediction, Vessel Simulation & Dynamic Rerouting.

SIH problem statement **26176**. This repository implements the foundation and first working vertical slice in the supplied [build pack](mds/00_README.md).

**This is a deterministic decision-support prototype, not a trained prediction model. Real-world accuracy has not been measured. A 99% accuracy claim is not supported by the available data.** Live mode currently retrieves selected PFZ, ocean, and weather values with provenance. Route grids, geofences, and simulation remain explicitly labelled demo-only until authoritative navigation datasets are configured.

## Run locally

Requires Node.js 20.9+ and npm. Node 22 LTS is a suitable baseline.

~~~powershell
npm ci
npm run dev
~~~

Open [ORCA on localhost](http://127.0.0.1:3000), or run **launch-orca.bat**.

For a production build:

~~~powershell
npm run build
npm start
~~~

The page computes the flagship scenario on the server when opened. Submit another query or change the scenario to execute the pipeline again. No API keys, database, Python service, external tiles or external fonts are required. Fonts are served locally; the interactive map requires browser WebGL. If WebGL is unavailable, the decision remains accessible in the tables.

Optional: copy .env.example to apps/web/.env.local. Setting DEMO_MODE=false disables fixture recommendations; no live fallback is silently enabled.

## Try the vertical slice

> I am leaving from Nagapattinam tomorrow at 5 AM. Where should I fish and what is the safest route?

The replay clock is **6 September 2026, 12:00 IST**. “Tomorrow” is **7 September 2026**. Fixtures expire at **8 September 2026, 00:00 IST** and are checked at each sampled arrival time.

- Normal: Zone B, southern waypoint route; the direct route intersects a restricted polygon.
- High waves: Zone B fails the wave gate; Zone C becomes the selected alternative.
- Zone B closure: a forbidden polygon rejects B; C is selected.
- Provider failure: missing critical marine evidence prevents a recommendation.
- “Why not the nearest fishing zone?”: reuses trip context and compares computed candidates.
- “What if I leave 3 hours later?”: shifts the context time and reevaluates transit evidence.
- Missing location/date/time: asks for clarification. Unsupported places or languages are not silently geocoded.

The rule-based parser supports these bounded English forms, today/tomorrow, explicit YYYY-MM-DD, 12-hour and 24-hour times. It is not a general language model. Context is held in the current browser page and sent to the API; refresh resets it.

## Repository

| Path | Purpose |
|---|---|
| apps/web | Next.js App Router dashboard and API |
| packages/contracts | Shared TypeScript contracts and Zod input/fixture validation |
| packages/engine | Planner, fixture providers, evidence selection, scoring, orchestration, explanation |
| services/geo | In-process Turf geometry and route sampling |
| data/demo | Labelled synthetic GeoJSON and evidence; fixed validity interval |
| tests | Geometry, decision, integration, time and API tests |
| scripts | Fixture generation, decision inspection and acceptance evaluation |
| mds | Original specifications, preserved |
| docs | Implementation, evaluation and verification records |

## Verification

~~~powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run evaluate
npx tsx scripts/inspect-decision.ts
~~~

The evaluation command writes docs/evaluation-report.json. It reports synthetic acceptance counts, numerical-claim checks and latency separately from real-world accuracy, which remains null.

To regenerate exactly the same fixture inputs:

~~~powershell
npx tsx scripts/build-fixtures.ts
~~~

Restart the server after editing fixtures; they are validated and loaded once per server process.

## API

- POST /api/chat: message, scenario (normal / high-waves / restricted-route / api-failure), language (en / auto), optional context.
- POST /api/plan: validates the same request shape and returns structured intent or clarification.
- GET /api/health: actual provider modes, fixture counts and unconfigured components.

The chat endpoint returns COMPLETE with a DecisionResponse, CLARIFICATION, UNSUPPORTED, or ERROR. No route is selected when evidence or hard gates fail. No auth, persisted conversation, live marine API or independent geo server is implemented in this milestone.

## Part 2 — Agentic AI & Voice Intelligence

Part 2 introduces full autonomous multi-agent orchestration, natural language and voice conversational intelligence:
- **Agents:** Intent, Planner (DAG), PFZ, Weather, Ocean, Hazard, Geospatial, Satellite Analytics, Evidence Aggregator, and Explanation.
- **Voice:** Bhashini ULCA Indic ASR/TTS pipeline with Web Speech browser fallback.
- **Map Actions:** SHOW_MARKERS, FOCUS_LOCATION, ADD_LAYER, SHOW_HAZARD_ZONE.
- **APIs:** `POST /api/v1/chat`, `POST /api/v1/voice/transcribe`, `POST /api/v1/voice/speak`, `POST /api/v1/voice/chat`, `GET /api/v1/agents/runs/{run_id}`.

## Part 3 — Deterministic Safety, Routing, Geofencing & Simulation

Part 3 delivers mathematical safety and dynamic navigation:
- **Risk Engine:** 0–100 deterministic risk assessment with hard gates for cyclone warnings and high waves.
- **Safe PFZ Ranking:** Multi-criteria decision analysis prioritizing safety over proximity.
- **A* Marine Routing:** Grid-based A* routing avoiding hazards, shorelines, and restricted areas.
- **Route Comparison:** Side-by-side trade-off analysis (shortest direct vs recommended detour).
- **Geofencing:** Boundary proximity detection and dead-reckoning trajectory projection.
- **Vessel Simulation:** Kinematics simulator with dynamic rerouting when hazards emerge.

## Part 4 — Final Integration, Data Freshness & UI Polish

Part 4 completes the prototype for robust evaluation:
- **Data Freshness Engine:** Categorizes data by dataset type (`live`, `near_real_time`, `forecast`, `satellite_observation`, `demo`) with specific staleness thresholds.
- **System Health:** Enriched `/api/v1/system/status` and `/api/v1/system/freshness` endpoints.
- **UI Polish:** DataStatusBadge, VoiceChatControl, PFZRecommendationCard, SafetyCard, RouteComparisonCard, SimulationWidget, GeofenceAlertBanner, MapLegend, coastal port presets, and live GPS geolocation.
- **Production Deployment:** Multi-stage `Dockerfile` and updated `compose.yaml`.

The live readiness audit deliberately returns unavailable or HTTP 503 for missing safety-critical coverage. It never substitutes demo routes, boundaries, alert clearances, or speech transcripts into live results.

See [backend documentation](backend/README.md) for full architecture diagrams and environment variables.
See [implementation notes](docs/IMPLEMENTATION.md) for formulas and boundaries, and [evaluation scope](docs/EVALUATION.md) for the work required before claiming prediction accuracy.
