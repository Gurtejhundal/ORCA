'use client';

import { Crosshair, History, Layers3, Route, SlidersHorizontal, TriangleAlert, Waves } from 'lucide-react';
import type { AppLanguage } from './ask-orca-bar';

const TOOLS = [
  { id: 'recent', en: 'Recent Chat', hi: 'हाल की वार्ता', icon: History },
  { id: 'fishing', en: 'Fishing Zones', hi: 'मछली क्षेत्र', icon: Crosshair },
  { id: 'conditions', en: 'Conditions', hi: 'स्थिति', icon: Waves },
  { id: 'alerts', en: 'Alerts', hi: 'चेतावनी', icon: TriangleAlert },
  { id: 'route', en: 'Route', hi: 'मार्ग', icon: Route },
  { id: 'layers', en: 'Layers', hi: 'परतें', icon: Layers3 },
] as const;

export type OrcaToolId = (typeof TOOLS)[number]['id'];

function ToolButtons({ language, activeTool, hasHistory, onSelect }: { language: AppLanguage; activeTool: OrcaToolId | null; hasHistory: boolean; onSelect: (tool: OrcaToolId) => void }) {
  return TOOLS.map((tool) => (
    <button
      key={tool.id}
      type="button"
      aria-label={tool[language]}
      aria-pressed={activeTool === tool.id}
      disabled={tool.id === 'recent' && !hasHistory}
      onClick={(event) => {
        event.currentTarget.closest('details')?.removeAttribute('open');
        onSelect(tool.id);
      }}
    >
      <tool.icon size={18} strokeWidth={1.5} aria-hidden="true" />
      <span>{tool[language]}</span>
    </button>
  ));
}

export function OrcaToolRail({ language, activeTool, hasHistory, onSelect }: { language: AppLanguage; activeTool: OrcaToolId | null; hasHistory: boolean; onSelect: (tool: OrcaToolId) => void }) {
  const label = language === 'hi' ? 'समुद्री उपकरण' : 'Marine tools';
  return (
    <>
      <aside className="orca-tool-rail" aria-label={label}><ToolButtons language={language} activeTool={activeTool} hasHistory={hasHistory} onSelect={onSelect} /></aside>
      <details className="orca-tool-drawer">
        <summary><SlidersHorizontal size={18} aria-hidden="true" /><span>{label}</span></summary>
        <div aria-label={label}><ToolButtons language={language} activeTool={activeTool} hasHistory={hasHistory} onSelect={onSelect} /></div>
      </details>
    </>
  );
}
