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
3. If an image is provided, assess leaf color, drooping, discoloration, pests
4. Recommend watering only if soil moisture is below 40% or plant shows stress signs
"""


# ============================================================
# Analysis functions
# ============================================================

def analyze_plant(
    temperature: float,
    atmosphere_hpa: float,
    soil_moisture: float,
    image_jpeg: Optional[bytes] = None
) -> dict:
    """
    Analyze plant health using Gemini AI.

    Returns a dict with keys:
    - decision_summary: str
    - needs_watering: bool
    - recommended_duration_ms: int (0 if no watering needed)
    - suggestions: list of dicts with keys: category, title, description, priority
    """
    client = _get_client()
    if client is None:
        return _fallback_analysis(temperature, atmosphere_hpa, soil_moisture)

    sensor_info = (
        f"Current sensor readings:\n"
        f"- Temperature: {temperature}°C\n"
        f"- Atmospheric pressure: {atmosphere_hpa} hPa\n"
        f"- Soil moisture: {soil_moisture}%\n"
        f"- Current UTC time: {datetime.now(timezone.utc).isoformat()}"
    )

    user_prompt = f"""{sensor_info}

Based on the sensor data{" and the provided plant image" if image_jpeg else ""}, analyze the plant's health and respond with the following JSON structure:
{{
    "decision_summary": "A 1-3 sentence summary of the analysis and decision",
    "needs_watering": true/false,
    "recommended_duration_ms": 0-10000 (milliseconds of watering recommended, 0 if not needed),
    "suggestions": [
        {{
            "category": "ENVIRONMENT|HEALTH|WATERING|FERTILIZATION",
            "title": "Brief title",
            "description": "Detailed suggestion description",
            "priority": "HIGH|MEDIUM|LOW"
        }}
    ]
}}

Important: Only output valid JSON, nothing else."""

    # Build messages
    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
    ]

    if image_jpeg:
        # Multimodal request with image
        image_b64 = base64.b64encode(image_jpeg).decode('utf-8')
        messages.append({
            "role": "user",
            "content": [
                {"type": "text", "text": user_prompt},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{image_b64}"
                    }
                }
            ]
        })
    else:
        messages.append({"role": "user", "content": user_prompt})

    try:
        response = client.chat.completions.create(
            model=settings.GEMINI_MODEL,
            messages=messages,
            temperature=0.3,
            max_tokens=1024,
        )

        content = response.choices[0].message.content.strip()

        # Strip markdown code fences if present
        if content.startswith("```"):
            lines = content.split('\n')
            # Remove first line (```json) and last line (```)
            lines = [l for l in lines if not l.strip().startswith("```")]
            content = '\n'.join(lines)

        result = json.loads(content)

        # Validate required keys
        if "decision_summary" not in result:
            result["decision_summary"] = "Analysis completed."
        if "needs_watering" not in result:
            result["needs_watering"] = False
        if "recommended_duration_ms" not in result:
            result["recommended_duration_ms"] = 0
        if "suggestions" not in result:
            result["suggestions"] = []

        logger.info(f"AI analysis completed: {result['decision_summary']}")
        return result

    except json.JSONDecodeError as e:
        logger.error(f"AI returned invalid JSON: {e}")
        return _fallback_analysis(temperature, atmosphere_hpa, soil_moisture)
    except Exception as e:
        logger.error(f"AI analysis failed: {e}")
        return _fallback_analysis(temperature, atmosphere_hpa, soil_moisture)


# ============================================================
# Fallback (rule-based) analysis
# ============================================================

def _fallback_analysis(
    temperature: float,
    atmosphere_hpa: float,
    soil_moisture: float
) -> dict:
    """
    Simple rule-based analysis when AI is unavailable.
    """
    suggestions = []
    needs_watering = False
    duration_ms = 0
    summary_parts = []

    # Soil moisture check
    if soil_moisture < 30:
        needs_watering = True
        duration_ms = 5000
        summary_parts.append(f"Soil moisture critically low at {soil_moisture}%")
        suggestions.append({
            "category": "WATERING",
            "title": "Immediate Watering Needed",
            "description": f"Soil moisture is at {soil_moisture}%, well below the optimal range (40-60%). Immediate watering is recommended.",
            "priority": "HIGH"
        })
    elif soil_moisture < 40:
        needs_watering = True
        duration_ms = 3000
        summary_parts.append(f"Soil moisture below optimal at {soil_moisture}%")
        suggestions.append({
            "category": "WATERING",
            "title": "Watering Recommended",
            "description": f"Soil moisture is at {soil_moisture}%, below the optimal range. Light watering is recommended.",
            "priority": "MEDIUM"
        })
    else:
        summary_parts.append(f"Soil moisture at {soil_moisture}%, within acceptable range")

    # Temperature check
    if temperature > 35:
        suggestions.append({
            "category": "ENVIRONMENT",
            "title": "High Temperature Alert",
            "description": f"Ambient temperature is {temperature}°C, exceeding the safe threshold. Move plant to a cooler location or provide shade.",
            "priority": "HIGH"
        })
        summary_parts.append(f"High temperature warning at {temperature}°C")
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
        summary_parts.append(f"Low temperature warning at {temperature}°C")

    if not summary_parts:
        summary_parts.append("All conditions nominal")

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
