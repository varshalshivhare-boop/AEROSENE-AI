'use client';

import React, { useState } from 'react';
import HeroSection from '@/components/hero/HeroSection';
import DashboardShell from '@/components/dashboard/DashboardShell';
import TransparencyModal from '@/components/modals/TransparencyModal';

export default function Home() {
  const [showDashboard, setShowDashboard] = useState(false);
  const [isZooming, setIsZooming] = useState(false);
  const [methodologyOpen, setMethodologyOpen] = useState(false);

  const handleExplore = () => {
    if (isZooming || showDashboard) return;
    setIsZooming(true);

    // Cinematic zoom sequence: 1200ms fly-in to India, then switch to live map
    setTimeout(() => {
      setShowDashboard(true);
      setIsZooming(false);
    }, 1200);
  };

  const handleMethodology = () => {
    setMethodologyOpen(true);
  };

  const handleBackToHero = () => {
    setShowDashboard(false);
    setIsZooming(false);
  };

  if (showDashboard) {
    return (
      <>
        <DashboardShell onBack={handleBackToHero} />
        <TransparencyModal
          isOpen={methodologyOpen}
          onClose={() => setMethodologyOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      <HeroSection
        onExplore={handleExplore}
        onMethodology={handleMethodology}
        isZooming={isZooming}
      />
      <TransparencyModal
        isOpen={methodologyOpen}
        onClose={() => setMethodologyOpen(false)}
      />
    </>
  );
}
