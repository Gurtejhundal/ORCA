# SamudraAI / ORCA backend

> See [READINESS.md](READINESS.md) for the tested live-source matrix and current blockers. Live routing is disabled until a reviewed navigable-water grid and authoritative boundary coverage are integrated.

FastAPI APIs, provider adapters, PostGIS persistence, deterministic decision services, and an explicit offline replay are integrated into the existing Next.js 16 / React 19 / MapLibre application. Live provider data and demo scenario data remain visibly separated.

## Setup and exact commands

Requires Python 3.12+, Node.js 20.9+, Docker Desktop (Linux containers), or an existing PostgreSQL 16+ installation with PostGIS 3.5+. Commands run from the repository root in PowerShell.

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.lock.txt
npm ci
.\.venv\Scripts\python.exe -m backend.scripts.init_local
docker compose up -d db
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m backend.run
```

In a second terminal:

```powershell
npm run dev
```

On the development machine used for this implementation, Python was supplied by Codex's bundled **Python 3.12.14**. The `.venv` is already created. If `py` is unavailable when recreating it on this machine:

```powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -m venv .venv
```

`init_local` creates an ignored `.env` with a randomly generated password, loopback PostgreSQL port **5433**, and **DEMO_MODE=true**. It refuses to overwrite an existing `.env`. The Compose volume persists across restarts. `docker compose stop` stops services without deleting the database. The migration enables PostGIS and creates only application tables; it does not modify extension-owned tables.

For an existing database, set `DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:PORT/DATABASE` using your own credentials. The migration user needs permission to create the PostGIS extension (or an administrator must enable it first). Production runtime credentials should have narrower permissions. No credentials or API keys are committed.

Links: [Landing page](http://127.0.0.1:3000), [existing dashboard + marine data](http://127.0.0.1:3000/dashboard), [Swagger](http://127.0.0.1:8000/docs), [ReDoc](http://127.0.0.1:8000/redoc), [OpenAPI JSON](http://127.0.0.1:8000/openapi.json).

The landing page's **Data Sources** link and existing **Fishing Zones / Conditions / Alerts / Layers** buttons open the relevant dashboard sections. Its dormant map originally had no CSS and zero height; new dashboard-only styles supply dimensions and scrolling. Existing components remain in place. Blue overlays are backend PFZ lines. Green/orange route visuals and their scores remain explicitly synthetic replay output.

## Environment variables

Root `.env` is loaded by Pydantic and Docker Compose. Defaults are in `.env.example`.

| Variable | Purpose / default |
| --- | --- |
| `DATABASE_URL` | PostgreSQL SQLAlchemy psycopg URL; required for persistence and migrations |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Required for the local Compose database |
| `POSTGRES_PORT` | Local database port; default 5433 |
| `DEMO_MODE` | Backend live false / offline replay true; default false |
| `FRONTEND_URL` | Allowed frontend origin; default http://127.0.0.1:3000 |
| `HTTP_TIMEOUT` | Per-provider operation timeout, default 8 seconds |
| `REQUEST_TIMEOUT` | Whole API deadline, default 35 seconds |
| `HTTP_RETRIES` | Transient failure retries, default 2 |
| `CACHE_MAX_ENTRIES` | Bounded process cache size, default 512 |
| `WEATHER_TTL` | Weather cache seconds, default 600 |
| `OCEAN_TTL` | Ocean forecast cache seconds, default 1800 |
| `SATELLITE_TTL` | Reserved satellite product TTL, default 21600; no verified live grid currently enabled |
| `PFZ_TTL` | PFZ refresh seconds, default 21600; product validity always overrides cached availability |
| `OPEN_METEO_ENABLED` | Enable fallback marine and weather provider, default true |
| `INCOIS_ERDDAP_ENABLED` | Enable catalog health check, default true |
| `PFZ_IMPORT_FILE` | Optional trusted local normalized PFZ GeoJSON fallback |
| `ZONES_IMPORT_FILE` | Optional trusted local normalized hazard/restricted/protected GeoJSON import |
| `BACKEND_URL` | Next.js server-side variable in `apps/web/.env.local`; default http://127.0.0.1:8000 |

No Redis or external API keys are required. Cache is deliberately process-local; use one worker for this demo. A distributed deployment needs a shared cache implementation. Keep frontend variables in `apps/web/.env.local`; copying the root database environment there is unnecessary. The pre-existing chat API's `DEMO_MODE` setting applies to its old replay independently of the backend.

To switch backend mode, edit `DEMO_MODE` in the root `.env`, restart FastAPI, and refresh the dashboard. Live mode never uses demo records as fallback.

## Architecture

```text
Existing Next.js / MapLibre frontend
    → centralized marine-api.ts → /api/v1 proxy
    → FastAPI routes + Pydantic validation
    → MarineService
    → SourceRegistry / PFZ adapter boundary
    → INCOIS PFZ WFS + OSF ncWMS / Open-Meteo / ERDDAP catalog
    → normalized observations + explicit source/quality/time/freshness
    → PostGIS repository + bounded TTL cache
