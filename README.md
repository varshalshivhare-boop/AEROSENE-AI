# Aerosense AI — Environmental Intelligence Dashboard (Phase 5)

Modern Next.js 13+ / React, Tailwind CSS, MapLibre GL, and Recharts geospatial intelligence dashboard for Aerosense AI.

## Features
- **MapLibre GL Geospatial Engine**: Centered on India (`coords: [22.5, 78.9]`, `zoom: 5`) with dark/modern base raster tiles.
- **Layer 1: Predicted AQI Grid**: Sentinel-5P inference interpolation colored with standard CPCB thresholds (Good `#00b050` to Severe `#7e0023`).
- **Layer 2: CPCB Ground Stations**: Live CAAQMS in-situ telemetry markers with real-time popup cards.
- **Layer 3: HCHO Hotspots**: Formaldehyde industrial/thermal plume detection with animated gas markers.
- **Layer 4: Active Biomass Fires**: VIIRS/MODIS fire anomalies with Fire Radiative Power (MW) telemetry.
- **Floating Layer Controls**: Toggle between any combination of the 4 intelligence layers.
- **Interactive Details Drawer**:
  - Location Name & Lat/Lon Coordinates
  - Estimated PM2.5 (µg/m³) & CPCB category badge
  - Model Confidence badge (High / Medium / Low)
  - Recharts 7-day trend line graph comparing predictions with ground monitors
  - Ground monitor vs. predicted delta analysis
- **Model Methodology & Accuracy Modal**:
  - Cross-validation performance cards: **MAE**, **RMSE**, and **R²** fetched from `/api/v1/model/metrics`
  - Pipeline feature breakdown (Sentinel-5P, MODIS/VIIRS, ERA5, SRTM, CAAQMS)
  - Operating bounds disclaimer: *"Decision-support estimate; complements ground stations."*
- **Offline Fallback Architecture**: Automatic graceful fallback to realistic simulated Indian telemetry if backend (`http://localhost:8000`) is offline.

## Project Structure
```
web_client/
├── src/
│   ├── app/
│   │   ├── globals.css         # Tailwind & custom dark styling
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Main dashboard shell & dynamic map loader
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── DetailsDrawer.tsx   # Recharts PM2.5 analysis & delta drawer
│   │   │   └── LayerControls.tsx   # Floating multi-layer toggle widget
│   │   ├── map/
│   │   │   └── Map.tsx             # MapLibre GL dark map & layer rendering
│   │   └── modals/
│   │       └── TransparencyModal.tsx # Model metrics (MAE/RMSE/R2) & disclaimer
│   └── services/
│       └── api.ts              # API client for http://localhost:8000 with offline fallback
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run development server**:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.
