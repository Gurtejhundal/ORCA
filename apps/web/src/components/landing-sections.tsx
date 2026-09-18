'use client';

import {
  ArrowRight,
  Check,
  Database,
  Fish,
  Gauge,
  MessageSquareText,
  Route,
  Satellite,
  ShieldCheck,
  Waves,
} from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
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
    processDetails: ['Start with a departure coast, time, and question.', 'Extract the location, departure window, and decision intent.', 'Retrieve ocean, weather, PFZ, and boundary evidence.', 'Check freshness, coverage, and hard safety thresholds.', 'Weigh feasible destinations and routes, not distance alone.', 'Return the recommendation with reasons, sources, and uncertainty.'],
    processSignals: ['QUESTION → CONTEXT', 'CONTEXT → PLAN', 'PROVIDERS → EVIDENCE', 'EVIDENCE → SAFETY GATES', 'FEASIBLE OPTIONS → RANKING', 'DECISION → EXPLANATION'],
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
    nearestLabel: 'NEAREST',
    chosenLabel: 'RECOMMENDED',
    hazardLabel: 'Hazard exposure',
    coast: 'Departure coast',
    recommendation: '6.3 km farther, with stronger fishing potential and materially lower route risk.',
    scenarioEyebrow: '04 / USE CASES',
    scenarioTitle: 'Different crews. One evidence-led workflow.',
    scenarioIntro: 'Choose a perspective to see the marine question, the evidence to inspect, and the next action.',
    scenarios: [
      ['Fishermen', 'Where should I fish tomorrow near Nagapattinam?', 'Compare fishing potential, departure conditions, and a safer passage.', 'PFZ · WAVES · ROUTE'],
      ['Coastal authorities', 'Which marine warnings apply near Chennai?', 'Inspect source warnings and the regions affected before issuing local guidance.', 'WARNINGS · WIND · BOUNDARIES'],
      ['Researchers', 'Compare SST, chlorophyll and current evidence near Kochi.', 'Inspect parameter values, provider provenance, valid times, and missing coverage.', 'SST · CHLOROPHYLL · CURRENTS'],
      ['Maritime operators', 'Assess the route risk and sea conditions near Kochi.', 'Check the changing sea state and route constraints alongside official advisories.', 'SEA STATE · RISK · PASSAGE'],
    ],
    askScenario: 'Ask this question',
    sourceEyebrow: '05 / DATA SOURCES',
    sourceTitle: 'Evidence enters as a pipeline, not a logo wall.',
    sourceIntro: 'ORCA keeps each provider attached to its value, valid time, freshness, and operating mode before the decision engine can use it.',
    collector: 'ORCA data collector',
    normalize: 'Normalization',
    freshness: 'Freshness validation',
    engine: 'Decision engine',
    aboutEyebrow: '06 / EXPLAINABILITY',
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
    stateDescriptions: ['Current provider observation or forecast within its valid window.', 'Previously fetched provider data; check age and validity.', 'Fixed reference data, such as boundaries or bathymetry.', 'Replay or synthetic fixture; not a live observation.'],
    stateLegend: 'What the data states mean',
    exampleSource: 'Illustrative scenario · synthetic fixtures',
    exampleWhy: 'PFZ-02 trades a longer passage for stronger fishing potential and lower route exposure.',
    hydrographic: 'Hydrographic data',
    evidenceExample: 'Example evidence object · demo, not a live reading',
    reliabilityEyebrow: '07 / SAFETY & RELIABILITY',
    reliabilityTitle: 'Support the decision. Never replace the skipper.',
    reliability: [['Official warnings take precedence', 'Follow INCOIS, IMD, port alerts, and maritime authority instructions. ORCA is not a navigation instrument.'], ['Missing evidence stays visible', 'Unavailable or stale readings are labelled. A confident-looking score is not proof of safe passage.'], ['Hard safety stops come first', 'Restricted boundaries and hazard thresholds are checked before feasible options are ranked.']],
    ruleTitle: 'Safety before ranking',
    ruleBody: 'Restricted zones and hard hazard thresholds are evaluated before a fishing score can influence the route.',
    finalEyebrow: 'PLAN WITH OCEAN CONTEXT',
    finalTitle: 'Ask the sea a better question.',
    finalIntro: 'Start with where you are leaving from, when you plan to depart, and what decision you need to make.',
    askOrca: 'Ask ORCA',
    seeReasoning: 'See how ORCA reasons',
    product: 'Product',
    project: 'Project',
    projectIdentity: 'Marine EcOsystem Reasoning with Collaborative Agents.',
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
    processDetails: ['प्रस्थान तट, समय और सवाल से शुरुआत करें।', 'स्थान, प्रस्थान अवधि और निर्णय का उद्देश्य समझें।', 'समुद्र, मौसम, मत्स्य क्षेत्र और सीमा के प्रमाण जुटाएँ।', 'ताज़गी, उपलब्धता और गंभीर सुरक्षा सीमाएँ जाँचें।', 'केवल दूरी नहीं, संभव गंतव्य और मार्गों की तुलना करें।', 'कारण, स्रोत और अनिश्चितता के साथ सुझाव दें।'],
    processSignals: ['सवाल → संदर्भ', 'संदर्भ → योजना', 'स्रोत → प्रमाण', 'प्रमाण → सुरक्षा जाँच', 'संभव विकल्प → रैंकिंग', 'निर्णय → व्याख्या'],
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
    nearestLabel: 'निकटतम',
    chosenLabel: 'सुझाया गया',
    hazardLabel: 'खतरे वाला क्षेत्र',
    coast: 'प्रस्थान तट',
    recommendation: '6.3 किमी अधिक दूरी, लेकिन बेहतर मत्स्य संभावना और काफी कम मार्ग जोखिम।',
    scenarioEyebrow: '04 / उपयोग',
    scenarioTitle: 'अलग उपयोगकर्ता। प्रमाण पर आधारित एक प्रक्रिया।',
    scenarioIntro: 'समुद्री सवाल, आवश्यक प्रमाण और अगला कदम देखने के लिए अपनी भूमिका चुनें।',
    scenarios: [
      ['मछुआरे', 'कल नागपट्टिनम के पास कहाँ मछली पकड़ूँ?', 'मत्स्य संभावना, प्रस्थान स्थिति और सुरक्षित मार्ग की तुलना करें।', 'मत्स्य क्षेत्र · लहरें · मार्ग'],
      ['तटीय प्राधिकरण', 'चेन्नई के पास कौन-सी समुद्री चेतावनियाँ लागू हैं?', 'स्थानीय निर्देश से पहले स्रोत चेतावनियाँ और प्रभावित क्षेत्र देखें।', 'चेतावनी · हवा · सीमाएँ'],
      ['शोधकर्ता', 'कोच्चि के पास SST, क्लोरोफिल और समुद्री धाराओं के प्रमाण की तुलना करें।', 'मान, स्रोत, वैध समय और अनुपलब्ध डेटा की जाँच करें।', 'SST · क्लोरोफिल · धाराएँ'],
      ['समुद्री संचालक', 'कोच्चि के पास मार्ग जोखिम और समुद्री स्थिति जाँचें।', 'आधिकारिक चेतावनियों के साथ समुद्री स्थिति और मार्ग सीमाएँ देखें।', 'समुद्री स्थिति · जोखिम · मार्ग'],
    ],
    askScenario: 'यह सवाल पूछें',
    sourceEyebrow: '05 / डेटा स्रोत',
    sourceTitle: 'प्रमाण एक प्रक्रिया से आता है, केवल लोगो से नहीं।',
    sourceIntro: 'निर्णय इंजन से पहले ORCA हर मान के साथ उसका स्रोत, वैध समय, ताज़गी और संचालन स्थिति रखता है।',
    collector: 'ORCA डेटा संग्रह',
    normalize: 'मानकीकरण',
    freshness: 'ताज़गी सत्यापन',
    engine: 'निर्णय इंजन',
    aboutEyebrow: '06 / व्याख्या',
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
    stateDescriptions: ['वैध अवधि के भीतर वर्तमान स्रोत का माप या पूर्वानुमान।', 'पहले जुटाया गया स्रोत डेटा; उम्र और वैधता जाँचें।', 'सीमाओं या समुद्री गहराई जैसा स्थिर संदर्भ डेटा।', 'रीप्ले या कृत्रिम उदाहरण; वर्तमान माप नहीं।'],
    stateLegend: 'डेटा स्थितियों का अर्थ',
    exampleSource: 'उदाहरण परिस्थिति · कृत्रिम डेटा',
    exampleWhy: 'PFZ-02 का मार्ग लंबा है, लेकिन मत्स्य संभावना बेहतर और मार्ग जोखिम कम है।',
    hydrographic: 'समुद्री सर्वेक्षण डेटा',
    evidenceExample: 'प्रमाण का उदाहरण · डेमो, वर्तमान माप नहीं',
    reliabilityEyebrow: '07 / सुरक्षा और विश्वसनीयता',
    reliabilityTitle: 'निर्णय में मदद। कप्तान का विकल्प नहीं।',
    reliability: [['आधिकारिक चेतावनियाँ सर्वोपरि हैं', 'INCOIS, IMD, बंदरगाह और समुद्री प्राधिकरण के निर्देश मानें। ORCA नौवहन उपकरण नहीं है।'], ['अधूरा प्रमाण छिपाया नहीं जाता', 'अनुपलब्ध या पुराने माप चिह्नित हैं। अच्छा स्कोर सुरक्षित यात्रा का प्रमाण नहीं है।'], ['गंभीर सुरक्षा रोक पहले', 'विकल्पों की रैंकिंग से पहले प्रतिबंधित सीमाएँ और खतरे की सीमा जाँची जाती है।']],
    ruleTitle: 'रैंकिंग से पहले सुरक्षा',
    ruleBody: 'मत्स्य स्कोर मार्ग को प्रभावित करे, उससे पहले प्रतिबंधित क्षेत्र और गंभीर खतरे की सीमा जाँची जाती है।',
    finalEyebrow: 'समुद्री संदर्भ के साथ योजना',
    finalTitle: 'समुद्र से बेहतर सवाल पूछें।',
    finalIntro: 'बताएँ कि आप कहाँ से निकल रहे हैं, कब प्रस्थान करेंगे और कौन-सा निर्णय लेना है।',
    askOrca: 'ORCA से पूछें',
    seeReasoning: 'ORCA की तर्क प्रक्रिया देखें',
    product: 'उत्पाद',
    project: 'परियोजना',
    projectIdentity: 'सहयोगी एजेंटों के साथ समुद्री पारिस्थितिकी तंत्र पर तर्क।',
    footer: 'सोच-समझकर निर्णय लेने के लिए समुद्री बुद्धिमत्ता। आधिकारिक नौवहन चेतावनियों का विकल्प नहीं।',
  },
} as const;

