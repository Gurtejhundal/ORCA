# Responsive Rules

## Desktop

Keep full immersive composition.

- ocean dominates;
- boat centered;
- left dock visible;
- question bar bottom center;
- contextual overlays around boat.

## Tablet

Reduce:
- nav items;
- overlay labels;
- PFZ count;
- sidebar width.

Keep:
- ocean;
- boat;
- question bar;
- 3–4 tools.

## Mobile

Do not compress desktop hero.

Use a mobile-specific composition:

- full-screen ocean;
- boat centered;
- top minimal logo;
- no full top nav;
- bottom question bar;
- tool dock becomes compact floating rail/button;
- result becomes bottom sheet;
- max 1 PFZ marker until interaction.

## Mobile priority

```text
Ocean
Boat
Question
Recommendation
Route
Evidence
```

## Glass on mobile

Use slightly more opacity because small text over water needs contrast.

## Performance

Reduce:
- wave shader complexity;
- water interaction radius;
- number of live overlays;
- blur radius.
