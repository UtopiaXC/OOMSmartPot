"""
Pydantic schemas for API request/response models.
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


# ---- Sensor ----

class SensorReadingsResponse(BaseModel):
    timestamp: datetime
    temperature_celsius: float
    atmosphere_hpa: float
    soil_moisture_percent: float
    model_config = ConfigDict(from_attributes=True)


class SensorReadingsHistoryResponse(BaseModel):
    total_records: int
    records: List[SensorReadingsResponse]


# ---- Pump ----

class PumpActionRequest(BaseModel):
    action: str
    duration_milliseconds: int


class PumpActionResponse(BaseModel):
    status: str
    message: str
    estimated_end_time: datetime


class PumpStatusResponse(BaseModel):
    is_running: bool
    last_executed_time: datetime
    last_duration_milliseconds: int
    hardware_healthy: bool


class PumpStopResponse(BaseModel):
    status: str
    message: str


# ---- AI ----

class AiTriggerResponse(BaseModel):
    triggered_at: datetime
    status: str
    ai_decision_summary: str
    schedules_updated: bool


# ---- Schedule ----

class ScheduleItem(BaseModel):
    schedule_id: str
    planned_time: datetime
    duration_milliseconds: int
    executed: bool
    model_config = ConfigDict(from_attributes=True)


class UpcomingScheduleResponse(BaseModel):
    generated_at: datetime
    ai_decision_summary: str
    schedules: List[ScheduleItem]


class HistoryRecordItem(BaseModel):
    executed_at: datetime
    trigger_type: str
    duration_milliseconds: int
    status: str
    soil_moisture_before: float
    soil_moisture_after: float
    model_config = ConfigDict(from_attributes=True)


class ScheduleHistoryResponse(BaseModel):
    total_records: int
    records: List[HistoryRecordItem]


# ---- Suggestions ----

class SuggestionItem(BaseModel):
    suggestion_id: str
    category: str
    title: str
    description: str
    priority: str
    model_config = ConfigDict(from_attributes=True)


class AiSuggestionsResponse(BaseModel):
    timestamp: datetime
    suggestions: List[SuggestionItem]


# ---- System Config ----

class SystemConfigPayload(BaseModel):
    sensor_read_interval_seconds: Optional[int] = None
    ai_evaluation_cron: Optional[str] = None
    safety_max_duration_milliseconds: Optional[int] = None


class SystemConfigResponse(BaseModel):
    sensor_read_interval_seconds: int
    ai_evaluation_cron: str
    safety_max_duration_milliseconds: int
    model_config = ConfigDict(from_attributes=True)


# ---- General ----

class GeneralSuccessResponse(BaseModel):
    status: str
    message: str


# ---- Camera ----

class CameraSnapshotResponse(BaseModel):
    timestamp: datetime
    image_base64: str
    format: str = "jpeg"
