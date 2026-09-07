# ORCA Directional Hover Waves
## React Bits `RippleDistortion` Adaptation — TS-TW

## Objective

Adapt React Bits `RippleDistortion` into the ORCA ocean hero so pointer movement creates **directional ocean-wave crests**, not circular ripples.

Target interaction:

```text
NORMAL OCEAN
~~~~~~~~~~~~~~~

pointer moves →

~~~~~~~~~~~~>>>
~~~~~~~~~~~>>>>
~~~~~~~~~~>>>>>
~~~~~~~~~>>>>>>

local wave fronts bend and move
in the pointer direction
```

The effect should resemble **small tide/wave fronts travelling toward shore**, not a stone dropped into water.

The liquid-glass system is separate.

```text
POINTER
   ↓
ORCA OCEAN WAVE DEFORMATION
   ↓
LIVE OCEAN FRAME
   ↓
REACT BITS FLUID GLASS
   ↓
LIVE REFRACTION
```

Do **not** distort the liquid-glass bar itself.

---

# 1. Verified React Bits Source

Component:

```text
RippleDistortion
Variant: TS-TW
```

Docs:

```text
https://reactbits.dev/animations/ripple-distortion
```

Registry:

```text
https://reactbits.dev/r/RippleDistortion-TS-TW.json
```

Install:

```bash
npx shadcn@latest add @react-bits/RippleDistortion-TS-TW
```

The exact registry currently declares:

```text
ogl@^1.0.11
```

as its only direct dependency.

The registry description is:

```text
Pointer-driven water displacement that warps content and leaves a decaying wake.
```

The stock component uses:

```ts
Renderer
Program
Mesh
Geometry
Triangle
Texture
RenderTarget
```

from:

```ts
ogl
```

---

# 2. What the Stock Component Actually Does

The original component is a 2D GPU image-distortion effect.

Flow:

```text
source image
     ↓
OGL texture
     ↓
pointer movement
     ↓
spawn circular wave stamps
     ↓
draw stamps into displacement render target
     ↓
sample displacement texture
     ↓
distort source image
```

Important constants:

```ts
const MAX_WAVES = 100;
const START_SCALE = 1.5;
```

The stock wave fragment shader contains:

```glsl
float r = dot(p, p);

float brush =
  (exp(-r * 5.0) - EDGE)
  / (1.0 - EDGE);

brush *=
  0.55 +
  0.45 *
  cos(
    sqrt(r)
    * PI
    * 2.0
    * uRings
  );
```

This line:

```glsl
cos(sqrt(r) * ...)
```

is why the stock effect creates **concentric rings**.

For ORCA, this must be removed.

---

# 3. Stock Props

The registry currently exposes:

```ts
export interface RippleDistortionProps {
  src?: string;
  brushSize?: number;
  strength?: number;
  swirl?: number;
  rings?: number;
  spread?: number;
  fade?: number;
  spacing?: number;
  dispersion?: number;
  glint?: number;
  tint?: string;
  tintAmount?: number;
  grayscale?: boolean;
  highlightColor?: string;
  trigger?: 'hover' | 'click' | 'both';
  clickStrength?: number;
  quality?: 'low' | 'medium' | 'high';
  enabled?: boolean;
  className?: string;
  style?: CSSProperties;
}
```

For ORCA, several of these are no longer appropriate.

---

# 4. ORCA API

Create a separate component rather than destroying the installed registry source.

Recommended file:

```text
components/hero/OrcaWaveDistortion.tsx
```

Recommended props:

```ts
export interface OrcaWaveDistortionProps {
  src?: string;

  brushSize?: number;
  strength?: number;

  // Directional wave controls
  crestCount?: number;
  crestSpacing?: number;
  crestWidth?: number;
  elongation?: number;

  // Propagation
  propagation?: number;
  trailLength?: number;

  // Pointer response
  velocityInfluence?: number;
  directionSmoothing?: number;
  interactionRadius?: number;

  // Decay
  fade?: number;
  spacing?: number;

  // Optical effects
  dispersion?: number;
  glint?: number;

  quality?: 'low' | 'medium' | 'high';
  enabled?: boolean;

  className?: string;
  style?: CSSProperties;
}
```

