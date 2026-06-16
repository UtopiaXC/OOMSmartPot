"""
System configuration router.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from schemas import SystemConfigResponse, SystemConfigPayload, GeneralSuccessResponse
from database import get_db
from models import SystemConfigDB

router = APIRouter(prefix="/api/v1/system", tags=["Configuration"])


@router.get("/config", response_model=SystemConfigResponse)
async def get_current_system_configuration(db: Session = Depends(get_db)):
    config = db.query(SystemConfigDB).first()
    if not config:
        config = SystemConfigDB()
        db.add(config)
        db.commit()
        db.refresh(config)
    return SystemConfigResponse.model_validate(config)


@router.put("/config", response_model=GeneralSuccessResponse)
async def update_system_configuration(payload: SystemConfigPayload, db: Session = Depends(get_db)):
    config = db.query(SystemConfigDB).first()
    if not config:
        config = SystemConfigDB()
        db.add(config)

    if payload.sensor_read_interval_seconds is not None:
        config.sensor_read_interval_seconds = payload.sensor_read_interval_seconds
    if payload.ai_evaluation_cron is not None:
        config.ai_evaluation_cron = payload.ai_evaluation_cron
    if payload.safety_max_duration_milliseconds is not None:
        config.safety_max_duration_milliseconds = payload.safety_max_duration_milliseconds

    db.commit()

    # Notify scheduler to update cron if it changed
    if payload.ai_evaluation_cron is not None:
        try:
            from adapters.scheduler import update_cron_schedule
            update_cron_schedule(payload.ai_evaluation_cron)
        except Exception:
            pass  # Scheduler might not be running yet

    # Notify scheduler to update sensor interval if it changed
    if payload.sensor_read_interval_seconds is not None:
        try:
            from adapters.scheduler import update_sensor_interval
            update_sensor_interval(payload.sensor_read_interval_seconds)
        except Exception:
            pass

    return GeneralSuccessResponse(
        status="success",
        message="Configuration updated successfully."
    )