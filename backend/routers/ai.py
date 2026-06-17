"""
AI analysis and suggestions router.
"""
import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from schemas import AiTriggerResponse, AiSuggestionsResponse, SuggestionItem
from database import get_db
from models import SuggestionDB, ScheduleDB, AiAnalysisRecordDB, SystemConfigDB
from adapters.hardware import hardware_adapter
from adapters.ai_service import analyze_plant

router = APIRouter(prefix="/api/v1/ai", tags=["AI & Schedule"])


@router.post("/trigger", response_model=AiTriggerResponse)
async def manually_trigger_ai_analysis(db: Session = Depends(get_db)):
    """
    Manually trigger AI analysis.
    Gathers sensor data, captures camera image, and sends to Gemini for analysis.
    Updates watering schedules and suggestions based on AI response.
    """
    # 1. Read current sensor data
    temperature = hardware_adapter.read_temperature()
    atmosphere = hardware_adapter.read_atmosphere()
    soil_moisture = hardware_adapter.read_soil_moisture()


    # 2. Capture camera snapshot
    image_jpeg = None

    try:
        image_jpeg = hardware_adapter.capture_snapshot_jpeg()
    except Exception:
        pass

    # 3. Run AI analysis
    result = analyze_plant(temperature, atmosphere, soil_moisture, image_jpeg)

    # 4. Store analysis record
    sensor_data = json.dumps({
        "temperature_celsius": temperature,
        "atmosphere_hpa": atmosphere,
        "soil_moisture_percent": soil_moisture
    })
    analysis_record = AiAnalysisRecordDB(
        analyzed_at=datetime.now(timezone.utc),
        decision_summary=result["decision_summary"],
        schedules_updated=result["needs_watering"],
        sensor_snapshot=sensor_data,
        image_used=image_jpeg is not None
    )
    db.add(analysis_record)

    # 5. If watering needed, create schedule
    schedules_updated = False
    if result["needs_watering"] and result["recommended_duration_ms"] > 0:
        now = datetime.now(timezone.utc)
        schedule_id = f"sch_{now.strftime('%Y%m%d_%H%M%S')}"

        # Respect safety limit
        config = db.query(SystemConfigDB).first()
        max_duration = config.safety_max_duration_milliseconds if config else 15000
        duration = min(result["recommended_duration_ms"], max_duration)

        new_schedule = ScheduleDB(
            schedule_id=schedule_id,
            planned_time=now,
            duration_milliseconds=duration,
            executed=False
        )
        db.add(new_schedule)
        schedules_updated = True

    # 6. Update suggestions
    if result.get("suggestions"):
        db.query(SuggestionDB).delete()
        for i, sug in enumerate(result["suggestions"]):
            now = datetime.now(timezone.utc)
            sug_id = f"sug_{now.strftime('%Y%m%d')}_{i+1:03d}"
            db.add(SuggestionDB(
                suggestion_id=sug_id,
                category=sug.get("category", "HEALTH"),
                title=sug.get("title", "Untitled"),
                description=sug.get("description", ""),
                priority=sug.get("priority", "LOW"),
                created_at=now
            ))

    db.commit()

    return AiTriggerResponse(
        triggered_at=datetime.now(timezone.utc),
        status="completed",
        ai_decision_summary=result["decision_summary"],
        schedules_updated=schedules_updated
    )


@router.get("/suggestions", response_model=AiSuggestionsResponse)
async def get_ai_diagnostics_and_suggestions(db: Session = Depends(get_db)):
    suggestions = db.query(SuggestionDB).all()
    return AiSuggestionsResponse(
        timestamp=datetime.now(timezone.utc),
        suggestions=[SuggestionItem.model_validate(s) for s in suggestions]
    )