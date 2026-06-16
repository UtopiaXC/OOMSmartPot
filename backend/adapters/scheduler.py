"""
Background scheduler for OOMSmartPot.
Handles:
1. Cron-based AI evaluation (default: 0 8,18 * * * = every day at 8:00 and 18:00)
2. Periodic execution of due watering schedules
"""
import json
import logging
from datetime import datetime, timezone

from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

_scheduler: Optional[AsyncIOScheduler] = None

AI_EVAL_JOB_ID = "ai_evaluation_cron"
SCHEDULE_CHECK_JOB_ID = "schedule_checker"
SENSOR_READ_JOB_ID = "sensor_reader"


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler(timezone="UTC")
    return _scheduler


async def _run_ai_evaluation():
    """Execute AI evaluation: read sensors, capture image, analyze, update DB."""
    logger.info("Cron AI evaluation triggered")

    # Import here to avoid circular imports
    from database import SessionLocal
    from models import (
        ScheduleDB, SuggestionDB, AiAnalysisRecordDB, SystemConfigDB
    )
    from adapters.hardware import hardware_adapter
    from adapters.ai_service import analyze_plant

    db = SessionLocal()
    try:
        # 1. Read current sensor data
        temperature = hardware_adapter.read_temperature()
        atmosphere = hardware_adapter.read_atmosphere()
        soil_moisture = hardware_adapter.read_soil_moisture()

        # 2. Capture camera snapshot
        image_jpeg = None
        try:
            image_jpeg = hardware_adapter.capture_snapshot_jpeg()
        except Exception as e:
            logger.warning(f"Camera snapshot failed during AI eval: {e}")

        # 3. Run AI analysis
        result = analyze_plant(temperature, atmosphere, soil_moisture, image_jpeg)

        # 4. Save analysis record
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

        # 5. If watering is needed, create a schedule
        if result["needs_watering"] and result["recommended_duration_ms"] > 0:
            now = datetime.now(timezone.utc)
            schedule_id = f"sch_{now.strftime('%Y%m%d_%H%M%S')}"

            # Check safety limit
            config = db.query(SystemConfigDB).first()
            max_duration = config.safety_max_duration_milliseconds if config else 15000
            duration = min(result["recommended_duration_ms"], max_duration)

            new_schedule = ScheduleDB(
                schedule_id=schedule_id,
                planned_time=now,  # Execute immediately
                duration_milliseconds=duration,
                executed=False
            )
            db.add(new_schedule)
            logger.info(f"AI scheduled watering: {schedule_id}, duration={duration}ms")

        # 6. Update suggestions - clear old ones and add new
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
        logger.info(f"AI evaluation completed: {result['decision_summary']}")

    except Exception as e:
        logger.error(f"AI evaluation failed: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()


async def _check_and_execute_schedules():
    """Check for due watering schedules and execute them."""
    from database import SessionLocal
    from models import ScheduleDB, HistoryRecordDB
    from adapters.hardware import hardware_adapter

    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        due_schedules = (
            db.query(ScheduleDB)
            .filter(ScheduleDB.executed == False, ScheduleDB.planned_time <= now)
            .all()
        )

        for schedule in due_schedules:
            if hardware_adapter.get_pump_is_running():
                logger.warning(f"Pump busy, skipping schedule {schedule.schedule_id}")
                continue

            logger.info(f"Executing schedule {schedule.schedule_id}: {schedule.duration_milliseconds}ms")

            # Read soil moisture before watering
            moisture_before = hardware_adapter.read_soil_moisture()

            # Execute watering
            hardware_adapter.set_pump_state(True)

            import asyncio
            await asyncio.sleep(schedule.duration_milliseconds / 1000.0)

            hardware_adapter.set_pump_state(False)
            hardware_adapter.set_last_duration_milliseconds(schedule.duration_milliseconds)

            # Read soil moisture after watering
            moisture_after = hardware_adapter.read_soil_moisture()

            # Mark schedule as executed
            schedule.executed = True

            # Record in history
            history = HistoryRecordDB(
                executed_at=datetime.now(timezone.utc),
                trigger_type="AI_SCHEDULED",
                duration_milliseconds=schedule.duration_milliseconds,
                status="SUCCESS",
                soil_moisture_before=moisture_before,
                soil_moisture_after=moisture_after
            )
            db.add(history)

            logger.info(
                f"Schedule {schedule.schedule_id} completed. "
                f"Moisture: {moisture_before}% -> {moisture_after}%"
            )

        db.commit()

    except Exception as e:
        logger.error(f"Schedule execution failed: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()


def _parse_cron_expression(cron_expr: str) -> dict:
    """Parse a standard 5-field cron expression into APScheduler CronTrigger kwargs."""
    parts = cron_expr.strip().split()
    if len(parts) != 5:
        raise ValueError(f"Invalid cron expression: {cron_expr}")
    return {
        "minute": parts[0],
        "hour": parts[1],
        "day": parts[2],
        "month": parts[3],
        "day_of_week": parts[4],
    }


async def _collect_sensor_reading():
    """Read current sensor values and store them in the database."""
    from database import SessionLocal
    from models import SensorReadingDB
    from adapters.hardware import hardware_adapter

    db = SessionLocal()
    try:
        reading = SensorReadingDB(
            timestamp=datetime.now(timezone.utc),
            temperature_celsius=hardware_adapter.read_temperature(),
            atmosphere_hpa=hardware_adapter.read_atmosphere(),
            soil_moisture_percent=hardware_adapter.read_soil_moisture()
        )
        db.add(reading)
        db.commit()
    except Exception as e:
        logger.error(f"Sensor reading collection failed: {e}")
        db.rollback()
    finally:
        db.close()


def start_scheduler(
    cron_expression: str = "0 8,18 * * *",
    sensor_interval_seconds: int = 3
):
    """Start the background scheduler with AI evaluation cron, schedule checker, and sensor reader."""
    scheduler = get_scheduler()

    # Add AI evaluation cron job
    try:
        cron_kwargs = _parse_cron_expression(cron_expression)
        scheduler.add_job(
            _run_ai_evaluation,
            trigger=CronTrigger(**cron_kwargs, timezone="UTC"),
            id=AI_EVAL_JOB_ID,
            replace_existing=True,
            name="AI Plant Evaluation"
        )
        logger.info(f"AI evaluation cron job scheduled: {cron_expression}")
    except Exception as e:
        logger.error(f"Failed to schedule AI evaluation: {e}")

    # Add schedule checker (runs every 30 seconds to check for due watering)
    scheduler.add_job(
        _check_and_execute_schedules,
        trigger=IntervalTrigger(seconds=30),
        id=SCHEDULE_CHECK_JOB_ID,
        replace_existing=True,
        name="Watering Schedule Checker"
    )
    logger.info("Schedule checker started (interval: 30s)")

    # Add periodic sensor data collection
    scheduler.add_job(
        _collect_sensor_reading,
        trigger=IntervalTrigger(seconds=sensor_interval_seconds),
        id=SENSOR_READ_JOB_ID,
        replace_existing=True,
        name="Sensor Data Collector"
    )
    logger.info(f"Sensor data collector started (interval: {sensor_interval_seconds}s)")

    if not scheduler.running:
        scheduler.start()
        logger.info("Background scheduler started")


def update_cron_schedule(new_cron_expression: str):
    """Update the AI evaluation cron schedule dynamically."""
    scheduler = get_scheduler()
    try:
        cron_kwargs = _parse_cron_expression(new_cron_expression)
        scheduler.reschedule_job(
            AI_EVAL_JOB_ID,
            trigger=CronTrigger(**cron_kwargs, timezone="UTC")
        )
        logger.info(f"AI evaluation cron updated to: {new_cron_expression}")
    except Exception as e:
        logger.error(f"Failed to update cron schedule: {e}")


def update_sensor_interval(new_interval_seconds: int):
    """Update the sensor reading interval dynamically."""
    scheduler = get_scheduler()
    try:
        scheduler.reschedule_job(
            SENSOR_READ_JOB_ID,
            trigger=IntervalTrigger(seconds=new_interval_seconds)
        )
        logger.info(f"Sensor read interval updated to: {new_interval_seconds}s")
    except Exception as e:
        logger.error(f"Failed to update sensor interval: {e}")


def shutdown_scheduler():
    """Gracefully shut down the scheduler."""
    scheduler = get_scheduler()
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Background scheduler shut down")
