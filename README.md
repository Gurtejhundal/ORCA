# ORCA — Marine EcOsystem Reasoning with Collaborative Agents

SIH problem statement **26176**. This repository implements the foundation and first working vertical slice in the supplied [build pack](mds/00_README.md).

**This is a deterministic demonstration, not a trained prediction model. Real-world accuracy has not been measured. A 99% accuracy claim is not supported by the available data.** All marine readings, fishing zones, geofences, routes and coastline geometry are synthetic and visibly labelled DEMO.

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

See [implementation notes](docs/IMPLEMENTATION.md) for formulas and boundaries, and [evaluation scope](docs/EVALUATION.md) for the work required before claiming prediction accuracy.
