import asyncio
import logging

import cv2
import numpy

logger = logging.getLogger(__name__)


class CameraDriver:
    def __init__(self):
        self._camera = None
        self._is_real = False
        self._initialized = False

    def _initialize(self):
        if self._initialized:
            return
        self._initialized = True
        try:
            self._camera = cv2.VideoCapture('/dev/video0', cv2.CAP_V4L2)
            if self._camera.isOpened():
                self._is_real = True
                logger.info("Camera initialized with cv2")
            else:
                self._is_real = False
                logger.warning("Camera failed to open, using placeholder")
        except Exception as exception_instance:
            logger.warning(f"Failed to initialize cv2 camera: {exception_instance}")
            self._camera = None
            self._is_real = False

    @property
    def is_real_hardware(self) -> bool:
        self._initialize()
        return self._is_real

    def capture_jpeg(self) -> bytes:
        self._initialize()
        if self._is_real:
            if self._camera is not None:
                capture_success, frame_data = self._camera.read()
                if capture_success:
                    encode_success, buffer_data = cv2.imencode('.jpg', frame_data)
                    if encode_success:
                        return buffer_data.tobytes()
        
        return self._generate_placeholder_jpeg()

    def _generate_placeholder_jpeg(self) -> bytes:
        import os
        current_dir = os.path.dirname(os.path.abspath(__file__))
        image_path = os.path.join(current_dir, "test_image.png")
        try:
            with open(image_path, "rb") as f:
                return f.read()
        except Exception as e:
            logger.error(f"Failed to load {image_path}: {e}")
            
        # Fallback to generated image
        placeholder_image = numpy.zeros((480, 640, 3), dtype=numpy.uint8)
        placeholder_image[:] = (34, 139, 34)
        
        cv2.putText(
            placeholder_image,
            "OOMSmartPot Camera",
            (160, 200),
            cv2.FONT_HERSHEY_SIMPLEX,
            1.0,
            (255, 255, 255),
            2,
            cv2.LINE_AA
        )
        cv2.putText(
            placeholder_image,
            "[Placeholder Mode]",
            (200, 240),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (200, 200, 200),
            2,
            cv2.LINE_AA
        )
        
        encode_success, buffer_data = cv2.imencode('.jpg', placeholder_image)
        if encode_success:
            return buffer_data.tobytes()
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
        while True:
            frame_bytes = await asyncio.to_thread(self.capture_jpeg)
            yield (
                b'--frame\r\n'
                b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n'
            )
            await asyncio.sleep(0.1)

    def close(self):
        if self._is_real:
            if self._camera is not None:
                self._camera.release()