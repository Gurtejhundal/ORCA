import { describe, expect, it } from 'vitest';
import type { LineString, Polygon } from 'geojson';
import {
  aggregateRouteRisk,
  distanceToBoundary,
  haversineDistance,
  lineIntersectsPolygon,
  lineWithinWater,
  nearestPoint,
  pointInPolygon,
  sampleRoute,
} from '@orca/geo';

const square: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
  ],
};
const line = (coordinates: number[][]): LineString => ({
  type: 'LineString',
  coordinates,
});
describe('geospatial operations', () => {
  it('matches the known equatorial one-degree distance', () =>
    expect(
      haversineDistance({ lat: 0, lon: 0 }, { lat: 0, lon: 1 }),
    ).toBeCloseTo(111.195, 2));
  it('returns zero for the same point', () =>
    expect(haversineDistance({ lat: 10, lon: 80 }, { lat: 10, lon: 80 })).toBe(
      0,
    ));
  it('selects nearest point and handles empty input', () => {
    expect(
      nearestPoint({ lat: 0, lon: 0 }, [
        { id: 'far', location: { lat: 0, lon: 2 } },
        { id: 'near', location: { lat: 0, lon: 1 } },
      ])?.id,
    ).toBe('near');
    expect(nearestPoint({ lat: 0, lon: 0 }, [])).toBeUndefined();
  });
  it.each([
    [0.5, 0.5, true],
    [1.5, 1.5, false],
    [0, 0, true],
  ])('point %s,%s containment is %s', (lon, lat, inside) => {
    expect(
      pointInPolygon({ lat: lat as number, lon: lon as number }, square),
    ).toBe(inside);
  });
  it('detects crossing with both endpoints outside', () =>
    expect(
      lineIntersectsPolygon(
        line([
          [-1, 0.5],
          [2, 0.5],
        ]),
        square,
      ),
    ).toBe(true));
  it('detects a line entirely inside the restricted polygon', () =>
    expect(
      lineIntersectsPolygon(
        line([
          [0.2, 0.2],
          [0.8, 0.8],
        ]),
        square,
      ),
    ).toBe(true));
  it('detects boundary tangency', () =>
    expect(
      lineIntersectsPolygon(
        line([
          [-1, 0],
          [2, 0],
        ]),
        square,
      ),
    ).toBe(true));
  it('allows a disjoint line', () =>
    expect(
      lineIntersectsPolygon(
        line([
          [2, 2],
          [3, 3],
        ]),
        square,
      ),
    ).toBe(false));
  it('respects polygon holes', () => {
    const hole: Polygon = {
      type: 'Polygon',
      coordinates: [
        square.coordinates[0],
        [
          [0.2, 0.2],
          [0.2, 0.8],
          [0.8, 0.8],
          [0.8, 0.2],
          [0.2, 0.2],
        ],
      ],
    };
    expect(pointInPolygon({ lat: 0.5, lon: 0.5 }, hole)).toBe(false);
    expect(
      lineIntersectsPolygon(
        line([
          [0.4, 0.4],
          [0.6, 0.6],
        ]),
        hole,
      ),
    ).toBe(false);
  });
  it('rejects routes that leave the water mask', () => {
    expect(
      lineWithinWater(
        line([
          [0.2, 0.2],
          [0.8, 0.8],
        ]),
        square,
      ),
    ).toBe(true);
    expect(
      lineWithinWater(
        line([
          [0.2, 0.2],
          [2, 2],
        ]),
        square,
      ),
    ).toBe(false);
  });
  it('measures boundary distance in kilometers', () =>
    expect(distanceToBoundary({ lat: 0.5, lon: 0.5 }, square)).toBeCloseTo(
      55.59,
      1,
    ));
  it('samples both endpoints with bounded spacing', () => {
    const samples = sampleRoute(
      line([
        [0, 0],
        [0.02, 0],
      ]),
      1,
    );
    expect(samples).toHaveLength(4);
    expect(samples[0].location.lon).toBeCloseTo(0);
    expect(samples.at(-1)!.location.lon).toBeCloseTo(0.02);
    expect(samples[1].distanceKm).toBeLessThanOrEqual(1);
  });
  it('rejects invalid sampling intervals', () =>
    expect(() =>
      sampleRoute(
        line([
          [0, 0],
          [1, 1],
        ]),
        0,
      ),
    ).toThrow());
  it('uses distance-weighted risk rather than sample counts', () => {
    expect(
      aggregateRouteRisk([
        { distanceKm: 0, risk: 0 },
        { distanceKm: 9, risk: 0 },
        { distanceKm: 10, risk: 1 },
      ]),
    ).toEqual({ meanRisk: 0.05, maxRisk: 1 });
    expect(aggregateRouteRisk([])).toEqual({ meanRisk: 1, maxRisk: 1 });
  });
});
