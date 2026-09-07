# Design Tokens

These are starting points, not absolute values.

```css
:root {
  --orca-bg-deep: #06131b;
  --orca-bg-ocean: #0b2a3a;

  --orca-text-primary: rgba(255,255,255,0.94);
  --orca-text-secondary: rgba(224,237,244,0.68);
  --orca-text-muted: rgba(199,216,224,0.48);

  --orca-glass-bg: rgba(255,255,255,0.055);
  --orca-glass-border: rgba(255,255,255,0.14);
  --orca-glass-highlight: rgba(255,255,255,0.12);

  --orca-safe: #77c6a3;
  --orca-warning: #e2b66a;
  --orca-danger: #d9796b;
  --orca-info: #7ebdcf;

  --orca-radius-sm: 12px;
  --orca-radius-md: 18px;
  --orca-radius-lg: 28px;

  --orca-space-1: 4px;
  --orca-space-2: 8px;
  --orca-space-3: 12px;
  --orca-space-4: 16px;
  --orca-space-5: 24px;
  --orca-space-6: 32px;
  --orca-space-7: 48px;
  --orca-space-8: 64px;

  --orca-blur-glass: 22px;

  --orca-motion-fast: 160ms;
  --orca-motion-normal: 260ms;
  --orca-motion-slow: 700ms;
}
```

## Glass utility

```css
.orca-glass {
  background:
    linear-gradient(
      180deg,
      rgba(255,255,255,0.08),
      rgba(255,255,255,0.035)
    );
  border: 1px solid var(--orca-glass-border);
  backdrop-filter: blur(var(--orca-blur-glass)) saturate(115%);
  -webkit-backdrop-filter: blur(var(--orca-blur-glass)) saturate(115%);
  box-shadow:
    0 10px 30px rgba(0,0,0,0.16),
    inset 0 1px 0 rgba(255,255,255,0.12);
}
```

## Important

Do not blindly apply `.orca-glass` to every surface.

Glass is an accent material, not the whole website.
