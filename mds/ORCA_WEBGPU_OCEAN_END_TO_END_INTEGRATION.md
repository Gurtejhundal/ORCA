# ORCA WebGPU Ocean Hero — End-to-End Integration Guide
## Interactive Procedural Waves + Infinite Boat Motion + Liquid Glass UI

## Goal

Build the ORCA hero as a **living ocean simulation**, not a looping background video.

The final hero must provide:

- procedural ocean waves that run continuously;
- mouse-hover interaction that **bends and pushes existing waves**, not circular ripples;
- a fisherman/boat viewed from the top;
- continuous natural boat bobbing, pitch, roll and tiny drift;
- a subtle boat wake;
- PFZ, routes and restricted-zone overlays;
- liquid-glass HTML interface above the GPU canvas;
- graceful WebGL fallback;
- high performance suitable for a live SIH Gateway demo.

The visual reference remains:

> Deep blue ocean + top-view fisherman + minimal ORCA UI + contextual marine intelligence.

---

# 1. Recommended Stack

## Application

- Next.js
- TypeScript
- React

## 3D / GPU

- Three.js
- WebGPURenderer
- TSL (Three Shading Language)

Use WebGPU where available and retain a WebGL-compatible fallback.

## UI

- HTML / React
- CSS
- backdrop-filter
- Framer Motion or GSAP

Do **not** render normal UI controls inside WebGPU.

## Data overlays

- GeoJSON
- ORCA API
- Marine data adapters

---

# 2. Final Hero Architecture

```text
Hero
│
├── GPU Scene
│   ├── OceanSurface
│   │   ├── base procedural waves
│   │   ├── directional wave layers
│   │   ├── pointer influence
│   │   ├── surface normals
│   │   └── lighting/reflections
│   ├── FishingBoat
│   │   ├── position from waveHeight()
│   │   ├── pitch from wave slope
│   │   ├── roll from wave slope
│   │   ├── slow yaw drift
│   │   └── wake
│   ├── PFZMarkers
│   ├── RouteLines
│   ├── RestrictedZones
│   └── Optional underwater elements
│
├── Interaction Controller
│   ├── pointer position
│   ├── pointer velocity
│   ├── pointer direction
│   ├── interaction strength
│   └── decay
│
├── ORCA State
│   ├── idle
│   ├── analysing
│   ├── result
│   └── alert
│
└── DOM Interface
    ├── Navbar
    ├── LiquidGlassToolDock
    ├── AskORCA
    ├── QuickPrompts
    └── ContextualResultSheet
```

---

# 3. Repository Structure

```text
apps/web/
├── app/
│   └── page.tsx
├── components/
│   ├── hero/
│   │   ├── OrcaHero.tsx
│   │   ├── OceanCanvas.tsx
│   │   ├── OceanSurface.tsx
│   │   ├── FishingBoat.tsx
│   │   ├── BoatWake.tsx
│   │   ├── MarineOverlay.tsx
│   │   ├── PfzMarker.tsx
│   │   ├── RouteLayer.tsx
│   │   ├── RestrictedLayer.tsx
│   │   └── HeroEnvironment.tsx
│   ├── ui/
│   │   ├── LiquidGlass.tsx
│   │   ├── AskOrcaBar.tsx
│   │   ├── ToolDock.tsx
│   │   └── ResultSheet.tsx
│   └── marine/
│       └── MarineDataProvider.tsx
├── lib/
│   ├── webgpu/
│   │   ├── createRenderer.ts
│   │   ├── waveModel.ts
│   │   ├── pointerInteraction.ts
│   │   └── deviceSupport.ts
│   ├── marine/
│   │   ├── coordinates.ts
│   │   ├── projection.ts
│   │   └── types.ts
│   └── performance/
│       └── quality.ts
├── shaders/
│   └── ocean/
│       ├── oceanMaterial.ts
│       └── waveParameters.ts
├── public/
│   └── models/
│       └── fishing-boat.glb
└── styles/
    └── liquid-glass.css
```

---

# 4. Rendering Strategy

