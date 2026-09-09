'use client';

import { Crosshair, Layers3, Route, TriangleAlert, Waves } from 'lucide-react';
import { useState } from 'react';

const TOOLS = [
  { label: 'Fishing Zones', icon: Crosshair },
  { label: 'Conditions', icon: Waves },
  { label: 'Alerts', icon: TriangleAlert },
  { label: 'Route', icon: Route },
  { label: 'Layers', icon: Layers3 },
];
const DATA_DESTINATIONS: Record<string, string> = {
  'Fishing Zones': '/dashboard#marine-map',
  Conditions: '/dashboard#marine-data',
  Alerts: '/dashboard#marine-alerts',
  Layers: '/dashboard#marine-map',
};

export function OrcaToolRail() {
  const [activeTool, setActiveTool] = useState('Fishing Zones');

  return (
    <aside className="orca-tool-rail" aria-label="Marine tools">
      {TOOLS.map(({ label, icon: Icon }) => (
        <button
          key={label}
          type="button"
          aria-pressed={activeTool === label}
          onClick={() => {
            setActiveTool(label);
            const destination = DATA_DESTINATIONS[label];
            if (destination) window.location.assign(destination);
          }}
        >
          <Icon size={19} strokeWidth={1.45} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </aside>
  );
}
