from typing import List, Optional
from pydantic import BaseModel

class CPCBStation(BaseModel):
    station_id: str
    station_name: str
    city: str
    state: str
    lat: float
    lon: float
    ground_pm25: float
    satellite_pm25_estimate: float
    absolute_error_delta: float
    ground_aqi: int
    ground_category: str
    color_hex: str
    last_updated: str

class StationResponse(BaseModel):
    total_active_monitors: int
    data_source: str
    stations: List[CPCBStation]

# Time series historical trend
class HistoryTrendPoint(BaseModel):
    date: str
    pm25_estimate: float
    aqi: int
    category: str
    color_hex: str
    aod: float

class LocationHistoryResponse(BaseModel):
    lat: float
    lon: float
    location_name: str
    period_days: int
    history: List[HistoryTrendPoint]
