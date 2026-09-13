'use client';

import { Crosshair, Layers3, Route, SlidersHorizontal, TriangleAlert, Waves } from 'lucide-react';
import type { AppLanguage } from './ask-orca-bar';

const TOOLS = [
  { id: 'fishing', en: 'Fishing Zones', hi: 'मछली क्षेत्र', icon: Crosshair },
  { id: 'conditions', en: 'Conditions', hi: 'समुद्री स्थिति', icon: Waves },
  { id: 'alerts', en: 'Alerts', hi: 'चेतावनी', icon: TriangleAlert },
  { id: 'route', en: 'Route', hi: 'मार्ग', icon: Route },
  { id: 'layers', en: 'Layers', hi: 'परतें', icon: Layers3 },
] as const;

export type MarineToolId = (typeof TOOLS)[number]['id'];

export function MarineToolDock({ language, activeTool, onSelect }: {
  language: AppLanguage;
  activeTool: MarineToolId | null;
  onSelect: (tool: MarineToolId) => void;
}) {
  const buttons = () => TOOLS.map(({ id, icon: Icon, ...label }) => (
    <button key={id} type="button" aria-pressed={activeTool === id} onClick={(event) => {
      event.currentTarget.closest('details')?.removeAttribute('open');
      onSelect(id);
    }}>
      <Icon size={22} strokeWidth={1.6} aria-hidden="true" /><span>{label[language]}</span>
    </button>
  ));
  const label = language === 'hi' ? 'समुद्री उपकरण' : 'Marine Tools';
  return (
    <>
      <aside className="marine-tool-dock marine-glass marine-glass--dock" aria-label={label}>{buttons()}</aside>
      <details className="marine-tool-panel">
        <summary className="marine-glass marine-glass--dock" aria-label={label}><SlidersHorizontal size={20} strokeWidth={1.6} aria-hidden="true" /><span>{label}</span></summary>
        <div className="marine-glass marine-glass--dock" aria-label={label}>{buttons()}</div>
      </details>
    </>
  );
}
