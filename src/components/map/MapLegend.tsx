'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Wind, Radio, Satellite, Flame, Info } from 'lucide-react';
import { AQI_BREAKPOINTS } from '@/lib/aqi';
import type { LayerState } from '@/types/environment';

interface MapLegendProps {
  layers: LayerState;
}

export default function MapLegend({ layers }: MapLegendProps) {
  const hasAny = Object.values(layers).some(Boolean);
  if (!hasAny) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="glass rounded-xl p-3 w-48 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
    >
      {/* AQI Grid Legend */}
      {layers.aqiGrid && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Wind size={10} className="text-[#38c1d6]" />
            <span className="text-[9px] font-mono text-[#8ba8cc] uppercase tracking-wider">
              PM2.5 Estimate
            </span>
          </div>
          <div className="space-y-1">
            {AQI_BREAKPOINTS.map((bp) => (
              <div key={bp.category} className="flex items-center gap-2">
                <div
                  className="w-3 h-2 rounded-sm shrink-0"
                  style={{ background: bp.color, opacity: 0.8 }}
                />
                <span className="text-[9px] text-[#4a6280] flex-1">{bp.category}</span>
                <span className="text-[8px] font-mono text-[#2e4a6a]">
                  {bp.pm25Low}–{bp.pm25High > 400 ? '500+' : bp.pm25High}
                </span>
              </div>
            ))}
          </div>
          <div className="text-[8px] text-[#2e4a6a] mt-1.5 leading-relaxed">
            PM2.5 µg/m³ · Model estimate
          </div>
        </div>
      )}

      {/* Divider */}
      {layers.aqiGrid && (layers.stations || layers.hcho || layers.fires) && (
        <div className="border-t border-[#38c1d6]/08 my-2" />
      )}

      {/* Station marker */}
      {layers.stations && (
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-3 h-3 rounded-full bg-[#10b981] border border-[#10b981]/50 shrink-0 flex items-center justify-center">
            <Radio size={6} className="text-white" />
          </div>
          <span className="text-[9px] text-[#4a6280]">CPCB Station</span>
        </div>
      )}

      {/* HCHO marker */}
      {layers.hcho && (
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-3 h-3 rounded-full bg-[#f59e0b]/60 border border-[#f59e0b]/50 shrink-0" />
          <span className="text-[9px] text-[#4a6280]">HCHO Hotspot</span>
        </div>
      )}

      {/* Fire marker */}
      {layers.fires && (
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-3 h-3 rounded-full bg-[#ef4444]/70 border border-[#ef4444]/50 shrink-0 flex items-center justify-center">
            <Flame size={6} className="text-white" />
          </div>
          <span className="text-[9px] text-[#4a6280]">Fire Detection</span>
        </div>
      )}

      {/* Disclaimer */}
      <div className="flex items-start gap-1 mt-2 pt-2 border-t border-[#38c1d6]/06">
        <Info size={8} className="text-[#2e4a6a] mt-0.5 shrink-0" />
        <p className="text-[8px] text-[#2e4a6a] leading-relaxed">
          Grid cells show model estimates. Station markers show direct measurements.
          These are different evidence types.
        </p>
      </div>
    </motion.div>
  );
}
