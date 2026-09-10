'use client';

import { Crosshair, History, Route, TriangleAlert, Waves } from 'lucide-react';
import type { AppLanguage } from './ask-orca-bar';

const TOOLS = [
  { id: 'recent', en: 'Recent Chat', hi: 'हाल की वार्ता', icon: History },
  { id: 'fishing', en: 'Fishing Zones', hi: 'मछली क्षेत्र', icon: Crosshair },
  { id: 'conditions', en: 'Conditions', hi: 'स्थिति', icon: Waves },
  { id: 'alerts', en: 'Alerts', hi: 'चेतावनी', icon: TriangleAlert },
  { id: 'route', en: 'Route', hi: 'मार्ग', icon: Route },
] as const;

export type OrcaToolId = (typeof TOOLS)[number]['id'];

export function OrcaToolRail({ language, activeTool, hasHistory, onSelect }: { language: AppLanguage; activeTool: OrcaToolId | null; hasHistory: boolean; onSelect: (tool: OrcaToolId) => void }) {
  return (
    <aside className="orca-tool-rail" aria-label={language === 'hi' ? 'समुद्री उपकरण' : 'Marine tools'}>
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          type="button"
          aria-label={tool[language]}
          aria-pressed={activeTool === tool.id}
          disabled={tool.id === 'recent' && !hasHistory}
          onClick={() => onSelect(tool.id)}
        >
          <tool.icon size={19} strokeWidth={1.45} aria-hidden="true" />
          <span>{tool[language]}</span>
        </button>
      ))}
    </aside>
  );
}
