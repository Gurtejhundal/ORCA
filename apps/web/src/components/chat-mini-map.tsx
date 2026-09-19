'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { Feature, FeatureCollection, Position } from 'geojson';
import { Maximize2 } from 'lucide-react';
import type { ChatResponsePayload, RankedPFZCandidate } from '@/services/marine-api';
import { backendMapAction } from '@/services/backend-map-actions';
import {
  createMapLibreController,
  MAP_STYLE_URL,
  positionsFromGeoJson,
  type MapLibreController,
} from '@/services/maplibre-map';

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

function featureFromCandidate(candidate: RankedPFZCandidate): Feature | null {
  if (!candidate.geometry) return null;
  return {
    type: 'Feature',
    id: candidate.pfz_id,
    geometry: candidate.geometry,
    properties: {
      name: candidate.name,
      distance_km: candidate.distance_km,
      source: candidate.source,
      ranking_score: candidate.ranking_score,
      excluded: candidate.excluded,
    },
  };
}

function routeLayer(response: ChatResponsePayload): FeatureCollection {
  const route = response.route_comparison?.safe_route;
  const geometry = route?.geojson?.type === 'Feature'
    ? route.geojson.geometry
    : route?.geojson?.type === 'LineString'
      ? route.geojson
      : null;
  if (!geometry || typeof geometry !== 'object' || !('type' in geometry)) return EMPTY;
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', geometry: geometry as Feature['geometry'], properties: { name: 'Route' } }],
  };
}

function markerPosition(candidate: RankedPFZCandidate) {
  const geometry = candidate.geometry;
  if (!geometry || !('coordinates' in geometry)) return null;
  const first = (value: unknown): Position | null => {
    if (!Array.isArray(value)) return null;
    if (typeof value[0] === 'number' && typeof value[1] === 'number') return value as Position;
    for (const item of value) {
      const found = first(item);
      if (found) return found;
    }
    return null;
  };
  const position = first(geometry.coordinates);
  return position ? { lon: Number(position[0]), lat: Number(position[1]) } : null;
}

export function ChatMiniMap({ response, onOpenMap }: { response: ChatResponsePayload; onOpenMap: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const controllerRef = useRef<MapLibreController | null>(null);
  const [ready, setReady] = useState(false);
  const candidates = response.data.ranked_pfz_candidates ?? [];
  const pfzLayer = useMemo<FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: candidates.flatMap((candidate) => {
      const feature = featureFromCandidate(candidate);
      return feature ? [feature] : [];
    }),
  }), [candidates]);
  const safeRouteLayer = useMemo(() => routeLayer(response), [response]);
  const canRender = response.map_actions.length > 0 || pfzLayer.features.length > 0 || safeRouteLayer.features.length > 0 || !!response.location;

  useEffect(() => {
    if (!canRender) return;
    const element = container.current;
    if (!element || mapRef.current) return;
    const center = response.location ?? { lat: 20.0, lon: 78.0 };
    const map = new maplibregl.Map({
      container: element,
      style: MAP_STYLE_URL,
      center: [center.lon, center.lat],
      zoom: response.location ? 8 : 4,
      minZoom: 2,
      maxZoom: 13,
      attributionControl: false,
    });
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
  }, [canRender, response.location]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller || !ready) return;
    response.map_actions.map(backendMapAction).filter((action) => action !== null).forEach((action) => controller.apply(action));
    if (pfzLayer.features.length) {
      controller.apply({ type: 'ADD_LAYER', id: 'chat-pfz', geojson: pfzLayer, options: { fillColor: '#61b7ff', fillOpacity: 0.3, lineColor: '#bcefff', lineWidth: 2 } });
      controller.apply({
        type: 'SHOW_MARKERS',
        id: 'chat-pfz-markers',
        markers: candidates.flatMap((candidate) => {
          const position = markerPosition(candidate);
          return position ? [{
            id: candidate.pfz_id,
            kind: 'zone' as const,
            label: 'PFZ',
            position,
            status: candidate.excluded ? 'rejected' as const : candidate.rank === 1 ? 'recommended' as const : 'alternative' as const,
            title: `${candidate.name} - ${candidate.distance_km.toFixed(1)} km`,
          }] : [];
        }),
      });
    }
    if (safeRouteLayer.features.length) controller.apply({ type: 'DRAW_ROUTE', id: 'chat-route', geojson: safeRouteLayer });
    if (response.location) {
      controller.apply({ type: 'SHOW_MARKERS', id: 'chat-location', markers: [{ id: 'chat-location', kind: 'location', label: '●', position: response.location, title: 'Searched location' }] });
    }
    const positions: Position[] = [
      ...positionsFromGeoJson(pfzLayer),
      ...positionsFromGeoJson(safeRouteLayer),
      ...(response.location ? [[response.location.lon, response.location.lat] as Position] : []),
    ];
    if (positions.length > 1) controller.fitBounds(positions, 42);
    else if (response.location) controller.apply({ type: 'FOCUS_LOCATION', location: response.location, zoom: 8 });
  }, [candidates, pfzLayer, ready, response, safeRouteLayer]);

  if (!canRender) return null;

  return (
    <div className="chat-mini-map" aria-label="Map preview for this answer">
      <div ref={container} className="chat-mini-map__canvas" />
      <div className="chat-mini-map__label">
        <span>PFZ map preview</span>
        <button type="button" onClick={onOpenMap} aria-label="Open full marine workspace"><Maximize2 size={14} /></button>
      </div>
    </div>
  );
}
