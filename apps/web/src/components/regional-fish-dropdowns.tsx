'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ChatResponsePayload } from '@/services/marine-api';
import type { AppLanguage } from './hero/ask-orca-bar';

type FishSpecies = {
  id: string;
  en: string;
  hi: string;
  noteEn: string;
  noteHi: string;
};

type FishLocation = {
  id: string;
  titleEn: string;
  titleHi: string;
  areaEn: string;
  areaHi: string;
  windowEn: string;
  windowHi: string;
  promptEn: string;
  promptHi: string;
  species: FishSpecies[];
};

const FISH_LOCATIONS: FishLocation[] = [
  {
    id: 'east-coast',
    titleEn: 'Bay of Bengal coast',
    titleHi: 'बंगाल की खाड़ी तट',
    areaEn: 'Nagapattinam · Chennai · Odisha · Bengal',
    areaHi: 'नागपट्टिनम · चेन्नई · ओडिशा · बंगाल',
    windowEn: 'Good for PFZ questions near Tamil Nadu and the east coast.',
    windowHi: 'तमिलनाडु और पूर्वी तट के PFZ सवालों के लिए उपयोगी।',
    promptEn: 'Which fish are likely near this Bay of Bengal fishing zone, and what conditions should I check before going?',
    promptHi: 'इस बंगाल की खाड़ी मत्स्य क्षेत्र में कौन सी मछलियाँ मिल सकती हैं और जाने से पहले कौन सी स्थितियाँ जाँचूँ?',
    species: [
      { id: 'sardine', en: 'Sardine', hi: 'सार्डिन', noteEn: 'Pelagic shoals near productive coastal water.', noteHi: 'उत्पादक तटीय जल में झुंड।' },
      { id: 'mackerel', en: 'Mackerel', hi: 'मैकेरल', noteEn: 'Common when temperature and bait signals line up.', noteHi: 'तापमान और bait संकेत सही हों तो आम।' },
      { id: 'seer', en: 'Seer fish', hi: 'सीर मछली', noteEn: 'Higher-value catch; check season and route safety.', noteHi: 'अधिक मूल्य वाली पकड़; मौसम और मार्ग सुरक्षा जाँचें।' },
      { id: 'prawns', en: 'Prawns', hi: 'झींगा', noteEn: 'Often tied to estuaries and shallow coastal grounds.', noteHi: 'अक्सर मुहानों और उथले तटीय जल से जुड़ा।' },
    ],
  },
  {
    id: 'west-coast',
    titleEn: 'Arabian Sea coast',
    titleHi: 'अरब सागर तट',
    areaEn: 'Kerala · Karnataka · Goa · Maharashtra',
    areaHi: 'केरल · कर्नाटक · गोवा · महाराष्ट्र',
    windowEn: 'Use for west-coast PFZ, shelf, and harbour questions.',
    windowHi: 'पश्चिमी तट PFZ, shelf और harbour सवालों के लिए।',
    promptEn: 'Which fish are likely near this Arabian Sea fishing zone, and what route or weather risks should I check?',
    promptHi: 'इस अरब सागर मत्स्य क्षेत्र में कौन सी मछलियाँ मिल सकती हैं और कौन से मार्ग या मौसम जोखिम जाँचूँ?',
    species: [
      { id: 'oil-sardine', en: 'Oil sardine', hi: 'ऑयल सार्डिन', noteEn: 'Strong west-coast pelagic indicator.', noteHi: 'पश्चिमी तट की pelagic प्रजाति।' },
      { id: 'pomfret', en: 'Pomfret', hi: 'पॉम्फ्रेट', noteEn: 'Coastal shelf catch; verify local restrictions.', noteHi: 'तटीय shelf पकड़; स्थानीय नियम जाँचें।' },
      { id: 'seer-west', en: 'Seer fish', hi: 'सीर मछली', noteEn: 'Good target when winds and currents are manageable.', noteHi: 'हवा और currents ठीक हों तो अच्छा target।' },
      { id: 'bombay-duck', en: 'Bombay duck', hi: 'बॉम्बे डक', noteEn: 'Region-specific catch near Maharashtra/Gujarat.', noteHi: 'महाराष्ट्र/गुजरात के पास क्षेत्रीय पकड़।' },
    ],
  },
  {
    id: 'inland',
    titleEn: 'Inland freshwater',
    titleHi: 'अंतर्देशीय मीठा पानी',
    areaEn: 'Rivers · reservoirs · lakes',
    areaHi: 'नदियाँ · जलाशय · झीलें',
    windowEn: 'Useful for non-marine river and reservoir questions.',
    windowHi: 'नदी और जलाशय वाले non-marine सवालों के लिए।',
    promptEn: 'Which freshwater fish are likely in this inland zone, and what local rules should I check?',
    promptHi: 'इस अंतर्देशीय क्षेत्र में कौन सी मीठे पानी की मछलियाँ मिल सकती हैं और कौन से स्थानीय नियम जाँचूँ?',
    species: [
      { id: 'rohu', en: 'Rohu', hi: 'रोहू', noteEn: 'Common river and reservoir carp.', noteHi: 'आम नदी और जलाशय carp।' },
      { id: 'catla', en: 'Catla', hi: 'कतला', noteEn: 'Freshwater carp; check stocking and season.', noteHi: 'मीठे पानी की carp; stocking और season जाँचें।' },
      { id: 'mrigal', en: 'Mrigal', hi: 'मृगल', noteEn: 'Bottom-feeding carp in inland waters.', noteHi: 'अंतर्देशीय जल की bottom-feeding carp।' },
      { id: 'tilapia', en: 'Tilapia', hi: 'तिलापिया', noteEn: 'Widely present; rules vary by water body.', noteHi: 'कई जगह मौजूद; नियम जलाशय के हिसाब से बदलते हैं।' },
    ],
  },
];

