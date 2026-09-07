# Testing and Evaluation

## Unit tests

### Scores
- safety = 100 when all risks zero;
- safety decreases with increasing hazards;
- hard gate overrides good weighted score;
- missing critical evidence reduces confidence;
- opportunity score remains 0..100.

### Geospatial
- Haversine known-distance test;
- point inside polygon;
- point outside polygon;
- route intersects restricted polygon;
- route does not intersect;
- nearest candidate correct.

### Time
- parse "tomorrow at 5 AM" in user timezone;
- forecast window matches departure.

## Integration tests

1. flagship query.
2. nearest zone unsafe.
3. safest zone farther away.
4. restricted-zone crossing.
5. marine API unavailable.
6. PFZ unavailable.
7. cached data.
8. multilingual explanation.
9. follow-up: "why not nearest?"
10. follow-up: "what if I leave 3 hours later?"

## Hallucination evaluation

For each generated answer:
- extract all numbers;
- assert they exist in decision/evidence;
- extract named sources;
- assert source exists in evidence.

## Agent evaluation

Measure:
- intent accuracy;
- valid tool plan rate;
- task success rate;
- tool failure recovery;
- response latency;
- unsupported-claim count.

## Demo performance targets

Prototype targets:
- first visual feedback < 1 second;
- full cached/demo response < 5 seconds;
- live provider request timeout 4–6 seconds each;
- independent fetches in parallel.

## Manual judge checklist

Can a judge answer these immediately?

- What is ORCA recommending?
- Why?
- Which data supports it?
- Is the data live/cached/demo?
- Why isn't the shortest route selected?
- What did the agents actually do?