At startup:

```text
Browser loads hero
      ↓
Check WebGPU support
      ↓
YES → WebGPURenderer
NO  → WebGL fallback
```

Keep renderer-specific creation in one module:

```ts
createOrcaRenderer()
```

The rest of the hero should not care which backend is being used.

---

# 5. Ocean Surface

Use a large subdivided plane:

```text
PlaneGeometry
      ↓
vertex displacement
      ↓
procedural ocean surface
```

Do not begin with extreme subdivision. Increase geometry only after profiling.

---

# 6. Base Procedural Ocean

The ocean should never visibly loop.

Use continuous time-driven wave functions:

```text
height =
    waveA(x,z,time)
  + waveB(x,z,time)
  + waveC(x,z,time)
  + microWave(x,z,time)
```

Each wave needs different:

- direction;
- wavelength;
- amplitude;
- speed;
- steepness.

Avoid a single sine-wave animation.

---

# 7. Gerstner-Style Wave Model

A Gerstner-style model is appropriate for rolling ocean waves.

For each wave:

```text
phase =
    dot(direction, position)
    * frequency
    + time * speed
```

Conceptually:

```text
X += direction.x * steepness * amplitude * cos(phase)
Z += direction.y * steepness * amplitude * cos(phase)
Y += amplitude * sin(phase)
```

Combine several wave systems.

Suggested starting layers:

```text
Wave A  large / slow / diagonal
Wave B  medium / perpendicular
Wave C  small / faster
Micro   low-amplitude variation
```

---

# 8. Central Wave Model

Create one shared conceptual ocean model:

```ts
waveSample(x, z, time)
```

It should return:

```ts
{
  height,
  slopeX,
  slopeZ,
  normal
}
```

Ocean rendering and boat movement must share the same base wave parameters.

---

# 9. Infinite Boat Motion

Do not use a fixed CSS loop.

Every frame:

```text
time continuously increases
        ↓
sample base ocean under boat
        ↓
boat height changes
        ↓
boat pitch/roll changes
```

Conceptually:

```ts
const sample = waveSample(
  boatX,
  boatZ,
  elapsedTime
);

boat.position.y = sample.height;
```

Because `elapsedTime` continuously increases, the movement does not visibly restart.

---

# 10. Boat Pitch and Roll

Sample the ocean around the boat:

```text
        front

left   center   right

        back
```

Then derive orientation:

```ts
pitch = frontHeight - backHeight;
roll  = rightHeight - leftHeight;
```

Smooth all movement with interpolation.

Never snap directly to raw calculated rotations.

---

# 11. Slow Endless Drift

Add extremely small, slow positional drift:

```text
boatX = baseX + slowNoise(time) * driftAmount
boatZ = baseZ + slowNoise(time + offset) * driftAmount
```

Add tiny yaw variation.

The boat should appear to drift naturally while remaining inside the hero composition.

---

# 12. Pointer Interaction

The pointer must **not** create circular ripples.

Desired behavior:

```text
normal ocean waves
        ↓
mouse moves across surface
        ↓
nearby wave orientation/amplitude shifts
        ↓
waves lean/push in pointer direction
        ↓
effect decays smoothly
```

Track:

```ts
pointerPosition
previousPointerPosition
pointerVelocity
pointerDirection
interactionStrength
```

---

# 13. Convert Pointer to Ocean Coordinates

Flow:

```text
pointer screen position
      ↓
normalized device coordinates
      ↓
camera ray
      ↓
ray-plane intersection
      ↓
ocean world coordinate
```

Use the resulting position as `mouseOceanPosition`.

---

# 14. Local Wave Influence

For each ocean vertex:

```text
distance = length(vertexXZ - mouseXZ)
```

Then use a soft falloff:

```text
influence = smoothstep(radius, 0, distance)
```

The boundary should never look circular or sharply cut.

---

# 15. Directional Wave Deformation

Instead of a radial ripple formula, use mouse direction.

Conceptually:

```text
directionalPhase =
dot(
  vertexXZ - mouseXZ,
  mouseDirection
)
```

