"""
Water pump control router.
"""
import asyncio
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta

from schemas import PumpActionRequest, PumpActionResponse, PumpStatusResponse, PumpStopResponse
from adapters.hardware import hardware_adapter
from database import get_db
from models import SystemConfigDB, HistoryRecordDB

router = APIRouter(prefix="/api/v1/pump", tags=["Actuator Control"])


async def automatic_pump_shutdown(duration_milliseconds: int):
    """Background task: automatically shut off pump and record history."""
    # Read soil moisture before (already started pumping, but captures state)
    moisture_before = hardware_adapter.read_soil_moisture()

    await asyncio.sleep(duration_milliseconds / 1000.0)

    if hardware_adapter.get_pump_is_running():
        hardware_adapter.set_pump_state(False)
        hardware_adapter.set_last_duration_milliseconds(duration_milliseconds)

        # Read soil moisture after
        moisture_after = hardware_adapter.read_soil_moisture()

        # Record history
        from database import SessionLocal
        db = SessionLocal()
        try:
            history = HistoryRecordDB(
                executed_at=datetime.now(timezone.utc),
                trigger_type="MANUAL",
                duration_milliseconds=duration_milliseconds,
                status="SUCCESS",
                soil_moisture_before=moisture_before,
                soil_moisture_after=moisture_after
            )
            db.add(history)
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()


@router.post("/action", response_model=PumpActionResponse, status_code=status.HTTP_202_ACCEPTED)
async def execute_single_watering_task(payload: PumpActionRequest, db: Session = Depends(get_db)):
    config = db.query(SystemConfigDB).first()
    max_duration = config.safety_max_duration_milliseconds if config else 15000

    if payload.duration_milliseconds > max_duration:
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


@router.get("/status", response_model=PumpStatusResponse)
async def get_pump_status():
    return PumpStatusResponse(
        is_running=hardware_adapter.get_pump_is_running(),
        last_executed_time=hardware_adapter.get_last_executed_time(),
        last_duration_milliseconds=hardware_adapter.get_last_duration_milliseconds(),
        hardware_healthy=hardware_adapter.get_hardware_healthy()
    )


@router.post("/stop", response_model=PumpStopResponse)
async def emergency_stop_pump():
    hardware_adapter.set_pump_state(False)
    return PumpStopResponse(
        status="stopped",
        message="Pump stopped immediately."
    )