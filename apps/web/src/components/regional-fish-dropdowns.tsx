'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Compass, Fish, Sparkles } from 'lucide-react';
import type { AppLanguage } from './hero/ask-orca-bar';

interface FishItem {
  id: string;
  nameEn: string;
  nameHi: string;
  promptEn: string;
  promptHi: string;
}

interface RegionInfo {
  id: string;
  titleEn: string;
  titleHi: string;
  subtitleEn: string;
  subtitleHi: string;
  fishItems: FishItem[];
}

const REGIONS: RegionInfo[] = [
  {
    id: 'west-coast',
    titleEn: 'West coast (Kerala–Karnataka–Goa–Maharashtra)',
    titleHi: 'पश्चिमी तट (केरल-कर्नाटक-गोवा-महाराष्ट्र)',
    subtitleEn: 'Arabian Sea Marine Shelf',
    subtitleHi: 'अरब सागर समुद्री तट',
    fishItems: [
      {
        id: 'oil-sardine',
        nameEn: 'Oil Sardine',
        nameHi: 'ऑयल सार्डिन',
        promptEn: 'Tell me the best spots, season, and techniques for catching Oil Sardine on the West coast (Kerala–Karnataka–Goa–Maharashtra)',
        promptHi: 'पश्चिमी तट (केरल-कर्नाटक-गोवा-महाराष्ट्र) पर ऑयल सार्डिन मछली पकड़ने के सर्वोत्तम स्थान और मौसम बताएं',
      },
      {
        id: 'mackerel-west',
        nameEn: 'Mackerel',
        nameHi: 'मैकेरल',
        promptEn: 'Where and when can I catch Mackerel on the West coast (Kerala–Karnataka–Goa–Maharashtra)?',
        promptHi: 'पश्चिमी तट पर मैकेरल मछली कहाँ और कब पकड़ी जा सकती है?',
      },
      {
        id: 'seer-west',
        nameEn: 'Seer (Surmai)',
        nameHi: 'सीर (सुरमई)',
        promptEn: 'What are the best fishing zones, gear, and season for Seer fish (Surmai/Kingfish) on the West coast?',
        promptHi: 'पश्चिमी तट पर सीर (सुरमई) मछली के लिए सर्वोत्तम मत्स्य क्षेत्र, मौसम और गियर क्या हैं?',
      },
      {
        id: 'pomfret',
        nameEn: 'Pomfret',
        nameHi: 'पॉम्फ्रेट',
        promptEn: 'Guide me on catching Pomfret along the West coast (Goa, Maharashtra, Karnataka)',
        promptHi: 'पश्चिमी तट (गोवा, महाराष्ट्र, कर्नाटक) पर पॉम्फ्रेट मछली पकड़ने की गाइड दें',
      },
      {
        id: 'prawns-west',
        nameEn: 'Prawns',
        nameHi: 'झींगा (Prawns)',
        promptEn: 'What are the top coastal zones and seasons for Prawns on the West coast?',
        promptHi: 'पश्चिमी तट पर झींगा पकड़ने के लिए प्रमुख तटीय क्षेत्र और मौसम क्या हैं?',
      },
      {
        id: 'bombay-duck',
        nameEn: 'Bombay Duck',
        nameHi: 'बॉम्बे डक',
        promptEn: 'Tell me about Bombay Duck fishing hotspots, seasons, and techniques in Maharashtra and Gujarat',
        promptHi: 'महाराष्ट्र और गुजरात में बॉम्बे डक मछली पकड़ने के प्रमुख क्षेत्र और मौसम बताएं',
      },
    ],
  },
  {
    id: 'east-coast',
    titleEn: 'East coast (Odisha–Andhra–Tamil Nadu–West Bengal)',
    titleHi: 'पूर्वी तट (ओडिशा-आंध्र-तमिलनाडु-पश्चिम बंगाल)',
    subtitleEn: 'Bay of Bengal Coastal Zone',
    subtitleHi: 'बंगाल की खाड़ी तटीय क्षेत्र',
    fishItems: [
      {
        id: 'mackerel-east',
        nameEn: 'Mackerel',
        nameHi: 'मैकेरल',
        promptEn: 'Where and when can I catch Mackerel on the East coast (Odisha, Andhra, Tamil Nadu, West Bengal)?',
        promptHi: 'पूर्वी तट (ओडिशा, आंध्र, तमिलनाडु, पश्चिम बंगाल) पर मैकेरल मछली पकड़ने के सर्वोत्तम स्थान बताएं',
      },
      {
        id: 'sardine-east',
        nameEn: 'Sardine',
        nameHi: 'सार्डिन',
        promptEn: 'What are the best fishing spots and conditions for Sardine along the East coast of India?',
        promptHi: 'भारत के पूर्वी तट पर सार्डिन मछली पकड़ने के लिए सर्वोत्तम स्थान और स्थितियाँ क्या हैं?',
      },
      {
        id: 'seer-east',
        nameEn: 'Seer',
        nameHi: 'सीर मछली',
        promptEn: 'Tell me about Seer fish grounds, gear, and safe seasons on the East coast (Bay of Bengal)',
        promptHi: 'पूर्वी तट (बंगाल की खाड़ी) पर सीर मछली के शिकार क्षेत्र और सुरक्षित मौसम बताएं',
      },
      {
        id: 'prawns-east',
        nameEn: 'Prawns',
        nameHi: 'झींगा',
        promptEn: 'What are the best estuaries and coastal waters for Prawns on the East coast?',
        promptHi: 'पूर्वी तट पर झींगा मछली पकड़ने के लिए प्रमुख मुहाने और तटीय जल कौन से हैं?',
      },
      {
        id: 'hilsa',
        nameEn: 'Hilsa (Border Rivers)',
        nameHi: 'हिलसा (सीमावर्ती नदियाँ)',
        promptEn: 'Tell me about Hilsa fishing in West Bengal and Bangladesh border rivers: best seasons, rules, and hotspots',
        promptHi: 'पश्चिम बंगाल और सीमावर्ती नदियों में हिलसा मछली पकड़ने के नियम, मौसम और प्रमुख स्थान बताएं',
      },
      {
        id: 'snappers',
        nameEn: 'Various Snappers',
        nameHi: 'स्नैपर्स (Snappers)',
        promptEn: 'What are the top reef spots and techniques for catching Snappers on the East coast?',
        promptHi: 'पूर्वी तट पर स्नैपर्स मछली पकड़ने के लिए शीर्ष रीफ स्थान और तकनीकें क्या हैं?',
      },
    ],
  },
  {
    id: 'north-central-inland',
    titleEn: 'North/central India (inland)',
    titleHi: 'उत्तर/मध्य भारत (अंतर्देशीय)',
    subtitleEn: 'Rivers, Lakes & Reservoirs',
    subtitleHi: 'नदियाँ, झीलें और जलाशय',
    fishItems: [
      {
        id: 'rohu',
        nameEn: 'Rohu',
        nameHi: 'रोहू',
        promptEn: 'Tell me the best rivers, reservoirs, and bait techniques for catching Rohu in North/Central India',
        promptHi: 'उत्तर/मध्य भारत में रोहू मछली पकड़ने के लिए प्रमुख नदियाँ, जलाशय और चारा तकनीकें बताएं',
      },
      {
        id: 'catla',
        nameEn: 'Catla',
        nameHi: 'कतला',
        promptEn: 'Where are the top inland freshwater spots and best seasons for Catla in North/Central India?',
        promptHi: 'उत्तर/मध्य भारत में कतला मछली के लिए शीर्ष मीठे पानी के स्थान और सर्वोत्तम मौसम कौन से हैं?',
      },
      {
        id: 'mrigal',
        nameEn: 'Mrigal',
        nameHi: 'मृगल',
        promptEn: 'What are the best techniques, tackle, and locations for Mrigal fishing in North/Central India?',
        promptHi: 'उत्तर/मध्य भारत में मृगल मछली पकड़ने के लिए सर्वोत्तम तकनीक और स्थान क्या हैं?',
      },
      {
        id: 'pangasius',
        nameEn: 'Pangasius',
        nameHi: 'पंगासियस',
        promptEn: 'Where can I catch Pangasius in North and Central India rivers and lakes?',
        promptHi: 'उत्तर और मध्य भारत की नदियों और झीलों में पंगासियस कहाँ पकड़ी जा सकती है?',
      },
      {
        id: 'tilapia',
        nameEn: 'Tilapia',
        nameHi: 'तिलापिया',
        promptEn: 'Tell me about Tilapia fishing spots, seasons, and gear in North and Central India',
        promptHi: 'उत्तर और मध्य भारत में तिलापिया मछली पकड़ने के स्थान, मौसम और गियर के बारे में बताएं',
      },
      {
        id: 'magur',
        nameEn: 'Magur (Catfish)',
        nameHi: 'मागुर (कैटफिश)',
        promptEn: 'What are the best wetland and river spots for Magur (catfish) in North/Central India?',
        promptHi: 'उत्तर/मध्य भारत में मागुर (कैटफिश) के लिए सबसे अच्छे आर्द्रभूमि और नदी स्थान कौन से हैं?',
      },
    ],
  },
];

