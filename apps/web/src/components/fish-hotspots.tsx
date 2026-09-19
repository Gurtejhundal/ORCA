'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { FeatureCollection, Position } from 'geojson';
import { Fish, MapPin } from 'lucide-react';
import type { Location } from '@/services/marine-api';
import { createMapLibreController, MAP_STYLE_URL, type MapLibreController } from '@/services/maplibre-map';

type FishGround = {
  id: string;
  localName: string;
  englishName: string;
  coast: string;
  season: string;
  note: string;
  color: string;
  grounds: Array<{ name: string; lat: number; lon: number }>;
};

const FISH_GROUNDS: FishGround[] = [
  { id: 'surmai', localName: 'Surmai / Vanjaram', englishName: 'Seer fish', coast: 'Maharashtra, Goa, Tamil Nadu', season: 'Oct-Mar', note: 'Usually targeted around shoals, reef edges and coastal current lines.', color: '#78d7ff', grounds: [{ name: 'Mumbai offshore', lat: 18.88, lon: 72.55 }, { name: 'Goa shelf', lat: 15.18, lon: 73.55 }, { name: 'Nagapattinam belt', lat: 10.74, lon: 80.05 }] },
  { id: 'bangda', localName: 'Bangda / Ayala', englishName: 'Indian mackerel', coast: 'Konkan and Kerala coast', season: 'Aug-Feb', note: 'Common in productive nearshore waters and small pelagic schools.', color: '#8ff0c3', grounds: [{ name: 'Ratnagiri grounds', lat: 16.95, lon: 72.95 }, { name: 'Mangalore coast', lat: 12.82, lon: 74.58 }, { name: 'Kochi grounds', lat: 9.82, lon: 75.98 }] },
  { id: 'mathi', localName: 'Mathi / Tarli', englishName: 'Oil sardine', coast: 'Kerala, Karnataka, Goa', season: 'Jun-Dec', note: 'Often found in coastal pelagic shoals during monsoon and post-monsoon productivity.', color: '#ffd16f', grounds: [{ name: 'Kollam coast', lat: 8.78, lon: 76.35 }, { name: 'Kochi-Alappuzha belt', lat: 9.55, lon: 76.05 }, { name: 'Karwar coast', lat: 14.78, lon: 74.03 }] },
  { id: 'rawas', localName: 'Rawas / Gurjali', englishName: 'Indian salmon', coast: 'Gujarat and Maharashtra', season: 'Sep-Feb', note: 'Often linked with estuarine influence, muddy bottoms and coastal migration corridors.', color: '#ff9f8f', grounds: [{ name: 'Veraval shelf', lat: 20.82, lon: 70.12 }, { name: 'Diu grounds', lat: 20.66, lon: 70.65 }, { name: 'Mumbai north coast', lat: 19.35, lon: 72.45 }] },
  { id: 'paplet', localName: 'Paplet / Avoli', englishName: 'Pomfret', coast: 'Gujarat, Maharashtra, Odisha', season: 'Oct-Feb', note: 'Known from shelf waters and soft-bottom fishing grounds.', color: '#d9c3ff', grounds: [{ name: 'Okha-Veraval belt', lat: 21.25, lon: 69.55 }, { name: 'Palghar coast', lat: 19.68, lon: 72.42 }, { name: 'Paradeep coast', lat: 20.05, lon: 86.75 }] },
  { id: 'choora', localName: 'Choora / Kera', englishName: 'Tuna', coast: 'Lakshadweep, Kerala, Tamil Nadu', season: 'Oct-May', note: 'Targeted in deeper offshore waters, island slopes and current-rich grounds.', color: '#6ca7ff', grounds: [{ name: 'Lakshadweep channel', lat: 10.62, lon: 72.38 }, { name: 'Kanyakumari offshore', lat: 7.85, lon: 77.35 }, { name: 'Kochi offshore', lat: 9.62, lon: 75.42 }] },
  { id: 'ilish', localName: 'Ilish / Hilsa', englishName: 'Hilsa', coast: 'West Bengal and Odisha', season: 'Jul-Oct', note: 'Associated with estuarine and river-mouth migration zones.', color: '#b9f3ff', grounds: [{ name: 'Digha coast', lat: 21.55, lon: 87.38 }, { name: 'Sundarbans mouth', lat: 21.73, lon: 88.55 }, { name: 'Chandipur coast', lat: 21.42, lon: 87.02 }] },
];

function makeLayer(fish: FishGround): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: fish.grounds.map((ground) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [ground.lon, ground.lat] },
      properties: { name: ground.name, fish: fish.localName, season: fish.season, coast: fish.coast },
    })),
  };
}

