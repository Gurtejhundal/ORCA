'use client';

import { type FormEvent, type WheelEvent, useEffect, useRef, useState } from 'react';
import type { ConversationContext, DecisionResponse } from '@orca/contracts';
import dynamic from 'next/dynamic';
import {
  ArrowUp,
  Database,
  Fish,
  History,
  Languages,
  Map,
  Route,
  Satellite,
  ShieldCheck,
  Volume2,
  Waves,
} from 'lucide-react';
import { marineApi, type ChatResponsePayload } from '@/services/marine-api';
import { OrcaHero } from './hero/orca-hero';
import type { AppLanguage } from './hero/ask-orca-bar';
import type { OrcaToolId } from './hero/orca-tool-rail';

type View = 'chat' | 'workspace' | 'evidence';
type ChatTurn = {
  id: number;
  query: string;
  guide?: string;
  response?: ChatResponsePayload;
  error?: string;
  mapRequested?: boolean;
};

const Dashboard = dynamic(() => import('./dashboard').then((module) => module.Dashboard), {
  loading: () => <div className="workspace-unavailable" aria-hidden="true"><Waves size={24} /></div>,
});

const CHAT_STORAGE_KEY = 'orca-recent-chat-v1';

const CHAT_COPY = {
  en: {
    ready: 'MARINE DECISION ASSISTANT',
    title: 'Ask one question. Keep the context.',
    intro: 'Ask where to fish, whether conditions are safe, or why ORCA made a recommendation.',
    placeholder: 'Ask a follow-up…',
    send: 'Send follow-up',
    thinking: 'Checking marine evidence…',
    user: 'YOU',
    assistant: 'ORCA',
    map: 'Open workspace',
    mapGuide: 'The marine workspace is ready. Open it to inspect fishing zones, conditions, alerts, routes, and data layers.',
    guide: 'I can compare likely fishing zones, explain sea conditions and warnings, assess voyage risk, and open the marine workspace. Tell me your departure coast and time to begin.',
    recent: 'Recent conversation',
    exchange: 'exchange',
    exchanges: 'exchanges',
    scrollHint: 'Scroll down past the latest answer to return to the ocean.',
    confidence: 'confidence',
    noSources: 'No sources returned',
    readAloud: 'Read answer aloud',
    error: 'ORCA could not reach marine intelligence. Try again.',
  },
  hi: {
    ready: 'समुद्री निर्णय सहायक',
    title: 'एक सवाल पूछें। संदर्भ बना रहेगा।',
    intro: 'मछली कहाँ पकड़ें, समुद्र सुरक्षित है या ORCA ने यह सुझाव क्यों दिया—पूछें।',
    placeholder: 'अगला सवाल पूछें…',
    send: 'सवाल भेजें',
    thinking: 'समुद्री प्रमाण जाँचे जा रहे हैं…',
    user: 'आप',
    assistant: 'ORCA',
    map: 'कार्यस्थल खोलें',
    mapGuide: 'समुद्री कार्यस्थल तैयार है। मछली क्षेत्र, स्थिति, चेतावनी, मार्ग और डेटा परतें देखने के लिए इसे खोलें।',
    guide: 'मैं मछली पकड़ने के संभावित क्षेत्रों की तुलना, समुद्री स्थिति और चेतावनियाँ समझाने, यात्रा जोखिम जाँचने और समुद्री कार्यस्थल खोलने में मदद कर सकता हूँ। अपना प्रस्थान तट और समय बताएँ।',
    recent: 'हाल की बातचीत',
    exchange: 'सवाल',
    exchanges: 'सवाल',
    scrollHint: 'समुद्र पर लौटने के लिए नवीनतम उत्तर के बाद नीचे स्क्रॉल करें।',
    confidence: 'विश्वसनीयता',
    noSources: 'कोई स्रोत नहीं मिला',
    readAloud: 'उत्तर सुनाएँ',
    error: 'ORCA समुद्री बुद्धिमत्ता से जुड़ नहीं सका। फिर प्रयास करें।',
  },
} as const;

