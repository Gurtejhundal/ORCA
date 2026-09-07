# Geospatial and Routing Engine

## Required operations

1. Haversine distance.
2. nearest zone/point.
3. point-in-polygon.
4. line-polygon intersection.
5. distance-to-boundary.
6. route segment risk sampling.
7. route comparison.

## MVP route strategy

Do not build a full nautical navigation engine.

### Approach

1. Define water-region bounding box for the demo area.
2. Generate a coarse grid or graph over valid sea cells.
3. Remove land/restricted cells.
4. Attach dynamic risk cost to each cell.
5. Run A* or Dijkstra from departure to target.
6. Simplify returned path for display.

### Node cost

```text
nodeCost =
  distanceCost +
  λ1*waveRisk +
  λ2*windRisk +
  λ3*alertRisk +
  λ4*boundaryProximityRisk
```

Forbidden zone:
```text
nodeCost = Infinity
```

## Simplified fallback

If grid routing is too slow to finish:
- generate 2–3 deterministic waypoint routes;
- sample risk along each;
- choose lowest cost.

That is still defensible if clearly explained.

## Risk sampling

For every route:
1. sample N points along line;
2. interpolate/select nearest forecast cell;
3. compute risk per sample;
4. calculate mean/max route risk;
5. detect polygon intersections.

## Geofencing

Represent zones as GeoJSON polygons:

```json
{
  "type": "Feature",
  "properties": {
    "id": "zone-001",
    "name": "Restricted Demo Area",
    "severity": "forbidden"
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": []
  }
}
```

Use Shapely/PostGIS for intersection tests.

## Important disclaimer

A Gateway routing prototype is **decision-support research software**, not a certified marine navigation system.
