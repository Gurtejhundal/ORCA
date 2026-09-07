# ORCA Hero Implementation Master Plan
## Live Ocean + Infinite Boat + Directional Hover Waves + True Liquid Glass

## Purpose

This document is the **single implementation sequence** for building the ORCA hero.

It combines and references:

1. the approved hero visual;
2. the React Bits FluidGlass integration;
3. the React Bits RippleDistortion adaptation;
4. the live ocean and infinite boat behavior;
5. the correct implementation order.

Do not build ORCA intelligence APIs first.

The immediate goal is:

> **A visually correct, smooth, interactive hero that matches the approved design before marine intelligence is layered on top.**

---

# 1. Source of Truth

Use these files as implementation references.

## Hero visual reference

```text
ORCA_Design_Language_System/REFERENCE_HERO.png
```

This is the approved visual benchmark.

The hero should preserve:

- deep-blue ocean dominating the viewport;
- top-view fisherman and boat;
- minimal transparent navigation;
- slim left tool dock;
- bottom-centered Ask ORCA bar;
- restrained PFZ markers;
- minimal restricted-area overlay;
- no unnecessary dashboard cards;
- no heavy neon glow.

---

## Liquid Glass implementation reference

```text
ORCA_REACTBITS_FLUID_GLASS_IMPLEMENTATION_V2.md
```

This defines:

- React Bits `FluidGlass`;
- `bar.glb`;
- true live transmission/refraction;
- same-scene refraction;
- transparent liquid-glass behavior;
- DOM input layered above 3D glass;
- no frozen texture;
- no fake frosted card;
- no cyan glow.

---

## Directional ocean hover-wave reference

```text
ORCA_REACTBITS_DIRECTIONAL_WAVES_IMPLEMENTATION.md
```

This defines:

- React Bits `RippleDistortion`;
- removal of circular ripple behavior;
- removal of swirl;
- directional crest waves;
- mouse-velocity response;
- wave-front propagation;
- smooth decay;
- no RGB distortion;
- no purple tint;
- ocean-only interaction.

---

# 2. Final Hero Architecture

```text
ORCA HERO
│
├── LIVE GPU OCEAN
│   │
│   ├── Base procedural waves
│   ├── Directional pointer wave deformation
│   ├── Ocean lighting
│   └── Subtle underwater depth
│
├── TOP-VIEW FISHING BOAT
│   │
│   ├── base-wave height sampling
│   ├── pitch
│   ├── roll
│   ├── tiny drift
│   └── subtle wake
│
├── MARINE VISUAL LAYERS
│   ├── PFZ markers
│   ├── routes
│   └── restricted zones
│
├── TRUE LIQUID GLASS
│   └── Ask ORCA refractive bar
│
└── NORMAL DOM UI
    ├── navigation
    ├── tool dock
    ├── Ask ORCA input
    ├── microphone
    └── send button
```

---

# 3. Main Design Rule

The visual ratio should remain approximately:

```text
85% immersive ocean
15% interface
```

Do not turn the hero into a dashboard.

The ocean is the product stage.

The interface is only an intelligence layer above it.

---

# 4. Phase 0 — Repository Preparation

Before visual implementation:

- place all ORCA design MDs under `/docs`;
- place the approved hero image under `/docs/reference`;
- inspect the current Next.js project;
- inspect existing Three.js / R3F usage;
- inspect package versions;
- check whether WebGPU is already used;
- check existing hero code;
- identify existing design-system components.

Suggested:

```text
/docs/orca/
  HERO_MASTER_PLAN.md
  FLUID_GLASS.md
  DIRECTIONAL_WAVES.md
  DESIGN_LANGUAGE.md

/docs/reference/
  REFERENCE_HERO.png
```

Do not start rewriting the project until the existing repo is inspected.

---

# 5. Phase 1 — Recreate Static Hero Composition

Build the layout first.

Do not animate yet.

## Required elements

### Background

Use a temporary high-quality ocean background or initial canvas.

### Boat

Place a top-view boat near center.

### Header

Minimal transparent navigation.

### Left tool dock

Show only:

```text
Fishing Zones
Conditions
Alerts
Route
Layers
```

### Ask ORCA bar

Bottom center.

### Initial marine overlays

Maximum:

