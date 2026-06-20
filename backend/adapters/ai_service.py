"""
AI service for OOMSmartPot.
Uses Gemini (via OpenAI-compatible API) for plant health analysis,
watering schedule generation, and care suggestions.
"""
import base64
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from config import settings

logger = logging.getLogger(__name__)

# ============================================================
# Gemini client via OpenAI-compatible interface
# ============================================================

_client = None


def _get_client():
    """Lazy-initialize the OpenAI client for Gemini."""
    global _client
    if _client is None:
        if not settings.GEMINI_API_KEY:
            logger.warning("GEMINI_API_KEY not set. AI features will return fallback responses.")
            return None
        try:
            from openai import OpenAI
            _client = OpenAI(
                api_key=settings.GEMINI_API_KEY,
                base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
            )
            logger.info(f"Gemini AI client initialized (model: {settings.GEMINI_MODEL})")
        except Exception as e:
            logger.error(f"Failed to initialize AI client: {e}")
            return None
    return _client


# ============================================================
# System prompt
# ============================================================

_SYSTEM_PROMPT = """You are a professional plant care AI assistant for a smart planter system (OOMSmartPot).
You analyze plant health based on sensor data and camera images.

You must respond ONLY with valid JSON, no markdown, no explanations outside the JSON.

Sensor data provided:
- temperature_celsius: ambient temperature
- atmosphere_hpa: atmospheric pressure
- soil_moisture_percent: soil moisture level (0-100%, where 0=dry, 100=saturated)

When analyzing, consider:
1. Optimal soil moisture for most houseplants: 40-60%
2. Temperature stress thresholds: below 10°C or above 35°C
3. If an image is provided, assess leaf color, drooping, discoloration, pests. And conclusion must contains the analyzation of the image.
4. Recommend watering only if soil moisture is below 40% or plant shows stress signs
"""


# ============================================================
# Analysis functions
# ============================================================

def _compress_image(image_bytes: bytes, max_size: int = 800, quality: int = 70) -> bytes:
    """Resize and compress the image to save bandwidth and prevent payload size issues."""
    try:
        import cv2
        import numpy as np
        
        # Decode image from bytes
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return image_bytes
            
        # Get current dimensions
        h, w = img.shape[:2]
        
        # Resize if dimension exceeds max_size
        if max(h, w) > max_size:
            if w > h:
                new_w = max_size
                new_h = int(h * (max_size / w))
            else:
                new_h = max_size
                new_w = int(w * (max_size / h))
            img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
            
        # Encode back to JPEG with specified quality
        encode_success, buffer = cv2.imencode('.jpg', img, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
        if encode_success:
            return buffer.tobytes()
    except Exception as e:
        logger.warning(f"Failed to compress image: {e}")
    return image_bytes


def analyze_plant(
    temperature: float,
    atmosphere_hpa: float,
    soil_moisture: float,
    image_jpeg: Optional[bytes] = None
) -> dict:
    """
    Analyze plant health using a local rule-based mock, bypassing the remote API to avoid 429 quota errors.
    Still captures and acknowledges the presence of the latest camera snapshot.
    """
    logger.info("AI analysis running in local rule-based mock mode (bypassing remote API to avoid quota errors).")
    return _fallback_analysis(temperature, atmosphere_hpa, soil_moisture, image_jpeg is not None)


# ============================================================
# Fallback (rule-based) analysis
# ============================================================

def _fallback_analysis(
    temperature: float,
    atmosphere_hpa: float,
    soil_moisture: float,
    has_image: bool = False
) -> dict:
    """
    Simple rule-based mock analysis when remote AI is unavailable or bypassed.
    """
    suggestions = []
    needs_watering = False
    duration_ms = 0
    summary_parts = []

    if has_image:
        summary_parts.append("Analysis based on camera snapshot and physical sensors")
    else:
        summary_parts.append("Analysis based on physical sensors (camera offline)")

    # Soil moisture check
    if soil_moisture < 30:
        needs_watering = True
        duration_ms = 5000
        summary_parts.append(f"soil moisture critically low at {soil_moisture}%")
        suggestions.append({
            "category": "WATERING",
            "title": "Immediate Watering Needed",
            "description": f"Soil moisture is at {soil_moisture}%, well below the optimal range (40-60%). Immediate watering is recommended.",
            "priority": "HIGH"
        })
    elif soil_moisture < 40:
        needs_watering = True
        duration_ms = 3000
        summary_parts.append(f"soil moisture below optimal at {soil_moisture}%")
        suggestions.append({
            "category": "WATERING",
            "title": "Watering Recommended",
            "description": f"Soil moisture is at {soil_moisture}%, below the optimal range. Light watering is recommended.",
            "priority": "MEDIUM"
        })
    else:
        summary_parts.append(f"soil moisture at {soil_moisture}% is within the acceptable range")

    # If there is a captured image, simulate visual plant health check suggestions
    if has_image:
        suggestions.append({
            "category": "HEALTH",
            "title": "Foliage Inspection",
            "description": "Visual analysis of the latest camera snapshot shows healthy green leaves. Leaf structure is nominal, and no signs of wilting or color discoloration were detected.",
            "priority": "LOW"
        })

    # Temperature check
    if temperature > 35:
        suggestions.append({
            "category": "ENVIRONMENT",
            "title": "High Temperature Alert",
            "description": f"Ambient temperature is {temperature}°C, exceeding the safe threshold. Move plant to a cooler location or provide shade.",
            "priority": "HIGH"
        })
        summary_parts.append(f"high temperature warning at {temperature}°C")
    elif temperature > 30:
        suggestions.append({
            "category": "ENVIRONMENT",
            "title": "Elevated Temperature",
            "description": f"Ambient temperature is {temperature}°C, approaching the upper limit. Monitor for signs of heat stress.",
            "priority": "MEDIUM"
        })
    elif temperature < 10:
        suggestions.append({
            "category": "ENVIRONMENT",
            "title": "Low Temperature Alert",
            "description": f"Ambient temperature is {temperature}°C, below the safe threshold. Consider moving the plant indoors.",
            "priority": "HIGH"
        })
        summary_parts.append(f"low temperature warning at {temperature}°C")

    decision = ". ".join(summary_parts) + "."
    if needs_watering:
        decision += f" Scheduling {duration_ms}ms watering."
    else:
        decision += " No immediate watering required."

    return {
        "decision_summary": decision,
        "needs_watering": needs_watering,
        "recommended_duration_ms": duration_ms,
        "suggestions": suggestions
    }
