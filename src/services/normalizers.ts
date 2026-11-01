// ============================================================
// AeroSense AI — Data Normalizers
// ============================================================
// Converts raw backend response shapes to frontend domain types.

import type {
  ModelMetricsApiResponse,
  AQIGridApiResponse,
  StationsApiResponse,
  HCHOApiResponse,
  FiresApiResponse,
  RawAQICell,
  RawStation,
  RawHCHOHotspot,
  RawFireDetection,
} from '@/types/api';
import type {
  ModelMetrics,
  AQIGridCell,
  CPCBStation,
  HCHOHotspot,
  FireDetection,
  AQICategory,
} from '@/types/environment';
import { getCategoryFromPM25 } from '@/lib/aqi';

const VALID_CATEGORIES: AQICategory[] = [
  'Good', 'Satisfactory', 'Moderate', 'Poor', 'Very Poor', 'Severe',
];

function toCategory(raw?: string): AQICategory {
  if (!raw) return 'Unknown';
  const found = VALID_CATEGORIES.find(
    (c) => c.toLowerCase() === raw.toLowerCase().replace('_', ' ')
  );
  return found ?? 'Unknown';
}

// ---- Model Metrics ----

export function normalizeMetrics(raw: ModelMetricsApiResponse): ModelMetrics {
  return {
    modelName: raw.model_name ?? 'Unknown Model',
    mae: raw.mae ?? null,
    rmse: raw.rmse ?? null,
    r2: raw.r2 ?? null,
    evaluationPeriod: raw.evaluation_period,
    sampleCount: raw.sample_count,
    validationNote: raw.validation_note,
    lastUpdated: raw.last_updated,
  };
}

// ---- AQI Grid ----

function normalizeAQICell(raw: RawAQICell): AQIGridCell {
  const category = raw.category
    ? toCategory(raw.category)
    : getCategoryFromPM25(raw.pm25);
  return {
    id: raw.id,
    lat: raw.lat,
    lng: raw.lng,
    cellSizeDeg: raw.cell_size_deg ?? 0.5,
    pm25: raw.pm25,
    aqi: raw.aqi,
    category,
    timestamp: raw.timestamp,
    dataType:
      (raw.data_type as AQIGridCell['dataType']) ?? 'model_estimate',
    confidence: raw.confidence as AQIGridCell['confidence'],
    regionName: raw.region_name,
  };
}

export function normalizeAQIGrid(raw: AQIGridApiResponse): AQIGridCell[] {
  return (raw.cells ?? []).map(normalizeAQICell);
}

// ---- CPCB Stations ----

function normalizeStation(raw: RawStation): CPCBStation {
  return {
    id: raw.id,
    name: raw.name,
    lat: raw.lat,
    lng: raw.lng,
    city: raw.city ?? '',
    state: raw.state ?? '',
    pm25: raw.pm25,
    pm10: raw.pm10,
    no2: raw.no2,
    aqi: raw.aqi,
    category: raw.category ? toCategory(raw.category) : undefined,
    lastUpdated: raw.last_updated,
    status: (raw.status as CPCBStation['status']) ?? 'Active',
    pollutants: raw.pollutants ?? [],
  };
}

export function normalizeStations(raw: StationsApiResponse): CPCBStation[] {
  return (raw.stations ?? []).map(normalizeStation);
}

// ---- HCHO Hotspots ----

function normalizeHCHOPoint(raw: RawHCHOHotspot): HCHOHotspot {
  return {
    id: raw.id,
    lat: raw.lat,
    lng: raw.lng,
    hchoColumnDU: raw.hcho_column_du ?? raw.hcho_value,
    hchoValue: raw.hcho_value,
    hchoUnit: raw.hcho_unit ?? 'mol/m²',
    observationTime: raw.observation_time,
    satellite: raw.satellite ?? 'Sentinel-5P',
    instrument: raw.instrument ?? 'TROPOMI',
    intensity: (raw.intensity as HCHOHotspot['intensity']) ?? 'Elevated',
    regionName: raw.region_name,
  };
}

export function normalizeHCHO(raw: HCHOApiResponse): HCHOHotspot[] {
  return (raw.hotspots ?? []).map(normalizeHCHOPoint);
}

// ---- Fire Detections ----

function normalizeFire(raw: RawFireDetection): FireDetection {
  return {
    id: raw.id,
    lat: raw.lat,
    lng: raw.lng,
    acqDate: raw.acq_date,
    acqTime: raw.acq_time,
    satellite: raw.satellite ?? 'MODIS',
    instrument: raw.instrument ?? 'MODIS',
    confidence: (raw.confidence as FireDetection['confidence']) ?? 'nominal',
    brightness: raw.brightness,
    frp: raw.frp,
    daynight: (raw.daynight as FireDetection['daynight']) ?? 'D',
    regionName: raw.region_name,
  };
}

export function normalizeFires(raw: FiresApiResponse): FireDetection[] {
  return (raw.fires ?? []).map(normalizeFire);
}
