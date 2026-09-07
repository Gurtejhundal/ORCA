import {
  along,
  booleanIntersects,
  booleanPointInPolygon,
  booleanWithin,
  distance,
  feature,
  length,
  lineString,
  point,
  pointToLineDistance,
  polygonToLine,
} from '@turf/turf';
import type { LineString, Polygon } from 'geojson';
import type { GeoPoint, RouteSample } from '@orca/contracts';

export const coordinates = (p: GeoPoint): [number, number] => [p.lon, p.lat];
export const asPoint = (p: number[]): GeoPoint => ({ lon: p[0], lat: p[1] });
export function haversineDistance(a: GeoPoint, b: GeoPoint): number {
  return distance(point(coordinates(a)), point(coordinates(b)), {
    units: 'kilometers',
  });
}
export function nearestPoint<T extends { location: GeoPoint }>(
  origin: GeoPoint,
  values: T[],
): T | undefined {
  return values.reduce<T | undefined>(
    (best, value) =>
      !best ||
      haversineDistance(origin, value.location) <
        haversineDistance(origin, best.location)
        ? value
        : best,
    undefined,
  );
}
export function pointInPolygon(location: GeoPoint, geometry: Polygon): boolean {
  return booleanPointInPolygon(point(coordinates(location)), feature(geometry));
}
export function lineIntersectsPolygon(
  line: LineString,
  polygon: Polygon,
): boolean {
  // Handles tangency, containment and polygon holes. Vertex-only checks miss crossings.
  return booleanIntersects(feature(line), feature(polygon));
}
export function lineWithinWater(line: LineString, water: Polygon): boolean {
  return booleanWithin(feature(line), feature(water));
}
export function distanceToBoundary(
  location: GeoPoint,
  polygon: Polygon,
): number {
  const boundary = polygonToLine(feature(polygon));
  const parts =
    boundary.type === 'FeatureCollection' ? boundary.features : [boundary];
  return Math.min(
    ...parts.flatMap((part) => {
      const lines =
        part.geometry.type === 'LineString'
          ? [part.geometry.coordinates]
          : part.geometry.coordinates;
      return lines.map((ring) =>
        pointToLineDistance(point(coordinates(location)), lineString(ring), {
          units: 'kilometers',
        }),
      );
    }),
  );
}
export function routeLength(geometry: LineString): number {
  return length(feature(geometry), { units: 'kilometers' });
}
export function sampleRoute(
  geometry: LineString,
  spacingKm = 1,
): { location: GeoPoint; distanceKm: number }[] {
  if (!Number.isFinite(spacingKm) || spacingKm <= 0)
    throw new Error('Sample spacing must be positive');
  const total = routeLength(geometry);
  const count = Math.max(1, Math.ceil(total / spacingKm));
  if (count > 10000) throw new Error('Route exceeds sampling limit');
  return Array.from({ length: count + 1 }, (_, i) => ({
    location: asPoint(
      along(feature(geometry), (total * i) / count, { units: 'kilometers' })
        .geometry.coordinates,
    ),
    distanceKm: (total * i) / count,
  }));
}
export function aggregateRouteRisk(
  samples: Pick<RouteSample, 'risk' | 'distanceKm'>[],
): { meanRisk: number; maxRisk: number } {
  if (!samples.length) return { meanRisk: 1, maxRisk: 1 };
  const maxRisk = Math.max(...samples.map((s) => s.risk));
  const total = samples.at(-1)!.distanceKm;
  if (!total) return { meanRisk: maxRisk, maxRisk };
  // Trapezoidal distance weighting prevents short final segments distorting the mean.
  const integral = samples
    .slice(1)
    .reduce(
      (sum, s, i) =>
        sum +
        ((s.distanceKm - samples[i].distanceKm) * (s.risk + samples[i].risk)) /
          2,
      0,
    );
  return { meanRisk: integral / total, maxRisk };
}
