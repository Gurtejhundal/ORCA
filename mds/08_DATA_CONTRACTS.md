# Data Contracts

Use common schemas so the decision engine is independent of providers.

## GeoPoint

```ts
type GeoPoint = {
  lat: number;
  lon: number;
};
```

## Evidence

```ts
type Evidence<T = unknown> = {
  id: string;
  variable: string;
  value: T;
  unit?: string;
  location?: GeoPoint;
  validFrom?: string;
  validTo?: string;
  observedAt?: string;
  fetchedAt: string;
  sourceName: string;
  sourceUrl?: string;
  freshness: "LIVE" | "CACHED" | "STATIC" | "DEMO";
  quality: number; // 0..1
};
```

## CandidateFishingZone

```ts
type CandidateFishingZone = {
  id: string;
  geometry: GeoJSON.Point | GeoJSON.Polygon;
  source: string;
  evidenceIds: string[];
  opportunityScore?: number;
  safetyScore?: number;
  rejected?: boolean;
  rejectionReasons?: string[];
};
```

## MarineSnapshot

```ts
type MarineSnapshot = {
  location: GeoPoint;
  time: string;
  sstC?: number;
  chlorophyllMgM3?: number;
  waveHeightM?: number;
  wavePeriodS?: number;
  waveDirectionDeg?: number;
  windSpeedMs?: number;
  currentSpeedMs?: number;
  currentDirectionDeg?: number;
  seaLevelM?: number;
  alertSeverity?: 0 | 1 | 2 | 3;
  evidenceIds: string[];
};
```

## RouteCandidate

```ts
type RouteCandidate = {
  id: string;
  geometry: GeoJSON.LineString;
  distanceKm: number;
  etaMinutes?: number;
  meanRisk: number;
  maxRisk: number;
  boundaryIntersections: string[];
  hazardIntersections: string[];
  routeCost: number;
};
```

## DecisionResponse

```ts
type DecisionResponse = {
  requestId: string;
  intent: string;
  recommendation: {
    status: "RECOMMENDED" | "CAUTION" | "NOT_RECOMMENDED" | "INSUFFICIENT_DATA";
    candidateZoneId?: string;
    routeId?: string;
    safetyScore?: number;
    opportunityScore?: number;
    confidence: number;
  };
  alternatives: string[];
  reasons: string[];
  warnings: string[];
  evidence: Evidence[];
  map: {
    center: GeoPoint;
    layers: unknown[];
  };
  agentTrace: {
    name: string;
    status: string;
    durationMs?: number;
  }[];
};
```
