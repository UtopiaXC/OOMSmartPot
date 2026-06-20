"""
OOMSmartPot Backend Application
Smart Planter System API - FastAPI application entry point.
"""
import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base, SessionLocal
from models import SystemConfigDB
from routers import sensors, pump, ai, schedule, system, camera

# ---- Logging ----
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)


def init_db():
    """Create tables and ensure default system config exists."""
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        if not db.query(SystemConfigDB).first():
            db.add(SystemConfigDB())
            db.commit()
            logger.info("Default system configuration created")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle: startup and shutdown."""
    # ---- Startup ----
    init_db()
    logger.info("Database initialized")

    # Initialize hardware connections only inside the running worker process
    from adapters.hardware import hardware_adapter
    hardware_adapter.initialize()

    # Start background scheduler
    from adapters.scheduler import start_scheduler, shutdown_scheduler
    db = SessionLocal()
    try:
        config = db.query(SystemConfigDB).first()
        cron_expr = config.ai_evaluation_cron if config else "0 8,18 * * *"
        sensor_interval = config.sensor_read_interval_seconds if config else 3
    finally:
        db.close()

    start_scheduler(cron_expression=cron_expr, sensor_interval_seconds=sensor_interval)
    logger.info("OOMSmartPot backend started successfully")

    yield

    # ---- Shutdown ----
    shutdown_scheduler()
    logger.info("Scheduler shut down")

    from adapters.hardware import hardware_adapter
    hardware_adapter.cleanup()
    logger.info("Hardware resources released")


# ---- Create FastAPI app ----
app = FastAPI(
    title="Smart Planter System API",
    description="Backend API for OOMSmartPot - an AI-powered smart planter system",
    version="1.0.0",
    lifespan=lifespan
)

# ---- CORS middleware (allow frontend access) ----
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Register routers ----
app.include_router(sensors.router)
app.include_router(pump.router)
app.include_router(ai.router)
app.include_router(schedule.router)
app.include_router(system.router)
app.include_router(camera.router)


@app.get("/", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "OOMSmartPot Backend"}


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)