```text
2 PFZ markers
1 restricted-area boundary
```

Do not show:

- SST card;
- wind card;
- chlorophyll card;
- minimap;
- alert dashboard;
- full analytics panel.

## Acceptance

The static page should already visually resemble:

```text
REFERENCE_HERO.png
```

before animation begins.

---

# 6. Phase 2 — Build the Live Ocean

Now replace the static ocean with a procedural GPU scene.

Recommended stack:

```text
Three.js
React Three Fiber
custom shader / TSL where appropriate
```

Do not start with complex fluid simulation.

Use multiple continuous directional waves.

Concept:

```text
waveA
+
waveB
+
waveC
+
microWave
```

All waves depend on continuously increasing time.

There must be no visible loop.

---

# 7. Shared Wave Function

Create one conceptual base ocean model:

```ts
waveSample(
  x,
  z,
  time
)
```

Return:

```ts
{
  height,
  slopeX,
  slopeZ,
  normal
}
```

The ocean and boat must share this base model.

This is mandatory.

If the boat uses unrelated CSS animation, it will look fake.

---

# 8. Phase 3 — Infinite Boat Motion

Use a top-view GLB/GLTF fishing boat.

Every frame:

```text
sample ocean under boat
      ↓
update boat Y
      ↓
calculate pitch
      ↓
calculate roll
```

Add tiny smooth drift.

Do not use:

```css
animation: bob 3s infinite;
```

There should be no visible animation restart.

The movement is mathematically continuous.

---

# 9. Boat Motion Rules

Boat movement should be subtle.

Target:

```text
small vertical movement
small pitch
small roll
tiny yaw
tiny drift
```

Avoid:

```text
large rotations
fast movement
boat travelling across the scene
game-like physics
```

The hero should remain calm.

---

# 10. Phase 4 — Directional Mouse Waves

Use:

```text
ORCA_REACTBITS_DIRECTIONAL_WAVES_IMPLEMENTATION.md
```

as the source of truth.

Install the exact React Bits source first:

```bash
npx shadcn@latest add @react-bits/RippleDistortion-TS-TW
```

Verify its dependency:

```text
ogl@^1.0.11
```

Keep the installed component unchanged for reference.

Create an ORCA-specific adaptation.

---

# 11. Do Not Ship Stock RippleDistortion Behavior

The stock component produces:

```text
circular ripple rings
```

ORCA needs:

```text
directional wave fronts
```

Remove:

```text
rings
radial ring cosine
swirl
RGB dispersion
purple tint
grayscale
```

Add:

```text
pointer direction
pointer velocity
elongated crest
crest curvature
forward propagation
smooth decay
```

---

# 12. Desired Hover Behavior

When the pointer moves:

```text
existing ocean waves
      ↓
locally bend
      ↓
small crest fronts travel
      ↓
direction follows pointer movement
```

Visual analogy:

> small tide fronts moving across the water.

Not:

> throwing a stone into a pond.

---

# 13. Pointer Interaction Model

Track:

```ts
pointerPosition
previousPointerPosition
pointerVelocity
pointerDirection
pointerSpeed
interactionStrength
```

Fast movement:

```text
slightly stronger deformation
```

Slow movement:

```text
subtle deformation
```

Clamp everything.

Do not let mouse speed create extreme waves.

---

# 14. Pointer Stop

When pointer movement stops:

```text
stop spawning new wave fronts
      ↓
existing crest travels slightly
      ↓
crest fades
      ↓
base ocean returns
```

Do not continuously generate waves under a stationary mouse.

---

# 15. Pointer Leave

On `pointerleave`:

```text
interaction strength
→ smoothly decays to 0
```

Do not hard-reset the ocean.

---

# 16. Boat Must Ignore Pointer Waves

Critical architecture:

```text
visible ocean =
base waves
+
pointer deformation
```

But:

```text
boat physics =
base waves only
```

The cursor must never throw the boat around.

---

# 17. Phase 5 — Add True React Bits Liquid Glass

Use:

```text
ORCA_REACTBITS_FLUID_GLASS_IMPLEMENTATION_V2.md
```

as the source of truth.

Install:

```bash
npx shadcn@latest add @react-bits/FluidGlass-TS-TW
```

Use:

```text
bar.glb
```