Suggested initial values:

```ts
{
  brushSize: 180,
  strength: 0.08,

  crestCount: 3,
  crestSpacing: 0.38,
  crestWidth: 0.12,
  elongation: 2.8,

  propagation: 0.65,
  trailLength: 1.7,

  velocityInfluence: 0.8,
  directionSmoothing: 0.14,
  interactionRadius: 1,

  fade: 1.2,
  spacing: 8,

  dispersion: 0,
  glint: 0.05,

  quality: 'high',
  enabled: true
}
```

These are visual starting points.

---

# 5. Remove the Ring Model

Remove from the ORCA version:

```ts
rings
swirl
uRings
uSwirl
```

Do not use radial phase.

Delete this stock behavior:

```glsl
cos(sqrt(r) * PI * 2.0 * uRings)
```

and replace it with **directional crest coordinates**.

---

# 6. New Wave Instance Data

The stock `Wave` is:

```ts
interface Wave {
  x: number;
  y: number;
  scale: number;
  target: number;
  size: number;
  opacity: number;
}
```

For ORCA, use:

```ts
interface OrcaWave {
  x: number;
  y: number;

  dirX: number;
  dirY: number;

  scale: number;
  target: number;

  size: number;
  opacity: number;

  velocity: number;
  age: number;
}
```

Every wave instance now knows which way the pointer was moving when it was created.

---

# 7. Instanced Geometry Changes

Add a direction attribute:

```ts
const directions =
  new Float32Array(MAX_WAVES * 2);
```

Then add:

```ts
iDirection: {
  instanced: 1,
  size: 2,
  data: directions
}
```

The wave vertex shader should receive:

```glsl
attribute vec2 iDirection;
```

and pass it to the fragment shader:

```glsl
varying vec2 vDirection;
```

---

# 8. New Vertex Shader

Replace the wave vertex shader with a direction-aware version:

```glsl
precision highp float;

attribute vec2 position;
attribute vec2 uv;

attribute vec2 iOffset;
attribute vec2 iScale;
attribute float iOpacity;
attribute vec2 iDirection;

varying vec2 vUv;
varying float vOpacity;
varying vec2 vDirection;

void main() {
  vUv = uv;
  vOpacity = iOpacity;
  vDirection = normalize(iDirection);

  gl_Position = vec4(
    iOffset + position * iScale,
    0.0,
    1.0
  );
}
```

---

# 9. Core Idea: Rotate the Brush Into Pointer Direction

Inside the wave fragment shader, begin with:

```glsl
vec2 p = vUv * 2.0 - 1.0;
```

Build a coordinate system based on pointer direction:

```glsl
vec2 forward =
  normalize(vDirection);

vec2 sideways =
  vec2(
    -forward.y,
    forward.x
  );
```

Now project the fragment:

```glsl
float along =
  dot(p, forward);

float across =
  dot(p, sideways);
```

Meaning:

```text
along  = direction wave is travelling
across = direction wave crest extends
```

This is the key difference from radial ripples.

---

# 10. Shore-Wave Shape

A shore wave is closer to:

```text
────────────
  ────────────
    ─────────────
```

than:

```text
   ○○○
 ○     ○
○       ○
```

So create an **elongated band**.

Example:

```glsl
float lateral =
  exp(
    -across * across
    * uLateralFalloff
  );
```

Then create forward decay:

```glsl
float forwardMask =
  smoothstep(
    -1.0,
    -0.1,
    along
  )
  *
  (
    1.0 -
    smoothstep(
      0.15,
      1.0,
      along
    )
  );
```

This produces a local elongated patch.

---

# 11. Create Crest Bands

Instead of radial rings:

```glsl
cos(sqrt(r) * ...)
```

use waves across the **forward axis**:

```glsl
float phase =
  along * uCrestFrequency
  - uPhase;
```

Then:

```glsl
float crest =
  sin(phase);
```

But raw sine looks too uniform.

Sharpen positive crests:

```glsl
crest =
  pow(
    max(crest, 0.0),
    uCrestSharpness
  );
```

Now we have multiple parallel wave fronts.

---

# 12. Better Shore-Like Crest Formula

Recommended fragment concept:

