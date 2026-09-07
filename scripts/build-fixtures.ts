import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// All coordinates, polygons and values below are synthetic scenario inputs.
// They are not harbour, chart, INCOIS, fishing or navigation observations.
const dir = resolve('data/demo');
mkdirSync(dir, { recursive: true });
const write = (name: string, data: unknown) =>
  writeFileSync(resolve(dir, name), JSON.stringify(data, null, 2) + '\n');
const freshness = 'DEMO';
const sourceName = 'ORCA Demo Dataset';
const validFrom = '2026-09-07T00:00:00+05:30';
const validTo = '2026-09-08T00:00:00+05:30';
const observedAt = '2026-09-06T12:00:00+05:30';
const polygon = (ring: number[][]) => ({
  type: 'Polygon',
  coordinates: [ring],
});
const box = (w: number, s: number, e: number, n: number) =>
  polygon([
    [w, s],
    [e, s],
    [e, n],
    [w, n],
    [w, s],
  ]);
const origin = {
  name: 'Nagapattinam',
  lat: 10.767,
  lon: 79.872,
  freshness,
  sourceName,
};
write('origin.json', origin);
const zones = [
  { id: 'zone-a', name: 'Zone A', lon: 80.005, lat: 10.78 },
  { id: 'zone-b', name: 'Zone B', lon: 80.1, lat: 10.87 },
  { id: 'zone-c', name: 'Zone C', lon: 80.045, lat: 10.625 },
];
write('candidate-zones.geojson', {
  type: 'FeatureCollection',
  features: zones.map((z) => ({
    type: 'Feature',
    properties: {
      id: z.id,
      name: z.name,
      source: sourceName,
      freshness,
      evidenceIds: ['e-' + z.id + '-pfzSignal'],
    },
    geometry: { type: 'Point', coordinates: [z.lon, z.lat] },
  })),
});
write('geofences.geojson', {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        id: 'hazard-1',
        name: 'Elevated wave area',
        category: 'hazard',
        severity: 'elevated',
        sourceName,
        freshness,
        validFrom,
        validTo,
      },
      geometry: box(79.97, 10.755, 80.04, 10.81),
    },
    {
      type: 'Feature',
      properties: {
        id: 'restricted-1',
        name: 'Restricted demonstration area',
        category: 'restricted',
        severity: 'forbidden',
        sourceName,
        freshness,
        validFrom,
        validTo,
      },
      geometry: box(79.94, 10.8, 80.025, 10.85),
    },
  ],
});
write('region.json', {
  freshness,
  sourceName,
  note: 'Schematic coastline and water mask; not a nautical chart.',
  water: box(79.861, 10.54, 80.22, 11.02),
  land: polygon([
    [79.65, 10.54],
    [79.861, 10.54],
    [79.861, 11.02],
    [79.65, 11.02],
    [79.65, 10.54],
  ]),
});
write('routes.geojson', {
  type: 'FeatureCollection',
  features: zones.flatMap((z) =>
    (['direct', 'waypoint'] as const).map((kind) => ({
      type: 'Feature',
      properties: {
        id: z.id + '-' + kind,
        zoneId: z.id,
        name: kind === 'direct' ? 'Direct route' : 'Southern passage',
        kind,
        freshness,
      },
      geometry: {
        type: 'LineString',
        coordinates:
          kind === 'direct'
            ? [
                [origin.lon, origin.lat],
                [z.lon, z.lat],
              ]
            : [
                [origin.lon, origin.lat],
                [79.925, 10.726],
                [80.075, 10.726],
                [z.lon, z.lat],
              ],
      },
    })),
  ),
});
const cells = [
  {
    id: 'origin',
    lon: origin.lon,
    lat: origin.lat,
    wave: 0.7,
    wind: 4,
    sst: 28,
    chl: 1.2,
    pfz: 0.2,
  },
  {
    id: 'zone-a',
    lon: 80.005,
    lat: 10.78,
    wave: 3.6,
    wind: 14,
    sst: 28,
    chl: 1.5,
    pfz: 0.99,
  },
  {
    id: 'zone-b',
    lon: 80.1,
    lat: 10.87,
    wave: 1.1,
    wind: 5,
    sst: 28.3,
    chl: 1.4,
    pfz: 0.94,
  },
  {
    id: 'zone-c',
    lon: 80.045,
    lat: 10.625,
    wave: 0.8,
    wind: 4,
    sst: 24,
    chl: 0.4,
    pfz: 0.4,
  },
  {
    id: 'south-west',
    lon: 79.925,
    lat: 10.726,
    wave: 0.8,
    wind: 4,
    sst: 27.5,
    chl: 1.1,
    pfz: 0.4,
  },
  {
    id: 'south-middle',
    lon: 80.005,
    lat: 10.715,
    wave: 0.9,
    wind: 5,
    sst: 27.8,
    chl: 1.2,
    pfz: 0.4,
  },
  {
    id: 'south-east',
    lon: 80.075,
    lat: 10.726,
    wave: 0.9,
    wind: 5,
    sst: 27.8,
    chl: 1.2,
    pfz: 0.4,
  },
  {
    id: 'east',
    lon: 80.1,
    lat: 10.815,
    wave: 1.0,
    wind: 5,
    sst: 28,
    chl: 1.3,
    pfz: 0.5,
  },
];
write(
  'marine-snapshots.json',
  cells.flatMap((c) => {
    const values: Record<string, [number, string]> = {
      waveHeightM: [c.wave, 'm'],
      wavePeriodS: [7, 's'],
      waveDirectionDeg: [110, 'deg'],
      windSpeedMs: [c.wind, 'm/s'],
      currentSpeedMs: [0.3, 'm/s'],
      alertSeverity: [0, 'level'],
      sstC: [c.sst, '°C'],
      chlorophyllMgM3: [c.chl, 'mg/m³'],
      pfzSignal: [c.pfz, 'index'],
      otherSignal: [0.8, 'index'],
    };
    return Object.entries(values).map(([variable, [value, unit]]) => ({
      id: 'e-' + c.id + '-' + variable,
      variable,
      value,
      unit,
      location: { lat: c.lat, lon: c.lon },
      validFrom,
      validTo,
      observedAt,
      fetchedAt: observedAt,
      sourceName,
      freshness,
      quality: 0.96,
    }));
  }),
);
write('advisories.json', [
  {
    id: 'demo-disclosure',
    freshness,
    sourceName,
    validFrom,
    validTo,
    text: 'Synthetic replay. Scores use unvalidated prototype parameters. Routes are demonstration waypoints, not navigational directions.',
  },
]);
console.log('Wrote deterministic DEMO fixtures to ' + dir);
