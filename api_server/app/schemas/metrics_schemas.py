import os
import json
from typing import Dict, Any, List
from pydantic import BaseModel

class MetricStats(BaseModel):
    mae: float
    rmse: float
    r2: float
    samples: int

class SeasonalMetrics(BaseModel):
    monsoon: MetricStats
    post_monsoon: MetricStats
    summer: MetricStats
    winter: MetricStats

class ModelMetricsResponse(BaseModel):
    model_name: str
    architecture: str
    validation_strategy: str
    overall_performance: MetricStats
    seasonal_breakdown: SeasonalMetrics
    top_features: List[str]
    disclaimer: str
