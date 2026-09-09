'use client';
import { useRef, useState } from 'react';
import type { FeatureCollection } from 'geojson';
import { MarineData } from './marine-data';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type {
  ChatResponse,
  ConversationContext,
  DecisionResponse,
  Scenario,
} from '@orca/contracts';
import {
  Anchor,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  Database,
  Fish,
  Globe2,
  LoaderCircle,
  MapPin,
  Navigation,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Waves,
  X,
} from 'lucide-react';
import { EvidencePanel } from './evidence-panel';
import { localDate, localTime, reasonLabel } from './format';
import { DataStatusBadge } from './data-status-badge';
import { VoiceChatControl, AudioPlayer } from './voice-chat-control';
import { PFZRecommendationCard } from './pfz-recommendation-card';
import { SafetyCard } from './safety-card';
import { RouteComparisonCard } from './route-comparison-card';
import { SimulationWidget } from './simulation-widget';
import { GeofenceAlertBanner } from './geofence-alert';
import { MapLegend } from './map-legend';
import {
  marineApi,
  type RankedPFZCandidate,
  type RiskAssessment,
  type RouteComparison,
  type GeofenceStatus,
  type Location,
  type MapActionPayload,
} from '@/services/marine-api';

const PRESET_LOCATIONS: { name: string; lat: number; lon: number }[] = [
  { name: 'Nagapattinam', lat: 10.767, lon: 79.872 },
  { name: 'Chennai', lat: 13.0827, lon: 80.2707 },
  { name: 'Tuticorin', lat: 8.7642, lon: 78.1348 },
  { name: 'Kochi', lat: 9.9312, lon: 76.2673 },
  { name: 'Veraval', lat: 20.9008, lon: 70.3664 },
  { name: 'Visakhapatnam', lat: 17.6868, lon: 83.2185 },
];

const MarineMap = dynamic(
  () => import('./marine-map').then((module) => module.MarineMap),
  {
    ssr: false,
    loading: () => <div className="map-loading">Loading marine map…</div>,
  },
);
export const DEMO_QUERY =
  'I am leaving from Nagapattinam tomorrow at 5 AM. Where should I fish and what is the safest route?';
