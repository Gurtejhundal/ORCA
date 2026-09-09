'use client';
import { Check, AlertTriangle, ShieldCheck, Navigation, ChevronRight, X } from 'lucide-react';
import type { RankedPFZCandidate } from '@/services/marine-api';

interface PFZRecommendationCardProps {
  candidate: RankedPFZCandidate | null;
  allCandidates?: RankedPFZCandidate[];
  onSelectCandidate?: (candidate: RankedPFZCandidate) => void;
  onShowSafeRoute?: (candidate: RankedPFZCandidate) => void;
}

export function PFZRecommendationCard({
  candidate,
  allCandidates = [],
  onSelectCandidate,
  onShowSafeRoute,
}: PFZRecommendationCardProps) {
  if (!candidate) return null;

  const isSafe = !candidate.excluded && ['LOW', 'MODERATE'].includes(candidate.risk_level);
  const riskColor =
    candidate.risk_level === 'LOW'
      ? '#7de6c6'
      : candidate.risk_level === 'MODERATE'
      ? '#facc15'
      : candidate.risk_level === 'HIGH'
      ? '#fb923c'
      : '#f87171';

  return (
    <div className="bg-[#0f1923]/90 border border-white/10 rounded-xl p-4 shadow-xl text-white backdrop-blur-md">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck size={18} />
          </div>
          <div>
            <span className="text-[10px] font-semibold tracking-wider text-white/50 uppercase">
              Recommended Fishing Zone
            </span>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              {candidate.name}
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
                style={{
                  backgroundColor: `${riskColor}20`,
                  color: riskColor,
                  border: `1px solid ${riskColor}40`,
                }}
              >
                {candidate.risk_level} RISK
              </span>
            </h3>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xl font-mono font-bold text-white">
            {candidate.risk_score}
            <span className="text-xs text-white/40 font-normal">/100</span>
          </div>
          <span className="text-[10px] text-white/50">Risk Score</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-lg bg-white/5 mb-3 text-xs">
        <div>
          <span className="text-[10px] text-white/40 block">Distance</span>
          <span className="font-semibold">{candidate.distance_km.toFixed(1)} km</span>
        </div>
        <div>
          <span className="text-[10px] text-white/40 block">Rank Score</span>
          <span className="font-semibold">{candidate.ranking_score.toFixed(1)}</span>
        </div>
        <div>
          <span className="text-[10px] text-white/40 block">Status</span>
          <span
            className={`font-semibold flex items-center gap-1 ${
              isSafe ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {isSafe ? <Check size={12} /> : <X size={12} />}
            {isSafe ? 'Eligible for review' : 'Excluded'}
          </span>
        </div>
      </div>

      {/* Deterministic Checklist */}
      <div className="space-y-1.5 mb-4 text-xs">
        <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider block mb-1">
          Deterministic Safety Checklist
        </span>
        <p>Source: {candidate.source}</p>
        {candidate.factors.map(f => <p key={f.factor}>{f.finding}</p>)}
        {candidate.exclusion_reasons.map(reason => (
          <p key={reason} className="text-rose-300">{reason}</p>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-2 border-t border-white/10">
        {onShowSafeRoute && (
          <button
            type="button"
            onClick={() => onShowSafeRoute(candidate)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-xs font-semibold transition-colors"
          >
            <Navigation size={13} />
            Show Safe Route
          </button>
        )}
      </div>

      {/* Other candidates comparison */}
      {allCandidates.length > 1 && (
        <details className="mt-3 text-xs text-white/60">
          <summary className="cursor-pointer hover:text-white/80 text-[11px] select-none py-1">
            Compare other candidate zones ({allCandidates.length})
          </summary>
          <div className="mt-2 space-y-1 max-h-36 overflow-y-auto">
            {allCandidates.map((c) => (
              <button
                key={c.pfz_id}
                type="button"
                onClick={() => onSelectCandidate?.(c)}
                className={`w-full flex items-center justify-between p-2 rounded text-left transition-colors ${
                  c.pfz_id === candidate.pfz_id
                    ? 'bg-white/10 text-white font-medium'
                    : 'hover:bg-white/5 text-white/70'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      !c.excluded ? 'bg-emerald-400' : 'bg-rose-400'
                    }`}
                  />
                  <span>{c.name}</span>
                </div>
                <div className="flex items-center gap-3 text-white/50">
                  <span>{c.distance_km.toFixed(1)} km</span>
                  <span className="font-mono">{c.risk_score}/100</span>
                  <ChevronRight size={12} />
                </div>
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
