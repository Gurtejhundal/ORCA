# Risk Register

| Risk | Probability | Impact | Mitigation |
|---|---:|---:|---|
| Live PFZ machine-readable access unreliable | High | High | Cache current authoritative sample + show `CACHED` |
| Marine API outage | Medium | High | Provider abstraction + fixtures |
| Slow external API | High | Medium | parallel fetch + timeout + cache |
| LLM invalid JSON | Medium | Medium | schema validation + retry + fallback |
| Hallucinated measurements | Medium | Critical | explanation receives closed evidence set only |
| Route crosses land | Medium | High | water mask / curated demo area / validation |
| Judges call score arbitrary | High | High | transparent formula + call parameters prototype, configurable |
| Too many features | High | High | enforce P0 scope |
| Demo internet failure | Medium | Critical | offline fixtures + one-click demo |
| Team merge conflicts | Medium | Medium | ownership by service + protected main branch |
| UI consumes too much time | High | Medium | build vertical slice before polish |
| "Agentic AI" appears fake | Medium | High | expose real tool trace and outputs |
| Safety claims overreach | Medium | Critical | explicit decision-support disclaimer |

## Biggest strategic risk

The largest risk is not coding failure.

It is producing a polished chatbot that does not prove **marine reasoning**.

If time is limited, cut:
- authentication;
- user profiles;
- complex dashboards;
- voice;
- historical analytics.

Do not cut:
- evidence;
- scoring;
- geospatial checks;
- route comparison;
- explanation.