export function RegionalFishDropdowns({
  language = 'en',
  onSelectPrompt,
}: {
  language?: AppLanguage;
  onSelectPrompt?: (prompt: string) => void;
}) {
  const [openStates, setOpenStates] = useState<Record<string, boolean>>({
    'west-coast': true,
    'east-coast': false,
    'north-central-inland': false,
  });

  const toggleOpen = (id: string) => {
    setOpenStates((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const isHi = language === 'hi';

  return (
    <aside
      className="regional-dropdowns-sidebar"
      aria-label={isHi ? 'क्षेत्रीय मत्स्य गाइड' : 'Regional Fish Guide'}
    >
      <div className="regional-dropdowns-header">
        <div className="regional-dropdowns-title">
          <Compass size={14} aria-hidden="true" />
          <span>{isHi ? 'क्षेत्रीय प्रमुख प्रजातियाँ' : 'REGIONAL CATCH GUIDE'}</span>
        </div>
        <span className="regional-dropdowns-badge">
          3 {isHi ? 'क्षेत्र' : 'Zones'}
        </span>
      </div>

      <div className="regional-dropdowns-list">
        {REGIONS.map((region) => {
          const isOpen = !!openStates[region.id];
          const title = isHi ? region.titleHi : region.titleEn;
          const subtitle = isHi ? region.subtitleHi : region.subtitleEn;

          return (
            <div
              key={region.id}
              className={`regional-card ${isOpen ? 'is-open' : ''}`}
            >
              <button
                type="button"
                className="regional-card-header"
                onClick={() => toggleOpen(region.id)}
                aria-expanded={isOpen}
              >
                <div className="regional-card-title-group">
                  <div className="regional-card-icon">
                    <Fish size={15} aria-hidden="true" />
                  </div>
                  <div className="regional-card-texts">
                    <span className="regional-card-title">{title}</span>
                    <span className="regional-card-subtitle">{subtitle}</span>
                  </div>
                </div>
                <div className="regional-card-chevron">
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              {isOpen && (
                <div className="regional-card-body">
                  <div className="fish-buttons-grid">
                    {region.fishItems.map((fish) => {
                      const name = isHi ? fish.nameHi : fish.nameEn;
                      const prompt = isHi ? fish.promptHi : fish.promptEn;

                      return (
                        <button
                          key={fish.id}
                          type="button"
                          className="fish-ask-button"
                          onClick={() => onSelectPrompt?.(prompt)}
                          title={isHi ? `${name} के बारे में पूछें` : `Ask about ${name}`}
                        >
                          <Fish size={12} className="fish-btn-icon" aria-hidden="true" />
                          <span className="fish-btn-name">{name}</span>
                          <Sparkles size={11} className="fish-btn-sparkle" aria-hidden="true" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