function textFromResponse(response?: ChatResponsePayload) {
  if (!response) return '';
  return [
    response.answer,
    response.intent,
    response.recommended_pfz ? JSON.stringify(response.recommended_pfz) : '',
    response.data?.ranked_pfz ? JSON.stringify(response.data.ranked_pfz) : '',
  ].join(' ');
}

function locationForText(text: string) {
  const value = text.toLowerCase();
  if (/kochi|kerala|goa|mumbai|maharashtra|karnataka|gujarat|arabian/.test(value)) return 'west-coast';
  if (/river|lake|reservoir|rohu|catla|mrigal|tilapia|inland|freshwater/.test(value)) return 'inland';
  return 'east-coast';
}

function speciesPrompt(location: FishLocation, species: FishSpecies, language: AppLanguage) {
  return language === 'hi'
    ? `${location.titleHi} में ${species.hi} के लिए कौन सा PFZ, मौसम, गियर और सुरक्षा जाँच सही रहेगी?`
    : `For ${species.en} near the ${location.titleEn}, which PFZ, season, gear, and safety checks should I use?`;
}

export function FishLocateCard({
  response,
  language = 'en',
  onSelectPrompt,
}: {
  response?: ChatResponsePayload;
  language?: AppLanguage;
  onSelectPrompt?: (prompt: string) => void;
}) {
  const isHi = language === 'hi';
  const location = FISH_LOCATIONS.find((item) => item.id === locationForText(textFromResponse(response))) ?? FISH_LOCATIONS[0];

  return (
    <section className="fish-locate-card" aria-label={isHi ? 'मछली लोकेट' : 'Fish locate'}>
      <div className="fish-locate-card__head">
        <span>{isHi ? 'मछली लोकेट' : 'FISH LOCATE'}</span>
        <strong>{isHi ? location.titleHi : location.titleEn}</strong>
        <small>{isHi ? location.areaHi : location.areaEn}</small>
      </div>
      <div className="fish-locate-species">
        {location.species.map((fish) => (
          <button key={fish.id} type="button" onClick={() => onSelectPrompt?.(speciesPrompt(location, fish, language))}>
            <span>{isHi ? fish.hi : fish.en}</span>
            <small>{isHi ? fish.noteHi : fish.noteEn}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

export function RegionalFishDropdowns({
  language = 'en',
  activeResponse,
  onSelectPrompt,
}: {
  language?: AppLanguage;
  activeResponse?: ChatResponsePayload;
  onSelectPrompt?: (prompt: string) => void;
}) {
  const isHi = language === 'hi';
  const suggestedLocation = useMemo(() => locationForText(textFromResponse(activeResponse)), [activeResponse]);
  const [selectedId, setSelectedId] = useState(suggestedLocation);
  const selected = FISH_LOCATIONS.find((location) => location.id === selectedId) ?? FISH_LOCATIONS[0];

  useEffect(() => setSelectedId(suggestedLocation), [suggestedLocation]);

  return (
    <aside className="fish-locate-panel" aria-label={isHi ? 'मछली लोकेट पैनल' : 'Fish locate panel'}>
      <div className="fish-locate-panel__header">
        <span>{isHi ? 'ORCA मछली लोकेट' : 'ORCA FISH LOCATE'}</span>
        <h2>{isHi ? 'क्षेत्र चुनें, प्रजाति पूछें।' : 'Pick a zone, ask a species.'}</h2>
        <p>{isHi ? 'ORCA जवाब को PFZ, मौसम, मार्ग जोखिम और सुरक्षा जाँच से जोड़ता है।' : 'ORCA ties the answer to PFZ, weather, route risk, and safety checks.'}</p>
      </div>

      <div className="fish-locate-tabs" role="tablist" aria-label={isHi ? 'मत्स्य क्षेत्र' : 'Fish zones'}>
        {FISH_LOCATIONS.map((location) => (
          <button
            key={location.id}
            type="button"
            role="tab"
            aria-selected={selected.id === location.id}
            onClick={() => setSelectedId(location.id)}
          >
            {isHi ? location.titleHi : location.titleEn}
          </button>
        ))}
      </div>

      <div className="fish-locate-panel__body">
        <small>{isHi ? selected.areaHi : selected.areaEn}</small>
        <p>{isHi ? selected.windowHi : selected.windowEn}</p>
        <button className="fish-locate-primary" type="button" onClick={() => onSelectPrompt?.(isHi ? selected.promptHi : selected.promptEn)}>
          {isHi ? 'इस क्षेत्र की उपलब्ध मछलियाँ पूछें' : 'Ask available fish here'}
        </button>
      </div>

      <div className="fish-locate-species">
        {selected.species.map((fish) => (
          <button key={fish.id} type="button" onClick={() => onSelectPrompt?.(speciesPrompt(selected, fish, language))}>
            <span>{isHi ? fish.hi : fish.en}</span>
            <small>{isHi ? fish.noteHi : fish.noteEn}</small>
          </button>
        ))}
      </div>
    </aside>
  );
}
