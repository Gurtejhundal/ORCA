import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';

export const MAP_STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL || '/map-style.json';

export const MAP_LAYER_IDS = {
  grid: { source: 'marine-grid', fill: 'marine-grid-fill', line: 'marine-grid-lines', point: 'marine-grid-points' },
  pfz: { source: 'marine-pfz', fill: 'marine-pfz-fill', line: 'marine-pfz-lines', point: 'marine-pfz-points' },
  hazards: { source: 'marine-hazards', fill: 'marine-hazards-fill', line: 'marine-hazards-lines', point: 'marine-hazards-points' },
  restricted: { source: 'marine-restricted', fill: 'marine-restricted-fill', line: 'marine-restricted-lines', point: 'marine-restricted-points' },
  routes: { source: 'marine-routes', fill: 'marine-routes-fill', line: 'marine-routes-lines', point: 'marine-routes-points' },
} as const;

export type MapPosition = { lat: number; lon: number };
export type GeoJsonInput = Feature | FeatureCollection | Geometry;
export type PropertyPalette = {
  colors: Record<string, string>;
  fallback: string;
  property: string;
};
export type MapLayerOptions = {
  fillColor?: string;
  fillOpacity?: number;
  lineColor?: string;
  lineOpacity?: number;
  lineWidth?: number;
  pointColor?: string;
  pointRadius?: number;
  popupText?: (properties: Record<string, unknown>) => string;
  propertyPalette?: PropertyPalette;
};
export type MapMarker = {
  id: string;
  kind: 'location' | 'origin' | 'vessel' | 'zone';
  label?: string;
  onClick?: () => void;
  position: MapPosition;
  status?: 'alternative' | 'recommended' | 'rejected';
  title: string;
};

export type MapAction =
  | { type: 'ADD_LAYER'; id: string; geojson: GeoJsonInput; options?: MapLayerOptions }
  | { type: 'REMOVE_LAYER'; id: string }
  | { type: 'CLEAR_LAYER'; id?: string }
  | { type: 'FOCUS_LOCATION'; location: MapPosition; zoom?: number }
  | { type: 'FIT_BOUNDS'; geojson?: GeoJsonInput; positions?: Position[]; padding?: number }
  | { type: 'SHOW_MARKERS'; id: string; markers: MapMarker[] }
  | { type: 'SHOW_HAZARD_ZONE'; id: string; geojson: GeoJsonInput }
  | { type: 'HIGHLIGHT_REGION'; id: string; geojson: GeoJsonInput }
  | { type: 'DRAW_ROUTE'; id: string; geojson: GeoJsonInput }
  | { type: 'UPDATE_VESSEL'; id: string; position: MapPosition; title?: string }
  | { type: 'SHOW_GEOFENCE_WARNING'; id: string; title: string; position?: MapPosition };

const supportedGeometryTypes = new Set([
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
]);

export function toFeatureCollection(geojson: GeoJsonInput): FeatureCollection {
  const features =
    geojson.type === 'FeatureCollection'
      ? geojson.features
      : geojson.type === 'Feature'
        ? [geojson]
        : [{ type: 'Feature' as const, properties: {}, geometry: geojson }];
  return {
    type: 'FeatureCollection',
    features: features.filter(
      (feature) => feature.geometry && supportedGeometryTypes.has(feature.geometry.type),
    ),
  };
}

export function positionsFromGeoJson(geojson: GeoJsonInput): Position[] {
  const positions: Position[] = [];
  const collect = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      positions.push(value as Position);
      return;
    }
    value.forEach(collect);
  };
  for (const feature of toFeatureCollection(geojson).features)
    if (feature.geometry && 'coordinates' in feature.geometry)
      collect(feature.geometry.coordinates);
  return positions;
}

type ManagedLayer = { layerIds: string[]; sourceId: string };

