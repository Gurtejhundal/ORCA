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
}: {
  decision: DecisionResponse;
  onSelectZone: (id: string) => void;
  marineLayer?: FeatureCollection;
  onLocation?: (location: Location) => void;
  currentLocation?: Location;
  mapActions?: MapActionPayload[];
}) {
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
  const grid = useMemo(scenarioGrid, []);

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
        popupText: (properties) => popupText(properties, [['name', 'Route'], ['freshness', 'Freshness']]),
      },
    });
    controller.apply({
      type: 'SHOW_MARKERS', id: 'scenario-markers',
      markers: [
        { id: 'origin', kind: 'origin', label: 'NAGAPATTINAM', position: decision.plan.origin, title: 'Nagapattinam port' },
        ...decision.zones.flatMap((zone) => {
          const position = pointPosition(zone.geometry.coordinates);
          if (!position) return [];
          const status: 'recommended' | 'rejected' | 'alternative' = zone.id === decision.recommendation.candidateZoneId ? 'recommended' : zone.rejected ? 'rejected' : 'alternative';
          return [{
            id: zone.id, kind: 'zone' as const, label: zone.name.slice(-1), position,
            status, title: `${zone.name} · ${status === 'recommended' ? 'Recommended' : status === 'rejected' ? 'Rejected' : 'Alternative'}`,
            onClick: () => selectRef.current(zone.id),
          }];
        }),
      ],
    });
    frameMap(controller, decision, currentLocation);
  }, [decision, grid, mapReady]);

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
          ['name', 'PFZ'], ['distance_km', 'Distance km'], ['valid_until', 'Valid until'], ['source', 'Source'], ['freshness_minutes', 'Freshness min'],
        ]),
      },
    });
  }, [mapReady, marineLayer]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller || !mapReady || !currentLocation) return;
    controller.apply({
      type: 'SHOW_MARKERS', id: 'current-location',
      markers: [{ id: 'current-location', kind: 'location', label: '●', position: currentLocation, title: 'Selected fisherman location' }],
    });
  }, [currentLocation, mapReady]);

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
    <section id="marine-map" className="marine-map" aria-label="Interactive marine scenario map" aria-busy={mapLoading}>
      <div ref={container} className="map-canvas" data-testid="marine-map" />
      <div hidden={!mapLoading} className="map-loading" role="status">Loading marine map…</div>
      <div className="map-title"><span className="eyebrow">OPERATING AREA / 01</span><h2>Nagapattinam coast</h2><span>Bay of Bengal · Synthetic replay</span></div>
      <div className="map-north"><Compass size={23} /><span>N</span></div>
      <div className="map-sea-name" aria-hidden="true">BAY OF<br />BENGAL</div>
      <div className="map-controls">
        <button aria-label="Zoom in" onClick={() => zoom(1)}><Plus size={18} /></button>
        <button aria-label="Zoom out" onClick={() => zoom(-1)}><Minus size={18} /></button>
        <button aria-label="Frame all zones" onClick={() => {
          const controller = controllerRef.current;
          if (controller) frameMap(controller, decision, currentLocation);
        }}><Focus size={18} /></button>
      </div>
      <div className="map-layer-controls">
        <Layers size={14} />
        {Object.entries(layers).map(([key, visible]) => (
          <button key={key} aria-pressed={visible} onClick={() => setLayers((current) => ({ ...current, [key]: !visible }))}>
            <span className={'layer-dot ' + key} />
            {key === 'restricted' ? 'Restricted' : key[0].toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>
      <div className="map-legend"><span><i className="line-key" />Recommended</span><span><i className="line-key dashed" />Alternative</span></div>
      <div className="map-attribution">© OpenStreetMap contributors · Scenario layers are DEMO · Backend PFZ is separately labelled · Not a nautical chart</div>
      <div hidden={!mapError} className="map-error" role="alert">{mapError}</div>
    </section>
  );
}
