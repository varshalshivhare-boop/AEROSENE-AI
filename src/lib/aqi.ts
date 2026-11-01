// ============================================================
// AeroSense AI — AQI Calculation Utilities
// Source: CPCB AQI methodology
// ============================================================

import type { AQICategory } from '@/types/environment';

export interface AQIBreakpoint {
  category: AQICategory;
  /** CPCB AQI range (inclusive) */
  aqiLow: number;
  aqiHigh: number;
  /** PM2.5 concentration range (µg/m³) */
  pm25Low: number;
  pm25High: number;
  color: string;
  textColor: string;
  bgColor: string;
  description: string;
}

/**
 * CPCB AQI breakpoints for PM2.5.
 * Reference: CPCB AQI bulletin methodology.
 * Note: These are concentration ranges used to compute AQI,
 * not direct concentration values displayed as "AQI".
 */
export const AQI_BREAKPOINTS: AQIBreakpoint[] = [
  {
    category: 'Good',
    aqiLow: 0,
    aqiHigh: 50,
    pm25Low: 0,
    pm25High: 30,
    color: '#22c55e',
    textColor: '#14532d',
    bgColor: '#dcfce7',
    description: 'Air quality is satisfactory and poses little or no risk.',
  },
  {
    category: 'Satisfactory',
    aqiLow: 51,
    aqiHigh: 100,
    pm25Low: 30.1,
    pm25High: 60,
    color: '#86efac',
    textColor: '#166534',
    bgColor: '#f0fdf4',
    description: 'Acceptable air quality; minor concern for sensitive individuals.',
  },
  {
    category: 'Moderate',
    aqiLow: 101,
    aqiHigh: 200,
    pm25Low: 60.1,
    pm25High: 90,
    color: '#fbbf24',
    textColor: '#78350f',
    bgColor: '#fef3c7',
    description: 'Sensitive groups may experience health effects.',
  },
  {
    category: 'Poor',
    aqiLow: 201,
    aqiHigh: 300,
    pm25Low: 90.1,
    pm25High: 120,
    color: '#f97316',
    textColor: '#7c2d12',
    bgColor: '#ffedd5',
    description: 'Everyone may begin to experience health effects.',
  },
  {
    category: 'Very Poor',
    aqiLow: 301,
    aqiHigh: 400,
    pm25Low: 120.1,
    pm25High: 250,
    color: '#ef4444',
    textColor: '#7f1d1d',
    bgColor: '#fee2e2',
    description: 'Health warnings; everyone may experience serious health effects.',
  },
  {
    category: 'Severe',
    aqiLow: 401,
    aqiHigh: 500,
    pm25Low: 250.1,
    pm25High: 500,
    color: '#7f1d1d',
    textColor: '#fecaca',
    bgColor: '#450a0a',
    description: 'Emergency conditions; serious risk for entire population.',
  },
];

/**
 * Returns AQI category for a given PM2.5 concentration.
 * This is an approximation using CPCB PM2.5 sub-index ranges.
 * It is NOT an official CPCB AQI value (which requires multiple pollutants).
 */
export function getCategoryFromPM25(pm25: number): AQICategory {
  for (const bp of AQI_BREAKPOINTS) {
    if (pm25 >= bp.pm25Low && pm25 <= bp.pm25High) {
      return bp.category;
    }
  }
  if (pm25 > 500) return 'Severe';
  return 'Unknown';
}

/**
 * Returns the AQI breakpoint config for a given category.
 */
export function getBreakpoint(category: AQICategory): AQIBreakpoint | undefined {
  return AQI_BREAKPOINTS.find((bp) => bp.category === category);
}

/**
 * Returns the color hex for a given AQI category.
 */
export function getCategoryColor(category: AQICategory): string {
  return getBreakpoint(category)?.color ?? '#64748b';
}

/**
 * Returns a CSS rgba string with optional opacity for map overlays.
 */
export function getCategoryColorRGBA(category: AQICategory, opacity = 0.6): string {
  const hex = getCategoryColor(category);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

/**
 * Simple linear sub-index interpolation for PM2.5 → AQI.
 * Returns null if the value is out of supported range.
 * This should NOT be displayed as an official CPCB AQI unless
 * all required pollutants are included.
 */
export function pm25ToSubIndex(pm25: number): number | null {
  const bp = AQI_BREAKPOINTS.find(
    (b) => pm25 >= b.pm25Low && pm25 <= b.pm25High
  );
  if (!bp) return null;
  return Math.round(
    ((bp.aqiHigh - bp.aqiLow) / (bp.pm25High - bp.pm25Low)) *
      (pm25 - bp.pm25Low) +
      bp.aqiLow
  );
}
