'use client';

import {
  ArrowRight,
  Check,
  Database,
  Fish,
  Gauge,
  MapPin,
  MessageSquareText,
  Navigation,
  Route,
  Satellite,
  ShieldCheck,
  Waves,
} from 'lucide-react';
import type { AppLanguage } from './hero/ask-orca-bar';

const COPY = {
  en: {
    capabilityEyebrow: '01 / WHAT ORCA DOES',
    capabilityTitle: 'One question becomes a reasoned marine decision.',
    capabilityIntro: 'ORCA connects fishing potential, sea conditions, route risk, and source evidence so crews can compare options—not chase the nearest point on a map.',
    openWorkspace: 'Open workspace',
    inspectEvidence: 'Inspect evidence',
    capabilityLabels: [
      ['Fishing intelligence', 'Compare PFZ potential with SST, chlorophyll, distance, and freshness.', 'PFZ · SST · CHLOROPHYLL'],
      ['Voyage safety', 'Read waves, wind, alerts, and hard safety stops before departure.', 'WAVES · WIND · ALERTS'],
      ['Route intelligence', 'Compare safer passages against distance and restricted boundaries.', 'RISK · DISTANCE · BOUNDARIES'],
      ['Conversational reasoning', 'Ask in English or Hindi and keep the context through follow-up questions.', 'ENGLISH · HINDI · CONTEXT'],
    ],
    processEyebrow: '02 / HOW ORCA WORKS',
    processTitle: 'A visible reasoning chain, not a black-box answer.',
    processIntro: 'Every recommendation moves through the same six-stage sequence, with source and freshness metadata preserved for inspection.',
    process: ['Ask', 'Understand', 'Collect', 'Analyse', 'Compare', 'Recommend'],
    useEyebrow: '03 / DECISION INTELLIGENCE',
    useTitle: 'Nearest does not always mean best.',
    useIntro: 'An illustrative Nagapattinam scenario shows how ORCA balances fishing potential with voyage safety and route exposure.',
    illustrative: 'ILLUSTRATIVE COMPARISON',
    distance: 'Distance',
    fishing: 'Fishing',
    safety: 'Safety',
    routeRisk: 'Route risk',
    high: 'High',
    low: 'Low',
    recommended: 'ORCA RECOMMENDS PFZ-02',
    recommendation: '6.3 km farther, with stronger fishing potential and materially lower route risk.',
    sourceEyebrow: '04 / DATA SOURCES',
    sourceTitle: 'Evidence enters as a pipeline, not a logo wall.',
    sourceIntro: 'ORCA keeps each provider attached to its value, valid time, freshness, and operating mode before the decision engine can use it.',
    collector: 'ORCA data collector',
    normalize: 'Normalization',
    freshness: 'Freshness validation',
    engine: 'Decision engine',
    aboutEyebrow: '05 / EXPLAINABILITY',
    aboutTitle: 'The recommendation carries its evidence with it.',
    aboutIntro: 'Operators can see what drove the result, which state each source is in, and where uncertainty remains before acting.',
    explanationTitle: 'Recommended: PFZ-02',
    explanationRows: [
      ['Fishing potential', 'High'],
      ['Wave height', '1.4 m'],
      ['Wind', '11 km/h'],
      ['Route risk', 'Low'],
      ['Restricted zones', 'None'],
      ['Confidence', '89%'],
    ],
    states: ['LIVE', 'CACHED', 'STATIC', 'DEMO'],
    ruleTitle: 'Safety before ranking',
    ruleBody: 'Restricted zones and hard hazard thresholds are evaluated before a fishing score can influence the route.',
    finalEyebrow: 'PLAN WITH OCEAN CONTEXT',
    finalTitle: 'Ask the sea a better question.',
    finalIntro: 'Start with where you are leaving from, when you plan to depart, and what decision you need to make.',
    askOrca: 'Ask ORCA',
    footer: 'Marine intelligence for informed decisions. Not a substitute for official navigation warnings.',
  },
  hi: {
    capabilityEyebrow: '01 / ORCA क्या करता है',
    capabilityTitle: 'एक सवाल से तर्कपूर्ण समुद्री निर्णय तक।',
    capabilityIntro: 'ORCA मछली की संभावना, समुद्री स्थिति, मार्ग जोखिम और स्रोत प्रमाण को जोड़ता है ताकि दल केवल निकटतम बिंदु नहीं, बेहतर विकल्प चुन सके।',
    openWorkspace: 'कार्यस्थल खोलें',
    inspectEvidence: 'प्रमाण देखें',
    capabilityLabels: [
      ['मत्स्य बुद्धिमत्ता', 'PFZ संभावना की SST, क्लोरोफिल, दूरी और ताज़गी के साथ तुलना।', 'PFZ · SST · क्लोरोफिल'],
      ['यात्रा सुरक्षा', 'प्रस्थान से पहले लहरें, हवा, चेतावनियाँ और सुरक्षा रोक देखें।', 'लहरें · हवा · चेतावनी'],
      ['मार्ग बुद्धिमत्ता', 'दूरी और प्रतिबंधित सीमाओं के साथ सुरक्षित मार्गों की तुलना।', 'जोखिम · दूरी · सीमाएँ'],
      ['संवादी तर्क', 'अंग्रेज़ी या हिंदी में पूछें और अगले सवालों में संदर्भ बनाए रखें।', 'अंग्रेज़ी · हिंदी · संदर्भ'],
    ],
    processEyebrow: '02 / ORCA कैसे काम करता है',
    processTitle: 'स्पष्ट तर्क प्रक्रिया, केवल बंद उत्तर नहीं।',
    processIntro: 'हर सुझाव छह चरणों से गुजरता है और स्रोत व ताज़गी की जानकारी जाँच के लिए साथ रहती है।',
    process: ['पूछें', 'समझें', 'जुटाएँ', 'विश्लेषण', 'तुलना', 'सुझाव'],
    useEyebrow: '03 / निर्णय बुद्धिमत्ता',
    useTitle: 'सबसे पास हमेशा सबसे अच्छा नहीं होता।',
    useIntro: 'नागपट्टिनम का यह उदाहरण दिखाता है कि ORCA मत्स्य संभावना, यात्रा सुरक्षा और मार्ग जोखिम को साथ कैसे देखता है।',
    illustrative: 'उदाहरण तुलना',
    distance: 'दूरी',
    fishing: 'मत्स्य',
    safety: 'सुरक्षा',
    routeRisk: 'मार्ग जोखिम',
    high: 'ऊँचा',
    low: 'कम',
    recommended: 'ORCA का सुझाव: PFZ-02',
    recommendation: '6.3 किमी अधिक दूरी, लेकिन बेहतर मत्स्य संभावना और काफी कम मार्ग जोखिम।',
    sourceEyebrow: '04 / डेटा स्रोत',
    sourceTitle: 'प्रमाण एक प्रक्रिया से आता है, केवल लोगो से नहीं।',
    sourceIntro: 'निर्णय इंजन से पहले ORCA हर मान के साथ उसका स्रोत, वैध समय, ताज़गी और संचालन स्थिति रखता है।',
    collector: 'ORCA डेटा संग्रह',
    normalize: 'मानकीकरण',
    freshness: 'ताज़गी सत्यापन',
    engine: 'निर्णय इंजन',
    aboutEyebrow: '05 / व्याख्या',
    aboutTitle: 'हर सुझाव अपने प्रमाण के साथ आता है।',
    aboutIntro: 'कार्रवाई से पहले उपयोगकर्ता देख सकते हैं कि नतीजा किन कारणों से बना, हर स्रोत की स्थिति क्या है और अनिश्चितता कहाँ है।',
    explanationTitle: 'सुझाव: PFZ-02',
    explanationRows: [
      ['मत्स्य संभावना', 'ऊँची'],
      ['लहर ऊँचाई', '1.4 मी'],
      ['हवा', '11 किमी/घं'],
      ['मार्ग जोखिम', 'कम'],
      ['प्रतिबंधित क्षेत्र', 'कोई नहीं'],
      ['विश्वसनीयता', '89%'],
    ],
    states: ['लाइव', 'संचित', 'स्थिर', 'डेमो'],
    ruleTitle: 'रैंकिंग से पहले सुरक्षा',
    ruleBody: 'मत्स्य स्कोर मार्ग को प्रभावित करे, उससे पहले प्रतिबंधित क्षेत्र और गंभीर खतरे की सीमा जाँची जाती है।',
    finalEyebrow: 'समुद्री संदर्भ के साथ योजना',
    finalTitle: 'समुद्र से बेहतर सवाल पूछें।',
    finalIntro: 'बताएँ कि आप कहाँ से निकल रहे हैं, कब प्रस्थान करेंगे और कौन-सा निर्णय लेना है।',
    askOrca: 'ORCA से पूछें',
    footer: 'सोच-समझकर निर्णय लेने के लिए समुद्री बुद्धिमत्ता। आधिकारिक नौवहन चेतावनियों का विकल्प नहीं।',
  },
} as const;