const EVIDENCE_COPY = {
  en: {
    eyebrow: 'ONE TRACEABLE DECISION SYSTEM',
    title: 'Marine reasoning you can inspect.',
    intro: 'Capabilities, source provenance, freshness, and safety gates live together—without opening another product surface.',
    sources: 'Evidence pipeline',
    safety: 'Safety rules',
    capabilities: 'ORCA capabilities',
    example: 'Example evidence object',
    safetyItems: ['No invented measurements', 'Source-traceable values', 'Restricted-zone checks', 'Deterministic scoring'],
  },
  hi: {
    eyebrow: 'एक सत्यापन योग्य निर्णय प्रणाली',
    title: 'समुद्री तर्क जिसे आप जाँच सकते हैं।',
    intro: 'क्षमताएँ, डेटा स्रोत, ताज़गी और सुरक्षा नियम एक ही जगह दिखाई देते हैं।',
    sources: 'प्रमाण प्रक्रिया',
    safety: 'सुरक्षा नियम',
    capabilities: 'ORCA की क्षमताएँ',
    example: 'प्रमाण का उदाहरण',
    safetyItems: ['कोई काल्पनिक माप नहीं', 'स्रोत तक जाँचे जा सकने वाले मान', 'प्रतिबंधित क्षेत्र की जाँच', 'निश्चित स्कोरिंग'],
  },
} as const;

const CAPABILITIES = [
  { icon: Fish, en: 'Fishing intelligence', hi: 'मत्स्य बुद्धिमत्ता', detailEn: 'PFZ · SST · chlorophyll · opportunity', detailHi: 'PFZ · SST · क्लोरोफिल · संभावना', signalEn: 'PFZ–02', signalHi: 'PFZ–02' },
  { icon: ShieldCheck, en: 'Voyage safety', hi: 'यात्रा सुरक्षा', detailEn: 'Waves · wind · hazards · warnings', detailHi: 'लहरें · हवा · खतरे · चेतावनी', signalEn: '86 / 100', signalHi: '86 / 100' },
  { icon: Route, en: 'Route intelligence', hi: 'मार्ग बुद्धिमत्ता', detailEn: 'Safer passages · boundaries · route risk', detailHi: 'सुरक्षित मार्ग · सीमाएँ · मार्ग जोखिम', signalEn: 'LOW RISK', signalHi: 'कम जोखिम' },
  { icon: Languages, en: 'Conversational reasoning', hi: 'संवादी तर्क', detailEn: 'Hindi · English · context · explanations', detailHi: 'हिंदी · अंग्रेज़ी · संदर्भ · स्पष्टीकरण', signalEn: '2 LANG', signalHi: '2 भाषाएँ' },
] as const;

async function speakAnswer(text: string, language: string) {
  try {
    const result = await marineApi.speakText(text, language);
    if (result.audio_base64) {
      await new Audio(`data:audio/wav;base64,${result.audio_base64}`).play();
      return;
    }
  } catch {
    // Use the browser voice when the configured speech provider is unavailable.
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
    window.speechSynthesis.speak(utterance);
  }
}

function ChatComposer({ language, pending, onSubmit }: { language: AppLanguage; pending: boolean; onSubmit: (query: string) => Promise<void> }) {
  const [message, setMessage] = useState('');
  const copy = CHAT_COPY[language];
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!message.trim() || pending) return;
    const query = message.trim();
    setMessage('');
    void onSubmit(query);
  };

  return (
    <form className="chat-composer" onSubmit={submit}>
      <label className="sr-only" htmlFor="orca-follow-up">{copy.placeholder}</label>
      <input id="orca-follow-up" value={message} disabled={pending} onChange={(event) => setMessage(event.target.value)} placeholder={copy.placeholder} autoComplete="off" autoFocus />
      <button type="submit" disabled={pending || !message.trim()} aria-label={copy.send}><ArrowUp size={17} /></button>
    </form>
  );
}

