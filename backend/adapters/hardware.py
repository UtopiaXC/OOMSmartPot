"""
Hardware driver adapter for OOMSmartPot.
Provides a unified interface to all hardware (sensors, pump, camera).
Automatically detects available hardware and falls back to mock implementations.
"""
import asyncio
import logging
import sys
import os
import threading
from datetime import datetime, timezone, timedelta

# Add project root to path so we can import drivers
_project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from config import settings

logger = logging.getLogger(__name__)

# ============================================================
# Sensor Adapter
# ============================================================

class SensorDriverAdapter:
    """Adapter that reads sensor data using the official drivers.sensor module."""

    def __init__(self):
        # Import sensor driver to initialize serial port
        import drivers.sensor as sensor_driver
        self._driver = sensor_driver
        logger.info("Sensor driver initialized successfully")

    def read_temperature(self) -> float:
        """Read temperature in °C from MPL115A2 via the driver."""
        raw = self._driver.get_temperature_sensor_data()
        return round(float(raw), 1)

    def read_atmosphere(self) -> float:
        """Read atmospheric pressure in hPa from MPL115A2 via the driver.
        Driver returns kPa, we convert to hPa (×10).
        """
        raw = self._driver.get_pressure_sensor_data()
        kpa = float(raw)
        return round(kpa * 10.0, 1)

    def read_soil_moisture(self) -> float:
        """Read soil moisture as percentage (0-100%) via the driver."""
        raw = self._driver.get_soil_sensor_data()
        raw_value = float(raw)
        percent = round(min(max(raw_value / 950.0 * 100.0, 0.0), 100.0), 1)
        return percent

    def close(self):
        try:
            if hasattr(self._driver, 'ser'):
                self._driver.ser.close()
        except Exception:
            pass


# ============================================================
# Pump Adapter
# ============================================================

class PumpDriverAdapter:
    """Controls the water pump using the official drivers.pump module."""

    def __init__(self):
        import drivers.pump as pump_driver
        self._driver = pump_driver
        logger.info("Pump driver initialized successfully")

    def turn_on(self):
        self._driver.pump_on()

    def turn_off(self):
        self._driver.pump_off()

    def cleanup(self):
        try:
            self._driver.GPIO.cleanup()
        except Exception:
            pass


# ============================================================
# Unified Hardware Adapter (Singleton)
# ============================================================

class HardwareDriverAdapter:
    """Singleton adapter providing unified access to all hardware."""
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(HardwareDriverAdapter, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True

        # -- State tracking --
        self._pump_is_running = False
        self._last_executed_time = datetime.now(timezone.utc) - timedelta(hours=3)
        self._last_duration_milliseconds = 0
        self._hardware_healthy = True

        # -- Initialize sensor adapter --
        self._sensor = self._init_sensor()

        # -- Initialize pump adapter --
        self._pump = self._init_pump()

        # -- Initialize camera --
        self._camera = self._init_camera()

    def _init_sensor(self):
        """Initialize sensor adapter using the official driver."""
        if settings.MOCK_HARDWARE:
            raise RuntimeError("Mock hardware is disabled. Only real drivers are allowed.")
        return SensorDriverAdapter()

    def _init_pump(self):
        """Initialize pump adapter using the official driver."""
        if settings.MOCK_HARDWARE:
            raise RuntimeError("Mock hardware is disabled. Only real drivers are allowed.")
        return PumpDriverAdapter()

    def _init_camera(self):
        """Initialize camera driver."""
        from drivers.camera import CameraDriver
        camera = CameraDriver()
        if not camera.is_real_hardware:
            logger.warning("Real camera initialization failed, continuing with placeholder images")
        return camera

    # ---- Sensor interface ----

    def read_temperature(self) -> float:
        return self._sensor.read_temperature()

    def read_atmosphere(self) -> float:
        return self._sensor.read_atmosphere()

    def read_soil_moisture(self) -> float:
        return self._sensor.read_soil_moisture()

    # ---- Pump interface ----

    def set_pump_state(self, state: bool):
        self._pump_is_running = state
        if state:
            self._pump.turn_on()
            self._last_executed_time = datetime.now(timezone.utc)
        else:
            self._pump.turn_off()

    def get_pump_is_running(self) -> bool:
        return self._pump_is_running

    def get_last_executed_time(self) -> datetime:
        return self._last_executed_time

    def get_last_duration_milliseconds(self) -> int:
        return self._last_duration_milliseconds

    def set_last_duration_milliseconds(self, duration: int):
        self._last_duration_milliseconds = duration

    def get_hardware_healthy(self) -> bool:
        return self._hardware_healthy

    # ---- Camera interface ----

    def capture_snapshot_jpeg(self) -> bytes:
        """Capture a single JPEG frame from the camera."""
        return self._camera.capture_jpeg()

    async def get_video_stream_frame(self):
        """Yield MJPEG frames for streaming."""
        async for frame in self._camera.generate_mjpeg_stream():
            yield frame

    # ---- Cleanup ----

    def cleanup(self):
        """Release all hardware resources."""
        self._sensor.close()
        self._pump.cleanup()
        self._camera.close()
        logger.info("Hardware resources released")


# Module-level singleton instance
hardware_adapter = HardwareDriverAdapter()