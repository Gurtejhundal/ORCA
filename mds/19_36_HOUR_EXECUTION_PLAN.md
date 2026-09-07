# 36-Hour Execution Plan

Assume a 6-person team.

## Suggested ownership

### Member 1 — Tech lead / integration
- contracts;
- orchestration;
- merge control;
- deployment.

### Member 2 — Frontend/map
- dashboard;
- MapLibre;
- layers;
- route visualization.

### Member 3 — Marine data
- provider adapters;
- normalization;
- cached fixtures.

### Member 4 — Geo/routing
- Shapely/GeoPandas;
- geofences;
- route comparison.

### Member 5 — AI/agents
- intent;
- planner;
- tool calling;
- explanation;
- multilingual.

### Member 6 — QA/demo/research
- datasets;
- tests;
- pitch;
- evidence labels;
- presentation assets;
- continuously tests main branch.

---

# Timeline

## Hour 0–2
- lock scope;
- assign ownership;
- repo scaffold;
- fixture dataset;
- deployment skeleton.

## Hour 2–6
Goal: first vertical slice.

Must already show:
- query;
- static candidate zones;
- score;
- route;
- map;
- explanation.

If this does not work by hour 6, stop adding features.

## Hour 6–12
- marine API adapter;
- geospatial functions;
- real/cached PFZ data;
- evidence schema;
- error handling.

## Hour 12–18
- planner/tool orchestration;
- decision engine;
- route comparison;
- hard gates;
- agent trace.

## Hour 18–24
- multilingual output;
- counterfactual query;
- evidence drawer;
- cache/fallbacks;
- integration tests.

## Hour 24–29
- UI polish;
- animation only if harmless;
- demo reset;
- source badges;
- latency improvements.

## Hour 29–32
**Feature freeze.**

No major new features.

- run test matrix;
- fix only demo blockers;
- prepare screenshots/video fallback.

## Hour 32–35
- pitch rehearsal;
- judge Q&A;
- each member rehearses technical area;
- create backup local/demo mode.

## Hour 35–36
- final deployment;
- health check;
- laptops charged;
- backup hotspot;
- local build;
- final git tag.

## Rule

At all times keep `main` demoable.
