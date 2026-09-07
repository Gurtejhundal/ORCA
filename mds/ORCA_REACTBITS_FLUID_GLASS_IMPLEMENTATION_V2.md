# ORCA Liquid Glass Integration — React Bits FluidGlass (TS-TW)

## Objective

Integrate the React Bits `FluidGlass` component into ORCA and adapt it into a **static liquid-glass bar** for the hero UI.

Target usage:

- Ask ORCA bar at the bottom
- optional compact tool dock
- no demo images
- no demo typography
- no scrolling behavior
- no pointer-following lens behavior
- no floating cube
- no internal navigation rendered inside the 3D scene
- preserve the actual refractive/transmission look of the React Bits component

The visual goal is:

> a real, continuously refractive liquid-glass slab over the live ORCA ocean — fully clear/transmissive like the React Bits preview, never a frozen, frosted, screenshot-based, or opaque `backdrop-blur` card.

The ocean, boat, PFZ overlays and routes must remain visibly live through the glass every frame.

---

# 1. Source

React Bits component:

```text
FluidGlass
Variant: TS-TW
```

Registry:

```text
https://reactbits.dev/r/FluidGlass-TS-TW.json
```

Docs:

```text
https://reactbits.dev/components/fluid-glass
```

Install:

```bash
npx shadcn@latest add @react-bits/FluidGlass-TS-TW
```

The registry currently declares these dependencies:

```text
three@^0.180.0
@react-three/fiber@^9.3.0
@react-three/drei@^10.7.4
maath@^0.10.8
```

It also requires these model assets:

```text
/public/assets/3d/lens.glb
/public/assets/3d/bar.glb
/public/assets/3d/cube.glb
```

For ORCA, only:

```text
bar.glb
```

is required for the bottom question bar.

---

# 2. Important Technical Reality

The stock React Bits component is a self-contained 3D demo.

Its source includes:

- its own `<Canvas>`
- `ScrollControls`
- demo typography
- demo images
- navigation text
- `useFBO`
- `MeshTransmissionMaterial`
- its own offscreen scene

That is fine for the React Bits demo.

It is **not the correct final architecture for ORCA**.

Why:

The stock component refracts content rendered inside its own Three.js scene/FBO.

ORCA has a separate live ocean scene.

If we simply place:

```tsx
<FluidGlass mode="bar" />
```

over the ORCA ocean as another independent canvas, the glass will not automatically refract the real ocean behind it.

So we should reuse the **FluidGlass material, geometry and behavior**, but integrate the bar into the same 3D rendering environment as the ORCA ocean.


---

# 2A. Non-Negotiable: Live Transparent Liquid Glass

The React Bits preview establishes the correct behavior.

We want:

```text
LIVE OCEAN
  ↓
rendered continuously
  ↓
TRANSMISSIVE GLASS
  ↓
live optical refraction
  ↓
sharp HTML input above it
```

The glass must **never** become a frozen frame of the ocean.

Do not implement:

```text
❌ screenshot of ocean
❌ cached frame texture
❌ frozen FBO reused without updating
❌ opaque navy panel
❌ heavy frosted blur
❌ static fake glass background
❌ cyan glow pretending to be glass
```

The correct behavior is:

```text
Ocean waves move
      ↓
FBO/scene texture updates this frame
      ↓
FluidGlass samples this live frame
      ↓
the wave movement is visibly refracted through the bar
```

If the boat or route moves behind the glass, that movement must also remain visible through the glass.

The glass is static in position, but **its optical content is live every frame**.

---

# 2B. "Fully Transparent" Means High Transmission, Not Zero Opacity

Do not interpret "fully transparent" as:

```css
opacity: 0;
```

That would make the glass disappear.

For ORCA, "fully transparent" means:

- `transmission` near `1`
- `roughness` near `0`
- low chromatic aberration
- restrained IOR
- low tint
- visible refraction
- almost no frosted diffusion

Start from:

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

These are starting values, not fixed values.

The first visual target is **maximum clarity**.

Only after the live transparent effect works should we add subtle tuning.

---

---

# 3. Recommended Architecture

Do not keep two separate full-screen 3D canvases.

Use:

```text
ORCA Hero
│
├── One Three.js / R3F Canvas
│   │
│   ├── Ocean
│   ├── Boat
│   ├── PFZ overlays
│   ├── Route overlays
│   └── ORCA Glass Bar Mesh
│
└── DOM Layer
    ├── Navbar
    ├── Ask ORCA text input
    ├── microphone button
    ├── send button
    └── optional tool dock
```

