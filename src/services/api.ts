// ============================================================
// AeroSense AI — Centralized API Client
// ============================================================
//
// Base URL: NEXT_PUBLIC_API_BASE_URL (default: http://localhost:8000)
//
// Confirmed endpoints:
//   GET /api/v1/model/metrics  ← returns ModelMetricsApiResponse
//
// Anticipated endpoints (not yet implemented):
//   GET /api/v1/aqi/grid
//   GET /api/v1/stations
//   GET /api/v1/hcho/hotspots
//   GET /api/v1/fires
//   GET /api/v1/trends/:locationId
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
 * CONFIRMED: Fetch model performance metrics.
 * GET /api/v1/model/metrics
 */
export async function fetchModelMetrics(): Promise<ModelMetrics> {
  const raw = await apiFetch<ModelMetricsApiResponse>('/api/v1/model/metrics');
  return normalizeMetrics(raw);
}

/**
 * ANTICIPATED: Fetch AQI/PM2.5 grid predictions.
 * GET /api/v1/aqi/grid
 * This endpoint is not yet implemented in the backend.
 */
export async function fetchAQIGrid(): Promise<AQIGridCell[]> {
  const raw = await apiFetch<AQIGridApiResponse>('/api/v1/aqi/grid');
  return normalizeAQIGrid(raw);
}

/**
 * ANTICIPATED: Fetch CPCB ground station data.
 * GET /api/v1/stations
 * This endpoint is not yet implemented in the backend.
 */
export async function fetchStations(): Promise<CPCBStation[]> {
  const raw = await apiFetch<StationsApiResponse>('/api/v1/stations');
  return normalizeStations(raw);
}

/**
 * ANTICIPATED: Fetch HCHO hotspot observations.
 * GET /api/v1/hcho/hotspots
 * This endpoint is not yet implemented in the backend.
 */
export async function fetchHCHOHotspots(): Promise<HCHOHotspot[]> {
  const raw = await apiFetch<HCHOApiResponse>('/api/v1/hcho/hotspots');
  return normalizeHCHO(raw);
}

/**
 * ANTICIPATED: Fetch NASA FIRMS fire detections.
 * GET /api/v1/fires
 * This endpoint is not yet implemented in the backend.
 */
export async function fetchFireDetections(): Promise<FireDetection[]> {
  const raw = await apiFetch<FiresApiResponse>('/api/v1/fires');
  return normalizeFires(raw);
}

/**
 * ANTICIPATED: Fetch 7-day trend for a location.
 * GET /api/v1/trends/:locationId
 * This endpoint is not yet implemented in the backend.
 */
export async function fetchTrend(locationId: string): Promise<TrendDataPoint[]> {
  const raw = await apiFetch<TrendsApiResponse>(`/api/v1/trends/${encodeURIComponent(locationId)}`);
  return raw.points ?? [];
}