```

`backend/core` handles settings/errors/logging; `schemas` defines contracts; `data_sources` isolates HTTP and provider parsing; `services` assembles partial results; `database` holds async connections, repositories and Alembic; `geospatial` handles WGS84 validation/transforms and distance; `cache` provides TTL and concurrent-request deduplication. Scientific grid helpers use xarray/NumPy; feature reprojection uses GeoPandas/pyproj. Rasterio is unnecessary for current point/line APIs.

Tables: **marine_observations**, **pfz_zones**, **marine_zones**, **conversation_sessions**, **agent_runs**. Zone geometries use indexed PostGIS geography with SRID 4326. JSONB preserves provider properties. Conversation and agent tables are schema foundations only. Live observations and PFZ are persisted; demo records never enter live tables. Observation IDs deduplicate repeated writes of the same fetched record. Failed persistence is reported in `data_quality.persistence` while available source values remain usable.

## APIs

All routes are GET. Swagger describes coordinates, timestamps, filters, response models and errors.

| Route | Parameters / result |
| --- | --- |
| `/health` | Liveness `{"status":"ok"}` |
| `/api/v1/system/status` | Backend, DB, PostGIS, cache, provider/data readiness |
| `/api/v1/pfz` | Optional date, bbox, lat+lon, radius km, limit |
| `/api/v1/pfz/nearest` | lat, lon; optional limit/date; geography distance to nearest point of each line/polygon |
| `/api/v1/ocean/conditions` | lat, lon, optional timezone-aware time; per-field provenance |
| `/api/v1/weather` | Same; wind/gust/precipitation/visibility/WMO code/thunderstorm flag |
| `/api/v1/alerts` | lat, lon, optional radius km; unavailable warning feeds explicitly reported |
| `/api/v1/map/layers` | Optional lat+lon; actual layer availability |
| `/api/v1/map/layer/{name}` | pfz, sst, chlorophyll, waves, currents, hazards, restricted, protected |

Bbox is `west,south,east,north`. Split dateline-crossing boxes into two requests. `date` selects UTC noon of that date, and omitted dates use the current instant or fixed replay clock. Forecast requests select the nearest hourly time (ocean INCOIS products have 3-hour native steps); actual selected timestamps remain on each value. Scalar map layers return a sampled GeoJSON point at the provider location, not a fabricated gridded field. Unknown/missing values are null with source `unavailable`.

PostGIS computes spheroidal geography distance in meters. Offline line/polygon distance uses a WGS84 azimuthal-equidistant projection centered on the query point, suitable for local marine queries. Haversine is available for point distances. None of these distances is a navigable route. Very large, polar or dateline-crossing offline polygons should use PostGIS instead of the local projection helper.

## Verified sources and limitations

See [source verification](SOURCE_VERIFICATION.md) for exact discovery URLs and outcomes.

* **INCOIS PFZ WFS:** real GeoJSON verified, 90 MultiLineString features. `Year` + `Julian_day` are matched to the current advisory's forecast date. IDs include product day; raw properties are retained. Public validity is date-only: the backend conservatively expires at the start of the published valid-upto date in Asia/Kolkata. It does **not** assume an unpublished expiry hour. Early on 8 September, the observed 7 September product was excluded as expired. During later verification, the advisory advanced to 8/9 September while WFS still contained day 250 (7 September); the adapter correctly reported a date mismatch and did not attach new validity to old vectors.
* **INCOIS OSF:** public forecast page supplies the current dataset filename. An isolated parser discovers it, then requests ncWMS time-series CSV for significant waves, swell height, wave period and swell period. No dates or filenames are hardcoded in the adapter. Any declaration/schema change fails gracefully.
* **Open-Meteo Marine:** verified real forecast fallback for wave direction, SST, currents and sea level, plus other available wave variables. Current velocity is converted from documented km/h to m/s. Marine fallback retains its own name and `primary_source_available=false`. Sea level is relative to global mean sea level and is not a coastal navigation datum.
* **Open-Meteo Weather:** verified live weather. Thunderstorm flag is explicitly derived from WMO codes 95/96/99; this is not an authoritative lightning warning.
* **INCOIS ERDDAP:** actual catalog endpoint discovered, but local TLS chain verification failed. Verification stays enabled. Catalog health and a fail-closed adapter exist; no dataset IDs, scientific axes or chlorophyll values are invented. Chlorophyll remains unavailable live.
* **Alerts/restricted/protected:** importable reviewed PostGIS records are supported. No dependable automated warning or authoritative boundary feed was verified. Live empty results are marked unavailable where appropriate and must not be read as an all-clear. No hazard is invented from wave thresholds.

The sources are public interfaces, not availability guarantees. Open-Meteo's public service is for non-commercial usage subject to its terms and attribution; retain Open-Meteo / upstream attribution. Confirm INCOIS redistribution terms before public redistribution beyond this prototype.

## Offline replay

`data/demo/incois-pfz-recorded.geojson` contains three real PFZ line geometries captured from the verified WFS. Source is **cached INCOIS PFZ sample**, `mode=demo`, original properties, retrieval time, expiry and date precision retained. Replay clock is **2026-09-07T06:00:00Z**. Condition and hazard fixtures remain the repository's explicitly **synthetic** samples, limited to their original coordinates/validity and a 50 km lookup range. They are never labelled INCOIS. Missing demo variables remain null. `is_stale` reflects real wall-clock expiry even when replay time is within historical validity.

The source recording utility consumes already-downloaded files under ignored `output/source-probes`; it does not invent sample values. Re-recording is an intentional developer operation, not an automatic live-mode fallback.

## Reviewed imports

Both PFZ fallback and marine zone imports accept a normalized FeatureCollection. Each feature needs `geometry` and properties: `id`, `name`, `valid_from`, `valid_until`, `source`, `source_reference`, `fetched_at`, `expires_at`, `mode=live`, and `metadata`. Marine zones also require `type` (e.g. hazard/restricted/protected) and optionally `severity`; alert description lives in metadata. Timestamps must include timezone. Expired records are excluded. Only locally reviewed files configured by the operator are read; no user API accepts a URL or import path.

```powershell
.\.venv\Scripts\python.exe -m backend.scripts.import_zones
```

## Verification commands

```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m backend.scripts.smoke
.\.venv\Scripts\python.exe -m backend.scripts.smoke --live
npm test
npm run typecheck
npm run lint
npm run build
```

`smoke` needs the running backend on port 8000 and validates every layer's GeoJSON. `--live` creates a real-provider app in-process and persists real observations/PFZ using configured PostgreSQL. It records full results to ignored `output/live-smoke.json`; API HTTP 200 does not imply every field is available. Unit tests are deterministic and do not call external providers. Integration tests use the configured database and rollback their test records. Without `DATABASE_URL`, DB tests skip explicitly. See [validation report](VALIDATION.md).

## Resilience and operational boundaries

Async HTTP has host allowlisting, HTTPS verification, redirect rejection, body limits, operation timeouts and bounded retry backoff for transient failures. Independent source requests run concurrently. Cache keys contain provider/product, coordinates and requested forecast time; concurrent identical requests share one fetch. Cached timestamps are preserved, not reset by reads. Expired live safety data is never served as fallback. Cache, source and persistence availability are distinct.

The API is bound to localhost for development. Deployments need a reverse proxy and deployment-specific authentication/rate limiting, managed secrets, database backups, shared caching for multiple workers, and source licensing review. These are not silently provided by CORS.

---

# Part 2 — Agentic AI, Multi-Agent Orchestration, Conversational Intelligence & Voice

SamudraAI has been upgraded with a complete autonomous multi-agent reasoning framework, conversational intelligence supporting Indian regional languages, and a dual Bhashini / Browser-fallback voice pipeline.

## Multi-Agent Architecture

```text
USER (Voice or Text)
  │
  ├── Voice Input (Audio Blob) ──> POST /api/v1/voice/transcribe (Bhashini ASR / Browser fallback)
  │                                     │
  ▼                                     ▼
