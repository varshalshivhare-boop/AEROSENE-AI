'use client';

import React from 'react';
import { Layers, Activity, Flame, Radio, Wind } from 'lucide-react';

export interface LayerState {
  aqi: boolean;
  stations: boolean;
  hotspots: boolean;
  fires: boolean;
}

interface Props {
  layerVisibility: LayerState;
  setLayerVisibility: React.Dispatch<React.SetStateAction<LayerState>>;
}

export const LayerControls: React.FC<Props> = ({ layerVisibility, setLayerVisibility }) => {
  const toggle = (key: keyof LayerState) => {
    setLayerVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const layersConfig: {
    key: keyof LayerState;
    label: string;
    sublabel: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    badge: string;
  }[] = [
    {
      key: 'aqi',
      label: 'Predicted AQI Grid',
      sublabel: 'Sentinel-5P AI Model',
      icon: Wind,
      accentColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      badge: 'CPCB 0-500',
    },
    {
      key: 'stations',
      label: 'CPCB Ground Stations',
      sublabel: 'CAAQMS In-situ Telemetry',
      icon: Radio,
      accentColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
      badge: 'Live',
    },
    {
      key: 'hotspots',
      label: 'HCHO Hotspots',
      sublabel: 'Tropospheric Formaldehyde',
      icon: Activity,
      accentColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      badge: 'VOC Gas',
    },
    {
      key: 'fires',
      label: 'Active Biomass Fires',
      sublabel: 'VIIRS / MODIS Detection',
      icon: Flame,
      accentColor: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
      badge: 'FRP MW',
    },
  ];

  return (
    <div className="absolute top-5 left-5 w-72 bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-700/60 p-3.5 shadow-2xl z-20 transition-all select-none">
      <div className="flex items-center justify-between pb-3 mb-2.5 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            Intelligence Layers
          </h3>
        </div>
        <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full font-mono">
          4 Feeds
        </span>
      </div>

      <div className="space-y-2">
        {layersConfig.map(({ key, label, sublabel, icon: Icon, accentColor, badge }) => {
          const isActive = layerVisibility[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className={`w-full flex items-center justify-between p-2 rounded-lg border text-left transition-all ${
                isActive
                  ? `${accentColor} shadow-sm`
                  : 'bg-slate-800/40 border-slate-800 text-slate-500 hover:bg-slate-800/70 hover:text-slate-400'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <div
                  className={`p-1.5 rounded-md ${
                    isActive ? 'bg-slate-900/80' : 'bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-100">{label}</div>
                  <div className="text-[10px] text-slate-400">{sublabel}</div>
                </div>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900/60 text-slate-300 font-mono">
                  {badge}
                </span>
                <span
                  className={`w-2 h-2 rounded-full transition-all ${
                    isActive ? 'bg-current shadow-[0_0_8px_currentColor]' : 'bg-slate-700'
                  }`}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