function ChatView({ turns, pending, language, onSubmit, onOpenMap, onReturnHome }: { turns: ChatTurn[]; pending: boolean; language: AppLanguage; onSubmit: (query: string) => Promise<void>; onOpenMap: () => void; onReturnHome: () => void }) {
  const endRef = useRef<HTMLDivElement>(null);
  const copy = CHAT_COPY[language];
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, pending]);

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    const thread = event.currentTarget;
    const atBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight <= 2;
    if (event.deltaY > 0 && atBottom) onReturnHome();
  };

  const exchangeLabel = turns.length === 1 ? copy.exchange : copy.exchanges;
  return (
    <div className="chat-workspace">
      <div className="chat-session-bar">
        <span><History size={15} /><span><strong>{copy.recent}</strong><small>{turns.length} {exchangeLabel}</small></span></span>
        <small>{copy.scrollHint}</small>
      </div>
      <div className="chat-thread" aria-live="polite" onWheel={handleWheel}>
        {turns.length === 0 && (
          <div className="chat-empty">
            <span className="view-eyebrow">{copy.ready}</span>
            <h1>{copy.title}</h1>
            <p>{copy.intro}</p>
          </div>
        )}
        {turns.map((turn) => (
          <div className="chat-turn" key={turn.id}>
            <div className="chat-message chat-message--user"><span>{copy.user}</span><p>{turn.query}</p></div>
            <div className="chat-message chat-message--orca">
              <span><Waves size={14} />{copy.assistant}</span>
              {!turn.guide && !turn.response && !turn.error && <div className="chat-thinking" role="status"><i /><i /><i />{copy.thinking}</div>}
              {turn.error && <div className="chat-error" role="alert">{turn.error}</div>}
              {turn.guide && <div className="chat-answer"><p>{turn.guide}</p></div>}
              {turn.response && (
                <div className="chat-answer">
                  <p>{turn.response.answer}</p>
                  <div className="chat-answer__meta">
                    <span>{Math.round(turn.response.confidence * 100)}% {copy.confidence}</span>
                    <span>{turn.response.sources.join(' · ') || copy.noSources}</span>
                    <button type="button" onClick={() => void speakAnswer(turn.response!.answer, turn.response!.language)} aria-label={copy.readAloud}><Volume2 size={15} /></button>
                  </div>
                  {(turn.response.map_actions.length > 0 || turn.response.route || turn.response.recommended_pfz) && (
                    <button className="chat-map-action" type="button" onClick={onOpenMap}><Map size={15} />{copy.map}</button>
                  )}
                </div>
              )}
              {turn.mapRequested && <button className="chat-map-action" type="button" onClick={onOpenMap}><Map size={15} />{copy.map}</button>}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <ChatComposer language={language} pending={pending} onSubmit={onSubmit} />
    </div>
  );
}

function EvidenceView({ language }: { language: AppLanguage }) {
  const copy = EVIDENCE_COPY[language];
  const pipeline = [
    { icon: Satellite, title: 'INCOIS · IMD · Copernicus · GEBCO', detail: language === 'hi' ? 'समुद्री स्रोत' : 'Marine sources' },
    { icon: Database, title: language === 'hi' ? 'एकीकृत प्रमाण' : 'Normalized evidence', detail: language === 'hi' ? 'स्रोत · मान · वैध समय' : 'SOURCE · VALUE · VALID TIME' },
    { icon: Waves, title: language === 'hi' ? 'ताज़गी जाँच' : 'Freshness check', detail: language === 'hi' ? 'प्रत्यक्ष · संचित · स्थिर · डेमो' : 'LIVE · CACHED · STATIC · DEMO' },
    { icon: ShieldCheck, title: language === 'hi' ? 'सुरक्षा पहले' : 'Safety gates first', detail: language === 'hi' ? 'रैंकिंग से पहले रोक' : 'Hard stops before ranking' },
  ];

  return (
    <div className="evidence-view">
      <header>
        <span className="view-eyebrow">{copy.eyebrow}</span>
        <h1>{copy.title}</h1>
        <p>{copy.intro}</p>
      </header>
      <div className="evidence-layout">
        <section className="capability-list" aria-label={copy.capabilities}>
          {CAPABILITIES.map(({ icon: Icon, en, hi, detailEn, detailHi, signalEn, signalHi }, index) => (
            <article key={en}>
              <span>0{index + 1}</span>
              <Icon aria-hidden="true" />
              <div><h2>{language === 'hi' ? hi : en}</h2><p>{language === 'hi' ? detailHi : detailEn}</p></div>
              <strong>{language === 'hi' ? signalHi : signalEn}</strong>
            </article>
          ))}
        </section>
        <section className="evidence-pipeline" aria-label={copy.sources}>
          <h2>{copy.sources}</h2>
          {pipeline.map(({ icon: Icon, title, detail }) => (
            <div key={title}><Icon aria-hidden="true" /><span><strong>{title}</strong><small>{detail}</small></span></div>
          ))}
          <pre aria-label={copy.example}><code>{`{
  "parameter": "wave_height",
  "value": 1.8,
  "unit": "m",
  "source": "INCOIS",
  "freshness": "LIVE"
}`}</code></pre>
        </section>
      </div>
      <div className="safety-line"><strong>{copy.safety}</strong>{copy.safetyItems.map((item) => <span key={item}>{item}</span>)}</div>
    </div>
  );
}

function isMapRequest(query: string) {
  return /\bmap(s)?\b/i.test(query) || /(मानचित्र|नक्शा)/.test(query);
}

function isCapabilityRequest(query: string) {
  return /\b(what can (orca|you) do|how can (orca|you) help|capabilit)/i.test(query) || /(ORCA क्या कर सकता|कैसे मदद)/.test(query);
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => void;
};

export function OrcaExperience({ initialDecision, initialContext }: { initialDecision?: DecisionResponse; initialContext?: ConversationContext }) {
  const [view, setView] = useState<View | null>(null);
  const [language, setLanguage] = useState<AppLanguage>('en');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [pending, setPending] = useState(false);
  const [historyReady, setHistoryReady] = useState(false);
  const [activeTool, setActiveTool] = useState<OrcaToolId | null>(null);
  const sessionId = useRef<string | undefined>(undefined);
  const nextTurnId = useRef(1);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const raw = localStorage.getItem(CHAT_STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as { turns?: unknown; sessionId?: unknown };
          if (Array.isArray(saved.turns)) {
            const restored = saved.turns.filter((turn): turn is ChatTurn => {
              if (!turn || typeof turn !== 'object') return false;
              const item = turn as Partial<ChatTurn>;
              return typeof item.id === 'number' && typeof item.query === 'string';
            }).slice(-40);
            setTurns(restored);
            nextTurnId.current = Math.max(0, ...restored.map((turn) => turn.id)) + 1;
          }
          if (typeof saved.sessionId === 'string') sessionId.current = saved.sessionId;
        }
      } catch {
        localStorage.removeItem(CHAT_STORAGE_KEY);
      }
      setHistoryReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!historyReady) return;
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ turns, sessionId: sessionId.current }));
  }, [historyReady, turns]);

  useEffect(() => {
    if (!view) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setView(null);
        setActiveTool(null);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [view]);

  const transitionTo = (next: View | null) => {
    if (view === next) return;
    const update = () => setView(next);
    const start = (document as ViewTransitionDocument).startViewTransition;
    if (start && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) start.call(document, update);
    else update();
  };

  const openView = (next: View) => {
    setActiveTool(next === 'chat' ? 'recent' : next === 'workspace' ? (activeTool === 'recent' || !activeTool ? 'fishing' : activeTool) : null);
    transitionTo(next);
  };

  const closeView = () => {
    setActiveTool(null);
    transitionTo(null);
  };

  const selectTool = (tool: OrcaToolId) => {
    setActiveTool(tool);
    transitionTo(tool === 'recent' ? 'chat' : 'workspace');
  };

  const runQuery = async (query: string) => {
    if (!query.trim() || pending) return;
    const id = nextTurnId.current++;
    const openMap = isMapRequest(query);
    setActiveTool(openMap ? 'fishing' : 'recent');
    transitionTo(openMap ? 'workspace' : 'chat');
    if (openMap) {
      setTurns((current) => [...current, { id, query, guide: CHAT_COPY[language].mapGuide, mapRequested: true }]);
      return;
    }
    if (isCapabilityRequest(query)) {
      setTurns((current) => [...current, { id, query, guide: CHAT_COPY[language].guide }]);
      return;
    }
    setPending(true);
    setTurns((current) => [...current, { id, query }]);
    try {
      const response = await marineApi.chat({ message: query, session_id: sessionId.current, language });
      sessionId.current = response.session_id;
      setTurns((current) => current.map((turn) => turn.id === id ? { ...turn, response } : turn));
    } catch (error) {
      const message = language === 'hi' ? CHAT_COPY.hi.error : error instanceof Error ? error.message : CHAT_COPY.en.error;
      setTurns((current) => current.map((turn) => turn.id === id ? { ...turn, error: message } : turn));
    } finally {
      setPending(false);
    }
  };

  const navigate = (next: string) => {
    if (next === 'home') closeView();
    else openView(next as View);
  };

  return (
    <main className={view ? `orca-experience orca-experience--open orca-experience--${view}` : 'orca-experience'}>
      <OrcaHero
        onNavigate={navigate}
        language={language}
        onLanguageChange={setLanguage}
        onSubmitQuery={runQuery}
        activeView={view}
        activeTool={activeTool}
        hasHistory={turns.length > 0}
        onSelectTool={selectTool}
      />
      {view && (
        <section className={`experience-overlay experience-overlay--${view}`} aria-label={language === 'hi' ? 'ORCA दृश्य' : `${view} view`}>
          <div className="experience-page">
            {view === 'chat' ? (
              <ChatView turns={turns} pending={pending} language={language} onSubmit={runQuery} onOpenMap={() => openView('workspace')} onReturnHome={closeView} />
            ) : view === 'workspace' ? (
              initialDecision && initialContext ? <Dashboard initialDecision={initialDecision} initialContext={initialContext} embedded language={language} /> : <div className="workspace-unavailable" role="alert"><Map size={24} /><h1>{language === 'hi' ? 'कार्यस्थल डेटा उपलब्ध नहीं है।' : 'Workspace data is unavailable.'}</h1><p>{language === 'hi' ? 'ORCA के निर्णय इंजन से दोबारा जुड़ने तक बातचीत उपलब्ध रहेगी।' : 'The conversation remains available while ORCA reconnects to the decision engine.'}</p></div>
            ) : (
              <EvidenceView language={language} />
            )}
          </div>
        </section>
      )}
    </main>
  );
}
