'use client';
import { ShieldAlert, ShieldCheck, AlertOctagon, Activity, HelpCircle, CheckCircle2 } from 'lucide-react';
import type { RiskAssessment } from '@/services/marine-api';

interface SafetyCardProps {
  risk: RiskAssessment | null;
  locationName?: string;
}

export function SafetyCard({ risk, locationName }: SafetyCardProps) {
  if (!risk) return null;

  const levelColor =
    risk.level === 'LOW'
      ? '#7de6c6'
      : risk.level === 'MODERATE'
      ? '#facc15'
      : risk.level === 'HIGH'
      ? '#fb923c'
      : '#f87171';

  const isSafe = risk.level === 'LOW' || risk.level === 'MODERATE';

  return (
    <div className="bg-[#0f1923]/90 border border-white/10 rounded-xl p-4 shadow-xl text-white backdrop-blur-md">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div
            className="p-2 rounded-lg"
            style={{
              backgroundColor: `${levelColor}15`,
              color: levelColor,
              border: `1px solid ${levelColor}30`,
            }}
          >
            {isSafe ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
          </div>
          <div>
            <span className="text-[10px] font-semibold tracking-wider text-white/50 uppercase">
              Marine Risk Assessment {locationName ? `· ${locationName}` : ''}
            </span>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span
                className="text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
                style={{
                  backgroundColor: `${levelColor}20`,
                  color: levelColor,
                  border: `1px solid ${levelColor}40`,
                }}
              >
                {risk.level} RISK
              </span>
              <span className="text-xs text-white/60 font-normal">
                ({(risk.confidence * 100).toFixed(0)}% confidence)
              </span>
            </h3>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xl font-mono font-bold" style={{ color: levelColor }}>
            {risk.score}
            <span className="text-xs text-white/40 font-normal">/100</span>
          </div>
          <span className="text-[10px] text-white/50">Risk Index</span>
        </div>
      </div>

      {/* Official overrides alert */}
      {risk.official_overrides && risk.official_overrides.length > 0 && (
        <div className="mb-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
          <AlertOctagon size={16} className="shrink-0 text-rose-400 mt-0.5" />
          <div>
            <span className="font-bold block">Hard Marine Safety Gate Triggered</span>
            {risk.official_overrides.map((ov, i) => (
              <span key={i} className="block text-white/80 text-[11px] mt-0.5">
                • {ov.description} ({ov.source})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Risk Factors Breakdown */}
      <div className="space-y-2 mb-2">
        <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider block">
          Contributing Marine Risk Factors
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {risk.factors.map((f, i) => (
            <div key={i} className="p-2 rounded bg-white/5 border border-white/5 flex items-start justify-between gap-2">
              <div>
                <span className="font-semibold text-white/90 capitalize block">
                  {f.factor.replaceAll('_', ' ')}
                </span>
                <span className="text-[11px] text-white/60 leading-tight block mt-0.5">
                  {f.finding}
                </span>
              </div>
              <span className="font-mono text-[11px] text-white/40 shrink-0">
                +{f.contribution}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Missing critical data notice */}
      {risk.missing_critical_data && risk.missing_critical_data.length > 0 && (
        <div className="mt-3 pt-2 border-t border-white/10 flex items-center gap-1.5 text-[11px] text-amber-300/80">
          <HelpCircle size={12} />
          <span>Notice: missing {risk.missing_critical_data.join(', ')} data; penalties applied.</span>
        </div>
      )}
    </div>
  );
}