Then:

```text
mouseWave =
sin(directionalPhase * frequency + time * speed)
* influence
* mouseStrength
```

The existing wave field should visually bend or push with pointer motion.

---

# 16. Pointer Velocity

Pointer speed may slightly increase deformation strength:

```text
slow cursor → subtle wave deformation
fast cursor → slightly stronger deformation
```

Clamp aggressively.

Do not allow spikes or game-like splashes.

---

# 17. Interaction Decay

When pointer movement stops:

```text
mouseStrength → smoothly approaches 0
```

Use frame-independent damping.

The ocean should naturally settle back into its base procedural motion.

---

# 18. Boat Must Ignore Pointer Waves

This separation is deliberate.

```text
Ocean rendering =
BaseWaves + PointerInfluence
```

But:

```text
Boat movement =
BaseWaves only
```

This prevents the fisherman from jumping when the user moves the cursor.

---

# 19. Boat Wake

Gateway-safe implementation order:

1. transparent wake texture behind boat;
2. shader trail if time permits;
3. procedural foam only if performance remains strong.

Start simple.

---

# 20. Camera

Use a near-top-down perspective.

Avoid:

- side-view fisherman;
- rear-view cinematic boat;
- third-person game camera;
- horizon-heavy composition.

A slight perspective angle is enough to preserve wave depth.

---

# 21. Liquid Glass Layer

Keep UI outside the GPU scene:

```tsx
<section className="hero">
  <OceanCanvas />
  <Navbar />
  <ToolDock />
  <AskOrcaBar />
  <ResultSheet />
</section>
```

This keeps the interface accessible and maintainable.

---

# 22. Liquid Glass Rules

Use:

- high transparency;
- controlled backdrop blur;
- subtle border;
- subtle internal highlight;
- weak shadow;
- optional low-strength refraction.

Avoid:

- cyan glow;
- thick blue borders;
- opaque navy cards;
- glowing icons everywhere.

---

# 23. PFZ Integration

Default state:

```text
ocean
boat
query bar
tool dock
```

After a fishing query:

```text
PFZ-01
PFZ-02
```

Use minimal target markers:

```text
◎ PFZ-02
  18.4 km
```

---

# 24. Route Integration

When ORCA chooses a target:

```text
boat
  ↓
route draws
  ↓
PFZ
```

States:

```text
recommended → solid
alternative → dashed
rejected    → warning style
```

---

# 25. Restricted Areas

Use real or clearly labelled demo GeoJSON.

Display:

- thin boundary;
- subtle fill;
- compact label.

Do not permanently fill huge portions of the ocean with bright red.

---

# 26. ORCA Query Flow

```text
User question
      ↓
AskORCA
      ↓
ORCA backend
      ↓
Planner
      ↓
Marine data
      ↓
PFZ candidates
      ↓
Decision engine
      ↓
Recommended zone + route
      ↓
Hero visual state updates
```

---

# 27. Hero State Machine

```ts
type HeroState =
  | "idle"
  | "analysing"
  | "result"
  | "warning"
  | "error";
```

## Idle

Show only:
- ocean;
- boat;
- question bar;
- minimal controls.

## Analysing

Show:
- subtle sonar pulse;
- task progress;
- relevant layers appearing.

## Result

Show:
- selected PFZ;
- route;
- compact evidence;
- liquid-glass result panel.

---

# 28. Live Marine Data

Interactive water and live marine data are different systems.

Keep them separate:

```text
Marine Provider
    ↓
ORCA API
    ↓
normalized evidence
    ↓
frontend state
    ↓
PFZ / route / warning overlays
```

Do not couple live API calls to shader rendering.

---

# 29. Coordinate Mapping

Create a dedicated projection layer:

```ts
geoToWorld(lat, lon)
worldToGeo(x, z)
```

Do not duplicate mapping logic across PFZ, routes and boundaries.

---

# 30. Performance Tiers

## High

- WebGPU
- higher ocean subdivision
- full pointer deformation
- wake
- subtle underwater effects

