'use client';

import { Crosshair, Fish, Layers3, Route, SlidersHorizontal, TriangleAlert, Waves } from 'lucide-react';
import type { AppLanguage } from './ask-orca-bar';

const TOOLS = [
  { id: 'fishing', en: 'Fishing Zones', hi: 'मछली क्षेत्र', helpEn: 'PFZ areas', helpHi: 'PFZ क्षेत्र', icon: Crosshair },
  { id: 'fishes', en: 'Fishes', hi: 'मछलियाँ', helpEn: 'Local grounds', helpHi: 'स्थानीय क्षेत्र', icon: Fish },
  { id: 'conditions', en: 'Conditions', hi: 'समुद्री स्थिति', helpEn: 'Waves and wind', helpHi: 'लहर और हवा', icon: Waves },
  { id: 'alerts', en: 'Alerts', hi: 'चेतावनी', helpEn: 'Warnings', helpHi: 'चेतावनी', icon: TriangleAlert },
  { id: 'route', en: 'Route', hi: 'मार्ग', helpEn: 'Safe passage', helpHi: 'सुरक्षित मार्ग', icon: Route },
  { id: 'layers', en: 'Layers', hi: 'परतें', helpEn: 'Map evidence', helpHi: 'मानचित्र प्रमाण', icon: Layers3 },
] as const;

export type MarineToolId = (typeof TOOLS)[number]['id'];

export function MarineToolDock({ language, activeTool, onSelect }: {
  language: AppLanguage;
  activeTool: MarineToolId | null;
  onSelect: (tool: MarineToolId) => void;
}) {
  const buttons = () => TOOLS.map(({ id, icon: Icon, ...label }) => (
    <button key={id} type="button" aria-pressed={activeTool === id} title={`${label[language]} · ${language === 'hi' ? label.helpHi : label.helpEn}`} onClick={(event) => {
      event.currentTarget.closest('details')?.removeAttribute('open');
      onSelect(id);
    }}>
      <Icon size={20} strokeWidth={1.6} aria-hidden="true" />
      <span>{label[language]}<small>{language === 'hi' ? label.helpHi : label.helpEn}</small></span>
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
