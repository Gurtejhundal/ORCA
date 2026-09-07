# Motion Language

## Principle

Motion should make the environment feel alive, not make the UI feel animated.

## Ambient motion

Allowed:
- ocean wave movement;
- boat bobbing;
- natural wake;
- tiny water shimmer;
- gentle cloud/light drift;
- very slow PFZ pulse;
- subtle current movement.

## Cursor-water interaction

This is a hero signature.

When cursor moves over the ocean:
- localized ripple;
- mild water displacement;
- very small surface distortion;
- short decay;
- no large radial explosion;
- no fluid simulation that feels like a game.

Interaction should feel like:
> moving through a living surface

not:
> clicking a WebGL demo.

## Query-response animation

Sequence:

1. input active;
2. subtle sonar/radar pulse from boat;
3. relevant ocean layer appears;
4. PFZ targets fade in;
5. unsafe zone/boundary appears if needed;
6. recommended route draws;
7. selected target stabilizes;
8. result glass panel appears.

## Timing

- micro interaction: 120–220 ms
- card/glass appearance: 200–350 ms
- route draw: 500–900 ms
- map intelligence reveal: 300–700 ms
- ambient loops: slow and continuous

## Easing

Prefer:
- ease-out
- cubic-bezier curves with soft deceleration
- spring only for very subtle button/target motion

## Reduce motion

Respect `prefers-reduced-motion`.

Disable:
- water cursor disturbance;
- large route animation;
- repeated PFZ pulse.
