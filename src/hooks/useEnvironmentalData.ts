'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type {
  AQIGridCell,
  CPCBStation,
  HCHOHotspot,
  FireDetection,
  TrendDataPoint,
  SelectedFeature,
  LayerState,
} from '@/types/environment';
import {
  fetchAQIGrid,
  fetchStations,
  fetchHCHOHotspots,
  fetchFireDetections,
  fetchTrend,
  ApiClientError,
} from '@/services/api';
import {
  MOCK_AQI_GRID,
  MOCK_STATIONS,
  MOCK_HCHO_HOTSPOTS,
  MOCK_FIRES,
  getMockTrend,
} from '@/services/mockData';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

export type DataStatus = 'idle' | 'loading' | 'success' | 'error' | 'offline';

interface EnvironmentalData {
  aqiGrid: AQIGridCell[];
  stations: CPCBStation[];
  hchoHotspots: HCHOHotspot[];
  fires: FireDetection[];
  trend: TrendDataPoint[];
  status: DataStatus;
  error: string | null;
  isMock: boolean;
  lastUpdated: string | null;
  refresh: () => void;
  loadTrend: (id: string) => Promise<void>;
}

export function useEnvironmentalData(): EnvironmentalData {
  const [aqiGrid, setAqiGrid] = useState<AQIGridCell[]>([]);
  const [stations, setStations] = useState<CPCBStation[]>([]);
  const [hchoHotspots, setHchoHotspots] = useState<HCHOHotspot[]>([]);
  const [fires, setFires] = useState<FireDetection[]>([]);
  const [trend, setTrend] = useState<TrendDataPoint[]>([]);
  const [status, setStatus] = useState<DataStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isMock, setIsMock] = useState(USE_MOCK);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setStatus('loading');
    setError(null);

    if (USE_MOCK) {
      // Simulate a brief load
      await new Promise((r) => setTimeout(r, 600));
      setAqiGrid(MOCK_AQI_GRID);
      setStations(MOCK_STATIONS);
      setHchoHotspots(MOCK_HCHO_HOTSPOTS);
      setFires(MOCK_FIRES);
      setIsMock(true);
      setStatus('success');
      setLastUpdated(new Date().toISOString());
      return;
    }

    try {
      const [gridData, stationsData, hchoData, firesData] = await Promise.allSettled([
        fetchAQIGrid(),
        fetchStations(),
        fetchHCHOHotspots(),
        fetchFireDetections(),
      ]);

      setAqiGrid(gridData.status === 'fulfilled' ? gridData.value : MOCK_AQI_GRID);
      setStations(stationsData.status === 'fulfilled' ? stationsData.value : MOCK_STATIONS);
      setHchoHotspots(hchoData.status === 'fulfilled' ? hchoData.value : MOCK_HCHO_HOTSPOTS);
      setFires(firesData.status === 'fulfilled' ? firesData.value : MOCK_FIRES);

      const anyFailed = [gridData, stationsData, hchoData, firesData].some(
        (r) => r.status === 'rejected'
      );

      if (anyFailed) {
        const firstError = [gridData, stationsData, hchoData, firesData].find(
          (r) => r.status === 'rejected'
        ) as PromiseRejectedResult;
        const isOffline = firstError.reason instanceof ApiClientError && firstError.reason.isOffline;
        setIsMock(true);
        setStatus(isOffline ? 'offline' : 'error');
        setError(isOffline ? 'Backend offline — showing demo data.' : 'Some data layers failed. Showing demo data where unavailable.');
      } else {
        setIsMock(false);
        setStatus('success');
        setLastUpdated(new Date().toISOString());
      }
    } catch (err) {
      const isOffline = err instanceof ApiClientError && err.isOffline;
      setAqiGrid(MOCK_AQI_GRID);
      setStations(MOCK_STATIONS);
      setHchoHotspots(MOCK_HCHO_HOTSPOTS);
      setFires(MOCK_FIRES);
      setIsMock(true);
      setStatus(isOffline ? 'offline' : 'error');
      setError(
        isOffline
          ? 'Backend is offline. Showing demonstration data.'
          : `Failed to load data: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  }, []);

  const loadTrend = useCallback(async (id: string) => {
    if (isMock) {
      setTrend(getMockTrend(id));
      return;
    }
    try {
      const data = await fetchTrend(id);
      setTrend(data.length > 0 ? data : getMockTrend(id));
    } catch {
      setTrend(getMockTrend(id));
    }
  }, [isMock]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    aqiGrid,
    stations,
    hchoHotspots,
    fires,
    trend,
    status,
    error,
    isMock,
    lastUpdated,
    refresh: loadData,
    loadTrend,
  };
}