Text Query ─────────────────────> POST /api/v1/chat / MarineOrchestrator
                                        │
    ┌───────────────────────────────────┼───────────────────────────────────┐
    │                                   │                                   │
Language Detection               Location Resolution                 Time Resolution
(Hindi, English, etc.)        (Coords > Named Port/City > GPS)     (Timezone-aware UTC)
    │                                   │                                   │
    └───────────────────────────────────┼───────────────────────────────────┘
                                        ▼
                                   Intent Agent
                          (15 distinct marine intents)
                                        ▼
                                  Planner Agent
                          (Validates DAG Task Graph)
                                        ▼
                   ┌────────────────────────────────────────┐
                   │ Parallel Agent Execution (asyncio)     │
                   ├────────────────────────────────────────┤
                   │ • PFZ Agent (candidates, distances)    │
                   │ • Weather Agent (wind, gusts, rain)    │
                   │ • Ocean Agent (waves, swell, currents) │
                   │ • Hazard Agent (cyclone, surge alerts) │
                   │ • Geospatial Agent (GIS intersections) │
                   │ • Satellite Agent (SST & chlorophyll)  │
                   └────────────────────────────────────────┘
                                        ▼
                               Evidence Aggregator
                       (Deduplication, staleness, conflicts)
                                        ▼
                              Confidence Engine (0.0–1.0)
                                        ▼
                               Explanation Agent
                    (Evidence-grounded explanation in user lang)
                                        ▼
                                   Map Actions
                     (SHOW_MARKERS, FOCUS_LOCATION, ADD_LAYER)
                                        ▼
                               Persist Agent Run
                                        ▼
    ┌───────────────────────────────────┴───────────────────────────────────┐
    ▼                                                                       ▼
