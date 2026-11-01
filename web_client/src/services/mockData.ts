// ============================================================
// AeroSense AI — Mock Data Provider
// ============================================================
//
// This file contains clearly fictional demonstration data.
// It is used ONLY when NEXT_PUBLIC_USE_MOCK_DATA=true or when
// the backend is unreachable.
//
// IMPORTANT: This data must NEVER be labeled as live, verified,
// or measured. It exists solely to demonstrate UI functionality.

import type {
  AQIGridCell,
  CPCBStation,
  HCHOHotspot,
  FireDetection,
  TrendDataPoint,
} from '@/types/environment';
import { getCategoryFromPM25 } from '@/lib/aqi';

// ---- Demo AQI Grid Cells ----
// Coarse grid over major Indian cities — NOT real measurements

export const MOCK_AQI_GRID: AQIGridCell[] = [
  // Delhi NCR
  {
    id: 'grid-delhi-1',
    lat: 28.65,
    lng: 77.2,
    cellSizeDeg: 0.5,
    pm25: 187,
    aqi: 287,
    category: 'Very Poor',
    timestamp: '2026-11-01T06:00:00Z',
    dataType: 'model_estimate',
    confidence: 'Medium',
    regionName: 'Delhi NCR',
  },
  {
    id: 'grid-delhi-2',
    lat: 28.45,
    lng: 77.05,
    cellSizeDeg: 0.5,
    pm25: 210,
    aqi: 330,
    category: 'Severe',
    timestamp: '2026-11-01T06:00:00Z',
    dataType: 'model_estimate',
    confidence: 'Medium',
    regionName: 'Gurugram',
  },
  // Mumbai
  {
    id: 'grid-mumbai-1',
    lat: 19.08,
    lng: 72.88,
    cellSizeDeg: 0.5,
    pm25: 65,
    aqi: 138,
    category: 'Moderate',
    timestamp: '2026-11-01T06:00:00Z',
    dataType: 'model_estimate',
    confidence: 'High',
    regionName: 'Mumbai',
  },
  // Kolkata
  {
    id: 'grid-kolkata-1',
    lat: 22.56,
    lng: 88.36,
    cellSizeDeg: 0.5,
    pm25: 145,
    aqi: 230,
    category: 'Poor',
    timestamp: '2026-11-01T06:00:00Z',
    dataType: 'model_estimate',
    confidence: 'Medium',
    regionName: 'Kolkata',
  },
  // Chennai
  {
    id: 'grid-chennai-1',
    lat: 13.08,
    lng: 80.27,
    cellSizeDeg: 0.5,
    pm25: 42,
    category: getCategoryFromPM25(42),
    timestamp: '2026-11-01T06:00:00Z',
    dataType: 'model_estimate',
    confidence: 'High',
    regionName: 'Chennai',
  },
  // Bengaluru
  {
    id: 'grid-bengaluru-1',
    lat: 12.97,
    lng: 77.59,
    cellSizeDeg: 0.5,
    pm25: 55,
    category: getCategoryFromPM25(55),
    timestamp: '2026-11-01T06:00:00Z',
    dataType: 'model_estimate',
    confidence: 'High',
    regionName: 'Bengaluru',
  },
  // Hyderabad
  {
    id: 'grid-hyderabad-1',
    lat: 17.38,
    lng: 78.49,
    cellSizeDeg: 0.5,
    pm25: 78,
    category: getCategoryFromPM25(78),
    timestamp: '2026-11-01T06:00:00Z',
    dataType: 'model_estimate',
    confidence: 'High',
    regionName: 'Hyderabad',
  },
  // Ahmedabad
  {
    id: 'grid-ahmedabad-1',
    lat: 23.03,
    lng: 72.58,
    cellSizeDeg: 0.5,
    pm25: 110,
    category: getCategoryFromPM25(110),
    timestamp: '2026-11-01T06:00:00Z',
    dataType: 'model_estimate',
    confidence: 'Medium',
    regionName: 'Ahmedabad',
  },
  // Lucknow
  {
    id: 'grid-lucknow-1',
    lat: 26.85,
    lng: 80.95,
    cellSizeDeg: 0.5,
    pm25: 168,
    category: getCategoryFromPM25(168),
    timestamp: '2026-11-01T06:00:00Z',
    dataType: 'model_estimate',
    confidence: 'Low',
    regionName: 'Lucknow',
  },
  // Kanpur
  {
    id: 'grid-kanpur-1',
    lat: 26.47,
    lng: 80.33,
    cellSizeDeg: 0.5,
    pm25: 195,
    category: getCategoryFromPM25(195),
    timestamp: '2026-11-01T06:00:00Z',
    dataType: 'model_estimate',
    confidence: 'Low',
    regionName: 'Kanpur',
  },
  // Patna
  {
    id: 'grid-patna-1',
    lat: 25.61,
    lng: 85.14,
    cellSizeDeg: 0.5,
    pm25: 158,
    category: getCategoryFromPM25(158),
    timestamp: '2026-11-01T06:00:00Z',
    dataType: 'model_estimate',
    confidence: 'Low',
    regionName: 'Patna',
  },
  // Pune
  {
    id: 'grid-pune-1',
    lat: 18.52,
    lng: 73.86,
    cellSizeDeg: 0.5,
    pm25: 58,
    category: getCategoryFromPM25(58),
    timestamp: '2026-11-01T06:00:00Z',
    dataType: 'model_estimate',
    confidence: 'High',
    regionName: 'Pune',
  },
  // Jaipur
  {
    id: 'grid-jaipur-1',
    lat: 26.91,
    lng: 75.79,
    cellSizeDeg: 0.5,
    pm25: 95,
    category: getCategoryFromPM25(95),
    timestamp: '2026-11-01T06:00:00Z',
    dataType: 'model_estimate',
    confidence: 'Medium',
    regionName: 'Jaipur',
  },
];