const SCENARIOS: { id: Scenario; label: string; description: string }[] = [
  {
    id: 'normal',
    label: 'Normal conditions',
    description: 'Baseline synthetic replay',
  },
  {
    id: 'high-waves',
    label: 'High waves',
    description: 'Elevated waves around Zone B',
  },
  {
    id: 'restricted-route',
    label: 'Zone B closure',
    description: 'Additional forbidden polygon at Zone B',
  },
  {
    id: 'api-failure',
    label: 'Provider failure',
    description: 'Marine readings unavailable',
  },
];
export function Dashboard({
  initialDecision,
  initialContext,
}: {
  initialDecision: DecisionResponse;
  initialContext: ConversationContext;
}) {
  const [decision, setDecision] = useState(initialDecision);
  const [context, setContext] = useState(initialContext);
  const [message, setMessage] = useState(DEMO_QUERY);
  const [scenario, setScenario] = useState<Scenario>('normal');
  const [selectedZone, setSelectedZone] = useState(
    initialDecision.recommendation.candidateZoneId ?? 'zone-a',
  );
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [lastQuery, setLastQuery] = useState(DEMO_QUERY);
  const controller = useRef<AbortController | null>(null);

  // Part 4 State
  const [currentLocation, setCurrentLocation] = useState<Location>({ lat: 10.767, lon: 79.872 });
  const [gpsActive, setGpsActive] = useState(false);
  const [recommendedPFZ, setRecommendedPFZ] = useState<RankedPFZCandidate | null>(null);
  const [allPFZCandidates, setAllPFZCandidates] = useState<RankedPFZCandidate[]>([]);
  const [safetyRisk, setSafetyRisk] = useState<RiskAssessment | null>(null);
  const [routeComparison, setRouteComparison] = useState<RouteComparison | null>(null);
  const [geofenceStatus, setGeofenceStatus] = useState<GeofenceStatus | null>(null);
  const [marineLayer, setMarineLayer] = useState<FeatureCollection>({ type: 'FeatureCollection', features: [] });
  const [backendAnswer, setBackendAnswer] = useState('');
  const sessionId = useRef<string | undefined>(undefined);
  const [mapActions, setMapActions] = useState<MapActionPayload[]>([]);

  const result = decision.recommendation;
  const zone = decision.zones.find((z) => z.id === result.candidateZoneId);
  const route = decision.routes.find((r) => r.id === result.routeId);
  const inspected = decision.zones.find((z) => z.id === selectedZone);
  const isSuccess =
    result.status === 'RECOMMENDED' || result.status === 'CAUTION';
  const elapsed = decision.agentTrace.reduce((sum, t) => sum + t.durationMs, 0);

  // Location selector handler
  function handlePresetLocation(preset: { name: string; lat: number; lon: number }) {
    setCurrentLocation({ lat: preset.lat, lon: preset.lon });
    const newMsg = `I am departing from ${preset.name}. Where should I fish and what is the safest route?`;
    setMessage(newMsg);
    void submit(newMsg, scenario, false, { lat: preset.lat, lon: preset.lon });
  }

  // Live GPS tracking
  function toggleGps() {
    if (!navigator.geolocation) {
      setNotice('Geolocation is not supported by your browser.');
      return;
    }
    if (gpsActive) {
      setGpsActive(false);
      return;
    }
    setGpsActive(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLoc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setCurrentLocation(userLoc);
        const msg = `What is the marine risk and nearest safe fishing zone from my current GPS position (${userLoc.lat.toFixed(3)}, ${userLoc.lon.toFixed(3)})?`;
        setMessage(msg);
        void submit(msg, scenario, false, userLoc);
      },
      (err) => {
        setGpsActive(false);
        setNotice(`GPS error: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function submit(
    query = message,
    nextScenario = scenario,
    reset = false,
    queryLocation = currentLocation,
  ) {
    if (!query.trim() || pending) return;
    controller.current?.abort();
    controller.current = new AbortController();
    setPending(true);
    setNotice('');
    setBackendAnswer('');
    setRecommendedPFZ(null);
    setAllPFZCandidates([]);
    setSafetyRisk(null);
    setRouteComparison(null);
    setGeofenceStatus(null);
    setMapActions([]);
    const timeout = setTimeout(() => controller.current?.abort(), 40000);
    try {
      // Scenario controls explicitly run the labelled legacy replay.
      if (reset) {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          scenario: nextScenario,
          language: 'en',
          context: reset ? undefined : context,
        }),
        signal: controller.current.signal,
      });
      const body: ChatResponse = await response.json();
      if (!response.ok || body.status === 'ERROR')
        throw new Error('answer' in body ? body.answer : 'Analysis failed');
      if (body.status === 'COMPLETE') {
        setDecision(body.decision);
        setContext(body.context);
        setSelectedZone(
          body.decision.recommendation.candidateZoneId ??
            body.decision.zones[0]?.id ??
            '',
        );
        setLastQuery(query);
        setMessage(query);
      } else {
        setNotice(body.answer);
        setContext(body.context);
      }

      }
      // User queries go directly to the marine backend with persistent context.
      try {
        const agentChat = await marineApi.chat({
          message: query,
          location: queryLocation,
          language: 'en',
          session_id: reset ? undefined : sessionId.current,
        }, controller.current.signal);
        sessionId.current = agentChat.session_id;
        setLastQuery(query);
        setMessage(query);
        setBackendAnswer(agentChat.answer);
        setMapActions(agentChat.map_actions);
        setNotice(agentChat.warnings.join(' · '));
        setRecommendedPFZ(agentChat.data.ranked_pfz ?? null);
        setAllPFZCandidates(agentChat.data.ranked_pfz_candidates ?? []);
        if (agentChat.risk) {
          setSafetyRisk(agentChat.risk.risk);
        }
        if (agentChat.route_comparison) {
          setRouteComparison(agentChat.route_comparison);
        }
        if (agentChat.geofence) {
          setGeofenceStatus(agentChat.geofence);
        }
      } catch (error) {
        setBackendAnswer('Backend analysis unavailable. The scenario metrics below remain a demo replay.');
        setNotice(error instanceof Error ? error.message : 'Backend analysis unavailable');
      }
    } catch (error) {
      setNotice(
        error instanceof Error && error.name === 'AbortError'
          ? 'Analysis timed out. Retry the request.'
          : error instanceof Error
            ? error.message
            : 'The analysis could not be completed.',
      );
    } finally {
      clearTimeout(timeout);
      setPending(false);
    }
  }
  function scenarioChanged(value: Scenario) {
    setScenario(value);
    void submit(DEMO_QUERY, value, true);
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#query">
        Skip to trip planner
      </a>
      <header className="topbar">
        <Link
          className="brand"
          href="/"
          aria-label="ORCA Marine intelligence home"
        >
          <span className="brand-symbol">
            <Waves size={25} />
          </span>
          <strong>
            ORCA<span>MARINE INTELLIGENCE</span>
          </strong>
        </Link>
        <nav aria-label="Workspace">
          <span className="nav-active">Trip intelligence</span>
          <a href="#comparison">Route comparison</a>
          <a href="#evidence">Evidence</a>
        </nav>
        <div className="flex items-center gap-3">
          <DataStatusBadge />
          <div className="header-status">
            <span className="status-dot" />
            <span>
              {pending
                ? 'Retrieving demo evidence'
                : decision.agentTrace.some((agent) => agent.status === 'FAILED')
                  ? 'Demo source unavailable'
                  : 'Demo providers ready'}
            </span>
            <span className="language">
              <Globe2 size={14} /> EN
            </span>
          </div>
        </div>
      </header>
      <div className="replay-banner">
        <span>
          <span className="badge demo">DEMO REPLAY</span> Synthetic observations
          & routes. Prototype scores; not for navigation.
        </span>
        <span>
          <Clock3 size={12} /> Replay clock: 06 Sep 2026 · 12:00 IST
        </span>
      </div>
      <main>
        <div className="workspace-heading">
          <div>
            <span className="eyebrow">OCEAN CONTEXT. INFORMED DECISIONS.</span>
            <h1>Your next voyage, reasoned.</h1>
          </div>
          <div className="scenario-control">
            <SlidersHorizontal size={15} />
            <label htmlFor="scenario">Scenario</label>
            <select
              id="scenario"
              value={scenario}
              disabled={pending}
              onChange={(e) => scenarioChanged(e.target.value as Scenario)}
            >
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              className="icon-button"
              aria-label="Reset demo"
              disabled={pending}
              onClick={() => {
                setScenario('normal');
                void submit(DEMO_QUERY, 'normal', true);
              }}
            >
              <RotateCcw size={15} />
            </button>
          </div>
        </div>
        <div className="intelligence-workspace">
          <aside
            className="conversation-panel"
            aria-label="Trip planner and agent execution"
          >
            <div className="panel-title">
              <span className="eyebrow">TRIP PLANNER</span>
              <span className="small-tag">01 / NAGAPATTINAM</span>
            </div>
            {/* Preset Coastal Ports & GPS Selector */}
            <div className="flex flex-wrap items-center gap-1.5 mb-2 text-xs">
              <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">
                Port:
              </span>
              {PRESET_LOCATIONS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => handlePresetLocation(p)}
                  disabled={pending}
                  className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                    currentLocation.lat === p.lat && currentLocation.lon === p.lon
                      ? 'bg-sky-500 text-white font-semibold'
                      : 'bg-white/5 hover:bg-white/10 text-white/70'
                  }`}
                >
                  {p.name}
                </button>
              ))}
              <button
                type="button"
                onClick={toggleGps}
                disabled={pending}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors flex items-center gap-1 ${
                  gpsActive
                    ? 'bg-emerald-500 text-white font-semibold animate-pulse'
                    : 'bg-white/5 hover:bg-white/10 text-white/70'
                }`}
                title="Detect live GPS position"
              >
                <MapPin size={11} />
                {gpsActive ? 'GPS Active' : 'Live GPS'}
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
              className="query-form"
            >
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="query">Where are we heading?</label>
                <VoiceChatControl
                  onTranscript={(text) => {
                    setMessage(text);
                    void submit(text);
                  }}
                  disabled={pending}
                />
              </div>
              <textarea
                id="query"
                maxLength={2000}
                value={message}
                disabled={pending}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
              />
              <button
                className="primary-button"
                type="submit"
                disabled={pending || !message.trim()}
              >
                {pending ? (
                  <>
                    <LoaderCircle className="spinner" size={16} />
                    Analyzing evidence…
                  </>
                ) : (
                  <>
                    Run analysis
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
            <div className="query-chips">
              <button
                disabled={pending}
                onClick={() => void submit('Why not the nearest fishing zone?')}
              >
                Why not the nearest?
                <ArrowUpRight size={12} />
              </button>
              <button
                disabled={pending}
                onClick={() => void submit('What if I leave 3 hours later?')}
              >
                Leave 3 hours later
                <ArrowUpRight size={12} />
              </button>
            </div>
            {notice && (
              <div role="alert" className="request-notice">
                {notice}
                <span>
                  Marine data warnings apply to the backend answer. Scenario metrics remain a labelled replay.
                </span>
              </div>
            )}
            <div className="trip-context">
              <div>
                <MapPin size={15} />
                <span>
                  Departure<strong>{decision.plan.origin.name}</strong>
                </span>
              </div>
              <div>
                <Clock3 size={15} />
                <span>
                  {localDate(decision.plan.departureTime)}
                  <strong>{localTime(decision.plan.departureTime)} IST</strong>
                </span>
              </div>
            </div>
            <div className="trace-heading">
              <h2>Reasoning trail</h2>
              <span>
                {pending ? 'RUNNING' : Math.round(elapsed) + ' ms · tool time'}
              </span>
            </div>
            <ol className="agent-trace" aria-label="Completed tool execution">
              {decision.agentTrace.map((agent, index) => (
                <li key={agent.id}>
                  <span
                    className={
                      'trace-icon ' +
                      (agent.status === 'FAILED' ? 'failed' : '')
                    }
                  >
                    {agent.status === 'FAILED' ? (
                      <X size={11} />
                    ) : (
                      <Check size={11} />
                    )}
                  </span>
                  <details>
                    <summary>
                      <span>{agent.name}</span>
                      <small>{String(index + 1).padStart(2, '0')}</small>
                    </summary>
                    <p>{agent.summary}</p>
                    <code>{agent.tool}</code>
                    <p>
                      {agent.status} · {agent.durationMs} ms
                    </p>
                  </details>
                </li>
              ))}
            </ol>
            <div className="trace-footnote">
              <span className="status-dot" />
              Actual service calls · Deterministic rules
            </div>
          </aside>
          <div className="map-workspace relative">
            {geofenceStatus && (
              <div className="absolute top-4 left-4 right-4 z-20">
                <GeofenceAlertBanner status={geofenceStatus} />
              </div>
            )}
            <MarineMap decision={decision} onSelectZone={setSelectedZone} currentLocation={currentLocation} onLocation={setCurrentLocation} marineLayer={marineLayer} mapActions={mapActions} />
            <MapLegend />
            <div
              className={
                'map-recommendation ' + (!isSuccess ? 'no-recommendation' : '')
              }
            >
              <span className="recommendation-icon">
                {isSuccess ? <Navigation size={21} /> : <Waves size={21} />}
              </span>
              <div>
                <span className="eyebrow">
                  {isSuccess
                    ? 'RECOMMENDED IN THIS REPLAY'
                    : result.status.replaceAll('_', ' ')}
                </span>
                <strong>
                  {zone
                    ? zone.name + ' · ' + (route?.name ?? '')
                    : 'No feasible trip recommendation'}
                </strong>
                <p>
                  {route
                    ? 'Avoids restricted areas · ' +
                      route.distanceKm.toFixed(1) +
                      ' km · ' +
                      route.etaMinutes +
                      ' min at assumed demo speed'
                    : 'Required evidence or safety conditions are not satisfied.'}
                </p>
              </div>
              <a href="#comparison" aria-label="View recommendation comparison">
                <ArrowDown size={18} />
              </a>
            </div>
          </div>
        </div>
        <section
          className="metric-strip"
          aria-label="Computed recommendation metrics"
        >
          {[
            {
              label: 'Voyage safety',
              value: result.safetyScore,
              unit: '/100',
              note: 'Worst sampled route score',
              icon: ShieldCheck,
            },
            {
              label: 'Fishing opportunity',
              value: result.opportunityScore,
              unit: '/100',
              note: 'Relative score · not catch probability',
              icon: Fish,
            },
            {
              label: 'Route distance',
              value: route?.distanceKm.toFixed(1),
              unit: 'km',
              note: route
                ? route.etaMinutes + ' min · assumed 12 km/h'
                : 'No feasible route',
              icon: Navigation,
            },
            {
              label: 'Evidence confidence',
              value: zone ? Math.round(result.confidence * 100) : undefined,
              unit: '%',
              note: 'Coverage & quality · not accuracy',
              icon: Database,
            },
          ].map((metric) => (
            <article key={metric.label}>
              <div className="metric-label">
                <metric.icon size={16} />
                {metric.label}
              </div>
              <p>
                {metric.value ?? '—'}
                <span>{metric.value !== undefined ? metric.unit : ''}</span>
              </p>
              <small>{metric.note}</small>
            </article>
          ))}
        </section>
        <div className="results-grid" id="comparison">
          <section className="decision-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">THE DECISION, EXPLAINED</span>
                <h2>
                  {zone ? 'Why ' + zone.name + '?' : 'Why no recommendation?'}
                </h2>
              </div>
              <span
                className={'badge ' + (isSuccess ? 'positive' : 'negative')}
              >
                {result.status.replaceAll('_', ' ')}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="answer font-medium" aria-live="polite">
                {backendAnswer || decision.answer}
              </p>
              <AudioPlayer text={backendAnswer || decision.answer} language="en" />
            </div>

            {/* Part 4 Deterministic Safety Assessment Card */}
            {safetyRisk && (
              <div className="my-3">
                <SafetyCard risk={safetyRisk} locationName={decision.plan.origin.name} />
              </div>
            )}

            {/* Part 4 Safe PFZ Recommendation Card */}
            {recommendedPFZ && (
              <div className="my-3">
                <PFZRecommendationCard
                  candidate={recommendedPFZ}
                  allCandidates={allPFZCandidates}
                  onSelectCandidate={(c) => {
                    setRecommendedPFZ(c);
                  }}
                  onShowSafeRoute={(c) => {
                    void submit(`What is the safest navigation route to ${c.name}?`);
                  }}
                />
              </div>
            )}

            <ul className="decision-reasons">
              {decision.reasons.map((reason) => (
                <li key={reason}>
                  {isSuccess ? <Check size={14} /> : <X size={14} />}
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
            <details className="method-details">
              <summary>
                Scoring method & limitations
                <ChevronRight size={14} />
              </summary>
              <p>
                Safety weights: waves 30%, wind 20%, alerts 20%, currents 10%,
                restricted boundaries 15%, uncertainty 5%. Hard gates override
                scores. Routes are sampled every 1 km or less at an assumed 12
                km/h.
              </p>
              <p>
                Opportunity combines fishing-zone signal, temperature,
                chlorophyll and an additional demo signal. Confidence is
                coverage × freshness × quality × consistency. These prototype
                parameters have not been validated against real voyages or
                catches.
              </p>
              <p>
                Route cost prioritizes mean and maximum risk over distance. Only
                the supplied direct and waypoint routes are compared. This is
                not a global shortest-path search.
              </p>
              {decision.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </details>
          </section>
          <section className="comparison-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">SAFETY BEFORE PROXIMITY</span>
                <h2>Compare fishing zones</h2>
              </div>
              <span className="small-tag">
                {decision.zones.length} CANDIDATES
              </span>
            </div>
            <div className="table-scroll">
              <table>
                <caption className="sr-only">
                  Candidate zone scores, distance and rejection reasons
                </caption>
                <thead>
                  <tr>
                    <th>Fishing zone</th>
                    <th>Direct km</th>
                    <th>Zone safety</th>
                    <th>Opportunity</th>
                    <th>Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {[...decision.zones]
                    .sort((a, b) => a.id.localeCompare(b.id))
                    .map((z) => (
                      <tr
                        key={z.id}
                        className={z.id === selectedZone ? 'selected-row' : ''}
                      >
                        <th>
                          <button
                            onClick={() => setSelectedZone(z.id)}
                            aria-pressed={z.id === selectedZone}
                          >
                            <span
                              className={
                                'table-zone ' +
                                (z.id === zone?.id
                                  ? 'green'
                                  : z.rejected
                                    ? 'orange'
                                    : '')
                              }
                            >
                              {z.name.slice(-1)}
                            </span>
                            {z.name}
                          </button>
                        </th>
                        <td>{z.distanceKm.toFixed(1)}</td>
                        <td>
                          {z.safety.score}
                          <small>/100</small>
                        </td>
                        <td>
                          {z.opportunity.score}
                          <small>/100</small>
                        </td>
                        <td>
                          <span
                            className={
                              'table-status ' +
                              (z.rejected
                                ? 'rejected'
                                : z.id === zone?.id
                                  ? 'chosen'
                                  : '')
                            }
                          >
                            {z.rejected
                              ? 'Rejected'
                              : z.id === zone?.id
                                ? 'Selected'
                                : 'Alternative'}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {inspected && (
              <div className="zone-inspection">
                <strong>{inspected.name}</strong>
                <span>
                  {inspected.rejected
                    ? inspected.rejectionReasons.map(reasonLabel).join(' · ')
                    : 'Feasible candidate · utility ' +
                      inspected.utility.toFixed(1)}
                </span>
                <a href="#evidence">
                  Inspect evidence
                  <ArrowUpRight size={13} />
                </a>
              </div>
            )}
            <p className="table-note">
              Zone safety describes destination conditions. Voyage safety
              includes the full route.
            </p>
          </section>
        </div>
        {/* Part 4 Deterministic Route Comparison Section */}
        {routeComparison && (
          <section className="my-6">
            <RouteComparisonCard
              comparison={routeComparison}
              onSelectRoute={(selRoute) => {
                void submit(`Inspect route with distance ${selRoute.total_distance_km.toFixed(1)} km`);
              }}
            />
          </section>
        )}

        {/* Part 4 Vessel Simulation & Dynamic Reroute Section */}
        <MarineData location={currentLocation} onLocation={setCurrentLocation} onLayer={setMarineLayer} />
        <section className="my-6">
          <SimulationWidget
            origin={currentLocation}
            onVesselMove={(pos, heading) => {
              setCurrentLocation(pos);
            }}
            onRouteRecalculated={(newRoute) => {
              void submit(`Dynamic hazard encountered! Route recalculated to avoid hazard.`);
            }}
          />
        </section>

        <section className="routes-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                DISTANCE IS ONLY PART OF THE STORY
              </span>
              <h2>Route options · {inspected?.name ?? 'No destination'}</h2>
            </div>
            <span className="small-tag">DETERMINISTIC WAYPOINTS</span>
          </div>
          <div className="route-options">
            {decision.routes
              .filter((r) => r.zoneId === selectedZone)
              .map((r) => (
                <article
                  key={r.id}
                  className={
                    'route-option ' + (r.id === route?.id ? 'recommended' : '')
                  }
                >
                  <div className="route-option-title">
                    <span className="route-name">
                      <Navigation size={17} />
                      {r.name}
                    </span>
                    <span
                      className={
                        'badge ' + (r.rejected ? 'negative' : 'positive')
                      }
                    >
                      {r.rejected
                        ? 'REJECTED'
                        : r.id === route?.id
                          ? 'RECOMMENDED'
                          : 'FEASIBLE'}
                    </span>
                  </div>
                  <div className="route-numbers">
                    <span>
                      <strong>{r.distanceKm.toFixed(1)}</strong>km
                    </span>
                    <span>
                      <strong>{r.safetyScore}</strong>/100 safety
                    </span>
                    <span>
                      <strong>{r.etaMinutes}</strong>min
                    </span>
                  </div>
                  <p>
                    {r.rejected
                      ? r.rejectionReasons.map(reasonLabel).join(' · ')
                      : 'No hard gate triggered. No restricted-area intersection.'}
                  </p>
                  <details>
                    <summary>Risk & cost breakdown</summary>
                    <dl className="route-factors">
                      <div>
                        <dt>Mean / peak risk</dt>
                        <dd>
                          {r.meanRisk.toFixed(3)} / {r.maxRisk.toFixed(3)}
                        </dd>
                      </div>
                      <div>
                        <dt>Cost</dt>
                        <dd>
                          {r.routeCost === null
                            ? 'Infeasible'
                            : r.routeCost.toFixed(3)}
                        </dd>
                      </div>
                      <div>
                        <dt>Samples / confidence</dt>
                        <dd>
                          {r.samples.length} / {Math.round(r.confidence * 100)}%
                        </dd>
                      </div>
                      <div>
                        <dt>Hazard / restricted crossings</dt>
                        <dd>
                          {r.hazardIntersections.length} /{' '}
                          {r.boundaryIntersections.length}
                        </dd>
                      </div>
                    </dl>
                  </details>
                </article>
              ))}
          </div>
        </section>
        <EvidencePanel decision={decision} zoneId={selectedZone} />

        {/* Safety Disclaimer */}
        <div className="my-6 p-4 rounded-xl border border-white/10 bg-black/40 text-center text-xs text-white/60 space-y-1">
          <p className="font-semibold text-white/80">
            Official Marine Safety & Decision-Support Notice
          </p>
          <p>
            SamudraAI / ORCA is an intelligent decision-support prototype. Official INCOIS / IMD marine advisories, port alerts, and maritime authority instructions take absolute precedence. Not intended as sole means of nautical navigation.
          </p>
        </div>

        <footer>
          <span>
            <Anchor size={14} /> ORCA · SIH 26176
          </span>
          <span>
            Route analysis is a synthetic replay · Marine data mode is labelled separately
          </span>
          <a href="/api/v1/system/status" target="_blank" rel="noreferrer">
            Provider health & freshness
            <ArrowUpRight size={13} />
          </a>
        </footer>
        <details className="last-query">
          <summary>Query used for the displayed result</summary>
          <p>{lastQuery}</p>
          <p>
            {SCENARIOS.find((s) => s.id === decision.scenario)?.description}
          </p>
        </details>
      </main>
    </div>
  );
}
