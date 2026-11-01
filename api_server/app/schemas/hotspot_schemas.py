from typing import List, Optional
from pydantic import BaseModel

class HotspotContext(BaseModel):
    nearby_fires_50km: int
    min_fire_dist_km: float
    wind_direction_cardinal: str
    wind_speed_ms: float
    satellite_sensor: str
    scientific_disclaimer: str

class HCHOHotspot(BaseModel):
    hotspot_id: str
    region: str
    lat: float
    lon: float
    hcho_column_mol_m2: float
    z_score: float
    severity: str
    timestamp: str
    context: HotspotContext

class HotspotResponse(BaseModel):
    total_anomalies: int
    detected_at: str
    hotspots: List[HCHOHotspot]