```glsl
float phase =
  (
    along
    * uCrestCount
    * 6.28318530718
  )
  - uPhase;

float raw =
  sin(phase);

float crest =
  pow(
    max(raw, 0.0),
    uCrestSharpness
  );
```

Combine:

```glsl
float brush =
  crest
  * lateral
  * forwardMask
  * vOpacity;
```

Result:

```text
pointer →

~~~~  ~~~~  ~~~~
```

instead of circles.

---

# 13. Add Slight Crest Curvature

Perfect straight lines look synthetic.

Add mild curvature:

```glsl
float curve =
  across * across
  * uCurveAmount;

float phase =
  (
    along + curve
  )
  * uCrestFrequency
  - uPhase;
```

This makes wave fronts slightly bowed.

Do not overdo it.

Target:

```text
  _________
 /         \
```

not:

```text
(           )
```

---

# 14. Mouse Direction

The stock component only tracks:

```ts
previousX
previousY
```

for spacing.

ORCA needs actual velocity.

Add:

```ts
let previousPointerX = 0;
let previousPointerY = 0;

let smoothedDirX = 1;
let smoothedDirY = 0;
```

On movement:

```ts
const dx =
  point[0] - previousPointerX;

const dy =
  point[1] - previousPointerY;

const speed =
  Math.sqrt(dx * dx + dy * dy);
```

Normalize:

```ts
if (speed > 0.001) {
  const nx = dx / speed;
  const ny = dy / speed;

  smoothedDirX +=
    (nx - smoothedDirX)
    * directionSmoothing;

  smoothedDirY +=
    (ny - smoothedDirY)
    * directionSmoothing;
}
```

Then give new wave instances:

```ts
wave.dirX = smoothedDirX;
wave.dirY = smoothedDirY;
```

---

# 15. Pointer Velocity Controls Strength

Fast movement should create slightly stronger wave deformation.

But never create huge waves.

Example:

```ts
const normalizedSpeed =
  Math.min(
    speed / 40,
    1
  );

const power =
  0.45 +
  normalizedSpeed
  * velocityInfluence;
```

Clamp:

```ts
const safePower =
  Math.min(power, 1.15);
```

Target behavior:

```text
slow hover
→ gentle tide deformation

normal movement
→ visible crest movement

fast movement
→ slightly stronger crest
```

Never:

```text
fast mouse
→ tsunami
```

---

# 16. Do Not Spawn 100 Visible Waves

The stock component supports:

```ts
MAX_WAVES = 100
```

That is safe as a buffer.

But ORCA should usually have far fewer active wave stamps.

Recommended:

```ts
const MAX_WAVES = 48;
```

or retain 100 but ensure most are inactive.

The effect must remain subtle.

---

# 17. Modify `setNewWave`

New signature:

```ts
const setNewWave = (
  x: number,
  y: number,
  dirX: number,
  dirY: number,
  power: number
) => {
  const wave = waves[current];

  current =
    (current + 1)
    % MAX_WAVES;

  wave.x = x;
  wave.y = y;

  wave.dirX = dirX;
  wave.dirY = dirY;

  wave.scale =
    START_SCALE * power;

  wave.target =
    START_SCALE
    * spread
    * power;

  wave.size = brushSize;

  wave.opacity = 1;
  wave.velocity = power;
  wave.age = 0;
};
```

---

# 18. Avoid Expanding Circular Scale

The stock effect expands each stamp in all directions.

For shore waves, use **directional propagation**.

Instead of only:

```ts
wave.scale +=
  (wave.target - wave.scale)
  * growth;
```

also move the wave forward:

```ts
wave.x +=
  wave.dirX
  * propagation
  * delta
  * wave.velocity;

wave.y +=
  wave.dirY
  * propagation
  * delta
  * wave.velocity;
```

This creates visible travel.

---

# 19. Keep Wave Fronts Elongated

The stock `iScale` uses:

```ts
scales[i * 2]
scales[i * 2 + 1]
```

as symmetric dimensions.

For ORCA:

```text
length across crest
>
length along motion
```

Example:

```ts
const alongSize =
  half;

const acrossSize =
  half * elongation;
```

