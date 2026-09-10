'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { DecisionResponse } from '@orca/contracts';
import type { Feature, FeatureCollection, Position } from 'geojson';
import { Compass, Focus, Layers, Minus, Plus } from 'lucide-react';
import type { Location, MapActionPayload } from '@/services/marine-api';
import { backendMapAction } from '@/services/backend-map-actions';
import {
  createMapLibreController,
  MAP_STYLE_URL,
  type MapLibreController,
  type MapPosition,
} from '@/services/maplibre-map';

const EMPTY_LAYER: FeatureCollection = { type: 'FeatureCollection', features: [] };
const MAP_COPY = {
  en: {
    aria: 'Interactive marine scenario map',
    loading: 'Loading marine map…',
    area: 'OPERATING AREA / 01',
    coast: 'Nagapattinam coast',
    sea: 'Bay of Bengal · Synthetic replay',
    seaName: <>BAY OF<br />BENGAL</>,
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    frame: 'Frame all zones',
    layerLabels: { hazards: 'Hazards', restricted: 'Restricted', routes: 'Routes' },
    recommended: 'Recommended',
    rejected: 'Rejected',
    alternative: 'Alternative',
    attribution: '© OpenStreetMap contributors · Scenario layers are DEMO · Backend PFZ is separately labelled · Not a nautical chart',
    styleError: 'Map style could not load. Check the configured map style and browser network connection.',
    tileError: 'Map tiles could not load. Check the configured map style and browser network connection.',
    port: 'Nagapattinam port',
    selectedLocation: 'Selected fisherman location',
    route: 'Route',
    freshness: 'Freshness',
    distance: 'Distance km',
    validUntil: 'Valid until',
    source: 'Source',
    freshnessMinutes: 'Freshness min',
  },
  hi: {
    aria: 'समुद्री परिस्थिति का इंटरैक्टिव मानचित्र',
    loading: 'समुद्री मानचित्र लोड हो रहा है…',
    area: 'परिचालन क्षेत्र / 01',
    coast: 'Nagapattinam तट',
    sea: 'बंगाल की खाड़ी · कृत्रिम रीप्ले',
    seaName: <>बंगाल की<br />खाड़ी</>,
    zoomIn: 'ज़ूम बढ़ाएँ',
    zoomOut: 'ज़ूम घटाएँ',
    frame: 'सभी क्षेत्र दिखाएँ',
    layerLabels: { hazards: 'खतरे', restricted: 'प्रतिबंधित', routes: 'मार्ग' },
    recommended: 'सुझाया गया',
    rejected: 'अस्वीकृत',
    alternative: 'वैकल्पिक',
    attribution: '© OpenStreetMap योगदानकर्ता · परिस्थिति परतें डेमो हैं · बैकएंड PFZ अलग चिह्नित है · यह नौवहन चार्ट नहीं है',
    styleError: 'मानचित्र शैली लोड नहीं हुई। नेटवर्क कनेक्शन और मानचित्र सेटिंग जाँचें।',
    tileError: 'मानचित्र टाइलें लोड नहीं हुईं। नेटवर्क कनेक्शन और मानचित्र सेटिंग जाँचें।',
    port: 'Nagapattinam बंदरगाह',
    selectedLocation: 'चुना हुआ मछुआरा स्थान',
    route: 'मार्ग',
    freshness: 'ताज़गी',
    distance: 'दूरी किमी',
    validUntil: 'मान्य समय',
    source: 'स्रोत',
    freshnessMinutes: 'ताज़गी मिनट',
  },
} as const;

function featureLayer(
  layers: FeatureCollection,
  kind: string,
  onlyVisible = false,
): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: layers.features.filter(
      (feature) =>
        feature.properties?.kind === kind &&
        (!onlyVisible || feature.properties?.visible === true),
    ),
  };
}

function scenarioGrid(): FeatureCollection {
  const features: Feature[] = [];
  for (let lon = 79.8; lon <= 80.21; lon += 0.05)
    features.push({
      type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[lon, 10.54], [lon, 11.02]] },
    });
  for (let lat = 10.55; lat <= 11.01; lat += 0.05)
    features.push({
      type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[79.8, lat], [80.22, lat]] },
    });
  return { type: 'FeatureCollection', features };
}