const CAPABILITY_ICONS = [Fish, ShieldCheck, Route, MessageSquareText] as const;
const SOURCE_NAMES = ['INCOIS', 'IMD', 'Copernicus', 'GEBCO', 'Hydrographic data'];

export function LandingSections({
  language,
  onOpenWorkspace,
  onOpenEvidence,
}: {
  language: AppLanguage;
  onOpenWorkspace: () => void;
  onOpenEvidence: () => void;
}) {
  const copy = COPY[language];

  return (
    <div className="orca-landing" id="main-content">
      <section className="landing-section capability-section" id="capabilities">
        <header className="landing-heading">
          <span>{copy.capabilityEyebrow}</span>
          <h2>{copy.capabilityTitle}</h2>
          <p>{copy.capabilityIntro}</p>
          <div className="landing-actions">
            <button className="orca-button orca-button--primary" type="button" onClick={onOpenWorkspace}>{copy.openWorkspace}<ArrowRight size={16} /></button>
            <button className="orca-button orca-button--secondary" type="button" onClick={onOpenEvidence}>{copy.inspectEvidence}</button>
          </div>
        </header>

        <div className="capability-sequence">
          {copy.capabilityLabels.map(([title, description, signal], index) => {
            const Icon = CAPABILITY_ICONS[index] ?? Waves;
            return (
              <article key={title}>
                <div className="capability-copy">
                  <span>0{index + 1}</span>
                  <Icon aria-hidden="true" />
                  <div><h3>{title}</h3><p>{description}</p></div>
                </div>
                <div className={`capability-visual capability-visual--${index + 1}`} aria-hidden="true">
                  <i /><i /><i />
                  <strong>{signal}</strong>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="landing-section process-section" aria-labelledby="process-title">
        <header className="landing-heading landing-heading--wide">
          <span>{copy.processEyebrow}</span>
          <h2 id="process-title">{copy.processTitle}</h2>
          <p>{copy.processIntro}</p>
        </header>
        <ol className="reasoning-flow">
          {copy.process.map((step, index) => <li key={step}><span>0{index + 1}</span><strong>{step}</strong></li>)}
        </ol>
      </section>

      <section className="landing-section decision-section" id="use-cases">
        <header className="landing-heading">
          <span>{copy.useEyebrow}</span>
          <h2>{copy.useTitle}</h2>
          <p>{copy.useIntro}</p>
        </header>
        <div className="decision-comparison" aria-label={copy.illustrative}>
          <span className="decision-comparison__label">{copy.illustrative}</span>
          <article>
            <header><MapPin aria-hidden="true" /><strong>PFZ-01</strong><small>NEAREST</small></header>
            <dl><div><dt>{copy.distance}</dt><dd>12.4 km</dd></div><div><dt>{copy.fishing}</dt><dd>82</dd></div><div><dt>{copy.safety}</dt><dd>52</dd></div><div><dt>{copy.routeRisk}</dt><dd className="risk-high">{copy.high}</dd></div></dl>
          </article>
          <div className="decision-route" aria-hidden="true"><span /><Navigation /></div>
          <article className="decision-comparison__selected">
            <header><ShieldCheck aria-hidden="true" /><strong>PFZ-02</strong><small>RECOMMENDED</small></header>
            <dl><div><dt>{copy.distance}</dt><dd>18.7 km</dd></div><div><dt>{copy.fishing}</dt><dd>88</dd></div><div><dt>{copy.safety}</dt><dd>86</dd></div><div><dt>{copy.routeRisk}</dt><dd className="risk-low">{copy.low}</dd></div></dl>
          </article>
          <div className="decision-result"><Check aria-hidden="true" /><span><strong>{copy.recommended}</strong><small>{copy.recommendation}</small></span></div>
        </div>
      </section>

      <section className="landing-section source-section" id="data-sources">
        <header className="landing-heading">
          <span>{copy.sourceEyebrow}</span>
          <h2>{copy.sourceTitle}</h2>
          <p>{copy.sourceIntro}</p>
        </header>
        <div className="source-pipeline">
          <div className="source-cloud">{SOURCE_NAMES.map((source) => <span key={source}>{source}</span>)}</div>
          <ArrowRight aria-hidden="true" />
          <div className="pipeline-stage"><Satellite aria-hidden="true" /><strong>{copy.collector}</strong></div>
          <ArrowRight aria-hidden="true" />
          <div className="pipeline-stage"><Database aria-hidden="true" /><strong>{copy.normalize}</strong></div>
          <ArrowRight aria-hidden="true" />
          <div className="pipeline-stage"><Gauge aria-hidden="true" /><strong>{copy.freshness}</strong></div>
          <ArrowRight aria-hidden="true" />
          <div className="pipeline-stage pipeline-stage--final"><Waves aria-hidden="true" /><strong>{copy.engine}</strong></div>
        </div>
      </section>

      <section className="landing-section explain-section" id="about">
        <header className="landing-heading">
          <span>{copy.aboutEyebrow}</span>
          <h2>{copy.aboutTitle}</h2>
          <p>{copy.aboutIntro}</p>
        </header>
        <div className="explain-layout">
          <article className="evidence-receipt">
            <header><Waves aria-hidden="true" /><h3>{copy.explanationTitle}</h3><span>89%</span></header>
            <dl>{copy.explanationRows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
            <div className="evidence-states">{copy.states.map((state, index) => <span key={state} data-state={index}>{state}</span>)}</div>
          </article>
          <aside className="safety-rule"><ShieldCheck aria-hidden="true" /><span><strong>{copy.ruleTitle}</strong><p>{copy.ruleBody}</p></span></aside>
        </div>
      </section>

      <section className="landing-final" aria-labelledby="final-title">
        <div><span>{copy.finalEyebrow}</span><h2 id="final-title">{copy.finalTitle}</h2><p>{copy.finalIntro}</p></div>
        <div className="landing-actions"><a className="orca-button orca-button--primary" href="#home">{copy.askOrca}<ArrowRight size={16} /></a><button className="orca-button orca-button--secondary" type="button" onClick={onOpenWorkspace}>{copy.openWorkspace}</button></div>
      </section>

      <footer className="orca-footer"><span><Waves aria-hidden="true" /><strong>ORCA</strong></span><p>{copy.footer}</p><small>© 2026 ORCA</small></footer>
    </div>
  );
}
