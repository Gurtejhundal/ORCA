# UI/UX Specification

## Design principle

Marine command center, not generic SaaS chatbot.

## Desktop layout

```text
┌──────────────────────────────────────────────────────────┐
│ ORCA | Data status | location | language                 │
├─────────────────────┬────────────────────────────────────┤
│ Conversation        │ Interactive Marine Map             │
│                     │                                    │
│ User query          │ PFZ ●                              │
│ Agent trace         │ hazard polygons                    │
│ Recommendation      │ route lines                        │
│                     │ boundary overlays                  │
├─────────────────────┴────────────────────────────────────┤
│ Safety | Opportunity | Distance | Confidence | Evidence │
└──────────────────────────────────────────────────────────┘
```

## Main components

### 1. Query composer
- text input;
- microphone optional;
- sample-query chips.

### 2. Agent trace
Show meaningful execution:
- planning;
- fetching marine data;
- checking hazards;
- routing;
- scoring;
- explaining.

### 3. Map
Required layers:
- origin;
- candidate fishing zones;
- recommended target;
- recommended route;
- alternative route;
- hazards;
- geofences;
- optional SST/chlorophyll overlay.

### 4. Decision cards

```text
Voyage Safety          84/100
Fishing Opportunity    91/100
Confidence             87%
Distance               26.9 km
```

### 5. Why this route?
Show 3–5 short reasons.

### 6. Evidence drawer
For every variable:
- value;
- unit;
- source;
- valid time;
- freshness badge.

### 7. Route comparison
Recommended vs nearest/shortest.

## Visual hierarchy

The judge should understand the decision in 5 seconds:

1. **GO / CAUTION / DO NOT GO**
2. destination;
3. route;
4. scores;
5. reasons;
6. data evidence.

Do not bury the decision inside a long chatbot paragraph.
