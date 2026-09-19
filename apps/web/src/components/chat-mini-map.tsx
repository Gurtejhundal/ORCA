'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { Feature, FeatureCollection, Position } from 'geojson';
import { Maximize2 } from 'lucide-react';
import type { ChatResponsePayload, Location, RankedPFZCandidate } from '@/services/marine-api';
import { backendMapAction } from '@/services/backend-map-actions';
import {
  createMapLibreController,
  MAP_STYLE_URL,
  positionsFromGeoJson,
  type MapLibreController,
} from '@/services/maplibre-map';

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

function candidateFeature(candidate: RankedPFZCandidate): Feature | null {
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

function routeFeature(response: ChatResponsePayload): Feature | null {
  const route = response.route_comparison?.safe_route ?? null;
  const geometry = route?.geojson?.type === 'Feature'
    ? route.geojson.geometry
    : route?.geojson?.type === 'LineString'
      ? route.geojson
      : null;
  if (!geometry || typeof geometry !== 'object' || !('type' in geometry)) return null;
  return {
    type: 'Feature',
    geometry: geometry as Feature['geometry'],
    properties: {
      name: 'Route',
      distance_km: route?.total_distance_km,
      risk: route?.overall_risk_level,
    },
  };
}

function pointFromGeometry(candidate: RankedPFZCandidate): Location | null {
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

function fallbackLayers(response: ChatResponsePayload) {
  const candidates = response.data.ranked_pfz_candidates ?? [];
  const pfzFeatures = candidates.flatMap((candidate) => {
    const feature = candidateFeature(candidate);
    return feature ? [feature] : [];
  });
  const route = routeFeature(response);
  const routeLayer: FeatureCollection = route ? { type: 'FeatureCollection', features: [route] } : EMPTY;
  const pfzLayer: FeatureCollection = { type: 'FeatureCollection', features: pfzFeatures };
  return { candidates, pfzLayer, routeLayer };
}

export function ChatMiniMap({
  response,
  onOpenMap,
}: {
  response: ChatResponsePayload;
  onOpenMap: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const controllerRef = useRef<MapLibreController | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const { candidates, pfzLayer, routeLayer } = useMemo(() => fallbackLayers(response), [response]);
  const hasRenderableMap =
    response.map_actions.length > 0 ||
    pfzLayer.features.length > 0 ||
    routeLayer.features.length > 0 ||
    !!response.location;

  useEffect(() => {
    if (!hasRenderableMap) return;
    const element = container.current;
    if (!element || mapRef.current) return;
    let cancelled = false;
    const center = response.location ?? { lat: 20.0, lon: 78.0 };
    const map = new maplibregl.Map({
      container: element,
      style: MAP_STYLE_URL,
      center: [center.lon, center.lat],
      zoom: response.location ? 8.2 : 4.2,
      minZoom: 2,
      maxZoom: 13,
      attributionControl: false,
      interactive: true,
    });
    mapRef.current = map;
    const onMapError = () => {
      if (!cancelled) setError('Map preview could not load.');
    };
    map.on('error', onMapError);
    map.once('style.load', () => {
      if (cancelled) return;
      controllerRef.current = createMapLibreController(map);
      setReady(true);
      setError('');
    });
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(element);
    return () => {
      cancelled = true;
      observer.disconnect();
      controllerRef.current?.dispose();
      controllerRef.current = null;
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [hasRenderableMap, response.location]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller || !ready) return;
    const translated = response.map_actions.map(backendMapAction).filter((action) => action !== null);
    translated.forEach((action) => controller.apply(action));

    if (pfzLayer.features.length) {
      controller.apply({
        type: 'ADD_LAYER',
        id: 'chat-pfz',
        geojson: pfzLayer,
        options: { fillColor: '#61b7ff', fillOpacity: 0.32, lineColor: '#bcefff', lineWidth: 2.5 },
      });
      controller.apply({
        type: 'SHOW_MARKERS',
        id: 'chat-pfz-markers',
        markers: candidates.flatMap((candidate) => {
          const position = pointFromGeometry(candidate);
          return position ? [{
            id: candidate.pfz_id,
            kind: 'zone' as const,
            label: 'PFZ',
            position,
            status: candidate.excluded ? 'rejected' as const : candidate.rank === 1 ? 'recommended' as const : 'alternative' as const,
            title: `${candidate.name} · ${candidate.distance_km.toFixed(1)} km`,
          }] : [];
        }),
      });
    }

    if (routeLayer.features.length) {
      controller.apply({
        type: 'DRAW_ROUTE',
        id: 'chat-route',
        geojson: routeLayer,
      });
    }

    if (response.location) {
      controller.apply({
        type: 'SHOW_MARKERS',
        id: 'chat-location',
        markers: [{ id: 'chat-location', kind: 'location', label: '●', position: response.location, title: 'Searched location' }],
      });
    }

    const positions: Position[] = [
      ...positionsFromGeoJson(pfzLayer),
      ...positionsFromGeoJson(routeLayer),
      ...(response.location ? [[response.location.lon, response.location.lat] as Position] : []),
    ];
    if (positions.length > 1) controller.fitBounds(positions, 42);
    else if (response.location) controller.apply({ type: 'FOCUS_LOCATION', location: response.location, zoom: 8.2 });
  }, [candidates, pfzLayer, ready, response, routeLayer]);

  if (!hasRenderableMap) return null;

  return (
    <div className="chat-mini-map" aria-label="Map preview for this answer">
      <div ref={container} className="chat-mini-map__canvas" />
      <div className="chat-mini-map__label">
        <span>PFZ map preview</span>
        <button type="button" onClick={onOpenMap} aria-label="Open full marine workspace">
          <Maximize2 size={14} />
        </button>
      </div>
      {error ? <div className="chat-mini-map__error" role="alert">{error}</div> : null}
    </div>
  );
}
