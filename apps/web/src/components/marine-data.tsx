'use client';
import { useEffect, useState } from 'react';
import type { FeatureCollection } from 'geojson';
import { marineApi, type Location, type Conditions, type NearestPFZ, type Alerts } from '@/services/marine-api';

const LAYERS = ['pfz', 'sst', 'chlorophyll', 'waves', 'currents', 'hazards', 'restricted', 'protected'] as const;
const LAYER_LABELS = {
  en: ['Fishing zones', 'Sea temperature', 'Chlorophyll', 'Waves', 'Currents', 'Hazards', 'Restricted areas', 'Protected areas'],
  hi: ['मत्स्य क्षेत्र', 'समुद्र तापमान', 'क्लोरोफिल', 'लहरें', 'धाराएँ', 'खतरे', 'प्रतिबंधित क्षेत्र', 'संरक्षित क्षेत्र'],
};

export function MarineData({ location, onLocation, onLayer, language = 'en', tool }: {
  location: Location; onLocation: (p: Location) => void; onLayer: (layer: FeatureCollection) => void;
  language?: 'en' | 'hi'; tool?: 'conditions' | 'alerts' | 'layers';
}) {
  const t = (en: string, hi: string) => language === 'hi' ? hi : en;
  const [ocean, setOcean] = useState<Conditions | null>(null);
  const [weather, setWeather] = useState<Conditions | null>(null);
  const [pfz, setPFZ] = useState<NearestPFZ | null>(null);
  const [alerts, setAlerts] = useState<Alerts | null>(null);
  const [layerName, setLayerName] = useState<(typeof LAYERS)[number]>('pfz');
  const [failed, setFailed] = useState(false);
  const [locationError, setLocationError] = useState(false);
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
        marineApi.getMapLayer(layerName, location, controller.signal),
      ]).then(([p, o, w, a, layer]) => {
        if (!active) return;
        setPFZ(p.status === 'fulfilled' ? p.value : null);
        setOcean(o.status === 'fulfilled' ? o.value : null);
        setWeather(w.status === 'fulfilled' ? w.value : null);
        setAlerts(a.status === 'fulfilled' ? a.value : null);
        onLayer(layer.status === 'fulfilled' ? layer.value : { type: 'FeatureCollection', features: [] });
        setFailed([p, o, w, a, layer].some((result) => result.status === 'rejected'));
        setLoading(false);
      });
    }, 0);
    return () => { active = false; window.clearTimeout(initial); controller.abort(); };
  }, [location, onLayer, layerName]);

  const readings = [ocean?.conditions.significant_wave_height, ocean?.conditions.sst, weather?.conditions.wind_speed, ocean?.conditions.current_speed];
  const title = tool === 'alerts' ? t('Marine alerts', 'समुद्री चेतावनियाँ') : tool === 'layers' ? t('Map layers', 'मानचित्र परतें') : t('Conditions at your location', 'आपके स्थान की समुद्री स्थिति');
  return <section id={tool ? undefined : 'marine-data'} className={tool ? 'marine-data-panel' : 'decision-section'} aria-label={title}>
    <div className="section-heading"><div><span className="eyebrow">{t('SOURCE-TRACEABLE MARINE DATA', 'स्रोत सहित समुद्री डेटा')}</span><h2>{title}</h2></div></div>
    <p className="marine-data-mode" role="status">{loading ? t('Loading evidence…', 'प्रमाण लोड हो रहे हैं…') : t('Data mode: ', 'डेटा स्थिति: ') + (ocean?.mode ?? weather?.mode ?? pfz?.mode ?? t('unavailable', 'अनुपलब्ध'))}</p>
    <form className="marine-location-form" onSubmit={(event) => {
      event.preventDefault(); const data = new FormData(event.currentTarget);
      const lat = Number(data.get('lat')); const lon = Number(data.get('lon'));
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
      setLocationError(false); onLocation({ lat, lon });
    }}>
      <label>{t('Latitude', 'अक्षांश')}<input key={'lat-' + location.lat} name="lat" type="number" min="-90" max="90" step="any" required defaultValue={location.lat} /></label>
      <label>{t('Longitude', 'देशांतर')}<input key={'lon-' + location.lon} name="lon" type="number" min="-180" max="180" step="any" required defaultValue={location.lon} /></label>
      <button type="submit">{t('Load location', 'स्थान लोड करें')}</button>
      <button type="button" onClick={() => {
        if (!navigator.geolocation) { setLocationError(true); return; }
        navigator.geolocation.getCurrentPosition((position) => { setLocationError(false); onLocation({ lat: position.coords.latitude, lon: position.coords.longitude }); }, () => setLocationError(true), { timeout: 10000 });
      }}>{t('Use my location', 'मेरा स्थान लें')}</button>
    </form>
    {locationError && <p role="alert">{t('Location access unavailable. Enter coordinates or click the map.', 'स्थान उपलब्ध नहीं है। निर्देशांक भरें या मानचित्र पर क्लिक करें।')}</p>}
    {failed && <p role="status">{t('Some marine services are unavailable. Missing values are not estimated.', 'कुछ समुद्री सेवाएँ अनुपलब्ध हैं। अधूरे मानों का अनुमान नहीं लगाया जाता।')}</p>}
    {pfz?.mode === 'demo' && <p className="marine-data-note">{t('Offline replay, not live observations. Each reading retains its source and valid time.', 'ऑफलाइन रीप्ले, वर्तमान माप नहीं। हर मान के साथ स्रोत और वैध समय है।')}</p>}
    {tool === 'layers' ? <div className="marine-layer-selector" role="group" aria-label={title}>{LAYERS.map((name, index) => <button type="button" key={name} aria-pressed={layerName === name} onClick={() => setLayerName(name)}>{LAYER_LABELS[language][index]}</button>)}<p>{t('The selected layer replaces the backend overlay. Synthetic routes are labelled separately.', 'चुनी परत बैकएंड डेटा परत को बदलती है। कृत्रिम मार्ग अलग चिह्नित हैं।')}</p></div> : <>
      {tool !== 'alerts' && <div className={tool ? 'marine-readings' : 'metric-strip'}>{readings.map((reading, index) => <article key={index}>
        <div className="metric-label">{[t('Wave height', 'लहर ऊँचाई'), t('Sea temperature', 'समुद्र तापमान'), t('Wind speed', 'हवा गति'), t('Current speed', 'धारा गति')][index]}</div>
        <p>{reading?.value == null ? '—' : reading.value.toLocaleString(language === 'hi' ? 'hi-IN' : 'en-IN', { maximumFractionDigits: 2 })} <span>{reading?.value != null ? reading.unit : ''}</span></p>
        <small>{reading?.source ?? t('Unavailable', 'अनुपलब्ध')}{reading?.is_stale ? t(' · STALE / REPLAY', ' · पुराना / रीप्ले') : ''}</small>
        {reading?.value != null && <details><summary>{t('Source & freshness', 'स्रोत और ताज़गी')}</summary><p>{t('Forecast', 'पूर्वानुमान')}: {reading.forecast_time ?? '—'}<br />{t('Observed', 'माप समय')}: {reading.observation_time ?? '—'}<br />{t('Fetched', 'संग्रह समय')}: {reading.fetched_at}<br />{t('Age', 'उम्र')}: {Math.round(reading.freshness_minutes)} min · {reading.quality}</p></details>}
      </article>)}</div>}
      {!tool && <><h3>{t('Nearest PFZ', 'निकटतम मत्स्य क्षेत्र')}</h3>{pfz?.results.map((zone) => <p key={zone.id}>{zone.name} · {zone.distance_km?.toFixed(2)} km · {zone.source} · {zone.valid_until}{zone.is_stale ? t(' · STALE / REPLAY', ' · पुराना / रीप्ले') : ''}</p>)}{!pfz?.results.length && <p>{t('No available PFZ for this location/time.', 'इस स्थान और समय के लिए मत्स्य क्षेत्र उपलब्ध नहीं है।')}</p>}</>}
      {tool !== 'conditions' && <><h3>{t('Marine alerts', 'समुद्री चेतावनियाँ')}</h3>{alerts?.alerts.map((alert) => <article className="marine-alert" key={alert.id}><h4>{alert.title}</h4><p>{alert.source} · {alert.valid_until}</p></article>)}{!loading && !alerts?.alerts.length && <p>{!alerts || alerts.status === 'unavailable' ? t('Alert evidence unavailable. This does not mean it is safe to sail.', 'चेतावनी प्रमाण अनुपलब्ध है। इसका अर्थ सुरक्षित समुद्र नहीं है।') : t('No warnings returned. Check official advisories before departure.', 'कोई चेतावनी नहीं मिली। प्रस्थान से पहले आधिकारिक निर्देश जाँचें।')}</p>}{alerts?.missing_sources.map((source) => <p key={source}>{source}</p>)}</>}
    </>}
  </section>;
}
