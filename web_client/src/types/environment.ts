// ============================================================
// AeroSense AI — Environment / Domain Types
// ============================================================

export type AQICategory =
  | 'Good'
  | 'Satisfactory'
  | 'Moderate'
  | 'Poor'
  | 'Very Poor'
  | 'Severe'
  | 'Unknown';

export interface AQIGridCell {
  id: string;
  lat: number;
  lng: number;
  /** Width / height of the cell in degrees */
  cellSizeDeg: number;
  /** PM2.5 concentration µg/m³ — model estimate */
  pm25: number;
  /** AQI value — only present when calculated or returned by backend */
  aqi?: number;
  category: AQICategory;
  /** ISO timestamp of the prediction */
  timestamp: string;
  /** Whether this is a model estimate, ground measurement, or satellite */
  dataType: 'model_estimate' | 'ground_measurement' | 'satellite_derived';
  confidence?: 'High' | 'Medium' | 'Low';
  regionName?: string;
}

export interface CPCBStation {
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
  category?: AQICategory;
  /** ISO timestamp of the measurement */
  lastUpdated: string;
  status: 'Active' | 'Inactive' | 'Maintenance';
  pollutants: string[];
}

export interface HCHOHotspot {
  id: string;
  lat: number;
  lng: number;
  /** HCHO column amount in mol/m² × 10⁻⁶ (Dobson units) */
  hchoColumnDU: number;
  /** Raw HCHO value as returned by backend */
  hchoValue: number;
  hchoUnit: string;
  /** ISO timestamp of satellite overpass */
  observationTime: string;
  satellite: string;
  instrument: string;
  /** Qualitative intensity */
  intensity: 'Elevated' | 'High' | 'Extreme';
  regionName?: string;
  /** Explanation of what HCHO indicates */
  note?: string;
}

export interface FireDetection {
  id: string;
  lat: number;
  lng: number;
  /** ISO timestamp */
  acqDate: string;
  acqTime: string;
  satellite: string;
  instrument: string;
  confidence: 'low' | 'nominal' | 'high';
  /** Brightness temperature (Kelvin) */
  brightness: number;
  frp?: number;
  daynight: 'D' | 'N';
  regionName?: string;
}

export interface TrendDataPoint {
  date: string;
  observed?: number;
  predicted?: number;
  pm25?: number;
  aqi?: number;
}

export interface ModelMetrics {
  modelName: string;
  mae: number | null;
  rmse: number | null;
  r2: number | null;
  evaluationPeriod?: string;
  sampleCount?: number;
  validationNote?: string;
  lastUpdated?: string;
}

export type SelectedFeature =
  | { type: 'aqiCell'; data: AQIGridCell }
  | { type: 'station'; data: CPCBStation }
  | { type: 'hcho'; data: HCHOHotspot }
  | { type: 'fire'; data: FireDetection }
  | null;

export type LayerKey = 'aqiGrid' | 'stations' | 'hcho' | 'fires';

export interface LayerState {
  aqiGrid: boolean;
  stations: boolean;
  hcho: boolean;
  fires: boolean;
}
