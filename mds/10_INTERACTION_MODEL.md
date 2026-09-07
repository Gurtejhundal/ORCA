# Interaction Model

## Default state

The hero is visually quiet.

User sees:
- ocean;
- boat;
- ORCA;
- query bar;
- tool dock;
- 1–2 contextual map markers.

## Hover water

Cursor causes local water response.

This is purely ambient.

It must not:
- move the boat unnaturally;
- trigger UI;
- create waves across the full screen.

## Sidebar

Clicking tools reveals only the selected intelligence layer.

Example:
- Fishing Zones → PFZ targets
- Conditions → wave/current/SST labels
- Alerts → warning zones
- Route → route options
- Layers → layer chooser

Do not show all layers at once.

## Query submit

The system should progressively reveal only the data relevant to the question.

Example:

`Where should I fish today?`

Reveal:
- PFZ;
- safety;
- route;
- necessary conditions.

Do not open every possible data panel.

## Result

Keep map/ocean visible.

Overlay:
- compact result sheet;
- recommended target;
- route;
- 2–4 evidence labels.

## Drill-down

Detailed evidence can open in a side sheet or bottom sheet.

Do not move the user into a completely different dashboard unless required.
