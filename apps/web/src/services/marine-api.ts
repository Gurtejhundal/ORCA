import type { FeatureCollection, Geometry } from 'geojson';

export type Location = { lat: number; lon: number };
export type Observation = {
  parameter: string; value: number | null; unit: string | null;
  source: string; source_reference: string | null; quality: string;
  forecast_time: string | null; observation_time: string | null;
  fetched_at: string; expires_at: string; freshness_minutes: number;
  is_stale: boolean; mode: 'demo' | 'live'; location: Location;
};
export type Conditions = {
  mode: 'demo' | 'live'; status: string; forecast_time: string;
  conditions: Record<string, Observation>; sources: string[]; missing_sources: string[];
};
export type PFZ = {
  id: string; name: string; geometry: Geometry; distance_km: number | null;
  source: string; source_reference: string; valid_from: string; valid_until: string;
  fetched_at: string; freshness_minutes: number; is_stale: boolean; mode: string;
};
export type NearestPFZ = { mode: string; status: string; results: PFZ[]; missing_sources: string[]; replay_time: string | null };
export type Alerts = { mode: string; status: string; alerts: { id: string; title: string; source: string; valid_until: string }[]; missing_sources: string[] };

async function apiError(response: Response, path: string): Promise<Error> {
  const body = await response.json().catch(() => null);
  const detail = typeof body?.detail === 'string' ? body.detail : 'Request failed';
  return new Error(`Marine API ${response.status} (${path}): ${detail}`);
}

async function get<T>(path: string, params: Record<string, string | number> = {}, signal?: AbortSignal): Promise<T> {
  const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const response = await fetch(`/api/v1/${path}?${query}`, {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(40000)]) : AbortSignal.timeout(40000),
    cache: 'no-store',
  });
  if (!response.ok) throw await apiError(response, path);
  return response.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(40000)]) : AbortSignal.timeout(40000),
    cache: 'no-store',
  });
  if (!response.ok) throw await apiError(response, path);
  return response.json() as Promise<T>;
}

