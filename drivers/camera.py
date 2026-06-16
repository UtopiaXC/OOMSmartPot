"""
Camera driver for OOMSmartPot.
Supports picamera2 (Raspberry Pi Camera) with fallback to a generated placeholder.
"""
import asyncio
import io
import logging

logger = logging.getLogger(__name__)

# Try to import picamera2 (only available on Raspberry Pi)
try:
    from picamera2 import Picamera2
    _PICAMERA2_AVAILABLE = True
except ImportError:
    _PICAMERA2_AVAILABLE = False
    logger.warning("picamera2 not available, camera will use placeholder images")

# Try to use PIL for placeholder generation
try:
    from PIL import Image, ImageDraw, ImageFont
    _PIL_AVAILABLE = True
except ImportError:
    _PIL_AVAILABLE = False


class CameraDriver:
    """Camera driver with automatic hardware detection and fallback."""

    def __init__(self):
        self._camera = None
        self._is_real = False
        self._initialize()

    def _initialize(self):
        """Try to initialize real camera hardware."""
        if _PICAMERA2_AVAILABLE:
            try:
                self._camera = Picamera2()
                config = self._camera.create_still_configuration(
                    main={"size": (640, 480), "format": "RGB888"}
                )
                self._camera.configure(config)
                self._camera.start()
                self._is_real = True
                logger.info("Camera initialized with picamera2")
            except Exception as e:
                logger.warning(f"Failed to initialize picamera2: {e}, using placeholder")
                self._camera = None
                self._is_real = False
        else:
            logger.info("Camera running in placeholder mode (no picamera2)")

    @property
    def is_real_hardware(self) -> bool:
        return self._is_real

    def capture_jpeg(self) -> bytes:
        """Capture a single JPEG frame."""
        if self._is_real and self._camera is not None:
            try:
                buf = io.BytesIO()
                self._camera.capture_file(buf, format='jpeg')
                return buf.getvalue()
            except Exception as e:
                logger.error(f"Camera capture failed: {e}")
                return self._generate_placeholder_jpeg()
        else:
            return self._generate_placeholder_jpeg()

    def _generate_placeholder_jpeg(self) -> bytes:
        """Generate a placeholder JPEG image for development/testing."""
        if _PIL_AVAILABLE:
            img = Image.new('RGB', (640, 480), color=(34, 139, 34))
            draw = ImageDraw.Draw(img)
            try:
                font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24)
            except (IOError, OSError):
                font = ImageFont.load_default()
            draw.text(
                (160, 200),
                "OOMSmartPot Camera",
                fill=(255, 255, 255),
                font=font
            )
            draw.text(
                (200, 240),
                "[Placeholder Mode]",
                fill=(200, 200, 200),
                font=font
            )
            buf = io.BytesIO()
            img.save(buf, format='JPEG', quality=80)
            return buf.getvalue()
        else:
            # Minimal valid JPEG if PIL is not available
            return (
                b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00'
                b'\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t'
                b'\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a'
                b'\x1f\x1e\x1d\x1a\x1c\x1c $.\' "21\x1c\x1c748:::#bEHI0@B::A'
                b'\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00'
                b'\xff\xc4\x00\x15\x00\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00'
                b'\x00\x00\x00\x00\x00\x00\x03'
                b'\xff\xda\x00\x08\x01\x01\x00\x00?\x007\xff\xd9'
            )

    async def generate_mjpeg_stream(self):
        """Yield MJPEG frames for streaming endpoint."""
        while True:
            frame = self.capture_jpeg()
            yield (
                b'--frame\r\n'
                b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n'
            )
            await asyncio.sleep(0.1)  # ~10 fps

    def close(self):
        """Clean up camera resources."""
        if self._is_real and self._camera is not None:
            try:
                self._camera.stop()
                self._camera.close()
            except Exception:
                pass