function pointPosition(coordinates: number[]): MapPosition | null {
  const [lon, lat] = coordinates;
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

function frameMap(
  controller: MapLibreController,
  decision: DecisionResponse,
  currentLocation?: Location,
) {
  const positions: Position[] = [[decision.plan.origin.lon, decision.plan.origin.lat]];
  const extend = (position: MapPosition | null) => {
    if (position) positions.push([position.lon, position.lat]);
  };
  decision.zones.forEach((zone) => extend(pointPosition(zone.geometry.coordinates)));
  decision.routes.forEach((route) => route.geometry.coordinates.forEach((position) => extend(pointPosition(position))));
  decision.geofences.forEach((fence) => fence.geometry.coordinates[0].forEach((position) => extend(pointPosition(position))));
  if (currentLocation) extend(currentLocation);
  controller.fitBounds(positions, window.innerWidth < 600 ? 60 : 100);
}

function popupText(
  properties: Record<string, unknown>,
  fields: Array<[string, string]>,
): string {
  return fields
    .flatMap(([key, label]) => {
      const value = properties[key];
      return typeof value === 'string' || typeof value === 'number' ? [`${label}: ${value}`] : [];
    })
    .join('\n');
}

export function MarineMap({
  decision,
  onSelectZone,
  marineLayer,
  onLocation,
  currentLocation,
  mapActions,
  language = 'en',
}: {
  decision: DecisionResponse;
  onSelectZone: (id: string) => void;
  marineLayer?: FeatureCollection;
  onLocation?: (location: Location) => void;
  currentLocation?: Location;
  mapActions?: MapActionPayload[];
  language?: 'en' | 'hi';
}) {
  const copy = MAP_COPY[language];
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const controllerRef = useRef<MapLibreController | null>(null);
  const initialCenter = useRef({ lat: decision.map.center.lat, lon: decision.map.center.lon });
  const selectRef = useRef(onSelectZone);
  const locationRef = useRef(onLocation);
  const [mapReady, setMapReady] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState('');
  const [layers, setLayers] = useState({ hazards: true, restricted: true, routes: true });
  const grid = useMemo(() => scenarioGrid(), []);

  useEffect(() => { selectRef.current = onSelectZone; }, [onSelectZone]);
  useEffect(() => { locationRef.current = onLocation; }, [onLocation]);

  useEffect(() => {
    const element = container.current;
    if (!element || mapRef.current) return;
    let cancelled = false;
    const map = new maplibregl.Map({
      container: element,
      style: MAP_STYLE_URL,
      center: [initialCenter.current.lon, initialCenter.current.lat],
      zoom: 10.3,
      minZoom: 2,
      maxZoom: 14,
      attributionControl: false,
    });
    mapRef.current = map;
    const loadingTimeout = window.setTimeout(() => {
      if (!cancelled && !controllerRef.current) {
        setMapLoading(false);
        setMapError('Map style could not load. Check the configured map style and browser network connection.');
      }
    }, 15000);
    const onMapError = () => {
      if (!cancelled) {
        setMapLoading(false);
        setMapError('Map tiles could not load. Check the configured map style and browser network connection.');
      }
    };
    map.on('error', onMapError);
    map.on('click', (event) => locationRef.current?.({ lat: event.lngLat.lat, lon: event.lngLat.lng }));
    const initializeLayers = () => {
      if (cancelled || controllerRef.current) return;
      controllerRef.current = createMapLibreController(map);
      window.clearTimeout(loadingTimeout);
      setMapLoading(false);
      setMapError('');
      setMapReady(true);
    };
    map.once('style.load', initializeLayers);
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(element);

    return () => {
      cancelled = true;
      window.clearTimeout(loadingTimeout);
      observer.disconnect();
      controllerRef.current?.dispose();
      controllerRef.current = null;
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller || !mapReady) return;
    controller.apply({
      type: 'ADD_LAYER', id: 'grid', geojson: grid,
      options: { lineColor: '#77989e', lineOpacity: 0.16, lineWidth: 1 },
    });
    controller.apply({ type: 'SHOW_HAZARD_ZONE', id: 'hazards', geojson: featureLayer(decision.map.layers, 'hazard') });
    controller.apply({
      type: 'ADD_LAYER', id: 'restricted', geojson: featureLayer(decision.map.layers, 'restricted'),
      options: { fillColor: '#dd7d82', fillOpacity: 0.15, lineColor: '#dc8a90', lineWidth: 1.5 },
    });
    controller.apply({
      type: 'ADD_LAYER', id: 'routes', geojson: featureLayer(decision.map.layers, 'route', true),
      options: {
        lineColor: '#7de6c6', lineOpacity: 0.95, lineWidth: 3,
        popupText: (properties) => popupText(properties, [['name', copy.route], ['freshness', copy.freshness]]),
      },
    });
    controller.apply({
      type: 'SHOW_MARKERS', id: 'scenario-markers',
      markers: [
        { id: 'origin', kind: 'origin', label: 'NAGAPATTINAM', position: decision.plan.origin, title: copy.port },
        ...decision.zones.flatMap((zone) => {
          const position = pointPosition(zone.geometry.coordinates);
          if (!position) return [];
          const status: 'recommended' | 'rejected' | 'alternative' = zone.id === decision.recommendation.candidateZoneId ? 'recommended' : zone.rejected ? 'rejected' : 'alternative';
          return [{
            id: zone.id, kind: 'zone' as const, label: zone.name.slice(-1), position,
            status, title: `${zone.name} · ${status === 'recommended' ? copy.recommended : status === 'rejected' ? copy.rejected : copy.alternative}`,
            onClick: () => selectRef.current(zone.id),
          }];
        }),
      ],
    });
    frameMap(controller, decision);
  }, [copy, decision, grid, mapReady]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller || !mapReady) return;
    controller.setLayerVisible('hazards', layers.hazards);
    controller.setLayerVisible('restricted', layers.restricted);
    controller.setLayerVisible('routes', layers.routes);
  }, [layers, mapReady]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller || !mapReady) return;
    controller.apply({
      type: 'ADD_LAYER', id: 'pfz', geojson: marineLayer ?? EMPTY_LAYER,
      options: {
        fillColor: '#61b7ff', fillOpacity: 0.25, lineColor: '#61b7ff', lineWidth: 2,
        popupText: (properties) => popupText(properties, [
          ['name', 'PFZ'], ['distance_km', copy.distance], ['valid_until', copy.validUntil], ['source', copy.source], ['freshness_minutes', copy.freshnessMinutes],
        ]),
      },
    });
  }, [copy, mapReady, marineLayer]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller || !mapReady || !currentLocation) return;
    controller.apply({
      type: 'SHOW_MARKERS', id: 'current-location',
      markers: [{ id: 'current-location', kind: 'location', label: '●', position: currentLocation, title: copy.selectedLocation }],
    });
  }, [copy, currentLocation, mapReady]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller || !mapReady) return;
    const actions = (mapActions ?? []).map(backendMapAction).filter(a => a !== null);
    actions.forEach(a => controller.apply(a));
    return () => actions.forEach(a => {
      if ('id' in a && a.id) {
        controller.apply({ type: 'REMOVE_LAYER', id: a.id });
        if (a.type === 'SHOW_MARKERS') controller.apply({ type: 'SHOW_MARKERS', id: a.id, markers: [] });
      }
    });
  }, [mapActions, mapReady]);

  const zoom = (delta: number) => {
    const map = mapRef.current;
    if (map) map.setZoom(Math.min(14, Math.max(2, map.getZoom() + delta)));
  };

  return (
    <section id="marine-map" className="marine-map" aria-label={copy.aria} aria-busy={mapLoading}>
      <div ref={container} className="map-canvas" data-testid="marine-map" />
      <div hidden={!mapLoading} className="map-loading" role="status">{copy.loading}</div>
      <div className="map-title"><span className="eyebrow">{copy.area}</span><h2>{copy.coast}</h2><span>{copy.sea}</span></div>
      <div className="map-north"><Compass size={23} /><span>N</span></div>
      <div className="map-sea-name" aria-hidden="true">{copy.seaName}</div>
      <div className="map-controls">
        <button aria-label={copy.zoomIn} onClick={() => zoom(1)}><Plus size={18} /></button>
        <button aria-label={copy.zoomOut} onClick={() => zoom(-1)}><Minus size={18} /></button>
        <button aria-label={copy.frame} onClick={() => {
          const controller = controllerRef.current;
          if (controller) frameMap(controller, decision, currentLocation);
        }}><Focus size={18} /></button>
      </div>
      <div className="map-layer-controls">
        <Layers size={14} />
        {Object.entries(layers).map(([key, visible]) => (
          <button key={key} aria-pressed={visible} onClick={() => setLayers((current) => ({ ...current, [key]: !visible }))}>
            <span className={'layer-dot ' + key} />
            {copy.layerLabels[key as keyof typeof copy.layerLabels]}
          </button>
        ))}
      </div>
      <div className="map-legend"><span><i className="line-key" />{copy.recommended}</span><span><i className="line-key dashed" />{copy.alternative}</span></div>
      <div className="map-attribution">{copy.attribution}</div>
      <div hidden={!mapError} className="map-error" role="alert">{language === 'hi' ? (mapError.startsWith('Map style') ? copy.styleError : copy.tileError) : mapError}</div>
    </section>
  );
}
