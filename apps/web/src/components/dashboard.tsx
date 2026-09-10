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
    loading: () => <div className="map-loading" aria-hidden="true"><LoaderCircle className="spinner" size={20} /></div>,
  },
);
export const DEMO_QUERY =
  'I am leaving from Nagapattinam tomorrow at 5 AM. Where should I fish and what is the safest route?';
const DASHBOARD_COPY = {
  en: {
    demoQuery: DEMO_QUERY,
    skip: 'Skip to trip planner',
    headingEyebrow: 'OCEAN CONTEXT. INFORMED DECISIONS.',
    heading: 'Your next voyage, reasoned.',
    scenario: 'Scenario',
    reset: 'Reset demo',
    planner: 'TRIP PLANNER',
    plannerLabel: 'Trip planner and agent execution',
    port: 'Port:',
    gpsTitle: 'Detect live GPS position',
    gpsActive: 'GPS Active',
    liveGps: 'Live GPS',
    destination: 'Where are we heading?',
    analyzing: 'Analyzing evidence…',
    run: 'Run analysis',
    nearest: 'Why not the nearest?',
    nearestQuery: 'Why not the nearest fishing zone?',
    later: 'Leave 3 hours later',
    laterQuery: 'What if I leave 3 hours later?',
    warningNote: 'Marine data warnings apply to the backend answer. Scenario metrics remain a labelled replay.',
    departure: 'Departure',
    reasoning: 'Reasoning trail',
    running: 'RUNNING',
    toolTime: 'ms · tool time',
    traceLabel: 'Completed tool execution',
    traceFootnote: 'Actual service calls · Deterministic rules',
    geolocationUnavailable: 'Geolocation is not supported by your browser.',
    gpsError: 'GPS error',
    backendUnavailable: 'Backend analysis unavailable. The scenario metrics below remain a demo replay.',
    backendUnavailableShort: 'Backend analysis unavailable',
    timeout: 'Analysis timed out. Retry the request.',
    analysisFailed: 'The analysis could not be completed.',
    analysisFailedShort: 'Analysis failed',
    portQuery: (name: string) => `I am departing from ${name}. Where should I fish and what is the safest route?`,
    gpsQuery: (lat: string, lon: string) => `What is the marine risk and nearest safe fishing zone from my current GPS position (${lat}, ${lon})?`,
  },
  hi: {
    demoQuery: 'मैं Nagapattinam से कल सुबह 5 बजे निकल रहा हूँ। मुझे कहाँ मछली पकड़नी चाहिए और सबसे सुरक्षित मार्ग कौन सा है?',
    skip: 'यात्रा योजनाकार पर जाएँ',
    headingEyebrow: 'समुद्री संदर्भ। सूचित निर्णय।',
    heading: 'आपकी अगली समुद्री यात्रा, तर्क सहित।',
    scenario: 'परिस्थिति',
    reset: 'डेमो रीसेट करें',
    planner: 'यात्रा योजनाकार',
    plannerLabel: 'यात्रा योजना और एजेंट प्रक्रिया',
    port: 'बंदरगाह:',
    gpsTitle: 'वर्तमान GPS स्थिति पता करें',
    gpsActive: 'GPS सक्रिय',
    liveGps: 'लाइव GPS',
    destination: 'हम कहाँ जा रहे हैं?',
    analyzing: 'प्रमाणों का विश्लेषण जारी है…',
    run: 'विश्लेषण चलाएँ',
    nearest: 'निकटतम क्षेत्र क्यों नहीं?',
    nearestQuery: 'निकटतम मछली पकड़ने का क्षेत्र क्यों नहीं चुना गया?',
    later: '3 घंटे बाद निकलें',
    laterQuery: 'अगर मैं 3 घंटे बाद निकलूँ तो क्या बदलेगा?',
    warningNote: 'समुद्री डेटा चेतावनियाँ बैकएंड उत्तर पर लागू होती हैं। परिस्थिति के आँकड़े स्पष्ट रूप से डेमो हैं।',
    departure: 'प्रस्थान',
    reasoning: 'निर्णय का आधार',
    running: 'जारी',
    toolTime: 'मि.से. · उपकरण समय',
    traceLabel: 'पूरी हुई उपकरण प्रक्रिया',
    traceFootnote: 'वास्तविक सेवा कॉल · निश्चित नियम',
    geolocationUnavailable: 'आपका ब्राउज़र स्थान सेवा का समर्थन नहीं करता।',
    gpsError: 'GPS त्रुटि',
    backendUnavailable: 'बैकएंड विश्लेषण उपलब्ध नहीं है। नीचे दिए परिस्थिति आँकड़े डेमो रीप्ले हैं।',
    backendUnavailableShort: 'बैकएंड विश्लेषण उपलब्ध नहीं है',
    timeout: 'विश्लेषण का समय समाप्त हुआ। फिर प्रयास करें।',
    analysisFailed: 'विश्लेषण पूरा नहीं हो सका।',
    analysisFailedShort: 'विश्लेषण विफल रहा',
    portQuery: (name: string) => `मैं ${name} से निकल रहा हूँ। मुझे कहाँ मछली पकड़नी चाहिए और सबसे सुरक्षित मार्ग कौन सा है?`,
    gpsQuery: (lat: string, lon: string) => `मेरी वर्तमान GPS स्थिति (${lat}, ${lon}) से समुद्री जोखिम और निकटतम सुरक्षित मछली क्षेत्र कौन सा है?`,
  },
} as const;
const SCENARIOS: { id: Scenario; label: Record<'en' | 'hi', string>; description: Record<'en' | 'hi', string> }[] = [
  {
    id: 'normal',
    label: { en: 'Normal conditions', hi: 'सामान्य स्थिति' },
    description: { en: 'Baseline synthetic replay', hi: 'आधारभूत कृत्रिम रीप्ले' },
  },
  {
    id: 'high-waves',
    label: { en: 'High waves', hi: 'ऊँची लहरें' },
    description: { en: 'Elevated waves around Zone B', hi: 'Zone B के पास ऊँची लहरें' },
  },
  {
    id: 'restricted-route',
    label: { en: 'Zone B closure', hi: 'Zone B बंद' },
    description: { en: 'Additional forbidden polygon at Zone B', hi: 'Zone B में अतिरिक्त निषिद्ध क्षेत्र' },
  },
  {
    id: 'api-failure',
    label: { en: 'Provider failure', hi: 'डेटा प्रदाता विफल' },
    description: { en: 'Marine readings unavailable', hi: 'समुद्री माप उपलब्ध नहीं' },
  },
];
const AGENT_NAMES_HI: Record<string, string> = {
  Planner: 'योजना',
  'Marine intelligence': 'समुद्री विश्लेषण',
  'Weather intelligence': 'मौसम विश्लेषण',
  'Geospatial analysis': 'भौगोलिक विश्लेषण',
  'Decision engine': 'निर्णय इंजन',
  'Route comparison': 'मार्ग तुलना',
  Explanation: 'स्पष्टीकरण',
};
export function Dashboard({
  initialDecision,
  initialContext,
  embedded = false,
  language = 'en',
}: {
  initialDecision: DecisionResponse;
  initialContext: ConversationContext;
  embedded?: boolean;
  language?: 'en' | 'hi';
}) {
  const copy = DASHBOARD_COPY[language];
  const [decision, setDecision] = useState(initialDecision);
  const [context, setContext] = useState(initialContext);
  const [message, setMessage] = useState<string | null>(null);
  const [scenario, setScenario] = useState<Scenario>('normal');
  const [selectedZone, setSelectedZone] = useState(
    initialDecision.recommendation.candidateZoneId ?? 'zone-a',
  );
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [lastQuery, setLastQuery] = useState<string>(copy.demoQuery);
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
  const currentMessage = message ?? copy.demoQuery;

  // Location selector handler
  function handlePresetLocation(preset: { name: string; lat: number; lon: number }) {
    setCurrentLocation({ lat: preset.lat, lon: preset.lon });
    const newMsg = copy.portQuery(preset.name);
    setMessage(newMsg);
    void submit(newMsg, scenario, false, { lat: preset.lat, lon: preset.lon });
  }

  // Live GPS tracking
  function toggleGps() {
    if (!navigator.geolocation) {
      setNotice(copy.geolocationUnavailable);
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
        const msg = copy.gpsQuery(userLoc.lat.toFixed(3), userLoc.lon.toFixed(3));
        setMessage(msg);
        void submit(msg, scenario, false, userLoc);
      },
      (err) => {
        setGpsActive(false);
        setNotice(language === 'hi' ? copy.gpsError : `${copy.gpsError}: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function submit(
    query = currentMessage,
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
          language,
          context: reset ? undefined : context,
        }),
        signal: controller.current.signal,
      });
      const body: ChatResponse = await response.json();
      if (!response.ok || body.status === 'ERROR')
        throw new Error('answer' in body ? body.answer : copy.analysisFailedShort);
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
          language,
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
        setBackendAnswer(copy.backendUnavailable);
        setNotice(language === 'hi' ? copy.backendUnavailableShort : error instanceof Error ? error.message : copy.backendUnavailableShort);
      }
    } catch (error) {
      setNotice(
        error instanceof Error && error.name === 'AbortError'
          ? copy.timeout
          : language === 'hi'
            ? copy.analysisFailed
            : error instanceof Error
            ? error.message
            : copy.analysisFailed,
      );
    } finally {
      clearTimeout(timeout);
      setPending(false);
    }
  }
  function scenarioChanged(value: Scenario) {
    setScenario(value);
    void submit(copy.demoQuery, value, true);
  }
  return (
    <div className={`app-shell${embedded ? ' app-shell--embedded' : ''}`}>
      <a className="skip-link" href="#query">
        {copy.skip}
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
            <span className="eyebrow">{copy.headingEyebrow}</span>
            <h1>{copy.heading}</h1>
          </div>
          <div className="scenario-control">
            <SlidersHorizontal size={15} />
            <label htmlFor="scenario">{copy.scenario}</label>
            <select
              id="scenario"
              value={scenario}
              disabled={pending}
              onChange={(e) => scenarioChanged(e.target.value as Scenario)}
            >
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label[language]}
                </option>
              ))}
            </select>
            <button
              className="icon-button"
              aria-label={copy.reset}
              disabled={pending}
              onClick={() => {
                setScenario('normal');
                void submit(copy.demoQuery, 'normal', true);
              }}
            >
              <RotateCcw size={15} />
            </button>
          </div>
        </div>
        <div className="intelligence-workspace">
          <aside
            className="conversation-panel"
            aria-label={copy.plannerLabel}
          >
            <div className="panel-title">
              <span className="eyebrow">{copy.planner}</span>
              <span className="small-tag">01 / NAGAPATTINAM</span>
            </div>
            {/* Preset Coastal Ports & GPS Selector */}
            <div className="flex flex-wrap items-center gap-1.5 mb-2 text-xs">
              <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">
                {copy.port}
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
                title={copy.gpsTitle}
              >
                <MapPin size={11} />
                {gpsActive ? copy.gpsActive : copy.liveGps}
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
                <label htmlFor="query">{copy.destination}</label>
                <VoiceChatControl
                  onTranscript={(text) => {
                    setMessage(text);
                    void submit(text);
                  }}
                  languageHint={language}
                  disabled={pending}
                />
              </div>
              <textarea
                id="query"
                maxLength={2000}
                value={currentMessage}
                disabled={pending}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
              />
              <button
                className="primary-button"
                type="submit"
                disabled={pending || !currentMessage.trim()}
              >
                {pending ? (
                  <>
                    <LoaderCircle className="spinner" size={16} />
                    {copy.analyzing}
                  </>
                ) : (
                  <>
                    {copy.run}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
            <div className="query-chips">
              <button
                disabled={pending}
                onClick={() => void submit(copy.nearestQuery)}
              >
                {copy.nearest}
                <ArrowUpRight size={12} />
              </button>
              <button
                disabled={pending}
                onClick={() => void submit(copy.laterQuery)}
              >
                {copy.later}
                <ArrowUpRight size={12} />
              </button>
            </div>
            {notice && (
              <div role="alert" className="request-notice">
                {notice}
                <span>
                  {copy.warningNote}
                </span>
              </div>
            )}
            <div className="trip-context">
              <div>
                <MapPin size={15} />
                <span>
                  {copy.departure}<strong>{decision.plan.origin.name}</strong>
                </span>
              </div>
              <div>
                <Clock3 size={15} />
                <span>
                  {language === 'hi'
                    ? new Intl.DateTimeFormat('hi-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(decision.plan.departureTime))
                    : localDate(decision.plan.departureTime)}
                  <strong>{localTime(decision.plan.departureTime)} IST</strong>
                </span>
              </div>
            </div>
            <div className="trace-heading">
              <h2>{copy.reasoning}</h2>
              <span>
                {pending ? copy.running : `${Math.round(elapsed)} ${copy.toolTime}`}
              </span>
            </div>
            <ol className="agent-trace" aria-label={copy.traceLabel}>
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
                      <span>{language === 'hi' ? (AGENT_NAMES_HI[agent.name] ?? agent.name) : agent.name}</span>
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
              {copy.traceFootnote}
            </div>
          </aside>
          <div className="map-workspace relative">
            {geofenceStatus && (
              <div className="absolute top-4 left-4 right-4 z-20">
                <GeofenceAlertBanner status={geofenceStatus} language={language} />
              </div>
            )}
            <MarineMap decision={decision} onSelectZone={setSelectedZone} currentLocation={currentLocation} onLocation={setCurrentLocation} marineLayer={marineLayer} mapActions={mapActions} language={language} />
            <MapLegend language={language} />
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
              <AudioPlayer text={backendAnswer || decision.answer} language={language} />
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
            onVesselMove={(pos) => {
              setCurrentLocation(pos);
            }}
            onRouteRecalculated={() => {
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
            ORCA is an intelligent decision-support prototype. Official INCOIS / IMD marine advisories, port alerts, and maritime authority instructions take absolute precedence. Not intended as the sole means of nautical navigation.
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
            {SCENARIOS.find((s) => s.id === decision.scenario)?.description[language]}
          </p>
        </details>
      </main>
    </div>
  );
}
