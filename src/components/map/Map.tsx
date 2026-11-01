'use client';

import React, { useEffect, useRef, useState } from 'react';
import maplibregl, { Map as MapGL } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  fetchAQIGrid,
  fetchStations,
  fetchHotspots,
  fetchFires,
  AQIGridCell,
  Station,
  Hotspot,
  FireAnomaly,
} from '@/services/api';
import { LayerState } from '../dashboard/LayerControls';

interface Props {
  onSelectCell: (cell: AQIGridCell) => void;
  onSelectStation: (station: Station) => void;
  layerVisibility: LayerState;
}

export const cpcbColorMap = (aqi: number): string => {
  if (aqi <= 50) return '#00b050'; // Good (Green)
  if (aqi <= 100) return '#92d050'; // Satisfactory (Light Green)
  if (aqi <= 200) return '#f59e0b'; // Moderate (Yellow/Amber)
  if (aqi <= 300) return '#f97316'; // Poor (Orange)
  if (aqi <= 400) return '#ef4444'; // Very Poor (Red)
  return '#7e0023'; // Severe (Maroon)
};

export default function Map({
  onSelectCell,
  onSelectStation,
  layerVisibility,
}: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapGL | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [gridData, setGridData] = useState<AQIGridCell[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [fires, setFires] = useState<FireAnomaly[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  // 1. Fetch telemetry & model data
  useEffect(() => {
    let active = true;
    Promise.all([fetchAQIGrid(), fetchStations(), fetchHotspots(), fetchFires()]).then(
      ([g, s, h, f]) => {
        if (!active) return;
        setGridData(g);
        setStations(s);
        setHotspots(h);
        setFires(f);
      }
    );
    return () => {
      active = false;
    };
  }, []);

  // 2. Initialize MapLibre
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: [
              'https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
              'https://cartodb-basemaps-b.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
              'https://cartodb-basemaps-c.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors, &copy; CARTO',
          },
        },
        layers: [
          {
            id: 'dark-base',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [78.9, 22.5], // Centered on India (coords: [22.5, 78.9], zoom: 5)
      zoom: 4.8,
      minZoom: 3,
      maxZoom: 16,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    map.on('load', () => {
      mapRef.current = map;
      setMapLoaded(true);
      map.resize();
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 3. Render Vector Layers (AQI Grid)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || gridData.length === 0) return;

    const sourceData: GeoJSON.FeatureCollection<GeoJSON.Geometry> = {
      type: 'FeatureCollection',
      features: gridData.map((cell) => ({
        type: 'Feature',
        id: cell.id,
        properties: {
          id: cell.id,
          name: cell.name,
          aqi: cell.aqi,
          pm25: cell.pm25,
          color: cpcbColorMap(cell.aqi),
          confidence: cell.confidence,
        },
        geometry: {
          type: 'Point',
          coordinates: [cell.lon, cell.lat],
        },
      })),
    };

    if (map.getSource('aqi-grid-source')) {
      const src = map.getSource('aqi-grid-source') as maplibregl.GeoJSONSource;
      src.setData(sourceData);
    } else {
      map.addSource('aqi-grid-source', {
        type: 'geojson',
        data: sourceData,
      });

      // Halo/glow layer
      map.addLayer({
        id: 'aqi-grid-glow',
        type: 'circle',
        source: 'aqi-grid-source',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 18, 8, 38],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.28,
          'circle-blur': 0.8,
        },
        layout: {
          visibility: layerVisibility.aqi ? 'visible' : 'none',
        },
      });

      // Solid central core
      map.addLayer({
        id: 'aqi-grid-core',
        type: 'circle',
        source: 'aqi-grid-source',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 9, 8, 20],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.88,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-opacity': 0.8,
        },
        layout: {
          visibility: layerVisibility.aqi ? 'visible' : 'none',
        },
      });

      // Click event for grid cells
      map.on('click', 'aqi-grid-core', (e) => {
        if (!e.features || !e.features[0]) return;
        const cellId = e.features[0].properties?.id;
        const target = gridData.find((c) => c.id === cellId);
        if (target) {
          onSelectCell(target);
        }
      });

      map.on('mouseenter', 'aqi-grid-core', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'aqi-grid-core', () => {
        map.getCanvas().style.cursor = '';
      });
    }
  }, [mapLoaded, gridData, onSelectCell]);

  // 4. Update Layer Visibilities
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (map.getLayer('aqi-grid-core')) {
      map.setLayoutProperty('aqi-grid-core', 'visibility', layerVisibility.aqi ? 'visible' : 'none');
    }
    if (map.getLayer('aqi-grid-glow')) {
      map.setLayoutProperty('aqi-grid-glow', 'visibility', layerVisibility.aqi ? 'visible' : 'none');
    }
  }, [layerVisibility.aqi, mapLoaded]);

  // 5. Render HTML Markers (CPCB Stations, HCHO Hotspots, Active Fires)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // --- Render CPCB Ground Stations ---
    if (layerVisibility.stations) {
      stations.forEach((st) => {
        const el = document.createElement('div');
        el.className = 'group cursor-pointer relative';
        el.innerHTML = `
          <div class="relative flex items-center justify-center">
            <span class="absolute w-7 h-7 rounded-full bg-cyan-400/30 animate-ping"></span>
            <div class="relative w-6 h-6 rounded-full bg-slate-900 border-2 border-cyan-400 flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.8)]">
              <span class="w-2 h-2 rounded-full bg-cyan-300"></span>
            </div>
            <div class="absolute -bottom-6 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950/90 text-cyan-300 text-[10px] font-mono px-2 py-0.5 rounded border border-cyan-800 whitespace-nowrap pointer-events-none z-30">
              ${st.name.split(',')[0]} (${st.pm25.toFixed(1)} µg/m³)
            </div>
          </div>
        `;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectStation(st);
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([st.lon, st.lat])
          .addTo(map);

        markersRef.current.push(marker);
      });
    }

    // --- Render HCHO Hotspots (Animated Gas Cloud / Flame Icon) ---
    if (layerVisibility.hotspots) {
      hotspots.forEach((h) => {
        const el = document.createElement('div');
        el.className = 'group cursor-pointer relative pointer-events-auto';
        el.innerHTML = `
          <div class="relative flex items-center justify-center">
            <span class="absolute w-10 h-10 rounded-full bg-amber-500/25 animate-pulse"></span>
            <div class="relative w-8 h-8 rounded-full bg-gradient-to-tr from-amber-600 to-yellow-400 border border-amber-200/60 flex items-center justify-center shadow-[0_0_16px_rgba(245,158,11,0.9)] animate-bounce" style="animation-duration: 2.5s;">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-slate-950" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.001 2.002c-.52 0-1.02.26-1.32.7l-4.5 6.75a4.5 4.5 0 0 0 7.49 4.99 1.5 1.5 0 0 1 2.33 1.06 6 6 0 1 1-10.49-4.8 1.5 1.5 0 0 1 2.5-1.65 9 9 0 1 0 15.98 7.95 9 9 0 0 0-10.49-14.79 1.5 1.5 0 0 1-1.5-2.26Z"/>
              </svg>
            </div>
            <div class="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950/95 text-amber-300 text-[10px] font-semibold px-2 py-0.5 rounded border border-amber-700 whitespace-nowrap pointer-events-none z-30">
              ${h.name}: ${(h.intensity * 100).toFixed(0)}% Peak HCHO
            </div>
          </div>
        `;
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([h.lon, h.lat])
          .addTo(map);

        markersRef.current.push(marker);
      });
    }

    // --- Render Active Biomass Fires ---
    if (layerVisibility.fires) {
      fires.forEach((f) => {
        const el = document.createElement('div');
        el.className = 'group cursor-pointer relative pointer-events-auto';
        el.innerHTML = `
          <div class="relative flex items-center justify-center">
            <span class="absolute w-9 h-9 rounded-full bg-rose-600/30 animate-ping" style="animation-duration: 2s;"></span>
            <div class="relative w-7 h-7 rounded-full bg-gradient-to-t from-red-700 via-rose-500 to-amber-300 border border-white/80 flex items-center justify-center shadow-[0_0_14px_rgba(225,29,72,0.9)]">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.43 2.3a1 1 0 0 0-1.86 0 12.3 12.3 0 0 0-.6 3.1c-.24 2.1-.8 3.6-1.7 4.7-.9 1.1-2.2 1.9-3.7 2.3a1 1 0 0 0-.6 1.4c.5 1.2 1.3 2.2 2.3 3 1.6 1.3 3.6 2 5.7 2s4.1-.7 5.7-2c1.6-1.3 2.6-3.2 2.6-5.2 0-3.1-2-5.9-4.8-7.3-.6-.3-1.1-.9-1.4-1.5a14 14 0 0 1-1.6-3.8v-.2z"/>
              </svg>
            </div>
            <div class="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950/95 text-rose-300 text-[10px] font-semibold px-2 py-0.5 rounded border border-rose-800 whitespace-nowrap pointer-events-none z-30">
              ${f.name} (${f.frp} MW)
            </div>
          </div>
        `;
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([f.lon, f.lat])
          .addTo(map);

        markersRef.current.push(marker);
      });
    }

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };
  }, [mapLoaded, stations, hotspots, fires, layerVisibility, onSelectStation]);

  return (
    <div className="relative w-full h-full bg-slate-950">
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

      {/* CPCB Legend */}
      <div className="absolute bottom-6 left-6 bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-700/60 p-3 shadow-xl z-20 text-xs">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-2">
          CPCB AQI Scale
        </div>
        <div className="flex items-center space-x-1 font-mono text-[10px]">
          <div className="flex flex-col items-center">
            <span className="w-8 h-2 rounded-l bg-[#00b050]" />
            <span className="text-slate-400 mt-1">0-50</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="w-8 h-2 bg-[#92d050]" />
            <span className="text-slate-400 mt-1">100</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="w-8 h-2 bg-[#f59e0b]" />
            <span className="text-slate-400 mt-1">200</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="w-8 h-2 bg-[#f97316]" />
            <span className="text-slate-400 mt-1">300</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="w-8 h-2 bg-[#ef4444]" />
            <span className="text-slate-400 mt-1">400</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="w-8 h-2 rounded-r bg-[#7e0023]" />
            <span className="text-slate-400 mt-1">500+</span>
          </div>
        </div>
      </div>
    </div>
  );
}
