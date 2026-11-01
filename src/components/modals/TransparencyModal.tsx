'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BarChart2, Database, Brain, Shield, AlertCircle, RefreshCw, Info } from 'lucide-react';
import type { ModelMetrics } from '@/types/environment';
import { fetchModelMetrics, ApiClientError } from '@/services/api';
import { fmtMetric, fmtTimestamp } from '@/lib/formatters';

interface TransparencyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type MetricStatus = 'idle' | 'loading' | 'success' | 'offline' | 'error';

function MetricCard({
  label,
  value,
  unit,
  description,
  isLoading,
  isUnavailable,
}: {
  label: string;
  value: string;
  unit?: string;
  description: string;
  isLoading: boolean;
  isUnavailable: boolean;
}) {
  return (
    <div className="glass-sm p-4 rounded-xl">
      <div className="text-[9px] font-mono text-[#4a6280] uppercase tracking-widest mb-2">{label}</div>
      {isLoading ? (
        <div className="h-8 skeleton rounded mb-1" />
      ) : isUnavailable ? (
        <div className="text-lg font-bold text-[#4a6280]">Unavailable</div>
      ) : (
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-black text-gradient-cyan">{value}</span>
          {unit && <span className="text-xs text-[#8ba8cc]">{unit}</span>}
        </div>
      )}
      <p className="text-[10px] text-[#4a6280] mt-1.5 leading-relaxed">{description}</p>
    </div>
  );
}

const DATA_INPUTS = [
  {
    name: 'MODIS AOD',
    desc: 'Aerosol Optical Depth from NASA Terra/Aqua satellites.',
    status: 'integrated',
  },
  {
    name: 'Sentinel-5P TROPOMI HCHO',
    desc: 'Formaldehyde column from Copernicus satellite.',
    status: 'integrated',
  },
  {
    name: 'ERA5 Meteorology',
    desc: 'ECMWF reanalysis — wind speed, humidity, boundary layer height, temperature.',
    status: 'integrated',
  },
  {
    name: 'CPCB Ground Measurements',
    desc: 'PM2.5 / PM10 / NO₂ from the national monitoring network used as validation.',
    status: 'integrated',
  },
  {
    name: 'NASA FIRMS Fire Detections',
    desc: 'MODIS & VIIRS active fire detections used as an auxiliary input.',
    status: 'integrated',
  },
  {
    name: 'INSAT-3D',
    desc: 'Indian geostationary satellite data for cloud and radiation fields.',
    status: 'planned',
  },
];

