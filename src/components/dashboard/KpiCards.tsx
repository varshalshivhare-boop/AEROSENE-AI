'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Wind, Radio, Satellite, Flame, TrendingUp, RefreshCw, AlertCircle } from 'lucide-react';
import type { AQIGridCell, CPCBStation, HCHOHotspot } from '@/types/environment';
import { getCategoryColor } from '@/lib/aqi';
import { fmtPM25, fmtRelativeTime } from '@/lib/formatters';
import type { DataStatus } from '@/hooks/useEnvironmentalData';

interface KpiCardsProps {
  aqiGrid: AQIGridCell[];
  stations: CPCBStation[];
  hchoHotspots: HCHOHotspot[];
  status: DataStatus;
  isMock: boolean;
  lastUpdated: string | null;
  error: string | null;
  onRefresh: () => void;
}

interface KpiCardProps {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub: string;
  color: string;
  delay?: number;
  isLoading?: boolean;
}

function KpiCard({ icon: Icon, label, value, sub, color, delay = 0, isLoading }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="glass-sm rounded-xl p-3.5 flex flex-col gap-2 hover:border-[#38c1d6]/20 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: `${color}18`, border: `1px solid ${color}28` }}
        >
          <Icon size={13} style={{ color }} />
        </div>
        <span className="text-[9px] font-mono text-[#2e4a6a] uppercase tracking-widest">
          {label}
        </span>
      </div>

      {isLoading ? (
        <div className="h-7 skeleton rounded" />
      ) : (
        <div className="text-xl font-black leading-none" style={{ color }}>
          {value}
        </div>
      )}

      <div className="text-[9px] text-[#4a6280] leading-tight">{sub}</div>
    </motion.div>
  );
}

export default function KpiCards({
  aqiGrid,
  stations,
  hchoHotspots,
  status,
  isMock,
  lastUpdated,
  error,
  onRefresh,
}: KpiCardsProps) {
  const isLoading = status === 'loading';

  // Find worst AQI cell
  const worstCell = aqiGrid.reduce<AQIGridCell | null>((worst, cell) => {
    if (!worst) return cell;
    return (cell.pm25 > worst.pm25) ? cell : worst;
  }, null);

  const activeStations = stations.filter((s) => s.status === 'Active').length;
  const elevatedHCHO = hchoHotspots.filter(
    (h) => h.intensity === 'High' || h.intensity === 'Extreme'
  ).length;

  const worstColor = worstCell ? getCategoryColor(worstCell.category) : '#38c1d6';

  return (
    <div className="space-y-2">
      {/* Status bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          {isMock && <span className="demo-badge">DEMO DATA</span>}
          {error && (
            <div className="flex items-center gap-1">
              <AlertCircle size={10} className="text-[#f59e0b]" />
              <span className="text-[9px] text-[#f59e0b]">{error}</span>
            </div>
          )}
          {status === 'success' && !isMock && lastUpdated && (
            <span className="text-[9px] text-[#4a6280]">
              Updated {fmtRelativeTime(lastUpdated)}
            </span>
          )}
        </div>
        <button
          id="kpi-refresh-btn"
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-1 text-[9px] text-[#4a6280] hover:text-[#38c1d6] transition-colors disabled:opacity-40"
          aria-label="Refresh data"
        >
          <RefreshCw size={9} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-2">
        <KpiCard
          icon={Wind}
          label="Worst PM2.5"
          value={worstCell ? fmtPM25(worstCell.pm25) : '—'}
          sub={worstCell ? `${worstCell.regionName ?? 'Unknown'} · ${worstCell.category}` : 'No data'}
          color={worstColor}
          delay={0}
          isLoading={isLoading}
        />

        <KpiCard
          icon={TrendingUp}
          label="AQI Category"
          value={worstCell?.category ?? '—'}
          sub={worstCell ? `Model estimate · Grid cell` : 'No data'}
          color={worstColor}
          delay={0.05}
          isLoading={isLoading}
        />

        <KpiCard
          icon={Radio}
          label="CPCB Stations"
          value={isLoading ? '—' : activeStations}
          sub={`${stations.length} total · ${activeStations} active`}
          color="#10b981"
          delay={0.1}
          isLoading={isLoading}
        />

        <KpiCard
          icon={Satellite}
          label="HCHO Hotspots"
          value={isLoading ? '—' : hchoHotspots.length}
          sub={`${elevatedHCHO} elevated · Sentinel-5P`}
          color="#f59e0b"
          delay={0.15}
          isLoading={isLoading}
        />
      </div>

      {/* Data provenance note */}
      <div className="px-1">
        <p className="text-[8px] text-[#2e4a6a] leading-relaxed">
          PM2.5 values are satellite-derived model estimates. AQI categories use CPCB PM2.5
          sub-index ranges — not official multi-pollutant AQI.{' '}
          {isMock && 'All values are fictional demonstration data.'}
        </p>
      </div>
    </div>
  );
}
