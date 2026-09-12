'use client';

import { AskOrcaBar, type AppLanguage } from './ask-orca-bar';
import { OceanRippleVideo } from './ocean-ripple-video';
import { OrcaToolRail, type OrcaToolId } from './orca-tool-rail';

export function OrcaHero({
  language,
  onSubmitQuery,
  activeTool,
  hasHistory,
  onSelectTool,
}: {
  language: AppLanguage;
  onSubmitQuery: (query: string) => Promise<void>;
  activeTool: OrcaToolId | null;
  hasHistory: boolean;
  onSelectTool: (tool: OrcaToolId) => void;
}) {
  return (
    <section
      className="orca-hero"
      id="home"
      aria-label={language === 'hi' ? 'समुद्र के बारे में ORCA से पूछें' : 'Ask ORCA about the sea'}
    >
      <OceanRippleVideo ariaLabel={language === 'hi' ? 'समुद्र में चलती मछली पकड़ने की नाव' : 'Fishing boat moving through the ocean'} />
      <div className="orca-hero__legibility" aria-hidden="true" />
      <OrcaToolRail language={language} activeTool={activeTool} hasHistory={hasHistory} onSelect={onSelectTool} />
      <AskOrcaBar language={language} onSubmitQuery={onSubmitQuery} />
    </section>
  );
}
