import axios from 'axios';

export const API_BASE = 'http://localhost:8000';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 1500, // Quick fail if local server is down
});

export type ConfidenceLevel = 'High' | 'Medium' | 'Low';

export interface AQIGridCell {
  id: string;
  name: string;
  lat: number;
  lon: number;
  aqi: number;
  pm25: number;
  groundPM25?: number;
  confidence: ConfidenceLevel;
}

export interface Station {
  id: string;
  name: string;
  lat: number;
  lon: number;
  pm25: number;
  aqi: number;
  predictedPM25: number;
  confidence: ConfidenceLevel;
}

export interface Hotspot {
  id: string;
  name: string;
  lat: number;
  lon: number;
  intensity: number; // 0.0 - 1.0 scale
  hchoMolM2: number; // 10^-4 mol/m^2
}

export interface FireAnomaly {
  id: string;
  name: string;
  lat: number;
  lon: number;
  frp: number; // Fire Radiative Power (MW)
  confidence: string;
}

export interface ModelMetrics {
  mae: number;
  rmse: number;
  r2: number;
  lastUpdated: string;
  featuresUsed: string[];
  sampleSize: number;
}

// Check backend connectivity with fast timeout
export const checkBackendHealth = async (): Promise<boolean> => {
  try {
    const res = await client.get('/health');
    return res.status === 200;
  } catch {
    return false;
  }
};

// Realistic mock India data
const MOCK_GRID: AQIGridCell[] = [
  { id: 'grid-delhi', name: 'Delhi NCR Hub', lat: 28.6139, lon: 77.2090, aqi: 342, pm25: 184.2, groundPM25: 178.5, confidence: 'High' },
  { id: 'grid-noida', name: 'Noida Industrial Zone', lat: 28.5355, lon: 77.3910, aqi: 318, pm25: 168.0, groundPM25: 172.0, confidence: 'High' },
  { id: 'grid-gurugram', name: 'Gurugram Cyber City', lat: 28.4595, lon: 77.0266, aqi: 285, pm25: 142.4, groundPM25: 135.0, confidence: 'Medium' },
  { id: 'grid-lucknow', name: 'Lucknow Central Plain', lat: 26.8467, lon: 80.9462, aqi: 245, pm25: 118.6, groundPM25: 110.0, confidence: 'High' },
  { id: 'grid-patna', name: 'Patna Gangetic Basin', lat: 25.5941, lon: 85.1376, aqi: 290, pm25: 154.1, groundPM25: 160.2, confidence: 'Medium' },
  { id: 'grid-kolkata', name: 'Kolkata Metropolitan', lat: 22.5726, lon: 88.3639, aqi: 178, pm25: 88.5, groundPM25: 82.0, confidence: 'High' },
  { id: 'grid-mumbai', name: 'Mumbai Coastal Corridor', lat: 19.0760, lon: 72.8777, aqi: 135, pm25: 64.2, groundPM25: 60.1, confidence: 'High' },
  { id: 'grid-ahmedabad', name: 'Ahmedabad Sabarmati', lat: 23.0225, lon: 72.5714, aqi: 162, pm25: 79.8, groundPM25: 75.3, confidence: 'Medium' },
  { id: 'grid-bhopal', name: 'Bhopal Central Highlands', lat: 23.2599, lon: 77.4126, aqi: 112, pm25: 48.0, groundPM25: 45.2, confidence: 'High' },
  { id: 'grid-nagpur', name: 'Nagpur Vidarbha Hub', lat: 21.1458, lon: 79.0882, aqi: 94, pm25: 38.6, groundPM25: 40.0, confidence: 'High' },
  { id: 'grid-hyderabad', name: 'Hyderabad Deccan', lat: 17.3850, lon: 78.4867, aqi: 88, pm25: 35.4, groundPM25: 36.8, confidence: 'High' },
  { id: 'grid-bengaluru', name: 'Bengaluru Plateau', lat: 12.9716, lon: 77.5946, aqi: 48, pm25: 18.2, groundPM25: 19.0, confidence: 'High' },
  { id: 'grid-chennai', name: 'Chennai Coromandel', lat: 13.0827, lon: 80.2707, aqi: 72, pm25: 28.5, groundPM25: 30.1, confidence: 'High' },
  { id: 'grid-punjab', name: 'Amritsar Agricultural Belt', lat: 31.6340, lon: 74.8723, aqi: 368, pm25: 210.4, groundPM25: 204.0, confidence: 'Medium' },
  { id: 'grid-jaipur', name: 'Jaipur Semi-Arid', lat: 26.9124, lon: 75.7873, aqi: 198, pm25: 98.7, groundPM25: 104.2, confidence: 'Low' },
  { id: 'grid-guwahati', name: 'Guwahati Valley', lat: 26.1445, lon: 91.7362, aqi: 85, pm25: 34.0, groundPM25: 32.5, confidence: 'Medium' }
];

