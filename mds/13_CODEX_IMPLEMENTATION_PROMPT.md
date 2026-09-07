# Codex Design Implementation Prompt

```text
You are implementing the ORCA website design system.

Before coding, read every design document in this folder and inspect
REFERENCE_HERO.png.

REFERENCE_HERO.png is the primary visual benchmark.

PRIMARY GOAL

Recreate the hero composition as closely as practical:

- full-screen deep blue realistic ocean
- top-down fisherman in a small fishing boat
- large uninterrupted water surface
- minimal transparent top navigation
- compact vertical liquid-glass tool dock on the left
- large bottom-centered Ask ORCA question bar
- only 1–2 PFZ targets visible by default
- subtle restricted-area boundary
- contextual route/data overlays
- no dashboard cards
- no unnecessary widgets
- no neon glow

DESIGN LANGUAGE

The entire website must inherit:

- immersive ocean-first layouts
- restrained Apple-like liquid glass
- high transparency
- subtle blur/refraction
- thin borders
- low-glow surfaces
- calm typography
- large negative space
- geospatial overlays
- slow environmental motion

DO NOT build a generic glassmorphism dashboard.

LIQUID GLASS

The glass must feel physically plausible:

- ocean visible through it
- controlled backdrop blur
- subtle edge highlight
- slight internal reflection
- no cyan outer glow
- no opaque blue card surfaces

HERO MOTION

Implement a performant live-water effect.

The water should react locally to pointer movement:
- subtle ripples
- slight distortion
- short decay
- limited radius

Do not create a game-like water simulation.

The boat should:
- bob gently
- remain top-down
- create a subtle wake

DEFAULT HERO UI

Visible:
- ORCA branding
- minimal navigation
- left dock
- Ask ORCA bar
- max 2 PFZ markers
- one restricted-area boundary

Hidden until relevant:
- SST
- chlorophyll
- wind
- wave cards
- alert panels
- detailed route analysis
- extra map layers

When a user asks a question, progressively reveal only the relevant intelligence.

WEBSITE-WIDE RULE

Do not turn later sections into card grids.

Use:
- editorial layouts
- large visuals
- marine maps
- thin dividers
- contextual glass
- open space

IMPLEMENTATION ORDER

1. inspect current project
2. establish design tokens
3. implement reusable liquid-glass primitive
4. implement hero layout
5. implement ocean scene
6. implement boat
7. implement cursor-water interaction
8. implement tool dock
9. implement query bar
10. implement contextual PFZ/restricted overlays
11. implement responsive behavior
12. extend design language to the rest of the website

QUALITY CHECK

Before declaring the hero complete, compare it against REFERENCE_HERO.png.

Ask:
- Is the ocean still the dominant visual?
- Is the boat top-down?
- Is the UI quieter than the background?
- Is there unnecessary glow?
- Are there unnecessary widgets?
- Does the glass look optical rather than like a blue translucent card?
- Would this still look designed if all animations stopped?

If not, continue refining.

Do not sacrifice visual restraint for feature density.
```
