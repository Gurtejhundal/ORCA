# Demo Fixture Specification

A reliable offline fixture is mandatory.

## Region

Choose **one Indian coastal region** and keep all fixture data geographically consistent.

Suggested demo narrative:
- origin: Nagapattinam / selected fishing harbour;
- 3 candidate fishing zones offshore;
- 1 restricted/hazard polygon;
- 1 shortest but riskier route;
- 1 longer safer route.

## Fixture files

```text
/data/demo/
  origin.json
  candidate-zones.geojson
  geofences.geojson
  marine-snapshots.json
  routes.geojson
  advisories.json
```

## Required scenario behavior

### Zone A
- closest;
- high opportunity;
- poor safety or route hazard.

### Zone B
- slightly farther;
- good opportunity;
- good safety;
- should be recommended.

### Zone C
- safe;
- lower fishing opportunity.

This creates a real multi-objective decision.

## Critical requirement

Fixtures must be labelled `DEMO` unless they are actual cached authoritative data.

Do not present synthetic coordinates/readings as current INCOIS measurements.

## Demo perturbation

Add an internal toggle:

```text
Scenario 1: Normal
Scenario 2: High Waves
Scenario 3: Restricted Route
Scenario 4: API Failure
```

The recommendation must change deterministically.

This is excellent evidence that the system is not producing a hard-coded answer.
