# Master Codex Prompt Template

Do not ask Codex to build the entire application from this prompt in one shot.
Use this template for each phase from `14_CODEX_IMPLEMENTATION_PLAN.md`.

```text
You are implementing ORCA, an Agentic AI marine decision-support prototype
for SIH 2026 Problem Statement 26176.

Read these repository docs before coding:
- 00_README.md
- 04_TECH_STACK.md
- 05_SYSTEM_ARCHITECTURE.md
- 08_DATA_CONTRACTS.md
- [PHASE-SPECIFIC FILE]

TASK
[ONE clearly scoped implementation task]

CONSTRAINTS
- TypeScript strict mode.
- Keep LLM output separate from deterministic calculations.
- Never fabricate marine/weather/geospatial measurements.
- Every provider result must include source, time, freshness and quality.
- Do not remove existing working behavior.
- Prefer small composable modules.
- Add tests for deterministic functions.
- Update documentation when an interface changes.

ACCEPTANCE CRITERIA
1. [...]
2. [...]
3. [...]

BEFORE CODING
- inspect existing repository structure;
- identify affected files;
- state the implementation plan briefly;
- reuse existing contracts/components where possible.

AFTER CODING
- run relevant tests;
- run typecheck/lint;
- summarize files changed;
- list any unresolved blocker;
- do not claim completion if acceptance criteria fail.
```

## Bad prompt

```text
Build me an AI marine app for SIH with agents, maps and APIs.
```

This causes uncontrolled architecture and fake completeness.

## Good prompt

```text
Implement the deterministic route comparison module described in
10_GEOSPATIAL_AND_ROUTING.md using the existing RouteCandidate contract.
Add tests for safe route, restricted-zone intersection and no-route cases.
Do not touch UI.
```
