"""
Centralized configuration management for OOMSmartPot backend.
Loads settings from environment variables and .env file.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env file from backend directory
_env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=_env_path)


class Settings:
    """Application settings loaded from environment variables."""

    # --- Gemini AI ---
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

    # --- Serial (Arduino sensors) ---
    SERIAL_PORT: str = os.getenv("SERIAL_PORT", "/dev/ttyACM0")
    SERIAL_BAUD: int = int(os.getenv("SERIAL_BAUD", "9600"))

    # --- GPIO (Pump) ---
    PUMP_GPIO_PIN: int = int(os.getenv("PUMP_GPIO_PIN", "26"))

    # --- Database ---
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./smartpot.db")

    # --- Mock mode ---
    # When True, forces all hardware to use mock implementations
    MOCK_HARDWARE: bool = os.getenv("MOCK_HARDWARE", "false").lower() in ("true", "1", "yes")


settings = Settings()
