# Hero Exact Specification

## Goal

Recreate the composition and visual balance of `REFERENCE_HERO.png` as closely as practical.

## Scene

Full-viewport ocean background.

### Camera
- top-down or near-top-down;
- slight perspective only if needed for depth;
- fisherman and boat centered;
- boat visually small relative to ocean;
- no cinematic rear-view silhouette;
- no close-up fisherman.

### Ocean
- deep blue;
- realistic wave texture;
- subtle underwater depth;
- mild specular highlights;
- no exaggerated foam;
- no tropical turquoise;
- no giant dramatic wave peaks.

### Boat
- centered;
- small fishing vessel;
- modest wake;
- natural shadow;
- should feel physically part of the ocean.

## Top navigation

Left:
- ORCA logo
- brand name

Center:
- Home
- Capabilities
- Use Cases
- Data Sources
- About

Right:
- language selector
- optional account button

Keep header transparent and lightweight.

## Left tool dock

Floating vertical liquid-glass rail.

Items:
- Fishing Zones
- Conditions
- Alerts
- Route
- Layers

Rules:
- small;
- icon-led;
- no oversized labels;
- no glow halo;
- one active state only;
- subtle glass blur and edge.

## Ocean intelligence

Only contextual overlays.

Default visible:
- 1–2 PFZ markers;
- one restricted-area boundary;
- very subtle route or connection;
- no permanent full-size data cards.

PFZ marker structure:

```text
◎ PFZ-01
  12.4 km
```

Restricted area:
- subtle red/dark boundary;
- no large fill;
- avoid alarm-heavy styling unless actually active.

## Ask ORCA bar

Primary UI.

Position:
- centered;
- close to bottom;
- width roughly 42–52% desktop viewport.

Contents:
- small ORCA icon;
- placeholder;
- microphone;
- send.

Text:
`Ask ORCA about the sea...`

Below:
- 2–3 optional suggestion chips.

Rules:
- glass, not glowing pill;
- high transparency;
- visible ocean underneath;
- soft blur;
- crisp edge;
- subtle refraction;
- no strong cyan outline.

## Default-state information density

The hero must remain calm.

Maximum:
- top nav;
- left tool dock;
- 2 PFZ markers;
- 1 restricted boundary;
- 1 query bar;
- 3 quick-prompt chips.

Anything beyond this requires a user interaction.
