import asyncio
import random
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import uvicorn

class SystemConfiguration:
    def __init__(self):
        self.sensor_read_interval_seconds = 60
        self.ai_evaluation_cron = "0 8,18 * * *"
        self.safety_max_duration_milliseconds = 15000

class HardwareDriverAdapter:
    def __init__(self):
        self.pump_is_running = False
        self.last_executed_time = datetime.now(timezone.utc) - timedelta(hours=3)
        self.last_duration_milliseconds = 4000
        self.hardware_healthy = True

    def read_temperature(self) -> float:
        return round(22.0 + random.uniform(0.0, 5.0), 1)

    def read_atmosphere(self) -> float:
        return round(1008.0 + random.uniform(0.0, 10.0), 1)

    def read_soil_moisture(self) -> float:
        return round(35.0 + random.uniform(0.0, 25.0), 1)

    def set_pump_state(self, state: bool):
        self.pump_is_running = state
        if state:
            self.last_executed_time = datetime.now(timezone.utc)

    def get_pump_is_running(self) -> bool:
        return self.pump_is_running

    def get_last_executed_time(self) -> datetime:
        return self.last_executed_time

    def get_last_duration_milliseconds(self) -> int:
        return self.last_duration_milliseconds

    def set_last_duration_milliseconds(self, duration: int):
        self.last_duration_milliseconds = duration

    def get_hardware_healthy(self) -> bool:
        return self.hardware_healthy

    async def get_video_stream_frame(self):
        mock_jpeg_frame = b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.\x27"21\x1c\x1c748\x3a\x3a\x3a\x23\x2bEHI\x30@B\x3a\x3aA\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x15\x00\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x03\xff\xda\x00\x08\x01\x01\x00\x00\x3f\x00\x37\xff\xd9'
        while True:
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + mock_jpeg_frame + b'\r\n')
            await asyncio.sleep(0.1)

class SensorReadingsResponse(BaseModel):
    timestamp: datetime
    temperature_celsius: float
    atmosphere_hpa: float
    soil_moisture_percent: float

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

class AiTriggerResponse(BaseModel):
    triggered_at: datetime
    status: str
    ai_decision_summary: str
    schedules_updated: bool

class ScheduleItem(BaseModel):
    schedule_id: str
    planned_time: datetime
    duration_milliseconds: int
    executed: bool

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

class ScheduleHistoryResponse(BaseModel):
    total_records: int
    records: List[HistoryRecordItem]

class SuggestionItem(BaseModel):
    suggestion_id: str
    category: str
    title: str
    description: str
    priority: str

class AiSuggestionsResponse(BaseModel):
    timestamp: datetime
    suggestions: List[SuggestionItem]

class SystemConfigPayload(BaseModel):
    sensor_read_interval_seconds: Optional[int] = None
    ai_evaluation_cron: Optional[str] = None
    safety_max_duration_milliseconds: Optional[int] = None

class SystemConfigResponse(BaseModel):
    sensor_read_interval_seconds: int
    ai_evaluation_cron: str
    safety_max_duration_milliseconds: int

class GeneralSuccessResponse(BaseModel):
    status: str
    message: str

app = FastAPI(title="Smart Planter System API")
hardware_adapter = HardwareDriverAdapter()
global_configuration = SystemConfiguration()

upcoming_schedules_store = [
    ScheduleItem(
        schedule_id="sch_20260614_1800",
        planned_time=datetime.now(timezone.utc) + timedelta(hours=2),
        duration_milliseconds=3500,
        executed=False
    )
]

historical_records_store = [
    HistoryRecordItem(
        executed_at=datetime.now(timezone.utc) - timedelta(hours=16),
        trigger_type="AI_SCHEDULED",
        duration_milliseconds=3500,
        status="SUCCESS",
        soil_moisture_before=38.5,
        soil_moisture_after=52.1
    )
]

ai_suggestions_store = [
    SuggestionItem(
        suggestion_id="sug_20260614_001",
        category="ENVIRONMENT",
        title="High Ambient Temperature",
        description="Ambient temperature is reaching the upper optimal limit. Monitor closely for signs of leaf wilting.",
        priority="MEDIUM"
    ),
    SuggestionItem(
        suggestion_id="sug_20260614_002",
        category="HEALTH",
        title="Mild Leaf Droop Detected",
        description="Computer vision models indicate slight drooping at leaf margins. Combined with mid-range soil moisture, adjustments to irrigation may be needed soon.",
        priority="LOW"
    )
]

@app.get("/api/v1/sensors/current", response_model=SensorReadingsResponse)
async def get_current_sensor_readings():
    return SensorReadingsResponse(
        timestamp=datetime.now(timezone.utc),
        temperature_celsius=hardware_adapter.read_temperature(),
        atmosphere_hpa=hardware_adapter.read_atmosphere(),
        soil_moisture_percent=hardware_adapter.read_soil_moisture()
    )

