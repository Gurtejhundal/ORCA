# ORCA Website — Master Product, Build Order & Verification Plan
## SIH 2026 / Gateway Implementation Blueprint

## Purpose

This document defines how the **entire ORCA website** should work from first load to final marine recommendation.

It also defines:

- what must be built first;
- what must not be built early;
- how the hero connects to ORCA intelligence;
- frontend architecture;
- backend architecture;
- agent flow;
- marine-data flow;
- maps and geospatial logic;
- decision engine;
- verification criteria;
- testing order;
- Gateway-ready definition of done.

This is the main project-control document.

---

# 1. Product Definition

ORCA is:

> **A marine intelligence assistant for fishermen that combines conversation, marine data, geospatial reasoning, safety checks, fishing-zone intelligence, and route guidance.**

The fisherman should be able to ask:

```text
Where should I fish today?
Is it safe to leave at 5 AM?
What are the sea conditions?
Are there any warnings nearby?
What is the safest route?
Am I near a restricted or international boundary?
Why are you recommending this fishing zone?
```

The user sees a simple conversational product.

Behind the scenes:

```text
User question
      ↓
Intent understanding
      ↓
Task planning
      ↓
Marine data retrieval
      ↓
Weather / ocean / GIS analysis
      ↓
Deterministic safety + fishing scoring
      ↓
Route comparison
      ↓
Explainable recommendation
      ↓
Map / hero visualization
```

---

# 2. Main Product Principle

ORCA should look simple to the fisherman.

The complexity stays behind the interface.

Frontend:

```text
Ask ORCA
```

Backend:

```text
Agents
APIs
Marine data
Geospatial calculations
Risk scoring
Route comparison
Evidence
```

Do not expose unnecessary technical complexity to the fisherman.

---

# 3. Primary User

For Gateway, focus on:

```text
PRIMARY USER
Fisherman
```

Secondary users:

```text
Researchers
Coastal authorities
Maritime operators
```

Do not design four separate products now.

Build the fisherman workflow first.

---

# 4. Primary Gateway Demo

The flagship query:

```text
I am leaving from Nagapattinam tomorrow at 5 AM.
Where should I fish and what is the safest route?
```

Expected ORCA behavior:

```text
1. Understand location and departure time.
2. Find candidate fishing/PFZ zones.
3. Check sea conditions.
4. Check weather and marine warnings.
5. Check restricted/boundary areas.
6. Calculate fishing opportunity.
7. Calculate voyage safety.
8. Compare routes.
9. Select best zone + route.
10. Explain why.
11. Display everything visually.
```

This one flow should work perfectly before adding more use cases.

---

# 5. Whole Website Structure

Recommended website:

```text
/
├── Home / ORCA Hero
├── How It Works
├── Capabilities
├── Use Cases
├── Data Sources
├── About
└── ORCA Intelligence Experience
```

For Gateway, these can exist as sections on one strong landing page plus the live ORCA experience.

Do not waste time building many separate marketing pages.

---

# 6. Home / Hero

Reference:

```text
REFERENCE_HERO.png
```

Implementation master:

```text
ORCA_HERO_MASTER_IMPLEMENTATION_PLAN.md
```

Supporting references:

```text
ORCA_REACTBITS_FLUID_GLASS_IMPLEMENTATION_V2.md
ORCA_REACTBITS_DIRECTIONAL_WAVES_IMPLEMENTATION.md
```

Hero must provide:

```text
live ocean
top-view boat
infinite natural boat movement
directional mouse-wave interaction
true live liquid glass
Ask ORCA bar
minimal tool dock
minimal PFZ hints
minimal restricted boundary
```

---

# 7. Hero Purpose

The hero should explain the product without a long paragraph.

Visual message:

```text
Fisherman
    ↓
asks ORCA
    ↓
ORCA understands the sea
    ↓
ORCA guides him
```

Do not put a full dashboard in the hero.

---

# 8. Hero Verification

Hero is complete only when:

```text
[ ] ocean moves continuously
[ ] no obvious animation loop
[ ] boat is top-view
[ ] boat follows natural wave model
[ ] mouse creates directional wave fronts
[ ] no circular ripples
[ ] no whirlpool effect
[ ] liquid glass is fully live
[ ] no frozen glass texture
[ ] ocean remains visible through glass
[ ] Ask ORCA input works
[ ] UI remains minimal
[ ] desktop performance is acceptable
[ ] mobile fallback works
```

Do not continue to ORCA intelligence if hero foundation is unstable.

---

# 9. Marketing Sections Below Hero

After hero:

```text
1. How ORCA Works
2. What ORCA Can Check
3. Fisherman Scenario
4. Safe Route Intelligence
5. Data Sources
6. Regional Language Support
7. Final Ask ORCA CTA
```

Keep same design language.

Avoid generic feature-card grids.

---

# 10. How ORCA Works Section

Show:

```text
ASK
 ↓
UNDERSTAND
 ↓
CHECK DATA
 ↓
ANALYSE SEA
 ↓
COMPARE RISK
 ↓
GUIDE
```

Keep this visual and simple.

---

# 11. Capabilities Section

Core capabilities:

```text
Fishing Zones
Sea Conditions
Marine Alerts
Safe Routes
Boundary Awareness
Explainable Decisions
```

Each capability should have:

```text
short text
+
marine visualization
```

Do not use huge cards with generic icons.

---

# 12. Live ORCA Experience

The actual product interaction should remain integrated with the hero/map experience.

User asks:

```text
Where should I fish today?
```

Then:

```text
hero state
idle
→ analysing
→ result
```

The ocean remains visible.

The interface reveals only relevant intelligence.

---

# 13. ORCA Frontend State

Recommended:

```ts
type OrcaState =
  | "idle"
  | "analysing"
  | "result"
  | "warning"
  | "error";
```

---

# 14. Idle State

Show:

```text
ocean
boat
Ask ORCA
tool dock
minimal PFZ hints
```

No heavy data panels.

---

# 15. Analysing State

After query:

```text
ORCA analysing...
```

Show real task progress where possible:

```text
✓ Understanding request
✓ Checking sea conditions
✓ Finding fishing zones
✓ Checking hazards
✓ Comparing routes
```

Do not use fake fixed loading animation if the tasks are already complete.

---

# 16. Result State

Display:

```text
Recommended PFZ
Fishing Opportunity
Voyage Safety
Distance
Confidence
Recommended Route
Reasons
```

Example:

```text
PFZ-02 Recommended

Fishing Opportunity  89
Voyage Safety        86
Confidence           91%
Distance             18.4 km

✓ favourable conditions
✓ lower wave exposure
✓ route avoids restricted zone
```

---

# 17. Warning State

Example:

```text
NOT RECOMMENDED

Reason:
High wave exposure on route.

Safer departure window:
06:30–08:00
```

Do not let the LLM override deterministic safety logic.

---

# 18. Frontend Technology

Recommended:

```text
Next.js
TypeScript
Tailwind CSS
Three.js / React Three Fiber
React Bits components
MapLibre / GeoJSON where required
Framer Motion or GSAP
```

Use the smallest reliable stack.

---

# 19. Frontend Architecture

```text
Frontend
│
├── Hero
│   ├── Ocean
│   ├── Boat
│   ├── Pointer waves
│   ├── FluidGlass
│   └── Ask ORCA
│
├── Marine overlays
│   ├── PFZ
│   ├── Routes
│   ├── Boundaries
│   └── Hazards
│
├── ORCA response UI
│   ├── Result
│   ├── Evidence
│   └── Comparison
│
└── Marketing sections
```

---

# 20. Backend Purpose

Backend must handle:

```text
query interpretation
agent orchestration
data retrieval
normalization
decision logic
geospatial logic
route logic
evidence collection
response generation
```

Do not perform important safety calculations inside frontend components.

---

# 21. Backend Technology

Recommended:

```text
Next.js API routes
+
Python FastAPI only if geospatial/scientific logic benefits from Python
```

Possible Python tools:

```text
GeoPandas
Shapely
NumPy
Pandas
NetworkX
```