The 3D bar provides the physical glass/refraction.

The actual text and controls remain normal HTML.

This gives us:

- real ocean refraction
- sharp accessible text
- normal keyboard input
- easy responsive layout
- much easier event handling

---

# 4. What to Reuse from React Bits

Reuse these ideas from the registry source:

```text
bar.glb
ModeWrapper geometry logic
MeshTransmissionMaterial
ior
thickness
anisotropy
chromaticAberration
viewport-based positioning
bottom lock behavior
FBO/refraction concept
```

Do not reuse the demo-specific content.

---

# 5. What to Remove

Remove from the ORCA-specific component:

```text
ScrollControls
useScroll
Images()
Typography()
NavItems()
Image
Text
Scroll
Preload
demo image URLs
demo navigation items
pages={3}
distance={0.4}
```

We do not need scroll-driven content inside the glass.

---

# 6. Current React Bits Bar Behavior

In the registry source, the bar uses:

```tsx
<ModeWrapper
  glb="/assets/3d/bar.glb"
  geometryKey="Cube"
  lockToBottom
  followPointer={false}
  ...
/>
```

That is useful because it already:

- does not follow the pointer
- locks the bar to the bottom
- uses `bar.glb`
- applies transmission material

But ORCA needs more control.

---

# 7. New ORCA Component

Create:

```text
components/hero/OrcaFluidGlassBar.tsx
```

Do not call the full React Bits demo component directly from the hero.

Create a focused ORCA wrapper based on the registry source.

Suggested public interface:

```ts
interface OrcaFluidGlassBarProps {
  width?: number;
  height?: number;
  bottomOffset?: number;

  ior?: number;
  thickness?: number;
  chromaticAberration?: number;
  anisotropy?: number;

  transmission?: number;
  roughness?: number;

  visible?: boolean;
}
```

Default target:

```ts
{
  ior: 1.12,
  thickness: 6,
  chromaticAberration: 0.02,
  anisotropy: 0.01,
  transmission: 1,
  roughness: 0.02
}
```

These are starting values only.

Tune them visually against the ocean.

---

# 8. Reduce Chromatic Aberration

The stock example uses:

```ts
chromaticAberration: 0.1
```

That is too strong for ORCA.

It can create a flashy RGB fringe.

For ORCA start around:

```ts
0.01–0.03
```

The final glass should feel premium and optical.

Not:

```text
gaming effect
neon distortion
rainbow glass
```

---

# 9. Bar Position Is Static — Optics Are Live

The bar should remain anchored near the bottom center.

No pointer tracking.

No scroll movement.

No bobbing.

No 3D floating animation.

But **static position does not mean static glass content**.

Desired behavior:

```text
bar position             STATIC
bar geometry             STATIC
glass material params    mostly STATIC

ocean behind bar         LIVE
boat behind bar          LIVE
route behind bar         LIVE
PFZ behind bar           LIVE
refraction result        LIVE EVERY FRAME
```

That distinction is critical.

The user should see the moving ocean continuously distorted through the stationary glass bar.

---

# 10. Screen-Space Positioning

Use the current camera viewport to place the bar.

Conceptually:

```ts
const v = viewport.getCurrentViewport(camera, [0, 0, glassDepth]);

const y =
  -v.height / 2
  + bottomOffset;

glass.position.set(
  0,
  y,
  glassDepth
);
```

The bar should remain visually aligned with the HTML Ask ORCA input.

---

# 11. Align 3D Glass with DOM Input

This is critical.

We will have:

```text
3D glass mesh
+
HTML input directly over it
```

They must align exactly.

Recommended structure:

```tsx
<div className="orca-ask-wrapper">

  <div className="orca-glass-anchor" />

  <form className="orca-ask-content">
    ...
  </form>

</div>
```

Measure the DOM bar with:

```ts
ResizeObserver
```

Pass:

```text
width
height
bottom offset
```

to the 3D glass component.

Then map screen-space dimensions into Three.js viewport dimensions.

Do not manually guess the scale forever.

---

# 12. Responsive Alignment

Desktop target:

```text
width: approximately 44–52vw
height: 64–74px
```

Tablet:

```text
width: approximately 65–75vw
```

Mobile:

```text
width: calc(100% - 24px)
height: 58–66px
```

The 3D bar must update when:

```text
window resize
orientation change
container resize
```

Use `ResizeObserver`.

---

# 13. Ask ORCA DOM Content

