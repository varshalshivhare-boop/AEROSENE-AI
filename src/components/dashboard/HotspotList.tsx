'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Satellite, Flame, Radio } from 'lucide-react';
import type { HCHOHotspot, CPCBStation, AQIGridCell, SelectedFeature } from '@/types/environment';
import { getCategoryColor } from '@/lib/aqi';
import { fmtPM25, fmtRelativeTime } from '@/lib/formatters';

interface HotspotListProps {
  hchoHotspots: HCHOHotspot[];
  stations: CPCBStation[];
  aqiGrid: AQIGridCell[];
  onSelect: (feature: SelectedFeature) => void;
  isMock: boolean;
}

export default function HotspotList({
  hchoHotspots,
  stations,
  aqiGrid,
  onSelect,
  isMock,
}: HotspotListProps) {
  // Sort hotspots by intensity
  const sortedHCHO = [...hchoHotspots].sort((a, b) => {
    const order = { Extreme: 0, High: 1, Elevated: 2 };
    return order[a.intensity] - order[b.intensity];
  });

  // Sort grid cells by PM2.5 desc
  const sortedGrid = [...aqiGrid]
    .sort((a, b) => b.pm25 - a.pm25)
    .slice(0, 5);

  return (
    <div className="space-y-3">
      {/* Top PM2.5 cells */}
      <div>
        <div className="text-[9px] font-mono text-[#4a6280] uppercase tracking-widest mb-2 flex items-center gap-1.5">
          <MapPin size={9} className="text-[#38c1d6]" />
          Highest PM2.5 Estimates
          {isMock && <span className="demo-badge ml-1">DEMO</span>}
        </div>
        <div className="space-y-1">
          {sortedGrid.map((cell, i) => {
            const color = getCategoryColor(cell.category);
            return (
              <motion.button
                key={cell.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => onSelect({ type: 'aqiCell', data: cell })}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left
                           hover:bg-[#38c1d6]/05 border border-transparent hover:border-[#38c1d6]/12
                           transition-all duration-150"
                id={`hotspot-grid-${cell.id}`}
              >
                <div className="w-1.5 h-6 rounded-full shrink-0" style={{ background: color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[#e2eeff] truncate">
                    {cell.regionName ?? `${cell.lat.toFixed(1)}°N`}
                  </div>
                  <div className="text-[9px] text-[#4a6280]">{cell.category}</div>
                </div>
                <div className="text-xs font-mono font-bold shrink-0" style={{ color }}>
                  {fmtPM25(cell.pm25)}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* HCHO Hotspots */}
      {hchoHotspots.length > 0 && (
        <div>
          <div className="text-[9px] font-mono text-[#4a6280] uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Satellite size={9} className="text-[#f59e0b]" />
            HCHO Hotspots
          </div>
          <div className="space-y-1">
            {sortedHCHO.map((h, i) => {
              const color = h.intensity === 'Extreme' ? '#ef4444'
                : h.intensity === 'High' ? '#f97316' : '#f59e0b';
              return (
                <motion.button
                  key={h.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  onClick={() => onSelect({ type: 'hcho', data: h })}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left
                             hover:bg-[#f59e0b]/05 border border-transparent hover:border-[#f59e0b]/12
                             transition-all duration-150"
                  id={`hotspot-hcho-${h.id}`}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0 animate-pulse"
                    style={{ background: color, boxShadow: `0 0 6px ${color}60` }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[#e2eeff] truncate">
                      {h.regionName ?? `${h.lat.toFixed(2)}°N, ${h.lng.toFixed(2)}°E`}
                    </div>
                    <div className="text-[9px] text-[#4a6280]">{h.satellite} · {h.instrument}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-mono font-bold" style={{ color }}>
                      {h.hchoColumnDU.toFixed(1)}×10⁻⁴
                    </div>
                    <div className="text-[8px] text-[#4a6280]">{h.intensity}</div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* Most polluted stations */}
      {stations.length > 0 && (
        <div>
          <div className="text-[9px] font-mono text-[#4a6280] uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Radio size={9} className="text-[#10b981]" />
            Active CPCB Stations
          </div>
          <div className="space-y-1">
            {stations.slice(0, 4).map((s, i) => {
              const color = s.category ? getCategoryColor(s.category) : '#10b981';
              return (
                <motion.button
                  key={s.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => onSelect({ type: 'station', data: s })}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left
                             hover:bg-[#10b981]/05 border border-transparent hover:border-[#10b981]/12
                             transition-all duration-150"
                  id={`hotspot-station-${s.id}`}
                >
                  <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#10b981]" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[#e2eeff] truncate">{s.name}</div>
                    <div className="text-[9px] text-[#4a6280]">{s.city} · {fmtRelativeTime(s.lastUpdated)}</div>
                  </div>
                  {s.pm25 != null && (
                    <div className="text-[10px] font-mono font-bold shrink-0" style={{ color }}>
                      {fmtPM25(s.pm25)}
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