Do not create microservices unless they solve a real need.

---

# 22. Agent Architecture

Recommended agents:

```text
Planner Agent
Marine Intelligence Agent
Weather/Hazard Agent
Geospatial Agent
Decision Resolver
Explanation Agent
```

Do not create 15 agents.

---

# 23. Agent Responsibilities

## Planner

```text
understands query
creates task plan
```

## Marine Intelligence

```text
PFZ
SST
chlorophyll
waves
currents
marine conditions
```

## Weather/Hazard

```text
weather
wind
cyclone
lightning
warnings
```

## Geospatial

```text
distance
boundary checks
restricted-zone intersections
route geometry
```

## Decision Resolver

```text
safety
opportunity
route comparison
candidate selection
```

## Explanation

```text
converts deterministic result
into simple fisherman-friendly answer
```

---

# 24. Deterministic vs AI Logic

AI should handle:

```text
intent
planning
tool selection
language
explanation
```

AI should NOT invent:

```text
wave height
SST
chlorophyll
PFZ coordinate
safety score
route intersection
boundary status
```

These must come from real data or deterministic code.

---

# 25. Data Architecture

```text
External Data
     ↓
Provider Adapters
     ↓
Normalized Evidence
     ↓
Decision Engine
     ↓
Frontend Result
```

---

# 26. Data Categories

ORCA may use:

```text
PFZ
SST
chlorophyll
waves
wind
currents
tides
cyclone alerts
lightning alerts
marine warnings
coastline
restricted zones
protected zones
maritime boundaries
```

Do not integrate every dataset first.

---

# 27. First Data Integration

Start with only:

```text
1. PFZ / candidate fishing zones
2. wave / marine forecast
3. weather / wind
4. restricted-zone GeoJSON
```

This is enough for the first complete decision flow.

---

# 28. Data Verification

Every data result must store:

```text
source
value
unit
location
valid time
fetched time
freshness
quality
```

Example:

```json
{
  "variable": "wave_height",
  "value": 1.4,
  "unit": "m",
  "source": "provider-name",
  "validAt": "...",
  "freshness": "LIVE"
}
```

---

# 29. Data States

Use:

```text
LIVE
CACHED
STATIC
DEMO
```

Never present demo data as live.

---

# 30. Decision Engine

Core outputs:

```text
Safety Score
Fishing Opportunity Score
Route Cost
Confidence
```

Keep the formulas deterministic and transparent.

---

# 31. Safety Logic

Example structure:

```text
wave risk
wind risk
alert risk
current risk
boundary risk
uncertainty
      ↓
Safety Score
```

Add hard gates.

Example:

```text
restricted-zone intersection
→ reject route
```

---

# 32. Fishing Opportunity

Use:

```text
PFZ evidence
SST suitability
chlorophyll suitability
other signal
```

Do not call it:

```text
probability of catching fish
```

unless scientifically validated.

Call it:

```text
relative fishing opportunity score
```

---

# 33. Route Engine

For Gateway:

```text
origin
→ candidate target
→ candidate routes
→ sample risk along routes
→ reject forbidden paths
→ compare cost
→ choose safest feasible route
```

Do not build certified marine navigation.

This is a decision-support prototype.

---

# 34. Route Verification

Test:

```text
[ ] shortest route can lose
[ ] safer route can be longer
[ ] restricted route is rejected
[ ] hazard route gets higher risk
[ ] route changes when conditions change
```

This is one of the strongest demo proofs.

---

# 35. Counterfactual Reasoning

User asks:

```text
Why not the nearest zone?
```

ORCA should compare:

```text
Recommended
vs
Nearest
```

Show:

```text
distance
safety
opportunity
wave exposure
boundary conflict
route cost
```

This proves real reasoning.

---

# 36. Conversation Memory

For first version:

store only:

```text
conversation ID
latest location
latest departure time
latest selected PFZ
latest route
latest evidence
```

Do not overbuild memory.

---

# 37. Multilingual Support

Add after English flow works.

Flow:

```text
detect language
      ↓
understand intent
      ↓
run same intelligence pipeline
      ↓
translate/explain result
```

