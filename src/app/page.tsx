'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { LayerControls, LayerState } from '@/components/dashboard/LayerControls';
import { DetailsDrawer, SelectedEntity } from '@/components/dashboard/DetailsDrawer';
import { TransparencyModal } from '@/components/modals/TransparencyModal';
import { AQIGridCell, Station } from '@/services/api';
import {
  Sparkles,
  Info,
  Shield,
  Activity,
  Layers,
  Radio,
} from 'lucide-react';

// Dynamic import with SSR disabled to prevent window/WebGL errors during Next.js SSR
const Map = dynamic(() => import('@/components/map/Map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-400">
      <div className="relative flex items-center justify-center mb-4">
        <div className="w-16 h-16 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin" />
        <Activity className="w-6 h-6 text-cyan-400 absolute animate-pulse" />
      </div>
      <p className="text-sm font-medium tracking-wide text-slate-300">
        Initializing Aerosense AI Geospatial Engine...
      </p>
      <span className="text-xs text-slate-500 mt-1 font-mono">
        Loading Sentinel-5P TROPOMI & CAAQMS Ingestion Grids
      </span>
    </div>
  ),
});

export default function HomePage() {
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [layerVisibility, setLayerVisibility] = useState<LayerState>({
    aqi: true,
    stations: true,
    hotspots: true,
    fires: true,
  });

  const handleSelectCell = (cell: AQIGridCell) => {
    setSelectedEntity({
      type: 'grid',
      data: cell,
    });
  };

  const handleSelectStation = (station: Station) => {
    setSelectedEntity({
      type: 'station',
      data: station,
    });
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col select-none">
      {/* Top Navigation Bar */}
      <header className="absolute top-0 left-0 right-0 h-16 bg-slate-900/85 backdrop-blur-md border-b border-slate-800/80 z-20 px-6 flex items-center justify-between shadow-lg">
        {/* Brand identity */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 via-indigo-600 to-emerald-500 p-0.5 shadow-[0_0_15px_rgba(6,182,212,0.4)]">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-extrabold tracking-wider uppercase text-white font-mono">
                AEROSENSE <span className="text-cyan-400">AI</span>
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                v2.4
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Environmental Intelligence & AQI Prediction Engine &bull; India Domain
            </p>
          </div>
        </div>

        {/* Action Controls & Methodology Trigger */}
        <div className="flex items-center space-x-3">
          <div className="hidden md:flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[11px]">Backend Ingestion: Live / Synced</span>
          </div>

          <button
            onClick={() => setShowModal(true)}
            type="button"
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 hover:text-white border border-slate-700/70 shadow-md text-xs font-medium transition-all"
          >
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span>Model Methodology & Accuracy</span>
          </button>
        </div>
      </header>

      {/* Main Map View Area */}
      <div className="relative flex-1 w-full h-full pt-16">
        <Map
          onSelectCell={handleSelectCell}
          onSelectStation={handleSelectStation}
          layerVisibility={layerVisibility}
        />

        {/* Floating Layer Controls (Top Left, below navbar) */}
        <div className="relative top-3 left-0">
          <LayerControls
            layerVisibility={layerVisibility}
            setLayerVisibility={setLayerVisibility}
          />
        </div>

        {/* Side Details Drawer */}
        {selectedEntity && (
          <DetailsDrawer
            entity={selectedEntity}
            onClose={() => setSelectedEntity(null)}
          />
        )}
      </div>

      {/* Transparency Modal */}
      {showModal && <TransparencyModal onClose={() => setShowModal(false)} />}
    </main>
  );
}
