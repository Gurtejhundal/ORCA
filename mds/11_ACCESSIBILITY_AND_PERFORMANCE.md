# Accessibility and Performance

## Contrast

Ocean backgrounds are visually complex.

Always verify:
- readable nav;
- readable glass text;
- sufficient icon contrast;
- warning visibility.

## Do not rely only on color

For:
- restricted areas;
- warnings;
- route states.

Use:
- line style;
- icon;
- label;
- pattern.

## Keyboard

All:
- nav;
- dock;
- query bar;
- chips;
- layer controls

must be keyboard reachable.

## Reduced motion

Respect user motion preferences.

## WebGL fallback

If interactive ocean fails:
- use high-quality static/looping ocean background;
- keep all UI functional.

## Performance budget

Hero:
- avoid oversized video if a shader/canvas solution is lighter;
- lazy-load below-fold sections;
- reduce blur count;
- reuse one glass primitive;
- avoid dozens of animated DOM nodes.

## Goal

The hero should remain smooth on a normal modern laptop, not only a high-end GPU.