Text Response                                                      Voice Audio (TTS)
(Chat UI + Evidence Cards + Map Actions)                   (POST /api/v1/voice/speak - Bhashini/Browser)
```

## Voice Architecture

```text
Microphone (Browser MediaRecorder)
       ↓
BHASHINI ASR (POST /api/v1/voice/transcribe)
       ↓
Detected Indian Language & Transcript
       ↓
SamudraAI Multi-Agent Orchestrator
       ↓
Multilingual Grounded Answer
       ↓
BHASHINI TTS (POST /api/v1/voice/speak)
       ↓
Browser Audio Playback
```

* **Primary Provider:** Bhashini ULCA / Dhruva inference API (configured via `BHASHINI_API_KEY`, `BHASHINI_USER_ID`, `BHASHINI_BASE_URL`).
* **Fallback Provider:** Web Speech API (`SpeechRecognition` and `speechSynthesis`) for browser-side offline operation and testing.
* **Fail-safe Design:** Voice failure never breaks normal text chat.

## Google Maps Integration

Agents remain strictly map-provider independent, generating declarative actions that are dispatched to the frontend `GoogleMapController`:

```text
Agents
  ↓
Generic map actions + GeoJSON
  ↓
Google Maps frontend (services/google-maps.ts)
```

Supported actions:
* `SHOW_MARKERS`: Places PFZ or vessel coordinates as markers on Google Maps.
* `FOCUS_LOCATION`: Centers and zooms Google Maps to target latitude and longitude.
* `ADD_LAYER`: Adds GeoJSON FeatureCollections (PFZ contours, sampled layers).
* `SHOW_HAZARD_ZONE`: Visualizes active hazard boundaries on Google Maps with caution styling.
* `HIGHLIGHT_REGION`: Highlights oceanic interest areas.
* `CLEAR_LAYER`: Removes temporary layers.

## Language Support

* **Fully Functional:**
  * **English (`en`)**: Native multi-agent synthesis, entity extraction, full reasoning.
  * **Hindi (`hi`)**: Automatic Devanagari & Hinglish detection, Hindi intent recognition, Hindi explanation synthesis, and Hindi TTS/ASR.
* **Provider Dependent (Bhashini / Script Detected):**
  * **Tamil (`ta`)**, **Telugu (`te`)**, **Malayalam (`ml`)**, **Kannada (`kn`)**, **Marathi (`mr`)**, **Gujarati (`gu`)**, **Bengali (`bn`)**, **Odia (`or`)**: Unicode script detection active, structured routing enabled, full audio pipeline active when Bhashini credentials are provided.

## Part 2 Environment Variables

| Variable | Description |
|---|---|
| `LLM_PROVIDER` | LLM backend: `gemini`, `openai`, `groq`, or `mock` (default `mock`) |
| `LLM_MODEL` | Target model name (e.g. `gemini-1.5-flash`, `gpt-4o-mini`) |
| `LLM_API_KEY` | API key for LLM provider (not required if `LLM_PROVIDER=mock`) |
| `BHASHINI_API_KEY` | Bhashini ULCA inference API authorization key |
| `BHASHINI_USER_ID` | Bhashini ULCA user ID |
| `BHASHINI_BASE_URL` | Bhashini inference endpoint (default `https://dhruva-api.bhashini.gov.in/services/inference/pipeline`) |
| `BHASHINI_PIPELINE_ID` | Optional Bhashini pipeline ID |

