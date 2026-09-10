'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Square, FastForward, Navigation2, Compass, AlertCircle, CheckCircle2 } from 'lucide-react';
import { marineApi, type SimulationState, type Location, type RouteResult } from '@/services/marine-api';

interface SimulationWidgetProps {
  routeId?: string;
  origin?: Location;
  destination?: Location;
  onVesselMove?: (position: Location, heading: number) => void;
  onRouteRecalculated?: (newRoute: RouteResult) => void;
}

export function SimulationWidget({
  routeId,
  origin,
  destination,
  onVesselMove,
  onRouteRecalculated,
}: SimulationWidgetProps) {
  const [simState, setSimState] = useState<SimulationState | null>(null);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const stepping = useRef(false);
  const [hazardTest, setHazardTest] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  async function handleStart() {
    setLoading(true);
    setError('');
    try {
      const state = await marineApi.startSimulation({
        route_id: routeId,
        origin: origin ?? { lat: 10.767, lon: 79.872 },
        destination: destination ?? { lat: 10.900, lon: 80.050 },
        speed_knots: 14,
        simulate_hazard_emergence: hazardTest,
      });
      setSimState(state);
      setRunning(true);
      if (state.current_position && onVesselMove) {
        onVesselMove(state.current_position, state.current_heading);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Simulation unavailable');
    } finally {
      setLoading(false);
    }
  }

  const handleStep = useCallback(async () => {
    if (!simState || stepping.current) return;
    stepping.current = true;
    try {
      const res = await marineApi.stepSimulation(simState.simulation_id);
      setSimState(res.state);

      if (res.state.current_position && onVesselMove) {
        onVesselMove(res.state.current_position, res.state.current_heading);
      }

      if (res.state.route_needs_recalculation && res.state.recalculated_route && onRouteRecalculated) {
        onRouteRecalculated(res.state.recalculated_route);
      }

      if (res.state.is_completed) {
        setRunning(false);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Simulation step failed');
      setRunning(false);
    } finally {
      stepping.current = false;
    }
  }, [onRouteRecalculated, onVesselMove, simState]);

  async function handleStop() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRunning(false);
    if (simState) {
      try {
        await marineApi.stopSimulation(simState.simulation_id);
      } catch {
        // Ignored
      }
    }
  }

  // Automatic stepping when running
  useEffect(() => {
    if (running && simState && !simState.is_completed) {
      timerRef.current = setInterval(() => {
        void handleStep();
      }, 2500);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [handleStep, running, simState]);

  return (
    <div className="bg-[#0f1923]/90 border border-white/10 rounded-xl p-4 shadow-xl text-white backdrop-blur-md">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Navigation2 size={18} />
          </div>
          <div>
            <span className="text-[10px] font-semibold tracking-wider text-white/50 uppercase">
              Vessel Simulation & Dynamic Reroute
            </span>
            <h3 className="text-base font-bold text-white">
              Deterministic Voyage Simulator
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!simState || simState.is_completed ? (
            <button
              type="button"
              disabled={loading}
              onClick={handleStart}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-colors"
            >
              <Play size={13} />
              Start Voyage
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setRunning(!running)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                  running
                    ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30'
                    : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {running ? <Square size={12} /> : <Play size={12} />}
                {running ? 'Pause' : 'Resume'}
              </button>

              <button
                type="button"
                onClick={handleStep}
                disabled={running}
                className="px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors flex items-center gap-1"
                title="Advance 5 minutes"
              >
                <FastForward size={12} />
                +5m
              </button>

              <button
                type="button"
                onClick={handleStop}
                className="px-2 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-colors"
              >
                Stop
              </button>
            </div>
          )}
        </div>
      </div>

      {error && <p role="alert">{error}</p>}
      {simState ? (
        <div className="space-y-3">
          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-xs text-white/60 mb-1 font-mono">
              <span>Progress: {simState.progress_percentage.toFixed(0)}%</span>
              <span>{simState.elapsed_time_minutes} min elapsed</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, simState.progress_percentage)}%` }}
              />
            </div>
          </div>

          {/* Telemetry grid */}
          <div className="grid grid-cols-4 gap-2 text-xs bg-white/5 p-2.5 rounded-lg">
            <div>
              <span className="text-[10px] text-white/40 block">Heading</span>
              <span className="font-semibold flex items-center gap-0.5">
                <Compass size={11} className="text-white/60" />
                {simState.current_heading.toFixed(0)}°
              </span>
            </div>
            <div>
              <span className="text-[10px] text-white/40 block">Speed</span>
              <span className="font-semibold">{simState.speed_knots} kts</span>
            </div>
            <div>
              <span className="text-[10px] text-white/40 block">Traveled</span>
              <span className="font-semibold">{simState.distance_traveled_km.toFixed(1)} km</span>
            </div>
            <div>
              <span className="text-[10px] text-white/40 block">Remaining</span>
              <span className="font-semibold">{simState.remaining_distance_km.toFixed(1)} km</span>
            </div>
          </div>

          {/* Recalculation Alert */}
          {simState.route_needs_recalculation && (
            <div className="p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle size={15} className="text-amber-400 shrink-0" />
                <span>
                  Dynamic hazard emerged! Route automatically rerouted safely.
                </span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-bold uppercase">
                Rerouted
              </span>
            </div>
          )}

          {simState.is_completed && (
            <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 size={15} />
              <span>Vessel safely arrived at destination waypoint!</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between text-xs text-white/50 pt-1">
          <span>Demo replay uses synthetic wave and boundary fields. Live navigation coverage is not configured.</span>
          <label className="flex items-center gap-1.5 cursor-pointer text-white/70 select-none">
            <input
              type="checkbox"
              checked={hazardTest}
              onChange={(e) => setHazardTest(e.target.checked)}
              className="rounded bg-white/10 border-white/20 text-indigo-500 focus:ring-0"
            />
            <span>Test dynamic hazard emergence</span>
          </label>
        </div>
      )}
    </div>
  );
}
