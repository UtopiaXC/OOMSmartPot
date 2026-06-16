"""
Sensor data router.
"""
from typing import Optional, Union

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from schemas import SensorReadingsResponse, SensorReadingsHistoryResponse
from adapters.hardware import hardware_adapter
from database import get_db
from models import SensorReadingDB

router = APIRouter(prefix="/api/v1/sensors", tags=["Sensors"])


@router.get(
    "/current",
    response_model=Union[SensorReadingsHistoryResponse, SensorReadingsResponse]
)
async def get_current_sensor_readings(
        start_time: Optional[datetime] = Query(
            default=None,
            description="ISO 8601 UTC timestamp. If provided, returns all historical records from this time onward."
        ),
        db: Session = Depends(get_db)
):
    """
    Get sensor readings.

    - Without `start_time`: returns the latest real-time reading from hardware.
    - With `start_time`: returns all stored historical readings from that time onward.
    """
    if start_time is not None:
        # Historical query mode
        query = (
            db.query(SensorReadingDB)
            .filter(SensorReadingDB.timestamp >= start_time)
            .order_by(SensorReadingDB.timestamp.asc())
        )
        total = query.count()
        records = query.all()
        return SensorReadingsHistoryResponse(
            total_records=total,
            records=[SensorReadingsResponse.model_validate(r) for r in records]
        )
    else:
        # Real-time mode: read directly from hardware
        return SensorReadingsResponse(
            timestamp=datetime.now(timezone.utc),
            temperature_celsius=hardware_adapter.read_temperature(),
            atmosphere_hpa=hardware_adapter.read_atmosphere(),
            soil_moisture_percent=hardware_adapter.read_soil_moisture()
        )