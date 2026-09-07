# Liquid Glass System

## Goal

Use Apple-like optical restraint without imitating platform chrome literally.

The glass should look physically plausible.

## Glass characteristics

Use:
- high transparency;
- strong but controlled backdrop blur;
- slight background saturation shift;
- very subtle internal highlight;
- faint edge line;
- low-opacity shadow;
- slight refraction/distortion if technically feasible.

Avoid:
- cyan glow;
- blue outer aura;
- opaque navy cards;
- thick luminous borders;
- excessive drop shadows.

## Suggested CSS direction

```css
.orca-glass {
  background:
    linear-gradient(
      180deg,
      rgba(255,255,255,0.08),
      rgba(255,255,255,0.035)
    );
  border: 1px solid rgba(255,255,255,0.14);
  backdrop-filter: blur(22px) saturate(115%);
  -webkit-backdrop-filter: blur(22px) saturate(115%);
  box-shadow:
    0 10px 30px rgba(0,0,0,0.16),
    inset 0 1px 0 rgba(255,255,255,0.12);
}
```

Tune visually.

Do not treat this as a fixed formula.

## Glass states

### Default
Nearly transparent.

### Hover
- slight increase in internal highlight;
- slight border clarity;
- minimal scale or translation.

### Active
- slightly more opacity;
- one subtle accent indicator.

### Disabled
- lower contrast;
- no bright outline.

## Refraction

If supported:
- add a low-strength displacement/distortion layer;
- do not warp text;
- only distort the ocean directly behind larger glass surfaces.

## Rule

Glass should make the UI feel expensive because it is **quiet**, not because it glows.