async def automatic_pump_shutdown(duration_milliseconds: int):
    await asyncio.sleep(duration_milliseconds / 1000.0)
    if hardware_adapter.get_pump_is_running():
        hardware_adapter.set_pump_state(False)
        hardware_adapter.set_last_duration_milliseconds(duration_milliseconds)

@app.post("/api/v1/pump/action", response_model=PumpActionResponse, status_code=status.HTTP_202_ACCEPTED)
async def execute_single_watering_task(payload: PumpActionRequest):
    if payload.duration_milliseconds > global_configuration.safety_max_duration_milliseconds:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "EXCEEDS_MAX_DURATION",
                "message": "Action denied. Duration exceeds the safety threshold specified in configuration."
            }
        )
    if hardware_adapter.get_pump_is_running():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "PUMP_ALREADY_RUNNING",
                "message": "Action denied. The pump is currently executing another task."
            }
        )

    hardware_adapter.set_pump_state(True)
    estimated_end_time = datetime.now(timezone.utc) + timedelta(milliseconds=payload.duration_milliseconds)
    asyncio.create_task(automatic_pump_shutdown(payload.duration_milliseconds))

    return PumpActionResponse(
        status="executing",
        message=f"Pump turned on, will automatically turn off after {payload.duration_milliseconds}ms.",
        estimated_end_time=estimated_end_time
    )

@app.get("/api/v1/pump/status", response_model=PumpStatusResponse)
async def get_pump_status():
    return PumpStatusResponse(
        is_running=hardware_adapter.get_pump_is_running(),
        last_executed_time=hardware_adapter.get_last_executed_time(),
        last_duration_milliseconds=hardware_adapter.get_last_duration_milliseconds(),
        hardware_healthy=hardware_adapter.get_hardware_healthy()
    )

@app.post("/api/v1/pump/stop", response_model=PumpStopResponse)
async def emergency_stop_pump():
    hardware_adapter.set_pump_state(False)
    return PumpStopResponse(
        status="stopped",
        message="Pump stopped immediately."
    )

@app.post("/api/v1/ai/trigger", response_model=AiTriggerResponse)
async def manually_trigger_ai_analysis():
    return AiTriggerResponse(
        triggered_at=datetime.now(timezone.utc),
        status="completed",
        ai_decision_summary="Analysis based on image and physical sensors. Foliage structure appears nominal. Soil moisture at stable level. No immediate watering required.",
        schedules_updated=True
    )

@app.get("/api/v1/schedule/upcoming", response_model=UpcomingScheduleResponse)
async def get_upcoming_watering_schedule():
    return UpcomingScheduleResponse(
        generated_at=datetime.now(timezone.utc) - timedelta(minutes=5),
        ai_decision_summary="Soil moisture is declining slowly. Scheduling a maintenance watering session for this evening.",
        schedules=upcoming_schedules_store
    )

@app.get("/api/v1/schedule/history", response_model=ScheduleHistoryResponse)
async def get_execution_records_and_decision_history(
        limit: int = Query(default=10, ge=1),
        offset: int = Query(default=0, ge=0)
):
    sliced_records = historical_records_store[offset : offset + limit]
    return ScheduleHistoryResponse(
        total_records=len(historical_records_store),
        records=sliced_records
    )

@app.get("/api/v1/ai/suggestions", response_model=AiSuggestionsResponse)
async def get_ai_diagnostics_and_suggestions():
    return AiSuggestionsResponse(
        timestamp=datetime.now(timezone.utc),
        suggestions=ai_suggestions_store
    )

@app.get("/api/v1/system/config", response_model=SystemConfigResponse)
async def get_current_system_configuration():
    return SystemConfigResponse(
        sensor_read_interval_seconds=global_configuration.sensor_read_interval_seconds,
        ai_evaluation_cron=global_configuration.ai_evaluation_cron,
        safety_max_duration_milliseconds=global_configuration.safety_max_duration_milliseconds
    )

@app.put("/api/v1/system/config", response_model=GeneralSuccessResponse)
async def update_system_configuration(payload: SystemConfigPayload):
    if payload.sensor_read_interval_seconds is not None:
        global_configuration.sensor_read_interval_seconds = payload.sensor_read_interval_seconds
    if payload.ai_evaluation_cron is not None:
        global_configuration.ai_evaluation_cron = payload.ai_evaluation_cron
    if payload.safety_max_duration_milliseconds is not None:
        global_configuration.safety_max_duration_milliseconds = payload.safety_max_duration_milliseconds
    return GeneralSuccessResponse(
        status="success",
        message="Configuration updated successfully."
    )

@app.get("/api/v1/camera/stream")
async def get_live_video_stream():
    return StreamingResponse(
        hardware_adapter.get_video_stream_frame(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-cache, private"}
    )



if __name__ == "__main__":
    uvicorn.run("test:app", host="0.0.0.0", port=8000, reload=True)