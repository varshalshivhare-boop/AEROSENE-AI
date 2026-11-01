'use client';

import { useState, useCallback } from 'react';
import type { LayerState, LayerKey } from '@/types/environment';

const DEFAULT_LAYERS: LayerState = {
  aqiGrid: true,
  stations: true,
  hcho: true,
  fires: false,
};

export function useMapLayers() {
  const [layers, setLayers] = useState<LayerState>(DEFAULT_LAYERS);

  const toggleLayer = useCallback((key: LayerKey) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const setLayer = useCallback((key: LayerKey, value: boolean) => {
    setLayers((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetLayers = useCallback(() => {
    setLayers(DEFAULT_LAYERS);
  }, []);

  return { layers, toggleLayer, setLayer, resetLayers };
}