const CAPABILITY_ICONS = [Fish, ShieldCheck, Route, MessageSquareText] as const;
const CAPABILITY_MEDIA = [
  {
    src: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/84000/84479/nwshelf_vir_2014225_lrg.jpg',
    alt: 'Satellite view of chlorophyll tracing ocean currents',
    credit: 'NASA Earth Observatory · VIIRS',
    href: 'https://earthobservatory.nasa.gov/images/84479/the-hydrologic-cycle',
  },
  {
    src: 'https://marinenavigation.noaa.gov/images/forecasts/NDFDWaveHeightMap.jpg',
    alt: 'NOAA marine wave-height forecast map',
    credit: 'NOAA · NDFD wave guidance',
    href: 'https://marinenavigation.noaa.gov/forecasts.html',
  },
  {
    src: 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Fishing_Boat_Waves_Devaneri_Mahabalipuram_Sep22_A7C_02637.jpg',
    alt: 'Fishing crew launching a boat through waves at Devaneri, Tamil Nadu',
    credit: 'T A Gonsalves · CC BY-SA 4.0',
    href: 'https://commons.wikimedia.org/wiki/File:Fishing_Boat_Waves_Devaneri_Mahabalipuram_Sep22_A7C_02637.jpg',
  },
  {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Fishing_boats_at_Rameswaram_fishing_port..JPG/1280px-Fishing_boats_at_Rameswaram_fishing_port..JPG',
    alt: 'Fishing crews unloading sardines at Rameswaram fishing harbour',
    credit: 'Rudolph A. Furtado · CC0',
    href: 'https://commons.wikimedia.org/wiki/File:Fishing_boats_at_Rameswaram_fishing_port..JPG',
  },
] as const;
const SOURCE_NAMES = ['INCOIS', 'IMD', 'Copernicus', 'GEBCO'];

