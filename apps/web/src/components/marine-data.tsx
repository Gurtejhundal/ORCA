'use client';
import { useEffect, useState } from 'react';
import type { FeatureCollection } from 'geojson';
import { marineApi, type Location, type Conditions, type NearestPFZ, type Alerts } from '@/services/marine-api';

export function MarineData({ location, onLocation, onLayer }: {
  location: Location; onLocation: (p: Location) => void; onLayer: (layer: FeatureCollection) => void;
}) {
  const [ocean, setOcean] = useState<Conditions | null>(null);
  const [weather, setWeather] = useState<Conditions | null>(null);
  const [pfz, setPFZ] = useState<NearestPFZ | null>(null);
  const [alerts, setAlerts] = useState<Alerts | null>(null);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const initial = window.setTimeout(() => {
      setLoading(true); setOcean(null); setWeather(null); setPFZ(null); setAlerts(null);
      onLayer({ type: 'FeatureCollection', features: [] });
      void Promise.allSettled([
        marineApi.getNearestPFZ(location, controller.signal),
        marineApi.getOceanConditions(location, controller.signal),
        marineApi.getWeather(location, controller.signal),
        marineApi.getAlerts(location, controller.signal),
        marineApi.getMapLayer('pfz', location, controller.signal),
      ]).then(([p, o, w, a, layer]) => {
        if (!active) return;
        setPFZ(p.status === 'fulfilled' ? p.value : null);
        setOcean(o.status === 'fulfilled' ? o.value : null);
        setWeather(w.status === 'fulfilled' ? w.value : null);
        setAlerts(a.status === 'fulfilled' ? a.value : null);
        onLayer(layer.status === 'fulfilled' ? layer.value : { type: 'FeatureCollection', features: [] });
        setNotice([p, o, w, a, layer].some(r => r.status === 'rejected') ? 'Some marine services are unavailable.' : '');
        setLoading(false);
      });
    }, 0);
    return () => { active = false; window.clearTimeout(initial); controller.abort(); };
  }, [location, onLayer]);
  function choose(p: Location) {
    setLoading(true); setOcean(null); setWeather(null); setPFZ(null); setAlerts(null);
    onLayer({ type: 'FeatureCollection', features: [] });
    onLocation(p);
  }
  const readings = [ocean?.conditions.significant_wave_height, ocean?.conditions.sst,
    weather?.conditions.wind_speed, ocean?.conditions.current_speed];
  return <section id="marine-data" className="decision-section" aria-label="Marine data from backend">
    <div className="section-heading"><div><span className="eyebrow">MARINE DATA FOUNDATION</span><h2>Conditions at your location</h2></div>
      <span className="badge demo">{loading ? 'LOADING' : (ocean?.mode ?? weather?.mode ?? pfz?.mode ?? 'UNAVAILABLE').toUpperCase()}</span></div>
    <form className="scenario-control" onSubmit={e => {
      e.preventDefault(); const data = new FormData(e.currentTarget);
      choose({ lat: Number(data.get('lat')), lon: Number(data.get('lon')) });
    }}>
      <label>Latitude <input key={`lat-${location.lat}`} name="lat" type="number" min="-90" max="90" step="any" required defaultValue={location.lat} /></label>
      <label>Longitude <input key={`lon-${location.lon}`} name="lon" type="number" min="-180" max="180" step="any" required defaultValue={location.lon} /></label>
      <button type="submit">Load location</button>
      <button type="button" onClick={() => {
        if (!navigator.geolocation) { setNotice('Geolocation unavailable. Enter coordinates or click the map.'); return; }
        navigator.geolocation.getCurrentPosition(p => choose({ lat: p.coords.latitude, lon: p.coords.longitude }),
          () => setNotice('Location access unavailable. Enter coordinates or click the map.'), { timeout: 10000 });
      }}>Use my location</button>
    </form>
    <p>Click the map to select coordinates. Backend PFZ overlays use blue; existing route recommendations remain a synthetic replay.</p>
    {notice && <p role="status">{notice}</p>}
    {pfz?.mode === 'demo' && <p>Offline replay · {pfz.replay_time} · recorded INCOIS PFZ with synthetic condition fixtures; each source is labelled.</p>}
    <div className="metric-strip">{readings.map((reading, i) => <article key={i}>
      <div className="metric-label">{['Wave height', 'Sea temperature', 'Wind speed', 'Current speed'][i]}</div>
      <p>{reading?.value == null ? '—' : reading.value.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span>{reading?.value != null ? reading.unit : ''}</span></p>
      <small>{reading?.source ?? 'Unavailable'}{reading?.is_stale ? ' · STALE / REPLAY' : ''}</small>
      {reading?.value != null && <details><summary>Source & freshness</summary>
        <p>Source value: {reading.value} {reading.unit}<br />Forecast: {reading.forecast_time ?? 'Unavailable'}<br />Observed: {reading.observation_time ?? 'Unavailable'}<br />Fetched: {reading.fetched_at}<br />Age: {Math.round(reading.freshness_minutes)} min · {reading.quality}<br />Sample: {reading.location.lat}, {reading.location.lon}</p>
      </details>}
    </article>)}</div>
    <h3>Nearest PFZ · {pfz?.status ?? 'unavailable'}</h3>
    {pfz?.results.map(z => <div key={z.id}><p>{z.name} · {z.distance_km?.toFixed(2)} km · {z.source} · valid until {z.valid_until}{z.is_stale ? ' · STALE / REPLAY' : ''}</p>
      <details><summary>PFZ provenance</summary><p>Fetched: {z.fetched_at}<br />Age: {Math.round(z.freshness_minutes)} min<br />Reference: {z.source_reference}</p></details></div>)}
    {pfz?.missing_sources.map(s => <p key={s}>{s}</p>)}
    {!pfz?.results.length && <p>No available PFZ for this location/time.</p>}
    <h3 id="marine-alerts">Marine alerts · {alerts?.status ?? 'unavailable'}</h3>
    {alerts?.alerts.map(a => <p key={a.id}>{a.title} · {a.source} · valid until {a.valid_until}</p>)}
    {alerts?.missing_sources.map(s => <p key={s}>{s}</p>)}
  </section>;
}
