'use client';
import { useEffect, useRef, useState } from 'react';
import type { DecisionResponse } from '@orca/contracts';
import type { FeatureCollection } from 'geojson';
import maplibregl, { type Map as LibreMap } from 'maplibre-gl';
import { Compass, Focus, Layers, Minus, Plus } from 'lucide-react';

function frameMap(map: LibreMap, decision: DecisionResponse) {
  const bounds = new maplibregl.LngLatBounds();
  bounds.extend([decision.plan.origin.lon, decision.plan.origin.lat]);
  for (const zone of decision.zones)
    bounds.extend(zone.geometry.coordinates as [number, number]);
  for (const route of decision.routes)
    for (const pos of route.geometry.coordinates)
      bounds.extend(pos as [number, number]);
  for (const fence of decision.geofences)
    for (const pos of fence.geometry.coordinates[0])
      bounds.extend(pos as [number, number]);
  const compact = map.getContainer().clientWidth < 600;
  map.fitBounds(bounds, {
    padding: {
      top: 115,
      bottom: compact ? 150 : 100,
      left: compact ? 60 : 100,
      right: compact ? 65 : 130,
    },
    maxZoom: 11,
    duration: 0,
  });
}
export function MarineMap({
  decision,
  onSelectZone,
}: {
  decision: DecisionResponse;
  onSelectZone: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LibreMap | null>(null);
  const selectRef = useRef(onSelectZone);
  const errorRef = useRef<HTMLDivElement>(null);
  const [layers, setLayers] = useState({
    hazards: true,
    restricted: true,
    routes: true,
  });
  useEffect(() => {
    selectRef.current = onSelectZone;
  }, [onSelectZone]);
  useEffect(() => {
    if (!container.current) return;
    const reportError = (message: string) => {
      if (errorRef.current) {
        errorRef.current.textContent = message;
        errorRef.current.hidden = false;
      }
    };
    if (errorRef.current) errorRef.current.hidden = true;
    let map: LibreMap;
    try {
      map = new maplibregl.Map({
        container: container.current,
        center: [80.0, 10.755],
        zoom: 10.3,
        minZoom: 8,
        maxZoom: 14,
        pitch: 0,
        attributionControl: false,
        canvasContextAttributes: { antialias: false },
        style: {
          version: 8,
          sources: { orca: { type: 'geojson', data: decision.map.layers } },
          layers: [
            {
              id: 'water',
              type: 'background',
              paint: { 'background-color': '#102e3b' },
            },
            {
              id: 'land',
              type: 'fill',
              source: 'orca',
              filter: ['==', ['get', 'kind'], 'land'],
              paint: { 'fill-color': '#243e43' },
            },
            {
              id: 'coast',
              type: 'line',
              source: 'orca',
              filter: ['==', ['get', 'kind'], 'land'],
              paint: { 'line-color': '#557069', 'line-width': 1.5 },
            },
            {
              id: 'hazards',
              type: 'fill',
              source: 'orca',
              filter: ['==', ['get', 'kind'], 'hazard'],
              paint: { 'fill-color': '#ea9859', 'fill-opacity': 0.16 },
            },
            {
              id: 'hazard-edge',
              type: 'line',
              source: 'orca',
              filter: ['==', ['get', 'kind'], 'hazard'],
              paint: {
                'line-color': '#e7a569',
                'line-width': 1.3,
                'line-dasharray': [4, 3],
              },
            },
            {
              id: 'restricted',
              type: 'fill',
              source: 'orca',
              filter: ['==', ['get', 'kind'], 'restricted'],
              paint: { 'fill-color': '#dd7d82', 'fill-opacity': 0.15 },
            },
            {
              id: 'restricted-edge',
              type: 'line',
              source: 'orca',
              filter: ['==', ['get', 'kind'], 'restricted'],
              paint: {
                'line-color': '#dc8a90',
                'line-width': 1.3,
                'line-dasharray': [2, 2],
              },
            },
            {
              id: 'route-alternative',
              type: 'line',
              source: 'orca',
              filter: [
                'all',
                ['==', ['get', 'kind'], 'route'],
                ['==', ['get', 'visible'], true],
                ['==', ['get', 'recommended'], false],
              ],
              paint: {
                'line-color': '#d9a575',
                'line-width': 2,
                'line-dasharray': [3, 3],
                'line-opacity': 0.8,
              },
            },
            {
              id: 'route-glow',
              type: 'line',
              source: 'orca',
              filter: [
                'all',
                ['==', ['get', 'kind'], 'route'],
                ['==', ['get', 'recommended'], true],
              ],
              paint: {
                'line-color': '#63debe',
                'line-width': 10,
                'line-opacity': 0.09,
              },
            },
            {
              id: 'route-recommended',
              type: 'line',
              source: 'orca',
              filter: [
                'all',
                ['==', ['get', 'kind'], 'route'],
                ['==', ['get', 'recommended'], true],
              ],
              paint: { 'line-color': '#7de6c6', 'line-width': 3 },
            },
          ],
        },
      });
    } catch {
      reportError(
        'WebGL is unavailable. The zone, route and evidence tables below contain the full decision.',
      );
      return;
    }
    mapRef.current = map;
    const markers: maplibregl.Marker[] = [];
    map.on('error', () =>
      reportError(
        'The map could not render completely. Use the route and evidence tables below.',
      ),
    );
    map.on('load', () => {
      const grid: FeatureCollection = {
        type: 'FeatureCollection',
        features: [],
      };
      for (let lon = 79.8; lon <= 80.21; lon += 0.05)
        grid.features.push({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [lon, 10.54],
              [lon, 11.02],
            ],
          },
        });
      for (let lat = 10.55; lat <= 11.01; lat += 0.05)
        grid.features.push({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [79.8, lat],
              [80.22, lat],
            ],
          },
        });
      map.addSource('grid', { type: 'geojson', data: grid });
      map.addLayer(
        {
          id: 'grid-lines',
          type: 'line',
          source: 'grid',
          paint: {
            'line-color': '#77989e',
            'line-opacity': 0.1,
            'line-width': 1,
          },
        },
        'hazards',
      );
      for (const zone of decision.zones) {
        const button = document.createElement('button');
        const selected = zone.id === decision.recommendation.candidateZoneId;
        button.className =
          'zone-marker ' +
          (selected
            ? 'recommended'
            : zone.rejected
              ? 'rejected'
              : 'alternative');
        button.setAttribute('aria-label', 'Inspect ' + zone.name);
        const letter = document.createElement('span');
        letter.className = 'zone-letter';
        letter.textContent = zone.name.slice(-1);
        const label = document.createElement('span');
        label.className = 'zone-map-label';
        label.textContent =
          zone.name +
          (selected
            ? ' · Recommended'
            : zone.rejected
              ? ' · Rejected'
              : ' · Alternative');
        button.append(letter, label);
        button.onclick = () => selectRef.current(zone.id);
        markers.push(
          new maplibregl.Marker({ element: button, anchor: 'center' })
            .setLngLat(zone.geometry.coordinates as [number, number])
            .addTo(map),
        );
      }
      const port = document.createElement('div');
      port.className = 'origin-marker';
      const dot = document.createElement('span');
      dot.className = 'port-dot';
      const label = document.createElement('span');
      label.textContent = 'NAGAPATTINAM';
      port.append(dot, label);
      markers.push(
        new maplibregl.Marker({ element: port })
          .setLngLat([decision.plan.origin.lon, decision.plan.origin.lat])
          .addTo(map),
      );
      frameMap(map, decision);
    });
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      markers.forEach((m) => m.remove());
      map.remove();
      mapRef.current = null;
    };
  }, [decision]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const ids = {
        hazards: ['hazards', 'hazard-edge'],
        restricted: ['restricted', 'restricted-edge'],
        routes: ['route-alternative', 'route-glow', 'route-recommended'],
      };
      for (const [key, names] of Object.entries(ids))
        for (const id of names) {
          if (map.getLayer(id))
            map.setLayoutProperty(
              id,
              'visibility',
              layers[key as keyof typeof layers] ? 'visible' : 'none',
            );
        }
    };
    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
    return () => {
      map.off('load', apply);
    };
  }, [layers, decision]);
  return (
    <section
      className="marine-map"
      aria-label="Interactive marine scenario map"
    >
      <div ref={container} className="map-canvas" data-testid="marine-map" />
      <div className="map-title">
        <span className="eyebrow">OPERATING AREA / 01</span>
        <h2>Nagapattinam coast</h2>
        <span>Bay of Bengal · Synthetic replay</span>
      </div>
      <div className="map-north">
        <Compass size={23} />
        <span>N</span>
      </div>
      <div className="map-sea-name" aria-hidden="true">
        BAY OF
        <br />
        BENGAL
      </div>
      <div className="map-controls">
        <button aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
          <Plus size={18} />
        </button>
        <button aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
          <Minus size={18} />
        </button>
        <button
          aria-label="Frame all zones"
          onClick={() => {
            if (mapRef.current) frameMap(mapRef.current, decision);
          }}
        >
          <Focus size={18} />
        </button>
      </div>
      <div className="map-layer-controls">
        <Layers size={14} />
        {Object.entries(layers).map(([key, visible]) => (
          <button
            key={key}
            aria-pressed={visible}
            onClick={() =>
              setLayers((current) => ({ ...current, [key]: !visible }))
            }
          >
            <span className={'layer-dot ' + key} />
            {key === 'restricted'
              ? 'Restricted'
              : key[0].toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>
      <div className="map-legend">
        <span>
          <i className="line-key" />
          Recommended
        </span>
        <span>
          <i className="line-key dashed" />
          Alternative
        </span>
      </div>
      <div className="map-attribution">
        ORCA DEMO · Schematic coast & water mask · Not a nautical chart
      </div>
      <div ref={errorRef} hidden className="map-error" role="alert" />
    </section>
  );
}
