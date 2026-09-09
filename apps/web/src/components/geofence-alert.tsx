'use client';
import { AlertOctagon, Compass, ShieldAlert, ArrowRight, ShieldCheck } from 'lucide-react';
import type { GeofenceStatus, GeofenceWarning } from '@/services/marine-api';

interface GeofenceAlertBannerProps {
  status: GeofenceStatus | null;
  onApplyHeading?: (heading: number) => void;
}

export function GeofenceAlertBanner({ status, onApplyHeading }: GeofenceAlertBannerProps) {
  if (!status || status.status === 'SAFE' || !status.warnings || status.warnings.length === 0) {
    return null;
  }

  const primaryWarning = status.warnings[0];
  const isBreach = status.status === 'BREACH' || primaryWarning.level === 'CRITICAL';
  const isWarning = status.status === 'WARNING' || primaryWarning.level === 'WARNING';

  const bgColor = isBreach ? 'bg-rose-950/90 border-rose-500/50' : 'bg-amber-950/90 border-amber-500/50';
  const textColor = isBreach ? 'text-rose-200' : 'text-amber-200';
  const badgeColor = isBreach ? 'bg-rose-500 text-white' : 'bg-amber-500 text-black font-bold';

  return (
    <div
      className={`rounded-xl border p-3.5 shadow-2xl backdrop-blur-md ${bgColor} ${textColor} transition-all duration-300`}
      role="alert"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-white/10 shrink-0 mt-0.5">
            {isBreach ? (
              <AlertOctagon size={20} className="text-rose-400 animate-pulse" />
            ) : (
              <ShieldAlert size={20} className="text-amber-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold ${badgeColor}`}>
                {isBreach ? 'CRITICAL MARITIME BOUNDARY BREACH' : 'PROXIMITY WARNING'}
              </span>
              {primaryWarning.time_to_breach_minutes && (
                <span className="text-xs opacity-80 font-mono">
                  Breach in ~{primaryWarning.time_to_breach_minutes.toFixed(0)} min
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-white">
              {primaryWarning.message}
            </p>
            {status.recommended_action && (
              <p className="text-xs opacity-90 mt-1">
                {status.recommended_action}
              </p>
            )}
          </div>
        </div>

        {primaryWarning.recommended_heading_degrees !== undefined &&
          primaryWarning.recommended_heading_degrees !== null && (
            <div className="shrink-0 flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold bg-black/40 px-2.5 py-1.5 rounded-lg border border-white/10 text-white">
                <Compass size={14} className="text-sky-400" />
                Safe Escape: {primaryWarning.recommended_heading_degrees.toFixed(0)}°
              </div>
              {onApplyHeading && (
                <button
                  type="button"
                  onClick={() => onApplyHeading(primaryWarning.recommended_heading_degrees!)}
                  className="px-2 py-1 rounded bg-white/15 hover:bg-white/25 text-white text-[11px] font-semibold transition-colors flex items-center gap-1"
                >
                  Apply Heading <ArrowRight size={11} />
                </button>
              )}
            </div>
          )}
      </div>

      {status.boundaries && status.boundaries.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-white/10 flex flex-wrap gap-3 text-xs opacity-80">
          {status.boundaries.map((b) => (
            <span key={b.zone_id}>
              {b.zone_name}: {b.distance_km.toFixed(1)} km away ({b.bearing_degrees.toFixed(0)}°)
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
