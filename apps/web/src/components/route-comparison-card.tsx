'use client';
import { ShieldCheck, AlertTriangle, Check, GitCompare } from 'lucide-react';
import type { RouteComparison, RouteResult } from '@/services/marine-api';

interface RouteComparisonCardProps {
  comparison: RouteComparison | null;
  onSelectRoute?: (route: RouteResult) => void;
}

export function RouteComparisonCard({
  comparison,
  onSelectRoute,
}: RouteComparisonCardProps) {
  if (!comparison) return null;

  const { shortest_route, safe_route, detour_distance_km, detour_percentage, extra_duration_hours, risk_reduction_percentage, trade_off_explanation } = comparison;

  return (
    <div className="bg-[#0f1923]/90 border border-white/10 rounded-xl p-4 shadow-xl text-white backdrop-blur-md">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <GitCompare size={18} />
          </div>
          <div>
            <span className="text-[10px] font-semibold tracking-wider text-white/50 uppercase">
              Route Optimization & Safety Comparison
            </span>
            <h3 className="text-base font-bold text-white">
              Direct Route vs Recommended Safe Detour
            </h3>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs font-semibold px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            -{risk_reduction_percentage.toFixed(0)}% Risk
          </div>
        </div>
      </div>

      {/* Side-by-Side Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        {/* Shortest Route */}
        <div className="p-3 rounded-lg bg-white/5 border border-white/10 relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white/70 uppercase">
              Shortest Direct Route
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-semibold uppercase">
              {shortest_route.overall_risk_level} Risk ({shortest_route.overall_risk_score}/100)
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs mb-2">
            <div>
              <span className="text-[10px] text-white/40 block">Distance</span>
              <span className="font-semibold">{shortest_route.total_distance_km.toFixed(1)} km</span>
            </div>
            <div>
              <span className="text-[10px] text-white/40 block">Est. Time</span>
              <span className="font-semibold">{shortest_route.estimated_duration_hours.toFixed(1)} h</span>
            </div>
            <div>
              <span className="text-[10px] text-white/40 block">Safety</span>
              <span className="font-semibold">{shortest_route.safety_score}/100</span>
            </div>
          </div>

          {shortest_route.warnings.length > 0 && (
            <div className="text-[11px] text-rose-300/90 space-y-1 mb-2">
              {shortest_route.warnings.slice(0, 2).map((w, i) => (
                <div key={i} className="flex items-start gap-1">
                  <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {onSelectRoute && (
            <button
              type="button"
              onClick={() => onSelectRoute(shortest_route)}
              className="w-full mt-1 py-1.5 px-2 rounded bg-white/5 hover:bg-white/10 text-white/70 text-xs font-medium transition-colors"
            >
              Inspect Direct Route
            </button>
          )}
        </div>

        {/* Safe Route */}
        <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/30 relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-sky-300 uppercase flex items-center gap-1">
              <ShieldCheck size={14} /> Recommended Safe Route
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold uppercase">
              {safe_route.overall_risk_level} Risk ({safe_route.overall_risk_score}/100)
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs mb-2">
            <div>
              <span className="text-[10px] text-white/40 block">Distance</span>
              <span className="font-semibold text-emerald-300">
                {safe_route.total_distance_km.toFixed(1)} km
              </span>
            </div>
            <div>
              <span className="text-[10px] text-white/40 block">Est. Time</span>
              <span className="font-semibold">{safe_route.estimated_duration_hours.toFixed(1)} h</span>
            </div>
            <div>
              <span className="text-[10px] text-white/40 block">Safety</span>
              <span className="font-semibold text-emerald-300">{safe_route.safety_score}/100</span>
            </div>
          </div>

          <div className="text-[11px] text-sky-200/90 space-y-1 mb-2">
            <div className="flex items-center gap-1 text-emerald-300">
              <Check size={11} />
              <span>Detour avoids high waves & restricted marine zones</span>
            </div>
            {safe_route.avoided_hazards && safe_route.avoided_hazards.length > 0 && (
              <div className="text-white/60">
                Avoided: {safe_route.avoided_hazards.join(', ')}
              </div>
            )}
          </div>

          {onSelectRoute && (
            <button
              type="button"
              onClick={() => onSelectRoute(safe_route)}
              className="w-full mt-1 py-1.5 px-2 rounded bg-sky-500/30 hover:bg-sky-500/40 text-sky-200 text-xs font-medium transition-colors"
            >
              Select & Draw Safe Route
            </button>
          )}
        </div>
      </div>

      {/* Trade-off summary bar */}
      <div className="p-2.5 rounded-lg bg-white/5 border border-white/5 text-xs text-white/80 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2 font-medium">
          <span>Detour penalty: +{detour_distance_km.toFixed(1)} km (+{detour_percentage.toFixed(0)}%)</span>
          <span>Extra transit time: +{(extra_duration_hours * 60).toFixed(0)} min</span>
          <span className="text-emerald-300 font-semibold">
            Risk reduced by {risk_reduction_percentage.toFixed(0)}%
          </span>
        </div>
        <p className="text-[11px] text-white/60 leading-normal pt-1 border-t border-white/5">
          {trade_off_explanation}
        </p>
      </div>
    </div>
  );
}