Do not build separate logic for every language.

---

# 38. Database

Minimum tables:

```text
conversations
messages
evidence
trips
geofences
```

Optional later:

```text
saved locations
alerts
agent runs
cache
```

---

# 39. API Endpoints

Minimum:

```text
POST /api/chat
POST /api/plan
GET  /api/marine
GET  /api/pfz
POST /api/routes/compare
GET  /api/geofences
GET  /api/health
```

---

# 40. Health Endpoint

Before demo:

```text
/api/health
```

must report:

```text
frontend
backend
database
LLM
marine provider
PFZ provider
```

Example:

```json
{
  "app": "ok",
  "llm": "ok",
  "marine": "ok",
  "pfz": "cached",
  "database": "ok"
}
```

---

# 41. Build Order — Mandatory

Do not change this order unless there is a real blocker.

---

## Stage 1 — Design Foundation

Build:

```text
static hero
design tokens
layout
navigation
tool dock
Ask ORCA bar
```

Verify against:

```text
REFERENCE_HERO.png
```

---

## Stage 2 — Ocean Foundation

Build:

```text
procedural ocean
continuous waves
lighting
performance
```

Verify:

```text
no visible loop
stable FPS
```

---

## Stage 3 — Boat

Build:

```text
top-view boat
wave-based height
pitch
roll
drift
```

Verify:

```text
boat physically matches ocean
```

---

## Stage 4 — Pointer Waves

Build:

```text
directional wave crests
pointer velocity
pointer direction
propagation
decay
```

Verify:

```text
no circular ripple
no swirl
```

---

## Stage 5 — Liquid Glass

Build:

```text
true FluidGlass
bar.glb
live scene refraction
DOM input overlay
```

Verify:

```text
moving water visible through glass
no frozen frame
```

---

## Stage 6 — Hero Integration

Combine:

```text
ocean
boat
mouse waves
glass
PFZ hints
restricted boundary
```

Verify performance.

---

## Stage 7 — Fixture Intelligence

Before live APIs:

use controlled demo data.

Build:

```text
3 fishing zones
marine snapshots
hazard polygon
2 routes
decision scores
```

Verify complete user flow.

---

## Stage 8 — Deterministic Decision Engine

Build:

```text
safety
opportunity
confidence
route cost
hard gates
```

Test thoroughly.

---

## Stage 9 — ORCA Query Flow

Build:

```text
Ask ORCA
intent parsing
planner
fixture tools
decision
explanation
visual result
```

Verify flagship query.

---

## Stage 10 — Live Data

Replace fixture adapters one at a time.

Order:

```text
marine forecast
weather
PFZ
alerts
additional datasets
```

Never replace all fixture providers at once.

---

## Stage 11 — Maps / Geospatial

Build:

```text
real coordinates
GeoJSON
boundary intersection
route geometry
hazard zones
```

---

## Stage 12 — Multilingual

Only after English flow is stable.

---

## Stage 13 — Testing / Demo Hardening

Add:

```text
API fallback
cache
offline demo
error states
health checks
```

---

# 42. Verification Gates

Every stage has a gate.

Do not proceed until the gate passes.

---

## Gate 1 — Visual

Question:

```text
Does the static hero look right?
```

If no:

do not start advanced animation.

---

## Gate 2 — Ocean

Question:

```text
Does the ocean run smoothly without obvious looping?
```

If no:

do not add boat.

---

## Gate 3 — Boat

Question:

```text
Does the boat feel attached to the ocean?
```

If no:

fix wave sharing.

---

## Gate 4 — Hover Waves

Question:

```text
Do mouse movements create directional tide-like crests?
```

If circular:

fail.

---

## Gate 5 — Glass

Question:

```text
Can I see the live moving ocean through the liquid glass?
```

If frozen/frosted:

fail.

---

## Gate 6 — Fixture Decision

Question:

```text
Does changing the fixture conditions change the recommendation?
```

If no:

the decision is hard-coded.

Fail.

---

## Gate 7 — Safety

Question:

```text
Can unsafe candidates be rejected even if fishing opportunity is high?
```