Because the geometry itself is axis-aligned, the shader direction projection handles orientation.

If needed, extend the vertex shader to rotate geometry itself.

---

# 20. Recommended Shader Uniforms

Replace:

```ts
uRings
```

with:

```ts
interface WaveUniforms {
  uCrestCount: { value: number };
  uCrestSharpness: { value: number };
  uCurveAmount: { value: number };
  uLateralFalloff: { value: number };
  uPhase: { value: number };
}
```

Suggested initial values:

```ts
uCrestCount: 3
uCrestSharpness: 2.4
uCurveAmount: 0.12
uLateralFalloff: 2.8
```

---

# 21. Animate Crest Propagation

The fragment shader can animate the crest phase.

Add:

```glsl
uniform float uPhase;
```

Update every frame:

```ts
waveUniforms.uPhase.value +=
  delta * propagation;
```

This makes wave crests move inside the influence field.

Combine this with forward instance movement only if the effect remains subtle.

If it looks too busy, use **one propagation method**, not both.

---

# 22. Recommended New Wave Fragment Shader

Starting implementation:

```glsl
precision highp float;

varying vec2 vUv;
varying float vOpacity;
varying vec2 vDirection;

uniform float uCrestCount;
uniform float uCrestSharpness;
uniform float uCurveAmount;
uniform float uLateralFalloff;
uniform float uPhase;

const float TAU =
  6.28318530718;

void main() {

  vec2 p =
    vUv * 2.0 - 1.0;

  vec2 forward =
    normalize(vDirection);

  vec2 sideways =
    vec2(
      -forward.y,
      forward.x
    );

  float along =
    dot(p, forward);

  float across =
    dot(p, sideways);

  float lateral =
    exp(
      -across
      * across
      * uLateralFalloff
    );

  float longitudinal =
    exp(
      -along
      * along
      * 1.7
    );

  float curve =
    across
    * across
    * uCurveAmount;

  float phase =
    (
      along
      + curve
    )
    * uCrestCount
    * TAU
    - uPhase;

  float crest =
    pow(
      max(
        sin(phase),
        0.0
      ),
      uCrestSharpness
    );

  float brush =
    crest
    * lateral
    * longitudinal
    * vOpacity;

  gl_FragColor =
    vec4(
      vec3(brush),
      1.0
    );
}
```

This is the core replacement for the ring shader.

---

# 23. Composite Shader Changes

The stock composite shader does:

```glsl
float amount =
  texture2D(
    uDisplacement,
    vUv
  ).r;

float theta =
  amount
  * uSwirl
  * TAU;

vec2 dir =
  vec2(
    sin(theta),
    cos(theta)
  );

vec2 push =
  dir
  * amount
  * uStrength;
```

That produces swirl-based displacement.

We do not want this.

---

# 24. Use Displacement Gradient Instead of Swirl

Sample neighboring displacement pixels:

```glsl
float left =
  texture2D(
    uDisplacement,
    vUv - vec2(uTexel.x, 0.0)
  ).r;

float right =
  texture2D(
    uDisplacement,
    vUv + vec2(uTexel.x, 0.0)
  ).r;

float down =
  texture2D(
    uDisplacement,
    vUv - vec2(0.0, uTexel.y)
  ).r;

float up =
  texture2D(
    uDisplacement,
    vUv + vec2(0.0, uTexel.y)
  ).r;
```

Calculate gradient:

```glsl
vec2 gradient =
  vec2(
    right - left,
    up - down
  );
```

Then:

```glsl
vec2 push =
  gradient
  * uStrength;
```

This makes the source image/water bend according to the local wave crest shape.

Much more physically sensible than arbitrary swirl.

---

# 25. New Composite Core

Replace:

```glsl
float theta = ...
vec2 dir = ...
vec2 push = ...
```

with:

```glsl
float amount =
  texture2D(
    uDisplacement,
    vUv
  ).r;

float left =
  texture2D(
    uDisplacement,
    vUv - vec2(uTexel.x, 0.0)
  ).r;

float right =
  texture2D(
    uDisplacement,
    vUv + vec2(uTexel.x, 0.0)
  ).r;

float down =
  texture2D(
    uDisplacement,
    vUv - vec2(0.0, uTexel.y)
  ).r;

float up =
  texture2D(
    uDisplacement,
    vUv + vec2(0.0, uTexel.y)
  ).r;

vec2 gradient =
  vec2(
    right - left,
    up - down
  );

vec2 push =
  gradient
  * uStrength;
```

