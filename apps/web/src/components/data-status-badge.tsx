'use client';
import { useEffect, useState } from 'react';
import { Activity, Database, RefreshCw } from 'lucide-react';
import { marineApi, type DataFreshnessSummary, type SystemStatusResponse } from '@/services/marine-api';

export function DataStatusBadge() {
  const [freshness, setFreshness] = useState<DataFreshnessSummary | null>(null);
  const [status, setStatus] = useState<SystemStatusResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const [f, s] = await Promise.all([
        marineApi.getDataFreshness(),
        marineApi.getSystemStatus(),
      ]);
      setFreshness(f);
      setStatus(s);
    } catch {
      setFreshness(null);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = setInterval(() => void refresh(), 60000);
    return () => {
      window.clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  const mode = status?.mode ?? freshness?.mode ?? 'unavailable';
  const isDemo = mode === 'demo';

  const dotColor = (st?: string) => {
    switch (st) {
      case 'current':
        return '#7de6c6';
      case 'aging':
        return '#e7a569';
      case 'stale':
        return '#dc8a90';
      case 'demo':
        return '#61b7ff';
      default:
        return '#8a99a8';
    }
  };

  return (
    <div className="relative inline-block text-left">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border border-white/10 bg-black/40 backdrop-blur-md text-white/90 hover:bg-white/10 transition-colors"
          title="Click to view data freshness and system status"
        >
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: dotColor(freshness?.overall_status) }}
          />
          <span className="font-semibold tracking-wide uppercase">
            {isDemo ? 'Demo Replay' : mode === 'unavailable' ? 'Status unavailable' : `Live mode · ${freshness?.overall_status ?? 'checking'}`}
          </span>
          <Activity size={12} className="opacity-60 ml-0.5" />
        </button>
      </div>

      {open && (
        <div
          className="absolute right-0 mt-2 w-80 rounded-lg border border-white/15 bg-neutral-900/95 backdrop-blur-xl p-4 shadow-2xl z-50 text-xs text-white/90 animate-in fade-in zoom-in-95 duration-150"
          style={{ background: 'rgba(18, 24, 33, 0.95)' }}
        >
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center gap-1.5 font-bold">
              <Database size={14} className="text-sky-400" />
              <span>DATA FRESHNESS & PROVENANCE</span>
            </div>
            <button
              onClick={() => void refresh()}
              disabled={loading}
              className="p-1 hover:text-white text-white/60 transition-colors"
              title="Refresh status"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          <p className="text-[11px] text-white/60 mt-2 mb-3">
            {freshness?.notice ||
              'Latest available marine observations, advisories, and forecasts.'}
          </p>

          <div className="space-y-1.5">
            {[
              { key: 'pfz', label: 'PFZ Products', type: 'Near-real-time' },
              { key: 'ocean', label: 'Ocean Forecast (Waves/Currents)', type: 'Forecast' },
              { key: 'weather', label: 'Weather (Wind/Visibility)', type: 'Forecast' },
              { key: 'alerts', label: 'Disaster / Cyclone Hazards', type: 'Near-real-time' },
              { key: 'sst', label: 'Sea Surface Temperature', type: 'Satellite' },
              { key: 'chlorophyll', label: 'Ocean Chlorophyll', type: 'Satellite' },
              { key: 'gps', label: 'Vessel Navigation GPS', type: 'Live' },
            ].map(({ key, label, type }) => {
              const item = freshness?.datasets[key];
              const st = item?.freshness_status ?? (isDemo ? 'demo' : 'unavailable');
              return (
                <div
                  key={key}
                  className="flex items-center justify-between py-1 px-1.5 rounded bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: dotColor(st) }}
                    />
                    <span className="font-medium">{label}</span>
                  </div>
                  <div className="text-right">
                    <span className="capitalize font-semibold text-[11px]">
                      {st}
                    </span>
                    <span className="text-[10px] text-white/50 block">
                      {item?.age_minutes != null
                        ? `${Math.round(item.age_minutes)}m ago`
                        : type}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-white/60">
            <span>Voice Provider:</span>
            <span className="font-medium text-white/80 capitalize">
              {status?.voice ?? 'Unavailable'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-white/60 mt-1">
            <span>LLM Provider:</span>
            <span className="font-medium text-white/80 capitalize">
              {status?.llm || 'Unavailable'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full mt-3 py-1.5 text-center text-xs font-medium rounded bg-white/10 hover:bg-white/15 text-white transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
