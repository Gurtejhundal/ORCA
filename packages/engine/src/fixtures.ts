import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import {
  candidateSchema,
  evidenceSchema,
  geofenceSchema,
  geoPointSchema,
  lineGeometrySchema,
  polygonGeometrySchema,
} from '@orca/contracts';

const base = existsSync(resolve('data/demo/origin.json'))
  ? resolve('data/demo')
  : resolve('../../data/demo');
const read = (file: string): unknown =>
  JSON.parse(readFileSync(resolve(base, file), 'utf8'));
const featureCollection = <T extends z.ZodType>(
  properties: T,
  geometry: z.ZodType,
) =>
  z.object({
    type: z.literal('FeatureCollection'),
    features: z.array(
      z.object({ type: z.literal('Feature'), properties, geometry }),
    ),
  });
const origin = geoPointSchema
  .extend({
    name: z.literal('Nagapattinam'),
    freshness: z.literal('DEMO'),
    sourceName: z.string(),
  })
  .parse(read('origin.json'));
const candidates = featureCollection(
  candidateSchema.omit({ geometry: true }),
  candidateSchema.shape.geometry,
)
  .parse(read('candidate-zones.geojson'))
  .features.map((f) =>
    candidateSchema.parse({ ...f.properties, geometry: f.geometry }),
  );
const geofences = featureCollection(
  geofenceSchema.omit({ geometry: true }),
  polygonGeometrySchema,
)
  .parse(read('geofences.geojson'))
  .features.map((f) =>
    geofenceSchema.parse({ ...f.properties, geometry: f.geometry }),
  );
const routeProperties = z.object({
  id: z.string(),
  zoneId: z.string(),
  name: z.string(),
  kind: z.enum(['direct', 'waypoint']),
  freshness: z.literal('DEMO'),
});
const routes = featureCollection(routeProperties, lineGeometrySchema)
  .parse(read('routes.geojson'))
  .features.map((f) => ({
    ...f.properties,
    geometry: lineGeometrySchema.parse(f.geometry),
  }));
const region = z
  .object({
    freshness: z.literal('DEMO'),
    sourceName: z.string(),
    note: z.string(),
    water: polygonGeometrySchema,
    land: polygonGeometrySchema,
  })
  .parse(read('region.json'));
const evidence = z.array(evidenceSchema).parse(read('marine-snapshots.json'));
const advisories = z
  .array(
    z.object({
      id: z.string(),
      freshness: z.literal('DEMO'),
      sourceName: z.string(),
      validFrom: z.iso.datetime({ offset: true }),
      validTo: z.iso.datetime({ offset: true }),
      text: z.string(),
    }),
  )
  .parse(read('advisories.json'));

export const FIXTURES = {
  origin,
  candidates,
  geofences,
  routes,
  region,
  evidence,
  advisories,
};