const MOCK_STATIONS: Station[] = [
  { id: 'cpcb-ito', name: 'CPCB - ITO, New Delhi', lat: 28.6289, lon: 77.2405, pm25: 182.0, aqi: 340, predictedPM25: 188.4, confidence: 'High' },
  { id: 'cpcb-anand-vihar', name: 'CPCB - Anand Vihar, Delhi', lat: 28.6502, lon: 77.3150, pm25: 224.5, aqi: 382, predictedPM25: 215.0, confidence: 'High' },
  { id: 'cpcb-bkc', name: 'CPCB - Bandra Kurla, Mumbai', lat: 19.0662, lon: 72.8688, pm25: 68.4, aqi: 142, predictedPM25: 62.1, confidence: 'High' },
  { id: 'cpcb-btm', name: 'CPCB - BTM Layout, Bengaluru', lat: 12.9166, lon: 77.6101, pm25: 19.8, aqi: 49, predictedPM25: 18.0, confidence: 'High' },
  { id: 'cpcb-victoria', name: 'CPCB - Victoria Memorial, Kolkata', lat: 22.5448, lon: 88.3426, pm25: 92.1, aqi: 184, predictedPM25: 86.4, confidence: 'High' },
  { id: 'cpcb-sanathnagar', name: 'CPCB - Sanathnagar, Hyderabad', lat: 17.4566, lon: 78.4439, pm25: 38.0, aqi: 92, predictedPM25: 35.2, confidence: 'High' },
  { id: 'cpcb-maninagar', name: 'CPCB - Maninagar, Ahmedabad', lat: 22.9978, lon: 72.6033, pm25: 81.2, aqi: 165, predictedPM25: 78.0, confidence: 'Medium' },
  { id: 'cpcb-amritsar', name: 'CPCB - Golden Temple, Amritsar', lat: 31.6200, lon: 74.8765, pm25: 218.0, aqi: 374, predictedPM25: 209.5, confidence: 'High' }
];

const MOCK_HOTSPOTS: Hotspot[] = [
  { id: 'hcho-1', name: 'Indo-Gangetic Industrial HCHO Plume', lat: 28.5, lon: 77.8, intensity: 0.94, hchoMolM2: 24.5 },
  { id: 'hcho-2', name: 'Singrauli Thermal Power Cluster', lat: 24.2, lon: 82.6, intensity: 0.88, hchoMolM2: 21.8 },
  { id: 'hcho-3', name: 'Mumbai-Thane Chemical Belt', lat: 19.2, lon: 73.0, intensity: 0.76, hchoMolM2: 18.2 },
  { id: 'hcho-4', name: 'Petrochemical Corridor, Gujarat', lat: 22.3, lon: 73.1, intensity: 0.82, hchoMolM2: 19.9 },
  { id: 'hcho-5', name: 'Chhota Nagpur Smelting Zone', lat: 23.8, lon: 86.2, intensity: 0.85, hchoMolM2: 20.4 }
];

const MOCK_FIRES: FireAnomaly[] = [
  { id: 'fire-1', name: 'Stubble Burn Cluster A (Sangrur, Punjab)', lat: 30.245, lon: 75.842, frp: 148.5, confidence: '98%' },
  { id: 'fire-2', name: 'Biomass Residue Burning (Bathinda, Punjab)', lat: 30.211, lon: 74.945, frp: 182.0, confidence: '99%' },
  { id: 'fire-3', name: 'Agricultural Fire Event (Karnal, Haryana)', lat: 29.685, lon: 76.990, frp: 96.2, confidence: '92%' },
  { id: 'fire-4', name: 'Forest/Brush Clearing (Central Odisha)', lat: 20.850, lon: 84.600, frp: 64.0, confidence: '85%' },
  { id: 'fire-5', name: 'Field Fire (Western UP Plains)', lat: 28.980, lon: 78.200, frp: 88.4, confidence: '91%' }
];

const MOCK_METRICS: ModelMetrics = {
  mae: 8.42,
  rmse: 12.18,
  r2: 0.89,
  lastUpdated: '2026-11-01T06:00:00Z',
  sampleSize: 142850,
  featuresUsed: [
    'Sentinel-5P TROPOMI: HCHO & NO2 Tropospheric Vertical Columns',
    'MODIS & VIIRS: Active Fire Radiative Power (FRP) & Thermal Anomalies',
    'ERA5 Reanalysis: Planetary Boundary Layer Height (PBLH), 10m U/V Wind Vectors',
    'Copernicus Surface Temperature & Relative Humidity',
    'NASA SRTM Digital Elevation Model (Topographic Terrain Ruggedness)',
    'CPCB Continuous Ambient Air Quality Monitoring (CAAQMS) Ground Truth'
  ]
};

export const fetchAQIGrid = async (): Promise<AQIGridCell[]> => {
  try {
    const { data } = await client.get<AQIGridCell[]>('/api/v1/aqi/grid');
    return data;
  } catch {
    return MOCK_GRID;
  }
};

export const fetchStations = async (): Promise<Station[]> => {
  try {
    const { data } = await client.get<Station[]>('/api/v1/stations');
    return data;
  } catch {
    return MOCK_STATIONS;
  }
};

export const fetchHotspots = async (): Promise<Hotspot[]> => {
  try {
    const { data } = await client.get<Hotspot[]>('/api/v1/hotspots');
    return data;
  } catch {
    return MOCK_HOTSPOTS;
  }
};

export const fetchFires = async (): Promise<FireAnomaly[]> => {
  try {
    const { data } = await client.get<FireAnomaly[]>('/api/v1/fires');
    return data;
  } catch {
    return MOCK_FIRES;
  }
};

export const fetchModelMetrics = async (): Promise<ModelMetrics> => {
  try {
    const { data } = await client.get<ModelMetrics>('/api/v1/model/metrics');
    return data;
  } catch {
    return MOCK_METRICS;
  }
};
