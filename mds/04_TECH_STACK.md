# Recommended Tech Stack

The stack is optimized for **fast Codex implementation**, visual demo quality and geospatial work.

## Frontend

- **Next.js** App Router
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui**
- **MapLibre GL JS** or **Mapbox GL JS**
- **Recharts** for small evidence/trend charts
- native browser Speech API only if time permits

## Backend

Recommended:
- Next.js route handlers for orchestration/API facade
- **Python FastAPI microservice** only for geospatial/scientific calculations that are easier in Python

Python packages:
- FastAPI
- Pydantic
- GeoPandas
- Shapely
- NetworkX
- NumPy
- Pandas
- httpx

## AI orchestration

Keep this simple.

- one LLM provider;
- structured JSON/tool calling;
- explicit planner/executor pattern;
- deterministic tools around the LLM.

Do not introduce a heavy agent framework unless the team already knows it.

## Database

- PostgreSQL
- PostGIS if available
- Supabase is acceptable for hackathon speed

## Cache

- in-memory cache initially;
- Redis optional;
- cache by `(provider, lat, lon, time-window, variables)`.

## Deployment

Fastest:
- Vercel: Next.js
- Render/Railway/Fly.io: FastAPI
- Supabase: PostgreSQL/PostGIS

## Environment variables

```env
LLM_API_KEY=
NEXT_PUBLIC_MAP_TOKEN=
DATABASE_URL=
OPEN_METEO_BASE_URL=https://marine-api.open-meteo.com
INCOIS_MODE=web|manual|adapter
DEMO_MODE=false
```

Never commit secrets.
