# Problem and Success Criteria

## Original problem

Marine stakeholders must combine satellite Earth Observation, oceanographic observations, forecasts, GIS layers and advisories to make operational decisions. These sources are fragmented and difficult for non-experts to interpret.

ORCA should provide a conversational interface backed by collaborative AI agents that can discover data, reason across space and time, and return evidence-based recommendations.

## Core problem in one sentence

> Convert fragmented marine data into an explainable answer to **where, when and whether a user should operate at sea**.

## Primary users

### 1. Fisher
Needs:
- nearest promising fishing zone;
- safe departure/return window;
- route avoiding hazards and boundaries;
- simple local-language explanation.

### 2. Coastal/disaster authority
Needs:
- hazardous regions;
- vessel exposure;
- alert explanation;
- map-first situational awareness.

### 3. Researcher
Needs:
- SST/chlorophyll/current patterns;
- evidence provenance;
- temporal comparison.

### 4. Maritime operator
Needs:
- route risk;
- waves/wind/current;
- restricted-zone awareness.

## Gateway success criteria

A strong prototype must demonstrate all of the following in one flow:

- [ ] natural-language input;
- [ ] intent extraction;
- [ ] autonomous task plan;
- [ ] at least 3 heterogeneous data sources/types;
- [ ] actual geospatial operations;
- [ ] deterministic risk/opportunity calculation;
- [ ] collaborative agent execution;
- [ ] interactive map;
- [ ] explainable answer with source timestamps;
- [ ] graceful handling of unavailable data.

## What does NOT count as success

- Chatbot answers generated from model knowledge.
- Static maps with fake pins.
- "Multi-agent" UI labels where no tools execute.
- Hard-coded final answers.
- Risk scores invented by the LLM.
- A huge feature list without a complete demo flow.

## Winning differentiation

The strongest differentiators are:

1. **Evidence fusion** — combine PFZ/SST/chlorophyll + waves/weather + GIS restrictions.
2. **Counterfactual route comparison** — show why shortest ≠ safest.
3. **Agent disagreement resolution** — fishing opportunity may be high while voyage safety is poor.
4. **Confidence/provenance** — every recommendation exposes evidence and data freshness.
