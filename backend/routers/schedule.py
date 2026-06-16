"""
Watering schedule and history router.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from schemas import UpcomingScheduleResponse, ScheduleHistoryResponse, ScheduleItem, HistoryRecordItem
from database import get_db
from models import ScheduleDB, HistoryRecordDB, AiAnalysisRecordDB

router = APIRouter(prefix="/api/v1/schedule", tags=["AI & Schedule"])


@router.get("/upcoming", response_model=UpcomingScheduleResponse)
async def get_upcoming_watering_schedule(db: Session = Depends(get_db)):
    schedules = db.query(ScheduleDB).filter(ScheduleDB.executed == False).all()

    # Get the latest AI analysis summary
    latest_analysis = (
        db.query(AiAnalysisRecordDB)
        .order_by(AiAnalysisRecordDB.analyzed_at.desc())
        .first()
    )

    if latest_analysis:
        summary = latest_analysis.decision_summary
        generated_at = latest_analysis.analyzed_at
    else:
        summary = "No AI analysis has been performed yet. Trigger an analysis to generate insights."
        generated_at = datetime.now(timezone.utc)

    return UpcomingScheduleResponse(
        generated_at=generated_at,
        ai_decision_summary=summary,
        schedules=[ScheduleItem.model_validate(s) for s in schedules]
    )


@router.get("/history", response_model=ScheduleHistoryResponse)
async def get_execution_records_and_decision_history(
        limit: int = Query(default=10, ge=1),
        offset: int = Query(default=0, ge=0),
        db: Session = Depends(get_db)
):
    total = db.query(HistoryRecordDB).count()
    records = db.query(HistoryRecordDB).order_by(HistoryRecordDB.executed_at.desc()).offset(offset).limit(limit).all()
    return ScheduleHistoryResponse(
        total_records=total,
        records=[HistoryRecordItem.model_validate(r) for r in records]
    )