Then sample:

```glsl
vec3 color =
  texture2D(
    uTexture,
    base + push
  ).rgb;
```

---

# 26. Remove Grayscale for ORCA

The supplied example uses:

```tsx
grayscale
```

Do not enable this for ORCA.

The deep-blue ocean is part of the design language.

Use:

```tsx
grayscale={false}
```

or remove the prop from the adapted component.

---

# 27. Remove Tint by Default

Stock default:

```ts
tint = '#a855f7'
tintAmount = 0.1
```

Wrong for ORCA.

Use:

```ts
tintAmount = 0
```

No purple tint.

The effect should distort the ocean, not recolor it.

---

# 28. Dispersion

Use:

```ts
dispersion = 0
```

for initial ORCA implementation.

Do not introduce RGB splitting into the ocean hover effect.

This is not the liquid-glass material.

---

# 29. Glint

Use very little:

```ts
glint = 0.02–0.06
```

or zero.

The actual ocean shader should provide most highlights.

---

# 30. What `src` Means

The stock component requires an image:

```tsx
src="/hero.jpg"
```

There are two implementation routes.

---

# 31. Route A — Temporary 2D Prototype

Use RippleDistortion directly over a static ocean image.

This is useful only for proving interaction.

Example:

```tsx
<OrcaWaveDistortion
  src="/images/orca-ocean.jpg"
  brushSize={180}
  strength={0.08}
  crestCount={3}
  crestWidth={0.12}
  elongation={2.8}
  propagation={0.65}
  fade={1.2}
  spacing={8}
  dispersion={0}
  glint={0.03}
/>
```

Pros:

- fast;
- easy;
- validates wave behavior.

Cons:

- ocean itself is frozen;
- boat cannot truly float;
- not final ORCA architecture.

Use only as an intermediate step.

---

# 32. Route B — Final ORCA Implementation

Final ORCA should use:

```text
live procedural ocean renderer
```

The pointer-wave logic from this component should be **ported into the ocean shader/system**.

Do not render:

```text
static hero.jpg
```

as the final ocean.

Final architecture:

```text
Procedural Ocean
+
Directional Pointer Wave Field
+
Boat Physics
+
Marine Overlays
```

This is the preferred solution.

---

# 33. If Ocean Is Already Three.js

If ORCA already has:

```text
Three.js
React Three Fiber
WebGL/WebGPU ocean
```

then:

**do not add a second OGL canvas over it for production.**

Instead reuse these ideas:

```text
pointer velocity
pointer direction
spacing
decaying stamps
directional crest shader
gradient displacement
```

inside the existing ocean shader.

Two GPU canvases fighting for the same hero is unnecessary.

---

# 34. Pointer Wave Field for Existing Ocean Shader

For a 3D ocean, expose uniforms:

```ts
uPointerPosition
uPointerDirection
uPointerSpeed
uPointerStrength
uPointerTime
```

Then combine:

```text
base wave height
+
local pointer crest displacement
```

Conceptually:

```glsl
float pointerWave =
  directionalWave(
    worldXZ,
    uPointerPosition,
    uPointerDirection,
    uPointerTime
  );

height +=
  pointerWave
  * uPointerStrength;
```

This is the clean final architecture.

---

# 35. Boat Behavior

The fisherman/boat must follow:

```text
BASE OCEAN WAVES
```

not:

```text
POINTER DEFORMATION
```

Do not let cursor movement throw the boat around.

Architecture:

```text
visible ocean height =
base waves
+
pointer waves

boat height =
base waves only
```

This keeps the experience premium rather than game-like.

---

# 36. Shore/Tide Visual Language

The hover effect should resemble:

```text
small moving wave fronts
```

not:

```text
water splash
```

Characteristics:

- elongated crest;
- directionally coherent;
- slight curve;
- soft decay;
- low amplitude;
- visible travel;
- no circular rings;
- no whirlpool;
- no RGB dispersion;
- no particle spray.

