# Accuracy and evaluation scope

**Real-world accuracy: not measured. Requested target: 99%. No trained model or independently labelled real-world evaluation set exists in this repository.**

Unit-test pass rates and acceptance-case pass counts demonstrate that code follows the specified fixture rules. They do not measure fishing outcomes, forecast skill, safe voyages or general natural-language understanding.

The file data/demo/evaluation-cases.json contains implementation-authored acceptance labels. These cases were used during development. They are neither held out nor representative of real marine stakeholders. The evaluation command checks response type, selected zone, decision status, synthetic evidence labels and numerical claims. The report preserves the measured results without converting them into a marine accuracy claim.

## Before claiming 99%

Define and assess separate tasks:

| Task | Evaluation evidence |
|---|---|
| Intent, location and time extraction | Independently annotated queries, including ambiguity, dialect and unsupported requests |
| Numerical/data retrieval correctness | Provider responses compared against normalized units, forecast cells, timestamps and evidence citations |
| Fishing opportunity | Real advisory or catch outcomes, with independent spatial/temporal holdout and appropriate baselines |
| Hazard/route decisions | Expert-labelled scenarios, verified GIS data, vessel context and critical false-negative analysis |
| Explanation support | Every numeric/source/location claim linked to a returned record or deterministic calculation |
| Refusal and missing data | Deliberate stale, conflicting, inaccessible and incomplete-source cases |

Use a predeclared test protocol and blind labels that are not exposed to development. Split by time and location where leakage is possible. Report per-task accuracy or regression errors, sample sizes, coverage/abstention rates, failure severity and statistical uncertainty. An aggregate score can hide dangerous false negatives.

No minimum sample count or safety-certification claim is inferred from the current synthetic acceptance suite. Evidence confidence in the dashboard is an input-quality score, not a probability that the answer is correct.