## Part 2 APIs

* `POST /api/v1/chat`: Conversational marine intelligence taking natural language messages and returning grounded answers, evidence, and map actions.
* `POST /api/v1/voice/transcribe`: Accepts audio files (up to 10MB) and returns transcripts with detected language and confidence.
* `POST /api/v1/voice/speak`: Synthesizes Indic and English text to speech.
* `POST /api/v1/voice/chat`: Direct audio-in to audio-out voice chat endpoint.
* `GET /api/v1/agents/runs/{run_id}`: Inspects execution traces, DAG task durations, and agent provenance.

## Part 3: Deterministic Marine Risk Engine, Safe PFZ Ranking, A* Routing, Geofencing & Simulation

Part 3 implements complete mathematical and deterministic spatial intelligence engines in Python using Shapely, NumPy, and PostGIS. The LLM is never invoked for coordinates, risk scores, or routing; it only explains the deterministic results.

### 1. Deterministic Marine Risk Engine (`backend/risk/`)
* **Multi-Factor Scoring (0–100)**:
  * Significant Wave Height: 30% weight
  * Wind Speed: 20% weight
  * Marine Hazards / Advisories: 20% weight
  * Severe Weather / Gusts: 15% weight
  * Ocean Surface Currents: 10% weight
  * Visibility: 5% weight
* **Clear Authority Separation**:
  * **Official Advisories (Hard Overrides)**: IMD Cyclone Warnings, INCOIS High Wave Alerts, and Maritime Administration Restricted Zones trigger immediate `EXTREME` (score $\ge 85$) or `HIGH` overrides.
  * **Operational Heuristics**: Vessel sensitivity multipliers (e.g. `small_fishing_boat` $1.25\times$, `medium_fishing_vessel` $1.0\times$, `generic_vessel` $0.9\times$).
* **Data Confidence Scoring (0.0–1.0)**: Computed based on availability of critical variables (wave, wind), source authority (official INCOIS/IMD vs synthetic), and freshness.

