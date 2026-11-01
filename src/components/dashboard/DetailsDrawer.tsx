'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  MapPin,
  Activity,
  Clock,
  Info,
  TrendingUp,
  Satellite,
  Radio,
  Wind,
  BarChart2,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { SelectedFeature, TrendDataPoint } from '@/types/environment';
import { fmtPM25, fmtTimestamp, fmtCoords, fmtRelativeTime } from '@/lib/formatters';
import { getCategoryColor, getBreakpoint } from '@/lib/aqi';

interface DetailsDrawerProps {
  feature: SelectedFeature;
  trend: TrendDataPoint[];
  isMockData: boolean;
  onClose: () => void;
}

const CATEGORY_CSS: Record<string, string> = {
  Good: 'cat-good',
  Satisfactory: 'cat-satisfactory',
  Moderate: 'cat-moderate',
  Poor: 'cat-poor',
  'Very Poor': 'cat-very-poor',
  Severe: 'cat-severe',
  Unknown: 'cat-unknown',
};

function TrendChart({
  trend,
  isMock,
}: {
  trend: TrendDataPoint[];
  isMock: boolean;
}) {
  if (!trend || trend.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-[#4a6280] text-sm">
        Historical trend data unavailable.
      </div>
    );
  }

  const hasObserved = trend.some((d) => d.observed != null);
  const hasPredicted = trend.some((d) => d.predicted != null);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-[#8ba8cc]">7-Day PM2.5 Trend</span>
        {isMock && <span className="demo-badge">DEMO DATA</span>}
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={trend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,193,214,0.08)" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#4a6280', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis
            tick={{ fill: '#4a6280', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
            tickLine={false}
            axisLine={false}
            unit=" µg"
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(7,20,40,0.95)',
              border: '1px solid rgba(56,193,214,0.2)',
              borderRadius: '8px',
              color: '#e2eeff',
              fontSize: '11px',
            }}
            formatter={(val: unknown, name?: unknown) => [
              typeof val === 'number' ? `${val.toFixed(1)} µg/m³` : '—',
              String(name ?? ''),
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: '10px', color: '#8ba8cc', paddingTop: '4px' }}
          />
          {hasObserved && (
            <Line
              type="monotone"
              dataKey="observed"
              name="Observed"
              stroke="#38c1d6"
              strokeWidth={1.5}
              dot={{ r: 2, fill: '#38c1d6' }}
              connectNulls={false}
            />
          )}
          {hasPredicted && (
            <Line
              type="monotone"
              dataKey="predicted"
              name="Predicted"
              stroke="#f59e0b"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              dot={{ r: 2, fill: '#f59e0b' }}
              connectNulls={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      <p className="text-[9px] text-[#4a6280] mt-1 leading-relaxed">
        Observed values from CPCB measurements; predicted from satellite-derived model estimate.
        {isMock && ' Fictional demonstration trend — not verified data.'}
      </p>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-[#38c1d6]/06">
      <div className="flex items-center gap-2 min-w-0">
        <Icon size={12} className="text-[#4a6280] shrink-0" />
        <span className="text-xs text-[#4a6280]">{label}</span>
      </div>
      <span className={`text-xs font-mono text-right ${valueClass ?? 'text-[#e2eeff]'}`}>
        {value}
      </span>
    </div>
  );
}

export default function DetailsDrawer({
  feature,
  trend,
  isMockData,
  onClose,
}: DetailsDrawerProps) {
  return (
    <AnimatePresence>
      {feature && (
        <>
          {/* Mobile backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-30 lg:hidden"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.aside
            key="drawer"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-sm z-40 flex flex-col
                       glass border-l border-[#38c1d6]/15 overflow-hidden
                       shadow-[0_0_60px_rgba(0,0,0,0.6)]"
            role="dialog"
            aria-label="Feature details"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#38c1d6]/12">
              <div className="flex items-center gap-2">
                {feature.type === 'aqiCell' && <Wind size={14} className="text-[#38c1d6]" />}
                {feature.type === 'station' && <Radio size={14} className="text-[#10b981]" />}
                {feature.type === 'hcho' && <Satellite size={14} className="text-[#f59e0b]" />}
                {feature.type === 'fire' && <Activity size={14} className="text-[#f97316]" />}
                <span className="text-sm font-bold text-[#e2eeff]">
                  {feature.type === 'aqiCell' && 'AQI Grid Cell'}
                  {feature.type === 'station' && 'CPCB Station'}
                  {feature.type === 'hcho' && 'HCHO Hotspot'}
                  {feature.type === 'fire' && 'Fire Detection'}
                </span>
                {isMockData && <span className="demo-badge ml-1">DEMO</span>}
              </div>
              <button
                id="details-drawer-close"
                onClick={onClose}
                className="p-1.5 rounded-lg text-[#4a6280] hover:text-[#e2eeff] hover:bg-[#38c1d6]/10 transition-colors"
                aria-label="Close details"
              >
                <X size={14} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">

              {/* ---- AQI Grid Cell ---- */}
              {feature.type === 'aqiCell' && (() => {
                const d = feature.data;
                const bp = getBreakpoint(d.category);
                const catColor = getCategoryColor(d.category);
                return (
                  <>
                    {/* Category badge */}
                    <div
                      className="flex items-center justify-between p-3 rounded-xl"
                      style={{ background: `${catColor}18`, border: `1px solid ${catColor}30` }}
                    >
                      <div>
                        <div className="text-xs text-[#8ba8cc] mb-0.5">AQI Category</div>
                        <div className="text-xl font-black" style={{ color: catColor }}>
                          {d.category}
                        </div>
                        {d.aqi && (
                          <div className="text-xs font-mono text-[#8ba8cc] mt-0.5">
                            AQI Sub-index: {d.aqi}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-[#8ba8cc] mb-0.5">PM2.5</div>
                        <div className="text-2xl font-bold" style={{ color: catColor }}>
                          {d.pm25.toFixed(1)}
                        </div>
                        <div className="text-xs text-[#4a6280]">µg/m³</div>
                      </div>
                    </div>

                    {bp && (
                      <p className="text-[10px] text-[#4a6280] leading-relaxed">
                        {bp.description}
                      </p>
                    )}

                    {/* Detail rows */}
                    <div>
                      {d.regionName && (
                        <Row icon={MapPin} label="Region" value={d.regionName} />
                      )}
                      <Row
                        icon={MapPin}
                        label="Coordinates"
                        value={fmtCoords(d.lat, d.lng)}
                        valueClass="text-[#8ba8cc] text-[10px]"
                      />
                      <Row
                        icon={Info}
                        label="Data Type"
                        value={d.dataType.replace(/_/g, ' ')}
                        valueClass="capitalize text-[#38c1d6]"
                      />
                      {d.confidence && (
                        <Row
                          icon={BarChart2}
                          label="Model Confidence"
                          value={d.confidence}
                          valueClass={
                            d.confidence === 'High'
                              ? 'text-[#22c55e]'
                              : d.confidence === 'Medium'
                              ? 'text-[#fbbf24]'
                              : 'text-[#f97316]'
                          }
                        />
                      )}
                      <Row
                        icon={Clock}
                        label="Timestamp"
                        value={fmtTimestamp(d.timestamp)}
                        valueClass="text-[#8ba8cc] text-[10px]"
                      />
                    </div>

                    {/* Disclaimer */}
                    <div className="p-3 rounded-lg bg-[#38c1d6]/05 border border-[#38c1d6]/12">
                      <div className="flex items-start gap-2">
                        <Info size={11} className="text-[#38c1d6] mt-0.5 shrink-0" />
                        <p className="text-[9px] text-[#4a6280] leading-relaxed">
                          This is a <strong className="text-[#8ba8cc]">model estimate</strong> derived
                          from satellite observations. PM2.5 concentration is not the same as AQI.
                          Decision-support estimate; complements, not replaces, ground station readings.
                        </p>
                      </div>
                    </div>

                    {/* Trend chart */}
                    <TrendChart trend={trend} isMock={isMockData} />
                  </>
                );
              })()}

              {/* ---- CPCB Station ---- */}
              {feature.type === 'station' && (() => {
                const d = feature.data;
                const catColor = d.category ? getCategoryColor(d.category) : '#10b981';
                return (
                  <>
                    <div
                      className="p-3 rounded-xl"
                      style={{ background: `${catColor}14`, border: `1px solid ${catColor}28` }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-[#10b981]" />
                        <span className="text-xs font-bold text-[#e2eeff]">{d.name}</span>
                      </div>
                      <div className="text-[10px] text-[#8ba8cc]">
                        {d.city}, {d.state}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <div
                          className="text-[9px] px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: `${catColor}25`, color: catColor }}
                        >
                          {d.status}
                        </div>
                        {d.category && (
                          <div
                            className="text-[9px] px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: `${catColor}25`, color: catColor }}
                          >
                            {d.category}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Pollutant readings */}
                    <div className="grid grid-cols-2 gap-2">
                      {d.pm25 != null && (
                        <div className="glass-sm p-2 rounded-lg text-center">
                          <div className="text-lg font-bold" style={{ color: catColor }}>
                            {d.pm25.toFixed(0)}
                          </div>
                          <div className="text-[9px] text-[#4a6280]">PM2.5 µg/m³</div>
                        </div>
                      )}
                      {d.pm10 != null && (
                        <div className="glass-sm p-2 rounded-lg text-center">
                          <div className="text-lg font-bold text-[#7dd3fc]">
                            {d.pm10.toFixed(0)}
                          </div>
                          <div className="text-[9px] text-[#4a6280]">PM10 µg/m³</div>
                        </div>
                      )}
                      {d.no2 != null && (
                        <div className="glass-sm p-2 rounded-lg text-center">
                          <div className="text-lg font-bold text-[#a78bfa]">
                            {d.no2.toFixed(0)}
                          </div>
                          <div className="text-[9px] text-[#4a6280]">NO₂ µg/m³</div>
                        </div>
                      )}
                      {d.aqi != null && (
                        <div className="glass-sm p-2 rounded-lg text-center">
                          <div className="text-lg font-bold text-[#f97316]">
                            {d.aqi}
                          </div>
                          <div className="text-[9px] text-[#4a6280]">AQI</div>
                        </div>
                      )}
                    </div>

                    <div>
                      <Row
                        icon={MapPin}
                        label="Coordinates"
                        value={fmtCoords(d.lat, d.lng)}
                        valueClass="text-[#8ba8cc] text-[10px]"
                      />
                      <Row
                        icon={Clock}
                        label="Last Updated"
                        value={fmtRelativeTime(d.lastUpdated)}
                        valueClass="text-[#8ba8cc]"
                      />
                      <Row
                        icon={Activity}
                        label="Pollutants"
                        value={d.pollutants.join(', ')}
                        valueClass="text-[#8ba8cc] text-[10px]"
                      />
                    </div>

                    <div className="p-3 rounded-lg bg-[#10b981]/05 border border-[#10b981]/15">
                      <div className="flex items-start gap-2">
                        <Info size={11} className="text-[#10b981] mt-0.5 shrink-0" />
                        <p className="text-[9px] text-[#4a6280] leading-relaxed">
                          Ground measurements from the <strong className="text-[#8ba8cc]">CPCB
                          monitoring network</strong>. These are direct sensor readings, distinct
                          from model estimates. AQI values are computed from multiple pollutants.
                        </p>
                      </div>
                    </div>

                    <TrendChart trend={trend} isMock={isMockData} />
                  </>
                );
              })()}

              {/* ---- HCHO Hotspot ---- */}
              {feature.type === 'hcho' && (() => {
                const d = feature.data;
                const intensityColor =
                  d.intensity === 'Extreme' ? '#ef4444'
                  : d.intensity === 'High' ? '#f97316'
                  : '#f59e0b';
                return (
                  <>
                    <div
                      className="p-3 rounded-xl"
                      style={{ background: `${intensityColor}14`, border: `1px solid ${intensityColor}28` }}
                    >
                      <div className="text-xs text-[#8ba8cc] mb-1">HCHO Column Density</div>
                      <div className="flex items-end gap-2">
                        <span className="text-3xl font-black" style={{ color: intensityColor }}>
                          {d.hchoColumnDU.toFixed(1)}
                        </span>
                        <span className="text-sm text-[#8ba8cc] mb-1">× 10⁻⁴ mol/m²</span>
                      </div>
                      <div
                        className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[9px] font-semibold"
                        style={{ background: `${intensityColor}22`, color: intensityColor }}
                      >
                        {d.intensity} HCHO
                      </div>
                    </div>

                    <div>
                      {d.regionName && <Row icon={MapPin} label="Region" value={d.regionName} />}
                      <Row
                        icon={MapPin}
                        label="Coordinates"
                        value={fmtCoords(d.lat, d.lng)}
                        valueClass="text-[#8ba8cc] text-[10px]"
                      />
                      <Row icon={Satellite} label="Satellite" value={d.satellite} valueClass="text-[#38c1d6]" />
                      <Row icon={Activity} label="Instrument" value={d.instrument} valueClass="text-[#38c1d6]" />
                      <Row
                        icon={Clock}
                        label="Observation"
                        value={fmtTimestamp(d.observationTime)}
                        valueClass="text-[#8ba8cc] text-[10px]"
                      />
                    </div>

                    <div className="p-3 rounded-lg bg-[#f59e0b]/06 border border-[#f59e0b]/18">
                      <div className="flex items-start gap-2">
                        <Info size={11} className="text-[#f59e0b] mt-0.5 shrink-0" />
                        <p className="text-[9px] text-[#4a6280] leading-relaxed">
                          HCHO (formaldehyde) is a <strong className="text-[#8ba8cc]">satellite-observed
                          atmospheric indicator</strong> of volatile organic compound (VOC) emissions.
                          An elevated HCHO column does not, by itself, prove a specific pollution source
                          or identify a specific facility. Ground verification is required.
                          {d.note && <> {d.note}</>}
                        </p>
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* ---- Fire Detection ---- */}
              {feature.type === 'fire' && (() => {
                const d = feature.data;
                const confColor =
                  d.confidence === 'high' ? '#ef4444'
                  : d.confidence === 'nominal' ? '#f97316'
                  : '#fbbf24';
                return (
                  <>
                    <div className="p-3 rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/25">
                      <div className="text-xs text-[#8ba8cc] mb-1">Fire Detection</div>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-lg font-bold text-[#f97316]">
                            {d.brightness.toFixed(1)} K
                          </div>
                          <div className="text-[9px] text-[#4a6280]">Brightness Temp.</div>
                        </div>
                        {d.frp != null && (
                          <div className="text-right">
                            <div className="text-lg font-bold text-[#ef4444]">
                              {d.frp.toFixed(1)}
                            </div>
                            <div className="text-[9px] text-[#4a6280]">FRP (MW)</div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      {d.regionName && <Row icon={MapPin} label="Region" value={d.regionName} />}
                      <Row
                        icon={MapPin}
                        label="Coordinates"
                        value={fmtCoords(d.lat, d.lng)}
                        valueClass="text-[#8ba8cc] text-[10px]"
                      />
                      <Row icon={Satellite} label="Satellite" value={d.satellite} valueClass="text-[#38c1d6]" />
                      <Row
                        icon={Clock}
                        label="Date"
                        value={`${d.acqDate} ${d.acqTime.slice(0, 2)}:${d.acqTime.slice(2)} UTC`}
                        valueClass="text-[#8ba8cc] text-[10px]"
                      />
                      <Row
                        icon={Activity}
                        label="Confidence"
                        value={d.confidence}
                        valueClass={`capitalize font-semibold`}
                      />
                      <Row
                        icon={TrendingUp}
                        label="Day/Night"
                        value={d.daynight === 'D' ? 'Daytime' : 'Nighttime'}
                      />
                    </div>

                    <div className="p-3 rounded-lg bg-[#f97316]/06 border border-[#f97316]/18">
                      <div className="flex items-start gap-2">
                        <Info size={11} className="text-[#f97316] mt-0.5 shrink-0" />
                        <p className="text-[9px] text-[#4a6280] leading-relaxed">
                          NASA FIRMS fire detection. A fire detection does not, by itself, confirm
                          the cause of nearby HCHO or PM2.5 elevations. Confidence level indicates
                          sensor reliability — low confidence detections may include false positives.
                        </p>
                      </div>
                    </div>
                  </>
                );
              })()}

            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
