// ============================================================
// AeroSense AI — Formatting Utilities
// ============================================================

/**
 * Formats a number to a fixed number of decimal places.
 * Returns '—' for null/undefined values.
 */
export function fmt(
  value: number | null | undefined,
  decimals = 1,
  unit = ''
): string {
  if (value == null || isNaN(value)) return '—';
  const formatted = value.toFixed(decimals);
  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * Formats a PM2.5 concentration value.
 */
export function fmtPM25(value: number | null | undefined): string {
  return fmt(value, 1, 'µg/m³');
}

/**
 * Formats a metric value (MAE, RMSE, R²).
 */
export function fmtMetric(
  value: number | null | undefined,
  key: 'mae' | 'rmse' | 'r2'
): string {
  if (value == null || isNaN(value)) return 'Unavailable';
  if (key === 'r2') return value.toFixed(3);
  return value.toFixed(2);
}

/**
 * Formats an ISO timestamp to a human-readable date+time.
 */
export function fmtTimestamp(iso: string | undefined | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    return iso;
  }
}

/**
 * Formats an ISO date to a short chart label.
 */
export function fmtChartDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    return iso;
  }
}

/**
 * Returns a formatted lat/lng string.
 */
export function fmtCoords(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lngDir}`;
}

/**
 * Relative time — "2 hours ago", "3 days ago".
 */
export function fmtRelativeTime(iso: string | undefined | null): string {
  if (!iso) return '—';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return iso;
  }
}

/**
 * Clamps a number between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Generates a color between two hex colors based on t in [0,1].
 */
export function lerpColor(hexA: string, hexB: string, t: number): string {
  const parse = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = parse(hexA);
  const [r2, g2, b2] = parse(hexB);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
