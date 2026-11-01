'use client';

import React, { useEffect, useState } from 'react';
import { fetchModelMetrics, ModelMetrics } from '@/services/api';
import {
  X,
  ShieldCheck,
  Cpu,
  BarChart2,
  Database,
  Layers,
  Info,
  Calendar,
} from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const TransparencyModal: React.FC<Props> = ({ onClose }) => {
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    fetchModelMetrics().then((data) => {
      if (isMounted) {
        setMetrics(data);
        setLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Model Methodology & Accuracy</h2>
              <p className="text-xs text-slate-400">
                Aerosense AI Environmental Intelligence v2.4 (Gradient Boosted Ensemble)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            aria-label="Close modal"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Key Metrics Cards */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center space-x-1.5">
              <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Cross-Validation Performance Metrics</span>
            </h3>

            {loading || !metrics ? (
              <div className="grid grid-cols-3 gap-3 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 bg-slate-800/60 rounded-xl border border-slate-700/40" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3.5">
                {/* MAE */}
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/70 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Mean Absolute Error</span>
                    <span className="text-[10px] text-cyan-400 font-mono bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800/40">
                      MAE
                    </span>
                  </div>
                  <div className="my-2">
                    <span className="text-2xl font-black text-white">{metrics.mae.toFixed(2)}</span>
                    <span className="text-xs text-slate-400 ml-1">µg/m³</span>
                  </div>
                  <div className="text-[10px] text-slate-400">Average absolute deviation</div>
                </div>

                {/* RMSE */}
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/70 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Root Mean Square</span>
                    <span className="text-[10px] text-indigo-400 font-mono bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-800/40">
                      RMSE
                    </span>
                  </div>
                  <div className="my-2">
                    <span className="text-2xl font-black text-white">{metrics.rmse.toFixed(2)}</span>
                    <span className="text-xs text-slate-400 ml-1">µg/m³</span>
                  </div>
                  <div className="text-[10px] text-slate-400">Penalizes extreme outliers</div>
                </div>

                {/* R2 */}
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/70 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Coefficient of Det.</span>
                    <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/40">
                      R²
                    </span>
                  </div>
                  <div className="my-2">
                    <span className="text-2xl font-black text-emerald-400">
                      {metrics.r2.toFixed(2)}
                    </span>
                    <span className="text-xs text-slate-400 ml-1">score</span>
                  </div>
                  <div className="text-[10px] text-slate-400">89% variance explained</div>
                </div>
              </div>
            )}
          </div>

          {/* Features Used */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center space-x-1.5">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span>Features Used in Inference Pipeline</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {metrics?.featuresUsed.map((feat, idx) => (
                <div
                  key={idx}
                  className="flex items-start space-x-2.5 p-3 rounded-lg bg-slate-800/40 border border-slate-800"
                >
                  <Layers className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span className="text-xs text-slate-300 leading-relaxed">{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Transparent Disclaimer Box */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start space-x-3">
            <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-amber-300">Model Transparency & Operating Bounds</h4>
              <p className="text-xs text-amber-200/90 leading-relaxed font-medium">
                &ldquo;Decision-support estimate; complements ground stations.&rdquo;
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                Aerosense AI blends orbital spectroradiometry (Sentinel-5P) with real-time micrometeorology to interpolate regions beyond CAAQMS ground monitor envelopes. Satellite estimations should be calibrated against local reference monitors for regulatory enforcement.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center space-x-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>Updated: Nov 1, 2026 | N = 142,850 validation observations</span>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
