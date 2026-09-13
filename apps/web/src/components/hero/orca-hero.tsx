'use client';

import { AskOrcaBar, type AppLanguage } from './ask-orca-bar';
import { OceanRippleVideo } from './ocean-ripple-video';
import { MarineToolDock, type MarineToolId } from './marine-tool-dock';

export function OrcaHero({
  language,
  onSubmitQuery,
  activeTool,
  paused,
  onSelectTool,
}: {
  language: AppLanguage;
  onSubmitQuery: (query: string) => Promise<void>;
  activeTool: MarineToolId | null;
  paused: boolean;
  onSelectTool: (tool: MarineToolId) => void;
}) {
  return (
    <section
      className="orca-hero"
      id="home"
      aria-label={language === 'hi' ? 'समुद्र के बारे में ORCA से पूछें' : 'Ask ORCA about the sea'}
    >
      <OceanRippleVideo paused={paused} ariaLabel={language === 'hi' ? 'समुद्र में चलती मछली पकड़ने की नाव' : 'Fishing boat moving through the ocean'} />
      <div className="orca-hero__legibility" aria-hidden="true" />
      <h1 className="sr-only">{language === 'hi' ? 'ORCA — समुद्री निर्णय सहायक' : 'ORCA — marine decision assistant'}</h1>
      <MarineToolDock language={language} activeTool={activeTool} onSelect={onSelectTool} />
      <AskOrcaBar language={language} onSubmitQuery={onSubmitQuery} />
    </section>
  );
}
