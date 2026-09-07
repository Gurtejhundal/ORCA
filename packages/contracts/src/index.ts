import { z } from 'zod';
import type { FeatureCollection, LineString, Polygon } from 'geojson';

export const geoPointSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lon: z.number().finite().min(-180).max(180),
});
export type GeoPoint = z.infer<typeof geoPointSchema>;
export const positionSchema = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);
export const pointGeometrySchema = z.object({
  type: z.literal('Point'),
  coordinates: positionSchema,
});
export const lineGeometrySchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(positionSchema).min(2),
});
const ringSchema = z
  .array(positionSchema)
  .min(4)
  .refine(
    (ring) => ring[0][0] === ring.at(-1)![0] && ring[0][1] === ring.at(-1)![1],
    'Polygon rings must be closed',
  );
export const polygonGeometrySchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(ringSchema).min(1),
});
export const freshnessSchema = z.enum(['LIVE', 'CACHED', 'STATIC', 'DEMO']);
export type Freshness = z.infer<typeof freshnessSchema>;
export const variables = [
  'sstC',
  'chlorophyllMgM3',
  'waveHeightM',
  'wavePeriodS',
  'waveDirectionDeg',
  'windSpeedMs',
  'currentSpeedMs',
  'alertSeverity',
  'pfzSignal',
  'otherSignal',
] as const;
export const variableSchema = z.enum(variables);
export type MarineVariable = z.infer<typeof variableSchema>;
export const evidenceSchema = z
  .object({
    id: z.string().min(1),
    variable: variableSchema,
    value: z.number().finite(),
    unit: z.string(),
    location: geoPointSchema,
    validFrom: z.iso.datetime({ offset: true }),
    validTo: z.iso.datetime({ offset: true }),
    observedAt: z.iso.datetime({ offset: true }),
    fetchedAt: z.iso.datetime({ offset: true }),
    sourceName: z.string().min(1),
    sourceUrl: z.url().optional(),
    freshness: freshnessSchema,
    quality: z.number().min(0).max(1),
  })
  .refine(
    (e) => Date.parse(e.validTo) > Date.parse(e.validFrom),
    'Invalid evidence validity interval',
  );
export type Evidence = z.infer<typeof evidenceSchema>;
export type MarineSnapshot = {
  location: GeoPoint;
  time: string;
  sstC?: number;
  chlorophyllMgM3?: number;
  waveHeightM?: number;
  wavePeriodS?: number;
  waveDirectionDeg?: number;
  windSpeedMs?: number;
  currentSpeedMs?: number;
  alertSeverity?: number;
  pfzSignal?: number;
  otherSignal?: number;
  evidenceIds: string[];
};
export const candidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  geometry: pointGeometrySchema,
  source: z.string(),
  freshness: freshnessSchema,
  evidenceIds: z.array(z.string()),
});
export type CandidateFishingZone = z.infer<typeof candidateSchema>;
export const geofenceSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(['hazard', 'restricted']),
  severity: z.enum(['elevated', 'forbidden']),
  geometry: polygonGeometrySchema,
  freshness: freshnessSchema,
  sourceName: z.string(),
  validFrom: z.iso.datetime({ offset: true }),
  validTo: z.iso.datetime({ offset: true }),
});
export type Geofence = z.infer<typeof geofenceSchema>;
export const scenarioSchema = z.enum([
  'normal',
  'high-waves',
  'restricted-route',
  'api-failure',
]);
export type Scenario = z.infer<typeof scenarioSchema>;
export const contextSchema = z.object({
  originName: z.literal('Nagapattinam').optional(),
  departureTime: z.iso.datetime({ offset: true }).optional(),
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  hour: z.number().int().min(0).max(23).optional(),
  minute: z.number().int().min(0).max(59).optional(),
});
export type ConversationContext = z.infer<typeof contextSchema>;
export const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  language: z.enum(['auto', 'en']).default('en'),
  scenario: scenarioSchema.default('normal'),
  context: contextSchema.optional(),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type TripPlan = {
  intent: 'FISHING_TRIP_PLAN' | 'EXPLAIN_NEAREST';
  origin: GeoPoint & { name: string };
  departureTime: string;
  timezone: 'Asia/Kolkata';
  replayClock: string;
  tasks: { id: string; tool: string; dependsOn: string[] }[];
};
export type ParseResult =
  | { status: 'READY'; plan: TripPlan; context: ConversationContext }
  | {
      status: 'CLARIFICATION' | 'UNSUPPORTED';
      message: string;
      context: ConversationContext;
    };