Overlay normal DOM content:

```tsx
<form>
  <OrcaIcon />

  <input
    placeholder="Ask ORCA about the sea..."
  />

  <button>
    Microphone
  </button>

  <button>
    Send
  </button>
</form>
```

Do not render this text with Drei `<Text>`.

Reasons:

- accessibility
- input focus
- selection
- typing
- screen readers
- mobile keyboard
- crisp text
- easier responsive design

---

# 14. Pointer Events

The glass mesh itself should not intercept form interaction.

The DOM input must receive clicks.

Structure layers carefully:

```text
Canvas
z-index 0

DOM controls
z-index 10
```

The canvas still needs pointer movement for the ocean interaction.

So do not globally disable:

```css
pointer-events: none;
```

on the entire canvas if the ocean needs pointer tracking.

Instead:

- ocean reads pointer from hero container
- DOM controls handle direct interaction
- glass mesh itself does not need clicks

---

# 15. Ocean Refraction

This is the main reason for using the React Bits glass technique.

The glass should refract:

```text
moving procedural waves
boat if it passes behind glass region
PFZ overlays if rendered in scene
route geometry
ocean lighting
```

This creates genuine visual depth.

The Ask ORCA HTML content should remain unaffected.

---

# 16. Same-Scene Integration

Preferred implementation:

```text
One R3F scene
```

Inside:

```tsx
<OceanSurface />
<FishingBoat />
<MarineLayers />
<OrcaFluidGlassBar />
```

This is better than:

```text
Canvas A → Ocean
Canvas B → React Bits FluidGlass
```

because separate canvases cannot naturally share the same scene texture.

---

# 17. FBO Strategy — Must Update Every Frame

The original component uses:

```ts
const buffer = useFBO();
```

then:

```ts
gl.setRenderTarget(buffer);
gl.render(scene, camera);
gl.setRenderTarget(null);
```

and provides:

```tsx
<MeshTransmissionMaterial
  buffer={buffer.texture}
/>
```

For ORCA, the offscreen buffer must contain the **current live frame** of:

```text
Ocean
Boat
Marine overlays
Routes
PFZ markers rendered in scene
```

but exclude the glass itself.

Target render flow:

```text
EVERY FRAME

1. advance ocean animation
2. update boat transform
3. update marine scene objects
4. hide/exclude glass
5. render current scene → FBO
6. restore/show glass
7. glass samples latest FBO texture
8. render final scene
```

Do not render the FBO once and reuse it forever.

That would create the exact frozen-glass effect we do not want.

If the ocean moves under the bar, the refraction must visibly change in the same frame.

---

# 18. Avoid Recursive Rendering

Never render the glass into the same texture it is currently sampling.

Use:

```text
scene layer A = ocean + boat + marine
scene layer B = glass
```

or temporarily hide the glass while capturing the buffer.

Conceptually:

```ts
glass.visible = false;

renderer.setRenderTarget(buffer);
renderer.render(scene, camera);

renderer.setRenderTarget(null);

glass.visible = true;
renderer.render(scene, camera);
```

Implement carefully in R3F.

---

# 19. Important WebGPU Compatibility Warning

ORCA's ocean plan uses WebGPU/TSL.

The current React Bits registry component uses:

```text
useFBO
MeshTransmissionMaterial
```

and the current `useFBO` implementation from Drei creates:

```text
THREE.WebGLRenderTarget
```

This means the stock FluidGlass implementation is strongly tied to the normal WebGL-oriented Drei path.

Do **not** assume the component can be dropped unchanged into a WebGPU renderer.

Also, current Drei WebGPU support is still evolving.

Therefore:

```text
Do not merge FluidGlass + WebGPU blindly.
```

Test the exact renderer path.

---

# 20. Recommended Renderer Strategy

For the hackathon, choose reliability over theoretical purity.

## Route A — Recommended first

Use:

```text
React Three Fiber
WebGLRenderer
```

for the hero initially.

This gives the highest chance that:

```text
MeshTransmissionMaterial
useFBO
FluidGlass
GLTF
ocean shaders
```

all work together.

The interactive ocean can still be GPU-accelerated using WebGL shaders.

You do **not** need WebGPU to create convincing waves.

---

# 21. WebGPU Upgrade

Only migrate to WebGPU after:

```text
ocean works
boat works
pointer waves work
glass works
query bar works
```

Then test whether the equivalent transmission/refraction path works.

Do not break a Gateway-ready hero just to say:

```text
we use WebGPU
```

The user cannot visually distinguish WebGPU from WebGL if both produce the same result.

---

# 22. If WebGPU Is Mandatory

If the ORCA hero is already using `WebGPURenderer`, do not blindly import the stock React Bits implementation.

Instead:

```text
reuse:
bar.glb
glass dimensions
material parameters
visual reference

rewrite:
refraction material / render target path
for WebGPU-compatible Three.js nodes/TSL
```

This is a separate engineering task.

---

# 23. Tool Dock

The React Bits `bar` geometry is primarily useful for the horizontal Ask ORCA bar.

For the vertical tool dock, do not force the same geometry.

Options:

### Option 1 — CSS glass

Use restrained CSS liquid glass for the tool dock.

Recommended.

### Option 2 — dedicated custom GLB

Create a vertical glass geometry.

Higher complexity.

For Gateway:

```text
Ask ORCA = true 3D refractive glass
Tool Dock = CSS optical glass
```

This is the best trade-off.

---

# 24. Glass Visual Settings

## First target: maximum clarity

Start much clearer than the stock React Bits demo:

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

If the component exposes only the simpler FluidGlass props, start near:

```ts
const orcaGlass = {
  transmission: 1,
  roughness: 0.01,
  ior: 1.10,
  thickness: 2.0,
  chromaticAberration: 0.003,
  anisotropy: 0.005
};
```

## Tuning order

Tune in this order:

```text
1. transmission / clarity
2. thickness
3. IOR
4. roughness
5. edge highlight
6. chromatic aberration
```

Do not begin by increasing distortion.

The ocean must remain readable through the bar.

Avoid:

```text
thickness too high
IOR too high
strong frost
RGB edge splitting
strong colored attenuation
cyan glow
opaque navy fill
```

Target:

> clear live water, slightly bent by the glass shape.

---

# 25. Color

The glass should be effectively colorless.

The ocean should provide nearly all visible color.

Start with:

```tsx
color="#ffffff"
```

If attenuation is used, keep it extremely weak.

Preferred visual result:

```text
deep-blue ocean
      ↓
clear refractive glass
      ↓
ocean remains deep-blue because it is visible through the glass
```

Do not tint the glass itself bright cyan, blue or purple.

The glass should look transparent first and stylized second.

---

# 26. HTML Surface Styling

The DOM bar should add almost no extra opaque background.

Example:

```css
.orca-ask-content {
  background: rgba(255,255,255,0.015);
  border: 1px solid rgba(255,255,255,0.10);
}
```

The 3D glass should provide most of the visual effect.

Do not stack:

```text
3D glass
+
heavy backdrop blur
+
opaque CSS card
```

That destroys the refraction.

---

# 27. Focus State

On input focus:

Do:

```text
slightly strengthen edge highlight
slightly increase glass clarity
```

Do not:

```text
add cyan glow
scale bar dramatically
pulse
```

The interaction should remain calm.

---

# 28. Listening State

When microphone mode is active:

Use one subtle internal indicator.

Example:

```text
small waveform
```

or:

```text
small pulsing dot
```

Do not make the whole glass glow.

---

# 29. Analysing State

When ORCA is analysing:

The bar stays fixed.

Inside the DOM layer:

```text
ORCA analysing sea conditions...
```

Optionally animate a small progress indicator.

The glass itself should not bounce or morph.

---

# 30. Result State

After a result:

Keep the bar.

Show result separately in:

```text
contextual glass sheet
```

above the Ask ORCA bar.

Do not transform the input bar into a huge dashboard.

---

# 31. Installation

Run:

```bash
npx shadcn@latest add @react-bits/FluidGlass-TS-TW
```

Then verify dependencies:

```bash
npm ls three
npm ls @react-three/fiber
npm ls @react-three/drei
npm ls maath
```

Expected registry requirements:

```text
three@^0.180.0
@react-three/fiber@^9.3.0
@react-three/drei@^10.7.4
maath@^0.10.8
```

Do not blindly downgrade an existing project.

First inspect current versions.

---

# 32. Asset Installation

Ensure:

```text
public/assets/3d/bar.glb
```

exists.

If React Bits installation does not automatically provide the model, copy it from the React Bits repository/example assets.

Verify runtime path:

```text
/assets/3d/bar.glb
```

The browser should return the GLB successfully.

---

# 33. Recommended File Structure