If no:

fail.

---

## Gate 8 — Route

Question:

```text
Can a longer route beat the shortest route because it is safer?
```

If no:

fail.

---

## Gate 9 — Evidence

Question:

```text
Can every important numeric claim be traced to evidence?
```

If no:

fail.

---

## Gate 10 — API Failure

Question:

```text
If one provider dies, does ORCA still respond correctly?
```

If app crashes:

fail.

---

# 43. Automated Tests

Minimum unit tests:

```text
safety score
opportunity score
confidence
route cost
hard gate
Haversine distance
point in polygon
line intersects polygon
nearest PFZ
```

---

# 44. Integration Tests

Minimum:

```text
flagship query
nearest zone unsafe
restricted route
high waves
provider unavailable
cached data
why not nearest
different departure time
```

---

# 45. Hallucination Verification

For generated explanation:

extract all:

```text
numbers
coordinates
source names
```

Verify each exists in:

```text
evidence
decision output
route result
```

If not:

fail.

---

# 46. Demo Data Verification

Demo data must clearly say:

```text
DEMO
```

Do not let judges think synthetic values are live observations.

---

# 47. Live Data Verification

Before Gateway:

verify:

```text
API reachable
units correct
timestamps correct
coordinates correct
fallback works
rate limits acceptable
```

Do this on the actual demo network.

---

# 48. Performance Verification

Desktop:

```text
60 FPS ideal
45+ FPS acceptable
```

Check:

```text
hero load
GPU frame rate
memory
mobile fallback
DPR
```

---

# 49. Mobile Verification

Must work at:

```text
small phone
large phone
tablet
desktop
```

On mobile:

```text
no hover dependency
simpler ocean
Ask ORCA remains primary
result uses bottom sheet
```

---

# 50. Accessibility Verification

Check:

```text
keyboard navigation
focus states
input labels
button labels
contrast
reduced motion
not color-only warnings
```

---

# 51. Security Verification

At minimum:

```text
API keys server-side
input validation
no secrets in frontend
rate limiting if public
sanitize LLM/tool input
external data treated as untrusted
```

---

# 52. Error States

Design these intentionally:

```text
No marine data
PFZ unavailable
Weather unavailable
Location unclear
Route unavailable
Low confidence
Network failure
```

Do not show generic:

```text
Something went wrong.
```

Use:

```text
Wave forecast unavailable.
ORCA is using cached data from 04:30 IST.
```

---

# 53. Gateway Demo Mode

Create:

```text
DEMO_MODE=true
```

Demo mode should:

```text
use reliable fixture/cached data
keep all interactions working
show DEMO/CACHED labels
```

Do not rely entirely on live internet during judging.

---

# 54. Demo Scenarios

Create four:

```text
1. Normal fishing trip
2. High waves
3. Restricted route
4. Data-provider failure
```

Changing scenario should produce different deterministic results.

---

# 55. Gateway Demo Sequence

Recommended:

```text
1. Show hero
2. Ask flagship query
3. Show agents working
4. Show PFZ candidates
5. Show safe route
6. Show score
7. Ask “Why not nearest?”
8. Show counterfactual comparison
9. Show evidence
```

Do not waste time explaining every page.

---

# 56. What Must Be Real for Gateway

Strongly recommended real:

```text
working query
working decision engine
working geospatial calculation
working route comparison
working evidence
working visualization
```

Can be controlled/cached:

```text
some marine/PFZ data
```

Must be labelled honestly.

---

# 57. What Can Be Future Work

Do not block Gateway on:

```text
AIS
fleet tracking
satellite messaging
certified navigation
production alerts
full offline app
researcher portal
authority portal
species-specific scientific models
```

---

# 58. Recommended Team Work Split

For six people:

```text
1. Frontend / Hero
2. 3D / Ocean / Interaction
3. Backend / Agents
4. Marine data integration
5. Geo / Routing / Decision engine
6. QA / Demo / Research / Presentation
```

---

# 59. Merge Rule

Keep:

```text
main
```

demoable.

Use feature branches.