async function postFormData<T>(path: string, formData: FormData, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/v1/${path}`, {
    method: 'POST',
    body: formData,
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(40000)]) : AbortSignal.timeout(40000),
    cache: 'no-store',
  });
  if (!response.ok) throw await apiError(response, path);
  return response.json() as Promise<T>;
}

export type EvidenceItem = {
  id: string;
  parameter: string;
  value: unknown;
  unit: string | null;
  location: { lat: number; lon: number };
  source: string;
  forecast_time?: string;
  fetched_at: string;
  freshness_minutes: number;
  quality: string;
  is_stale: boolean;
};

export type MapActionPayload = {
  action: 'ADD_LAYER' | 'REMOVE_LAYER' | 'CLEAR_LAYER' | 'FOCUS_LOCATION' | 'SHOW_MARKERS' | 'SHOW_HAZARD_ZONE' | 'HIGHLIGHT_REGION' | 'FIT_BOUNDS' | 'DRAW_ROUTE' | 'UPDATE_VESSEL' | 'SHOW_GEOFENCE_WARNING';
  id?: string;
  layer?: string;
  lat?: number;
  lon?: number;
  zoom?: number;
  markers?: Array<{ id: string; title: string; position: { lat: number; lng: number }; label?: string }>;
  data?: unknown;
  geojson?: unknown;
  position?: { lat: number; lon: number };
  heading?: number;
  speed?: number;
  title?: string;
};

export type ChatRequestPayload = {
  message: string;
  session_id?: string;
  location?: Location;
  language?: string;
  developer_mode?: boolean;
};

export type ChatResponsePayload = {
  session_id: string;
  answer: string;
  language: string;
  intent: string;
  location?: Location | null;
  data: Record<string, unknown> & {
    ranked_pfz?: RankedPFZCandidate | null;
    ranked_pfz_candidates?: RankedPFZCandidate[];
  };
  recommended_pfz?: Record<string, unknown> | null;
  risk?: SafetyAnalysisResponse | null;
  route?: Record<string, unknown> | null;
  route_comparison?: RouteComparison | null;
  geofence?: GeofenceStatus | null;
  warnings: string[];
  evidence: EvidenceItem[];
  sources: string[];
  confidence: number;
  map_actions: MapActionPayload[];
  status: 'success' | 'partial' | 'failed';
  run_id: string;
};

export type TranscriptionResult = {
  text: string;
  language: string;
  confidence: number;
  provider: string;
};

export type SynthesisResult = {
  audio_base64: string | null;
  audio_format: string;
  audio_url: string | null;
  provider: string;
};

export type AgentRunTrace = {
  id: string;
  session_id: string;
  query: string;
  intent: string | null;
  plan: Record<string, unknown> | null;
  tool_calls: Array<{ task_id: string; agent: string; action: string; status: string; duration_ms: number }>;
  sources: string[];
  evidence_count: number;
  created_at: string | null;
};

// Part 3 Risk, Routing, Geofencing, Simulation Types
export type RiskAssessment = {
  score: number;
  level: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME' | 'UNKNOWN';
  factors: Array<{ factor: string; contribution: number; finding: string }>;
  official_overrides: Array<{ override: boolean; type: string; source: string; description: string }>;
  confidence: number;
  missing_critical_data: string[];
};

export type SafetyAnalysisResponse = {
  risk: RiskAssessment;
  confidence: number;
  factors: Array<{ factor: string; contribution: number; finding: string }>;
  official_overrides: Array<{ override: boolean; type: string; source: string; description: string }>;
  warnings: string[];
  evidence: Array<Record<string, unknown>>;
};

export type RankedPFZCandidate = {
  pfz_id: string;
  name: string;
  distance_km: number;
  risk_score: number;
  risk_level: string;
  ranking_score: number;
  rank: number;
  excluded: boolean;
  exclusion_reasons: string[];
  factors: RiskAssessment['factors'];
  geometry: import('geojson').Geometry | null;
  source: string;
};

export type PFZRankResponse = {
  ranked_candidates: RankedPFZCandidate[];
  excluded_candidates: RankedPFZCandidate[];
  confidence: number;
  evidence: EvidenceItem[];
  recommended: RankedPFZCandidate | null;
};

export type RouteSegment = {
  start: number[];
  end: number[];
  distance_km: number;
  wave_height_m: number;
  wind_speed_kts: number;
  risk_score: number;
  risk_level: string;
};

export type RouteResult = {
  route_id: string;
  origin: number[];
  destination: number[];
  total_distance_km: number;
  estimated_duration_hours: number;
  average_speed_kts: number;
  safety_score: number;
  overall_risk_score: number;
  overall_risk_level: string;
  geojson: Record<string, unknown>;
  coordinates: number[][];
  segments: RouteSegment[];
  warnings: string[];
  avoided_hazards: string[];
  calculation_time_ms: number;
};

export type RouteComparison = {
  shortest_route: RouteResult;
  safe_route: RouteResult;
  detour_distance_km: number;
  detour_percentage: number;
  extra_duration_hours: number;
  risk_reduction_score: number;
  risk_reduction_percentage: number;
  trade_off_explanation: string;
};

export type BoundaryDistance = {
  zone_id: string;
  zone_name: string;
  zone_type: string;
  severity: string;
  distance_km: number;
  is_inside: boolean;
  bearing_degrees: number;
  projected_breach_minutes?: number | null;
};

export type GeofenceWarning = {
  level: 'INFO' | 'CAUTION' | 'WARNING' | 'CRITICAL';
  zone_id: string;
  zone_name: string;
  zone_type: string;
  message: string;
  recommended_heading_degrees?: number | null;
  time_to_breach_minutes?: number | null;
};

export type GeofenceStatus = {
  status: 'SAFE' | 'CAUTION' | 'WARNING' | 'BREACH';
  current_position: Location;
  current_heading?: number | null;
  current_speed_knots?: number | null;
  boundaries: BoundaryDistance[];
  warnings: GeofenceWarning[];
  projected_trajectory: Array<{ minutes: number; lat: number; lon: number; distance_km: number }>;
  recommended_action?: string | null;
  timestamp: string;
};

export type SimulationState = {
  simulation_id: string;
  vessel_id: string;
  route_id: string;
  current_position: Location;
  current_heading: number;
  speed_knots: number;
  step_count: number;
  elapsed_time_minutes: number;
  distance_traveled_km: number;
  remaining_distance_km: number;
  progress_percentage: number;
  is_completed: boolean;
  geofence_status?: GeofenceStatus | null;
  active_warnings: string[];
  route_needs_recalculation: boolean;
  recalculated_route?: RouteResult | null;
};

export type SimulationStepResult = {
  state: SimulationState;
  map_actions: Array<Record<string, unknown>>;
  alerts: Array<Record<string, unknown>>;
};

export type DatasetFreshnessItem = {
  dataset: string;
  source: string;
  data_type: 'live' | 'near_real_time' | 'forecast' | 'satellite_observation' | 'demo';
  observation_time?: string | null;
  forecast_time?: string | null;
  fetched_at?: string | null;
  age_minutes?: number | null;
  is_stale: boolean;
  freshness_status: 'current' | 'aging' | 'stale' | 'unavailable' | 'demo';
  mode: 'live' | 'demo';
  description: string;
};

export type DataFreshnessSummary = {
  mode: 'live' | 'demo' | 'hybrid';
  system_time: string;
  datasets: Record<string, DatasetFreshnessItem>;
  overall_status: 'current' | 'aging' | 'stale' | 'unavailable' | 'demo';
  notice: string;
};

export type SystemStatusResponse = {
  backend: string;
  database: string;
  postgis: string;
  cache: string;
  mode: string;
  sources: Record<string, unknown>;
  voice: string;
  llm: string;
  freshness?: DataFreshnessSummary | null;
};

export const marineApi = {
  getNearestPFZ: (p: Location, s?: AbortSignal) => get<NearestPFZ>('pfz/nearest', p, s),
  getOceanConditions: (p: Location, s?: AbortSignal) => get<Conditions>('ocean/conditions', p, s),
  getWeather: (p: Location, s?: AbortSignal) => get<Conditions>('weather', p, s),
  getAlerts: (p: Location, s?: AbortSignal) => get<Alerts>('alerts', p, s),
  getMapLayer: (name: string, p: Location, s?: AbortSignal) => get<FeatureCollection>(`map/layer/${name}`, p, s),

  // Part 2 Conversational & Voice APIs
  chat: (payload: ChatRequestPayload, s?: AbortSignal) => post<ChatResponsePayload>('chat', payload, s),
  transcribeAudio: (audioBlob: Blob, languageHint?: string, sessionId?: string, s?: AbortSignal) => {
    const fd = new FormData();
    fd.append('audio', audioBlob, 'recording.webm');
    if (languageHint) fd.append('language_hint', languageHint);
    if (sessionId) fd.append('session_id', sessionId);
    return postFormData<TranscriptionResult>('voice/transcribe', fd, s);
  },
  speakText: (text: string, language = 'hi', s?: AbortSignal) => post<SynthesisResult>('voice/speak', { text, language }, s),
  getAgentRun: (runId: string, s?: AbortSignal) => get<AgentRunTrace>(`agents/runs/${runId}`, {}, s),

  // Part 3 Deterministic Safety, Routing, Geofencing & Simulation APIs
  analyzeSafety: (payload: { location: Location; vessel_profile?: string }, s?: AbortSignal) =>
    post<SafetyAnalysisResponse>('safety/analyze', payload, s),
  rankSafePFZ: (payload: { origin: Location; limit?: number; vessel_profile?: string }, s?: AbortSignal) =>
    post<PFZRankResponse>('pfz/rank-safe', payload, s),
  getSafeRoute: (payload: { origin: Location; destination: Location; vessel_type?: string; optimization_preference?: string }, s?: AbortSignal) =>
    post<RouteResult>('routes/safe', payload, s),
  compareRoutes: (payload: { origin: Location; destination: Location; vessel_type?: string }, s?: AbortSignal) =>
    post<RouteComparison>('routes/compare', payload, s),
  checkGeofence: (payload: { position: Location; heading_degrees?: number; speed_knots?: number }, s?: AbortSignal) =>
    post<GeofenceStatus>('geofence/check', payload, s),
  startSimulation: (payload: { route_id?: string; origin?: Location; destination?: Location; vessel_id?: string; speed_knots?: number; simulate_hazard_emergence?: boolean }, s?: AbortSignal) =>
    post<SimulationState>('simulation/start', payload, s),
  stepSimulation: (simId: string, s?: AbortSignal) =>
    post<SimulationStepResult>(`simulation/${simId}/step`, {}, s),
  stopSimulation: (simId: string, s?: AbortSignal) =>
    post<{ status: string }>(`simulation/${simId}/stop`, {}, s),

  // Part 4 System Readiness & Centralized Freshness APIs
  getSystemStatus: (s?: AbortSignal) => get<SystemStatusResponse>('system/status', {}, s),
  getDataFreshness: (s?: AbortSignal) => get<DataFreshnessSummary>('system/freshness', {}, s),
};
