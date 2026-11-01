'use client';

import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { Wind, Brain, Menu, X, RefreshCw } from 'lucide-react';
import type { SelectedFeature } from '@/types/environment';
import type { LayerKey } from '@/types/environment';
import { useEnvironmentalData } from '@/hooks/useEnvironmentalData';
import { useMapLayers } from '@/hooks/useMapLayers';
import LayerControls from '@/components/dashboard/LayerControls';
import DetailsDrawer from '@/components/dashboard/DetailsDrawer';
import KpiCards from '@/components/dashboard/KpiCards';
import HotspotList from '@/components/dashboard/HotspotList';
import MapLegend from '@/components/map/MapLegend';
import TransparencyModal from '@/components/modals/TransparencyModal';
import { fmtRelativeTime } from '@/lib/formatters';

// Dynamic import of map to avoid SSR issues
const IndiaMap = dynamic(() => import('@/components/map/IndiaMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#030e1c]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#38c1d6]/30 border-t-[#38c1d6] rounded-full animate-spin" />
        <span className="text-xs font-mono text-[#4a6280]">Loading map…</span>
      </div>
    </div>
  ),
});

const NAV_ITEMS = ['Dashboard', 'Air Map', 'Hotspots', 'Analytics', 'Methodology'];

interface DashboardShellProps {
  onBack?: () => void;
}

