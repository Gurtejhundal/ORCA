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

export function OrcaToolRail() {
  const [activeTool, setActiveTool] = useState('Fishing Zones');

  return (
    <aside className="orca-tool-rail" aria-label="Marine tools">
      {TOOLS.map(({ label, icon: Icon }) => (
        <button
          key={label}
          type="button"
          aria-pressed={activeTool === label}
          onClick={() => setActiveTool(label)}
        >
          <Icon size={19} strokeWidth={1.45} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </aside>
  );
}