### 2. Safe PFZ Ranker (`backend/risk/service.py`)
* **Hard Safety Gates**: Candidates intersecting restricted zones or severe cyclone/hazard zones are explicitly excluded with documented exclusion reasons.
* **Weighted Multi-Factor Suitability**:
  $$\text{Suitability} = 0.40 \times \text{Safety} + 0.25 \times \text{Distance} + 0.15 \times \text{ForecastQuality} + 0.10 \times \text{EnvironmentalFit} + 0.10 \times \text{Confidence}$$

### 3. Risk-Aware A* Marine Routing (`backend/routing/`)
* **Bounded 2D Navigation Grid**: Covers voyage bounding box with safety margins. Land polygons and forbidden restricted zones have $\infty$ cost.
* **Cost Function**:
  $$\text{Cost} = (\text{Distance} \times \text{WavePenalty} \times \text{WindPenalty} \times \text{HazardMultiplier}) + \text{HazardFlatPenalty}$$
* **Heuristic**: Admissible and consistent haversine distance heuristic.
* **Path Smoothing**: Greedy line-of-sight shortcutting with post-smoothing collision verification against all land, restricted, and hazard shapes.
* **Route Comparison**: Computes shortest direct navigable route vs. recommended safe detour route, calculating detour distance (km), detour percentage, time delta, and risk reduction percentage with plain-language trade-off explanations.

### 4. Geofencing & Trajectory Prediction (`backend/geofence/`)
* **Boundary Distance**: Accurate geodesic distance calculations using Shapely and PostGIS.
* **Dead Reckoning Projection**: Projects vessel coordinates forward for 15, 30, and 60 minutes based on speed and heading.
* **Multi-Level Warnings**:
  * `CRITICAL`: Active breach inside forbidden zone, or projected breach $\le 15$ min.
  * `WARNING`: Projected breach $\le 30$ min, or proximity $\le 2.0$ km.
  * `CAUTION`: Projected breach $\le 60$ min, or proximity $\le 5.0$ km.
  * `INFO`: General advisory.
* **Deterministic Course Correction**: Computes safe escape heading ($\Delta \theta$) that guarantees zero collisions with any boundary or coastline.

### 5. Vessel Simulation & Dynamic Rerouting (`backend/simulation/`)
* **Session Manager**: Manages in-memory simulation sessions (`create`, `step`, `stop`).
* **Kinematics Interpolation**: Moves vessel along route LineString based on speed and elapsed time.
* **Dynamic Rerouting**: When an active route intersects an evolving hazard, the system flags `route_needs_recalculation`, automatically generates a safe detour route, and dispatches a `DRAW_ROUTE` action.
* **Generic MapLibre Actions**: Emits `UPDATE_VESSEL`, `DRAW_ROUTE`, and `SHOW_GEOFENCE_WARNING`.

### 6. Part 3 API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/safety/analyze` | Deterministic marine safety risk assessment |
| `POST` | `/api/v1/pfz/rank-safe` | Rank Potential Fishing Zones with safety gates |
| `POST` | `/api/v1/routes/safe` | Compute A* risk-aware safe marine route |
| `POST` | `/api/v1/routes/compare` | Compare shortest direct route vs. safe recommended detour |
| `POST` | `/api/v1/routes/reroute` | Recalculate route from current vessel position |
| `POST` | `/api/v1/geofence/check` | Boundary proximity, trajectory projection, and warnings |
| `POST` | `/api/v1/simulation/start` | Start vessel simulation session |
| `POST` | `/api/v1/simulation/{id}/step` | Advance vessel by step interval (returns updated position & map actions) |
| `POST` | `/api/v1/simulation/{id}/stop` | Stop and remove simulation session |
| `GET` | `/api/v1/simulation/{id}` | Get current simulation state |

---

## Part 4 — Final Integration, Data Freshness & Reliability

### 1. Data Freshness Classification & Policies

SamudraAI strictly distinguishes dataset types and avoids claiming second-by-second realtime for periodic oceanographic models:

