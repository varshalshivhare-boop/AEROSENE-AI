// ============================================================
// AeroSense AI — API Response Types
// ============================================================
//
// Confirmed endpoints:
//   GET /api/v1/model/metrics
//
// Anticipated endpoints (not yet implemented in backend):
//   GET /api/v1/aqi/grid           — AQI/PM2.5 grid cells
//   GET /api/v1/stations           — CPCB ground stations
//   GET /api/v1/hcho/hotspots      — HCHO elevated observations
//   GET /api/v1/fires              — NASA FIRMS fire detections
//   GET /api/v1/trends/:locationId — 7-day trend series
//
// These interfaces will be aligned with the backend as it is implemented.

import type {
  AQIGridCell,
  CPCBStation,
  HCHOHotspot,
  FireDetection,
  TrendDataPoint,
  ModelMetrics,
} from './environment';

// ---- Generic wrapper ----

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp?: string;
}

export interface ApiError {
  code: string;
  message: string;
  statusCode?: number;
}

// ---- Model Metrics (/api/v1/model/metrics) — CONFIRMED ----

export interface ModelMetricsApiResponse {
  model_name: string;
  mae: number | null;
  rmse: number | null;
  r2: number | null;
  evaluation_period?: string;
  sample_count?: number;
  validation_note?: string;
  last_updated?: string;
}

// ---- AQI Grid (/api/v1/aqi/grid) — ANTICIPATED ----

export interface AQIGridApiResponse {
  cells: RawAQICell[];
  generatedAt: string;
  modelVersion?: string;
}

export interface RawAQICell {
  id: string;
  lat: number;
  lng: number;
  cell_size_deg?: number;
  pm25: number;
  aqi?: number;
  category?: string;
  timestamp: string;
  data_type?: string;
  confidence?: string;
  region_name?: string;
}

// ---- CPCB Stations (/api/v1/stations) — ANTICIPATED ----

export interface StationsApiResponse {
  stations: RawStation[];
  fetchedAt: string;
}

export interface RawStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  city: string;
  state: string;
  pm25?: number;
  pm10?: number;
  no2?: number;
  aqi?: number;
  category?: string;
  last_updated: string;
  status?: string;
  pollutants?: string[];
}

// ---- HCHO Hotspots (/api/v1/hcho/hotspots) — ANTICIPATED ----

export interface HCHOApiResponse {
  hotspots: RawHCHOHotspot[];
  observationDate: string;
  satellite?: string;
}

export interface RawHCHOHotspot {
  id: string;
  lat: number;
  lng: number;
  hcho_column_du?: number;
  hcho_value: number;
  hcho_unit?: string;
  observation_time: string;
  satellite?: string;
  instrument?: string;
  intensity?: string;
  region_name?: string;
}

// ---- Fire Detections (/api/v1/fires) — ANTICIPATED ----

export interface FiresApiResponse {
  fires: RawFireDetection[];
  fetchedAt: string;
}

export interface RawFireDetection {
  id: string;
  lat: number;
  lng: number;
  acq_date: string;
  acq_time: string;
  satellite?: string;
  instrument?: string;
  confidence?: string;
  brightness: number;
  frp?: number;
  daynight?: string;
  region_name?: string;
}

// ---- Trends (/api/v1/trends/:locationId) — ANTICIPATED ----

export interface TrendsApiResponse {
  locationId: string;
  points: TrendDataPoint[];
  isDemoData?: boolean;
}

// ---- Normalized export types re-exported for convenience ----
export type {
  AQIGridCell,
  CPCBStation,
  HCHOHotspot,
  FireDetection,
  TrendDataPoint,
  ModelMetrics,
};
