# Deterministic Decision Engine

The scoring engine must be transparent and configurable.

## Important

The weights below are **prototype parameters**, not scientifically validated operating limits.  
Do not present them as government or maritime-navigation standards.

Store all thresholds in config so they can be replaced by domain-expert validated values.

---

# 1. Safety Score

Normalize each hazard to `0..1`:

- wave risk `Rw`
- wind risk `Rwind`
- cyclone/severe-alert risk `Ra`
- current risk `Rc`
- restricted-boundary risk `Rb`
- data uncertainty `Ru`

Prototype weighted risk:

```text
R =
  0.30*Rw +
  0.20*Rwind +
  0.20*Ra +
  0.10*Rc +
  0.15*Rb +
  0.05*Ru
```

```text
SafetyScore = round(100 * (1 - clamp(R, 0, 1)))
```

## Hard gates

Hard gates override the score.

Examples:
- severe authoritative alert covers route/time;
- route crosses forbidden polygon;
- critical marine value exceeds configured prototype threshold;
- critical required evidence unavailable.

Output:

```json
{
  "status": "NOT_RECOMMENDED",
  "reason": "HARD_GATE_RESTRICTED_ZONE"
}
```

---

# 2. Fishing Opportunity Score

Inputs:
- PFZ overlap/proximity;
- SST suitability;
- chlorophyll suitability;
- optional current/season signal;
- evidence quality.

Prototype:

```text
Opportunity =
  0.45*PFZ +
  0.25*SSTSuitability +
  0.20*ChlSuitability +
  0.10*OtherSignal
```

If no validated species-specific model exists, call this a **relative opportunity score**, not "probability of catching fish".

---

# 3. Route Cost

For route `r`:

```text
Cost(r) =
  α * normalizedDistance +
  β * meanRisk +
  γ * maxRisk +
  δ * restrictedPenalty +
  ε * uncertainty
```

Suggested prototype priority:
- safety must dominate distance;
- restricted-zone penalty should effectively be infinite for forbidden zones.

---

# 4. Decision rule

```text
1. Reject hard-gate failures.
2. Require minimum evidence confidence.
3. Rank remaining zones by:
   utility = opportunity - safetyPenalty - travelPenalty.
4. Generate route candidates for top zones.
5. Pick minimum feasible route cost.
```

---

# 5. Confidence

Confidence is based on evidence, not LLM certainty.

```text
confidence =
  coverage *
  freshness *
  sourceQuality *
  consistency
```

Where every factor is `0..1`.

Example:
- missing chlorophyll lowers coverage;
- cached 24-hour-old wave data lowers freshness;
- conflicting providers lower consistency.

---

# 6. Counterfactual explanation

Always support:

> "Why not the nearest/shortest option?"

Return a table:

| Metric | Recommended | Alternative |
|---|---:|---:|
| Distance | ... | ... |
| Safety | ... | ... |
| Opportunity | ... | ... |
| Max wave | ... | ... |
| Boundary conflict | ... | ... |
| Total route cost | ... | ... |

This is a major demo differentiator.
