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

class _RealSensorAdapter:
    """Reads sensor data from Arduino via serial port."""

    def __init__(self, port: str, baud: int):
        import serial
        self._ser = serial.Serial(port, baud, timeout=2)
        self._ser.reset_input_buffer()
        self._lock = threading.Lock()
        logger.info(f"Serial sensor connected on {port} @ {baud} baud")

    def _send_command(self, command: bytes) -> str:
        """Send a command to Arduino and read the response line."""
        with self._lock:
            self._ser.reset_input_buffer()
            self._ser.write(command + b'\n')
            line = self._ser.readline().decode('utf-8').strip()
            if not line:
                # Retry once
                self._ser.write(command + b'\n')
                line = self._ser.readline().decode('utf-8').strip()
            return line

    def read_temperature(self) -> float:
        """Read temperature in °C from MPL115A2 via Arduino."""
        try:
            raw = self._send_command(b'TEMP')
            return round(float(raw), 1)
        except (ValueError, Exception) as e:
            logger.error(f"Temperature read failed: {e}")
            return -999.0

    def read_atmosphere(self) -> float:
        """Read atmospheric pressure in hPa from MPL115A2 via Arduino.
        Arduino returns kPa, we convert to hPa (×10).
        """
        try:
            raw = self._send_command(b'PRESS')
            kpa = float(raw)
            hpa = round(kpa * 10.0, 1)
            return hpa
        except (ValueError, Exception) as e:
            logger.error(f"Pressure read failed: {e}")
            return -999.0

    def read_soil_moisture(self) -> float:
        """Read soil moisture as percentage (0-100%).
        Arduino returns raw ADC value 0~950.
        0 = dry, 300 = humid, 700~950 = in water.
        We map linearly: percent = raw / 950 * 100
        """
        try:
            raw = self._send_command(b'GETSOIL')
            raw_value = float(raw)
            percent = round(min(max(raw_value / 950.0 * 100.0, 0.0), 100.0), 1)
            return percent
        except (ValueError, Exception) as e:
            logger.error(f"Soil moisture read failed: {e}")
            return -999.0

    def close(self):
        try:
            self._ser.close()
        except Exception:
            pass


class _MockSensorAdapter:
    """Returns simulated sensor data for development without hardware."""

    def __init__(self):
        import random
        self._random = random
        logger.info("Sensor adapter running in MOCK mode")

    def read_temperature(self) -> float:
        return round(22.0 + self._random.uniform(0.0, 5.0), 1)

    def read_atmosphere(self) -> float:
        return round(1008.0 + self._random.uniform(0.0, 10.0), 1)

    def read_soil_moisture(self) -> float:
        return round(35.0 + self._random.uniform(0.0, 25.0), 1)

    def close(self):
        pass


# ============================================================
# Pump Adapter
# ============================================================

class _RealPumpAdapter:
    """Controls the water pump via Raspberry Pi GPIO."""

    def __init__(self, gpio_pin: int):
        import RPi.GPIO as GPIO
        self._GPIO = GPIO
        self._pin = gpio_pin
        self._GPIO.setmode(self._GPIO.BCM)
        self._GPIO.setup(self._pin, self._GPIO.OUT)
        self._GPIO.output(self._pin, self._GPIO.LOW)
        logger.info(f"Pump GPIO initialized on BCM pin {gpio_pin}")

    def turn_on(self):
        self._GPIO.output(self._pin, self._GPIO.HIGH)

    def turn_off(self):
        self._GPIO.output(self._pin, self._GPIO.LOW)

    def cleanup(self):
        try:
            self._GPIO.output(self._pin, self._GPIO.LOW)
            self._GPIO.cleanup(self._pin)
        except Exception:
            pass


class _MockPumpAdapter:
    """Simulates pump control for development."""

    def __init__(self):
        logger.info("Pump adapter running in MOCK mode")

    def turn_on(self):
        logger.info("[MOCK] Pump turned ON")

    def turn_off(self):
        logger.info("[MOCK] Pump turned OFF")

    def cleanup(self):
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
        """Initialize sensor adapter with auto-detection."""
        if settings.MOCK_HARDWARE:
            return _MockSensorAdapter()
        try:
            return _RealSensorAdapter(settings.SERIAL_PORT, settings.SERIAL_BAUD)
        except Exception as e:
            logger.warning(f"Cannot connect to Arduino on {settings.SERIAL_PORT}: {e}")
            logger.warning("Falling back to mock sensor adapter")
            return _MockSensorAdapter()

    def _init_pump(self):
        """Initialize pump adapter with auto-detection."""
        if settings.MOCK_HARDWARE:
            return _MockPumpAdapter()
        try:
            return _RealPumpAdapter(settings.PUMP_GPIO_PIN)
        except Exception as e:
            logger.warning(f"Cannot initialize GPIO for pump: {e}")
            logger.warning("Falling back to mock pump adapter")
            return _MockPumpAdapter()

    def _init_camera(self):
        """Initialize camera driver with auto-detection."""
        try:
            from drivers.camera import CameraDriver
            return CameraDriver()
        except Exception as e:
            logger.warning(f"Camera initialization failed: {e}")
            # Create a minimal fallback
            from drivers.camera import CameraDriver
            cam = CameraDriver.__new__(CameraDriver)
            cam._camera = None
            cam._is_real = False
            return cam

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