## Medium

- WebGPU or WebGL
- reduced geometry
- fewer wave layers
- pointer deformation retained

## Low

- reduced DPR
- simpler ocean
- simplified wake
- no underwater effects

---

# 31. DPR

Clamp device pixel ratio.

Do not blindly render at native Retina resolution.

A maximum around `1.5–2` is a sensible starting point, then profile.

---

# 32. Performance Goal

Target:

```text
60 FPS ideal
45+ FPS acceptable for Gateway prototype
```

Measure actual frame performance before adding more effects.

---

# 33. Mobile Strategy

Mobile should use:

- fewer wave layers;
- lower geometry density;
- lower DPR;
- simpler wake;
- no hover interaction;
- simpler overlay count.

Touch devices do not need cursor-driven wave deformation.

---

# 34. Reduced Motion

Respect:

```text
prefers-reduced-motion
```

Reduce or disable:

- pointer deformation;
- strong boat roll;
- sonar sweep;
- route animation.

---

# 35. Boat Asset Rules

Use a low-to-medium polygon GLB with a strong top-view silhouette.

Avoid:
- huge models;
- photogrammetry;
- detailed interiors;
- giant textures.

The camera will not see most of that detail.

---

# 36. Loading Strategy

Do not show a blank hero.

Use:

```text
lightweight ocean fallback
      ↓
UI available immediately
      ↓
GPU scene initializes
      ↓
boat model loads
      ↓
full experience activates
```

---

# 37. Failure Strategy

```text
WebGPU fails
   ↓
WebGL fallback

3D fails
   ↓
static/looping ocean fallback

ORCA chatbot
   ↓
still functional
```

The visual effect must never become a single point of failure.

---

# 38. Testing Checklist

## Ocean

- [ ] waves continuously move;
- [ ] no obvious loop;
- [ ] pointer modifies existing waves;
- [ ] no circular ripple behavior;
- [ ] interaction decays;
- [ ] no large wave spikes.

## Boat

- [ ] top-view;
- [ ] continuously floats;
- [ ] follows base waves;
- [ ] subtle pitch;
- [ ] subtle roll;
- [ ] slow drift;
- [ ] no visible reset;
- [ ] ignores pointer deformation.

## UI

- [ ] liquid glass stays readable;
- [ ] no unnecessary glow;
- [ ] question bar is responsive;
- [ ] canvas does not block UI interactions.

## ORCA

- [ ] PFZ coordinates affect marker position;
- [ ] route changes from structured data;
- [ ] restricted areas render from geometry;
- [ ] a new query can alter the selected PFZ.

---

# 39. Implementation Phases

## Phase 1 — GPU Foundation

Build:

```text
renderer
camera
ocean plane
lighting
```

Acceptance:

```text
stable ocean scene
```

## Phase 2 — Procedural Waves

Build:

```text
multi-wave model
continuous time
surface displacement
```

Acceptance:

```text
ocean feels endless
```

## Phase 3 — Boat

Build:

```text
GLB boat
wave sampling
height
pitch
roll
drift
```

Acceptance:

```text
boat feels physically attached to ocean
```

## Phase 4 — Pointer Wave Interaction

Build:

```text
raycast pointer
velocity
direction
soft local influence
directional wave deformation
decay
```

Acceptance:

```text
hover bends nearby existing waves without ripples
```

## Phase 5 — Wake

Build a subtle boat trail.

## Phase 6 — Liquid Glass

Build:

```text
navbar
tool dock
Ask ORCA
```

## Phase 7 — ORCA Overlays

Build:

```text
PFZ
routes
restricted zones
labels
```

## Phase 8 — Query Integration

Build:

```text
Ask ORCA
backend request
hero state
analysis feedback
result
```

## Phase 9 — Performance

Build:

```text
quality tiers
DPR clamp
mobile optimization
fallbacks
```

---

# 40. Codex Master Integration Prompt