```text
components/
├── hero/
│   ├── OrcaHero.tsx
│   ├── OceanScene.tsx
│   ├── OrcaFluidGlassBar.tsx
│   └── AskOrcaOverlay.tsx
│
├── react-bits/
│   └── FluidGlass/
│       └── FluidGlass.tsx
│
└── ui/
    └── ToolDock.tsx

public/
└── assets/
    └── 3d/
        └── bar.glb
```

Keep the original imported component for reference.

Create the ORCA-specific component separately.

Do not destroy the registry source immediately.

---

# 34. Implementation Order

## Phase 1

Install the React Bits component unchanged.

Verify:

```text
bar mode renders
bar.glb loads
material works
```

## Phase 2

Create:

```text
OrcaFluidGlassBar
```

Strip:

```text
scroll
images
typography
navigation
```

## Phase 3

Make bar static.

Verify:

```text
no pointer following
no scroll movement
bottom aligned
```

## Phase 4

Align bar with Ask ORCA DOM input.

## Phase 5

Move glass into same ocean scene.

Verify real ocean refraction.

## Phase 6

Tune material:

```text
IOR
thickness
chromatic aberration
roughness
scale
```

## Phase 7

Responsive testing.

## Phase 8

Performance testing.

## Phase 9

Only after stable:
consider WebGPU migration.

---

# 34A. Interaction With RippleDistortion / Ocean Hover Effect

RippleDistortion or the adapted pointer-wave system belongs to the **ocean only**.

Architecture:

```text
pointer movement
      ↓
ocean wave deformation
      ↓
live ocean frame changes
      ↓
FluidGlass receives latest frame
      ↓
glass refracts the changed water immediately
```

Do not apply RippleDistortion to:

- Ask ORCA text;
- glass geometry;
- microphone button;
- send button;
- navbar;
- tool dock.

The glass should not wobble because the cursor moved over the sea.

The **water moves**.

The **glass refracts the moving water**.

That is the intended effect.

---

# 35. Acceptance Criteria

The integration is complete only if:

- [ ] React Bits `bar.glb` is used.
- [ ] liquid transmission/refraction is visible.
- [ ] bar does not follow pointer.
- [ ] bar does not scroll.
- [ ] demo images are removed.
- [ ] demo typography is removed.
- [ ] demo nav text is removed.
- [ ] Ask ORCA uses normal HTML input.
- [ ] 3D glass aligns with DOM bar.
- [ ] ocean is visibly refracted through glass.
- [ ] refraction updates every frame while ocean waves move.
- [ ] no frozen/cached ocean frame is visible inside the glass.
- [ ] boat/route movement remains live when passing behind the glass.
- [ ] glass is clear/transmissive rather than heavily frosted.
- [ ] no cyan glow is added.
- [ ] chromatic aberration is restrained.
- [ ] responsive resizing works.
- [ ] mobile layout remains readable.
- [ ] input remains keyboard accessible.
- [ ] ocean hover interaction still works.
- [ ] bar does not block ocean pointer tracking unexpectedly.
- [ ] hero maintains good frame rate.
- [ ] fallback behavior is defined.

---

# 36. Failure Cases

## Glass appears black

Likely:
- FBO is not rendering the ocean.
- buffer texture is wrong.
- scene separation is wrong.

## Glass shows React Bits demo content

Remove:

```text
Typography
Images
Scroll
```

## Glass does not refract the ocean

Likely:
- FluidGlass is in a separate Canvas.
- buffer only contains its own internal scene.

Fix:
- integrate glass into the ORCA ocean scene.

## Glass looks neon

Reduce:
- chromatic aberration;
- colored attenuation;
- CSS glow;
- border brightness.

## Glass shifts during interaction

Ensure:

```text
followPointer = false
lock/static positioning = true
```

## Input cannot be clicked

Fix:
- z-index;
- pointer event layering;
- DOM overlay position.

---

# 37. Codex Implementation Prompt

