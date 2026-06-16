"""
SQLAlchemy ORM models for OOMSmartPot database tables.
"""
from sqlalchemy import Boolean, Column, Integer, String, Float, DateTime, Text
from datetime import datetime, timezone
from database import Base


class SystemConfigDB(Base):
    __tablename__ = "system_config"
    id = Column(Integer, primary_key=True, index=True)
    sensor_read_interval_seconds = Column(Integer, default=3)
    ai_evaluation_cron = Column(String, default="0 8,18 * * *")
    safety_max_duration_milliseconds = Column(Integer, default=15000)


class ScheduleDB(Base):
    __tablename__ = "schedules"
    schedule_id = Column(String, primary_key=True, index=True)
    planned_time = Column(DateTime, nullable=False)
    duration_milliseconds = Column(Integer, nullable=False)
    executed = Column(Boolean, default=False)


class HistoryRecordDB(Base):
    __tablename__ = "history_records"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    executed_at = Column(DateTime, nullable=False)
    trigger_type = Column(String, nullable=False)
    duration_milliseconds = Column(Integer, nullable=False)
    status = Column(String, nullable=False)
    soil_moisture_before = Column(Float, nullable=False)
    soil_moisture_after = Column(Float, nullable=False)


class SuggestionDB(Base):
    __tablename__ = "suggestions"
    suggestion_id = Column(String, primary_key=True, index=True)
    category = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=False)
    priority = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class AiAnalysisRecordDB(Base):
    """Stores each AI analysis result for history tracking."""
    __tablename__ = "ai_analysis_records"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    analyzed_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    decision_summary = Column(Text, nullable=False)
    schedules_updated = Column(Boolean, default=False)
    sensor_snapshot = Column(Text, nullable=True)  # JSON string of sensor data at analysis time
    image_used = Column(Boolean, default=False)


class SensorReadingDB(Base):
    """Stores periodic sensor readings for historical queries."""
    __tablename__ = "sensor_readings"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True)
    temperature_celsius = Column(Float, nullable=False)
    atmosphere_hpa = Column(Float, nullable=False)
    soil_moisture_percent = Column(Float, nullable=False)
