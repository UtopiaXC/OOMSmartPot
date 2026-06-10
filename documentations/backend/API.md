# Smart Planter System  Backend API Documentation

This document defines the API specifications for the backend controller of the Smart Planter system. The system architecture includes RESTful APIs and WebSockets.

## Global Conventions

* **Base URL**: `http://<pi-ip-address>:<port>`
* **Data Format**: Both request and response bodies use `application/json`.
* **Time Format**: ISO 8601 extended format (e.g., `2026-06-09T17:15:00Z`).

## 1. Sensors

### 1.1 Get Current Sensor Readings

* **URL**: `/api/v1/sensors/current`
* **Method**: `GET`
* **Success Response**:
    * **Code**: 200 OK
    * **Content**:
        ```json
        {
          "timestamp": "2026-06-09T17:15:00Z",
          "temperature_celsius": 24.5,
          "atmosphere_hpa": 1012.3,
          "soil_moisture_percent": 42.8,
          "light_intensity_lux": 1250,
          "water_tank_level_percent": 85.0
        }
        ```

## 2. Actuator Control

### 2.1 Execute Single Watering Action

* **URL**: `/api/v1/pump/action`
* **Method**: `POST`
* **Payload**:
    ```json
    {
      "action": "run",
      "duration_milliseconds": 5000
    }
    ```
* **Success Response**:
    * **Code**: 202 Accepted
    * **Content**:
        ```json
        {
          "status": "executing",
          "message": "Pump turned on, will automatically turn off after 5000ms.",
          "estimated_end_time": "2026-06-09T17:15:05Z"
        }
        ```
* **Error Response**:
    * **Code**: 400 Bad Request / 409 Conflict
    * **Content**:
        ```json
        {
          "error": "LOW_WATER_LEVEL",
          "message": "Action denied. Water tank level is below 10%."
        }
        ```

### 2.2 Get Pump Status

* **URL**: `/api/v1/pump/status`
* **Method**: `GET`
* **Success Response**:
    * **Code**: 200 OK
    * **Content**:
        ```json
        {
          "is_running": false,
          "last_executed_time": "2026-06-09T12:00:00Z",
          "last_duration_milliseconds": 3000,
          "hardware_healthy": true
        }
        ```

### 2.3 Stop Pump
* **URL**: `/api/v1/pump/stop`
* **Method**: `POST`
* **Success Response**:
    * **Code**: 200 OK
    * **Content**:
        ```json
        {
          "status": "stopped",
          "message": "Pump stopped"
        }
        ```

## 3. AI & Schedule

### 3.1 Get Upcoming Schedule

* **URL**: `/api/v1/schedule/upcoming`
* **Method**: `GET`
* **Success Response**:
    * **Code**: 200 OK
    * **Content**:
        ```json
        {
          "generated_at": "2026-06-09T08:00:00Z",
          "ai_decision_summary": "Based on photo analysis showing dry leaves and soil moisture at 35%, increasing watering frequency.",
          "schedules": [
            {
              "schedule_id": "sch_20260609_1800",
              "planned_time": "2026-06-09T18:00:00Z",
              "duration_milliseconds": 4000,
              "executed": false
            }
          ]
        }
        ```

### 3.2 Get Execution and AI Decision History

* **URL**: `/api/v1/schedule/history`
* **Method**: `GET`
* **URL Params**:
    * `limit=[int]` (Optional, default 10)
    * `offset=[int]` (Optional, default 0)
* **Success Response**:
    * **Code**: 200 OK
    * **Content**:
        ```json
        {
          "total_records": 45,
          "records": [
            {
              "executed_at": "2026-06-09T08:00:05Z",
              "trigger_type": "AI_SCHEDULED",
              "duration_milliseconds": 3500,
              "status": "SUCCESS",
              "soil_moisture_before": 32.1,
              "soil_moisture_after": 55.4
            }
          ]
        }
        ```

### 3.3 Get AI Insights and Suggestions

* **URL**: `/api/v1/ai/suggestions`
* **Method**: `GET`
* **Success Response**:
    * **Code**: 200 OK
    * **Content**:
        ```json
        {
          "timestamp": "2026-06-09T17:20:00Z",
          "suggestions": [
            {
              "suggestion_id": "sug_20260609_001",
              "category": "ENVIRONMENT",
              "title": "Move Indoors",
              "description": "The outdoor temperature is dropping below the optimal threshold for this plant species. Moving the planter indoors is highly recommended.",
              "priority": "HIGH"
            },
            {
              "suggestion_id": "sug_20260609_002",
              "category": "FERTILIZATION",
              "title": "Fertilization Required",
              "description": "Analysis of the plant growth cycle indicates a depletion of soil nutrients. Please apply nitrogen-rich fertilizer.",
              "priority": "MEDIUM"
            },
            {
              "suggestion_id": "sug_20260609_003",
              "category": "HEALTH",
              "title": "Pest Inspection Recommended",
              "description": "Recent camera frame analysis detected minor discoloration patterns on the lower leaves. Please check for potential pest infestations.",
              "priority": "LOW"
            }
          ]
        }
        ```
## 4. System Configuration

### 4.1 Get Current Configuration

* **URL**: `/api/v1/system/config`
* **Method**: `GET`
* **Success Response**:
    * **Code**: 200 OK
    * **Content**:
        ```json
        {
          "sensor_read_interval_seconds": 60,
          "ai_evaluation_cron": "0 8,18 * * *",
          "safety_max_duration_milliseconds": 15000
        }
        ```

### 4.2 Update Configuration

* **URL**: `/api/v1/system/config`
* **Method**: `PUT`
* **Payload**:
    ```json
    {
      "sensor_read_interval_seconds": 30,
      "ai_evaluation_cron": "0 7,13,19 * * *"
    }
    ```
* **Success Response**:
    * **Code**: 200 OK
    * **Content**:
        ```json
        {
          "status": "success",
          "message": "Configuration updated successfully."
        }
        ```

## 5. Camera Stream

### **5.1 Get Real-time Camera Stream**
* **URL**: `/api/v1/camera/stream`
* **Method**: `GET`
* **Headers**: 
```http
Content-Type: multipart/x-mixed-replace; boundary=frame 
Cache-Control: no-cache, private
```
* **Success Response**:
    * **Code**: 200 OK
    * **Content**: Continuous JPEG Binary Stream separated by boundary