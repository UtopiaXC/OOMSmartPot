"""
Camera streaming and snapshot router.
"""
import base64
from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from adapters.hardware import hardware_adapter
from schemas import CameraSnapshotResponse

router = APIRouter(prefix="/api/v1/camera", tags=["Camera Stream"])


@router.get("/stream")
async def get_live_video_stream():
    """Get live MJPEG video stream from the camera."""
    return StreamingResponse(
        hardware_adapter.get_video_stream_frame(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-cache, private"}
    )


@router.get("/snapshot", response_model=CameraSnapshotResponse)
async def get_camera_snapshot():
    """Capture a single JPEG frame from the camera and return as base64."""
    jpeg_bytes = hardware_adapter.capture_snapshot_jpeg()
    image_b64 = base64.b64encode(jpeg_bytes).decode('utf-8')

    return CameraSnapshotResponse(
        timestamp=datetime.now(timezone.utc),
        image_base64=image_b64,
        format="jpeg"
    )