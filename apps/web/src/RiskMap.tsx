import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { Crosshair, Layers } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

function getZones(token: string): Promise<FeatureCollection> {
  return fetch(`${API_URL}/zones`, { headers: { Authorization: `Bearer ${token}` } })
    .then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to load map zones');
      return body as FeatureCollection;
    });
}

export default function RiskMap({ token }: { token: string }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#0c1822' } }] },
      center: [73.86, 18.515], zoom: 11.6, attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    mapRef.current = map;
    map.on('load', async () => {
      try {
        const geojson = await getZones(token);
        map.addSource('zones', { type: 'geojson', data: geojson });
        map.addLayer({ id: 'risk-zone-fill', type: 'fill', source: 'zones', paint: {
          'fill-color': ['match', ['get', 'category'], 'CRITICAL', '#ec655a', 'HIGH', '#e9a74f', 'MODERATE', '#61b8c0', '#4b9d81'],
          'fill-opacity': 0.22,
        } });
        map.addLayer({ id: 'risk-zone-line', type: 'line', source: 'zones', paint: { 'line-color': '#77b9c9', 'line-width': 1.4, 'line-opacity': 0.65 } });
        map.on('click', 'risk-zone-fill', (event) => {
          const feature = event.features?.[0];
          if (!feature) return;
          const properties = feature.properties as { name?: string; category?: string; risk?: number };
          const content = document.createElement('div');
          const title = document.createElement('strong');
          title.textContent = properties.name ?? 'Zone';
          const detail = document.createElement('div');
          detail.textContent = `Risk index: ${properties.risk ?? 'Not assessed'} · ${properties.category ?? 'No category'}`;
          const note = document.createElement('small');
          note.textContent = 'Synthetic demonstration estimate';
          content.append(title, detail, note);
          new maplibregl.Popup({ closeButton: false, className: 'zone-popup' })
            .setLngLat(event.lngLat)
            .setDOMContent(content)
            .addTo(map);
        });
      } catch (error) { console.error('Unable to load map zones', error); }
    });
    return () => { map.remove(); mapRef.current = null; };
  }, [token]);
  return <div className="map-frame"><div ref={container} className="map-canvas" />
    <div className="map-attribution">Synthetic demonstration zones · MapLibre · no external basemap tiles</div>
    <div className="map-controls"><span className="map-control-title"><Layers size={14} /> MAP LAYERS</span>
      <div className="legend-row"><i className="legend-dot critical" /> Critical risk</div><div className="legend-row"><i className="legend-dot high" /> High risk</div><div className="legend-row"><i className="legend-dot moderate" /> Moderate risk</div></div>
    <div className="map-crosshair"><Crosshair size={15} /> PUNE METROPOLITAN AREA</div>
  </div>;
}