// ---- Demo CPCB Stations ----

export const MOCK_STATIONS: CPCBStation[] = [
  {
    id: 'stn-delhi-anand',
    name: 'Anand Vihar',
    lat: 28.647,
    lng: 77.316,
    city: 'Delhi',
    state: 'Delhi',
    pm25: 201,
    pm10: 310,
    aqi: 315,
    category: 'Severe',
    lastUpdated: '2026-11-01T05:30:00Z',
    status: 'Active',
    pollutants: ['PM2.5', 'PM10', 'NO2', 'SO2'],
  },
  {
    id: 'stn-delhi-igi',
    name: 'IGI Airport (T3)',
    lat: 28.556,
    lng: 77.1,
    city: 'Delhi',
    state: 'Delhi',
    pm25: 178,
    pm10: 265,
    aqi: 275,
    category: 'Very Poor',
    lastUpdated: '2026-11-01T05:30:00Z',
    status: 'Active',
    pollutants: ['PM2.5', 'PM10'],
  },
  {
    id: 'stn-mumbai-bkc',
    name: 'Bandra Kurla Complex',
    lat: 19.065,
    lng: 72.868,
    city: 'Mumbai',
    state: 'Maharashtra',
    pm25: 58,
    pm10: 95,
    aqi: 130,
    category: 'Moderate',
    lastUpdated: '2026-11-01T05:30:00Z',
    status: 'Active',
    pollutants: ['PM2.5', 'PM10', 'NO2'],
  },
  {
    id: 'stn-kolkata-rabindra',
    name: 'Rabindra Bharati',
    lat: 22.584,
    lng: 88.363,
    city: 'Kolkata',
    state: 'West Bengal',
    pm25: 132,
    pm10: 198,
    aqi: 215,
    category: 'Poor',
    lastUpdated: '2026-11-01T05:00:00Z',
    status: 'Active',
    pollutants: ['PM2.5', 'PM10'],
  },
  {
    id: 'stn-chennai-manali',
    name: 'Manali Industrial Area',
    lat: 13.168,
    lng: 80.265,
    city: 'Chennai',
    state: 'Tamil Nadu',
    pm25: 72,
    pm10: 118,
    aqi: 155,
    category: 'Moderate',
    lastUpdated: '2026-11-01T05:30:00Z',
    status: 'Active',
    pollutants: ['PM2.5', 'PM10', 'SO2', 'NO2'],
  },
  {
    id: 'stn-bengaluru-silk',
    name: 'Silk Board Junction',
    lat: 12.917,
    lng: 77.623,
    city: 'Bengaluru',
    state: 'Karnataka',
    pm25: 62,
    pm10: 98,
    aqi: 140,
    category: 'Moderate',
    lastUpdated: '2026-11-01T05:30:00Z',
    status: 'Active',
    pollutants: ['PM2.5', 'PM10'],
  },
  {
    id: 'stn-hyderabad-icp',
    name: 'ICP Bollaram',
    lat: 17.487,
    lng: 78.345,
    city: 'Hyderabad',
    state: 'Telangana',
    pm25: 88,
    pm10: 140,
    aqi: 175,
    category: 'Moderate',
    lastUpdated: '2026-11-01T05:00:00Z',
    status: 'Active',
    pollutants: ['PM2.5', 'PM10', 'NO2'],
  },
  {
    id: 'stn-lucknow-lko',
    name: 'Lal Bagh',
    lat: 26.842,
    lng: 80.927,
    city: 'Lucknow',
    state: 'Uttar Pradesh',
    pm25: 160,
    pm10: 245,
    aqi: 258,
    category: 'Very Poor',
    lastUpdated: '2026-11-01T04:30:00Z',
    status: 'Active',
    pollutants: ['PM2.5', 'PM10'],
  },
];

// ---- Demo HCHO Hotspots ----
// These are fictional values illustrating the UI.
// Real HCHO observations come from Sentinel-5P TROPOMI.