export type ScoreBreakdown = {
  score: number;
  factors: Record<string, number>;
  gates: string[];
};
export type ConfidenceBreakdown = {
  score: number;
  coverage: number;
  freshness: number;
  sourceQuality: number;
  consistency: number;
  missing: MarineVariable[];
};
export type RouteSample = {
  location: GeoPoint;
  distanceKm: number;
  arrivalTime: string;
  risk: number;
  evidenceIds: string[];
  gates: string[];
};
export type RouteCandidate = {
  id: string;
  zoneId: string;
  name: string;
  kind: 'direct' | 'waypoint';
  freshness: Freshness;
  geometry: LineString;
  distanceKm: number;
  etaMinutes: number;
  meanRisk: number;
  maxRisk: number;
  safetyScore: number;
  confidence: number;
  boundaryIntersections: string[];
  hazardIntersections: string[];
  routeCost: number | null;
  costBreakdown: Record<string, number>;
  rejected: boolean;
  rejectionReasons: string[];
  samples: RouteSample[];
};
export type RankedZone = CandidateFishingZone & {
  distanceKm: number;
  snapshot: MarineSnapshot;
  safety: ScoreBreakdown;
  opportunity: ScoreBreakdown;
  confidence: ConfidenceBreakdown;
  utility: number;
  rejected: boolean;
  rejectionReasons: string[];
  bestRouteId?: string;
};
export type AgentTrace = {
  id: string;
  name: string;
  tool: string;
  status: 'COMPLETE' | 'FAILED';
  durationMs: number;
  summary: string;
};
export type ProviderResult<T> = {
  status: 'demo' | 'ok' | 'stale' | 'unavailable';
  source: string;
  fetchedAt: string;
  data: T;
  error: string | null;
};
export type MarineRequest = { start: string; end: string; scenario: Scenario };
export type FishingZoneRequest = {
  origin: GeoPoint;
  radiusKm: number;
  time: string;
};
export interface MarineProvider {
  getSnapshot(input: MarineRequest): Promise<ProviderResult<Evidence[]>>;
}
export interface FishingZoneProvider {
  getCandidates(
    input: FishingZoneRequest,
  ): Promise<ProviderResult<CandidateFishingZone[]>>;
}
export type DecisionResponse = {
  requestId: string;
  intent: TripPlan['intent'];
  plan: TripPlan;
  scenario: Scenario;
  mode: 'DEMO';
  recommendation: {
    status: 'RECOMMENDED' | 'CAUTION' | 'NOT_RECOMMENDED' | 'INSUFFICIENT_DATA';
    candidateZoneId?: string;
    routeId?: string;
    safetyScore?: number;
    opportunityScore?: number;
    confidence: number;
  };
  answer: string;
  reasons: string[];
  warnings: string[];
  alternatives: string[];
  zones: RankedZone[];
  routes: RouteCandidate[];
  evidence: Evidence[];
  geofences: Geofence[];
  map: { center: GeoPoint; layers: FeatureCollection; waterRegion: Polygon };
  agentTrace: AgentTrace[];
};
export type ChatResponse =
  | {
      status: 'COMPLETE';
      context: ConversationContext;
      decision: DecisionResponse;
    }
  | {
      status: 'CLARIFICATION' | 'UNSUPPORTED';
      context: ConversationContext;
      answer: string;
    }
  | { status: 'ERROR'; answer: string };