```text
We are integrating React Bits FluidGlass into the ORCA hero.

SOURCE

Docs:
https://reactbits.dev/components/fluid-glass

Registry:
https://reactbits.dev/r/FluidGlass-TS-TW.json

Install:
npx shadcn@latest add @react-bits/FluidGlass-TS-TW

The registry component currently depends on:

- three@^0.180.0
- @react-three/fiber@^9.3.0
- @react-three/drei@^10.7.4
- maath@^0.10.8

It uses:

- bar.glb
- lens.glb
- cube.glb

For ORCA we only need bar.glb.

GOAL

Use the React Bits bar geometry and transmission/refraction behavior to
create the bottom Ask ORCA liquid-glass bar.

Do NOT keep the stock demo behavior.

REMOVE

- ScrollControls
- useScroll
- Images()
- Typography()
- NavItems()
- demo image assets
- demo navigation
- scroll-driven animation
- lens mode
- cube mode

KEEP / ADAPT

- bar.glb
- MeshTransmissionMaterial
- IOR
- thickness
- anisotropy
- chromatic aberration
- viewport-based positioning
- FBO/refraction architecture where appropriate

BAR BEHAVIOR

The ORCA glass bar must:

- remain static at the bottom center;
- never follow the pointer;
- never move with scroll;
- never bob or float;
- refract the live ocean behind it;
- update that refraction EVERY FRAME;
- never display a frozen/cached screenshot of the ocean;
- remain highly transparent and low-roughness;
- allow moving waves/boat/routes behind it to remain visibly live;
- resize responsively;
- visually align with the DOM Ask ORCA form.

The actual input, microphone and send button must remain normal HTML/React
elements layered over the 3D glass.

Do not render editable text using Drei Text.

IMPORTANT ARCHITECTURE

Inspect the existing ORCA ocean implementation.

If the ocean and React Bits FluidGlass are in separate Canvas instances,
do not leave them that way for the final version.

The stock FluidGlass component captures/refractions content from its own
Three.js scene/FBO.

For true ocean refraction, adapt the FluidGlass bar into the same Three.js
scene as the ORCA ocean, or create an equivalent scene-texture capture that
contains the live ocean.

Avoid recursive glass rendering:
capture ocean/boat/marine layers without the glass, then use that render
texture for the glass material.

VISUAL SETTINGS

First target maximum clarity.

Start near:

ior: 1.10
thickness: 2.0
chromaticAberration: 0.003
anisotropy: 0.005
transmission: 1
roughness: 0.01
clearcoat: 1
clearcoatRoughness: 0.02

Tune visually only after live transmission works.

The final glass must be nearly colorless and clearly show the moving ocean through it.

Do not create a frosted/static panel.

DO NOT ADD:

- cyan outer glow
- blue neon border
- opaque navy background
- strong RGB fringing
- heavy shadow

WEBGPU WARNING

The current React Bits registry implementation uses `useFBO` and
`MeshTransmissionMaterial`.

Do not assume this stock implementation is automatically compatible with
the ORCA WebGPU renderer.

First inspect the current renderer and package versions.

For the first reliable implementation, prefer the renderer path that
actually supports the existing FluidGlass technique.

Do not break a functioning WebGL implementation just to force WebGPU.

If the project already depends on WebGPU, explicitly test compatibility
before changing architecture.

IMPLEMENTATION ORDER

1. inspect repo and package versions
2. install/import React Bits source
3. verify stock bar works
4. create OrcaFluidGlassBar
5. strip demo content
6. make bar static
7. align with DOM Ask ORCA form
8. integrate same-scene ocean refraction
9. tune glass optics
10. test responsive sizing
11. profile performance
12. only then evaluate WebGPU upgrade

Before coding, report:

- existing renderer
- existing Three/R3F/Drei versions
- where the ocean scene lives
- where the query bar lives
- whether FluidGlass can share the scene directly
- any WebGPU compatibility risk

After implementation, report:

- files changed
- dependency changes
- whether bar.glb loads
- whether ocean refraction works
- whether DOM alignment works
- FPS/performance observations
- remaining limitations

Do not claim true ocean refraction unless the live ocean is actually visible
through/distorted by the glass.

Do not claim completion if the FBO/render texture is captured only once.
Verify that ocean movement remains visible through the glass continuously.
```

---

# 38. Final Target

The final Ask ORCA control should feel like:

```text
a clear physical liquid-glass slab
sitting over a continuously moving ocean
```

The bar position remains calm and fixed.

The optical content does not freeze.

The user should see:

```text
moving ocean
      ↓
live frame capture / live scene texture
      ↓
high-transmission refractive glass
      ↓
moving water visibly bends through glass
      ↓
sharp DOM-based Ask ORCA input
```

If a wave moves under the bar, that wave must continue moving while visibly refracted.

If the boat or route moves behind the bar, that movement must remain live.

Never ship:

```text
frozen ocean texture
static screenshot glass
opaque frosted card
blue translucent rectangle
cyan glow pretending to be glass
```

The target is the same optical behavior demonstrated in the React Bits FluidGlass preview:
**clear, live, continuously refractive glass.**
