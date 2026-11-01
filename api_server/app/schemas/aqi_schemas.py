from typing import Any, List, Optional
from pydantic import BaseModel, Field

# --- Geometry & GeoJSON Schemas ---
class GeoJSONGeometry(BaseModel):
    type: str = "Point"
    coordinates: List[float] # [lon, lat]

class AQIFeatureProperties(BaseModel):
    id: str
    location_name: str
    region: str
    pm25_estimate: Optional[float]
    aqi: Optional[int]
    category: str
    color_hex: str
    confidence: str
    cloud_fraction: float
    aod: Optional[float]
    hcho_column: Optional[float]
    timestamp: str

class AQIGeoJSONFeature(BaseModel):
    type: str = "Feature"
    geometry: GeoJSONGeometry
    properties: AQIFeatureProperties

class AQIGeoJSONResponse(BaseModel):
    type: str = "FeatureCollection"
    generated_at: str
    total_grid_points: int
    features: List[AQIGeoJSONFeature]

# --- Single Prediction Request / Response ---
class PredictRequest(BaseModel):
    lat: float = Field(..., ge=-90.0, le=90.0, example=28.6139)
    lon: float = Field(..., ge=-180.0, le=180.0, example=77.2090)
    aod: float = Field(..., ge=0.0, le=5.0, example=0.85)
    hcho_mol_m2: Optional[float] = Field(0.00015, example=0.000185)
    temp_2m_k: Optional[float] = Field(298.15, example=301.15)
    relative_humidity: Optional[float] = Field(50.0, example=55.0)
    wind_u: Optional[float] = Field(1.5, example=2.1)
    wind_v: Optional[float] = Field(-0.8, example=-1.2)
    pbl_height_m: Optional[float] = Field(800.0, example=850.0)
    fire_count_50km: Optional[int] = Field(0, example=12)
    min_dist_fire_km: Optional[float] = Field(999.0, example=14.5)
    cloud_fraction: Optional[float] = Field(0.05, example=0.10)

class PredictResponse(BaseModel):
    coordinates: List[float]
    pm25_estimate: Optional[float]
    aqi: Optional[int]
    category: str
    color_hex: str
    advisory: str
    confidence: str
    status: str
    derived_metrics: Optional[dict] = None
