'use client';
import { useState } from 'react';
import { Layers, ChevronDown, ChevronUp, Shield, Waves, AlertTriangle } from 'lucide-react';

export function MapLegend() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="absolute bottom-4 right-4 z-20 bg-[#0f1923]/90 border border-white/10 rounded-xl shadow-2xl backdrop-blur-md text-white text-xs p-3 select-none max-w-xs transition-all">
      <div
        className="flex items-center justify-between gap-3 cursor-pointer"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-1.5 font-semibold text-white/90">
          <Layers size={14} className="text-sky-400" />
          <span>Map Layers & Legends</span>
        </div>
        <button type="button" className="text-white/50 hover:text-white">
          {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {!collapsed && (
        <div className="mt-3 space-y-3 pt-2 border-t border-white/10">
          {/* Risk Levels */}
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40 block mb-1.5">
              Marine Risk Level
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#7de6c6]" />
                <span className="text-white/80">Low (0-35)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#facc15]" />
                <span className="text-white/80">Moderate (36-60)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#fb923c]" />
                <span className="text-white/80">High (61-80)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f87171]" />
                <span className="text-white/80">Extreme (81-100)</span>
              </div>
            </div>
          </div>

          {/* Zones & Routes */}
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40 block mb-1.5">
              Features
            </span>
            <div className="space-y-1 text-white/80">
              <div className="flex items-center gap-2">
                <span className="w-3 h-1 bg-[#61b7ff] rounded-full" />
                <span>Recommended Safe Route</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-1 bg-white/30 rounded-full border-b border-dashed border-white" />
                <span>Shortest Direct (Unsafe)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-white" />
                <span>PFZ (Potential Fishing Zone)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded bg-rose-500/50 border border-rose-400" />
                <span>Restricted Maritime Zone</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
