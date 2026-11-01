'use client';

import React, { useRef, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Wind, Brain, Radio, Activity, Sparkles, MapPin, ChevronDown, Compass } from 'lucide-react';
import type { GlobeSceneProps } from './GlobeScene';

// Dynamically import the 3D globe to avoid SSR errors
const GlobeScene = dynamic<GlobeSceneProps>(() => import('./GlobeScene'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div
        className="w-56 h-56 rounded-full border border-[#38c1d6]/20 animate-pulse"
        style={{ boxShadow: '0 0 80px rgba(56,193,214,0.1)' }}
      />
    </div>
  ),
});

// Telemetry data strip
const TELEMETRY = [
  { label: 'ORBIT', value: '705 km SSO' },
  { label: 'SENSOR', value: 'TROPOMI / MODIS' },
  { label: 'REVISIT', value: '1 day' },
  { label: 'COVERAGE', value: 'PAN-INDIA' },
  { label: 'STATUS', value: 'ACTIVE' },
];

interface HeroSectionProps {
  onExplore: () => void;
  onMethodology: () => void;
  isZooming?: boolean;
}

// ---- Sci-Fi Re-Entry HUD Overlay Component ----

function ReentryHud({ isZooming }: { isZooming: boolean }) {
  const [altitude, setAltitude] = useState(705);
  const [mach, setMach] = useState(24.8);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!isZooming) {
      setAltitude(705);
      setMach(24.8);
      setFlash(false);
      return;
    }

    const start = performance.now();
    const duration = 1200;

    const interval = setInterval(() => {
      const elapsed = performance.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const easeP = progress * progress;

      // Altitude ticks from 705 km down to 0
      const currentAlt = Math.max(0, Math.round(705 * (1 - easeP)));
      setAltitude(currentAlt);

      // Mach velocity drops as atmosphere compresses
      const currentMach = Math.max(0.8, +(24.8 * (1 - easeP * 0.95)).toFixed(1));
      setMach(currentMach);

      if (elapsed > 1050 && !flash) {
        setFlash(true);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [isZooming, flash]);

  if (!isZooming) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center overflow-hidden">
      {/* 1. Atmospheric Re-entry Flare & Vignette */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at center, rgba(56,193,214,0.22) 0%, rgba(2,11,24,0.75) 55%, #020b18 90%)',
        }}
      />

      {/* 2. Expanding Hypersonic Shockwave Ring */}
      <motion.div
        initial={{ scale: 0.2, opacity: 0.8 }}
        animate={{ scale: [0.2, 1.8, 3.5], opacity: [0.9, 0.4, 0] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut' }}
        className="absolute w-72 h-72 rounded-full border-2 border-[#38c1d6] shadow-[0_0_80px_rgba(56,193,214,0.8)]"
      />

      {/* 3. Central Rotating Reticle & Targeting Brackets */}
      <div className="relative flex flex-col items-center justify-center">
        {/* Rotating compass ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          className="w-80 h-80 sm:w-96 sm:h-96 rounded-full border border-[#38c1d6]/30 border-dashed flex items-center justify-center"
        >
          {/* Degree ticks */}
          <div className="absolute top-2 text-[9px] font-mono text-[#38c1d6]">000° N</div>
          <div className="absolute bottom-2 text-[9px] font-mono text-[#38c1d6]">180° S</div>
          <div className="absolute right-2 text-[9px] font-mono text-[#38c1d6]">090° E</div>
          <div className="absolute left-2 text-[9px] font-mono text-[#38c1d6]">270° W</div>
        </motion.div>

        {/* Clamping Corner Crosshairs */}
        <motion.div
          initial={{ scale: 1.6, opacity: 0 }}
          animate={{ scale: [1.6, 1.0], opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="absolute w-56 h-56 flex items-center justify-center pointer-events-none"
        >
          {/* Top-left corner */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#38c1d6] shadow-[0_0_15px_rgba(56,193,214,0.8)]" />
          {/* Top-right corner */}
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#38c1d6] shadow-[0_0_15px_rgba(56,193,214,0.8)]" />
          {/* Bottom-left corner */}
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[#38c1d6] shadow-[0_0_15px_rgba(56,193,214,0.8)]" />
          {/* Bottom-right corner */}
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#38c1d6] shadow-[0_0_15px_rgba(56,193,214,0.8)]" />

          {/* Central Target Dot */}
          <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444] animate-ping shadow-[0_0_20px_#ef4444]" />
        </motion.div>

        {/* Center Telemetry Data Card */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="absolute glass-sm px-6 py-4 rounded-2xl border border-[#38c1d6]/50 shadow-[0_0_60px_rgba(56,193,214,0.35)] flex flex-col items-center gap-2 backdrop-blur-md"
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#38c1d6] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#38c1d6]"></span>
            </span>
            <span className="text-xs sm:text-sm font-mono tracking-widest text-[#e2eeff] font-extrabold uppercase">
              ATMOSPHERIC RE-ENTRY // INDIA SURFACE LOCK
            </span>
          </div>

          {/* Live Dynamic Counters */}
          <div className="grid grid-cols-3 gap-6 pt-1 text-center font-mono">
            <div>
              <span className="text-[10px] text-[#8ba8cc] block uppercase">Altitude</span>
              <span className="text-lg sm:text-2xl font-black text-[#38c1d6] tracking-tight">
                {altitude} <span className="text-xs font-normal">KM</span>
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[#8ba8cc] block uppercase">Velocity</span>
              <span className="text-lg sm:text-2xl font-black text-[#fbbf24] tracking-tight">
                M {mach}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[#8ba8cc] block uppercase">Coordinates</span>
              <span className="text-xs sm:text-sm font-bold text-[#10b981] block mt-1">
                22.5°N, 78.9°E
              </span>
            </div>
          </div>

          {/* Progress speedline */}
          <div className="w-64 h-1 bg-[#38c1d6]/20 rounded-full overflow-hidden mt-1">
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ duration: 0.5, repeat: Infinity, ease: 'linear' }}
              className="w-full h-full bg-gradient-to-r from-transparent via-[#38c1d6] to-transparent"
            />
          </div>
        </motion.div>
      </div>

      {/* 4. Final Cloud-Break Sonic Flash */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.9, 0.4] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 bg-gradient-to-b from-[#e0f2fe] via-[#38c1d6]/50 to-[#020b18] pointer-events-none"
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ---- Main Hero Section Component ----

export default function HeroSection({ onExplore, onMethodology, isZooming }: HeroSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Global scroll & wheel detection: scrolling anywhere on the page zooms into Earth and enters the dashboard
  useEffect(() => {
    let accumulatedDelta = 0;
    let touchStartY = 0;

    const handleWheel = (e: WheelEvent) => {
      if (isZooming) return;
      // Scroll down on mouse wheel
      if (e.deltaY > 8) {
        accumulatedDelta += e.deltaY;
        if (accumulatedDelta > 20) {
          onExplore();
          accumulatedDelta = 0;
        }
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isZooming) return;
      const deltaY = touchStartY - e.touches[0].clientY;
      if (deltaY > 30) {
        onExplore();
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isZooming, onExplore]);

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen flex flex-col justify-between overflow-hidden gradient-hero grid-overlay select-none"
      aria-label="AeroSense AI Hero"
    >
      {/* ---- Top status bar ---- */}
      <header className="relative z-20 flex items-center justify-between px-6 lg:px-12 py-3.5 border-b border-[#38c1d6]/10 backdrop-blur-md bg-[#020b18]/60">
        {/* Brand Icon & Name */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#38c1d6] to-[#10b981] flex items-center justify-center shadow-[0_0_15px_rgba(56,193,214,0.5)]">
            <Wind size={16} className="text-[#020b18]" strokeWidth={2.5} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-extrabold tracking-wider text-[#e2eeff]">AEROSENSE</span>
            <span className="text-xs font-mono font-bold text-[#38c1d6] px-1.5 py-0.5 rounded bg-[#38c1d6]/15 border border-[#38c1d6]/30">
              AI
            </span>
          </div>
        </div>

        {/* Telemetry strip */}
        <div className="hidden md:flex items-center gap-6">
          {TELEMETRY.map((t) => (
            <div key={t.label} className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] font-mono text-[#4a6280] tracking-widest uppercase">
                {t.label}
              </span>
              <span className="text-[11px] font-mono font-medium text-[#38c1d6]">{t.value}</span>
            </div>
          ))}
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-3">
          <button
            id="hero-methodology-btn"
            onClick={onMethodology}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-sm border border-[#38c1d6]/25 text-[#8ba8cc] hover:text-[#38c1d6] hover:border-[#38c1d6]/50 transition-all cursor-pointer text-[10px] font-mono tracking-wider uppercase"
          >
            <Brain size={13} className="text-[#38c1d6]" />
            <span>Model Card</span>
          </button>

          {/* Live status badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass-sm border-[#38c1d6]/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10b981]"></span>
            </span>
            <span className="text-[10px] font-mono text-[#10b981] font-semibold tracking-wider uppercase">
              Live Platform
            </span>
          </div>
        </div>
      </header>

      {/* ---- Centered Main Hero Content ---- */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-3 w-full text-center">
        {/* TITLE: AEROSENSE AI */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="flex flex-col items-center text-center"
        >
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tight leading-none text-center">
            <span className="text-gradient-hero">AEROSENSE </span>
            <span className="text-[#38c1d6] drop-shadow-[0_0_40px_rgba(56,193,214,0.65)]">AI</span>
          </h1>
          <p className="mt-2 text-xs sm:text-sm font-mono tracking-widest uppercase text-[#8ba8cc]/80 text-center">
            Satellite Intelligence • CPCB Ground Stations • Real-Time PM2.5
          </p>
        </motion.div>

        {/* ---- 100% Centered 3D Globe with Symmetrical Balance ---- */}
        <div className="relative w-full max-w-5xl h-[360px] sm:h-[420px] lg:h-[480px] my-1 flex items-center justify-center">
          {/* Subtle radial backdrop glow */}
          <div
            className="absolute inset-0 pointer-events-none rounded-full"
            style={{
              background: 'radial-gradient(circle at 50% 50%, rgba(56,193,214,0.14) 0%, rgba(2,11,24,0) 65%)',
            }}
          />

          {/* Centered Globe Canvas */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{
              opacity: 1,
              scale: isZooming ? 1.55 : 1,
            }}
            transition={{
              duration: isZooming ? 1.2 : 0.8,
              ease: isZooming ? [0.16, 1, 0.3, 1] : 'easeOut',
            }}
            className="w-full max-w-xl h-full flex items-center justify-center relative mx-auto"
          >
            <GlobeScene
              className="w-full h-full"
              isZooming={isZooming}
              onZoomTrigger={onExplore}
            />
          </motion.div>

          {/* Symmetrical Left Card: Region Telemetry */}
          <AnimatePresence>
            {!isZooming && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.4 }}
                className="hidden xl:flex flex-col gap-2 absolute top-12 left-4 glass-sm p-3.5 rounded-2xl w-52 text-left border border-[#38c1d6]/20 shadow-[0_8px_30px_rgba(2,11,24,0.7)]"
              >
                <div className="flex items-center gap-1.5">
                  <MapPin size={13} className="text-[#38c1d6]" />
                  <span className="text-[10px] font-mono text-[#8ba8cc] uppercase tracking-wider">
                    Target Region
                  </span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#8ba8cc]">Subcontinent</span>
                    <span className="font-mono text-[#e2eeff] font-semibold">India</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8ba8cc]">Coordinates</span>
                    <span className="font-mono text-[#38c1d6] font-semibold">22.5°N, 78.9°E</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8ba8cc]">Network</span>
                    <span className="font-mono text-[#10b981] font-semibold">8 CPCB Online</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Symmetrical Right Card: Live Hotspot Observation */}
          <AnimatePresence>
            {!isZooming && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.4 }}
                className="hidden xl:flex flex-col gap-2 absolute top-12 right-4 glass-sm p-3.5 rounded-2xl w-52 text-left border border-[#38c1d6]/20 shadow-[0_8px_30px_rgba(2,11,24,0.7)]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ef4444] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ef4444]"></span>
                    </span>
                    <span className="text-[10px] font-mono text-[#8ba8cc] uppercase tracking-wider">
                      Hotspot
                    </span>
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#ef4444]/15 text-[#ef4444] font-bold border border-[#ef4444]/30">
                    LIVE
                  </span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#8ba8cc]">Location</span>
                    <span className="font-mono text-[#e2eeff] font-semibold">Delhi NCR</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8ba8cc]">PM2.5 Peak</span>
                    <span className="font-mono text-[#ef4444] font-bold">187 µg/m³</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8ba8cc]">Sentinel-5P</span>
                    <span className="font-mono text-[#38c1d6] font-semibold">Confirmed</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ---- Interactive Scroll Prompt ---- */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: isZooming ? 0 : 1, y: isZooming ? 20 : 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center justify-center gap-3 mt-1 w-full max-w-lg z-20 mx-auto"
        >
          {/* Animated Scroll Trigger Pill (Click or Scroll) */}
          <button
            onClick={onExplore}
            className="group flex items-center gap-3 px-7 py-3.5 rounded-full glass border border-[#38c1d6]/30 text-[#e2eeff]
                       hover:border-[#38c1d6]/70 hover:bg-[#38c1d6]/15 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-[0_0_30px_rgba(56,193,214,0.25)]"
          >
            <div className="w-4 h-6 rounded-full border border-[#38c1d6] flex items-start justify-center p-0.5">
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
                className="w-1 h-1.5 rounded-full bg-[#38c1d6]"
              />
            </div>
            <span className="text-xs sm:text-sm font-mono font-bold tracking-wider text-[#38c1d6] uppercase">
              Scroll down on Earth to Enter Live Map
            </span>
            <ChevronDown size={15} className="text-[#38c1d6] group-hover:translate-y-0.5 transition-transform" />
          </button>
        </motion.div>

        {/* Quick stats pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isZooming ? 0 : 1 }}
          transition={{ duration: 0.4 }}
          className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 mt-4 text-xs text-[#8ba8cc] mx-auto text-center"
        >
          <div className="flex items-center gap-1.5 font-mono">
            <Radio size={12} className="text-[#38c1d6]" />
            <span>8 CPCB Ground Stations</span>
          </div>
          <span className="text-[#38c1d6]/30">•</span>
          <div className="flex items-center gap-1.5 font-mono">
            <Activity size={12} className="text-[#fbbf24]" />
            <span>4 HCHO Anomaly Hotspots</span>
          </div>
          <span className="text-[#38c1d6]/30">•</span>
          <div className="flex items-center gap-1.5 font-mono">
            <Sparkles size={12} className="text-[#10b981]" />
            <span>13 High-Res Grid Cells</span>
          </div>
        </motion.div>
      </main>

      {/* ---- Cinematic Sci-Fi Re-entry HUD with Dynamic Altitude & Crosshairs ---- */}
      <AnimatePresence>
        {isZooming && <ReentryHud isZooming={isZooming} />}
      </AnimatePresence>

      {/* Footer subtle attribution */}
      <footer className="relative z-10 py-2.5 text-center border-t border-[#38c1d6]/10 text-[11px] font-mono text-[#8ba8cc]/50">
        Sentinel-5P TROPOMI • MODIS / VIIRS FIRMS • CPCB Ground Network • LightGBM Residual AI
      </footer>
    </section>
  );
}
