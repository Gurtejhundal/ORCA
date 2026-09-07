# User Flows

## Flagship flow: Plan a fishing trip

### User
"I am leaving from Nagapattinam tomorrow at 5 AM. Where should I fish and what is the safest route?"

### System flow

1. Detect language.
2. Extract:
   - origin;
   - departure datetime;
   - intent = `FISHING_TRIP_PLAN`;
   - desired outputs = zone + safety + route.
3. Geocode/resolve origin.
4. Planner creates tasks:
   - get candidate PFZ/fishing areas;
   - get marine forecast;
   - get weather alerts;
   - get restricted/geofence layers;
   - score candidate zones;
   - route to top candidates;
   - compare routes;
   - explain recommendation.
5. Agents execute tools.
6. Decision engine rejects unsafe candidates.
7. Route engine computes candidate routes.
8. Resolver chooses best feasible option.
9. UI renders:
   - recommended zone;
   - safety score;
   - opportunity score;
   - route;
   - hazard overlays;
   - explanation;
   - confidence and source freshness.

## Follow-up flow

User:
"Why not the nearest zone?"

System:
- reuse conversation context;
- compare recommended vs nearest;
- show distance, safety, waves, restricted zones and total cost;
- do not re-fetch unchanged data unless stale.

## Safety flow

User:
"Can I go even if waves are very high?"

System:
- never override deterministic hard-safety gate;
- explain which threshold/rule triggered;
- offer safer departure windows if forecast data supports them.

## Data failure flow

If one source fails:
- mark source unavailable;
- lower confidence;
- use fallback only if configured;
- clearly identify fallback;
- never fabricate the missing measurement.
