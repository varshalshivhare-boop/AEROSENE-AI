'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Wind, Radio, Satellite, Flame, type LucideIcon } from 'lucide-react';
import type { LayerState, LayerKey } from '@/types/environment';

interface LayerConfig {
  key: LayerKey;
  label: string;
  icon: LucideIcon;
  color: string;
  activeColor: string;
  activeBg: string;
}

const LAYERS: LayerConfig[] = [
  {
    key: 'aqiGrid',
    label: 'PM2.5 Grid',
    icon: Wind,
    color: '#38c1d6',
    activeColor: '#38c1d6',
    activeBg: 'rgba(56,193,214,0.12)',
  },
  {
    key: 'hcho',
    label: 'HCHO Hotspots',
    icon: Satellite,
    color: '#f59e0b',
    activeColor: '#f59e0b',
    activeBg: 'rgba(245,158,11,0.12)',
  },
  {
    key: 'fires',
    label: 'Fire Detections',
    icon: Flame,
    color: '#f97316',
    activeColor: '#f97316',
    activeBg: 'rgba(249,115,22,0.12)',
  },
  {
    key: 'stations',
    label: 'CPCB Stations',
    icon: Radio,
    color: '#10b981',
    activeColor: '#10b981',
    activeBg: 'rgba(16,185,129,0.12)',
  },
];

interface LayerControlsProps {
  layers: LayerState;
  onToggle: (key: LayerKey) => void;
}

export default function LayerControls({ layers, onToggle }: LayerControlsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="glass rounded-2xl p-3 w-52 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
      role="group"
      aria-label="Map layer controls"
    >
      <div className="text-[9px] font-mono text-[#4a6280] uppercase tracking-widest mb-2 px-1">
        Data Layers
      </div>

      <div className="flex flex-col gap-1">
        {LAYERS.map(({ key, label, icon: Icon, color, activeColor, activeBg }) => {
          const isActive = layers[key];
          return (
            <motion.button
              key={key}
              id={`layer-toggle-${key}`}
              onClick={() => onToggle(key)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl text-left
                         transition-all duration-200 focus-visible:outline focus-visible:outline-2"
              style={{
                background: isActive ? activeBg : 'transparent',
                border: `1px solid ${isActive ? `${activeColor}30` : 'rgba(56,193,214,0.06)'}`,
                outlineColor: color,
              }}
              aria-pressed={isActive}
              aria-label={`Toggle ${label} layer`}
            >
              {/* Color dot indicator */}
              <div
                className="w-2 h-2 rounded-full shrink-0 transition-all duration-200"
                style={{
                  background: isActive ? color : '#1e3a5f',
                  boxShadow: isActive ? `0 0 6px ${color}60` : 'none',
                }}
              />

              {/* Icon */}
              <Icon
                size={13}
                style={{ color: isActive ? color : '#4a6280' }}
                className="shrink-0 transition-colors duration-200"
              />

              {/* Label */}
              <span
                className="text-xs font-medium transition-colors duration-200 flex-1"
                style={{ color: isActive ? '#e2eeff' : '#4a6280' }}
              >
                {label}
              </span>

              {/* Toggle indicator */}
              <div
                className="w-7 h-3.5 rounded-full relative transition-all duration-200 shrink-0"
                style={{
                  background: isActive ? `${color}40` : 'rgba(56,193,214,0.06)',
                  border: `1px solid ${isActive ? `${color}50` : 'rgba(56,193,214,0.1)'}`,
                }}
              >
                <div
                  className="absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all duration-200"
                  style={{
                    background: isActive ? color : '#1e3a5f',
                    left: isActive ? '14px' : '1px',
                    boxShadow: isActive ? `0 0 4px ${color}80` : 'none',
                  }}
                />
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