for the Ask ORCA control.

Keep the original component for reference.

Create an ORCA-specific glass bar implementation.

---

# 18. Liquid Glass Non-Negotiable

The glass must be:

```text
clear
high-transmission
live
continuously refractive
```

It must NOT be:

```text
frozen
frosted
opaque
blue-tinted
glowing
screenshot-based
```

---

# 19. Correct Liquid Glass Pipeline

```text
LIVE OCEAN FRAME
      ↓
render/current scene texture
      ↓
FluidGlass transmission material
      ↓
live refracted ocean
      ↓
sharp HTML Ask ORCA input
```

If water moves under the glass:

```text
the water must visibly continue moving
through the glass.
```

---

# 20. Glass Position vs Glass Optics

The Ask ORCA bar position is static.

```text
bar position       STATIC
bar shape          STATIC
```

But:

```text
ocean behind bar   LIVE
refraction         LIVE EVERY FRAME
```

Do not confuse:

```text
static bar position
```

with:

```text
static glass texture
```

---

# 21. Initial Liquid Glass Values

Start near:

```tsx
<MeshTransmissionMaterial
  transmission={1}
  roughness={0.01}
  ior={1.10}
  thickness={2.0}
  chromaticAberration={0.003}
  anisotropy={0.005}
  clearcoat={1}
  clearcoatRoughness={0.02}
  color="#ffffff"
/>
```

Tune only after the live refraction works.

---

# 22. Keep Ask ORCA Text as DOM

The 3D glass creates the optical surface.

The actual controls should be normal HTML:

```tsx
<form>
  <OrcaIcon />

  <input
    placeholder="Ask ORCA about the sea..."
  />

  <MicrophoneButton />
  <SendButton />
</form>
```

Do not render editable text using Three.js `<Text>`.

---

# 23. Liquid Glass and Mouse Waves Must Work Together

The intended pipeline:

```text
MOUSE
  ↓
directional ocean wave deformation
  ↓
LIVE OCEAN
  ↓
FluidGlass receives latest frame
  ↓
moving/deformed water is refracted
  ↓
Ask ORCA DOM controls stay stable
```

Do not distort the glass itself with RippleDistortion.

The ocean changes.

The glass refracts the changed ocean.

---

# 24. Phase 6 — Add Subtle Wake

Only after ocean + boat + hover waves work.

Start with:

```text
transparent wake texture
```

behind the boat.

Do not build complex foam simulation initially.

The wake should be barely noticeable.

---

# 25. Phase 7 — Add PFZ Markers

Only after the visual foundation is stable.

Initial markers:

```text
◎ PFZ-01
  12.4 km

◎ PFZ-02
  18.7 km
```

Keep markers restrained.

Avoid:

```text
large glowing radar circles
constant pulsing
big card labels
```

---

# 26. Phase 8 — Add Restricted Zone

Use thin boundary line.

Example:

```text
- - - - - - - -
 Restricted Area
```

Use a low-opacity fill only if needed.

Do not paint half the ocean red.

---

# 27. Phase 9 — Add Route Geometry

After ORCA intelligence exists:

```text
boat
  ↓
recommended route
  ↓
PFZ
```

Styles:

```text
recommended → solid
alternative → dashed
rejected    → warning
```

---

# 28. Phase 10 — Add Ask ORCA State

Hero states:

```ts
type HeroState =
  | 'idle'
  | 'analysing'
  | 'result'
  | 'warning'
  | 'error';
```

---

# 29. Idle State

Show:

```text
ocean
boat
nav
tool dock
Ask ORCA bar
minimal PFZ hints
```

Keep it quiet.

---

# 30. Analysing State

After question:

```text
Ask ORCA
      ↓
small analysis indicator
      ↓
relevant layers appear
```

Possible:

```text
Checking sea conditions...
Finding fishing zones...
Comparing route safety...
```

Do not fake arbitrary loading delays.

---

# 31. Result State

Show:

```text
recommended PFZ
route
safety
fishing opportunity
confidence
2–4 reasons
```

Use a compact contextual glass panel.

Do not replace the hero with a dashboard.

---

# 32. Do Not Connect Live APIs Yet

Before marine APIs:

the following must work:

```text
✓ static hero composition
✓ live procedural ocean
✓ infinite boat motion
✓ directional mouse waves
✓ true liquid glass
✓ responsive layout
✓ stable frame rate
```

If this foundation is weak, adding APIs will only make debugging harder.

---

# 33. First Major Milestone

The first major milestone is complete when the hero does this:

```text
user opens page
      ↓
living ocean is already moving
      ↓
top-view boat floats endlessly
      ↓
mouse bends nearby wave field
      ↓
wave fronts propagate and fade
      ↓
Ask ORCA glass stays clear
      ↓
moving ocean remains visible
through the glass
```

No marine API is required for this milestone.

---

# 34. Performance Target

Desktop:

```text
60 FPS ideal
45+ FPS minimum acceptable for Gateway
```

Do not chase visual complexity below this.

---

# 35. Quality Tiers

## High

```text
full procedural waves
full pointer interaction
high geometry
boat wake
live glass
```

## Medium

```text
reduced ocean geometry
fewer wave systems
reduced DPR
live glass retained
```

## Low

```text
simpler waves
lower DPR
no underwater effects
simpler wake
```

Do not remove the core interaction before removing decorative effects.

---

# 36. DPR

Clamp device pixel ratio.

Do not render automatically at extreme Retina DPR.

Start around:

```text
max DPR 1.5–2
```

then profile.

---

# 37. Mobile

Mobile has no hover.

Use:

```text
ambient ocean
boat movement
liquid glass
Ask ORCA
```

Do not require mouse-wave interaction on touch devices.

Optional:

```text
small drag deformation
```

only if it remains stable.

---

# 38. Reduced Motion

Respect:

```text
prefers-reduced-motion
```

Reduce:

- wave amplitude;
- boat rotation;
- route animation;
- sonar effects.

Disable mouse-generated directional waves if necessary.

---

# 39. Failure Fallbacks

## If WebGPU fails

Use:

```text
WebGL
```

## If advanced ocean renderer fails

Use:

```text
lighter procedural ocean
```

## If all GPU rendering fails

Use:

```text
high-quality ocean fallback
```

The Ask ORCA product must remain usable.

---

# 40. What Not to Build Yet

Do not spend time on:

- authentication;
- user profiles;
- admin dashboard;
- historical analytics;
- voice processing;
- alert subscriptions;
- researcher dashboard;
- authority dashboard;
- complex database work.

First finish the hero foundation.

---

# 41. Visual Do Nots

Never introduce:

```text
cyan outer glow
purple gradient
huge glass cards
dashboard grid
giant PFZ markers
side-view fisherman
game HUD
RGB distortion
whirlpool mouse effect
circular ripple rings
frozen glass
heavy frost
opaque navy glass
```

Compare continuously with:

```text
REFERENCE_HERO.png
```

---

# 42. Suggested Final File Structure

```text
components/
├── hero/
│   ├── OrcaHero.tsx
│   ├── OceanScene.tsx
│   ├── OceanSurface.tsx
│   ├── PointerWaveController.tsx
│   ├── FishingBoat.tsx
│   ├── BoatWake.tsx
│   ├── MarineOverlays.tsx
│   ├── PfzMarker.tsx
│   ├── RouteLayer.tsx
│   └── RestrictedLayer.tsx
│
├── ui/
│   ├── OrcaFluidGlassBar.tsx
│   ├── AskOrcaBar.tsx
│   └── ToolDock.tsx
│
└── react-bits/
    ├── FluidGlass/
    └── RippleDistortion/

lib/
├── ocean/
│   ├── waveModel.ts
│   ├── pointerWaves.ts
│   └── quality.ts
│
└── marine/
    └── projection.ts

public/
└── assets/
    └── 3d/
        └── bar.glb

docs/
└── reference/
    └── REFERENCE_HERO.png
```

---

# 43. Codex Master Kickoff Prompt