| Dataset | Data Type | Source | Current (<) | Aging | Stale (>) | Re-fetch / Update Cycle |
|---|---|---|---|---|---|---|
| **Weather** | `forecast` | Open-Meteo | 60 min | 60–180 min | 180 min | Hourly updates |
| **Ocean** | `forecast` | Open-Meteo Marine / INCOIS | 180 min | 180–360 min | 360 min | 3–6 hours |
| **PFZ** | `near_real_time` | INCOIS Advisories | 12 hours | 12–24 hours | 24 hours | 12 hours |
| **Marine Alerts** | `near_real_time` | INCOIS / IMD Advisories | 6 hours | 6–12 hours | 12 hours | 6 hours |
| **SST / Chlorophyll** | `satellite_observation`| NOAA / Copernicus / INCOIS | 12 hours | 12–36 hours | 36 hours | 24 hours |
| **Vessel GPS** | `live` | On-board Transponder / Geolocation | 5 min | 5–15 min | 15 min | Continuous / On-demand |

### 2. End-to-End System Architecture

```mermaid
flowchart TD
    subgraph Client["React / Next.js Web Client"]
        UI["ORCA Dashboard"]
        Voice["VoiceChatControl (Mic / TTS)"]
        Badge["DataStatusBadge (Live / Demo / Freshness)"]
        Map["MapLibre Marine Map"]
        Sim["Vessel Simulation Widget"]
        PFZCard["PFZ Recommendation Card"]
        RouteCard["Route Comparison Card"]
    end

    subgraph API["FastAPI Application"]
        Router["/api/v1 Router"]
        Orchestrator["Multi-Agent Orchestrator"]
        FreshnessEngine["Data Freshness Engine"]
        VoiceSvc["Bhashini / Fallback Voice Service"]
    end

    subgraph Engines["Deterministic Python Engines"]
        RiskEngine["Marine Risk Engine (0-100)"]
        PFZRanker["Safe PFZ Ranker"]
        AStar["A* Route Optimizer"]
        GeofenceEng["Geofence & Projection Engine"]
        SimEng["Kinematics Vessel Simulator"]
    end

    subgraph Storage["Data & Cache Layer"]
        PG[(PostgreSQL + PostGIS)]
        Cache["Bounded Process Memory Cache"]
        GeoJSON["Local GeoJSON Fallbacks"]
    end

    UI --> Router
    Router --> Orchestrator
    Router --> FreshnessEngine
    FreshnessEngine --> Cache
    Orchestrator --> RiskEngine
    Orchestrator --> PFZRanker
    Orchestrator --> AStar
    Orchestrator --> GeofenceEng
    Sim --> SimEng
    SimEng --> AStar
    SimEng --> GeofenceEng
    RiskEngine --> PG
    PFZRanker --> PG
    AStar --> PG
```

### 3. Data Flow Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Fisher as Fisherman / Navigator
    participant Web as React Web Client
    participant API as FastAPI Backend
    participant Orch as Agent Orchestrator
    participant Engines as Risk / PFZ / A* Engines
    participant Fresh as Freshness Engine

    Fisher->>Web: Voice query or Port selection ("Where to fish safely?")
    Web->>Fresh: GET /api/v1/system/freshness
    Fresh-->>Web: Dataset ages, freshness statuses (current/aging/stale)
    Web->>API: POST /api/v1/chat {message, location}
    API->>Orch: Dispatch query to multi-agent DAG
    Orch->>Engines: Deterministic Risk & PFZ Ranking
    Engines-->>Orch: Safety score, Ranked PFZs, A* Safe route
    Orch-->>API: Explainable decision + Map Actions (DRAW_ROUTE)
    API-->>Web: Structured response (cards, routes, warnings)
    Web->>Fisher: Render PFZ Card, Route Comparison & Voice TTS readout
```

### 4. Part 4 System Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/system/status` | Comprehensive health check: backend, database, PostGIS, cache, mode, voice, LLM, freshness |
| `GET` | `/api/v1/system/freshness` | Centralized data freshness metrics with observation timestamps and staleness flags |

### 5. Deployment & Reliability

- **Docker Production Image**: Multi-stage build in `Dockerfile` with non-root user `appuser`.
- **Docker Compose**: Orchestrates FastAPI backend and PostGIS database with health checks.
- **Graceful Failure**: Live mode returns partial/unavailable responses or HTTP 503 when a safety-critical provider is missing. Demo fixtures are loaded only when `DEMO_MODE=true`.
