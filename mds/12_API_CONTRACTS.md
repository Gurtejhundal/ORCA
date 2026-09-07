# API Contracts

## POST /api/chat

Request:

```json
{
  "conversationId": "optional-uuid",
  "message": "I am leaving from Nagapattinam tomorrow at 5 AM. Where should I fish?",
  "language": "auto"
}
```

Response:

```json
{
  "conversationId": "...",
  "requestId": "...",
  "answer": "...",
  "decision": {},
  "map": {},
  "agentTrace": []
}
```

---

## POST /api/plan

Internal endpoint.

Input:
```json
{
  "message": "...",
  "context": {}
}
```

Output:
```json
{
  "intent": "FISHING_TRIP_PLAN",
  "origin": {"name":"Nagapattinam"},
  "departureTime": "...",
  "tasks": [
    {"id":"marine","tool":"marine_snapshot"},
    {"id":"pfz","tool":"pfz_candidates"},
    {"id":"gis","tool":"geofence_lookup"}
  ]
}
```

---

## GET /api/marine

Params:
```text
lat
lon
start
end
```

Returns normalized `Evidence[]`.

---

## GET /api/pfz

Params:
```text
lat
lon
radiusKm
date
```

Returns `CandidateFishingZone[]`.

---

## POST /api/routes/compare

Request:
```json
{
  "origin": {"lat":0,"lon":0},
  "destinations": [{"lat":0,"lon":0}],
  "departureTime": "..."
}
```

Response:
```json
{
  "routes": [],
  "recommendedRouteId": "..."
}
```

---

## GET /api/geofences

Params:
```text
bbox
categories
```

Returns GeoJSON FeatureCollection.

---

## GET /api/health

Must expose adapter status before demo:

```json
{
  "app":"ok",
  "llm":"ok",
  "marine":"ok",
  "pfz":"cached",
  "database":"ok"
}
```