Do not merge broken visual experiments into main.

---

# 60. Definition of Website Done

The Gateway website is ready only when:

```text
[ ] hero matches reference direction
[ ] live ocean works
[ ] top-view boat works
[ ] directional hover waves work
[ ] liquid glass is live
[ ] Ask ORCA works
[ ] flagship query works end-to-end
[ ] deterministic decision engine works
[ ] PFZ candidates display
[ ] route comparison works
[ ] restricted zones work
[ ] evidence is visible
[ ] agent trace is visible
[ ] failures are handled
[ ] demo mode works
[ ] mobile works
[ ] performance is acceptable
[ ] 3-minute demo is rehearsed
```

---

# 61. Most Important Rule

Do not build the project horizontally.

Bad:

```text
partial hero
partial agents
partial API
partial map
partial dashboard
partial voice
```

Good:

```text
one complete vertical slice
```

Build:

```text
hero
→ query
→ data
→ decision
→ route
→ explanation
→ visualization
```

Then expand.

---

# 62. First Thing to Build

The first implementation task is:

```text
STATIC HERO COMPOSITION
```

matching:

```text
REFERENCE_HERO.png
```

Then:

```text
LIVE OCEAN
```

Then:

```text
BOAT
```

Then:

```text
DIRECTIONAL HOVER WAVES
```

Then:

```text
LIVE LIQUID GLASS
```

Only after those five are correct:

```text
ORCA INTELLIGENCE
```

---

# 63. Codex Master Project Prompt

```text
You are implementing the ORCA SIH 2026 marine-intelligence website.

Before coding, read all ORCA project documentation.

The main source-of-truth documents are:

- ORCA_HERO_MASTER_IMPLEMENTATION_PLAN.md
- ORCA_REACTBITS_FLUID_GLASS_IMPLEMENTATION_V2.md
- ORCA_REACTBITS_DIRECTIONAL_WAVES_IMPLEMENTATION.md
- ORCA design-language documentation
- this website master plan
- REFERENCE_HERO.png

DO NOT BUILD THE WHOLE PRODUCT AT ONCE.

Use the build order and verification gates in this document.

PHASE ORDER

1. Static hero composition
2. Procedural ocean
3. Top-view boat
4. Directional pointer waves
5. True live liquid glass
6. Integrated hero
7. Fixture marine intelligence
8. Deterministic decision engine
9. ORCA query flow
10. Live marine data adapters
11. Geospatial/routing
12. Multilingual support
13. Demo hardening

IMPORTANT

Do not move to the next phase until the current verification gate passes.

Before every phase:

- inspect current implementation;
- state files to change;
- state expected behavior;
- identify any blocker.

After every phase:

- typecheck;
- lint;
- run tests;
- run the app;
- verify acceptance criteria;
- report what actually works;
- report what still does not work.

Do not claim completion if the visual or functional acceptance criteria fail.

CORE RULES

- ocean dominates the hero;
- top-view fisherman;
- no circular pointer ripples;
- no whirlpool;
- no cyan glow;
- liquid glass remains live every frame;
- no frozen glass texture;
- no fake dashboard-heavy UI;
- no invented marine measurements;
- deterministic safety logic;
- every numeric recommendation must be evidence-backed;
- fixture data must be labelled DEMO;
- live provider failures must not crash ORCA;
- main branch must remain demoable.

FIRST TASK

Inspect the repository only.

Return:

1. current architecture;
2. current files;
3. current dependencies;
4. what already exists;
5. what conflicts with the master plan;
6. the exact implementation plan for Stage 1;
7. any serious blocker.

Do not modify code until this inspection is complete.
```

---

# Final Strategy

Build ORCA in this order:

```text
LOOK RIGHT
    ↓
MOVE RIGHT
    ↓
INTERACT RIGHT
    ↓
THINK RIGHT
    ↓
USE REAL DATA
    ↓
HANDLE FAILURE
    ↓
DEMO
```

If the first five technical foundations are correct, the rest of the website becomes manageable.

If those foundations are weak, adding more agents, APIs, pages and features will only make the project harder to fix.
