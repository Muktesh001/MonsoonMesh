import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { Layers, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { getZones } from '../../api.ts';
import type { ZoneProperties } from '../../types.ts';
import 'maplibre-gl/dist/maplibre-gl.css';

type RiskMapProps = {
  token: string;
  height?: string;
  showControls?: boolean;
  onZoneClick?: (props: ZoneProperties) => void;
};

const RISK_COLORS = {
  CRITICAL: '#e46e62',
  HIGH:     '#e3a850',
  MODERATE: '#57b6b0',
  LOW:      '#6eae8d',
};

export default function RiskMap({
  token,
  height = '100%',
  showControls = true,
  onZoneClick,
}: RiskMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#0c1822' },
          },
        ],
      },
      center: [73.86, 18.515],
      zoom: 11.2,
      attributionControl: false,
    });

    mapRef.current = map;

    map.on('load', async () => {
      try {
        const geojson: FeatureCollection = await getZones(token);

        map.addSource('zones', { type: 'geojson', data: geojson });

        // Fill layer
        map.addLayer({
          id: 'zone-fill',
          type: 'fill',
          source: 'zones',
          paint: {
            'fill-color': [
              'match', ['get', 'category'],
              'CRITICAL', RISK_COLORS.CRITICAL,
              'HIGH',     RISK_COLORS.HIGH,
              'MODERATE', RISK_COLORS.MODERATE,
              RISK_COLORS.LOW,
            ],
            'fill-opacity': 0.22,
          },
        });

        // Outline layer
        map.addLayer({
          id: 'zone-line',
          type: 'line',
          source: 'zones',
          paint: {
            'line-color': [
              'match', ['get', 'category'],
              'CRITICAL', RISK_COLORS.CRITICAL,
              'HIGH',     RISK_COLORS.HIGH,
              'MODERATE', RISK_COLORS.MODERATE,
              RISK_COLORS.LOW,
            ],
            'line-width': 1.5,
            'line-opacity': 0.7,
          },
        });

        // Hover highlight
        map.addLayer({
          id: 'zone-fill-hover',
          type: 'fill',
          source: 'zones',
          paint: {
            'fill-color': '#ffffff',
            'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.08, 0],
          },
        });

        let hoveredId: string | number | null = null;

        map.on('mousemove', 'zone-fill', (e) => {
          if (e.features?.[0]) {
            if (hoveredId !== null) {
              map.setFeatureState({ source: 'zones', id: hoveredId }, { hover: false });
            }
            hoveredId = e.features[0].id ?? null;
            if (hoveredId !== null) {
              map.setFeatureState({ source: 'zones', id: hoveredId }, { hover: true });
            }
            map.getCanvas().style.cursor = 'pointer';
          }
        });

        map.on('mouseleave', 'zone-fill', () => {
          if (hoveredId !== null) {
            map.setFeatureState({ source: 'zones', id: hoveredId }, { hover: false });
          }
          hoveredId = null;
          map.getCanvas().style.cursor = '';
        });

        map.on('click', 'zone-fill', (e) => {
          const feature = e.features?.[0];
          if (!feature) return;
          const props = feature.properties as ZoneProperties;

          if (onZoneClick) {
            onZoneClick(props);
            return;
          }

          // Default popup
          const el = document.createElement('div');
          el.className = 'map-popup-content';
          el.innerHTML = `
            <div class="map-popup-name">${props.name ?? 'Zone'}</div>
            <div class="map-popup-row">
              <span class="map-popup-label">Risk category</span>
              <span class="badge badge-${(props.category ?? 'LOW').toLowerCase()}-risk">${props.category ?? 'Unknown'}</span>
            </div>
            <div class="map-popup-row">
              <span class="map-popup-label">Risk index</span>
              <span class="map-popup-val">${props.risk != null ? props.risk.toFixed(1) : 'Not assessed'}</span>
            </div>
            <div class="map-popup-note">Synthetic demonstration estimate</div>
          `;

          new maplibregl.Popup({ closeButton: true, className: 'mm-popup', maxWidth: '220px' })
            .setLngLat(e.lngLat)
            .setDOMContent(el)
            .addTo(map);
        });

        setLoaded(true);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Unable to load zones');
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [token, onZoneClick]);

  function zoomIn() { mapRef.current?.zoomIn(); }
  function zoomOut() { mapRef.current?.zoomOut(); }
  function fitPune() { mapRef.current?.flyTo({ center: [73.86, 18.515], zoom: 11.2 }); }

  return (
    <div className="map-wrap" style={{ height }}>
      <div ref={containerRef} className="map-canvas" />

      {/* Legend */}
      {showControls && (
        <div className="map-legend">
          <div className="map-legend-title"><Layers size={12} /> RISK ZONES</div>
          {Object.entries(RISK_COLORS).map(([cat, color]) => (
            <div className="map-legend-row" key={cat}>
              <span className="map-legend-dot" style={{ background: color }} />
              <span>{cat.charAt(0) + cat.slice(1).toLowerCase()}</span>
            </div>
          ))}
        </div>
      )}

      {/* Custom zoom controls */}
      {showControls && (
        <div className="map-custom-controls">
          <button className="map-ctrl-btn" onClick={zoomIn} aria-label="Zoom in"><ZoomIn size={14} /></button>
          <div className="map-ctrl-div" />
          <button className="map-ctrl-btn" onClick={zoomOut} aria-label="Zoom out"><ZoomOut size={14} /></button>
          <div className="map-ctrl-div" />
          <button className="map-ctrl-btn" onClick={fitPune} aria-label="Reset view"><Maximize2 size={14} /></button>
        </div>
      )}

      {/* Location label */}
      <div className="map-location-tag">PUNE METROPOLITAN AREA</div>

      {/* Attribution */}
      <div className="map-attribution">
        Synthetic zones · MapLibre · no external basemap
      </div>

      {/* Loading overlay */}
      {!loaded && !loadError && (
        <div className="map-loading">
          <span className="map-loading-dot" />
          <span className="map-loading-dot" />
          <span className="map-loading-dot" />
        </div>
      )}

      {/* Error overlay */}
      {loadError && (
        <div className="map-error">
          <span>Unable to load zones</span>
          <small>{loadError}</small>
        </div>
      )}
    </div>
  );
}