export function LandingSections({
  language,
  onOpenWorkspace,
  onOpenEvidence,
  onAskQuery,
}: {
  language: AppLanguage;
  onOpenWorkspace: () => void;
  onOpenEvidence: () => void;
  onAskQuery: (query: string) => Promise<void>;
}) {
  const copy = COPY[language];
  const [stage, setStage] = useState(0);
  const [scenario, setScenario] = useState(0);
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const entry = entries.find((item) => item.isIntersecting);
      if (entry) setStage(Number((entry.target as HTMLElement).dataset.stage));
    }, { rootMargin: '-25% 0px -50% 0px', threshold: 0 });
    document.querySelectorAll('#how-it-works [data-stage]').forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

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
            const media = CAPABILITY_MEDIA[index];
            return (
              <article key={title}>
                <div className="capability-copy">
                  <span>0{index + 1}</span>
                  <Icon aria-hidden="true" />
                  <div><h3>{title}</h3><p>{description}</p></div>
                </div>
                <figure className={`capability-visual capability-visual--${index + 1}`}>
                  <Image src={media.src} alt={media.alt} fill sizes="(max-width: 768px) 100vw, 52vw" unoptimized />
                  <figcaption><strong>{signal}</strong><a href={media.href} target="_blank" rel="noreferrer">{media.credit}</a></figcaption>
                </figure>
              </article>
            );
          })}
        </div>
      </section>

      <section className="landing-section process-section" id="how-it-works" aria-labelledby="process-title">
        <header className="landing-heading landing-heading--wide">
          <span>{copy.processEyebrow}</span>
          <h2 id="process-title">{copy.processTitle}</h2>
          <p>{copy.processIntro}</p>
        </header>
        <div className="reasoning-layout">
          <ol className="reasoning-flow">
            {copy.process.map((step, index) => <li key={step} data-stage={index}><button type="button" aria-pressed={stage === index} onClick={() => setStage(index)}><span>0{index + 1}</span><strong>{step}</strong><ArrowRight size={16} aria-hidden="true" /></button></li>)}
          </ol>
          <div className="reasoning-detail" aria-live="polite">
            <span>0{stage + 1} / 06</span><h3>{copy.process[stage]}</h3><p>{copy.processDetails[stage]}</p>
            <div className="reasoning-signal"><Waves size={20} aria-hidden="true" /><code>{copy.processSignals[stage]}</code></div>
            <button className="orca-button orca-button--secondary" type="button" onClick={onOpenEvidence}>{copy.inspectEvidence}<ArrowRight size={16} aria-hidden="true" /></button>
          </div>
        </div>
      </section>

      <section className="landing-section decision-section" id="decision-intelligence">
        <header className="landing-heading">
          <span>{copy.useEyebrow}</span>
          <h2>{copy.useTitle}</h2>
          <p>{copy.useIntro}</p>
        </header>
        <div className="decision-comparison" aria-label={copy.illustrative}>
          <span className="decision-comparison__label">{copy.illustrative}</span>
          <div className="comparison-chart" role="img" aria-label={`${copy.coast}: PFZ-01 — ${copy.high}; PFZ-02 — ${copy.low}`}>
            <svg viewBox="0 0 600 180" aria-hidden="true">
              <path d="M0 0H90L120 35L98 75L132 114L105 180H0Z" className="comparison-coast" />
              <rect x="220" y="22" width="105" height="70" rx="5" className="comparison-hazard" />
              <path d="M115 135L288 54" className="comparison-path comparison-path--risk" />
              <path d="M115 135L352 140L495 42" className="comparison-path comparison-path--safe" />
              <circle cx="115" cy="135" r="5" /><circle cx="288" cy="54" r="5" /><circle cx="495" cy="42" r="5" />
              <text x="35" y="159">{copy.coast}</text><text x="240" y="115">{copy.hazardLabel}</text>
              <text x="278" y="18">PFZ-01</text><text x="478" y="20">PFZ-02</text>
            </svg>
          </div>
          <div className="comparison-table-wrap">
            <table className="comparison-table">
              <thead><tr><th scope="col">{language === 'hi' ? 'मापदंड' : 'Measure'}</th><th scope="col"><span>PFZ-01</span><small>{copy.nearestLabel}</small></th><th scope="col"><span>PFZ-02</span><small>{copy.chosenLabel}</small></th></tr></thead>
              <tbody>
                <tr><th scope="row">{copy.distance}</th><td>12.4 km</td><td>18.7 km</td></tr>
                <tr><th scope="row">{copy.fishing}</th><td><span className="metric-value">82</span><span className="metric-track"><i style={{ width: '82%' }} /></span></td><td><span className="metric-value">88</span><span className="metric-track"><i style={{ width: '88%' }} /></span></td></tr>
                <tr><th scope="row">{copy.safety}</th><td><span className="metric-value">52</span><span className="metric-track"><i style={{ width: '52%' }} /></span></td><td><span className="metric-value">86</span><span className="metric-track metric-track--safe"><i style={{ width: '86%' }} /></span></td></tr>
                <tr><th scope="row">{copy.routeRisk}</th><td className="risk-high">{copy.high}</td><td className="risk-low">{copy.low}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="decision-result"><Check aria-hidden="true" /><span><strong>{copy.recommended}</strong><small>{copy.recommendation}</small></span></div>
        </div>
      </section>

      <section className="landing-section use-case-section" id="use-cases">
        <header className="landing-heading"><span>{copy.scenarioEyebrow}</span><h2>{copy.scenarioTitle}</h2><p>{copy.scenarioIntro}</p></header>
        <div className="use-case-layout">
          <div className="use-case-selector" role="group" aria-label={copy.scenarioTitle}>{copy.scenarios.map(([role], index) => <button key={role} type="button" aria-pressed={scenario === index} onClick={() => setScenario(index)}>{role}<ArrowRight size={16} aria-hidden="true" /></button>)}</div>
          <article className="use-case-scenario" aria-live="polite" key={scenario}><span>{copy.scenarios[scenario][3]}</span><MessageSquareText size={24} aria-hidden="true" /><h3>{copy.scenarios[scenario][1]}</h3><p>{copy.scenarios[scenario][2]}</p><button className="orca-button orca-button--primary" type="button" onClick={() => void onAskQuery(copy.scenarios[scenario][1])}>{copy.askScenario}<ArrowRight size={16} aria-hidden="true" /></button></article>
        </div>
      </section>

      <section className="landing-section source-section" id="data-sources">
        <header className="landing-heading">
          <span>{copy.sourceEyebrow}</span>
          <h2>{copy.sourceTitle}</h2>
          <p>{copy.sourceIntro}</p>
        </header>
        <div className="source-pipeline">
          <div className="source-cloud">{[...SOURCE_NAMES, copy.hydrographic].map((source) => <span key={source}>{source}</span>)}</div>
          <ArrowRight aria-hidden="true" />
          <div className="pipeline-stage"><Satellite aria-hidden="true" /><strong>{copy.collector}</strong></div>
          <ArrowRight aria-hidden="true" />
          <div className="pipeline-stage"><Database aria-hidden="true" /><strong>{copy.normalize}</strong></div>
          <ArrowRight aria-hidden="true" />
          <div className="pipeline-stage"><Gauge aria-hidden="true" /><strong>{copy.freshness}</strong></div>
          <ArrowRight aria-hidden="true" />
          <div className="pipeline-stage pipeline-stage--final"><Waves aria-hidden="true" /><strong>{copy.engine}</strong></div>
        </div>
        <div className="source-example"><span>{copy.evidenceExample}</span><pre><code>{'{ "parameter": "wave_height", "value": 1.4, "unit": "m", "source": "synthetic_fixture", "mode": "DEMO" }'}</code></pre><p>{copy.stateDescriptions[3]}</p></div>
      </section>

      <section className="landing-section explain-section" id="explainability">
        <header className="landing-heading">
          <span>{copy.aboutEyebrow}</span>
          <h2>{copy.aboutTitle}</h2>
          <p>{copy.aboutIntro}</p>
        </header>
        <div className="explain-layout">
          <article className="evidence-receipt">
            <header><Waves aria-hidden="true" /><h3>{copy.explanationTitle}</h3><span className="data-state data-state--demo">{copy.states[3]}</span></header>
            <p className="evidence-receipt__why">{copy.exampleWhy}</p>
            <dl>{copy.explanationRows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
            <p className="evidence-receipt__source">{copy.exampleSource}</p>
          </article>
          <details className="freshness-legend"><summary>{copy.stateLegend}</summary>{copy.states.map((state, index) => <p key={state}><span className={`data-state data-state--${['live', 'cached', 'static', 'demo'][index]}`}>{state}</span>{copy.stateDescriptions[index]}</p>)}</details>
        </div>
      </section>

      <section className="landing-section reliability-section" id="safety-reliability"><header className="landing-heading"><span>{copy.reliabilityEyebrow}</span><h2>{copy.reliabilityTitle}</h2></header><div className="reliability-rules">{copy.reliability.map(([title, body], index) => <article key={title}><span>0{index + 1}</span><ShieldCheck size={20} aria-hidden="true" /><div><h3>{title}</h3><p>{body}</p></div></article>)}</div></section>

      <section className="landing-final" aria-labelledby="final-title">
        <div><span>{copy.finalEyebrow}</span><h2 id="final-title">{copy.finalTitle}</h2><p>{copy.finalIntro}</p></div>
        <div className="landing-actions"><button className="orca-button orca-button--primary" type="button" onClick={onOpenWorkspace}>{copy.openWorkspace}<ArrowRight size={16} aria-hidden="true" /></button><a className="orca-button orca-button--secondary" href="#how-it-works">{copy.seeReasoning}</a></div>
      </section>

      <footer className="orca-footer"><div className="orca-footer__identity" id="project"><span><Waves aria-hidden="true" /><strong>ORCA</strong></span><p>{copy.projectIdentity}</p><small>SIH · 26176 / © 2026 ORCA</small></div><div className="orca-footer__links"><strong>{copy.product}</strong><a href="#capabilities">{language === 'hi' ? 'क्षमताएँ' : 'Capabilities'}</a><a href="#how-it-works">{language === 'hi' ? 'कार्यप्रणाली' : 'How ORCA works'}</a><a href="#data-sources">{language === 'hi' ? 'डेटा स्रोत' : 'Data sources'}</a></div><div className="orca-footer__links"><strong>{copy.project}</strong><a href="#project">{language === 'hi' ? 'परिचय' : 'About ORCA'}</a><a href="#safety-reliability">{language === 'hi' ? 'सुरक्षा और विश्वसनीयता' : 'Safety & reliability'}</a></div><p className="orca-footer__notice">{copy.footer}</p></footer>
    </div>
  );
}