---

# 37. Mouse Stationary Behavior

If the user stops moving the pointer:

```text
do not continuously generate waves forever.
```

Instead:

```text
last generated crest
      ↓
travels slightly
      ↓
fades
      ↓
ocean returns to normal
```

This is important.

The pointer is a disturbance, not a permanent wave generator.

---

# 38. Mouse Leaving Hero

On:

```text
pointerleave
```

do not hard reset.

Set:

```ts
targetInteractionStrength = 0;
```

Then smooth:

```text
current strength
→ 0
```

over roughly:

```text
400–900 ms
```

depending on visual tuning.

---

# 39. Entering Hero

Do not instantly create a large wave on pointer enter.

Wait until actual pointer movement is detected.

This avoids a visible pop.

---

# 40. Suggested ORCA Configuration

For a first serious build:

```tsx
<OrcaWaveDistortion
  src="/images/orca-ocean.jpg"

  brushSize={180}
  strength={0.075}

  crestCount={3}
  crestSpacing={0.36}
  crestWidth={0.11}
  elongation={2.8}

  propagation={0.6}
  trailLength={1.6}

  velocityInfluence={0.7}
  directionSmoothing={0.12}

  fade={1.15}
  spacing={7}

  dispersion={0}
  glint={0.03}

  quality="high"
/>
```

Do not treat these values as final.

---

# 41. Performance

Registry quality scales:

```ts
const QUALITY_SCALE = {
  low: 0.4,
  medium: 0.7,
  high: 1
};
```

Keep this idea.

Desktop:

```text
high
```

Mid-range:

```text
medium
```

Mobile:

```text
low or disable pointer deformation
```

---

# 42. Mobile

There is no hover on touch devices.

Do not recreate the same interaction through constant touch tracking.

Recommended mobile:

```text
natural ambient ocean waves only
```

Optional:

```text
very subtle touch-drag deformation
```

only if performance and usability remain good.

---

# 43. Reduced Motion

The stock component already checks:

```ts
prefers-reduced-motion
```

Keep this.

When enabled:

- disable pointer-created crests;
- keep a calm ocean;
- keep ORCA functionality.

---

# 44. Cleanup

Preserve the stock cleanup behavior:

```text
cancelAnimationFrame
ResizeObserver.disconnect
remove pointer listeners
remove canvas
lose WebGL context when appropriate
```

Do not leak GPU contexts during navigation/hot reload.

---

# 45. Integration with Liquid Glass

The final layer order should be:

```text
LIVE OCEAN
  ├── natural waves
  └── directional pointer waves

LIVE BOAT

MARINE OVERLAYS

TRUE LIQUID GLASS
  └── refracts latest ocean frame

DOM ASK ORCA CONTROLS
```

Important:

```text
RippleDistortion logic
≠
FluidGlass
```

They solve different problems.

---

# 46. Liquid Glass Must Remain Live

If the pointer deforms the ocean underneath the Ask ORCA bar:

```text
the refracted water inside the liquid glass
must visibly change in real time.
```

No frozen FBO.

No static screenshot.

No fake frosted background.

---

# 47. Do Not Apply Pointer Distortion to UI

The ocean should react.

The UI should remain stable.

Do not distort:

```text
ORCA logo
navbar
tool dock
input text
microphone
send button
result text
```

The interface remains readable while the environment moves underneath.

---

# 48. Suggested File Structure

```text
components/
├── react-bits/
│   └── RippleDistortion/
│       └── RippleDistortion.tsx
│
├── hero/
│   ├── OrcaHero.tsx
│   ├── OrcaWaveDistortion.tsx
│   ├── OceanSurface.tsx
│   ├── PointerWaveController.tsx
│   ├── FishingBoat.tsx
│   └── MarineOverlays.tsx
│
└── ui/
    ├── OrcaFluidGlassBar.tsx
    └── AskOrcaBar.tsx
```

Keep the original registry component untouched.

Adapt it in the ORCA-specific component.

---

# 49. Implementation Sequence

## Phase 1 — Install exact component

Run:

```bash
npx shadcn@latest add @react-bits/RippleDistortion-TS-TW
```

