import type { MapActionPayload } from './marine-api';
import type { GeoJsonInput, MapAction } from './maplibre-map';

const validPosition = (p?: {lat: number; lon: number}): p is {lat: number; lon: number} =>
  !!p && Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;

/** Translate the backend wire contract into the existing MapLibre controller contract. */
export function backendMapAction(action: MapActionPayload): MapAction | null {
  const id = `backend-${action.id ?? action.layer ?? action.action}`;
  const raw = action.geojson ?? action.data;
  const geojson = raw && typeof raw === 'object' && 'type' in raw &&
    ['FeatureCollection', 'Feature', 'Point', 'LineString', 'Polygon', 'MultiPolygon', 'MultiLineString', 'MultiPoint'].includes(String(raw.type))
    ? raw as GeoJsonInput : null;
  switch (action.action) {
    case 'ADD_LAYER': case 'DRAW_ROUTE': case 'SHOW_HAZARD_ZONE': case 'HIGHLIGHT_REGION':
      return geojson ? { type: action.action, id, geojson } : null;
    case 'REMOVE_LAYER': case 'CLEAR_LAYER':
      return { type: action.action, id };
    case 'FOCUS_LOCATION': {
      const p = { lat: action.lat!, lon: action.lon! };
      return validPosition(p) ? { type: action.action, location: p, zoom: action.zoom } : null;
    }
    case 'FIT_BOUNDS':
      return geojson ? { type: action.action, geojson } : null;
    case 'SHOW_MARKERS':
      return { type: action.action, id, markers: (action.markers ?? []).flatMap(m => {
        const p = { lat: m.position?.lat, lon: m.position?.lng };
        return validPosition(p) ? [{ id: m.id, kind: 'zone' as const, position: p, title: m.title, label: m.label }] : [];
      }) };
    case 'UPDATE_VESSEL':
      return validPosition(action.position) ? { type: action.action, id, position: action.position, title: action.title } : null;
    case 'SHOW_GEOFENCE_WARNING':
      return validPosition(action.position) ? { type: action.action, id, position: action.position, title: action.title ?? 'Boundary warning' } : null;
  }
}