export default function DashboardShell({ onBack }: DashboardShellProps) {
  const [selectedFeature, setSelectedFeature] = useState<SelectedFeature>(null);
  const [activeNav, setActiveNav] = useState('Dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [methodologyOpen, setMethodologyOpen] = useState(false);

  const {
    aqiGrid,
    stations,
    hchoHotspots,
    fires,
    trend,
    status,
    error,
    isMock,
    lastUpdated,
    refresh,
    loadTrend,
  } = useEnvironmentalData();

  const { layers, toggleLayer } = useMapLayers();

  const handleFeatureSelect = useCallback(
    async (feature: SelectedFeature) => {
      setSelectedFeature(feature);
      if (feature) {
        await loadTrend(feature.data.id);
      }
    },
    [loadTrend]
  );

  const handleDrawerClose = useCallback(() => {
    setSelectedFeature(null);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[#020b18] overflow-hidden">
      {/* ============================================================
          Top Navigation
      ============================================================ */}
      <header className="shrink-0 flex items-center justify-between px-4 lg:px-6 py-2.5 border-b border-[#38c1d6]/10 z-20">
        {/* Brand */}
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="mr-2 text-[#4a6280] hover:text-[#38c1d6] transition-colors"
              aria-label="Back to hero"
            >
              ←
            </button>
          )}
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#38c1d6] to-[#10b981] flex items-center justify-center">
            <Wind size={12} className="text-[#020b18]" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-bold tracking-wide text-[#e2eeff]">AEROSENSE</span>
          <span className="text-xs font-mono text-[#38c1d6]">AI</span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-1" role="navigation" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <button
              key={item}
              id={`nav-${item.toLowerCase().replace(' ', '-')}`}
              onClick={() => {
                if (item === 'Methodology') {
                  setMethodologyOpen(true);
                } else {
                  setActiveNav(item);
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                activeNav === item
                  ? 'bg-[#38c1d6]/12 text-[#38c1d6] border border-[#38c1d6]/20'
                  : 'text-[#4a6280] hover:text-[#8ba8cc] hover:bg-[#38c1d6]/05'
              }`}
            >
              {item}
            </button>
          ))}
        </nav>

        {/* Right: Status + Mobile menu */}
        <div className="flex items-center gap-3">
          {/* Data status */}
          <div className="hidden sm:flex items-center gap-2">
            {isMock && (
              <span className="demo-badge">DEMO DATA</span>
            )}
            <div className="flex items-center gap-1.5">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: status === 'success' ? '#10b981'
                    : status === 'loading' ? '#38c1d6'
                    : status === 'offline' ? '#f59e0b'
                    : '#ef4444',
                  boxShadow: `0 0 4px ${
                    status === 'success' ? '#10b981'
                    : status === 'loading' ? '#38c1d6'
                    : '#f59e0b'
                  }60`,
                }}
              />
              <span className="text-[9px] font-mono text-[#4a6280]">
                {status === 'loading' ? 'Loading…'
                  : status === 'offline' ? 'Offline'
                  : status === 'success' ? (lastUpdated ? fmtRelativeTime(lastUpdated) : 'Live')
                  : 'Error'}
              </span>
            </div>
          </div>

          {/* Refresh */}
          <button
            id="dashboard-refresh-btn"
            onClick={refresh}
            disabled={status === 'loading'}
            className="p-1.5 rounded-lg text-[#4a6280] hover:text-[#38c1d6] hover:bg-[#38c1d6]/10 transition-colors disabled:opacity-40"
            aria-label="Refresh data"
          >
            <RefreshCw size={12} className={status === 'loading' ? 'animate-spin' : ''} />
          </button>

          {/* Methodology button */}
          <button
            id="nav-methodology-btn"
            onClick={() => setMethodologyOpen(true)}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                       glass border-[#38c1d6]/15 text-[#38c1d6] hover:border-[#38c1d6]/30
                       transition-all duration-150"
            aria-label="Open model methodology"
          >
            <Brain size={11} />
            Methodology
          </button>

          {/* Mobile menu toggle */}
          <button
            id="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1.5 rounded-lg text-[#4a6280] hover:text-[#e2eeff] transition-colors"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </header>

      {/* Mobile nav drawer */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:hidden border-b border-[#38c1d6]/10 px-4 py-3 z-20 bg-[#030e1c]"
        >
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item}
                onClick={() => {
                  if (item === 'Methodology') setMethodologyOpen(true);
                  else setActiveNav(item);
                  setMobileMenuOpen(false);
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium text-left transition-all ${
                  activeNav === item
                    ? 'bg-[#38c1d6]/12 text-[#38c1d6]'
                    : 'text-[#4a6280] hover:text-[#8ba8cc]'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* ============================================================
          Main content
      ============================================================ */}
      <div className="flex-1 flex overflow-hidden">

        {/* ---- Left sidebar ---- */}
        <aside className="hidden xl:flex flex-col w-72 shrink-0 border-r border-[#38c1d6]/08 overflow-y-auto p-4 gap-5">
          <KpiCards
            aqiGrid={aqiGrid}
            stations={stations}
            hchoHotspots={hchoHotspots}
            status={status}
            isMock={isMock}
            lastUpdated={lastUpdated}
            error={error}
            onRefresh={refresh}
          />
          <div className="border-t border-[#38c1d6]/08" />
          <HotspotList
            hchoHotspots={hchoHotspots}
            stations={stations}
            aqiGrid={aqiGrid}
            onSelect={handleFeatureSelect}
            isMock={isMock}
          />
        </aside>

        {/* ---- Map area ---- */}
        <div className="flex-1 relative overflow-hidden">
          <IndiaMap
            aqiGrid={aqiGrid}
            stations={stations}
            hchoHotspots={hchoHotspots}
            fires={fires}
            layers={layers}
            onFeatureSelect={handleFeatureSelect}
            isMock={isMock}
          />

          {/* Floating layer controls — top left */}
          <div className="absolute top-4 left-4 z-10">
            <LayerControls layers={layers} onToggle={toggleLayer as (key: LayerKey) => void} />
          </div>

          {/* Map legend — bottom left */}
          <div className="absolute bottom-12 left-4 z-10">
            <MapLegend layers={layers} />
          </div>

          {/* Demo badge — bottom center */}
          {isMock && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
              <span className="demo-badge shadow-lg">⚠ Demo Data — Not Real Measurements</span>
            </div>
          )}

          {/* Mobile KPI strip — only on smaller screens */}
          <div className="xl:hidden absolute top-4 right-4 z-10 max-w-[200px]">
            <div className="glass-sm rounded-xl p-3 space-y-1.5">
              {isMock && <span className="demo-badge">DEMO</span>}
              <div className="text-[9px] font-mono text-[#4a6280]">
                Stations: <span className="text-[#10b981]">{stations.length}</span>
              </div>
              <div className="text-[9px] font-mono text-[#4a6280]">
                HCHO: <span className="text-[#f59e0b]">{hchoHotspots.length}</span>
              </div>
              <div className="text-[9px] font-mono text-[#4a6280]">
                Grid cells: <span className="text-[#38c1d6]">{aqiGrid.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Details drawer (right) */}
        <DetailsDrawer
          feature={selectedFeature}
          trend={trend}
          isMockData={isMock}
          onClose={handleDrawerClose}
        />
      </div>

      {/* Transparency modal */}
      <TransparencyModal isOpen={methodologyOpen} onClose={() => setMethodologyOpen(false)} />
    </div>
  );
}
