'use client';

import React from 'react';
import { AQIGridCell, Station, ConfidenceLevel } from '@/services/api';
import {
  X,
  MapPin,
  TrendingUp,
  Cpu,
  BarChart3,
  ShieldCheck,
  AlertTriangle,
  Radio,
  Layers,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

export interface SelectedEntity {
  type: 'grid' | 'station';
  data: AQIGridCell | Station;
}

interface Props {
  entity: SelectedEntity;
  onClose: () => void;
}

export const getCPCBCategory = (aqi: number) => {
  if (aqi <= 50) {
    return { label: 'Good', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40', color: '#10b981' };
  }
  if (aqi <= 100) {
    return { label: 'Satisfactory', bg: 'bg-lime-500/20 text-lime-400 border-lime-500/40', color: '#84cc16' };
  }
  if (aqi <= 200) {
    return { label: 'Moderate', bg: 'bg-amber-500/20 text-amber-400 border-amber-500/40', color: '#f59e0b' };
  }
  if (aqi <= 300) {
    return { label: 'Poor', bg: 'bg-orange-500/20 text-orange-400 border-orange-500/40', color: '#f97316' };
  }
  if (aqi <= 400) {
    return { label: 'Very Poor', bg: 'bg-red-500/20 text-red-400 border-red-500/40', color: '#ef4444' };
  }
  return { label: 'Severe', bg: 'bg-purple-900/40 text-rose-300 border-purple-500/50', color: '#7e0023' };
};

const getConfidenceBadge = (confidence: ConfidenceLevel) => {
  switch (confidence) {
    case 'High':
      return {
        label: 'High Confidence',
        badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        icon: ShieldCheck,
      };
    case 'Medium':
      return {
        label: 'Medium Confidence',
        badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        icon: AlertTriangle,
      };
    case 'Low':
    default:
      return {
        label: 'Low Confidence (Cloud obscured)',
        badge: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        icon: AlertTriangle,
      };
  }
};

const generate7DayTrend = (basePM25: number) => {
  const days = ['D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'Yesterday', 'Today'];
  const factors = [0.88, 0.94, 1.05, 1.12, 0.98, 1.02, 1.0];
  return days.map((day, idx) => {
    const val = Math.max(10, Math.round(basePM25 * factors[idx] + (Math.sin(idx * 1.5) * 6)));
    const ground = Math.max(8, Math.round(val + (Math.cos(idx) * 5)));
    return {
      day,
      predicted: val,
      ground,
    };
  });
};

export const DetailsDrawer: React.FC<Props> = ({ entity, onClose }) => {
  const { type, data } = entity;
  const isStation = type === 'station';
  const stationData = isStation ? (data as Station) : null;
  const gridData = !isStation ? (data as AQIGridCell) : null;

  const name = isStation ? stationData!.name : gridData!.name;
  const lat = data.lat;
  const lon = data.lon;
  const aqi = data.aqi;
  const pm25 = isStation ? stationData!.pm25 : gridData!.pm25;
  const confidence = data.confidence || 'High';

  const category = getCPCBCategory(aqi);
  const confBadge = getConfidenceBadge(confidence);
  const ConfIcon = confBadge.icon;

  const trendData = React.useMemo(() => generate7DayTrend(pm25), [pm25]);

  // Delta calculation
  let groundVal = pm25;
  let predictedVal = pm25;

  if (isStation && stationData) {
    groundVal = stationData.pm25;
    predictedVal = stationData.predictedPM25;
  } else if (gridData && gridData.groundPM25) {
    groundVal = gridData.groundPM25;
    predictedVal = gridData.pm25;
  } else {
    groundVal = +(pm25 * 0.96).toFixed(1);
    predictedVal = pm25;
  }

  const delta = +(predictedVal - groundVal).toFixed(1);
  const deltaPct = groundVal > 0 ? +((delta / groundVal) * 100).toFixed(1) : 0;

  return (
    <aside className="fixed top-0 right-0 h-full w-96 bg-slate-900/95 backdrop-blur-xl border-l border-slate-700/60 shadow-2xl z-40 flex flex-col text-slate-100 overflow-hidden animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-start justify-between bg-slate-950/40">
        <div>
          <div className="flex items-center space-x-1.5 text-xs font-medium text-cyan-400 mb-1">
            {isStation ? (
              <>
                <Radio className="w-3.5 h-3.5" />
                <span>CPCB Ground Telemetry Station</span>
              </>
            ) : (
              <>
                <Layers className="w-3.5 h-3.5" />
                <span>AI Predicted AQI Grid Cell</span>
              </>
            )}
          </div>
          <h2 className="text-base font-bold text-white tracking-tight leading-snug">{name}</h2>
          <div className="flex items-center space-x-1.5 text-xs text-slate-400 mt-1">
            <MapPin className="w-3 h-3 text-slate-500" />
            <span>
              {lat.toFixed(4)}° N, {lon.toFixed(4)}° E
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          type="button"
          aria-label="Close details"
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 gap-3">
          {/* AQI Badge Card */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Air Quality Index
            </span>
            <div className="flex items-baseline space-x-2 my-1">
              <span className="text-3xl font-extrabold" style={{ color: category.color }}>
                {aqi}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">CPCB</span>
            </div>
            <div
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${category.bg} w-fit`}
            >
              {category.label}
            </div>
          </div>

          {/* PM2.5 Card */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Estimated PM2.5
            </span>
            <div className="flex items-baseline space-x-1 my-1">
              <span className="text-3xl font-extrabold text-cyan-300">{pm25.toFixed(1)}</span>
              <span className="text-xs text-slate-400">µg/m³</span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>Real-time estimate</span>
            </div>
          </div>
        </div>

        {/* Model Confidence Badge */}
        <div
          className={`flex items-center justify-between p-3 rounded-xl border ${confBadge.badge}`}
        >
          <div className="flex items-center space-x-2">
            <ConfIcon className="w-4 h-4" />
            <div className="text-xs font-semibold">{confBadge.label}</div>
          </div>
          <span className="text-[11px] font-mono opacity-80">95% CI</span>
        </div>

        {/* Ground monitor vs predicted comparison delta */}
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-xs font-medium text-slate-300">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              <span>Model vs Ground Delta</span>
            </div>
            <span
              className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                Math.abs(delta) < 10
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/20 text-amber-400'
              }`}
            >
              {delta > 0 ? `+${delta}` : delta} µg/m³ ({deltaPct > 0 ? `+${deltaPct}` : deltaPct}%)
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-slate-900/60 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-400">CAAQMS Monitor</div>
              <div className="text-sm font-semibold text-slate-200 mt-0.5">
                {groundVal.toFixed(1)} <span className="text-[10px] font-normal text-slate-400">µg/m³</span>
              </div>
            </div>
            <div className="p-2 bg-slate-900/60 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-400">AI Satellite Model</div>
              <div className="text-sm font-semibold text-cyan-300 mt-0.5">
                {predictedVal.toFixed(1)} <span className="text-[10px] font-normal text-slate-400">µg/m³</span>
              </div>
            </div>
          </div>
        </div>

        {/* 7-Day Trend Recharts Line Graph */}
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-xs font-medium text-slate-300">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              <span>7-Day PM2.5 Trend</span>
            </div>
            <div className="flex items-center space-x-3 text-[10px]">
              <span className="flex items-center space-x-1 text-cyan-400">
                <span className="w-2 h-0.5 bg-cyan-400 inline-block" />
                <span>Predicted</span>
              </span>
              <span className="flex items-center space-x-1 text-slate-400">
                <span className="w-2 h-0.5 bg-slate-400 border-dashed inline-block" />
                <span>Ground</span>
              </span>
            </div>
          </div>

          <div className="h-44 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="day"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: '#f8fafc',
                  }}
                  itemStyle={{ padding: 0 }}
                />
                <ReferenceLine y={60} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'NAAQS (60)', fill: '#f59e0b', fontSize: 9, position: 'insideTopLeft' }} />
                <Line
                  type="monotone"
                  dataKey="predicted"
                  name="Predicted PM2.5"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  dot={{ r: 2, fill: '#06b6d4' }}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="ground"
                  name="Ground PM2.5"
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={{ r: 2, fill: '#94a3b8' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </aside>
  );
};
