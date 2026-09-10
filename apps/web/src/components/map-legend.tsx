'use client';
import { useState } from 'react';
import { Layers, ChevronDown, ChevronUp } from 'lucide-react';

const LEGEND_COPY = {
  en: {
    title: 'Map Layers & Legends',
    toggle: 'Toggle map legend',
    risk: 'Marine Risk Level',
    low: 'Low (0-35)',
    moderate: 'Moderate (36-60)',
    high: 'High (61-80)',
    extreme: 'Extreme (81-100)',
    features: 'Features',
    safeRoute: 'Recommended Safe Route',
    unsafeRoute: 'Shortest Direct (Unsafe)',
    pfz: 'PFZ (Potential Fishing Zone)',
    restricted: 'Restricted Maritime Zone',
  },
  hi: {
    title: 'मानचित्र परतें और संकेत',
    toggle: 'मानचित्र संकेत खोलें या बंद करें',
    risk: 'समुद्री जोखिम स्तर',
    low: 'कम (0-35)',
    moderate: 'मध्यम (36-60)',
    high: 'उच्च (61-80)',
    extreme: 'अत्यधिक (81-100)',
    features: 'विशेषताएँ',
    safeRoute: 'सुझाया सुरक्षित मार्ग',
    unsafeRoute: 'सबसे छोटा सीधा मार्ग (असुरक्षित)',
    pfz: 'PFZ (संभावित मछली क्षेत्र)',
    restricted: 'प्रतिबंधित समुद्री क्षेत्र',
  },
} as const;

export function MapLegend({ language = 'en' }: { language?: 'en' | 'hi' }) {
  const [collapsed, setCollapsed] = useState(false);
  const copy = LEGEND_COPY[language];

  return (
    <div className="absolute bottom-4 right-4 z-20 bg-[#0f1923]/90 border border-white/10 rounded-xl shadow-2xl backdrop-blur-md text-white text-xs p-3 select-none max-w-xs transition-all">
      <div
        className="flex items-center justify-between gap-3 cursor-pointer"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-1.5 font-semibold text-white/90">
          <Layers size={14} className="text-sky-400" />
          <span>{copy.title}</span>
        </div>
        <button type="button" className="text-white/50 hover:text-white" aria-label={copy.toggle}>
          {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {!collapsed && (
        <div className="mt-3 space-y-3 pt-2 border-t border-white/10">
          {/* Risk Levels */}
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40 block mb-1.5">
              {copy.risk}
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#7de6c6]" />
                <span className="text-white/80">{copy.low}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#facc15]" />
                <span className="text-white/80">{copy.moderate}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#fb923c]" />
                <span className="text-white/80">{copy.high}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f87171]" />
                <span className="text-white/80">{copy.extreme}</span>
              </div>
            </div>
          </div>

          {/* Zones & Routes */}
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40 block mb-1.5">
              {copy.features}
            </span>
            <div className="space-y-1 text-white/80">
              <div className="flex items-center gap-2">
                <span className="w-3 h-1 bg-[#61b7ff] rounded-full" />
                <span>{copy.safeRoute}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-1 bg-white/30 rounded-full border-b border-dashed border-white" />
                <span>{copy.unsafeRoute}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-white" />
                <span>{copy.pfz}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded bg-rose-500/50 border border-rose-400" />
                <span>{copy.restricted}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