Verify:

```bash
npm ls ogl
```

Expected compatible dependency requirement from the current registry:

```text
ogl@^1.0.11
```

---

## Phase 2 — Confirm stock component

Render the stock example temporarily.

Acceptance:

- image loads;
- pointer creates distortion;
- no console errors.

Do not proceed if base installation is broken.

---

## Phase 3 — Clone to ORCA component

Create:

```text
OrcaWaveDistortion.tsx
```

Keep original source for reference.

---

## Phase 4 — Add Direction Attributes

Implement:

```text
iDirection
pointer velocity
pointer direction
direction smoothing
```

---

## Phase 5 — Replace Ring Shader

Delete:

```text
radial ring calculation
uRings
```

Implement:

```text
directional crest shader
```

Acceptance:

```text
no circular rings appear
```

---

## Phase 6 — Remove Swirl Composite

Remove:

```text
theta
uSwirl
sin(theta)
cos(theta)
```

Use:

```text
displacement gradient
```

Acceptance:

```text
ocean bends like a wave field,
not a whirlpool
```

---

## Phase 7 — Add Propagation

Make crests:

```text
move slightly forward
+
fade
```

Acceptance:

```text
wave fronts feel like they travel
```

---

## Phase 8 — Visual Tuning

Tune:

```text
brushSize
strength
crestCount
crestSharpness
curve
elongation
propagation
fade
```

Do not add more effects until this feels correct.

---

## Phase 9 — Integrate into Live Ocean

Once the effect is correct:

```text
port interaction logic
into the actual ORCA ocean shader
```

Do not leave static-image RippleDistortion as the final ocean.

---

## Phase 10 — Verify FluidGlass

Confirm:

```text
ocean deformation visible
through liquid glass
in real time
```

---

# 50. Acceptance Criteria

The feature is done only when:

- [ ] exact React Bits component is installed successfully;
- [ ] `ogl` dependency is installed;
- [ ] original source is preserved;
- [ ] ORCA-specific version exists;
- [ ] no circular ripple rings are visible;
- [ ] no swirl/whirlpool behavior is visible;
- [ ] pointer direction changes wave direction;
- [ ] pointer speed slightly changes interaction strength;
- [ ] crests are elongated like shore waves;
- [ ] crest fronts have slight natural curvature;
- [ ] wave fronts propagate slightly;
- [ ] wave influence decays smoothly;
- [ ] pointer stop does not spawn endless waves;
- [ ] pointer leave fades naturally;
- [ ] no grayscale is applied;
- [ ] no purple tint is applied;
- [ ] no RGB dispersion is visible;
- [ ] boat does not react violently to mouse interaction;
- [ ] UI remains undistorted;
- [ ] liquid glass remains live and refractive;
- [ ] hover deformation is visible through liquid glass;
- [ ] reduced-motion mode works;
- [ ] mobile does not depend on hover;
- [ ] frame rate remains acceptable.

---

# 51. Codex Implementation Prompt