```text
We are now implementing the ORCA hero.

Before writing code, read:

1. this master implementation document;
2. ORCA_REACTBITS_FLUID_GLASS_IMPLEMENTATION_V2.md;
3. ORCA_REACTBITS_DIRECTIONAL_WAVES_IMPLEMENTATION.md;
4. the ORCA design-language documentation;
5. REFERENCE_HERO.png.

REFERENCE_HERO.png is the primary visual target.

DO NOT START WITH MARINE APIs.

The first milestone is:

LIVE PROCEDURAL OCEAN
+
TOP-VIEW BOAT
+
INFINITE NATURAL BOAT MOTION
+
DIRECTIONAL MOUSE WAVE DEFORMATION
+
TRUE LIVE REACT BITS LIQUID GLASS
+
STATIC HERO UI COMPOSITION

IMPLEMENTATION ORDER

PHASE 1
Inspect repository.

Report:
- framework/version;
- Three.js/R3F versions;
- renderer currently used;
- current hero files;
- existing React Bits components;
- current FluidGlass status;
- current RippleDistortion status;
- any WebGPU/WebGL conflict.

Do not modify code before inspection.

PHASE 2
Recreate static hero composition matching REFERENCE_HERO.png.

No animations yet.

PHASE 3
Implement procedural ocean with multiple continuous wave systems.

There must be no visible loop.

PHASE 4
Add top-view boat.

Boat height, pitch and roll must come from the base ocean wave model.

Do not use CSS bob animation.

PHASE 5
Install and verify React Bits RippleDistortion TS-TW.

Keep original component unchanged.

Create ORCA-specific directional wave implementation.

Remove:
- circular rings
- swirl
- RGB dispersion
- tint
- grayscale

Add:
- pointer direction
- pointer velocity
- elongated wave crests
- mild curvature
- forward propagation
- smooth decay

The visual must resemble small tide/wave fronts, not pond ripples.

PHASE 6
Integrate pointer-wave behavior into the live ocean.

The visible ocean is:

base ocean
+
pointer wave deformation

The boat uses:

base ocean only

Mouse movement must not throw the boat around.

PHASE 7
Install/verify React Bits FluidGlass TS-TW.

Use bar.glb.

Build ORCA-specific static Ask ORCA glass bar.

The bar must:
- remain fixed;
- be highly transparent;
- use real transmission/refraction;
- update refraction every frame;
- show the moving ocean through it;
- never use a frozen screenshot;
- never use heavy frost;
- never add cyan glow.

Use DOM controls above the glass.

PHASE 8
Verify interaction pipeline:

mouse
→ ocean wave deformation
→ live ocean changes
→ FluidGlass refracts latest ocean
→ Ask ORCA DOM UI remains stable

If the pointer changes water underneath the bar, that changed water must
be visible through the glass immediately.

PHASE 9
Add subtle wake.

PHASE 10
Add minimal PFZ markers and restricted-area overlay.

Do not add unnecessary widgets.

PHASE 11
Responsive/performance pass.

Target:
60 FPS ideal
45+ FPS acceptable

Add:
- DPR clamp
- quality levels
- mobile reduction
- reduced-motion support
- renderer fallback

AFTER EVERY PHASE

- typecheck;
- lint;
- test;
- run app;
- visually inspect;
- report files changed;
- report actual limitations.

Do not claim a visual feature works unless it has been rendered/tested.

NON-NEGOTIABLE DESIGN RULES

- ocean dominates;
- boat is top-view;
- no side/rear fisherman;
- no circular mouse ripples;
- no whirlpool;
- no neon cyan glow;
- no dashboard grid;
- no frozen liquid glass;
- no static screenshot inside glass;
- no fake frosted rectangle;
- no unnecessary widgets.

The immediate goal is not feature count.

The goal is a visually correct, smooth ORCA hero foundation matching
REFERENCE_HERO.png.
```

---

# 44. Final Definition of Done

The hero foundation is done only if all are true:

```text
[ ] composition matches approved reference closely
[ ] ocean continuously moves
[ ] no obvious ocean animation loop
[ ] boat is top-view
[ ] boat floats endlessly
[ ] boat motion is based on ocean waves
[ ] mouse modifies existing wave field
[ ] no circular ripple rings
[ ] wave crests travel directionally
[ ] pointer influence fades naturally
[ ] liquid glass is truly transparent/transmissive
[ ] ocean remains live through the glass
[ ] no frozen FBO/frame
[ ] no cyan glow
[ ] Ask ORCA controls remain sharp and usable
[ ] responsive layout works
[ ] mobile fallback works
[ ] performance is acceptable
```

Only after this checklist passes should ORCA marine data and agent intelligence be connected.