function nearestGrounds(location: Location | undefined, fish: FishGround) {
  if (!location) return fish.grounds.slice(0, 2);
  return [...fish.grounds].sort((a, b) => Math.hypot(a.lat - location.lat, a.lon - location.lon) - Math.hypot(b.lat - location.lat, b.lon - location.lon)).slice(0, 2);
}

export function FishHotspots({ location, language }: { location?: Location; language: 'en' | 'hi' }) {
  const [selectedId, setSelectedId] = useState(FISH_GROUNDS[0].id);
  const selected = FISH_GROUNDS.find((fish) => fish.id === selectedId) ?? FISH_GROUNDS[0];
  const layer = useMemo(() => makeLayer(selected), [selected]);
  const nearby = useMemo(() => nearestGrounds(location, selected), [location, selected]);
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const controllerRef = useRef<MapLibreController | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = container.current;
    if (!element || mapRef.current) return;
    const center = location ?? { lat: 14.4, lon: 76.2 };
    const map = new maplibregl.Map({ container: element, style: MAP_STYLE_URL, center: [center.lon, center.lat], zoom: location ? 5.5 : 4.3, minZoom: 2, maxZoom: 13, attributionControl: false });
    mapRef.current = map;
    map.once('style.load', () => {
      controllerRef.current = createMapLibreController(map);
      setReady(true);
    });
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(element);
    return () => {
      observer.disconnect();
      controllerRef.current?.dispose();
      controllerRef.current = null;
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [location]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller || !ready) return;
    controller.apply({ type: 'ADD_LAYER', id: 'fish-grounds', geojson: layer, options: { pointColor: selected.color, fillColor: selected.color, lineColor: '#f5fffb', pointRadius: 8, fillOpacity: 0.85 } });
    controller.apply({
      type: 'SHOW_MARKERS',
      id: 'fish-ground-labels',
      markers: selected.grounds.map((ground, index) => ({ id: `${selected.id}-${ground.name}`, kind: 'fish', label: String(index + 1), title: ground.name, position: { lat: ground.lat, lon: ground.lon } })),
    });
    if (location) controller.apply({ type: 'SHOW_MARKERS', id: 'fish-current-location', markers: [{ id: 'fish-current-location', kind: 'location', label: '●', title: 'Selected location', position: location }] });
    const positions: Position[] = [...selected.grounds.map((ground) => [ground.lon, ground.lat] as Position), ...(location ? [[location.lon, location.lat] as Position] : [])];
    controller.fitBounds(positions, 70);
  }, [layer, location, ready, selected]);

  return (
    <section className="fish-hotspots" aria-label={language === 'hi' ? 'मछली क्षेत्र' : 'Fish grounds'}>
      <span className="eyebrow">{language === 'hi' ? 'स्थानीय नामों से मछली क्षेत्र' : 'FISH GROUNDS BY LOCAL NAME'}</span>
      <h2>{language === 'hi' ? 'किस मछली के लिए कौन सा इलाका देखें' : 'Fish species and common grounds'}</h2>
      <p>{language === 'hi' ? 'यह ऐतिहासिक/स्थानीय जानकारी है। यह पकड़ की गारंटी नहीं देता।' : 'Historical and local fishery context. This does not guarantee catch.'}</p>
      <div className="fish-hotspots__layout">
        <div className="fish-hotspots__list">
          {FISH_GROUNDS.map((fish) => (
            <button key={fish.id} type="button" aria-pressed={selected.id === fish.id} onClick={() => setSelectedId(fish.id)}>
              <Fish size={15} />
              <span><strong>{fish.localName}</strong><small>{fish.englishName}</small></span>
            </button>
          ))}
        </div>
        <div className="fish-hotspots__map-wrap"><div ref={container} className="fish-hotspots__map" /></div>
      </div>
      <article className="fish-hotspots__details">
        <h3>{selected.localName}</h3>
        <dl>
          <div><dt>{language === 'hi' ? 'अंग्रेज़ी नाम' : 'English name'}</dt><dd>{selected.englishName}</dd></div>
          <div><dt>{language === 'hi' ? 'मुख्य तट' : 'Main coast'}</dt><dd>{selected.coast}</dd></div>
          <div><dt>{language === 'hi' ? 'मौसम' : 'Season'}</dt><dd>{selected.season}</dd></div>
        </dl>
        <p>{selected.note}</p>
        <div className="fish-hotspots__nearby">{nearby.map((ground) => <span key={ground.name}><MapPin size={12} />{ground.name}</span>)}</div>
      </article>
    </section>
  );
}
