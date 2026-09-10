# ORCA live readiness — 9 September 2026

This document records what was exercised from the running local stack. “Live” means the response came from the named remote provider during the audit; it does not mean nautical certification or continuous provider availability.

| Capability | Result | Provenance / behavior |
|---|---|---|
| Process health | Passing | `/health` and `/api/v1/system/status` returned through the Next.js proxy |
| PostgreSQL, PostGIS | Not exercised in this checkout | Docker is unavailable; database integration tests skipped explicitly |
| PFZ list and nearest PFZ | Provider reachable; current result unavailable | INCOIS PFZ WFS responded, but its latest published product was outside the conservative validity window during the final 9 September audit, so it was not served as current |
| Wave and swell forecast | Live | INCOIS Ocean State Forecast |
| Marine fallback fields | Live fallback | Open-Meteo Marine, always labelled as Open-Meteo |
| Weather | Live | Open-Meteo Weather |
| SST | Live fallback | Open-Meteo Marine; no claim of INCOIS ERDDAP origin |
| Chlorophyll | Unavailable | No current verified INCOIS ERDDAP grid was found |
| Automated marine alerts | Unavailable | No verified INCOIS/IMD machine-readable warning feed is configured; an empty list is never an all-clear |
| Protected/restricted boundaries | Unavailable unless imported | Configure `ZONES_IMPORT_FILE` with a reviewed normalized GeoJSON export |
| Live routing and simulation | Disabled | Returns HTTP 503 until navigable-water, shoreline, boundary, and forecast-grid coverage is configured |
| Text chat | Functional, rule-based by default | `LLM_PROVIDER=mock` is reported as mock; configure a supported provider for live LLM output |
| Uploaded-audio transcription | Unavailable by default | Returns HTTP 503 without Bhashini; browser speech recognition remains a client-side option |
| Text-to-speech | Browser fallback | No server audio is claimed when the browser performs speech synthesis |

## Reproduce the checks

From the repository root in PowerShell:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
npm test
npm run typecheck
npm run build
.\.venv\Scripts\python.exe -m backend.scripts.smoke --live
.\.venv\Scripts\python.exe -m backend.scripts.audit_readiness
```

The machine-readable reports are written to `output/live-smoke.json` and `output/part4-live-readiness.json`. Expected HTTP 503 responses in the readiness audit are passing fail-closed checks, not test failures.

## Required configuration for the unavailable capabilities

- Provide and validate an authoritative alert adapter before using alerts for departure decisions.
- Import reviewed restricted/protected boundary data through `ZONES_IMPORT_FILE`.
- Integrate a reviewed navigable-water and shoreline grid before enabling live A* routes or simulation.
- Set `LLM_PROVIDER` and `LLM_API_KEY` for a supported live language provider.
- Set all Bhashini variables for server-side speech recognition and synthesis.

Do not present this prototype as a sole source for navigation or marine-safety decisions.