export default function TransparencyModal({ isOpen, onClose }: TransparencyModalProps) {
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [metricStatus, setMetricStatus] = useState<MetricStatus>('idle');
  const [metricError, setMetricError] = useState<string | null>(null);

  const loadMetrics = async () => {
    setMetricStatus('loading');
    setMetricError(null);
    try {
      const data = await fetchModelMetrics();
      setMetrics(data);
      setMetricStatus('success');
    } catch (err) {
      const isOffline = err instanceof ApiClientError && err.isOffline;
      setMetricStatus(isOffline ? 'offline' : 'error');
      setMetricError(
        isOffline
          ? 'Model metrics are unavailable while the backend is offline.'
          : `Failed to fetch metrics: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  };

  useEffect(() => {
    if (isOpen && metricStatus === 'idle') {
      loadMetrics();
    }
  }, [isOpen]);

  const isLoading = metricStatus === 'loading';
  const isUnavailable = metricStatus === 'offline' || metricStatus === 'error' || !metrics;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="modal-content"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            className="fixed inset-4 md:inset-8 lg:inset-16 z-50 glass rounded-2xl overflow-hidden flex flex-col
                       shadow-[0_0_80px_rgba(0,0,0,0.8)]"
            role="dialog"
            aria-modal="true"
            aria-label="Model Methodology & Accuracy"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#38c1d6]/12">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#38c1d6]/15 border border-[#38c1d6]/25 flex items-center justify-center">
                  <Brain size={15} className="text-[#38c1d6]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#e2eeff]">Model Methodology & Accuracy</h2>
                  <p className="text-[10px] text-[#4a6280] font-mono">
                    GET /api/v1/model/metrics
                  </p>
                </div>
              </div>
              <button
                id="transparency-modal-close"
                onClick={onClose}
                className="p-1.5 rounded-lg text-[#4a6280] hover:text-[#e2eeff] hover:bg-[#38c1d6]/10 transition-colors"
                aria-label="Close modal"
              >
                <X size={15} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">

              {/* ---- Disclaimer banner ---- */}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-[#f59e0b]/08 border border-[#f59e0b]/20">
                <Shield size={14} className="text-[#f59e0b] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-[#f59e0b] mb-1">
                    Decision-support estimate; complements ground stations.
                  </p>
                  <p className="text-[10px] text-[#8ba8cc] leading-relaxed">
                    Satellite observations, model predictions, and ground measurements are different
                    evidence types and should not be treated as interchangeable. Model output
                    should be used alongside, not instead of, verified ground measurements.
                  </p>
                </div>
              </div>

              {/* ---- Metrics section ---- */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-[#e2eeff] flex items-center gap-2">
                    <BarChart2 size={13} className="text-[#38c1d6]" />
                    Validation Metrics
                  </h3>
                  <button
                    id="metrics-retry-btn"
                    onClick={loadMetrics}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 text-[9px] font-mono text-[#4a6280] hover:text-[#38c1d6] transition-colors disabled:opacity-40"
                    aria-label="Retry metrics fetch"
                  >
                    <RefreshCw size={9} className={isLoading ? 'animate-spin' : ''} />
                    {isLoading ? 'Loading…' : 'Retry'}
                  </button>
                </div>

                {/* Error / offline message */}
                {(metricStatus === 'offline' || metricStatus === 'error') && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-[#ef4444]/08 border border-[#ef4444]/18 mb-3">
                    <AlertCircle size={11} className="text-[#ef4444] mt-0.5 shrink-0" />
                    <p className="text-[10px] text-[#8ba8cc] leading-relaxed">{metricError}</p>
                  </div>
                )}

                {/* Model name */}
                {metricStatus === 'success' && metrics && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] text-[#4a6280]">Model:</span>
                    <span className="text-[10px] font-mono text-[#38c1d6]">{metrics.modelName}</span>
                    {metrics.lastUpdated && (
                      <span className="text-[9px] text-[#2e4a6a] ml-2">
                        Last updated: {fmtTimestamp(metrics.lastUpdated)}
                      </span>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <MetricCard
                    label="MAE"
                    value={fmtMetric(metrics?.mae, 'mae')}
                    unit="µg/m³"
                    description="Mean Absolute Error — average magnitude of prediction error. Lower is better."
                    isLoading={isLoading}
                    isUnavailable={isUnavailable}
                  />
                  <MetricCard
                    label="RMSE"
                    value={fmtMetric(metrics?.rmse, 'rmse')}
                    unit="µg/m³"
                    description="Root Mean Square Error — penalizes large errors more heavily than MAE."
                    isLoading={isLoading}
                    isUnavailable={isUnavailable}
                  />
                  <MetricCard
                    label="R²"
                    value={fmtMetric(metrics?.r2, 'r2')}
                    description="Coefficient of determination — proportion of variance explained. 1.0 is perfect."
                    isLoading={isLoading}
                    isUnavailable={isUnavailable}
                  />
                </div>

                {/* Evaluation details */}
                {metricStatus === 'success' && metrics && (
                  <div className="mt-3 p-3 rounded-lg bg-[#38c1d6]/05 border border-[#38c1d6]/10">
                    <div className="grid grid-cols-2 gap-2">
                      {metrics.evaluationPeriod && (
                        <div>
                          <div className="text-[9px] text-[#4a6280]">Evaluation Period</div>
                          <div className="text-[10px] font-mono text-[#8ba8cc]">{metrics.evaluationPeriod}</div>
                        </div>
                      )}
                      {metrics.sampleCount && (
                        <div>
                          <div className="text-[9px] text-[#4a6280]">Sample Count</div>
                          <div className="text-[10px] font-mono text-[#8ba8cc]">{metrics.sampleCount.toLocaleString()}</div>
                        </div>
                      )}
                    </div>
                    {metrics.validationNote && (
                      <p className="text-[9px] text-[#4a6280] mt-2 leading-relaxed">{metrics.validationNote}</p>
                    )}
                  </div>
                )}

                <div className="mt-3 flex items-start gap-2">
                  <Info size={10} className="text-[#4a6280] mt-0.5 shrink-0" />
                  <p className="text-[9px] text-[#2e4a6a] leading-relaxed">
                    Metrics are computed on held-out dates and locations not seen during training,
                    to give an honest estimate of generalization performance.
                    Held-out evaluation is important because in-sample performance is optimistic.
                  </p>
                </div>
              </div>

              {/* ---- Data Inputs ---- */}
              <div>
                <h3 className="text-sm font-bold text-[#e2eeff] flex items-center gap-2 mb-3">
                  <Database size={13} className="text-[#38c1d6]" />
                  Data Inputs
                </h3>
                <div className="space-y-2">
                  {DATA_INPUTS.map((input) => (
                    <div
                      key={input.name}
                      className="flex items-start gap-3 p-3 rounded-lg"
                      style={{
                        background: input.status === 'integrated'
                          ? 'rgba(16,185,129,0.04)'
                          : 'rgba(245,158,11,0.04)',
                        border: input.status === 'integrated'
                          ? '1px solid rgba(16,185,129,0.12)'
                          : '1px solid rgba(245,158,11,0.12)',
                      }}
                    >
                      <div
                        className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                        style={{ background: input.status === 'integrated' ? '#10b981' : '#f59e0b' }}
                      />
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-[#e2eeff]">{input.name}</span>
                          <span
                            className="text-[8px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide"
                            style={{
                              background: input.status === 'integrated'
                                ? 'rgba(16,185,129,0.15)'
                                : 'rgba(245,158,11,0.15)',
                              color: input.status === 'integrated' ? '#10b981' : '#f59e0b',
                            }}
                          >
                            {input.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#4a6280] leading-relaxed">{input.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ---- Model Approach ---- */}
              <div>
                <h3 className="text-sm font-bold text-[#e2eeff] flex items-center gap-2 mb-3">
                  <Brain size={13} className="text-[#38c1d6]" />
                  Model Approach
                </h3>
                <div className="space-y-3 text-[11px] text-[#8ba8cc] leading-relaxed">
                  <p>
                    The PM2.5 surface concentration prediction pipeline aligns multi-source satellite
                    and meteorological data to CPCB ground station measurements across India.
                  </p>
                  <p>
                    Features are extracted from co-registered satellite retrievals (AOD, HCHO),
                    meteorological fields (ERA5), and contextual indicators. A machine-learning
                    regressor is trained on matched satellite–ground pairs with temporal and
                    spatial cross-validation to avoid data leakage.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {['XGBoost', 'Random Forest', 'LightGBM'].map((m) => (
                      <span
                        key={m}
                        className="text-[9px] px-2 py-0.5 rounded-full font-mono"
                        style={{
                          background: 'rgba(56,193,214,0.08)',
                          border: '1px solid rgba(56,193,214,0.15)',
                          color: '#38c1d6',
                        }}
                      >
                        {m}
                      </span>
                    ))}
                    <span className="text-[9px] text-[#4a6280] self-center">(model family — see backend for deployed variant)</span>
                  </div>
                </div>
              </div>

              {/* ---- Limitations ---- */}
              <div>
                <h3 className="text-sm font-bold text-[#e2eeff] flex items-center gap-2 mb-3">
                  <AlertCircle size={13} className="text-[#f59e0b]" />
                  Limitations
                </h3>
                <div className="space-y-2">
                  {[
                    'Predictions degrade under heavy cloud cover when MODIS AOD retrieval is unavailable.',
                    'The model was trained on CPCB station locations; predictions at unmonitored remote regions carry higher uncertainty.',
                    'Grid cells represent spatial averages — sub-grid variability (e.g., near point sources) is not resolved.',
                    'HCHO hotspots indicate elevated atmospheric formaldehyde from satellite overpass — not verified ground-level concentrations.',
                    'Fire detections are instantaneous observations — not continuous monitoring.',
                    'Model accuracy varies by season; monsoon periods have sparser satellite coverage.',
                  ].map((text, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-1 h-1 rounded-full bg-[#f59e0b] mt-1.5 shrink-0" />
                      <p className="text-[10px] text-[#4a6280] leading-relaxed">{text}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
