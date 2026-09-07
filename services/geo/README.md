# Geospatial service boundary

This milestone uses an in-process TypeScript package, @orca/geo, with Turf. No independent HTTP server or Python service is needed.

The package implements Haversine distance, nearest-point lookup, point-in-polygon, full line/polygon intersection, water-mask containment, distance to polygon boundary, bounded route sampling and distance-weighted risk aggregation. All coordinates are WGS84 [longitude, latitude]; distances are kilometers.

Tests cover crossing, containment, tangency, holes, known distances and endpoint inclusion. The supplied water mask is schematic DEMO geometry, not a chart.
