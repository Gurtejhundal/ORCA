# Product Scope

## P0 — Must ship for Gateway

### Conversational planning
- Text query.
- Language detection.
- Structured intent extraction.
- Multi-turn clarification only when a required field is missing.

### Marine intelligence
- SST.
- wave height / direction / period.
- ocean current if available.
- wind / weather.
- PFZ or a clearly labelled derived/mock candidate fishing layer if direct machine-readable PFZ access is unavailable.

### Geospatial intelligence
- user/departure coordinates;
- candidate fishing-zone points/polygons;
- route polyline;
- hazard polygons;
- boundary/restricted polygons;
- point-in-polygon and line-polygon intersection.

### Decision engine
- Safety Score.
- Fishing Opportunity Score.
- Route Cost.
- hard safety gates.
- confidence score.
- evidence list.

### UI
- conversational panel;
- interactive map;
- data layer toggles;
- score cards;
- route comparison;
- evidence/provenance drawer.

## P1 — Build only after P0 works

- Voice input/output.
- Regional-language output.
- proactive alerts;
- saved trips;
- multiple fishing-zone alternatives;
- animated agent execution timeline;
- historical trend chart.

## P2 — Future work, not Gateway blockers

- vessel telemetry;
- AIS integration;
- offline-first mobile app;
- IVR;
- satellite messaging;
- fleet dashboard;
- scientific species-specific habitat models;
- production-grade emergency dispatch;
- full maritime navigation compliance.

## Scope rule

If a feature does not improve the **single flagship demo**, postpone it.
