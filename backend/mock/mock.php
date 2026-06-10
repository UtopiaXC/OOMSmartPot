<?php

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

$serverRequestMethodString = $_SERVER['REQUEST_METHOD'];

if ($serverRequestMethodString === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$serverRequestUriString = $_SERVER['REQUEST_URI'];
$parsedUrlArray = parse_url($serverRequestUriString);
$requestPathString = $parsedUrlArray['path'];

$rawRequestBodyContentString = file_get_contents('php://input');
$parsedJsonRequestBodyArray = json_decode($rawRequestBodyContentString, true);

if ($requestPathString === '/api/v1/sensors/current') {
    if ($serverRequestMethodString === 'GET') {
        header('Content-Type: application/json');
        http_response_code(200);
        $sensorDataResponseArray = [
            "timestamp" => "2026-06-09T17:15:00Z",
            "temperature_celsius" => 24.5,
            "atmosphere_hpa" => 1012.3,
            "soil_moisture_percent" => 42.8,
            "light_intensity_lux" => 1250,
            "water_tank_level_percent" => 85.0
        ];
        echo json_encode($sensorDataResponseArray);
        exit();
    }
}

if ($requestPathString === '/api/v1/pump/action') {
    if ($serverRequestMethodString === 'POST') {
        header('Content-Type: application/json');
        $requestedActionString = "";
        if (isset($parsedJsonRequestBodyArray['action'])) {
            $requestedActionString = $parsedJsonRequestBodyArray['action'];
        }

        $durationMillisecondsInteger = 0;
        if (isset($parsedJsonRequestBodyArray['duration_milliseconds'])) {
            $durationMillisecondsInteger = $parsedJsonRequestBodyArray['duration_milliseconds'];
        }

        if ($requestedActionString === 'run') {
            http_response_code(202);
            $pumpActionSuccessResponseArray = [
                "status" => "executing",
                "message" => "Pump turned on, will automatically turn off after " . $durationMillisecondsInteger . "ms.",
                "estimated_end_time" => "2026-06-09T17:15:05Z"
            ];
            echo json_encode($pumpActionSuccessResponseArray);
            exit();
        }

        http_response_code(400);
        $pumpActionErrorResponseArray = [
            "error" => "INVALID_ACTION",
            "message" => "Action denied."
        ];
        echo json_encode($pumpActionErrorResponseArray);
        exit();
    }
}

if ($requestPathString === '/api/v1/pump/status') {
    if ($serverRequestMethodString === 'GET') {
        header('Content-Type: application/json');
        http_response_code(200);
        $pumpStatusResponseArray = [
            "is_running" => false,
            "last_executed_time" => "2026-06-09T12:00:00Z",
            "last_duration_milliseconds" => 3000,
            "hardware_healthy" => true
        ];
        echo json_encode($pumpStatusResponseArray);
        exit();
    }
}

if ($requestPathString === '/api/v1/pump/stop') {
    if ($serverRequestMethodString === 'POST') {
        header('Content-Type: application/json');
        http_response_code(200);
        $pumpStopResponseArray = [
            "status" => "stopped",
            "message" => "Pump stopped"
        ];
        echo json_encode($pumpStopResponseArray);
        exit();
    }
}

if ($requestPathString === '/api/v1/schedule/upcoming') {
    if ($serverRequestMethodString === 'GET') {
        header('Content-Type: application/json');
        http_response_code(200);
        $upcomingScheduleResponseArray = [
            "generated_at" => "2026-06-09T08:00:00Z",
            "ai_decision_summary" => "Based on photo analysis showing dry leaves and soil moisture at 35%, increasing watering frequency.",
            "schedules" => [
                [
                    "schedule_id" => "sch_20260609_1800",
                    "planned_time" => "2026-06-09T18:00:00Z",
                    "duration_milliseconds" => 4000,
                    "executed" => false
                ]
            ]
        ];
        echo json_encode($upcomingScheduleResponseArray);
        exit();
    }
}

if ($requestPathString === '/api/v1/schedule/history') {
    if ($serverRequestMethodString === 'GET') {
        header('Content-Type: application/json');
        http_response_code(200);
        $limitParameterInteger = 10;
        if (isset($_GET['limit'])) {
            $limitParameterInteger = intval($_GET['limit']);
        }
        $offsetParameterInteger = 0;
        if (isset($_GET['offset'])) {
            $offsetParameterInteger = intval($_GET['offset']);
        }
        $scheduleHistoryResponseArray = [
            "total_records" => 45,
            "records" => [
                [
                    "executed_at" => "2026-06-09T08:00:05Z",
                    "trigger_type" => "AI_SCHEDULED",
                    "duration_milliseconds" => 3500,
                    "status" => "SUCCESS",
                    "soil_moisture_before" => 32.1,
                    "soil_moisture_after" => 55.4
                ]
            ]
        ];
        echo json_encode($scheduleHistoryResponseArray);
        exit();
    }
}

if ($requestPathString === '/api/v1/ai/suggestions') {
    if ($serverRequestMethodString === 'GET') {
        header('Content-Type: application/json');
        http_response_code(200);
        $aiSuggestionsResponseArray = [
            "timestamp" => "2026-06-09T17:20:00Z",
            "suggestions" => [
                [
                    "suggestion_id" => "sug_20260609_001",
                    "category" => "ENVIRONMENT",
                    "title" => "Move Indoors",
                    "description" => "The outdoor temperature is dropping below the optimal threshold for this plant species. Moving the planter indoors is highly recommended.",
                    "priority" => "HIGH"
                ],
                [
                    "suggestion_id" => "sug_20260609_002",
                    "category" => "FERTILIZATION",
                    "title" => "Fertilization Required",
                    "description" => "Analysis of the plant growth cycle indicates a depletion of soil nutrients. Please apply nitrogen-rich fertilizer.",
                    "priority" => "MEDIUM"
                ],
                [
                    "suggestion_id" => "sug_20260609_003",
                    "category" => "HEALTH",
                    "title" => "Pest Inspection Recommended",
                    "description" => "Recent camera frame analysis detected minor discoloration patterns on the lower leaves. Please check for potential pest infestations.",
                    "priority" => "LOW"
                ]
            ]
        ];
        echo json_encode($aiSuggestionsResponseArray);
        exit();
    }
}

if ($requestPathString === '/api/v1/system/config') {
    if ($serverRequestMethodString === 'GET') {
        header('Content-Type: application/json');
        http_response_code(200);
        $systemConfigGetResponseArray = [
            "sensor_read_interval_seconds" => 60,
            "ai_evaluation_cron" => "0 8,18 * * *",
            "safety_max_duration_milliseconds" => 15000
        ];
        echo json_encode($systemConfigGetResponseArray);
        exit();
    }

    if ($serverRequestMethodString === 'PUT') {
        header('Content-Type: application/json');
        http_response_code(200);
        $systemConfigUpdateResponseArray = [
            "status" => "success",
            "message" => "Configuration updated successfully."
        ];
        echo json_encode($systemConfigUpdateResponseArray);
        exit();
    }
}

if ($requestPathString === '/api/v1/camera/stream') {
    if ($serverRequestMethodString === 'GET') {
        header('Content-Type: multipart/x-mixed-replace; boundary=frame');
        header('Cache-Control: no-cache, private');
        http_response_code(200);
        $multipartBoundaryString = "--frame\r\nContent-Type: image/jpeg\r\n\r\n";
        $mockJpegBinaryDataString = "mock_jpeg_binary_stream_data_placeholder";
        echo $multipartBoundaryString;
        echo $mockJpegBinaryDataString;
        echo "\r\n";
        exit();
    }
}

header('Content-Type: application/json');
http_response_code(404);
$endpointNotFoundResponseArray = [
    "error" => "NOT_FOUND",
    "message" => "Endpoint does not exist in mock system."
];
echo json_encode($endpointNotFoundResponseArray);
exit();