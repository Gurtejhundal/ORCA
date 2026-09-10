'use client';

import { AskOrcaBar, type AppLanguage } from './ask-orca-bar';
import { OceanRippleVideo } from './ocean-ripple-video';
import { OrcaNav } from './orca-nav';
import { OrcaToolRail, type OrcaToolId } from './orca-tool-rail';

export function LanguageSwitch({
  language,
  onChange,
  surface = 'hero',
}: {
  language: AppLanguage;
  onChange: (language: AppLanguage) => void;
  surface?: 'hero' | 'overlay';
}) {
  return (
    <div className={`language-switch language-switch--${surface}`} role="group" aria-label={language === 'hi' ? 'इंटरफ़ेस भाषा चुनें' : 'Choose interface language'}>
      <button type="button" aria-pressed={language === 'en'} onClick={() => onChange('en')}>EN</button>
      <button type="button" lang="hi" aria-pressed={language === 'hi'} onClick={() => onChange('hi')}>हिंदी</button>
    </div>
  );
}

export function OrcaHero({
  onNavigate,
  language,
  onLanguageChange,
  onSubmitQuery,
  activeView,
  activeTool,
  hasHistory,
  onSelectTool,
}: {
  onNavigate?: (view: string) => void;
  language: AppLanguage;
  onLanguageChange: (language: AppLanguage) => void;
  onSubmitQuery: (query: string) => Promise<void>;
  activeView: string | null;
  activeTool: OrcaToolId | null;
  hasHistory: boolean;
  onSelectTool: (tool: OrcaToolId) => void;
}) {
  return (
    <section
      className="orca-hero"
      id="home"
      aria-label={language === 'hi' ? 'समुद्र के बारे में ORCA से पूछें' : 'Ask ORCA about the sea'}
      onWheel={(event) => {
        if (event.deltaY < 0 && hasHistory) onNavigate?.('chat');
      }}
    >
      <OceanRippleVideo ariaLabel={language === 'hi' ? 'समुद्र में चलती मछली पकड़ने की नाव' : 'Fishing boat moving through the ocean'} />
      <div className="orca-hero__legibility" aria-hidden="true" />
      <OrcaNav language={language} activeView={activeView} onNavigate={onNavigate} />
      <LanguageSwitch language={language} onChange={onLanguageChange} />
      <OrcaToolRail language={language} activeTool={activeTool} hasHistory={hasHistory} onSelect={onSelectTool} />
      <AskOrcaBar language={language} onSubmitQuery={onSubmitQuery} />
    </section>
  );
}