function idsFor(id: string): ManagedLayer {
  const known = MAP_LAYER_IDS[id as keyof typeof MAP_LAYER_IDS];
  if (known) return { sourceId: known.source, layerIds: [known.fill, known.line, known.point] };
  const prefix = `marine-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  return { sourceId: `${prefix}-source`, layerIds: [`${prefix}-fill`, `${prefix}-line`, `${prefix}-points`] };
}

function colorExpression(color: string, palette?: PropertyPalette): string {
  if (!palette) return color;
  return [
    'match',
    ['get', palette.property],
    ...Object.entries(palette.colors).flat(),
    palette.fallback,
  ] as unknown as string;
}

function createMarkerElement(marker: MapMarker): HTMLElement {
  if (marker.kind === 'zone') {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = `zone-marker ${marker.status ?? 'alternative'}`;
    element.setAttribute('aria-label', `Inspect ${marker.title}`);
    const letter = document.createElement('span');
    letter.className = 'zone-letter';
    letter.textContent = marker.label ?? '';
    const label = document.createElement('span');
    label.className = 'zone-map-label';
    label.textContent = marker.title;
    element.append(letter, label);
    if (marker.onClick) element.onclick = marker.onClick;
    return element;
  }

  const element = document.createElement('div');
  element.className = marker.kind === 'origin' ? 'origin-marker' : 'origin-marker location-marker';
  element.setAttribute('aria-label', marker.title);
  element.textContent = marker.label ?? (marker.kind === 'vessel' ? 'VESSEL' : '●');
  return element;
}

export type MapLibreController = {
  apply(action: MapAction): void;
  fitBounds(points: Position[], padding?: number): void;
  getMap(): MapLibreMap;
  setLayerVisible(id: string, visible: boolean): void;
  dispose(): void;
};

export function createMapLibreController(map: MapLibreMap): MapLibreController {
  const layers = new Map<string, ManagedLayer>();
  const markerGroups = new Map<string, Map<string, maplibregl.Marker>>();

  const removeLayer = (id: string) => {
    const managed = layers.get(id);
    if (!managed) return;
    managed.layerIds.forEach((layerId) => {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    });
    if (map.getSource(managed.sourceId)) map.removeSource(managed.sourceId);
    layers.delete(id);
  };
  const clearMarkers = (id: string) => {
    markerGroups.get(id)?.forEach((marker) => marker.remove());
    markerGroups.delete(id);
  };
  const addLayer = (id: string, geojson: GeoJsonInput, options: MapLayerOptions = {}) => {
    const data = toFeatureCollection(geojson);
    const managed = layers.get(id) ?? idsFor(id);
    const source = map.getSource(managed.sourceId) as GeoJSONSource | undefined;
    if (source) {
      void source.setData(data);
      return;
    }

    map.addSource(managed.sourceId, { type: 'geojson', data });
    const [fillId, lineId, pointId] = managed.layerIds;
    const palette = options.propertyPalette;
    map.addLayer({
      id: fillId,
      type: 'fill',
      source: managed.sourceId,
      filter: ['==', '$type', 'Polygon'],
      paint: {
        'fill-color': colorExpression(options.fillColor ?? '#61b7ff', palette),
        'fill-opacity': options.fillOpacity ?? 0.2,
      },
    });
    map.addLayer({
      id: lineId,
      type: 'line',
      source: managed.sourceId,
      filter: ['in', '$type', 'LineString', 'Polygon'],
      paint: {
        'line-color': colorExpression(options.lineColor ?? options.fillColor ?? '#61b7ff', palette),
        'line-opacity': options.lineOpacity ?? 0.95,
        'line-width': options.lineWidth ?? 2,
      },
    });
    map.addLayer({
      id: pointId,
      type: 'circle',
      source: managed.sourceId,
      filter: ['==', '$type', 'Point'],
      paint: {
        'circle-color': colorExpression(options.pointColor ?? options.fillColor ?? '#61b7ff', palette),
        'circle-radius': options.pointRadius ?? 7,
        'circle-opacity': options.fillOpacity ?? 0.75,
        'circle-stroke-color': colorExpression(options.lineColor ?? options.fillColor ?? '#61b7ff', palette),
        'circle-stroke-width': 2,
      },
    });
    const getPopupText = options.popupText;
    if (getPopupText) {
      map.on('click', managed.layerIds, (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const text = getPopupText(feature.properties as Record<string, unknown>);
        if (text) new maplibregl.Popup().setLngLat(event.lngLat).setText(text).addTo(map);
      });
    }
    layers.set(id, managed);
  };
  const showMarkers = (id: string, markers: MapMarker[]) => {
    clearMarkers(id);
    const group = new Map<string, maplibregl.Marker>();
    markers.forEach((marker) => {
      const result = new maplibregl.Marker({ element: createMarkerElement(marker), anchor: 'center' })
        .setLngLat([marker.position.lon, marker.position.lat])
        .addTo(map);
      group.set(marker.id, result);
    });
    markerGroups.set(id, group);
  };
  const fitBounds = (points: Position[], padding = 100) => {
    if (points.length < 2) return;
    const bounds = new maplibregl.LngLatBounds();
    points.forEach((position) => bounds.extend([position[0], position[1]]));
    map.fitBounds(bounds, { padding, maxZoom: 11, duration: 0 });
  };

  return {
    getMap: () => map,
    fitBounds,
    setLayerVisible: (id, visible) => {
      const managed = layers.get(id);
      managed?.layerIds.forEach((layerId) => {
        if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
      });
    },
    apply: (action) => {
      switch (action.type) {
        case 'ADD_LAYER':
          addLayer(action.id, action.geojson, action.options);
          return;
        case 'REMOVE_LAYER':
          removeLayer(action.id);
          return;
        case 'CLEAR_LAYER':
          if (action.id) removeLayer(action.id);
          else [...layers.keys()].forEach(removeLayer);
          return;
        case 'FOCUS_LOCATION':
          map.flyTo({ center: [action.location.lon, action.location.lat], zoom: action.zoom ?? map.getZoom() });
          return;
        case 'FIT_BOUNDS':
          fitBounds(action.positions ?? (action.geojson ? positionsFromGeoJson(action.geojson) : []), action.padding);
          return;
        case 'SHOW_MARKERS':
          showMarkers(action.id, action.markers);
          return;
        case 'SHOW_HAZARD_ZONE':
          addLayer(action.id, action.geojson, {
            fillColor: '#ea9859', fillOpacity: 0.16, lineColor: '#e7a569', lineWidth: 1.5,
            propertyPalette: { property: 'severity', colors: { high: '#dc8a90', severe: '#dc8a90' }, fallback: '#ea9859' },
            popupText: (properties) => ['name', 'type', 'severity', 'valid_until', 'source']
              .flatMap((key) => {
                const value = properties[key];
                return typeof value === 'string' || typeof value === 'number' ? [`${key}: ${value}`] : [];
              })
              .join('\n'),
          });
          return;
        case 'HIGHLIGHT_REGION':
          addLayer(action.id, action.geojson, { fillColor: '#61b7ff', fillOpacity: 0.2, lineColor: '#61b7ff' });
          return;
        case 'DRAW_ROUTE':
          addLayer(action.id, action.geojson, { lineColor: '#7de6c6', lineOpacity: 0.95, lineWidth: 3 });
          return;
        case 'UPDATE_VESSEL': {
          const vessel = markerGroups.get('vessel')?.get(action.id);
          if (vessel) vessel.setLngLat([action.position.lon, action.position.lat]);
          else showMarkers('vessel', [{ id: action.id, kind: 'vessel', position: action.position, title: action.title ?? 'Vessel position' }]);
          return;
        }
        case 'SHOW_GEOFENCE_WARNING': {
          if (action.position) {
            new maplibregl.Popup()
              .setLngLat([action.position.lon, action.position.lat])
              .setText(`GEOFENCE WARNING: ${action.title}`)
              .addTo(map);
          }
          return;
        }
      }
    },
    dispose: () => {
      [...layers.keys()].forEach(removeLayer);
      markerGroups.forEach((markers) => markers.forEach((marker) => marker.remove()));
      markerGroups.clear();
    },
  };
}