```text
Implement the ORCA interactive ocean hero according to this specification.

PRIMARY REQUIREMENT

The hero must use a procedural GPU-driven ocean.

The water must move continuously with no visible looping animation.

The mouse interaction must NOT create circular ripples.

Instead, pointer movement should locally modify the existing wave field:
- track pointer position;
- track pointer velocity;
- track pointer direction;
- raycast the pointer to ocean/world coordinates;
- apply a soft local influence around that position;
- deform wave direction/amplitude using pointer direction;
- make faster pointer movement slightly stronger;
- smoothly decay interaction when movement stops.

Use Three.js WebGPURenderer and TSL where appropriate, while maintaining
a WebGL-compatible fallback.

BOAT

Use a top-view fishing boat GLB.

Do not animate it with CSS or a fixed repeating animation.

Boat motion must be derived from the same base procedural ocean model.

Every frame:
- sample base wave height under boat;
- calculate subtle pitch;
- calculate subtle roll;
- add tiny smooth drift;
- add tiny yaw movement;
- interpolate all movement to avoid jitter.

IMPORTANT:
The boat must respond only to BASE environmental waves.
It must NOT respond to pointer-generated visual wave deformation.

OCEAN MODEL

Create a reusable wave model based on multiple directional procedural waves.

Expose a conceptual sampling function:

waveSample(x, z, time)

returning:

height
slopeX
slopeZ
normal

The rendering and boat systems must share the same base wave parameters.

UI

Keep all standard UI outside the GPU canvas:

- Navbar
- LiquidGlassToolDock
- AskOrcaBar
- ResultSheet

Do not render text controls inside WebGPU.

Maintain the ORCA visual language:
- ocean dominant
- no unnecessary widgets
- no neon cyan glow
- restrained liquid glass
- high transparency
- subtle border
- subtle blur/refraction
- minimal overlays

ORCA DATA

Support structured marine overlays:
- PFZ markers
- recommended route
- alternative route
- restricted areas
- relevant evidence labels

Keep marine data retrieval independent from ocean simulation.

Use a geoToWorld() abstraction for lat/lon → scene coordinates.

PERFORMANCE

Implement:
- DPR clamp
- quality levels
- reduced geometry for low-end/mobile
- prefers-reduced-motion
- WebGPU → WebGL fallback
- static fallback if rendering completely fails

IMPLEMENT IN PHASES.

Before coding:
1. inspect the current repository;
2. identify current Three.js/React architecture;
3. identify existing hero implementation;
4. identify reusable liquid-glass components;
5. identify conflicts with this specification;
6. provide an implementation plan.

Then execute:

Phase 1 renderer + ocean
Phase 2 procedural waves
Phase 3 boat wave-following
Phase 4 pointer directional deformation
Phase 5 wake
Phase 6 liquid-glass UI integration
Phase 7 marine overlays
Phase 8 ORCA query integration
Phase 9 performance/fallback

After every phase:
- typecheck;
- run relevant tests;
- verify current hero still works;
- report actual implementation status.

Do not claim WebGPU or fallback works unless tested.
```

---

# 41. Critical Rules

1. Interactive ocean and marine data are separate systems.
2. Pointer movement reshapes **existing waves**; it does not create ripple rings.
3. Boat movement is infinite because it is time-driven and procedural.
4. Boat follows base environmental waves only.
5. UI stays DOM-based.
6. WebGPU enhancement must never break the ORCA product.
7. Performance matters more than adding another visual effect.

---

# Final Expected Experience

On load:

```text
deep living ocean
       ↓
small top-view fisherman
       ↓
boat continuously floating
       ↓
minimal liquid-glass ORCA interface
```

On pointer movement:

```text
cursor moves
       ↓
nearby existing waves subtly bend/push
       ↓
ocean smoothly returns to base motion
```

On query:

```text
"Where should I fish today?"
       ↓
ORCA analyses marine data
       ↓
PFZ targets appear
       ↓
hazard/restricted area appears
       ↓
recommended route draws
       ↓
ORCA recommendation appears
```

The ocean never stops moving.

The boat never visibly loops.

The pointer never produces fake circular ripples.

That is the target.