export const MOCK_HCHO_HOTSPOTS: HCHOHotspot[] = [
  {
    id: 'hcho-1',
    lat: 29.1,
    lng: 76.9,
    hchoColumnDU: 8.4,
    hchoValue: 8.4e-4,
    hchoUnit: 'mol/m²',
    observationTime: '2026-10-31T07:15:00Z',
    satellite: 'Sentinel-5P',
    instrument: 'TROPOMI',
    intensity: 'High',
    regionName: 'Haryana (Demo)',
    note: 'Elevated HCHO column observed. May indicate agricultural burning or industrial emissions. Requires ground verification.',
  },
  {
    id: 'hcho-2',
    lat: 25.4,
    lng: 83.0,
    hchoColumnDU: 6.8,
    hchoValue: 6.8e-4,
    hchoUnit: 'mol/m²',
    observationTime: '2026-10-31T07:15:00Z',
    satellite: 'Sentinel-5P',
    instrument: 'TROPOMI',
    intensity: 'Elevated',
    regionName: 'Eastern UP (Demo)',
    note: 'Elevated HCHO. Potential contribution from crop residue burning or biomass burning.',
  },
  {
    id: 'hcho-3',
    lat: 22.3,
    lng: 73.2,
    hchoColumnDU: 5.2,
    hchoValue: 5.2e-4,
    hchoUnit: 'mol/m²',
    observationTime: '2026-10-31T07:15:00Z',
    satellite: 'Sentinel-5P',
    instrument: 'TROPOMI',
    intensity: 'Elevated',
    regionName: 'South Gujarat (Demo)',
  },
  {
    id: 'hcho-4',
    lat: 20.5,
    lng: 85.8,
    hchoColumnDU: 7.1,
    hchoValue: 7.1e-4,
    hchoUnit: 'mol/m²',
    observationTime: '2026-10-31T07:15:00Z',
    satellite: 'Sentinel-5P',
    instrument: 'TROPOMI',
    intensity: 'High',
    regionName: 'Eastern Odisha (Demo)',
  },
];

// ---- Demo Fire Detections ----

export const MOCK_FIRES: FireDetection[] = [
  {
    id: 'fire-1',
    lat: 29.35,
    lng: 75.6,
    acqDate: '2026-10-31',
    acqTime: '0620',
    satellite: 'MODIS (Aqua)',
    instrument: 'MODIS',
    confidence: 'nominal',
    brightness: 334.5,
    frp: 18.2,
    daynight: 'D',
    regionName: 'Haryana (Demo)',
  },
  {
    id: 'fire-2',
    lat: 30.1,
    lng: 74.2,
    acqDate: '2026-10-31',
    acqTime: '0620',
    satellite: 'MODIS (Terra)',
    instrument: 'MODIS',
    confidence: 'high',
    brightness: 358.1,
    frp: 32.7,
    daynight: 'D',
    regionName: 'Punjab (Demo)',
  },
  {
    id: 'fire-3',
    lat: 29.7,
    lng: 76.8,
    acqDate: '2026-10-31',
    acqTime: '0655',
    satellite: 'VIIRS (NPP)',
    instrument: 'VIIRS',
    confidence: 'nominal',
    brightness: 340.2,
    frp: 22.1,
    daynight: 'D',
    regionName: 'Haryana (Demo)',
  },
  {
    id: 'fire-4',
    lat: 25.9,
    lng: 83.5,
    acqDate: '2026-10-31',
    acqTime: '0700',
    satellite: 'VIIRS (NPP)',
    instrument: 'VIIRS',
    confidence: 'low',
    brightness: 312.8,
    frp: 8.4,
    daynight: 'D',
    regionName: 'Eastern UP (Demo)',
  },
];

// ---- 7-day Demo Trend ----

function generateTrend(
  basePM25: number,
  locationId: string
): TrendDataPoint[] {
  const now = new Date('2026-11-01T00:00:00Z');
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    const noise = () => (Math.random() - 0.5) * basePM25 * 0.2;
    return {
      date: d.toISOString().split('T')[0],
      observed: i < 5 ? Math.max(0, basePM25 + noise()) : undefined,
      predicted: Math.max(0, basePM25 * (1 + (i - 3) * 0.03) + noise()),
      pm25: Math.max(0, basePM25 + noise()),
    };
  });
}

export const MOCK_TRENDS: Record<string, TrendDataPoint[]> = {
  'grid-delhi-1': generateTrend(187, 'grid-delhi-1'),
  'grid-mumbai-1': generateTrend(65, 'grid-mumbai-1'),
  'grid-kolkata-1': generateTrend(145, 'grid-kolkata-1'),
  'stn-delhi-anand': generateTrend(201, 'stn-delhi-anand'),
  'stn-mumbai-bkc': generateTrend(58, 'stn-mumbai-bkc'),
  default: generateTrend(120, 'default'),
};

export function getMockTrend(id: string): TrendDataPoint[] {
  return MOCK_TRENDS[id] ?? MOCK_TRENDS.default;
}
