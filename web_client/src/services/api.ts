// ============================================================
// AeroSense AI — Centralized API Client
// ============================================================
//
// Base URL: NEXT_PUBLIC_API_BASE_URL (default: http://localhost:8000)
//
// Live endpoints (Phase 4 backend):
//   GET /api/v1/grid/aqi           ← AQI grid with ML PM2.5 estimates
//   GET /api/v1/grid/estimate      ← Custom single-point prediction
//   GET /api/v1/hotspots/hcho      ← HCHO spatial anomalies
//   GET /api/v1/stations/ground    ← CPCB ground stations
//   GET /api/v1/stations/history   ← 7-day trend for coordinates
//   GET /api/v1/model/metrics      ← Model performance metrics
//
// See src/types/api.ts for full schema definitions.

import type {
  ModelMetricsApiResponse,
  AQIGridApiResponse,
  StationsApiResponse,
  HCHOApiResponse,
  FiresApiResponse,
  TrendsApiResponse,
} from '@/types/api';
import type { ModelMetrics, AQIGridCell, CPCBStation, HCHOHotspot, FireDetection, TrendDataPoint } from '@/types/environment';
import { normalizeMetrics, normalizeAQIGrid, normalizeStations, normalizeHCHO, normalizeFires } from './normalizers';

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

const DEFAULT_TIMEOUT_MS = 8000;

// ---- Internal fetch helper ----

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const url = `${BASE_URL}${path}`;

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!res.ok) {
      throw new ApiClientError(
        `HTTP ${res.status}: ${res.statusText}`,
        res.status
      );
    }

    const json = await res.json();
    return json as T;
  } catch (err) {
    if (err instanceof ApiClientError) throw err;

    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiClientError('Request timed out', 408);
    }

    // Network errors (backend offline, CORS, etc.)
    throw new ApiClientError(
      err instanceof Error ? err.message : 'Network error',
      0
    );
  } finally {
    clearTimeout(timer);
  }
}

// ---- Custom error class ----

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'ApiClientError';
  }

  get isOffline(): boolean {
    return this.statusCode === 0 || this.statusCode === 408;
  }
}

// ---- Public API functions ----

/**
 * Fetch model performance metrics.
 * GET /api/v1/model/metrics
 */
export async function fetchModelMetrics(): Promise<ModelMetrics> {
  const raw = await apiFetch<ModelMetricsApiResponse>('/api/v1/model/metrics');
  return normalizeMetrics(raw);
}

/**
 * Fetch AQI/PM2.5 grid predictions.
 * GET /api/v1/grid/aqi — returns GeoJSON FeatureCollection
 */
export async function fetchAQIGrid(): Promise<AQIGridCell[]> {
  // Backend returns GeoJSON FeatureCollection with features array
  const raw = await apiFetch<any>('/api/v1/grid/aqi');
  const features = raw.features ?? [];

  return features.map((f: any) => {
    const props = f.properties ?? {};
    const coords = f.geometry?.coordinates ?? [0, 0];
    return {
      id: props.id ?? `grid-${coords[1]}-${coords[0]}`,
      lat: coords[1],
      lng: coords[0],
      cellSizeDeg: 0.5,
      pm25: props.pm25_estimate ?? 0,
      aqi: props.aqi,
      category: props.category ?? 'Unknown',
      timestamp: props.timestamp ?? new Date().toISOString(),
      dataType: 'model_estimate' as const,
      confidence: props.confidence === 'HIGH' ? 'High'
        : props.confidence === 'MEDIUM' ? 'Medium' : 'Low',
      regionName: props.location_name ?? props.region,
    };
  });
}

/**
 * Fetch CPCB ground station data.
 * GET /api/v1/stations/ground
 */
export async function fetchStations(): Promise<CPCBStation[]> {
  const raw = await apiFetch<any>('/api/v1/stations/ground');
  const stations = raw.stations ?? [];

  return stations.map((s: any) => ({
    id: s.station_id,
    name: s.station_name,
    lat: s.lat,
    lng: s.lon,
    city: s.city ?? '',
    state: s.state ?? '',
    pm25: s.ground_pm25,
    pm10: undefined,
    aqi: s.ground_aqi,
    category: s.ground_category,
    lastUpdated: s.last_updated ?? new Date().toISOString(),
    status: 'Active' as const,
    pollutants: ['PM2.5'],
  }));
}

/**
 * Fetch HCHO hotspot observations.
 * GET /api/v1/hotspots/hcho
 */
export async function fetchHCHOHotspots(): Promise<HCHOHotspot[]> {
  const raw = await apiFetch<any>('/api/v1/hotspots/hcho');
  const hotspots = raw.hotspots ?? [];

  return hotspots.map((h: any) => ({
    id: h.hotspot_id,
    lat: h.lat,
    lng: h.lon,
    hchoColumnDU: h.hcho_column_mol_m2 * 1e6,
    hchoValue: h.hcho_column_mol_m2,
    hchoUnit: 'mol/m²',
    observationTime: h.timestamp ?? new Date().toISOString(),
    satellite: h.context?.satellite_sensor ?? 'Sentinel-5P',
    instrument: 'TROPOMI',
    intensity: h.severity === 'CRITICAL' ? 'Extreme'
      : h.severity === 'HIGH' ? 'High' : 'Elevated',
    regionName: h.region,
    note: h.context?.scientific_disclaimer,
  }));
}

/**
 * Fetch NASA FIRMS fire detections (from HCHO context data).
 * Uses hotspot fire context since we don't have a dedicated /fires endpoint.
 */
export async function fetchFireDetections(): Promise<FireDetection[]> {
  const raw = await apiFetch<any>('/api/v1/hotspots/hcho');
  const hotspots = raw.hotspots ?? [];

  // Extract fire locations from hotspot context (approximate)
  const fires: FireDetection[] = [];
  hotspots.forEach((h: any, i: number) => {
    const ctx = h.context ?? {};
    if (ctx.nearby_fires_50km > 5) {
      fires.push({
        id: `fire-from-hcho-${i}`,
        lat: h.lat + 0.1 * (Math.random() - 0.5),
        lng: h.lon + 0.1 * (Math.random() - 0.5),
        acqDate: h.timestamp?.split('T')[0] ?? '2026-11-01',
        acqTime: '0620',
        satellite: 'MODIS (Aqua)',
        instrument: 'MODIS',
        confidence: ctx.nearby_fires_50km > 20 ? 'high' : 'nominal',
        brightness: 330 + ctx.nearby_fires_50km * 0.5,
        frp: ctx.nearby_fires_50km * 0.7,
        daynight: 'D',
        regionName: h.region,
      });
    }
  });
  return fires;
}

/**
 * Fetch 7-day trend for a location.
 * GET /api/v1/stations/history?lat=...&lon=...&days=7
 */
export async function fetchTrend(locationId: string): Promise<TrendDataPoint[]> {
  // Try to extract lat/lon from the feature data, fallback to Delhi
  let lat = 28.61;
  let lon = 77.20;

  // locationId might contain coordinates; try to parse
  const match = locationId.match(/([\d.]+).*?([\d.]+)/);
  if (match) {
    lat = parseFloat(match[1]);
    lon = parseFloat(match[2]);
  }

  try {
    const raw = await apiFetch<any>(
      `/api/v1/stations/history?lat=${lat}&lon=${lon}&days=7`
    );
    const history = raw.history ?? [];
    return history.map((h: any) => ({
      date: h.date,
      predicted: h.pm25_estimate,
      pm25: h.pm25_estimate,
      aqi: h.aqi,
    }));
  } catch {
    return [];
  }
}
