'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Compass, Fish, Sparkles } from 'lucide-react';
import type { AppLanguage } from './hero/ask-orca-bar';

interface RegionInfo {
  id: string;
  titleEn: string;
  titleHi: string;
  subtitleEn: string;
  subtitleHi: string;
  speciesEn: string;
  speciesHi: string;
  speciesList: string[];
}

const REGIONS: RegionInfo[] = [
  {
    id: 'west-coast',
    titleEn: 'West coast (Kerala–Karnataka–Goa–Maharashtra)',
    titleHi: 'पश्चिमी तट (केरल-कर्नाटक-गोवा-महाराष्ट्र)',
    subtitleEn: 'Arabian Sea Marine Shelf',
    subtitleHi: 'अरब सागर समुद्री तट',
    speciesEn: 'oil sardine, mackerel, seer, pomfret, prawns, Bombay duck.',
    speciesHi: 'ऑयल सार्डिन, मैकेरल, सीर (सुरमई), पॉम्फ्रेट, झींगा, बॉम्बे डक।',
    speciesList: ['oil sardine', 'mackerel', 'seer fish', 'pomfret', 'prawns', 'Bombay duck'],
  },
  {
    id: 'east-coast',
    titleEn: 'East coast (Odisha–Andhra–Tamil Nadu–West Bengal)',
    titleHi: 'पूर्वी तट (ओडिशा-आंध्र-तमिलनाडु-पश्चिम बंगाल)',
    subtitleEn: 'Bay of Bengal Coastal Zone',
    subtitleHi: 'बंगाल की खाड़ी तटीय क्षेत्र',
    speciesEn: 'mackerel, sardine, seer, prawns, hilsa (especially in WB/Bangladesh border rivers), various snappers.',
    speciesHi: 'मैकेरल, सार्डिन, सीर, झींगा, हिलसा (विशेष रूप से पश्चिम बंगाल/बांग्लादेश सीमा नदियों में), विभिन्न स्नैपर्स।',
    speciesList: ['mackerel', 'sardine', 'seer fish', 'prawns', 'hilsa', 'snappers'],
  },
  {
    id: 'north-central-inland',
    titleEn: 'North/central India (inland)',
    titleHi: 'उत्तर/मध्य भारत (अंतर्देशीय)',
    subtitleEn: 'Rivers, Lakes & Reservoirs',
    subtitleHi: 'नदियाँ, झीलें और जलाशय',
    speciesEn: 'rohu, catla, mrigal, pangasius, tilapia, magur.',
    speciesHi: 'रोहू, कतला, मृगल, पंगासियस, तिलापिया, मागुर।',
    speciesList: ['rohu', 'catla', 'mrigal', 'pangasius', 'tilapia', 'magur'],
  },
];

export function RegionalFishDropdowns({
  language = 'en',
  onSelectPrompt,
}: {
  language?: AppLanguage;
  onSelectPrompt?: (prompt: string) => void;
}) {
  // Default open state for the 3 dropdowns
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
    <aside className="regional-dropdowns-sidebar" aria-label={isHi ? 'क्षेत्रीय मत्स्य गाइड' : 'Regional Fish Guide'}>
      <div className="regional-dropdowns-header">
        <div className="regional-dropdowns-title">
          <Compass size={14} aria-hidden="true" />
          <span>{isHi ? 'क्षेत्रीय प्रमुख प्रजातियाँ' : 'REGIONAL CATCH GUIDE'}</span>
        </div>
        <span className="regional-dropdowns-badge">3 {isHi ? 'क्षेत्र' : 'Zones'}</span>
      </div>

      <div className="regional-dropdowns-list">
        {REGIONS.map((region) => {
          const isOpen = !!openStates[region.id];
          const title = isHi ? region.titleHi : region.titleEn;
          const subtitle = isHi ? region.subtitleHi : region.subtitleEn;
          const content = isHi ? region.speciesHi : region.speciesEn;

          return (
            <div key={region.id} className={`regional-card ${isOpen ? 'is-open' : ''}`}>
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
                  <p className="regional-card-content">{content}</p>

                  {onSelectPrompt && (
                    <div className="regional-card-chips">
                      <span className="chips-label">
                        <Sparkles size={11} aria-hidden="true" />
                        {isHi ? 'पूछें:' : 'Ask:'}
                      </span>
                      {region.speciesList.slice(0, 3).map((sp) => (
                        <button
                          key={sp}
                          type="button"
                          className="species-chip"
                          onClick={() =>
                            onSelectPrompt(
                              isHi
                                ? `${title} में ${sp} मछली पकड़ने के बारे में बताएं`
                                : `Tell me about fishing for ${sp} in ${title}`
                            )
                          }
                        >
                          {sp}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