```text
We are adapting the React Bits RippleDistortion TS-TW component for the
ORCA marine-intelligence hero.

SOURCE OF TRUTH

Docs:
https://reactbits.dev/animations/ripple-distortion

Registry:
https://reactbits.dev/r/RippleDistortion-TS-TW.json

Install:
npx shadcn@latest add @react-bits/RippleDistortion-TS-TW

The current registry declares:
ogl@^1.0.11

IMPORTANT

Do not modify the installed React Bits source destructively.

Keep it as reference.

Create an ORCA-specific adaptation:
OrcaWaveDistortion.tsx

CURRENT STOCK BEHAVIOR

The React Bits component uses instanced circular wave brushes.

Its wave fragment shader calculates radial distance and uses:

cos(sqrt(r) * PI * 2.0 * uRings)

This creates circular ripple rings.

Its composite shader uses uSwirl to calculate an arbitrary displacement
direction.

That is NOT the ORCA target.

ORCA TARGET

When the mouse moves over the ocean, nearby existing water should develop
small directional wave fronts that visually resemble tide/wave crests moving
toward shore.

The interaction must NOT look like:
- circles
- stone-drop ripples
- whirlpools
- liquid lens distortion
- RGB split
- splashes

It should look like:
- elongated wave crests
- multiple roughly parallel fronts
- mild curvature
- pointer-direction response
- slight forward propagation
- soft decay
- low amplitude

IMPLEMENTATION

1. Install and verify the stock component first.

2. Add per-wave direction data:
   dirX
   dirY
   velocity
   age

3. Add an instanced iDirection vec2 attribute.

4. Track pointer velocity:
   dx = currentX - previousX
   dy = currentY - previousY

5. Normalize and smooth pointer direction.

6. Each spawned wave must store the current smoothed pointer direction.

7. REMOVE radial ring logic:
   uRings
   radial cos(sqrt(r) ...)
   concentric-ring behavior

8. Build the brush in a directional coordinate frame:

   forward = normalized pointer direction
   sideways = perpendicular(forward)

   along = dot(localPosition, forward)
   across = dot(localPosition, sideways)

9. Create elongated crest fronts using a sinusoidal function over the along
   coordinate, sharpen positive crests, and apply soft lateral/longitudinal
   falloff.

10. Add mild across^2 curvature to the phase so wave fronts are slightly
    bowed rather than perfectly straight.

11. REMOVE swirl-based composite displacement.

12. Instead calculate the gradient of the displacement texture using
    neighboring texel samples and use that gradient to offset the source
    texture.

13. Pointer speed may increase strength slightly, but clamp it aggressively.

14. Add slight forward propagation and smooth fade.

15. Stop spawning new waves when the pointer stops.

16. Pointer leave should decay existing influence rather than resetting.

17. Disable:
    grayscale
    purple tint
    dispersion
    strong glint

18. Preserve:
    ResizeObserver
    quality scaling
    prefers-reduced-motion
    proper RAF cleanup
    pointer cleanup

FINAL ORCA ARCHITECTURE

This OGL component may be used temporarily to prototype the interaction over
a static ocean image.

However, if the repository already has a live Three.js/R3F procedural ocean,
DO NOT ship a second full-screen OGL canvas as the final architecture.

Instead port the successful pointer-wave logic into the existing ocean shader:

baseOceanWaves
+
directionalPointerWaveField

The boat must follow BASE ocean waves only.

Mouse wave deformation must not throw the boat around.

LIQUID GLASS

Do not apply RippleDistortion to the FluidGlass UI.

Correct pipeline:

pointer
→ ocean wave deformation
→ live ocean frame
→ FluidGlass refraction
→ DOM Ask ORCA controls

The liquid glass must remain continuously transparent/refractive.

If the pointer changes the ocean underneath the glass, that changing water
must be visible through the glass immediately.

BEFORE CODING

Report:

1. current project renderer;
2. whether ORCA ocean is static image, OGL, Three.js or R3F;
3. current React/Three/WebGPU architecture;
4. where FluidGlass is rendered;
5. whether RippleDistortion should remain OGL or be ported into the existing
   ocean shader;
6. files you will change;
7. any renderer conflict.

IMPLEMENT IN PHASES

Phase 1:
install + verify stock React Bits component

Phase 2:
ORCA adaptation + pointer direction tracking

Phase 3:
directional crest shader

Phase 4:
gradient-based composite displacement

Phase 5:
propagation + fade tuning

Phase 6:
integrate with live ORCA ocean

Phase 7:
verify FluidGlass sees live deformation

Phase 8:
performance + responsive testing

AFTER EACH PHASE

- typecheck
- test
- verify no regression
- report actual status

Do not claim the feature is complete if circular ripples remain visible.
```

---

# 52. Final Visual Target

The user moves the mouse across the ocean:

```text
            pointer →

~~~~~~  ~~~~~~~  ~~~~~~~
~~~~~~~  ~~~~~~~~  ~~~~~~
~~~~~~~~  ~~~~~~~~~  ~~~~~
```

The effect feels like a small wave set moving across the surface.

Then:

```text
pointer stops
      ↓
existing crests travel slightly
      ↓
fade into natural ocean
```

Meanwhile:

```text
boat
→ continues natural infinite motion

liquid glass
→ remains fully live and refractive

ORCA UI
→ stays perfectly readable
```

That is the target behavior.
