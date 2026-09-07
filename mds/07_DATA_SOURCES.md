# Data Sources and Integration Strategy

**Verify access, licensing and machine-readable endpoints before production use.**
For Gateway, provenance and graceful fallback matter more than pretending every source has a perfect API.

## Priority A — India-specific authoritative sources

### INCOIS Potential Fishing Zone Advisory
Use for:
- PFZ advisory;
- fishing-zone evidence;
- India-specific credibility.

Official service currently publishes daily PFZ advisories and an interactive WebGIS.

Recommended integration order:
1. machine-readable/public interface if officially available to the team;
2. approved static/GeoJSON extraction prepared before demo;
3. manually curated current sample dataset clearly labelled `CACHED`;
4. simulated PFZ only as a last resort and clearly labelled `DEMO`.

Never scrape fragile UI during the live demo if you can avoid it.

### INCOIS Ocean State Forecast
Useful variables include:
- waves;
- winds;
- currents;
- SST;
- mixed layer depth and other ocean-state products.

Use authoritative INCOIS evidence whenever practical.

## Priority B — Developer-friendly marine forecast fallback

### Open-Meteo Marine API
Currently documents hourly variables such as:
- wave height;
- wave direction;
- wave period;
- swell;
- sea level height;
- SST;
- ocean current velocity/direction.

Use it as a prototype-friendly adapter/fallback, while clearly exposing source provenance.

## Priority C — Chlorophyll / EO

Possible sources:
- INCOIS ocean-colour products where available;
- NASA Earthdata/Ocean Color;
- Copernicus Marine.

For Gateway, pre-process a small regional chlorophyll raster/GeoJSON if live scientific data access is too slow or authentication-heavy.

## GIS layers

Prepare local GeoJSON for the demo region:
- coastline;
- India maritime reference boundary as permitted;
- marine protected/restricted demonstration polygons;
- ports/landing centres;
- demo hazard polygons.

## Data freshness classes

```text
LIVE        fetched during request
CACHED      previously fetched real observation/forecast
STATIC      reference GIS boundary/layer
DEMO        synthetic data for prototype demonstration
```

The UI must show the class.

## Adapter interface

Every source is converted into the normalized schema defined in `08_DATA_CONTRACTS.md`.

## Source verification notes — 6 Sep 2026

- INCOIS PFZ service is operational and publishes forecast/validity dates.
- INCOIS PFZ WebGIS presents georeferenced current PFZ information.
- INCOIS Ocean State Forecast publishes wind, significant wave height, currents and SST products.
- Open-Meteo Marine API documents JSON hourly marine forecast variables including waves, SST and ocean currents.

These facts should be re-checked immediately before the competition/demo.
