'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import type {
  AQIGridCell,
  CPCBStation,
  HCHOHotspot,
  FireDetection,
  SelectedFeature,
  LayerState,
} from '@/types/environment';
import { getCategoryColor } from '@/lib/aqi';

// Center on India
const INDIA_CENTER: [number, number] = [78.9, 22.5];
const INITIAL_ZOOM = 4.5;

// ---- Map style ----
const MAP_STYLE = {
  version: 8,
  name: 'AeroSense Dark',
  sources: {
    'carto-dark': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'carto-dark-layer',
      type: 'raster',
      source: 'carto-dark',
      minzoom: 0,
      maxzoom: 22,
      paint: {
        'raster-opacity': 0.85,
        'raster-saturation': -0.3,
        'raster-brightness-min': 0.0,
        'raster-brightness-max': 0.4,
      },
    },
  ],
};

interface IndiaMapProps {
  aqiGrid: AQIGridCell[];
  stations: CPCBStation[];
  hchoHotspots: HCHOHotspot[];
  fires: FireDetection[];
  layers: LayerState;
  onFeatureSelect: (feature: SelectedFeature) => void;
  isMock: boolean;
}

export default function IndiaMap({
  aqiGrid,
  stations,
  hchoHotspots,
  fires,
  layers,
  onFeatureSelect,
  isMock: _isMock,
}: IndiaMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mlRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // ---- Load maplibre-gl dynamically (client-only) ----
  useEffect(() => {
    if (mlRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        // Dynamic import avoids SSR and Turbopack static analysis issues
        const ml = await import('maplibre-gl');
        if (cancelled) return;
        // inject local maplibre CSS
        if (!document.getElementById('maplibre-css')) {
          const link = document.createElement('link');
          link.id = 'maplibre-css';
          link.rel = 'stylesheet';
          link.href = '/maplibre/maplibre-gl.css';
          document.head.appendChild(link);
        }
        // configure worker URL if supported
        try {
          if ('workerUrl' in ml) {
            (ml as any).workerUrl = '/maplibre/maplibre-gl-worker.mjs';
          }
        } catch {}
        // maplibre-gl exports named exports (not a default export)
        mlRef.current = ml;
        initMap(mlRef.current);
      } catch (err) {
        if (!cancelled) {
          setMapError('Failed to load map library.');
          console.error('[Map] load error:', err);
        }
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function initMap(maplibregl: any) {
    if (!mapContainer.current || map.current) return;
    try {
      const m = new maplibregl.Map({
        container: mapContainer.current,
        style: MAP_STYLE,
        center: INDIA_CENTER,
        zoom: INITIAL_ZOOM,
        minZoom: 3,
        maxZoom: 14,
        attributionControl: false,
      });

      m.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

      m.on('load', () => setMapReady(true));
      m.on('error', (e: { error?: { message?: string } }) => {
        console.warn('[Map] style error:', e.error?.message);
      });

      map.current = m;
    } catch (err) {
      setMapError('Map failed to initialize. WebGL may be unavailable.');
      console.error('[Map] init error:', err);
    }
  }

  // ---- Cleanup ----
  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => { try { m.remove(); } catch {} });
      markersRef.current = [];
      if (map.current) {
        try { map.current.remove(); } catch {}
        map.current = null;
      }
    };
  }, []);

  // ---- Helper: remove GeoJSON layers/sources ----
  const removeLayers = useCallback((...ids: string[]) => {
    const m = map.current;
    if (!m) return;
    ids.forEach((id) => {
      try { if (m.getLayer(id)) m.removeLayer(id); } catch {}
      try { if (m.getSource(id)) m.removeSource(id); } catch {}
    });
  }, []);

  // ============================================================
  // AQI Grid Layer
  // ============================================================
  useEffect(() => {
    const m = map.current;
    if (!m || !mapReady) return;

    const SRC = 'aqi-grid-src';
    const LYR_FILL = 'aqi-grid-fill';
    const LYR_STROKE = 'aqi-grid-stroke';

    removeLayers(LYR_FILL, LYR_STROKE, SRC);
    if (!layers.aqiGrid || aqiGrid.length === 0) return;

    const half = 0.22;
    const features = aqiGrid.map((cell) => ({
      type: 'Feature' as const,
      properties: {
        id: cell.id,
        pm25: cell.pm25,
        category: cell.category,
        color: getCategoryColor(cell.category),
        label: cell.regionName ?? `${cell.lat.toFixed(2)}, ${cell.lng.toFixed(2)}`,
        dataType: cell.dataType,
        confidence: cell.confidence ?? 'Unknown',
        timestamp: cell.timestamp,
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [cell.lng - half, cell.lat - half],
          [cell.lng + half, cell.lat - half],
          [cell.lng + half, cell.lat + half],
          [cell.lng - half, cell.lat + half],
          [cell.lng - half, cell.lat - half],
        ]],
      },
    }));

    m.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features } });
    m.addLayer({ id: LYR_FILL, type: 'fill', source: SRC, paint: {
      'fill-color': ['get', 'color'],
      'fill-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.45, 8, 0.55],
    }});
    m.addLayer({ id: LYR_STROKE, type: 'line', source: SRC, paint: {
      'line-color': ['get', 'color'], 'line-width': 0.8, 'line-opacity': 0.4,
    }});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onClick = (e: any) => {
      const feat = e.features?.[0];
      if (!feat) return;
      const cell = aqiGrid.find((c) => c.id === feat.properties?.id);
      if (cell) onFeatureSelect({ type: 'aqiCell', data: cell });
    };

    m.on('mouseenter', LYR_FILL, () => { m.getCanvas().style.cursor = 'pointer'; });
    m.on('mouseleave', LYR_FILL, () => { m.getCanvas().style.cursor = ''; });
    m.on('click', LYR_FILL, onClick);

    return () => {
      if (!map.current) return;
      try { map.current.off('click', LYR_FILL, onClick); } catch {}
      removeLayers(LYR_FILL, LYR_STROKE, SRC);
    };
  }, [mapReady, aqiGrid, layers.aqiGrid, onFeatureSelect, removeLayers]);

  // ============================================================
  // CPCB Stations Layer
  // ============================================================
  useEffect(() => {
    const m = map.current;
    const ml = mlRef.current;
    if (!m || !mapReady || !ml) return;

    // Remove existing station markers
    const toRemove = markersRef.current.filter((mk) => mk._isStation);
    toRemove.forEach((mk) => { try { mk.remove(); } catch {} });
    markersRef.current = markersRef.current.filter((mk) => !mk._isStation);

    if (!layers.stations) return;

    stations.forEach((station) => {
      const el = document.createElement('div');
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', `CPCB Station: ${station.name}`);
      el.setAttribute('tabindex', '0');
      const color = '#10b981';
      Object.assign(el.style, {
        width: '14px', height: '14px', borderRadius: '50%',
        background: color, border: '2px solid rgba(16,185,129,0.5)',
        boxShadow: '0 0 8px rgba(16,185,129,0.5), 0 0 20px rgba(16,185,129,0.15)',
        cursor: 'pointer', transition: 'transform 0.15s',
      });

      const handleClick = () => onFeatureSelect({ type: 'station', data: station });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handleKey = (e: any) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); };

      el.addEventListener('click', handleClick);
      el.addEventListener('keydown', handleKey);
      el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.4)'; });
      el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)'; });

      const marker = new ml.Marker({ element: el }).setLngLat([station.lng, station.lat]).addTo(m);
      marker._isStation = true;
      markersRef.current.push(marker);
    });
  }, [mapReady, stations, layers.stations, onFeatureSelect]);

  // ============================================================
  // HCHO Hotspots Layer
  // ============================================================
  useEffect(() => {
    const m = map.current;
    const ml = mlRef.current;
    if (!m || !mapReady || !ml) return;

    const toRemove = markersRef.current.filter((mk) => mk._isHCHO);
    toRemove.forEach((mk) => { try { mk.remove(); } catch {} });
    markersRef.current = markersRef.current.filter((mk) => !mk._isHCHO);

    if (!layers.hcho) return;

    hchoHotspots.forEach((hotspot) => {
      const el = document.createElement('div');
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', `HCHO Hotspot: ${hotspot.intensity}`);
      el.setAttribute('tabindex', '0');

      const size = hotspot.intensity === 'Extreme' ? 22 : hotspot.intensity === 'High' ? 18 : 14;
      const color = hotspot.intensity === 'Extreme' ? '#ef4444' : hotspot.intensity === 'High' ? '#f97316' : '#f59e0b';

      el.innerHTML = `<div style="position:relative;width:${size}px;height:${size}px;">
        <div style="position:absolute;inset:0;border-radius:50%;background:${color}40;animation:pulse-ring 2s cubic-bezier(0.4,0,0.6,1) infinite;"></div>
        <div style="position:absolute;inset:3px;border-radius:50%;background:${color};box-shadow:0 0 10px ${color}80;"></div>
      </div>`;
      Object.assign(el.style, { cursor: 'pointer', overflow: 'visible' });

      const handleClick = () => onFeatureSelect({ type: 'hcho', data: hotspot });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handleKey = (e: any) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); };
      el.addEventListener('click', handleClick);
      el.addEventListener('keydown', handleKey);

      const marker = new ml.Marker({ element: el }).setLngLat([hotspot.lng, hotspot.lat]).addTo(m);
      marker._isHCHO = true;
      markersRef.current.push(marker);
    });
  }, [mapReady, hchoHotspots, layers.hcho, onFeatureSelect]);

  // ============================================================
  // Fire Detections Layer
  // ============================================================
  useEffect(() => {
    const m = map.current;
    if (!m || !mapReady) return;

    const SRC = 'fires-src';
    const LYR = 'fires-layer';
    removeLayers(LYR, SRC);

    if (!layers.fires || fires.length === 0) return;

    const features = fires.map((f) => ({
      type: 'Feature' as const,
      properties: {
        id: f.id,
        confidence: f.confidence,
        color: f.confidence === 'high' ? '#ef4444' : f.confidence === 'nominal' ? '#f97316' : '#fbbf24',
      },
      geometry: { type: 'Point' as const, coordinates: [f.lng, f.lat] },
    }));

    m.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features } });
    m.addLayer({ id: LYR, type: 'circle', source: SRC, paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 5, 10, 9],
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.8,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#fff',
      'circle-stroke-opacity': 0.3,
    }});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onClick = (e: any) => {
      const feat = e.features?.[0];
      if (!feat) return;
      const fire = fires.find((f) => f.id === feat.properties?.id);
      if (fire) onFeatureSelect({ type: 'fire', data: fire });
    };

    m.on('mouseenter', LYR, () => { m.getCanvas().style.cursor = 'pointer'; });
    m.on('mouseleave', LYR, () => { m.getCanvas().style.cursor = ''; });
    m.on('click', LYR, onClick);

    return () => {
      if (!map.current) return;
      try { map.current.off('click', LYR, onClick); } catch {}
      removeLayers(LYR, SRC);
    };
  }, [mapReady, fires, layers.fires, onFeatureSelect, removeLayers]);

  // ============================================================
  // Render
  // ============================================================

  if (mapError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#030e1c]">
        <div className="glass p-8 rounded-2xl text-center max-w-sm">
          <div className="text-4xl mb-3">🗺️</div>
          <div className="text-sm font-semibold text-[#e2eeff] mb-2">Map Unavailable</div>
          <p className="text-xs text-[#4a6280]">{mapError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainer} className="w-full h-full" />
      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#030e1c]/80">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[#38c1d6]/30 border-t-[#38c1d6] rounded-full animate-spin" />
            <span className="text-xs font-mono text-[#4a6280]">Initializing map…</span>
          </div>
        </div>
      )}
    </div>
  );
}
